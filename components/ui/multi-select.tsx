"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Search, Check, X } from "lucide-react";

export type Opcao = { value: string; label: string };

export default function MultiSelect({
  label,
  opcoes,
  selecionados,
  onChange,
  placeholder = "Buscar…",
  textoTodos = "Todas",
  className = "",
}: {
  label?: string;
  opcoes: Opcao[];
  selecionados: string[];
  onChange: (vals: string[]) => void;
  placeholder?: string;
  textoTodos?: string;
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    if (aberto) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [aberto]);

  const filtradas = opcoes.filter((o) =>
    o.label.toLowerCase().includes(busca.trim().toLowerCase()),
  );

  const campoId = useId();

  function toggle(v: string) {
    if (selecionados.includes(v)) onChange(selecionados.filter((x) => x !== v));
    else onChange([...selecionados, v]);
  }

  const resumo =
    selecionados.length === 0
      ? textoTodos
      : selecionados.length === 1
        ? opcoes.find((o) => o.value === selecionados[0])?.label ?? "1 selecionado"
        : `${opcoes.find((o) => o.value === selecionados[0])?.label ?? "1"} +${selecionados.length - 1}`;

  return (
    <div className={className}>
      {/* `useId` porque o mesmo MultiSelect aparece várias vezes na mesma tela;
          um id fixo colidiria e o rótulo apontaria para o campo errado */}
      {label && (
        <label htmlFor={campoId} className="mb-1 block text-[11px] font-semibold text-ink-soft">
          {label}
        </label>
      )}
      <div ref={ref} className="relative">
        <button
          id={campoId}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={aberto}
          onClick={() => setAberto((a) => !a)}
          className={`flex w-full min-w-[140px] items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm outline-none transition ${
            selecionados.length > 0 ? "border-brand/50 bg-brand-light/30" : "border-line"
          } focus:border-brand`}
        >
          <span className={`truncate ${selecionados.length === 0 ? "text-ink-soft" : "font-medium text-ink"}`}>
            {resumo}
          </span>
          <ChevronDown size={14} className={`shrink-0 text-ink-soft transition ${aberto ? "rotate-180" : ""}`} />
        </button>

        {aberto && (
          <div className="absolute z-50 mt-1 w-full min-w-[210px] rounded-xl border border-line bg-white p-2 shadow-lg">
            <div className="relative mb-2">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft" />
              <input
                autoFocus
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder={placeholder}
                className="w-full rounded-lg border border-line py-1.5 pl-8 pr-2 text-sm outline-none focus:border-brand"
              />
            </div>
            <div className="max-h-56 overflow-y-auto">
              {filtradas.length === 0 ? (
                <p className="px-2 py-3 text-center text-xs text-ink-soft">Nada encontrado</p>
              ) : (
                filtradas.map((o) => {
                  const on = selecionados.includes(o.value);
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => toggle(o.value)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-surface"
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          on ? "border-brand bg-brand text-white" : "border-line"
                        }`}
                      >
                        {on && <Check size={11} />}
                      </span>
                      <span className="truncate text-ink">{o.label}</span>
                    </button>
                  );
                })
              )}
            </div>
            {selecionados.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="mt-2 flex w-full items-center justify-center gap-1 border-t border-line pt-2 text-xs font-medium text-ink-soft transition hover:text-danger"
              >
                <X size={12} /> Limpar seleção
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

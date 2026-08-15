"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { classeControle } from "@/components/ui/campo";

export type ComboOpt = { id: string; nome: string; sub?: string | null };

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function soDigitos(s: string): string {
  return s.replace(/\D/g, "");
}

// Select pesquisável: filtra por nome e, quando houver, por sub (ex.: CPF/CNPJ).
export default function ComboBusca({
  value,
  onChange,
  options,
  placeholder = "Selecionar…",
  className = "",
  id,
}: {
  value: string;
  onChange: (id: string) => void;
  options: ComboOpt[];
  placeholder?: string;
  className?: string;
  /** alvo do `htmlFor` do rótulo que a tela desenha ao lado */
  id?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const sel = options.find((o) => o.id === value) ?? null;

  useEffect(() => {
    function fora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, []);

  const q = norm(busca.trim());
  const qDig = soDigitos(busca);
  const filtradas = q
    ? options.filter(
        (o) =>
          norm(o.nome).includes(q) ||
          (!!o.sub && norm(o.sub).includes(q)) ||
          (!!o.sub && qDig.length > 0 && soDigitos(o.sub).includes(qDig)),
      )
    : options;

  return (
    <div className={`relative ${className}`} ref={ref}>
      {/*
        `id` no gatilho para que o rótulo da tela possa apontar para cá.

        O controle é um `<button>` que abre um popover, não um `<select>` — mas
        para quem clica no rótulo e para o leitor de tela, ele é o campo. Sem um
        alvo, os `<label>` que existem ao lado ficavam decorativos. `aria-haspopup`
        e `aria-expanded` dizem o que acontece ao acionar.
      */}
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
        className={classeControle("md", false, "flex items-center justify-between gap-1 bg-white text-left")}
      >
        <span className={`truncate ${sel ? "text-ink" : "text-ink-soft"}`}>{sel ? sel.nome : placeholder}</span>
        <ChevronDown size={14} className="shrink-0 text-ink-soft" />
      </button>
      {aberto && (
        <div className="absolute z-30 mt-1 w-full min-w-[220px] rounded-lg border border-line bg-white shadow-lg">
          <div className="border-b border-line p-1.5">
            <input
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou CPF/CNPJ…"
              className="w-full rounded-md border border-line px-2 py-1 text-sm outline-none focus:border-brand"
            />
          </div>
          <div className="max-h-56 overflow-auto py-1">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setAberto(false);
                setBusca("");
              }}
              className="flex w-full items-center px-2.5 py-1.5 text-left text-sm text-ink-soft hover:bg-surface"
            >
              {placeholder}
            </button>
            {filtradas.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  onChange(o.id);
                  setAberto(false);
                  setBusca("");
                }}
                className={`flex w-full flex-col px-2.5 py-1.5 text-left hover:bg-surface ${o.id === value ? "bg-brand-light/40" : ""}`}
              >
                <span className="truncate text-sm text-ink">{o.nome}</span>
                {o.sub && <span className="truncate text-[11px] text-ink-soft">{o.sub}</span>}
              </button>
            ))}
            {filtradas.length === 0 && <p className="px-2.5 py-2 text-xs text-ink-soft">Nada encontrado.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

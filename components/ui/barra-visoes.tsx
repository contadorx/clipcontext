"use client";

import { useEffect, useRef, useState } from "react";
import { Bookmark, BookmarkPlus, Check, Link as LinkIcon, Trash2, Users } from "lucide-react";
import type { Visao } from "@/lib/visoes";
import { useToast } from "@/components/ui/toast";
import Botao from "@/components/ui/botao";
import { classeControle } from "@/components/ui/campo";

/**
 * Barra de visões salvas — o recorte de filtros vira um chip nomeado.
 * O botão de link copia a URL com todos os filtros embutidos.
 */
export default function BarraVisoes({
  visoes,
  ativaId,
  sujo,
  onAplicar,
  onLimpar,
  onSalvar,
  onApagar,
}: {
  visoes: Visao[];
  ativaId: string | null;
  /** true quando o usuário mexeu nos filtros depois de aplicar uma visão */
  sujo: boolean;
  onAplicar: (v: Visao) => void;
  onLimpar: () => void;
  onSalvar: (nome: string, compartilhada: boolean) => Promise<string | null>;
  onApagar: (v: Visao) => Promise<void>;
}) {
  const { toast } = useToast();
  const [abrindo, setAbrindo] = useState(false);
  const [nome, setNome] = useState("");
  const [compart, setCompart] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const caixaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (abrindo) setTimeout(() => inputRef.current?.focus(), 20);
  }, [abrindo]);

  useEffect(() => {
    if (!abrindo) return;
    function fora(e: MouseEvent) {
      if (caixaRef.current && !caixaRef.current.contains(e.target as Node)) setAbrindo(false);
    }
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [abrindo]);

  async function salvar() {
    const n = nome.trim();
    if (!n) return;
    setSalvando(true);
    const erro = await onSalvar(n, compart);
    setSalvando(false);
    if (erro) {
      toast(erro, { tom: "erro" });
      return;
    }
    setNome("");
    setCompart(false);
    setAbrindo(false);
    toast(`Visão "${n}" salva.`);
  }

  function copiarLink() {
    const url = window.location.href;
    navigator.clipboard?.writeText(url).then(
      () => toast("Link desta visão copiado — abre com os mesmos filtros."),
      () => toast("Não foi possível copiar o link.", { tom: "erro" }),
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={onLimpar}
        className={[
          "flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition",
          !ativaId
            ? "border-brand bg-brand-light text-brand-dark"
            : "border-line bg-white text-ink-muted hover:border-brand hover:text-brand-dark",
        ].join(" ")}
      >
        Período todo
      </button>

      {visoes.map((v) => {
        const ativa = v.id === ativaId;
        return (
          <span
            key={v.id}
            className={[
              "group flex h-8 items-center gap-1.5 rounded-full border pl-3 pr-1.5 text-xs font-bold transition",
              ativa
                ? "border-brand bg-brand-light text-brand-dark"
                : "border-line bg-white text-ink-muted hover:border-brand hover:text-brand-dark",
            ].join(" ")}
          >
            <button type="button" onClick={() => onAplicar(v)} className="flex items-center gap-1.5">
              {v.compartilhada ? <Users size={12} /> : <Bookmark size={12} />}
              {v.nome}
              {ativa && sujo && <span title="filtros alterados" className="text-[10px] font-black">•</span>}
            </button>
            {v.minha && (
              <button
                type="button"
                title="Apagar visão"
                onClick={async () => {
                  await onApagar(v);
                }}
                className="hidden h-5 w-5 items-center justify-center rounded-full text-ink-soft transition hover:bg-white hover:text-danger group-hover:flex"
              >
                <Trash2 size={11} />
              </button>
            )}
          </span>
        );
      })}

      <div className="relative" ref={caixaRef}>
        <button
          type="button"
          onClick={() => setAbrindo((v) => !v)}
          className="flex h-8 items-center gap-1.5 rounded-full border border-dashed border-line bg-white px-3 text-xs font-bold text-ink-soft transition hover:border-brand hover:text-brand-dark"
        >
          <BookmarkPlus size={13} /> Salvar visão
        </button>

        {abrindo && (
          <div className="absolute left-0 top-10 z-30 w-72 rounded-xl2 bg-white p-3 shadow-card">
            <label className="mb-1 block text-[11px] font-semibold text-ink-soft">Nome da visão</label>
            <input
              ref={inputRef}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") salvar();
                if (e.key === "Escape") setAbrindo(false);
              }}
              placeholder="Ex.: Vencidos do Bradesco"
              className={classeControle("md")}
            />
            <label className="mt-2.5 flex cursor-pointer items-center gap-2 text-xs font-semibold text-ink-muted">
              <input
                type="checkbox"
                checked={compart}
                onChange={(e) => setCompart(e.target.checked)}
                className="h-3.5 w-3.5 accent-brand"
              />
              Compartilhar com a equipe da empresa
            </label>
            <p className="mt-2 text-[11px] leading-snug text-ink-soft">
              Guarda o recorte atual desta tela — todos os filtros de cima.
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAbrindo(false)}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-ink-soft transition hover:bg-surface"
              >
                Cancelar
              </button>
              <Botao variante="primario" tamanho="sm"
                onClick={salvar}
                disabled={!nome.trim() || salvando}
              >
                <Check size={13} /> {salvando ? "Salvando…" : "Salvar"}
              </Botao>
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={copiarLink}
        title="Copiar link com estes filtros"
        className="flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold text-ink-soft transition hover:bg-surface hover:text-ink"
      >
        <LinkIcon size={13} /> Copiar link
      </button>
    </div>
  );
}

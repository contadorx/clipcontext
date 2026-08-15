"use client";

import { useRef, useState } from "react";
import { X, Plus, Trash2, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { mascaraMoeda, parseMoeda } from "@/lib/formato";
import { useAtalhosModal } from "@/lib/atalhos";
import MessageStrip from "@/components/ui/message-strip";
import Botao from "@/components/ui/botao";

type Cat = { id: string; nome: string; tipo: string };
type Conta = { id: string; nome: string };
type Linha = { descricao: string; valor: string; venc: string; categoriaId: string };

function hoje(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function linhaVazia(): Linha {
  return { descricao: "", valor: "", venc: hoje(), categoriaId: "" };
}

const inputCls =
  "w-full rounded-lg border border-line bg-white px-2.5 py-2 text-sm outline-none focus:border-brand";

export default function LancamentoRapido({
  empresaId,
  aberto,
  categorias,
  contas,
  onFechar,
  onSalvo,
}: {
  empresaId: string;
  aberto: boolean;
  categorias: Cat[];
  contas: Conta[];
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [tipo, setTipo] = useState<"saida" | "entrada">("saida");
  const [contaId, setContaId] = useState("");
  const [linhas, setLinhas] = useState<Linha[]>([linhaVazia(), linhaVazia(), linhaVazia()]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const descRefs = useRef<(HTMLInputElement | null)[]>([]);

  useAtalhosModal(aberto, { onFechar, onConfirmar: () => salvar() });

  if (!aberto) return null;

  const tipoCat = tipo === "entrada" ? "receber" : "pagar";
  const cats = categorias.filter((c) => c.tipo === tipoCat);

  function mudarTipo(t: "saida" | "entrada") {
    setTipo(t);
    setLinhas((ls) => ls.map((l) => ({ ...l, categoriaId: "" })));
  }

  function setLinha(i: number, patch: Partial<Linha>) {
    setLinhas((ls) => {
      const n = ls.map((l, k) => (k === i ? { ...l, ...patch } : l));
      const ultima = n[n.length - 1];
      if (ultima.descricao || ultima.valor || ultima.categoriaId) n.push(linhaVazia());
      return n;
    });
  }
  function removerLinha(i: number) {
    setLinhas((ls) => {
      const n = ls.filter((_, k) => k !== i);
      return n.length ? n : [linhaVazia()];
    });
  }

  const comValor = linhas.filter((l) => parseMoeda(l.valor) > 0);
  const total = comValor.reduce((s, l) => s + parseMoeda(l.valor), 0);

  async function salvar() {
    setErro(null);
    if (!contaId) return setErro("Escolha a conta.");
    if (comValor.length === 0) return setErro("Preencha ao menos um lançamento com valor.");
    for (const l of comValor) {
      if (!l.categoriaId) return setErro("Toda linha com valor precisa de categoria.");
      if (!l.venc) return setErro("Toda linha com valor precisa de vencimento.");
    }
    setSalvando(true);
    const supabase = createClient();
    const rows = comValor.map((l) => ({
      empresa_id: empresaId,
      tipo,
      valor: parseMoeda(l.valor),
      descricao: l.descricao.trim() || null,
      categoria_id: l.categoriaId,
      conta_id: contaId,
      data_competencia: l.venc,
      data_vencimento: l.venc,
      data_pagamento: null,
      data_agendamento: null,
      transferencia: false,
    }));
    const { error } = await supabase.from("lancamentos").insert(rows);
    setSalvando(false);
    if (error) return setErro(error.message);
    onSalvo();
    onFechar();
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("fs-mov-changed"));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-rail/50 p-4"
      onClick={onFechar}
    >
      <div
        className="my-8 w-full max-w-3xl rounded-xl2 bg-white p-5 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="dlg-lancamento-rapido-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 id="dlg-lancamento-rapido-titulo" className="flex items-center gap-2 text-base font-bold text-ink">
            <Zap size={18} className="text-brand" /> Lançamento rápido
          </h3>
          <button
                aria-label="Fechar"
            type="button"
            onClick={onFechar}
            className="rounded-lg p-1.5 text-ink-soft transition hover:bg-surface"
          >
            <X size={18} />
          </button>
        </div>
        <p className="mt-1 text-xs text-ink-muted">
          Escolha o tipo e a conta uma vez; depois preencha as linhas. Todos entram como previsto
          (a {tipo === "entrada" ? "receber" : "pagar"}).
        </p>

        {/* tipo + conta */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-line p-0.5">
            <button
              type="button"
              onClick={() => mudarTipo("saida")}
              className={
                tipo === "saida"
                  ? "rounded-md bg-danger px-3 py-1.5 text-xs font-semibold text-white"
                  : "px-3 py-1.5 text-xs font-semibold text-ink-muted"
              }
            >
              Saídas
            </button>
            <button
              type="button"
              onClick={() => mudarTipo("entrada")}
              className={
                tipo === "entrada"
                  ? "rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white"
                  : "px-3 py-1.5 text-xs font-semibold text-ink-muted"
              }
            >
              Entradas
            </button>
          </div>
          <select
            value={contaId}
            onChange={(e) => setContaId(e.target.value)}
            className="rounded-lg border border-line bg-white px-2.5 py-2 text-sm outline-none focus:border-brand"
          >
            <option value="">Conta…</option>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>

        {/* grade */}
        <div className="mt-4 space-y-2">
          <div className="hidden grid-cols-[1fr_120px_150px_1fr_32px] gap-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-ink-soft sm:grid">
            <span>Descrição</span>
            <span>Valor</span>
            <span>Vencimento</span>
            <span>Categoria</span>
            <span></span>
          </div>
          {linhas.map((l, i) => (
            <div
              key={i}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !(e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  descRefs.current[i + 1]?.focus();
                }
              }}
              className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px_150px_1fr_32px]"
            >
              <input
                ref={(el) => {
                  descRefs.current[i] = el;
                }}
                value={l.descricao}
                onChange={(e) => setLinha(i, { descricao: e.target.value })}
                placeholder="Descrição"
                className={inputCls}
              />
              <input
                value={l.valor}
                onChange={(e) => setLinha(i, { valor: mascaraMoeda(e.target.value) })}
                inputMode="numeric"
                placeholder="0,00"
                className={`num ${inputCls}`}
              />
              <input
                type="date"
                value={l.venc}
                onChange={(e) => setLinha(i, { venc: e.target.value })}
                className={`num ${inputCls}`}
              />
              <select
                value={l.categoriaId}
                onChange={(e) => setLinha(i, { categoriaId: e.target.value })}
                className={inputCls}
              >
                <option value="">Categoria…</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => removerLinha(i)}
                className="flex items-center justify-center rounded-lg text-ink-soft transition hover:bg-surface hover:text-danger"
                title="Remover linha"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setLinhas((ls) => [...ls, linhaVazia()])}
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
        >
          <Plus size={13} /> Adicionar linha
        </button>

        {erro && <MessageStrip tipo="erro" className="mt-3">{erro}</MessageStrip>}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <span className="text-sm text-ink-muted">
            {comValor.length} lançamento{comValor.length === 1 ? "" : "s"} ·{" "}
            <span className="num font-bold text-ink">
              {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onFechar}
              className="rounded-md border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-muted transition hover:bg-surface"
            >
              Cancelar
            </button>
            <Botao variante="primario"
              onClick={salvar}
              disabled={salvando}
            >
              {salvando ? "Salvando…" : "Salvar todos"}
            </Botao>
          </div>
        </div>
      </div>
    </div>
  );
}

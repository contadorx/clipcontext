"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Repeat, Pause, Play, Pencil, Check, X, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { brl } from "@/lib/formato";
import EmptyState from "@/components/ui/empty-state";

export type RecorrenciaRow = {
  id: string;
  tipo: string;
  valor: number;
  descricao: string | null;
  dia_vencimento: number;
  ativa: boolean;
  proxima_competencia: string;
  categoria_nome: string | null;
  pessoa_nome: string | null;
};

function compBR(comp: string): string {
  const [a, m] = comp.slice(0, 7).split("-");
  return `${m}/${a}`;
}

export default function RecorrenciasClient({
  empresaId,
  recorrencias,
}: {
  empresaId: string;
  recorrencias: RecorrenciaRow[];
}) {
  const router = useRouter();
  const [editId, setEditId] = useState<string | null>(null);
  const [editValor, setEditValor] = useState("");
  const [editDia, setEditDia] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  // edição inline: Esc cancela · Ctrl/⌘+Enter salva
  useEffect(() => {
    if (editId === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setEditId(null);
      } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        const r = recorrencias.find((x) => x.id === editId);
        if (r) {
          e.preventDefault();
          salvarEdicao(r);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editId, recorrencias, salvarEdicao]);

  async function togglePausa(r: RecorrenciaRow) {
    const supabase = createClient();
    /*
      Pausar sem verificar é a mentira mais cara desta tela: a mensagem afirma
      "não gera mais parcelas até reativar" e a recorrência continua criando
      lançamento todo mês, no cron. A pessoa só descobre quando aparece a
      terceira parcela de um contrato que ela cancelou.
    */
    const rp = await supabase
      .from("recorrencias")
      .update({ ativa: !r.ativa, atualizado_em: new Date().toISOString() })
      .eq("id", r.id);
    if (rp.error) {
      setMsg(`Não foi possível ${r.ativa ? "pausar" : "reativar"}: ${rp.error.message}`);
      return;
    }
    setMsg(r.ativa ? "Recorrência pausada — não gera mais parcelas até reativar." : "Recorrência reativada.");
    router.refresh();
  }

  function abrirEdicao(r: RecorrenciaRow) {
    setEditId(r.id);
    setEditValor(String(r.valor).replace(".", ","));
    setEditDia(String(r.dia_vencimento));
  }

  async function salvarEdicao(r: RecorrenciaRow) {
    const valor = Number(editValor.replace(/\./g, "").replace(",", "."));
    const dia = Math.min(Math.max(1, Number(editDia) || r.dia_vencimento), 31);
    if (!valor || valor <= 0) {
      setMsg("Informe um valor válido.");
      return;
    }
    const supabase = createClient();
    const rr = await supabase
      .from("recorrencias")
      .update({ valor, dia_vencimento: dia, atualizado_em: new Date().toISOString() })
      .eq("id", r.id);
    if (rr.error) {
      setMsg(`Não foi possível salvar o reajuste: ${rr.error.message}`);
      return;
    }
    setEditId(null);
    setMsg("Reajuste salvo — vale para os próximos meses; as parcelas já criadas não mudam.");
    router.refresh();
  }

  async function excluir(r: RecorrenciaRow) {
    const supabase = createClient();
    // os lançamentos já gerados permanecem (o vínculo vira null); só a regra é removida
    const re = await supabase.from("recorrencias").delete().eq("id", r.id);
    if (re.error) {
      setMsg(`Não foi possível encerrar: ${re.error.message}. A recorrência continua gerando parcelas.`);
      return;
    }
    setMsg("Recorrência encerrada. Os lançamentos já criados continuam no sistema.");
    router.refresh();
  }

  if (recorrencias.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl2 bg-white px-4 py-12 text-center shadow-card">
        <Repeat size={26} strokeWidth={1.5} className="text-ink-soft" />
        <EmptyState compacto titulo="Nenhuma recorrência contínua ainda" />
        <p className="mt-1 max-w-md text-xs text-ink-muted">
          Ao lançar uma conta que se repete (aluguel, mensalidade, assinatura), marque "Repetir mensalmente" e
          escolha "Sem fim (contínuo)". Ela aparece aqui para você pausar, reajustar ou encerrar quando quiser.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {msg && <p className="rounded-lg bg-surface px-3 py-2 text-xs font-medium text-ink-muted ring-1 ring-inset ring-line">{msg}</p>}
      <div className="overflow-hidden rounded-xl2 bg-white shadow-card">
        {recorrencias.map((r) => {
          const entrada = r.tipo === "entrada";
          const emEdicao = editId === r.id;
          return (
            <div key={r.id} className={`border-b border-line/60 px-4 py-3 last:border-0 ${!r.ativa ? "bg-surface/40" : ""}`}>
              <div className="flex items-center gap-3">
                {entrada ? (
                  <ArrowDownCircle size={18} className="shrink-0 text-brand" />
                ) : (
                  <ArrowUpCircle size={18} className="shrink-0 text-danger" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    {r.descricao || (entrada ? "Receita recorrente" : "Despesa recorrente")}
                    {!r.ativa && <span className="ml-2 text-[10px] font-bold uppercase text-ink-soft">pausada</span>}
                  </p>
                  <p className="truncate text-[11px] text-ink-soft">
                    {r.categoria_nome ?? "sem categoria"}
                    {r.pessoa_nome ? ` · ${r.pessoa_nome}` : ""} · todo dia {r.dia_vencimento} ·{" "}
                    {r.ativa ? `próxima: ${compBR(r.proxima_competencia)}` : "sem próximas"}
                  </p>
                </div>

                {emEdicao ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      value={editValor}
                      onChange={(e) => setEditValor(e.target.value.replace(/[^\d,\.]/g, ""))}
                      className="num w-24 rounded-lg border border-line px-2 py-1.5 text-right text-xs outline-none focus:border-brand"
                      placeholder="valor"
                    />
                    <input
                      value={editDia}
                      onChange={(e) => setEditDia(e.target.value.replace(/\D/g, ""))}
                      className="num w-12 rounded-lg border border-line px-2 py-1.5 text-center text-xs outline-none focus:border-brand"
                      placeholder="dia"
                      title="Dia do vencimento"
                    />
                    <button aria-label="Salvar edição" onClick={() => salvarEdicao(r)} className="rounded-lg bg-brand p-1.5 text-white hover:bg-brand-dark">
                      <Check size={14} />
                    </button>
                    <button aria-label="Cancelar edição" onClick={() => setEditId(null)} className="rounded-lg border border-line p-1.5 text-ink-soft hover:text-danger">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className={`num shrink-0 text-sm font-bold ${entrada ? "text-brand" : "text-ink"}`}>{brl(r.valor)}</span>
                    <button
                      onClick={() => abrirEdicao(r)}
                      title="Reajustar valor ou dia"
                      className="rounded-lg p-1.5 text-ink-soft transition hover:bg-surface hover:text-brand"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => togglePausa(r)}
                      title={r.ativa ? "Pausar" : "Reativar"}
                      className="rounded-lg p-1.5 text-ink-soft transition hover:bg-surface hover:text-brand"
                    >
                      {r.ativa ? <Pause size={14} /> : <Play size={14} />}
                    </button>
                    <button
                      onClick={() => excluir(r)}
                      title="Encerrar (mantém os lançamentos já criados)"
                      className="rounded-lg p-1.5 text-ink-soft transition hover:bg-surface hover:text-danger"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-ink-soft">
        Reajustes e pausas valem para os meses futuros. As parcelas já geradas continuam como estão — edite-as em
        Movimentos se precisar.
      </p>
    </div>
  );
}

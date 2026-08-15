"use client";

import { useState } from "react";
import { Download, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import EmptyState from "@/components/ui/empty-state";
import { brl } from "@/lib/formato";
import MessageStrip from "@/components/ui/message-strip";

export type RemessaRow = {
  id: string;
  tipo: string;
  banco_codigo: string | null;
  sequencial: number | null;
  quantidade: number | null;
  valor_total: number | null;
  arquivo_nome: string | null;
  criado_em: string;
  cancelada_em: string | null;
  conta: { nome: string } | null;
};

function dataHoraBR(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

export default function ArquivosBancariosClient({ remessas }: { remessas: RemessaRow[] }) {
  const [baixando, setBaixando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function baixar(r: RemessaRow) {
    setBaixando(r.id);
    setErro(null);
    const supabase = createClient();
    const { data, error } = await supabase.from("cnab_remessas").select("conteudo, arquivo_nome").eq("id", r.id).maybeSingle();
    setBaixando(null);
    if (error || !data?.conteudo) {
      setErro("Esta remessa não tem o arquivo guardado (foi gerada antes do histórico) — gere uma nova se precisar.");
      return;
    }
    const blob = new Blob([data.conteudo], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = data.arquivo_nome || `REMESSA_${r.sequencial ?? ""}.REM`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-4">
      {/* onde cada fluxo acontece */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/agendamento"
          className="group rounded-xl2 bg-white p-4 shadow-card transition hover:border-brand"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-ink">Pagamentos (saídas)</p>
            <ArrowUpRight size={15} className="text-ink-soft transition group-hover:text-brand" />
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            Remessa de pagamento e processamento do retorno ficam em <b>Liquidações</b>.
          </p>
        </Link>
        <Link
          href="/vendas"
          className="group rounded-xl2 bg-white p-4 shadow-card transition hover:border-brand"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-ink">Cobrança (boletos)</p>
            <ArrowUpRight size={15} className="text-ink-soft transition group-hover:text-brand" />
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            Remessa de registro e retorno de liquidação ficam em <b>Serviços → Boletos</b>.
          </p>
        </Link>
      </div>

      {erro && <MessageStrip tipo="erro">{erro}</MessageStrip>}

      {/* histórico unificado */}
      <div className="overflow-hidden rounded-xl2 bg-white shadow-card">
        <div className="border-b border-line bg-surface/50 px-4 py-2.5">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Remessas geradas ({remessas.length})</p>
        </div>
        {remessas.length === 0 ? (
          <EmptyState compacto titulo="Nenhuma remessa gerada ainda" />
        ) : (
          remessas.map((r) => (
            <div key={r.id} className="flex items-center gap-3 border-b border-line/60 px-4 py-3 text-sm last:border-0">
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                  r.tipo === "cobranca" ? "bg-brand-light text-brand-dark" : "bg-surface text-ink-muted"
                }`}
              >
                {r.tipo === "cobranca" ? "cobrança" : "pagamento"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">
                  {r.arquivo_nome || `Remessa ${r.sequencial ?? ""}`}
                  {r.cancelada_em ? " · cancelada" : ""}
                </p>
                <p className="text-[11px] text-ink-soft">
                  {r.conta?.nome ?? "conta"} · banco {r.banco_codigo ?? "—"} · seq {r.sequencial ?? "—"} ·{" "}
                  {r.quantidade ?? 0} item(ns) · {dataHoraBR(r.criado_em)}
                </p>
              </div>
              <span className="num shrink-0 font-semibold text-ink">{brl(r.valor_total)}</span>
              <button
                type="button"
                onClick={() => baixar(r)}
                disabled={baixando === r.id}
                title="Baixar o arquivo novamente"
                className="shrink-0 rounded-lg p-1.5 text-ink-soft transition hover:bg-surface hover:text-brand disabled:opacity-50"
              >
                <Download size={15} />
              </button>
            </div>
          ))
        )}
      </div>

      <p className="text-[11px] text-ink-soft">
        Os retornos (.RET) são processados na tela do seu fluxo (Liquidações ou Boletos) e aplicam o resultado direto
        nos lançamentos e títulos — por isso não ficam listados aqui.
      </p>
    </div>
  );
}

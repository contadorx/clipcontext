"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Unlock, ShieldCheck, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import EmptyState from "@/components/ui/empty-state";

type Mes = { competencia: string; fechada: boolean; lancamentos: number };

function compBR(comp: string): string {
  const [a, m] = comp.slice(0, 7).split("-");
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${nomes[Number(m) - 1]}/${a}`;
}

export default function FechamentoClient({
  empresaId,
  podeFechar,
  meses,
}: {
  empresaId: string;
  podeFechar: boolean;
  meses: Mes[];
}) {
  const router = useRouter();
  const [processando, setProcessando] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  async function alternar(m: Mes) {
    if (!podeFechar) return;
    setProcessando(m.competencia);
    setMsg(null);
    const supabase = createClient();
    if (m.fechada) {
      const { error } = await supabase
        .from("competencias_fechadas")
        .delete()
        .eq("empresa_id", empresaId)
        .eq("competencia", m.competencia);
      setMsg(error ? { tipo: "erro", texto: error.message } : { tipo: "ok", texto: `${compBR(m.competencia)} reaberto.` });
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await supabase.from("competencias_fechadas").insert({
        empresa_id: empresaId,
        competencia: m.competencia,
        fechada_por: user?.id ?? null,
      });
      setMsg(
        error
          ? { tipo: "erro", texto: error.message }
          : { tipo: "ok", texto: `${compBR(m.competencia)} fechado — lançamentos protegidos contra alteração.` },
      );
    }
    setProcessando(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5 rounded-xl2 border border-line bg-surface/50 px-4 py-3">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-brand" />
        <p className="text-xs text-ink-muted">
          Fechar um mês protege os lançamentos daquela competência: ninguém consegue editar, excluir ou criar
          lançamentos no período, em nenhuma tela. O registro de <b>pagamento</b> (baixa de boleto, conciliação)
          continua liberado, porque é fato do banco. {podeFechar ? "" : "Apenas o responsável (owner) ou um gestor podem fechar e reabrir meses."}
        </p>
      </div>

      {msg && (
        <p className={`text-xs font-semibold ${msg.tipo === "erro" ? "text-danger" : "text-brand"}`}>{msg.texto}</p>
      )}

      <div className="overflow-hidden rounded-xl2 bg-white shadow-card">
        {meses.map((m) => (
          <div key={m.competencia} className="flex items-center gap-3 border-b border-line/60 px-4 py-3 last:border-0">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                m.fechada ? "bg-brand-light text-brand-dark" : "bg-surface text-ink-soft"
              }`}
            >
              {m.fechada ? <Lock size={15} /> : <Unlock size={15} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">{compBR(m.competencia)}</p>
              <p className="text-[11px] text-ink-soft">
                {m.lancamentos} lançamento(s) · {m.fechada ? "fechado" : "aberto"}
              </p>
            </div>
            {podeFechar ? (
              <button
                type="button"
                onClick={() => alternar(m)}
                disabled={processando !== null}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                  m.fechada
                    ? "border border-line text-ink-muted hover:border-danger hover:text-danger"
                    : "bg-brand text-white hover:bg-brand-dark"
                }`}
              >
                {processando === m.competencia ? "…" : m.fechada ? "Reabrir" : "Fechar mês"}
              </button>
            ) : (
              <span className="shrink-0 text-[11px] font-medium text-ink-soft">{m.fechada ? "fechado" : "aberto"}</span>
            )}
          </div>
        ))}
        {meses.length === 0 && (
          <EmptyState compacto titulo="Nenhum lançamento ainda para fechar" />
        )}
      </div>

      {!podeFechar && (
        <p className="flex items-center gap-1.5 text-[11px] text-ink-soft">
          <AlertTriangle size={12} /> Você tem acesso de leitura ao fechamento. Para fechar ou reabrir, fale com o
          responsável pelo escritório.
        </p>
      )}
    </div>
  );
}

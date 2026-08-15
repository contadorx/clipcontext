import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import Card from "@/components/ui/card";
import ObjectStatus from "@/components/ui/object-status";
import { brl, dataBR } from "@/lib/formato";
import type { Alerta, Pendencia } from "@/lib/painel";

/**
 * O que fazer agora.
 *
 * O painel dizia quanto a empresa tem e quanto deve. Não dizia o que fazer com
 * isso — para descobrir era preciso abrir Conciliação, Liquidações e Caixa de
 * entrada, uma por uma, e contar em cada. Os números já existiam; faltava
 * estarem no mesmo lugar, com o botão ao lado.
 *
 * Cada linha abre a lista **já filtrada**: a pendência não é um aviso, é o
 * começo da tarefa.
 *
 * Acima delas fica a única pergunta que tira o sono de quem opera caixa — em
 * que dia o dinheiro acaba, se nada mudar. O gráfico ao lado mostra a forma da
 * curva; aqui está a data.
 */
const TOM_BORDA: Record<Pendencia["tom"], string> = {
  negativo: "border-l-danger",
  critico: "border-l-amber-400",
  info: "border-l-blue-400",
  neutro: "border-l-line",
};

export default function Pendencias({
  alerta,
  pendencias,
}: {
  alerta: Alerta;
  pendencias: Pendencia[];
}) {
  return (
    <Card titulo="O que fazer agora" sub="cada linha abre a lista já filtrada">
      {/* ---- caixa: a data em que fura, ou o pior dia do período ---- */}
      {alerta.furo ? (
        <div className="mb-3 flex items-start gap-2.5 rounded-lg border border-danger/30 bg-rose-50 px-3 py-2.5">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-danger" />
          <div className="min-w-0 text-[12.5px] leading-snug">
            <p className="font-bold text-danger">
              O caixa fica negativo em {dataBR(alerta.furo)}
            </p>
            <p className="text-ink-muted">
              Pior dia do período: <span className="num font-semibold">{brl(alerta.menorSaldo)}</span>
              {alerta.menorSaldoData ? ` em ${dataBR(alerta.menorSaldoData)}` : ""}. Considera o que
              está em aberto pela data de vencimento; vencidos não entram.
            </p>
          </div>
        </div>
      ) : (
        <div className="mb-3 flex items-start gap-2.5 rounded-lg border border-brand/25 bg-brand-light/50 px-3 py-2.5">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-brand-dark" />
          <div className="min-w-0 text-[12.5px] leading-snug">
            <p className="font-bold text-brand-dark">O caixa cobre o período</p>
            <p className="text-ink-muted">
              Menor saldo projetado:{" "}
              <span className="num font-semibold">{brl(alerta.menorSaldo)}</span>
              {alerta.menorSaldoData ? ` em ${dataBR(alerta.menorSaldoData)}` : ""}.
            </p>
          </div>
        </div>
      )}

      {/* ---- os próximos sete dias, que é o horizonte de quem paga ---- */}
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-surface px-3 py-2 text-[12px]">
        <span className="text-ink-soft">Próximos 7 dias</span>
        <span className="text-ink-muted">
          a pagar <span className="num font-semibold text-ink">{brl(alerta.pagar7)}</span>
        </span>
        <span className="text-ink-muted">
          a receber <span className="num font-semibold text-brand-dark">{brl(alerta.receber7)}</span>
        </span>
        <ObjectStatus tom={alerta.cobre7 ? "positivo" : "negativo"}>
          {alerta.cobre7 ? "o saldo cobre" : "não cobre"}
        </ObjectStatus>
      </div>

      {/* ---- a fila de trabalho ---- */}
      {pendencias.length === 0 ? (
        <p className="py-6 text-center text-xs text-ink-soft">
          Nada pendente. Extrato conciliado, nada vencido e nenhum documento parado.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {pendencias.map((p) => (
            <li key={p.id}>
              <Link
                href={p.href}
                className={`flex items-center gap-3 rounded-lg border-l-[3px] bg-white px-3 py-2 transition hover:bg-surface ${TOM_BORDA[p.tom]}`}
              >
                <span className="num w-8 shrink-0 text-right text-base font-extrabold text-ink">
                  {p.quantos}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-ink">{p.titulo}</span>
                  <span className="block truncate text-[11px] text-ink-soft">{p.detalhe}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1 text-[12px] font-bold text-brand-dark">
                  {p.acao} <ArrowRight size={13} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

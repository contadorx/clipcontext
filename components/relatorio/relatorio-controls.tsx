"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const TRIMESTRES = ["1º tri", "2º tri", "3º tri", "4º tri"];

export default function RelatorioControls({
  ano,
  base,
  modo,
  mes,
  mesA,
  mesB,
  detalhe,
  gran,
  centros,
  centro,
}: {
  ano: number;
  base: string;
  modo: string;
  mes: number;
  mesA: number;
  mesB: number;
  detalhe: boolean;
  gran: string;
  centros: { id: string; nome: string }[];
  centro: string;
}) {
  const router = useRouter();
  const ir = (p: { ano?: number; base?: string; modo?: string; mes?: number; mesA?: number; mesB?: number; detalhe?: boolean; gran?: string; centro?: string }) => {
    const a = p.ano ?? ano;
    const b = p.base ?? base;
    const md = p.modo ?? modo;
    const m = p.mes ?? mes;
    const ma = p.mesA ?? mesA;
    const mb = p.mesB ?? mesB;
    const dt = p.detalhe ?? detalhe;
    const gr = p.gran ?? gran;
    const ce = p.centro ?? centro;
    router.push(`/relatorios?modo=${md}&ano=${a}&base=${b}&mes=${m}&mesA=${ma}&mesB=${mb}&detalhe=${dt ? 1 : 0}&g=${gr}&centro=${encodeURIComponent(ce)}`);
  };

  const mostraBase = modo === "comparativo" || modo === "orcado";
  const mostraDetalhe = modo === "resultado" || modo === "comparativo" || modo === "orcado" || modo === "caixa" || modo === "aging";
  const mostraPeriodo = modo === "resultado" || modo === "caixa" || modo === "comparativo";
  const periodos = gran === "tri" ? TRIMESTRES.map((l, i) => ({ v: i + 1, l })) : MESES.map((m, i) => ({ v: i + 1, l: m }));
  const vA = gran === "tri" ? Math.min(4, Math.max(1, mesA)) : mesA;
  const vB = gran === "tri" ? Math.min(4, Math.max(1, mesB)) : mesB;
  const mostraCentro =
    centros.length > 0 && (modo === "resultado" || modo === "caixa" || modo === "comparativo" || modo === "aging");
  const temAjustes = mostraBase || mostraDetalhe || mostraPeriodo || mostraCentro;

  const segOn = "rounded-md bg-ink px-3 py-1.5 font-semibold text-white";
  const segOff = "rounded-md px-3 py-1.5 font-medium text-ink-muted transition hover:bg-surface";
  const lbl = "text-[11px] font-semibold uppercase tracking-wide text-ink-soft";
  const caixa = "flex items-center gap-0.5 rounded-lg border border-line p-0.5 text-sm";
  const selCls = "rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand";

  return (
    <div className="space-y-3">
      {/* Qual relatório + ano */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className={`flex flex-wrap ${caixa}`}>
          {[
            { v: "resultado", l: "Resultado" },
            { v: "caixa", l: "Fluxo de Caixa" },
            { v: "comparativo", l: "Comparativo" },
            { v: "aging", l: "Aging" },
            { v: "orcado", l: "Orçado × Realizado" },
            { v: "analise", l: "Análise" },
          ].map((o) => (
            <button key={o.v} type="button" onClick={() => ir({ modo: o.v })} className={modo === o.v ? segOn : segOff}>
              {o.l}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button aria-label="Anterior"
            type="button"
            onClick={() => ir({ ano: ano - 1 })}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink-muted transition hover:border-brand hover:text-brand"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="num min-w-14 text-center text-base font-bold text-ink">{ano}</span>
          <button aria-label="Próximo"
            type="button"
            onClick={() => ir({ ano: ano + 1 })}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink-muted transition hover:border-brand hover:text-brand"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Como visualizar (ajustes) */}
      {temAjustes && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-3">
          {mostraCentro && (
            <div className="flex items-center gap-2">
              <span className={lbl}>Centro</span>
              <select value={centro} onChange={(e) => ir({ centro: e.target.value })} className={selCls}>
                <option value="">Todos os centros</option>
                {centros.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
                <option value="__sem__">Sem centro</option>
              </select>
            </div>
          )}
          {mostraBase && (
            <div className="flex items-center gap-2">
              <span className={lbl}>Base</span>
              <div className={caixa}>
                {[
                  { v: "competencia", l: "Competência" },
                  { v: "vencimento", l: "Vencimento" },
                  { v: "pagamento", l: "Pagamento" },
                ].map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => ir({ base: o.v })}
                    className={base === o.v ? "rounded-md bg-brand px-3 py-1.5 font-semibold text-white" : segOff}
                  >
                    {o.l}
                  </button>
                ))}
              </div>
            </div>
          )}

          {modo === "orcado" && (
            <div className="flex items-center gap-2">
              <span className={lbl}>Mês</span>
              <select value={mes} onChange={(e) => ir({ mes: Number(e.target.value) })} className={selCls}>
                <option value={0}>Ano todo</option>
                {MESES.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          )}

          {modo === "comparativo" && (
            <div className="flex items-center gap-2">
              <span className={lbl}>{gran === "tri" ? "Trimestres" : "Meses"}</span>
              <div className="flex items-center gap-1.5">
                <select value={vA} onChange={(e) => ir({ mesA: Number(e.target.value) })} className={selCls}>
                  {periodos.map((p) => (
                    <option key={p.v} value={p.v}>
                      {p.l}
                    </option>
                  ))}
                </select>
                <span className="text-xs font-semibold text-ink-soft">vs</span>
                <select value={vB} onChange={(e) => ir({ mesB: Number(e.target.value) })} className={selCls}>
                  {periodos.map((p) => (
                    <option key={p.v} value={p.v}>
                      {p.l}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {mostraPeriodo && (
            <div className="flex items-center gap-2">
              <span className={lbl}>Período</span>
              <div className={caixa}>
                {[
                  { v: "mes", l: "Mensal" },
                  { v: "tri", l: "Trimestral" },
                ].map((o) => (
                  <button key={o.v} type="button" onClick={() => ir({ gran: o.v })} className={gran === o.v ? segOn : segOff}>
                    {o.l}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mostraDetalhe && (
            <div className="flex items-center gap-2">
              <span className={lbl}>Detalhe</span>
              <button
                type="button"
                onClick={() => ir({ detalhe: !detalhe })}
                className={
                  detalhe
                    ? "rounded-lg border border-brand bg-brand-light px-3 py-2 text-sm font-semibold text-ink"
                    : "rounded-md border border-line px-2.5 py-1.5 text-[12.5px] font-medium text-ink-muted transition hover:border-brand hover:text-brand"
                }
              >
                {detalhe ? "Resumir" : modo === "caixa" ? "Abrir grupos" : modo === "aging" ? "Ver lançamentos" : "Detalhar por categoria"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { Wallet, RotateCcw, TrendingUp, TrendingDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { brl } from "@/lib/formato";
import { classeControle } from "@/components/ui/campo";

type Row = { tipo: "entrada" | "saida"; valor: number; data_pagamento: string | null; data_agendamento: string | null; data_vencimento: string };

function hoje() {
  return new Date().toISOString().slice(0, 10);
}
function addDias(base: string, n: number) {
  const d = new Date(base + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function primeiroDiaMes() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function ultimoDiaMes() {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

type Buckets = {
  efetReceber: number; efetPagar: number;
  agendReceber: number; agendPagar: number;
  prevReceber: number; prevPagar: number;
};
const zero: Buckets = { efetReceber: 0, efetPagar: 0, agendReceber: 0, agendPagar: 0, prevReceber: 0, prevPagar: 0 };

export default function CockpitCaixa({ empresaId }: { empresaId: string }) {
  const [dataIni, setDataIni] = useState(hoje());
  const [dataFim, setDataFim] = useState(addDias(hoje(), 30));
  const [saldoContas, setSaldoContas] = useState(0); // soma dos saldos iniciais das contas
  const [antes, setAntes] = useState(0); // efetivados/agendados com pagamento antes de dataIni
  const [buckets, setBuckets] = useState<Buckets>(zero);
  const [carregando, setCarregando] = useState(true);
  const [caixaManual, setCaixaManual] = useState<string>("");
  const [tocado, setTocado] = useState(false);

  const carregar = useCallback(async () => {
    if (!empresaId) return;
    setCarregando(true);
    const supabase = createClient();
    const h = hoje();
    const [contasRes, antesRes, janelaRes] = await Promise.all([
      supabase.from("contas_bancarias").select("saldo_inicial").eq("empresa_id", empresaId),
      // tudo que entra/sai com pagamento ANTES da data inicial (compõe o caixa inicial)
      supabase
        .from("lancamentos")
        .select("tipo, valor")
        .eq("empresa_id", empresaId)
        .not("transferencia", "is", true)
        .not("data_pagamento", "is", null)
        .lt("data_pagamento", dataIni),
      // janela de análise: pagamentos entre as datas OU previstos com vencimento até dataFim
      supabase
        .from("lancamentos")
        .select("tipo, valor, data_pagamento, data_agendamento, data_vencimento")
        .eq("empresa_id", empresaId)
        .not("transferencia", "is", true)
        .or(`and(data_pagamento.gte.${dataIni},data_pagamento.lte.${dataFim}),and(data_pagamento.is.null,data_vencimento.lte.${dataFim})`),
    ]);

    const sc = ((contasRes.data as { saldo_inicial: number }[]) ?? []).reduce((s, c) => s + Number(c.saldo_inicial || 0), 0);
    setSaldoContas(sc);

    const antesRows = (antesRes.data as { tipo: "entrada" | "saida"; valor: number }[]) ?? [];
    const antesNet = antesRows.reduce((s, r) => s + (r.tipo === "entrada" ? Number(r.valor) : -Number(r.valor)), 0);
    setAntes(antesNet);

    const b = { ...zero };
    for (const r of (janelaRes.data as Row[]) ?? []) {
      const v = Number(r.valor);
      const receber = r.tipo === "entrada";
      if (r.data_pagamento) {
        // efetivado: dinheiro já se moveu (por comando ou conciliação)
        if (receber) b.efetReceber += v; else b.efetPagar += v;
      } else if (r.data_agendamento) {
        // agendado no banco: dinheiro esperado no vencimento
        if (receber) b.agendReceber += v; else b.agendPagar += v;
      } else {
        // previsto em aberto: também pelo vencimento
        if (receber) b.prevReceber += v; else b.prevPagar += v;
      }
    }
    setBuckets(b);
    setCarregando(false);
  }, [empresaId, dataIni, dataFim]);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => {
    const h = () => carregar();
    window.addEventListener("fs-mov-changed", h);
    return () => window.removeEventListener("fs-mov-changed", h);
  }, [carregar]);

  const caixaInicialCalc = saldoContas + antes;
  const caixaInicial = tocado && caixaManual !== "" ? Number(caixaManual.replace(/\./g, "").replace(",", ".")) || 0 : caixaInicialCalc;

  const totReceber = buckets.efetReceber + buckets.agendReceber + buckets.prevReceber;
  const totPagar = buckets.efetPagar + buckets.agendPagar + buckets.prevPagar;
  const caixaFinal = caixaInicial + totReceber - totPagar;

  const linhas = [
    { nome: "Efetivado", rec: buckets.efetReceber, pag: buckets.efetPagar, cls: "text-ink" },
    { nome: "Agendado", rec: buckets.agendReceber, pag: buckets.agendPagar, cls: "text-amber-700" },
    { nome: "Previsto", rec: buckets.prevReceber, pag: buckets.prevPagar, cls: "text-ink-muted" },
  ];

  const h0 = hoje();
  const atalhos = [
    { l: "Hoje", ini: h0, fim: h0 },
    { l: "3d", ini: h0, fim: addDias(h0, 3) },
    { l: "7d", ini: h0, fim: addDias(h0, 7) },
    { l: "15d", ini: h0, fim: addDias(h0, 15) },
    { l: "30d", ini: h0, fim: addDias(h0, 30) },
    { l: "Mês", ini: primeiroDiaMes(), fim: ultimoDiaMes() },
  ];

  return (
    <div className="rounded-xl2 bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
          <Wallet size={16} className="text-brand" /> Cockpit de caixa
        </h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-0.5 rounded-lg border border-line p-0.5 text-xs">
            {atalhos.map((a) => {
              const ativo = dataIni === a.ini && dataFim === a.fim;
              return (
                <button
                  key={a.l}
                  type="button"
                  onClick={() => { setDataIni(a.ini); setDataFim(a.fim); }}
                  className={
                    ativo
                      ? "rounded-md bg-brand px-2.5 py-1.5 font-semibold text-white"
                      : "rounded-md px-2.5 py-1.5 font-medium text-ink-muted transition hover:bg-surface"
                  }
                >
                  {a.l}
                </button>
              );
            })}
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold text-ink-soft">Análise de</label>
            <input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)}
              className={classeControle("md", false, "num")} />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold text-ink-soft">até</label>
            <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)}
              className={classeControle("md", false, "num")} />
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        {/* buckets */}
        <div className="overflow-hidden rounded-xl border border-line">
          <div className="grid grid-cols-[1fr_1fr_1fr] bg-surface px-3 py-2 text-[11px] font-semibold text-ink-soft">
            <span>Situação</span>
            <span className="text-right">A receber</span>
            <span className="text-right">A pagar</span>
          </div>
          {linhas.map((l) => (
            <div key={l.nome} className="grid grid-cols-[1fr_1fr_1fr] border-t border-line px-3 py-2 text-sm">
              <span className={`font-medium ${l.cls}`}>{l.nome}</span>
              <span className="num text-right text-brand">{brl(l.rec)}</span>
              <span className="num text-right text-ink">{brl(l.pag)}</span>
            </div>
          ))}
          <div className="grid grid-cols-[1fr_1fr_1fr] border-t border-line bg-surface/50 px-3 py-2 text-sm font-bold">
            <span className="text-ink">Total</span>
            <span className="num text-right text-brand">{brl(totReceber)}</span>
            <span className="num text-right text-ink">{brl(totPagar)}</span>
          </div>
        </div>

        {/* waterfall do caixa */}
        <div className="flex flex-col justify-between rounded-xl border border-line p-4">
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-ink-muted">
                Caixa inicial
                {tocado && (
                  <button type="button" onClick={() => { setTocado(false); setCaixaManual(""); }}
                    title="Usar saldo calculado" className="text-ink-soft transition hover:text-brand">
                    <RotateCcw size={12} />
                  </button>
                )}
              </span>
              <input
                value={tocado ? caixaManual : brl(caixaInicialCalc)}
                onChange={(e) => { setTocado(true); setCaixaManual(e.target.value); }}
                onFocus={() => { if (!tocado) { setTocado(true); setCaixaManual(String(caixaInicialCalc.toFixed(2)).replace(".", ",")); } }}
                className="num w-32 rounded-lg border border-line px-2 py-1 text-right text-sm outline-none focus:border-brand"
              />
            </div>
            <div className="flex items-center justify-between text-brand">
              <span className="flex items-center gap-1"><TrendingUp size={13} /> (+) A receber</span>
              <span className="num">{brl(totReceber)}</span>
            </div>
            <div className="flex items-center justify-between text-danger">
              <span className="flex items-center gap-1"><TrendingDown size={13} /> (−) A pagar</span>
              <span className="num">{brl(totPagar)}</span>
            </div>
          </div>
          <div className={`mt-3 flex items-center justify-between rounded-lg px-3 py-2.5 ${caixaFinal >= 0 ? "bg-brand-light" : "bg-rose-50"}`}>
            <span className="text-sm font-bold text-ink">Caixa final projetado</span>
            <span className={`num text-lg font-extrabold ${caixaFinal >= 0 ? "text-brand-dark" : "text-ink"}`}>
              {brl(caixaFinal)}
            </span>
          </div>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-ink-soft">
        {carregando ? "Atualizando…" : "Caixa inicial = saldo das contas + tudo com pagamento antes da data de início. Previsto inclui itens em aberto (até a data final), inclusive atrasados."}
      </p>
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Landmark, GitCompareArrows, Inbox } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import NovoLancamento from "@/components/lancamentos/novo-lancamento";
import { SortToggle, toggleOrd, type Ordenacao } from "@/components/ui/sort";
import { SkeletonLinhas } from "@/components/ui/skeleton";
import EmptyState from "@/components/ui/empty-state";
import { dataBR, num2 } from "@/lib/formato";

type Conta = {
  id: string;
  nome: string;
  banco: string | null;
  agencia: string | null;
  conta_numero: string | null;
  saldo_inicial: number;
  data_inicio: string | null;
};
type Pago = {
  id: string;
  conta_id: string;
  tipo: "entrada" | "saida";
  valor: number;
  data_pagamento: string;
  descricao: string | null;
};

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function ExtratosClient({ empresaId }: { empresaId: string }) {
  const hoje = new Date();
  const [contas, setContas] = useState<Conta[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [selConta, setSelConta] = useState<string>("");
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [carregando, setCarregando] = useState(true);
  const [ordExt, setOrdExt] = useState<Ordenacao>({ campo: "data", dir: "asc" });

  const carregar = useCallback(async () => {
    setCarregando(true);
    const supabase = createClient();
    const [c, p] = await Promise.all([
      supabase
        .from("contas_bancarias")
        .select("id, nome, banco, agencia, conta_numero, saldo_inicial, data_inicio")
        .eq("empresa_id", empresaId)
        .order("nome"),
      supabase
        .from("lancamentos")
        .select("id, conta_id, tipo, valor, data_pagamento, descricao")
        .eq("empresa_id", empresaId)
        .not("conta_id", "is", null)
        .not("data_pagamento", "is", null)
        .order("data_pagamento"),
    ]);
    const cs = (c.data as Conta[]) ?? [];
    setContas(cs);
    setPagos(((p.data as unknown) as Pago[]) ?? []);
    setSelConta((s) => s || cs[0]?.id || "");
    setCarregando(false);
  }, [empresaId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    const h = () => carregar();
    window.addEventListener("fs-mov-changed", h);
    return () => window.removeEventListener("fs-mov-changed", h);
  }, [carregar]);

  function contaBase(id: string): { ini: number; di: string | null } {
    const c = contas.find((x) => x.id === id);
    return { ini: Number(c?.saldo_inicial ?? 0), di: c?.data_inicio ?? null };
  }
  // saldo da conta = saldo inicial + lançamentos pagos (a partir da data de início)
  function somaPagos(id: string, ate?: string) {
    const { ini, di } = contaBase(id);
    let s = ini;
    for (const p of pagos) {
      if (p.conta_id !== id) continue;
      if (di && p.data_pagamento < di) continue;
      if (ate && !(p.data_pagamento < ate)) continue;
      s += p.tipo === "entrada" ? Number(p.valor) : -Number(p.valor);
    }
    return s;
  }
  function saldoConta(id: string) {
    return somaPagos(id);
  }
  const saldoTotal = contas.reduce((s, c) => s + saldoConta(c.id), 0);

  const mes2 = String(mes).padStart(2, "0");
  const inicio = `${ano}-${mes2}-01`;
  const fimDia = new Date(ano, mes, 0).getDate();
  const fim = `${ano}-${mes2}-${String(fimDia).padStart(2, "0")}`;

  const doMes = pagos
    .filter((p) => p.conta_id === selConta && p.data_pagamento >= inicio && p.data_pagamento <= fim)
    .sort((a, b) => a.data_pagamento.localeCompare(b.data_pagamento));
  const saldoAnterior = somaPagos(selConta, inicio);

  // saldo corrente acumulado
  let acc = saldoAnterior;
  const linhas = doMes.map((p) => {
    acc += p.tipo === "entrada" ? Number(p.valor) : -Number(p.valor);
    return { ...p, saldo: acc };
  });

  function navMes(dir: number) {
    let m = mes + dir;
    let a = ano;
    if (m < 1) {
      m = 12;
      a--;
    } else if (m > 12) {
      m = 1;
      a++;
    }
    setMes(m);
    setAno(a);
  }

  const conta = contas.find((c) => c.id === selConta);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
      {/* lista de contas */}
      <div className="rounded-xl2 bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-[13px] font-bold text-ink">Contas</h2>
          <Link
            href="/configuracoes/contas-bancarias"
            className="text-xs font-semibold text-brand hover:underline"
          >
            Gerenciar
          </Link>
        </div>
        {carregando ? (
          <SkeletonLinhas linhas={4} colunas={2} />
        ) : contas.length === 0 ? (
          <EmptyState compacto titulo="Nenhuma conta cadastrada" />
        ) : (
          <div className="py-1">
            {contas.map((c) => {
              const ativo = c.id === selConta;
              const s = saldoConta(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelConta(c.id)}
                  className={`flex w-full items-center justify-between gap-2 border-l-2 px-4 py-2.5 text-left transition ${
                    ativo ? "border-brand bg-brand-light/40" : "border-transparent hover:bg-surface"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface text-ink-soft">
                      <Landmark size={14} />
                    </span>
                    <span className="text-sm text-ink">{c.nome}</span>
                  </span>
                  <span className={`num text-sm font-semibold ${s < 0 ? "text-ink" : "text-ink"}`}>{num2(s)}</span>
                </button>
              );
            })}
            <div className="mt-1 flex items-center justify-between border-t border-line px-4 py-3">
              <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">Saldo (R$)</span>
              <span className={`num text-base font-extrabold ${saldoTotal < 0 ? "text-ink" : "text-ink"}`}>
                {num2(saldoTotal)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* extrato */}
      <div className="rounded-xl2 bg-white shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
          <div>
            <h2 className="text-[13px] font-bold text-ink">{conta?.nome ?? "Extrato"}</h2>
            {conta && (conta.agencia || conta.conta_numero) && (
              <p className="text-[11px] text-ink-soft">
                {conta.banco ? conta.banco + " · " : ""}
                {conta.agencia ? "ag " + conta.agencia : ""}
                {conta.conta_numero ? " / cc " + conta.conta_numero : ""}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button aria-label="Anterior"
              type="button"
              onClick={() => navMes(-1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink-muted transition hover:border-brand hover:text-brand"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-[92px] text-center text-sm font-bold text-ink">
              {MESES[mes - 1]}/{ano}
            </span>
            <button aria-label="Próximo"
              type="button"
              onClick={() => navMes(1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink-muted transition hover:border-brand hover:text-brand"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* ações */}
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
          <NovoLancamento empresaId={empresaId} variant="button" />
          <Link
            href="/conciliacao"
            className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand"
          >
            <GitCompareArrows size={14} /> Conciliar extrato
          </Link>
        </div>

        <div className="max-xl:overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="[&>th]:sticky [&>th]:top-[calc(52px_+_var(--fs-cab,0px))] [&>th]:z-10 [&>th]:bg-white border-b border-line text-[11px] font-semibold text-ink-soft">
                <th className="px-4 py-2 text-left"><SortToggle label="Data" campo="data" inicial="asc" ord={ordExt} onToggle={(c, i) => setOrdExt((o) => toggleOrd(o, c, i))} /></th>
                <th className="px-4 py-2 text-left">Descrição</th>
                <th className="px-4 py-2 text-right">Entrada</th>
                <th className="px-4 py-2 text-right">Saída</th>
                <th className="px-4 py-2 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {ordExt.dir === "asc" && (
                <tr className="border-b border-line/60 bg-surface/40">
                  <td className="px-4 py-2 text-ink-soft" colSpan={4}>
                    Saldo anterior
                  </td>
                  <td className={`num px-4 py-2 text-right font-semibold ${saldoAnterior < 0 ? "text-ink" : "text-ink"}`}>
                    {num2(saldoAnterior)}
                  </td>
                </tr>
              )}
              {carregando ? (
                <tr>
                  <td colSpan={5} className="p-0">
                    <SkeletonLinhas linhas={6} colunas={5} />
                  </td>
                </tr>
              ) : linhas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-ink-soft">
                    <span className="flex flex-col items-center gap-2">
                      <Inbox size={22} strokeWidth={1.5} />
                      Nenhum lançamento pago neste período.
                    </span>
                  </td>
                </tr>
              ) : (
                (ordExt.dir === "desc" ? [...linhas].reverse() : linhas).map((l) => (
                  <tr key={l.id} className="border-b border-line/60 last:border-0">
                    <td className="num px-4 py-2 text-ink-muted">{dataBR(l.data_pagamento)}</td>
                    <td className="px-4 py-2 text-ink">{l.descricao || "—"}</td>
                    <td className="num px-4 py-2 text-right text-brand">
                      {l.tipo === "entrada" ? num2(Number(l.valor)) : ""}
                    </td>
                    <td className="num px-4 py-2 text-right text-ink">
                      {l.tipo === "saida" ? num2(Number(l.valor)) : ""}
                    </td>
                    <td className={`num px-4 py-2 text-right font-semibold ${l.saldo < 0 ? "text-ink" : "text-ink"}`}>
                      {num2(l.saldo)}
                    </td>
                  </tr>
                ))
              )}
              {ordExt.dir === "desc" && !carregando && linhas.length > 0 && (
                <tr className="border-t border-line/60 bg-surface/40">
                  <td className="px-4 py-2 text-ink-soft" colSpan={4}>
                    Saldo anterior
                  </td>
                  <td className={`num px-4 py-2 text-right font-semibold ${saldoAnterior < 0 ? "text-ink" : "text-ink"}`}>
                    {num2(saldoAnterior)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, List, TrendingUp, CheckCircle2, Circle, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import LancamentosClient from "@/components/lancamentos/lancamentos-client";
import { SortToggle, toggleOrd, type Ordenacao } from "@/components/ui/sort";
import { SkeletonLinhas } from "@/components/ui/skeleton";
import EmptyState from "@/components/ui/empty-state";
import { brl, dataBR } from "@/lib/formato";

type Conta = {
  id: string;
  nome: string;
  banco: string | null;
  saldo_inicial: number;
  data_inicio: string | null;
};
/** só o necessário para somar saldo — o extrato do mês vem à parte */
type Pago = {
  id: string;
  conta_id: string;
  tipo: "entrada" | "saida";
  valor: number;
  data_pagamento: string;
};
type LinhaExtrato = Pago & { descricao: string | null; conciliado: boolean };

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/**
 * A cor do saldo na barra de contas.
 *
 * Esta é a linha que responde "tenho caixa?" — é por ela que a tela é aberta. E
 * dela, o único número que exige ação é o negativo: uma conta no vermelho é
 * problema, não é tipo de dado. Aqui o vermelho está no lugar certo, ao
 * contrário da lista abaixo, onde ele marcava toda saída.
 *
 * Antes, positivo e negativo diferiam só entre `text-ink` e `text-ink-muted` —
 * dois cinzas. Era preciso ler os quatro números para achar o que importa.
 */
function classeSaldo(v: number): string {
  return v < 0 ? "text-danger" : "text-ink-muted";
}

export default function MovimentacoesContas({ empresaId }: { empresaId: string }) {
  const hoje = new Date();
  const [contas, setContas] = useState<Conta[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [extrato, setExtrato] = useState<LinhaExtrato[]>([]);
  // muda a cada "algo mudou lá fora", para o efeito do extrato refazer a consulta
  const [versao, setVersao] = useState(0);
  const [carregandoExtrato, setCarregandoExtrato] = useState(false);
  const [selConta, setSelConta] = useState<string>(""); // "" = todas as contas
  const [modo, setModo] = useState<"lista" | "extrato">("lista");
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [carregando, setCarregando] = useState(true);
  const [ordExt, setOrdExt] = useState<Ordenacao>({ campo: "data", dir: "asc" });

  /**
   * Duas consultas em vez de uma.
   *
   * O saldo de cada conta é saldo inicial + tudo que foi pago desde a data de
   * início dela — então essa parte precisa mesmo de todo o histórico. Mas
   * `descricao` e `conciliado` só interessam ao extrato do mês visível: trazê-los
   * para o histórico inteiro é baixar o texto de todo lançamento que a empresa já
   * pagou, a cada abertura da tela.
   *
   * O piso de data é a menor `data_inicio` entre as contas: lançamento anterior a
   * isso já era descartado no cálculo, então cortar na consulta dá o mesmo saldo
   * com menos linhas. Se alguma conta não tem data de início, ela conta desde
   * sempre e não dá para aplicar piso nenhum.
   */
  const carregar = useCallback(async () => {
    if (!empresaId) return;
    setCarregando(true);
    const supabase = createClient();

    const c = await supabase
      .from("contas_bancarias")
      .select("id, nome, banco, saldo_inicial, data_inicio")
      .eq("empresa_id", empresaId)
      .order("nome");
    const listaContas = (c.data as Conta[]) ?? [];
    setContas(listaContas);

    const inicios = listaContas.map((x) => x.data_inicio);
    const piso = inicios.some((d) => !d)
      ? null
      : inicios.filter(Boolean).sort()[0] ?? null;

    let q = supabase
      .from("lancamentos")
      .select("id, conta_id, tipo, valor, data_pagamento")
      .eq("empresa_id", empresaId)
      .not("conta_id", "is", null)
      .not("data_pagamento", "is", null);
    if (piso) q = q.gte("data_pagamento", piso);
    const p = await q.order("data_pagamento");

    setPagos(((p.data as unknown) as Pago[]) ?? []);
    setCarregando(false);
  }, [empresaId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Extrato do mês: só a conta e o mês visíveis, e só aqui vêm descrição e
  // conciliado. Recarrega ao trocar de conta ou de mês.
  useEffect(() => {
    if (!empresaId || !selConta) {
      setExtrato([]);
      return;
    }
    let cancelado = false;
    setCarregandoExtrato(true);
    (async () => {
      const m2 = String(mes).padStart(2, "0");
      const de = `${ano}-${m2}-01`;
      const ate = `${ano}-${m2}-${String(new Date(ano, mes, 0).getDate()).padStart(2, "0")}`;
      const { data } = await createClient()
        .from("lancamentos")
        .select("id, conta_id, tipo, valor, data_pagamento, descricao, conciliado")
        .eq("empresa_id", empresaId)
        .eq("conta_id", selConta)
        .not("data_pagamento", "is", null)
        .gte("data_pagamento", de)
        .lte("data_pagamento", ate)
        .order("data_pagamento");
      if (cancelado) return;
      setExtrato(((data as unknown) as LinhaExtrato[]) ?? []);
      setCarregandoExtrato(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [empresaId, selConta, ano, mes, versao]);

  // saldos e extrato se atualizam quando algo é lançado/efetivado em qualquer lugar
  useEffect(() => {
    const h = () => {
      carregar();
      setVersao((v) => v + 1);
    };
    window.addEventListener("fs-mov-changed", h);
    return () => window.removeEventListener("fs-mov-changed", h);
  }, [carregar]);

  // ----- saldo por conta (saldo inicial + lançamentos pagos a partir da data de início) -----
  function contaBase(id: string): { ini: number; di: string | null } {
    const c = contas.find((x) => x.id === id);
    return { ini: Number(c?.saldo_inicial ?? 0), di: c?.data_inicio ?? null };
  }
  function somaPagos(id: string, ate?: string): number {
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
  const saldoConta = (id: string) => somaPagos(id);
  const saldoTotal = contas.reduce((s, c) => s + saldoConta(c.id), 0);

  // ----- seleção de conta / modo -----
  function escolherConta(id: string) {
    if (id === "") {
      setSelConta("");
      if (modo === "extrato") setModo("lista"); // "todas" não tem extrato único
      return;
    }
    setSelConta(id);
  }
  function trocarModo(m: "lista" | "extrato") {
    if (m === "extrato" && !selConta) {
      const primeira = contas[0]?.id ?? "";
      if (!primeira) return; // sem contas, não há extrato
      setSelConta(primeira);
    }
    setModo(m);
  }

  // ----- dados do extrato (modo extrato) -----
  const mes2 = String(mes).padStart(2, "0");
  const inicio = `${ano}-${mes2}-01`;
  const fimDia = new Date(ano, mes, 0).getDate();
  const fim = `${ano}-${mes2}-${String(fimDia).padStart(2, "0")}`;
  const doMes = [...extrato].sort((a, b) => a.data_pagamento.localeCompare(b.data_pagamento));
  const saldoAnterior = somaPagos(selConta, inicio);
  let acc = saldoAnterior;
  const linhas = doMes.map((p) => {
    acc += p.tipo === "entrada" ? Number(p.valor) : -Number(p.valor);
    return { ...p, saldo: acc };
  });
  const saldoFinal = linhas.length ? acc : saldoAnterior;

  function exportarCsv() {
    if (linhas.length === 0) return;
    const fmt = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const esc = (s: string) => (/[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s);
    const head = ["Data", "Descrição", "Valor", "Saldo", "Conciliado"].join(";");
    const rows = linhas.map((l) => {
      const v = (l.tipo === "entrada" ? 1 : -1) * Number(l.valor);
      return [dataBR(l.data_pagamento), esc(l.descricao || ""), fmt(v), fmt(Number(l.saldo)), l.conciliado ? "Sim" : "Não"].join(";");
    });
    const csv = "\ufeff" + [head, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const nomeConta = (contaSel?.nome ?? "conta").replace(/[^\w-]+/g, "_");
    a.href = url;
    a.download = `extrato-${nomeConta}-${mes2}-${ano}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  function navMes(dir: number) {
    let m = mes + dir;
    let a = ano;
    if (m < 1) { m = 12; a--; }
    else if (m > 12) { m = 1; a++; }
    setMes(m);
    setAno(a);
  }
  const contaSel = contas.find((c) => c.id === selConta);

  const chipCls = (ativo: boolean) =>
    `flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
      ativo ? "border-brand bg-brand-light/40" : "border-line bg-white hover:bg-surface"
    }`;

  return (
    <div className="space-y-3">
      {/* BARRA DE CONTAS (faixa horizontal no topo) */}
      <div className="rounded-xl2 bg-white px-3 py-2.5 shadow-card">
        {/* O rótulo "Contas" e o "Gerenciar" tinham linha própria acima dos chips.
            Os chips já dizem que aquilo são contas — o rótulo custava 28px para
            repetir o óbvio. "Gerenciar" desce para a mesma linha, na ponta. */}
        {carregando ? (
          <SkeletonLinhas linhas={4} colunas={2} />
        ) : contas.length === 0 ? (
          <p className="text-sm text-ink-soft">
            Nenhuma conta ainda.{" "}
            <Link href="/configuracoes/contas-bancarias" className="font-semibold text-brand">
              Criar a primeira
            </Link>
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => escolherConta("")} className={chipCls(selConta === "")}>
              <span className="font-semibold text-ink">Todas as contas</span>
              <span className={`num font-semibold ${classeSaldo(saldoTotal)}`}>{brl(saldoTotal)}</span>
            </button>
            {contas.map((c) => {
              const ativo = c.id === selConta;
              const s = saldoConta(c.id);
              return (
                <button key={c.id} type="button" onClick={() => escolherConta(c.id)} className={chipCls(ativo)}>
                  <span className="max-w-[180px] truncate text-ink">{c.nome}</span>
                  <span className={`num font-semibold ${classeSaldo(s)}`}>{brl(s)}</span>
                  {s < 0 && <span className="sr-only"> — conta negativa</span>}
                </button>
              );
            })}
            <Link
              href="/configuracoes/contas-bancarias"
              className="ml-auto self-center text-xs font-semibold text-brand hover:underline"
            >
              Gerenciar
            </Link>
          </div>
        )}
      </div>

      {/* Lista | Extrato — dois modos da mesma tela, não duas telas.
          Tinha faixa própria; agora divide a linha com o aviso de conta
          filtrada, que antes ocupava a ponta direita dela mesma. */}
      <div className="-mt-2 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-line bg-white p-0.5 shadow-card">
          <button
            type="button"
            onClick={() => trocarModo("lista")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition ${
              modo === "lista" ? "bg-brand text-white" : "text-ink-muted hover:bg-surface"
            }`}
          >
            <List size={15} /> Lista
          </button>
          <button
            type="button"
            onClick={() => trocarModo("extrato")}
            disabled={contas.length === 0}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition disabled:opacity-40 ${
              modo === "extrato" ? "bg-brand text-white" : "text-ink-muted hover:bg-surface"
            }`}
          >
            <TrendingUp size={15} /> Extrato (saldo corrente)
          </button>
        </div>
        {modo === "lista" && selConta && (
          <span className="text-xs text-ink-soft">
            Filtrando por <span className="font-semibold text-ink">{contaSel?.nome}</span>
          </span>
        )}
      </div>

      {/* CONTEÚDO (largura inteira) */}
      {modo === "lista" ? (
        <LancamentosClient empresaId={empresaId} contaFixa={selConta || null} />
      ) : (
        <div className="overflow-hidden rounded-xl2 bg-white shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
            <h2 className="text-[13px] font-bold text-ink">Extrato — {contaSel?.nome ?? "—"}</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={exportarCsv}
                disabled={linhas.length === 0}
                className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-muted transition hover:border-brand hover:text-brand disabled:opacity-50"
              >
                <Download size={14} /> Exportar
              </button>
              <button
                type="button"
                onClick={() => navMes(-1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink-soft transition hover:bg-surface"
                aria-label="Mês anterior"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="min-w-[120px] text-center text-sm font-semibold text-ink">
                {MESES[mes - 1]}/{ano}
              </span>
              <button
                type="button"
                onClick={() => navMes(1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink-soft transition hover:bg-surface"
                aria-label="Próximo mês"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between bg-surface px-4 py-2.5 text-sm">
            <span className="text-ink-soft">Saldo anterior</span>
            <span className="num font-semibold text-ink">{brl(saldoAnterior)}</span>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[520px]">
              <div className="grid grid-cols-[88px_1fr_120px_130px] gap-3 border-b border-line px-4 py-2 text-[11px] font-semibold text-ink-soft">
                <span><SortToggle label="Data" campo="data" inicial="asc" ord={ordExt} onToggle={(c, i) => setOrdExt((o) => toggleOrd(o, c, i))} /></span>
                <span>Descrição</span>
                <span className="text-right">Valor</span>
                <span className="text-right">Saldo</span>
              </div>

              {carregandoExtrato ? (
                <SkeletonLinhas linhas={5} colunas={4} />
              ) : linhas.length === 0 ? (
                <EmptyState compacto titulo="Sem movimentos pagos neste mês" />
              ) : (
                (ordExt.dir === "desc" ? [...linhas].reverse() : linhas).map((l) => (
                  <div
                    key={l.id}
                    className="grid grid-cols-[88px_1fr_120px_130px] items-center gap-3 border-b border-line px-4 py-2.5 text-sm last:border-0"
                  >
                    <span className="num text-ink-muted">{dataBR(l.data_pagamento)}</span>
                    <span className="flex min-w-0 items-center gap-1.5 text-ink">
                      {l.conciliado ? (
                        <span title="Conciliado" className="flex shrink-0">
                          <CheckCircle2 size={13} className="text-brand" />
                        </span>
                      ) : (
                        <span title="Não conciliado" className="flex shrink-0">
                          <Circle size={13} className="text-ink-soft/40" />
                        </span>
                      )}
                      <span className="truncate">{l.descricao || "—"}</span>
                    </span>
                    <span className={`num text-right font-medium ${l.tipo === "entrada" ? "text-brand" : "text-ink"}`}>
                      {l.tipo === "entrada" ? "+" : "−"}
                      {brl(Number(l.valor))}
                    </span>
                    <span className="num text-right font-semibold text-ink">{brl(l.saldo)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm">
            <span className="font-semibold text-ink-muted">Saldo em {dataBR(fim)}</span>
            <span className={`num font-bold ${saldoFinal < 0 ? "text-ink" : "text-brand"}`}>{brl(saldoFinal)}</span>
          </div>
          <div className="flex items-center gap-4 border-t border-line px-4 py-2 text-[11px] text-ink-soft">
            <span className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-brand" /> Conciliado</span>
            <span className="flex items-center gap-1.5"><Circle size={12} className="text-ink-soft/40" /> Não conciliado</span>
          </div>
        </div>
      )}
    </div>
  );
}

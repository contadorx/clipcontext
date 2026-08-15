"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import RelatoriosLote from "@/components/carteira/relatorios-lote";
import { ChevronDown, ArrowUpRight, AlertTriangle, CheckCircle2, Clock, CalendarClock, Landmark, Inbox, FileText, Lock } from "lucide-react";
import { selecionarEmpresa } from "@/app/actions";
import NovaEmpresaBotao from "@/components/empresa/nova-empresa";
import MultiSelect from "@/components/ui/multi-select";
import EmptyState from "@/components/ui/empty-state";
import ObjectStatus from "@/components/ui/object-status";
import type { CarteiraData, EmpresaCockpit } from "@/lib/carteira";
import { brl, dataBR } from "@/lib/formato";

// Object status: marcador + texto colorido, igual ao resto do app.
// Atenção é vermelho de perigo — magenta é cor de marca, não de estado.
const STATUS = {
  vermelho: { tom: "negativo", label: "Atenção", rank: 0 },
  amarelo: { tom: "critico", label: "Acompanhar", rank: 1 },
  verde: { tom: "positivo", label: "Em dia", rank: 2 },
} as const;

const PSHORT: Record<string, string> = {
  hoje: "hoje", "3": "3d", "7": "7d", "15": "15d", "30": "30d", mes: "mês",
};
const PERIODOS = [
  { v: "hoje", l: "Hoje" },
  { v: "3", l: "3 dias" },
  { v: "7", l: "7 dias" },
  { v: "15", l: "15 dias" },
  { v: "30", l: "30 dias" },
  { v: "mes", l: "Mês" },
];

// Predicado de cada alerta: ao clicar no card, a lista mostra só as empresas que batem.
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
function mesNome(comp: string): string {
  const m = Number((comp || "").slice(5, 7));
  return m >= 1 && m <= 12 ? MESES[m - 1] : comp;
}
const PRED: Record<string, (e: EmpresaCockpit) => boolean> = {
  neg: (e) => e.previsao7 < 0,
  venc: (e) => e.aPagarVencido > 0 || e.aReceberVencido > 0,
  conc: (e) => e.diasPendente !== null && e.diasPendente >= 3,
  hoje: (e) => e.agHojeQtd > 0,
  docs: (e) => e.docsNovos > 0,
  rel: (e) => e.relatorioStatus === "pendente" || e.relatorioStatus === "rascunho",
};

// Ação direta de cada alerta: com o alerta ativo, cada empresa afetada leva à tela certa.
const ACAO_ALERTA: Record<
  string,
  { label: string; Icon: typeof AlertTriangle; rota: (e: EmpresaCockpit) => string; cookie: boolean }
> = {
  neg: { label: "Ver fluxo", Icon: AlertTriangle, rota: () => "/fluxo", cookie: true },
  venc: { label: "Ver vencidas", Icon: Clock, rota: () => "/lancamentos", cookie: true },
  conc: { label: "Conciliar", Icon: Landmark, rota: () => "/conciliacao", cookie: true },
  hoje: { label: "Ver agendados", Icon: CalendarClock, rota: () => "/lancamentos", cookie: true },
  docs: { label: "Ver documentos", Icon: Inbox, rota: (e) => `/documentos?empresa=${e.id}`, cookie: false },
  rel: { label: "Publicar relatório", Icon: FileText, rota: () => "/relatorios", cookie: true },
};

export default function CarteiraClient({ dados, periodo }: { dados: CarteiraData; periodo: string }) {
  const router = useRouter();
  const ps = PSHORT[periodo] ?? "7d";
  const [aberto, setAberto] = useState<string | null>(null);
  const [soAtencao, setSoAtencao] = useState(false);
  const [alertaAtivo, setAlertaAtivo] = useState<string | null>(null);
  const [empSel, setEmpSel] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [indo, setIndo] = useState<string | null>(null);

  // subconjunto selecionado (vazio = todas)
  const base = empSel.length > 0 ? dados.empresas.filter((e) => empSel.includes(e.id)) : dados.empresas;

  // listas para a geração/publicação de relatórios em lote (carteira inteira, só quem entrega relatório)
  const relPendentes = dados.empresas.filter((e) => e.relatorioStatus === "pendente").map((e) => ({ id: e.id, nome: e.nome }));
  const relRascunhos = dados.empresas.filter((e) => e.relatorioStatus === "rascunho").map((e) => ({ id: e.id, nome: e.nome }));

  const predAtivo = alertaAtivo ? PRED[alertaAtivo] : null;
  const lista = [...base]
    .filter((e) => (predAtivo ? predAtivo(e) : soAtencao ? e.status !== "verde" : true))
    .sort((a, b) => STATUS[a.status].rank - STATUS[b.status].rank || a.previsao7 - b.previsao7);

  function clicarAlerta(key: string) {
    setSoAtencao(false);
    setAlertaAtivo((cur) => (cur === key ? null : key));
  }

  function irPara(e: EmpresaCockpit, rota: string, cookie = true) {
    setIndo(e.id);
    startTransition(async () => {
      if (cookie) await selecionarEmpresa(e.id);
      router.push(rota);
    });
  }
  function abrirEmpresa(e: EmpresaCockpit) {
    irPara(e, "/painel", true);
  }

  const t = {
    n: base.length,
    caixa: base.reduce((s, x) => s + x.caixa, 0),
    aReceber7: base.reduce((s, x) => s + x.aReceber7, 0),
    aPagar7: base.reduce((s, x) => s + x.aPagar7, 0),
    previsao7: base.reduce((s, x) => s + x.previsao7, 0),
    atencao: base.filter((x) => x.status !== "verde").length,
  };
  const kpis: { label: string; valor: string; tom?: string; destaque?: boolean }[] = [
    { label: "Empresas", valor: String(t.n) },
    { label: "Caixa total", valor: brl(t.caixa) },
    { label: `A receber (${ps})`, valor: brl(t.aReceber7), tom: "text-brand" },
    { label: `A pagar (${ps})`, valor: brl(t.aPagar7), tom: "text-ink" },
    { label: `Previsão (${ps})`, valor: brl(t.previsao7), tom: t.previsao7 < 0 ? "text-danger" : "text-ink" },
    {
      label: "Precisam de atenção",
      valor: String(t.atencao),
      tom: t.atencao > 0 ? "text-danger" : "text-brand",
      destaque: t.atencao > 0,
    },
  ];

  const a = {
    caixaNegativo: base.filter((x) => x.previsao7 < 0).length,
    comVencidos: base.filter((x) => x.aPagarVencido > 0 || x.aReceberVencido > 0).length,
    vencidoPagar: base.reduce((s, x) => s + x.aPagarVencido, 0),
    vencidoReceber: base.reduce((s, x) => s + x.aReceberVencido, 0),
    conciliacaoPendente: base.filter((x) => x.diasPendente !== null && x.diasPendente >= 3).length,
    agHojeQtd: base.reduce((s, x) => s + x.agHojeQtd, 0),
    agHojePagar: base.reduce((s, x) => s + x.agHojePagar, 0),
    agHojeReceber: base.reduce((s, x) => s + x.agHojeReceber, 0),
    comDocsNovos: base.filter((x) => x.docsNovos > 0).length,
    docsNovosTotal: base.reduce((s, x) => s + x.docsNovos, 0),
    relatoriosPendentes: base.filter((x) => x.relatorioStatus === "pendente" || x.relatorioStatus === "rascunho").length,
  };
  const alertCards: {
    key: string;
    Icon: typeof AlertTriangle;
    cls: string;
    iconCls: string;
    titulo: string;
    sub: string;
    filtra?: boolean;
  }[] = [];
  if (a.caixaNegativo > 0)
    alertCards.push({
      key: "neg",
      Icon: AlertTriangle,
      cls: "border-danger/30 bg-rose-50 text-danger",
      iconCls: "text-danger",
      titulo: `${a.caixaNegativo} ${a.caixaNegativo === 1 ? "empresa" : "empresas"} com caixa negativo`,
      sub: `Previsão de ${ps} no vermelho`,
      filtra: true,
    });
  if (a.comVencidos > 0)
    alertCards.push({
      key: "venc",
      Icon: Clock,
      cls: "border-amber-300 bg-amber-50 text-amber-800",
      iconCls: "text-amber-600",
      titulo: `${a.comVencidos} ${a.comVencidos === 1 ? "empresa" : "empresas"} com contas vencidas`,
      sub: `${brl(a.vencidoPagar)} a pagar · ${brl(a.vencidoReceber)} a receber`,
      filtra: true,
    });
  if (a.conciliacaoPendente > 0)
    alertCards.push({
      key: "conc",
      Icon: Landmark,
      cls: "border-line bg-white text-ink",
      iconCls: "text-ink-muted",
      titulo: `${a.conciliacaoPendente} ${a.conciliacaoPendente === 1 ? "empresa" : "empresas"} com conciliação pendente`,
      sub: "Extrato sem conciliar há 3+ dias",
      filtra: true,
    });
  if (a.agHojeQtd > 0)
    alertCards.push({
      key: "hoje",
      Icon: CalendarClock,
      cls: "border-brand/30 bg-brand-light/40 text-brand-dark",
      iconCls: "text-brand",
      titulo: `${a.agHojeQtd} ${a.agHojeQtd === 1 ? "lançamento agendado" : "lançamentos agendados"} para hoje`,
      sub: `${brl(a.agHojePagar)} a pagar · ${brl(a.agHojeReceber)} a receber`,
    });

  if (a.comDocsNovos > 0)
    alertCards.push({
      key: "docs",
      Icon: Inbox,
      cls: "border-brand/30 bg-brand-light/40 text-brand-dark",
      iconCls: "text-brand",
      titulo: `${a.comDocsNovos} ${a.comDocsNovos === 1 ? "empresa" : "empresas"} com documentos novos`,
      sub: `${a.docsNovosTotal} ${a.docsNovosTotal === 1 ? "arquivo não lido" : "arquivos não lidos"}`,
      filtra: true,
    });

  if (a.relatoriosPendentes > 0)
    alertCards.push({
      key: "rel",
      Icon: FileText,
      cls: "border-line bg-white text-ink",
      iconCls: "text-ink-muted",
      titulo: `${a.relatoriosPendentes} ${a.relatoriosPendentes === 1 ? "cliente sem relatório" : "clientes sem relatório"} de ${mesNome(dados.compFechar)}`,
      sub: "Análise do mês ainda não publicada no portal",
      filtra: true,
    });

  // ação direta do alerta ativo (mesma para todas as empresas afetadas)
  const acaoAtiva = alertaAtivo ? ACAO_ALERTA[alertaAtivo] ?? null : null;
  const AcaoIcon = acaoAtiva?.Icon ?? null;

  return (
    <div className="space-y-6">
      {/* período + nova empresa */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            {/*
              O período são seis botões, não um campo: como `<label>` este texto
              não tinha controle para apontar — clicar nele não fazia nada e o
              leitor de tela anunciava seis botões soltos. Vira o nome do grupo.
            */}
            <span id="carteira-periodo-rotulo" className="mb-1 block text-[11px] text-ink-muted">
              Período da previsão
            </span>
            <div
              role="group"
              aria-labelledby="carteira-periodo-rotulo"
              className="flex flex-wrap items-center overflow-hidden rounded-md border border-line text-sm"
            >
            {PERIODOS.map((p) => (
              <button
                key={p.v}
                type="button"
                onClick={() => router.push(`/carteira?periodo=${p.v}`)}
                className={
                  periodo === p.v
                    ? "border-r border-line bg-brand px-3 py-1.5 text-[12.5px] font-semibold text-white last:border-r-0"
                    : "border-r border-line px-3 py-1.5 text-[12.5px] font-medium text-ink-muted transition last:border-r-0 hover:bg-surface"
                }
              >
                {p.l}
              </button>
            ))}
            </div>
          </div>
          <div className="flex items-end gap-2">
            <MultiSelect
              label="Empresas"
              opcoes={dados.empresas.map((e) => ({ value: e.id, label: e.nome }))}
              selecionados={empSel}
              onChange={setEmpSel}
              placeholder="Buscar empresa…"
              textoTodos="Todas as empresas"
            />
            {empSel.length > 0 && (
              <button
                type="button"
                onClick={() => setEmpSel([])}
                className="pb-2 text-xs font-medium text-ink-soft underline-offset-2 hover:underline"
              >
                limpar
              </button>
            )}
          </div>
        </div>
        <NovaEmpresaBotao aoCriar={() => router.refresh()} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <div
            key={k.label}
            className={[
              "rounded-xl2 bg-white p-4 shadow-card",
              k.destaque ? "ring-2 ring-brand" : "",
            ].join(" ")}
          >
            <p className="text-xs font-semibold text-ink-muted">{k.label}</p>
            <p className={`num mt-1 text-lg font-extrabold ${k.tom ?? "text-ink"}`}>{k.valor}</p>
          </div>
        ))}
      </div>

      {/* alertas (compactos, clicáveis: filtram a lista) */}
      {(relPendentes.length > 0 || relRascunhos.length > 0) && (
        <div className="mb-4">
          <RelatoriosLote
            pendentes={relPendentes}
            rascunhos={relRascunhos}
            competencia={dados.compFechar}
            mesNome={mesNome(dados.compFechar)}
            creditos={dados.creditosIa}
          />
        </div>
      )}

      {/*
        A faixa de leitura incompleta é IRMÃ dos alertas, não alternativa.

        Na primeira versão ela morava no `else` do ternário: só aparecia quando
        não havia nenhum alerta. Basta uma empresa com documento novo entre
        quarenta para o ternário cair no primeiro ramo e o aviso sumir —
        justamente com o caixa errado e a previsão zerada por trás. O caso raro
        estava coberto e o comum não.
      */}
      {dados.incompleto && (
        <div className="flex items-start gap-2 rounded-xl2 border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {dados.incompleto}
        </div>
      )}

      {alertCards.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {alertCards.map((c) => {
            const Icon = c.Icon;
            const ativo = alertaAtivo === c.key;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => clicarAlerta(c.key)}
                title={ativo ? "Clique para limpar o filtro" : "Clique para ver só estas empresas"}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-left transition hover:brightness-95 ${c.cls} ${
                  ativo ? "ring-2 ring-current" : ""
                }`}
              >
                <Icon size={15} className={`shrink-0 ${c.iconCls}`} />
                <span className="min-w-0">
                  <span className="block text-xs font-semibold leading-tight">{c.titulo}</span>
                  <span className="num block text-[10px] opacity-80">{c.sub}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl2 border border-brand/30 bg-brand-light/30 px-4 py-3 text-sm font-medium text-brand-dark">
          <CheckCircle2 size={16} /> Tudo em ordem — nenhum alerta na carteira.
        </div>
      )}

      {/* filtro */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-soft">
          {predAtivo
            ? `Mostrando ${lista.length} ${lista.length === 1 ? "empresa" : "empresas"} deste alerta${acaoAtiva ? ` — use "${acaoAtiva.label}" em cada uma para resolver.` : "."}`
            : "Ordenado por urgência (atenção primeiro, depois menor previsão de caixa)."}
        </p>
        {alertaAtivo ? (
          <button
            type="button"
            onClick={() => setAlertaAtivo(null)}
            className="text-xs font-semibold text-brand underline-offset-2 hover:underline"
          >
            Limpar filtro
          </button>
        ) : (
          <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-ink-muted">
            <input
              type="checkbox"
              checked={soAtencao}
              onChange={(e) => setSoAtencao(e.target.checked)}
              className="h-4 w-4 accent-brand"
            />
            Só com atenção
          </label>
        )}
      </div>

      {/* lista de empresas */}
      {lista.length === 0 ? (
        <EmptyState
          // vazio por filtro (alerta clicado ou "só com atenção") é discreto; o
          // vazio de verdade — nenhuma empresa — mantém a moldura tracejada
          filtrado={Boolean(predAtivo) || soAtencao}
          titulo={
            predAtivo
              ? "Nenhuma empresa neste alerta."
              : soAtencao
                ? "Tudo em dia por aqui. 👍"
                : "Nenhuma empresa cadastrada."
          }
        />
      ) : (
        <div className="space-y-3">
          {lista.map((e) => {
            const open = aberto === e.id;
            const st = STATUS[e.status];
            const concAtrasada = e.diasPendente !== null && e.diasPendente >= 3;
            const hojeParts: string[] = [];
            if (e.agHojePagar > 0) hojeParts.push(`${brl(e.agHojePagar)} a pagar`);
            if (e.agHojeReceber > 0) hojeParts.push(`${brl(e.agHojeReceber)} a receber`);
            const temBadge = e.aPagarVencido > 0 || e.aReceberVencido > 0 || e.agHojeQtd > 0;
            return (
              <div key={e.id} className="rounded-xl2 bg-white shadow-card">
                {/* header / resumo */}
                <div className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <button
                    type="button"
                    onClick={() => setAberto(open ? null : e.id)}
                    className="flex flex-1 items-start gap-3 text-left"
                  >
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-ink">{e.nome}</span>
                        <ObjectStatus tom={st.tom}>{st.label}</ObjectStatus>
                        {e.docsNovos > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-brand-light px-2 py-0.5 text-[10px] font-semibold text-brand-dark">
                            <Inbox size={11} /> {e.docsNovos} doc{e.docsNovos > 1 ? "s" : ""} nov{e.docsNovos > 1 ? "os" : "o"}
                          </span>
                        )}
                      </span>
                      {temBadge && (
                        <span className="mt-1 flex flex-wrap items-center gap-1.5">
                          {e.aPagarVencido > 0 && (
                            <span className="num inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-danger">
                              <Clock size={11} /> Vencido {brl(e.aPagarVencido)}
                            </span>
                          )}
                          {e.aReceberVencido > 0 && (
                            <span className="num inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                              <Clock size={11} /> A receber vencido {brl(e.aReceberVencido)}
                            </span>
                          )}
                          {e.agHojeQtd > 0 && (
                            <span className="num inline-flex items-center gap-1 rounded-full bg-brand-light px-2 py-0.5 text-[10px] font-semibold text-brand-dark">
                              <CalendarClock size={11} /> Hoje: {e.agHojeQtd}
                              {hojeParts.length > 0 ? ` · ${hojeParts.join(" · ")}` : ""}
                            </span>
                          )}
                        </span>
                      )}
                    </span>
                  </button>

                  {/* mini-métricas no resumo */}
                  <div className="hidden items-center gap-5 md:flex">
                    <div className="text-right">
                      <p className="text-[11px] text-ink-muted">Caixa</p>
                      <p className={`num text-sm font-bold ${e.caixa < 0 ? "text-ink" : "text-ink"}`}>
                        {brl(e.caixa)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-ink-muted">Resultado mês</p>
                      <p className={`num text-sm font-bold ${e.resultadoMes < 0 ? "text-ink" : "text-brand"}`}>
                        {brl(e.resultadoMes)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-ink-muted">Previsão {ps}</p>
                      <p className={`num text-sm font-bold ${e.previsao7 < 0 ? "text-ink" : "text-brand"}`}>
                        {brl(e.previsao7)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-ink-muted">Conciliação</p>
                      <p
                        className={`flex items-center justify-end gap-1 text-xs font-semibold ${
                          !e.temExtrato ? "text-ink-soft" : concAtrasada ? "text-danger" : "text-ink"
                        }`}
                      >
                        {!e.temExtrato ? (
                          "sem extrato"
                        ) : e.pendenteDesde ? (
                          <>
                            <Clock size={12} /> {e.diasPendente}d atrás
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={12} className="text-brand" /> em dia
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  {acaoAtiva && AcaoIcon && (
                    <button
                      type="button"
                      onClick={() => irPara(e, acaoAtiva.rota(e), acaoAtiva.cookie)}
                      disabled={pending && indo === e.id}
                      className="flex items-center gap-1.5 rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
                    >
                      <AcaoIcon size={13} /> {indo === e.id && pending ? "Abrindo…" : acaoAtiva.label}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => abrirEmpresa(e)}
                    disabled={pending && indo === e.id}
                    className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand disabled:opacity-60"
                  >
                    {indo === e.id && pending ? "Abrindo…" : "Abrir"} <ArrowUpRight size={13} />
                  </button>
                  <button
                    aria-label={open ? "Recolher os detalhes" : "Ver os detalhes"}
                    aria-expanded={open}
                    type="button"
                    onClick={() => setAberto(open ? null : e.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-soft transition hover:bg-surface"
                  >
                    <ChevronDown size={16} className={open ? "rotate-180 transition" : "transition"} />
                  </button>
                </div>

                {/* detalhe (toggle) */}
                {open && (
                  <div className="border-t border-line px-5 py-4">
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                      <Detalhe label="Caixa atual" valor={brl(e.caixa)} tom={e.caixa < 0 ? "danger" : "ink"} />
                      <Detalhe
                        label="Resultado do mês"
                        valor={brl(e.resultadoMes)}
                        tom={e.resultadoMes < 0 ? "danger" : "brand"}
                      />
                      <Detalhe label={`A receber (${ps})`} valor={brl(e.aReceber7)} tom="brand" />
                      <Detalhe label={`A pagar (${ps})`} valor={brl(e.aPagar7)} tom="ink" />
                      <Detalhe
                        label={`Previsão (${ps})`}
                        valor={brl(e.previsao7)}
                        tom={e.previsao7 < 0 ? "danger" : "brand"}
                      />
                    </div>

                    {(e.aReceberVencido > 0 || e.aPagarVencido > 0) && (
                      <div className="mt-4 flex flex-wrap gap-4 rounded-lg bg-surface px-4 py-2.5 text-xs">
                        {e.aReceberVencido > 0 && (
                          <span className="text-ink-muted">
                            A receber vencido: <b className="num text-ink">{brl(e.aReceberVencido)}</b>
                          </span>
                        )}
                        {e.aPagarVencido > 0 && (
                          <span className="text-ink-muted">
                            A pagar vencido: <b className="num text-ink">{brl(e.aPagarVencido)}</b>
                          </span>
                        )}
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                      {!e.temExtrato ? (
                        <span className="flex items-center gap-1.5">
                          <AlertTriangle size={13} className="text-ink-soft" /> Sem extrato importado para conciliar.
                        </span>
                      ) : (
                        <>
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 size={13} className="text-brand" /> Conciliado até{" "}
                            <b className="text-ink">{dataBR(e.conciliadoAte)}</b>
                          </span>
                          {e.pendenteDesde && (
                            <span
                              className={`flex items-center gap-1.5 ${concAtrasada ? "text-danger" : "text-ink-muted"}`}
                            >
                              <Clock size={13} /> Conciliação pendente desde{" "}
                              <b>{dataBR(e.pendenteDesde)}</b> ({e.diasPendente} dias)
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    <div className="mt-3 flex items-center gap-1.5 text-xs">
                      <Lock size={13} className="shrink-0 text-ink-soft" />
                      <span className="text-ink-muted">Mês de {mesNome(dados.compFechar)}:</span>
                      {e.mesFechado ? (
                        <span className="font-semibold text-brand">Fechado ✓</span>
                      ) : (
                        <span className="font-semibold text-ink-soft">Em aberto</span>
                      )}
                    </div>

                    {e.relatorioStatus !== "na" && (
                      <div className="mt-3 flex items-center gap-1.5 text-xs">
                        <FileText size={13} className="shrink-0 text-ink-soft" />
                        <span className="text-ink-muted">Relatório de {mesNome(dados.compFechar)}:</span>
                        {e.relatorioStatus === "publicado" ? (
                          <span className="font-semibold text-brand">Publicado ✓</span>
                        ) : e.relatorioStatus === "rascunho" ? (
                          <span className="font-semibold text-amber-600">Rascunho — não publicado</span>
                        ) : (
                          <span className="font-semibold text-ink-soft">A entregar</span>
                        )}
                      </div>
                    )}

                    {(e.docsNovos > 0 || (e.temExtrato && e.pendenteDesde) || !e.mesFechado || e.relatorioStatus === "pendente" || e.relatorioStatus === "rascunho") && (
                      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                        <span className="text-[11px] text-ink-muted">Ações</span>
                        {!e.mesFechado && (<button type="button" onClick={() => irPara(e, "/configuracoes/fechamento", true)} disabled={pending && indo === e.id} className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand disabled:opacity-60"><Lock size={13} /> Fechar mês</button>)}
                        {e.docsNovos > 0 && (
                          <button
                            type="button"
                            onClick={() => irPara(e, `/documentos?empresa=${e.id}`, false)}
                            disabled={pending && indo === e.id}
                            className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand disabled:opacity-60"
                          >
                            <Inbox size={13} /> Tratar {e.docsNovos} documento{e.docsNovos > 1 ? "s" : ""}
                          </button>
                        )}
                        {e.temExtrato && e.pendenteDesde && (
                          <button
                            type="button"
                            onClick={() => irPara(e, "/conciliacao", true)}
                            disabled={pending && indo === e.id}
                            className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand disabled:opacity-60"
                          >
                            <Landmark size={13} /> Conciliar
                          </button>
                        )}
                        {(e.relatorioStatus === "pendente" || e.relatorioStatus === "rascunho") && (
                          <button
                            type="button"
                            onClick={() => irPara(e, "/relatorios", true)}
                            disabled={pending && indo === e.id}
                            className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand disabled:opacity-60"
                          >
                            <FileText size={13} /> {e.relatorioStatus === "rascunho" ? "Publicar relatório" : "Gerar relatório"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Detalhe({ label, valor, tom }: { label: string; valor: string; tom: "ink" | "brand" | "danger" }) {
  const cor = tom === "brand" ? "text-brand" : tom === "danger" ? "text-danger" : "text-ink";
  return (
    <div>
      <p className="text-[11px] text-ink-muted">{label}</p>
      <p className={`num mt-0.5 text-base font-bold ${cor}`}>{valor}</p>
    </div>
  );
}

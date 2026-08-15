import Link from "next/link";
import type { Metadata, Viewport } from "next";
import {
  ChevronLeft,
  ChevronRight,
  Building2,
  Sparkles,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Wallet,
  Upload,
} from "lucide-react";
import { sessaoDoPortal, dadosDoPortal, portalConfigurado } from "@/lib/portal-sessao";
import EnviarDocumentos from "@/components/portal/enviar-documentos";
import PortalPeriodo from "@/components/portal/portal-periodo";
import { brlRedondo } from "@/lib/formato";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MESES_LONGO = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

type MesData = { mes: number; entradas: number; saidas: number };
type PortalData = {
  empresa: string | null;
  escritorio_nome: string | null;
  logo_url: string | null;
  ano: number;
  meses: MesData[];
  meses_resultado?: MesData[];
  libera_analise?: boolean;
  libera_documentos?: boolean;
  periodo?: string;
  analise?: { competencia: string; conteudo: string } | null;
};

const ABAS = ["resultado", "visao_caixa", "relatorio", "documentos"] as const;
type Aba = (typeof ABAS)[number];

// Reduz a fonte em degraus conforme o número fica mais longo, pra não extrapolar o card.
function tamKpi(texto: string): string {
  const n = texto.length;
  if (n > 12) return "text-xs sm:text-lg";
  if (n > 9) return "text-sm sm:text-xl";
  return "text-base sm:text-2xl";
}

function normaliza(meses: MesData[] | undefined): MesData[] {
  const porMes = new Map<number, MesData>();
  for (const m of meses ?? []) porMes.set(m.mes, m);
  return Array.from({ length: 12 }, (_, i) => {
    const m = porMes.get(i + 1);
    return { mes: i + 1, entradas: Number(m?.entradas ?? 0), saidas: Number(m?.saidas ?? 0) };
  });
}

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  /*
    O título só sai personalizado para quem tem sessão.

    Sem isso, o nome do escritório e o logo vazariam para qualquer um que
    abrisse o link — pouco, mas é a mesma consulta que entrega o financeiro, e
    manter os dois caminhos com a mesma regra evita que um deles fique para trás
    na próxima mudança.
  */
  let nome = "Financeiro";
  const sessao = await sessaoDoPortal(params.token);
  if (sessao) {
    const d = await dadosDoPortal(params.token, new Date().getFullYear());
    nome = ((d as PortalData | null)?.escritorio_nome as string) || "Financeiro";
  }
  const base = `/portal/${params.token}`;
  return {
    title: `${nome} — Financeiro`,
    manifest: `${base}/manifest`,
    appleWebApp: { capable: true, title: nome, statusBarStyle: "default" },
    icons: { apple: `${base}/icon?size=180` },
  };
}

export function generateViewport(): Viewport {
  return { themeColor: "#12A594" };
}

/**
 * Tela para quem chegou com o link mas sem sessão.
 *
 * Não oferece "me mande o link" de propósito: um endereço público que dispara
 * e-mail a partir de um token que circula por WhatsApp é um caminho para spam e
 * para descobrir quem são os clientes do escritório. Quem libera o acesso é o
 * contador, na tela de Portal do cliente.
 */
function PedirAcesso() {
  /*
    Sem nome de empresa nem logo: esta tela é vista por quem NÃO tem sessão, e
    ela sai da mesma consulta que entrega o financeiro. Dizer "portal da Padaria
    Estrela" para quem só tem o link já confirma de quem é o link.
  */
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-6">
      <div className="max-w-sm rounded-xl2 bg-white p-8 text-center shadow-card">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white">
          <Building2 size={20} />
        </div>
        <h1 className="mt-4 text-lg font-bold text-ink">Acesso por e-mail</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Este portal abre por um link enviado para o seu e-mail, e não pelo endereço compartilhado.
        </p>
        <p className="mt-3 text-sm text-ink-muted">
          Peça o acesso ao seu contador. Você recebe um e-mail com um botão que abre o portal e mantém você conectado
          por duas semanas.
        </p>
      </div>
    </div>
  );
}

function PortalIndisponivel() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-6">
      <div className="max-w-sm rounded-xl2 bg-white p-8 text-center shadow-card">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white">
          <Building2 size={20} />
        </div>
        <h1 className="mt-4 text-lg font-bold text-ink">Portal temporariamente indisponível</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Não é problema do seu link. Avise o seu contador: o portal está com uma configuração pendente do lado do
          sistema.
        </p>
      </div>
    </div>
  );
}

export default async function PortalPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { ano?: string; v?: string; t?: string; m?: string; aba?: string };
}) {
  const ano = Number(searchParams.ano) || new Date().getFullYear();
  /*
    A ordem importa: sessão ANTES dos dados.

    A primeira versão desta mudança consultava `portal_dados` e só depois
    checava a sessão. Como a RPC é executável pelo `anon` (tem de ser: o portal
    é público) e a chave anônima está no pacote do navegador, qualquer um com o
    link podia chamá-la direto e receber o ano inteiro em JSON. O login
    obrigatório existia no HTML e não nos dados — que é onde ele importa.
  */
  /*
    Falta de configuração não pode virar "peça acesso".

    O portal passou a depender da chave de serviço. Sem ela, a sessão nunca
    valida — e mandar o cliente pedir um link que também não vai funcionar cria
    um laço de suporte que ninguém consegue quebrar do lado de fora. Dizer que o
    problema é do sistema é o mínimo.
  */
  if (!portalConfigurado()) return <PortalIndisponivel />;

  const sessao = await sessaoDoPortal(params.token);
  const portal = sessao ? ((await dadosDoPortal(params.token, ano)) as PortalData | null) : null;

  if (!sessao) return <PedirAcesso />;

  if (!portal) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-6">
        <div className="max-w-sm rounded-xl2 bg-white p-8 text-center shadow-card">
          <h1 className="text-lg font-bold text-ink">Portal indisponível</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Este link não está mais ativo. Peça um novo link ao seu contador.
          </p>
        </div>
      </div>
    );
  }

  const libDocs = portal.libera_documentos !== false;
  const abasPermitidas: Aba[] = libDocs
    ? ["resultado", "visao_caixa", "relatorio", "documentos"]
    : ["resultado", "visao_caixa", "relatorio"];
  const aba: Aba = abasPermitidas.includes((searchParams.aba ?? "") as Aba)
    ? (searchParams.aba as Aba)
    : "resultado";
  const base = `/portal/${params.token}`;
  const ehFinanceira = aba === "resultado" || aba === "visao_caixa";

  // Caixa = por data_pagamento (meses); Resultado = por competência (meses_resultado).
  const linhas = normaliza(aba === "visao_caixa" ? portal.meses : portal.meses_resultado ?? portal.meses);

  // período isolado
  const v = ["ano", "tri", "mes"].includes(searchParams.v ?? "") ? (searchParams.v as string) : "ano";
  const t = Math.min(4, Math.max(1, Number(searchParams.t) || 1));
  const mSel = Math.min(12, Math.max(1, Number(searchParams.m) || new Date().getMonth() + 1));

  const doPeriodo =
    v === "ano" ? linhas : v === "tri" ? linhas.filter((l) => Math.ceil(l.mes / 3) === t) : linhas.filter((l) => l.mes === mSel);

  const pEntradas = doPeriodo.reduce((s, l) => s + l.entradas, 0);
  const pSaidas = doPeriodo.reduce((s, l) => s + l.saidas, 0);
  const pResultado = pEntradas - pSaidas;
  const maxBarra = Math.max(1, ...doPeriodo.map((l) => Math.max(l.entradas, l.saidas)));

  const mesAnt = v === "mes" && mSel > 1 ? linhas[mSel - 2] : null;
  const resAnt = mesAnt ? mesAnt.entradas - mesAnt.saidas : null;
  const variacao = resAnt !== null ? pResultado - resAnt : null;

  const tituloPeriodo =
    v === "ano" ? `Ano de ${ano}` : v === "tri" ? `${t}º trimestre de ${ano}` : `${MESES_LONGO[mSel - 1]} de ${ano}`;
  const mostraGrafico = v !== "mes" && doPeriodo.length > 1;

  const tabs: { id: Aba; label: string; curto: string; icon: typeof BarChart3 }[] = (
    [
      { id: "resultado", label: "Resultado", curto: "Resultado", icon: BarChart3 },
      { id: "visao_caixa", label: "Visão de caixa", curto: "Caixa", icon: Wallet },
      { id: "relatorio", label: "Relatório", curto: "Relatório", icon: Sparkles },
      { id: "documentos", label: "Documentos", curto: "Documentos", icon: Upload },
    ] as { id: Aba; label: string; curto: string; icon: typeof BarChart3 }[]
  ).filter((tb) => abasPermitidas.includes(tb.id));

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-10 border-b border-line bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6 sm:py-4">
          {portal.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={portal.logo_url} alt="" className="h-8 w-auto max-w-[150px] object-contain" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white">
              <Building2 size={18} />
            </div>
          )}
          <div className="leading-tight">
            {portal.escritorio_nome && <p className="text-sm font-bold text-ink">{portal.escritorio_nome}</p>}
            <p className="text-xs text-ink-muted">{portal.empresa}</p>
          </div>
        </div>

        <div className="mx-auto hidden max-w-3xl px-2 sm:block sm:px-4">
          <nav className="flex gap-1 overflow-x-auto">
            {tabs.map((tb) => {
              const ativa = tb.id === aba;
              const Icon = tb.icon;
              return (
                <Link
                  key={tb.id}
                  href={`${base}?aba=${tb.id}&ano=${ano}`}
                  className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-semibold transition ${
                    ativa ? "border-brand text-brand" : "border-transparent text-ink-muted hover:text-ink"
                  }`}
                >
                  <Icon size={15} /> {tb.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 pt-5 pb-28 sm:px-6 sm:py-7">
        {ehFinanceira && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-xl font-extrabold tracking-tight text-ink">
                {aba === "visao_caixa" ? "Visão de caixa" : "Resultado"}
              </h1>
              <div className="flex items-center gap-2">
                <Link
                  href={`${base}?aba=${aba}&ano=${ano - 1}&v=${v}&t=${t}&m=${mSel}`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white text-ink-muted transition hover:border-brand hover:text-brand"
                >
                  <ChevronLeft size={16} />
                </Link>
                <span className="num min-w-14 text-center text-base font-bold text-ink">{ano}</span>
                <Link
                  href={`${base}?aba=${aba}&ano=${ano + 1}&v=${v}&t=${t}&m=${mSel}`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white text-ink-muted transition hover:border-brand hover:text-brand"
                >
                  <ChevronRight size={16} />
                </Link>
              </div>
            </div>

            <PortalPeriodo base={base} ano={ano} v={v} t={t} m={mSel} aba={aba} />

            <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{tituloPeriodo}</p>

            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <div className="rounded-xl2 bg-white p-3 shadow-card sm:p-5">
                <p className="text-[11px] font-semibold text-ink-soft sm:text-xs">Entradas</p>
                <p className={`num mt-1 font-extrabold leading-tight text-brand ${tamKpi(brlRedondo(pEntradas))}`}>{brlRedondo(pEntradas)}</p>
              </div>
              <div className="rounded-xl2 bg-white p-3 shadow-card sm:p-5">
                <p className="text-[11px] font-semibold text-ink-soft sm:text-xs">Saídas</p>
                <p className={`num mt-1 font-extrabold leading-tight text-ink ${tamKpi(brlRedondo(pSaidas))}`}>{brlRedondo(pSaidas)}</p>
              </div>
              <div className="rounded-xl2 bg-white p-3 shadow-card sm:p-5">
                <p className="text-[11px] font-semibold text-ink-soft sm:text-xs">Resultado</p>
                <p className={`num mt-1 font-extrabold leading-tight ${pResultado < 0 ? "text-ink" : "text-brand"} ${tamKpi(brlRedondo(pResultado))}`}>
                  {brlRedondo(pResultado)}
                </p>
              </div>
            </div>

            {variacao !== null && (
              <div className="flex items-center gap-2 rounded-xl2 bg-white px-4 py-3 text-sm shadow-card">
                {variacao >= 0 ? (
                  <TrendingUp size={16} className="text-brand" />
                ) : (
                  <TrendingDown size={16} className="text-danger" />
                )}
                <span className="text-ink-muted">Resultado vs. mês anterior:</span>
                <span className={`num font-bold ${variacao < 0 ? "text-ink" : "text-brand"}`}>
                  {variacao >= 0 ? "+" : ""}
                  {brlRedondo(variacao)}
                </span>
              </div>
            )}

            {mostraGrafico && (
              <div className="rounded-xl2 bg-white p-4 shadow-card sm:p-5">
                <div className="mb-4 flex items-center gap-4 text-xs text-ink-muted">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm bg-brand" /> Entradas
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm bg-ink-muted" /> Saídas
                  </span>
                </div>
                <div className="flex items-end justify-between gap-1.5" style={{ height: 150 }}>
                  {doPeriodo.map((l) => (
                    <div key={l.mes} className="flex flex-1 flex-col items-center justify-end gap-1">
                      <div className="flex w-full items-end justify-center gap-0.5" style={{ height: 120 }}>
                        <div
                          className="w-1/2 rounded-t bg-brand"
                          style={{ height: `${(l.entradas / maxBarra) * 100}%` }}
                          title={`Entradas ${MESES[l.mes - 1]}: ${brlRedondo(l.entradas)}`}
                        />
                        <div
                          className="w-1/2 rounded-t bg-ink-muted"
                          style={{ height: `${(l.saidas / maxBarra) * 100}%` }}
                          title={`Saídas ${MESES[l.mes - 1]}: ${brlRedondo(l.saidas)}`}
                        />
                      </div>
                      <span className="text-[10px] text-ink-soft">{MESES[l.mes - 1]}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {doPeriodo.length > 1 && (
              <div className="space-y-2">
                {doPeriodo.map((l) => {
                  const r = l.entradas - l.saidas;
                  return (
                    <div
                      key={l.mes}
                      className="flex items-center justify-between rounded-xl2 bg-white px-4 py-3 shadow-card"
                    >
                      <div>
                        <p className="text-sm font-bold text-ink">{MESES_LONGO[l.mes - 1]}</p>
                        <p className="num mt-0.5 text-xs text-ink-soft">
                          Entradas {brlRedondo(l.entradas)} · Saídas {brlRedondo(l.saidas)}
                        </p>
                      </div>
                      <p className={`num text-base font-extrabold ${r < 0 ? "text-ink" : "text-brand"}`}>{brlRedondo(r)}</p>
                    </div>
                  );
                })}
              </div>
            )}

            <p className="pb-2 text-center text-[11px] text-ink-soft">
              {aba === "visao_caixa"
                ? "Valores efetivamente pagos e recebidos no período (regime de caixa)."
                : "Valores reconhecidos no período, independente do pagamento (regime de competência)."}
            </p>
          </>
        )}

        {aba === "relatorio" && (
          <>
            <h1 className="text-xl font-extrabold tracking-tight text-ink">Relatório do mês</h1>
            {portal.analise?.conteudo ? (
              <div className="rounded-xl2 border border-brand/30 bg-white p-5 shadow-card">
                <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
                  <Sparkles size={16} className="text-brand" /> Análise do mês
                  <span className="num text-xs font-medium text-ink-soft">{portal.analise.competencia}</span>
                </h2>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink">{portal.analise.conteudo}</p>
              </div>
            ) : (
              <div className="rounded-xl2 border border-dashed border-line bg-white px-4 py-10 text-center text-sm text-ink-soft">
                A análise ainda não foi publicada. Quando o seu escritório liberar, ela aparece aqui.
              </div>
            )}
          </>
        )}

        {aba === "documentos" && (
          <>
            <h1 className="text-xl font-extrabold tracking-tight text-ink">Documentos</h1>
            <EnviarDocumentos
              token={params.token}
              identidade={sessao ? { nome: sessao.nome, email: sessao.email } : null}
            />
          </>
        )}
      </main>

      {/* Barra de navegação inferior (mobile / PWA) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-line bg-white sm:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {tabs.map((tb) => {
          const ativa = tb.id === aba;
          const Icon = tb.icon;
          return (
            <Link
              key={tb.id}
              href={`${base}?aba=${tb.id}&ano=${ano}`}
              className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold transition ${
                ativa ? "text-brand" : "text-ink-muted"
              }`}
            >
              <Icon size={20} />
              {tb.curto}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

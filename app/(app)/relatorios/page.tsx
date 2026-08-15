import { Fragment } from "react";
import { getEmpresaContext } from "@/lib/empresa";
import { getRelatorio, getFluxoCaixa, type Relatorio, type FluxoCaixa } from "@/lib/relatorio";
import { getInadimplencia } from "@/lib/inadimplencia";
import { getAVencer } from "@/lib/a-vencer";
import { getAging } from "@/lib/aging";
import { getPorCentroCusto, getCentrosLista } from "@/lib/centro-custo";
import { getOrcadoRealizado } from "@/lib/relatorio-orcado";
import RelatorioControls from "@/components/relatorio/relatorio-controls";
import BaixarCsv from "@/components/relatorio/baixar-csv";
import AnaliseIA from "@/components/relatorio/analise-ia";
import AssistenteFinanceiro from "@/components/relatorio/assistente-financeiro";
import EvolucaoAnalise, { type PontoEvolucao } from "@/components/relatorio/evolucao-analise";
import PageHeader from "@/components/ui/page-header";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const TRIMESTRES = ["1º tri", "2º tri", "3º tri", "4º tri"];

// Soma os 12 meses em 4 trimestres (para séries somáveis: resultado, receitas, etc.).
function aggTri(v: number[]): number[] {
  return [0, 1, 2, 3].map((t) => (v[t * 3] ?? 0) + (v[t * 3 + 1] ?? 0) + (v[t * 3 + 2] ?? 0));
}
function aggRelTri(r: Relatorio): Relatorio {
  return {
    ...r,
    secoes: r.secoes.map((s) => ({
      ...s,
      subtotal: aggTri(s.subtotal),
      grupos: s.grupos.map((g) => ({
        ...g,
        valores: aggTri(g.valores),
        categorias: g.categorias.map((c) => ({ ...c, valores: aggTri(c.valores) })),
      })),
    })),
    resultado: aggTri(r.resultado),
    resultadoOperacional: aggTri(r.resultadoOperacional),
  };
}
function aggFluxoTri(f: FluxoCaixa): FluxoCaixa {
  return {
    ...f,
    recebimentos: aggTri(f.recebimentos),
    pagamentos: aggTri(f.pagamentos),
    geracao: aggTri(f.geracao),
    // saldo não soma: pega o saldo no início/fim de cada trimestre.
    saldoInicial: [0, 1, 2, 3].map((t) => f.saldoInicial[t * 3] ?? 0),
    saldoFinal: [0, 1, 2, 3].map((t) => f.saldoFinal[t * 3 + 2] ?? 0),
    semGrupo: aggTri(f.semGrupo),
    secoes: f.secoes.map((s) => ({
      ...s,
      subtotal: aggTri(s.subtotal),
      grupos: s.grupos.map((g) => ({ ...g, valores: aggTri(g.valores) })),
    })),
  };
}

function fmt(v: number): string {
  return Math.round(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}
function classeValor(v: number, base = "text-ink"): string {
  if (v < 0) return "text-ink";
  if (v === 0) return "text-ink-soft";
  return base;
}

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: { ano?: string; base?: string; visao?: string; modo?: string; mes?: string; mesA?: string; mesB?: string; detalhe?: string; g?: string; centro?: string };
}) {
  const { atual } = await getEmpresaContext();
  const empresaId = atual?.id ?? "";
  const ano = Number(searchParams.ano) || new Date().getFullYear();
  const modos = ["resultado", "caixa", "comparativo", "aging", "orcado", "analise"];
  const modo = modos.includes(searchParams.modo ?? "") ? (searchParams.modo as string) : "resultado";
  const bases = ["competencia", "vencimento", "pagamento"];
  const base = (bases.includes(searchParams.base ?? "") ? searchParams.base : "pagamento") as
    | "competencia"
    | "vencimento"
    | "pagamento";
  const mes = Math.min(12, Math.max(0, Number(searchParams.mes) || 0));
  const hojeM = new Date().getMonth() + 1;
  const mesA = Math.min(12, Math.max(1, Number(searchParams.mesA) || Math.max(1, hojeM - 1)));
  const mesB = Math.min(12, Math.max(1, Number(searchParams.mesB) || hojeM));
  const visaoOrc = base === "pagamento" ? "realizado" : "previsto";
  const det = searchParams.detalhe === "1";
  const gran = searchParams.g === "tri" ? "tri" : "mes";
  const centro = searchParams.centro ?? "";
  const centros = empresaId ? await getCentrosLista(empresaId) : [];

  let dadosEvolucao: PontoEvolucao[] = [];
  if (modo === "analise" && empresaId) {
    const [relEv, fcEv] = await Promise.all([
      getRelatorio(empresaId, ano, "competencia"),
      getFluxoCaixa(empresaId, ano),
    ]);
    dadosEvolucao = MESES.map((label, m) => ({
      label,
      receitas: relEv.receitasMensais[m] ?? 0,
      despesas: relEv.despesasMensais[m] ?? 0,
      resultado: relEv.resultado[m] ?? 0,
      saldo: fcEv.saldoFinal[m] ?? 0,
    }));
  }

  const baseTxt =
    base === "pagamento"
      ? "pela data de pagamento (caixa/agendamento)"
      : base === "vencimento"
        ? "pela data de vencimento"
        : "pela data de competência";

  const titulo =
    modo === "orcado"
      ? "Orçado × Realizado"
      : modo === "analise"
        ? "Análise do mês"
        : modo === "comparativo"
        ? "Comparativo mês a mês"
        : modo === "aging"
          ? "Aging de recebíveis e pagáveis"
          : modo === "centro"
              ? "Resultado por centro de custo"
              : modo === "caixa"
                ? "Fluxo de Caixa (DFC)"
                : "Resultado (regime de competência)";

  return (
    <div className="space-y-5">
      <PageHeader
        titulo={titulo}
        acoes={modo !== "analise" ? <BaixarCsv nome={`relatorio-${modo}-${ano}`} /> : undefined}
        sub={
          <>
          {modo === "orcado"
            ? `Compara a meta orçada com o ${visaoOrc === "realizado" ? "realizado (pago/recebido)" : "previsto (competência)"} — ${
                mes === 0 ? "ano todo" : MESES[mes - 1] + "/" + ano
              }.`
            : modo === "analise"
              ? "A evolução do ano dá o contexto; a IA gera um rascunho que você ajusta e publica no portal do cliente."
              : modo === "aging"
              ? "Contas em aberto por cliente e por fornecedor: a vencer e o atraso escalonado. Use “Ver lançamentos” para abrir os títulos."
              : modo === "centro"
                  ? "Receitas, despesas e resultado de cada centro de custo, pela data de competência."
                  : modo === "comparativo"
                    ? `Compara dois meses ${baseTxt}, com a variação entre eles.`
                    : modo === "caixa"
                      ? "Saldo inicial, recebimentos, pagamentos e saldo final de cada mês — pela data de pagamento (caixa)."
                      : "Receitas e despesas pela data de competência. Receita soma, despesa subtrai; nada fica de fora do resultado."}
          </>
        }
      >
        <div className="pb-3">
          <RelatorioControls ano={ano} base={base} modo={modo} mes={mes} mesA={mesA} mesB={mesB} detalhe={det} gran={gran} centros={centros} centro={centro} />
        </div>
      </PageHeader>

      {(modo === "resultado" || modo === "caixa") && (
        <Indicadores empresaId={empresaId} ano={ano} modo={modo} centro={centro} />
      )}

      {modo === "analise" ? (
        <>
          {empresaId && <EvolucaoAnalise dados={dadosEvolucao} ano={ano} />}
          <AnaliseIA empresaId={empresaId} />
          <AssistenteFinanceiro empresaId={empresaId} />
        </>
      ) : modo === "orcado" ? (
        <OrcadoTabela empresaId={empresaId} ano={ano} mes={mes} visao={visaoOrc} det={det} />
      ) : modo === "aging" ? (
        <AgingTabela empresaId={empresaId} det={det} centro={centro} />
      ) : modo === "centro" ? (
        <CentroCustoTabela empresaId={empresaId} ano={ano} />
      ) : modo === "comparativo" ? (
        <ComparativoTabela empresaId={empresaId} ano={ano} base={base} mesA={mesA} mesB={mesB} det={det} centro={centro} gran={gran} />
      ) : modo === "caixa" ? (
        <FluxoCaixaTabela empresaId={empresaId} ano={ano} det={det} gran={gran} centro={centro} />
      ) : (
        <ResultadoTabela empresaId={empresaId} ano={ano} det={det} gran={gran} centro={centro} />
      )}

      {modo !== "analise" && (
      <p className="text-[11px] text-ink-soft">
        {modo === "orcado"
          ? "Diferença = Realizado − Orçado. Verde = dentro/melhor que a meta; vermelho = receita abaixo ou despesa acima do orçado."
          : modo === "aging"
            ? "Contas em aberto pela data de vencimento. “A vencer” = ainda no prazo; demais faixas = dias de atraso. Inclui recebíveis (clientes) e pagáveis (fornecedores)."
            : modo === "centro"
                ? "Resultado = receitas − despesas de cada centro, pela data de competência. Sem centro entra como “Sem centro de custo”."
                : modo === "caixa"
                  ? "Fluxo de caixa pela data de pagamento, aberto por atividade. Operacional e financeiro entram no resultado; investimento e financiamento ficam fora. Use “Detalhar” para abrir os grupos."
                  : "Valores em R$ com sinal: entradas somam, saídas subtraem. O pontinho indica a natureza do grupo (verde = receita, cinza = despesa)."}
      </p>
      )}
    </div>
  );
}

/* ---------- Resultado (DRE gerencial, competência, 12 meses) ---------- */
async function ResultadoTabela({ empresaId, ano, det, gran, centro }: { empresaId: string; ano: number; det: boolean; gran: string; centro: string }) {
  let rel = await getRelatorio(empresaId, ano, "competencia", centro);
  if (gran === "tri") rel = aggRelTri(rel);
  const COLS = gran === "tri" ? TRIMESTRES : MESES;
  if (!rel.temGrupos)
    return (
      <div className="rounded-xl2 border border-dashed border-line bg-white py-16 text-center text-sm text-ink-muted">
        Cadastre grupos e categorias para montar o relatório.
      </div>
    );
  const av = (v: number) => (rel.totalReceitas > 0 ? (v / rel.totalReceitas) * 100 : 0);
  const fmtPct = (p: number) => `${p.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  return (
    <div className="overflow-x-auto rounded-xl2 bg-white shadow-card">
      {(rel.semCategoria.qtd > 0 || rel.divergencias > 0) && (
        <div className="flex flex-wrap gap-2 border-b border-line px-3 py-2 text-[11px]">
          {rel.semCategoria.qtd > 0 && (
            <span className="rounded-md bg-surface px-2 py-0.5 font-medium text-ink-muted">
              {rel.semCategoria.qtd} lançamento(s) sem categoria — veja a linha “Não categorizado”.
            </span>
          )}
          {rel.divergencias > 0 && (
            <span className="rounded-md bg-surface px-2 py-0.5 font-medium text-ink-muted">
              {rel.divergencias} com tipo divergente do grupo (ex.: entrada em grupo de despesa).
            </span>
          )}
        </div>
      )}
      <table className="w-full min-w-[940px] border-collapse text-xs">
        <thead>
          <tr className="border-b border-line">
            <th className="sticky left-0 z-10 bg-white px-3 py-2.5 text-left font-semibold text-ink-soft">
              Resultado
            </th>
            {COLS.map((m) => (
              <th key={m} className="px-2 py-2.5 text-right font-semibold text-ink-soft">
                {m}
              </th>
            ))}
            <th className="px-3 py-2.5 text-right font-semibold text-ink">{ano}</th>
            <th className="px-3 py-2.5 text-right font-semibold text-ink-soft">% rec.</th>
          </tr>
        </thead>
        <tbody>
          {rel.secoes.map((s) => (
            <Fragment key={s.chave}>
              <tr className="bg-surface/60">
                <td
                  colSpan={COLS.length + 3}
                  className="sticky left-0 bg-surface/60 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-muted"
                >
                  {s.titulo}{s.entraResultado ? "" : " (fora do resultado)"}
                </td>
              </tr>
              {s.grupos.map((g) => (
                <Fragment key={g.id}>
                <tr className="border-b border-line/70">
                  <td className="sticky left-0 z-10 bg-white px-3 py-2 text-ink">
                    <span className="flex items-center gap-1.5">
                      <span
                        className={`inline-block h-1.5 w-1.5 rounded-full ${g.eh_receita ? "bg-brand" : "bg-ink-soft"}`}
                      />
                      {g.nome}
                    </span>
                  </td>
                  {g.valores.map((v, i) => (
                    <td key={i} className={`num px-2 py-2 text-right ${classeValor(v)}`}>
                      {fmt(v)}
                    </td>
                  ))}
                  <td className={`num px-3 py-2 text-right font-semibold ${classeValor(g.total)}`}>{fmt(g.total)}</td>
                  <td className="num px-3 py-2 text-right text-ink-soft">{fmtPct(av(g.total))}</td>
                </tr>
                {det &&
                  g.categorias.map((c) => (
                    <tr key={c.id} className="border-b border-line/40 bg-white">
                      <td className="sticky left-0 z-10 bg-white py-1.5 pl-9 pr-3 text-[11px] text-ink-muted">{c.nome}</td>
                      {c.valores.map((v, i) => (
                        <td key={i} className={`num px-2 py-1.5 text-right text-[11px] ${classeValor(v)}`}>{fmt(v)}</td>
                      ))}
                      <td className={`num px-3 py-1.5 text-right text-[11px] ${classeValor(c.total)}`}>{fmt(c.total)}</td>
                      <td className="num px-3 py-1.5 text-right text-[11px] text-ink-soft">{fmtPct(av(c.total))}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
              <tr className="border-b border-line bg-white">
                <td className="sticky left-0 z-10 bg-white px-3 py-2 text-xs font-bold text-ink">
                  Resultado {s.titulo}
                </td>
                {s.subtotal.map((v, i) => (
                  <td key={i} className={`num px-2 py-2 text-right font-semibold ${classeValor(v)}`}>
                    {fmt(v)}
                  </td>
                ))}
                <td className={`num px-3 py-2 text-right font-bold ${classeValor(s.subtotalTotal)}`}>
                  {fmt(s.subtotalTotal)}
                </td>
                <td className="num px-3 py-2 text-right font-semibold text-ink-soft">{fmtPct(av(s.subtotalTotal))}</td>
              </tr>
              {s.chave === "operacionais" && (
                <tr className="border-b-2 border-line/80 bg-surface/40">
                  <td className="sticky left-0 z-10 bg-surface/40 px-3 py-2 text-xs font-extrabold text-ink">= Resultado Operacional</td>
                  {rel.resultadoOperacional.map((v, i) => (
                    <td key={i} className={`num px-2 py-2 text-right font-bold ${classeValor(v)}`}>{fmt(v)}</td>
                  ))}
                  <td className={`num px-3 py-2 text-right font-extrabold ${classeValor(rel.resultadoOperacionalTotal)}`}>{fmt(rel.resultadoOperacionalTotal)}</td>
                  <td className="num px-3 py-2 text-right font-bold text-ink-soft">{fmtPct(av(rel.resultadoOperacionalTotal))}</td>
                </tr>
              )}
            </Fragment>
          ))}
          <tr className="border-t-2 border-line bg-brand-light/40">
            <td className="sticky left-0 z-10 bg-brand-light/40 px-3 py-2.5 text-sm font-extrabold text-ink">
              Resultado Líquido
            </td>
            {rel.resultado.map((v, i) => (
              <td key={i} className={`num px-2 py-2.5 text-right font-bold ${classeValor(v)}`}>
                {fmt(v)}
              </td>
            ))}
            <td className={`num px-3 py-2.5 text-right font-extrabold ${classeValor(rel.resultadoTotal)}`}>
              {fmt(rel.resultadoTotal)}
            </td>
            <td className="num px-3 py-2.5 text-right font-extrabold text-ink">{fmtPct(av(rel.resultadoTotal))}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Fluxo de Caixa (DFC, 12 meses) ---------- */
async function FluxoCaixaTabela({ empresaId, ano, det, gran, centro }: { empresaId: string; ano: number; det: boolean; gran: string; centro: string }) {
  let fc = await getFluxoCaixa(empresaId, ano, centro);
  if (gran === "tri") fc = aggFluxoTri(fc);
  const COLS = gran === "tri" ? TRIMESTRES : MESES;
  if (!fc.temDados)
    return (
      <div className="rounded-xl2 border border-dashed border-line bg-white py-16 text-center text-sm text-ink-muted">
        Cadastre contas e registre pagamentos/recebimentos para montar o fluxo de caixa.
      </div>
    );
  const geracaoAno = fc.totalReceb - fc.totalPag;
  const saldoFinalAno = fc.saldoFinal[fc.saldoFinal.length - 1];
  // Componente definido dentro do render — o antipadrão que fez um campo do app
  // aceitar só uma letra. Aqui não tem efeito: este arquivo não é `"use client"`,
  // as funções de fora são `async` e rodam no servidor uma vez só. Não há
  // re-render nem reconciliação para remontar nada. Fica como está — mexer numa
  // tela de relatório de 1.000 linhas para ganhar zero não é troca boa.
  const Lin = ({
    rotulo,
    valores,
    anoVal,
    forte = false,
    saldo = false,
    sub = false,
  }: {
    rotulo: string;
    valores: number[];
    anoVal: number;
    forte?: boolean;
    saldo?: boolean;
    sub?: boolean;
  }) => (
    <tr className={saldo ? "bg-surface/40" : "border-b border-line/70"}>
      <td
        className={`sticky left-0 z-10 px-3 py-2 ${saldo ? "bg-surface/40" : "bg-white"} ${
          forte ? "font-bold text-ink" : sub ? "pl-9 text-ink-muted" : "text-ink"
        }`}
      >
        {rotulo}
      </td>
      {valores.map((v, i) => (
        <td key={i} className={`num px-2 py-2 text-right ${forte ? "font-semibold" : ""} ${classeValor(v)}`}>
          {fmt(v)}
        </td>
      ))}
      <td className={`num px-3 py-2 text-right font-bold ${classeValor(anoVal)}`}>{fmt(anoVal)}</td>
    </tr>
  );
  return (
    <div className="overflow-x-auto rounded-xl2 bg-white shadow-card">
      <table className="w-full min-w-[940px] border-collapse text-xs">
        <thead>
          <tr className="border-b border-line">
            <th className="sticky left-0 z-10 bg-white px-3 py-2.5 text-left font-semibold text-ink-soft">
              Fluxo de Caixa
            </th>
            {COLS.map((m) => (
              <th key={m} className="px-2 py-2.5 text-right font-semibold text-ink-soft">
                {m}
              </th>
            ))}
            <th className="px-3 py-2.5 text-right font-semibold text-ink">{ano}</th>
          </tr>
        </thead>
        <tbody>
          <Lin rotulo="Saldo inicial" valores={fc.saldoInicial} anoVal={fc.saldoInicialPeriodo} saldo />
          {fc.secoes.map((s) => (
            <Fragment key={s.chave}>
              <Lin
                rotulo={s.entraResultado ? s.titulo : `${s.titulo} (fora do resultado)`}
                valores={s.subtotal}
                anoVal={s.subtotalTotal}
                forte
              />
              {det &&
                s.grupos.map((g) => <Lin key={g.id} rotulo={g.nome} valores={g.valores} anoVal={g.total} sub />)}
            </Fragment>
          ))}
          {fc.semGrupo.some((v) => v !== 0) && (
            <Lin rotulo="Sem categoria" valores={fc.semGrupo} anoVal={fc.semGrupoTotal} sub />
          )}
          <Lin rotulo="(=) Geração de caixa" valores={fc.geracao} anoVal={geracaoAno} forte />
          <tr className="border-t-2 border-line bg-brand-light/40">
            <td className="sticky left-0 z-10 bg-brand-light/40 px-3 py-2.5 text-sm font-extrabold text-ink">
              Saldo final
            </td>
            {fc.saldoFinal.map((v, i) => (
              <td key={i} className={`num px-2 py-2.5 text-right font-bold ${classeValor(v)}`}>
                {fmt(v)}
              </td>
            ))}
            <td className={`num px-3 py-2.5 text-right font-extrabold ${classeValor(saldoFinalAno)}`}>
              {fmt(saldoFinalAno)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Orçado × Realizado ---------- */
function pct(orcado: number, realizado: number): string {
  if (orcado <= 0) return "—";
  return (realizado / orcado * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 }) + "%";
}
function classeDif(dif: number, ehReceita: boolean, orcado: number): string {
  if (orcado <= 0) return "text-ink-soft";
  const ruim = ehReceita ? dif < 0 : dif > 0;
  return ruim ? "text-danger" : "text-brand";
}

async function OrcadoTabela({
  empresaId,
  ano,
  mes,
  visao,
  det,
}: {
  empresaId: string;
  ano: number;
  mes: number;
  visao: "realizado" | "previsto";
  det: boolean;
}) {
  const rel = await getOrcadoRealizado(empresaId, ano, mes, visao);
  if (!rel.temGrupos)
    return (
      <div className="rounded-xl2 border border-dashed border-line bg-white py-16 text-center text-sm text-ink-muted">
        Cadastre grupos, categorias e o orçamento para montar o comparativo.
      </div>
    );
  const colHead = "px-3 py-2.5 text-right font-semibold text-ink-soft";
  const difResultado = rel.realizadoResultado - rel.orcadoResultado;
  return (
    <div className="overflow-x-auto rounded-xl2 bg-white shadow-card">
      <table className="w-full min-w-[680px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line">
            <th className="sticky left-0 z-10 bg-white px-3 py-2.5 text-left font-semibold text-ink-soft">Grupo</th>
            <th className={colHead}>Orçado</th>
            <th className={colHead}>{visao === "realizado" ? "Realizado" : "Previsto"}</th>
            <th className={colHead}>Diferença</th>
            <th className={colHead}>%</th>
          </tr>
        </thead>
        <tbody>
          {rel.secoes.map((s) => (
            <Fragment key={s.chave}>
              <tr className="bg-surface/60">
                <td
                  colSpan={5}
                  className="sticky left-0 bg-surface/60 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-muted"
                >
                  {s.titulo}{s.entraResultado ? "" : " (fora do resultado)"}
                </td>
              </tr>
              {s.grupos.map((g) => {
                const dif = g.realizado - g.orcado;
                return (
                  <Fragment key={g.id}>
                  <tr className="border-b border-line/70">
                    <td className="sticky left-0 z-10 bg-white px-3 py-2 text-ink">
                      <span className="flex items-center gap-1.5">
                        <span
                          className={`inline-block h-1.5 w-1.5 rounded-full ${g.eh_receita ? "bg-brand" : "bg-ink-soft"}`}
                        />
                        {g.nome}
                      </span>
                    </td>
                    <td className="num px-3 py-2 text-right text-ink-muted">{fmt(g.orcado)}</td>
                    <td className="num px-3 py-2 text-right text-ink">{fmt(g.realizado)}</td>
                    <td className={`num px-3 py-2 text-right font-semibold ${classeDif(dif, g.eh_receita, g.orcado)}`}>
                      {dif > 0 ? "+" : ""}
                      {fmt(dif)}
                    </td>
                    <td className="num px-3 py-2 text-right text-ink-muted">{pct(g.orcado, g.realizado)}</td>
                  </tr>
                  {det &&
                    g.categorias.map((c) => {
                      const difC = c.realizado - c.orcado;
                      return (
                        <tr key={c.id} className="border-b border-line/40 bg-white">
                          <td className="sticky left-0 z-10 bg-white py-1.5 pl-9 pr-3 text-[11px] text-ink-muted">{c.nome}</td>
                          <td className="num px-3 py-1.5 text-right text-[11px] text-ink-muted">{fmt(c.orcado)}</td>
                          <td className="num px-3 py-1.5 text-right text-[11px] text-ink">{fmt(c.realizado)}</td>
                          <td className={`num px-3 py-1.5 text-right text-[11px] ${classeDif(difC, g.eh_receita, c.orcado)}`}>{difC > 0 ? "+" : ""}{fmt(difC)}</td>
                          <td className="num px-3 py-1.5 text-right text-[11px] text-ink-muted">{pct(c.orcado, c.realizado)}</td>
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
              <tr className="border-b border-line bg-white">
                <td className="sticky left-0 z-10 bg-white px-3 py-2 text-xs font-bold text-ink">
                  Resultado {s.titulo}
                </td>
                <td className={`num px-3 py-2 text-right font-semibold ${classeValor(s.orcadoSub)}`}>
                  {fmt(s.orcadoSub)}
                </td>
                <td className={`num px-3 py-2 text-right font-semibold ${classeValor(s.realizadoSub)}`}>
                  {fmt(s.realizadoSub)}
                </td>
                <td className="num px-3 py-2 text-right font-semibold text-ink-soft">
                  {fmt(s.realizadoSub - s.orcadoSub)}
                </td>
                <td className="px-3 py-2"></td>
              </tr>
            </Fragment>
          ))}
          <tr className="border-t-2 border-line bg-brand-light/40">
            <td className="sticky left-0 z-10 bg-brand-light/40 px-3 py-2.5 text-sm font-extrabold text-ink">
              Resultado
            </td>
            <td className={`num px-3 py-2.5 text-right font-bold ${classeValor(rel.orcadoResultado)}`}>
              {fmt(rel.orcadoResultado)}
            </td>
            <td className={`num px-3 py-2.5 text-right font-bold ${classeValor(rel.realizadoResultado)}`}>
              {fmt(rel.realizadoResultado)}
            </td>
            <td className={`num px-3 py-2.5 text-right font-extrabold ${difResultado < 0 ? "text-ink" : "text-brand"}`}>
              {difResultado > 0 ? "+" : ""}
              {fmt(difResultado)}
            </td>
            <td className="px-3 py-2.5"></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Comparativo mês a mês ---------- */
function pctVar(a: number, b: number): string {
  if (a === 0) return b === 0 ? "—" : "novo";
  return ((b - a) / Math.abs(a) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 }) + "%";
}

async function ComparativoTabela({
  empresaId,
  ano,
  base,
  mesA,
  mesB,
  det,
  centro,
  gran,
}: {
  empresaId: string;
  ano: number;
  base: "competencia" | "vencimento" | "pagamento";
  mesA: number;
  mesB: number;
  det: boolean;
  centro: string;
  gran: string;
}) {
  let rel = await getRelatorio(empresaId, ano, base, centro);
  if (gran === "tri") rel = aggRelTri(rel);
  if (!rel.temGrupos)
    return (
      <div className="rounded-xl2 border border-dashed border-line bg-white py-16 text-center text-sm text-ink-muted">
        Cadastre grupos e categorias para montar o comparativo.
      </div>
    );
  const maxP = gran === "tri" ? 4 : 12;
  const iA = Math.min(maxP, Math.max(1, mesA)) - 1;
  const iB = Math.min(maxP, Math.max(1, mesB)) - 1;
  const COLS = gran === "tri" ? TRIMESTRES : MESES;
  const th = "px-3 py-2.5 text-right font-semibold text-ink-soft";
  return (
    <div className="overflow-x-auto rounded-xl2 bg-white shadow-card">
      <table className="w-full min-w-[620px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line">
            <th className="sticky left-0 z-10 bg-white px-3 py-2.5 text-left font-semibold text-ink-soft">Grupo</th>
            <th className={th}>{COLS[iA]}/{ano}</th>
            <th className={th}>{COLS[iB]}/{ano}</th>
            <th className={th}>Δ R$</th>
            <th className={th}>Δ %</th>
          </tr>
        </thead>
        <tbody>
          {rel.secoes.map((s) => (
            <Fragment key={s.chave}>
              <tr className="bg-surface/60">
                <td colSpan={5} className="sticky left-0 bg-surface/60 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-muted">
                  {s.titulo}{s.entraResultado ? "" : " (fora do resultado)"}
                </td>
              </tr>
              {s.grupos.map((g) => {
                const a = g.valores[iA];
                const b = g.valores[iB];
                const d = b - a;
                return (
                  <Fragment key={g.id}>
                  <tr className="border-b border-line/70">
                    <td className="sticky left-0 z-10 bg-white px-3 py-2 text-ink">
                      <span className="flex items-center gap-1.5">
                        <span className={`inline-block h-1.5 w-1.5 rounded-full ${g.eh_receita ? "bg-brand" : "bg-ink-soft"}`} />
                        {g.nome}
                      </span>
                    </td>
                    <td className={`num px-3 py-2 text-right ${classeValor(a)}`}>{fmt(a)}</td>
                    <td className={`num px-3 py-2 text-right ${classeValor(b)}`}>{fmt(b)}</td>
                    <td className={`num px-3 py-2 text-right font-semibold ${d < 0 ? "text-ink" : d > 0 ? "text-brand" : "text-ink-soft"}`}>{fmt(d)}</td>
                    <td className="num px-3 py-2 text-right text-ink-muted">{pctVar(a, b)}</td>
                  </tr>
                  {det &&
                    g.categorias
                      .filter((c) => c.valores[iA] !== 0 || c.valores[iB] !== 0)
                      .map((c) => {
                        const ca = c.valores[iA];
                        const cb = c.valores[iB];
                        const cd = cb - ca;
                        return (
                          <tr key={c.id} className="border-b border-line/40 bg-white">
                            <td className="sticky left-0 z-10 bg-white py-1.5 pl-9 pr-3 text-[11px] text-ink-muted">{c.nome}</td>
                            <td className={`num px-3 py-1.5 text-right text-[11px] ${classeValor(ca)}`}>{fmt(ca)}</td>
                            <td className={`num px-3 py-1.5 text-right text-[11px] ${classeValor(cb)}`}>{fmt(cb)}</td>
                            <td className={`num px-3 py-1.5 text-right text-[11px] ${cd < 0 ? "text-ink" : cd > 0 ? "text-brand" : "text-ink-soft"}`}>{fmt(cd)}</td>
                            <td className="num px-3 py-1.5 text-right text-[11px] text-ink-muted">{pctVar(ca, cb)}</td>
                          </tr>
                        );
                      })}
                  </Fragment>
                );
              })}
            </Fragment>
          ))}
          <tr className="border-t-2 border-line bg-brand-light/40">
            <td className="sticky left-0 z-10 bg-brand-light/40 px-3 py-2.5 text-sm font-extrabold text-ink">Resultado</td>
            <td className={`num px-3 py-2.5 text-right font-bold ${classeValor(rel.resultado[iA])}`}>{fmt(rel.resultado[iA])}</td>
            <td className={`num px-3 py-2.5 text-right font-bold ${classeValor(rel.resultado[iB])}`}>{fmt(rel.resultado[iB])}</td>
            <td className={`num px-3 py-2.5 text-right font-extrabold ${rel.resultado[iB] - rel.resultado[iA] < 0 ? "text-ink" : "text-brand"}`}>
              {fmt(rel.resultado[iB] - rel.resultado[iA])}
            </td>
            <td className="num px-3 py-2.5 text-right text-ink-muted">{pctVar(rel.resultado[iA], rel.resultado[iB])}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Inadimplência (aging) ---------- */
const BUCKETS = ["0–30 dias", "31–60", "61–90", "90+ dias"];

async function InadimplenciaTabela({ empresaId }: { empresaId: string }) {
  const inad = await getInadimplencia(empresaId);
  const semNada = inad.receber.total === 0 && inad.pagar.total === 0;
  if (semNada)
    return (
      <div className="rounded-xl2 border border-dashed border-line bg-white py-16 text-center text-sm text-ink-muted">
        Nenhuma conta vencida em aberto. 🎉
      </div>
    );

  // Componente definido dentro do render — o antipadrão que fez um campo do app
  // aceitar só uma letra. Aqui não tem efeito: este arquivo não é `"use client"`,
  // as funções de fora são `async` e rodam no servidor uma vez só. Não há
  // re-render nem reconciliação para remontar nada. Fica como está — mexer numa
  // tela de relatório de 1.000 linhas para ganhar zero não é troca boa.
  const Lado = ({ titulo, lado, cor }: { titulo: string; lado: typeof inad.receber; cor: string }) => {
    if (lado.total === 0) return null;
    const th = "px-3 py-2.5 text-right font-semibold text-ink-soft";
    return (
      <div className="overflow-x-auto rounded-xl2 bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="text-[13px] font-bold text-ink">{titulo}</h3>
          <span className={`num text-base font-extrabold ${cor}`}>{fmt(lado.total)}</span>
        </div>
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="sticky left-0 z-10 bg-white px-3 py-2.5 text-left font-semibold text-ink-soft">Cliente / Fornecedor</th>
              {BUCKETS.map((b) => <th key={b} className={th}>{b}</th>)}
              <th className="px-3 py-2.5 text-right font-bold text-ink">Total</th>
            </tr>
          </thead>
          <tbody>
            {lado.grupos.map((g) => (
              <tr key={g.pessoa} className="border-b border-line/70">
                <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium text-ink">{g.pessoa}</td>
                {g.buckets.map((v, i) => (
                  <td key={i} className={`num px-3 py-2 text-right ${i >= 2 && v > 0 ? "font-semibold text-ink" : "text-ink-muted"}`}>
                    {v > 0 ? fmt(v) : "—"}
                  </td>
                ))}
                <td className={`num px-3 py-2 text-right font-bold ${cor}`}>{fmt(g.total)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-line bg-surface/50">
              <td className="sticky left-0 z-10 bg-surface/50 px-3 py-2.5 font-extrabold text-ink">Total</td>
              {lado.buckets.map((v, i) => (
                <td key={i} className="num px-3 py-2.5 text-right font-semibold text-ink">{v > 0 ? fmt(v) : "—"}</td>
              ))}
              <td className={`num px-3 py-2.5 text-right font-extrabold ${cor}`}>{fmt(lado.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <Lado titulo="A receber em atraso" lado={inad.receber} cor="text-brand" />
      <Lado titulo="A pagar em atraso" lado={inad.pagar} cor="text-danger" />
    </div>
  );
}

/* ---------- Indicadores (resumo executivo) ---------- */
function corTom(tom: string | undefined, v: number): string {
  if (tom === "brand") return "text-brand";
  // saída não é magenta: cor de marca não vale como cor de dado
  if (tom === "accent") return "text-ink";
  return classeValor(v);
}

function CardsRow({ cards }: { cards: Array<{ l: string; v?: number; pct?: number; tom?: string; forte?: boolean }> }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((c) => (
        <div key={c.l} className={`rounded-xl2 border bg-white p-4 shadow-card ${c.forte ? "border-brand/30" : "border-line"}`}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">{c.l}</p>
          <p
            className={`num mt-1 text-lg font-extrabold ${
              c.pct !== undefined ? (c.pct < 0 ? "text-danger" : "text-ink") : corTom(c.tom, c.v ?? 0)
            }`}
          >
            {c.pct !== undefined
              ? `${c.pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
              : `R$ ${fmt(c.v ?? 0)}`}
          </p>
        </div>
      ))}
    </div>
  );
}

async function Indicadores({ empresaId, ano, modo, centro }: { empresaId: string; ano: number; modo: string; centro: string }) {
  if (modo === "caixa") {
    const fc = await getFluxoCaixa(empresaId, ano, centro);
    if (!fc.temDados) return null;
    return (
      <CardsRow
        cards={[
          { l: "Saldo inicial do ano", v: fc.saldoInicialPeriodo, tom: "auto" },
          { l: "Recebimentos", v: fc.totalReceb, tom: "brand" },
          { l: "Pagamentos", v: fc.totalPag, tom: "accent" },
          { l: "Saldo final", v: fc.saldoFinal[11], tom: "auto", forte: true },
        ]}
      />
    );
  }
  const rel = await getRelatorio(empresaId, ano, "competencia", centro);
  if (!rel.temGrupos) return null;
  const margem = rel.totalReceitas > 0 ? (rel.resultadoTotal / rel.totalReceitas) * 100 : 0;
  return (
    <CardsRow
      cards={[
        { l: "Receitas", v: rel.totalReceitas, tom: "brand" },
        { l: "Despesas", v: rel.totalDespesas, tom: "accent" },
        { l: "Resultado", v: rel.resultadoTotal, tom: "auto", forte: true },
        { l: "Margem", pct: margem },
      ]}
    />
  );
}

/* ---------- Contas a vencer (aging futuro) ---------- */
const BUCKETS_AV = ["até 7 dias", "8–15", "16–30", "30+ dias"];

async function AVencerTabela({ empresaId }: { empresaId: string }) {
  const av = await getAVencer(empresaId);
  const semNada = av.receber.total === 0 && av.pagar.total === 0;
  if (semNada)
    return (
      <div className="rounded-xl2 border border-dashed border-line bg-white py-16 text-center text-sm text-ink-muted">
        Nenhuma conta em aberto a vencer.
      </div>
    );

  // Componente definido dentro do render — o antipadrão que fez um campo do app
  // aceitar só uma letra. Aqui não tem efeito: este arquivo não é `"use client"`,
  // as funções de fora são `async` e rodam no servidor uma vez só. Não há
  // re-render nem reconciliação para remontar nada. Fica como está — mexer numa
  // tela de relatório de 1.000 linhas para ganhar zero não é troca boa.
  const Lado = ({ titulo, lado, cor }: { titulo: string; lado: typeof av.receber; cor: string }) => {
    if (lado.total === 0) return null;
    const th = "px-3 py-2.5 text-right font-semibold text-ink-soft";
    return (
      <div className="overflow-x-auto rounded-xl2 bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="text-[13px] font-bold text-ink">{titulo}</h3>
          <span className={`num text-base font-extrabold ${cor}`}>{fmt(lado.total)}</span>
        </div>
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="sticky left-0 z-10 bg-white px-3 py-2.5 text-left font-semibold text-ink-soft">Cliente / Fornecedor</th>
              {BUCKETS_AV.map((b) => (
                <th key={b} className={th}>{b}</th>
              ))}
              <th className="px-3 py-2.5 text-right font-bold text-ink">Total</th>
            </tr>
          </thead>
          <tbody>
            {lado.grupos.map((g) => (
              <tr key={g.pessoa} className="border-b border-line/70">
                <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium text-ink">{g.pessoa}</td>
                {g.buckets.map((v, i) => (
                  <td key={i} className={`num px-3 py-2 text-right ${i === 0 && v > 0 ? "font-semibold text-amber-700" : "text-ink-muted"}`}>
                    {v > 0 ? fmt(v) : "—"}
                  </td>
                ))}
                <td className={`num px-3 py-2 text-right font-bold ${cor}`}>{fmt(g.total)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-line bg-surface/50">
              <td className="sticky left-0 z-10 bg-surface/50 px-3 py-2.5 font-extrabold text-ink">Total</td>
              {lado.buckets.map((v, i) => (
                <td key={i} className="num px-3 py-2.5 text-right font-semibold text-ink">{v > 0 ? fmt(v) : "—"}</td>
              ))}
              <td className={`num px-3 py-2.5 text-right font-extrabold ${cor}`}>{fmt(lado.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <Lado titulo="A receber a vencer" lado={av.receber} cor="text-brand" />
      <Lado titulo="A pagar a vencer" lado={av.pagar} cor="text-ink" />
    </div>
  );
}

/* ---------- Resultado por centro de custo ---------- */
async function CentroCustoTabela({ empresaId, ano }: { empresaId: string; ano: number }) {
  const rel = await getPorCentroCusto(empresaId, ano);
  if (rel.linhas.length === 0)
    return (
      <div className="rounded-xl2 border border-dashed border-line bg-white py-16 text-center text-sm text-ink-muted">
        {rel.usa
          ? "Nenhum lançamento com centro de custo neste ano."
          : "O uso de centro de custo não está ativado. Ative em Configurações e classifique os lançamentos para ver este relatório."}
      </div>
    );
  const th = "px-3 py-2.5 text-right font-semibold text-ink-soft";
  return (
    <div className="overflow-x-auto rounded-xl2 bg-white shadow-card">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line">
            <th className="sticky left-0 z-10 bg-white px-3 py-2.5 text-left font-semibold text-ink-soft">Centro de custo</th>
            <th className={th}>Receitas</th>
            <th className={th}>Despesas</th>
            <th className="px-3 py-2.5 text-right font-bold text-ink">Resultado</th>
          </tr>
        </thead>
        <tbody>
          {rel.linhas.map((l) => (
            <tr key={l.id} className="border-b border-line/70">
              <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium text-ink">{l.nome}</td>
              <td className="num px-3 py-2 text-right text-brand">{fmt(l.receitas)}</td>
              <td className="num px-3 py-2 text-right text-ink">{fmt(l.despesas)}</td>
              <td className={`num px-3 py-2 text-right font-bold ${classeValor(l.resultado)}`}>{fmt(l.resultado)}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-line bg-brand-light/40">
            <td className="sticky left-0 z-10 bg-brand-light/40 px-3 py-2.5 font-extrabold text-ink">Total</td>
            <td className="num px-3 py-2.5 text-right font-bold text-brand">{fmt(rel.totalReceitas)}</td>
            <td className="num px-3 py-2.5 text-right font-bold text-ink">{fmt(rel.totalDespesas)}</td>
            <td className={`num px-3 py-2.5 text-right font-extrabold ${classeValor(rel.totalResultado)}`}>{fmt(rel.totalResultado)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Aging (recebíveis + pagáveis: a vencer + atraso escalonado) ---------- */
const BUCKETS_AGING = ["A vencer", "1–30", "31–60", "61–90", "90+"];

async function AgingTabela({ empresaId, det, centro }: { empresaId: string; det: boolean; centro: string }) {
  const ag = await getAging(empresaId, centro);
  if (ag.receber.total === 0 && ag.pagar.total === 0)
    return (
      <div className="rounded-xl2 border border-dashed border-line bg-white py-16 text-center text-sm text-ink-muted">
        Nenhuma conta em aberto. 🎉
      </div>
    );

  // Componente definido dentro do render — o antipadrão que fez um campo do app
  // aceitar só uma letra. Aqui não tem efeito: este arquivo não é `"use client"`,
  // as funções de fora são `async` e rodam no servidor uma vez só. Não há
  // re-render nem reconciliação para remontar nada. Fica como está — mexer numa
  // tela de relatório de 1.000 linhas para ganhar zero não é troca boa.
  const Lado = ({ titulo, lado, cor }: { titulo: string; lado: typeof ag.receber; cor: string }) => {
    if (lado.total === 0) return null;
    const th = "px-3 py-2.5 text-right font-semibold text-ink-soft";
    return (
      <div className="overflow-x-auto rounded-xl2 bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="text-[13px] font-bold text-ink">{titulo}</h3>
          <span className={`num text-base font-extrabold ${cor}`}>{fmt(lado.total)}</span>
        </div>
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="sticky left-0 z-10 bg-white px-3 py-2.5 text-left font-semibold text-ink-soft">
                Cliente / Fornecedor
              </th>
              {BUCKETS_AGING.map((b) => (
                <th key={b} className={th}>
                  {b}
                </th>
              ))}
              <th className="px-3 py-2.5 text-right font-bold text-ink">Total</th>
            </tr>
          </thead>
          <tbody>
            {lado.grupos.map((g) => (
              <Fragment key={g.pessoa}>
                <tr className="border-b border-line/70">
                  <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium text-ink">{g.pessoa}</td>
                  {g.buckets.map((v, i) => (
                    <td
                      key={i}
                      className={`num px-3 py-2 text-right ${
                        i >= 3 && v > 0 ? "font-semibold text-danger" : "text-ink-muted"
                      }`}
                    >
                      {v > 0 ? fmt(v) : "—"}
                    </td>
                  ))}
                  <td className={`num px-3 py-2 text-right font-bold ${cor}`}>{fmt(g.total)}</td>
                </tr>
                {det &&
                  g.itens.map((it) => (
                    <tr key={it.id} className="border-b border-line/40 bg-surface/30 text-xs">
                      <td className="sticky left-0 z-10 bg-surface/30 px-3 py-1.5 pl-8 text-ink-muted">
                        {it.data_vencimento.split("-").reverse().join("/")} · {it.descricao}
                      </td>
                      <td className="px-3 py-1.5 text-right text-ink-soft" colSpan={5}>
                        {it.vencido
                          ? `${it.dias} dia(s) em atraso`
                          : it.dias === 0
                            ? "vence hoje"
                            : `vence em ${it.dias} dia(s)`}
                      </td>
                      <td className="num px-3 py-1.5 text-right text-ink">{fmt(it.valor)}</td>
                    </tr>
                  ))}
              </Fragment>
            ))}
            <tr className="border-t-2 border-line bg-surface/50">
              <td className="sticky left-0 z-10 bg-surface/50 px-3 py-2.5 font-extrabold text-ink">Total</td>
              {lado.buckets.map((v, i) => (
                <td key={i} className="num px-3 py-2.5 text-right font-semibold text-ink">
                  {v > 0 ? fmt(v) : "—"}
                </td>
              ))}
              <td className={`num px-3 py-2.5 text-right font-extrabold ${cor}`}>{fmt(lado.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <Lado titulo="A receber (clientes)" lado={ag.receber} cor="text-brand" />
      <Lado titulo="A pagar (fornecedores)" lado={ag.pagar} cor="text-ink" />
    </div>
  );
}

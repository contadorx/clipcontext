import Link from "next/link";
import { Plus, UploadCloud } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaContext } from "@/lib/empresa";
import { getPeriodo } from "@/lib/periodo";
import { getPainelData } from "@/lib/painel";
import { getAging } from "@/lib/aging";
import Launchpad from "@/components/inicio/launchpad";
import { MiniBarras, MiniProgresso, Sparkline } from "@/components/inicio/mini";
import { brl, dataBR } from "@/lib/formato";

export const dynamic = "force-dynamic";

const compacto = (v: number) =>
  Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : brl(v);

function saudacao(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}
function isoMais(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * Início — a home da empresa em tiles.
 *
 * Cada tile carrega um número de verdade e leva para a lista já filtrada,
 * usando os mesmos filtros que vivem na URL. O menu continua na lateral: aqui
 * é atalho para o que precisa de atenção hoje, não substituto da navegação.
 */
export default async function InicioPage() {
  const supabase = createClient();
  const { atual } = await getEmpresaContext();
  const empresaId = atual?.id ?? "";
  const { de, ate } = getPeriodo();

  const hoje = new Date().toISOString().slice(0, 10);
  const em7 = isoMais(7);

  const [d, aging, docs, transacoes, liquidar] = await Promise.all([
    getPainelData(empresaId, de, ate),
    getAging(empresaId),
    supabase
      .from("documentos_recebidos")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId)
      .eq("status", "novo"),
    supabase
      .from("transacoes_extrato")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId)
      .eq("conciliado", false),
    supabase
      .from("lancamentos")
      .select("valor")
      .eq("empresa_id", empresaId)
      .eq("tipo", "saida")
      .is("data_pagamento", null)
      .not("transferencia", "is", true)
      .gte("data_vencimento", hoje)
      .lte("data_vencimento", em7),
  ]);

  const docsNovos = docs.count ?? 0;
  const naoConciliadas = transacoes.count ?? 0;
  const aLiquidar = ((liquidar.data as { valor: number }[]) ?? []).reduce((s, l) => s + Number(l.valor), 0);
  const qtdLiquidar = ((liquidar.data as { valor: number }[]) ?? []).length;

  const resultado = d.recebidos - d.despesas;
  const estourou = d.orcamento.filter((o) => o.fracao > 1);
  // a curva do tile é a mesma do gráfico grande, e o corte é o primeiro dia
  // projetado — o desenho tem de dizer onde o fato acaba e a aposta começa
  const curva = d.serie.map((p) => p.saldo);
  const corte = Math.max(d.serie.findIndex((p) => p.projetado), 0);
  const pior = d.orcamento[0] ?? null;

  // aging de recebíveis: [a vencer, 1-30, 31-60, 61-90, 90+]
  const buckets = aging.receber.buckets;
  const inadimplencia =
    aging.receber.total > 0
      ? ((aging.receber.total - buckets[0]) / aging.receber.total) * 100
      : 0;

  return (
    <div className="space-y-4">
      <div className="sticky top-[52px] z-20 -mx-5 border-b border-line bg-white px-5 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold tracking-tight text-ink">{saudacao()}</h1>
            <p className="truncate text-xs text-ink-muted">
              {atual?.nome ?? "—"} · o que precisa de atenção hoje
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/importar?tipo=lancamentos"
              className="flex h-8 items-center gap-1.5 rounded-md border border-line px-2.5 text-xs font-semibold text-ink-muted transition hover:border-brand hover:text-brand-dark"
            >
              <UploadCloud size={13} /> Importar
            </Link>
            <Link
              href="/movimentacoes"
              className="flex h-8 items-center gap-1.5 rounded-md bg-brand px-3 text-xs font-bold text-white transition hover:bg-brand-dark"
            >
              <Plus size={14} /> Lançar
            </Link>
          </div>
        </div>
      </div>

      {/*
        Três grupos, e não uma parede de tiles: decidir, fazer, entender.
        Agrupar por tarefa — e não por entidade — é o que separa um launchpad de
        um menu com ícones.

        O Painel deixou de existir e o que ele fazia se dividiu aqui: a parte de
        decisão virou tile, a analítica virou tile de relatório. Havia duas telas
        respondendo "o que precisa de mim hoje" de dois jeitos, e nenhuma
        resposta para "isso eu vejo em qual das duas?".
      */}
      <Launchpad
        tiles={[
          /* ------------------------------- decisões ------------------------ */
          {
            id: "caixa",
            grupo: "decisoes",
            fixo: true,
            href: "/fluxo",
            titulo: d.alerta.furo ? "O caixa fica negativo" : "O caixa cobre o período",
            sub: d.alerta.furo
              ? `pior dia: ${compacto(d.alerta.menorSaldo)}`
              : `menor saldo: ${compacto(d.alerta.menorSaldo)}`,
            valor: d.alerta.furo ? dataBR(d.alerta.furo) : brl(d.saldoAtual),
            tom: d.alerta.furo ? "negativo" : "positivo",
            corpo: <Sparkline valores={curva} corteProjecao={corte} />,
            rodapeEsq: d.alerta.furo ? "projeção do período" : "saldo de hoje",
            rodapeDir: "▸",
          },
          {
            id: "vencidos-pagar",
            grupo: "decisoes",
            fixo: true,
            href: "/agendamento",
            titulo: "Contas vencidas a pagar",
            sub: "já passaram do vencimento",
            valor: compacto(d.vencidos),
            tom: "negativo",
            vazio: d.vencidos === 0,
            rodapeEsq: "liquidar",
            rodapeDir: "▸",
          },
          {
            id: "vencidos-receber",
            grupo: "decisoes",
            fixo: true,
            href: "/movimentacoes?tipo=entrada",
            titulo: "Recebimentos vencidos",
            sub: `${inadimplencia.toFixed(0)}% da carteira em atraso`,
            valor: compacto(d.vencidosReceber),
            tom: "critico",
            vazio: d.vencidosReceber === 0,
            rodapeEsq: "cobrar",
            rodapeDir: "▸",
          },
          {
            id: "conciliar",
            grupo: "decisoes",
            href: "/conciliacao",
            titulo: "Transações sem conciliar",
            sub: "o saldo só bate depois disto",
            valor: String(naoConciliadas),
            unidade: "no extrato",
            tom: "info",
            vazio: naoConciliadas === 0,
            rodapeEsq: "conciliar",
            rodapeDir: "▸",
          },
          {
            id: "documentos",
            grupo: "decisoes",
            href: "/documentos",
            titulo: "Documentos sem lançamento",
            sub: "chegaram e ninguém classificou",
            valor: String(docsNovos),
            unidade: "documentos",
            tom: "neutro",
            vazio: docsNovos === 0,
            rodapeEsq: "classificar",
            rodapeDir: "▸",
          },
          {
            id: "liquidar-7",
            grupo: "decisoes",
            href: "/agendamento",
            titulo: "Vencem em 7 dias",
            sub: `${qtdLiquidar} pagamento(s)`,
            valor: compacto(aLiquidar),
            tom: "critico",
            vazio: qtdLiquidar === 0,
            rodapeEsq: "agendar",
            rodapeDir: "▸",
          },
          {
            id: "orcamento",
            grupo: "decisoes",
            href: "/relatorios",
            titulo: "Acima do orçado",
            sub: estourou.map((o) => o.nome).slice(0, 2).join(", ") || "nenhuma categoria",
            valor: String(estourou.length),
            unidade: "categorias",
            tom: "negativo",
            vazio: estourou.length === 0,
            rodapeEsq: "rever orçamento",
            rodapeDir: "▸",
          },

          /* ------------------------------ processos ------------------------ */
          { id: "lancar", grupo: "processos", href: "/movimentacoes", titulo: "Lançar movimentação", sub: "entrada, saída ou transferência", rodapeEsq: "atalho: N", rodapeDir: "▸" },
          { id: "importar", grupo: "processos", href: "/importar?tipo=lancamentos", titulo: "Importar extrato ou planilha", sub: "OFX, CNAB, CSV", rodapeEsq: "banco e planilha", rodapeDir: "▸" },
          { id: "conciliar-p", grupo: "processos", href: "/conciliacao", titulo: "Conciliar", sub: "extrato contra lançamentos", rodapeEsq: "por conta", rodapeDir: "▸" },
          { id: "liquidar-p", grupo: "processos", href: "/agendamento", titulo: "Liquidar e gerar remessa", sub: "pagar em lote, CNAB", rodapeEsq: "em lote", rodapeDir: "▸" },
          { id: "faturar", grupo: "processos", href: "/vendas", titulo: "Faturar o mês", sub: "gera as receitas dos contratos", rodapeEsq: "contratos", rodapeDir: "▸" },
          { id: "nfse", grupo: "processos", href: "/vendas", titulo: "Emitir NFS-e e boletos", sub: "documento fiscal e cobrança", rodapeEsq: "vendas", rodapeDir: "▸" },
          { id: "classificar", grupo: "processos", href: "/documentos", titulo: "Classificar documentos", sub: "notas e boletos recebidos", rodapeEsq: "caixa de entrada", rodapeDir: "▸" },
          { id: "exportar", grupo: "processos", href: "/configuracoes/exportar-contabil", titulo: "Exportar para a contabilidade", sub: "e fechar a competência", rodapeEsq: "contábil", rodapeDir: "▸" },

          /* ----------------------------- relatórios ------------------------ */
          {
            id: "fluxo",
            grupo: "relatorios",
            href: "/fluxo",
            titulo: "Fluxo de caixa",
            sub: "realizado e projetado",
            valor: compacto(d.previsto),
            tom: d.previsto < 0 ? "negativo" : "positivo",
            corpo: <Sparkline valores={curva} corteProjecao={corte} />,
            rodapeEsq: "30/60/90 dias",
            rodapeDir: "▸",
          },
          {
            id: "resultado",
            grupo: "relatorios",
            href: "/relatorios",
            titulo: "Resultado do período",
            sub: "recebido menos pago",
            valor: compacto(resultado),
            tom: resultado >= 0 ? "positivo" : "negativo",
            // o número é de um mês; a barra diz se ele é exceção ou regra
            corpo: (
              <MiniBarras
                valores={d.mensal.map((m) => m.resultado)}
                destaque={d.mensal.map((m, i) => (m.resultado < 0 ? i : -1)).filter((i) => i >= 0)}
              />
            ),
            rodapeEsq: "últimos 6 meses",
            rodapeDir: "▸",
          },
          {
            id: "aging",
            grupo: "relatorios",
            href: "/relatorios",
            titulo: "Aging de recebíveis",
            sub: "o que está parado, e há quanto tempo",
            valor: compacto(aging.receber.total),
            tom: "neutro",
            // a vencer, 1-30, 31-60, 61-90, 90+ — as três últimas em vermelho:
            // dinheiro parado há mais de 60 dias é outra conversa
            corpo: <MiniBarras valores={buckets} destaque={[2, 3, 4]} />,
            rodapeEsq: `${inadimplencia.toFixed(0)}% em atraso`,
            rodapeDir: "▸",
          },
          {
            id: "orcado",
            grupo: "relatorios",
            href: "/relatorios",
            titulo: "Orçado × realizado",
            sub: "consumo por categoria",
            // a pior categoria, não a soma: a soma pode estar em dia com uma
            // linha 8% acima escondida dentro dela
            corpo: pior ? <MiniProgresso fracao={pior.fracao} rotulo={pior.nome} /> : undefined,
            vazio: d.orcamento.length === 0,
            rodapeEsq: "pior categoria",
            rodapeDir: "▸",
          },
          { id: "centro", grupo: "relatorios", href: "/relatorios", titulo: "Por centro de custo", sub: "rateio e resultado por centro", rodapeEsq: "análise", rodapeDir: "▸" },
          { id: "extrato", grupo: "relatorios", href: "/movimentacoes", titulo: "Extrato por conta", sub: "saldo corrente, linha a linha", rodapeEsq: "por conta", rodapeDir: "▸" },
        ]}
      />
    </div>
  );
}

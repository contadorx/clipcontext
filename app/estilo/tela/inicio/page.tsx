"use client";

import Link from "next/link";
import { Plus, UploadCloud } from "lucide-react";
import { notFound } from "next/navigation";
import AppShell from "@/components/app-shell";
import Topbar from "@/components/topbar";
import Launchpad, { type TileDef } from "@/components/inicio/launchpad";
import { MiniBarras, MiniProgresso, Sparkline } from "@/components/inicio/mini";
import DadosFalsos from "@/components/bancada/dados-falsos";
import { bancadaLiberada } from "@/lib/bancada";

/**
 * Bancada do Início.
 *
 * Existe porque o launchpad foi entregue sem ninguém ter olhado: `/inicio` é
 * componente de servidor e redireciona sem sessão, então não havia como abrir.
 * Depois de três rodadas em que ler código produziu dois achados falsos,
 * entregar uma tela inteira sem ver é dívida, não detalhe.
 *
 * Os tiles são os mesmos da página real, com números fixos — inclusive um
 * zerado ("mês por fechar") e um de texto longo ("13/08/2026"), que são os dois
 * casos que o desenho precisa aguentar: o cinza do que está em dia e o número
 * que não cabe nos 145px úteis do tile.
 */
const TILES: TileDef[] = [
  {
    id: "caixa",
    grupo: "decisoes",
    fixo: true,
    href: "/fluxo",
    titulo: "O caixa fica negativo",
    valor: "20/08/2026",
    tom: "negativo",
    // a data diz quando; o desenho diz que é um mergulho e não uma queda lenta
    corpo: (
      <Sparkline
        valores={[81548, 100448, 94128, 106628, 98228, 26078, 19757, -8593, -743, -3923, 5497, 2756]}
        corteProjecao={4}
      />
    ),
    rodapeEsq: "projeção do período",
    rodapeDir: "▸",
  },
  { id: "vencidos-pagar", grupo: "decisoes", fixo: true, href: "/agendamento", titulo: "Contas vencidas a pagar", sub: "já passaram do vencimento", valor: "R$ 14,7 mil", tom: "negativo", rodapeEsq: "liquidar", rodapeDir: "▸" },
  { id: "vencidos-receber", grupo: "decisoes", fixo: true, href: "/movimentacoes", titulo: "Recebimentos vencidos", sub: "34% da carteira em atraso", valor: "R$ 18,9 mil", tom: "critico", rodapeEsq: "cobrar", rodapeDir: "▸" },
  { id: "conciliar", grupo: "decisoes", href: "/conciliacao", titulo: "Transações sem conciliar", sub: "o saldo só bate depois disto", valor: "6", unidade: "no extrato", tom: "info", rodapeEsq: "conciliar", rodapeDir: "▸" },
  { id: "documentos", grupo: "decisoes", href: "/documentos", titulo: "Documentos sem lançamento", sub: "chegaram e ninguém classificou", valor: "3", unidade: "documentos", rodapeEsq: "classificar", rodapeDir: "▸" },
  { id: "liquidar-7", grupo: "decisoes", href: "/agendamento", titulo: "Vencem em 7 dias", sub: "3 pagamento(s)", valor: "R$ 28,5 mil", tom: "critico", rodapeEsq: "agendar", rodapeDir: "▸" },
  { id: "orcamento", grupo: "decisoes", href: "/relatorios", titulo: "Acima do orçado", sub: "nenhuma categoria", valor: "0", unidade: "categorias", tom: "negativo", vazio: true, rodapeEsq: "rever orçamento", rodapeDir: "▸" },

  { id: "lancar", grupo: "processos", href: "/movimentacoes", titulo: "Lançar movimentação", sub: "entrada, saída ou transferência", rodapeEsq: "atalho: N", rodapeDir: "▸" },
  { id: "importar", grupo: "processos", href: "/importar", titulo: "Importar extrato ou planilha", sub: "OFX, CNAB, CSV", rodapeEsq: "banco e planilha", rodapeDir: "▸" },
  { id: "conciliar-p", grupo: "processos", href: "/conciliacao", titulo: "Conciliar", sub: "extrato contra lançamentos", rodapeEsq: "por conta", rodapeDir: "▸" },
  { id: "liquidar-p", grupo: "processos", href: "/agendamento", titulo: "Liquidar e gerar remessa", sub: "pagar em lote, CNAB", rodapeEsq: "em lote", rodapeDir: "▸" },
  { id: "faturar", grupo: "processos", href: "/vendas", titulo: "Faturar o mês", sub: "gera as receitas dos contratos", rodapeEsq: "contratos", rodapeDir: "▸" },
  { id: "nfse", grupo: "processos", href: "/vendas", titulo: "Emitir NFS-e e boletos", sub: "documento fiscal e cobrança", rodapeEsq: "vendas", rodapeDir: "▸" },
  { id: "classificar", grupo: "processos", href: "/documentos", titulo: "Classificar documentos", sub: "notas e boletos recebidos", rodapeEsq: "caixa de entrada", rodapeDir: "▸" },
  { id: "exportar", grupo: "processos", href: "/configuracoes/exportar-contabil", titulo: "Exportar para a contabilidade", sub: "e fechar a competência", rodapeEsq: "contábil", rodapeDir: "▸" },

  {
    id: "fluxo",
    grupo: "relatorios",
    href: "/fluxo",
    titulo: "Fluxo de caixa",
    valor: "R$ 74,7 mil",
    tom: "positivo",
    corpo: (
      <Sparkline
        valores={[81548, 100448, 94128, 106628, 98228, 26078, 19757, -8593, -743, -3923, 5497, 2756]}
        corteProjecao={4}
      />
    ),
    rodapeEsq: "30/60/90 dias",
    rodapeDir: "▸",
  },
  {
    id: "resultado",
    grupo: "relatorios",
    href: "/relatorios",
    titulo: "Resultado do período",
    valor: "R$ 12,5 mil",
    tom: "positivo",
    // seis meses: o número é de um mês, a barra mostra se ele é exceção ou regra
    corpo: <MiniBarras valores={[6890, 1770, 12220, 2120, 12710, 12500]} />,
    rodapeEsq: "últimos 6 meses",
    rodapeDir: "▸",
  },
  {
    id: "aging",
    grupo: "relatorios",
    href: "/relatorios",
    titulo: "Aging de recebíveis",
    valor: "R$ 55,1 mil",
    // a vencer, 1-30, 31-60, 61-90, 90+ — as três últimas em vermelho, porque
    // dinheiro parado há mais de 60 dias é outra conversa
    corpo: <MiniBarras valores={[36170, 12800, 4180, 1950, 0]} destaque={[2, 3, 4]} />,
    rodapeEsq: "34% em atraso",
    rodapeDir: "▸",
  },
  {
    id: "orcado",
    grupo: "relatorios",
    href: "/relatorios",
    titulo: "Orçado × realizado",
    // a categoria que estourou, não a soma: a soma pode estar em dia com uma
    // linha 8% acima escondida dentro dela
    corpo: <MiniProgresso fracao={18940 / 17500} rotulo="Insumos e mercadorias" />,
    rodapeEsq: "pior categoria",
    rodapeDir: "▸",
  },
  { id: "centro", grupo: "relatorios", href: "/relatorios", titulo: "Por centro de custo", sub: "rateio e resultado por centro", rodapeEsq: "análise", rodapeDir: "▸" },
  { id: "extrato", grupo: "relatorios", href: "/movimentacoes", titulo: "Extrato por conta", sub: "saldo corrente, linha a linha", rodapeEsq: "por conta", rodapeDir: "▸" },
];

export default function BancadaInicio() {
  if (!bancadaLiberada()) notFound();

  return (
    <DadosFalsos>
      <AppShell
        colapsadoInicial={false}
        admin
        papel="dono"
        docsNovos={3}
        topbar={
          <Topbar
            empresas={[{ id: "emp-1", nome: "Padaria Aurora Ltda" }]}
            atualId="emp-1"
            userEmail="leandro@contadorx.com.br"
            periodoPreset="mes"
            periodoLabel="ago/2026"
            escritorioNome="ContadorX"
            logoUrl={null}
            papel="dono"
          />
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl2 border border-amber-300 bg-amber-50 px-4 py-2.5 text-[12.5px] text-amber-900">
            <span className="font-bold">Bancada · nenhum número aqui é real.</span>
            <span>Tela de verdade, dados inventados. Nada é salvo e nada vem do seu banco.</span>
            <Link href="/estilo/tela" className="ml-auto font-semibold underline">
              trocar de tela
            </Link>
          </div>

          <div className="sticky top-[52px] z-20 -mx-5 border-b border-line bg-white px-5 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <h1 className="text-lg font-bold tracking-tight text-ink">Boa tarde</h1>
                <p className="truncate text-xs text-ink-muted">
                  Padaria Aurora Ltda · o que precisa de atenção hoje
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="flex h-8 items-center gap-1.5 rounded-md border border-line px-2.5 text-xs font-semibold text-ink-muted">
                  <UploadCloud size={13} /> Importar
                </span>
                <span className="flex h-8 items-center gap-1.5 rounded-md bg-brand px-3 text-xs font-bold text-white">
                  <Plus size={14} /> Lançar
                </span>
              </div>
            </div>
          </div>

          <Launchpad tiles={TILES} />
        </div>
      </AppShell>
    </DadosFalsos>
  );
}

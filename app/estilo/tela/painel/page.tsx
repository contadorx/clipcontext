"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "@/components/app-shell";
import Topbar from "@/components/topbar";
import PageHeader from "@/components/ui/page-header";
import StatCards from "@/components/painel/stat-cards";
import FluxoChart from "@/components/painel/fluxo-chart";
import ContasPanel from "@/components/painel/contas-panel";
import ContasList from "@/components/painel/contas-list";
import ResultadoMensal from "@/components/painel/resultado-mensal";
import Pendencias from "@/components/painel/pendencias";
import OrcadoRealizado from "@/components/painel/orcado-realizado";
import DadosFalsos from "@/components/bancada/dados-falsos";
import { bancadaLiberada } from "@/lib/bancada";
import type { Alerta, ContaSaldo, LinhaLanc, LinhaOrcamento, Pendencia, PontoFluxo, ResultadoMes } from "@/lib/painel";

/**
 * Bancada do Painel.
 *
 * Ganha rota própria porque não cabe no molde de `/estilo/tela/[qual]`: as
 * outras telas buscam o próprio dado do navegador, e basta responder ao
 * `fetch`. O Painel é montado por `getPainelData` num componente de servidor,
 * que chega pronto por prop — então a massa aqui é o **resultado** daquele
 * cálculo, escrito à mão.
 *
 * Os números batem com `lib/bancada/massa.json` de propósito: quem comparar
 * esta tela com Movimentações não pode ver dois universos diferentes.
 */
const CONTAS: ContaSaldo[] = [
  { id: "ct-1", nome: "Itaú", banco: "Itaú", saldo: 61809.4, aConciliar: 6 },
  { id: "ct-2", nome: "Bradesco", banco: "Bradesco", saldo: -19531.7, aConciliar: 0 },
  { id: "ct-3", nome: "Nubank PJ", banco: "Nubank", saldo: 39270.5, aConciliar: null },
];

/**
 * A curva do gráfico. `projetado` marca o trecho depois de hoje (13/08) — o
 * antes vem de pagamentos, o depois de vencimentos em aberto.
 *
 * Os números descem até ficar negativo em 20/08 de propósito: é o caso que o
 * cartão de pendências precisa saber mostrar, e uma bancada que só ensaia o
 * caso feliz não ensaia nada.
 */
const SERIE: PontoFluxo[] = [
  { data: "2026-08-01", saldo: 81548.2 },
  { data: "2026-08-05", saldo: 100448.2 },
  { data: "2026-08-08", saldo: 94127.8 },
  { data: "2026-08-10", saldo: 106627.8 },
  { data: "2026-08-13", saldo: 98227.8, projetado: true },
  { data: "2026-08-15", saldo: 26077.8, projetado: true },
  { data: "2026-08-18", saldo: 19757.4, projetado: true },
  { data: "2026-08-20", saldo: -8592.6, projetado: true },
  { data: "2026-08-22", saldo: -742.6, projetado: true },
  { data: "2026-08-25", saldo: -3923.2, projetado: true },
  { data: "2026-08-29", saldo: 5497.3, projetado: true },
  { data: "2026-08-31", saldo: 2756.4, projetado: true },
];

const ALERTA: Alerta = {
  furo: "2026-08-20",
  furoValor: -8592.6,
  menorSaldo: -8592.6,
  menorSaldoData: "2026-08-20",
  pagar7: 28470,
  receber7: 18900,
  cobre7: true,
};

const PENDENCIAS: Pendencia[] = [
  { id: "conciliar", quantos: 6, titulo: "transações do extrato sem conciliar", detalhe: "o saldo do banco só bate depois disto", acao: "Conciliar", href: "/conciliacao", tom: "info" },
  { id: "vencidos-pagar", quantos: 2, titulo: "contas vencidas a pagar", detalhe: "R$ 14.720,40", acao: "Liquidar", href: "/agendamento", tom: "negativo" },
  { id: "vencidos-receber", quantos: 1, titulo: "recebimentos vencidos", detalhe: "R$ 18.900,00 parados com clientes", acao: "Cobrar", href: "/movimentacoes", tom: "critico" },
  { id: "documentos", quantos: 3, titulo: "documentos sem lançamento", detalhe: "notas e boletos que chegaram e ninguém classificou", acao: "Classificar", href: "/documentos", tom: "neutro" },
  { id: "liquidar", quantos: 3, titulo: "pagamentos vencem em 7 dias", detalhe: "R$ 28.470,00", acao: "Agendar", href: "/agendamento", tom: "critico" },
];

const MENSAL: ResultadoMes[] = [
  { ym: "2026-03", label: "mar", entradas: 51200, saidas: 44310, resultado: 6890 },
  { ym: "2026-04", label: "abr", entradas: 48750, saidas: 46980, resultado: 1770 },
  { ym: "2026-05", label: "mai", entradas: 59340, saidas: 47120, resultado: 12220 },
  { ym: "2026-06", label: "jun", entradas: 54010, saidas: 51890, resultado: 2120 },
  { ym: "2026-07", label: "jul", entradas: 62480, saidas: 49770, resultado: 12710 },
  { ym: "2026-08", label: "ago", entradas: 12500, saidas: 0, resultado: 12500 },
];

const receber: { emAberto: LinhaLanc[]; efetuados: LinhaLanc[]; vencidos: LinhaLanc[] } = {
  emAberto: [
    { id: "l-5", descricao: "Venda a prazo — pedido 8901", data_vencimento: "2026-08-14", data_pagamento: null, valor: 18900 },
    { id: "l-10", descricao: "Buffet corporativo — evento", data_vencimento: "2026-08-22", data_pagamento: null, valor: 7850 },
    { id: "l-11", descricao: "Venda balcão — semana 35", data_vencimento: "2026-08-29", data_pagamento: null, valor: 9420.5 },
  ],
  efetuados: [
    { id: "l-3", descricao: "Contrato mensal — agosto", data_vencimento: "2026-08-10", data_pagamento: "2026-08-10", valor: 12500 },
  ],
  vencidos: [
    { id: "l-1", descricao: "Venda a prazo — pedido 8842", data_vencimento: "2026-08-05", data_pagamento: null, valor: 18900 },
  ],
};

const pagar: typeof receber = {
  emAberto: [
    { id: "l-6", descricao: "Folha de pagamento — agosto", data_vencimento: "2026-08-15", data_pagamento: null, valor: 22150 },
    { id: "l-7", descricao: "Farinha de trigo — lote 22", data_vencimento: "2026-08-18", data_pagamento: null, valor: 6320.4 },
    { id: "l-8", descricao: "Simples Nacional — 07/26", data_vencimento: "2026-08-20", data_pagamento: null, valor: 6410 },
    { id: "l-9", descricao: "Energia elétrica — julho", data_vencimento: "2026-08-25", data_pagamento: null, valor: 3180.6 },
    { id: "l-12", descricao: "Embalagens e descartáveis", data_vencimento: "2026-08-31", data_pagamento: null, valor: 2740.9 },
  ],
  efetuados: [],
  vencidos: [
    { id: "l-2", descricao: "Farinha de trigo — lote 22", data_vencimento: "2026-08-08", data_pagamento: null, valor: 6320.4 },
    { id: "l-4", descricao: "Aluguel do ponto comercial", data_vencimento: "2026-08-13", data_pagamento: null, valor: 8400 },
  ],
};

const ORCAMENTO: LinhaOrcamento[] = [
  { categoriaId: "cat-4", nome: "Insumos e mercadorias", orcado: 17500, realizado: 18940, fracao: 18940 / 17500 },
  { categoriaId: "cat-6", nome: "Pessoal", orcado: 24000, realizado: 22150, fracao: 22150 / 24000 },
  { categoriaId: "cat-5", nome: "Ocupação", orcado: 12000, realizado: 9980, fracao: 9980 / 12000 },
  { categoriaId: "cat-7", nome: "Impostos e taxas", orcado: 9000, realizado: 6410, fracao: 6410 / 9000 },
];

export default function BancadaPainel() {
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

          <div className="space-y-6">
            <PageHeader titulo="Painel" sub="Padaria Aurora Ltda · visão do período" />

            <StatCards
              saldoAtual={81548.2}
              previsto={74696.4}
              ate="2026-08-31"
              recebidos={12500}
              despesas={0}
              aPagar={40801.9}
              aReceber={36170.5}
              vencidoPagar={14720.4}
              vencidoReceber={18900}
            />

            <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
              <Pendencias alerta={ALERTA} pendencias={PENDENCIAS} />
              <ContasPanel contas={CONTAS} empresaId="emp-1" />
            </div>

            <FluxoChart serie={SERIE} verHref="/fluxo" />

            <OrcadoRealizado linhas={ORCAMENTO} />

            <div className="grid gap-5 lg:grid-cols-2">
              <ContasList titulo="A receber" tom="brand" dados={receber} empresaId="emp-1" />
              <ContasList titulo="A pagar" tom="accent" dados={pagar} empresaId="emp-1" />
            </div>

            <ResultadoMensal dados={MENSAL} />
          </div>
        </div>
      </AppShell>
    </DadosFalsos>
  );
}

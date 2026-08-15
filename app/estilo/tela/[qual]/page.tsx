"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "@/components/app-shell";
import Topbar from "@/components/topbar";
import PageHeader from "@/components/ui/page-header";
import MovimentacoesContas from "@/components/movimentacoes/movimentacoes-contas";
import LancamentosClient from "@/components/lancamentos/lancamentos-client";
import FluxoClient from "@/components/fluxo/fluxo-client";
import ConciliacaoClient from "@/components/conciliacao/conciliacao-client";
import AgendamentoClient from "@/components/agendamento/agendamento-client";
import { bancadaLiberada } from "@/lib/bancada";
import DadosFalsos from "@/components/bancada/dados-falsos";

/**
 * Bancada de tela inteira, dentro do shell de verdade.
 *
 * Serve à auditoria tela a tela: montar a tela **real** — mesmo componente,
 * mesma navegação, mesmo cabeçalho — com o banco respondido por
 * `scripts/bancada/servir.js`, capturar e comparar com o mockup Fiori.
 *
 * A alternativa seria auditar lendo código, e a lição das últimas rodadas é que
 * ler código não enxerga espaçamento, hierarquia nem quantos cliques uma tarefa
 * custa. Só abrir enxerga.
 *
 * As telas aqui só precisam de `empresaId` (ou de listas curtas), porque buscam
 * o resto do banco por conta própria — é o que torna a bancada barata. Telas
 * alimentadas por componente de servidor não cabem neste molde e ganham rota
 * própria, como `/estilo/lancamento-pagina`.
 */
const EMPRESA = "emp-1";

const CONTAS = [
  { id: "ct-1", nome: "Itaú" },
  { id: "ct-2", nome: "Bradesco" },
  { id: "ct-3", nome: "Nubank PJ" },
];

const CONTAS_CNAB = CONTAS.map((c) => ({
  ...c,
  banco: c.nome,
  agencia: "1234",
  conta: "56789-0",
  carteira: "109",
  convenio: "1234567",
  cedente_nome: "Padaria Aurora Ltda",
  cedente_documento: "12345678000190",
}));

/**
 * `titulo` só quando a página real usa `PageHeader`. Duas telas não usam — e
 * inventar um cabeçalho aqui faria a captura mostrar dois títulos empilhados,
 * que é defeito da bancada, não do app. Bancada que mente por acréscimo é pior
 * que bancada nenhuma.
 */
const TELAS: Record<
  string,
  { titulo?: string; sub?: string; corpo: React.ReactNode }
> = {
  movimentacoes: {
    titulo: "Movimentações & contas",
    sub: "Lançamentos e extrato por conta no mesmo lugar.",
    corpo: <MovimentacoesContas empresaId={EMPRESA} />,
  },
  lancamentos: {
    corpo: <LancamentosClient empresaId={EMPRESA} />,
  },
  fluxo: {
    titulo: "Fluxo de caixa",
    sub: "Entradas e saídas ao longo do tempo.",
    corpo: <FluxoClient empresaId={EMPRESA} />,
  },
  conciliacao: {
    // sem `titulo` de propósito: a Conciliação passou a montar o próprio
    // `PageHeader` (a conta e o importar moram nele agora). Repetir aqui daria
    // dois cabeçalhos empilhados na bancada e em nenhum outro lugar.
    corpo: <ConciliacaoClient empresaId={EMPRESA} empresaNome="Padaria Aurora Ltda" contas={CONTAS} />,
  },
  agendamento: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    corpo: (
      <AgendamentoClient empresaId={EMPRESA} contasCnab={CONTAS_CNAB as any} />
    ),
  },
};

export default function BancadaTela({ params }: { params: { qual: string } }) {
  if (!bancadaLiberada()) notFound();

  const { qual } = params;
  const tela = TELAS[qual];
  if (!tela) {
    return (
      <div className="p-8 text-sm">
        <p className="font-bold">Tela não conhecida pela bancada: {qual}</p>
        <p className="mt-2 text-ink-muted">
          Disponíveis: {Object.keys(TELAS).join(", ")}
        </p>
      </div>
    );
  }

  return (
    <DadosFalsos>
      <AppShell
        colapsadoInicial={false}
        admin
        papel="dono"
        docsNovos={3}
        // a barra de cima é a de verdade: sem ela a captura mentiria por
        // omissão, e é justamente onde moram busca global, empresa e período
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
          {/*
          Faixa de aviso obrigatória.

          Esta rota pode ficar ligada em produção por uma janela de teste, e aí
          ela vira a tela mais perigosa do app: parece o sistema, tem o shell do
          sistema, e todo número dentro dela é inventado. Sem esta faixa alguém
          olha o saldo, acredita, e toma decisão em cima de massa de teste.
        */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl2 border border-amber-300 bg-amber-50 px-4 py-2.5 text-[12.5px] text-amber-900">
            <span className="font-bold">
              Bancada · nenhum número aqui é real.
            </span>
            <span>
              Tela de verdade, dados inventados (Padaria Aurora, a mesma massa
              do mockup). Nada é salvo e nada vem do seu banco.
            </span>
            <Link
              href="/estilo/tela"
              className="ml-auto font-semibold underline"
            >
              trocar de tela
            </Link>
          </div>
          {tela.titulo && <PageHeader titulo={tela.titulo} sub={tela.sub} />}
          {tela.corpo}
        </div>
      </AppShell>
    </DadosFalsos>
  );
}

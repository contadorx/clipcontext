import Link from "next/link";
import { notFound } from "next/navigation";
import { bancadaLiberada } from "@/lib/bancada";

/**
 * Índice das bancadas.
 *
 * Existe para dar um endereço fácil de digitar no celular e para que ninguém
 * precise adivinhar o nome da rota. Também é o lugar honesto para dizer, antes
 * de a pessoa clicar, que nada ali dentro é dado de verdade.
 */
const TELAS = [
  {
    id: "movimentacoes",
    nome: "Movimentações & contas",
    nota: "A lista mais aberta do app. Saldo por conta no topo, lista abaixo.",
  },
  {
    id: "lancamentos",
    nome: "Lançamentos",
    nota: "Contas a pagar e a receber, sem a barra de contas.",
  },
  {
    id: "agendamento",
    nome: "Liquidações",
    nota: "Onde se dá baixa nas contas do dia. Cockpit de caixa no topo.",
  },
  {
    id: "fluxo",
    nome: "Fluxo de caixa",
    nota: "Entradas e saídas ao longo do tempo.",
  },
  {
    id: "conciliacao",
    nome: "Conciliação bancária",
    nota: "Extrato de um lado, lançamentos do outro.",
  },
];

const OUTRAS = [
  {
    href: "/estilo",
    nome: "Componentes base",
    nota: "Todo botão, campo, aviso e estado vazio, em todas as variantes.",
  },
  {
    href: "/estilo/lancamento",
    nome: "Lançamento — diálogo",
    nota: "O formulário completo, como abre pelo botão.",
  },
  {
    href: "/estilo/lancamento-pagina",
    nome: "Lançamento — página",
    nota: "O mesmo formulário com URL própria.",
  },
  {
    href: "/estilo/foco",
    nome: "Bancada de foco",
    nota: "Reproduz de propósito o bug do campo que aceitava uma letra.",
  },
];

export default function IndiceBancadas() {
  if (!bancadaLiberada()) notFound();

  return (
    <div className="min-h-screen bg-surface px-6 py-10">
      <div className="mx-auto max-w-[760px] space-y-8">
        <header>
          <h1 className="text-xl font-bold tracking-tight text-ink">
            Bancadas
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Telas de verdade com dados inventados. Nada é salvo, nada vem do seu
            banco e nenhuma empresa real aparece aqui — servem para olhar e
            comparar, não para conferir número.
          </p>
        </header>

        <section className="space-y-2">
          <h2 className="text-[13px] font-bold uppercase tracking-wider text-ink-soft">
            Telas inteiras
          </h2>
          {TELAS.map((t) => (
            <Link
              key={t.id}
              href={`/estilo/tela/${t.id}`}
              className="block rounded-xl2 bg-white p-4 shadow-card transition hover:ring-2 hover:ring-brand/30"
            >
              <p className="text-sm font-bold text-ink">{t.nome}</p>
              <p className="mt-0.5 text-xs text-ink-muted">{t.nota}</p>
            </Link>
          ))}
        </section>

        <section className="space-y-2">
          <h2 className="text-[13px] font-bold uppercase tracking-wider text-ink-soft">
            Peças e formulários
          </h2>
          {OUTRAS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="block rounded-xl2 bg-white p-4 shadow-card transition hover:ring-2 hover:ring-brand/30"
            >
              <p className="text-sm font-bold text-ink">{t.nome}</p>
              <p className="mt-0.5 text-xs text-ink-muted">{t.nota}</p>
            </Link>
          ))}
        </section>
      </div>
    </div>
  );
}

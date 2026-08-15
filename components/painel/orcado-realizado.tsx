import Link from "next/link";
import Card from "@/components/ui/card";
import { brl } from "@/lib/formato";
import type { LinhaOrcamento } from "@/lib/painel";

/**
 * Orçado × realizado do mês.
 *
 * O app tem orçamento desde sempre, em Configurações, e nunca o trouxe para
 * onde alguém decide. Orçamento que só existe na tela de cadastro não muda
 * comportamento nenhum — é um número que a pessoa digitou uma vez e nunca mais
 * viu.
 *
 * O cartão **não aparece** quando não há orçamento preenchido: num painel de
 * quem não usa a função, ele seria um retângulo vazio cobrando uma tarefa que
 * ninguém pediu. Quem decidir usar, vê; quem não, não fica devendo nada.
 *
 * A ordem é por quanto do orçado já foi consumido, não por valor: a categoria
 * que estourou é a que exige decisão, mesmo que seja a menor da lista.
 */
export default function OrcadoRealizado({ linhas }: { linhas: LinhaOrcamento[] }) {
  if (linhas.length === 0) return null;

  const estourou = linhas.filter((l) => l.fracao > 1);

  return (
    <Card
      titulo="Orçado × realizado"
      sub="despesas do mês"
      acao="Ajustar orçamento"
      acaoHref="/configuracoes/orcamento"
      rodape={
        estourou.length > 0 ? (
          <span className="text-[12px] text-ink-muted">
            <b className="text-danger">
              {estourou.length} categoria{estourou.length > 1 ? "s" : ""} acima do orçado
            </b>{" "}
            — {estourou.map((l) => l.nome).join(", ")}.
          </span>
        ) : (
          <span className="text-[12px] text-ink-muted">Nenhuma categoria estourou o orçamento.</span>
        )
      }
    >
      <ul className="space-y-2.5">
        {linhas.map((l) => {
          const pct = Math.min(l.fracao, 1) * 100;
          const acima = l.fracao > 1;
          return (
            <li key={l.categoriaId}>
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="min-w-0 truncate text-ink">{l.nome}</span>
                <span className="num shrink-0 font-semibold text-ink">
                  {brl(l.realizado)}
                  <span className="ml-1 font-normal text-ink-soft">de {brl(l.orcado)}</span>
                </span>
              </div>
              {/* A barra é a mesma leitura do número, para quem varre a lista sem
                  ler valor. Estouro em vermelho porque aqui é problema. */}
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface">
                <div
                  className={`h-full rounded-full ${acima ? "bg-danger" : "bg-brand"}`}
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
              </div>
              {acima && (
                <p className="mt-0.5 text-[11px] font-semibold text-danger">
                  {Math.round((l.fracao - 1) * 100)}% acima do orçado
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[11px] leading-snug text-ink-soft">
        Realizado é o que <b>saiu</b> no período, pela data de pagamento. Compromissos ainda em
        aberto não entram —{" "}
        <Link href="/fluxo" className="font-semibold text-brand-dark hover:underline">
          eles estão no fluxo
        </Link>
        .
      </p>
    </Card>
  );
}

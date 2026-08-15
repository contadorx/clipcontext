import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

/**
 * Estado vazio — a "illustrated message" do Fiori, na versão sóbria.
 *
 * Havia cinco moldes espalhados pelo app: com borda tracejada e botão, sem
 * borda e sem botão, card branco com parágrafo de instrução, parágrafo solto
 * sem ícone, e um dentro de <td colSpan>. Telas irmãs (Vendas × Contas ×
 * Centros de custo) usavam moldes diferentes para a mesma situação.
 *
 * A regra: se o vazio é o começo (não há nada cadastrado), ofereça a ação. Se o
 * vazio é resultado de filtro, não ofereça — sugira afrouxar o filtro.
 */
export default function EmptyState({
  titulo,
  descricao,
  icone: Icone = Inbox,
  acao,
  /** vazio por filtro: sem borda tracejada, mais discreto */
  filtrado = false,
  /** dentro de um painel pequeno: uma linha, sem ícone nem moldura */
  compacto = false,
  className = "",
}: {
  titulo: string;
  descricao?: React.ReactNode;
  icone?: LucideIcon;
  acao?: React.ReactNode;
  filtrado?: boolean;
  compacto?: boolean;
  className?: string;
}) {
  // Num painel lateral de 200px de altura, o círculo de 48px e o py-16 do
  // estado vazio "cheio" ocupariam a caixa inteira. Aqui a frase basta.
  if (compacto)
    return (
      <div className={`px-4 py-6 text-center ${className}`}>
        <p className="text-[12.5px] text-ink-muted">{titulo}</p>
        {descricao && <p className="mt-0.5 text-[11.5px] text-ink-soft">{descricao}</p>}
        {acao && <div className="mt-3">{acao}</div>}
      </div>
    );

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl2 px-6 text-center ${
        filtrado ? "py-12" : "border border-dashed border-line bg-white py-16"
      } ${className}`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-ink-soft">
        <Icone size={22} />
      </div>
      <p className="mt-3 text-sm font-semibold text-ink">{titulo}</p>
      {descricao && <p className="mt-1 max-w-sm text-[12.5px] text-ink-muted">{descricao}</p>}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  );
}

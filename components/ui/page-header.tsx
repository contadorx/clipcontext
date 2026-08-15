import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import MedeCabecalho from "@/components/ui/mede-cabecalho";

/**
 * Cabeçalho de página: mesmo bloco em todas as telas, preso abaixo da shell bar.
 *
 * Ganho concreto: o título e as ações principais ficam sempre no mesmo lugar,
 * mesmo com a lista rolando. Antes cada tela desenhava o seu, com escalas
 * diferentes de tipografia.
 */
export default function PageHeader({
  titulo,
  sub,
  voltar,
  acoes,
  children,
}: {
  titulo: string;
  sub?: React.ReactNode;
  /** migalha de volta, para telas de detalhe (ex.: dentro de Configurações) */
  voltar?: { href: string; label: string };
  /** botões à direita do título */
  acoes?: React.ReactNode;
  /** faixa extra sob o título (abas, filtros, KPIs) */
  children?: React.ReactNode;
}) {
  return (
    <div className="sticky top-[52px] z-20 -mx-5 border-b border-line bg-white px-5 pt-3">
      <MedeCabecalho />
      {voltar && (
        <Link
          href={voltar.href}
          className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted transition hover:text-brand"
        >
          <ChevronLeft size={14} /> {voltar.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start gap-3 pb-3">
        <div className="min-w-0 flex-1">
          <h1 className={`truncate text-lg font-bold tracking-tight text-ink${voltar ? " mt-0.5" : ""}`}>{titulo}</h1>
          {sub && <p className="mt-0.5 text-xs text-ink-muted">{sub}</p>}
        </div>
        {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
      </div>
      {children}
    </div>
  );
}

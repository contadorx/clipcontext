/**
 * Placeholder de carregamento.
 *
 * O app mostrava a palavra "Carregando…" em 19 lugares, em três escalas de
 * tipografia. O problema não é estético: como o texto ocupa uma linha e a lista
 * ocupa vinte, a tela salta quando os dados chegam e o clique vai parar em
 * outro lugar. O placeholder reserva o espaço.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-line/70 ${className}`} aria-hidden />;
}

/** linhas de tabela fantasma, na mesma altura das linhas reais */
export function SkeletonLinhas({
  linhas = 6,
  colunas = 5,
  className = "",
}: {
  linhas?: number;
  colunas?: number;
  className?: string;
}) {
  // larguras irregulares: uma grade perfeita parece um componente quebrado
  const larguras = ["w-3/4", "w-1/2", "w-5/6", "w-2/3", "w-1/3", "w-4/5"];
  return (
    <div role="status" aria-label="Carregando" className={className}>
      {Array.from({ length: linhas }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-line px-4 py-3 last:border-b-0">
          {Array.from({ length: colunas }).map((_, c) => (
            <Skeleton key={c} className={`h-3 ${larguras[(i + c) % larguras.length]} flex-1`} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** blocos de cartão fantasma, para painéis de KPI */
export function SkeletonCartoes({ n = 4, className = "" }: { n?: number; className?: string }) {
  return (
    <div role="status" aria-label="Carregando" className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-4 ${className}`}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="rounded-xl2 bg-white p-4 shadow-card">
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="mt-3 h-5 w-28" />
        </div>
      ))}
    </div>
  );
}

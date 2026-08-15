/**
 * Object status — o "semáforo" do Fiori.
 *
 * Antes disto cada tela desenhava o seu: quatro dialetos diferentes (marcador +
 * texto, pílula com fundo, ícone em quadrado, mini-badge redondo) em quatro
 * escalas de tipografia. O mesmo estado aparecia de um jeito em Movimentações e
 * de outro na Central de boletos.
 *
 * Regra de cor (a mesma do resto do app):
 *  - positivo  → teal da marca (recebido, conciliado, dentro do prazo)
 *  - negativo  → vermelho (vencido, erro, rejeitado) — só quando há problema
 *  - crítico   → âmbar (vence hoje, precisa de atenção mas ainda não é problema)
 *  - info      → azul (agendado, em processamento)
 *  - neutro    → tinta (previsto, rascunho, sem informação)
 *
 * Saída/despesa NÃO é negativo. É um tipo de dado.
 */
export type Tom = "positivo" | "negativo" | "critico" | "info" | "neutro";

const TEXTO: Record<Tom, string> = {
  positivo: "text-brand-dark",
  negativo: "text-danger",
  critico: "text-amber-700",
  info: "text-blue-700",
  neutro: "text-ink-muted",
};

const PILULA: Record<Tom, string> = {
  positivo: "bg-brand-light text-brand-dark",
  negativo: "bg-rose-50 text-danger",
  critico: "bg-amber-50 text-amber-700",
  info: "bg-blue-50 text-blue-700",
  neutro: "bg-surface text-ink-muted",
};

export default function ObjectStatus({
  tom = "neutro",
  children,
  /** pílula com fundo, para quando o status é o assunto da célula (ex.: fila de notas) */
  pilula = false,
  /** sem o marcador redondo */
  semMarcador = false,
  title,
  className = "",
}: {
  tom?: Tom;
  children: React.ReactNode;
  pilula?: boolean;
  semMarcador?: boolean;
  title?: string;
  className?: string;
}) {
  if (pilula)
    return (
      <span
        title={title}
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${PILULA[tom]} ${className}`}
      >
        {!semMarcador && <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-current" />}
        {children}
      </span>
    );

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 text-[11.5px] font-bold ${TEXTO[tom]} ${className}`}
    >
      {!semMarcador && <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/** badge redondo de 16px para marcas auxiliares na linha (conciliado, exportado, rateado) */
export function StatusIcone({
  tom = "neutro",
  title,
  children,
}: {
  tom?: Tom;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      title={title}
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${PILULA[tom]}`}
    >
      {children}
    </span>
  );
}

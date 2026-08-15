import Link from "next/link";

/**
 * Cartão padrão do app.
 *
 * Existia meia dúzia de cabeçalhos de cartão diferentes — cada tela escrevia o
 * seu título com um tamanho e um espaçamento. Aqui é um só: título, subtítulo
 * opcional, ação no canto e rodapé separado por linha.
 */
export default function Card({
  titulo,
  sub,
  acao,
  acaoHref,
  acoes,
  rodape,
  /** corpo colado nas bordas — para listas cujas linhas já têm o próprio padding */
  corpoSemPadding = false,
  className = "",
  children,
}: {
  titulo?: string;
  sub?: React.ReactNode;
  /** atalho para o caso comum: um link "ver mais" no canto do cabeçalho */
  acao?: string;
  acaoHref?: string;
  /** qualquer coisa no canto do cabeçalho (botões, filtros) */
  acoes?: React.ReactNode;
  rodape?: React.ReactNode;
  corpoSemPadding?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col rounded-xl2 bg-white shadow-card ${className}`}>
      {(titulo || acoes || acao) && (
        <div
          className={`flex items-start justify-between gap-3 px-4 pt-3.5 ${
            corpoSemPadding ? "border-b border-line pb-3" : "pb-2"
          }`}
        >
          <div className="min-w-0">
            {titulo && <h2 className="truncate text-[13px] font-bold text-ink">{titulo}</h2>}
            {sub && <p className="mt-0.5 text-[11px] text-ink-muted">{sub}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {acoes}
            {acao && acaoHref && (
              <Link href={acaoHref} className="text-[11.5px] font-semibold text-brand-dark hover:underline">
                {acao} →
              </Link>
            )}
          </div>
        </div>
      )}

      <div className={`flex min-h-0 flex-1 flex-col ${corpoSemPadding ? "" : "px-4 pb-4"}`}>{children}</div>

      {rodape && (
        <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-2.5 text-[12px]">
          {rodape}
        </div>
      )}
    </div>
  );
}

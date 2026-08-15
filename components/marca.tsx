/**
 * A marca FinanceiroX — o X-seta, o quadrado e o wordmark.
 *
 * O X é o elemento gráfico da família: veio do bpox (o outro produto da casa),
 * onde o braço ascendente do X é uma seta que sobe. Aqui ele foi redesenhado em
 * vetor a partir da referência — braço descendente partido em dois segmentos,
 * com o corte paralelo ao corredor da seta — e vestiu a cor DESTE produto: teal
 * no wordmark, branco sobre o quadrado com gradiente. Mesma família, produtos
 * distintos; a forma é compartilhada, a cor não.
 *
 * Um componente só, importado pelo site público, pelo login, pelo onboarding e
 * pela topbar. Geometria gerada por script (shapely) e congelada aqui — nenhuma
 * fonte envolvida, o mesmo path serve no favicon (`app/icon.svg`) e na imagem
 * OG, e renderiza idêntico onde a Plus Jakarta não carregou.
 */

/** Braço ascendente: a seta. */
export const X_SETA =
  "M28.2 10.3 L2.4 37.2 L2.4 37.7 L2.5 38.1 L9.5 44.7 L9.8 44.8 L10.0 44.8 L10.4 44.6 L36.1 17.8 L39.2 20.8 L39.5 20.9 L39.8 20.9 L40.0 20.8 L40.2 20.6 L40.3 20.3 L45.6 1.0 L45.6 0.7 L45.5 0.4 L45.3 0.2 L45.1 0.1 L44.9 0.0 L44.6 0.0 L25.3 6.2 L25.1 6.4 L25.0 6.7 L25.0 7.0 L25.1 7.3 L28.2 10.3 Z";

/** Braço descendente: dois segmentos, cortados rente ao corredor da seta. */
export const X_DESC =
  "M25.5 34.5 L40.5 47.9 L40.8 48.0 L41.1 48.0 L41.3 47.8 L41.5 47.7 L41.6 47.3 L41.6 34.1 L41.6 33.8 L41.4 33.5 L33.3 26.3 L32.9 26.1 L32.6 26.1 L32.3 26.3 L25.5 33.4 L25.3 33.7 L25.3 33.9 L25.3 34.2 L25.5 34.5 Z M6.8 17.3 L6.9 17.6 L7.1 17.9 L11.6 22.0 L12.0 22.1 L12.3 22.2 L12.7 21.9 L19.5 14.9 L19.6 14.6 L19.7 14.4 L19.6 14.0 L19.4 13.8 L8.1 3.6 L7.9 3.4 L7.6 3.4 L7.3 3.5 L7.1 3.6 L6.9 3.9 L6.8 4.1 L6.8 17.3 Z";

/** O X-seta sozinho, na cor do contexto (`currentColor`). Dimensione por className. */
export function XSeta({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="currentColor" aria-hidden className={className}>
      <path d={X_DESC} />
      <path d={X_SETA} />
    </svg>
  );
}

/** O quadrado da marca: gradiente teal com o X-seta em branco. */
export function MarcaFX({ tamanho = 32 }: { tamanho?: number }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <defs>
        <linearGradient id="fx-g" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="#17B8A6" />
          <stop offset="1" stopColor="#0E8577" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="url(#fx-g)" />
      <g transform="translate(9 9) scale(0.958)" fill="#fff">
        <path d={X_DESC} />
        <path d={X_SETA} />
      </g>
    </svg>
  );
}

/**
 * Wordmark: "Financeiro" na tinta do contexto e o X-seta no teal da marca,
 * no lugar da letra. O `sr-only` devolve o "X" a quem ouve em vez de ver.
 * O SVG dimensiona por `em`, então acompanha o corpo do texto ao lado.
 */
export function NomeFX({ escuro = false, className = "" }: { escuro?: boolean; className?: string }) {
  return (
    <span className={`font-extrabold tracking-tight ${escuro ? "text-white" : "text-ink"} ${className}`}>
      Financeiro
      <span className="sr-only">X</span>
      <XSeta className="ml-[0.08em] inline-block h-[0.78em] w-[0.78em] text-brand" />
    </span>
  );
}

export function LogoFX({
  tamanho = 30,
  escuro = false,
  texto = "text-[15px]",
}: {
  tamanho?: number;
  escuro?: boolean;
  texto?: string;
}) {
  return (
    <span className="flex items-center gap-2">
      <MarcaFX tamanho={tamanho} />
      <NomeFX escuro={escuro} className={texto} />
    </span>
  );
}

import Link from "next/link";

/**
 * Tile do Início: quadrado de tamanho fixo com um número ao vivo e um destino.
 *
 * A ideia é o menu deixar de ser lista de telas e passar a ser dado — você abre
 * o app e já vê onde está o problema, em vez de caçar a tela que mostra isso.
 */

export type TomTile = "neutro" | "positivo" | "critico" | "negativo" | "info";

const TOM: Record<TomTile, string> = {
  neutro: "text-ink",
  positivo: "text-brand-dark",
  critico: "text-amber-700",
  negativo: "text-danger",
  info: "text-blue-700",
};

/**
 * O corpo do número encolhe conforme ele cresce.
 *
 * O tile tem 172px de largura e cerca de 145px de área útil. A 26px fixos,
 * "R$ 14.720,40" e "13/08/2026" não cabem — e como o corpo do tile tem
 * `overflow-hidden`, o número não vazava: era **cortado**, o que é pior, porque
 * some sem avisar. Aparecia inteiro na tela de quem escreveu e truncado no PDF
 * e em tela menor.
 *
 * Os cortes saem da largura média do dígito nesta fonte, não de gosto: com
 * `font-semibold` e `tracking-tight`, cada caractere ocupa cerca de 0,58 do
 * corpo. Daí 145 ÷ (0,58 × n) para achar o maior corpo que ainda cabe.
 *
 * `font-light` também saiu: número financeiro fino a 26px fica pálido, e a
 * diferença de largura entre light e semibold é pequena demais para pagar por
 * isso.
 */
function corpoDoValor(v: string): string {
  const n = v.length;
  if (n <= 8) return "text-[26px]";
  if (n <= 11) return "text-[21px]";
  if (n <= 14) return "text-[17px]";
  return "text-[15px]";
}

export default function Tile({
  href,
  titulo,
  sub,
  valor,
  unidade,
  tom = "neutro",
  rodapeEsq,
  rodapeDir,
  rodapeTom,
  children,
  largo = false,
}: {
  href: string;
  titulo: string;
  sub?: string;
  /** número principal já formatado */
  valor?: string;
  /** prefixo/sufixo discreto ao lado do número (R$, documentos, títulos…) */
  unidade?: string;
  tom?: TomTile;
  rodapeEsq?: React.ReactNode;
  rodapeDir?: React.ReactNode;
  rodapeTom?: TomTile;
  /** conteúdo livre no corpo (mini gráfico, barra de progresso) */
  children?: React.ReactNode;
  largo?: boolean;
}) {
  return (
    <Link
      href={href}
      /*
        Tile sem número é mais baixo.

        Os oito tiles de Processos não têm valor — são portas. Na altura fixa de
        168px, dois terços de cada um era ar, e a fileira inteira empurrava os
        relatórios para fora da primeira dobra. Isso só apareceu ao abrir a tela:
        no código, os dois tipos de tile são a mesma chamada.

        126px, e não 104: com 104 o título de duas linhas invadia o subtítulo — o
        que também só apareceu ao olhar, uma correção depois.
      */
      className={`flex ${valor || children ? "h-[168px]" : "h-[126px]"} flex-col rounded-xl2 bg-white p-3.5 shadow-card transition hover:shadow-[0_4px_12px_rgba(16,24,40,.10)] active:scale-[.99] ${
        largo ? "w-full sm:w-[352px]" : "w-full sm:w-[172px]"
      }`}
    >
      <p className="line-clamp-2 text-[13px] font-bold leading-tight text-ink">{titulo}</p>
      {sub && <p className="line-clamp-2 text-[11px] leading-tight text-ink-muted">{sub}</p>}

      <div className="flex min-h-0 flex-1 flex-col justify-end overflow-hidden pt-1.5">
        {valor && (
          <p className="flex items-baseline gap-1">
            <span
              className={`num ${corpoDoValor(valor)} font-semibold leading-none tracking-tight ${TOM[tom]}`}
            >
              {valor}
            </span>
            {unidade && <span className="shrink-0 text-[11px] text-ink-muted">{unidade}</span>}
          </p>
        )}
        {children}
      </div>

      {(rodapeEsq || rodapeDir) && (
        <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-line pt-1.5 text-[11px]">
          <span className={`truncate font-semibold ${rodapeTom ? TOM[rodapeTom] : "text-ink-muted"}`}>
            {rodapeEsq}
          </span>
          <span className="shrink-0 text-ink-soft">{rodapeDir}</span>
        </div>
      )}
    </Link>
  );
}

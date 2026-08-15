import Link from "next/link";

/**
 * Botão.
 *
 * O app tinha 124 botões com a classe escrita à mão. As strings estavam
 * *quase* iguais — três tamanhos de padding disputando o mesmo papel
 * (`px-3 py-1.5`, `px-3 py-2`, `px-2.5 py-1.5`) e dois raios (`rounded-md` e
 * `rounded-lg`) no mesmo tipo de botão. Nada disso quebrava nada; só fazia a
 * mesma ação parecer outra coisa dependendo da tela.
 *
 * As variantes aqui são as que **de fato existem** no app, não uma taxonomia
 * inventada:
 *
 * - `primario`  — a ação da tela. Uma por bloco. Salvar, Criar, Conciliar.
 * - `secundario`— alternativa de mesmo peso, com borda. Cancelar, Importar.
 * - `discreto`  — ação de apoio, sem borda até o hover. "limpar seleção".
 * - `perigo`    — destrói dado. Excluir, Arquivar.
 * - `neutro`    — primário de tela onde teal significaria "receita", como o
 *                 botão de nova saída. Tinta em vez de marca.
 *
 * `href` transforma em link mantendo a aparência — abrir em nova aba é
 * comportamento de link, e um `<button>` com `onClick={router.push}` tira isso
 * de quem usa.
 */
export type VarianteBotao = "primario" | "secundario" | "discreto" | "perigo" | "neutro";
export type TamanhoBotao = "sm" | "md";

const VARIANTE: Record<VarianteBotao, string> = {
  primario: "bg-brand text-white hover:bg-brand-dark",
  secundario: "border border-line bg-white text-ink-muted hover:border-brand hover:text-brand-dark",
  discreto: "text-ink-soft hover:bg-surface hover:text-ink",
  perigo: "bg-danger text-white hover:opacity-90",
  neutro: "bg-ink text-white hover:bg-rail-hover",
};

const TAMANHO: Record<TamanhoBotao, string> = {
  sm: "h-8 gap-1.5 rounded-lg px-2.5 text-xs font-semibold",
  md: "h-9 gap-1.5 rounded-lg px-3.5 text-sm font-semibold",
};

const BASE =
  "inline-flex shrink-0 items-center justify-center whitespace-nowrap transition disabled:cursor-not-allowed disabled:opacity-50";

function classes(v: VarianteBotao, t: TamanhoBotao, largura: boolean, extra: string): string {
  return [BASE, TAMANHO[t], VARIANTE[v], largura ? "w-full" : "", extra].filter(Boolean).join(" ");
}

type Comuns = {
  variante?: VarianteBotao;
  tamanho?: TamanhoBotao;
  /** ocupa a largura toda — típico do botão de salvar no rodapé de diálogo */
  largura?: boolean;
  className?: string;
  children: React.ReactNode;
};

export default function Botao({
  variante = "secundario",
  tamanho = "md",
  largura = false,
  className = "",
  children,
  ...rest
}: Comuns & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={classes(variante, tamanho, largura, className)} {...rest}>
      {children}
    </button>
  );
}

export function BotaoLink({
  variante = "secundario",
  tamanho = "md",
  largura = false,
  className = "",
  children,
  href,
  ...rest
}: Comuns & { href: string } & Omit<React.ComponentProps<typeof Link>, "href" | "className" | "children">) {
  return (
    <Link href={href} className={classes(variante, tamanho, largura, className)} {...rest}>
      {children}
    </Link>
  );
}

/**
 * Botão só com ícone. `rotulo` é obrigatório: é o que o leitor de tela anuncia
 * e o que aparece no title. Um botão de ícone sem rótulo anuncia string vazia —
 * foi assim em 37 lugares do app antes desta rodada.
 */
export function BotaoIcone({
  rotulo,
  variante = "discreto",
  className = "",
  children,
  ...rest
}: {
  rotulo: string;
  variante?: VarianteBotao;
  className?: string;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      title={rotulo}
      className={[
        BASE,
        "h-8 w-8 rounded-lg",
        // Numa linha de tabela há um destes por linha: fundo vermelho sólido em
        // vinte linhas vira uma parede. O vermelho aparece no hover, quando a
        // pessoa já mirou o botão.
        variante === "perigo" ? "text-ink-soft hover:bg-rose-50 hover:text-danger" : VARIANTE[variante],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
}

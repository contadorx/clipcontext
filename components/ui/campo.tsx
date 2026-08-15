/**
 * Campo de formulário: rótulo, controle, ajuda e erro.
 *
 * Havia 149 campos com a classe escrita à mão e 19 arquivos com um
 * `const campo = "…"` ou `const inputCls = "…"` local — cada um com sua versão
 * do mesmo campo. A divergência que mais aparecia: metade usava
 * `focus:border-brand` só, metade acrescentava `focus:ring-2`, e o filtro das
 * listas usava uma borda inferior mais grossa que o formulário.
 *
 * Duas alturas, porque o app tem dois contextos e não mais que isso:
 *
 * - `md` — dentro de formulário, onde há espaço e o campo é o assunto.
 * - `sm` — dentro de barra de filtros, onde cabem seis lado a lado.
 *
 * O erro fica **abaixo** do campo e ligado a ele por `aria-describedby`: sem
 * isso, o leitor de tela anuncia o campo sem dizer o que está errado nele.
 */
export type TamanhoCampo = "sm" | "md";

/**
 * A cor da borda sai da base e entra por último, em vez de ficarem as duas na
 * string. Com `border-line` e `border-danger` juntas, quem ganha é a ordem no
 * CSS gerado — não a ordem em que foram escritas — e o campo com erro
 * continuava cinza.
 */
const BASE_CONTROLE: Record<TamanhoCampo, string> = {
  sm: "h-8 w-full rounded border border-b-2 px-2.5 text-[12.5px] outline-none transition",
  md: "w-full rounded-lg border px-3 py-2 text-sm outline-none transition",
};

const NORMAL: Record<TamanhoCampo, string> = {
  sm: "border-line border-b-ink-soft focus:border-brand focus:border-b-brand",
  md: "border-line focus:border-brand focus:ring-2 focus:ring-brand/15",
};

const COM_ERRO: Record<TamanhoCampo, string> = {
  sm: "border-danger border-b-danger focus:border-danger",
  md: "border-danger focus:border-danger focus:ring-2 focus:ring-danger/15",
};

export const CONTROLE: Record<TamanhoCampo, string> = {
  sm: `${BASE_CONTROLE.sm} ${NORMAL.sm}`,
  md: `${BASE_CONTROLE.md} ${NORMAL.md}`,
};

export function classeControle(tamanho: TamanhoCampo = "md", erro = false, extra = ""): string {
  return [BASE_CONTROLE[tamanho], erro ? COM_ERRO[tamanho] : NORMAL[tamanho], extra].filter(Boolean).join(" ");
}

export default function Campo({
  rotulo,
  htmlFor,
  ajuda,
  erro,
  obrigatorio = false,
  tamanho = "md",
  className = "",
  children,
}: {
  rotulo?: string;
  htmlFor?: string;
  /** explicação curta que fica sob o campo quando não há erro */
  ajuda?: React.ReactNode;
  erro?: string | null;
  obrigatorio?: boolean;
  tamanho?: TamanhoCampo;
  className?: string;
  children: React.ReactNode;
}) {
  const idAjuda = htmlFor ? `${htmlFor}-ajuda` : undefined;
  return (
    <div className={className}>
      {rotulo && (
        <label
          htmlFor={htmlFor}
          className={
            tamanho === "sm"
              ? "mb-1 block text-[11px] font-semibold text-ink-soft"
              : "mb-1 block text-xs font-semibold text-ink-muted"
          }
        >
          {rotulo}
          {obrigatorio && <span className="ml-0.5 text-danger">*</span>}
        </label>
      )}
      {children}
      {erro ? (
        <p id={idAjuda} role="alert" className="mt-1 text-[11.5px] font-semibold text-danger">
          {erro}
        </p>
      ) : ajuda ? (
        <p id={idAjuda} className="mt-1 text-[11px] leading-snug text-ink-soft">
          {ajuda}
        </p>
      ) : null}
    </div>
  );
}

/** Atalho para o caso mais comum: rótulo + input controlado. */
export function CampoTexto({
  rotulo,
  ajuda,
  erro,
  obrigatorio,
  tamanho = "md",
  className = "",
  inputClassName = "",
  ...rest
}: {
  rotulo?: string;
  ajuda?: React.ReactNode;
  erro?: string | null;
  obrigatorio?: boolean;
  tamanho?: TamanhoCampo;
  className?: string;
  inputClassName?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Campo
      rotulo={rotulo}
      htmlFor={rest.id}
      ajuda={ajuda}
      erro={erro}
      obrigatorio={obrigatorio}
      tamanho={tamanho}
      className={className}
    >
      <input
        aria-invalid={erro ? true : undefined}
        // só aponta para o texto de ajuda quando ele existe: `aria-describedby`
        // apontando para um id inexistente é um leitor de tela procurando algo
        // que não está lá
        aria-describedby={rest.id && (erro || ajuda) ? `${rest.id}-ajuda` : undefined}
        className={classeControle(tamanho, Boolean(erro), inputClassName)}
        {...rest}
      />
    </Campo>
  );
}

/** Atalho para `<select>` — mesma moldura, mesmo `id`/`htmlFor`. */
export function CampoSelect({
  rotulo,
  ajuda,
  erro,
  obrigatorio,
  tamanho = "md",
  className = "",
  inputClassName = "",
  children,
  ...rest
}: {
  rotulo?: string;
  ajuda?: React.ReactNode;
  erro?: string | null;
  obrigatorio?: boolean;
  tamanho?: TamanhoCampo;
  className?: string;
  inputClassName?: string;
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Campo
      rotulo={rotulo}
      htmlFor={rest.id}
      ajuda={ajuda}
      erro={erro}
      obrigatorio={obrigatorio}
      tamanho={tamanho}
      className={className}
    >
      <select
        aria-invalid={erro ? true : undefined}
        aria-describedby={rest.id && (erro || ajuda) ? `${rest.id}-ajuda` : undefined}
        className={classeControle(tamanho, Boolean(erro), inputClassName)}
        {...rest}
      >
        {children}
      </select>
    </Campo>
  );
}

/** Atalho para `<textarea>`. A altura vem por `rows`, como no HTML. */
export function CampoArea({
  rotulo,
  ajuda,
  erro,
  obrigatorio,
  tamanho = "md",
  className = "",
  inputClassName = "",
  ...rest
}: {
  rotulo?: string;
  ajuda?: React.ReactNode;
  erro?: string | null;
  obrigatorio?: boolean;
  tamanho?: TamanhoCampo;
  className?: string;
  inputClassName?: string;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Campo
      rotulo={rotulo}
      htmlFor={rest.id}
      ajuda={ajuda}
      erro={erro}
      obrigatorio={obrigatorio}
      tamanho={tamanho}
      className={className}
    >
      <textarea
        aria-invalid={erro ? true : undefined}
        aria-describedby={rest.id && (erro || ajuda) ? `${rest.id}-ajuda` : undefined}
        className={classeControle(tamanho, Boolean(erro), inputClassName)}
        {...rest}
      />
    </Campo>
  );
}

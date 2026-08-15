"use client";

import type { ColunaDef } from "@/components/ui/config-colunas";
import EmptyState from "@/components/ui/empty-state";
import { SkeletonLinhas } from "@/components/ui/skeleton";

/**
 * Tabela em grid.
 *
 * O app não usa `<table>` nas listas principais: usa CSS grid, porque as
 * colunas são configuráveis por usuário e a largura vem de um
 * `gridTemplateColumns` montado em runtime. O que se repetia em cada tela era a
 * moldura em volta disso — cabeçalho grudento, a decisão de quando rolar de
 * lado, carregando, vazio.
 *
 * Duas armadilhas que este componente resolve de uma vez, e que custaram caro
 * para descobrir:
 *
 * 1. **Um contêiner com `overflow-x` também é contêiner de rolagem vertical**,
 *    e aí o cabeçalho `sticky` gruda nele — que não rola — em vez de grudar na
 *    página. Por isso a rolagem lateral só existe abaixo de `xl`, onde a tabela
 *    de fato não cabe.
 * 2. **A altura do cabeçalho da página muda de tela para tela.** O offset do
 *    `sticky` vem da variável `--fs-cab`, publicada pelo `PageHeader`, e não de
 *    um número cravado que daria certo em uma tela e errado nas outras.
 */
export default function Tabela({
  colunas,
  gridTemplate,
  carregando = false,
  vazio,
  larguraMinima = "980px",
  /** conteúdo do cabeçalho por coluna; sem isso usa o `label` da definição */
  cabecalho,
  rodape,
  moldura = true,
  grudento = true,
  children,
}: {
  colunas: ColunaDef[];
  gridTemplate: string;
  carregando?: boolean;
  /** o que mostrar quando não há linhas; sem isto, nada é mostrado */
  vazio?: { titulo: string; descricao?: React.ReactNode; filtrado?: boolean; acao?: React.ReactNode } | null;
  larguraMinima?: string;
  cabecalho?: (c: ColunaDef) => React.ReactNode;
  rodape?: React.ReactNode;
  /**
   * `false` tira o cartão em volta (canto, fundo, sombra). Para quando a tabela
   * vive DENTRO de um Card ou de um diálogo — cartão dentro de cartão duplica
   * sombra e canto, e foi o que impedia a adoção nesses lugares.
   */
  moldura?: boolean;
  /**
   * `false` desliga o cabeçalho grudento. Obrigatório dentro de diálogo com
   * rolagem própria: o `top` do sticky é calculado para o shell da página
   * (52px + --fs-cab) e, dentro de um `overflow-auto`, o cabeçalho gruda no
   * contêiner errado, flutuando no meio do painel.
   */
  grudento?: boolean;
  children?: React.ReactNode;
}) {
  const semLinhas = !carregando && !children;

  return (
    <div className={moldura ? "rounded-xl2 bg-white shadow-card max-xl:overflow-x-auto" : "max-xl:overflow-x-auto"}>
      <div style={{ minWidth: larguraMinima }}>
        <div
          className={`${
            grudento ? "sticky top-[calc(52px_+_var(--fs-cab,0px))] z-10 " : ""
          }grid gap-3 border-b border-line bg-white px-4 py-2.5 text-[11px] font-semibold text-ink-soft`}
          style={{ gridTemplateColumns: gridTemplate }}
        >
          {colunas.map((c) => (
            <span key={c.id} className={c.alinha === "dir" ? "text-right" : undefined}>
              {cabecalho ? cabecalho(c) : c.label}
            </span>
          ))}
        </div>

        {carregando ? (
          <SkeletonLinhas linhas={8} colunas={Math.min(colunas.length, 6)} />
        ) : semLinhas && vazio ? (
          <EmptyState
            filtrado={vazio.filtrado}
            titulo={vazio.titulo}
            descricao={vazio.descricao}
            acao={vazio.acao}
          />
        ) : (
          children
        )}

        {rodape && (
          <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-1 border-t border-line px-4 py-3 text-sm">
            {rodape}
          </div>
        )}
      </div>
    </div>
  );
}

/** Uma linha da tabela, com a mesma grade do cabeçalho. */
export function LinhaTabela({
  gridTemplate,
  emFoco = false,
  selecionada = false,
  onClick,
  className = "",
  children,
  ...rest
}: {
  gridTemplate: string;
  emFoco?: boolean;
  selecionada?: boolean;
  /*
    Recebe o evento: a `div` o entrega de qualquer jeito, e quem decide se o
    clique abre precisa dele para saber ONDE se clicou. Tipar como `() => void`
    escondia isso — o handler recebia o evento em runtime e o TypeScript dizia
    que não havia nenhum, então a guarda de "clicou no checkbox, não abre"
    parecia impossível de escrever.
  */
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
  children: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "onClick" | "className">) {
  return (
    <div
      onClick={onClick}
      style={{ gridTemplateColumns: gridTemplate }}
      className={[
        "grid items-center gap-3 border-b border-line px-4 py-2.5 text-sm last:border-b-0",
        onClick ? "cursor-pointer" : "",
        // foco de teclado e seleção são estados diferentes: um diz "onde estou",
        // o outro "o que vai ser afetado". Empilhados, precisam continuar
        // distinguíveis — daí anel para foco e fundo para seleção.
        emFoco ? "ring-2 ring-inset ring-brand/40" : "",
        selecionada ? "bg-brand-light/40" : "hover:bg-surface/60",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}

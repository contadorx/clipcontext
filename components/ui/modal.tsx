"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Moldura de diálogo.
 *
 * Dois problemas que isto resolve:
 *
 * 1. O véu tinha quatro cores diferentes pelo app (`bg-rail/50`, `bg-ink/30`,
 *    `bg-ink/40`, `bg-black/40`). Abrir dois diálogos seguidos mudava o tom do
 *    fundo, o que faz parecer que são partes de sistemas diferentes.
 *
 * 2. Esc e o clique no véu fechavam direto, jogando fora o que tinha sido
 *    digitado. Com `sujo`, os dois caminhos passam a pedir confirmação — e só
 *    quando há de fato algo a perder.
 */
export const VEU = "fixed inset-0 z-50 bg-rail/50 backdrop-blur-[1px]";

/**
 * Detecta que o formulário foi mexido, sem tocar em cada campo.
 *
 * `onChange` no contêiner captura os eventos de todos os inputs, selects e
 * textareas de dentro — eles borbulham. Comparar quarenta estados com um
 * retrato inicial daria o mesmo resultado com quarenta vezes mais código, e
 * quebraria silenciosamente toda vez que alguém acrescentasse um campo.
 *
 * `chaveReset` zera a marca: passe o `aberto` do diálogo (ou o id em edição),
 * porque preencher os campos ao abrir não é o usuário mexendo.
 */
export function useSujo(chaveReset?: unknown) {
  const [sujo, setSujo] = useState(false);
  useEffect(() => {
    setSujo(false);
  }, [chaveReset]);

  return {
    sujo,
    limpar: () => setSujo(false),
    /** espalhe no contêiner do formulário: <div {...campos}> */
    campos: { onChange: () => setSujo(true) },
    /** true = pode fechar */
    confirmar: () => !sujo || confirm("Há alterações não salvas. Descartar?"),
  };
}

export function useGuardaSaida({
  sujo,
  onFechar,
  ativo = true,
}: {
  sujo: boolean;
  onFechar: () => void;
  ativo?: boolean;
}) {
  const sujoRef = useRef(sujo);
  sujoRef.current = sujo;

  const tentarFechar = () => {
    if (sujoRef.current && !confirm("Há alterações não salvas. Descartar?")) return;
    onFechar();
  };

  useEffect(() => {
    if (!ativo) return;
    const h = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (sujoRef.current && !confirm("Há alterações não salvas. Descartar?")) return;
      onFechar();
    };
    /*
      Fase de CAPTURA, e isso não é detalhe.

      O `GuardaDialogo` global escuta Esc no `document` (fase de bolha) e, se o
      evento ainda não foi tratado, **clica no botão "Fechar" da caixa**. Como
      `document` recebe o evento antes de `window`, ele fechava o diálogo antes
      deste tratador rodar — e a pergunta "Descartar?" aparecia depois, com o
      diálogo já fechado e a resposta "cancelar" sem efeito nenhum.

      Na captura, este é o primeiro a rodar: chama `preventDefault`, e o
      `GuardaDialogo` vê `defaultPrevented` e sai. Uma pergunta só, feita por
      quem sabe se há algo a perder.
    */
    window.addEventListener("keydown", h, true);
    return () => window.removeEventListener("keydown", h, true);
  }, [ativo, onFechar]);

  return tentarFechar;
}

export default function Modal({
  rotulo,
  aberto = true,
  onFechar,
  sujo = false,
  largura = "max-w-lg",
  /** rola a página inteira em vez de travar o diálogo na altura da tela */
  rolagem = false,
  children,
}: {
  /**
   * Como o diálogo se chama. Obrigatório: sem isto o leitor de tela anuncia
   * "diálogo" e nada mais, e o GuardaDialogo não distingue esta caixa de outra.
   * Uma moldura genérica não tem cabeçalho próprio para apontar, então o nome
   * vem de fora.
   *
   * Inclua a identidade do registro quando houver uma. Rótulo fixo ("Conta
   * bancária") num app onde a pessoa abre quarenta linhas iguais tira do leitor
   * de tela a única informação que diz QUAL delas foi aberta — informação que o
   * `aria-labelledby` do título dinâmico dava antes.
   */
  rotulo: string;
  aberto?: boolean;
  onFechar: () => void;
  sujo?: boolean;
  largura?: string;
  rolagem?: boolean;
  children: React.ReactNode;
}) {
  const tentarFechar = useGuardaSaida({ sujo, onFechar, ativo: aberto });
  if (!aberto) return null;

  return (
    <div
      /*
        `items-start justify-center` também no modo rolagem.

        Sem eles valem os padrões do flex: `justify-content: flex-start` cola a
        caixa na borda esquerda, e `align-items: stretch` a estica até a altura
        do véu — um diálogo de 300px vira uma faixa branca de tela inteira com
        os botões no meio do nada. O modo sem rolagem já centralizava; o outro
        nasceu torto e só tinha um consumidor para mostrar.
      */
      className={`${VEU} flex justify-center ${rolagem ? "items-start overflow-y-auto p-4" : "items-center p-4"}`}
      onClick={tentarFechar}
    >
      {/* o papel de diálogo é da caixa, não do véu: o véu é a área de fora */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={rotulo}
        className={`${rolagem ? "my-8 " : ""}w-full ${largura} rounded-xl2 bg-white shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

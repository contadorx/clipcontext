"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Navegar uma lista pelo teclado e abrir o item pela linha inteira.
 *
 * Movimentações era a única tela do app com isto, e a diferença aparecia no uso:
 * nas outras, a única porta para o objeto é um ícone de 32px na ponta direita da
 * linha — alvo pequeno, invisível para quem não sabe que ele existe, e nada
 * sugere que a linha inteira representa uma coisa que dá para abrir.
 *
 * Este hook é a extração daquele comportamento, para que as sete listas não
 * divirjam. A lição é a mesma da `FooterBar` e do `Modal`: o que cada consumidor
 * reimplementa por conta própria acaba diferente em cada tela, e o conserto de
 * um bug vira sete consertos.
 *
 * ## O foco acompanha o ITEM, não a posição
 *
 * A versão de Movimentações guardava o índice. Com índice, filtrar ou reordenar
 * a lista mantém o realce na terceira linha — que agora é outro registro. A
 * pessoa aperta Enter esperando abrir o que estava destacado e abre outra coisa.
 * Aqui o estado é o `id`; a posição é derivada. Se o item sair do filtro, o foco
 * some (em vez de escorregar para um vizinho), que é o comportamento honesto.
 *
 * ## Uma lista navegável por tela
 *
 * O listener é global (`window`), então duas instâncias montadas ao mesmo tempo
 * respondem à MESMA seta e o foco anda nas duas — com o Enter abrindo o item de
 * uma delas, sem regra visível de qual. O Fluxo de caixa é assim (duas tabelas
 * na mesma página, "vencido em aberto" e "agendamentos futuros") e por isso
 * ficou de fora desta rodada: escolher qual das duas manda é decisão de
 * produto, não varredura.
 *
 * Em desenvolvimento, montar a segunda instância imprime um aviso — porque o
 * sintoma (a seta mexendo em duas listas) é fácil de não perceber e difícil de
 * atribuir depois.
 *
 * ## O que este hook NÃO faz
 *
 * Não remove o botão explícito de abrir. A linha clicável é atalho, não a única
 * porta: quem navega por Tab, quem usa leitor de tela e quem está no celular
 * continuam precisando de um alvo com nome acessível. Tela que trocar o botão
 * por "clique na linha" fica inalcançável para essas três pessoas.
 */

export type ItemNavegavel = { id: string };

type Opcoes<T extends ItemNavegavel> = {
  /** A lista JÁ na ordem e no filtro que a tela mostra. */
  itens: T[];
  /** O que "abrir" significa nesta tela: página do objeto, diálogo, o que for. */
  abrir?: (item: T) => void;
  /** Espaço marca/desmarca. Sem isto, o teclado percorre mas não monta lote. */
  aoMarcar?: (item: T) => void;
  /** Tecla N. */
  aoNovo?: () => void;
  /** Tecla "/" leva o cursor para a busca da tela. */
  buscaRef?: React.RefObject<HTMLInputElement>;
  /**
   * Desliga o teclado — diálogo aberto, por exemplo. O atalho global roubaria
   * as setas de dentro do formulário.
   */
  desligado?: boolean;
};

/** Quantas instâncias estão montadas — só para o aviso de desenvolvimento. */
let montadas = 0;

export function useListaNavegavel<T extends ItemNavegavel>({
  itens,
  abrir,
  aoMarcar,
  aoNovo,
  buscaRef,
  desligado = false,
}: Opcoes<T>) {
  const [focoId, setFocoId] = useState<string | null>(null);

  /* Posição derivada do id. -1 quando o item saiu do filtro ou nada tem foco. */
  const foco = useMemo(
    () => (focoId ? itens.findIndex((i) => i.id === focoId) : -1),
    [itens, focoId],
  );

  /*
    Refs para o handler não precisar de todas as dependências.

    Sem isto, o `useEffect` do teclado remonta a cada render (a lista é novo
    array toda vez que um filtro muda), e remontar listener em lista grande é
    trabalho por tecla digitada em outro lugar da tela.
  */
  const ref = useRef({ itens, foco, abrir, aoMarcar, aoNovo, buscaRef, desligado });
  ref.current = { itens, foco, abrir, aoMarcar, aoNovo, buscaRef, desligado };

  /* Leva a linha em foco para a área visível — sem isto, ↓ além da dobra não
     mostra nada e parece que a tecla não funcionou. */
  const rolarAte = useCallback((id: string) => {
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-linha-id="${CSS.escape(id)}"]`)
        ?.scrollIntoView({ block: "nearest" });
    });
  }, []);

  const mover = useCallback(
    (passo: 1 | -1) => {
      const { itens: lista, foco: atual } = ref.current;
      if (lista.length === 0) return;
      const proximo =
        atual < 0 ? (passo === 1 ? 0 : lista.length - 1) : Math.min(Math.max(atual + passo, 0), lista.length - 1);
      const item = lista[proximo];
      if (!item) return;
      setFocoId(item.id);
      rolarAte(item.id);
    },
    [rolarAte],
  );

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      montadas += 1;
      if (montadas > 1) {
        console.warn(
          `useListaNavegavel: ${montadas} listas navegáveis montadas ao mesmo tempo. ` +
            "O listener é global — as setas vão mover o foco em todas elas. " +
            "Use `desligado` para deixar só uma ativa por vez.",
        );
      }
      return () => {
        montadas -= 1;
      };
    }
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const r = ref.current;
      if (r.desligado) return;

      /*
        Quem está digitando é dono das próprias teclas.

        Sem esta guarda, ↓ dentro de um campo de busca move a lista atrás em vez
        de o cursor, e "n" no meio de uma descrição abre o formulário de novo
        registro com o que estava sendo escrito perdido.
      */
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      const digitando =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || Boolean(el?.isContentEditable);

      /*
        Botão ou link em foco é dono do Enter e do Espaço — são as duas teclas
        que ATIVAM um botão.

        Sem esta guarda: percorrer a lista com ↓, marcar dois itens com Espaço,
        dar Tab até "limpar seleção" e apertar Enter — o `preventDefault` daqui
        cancela o clique sintetizado, o botão não faz nada, e a lista abre o
        item em foco. O sintoma é "o botão parou de funcionar", e a causa está
        noutro arquivo.

        As SETAS continuam valendo com um botão em foco: elas não ativam nada, e
        percorrer a lista sem tirar a mão do teclado é o ponto.
      */
      const interativo =
        tag === "BUTTON" || tag === "A" || tag === "SUMMARY" || Boolean(el?.closest("[role='button']"));

      /*
        Só engole o "/" se houver busca para focar. Telas sem campo de busca
        (Contas) chamavam `preventDefault` e não faziam nada — matando de quebra
        o "localizar rápido" do Firefox, que também usa "/".
      */
      if (e.key === "/" && !digitando && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const campo = r.buscaRef?.current;
        if (!campo) return;
        e.preventDefault();
        campo.focus();
        return;
      }
      if (digitando || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        mover(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        mover(-1);
      } else if (e.key === "Enter" && r.foco >= 0 && !interativo) {
        const item = r.itens[r.foco];
        if (item && r.abrir) {
          e.preventDefault();
          r.abrir(item);
        }
      } else if (e.key === " " && r.foco >= 0 && !interativo) {
        const item = r.itens[r.foco];
        if (item && r.aoMarcar) {
          e.preventDefault();
          r.aoMarcar(item);
        }
      } else if ((e.key === "n" || e.key === "N") && r.aoNovo) {
        e.preventDefault();
        r.aoNovo();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mover]);

  /**
   * Props da linha: realce, clique que abre, e a âncora que a rolagem procura.
   *
   * Função comum, e não `useCallback`: `abrir` é uma arrow inline em quase toda
   * tela, então a dependência mudava a cada render e o cache nunca acertava —
   * pagava-se a comparação para não guardar nada. Pior que o custo era o
   * recado: `useCallback` diz a quem lê "isto é estável", e não era.
   *
   * O clique tem duas guardas que parecem detalhe e não são:
   *
   *  - **Seleção de texto.** Sem conferir, copiar um valor da linha (arrastar e
   *    soltar) dispara o clique e a tela troca — o dado que a pessoa ia colar
   *    some junto com a página.
   *  - **Alvo interativo.** Checkbox, botão e link dentro da linha precisam
   *    fazer o que prometem. A guarda sobe pelo `closest`, então funciona
   *    inclusive quando o clique acerta o `<path>` do ícone dentro do botão.
   *    Telas antigas ainda têm `stopPropagation` célula a célula; as duas
   *    proteções convivem sem conflito, e a daqui é a que vale para tela nova.
   *    `LinhaTabela` (`components/ui/tabela.tsx`) tem o próprio `onClick` e
   *    NÃO passa por aqui — quem usar as duas peças juntas precisa combinar na
   *    mão até elas convergirem.
   */
  const propsLinha = ((item: T) => ({
      "data-linha-id": item.id,
      emFoco: focoId === item.id,
      onClick: (e?: React.MouseEvent) => {
        if (!abrir) return;
        if (e) {
          const alvo = e.target as HTMLElement | null;
          if (alvo?.closest("a, button, input, select, textarea, [role='button']")) return;
        }
        if (window.getSelection()?.toString()) return;
        setFocoId(item.id);
        abrir(item);
      },
    }));

  return { foco, focoId, setFocoId, propsLinha };
}

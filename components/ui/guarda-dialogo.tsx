"use client";

import { useEffect } from "react";

/**
 * Comportamento de diálogo para o app inteiro, montado uma vez.
 *
 * Os 32 diálogos do app foram escritos cada um do seu jeito, com o estado de
 * abertura numa variável diferente em cada tela. Fazer cada um chamar um hook
 * exigiria mexer em 25 arquivos e acertar 32 pares de "quem abre / quem fecha".
 *
 * Aqui o caminho é outro: os diálogos só declaram *o que são*
 * (`role="dialog" aria-modal="true"`), e este componente cuida do
 * comportamento observando o DOM. As quatro coisas que faltavam:
 *
 * 1. **Prender o foco.** Sem isso, Tab dentro de um diálogo sai visitando os
 *    links da tela de trás — que está coberta pelo véu. Quem navega por teclado
 *    fica preso num lugar que não consegue ver.
 * 2. **Levar o foco para dentro ao abrir.** Sem isso o foco continua no botão
 *    que abriu, atrás do véu, e o leitor de tela segue lendo a página antiga.
 * 3. **Devolver o foco ao gatilho ao fechar.** Sem isso, fechar joga o foco
 *    para o começo da página e a navegação recomeça do zero.
 * 4. **Fechar com Esc.** Só 16 dos 34 diálogos tratavam Escape. Aqui o Esc
 *    aciona o botão de fechar do diálogo do topo — e não um `onFechar`
 *    genérico — para passar pela mesma confirmação de alterações não salvas.
 *
 * Quando há diálogos empilhados, vale sempre o último do DOM.
 *
 * ## Remontagem
 *
 * Este arquivo detecta "abriu" comparando a *identidade do nó* do diálogo. Isso
 * confunde abrir com remontar: quando o React troca o nó por um novo — o que
 * acontece sozinho se alguém definir um componente dentro do corpo de render de
 * outro — o guarda via um diálogo novo, não encontrava foco dentro dele e
 * mandava o cursor para o primeiro focável, que quase sempre é o "Fechar".
 *
 * O efeito prático era um bug que parecia impossível: **o campo de texto
 * aceitava só uma letra**. A tecla remontava o diálogo, o cursor pulava para o
 * botão, e a segunda tecla não chegava mais no campo.
 *
 * A causa raiz é a remontagem e ela se conserta no componente que remonta. Mas
 * o guarda não pode ser o amplificador: agora ele distingue remontagem de
 * abertura e, quando é remontagem, devolve o cursor para o mesmo campo, na
 * mesma posição do texto.
 */
const FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const SELETOR = '[role="dialog"][aria-modal="true"]';

function dialogoAtivo(): HTMLElement | null {
  const todos = document.querySelectorAll<HTMLElement>(SELETOR);
  return todos.length ? todos[todos.length - 1] : null;
}

function focaveis(caixa: HTMLElement): HTMLElement[] {
  return Array.from(caixa.querySelectorAll<HTMLElement>(FOCAVEIS)).filter(
    // offsetParent nulo = escondido; o elemento em foco entra mesmo assim,
    // senão a conta quebra no meio de uma transição
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

/**
 * O que identifica um diálogo *entre nós diferentes*. Depois de uma remontagem
 * o nó é outro, mas o JSX é o mesmo — então o rótulo é igual.
 *
 * Todos os 35 diálogos do app declaram um dos três: quase todos apontam o
 * próprio cabeçalho com `aria-labelledby`, e os três que não têm cabeçalho
 * usam `aria-label`. Ainda assim este sinal não decide sozinho — um diálogo
 * novo pode nascer sem rótulo. Ver `ehRemontagem`, que soma três.
 */
function chave(caixa: HTMLElement): string {
  return (
    caixa.getAttribute("aria-label") ||
    caixa.getAttribute("aria-labelledby") ||
    caixa.getAttribute("data-dialogo") ||
    ""
  );
}

/**
 * Como reencontrar, na caixa nova, o campo que estava em foco na velha.
 *
 * `id`/`name` seriam o caminho direto, mas quase nenhum campo do app tem um dos
 * dois — então o que sustenta o reencontro é a posição **entre os controles do
 * mesmo tipo**. Deliberadamente não é a posição na ordem de tabulação: aquela
 * conta muda quando um botão aparece, some ou fica desabilitado, e o cursor
 * acabaria num controle vizinho.
 */
type Marca = { direto: string | null; tag: string; tipo: string; ordem: number };

function iguais(el: Element, tag: string, tipo: string): boolean {
  return el.tagName.toLowerCase() === tag && (!tipo || (el as HTMLInputElement).type === tipo);
}

function marcaDe(caixa: HTMLElement, el: HTMLElement): Marca {
  const escapavel = typeof CSS !== "undefined" && typeof CSS.escape === "function";
  const nome = el.getAttribute("name");
  const direto = !escapavel
    ? null
    : el.id
      ? `#${CSS.escape(el.id)}`
      : nome
        ? `[name="${CSS.escape(nome)}"]`
        : null;
  const tag = el.tagName.toLowerCase();
  // `input` sem atributo `type` responde `"text"` na propriedade, então o filtro
  // fica em JS: o seletor `input[type="text"]` não casaria com ele.
  const tipo = tag === "input" ? (el as HTMLInputElement).type : "";
  const ordem = Array.from(caixa.querySelectorAll(tag)).filter((e) => iguais(e, tag, tipo)).indexOf(el);
  return { direto, tag, tipo, ordem };
}

export default function GuardaDialogo() {
  useEffect(() => {
    let abertoAgora: HTMLElement | null = null;
    let chaveAberta = "";
    let gatilho: HTMLElement | null = null;

    // Último elemento que teve foco dentro de um diálogo, e sua posição na
    // ordem de tabulação. O índice é calculado agora, com a caixa ainda no
    // documento: depois de destacada, `offsetParent` é nulo em tudo e a conta
    // daria zero focáveis.
    let ultimoFoco: HTMLElement | null = null;
    let ultimaMarca: Marca | null = null;
    let quantos = document.querySelectorAll(SELETOR).length;

    function aoFocar(e: FocusEvent) {
      const alvo = e.target as HTMLElement | null;
      if (!alvo || typeof alvo.closest !== "function") return;
      const caixa = alvo.closest<HTMLElement>(SELETOR);
      if (!caixa) return;
      ultimoFoco = alvo;
      ultimaMarca = marcaDe(caixa, alvo);
    }
    document.addEventListener("focusin", aoFocar, true);

    /**
     * Devolve o cursor ao campo equivalente depois de uma remontagem. O nó
     * antigo, já fora da árvore, ainda guarda `value` e `selectionStart` — é
     * de lá que sai a posição do cursor.
     */
    function restaurar(caixa: HTMLElement): boolean {
      const anterior = ultimoFoco;
      const marca = ultimaMarca;
      if (!anterior || !marca) return false;

      let alvo: HTMLElement | null = null;
      if (marca.direto) alvo = caixa.querySelector<HTMLElement>(marca.direto);
      if (!alvo && marca.ordem >= 0) {
        const iguaisNaCaixa = Array.from(caixa.querySelectorAll<HTMLElement>(marca.tag)).filter((e) =>
          iguais(e, marca.tag, marca.tipo),
        );
        alvo = iguaisNaCaixa[marca.ordem] ?? null;
      }
      if (!alvo) return false;

      const de = anterior as HTMLInputElement;
      const para = alvo as HTMLInputElement;

      // Última prova de que é o mesmo campo, e não um campo parecido de outro
      // diálogo: numa remontagem o React redesenha com o mesmo estado, então o
      // conteúdo bate. Entre diálogos diferentes, quase nunca bate.
      if (typeof de.value === "string" && typeof para.value === "string" && de.value !== para.value) {
        return false;
      }

      alvo.focus();

      if (typeof de.selectionStart === "number" && typeof para.setSelectionRange === "function") {
        try {
          // `setSelectionRange` lança em number/email/date — tipos que não têm
          // seleção. Não é erro, é só um campo onde não há cursor a devolver.
          para.setSelectionRange(de.selectionStart, de.selectionEnd ?? de.selectionStart);
        } catch {
          /* campo sem seleção posicionável */
        }
      }
      ultimoFoco = alvo;
      ultimaMarca = marcaDe(caixa, alvo);
      return true;
    }

    function aoAbrir(caixa: HTMLElement, remontagem: boolean) {
      abertoAgora = caixa;
      chaveAberta = chave(caixa);

      if (remontagem) {
        // Sem esperar: o `MutationObserver` roda como microtarefa, logo depois
        // do commit do React e antes do próximo evento de teclado. Devolver o
        // foco aqui não perde nenhuma tecla; devolver dentro de um `setTimeout`
        // de 30 ms perderia tudo o que fosse digitado no intervalo.
        //
        // O `autoFocus` aqui é justamente o problema a evitar: ele mandaria o
        // cursor para o primeiro campo, não para onde a pessoa estava digitando.
        if (restaurar(caixa)) return;
      } else {
        // o foco atual é de quem clicou para abrir — guarda para devolver depois
        const ativo = document.activeElement as HTMLElement | null;
        // numa remontagem o ativo é o `body`, e guardá-lo faria o fechamento
        // devolver o foco para lugar nenhum
        if (ativo && ativo !== document.body && !caixa.contains(ativo)) gatilho = ativo;
        ultimoFoco = null;
        ultimaMarca = null;
      }

      // dá um quadro para os campos com autoFocus se resolverem antes
      setTimeout(() => {
        if (caixa.contains(document.activeElement)) return;
        const alvo = focaveis(caixa)[0];
        if (alvo) alvo.focus();
        else {
          caixa.tabIndex = -1;
          caixa.focus();
        }
      }, 30);
    }

    function aoFechar() {
      abertoAgora = null;
      chaveAberta = "";
      ultimoFoco = null;
      ultimaMarca = null;
      const g = gatilho;
      gatilho = null;
      // focar um elemento que saiu da árvore é ruído — confere antes
      if (g && document.contains(g)) g.focus();
    }

    /**
     * Remontagem é o React trocando o nó do mesmo diálogo. Três sinais somados,
     * porque nenhum decide sozinho:
     *
     * 1. o nó anterior saiu do documento — sozinho, isto também é verdade quando
     *    um diálogo fecha e outro abre no mesmo commit;
     * 2. a quantidade de diálogos não mudou — separa remontagem de fechar um
     *    diálogo empilhado, que revelaria o de baixo;
     * 3. o rótulo bate — vale só para o diálogo que tem `aria-label`; nos outros
     *    é `"" === ""` e a decisão fica com os dois primeiros, mais a conferência
     *    de conteúdo do campo dentro de `restaurar`.
     */
    function ehRemontagem(atual: HTMLElement, contagem: number): boolean {
      return (
        abertoAgora !== null &&
        !document.contains(abertoAgora) &&
        contagem === quantos &&
        chave(atual) === chaveAberta
      );
    }

    const obs = new MutationObserver(() => {
      const contagem = document.querySelectorAll(SELETOR).length;
      const atual = dialogoAtivo();
      if (atual && atual !== abertoAgora) {
        const remontagem = ehRemontagem(atual, contagem);
        quantos = contagem;
        aoAbrir(atual, remontagem);
      } else if (!atual && abertoAgora) {
        quantos = contagem;
        aoFechar();
      } else {
        quantos = contagem;
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });

    // já pode haver um diálogo aberto na montagem (navegação direta com estado)
    const inicial = dialogoAtivo();
    if (inicial) aoAbrir(inicial, false);

    function onEsc(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      const caixa = dialogoAtivo();
      if (!caixa) return;
      // Algumas telas já tratam Esc por conta própria (o `Modal` e o modal de
      // lançamento, que escutam na fase de CAPTURA justamente para chegar
      // antes daqui). Se o evento já foi tratado, sai — e é assim que a guarda
      // de "alterações não salvas" delas continua sendo a única a perguntar.
      if (e.defaultPrevented) return;

      // O botão de fechar é o caminho: ele é quem sabe se há alteração não
      // salva a confirmar. Chamar um `onFechar` genérico daqui pularia essa
      // guarda e jogaria fora o que a pessoa digitou.
      const fechar = caixa.querySelector<HTMLElement>(
        '[data-fechar], [aria-label="Fechar"], [aria-label="Cancelar"], [aria-label="Cancelar edição"]',
      );
      if (fechar) {
        e.preventDefault();
        fechar.click();
      }
    }
    document.addEventListener("keydown", onEsc);

    function onKey(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const caixa = dialogoAtivo();
      if (!caixa) return;
      const itens = focaveis(caixa);
      if (itens.length === 0) {
        e.preventDefault();
        caixa.tabIndex = -1;
        caixa.focus();
        return;
      }
      const primeiro = itens[0];
      const ultimo = itens[itens.length - 1];
      const ativo = document.activeElement;
      if (e.shiftKey && (ativo === primeiro || !caixa.contains(ativo))) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && (ativo === ultimo || !caixa.contains(ativo))) {
        e.preventDefault();
        primeiro.focus();
      }
    }
    // captura: chega antes dos handlers das telas
    document.addEventListener("keydown", onKey, true);

    return () => {
      obs.disconnect();
      document.removeEventListener("focusin", aoFocar, true);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  return null;
}

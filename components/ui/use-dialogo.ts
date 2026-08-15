"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Comportamento de diálogo, sem reescrever a marcação de 32 telas.
 *
 * Faz as quatro coisas que faltavam em todos eles:
 *
 * 1. **Prende o foco.** Sem isso, Tab dentro de um diálogo vai visitando os
 *    links da tela de trás — que está visualmente coberta pelo véu. Quem navega
 *    por teclado fica preso num lugar que não consegue ver.
 * 2. **Leva o foco para dentro ao abrir**, no primeiro campo (ou no próprio
 *    diálogo). Sem isso o foco continua no botão que abriu, atrás do véu.
 * 3. **Devolve o foco ao gatilho ao fechar.** Sem isso, fechar um diálogo joga
 *    o foco para o começo da página e a pessoa recomeça a navegação.
 * 4. **Anuncia como diálogo** (`role="dialog"` + `aria-modal`), para que o
 *    leitor de tela pare de ler a tela de trás.
 *
 * Uso:
 *
 *   const dlg = useDialogo(aberto, () => setAberto(false));
 *   ...
 *   <div className={VEU} onClick={dlg.aoClicarVeu}>
 *     <div {...dlg.props} onClick={(e) => e.stopPropagation()}>…</div>
 *   </div>
 *
 * `rotulo` vira o `aria-label` do diálogo — o leitor de tela anuncia isso ao
 * entrar, então vale escrever o mesmo texto do título visível.
 */
const FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useDialogo(
  aberto: boolean,
  onFechar: () => void,
  opts: { rotulo?: string; focoInicial?: boolean } = {},
) {
  const { rotulo, focoInicial = true } = opts;
  const caixaRef = useRef<HTMLDivElement | null>(null);
  const gatilhoRef = useRef<HTMLElement | null>(null);

  // guarda quem tinha o foco antes de abrir, para devolver depois
  useEffect(() => {
    if (!aberto) return;
    gatilhoRef.current = document.activeElement as HTMLElement | null;
    return () => {
      // `focus` num elemento que saiu da árvore é ruído: confere antes
      const g = gatilhoRef.current;
      if (g && document.contains(g)) g.focus();
    };
  }, [aberto]);

  // foco inicial dentro do diálogo
  useEffect(() => {
    if (!aberto || !focoInicial) return;
    const t = setTimeout(() => {
      const caixa = caixaRef.current;
      if (!caixa) return;
      // se algum campo já pediu autoFocus, respeita
      if (caixa.contains(document.activeElement)) return;
      const primeiro = caixa.querySelector<HTMLElement>(FOCAVEIS);
      (primeiro ?? caixa).focus();
    }, 30);
    return () => clearTimeout(t);
  }, [aberto, focoInicial]);

  // armadilha de Tab
  useEffect(() => {
    if (!aberto) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const caixa = caixaRef.current;
      if (!caixa) return;
      const itens = Array.from(caixa.querySelectorAll<HTMLElement>(FOCAVEIS)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (itens.length === 0) {
        e.preventDefault();
        caixa.focus();
        return;
      }
      const primeiro = itens[0];
      const ultimo = itens[itens.length - 1];
      const ativo = document.activeElement;
      if (e.shiftKey && (ativo === primeiro || !caixa.contains(ativo))) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && ativo === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [aberto]);

  const aoClicarVeu = useCallback(
    (e: React.MouseEvent) => {
      // só fecha se o clique foi no véu mesmo, não em algo que borbulhou de dentro
      if (e.target === e.currentTarget) onFechar();
    },
    [onFechar],
  );

  return {
    props: {
      ref: caixaRef,
      role: "dialog" as const,
      "aria-modal": true,
      "aria-label": rotulo,
      tabIndex: -1,
    },
    aoClicarVeu,
  };
}

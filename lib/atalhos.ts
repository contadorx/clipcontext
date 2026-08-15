import { useEffect } from "react";

/**
 * Atalhos padrão de modal/diálogo:
 *  - Esc        → onFechar
 *  - Ctrl/⌘+Enter → onConfirmar
 * Só ativos quando `aberto` é true. Esc e Ctrl+Enter disparam mesmo com o foco
 * num campo (comportamento esperado de formulário em diálogo).
 */
export function useAtalhosModal(
  aberto: boolean,
  opts: { onFechar?: () => void; onConfirmar?: () => void },
) {
  const { onFechar, onConfirmar } = opts;
  useEffect(() => {
    if (!aberto) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onFechar?.();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        if (onConfirmar) {
          e.preventDefault();
          onConfirmar();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aberto, onFechar, onConfirmar]);
}

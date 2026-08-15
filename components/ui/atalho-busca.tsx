"use client";

import { Search } from "lucide-react";

/**
 * Campo de busca da shell bar. Não busca aqui: abre o command palette (⌘K),
 * que já faz busca de verdade no banco e executa comandos.
 */
export default function AtalhoBusca() {
  function abrir() {
    window.dispatchEvent(new CustomEvent("fs-abrir-busca"));
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="hidden h-8 min-w-[220px] items-center gap-2 rounded-md border border-line px-2.5 text-[12.5px] text-ink-soft transition hover:border-brand hover:text-ink-muted lg:flex"
      >
        <Search size={14} />
        <span className="flex-1 text-left">Buscar ou executar…</span>
        <kbd className="rounded border border-line px-1.5 text-[10px] font-semibold text-ink-soft">⌘K</kbd>
      </button>
      <button
        type="button"
        onClick={abrir}
        title="Buscar (⌘K)"
        className="flex h-8 w-8 items-center justify-center rounded-md text-ink-muted transition hover:bg-surface hover:text-ink lg:hidden"
      >
        <Search size={16} />
      </button>
    </>
  );
}

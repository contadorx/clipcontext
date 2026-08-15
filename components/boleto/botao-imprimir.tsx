"use client";

import { Printer } from "lucide-react";

export default function BotaoImprimir() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="flex items-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
    >
      <Printer size={15} /> Imprimir / salvar PDF
    </button>
  );
}

"use client";

import { Download } from "lucide-react";

export default function BaixarCsv({ nome }: { nome: string }) {
  function baixar() {
    const tabela =
      (document.querySelector("main table") as HTMLTableElement | null) ??
      (document.querySelector("table") as HTMLTableElement | null);
    if (!tabela) return;

    const linhas: string[] = [];
    for (const tr of Array.from(tabela.querySelectorAll("tr"))) {
      const celulas = Array.from(tr.querySelectorAll("th,td")).map((c) => {
        let t = (c.textContent ?? "").replace(/\s+/g, " ").trim();
        if (/[";\n]/.test(t)) t = '"' + t.replace(/"/g, '""') + '"';
        return t;
      });
      if (celulas.length) linhas.push(celulas.join(";"));
    }
    if (!linhas.length) return;

    // BOM para o Excel abrir acentos corretamente; ";" como separador (padrão pt-BR).
    const csv = "\ufeff" + linhas.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nome}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={baixar}
      className="flex shrink-0 items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[12.5px] font-medium text-ink-muted transition hover:border-brand hover:text-brand"
    >
      <Download size={15} /> Baixar CSV
    </button>
  );
}

"use client";

import { useState } from "react";
import { Tags, Layers } from "lucide-react";
import OrcamentoEditor from "@/components/cadastros/orcamento-editor";
import OrcamentoCcEditor from "@/components/cadastros/orcamento-cc-editor";

type Categoria = { id: string; nome: string; grupo_id: string; tipo: string };
type Grupo = { id: string; nome: string; ordem: number };
type Centro = { id: string; nome: string };

export default function OrcamentoTabs({
  empresaId,
  grupos,
  categorias,
  centros,
}: {
  empresaId: string;
  grupos: Grupo[];
  categorias: Categoria[];
  centros: Centro[];
}) {
  const [aba, setAba] = useState<"categoria" | "centro">("categoria");

  return (
    <div className="space-y-5">
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => setAba("categoria")}
          className={
            aba === "categoria"
              ? "flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white"
              : "flex items-center gap-1.5 rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-muted transition hover:bg-surface"
          }
        >
          <Tags size={15} /> Por categoria
        </button>
        <button
          type="button"
          onClick={() => setAba("centro")}
          className={
            aba === "centro"
              ? "flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white"
              : "flex items-center gap-1.5 rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-muted transition hover:bg-surface"
          }
        >
          <Layers size={15} /> Por centro de custo
        </button>
      </div>

      {aba === "categoria" ? (
        <OrcamentoEditor empresaId={empresaId} grupos={grupos} categorias={categorias} />
      ) : (
        <OrcamentoCcEditor empresaId={empresaId} centros={centros} />
      )}
    </div>
  );
}

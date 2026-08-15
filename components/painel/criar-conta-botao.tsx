"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import ContaModal from "./conta-modal";

export default function CriarContaBotao({
  empresaId,
  variante = "primario",
  children,
}: {
  empresaId: string;
  variante?: "primario" | "link";
  children?: React.ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const router = useRouter();

  const cls =
    variante === "link"
      ? "font-semibold text-brand"
      : "flex items-center gap-1.5 rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-brand-dark";

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className={cls}>
        {children ?? (
          <>
            <Plus size={14} /> Nova conta
          </>
        )}
      </button>
      <ContaModal
        aberto={aberto}
        empresaId={empresaId}
        onFechar={() => setAberto(false)}
        onSalvo={() => {
          setAberto(false);
          router.refresh();
        }}
      />
    </>
  );
}

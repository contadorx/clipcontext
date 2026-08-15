"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import LancamentoModal, { type Tipo } from "@/components/lancamentos/lancamento-modal";

function emitirMudanca() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("fs-mov-changed"));
}

export default function NovoLancamento({
  empresaId,
  variant = "button",
  onSalvo,
}: {
  empresaId: string;
  variant?: "button" | "launcher";
  onSalvo?: () => void;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [tipoInicial, setTipoInicial] = useState<Tipo>("saida");

  // No menu, o botão "Novo lançamento" dispara este evento.
  useEffect(() => {
    if (variant !== "launcher") return;
    const h = () => {
      setTipoInicial("saida");
      setAberto(true);
    };
    window.addEventListener("fs-novo-lancamento", h);
    return () => window.removeEventListener("fs-novo-lancamento", h);
  }, [variant]);

  function salvou() {
    onSalvo?.();
    router.refresh();
    emitirMudanca();
  }

  return (
    <>
      {variant === "button" && (
        <button
          type="button"
          onClick={() => {
            setTipoInicial("saida");
            setAberto(true);
          }}
          className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
        >
          <Plus size={15} /> Lançamento
        </button>
      )}

      <LancamentoModal
        empresaId={empresaId}
        aberto={aberto}
        tipo={tipoInicial}
        onFechar={() => setAberto(false)}
        onSalvo={salvou}
      />
    </>
  );
}

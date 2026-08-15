"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import LancamentoModal, { type Tipo } from "@/components/lancamentos/lancamento-modal";

export default function CriarLancamentoBotao({
  empresaId,
  tipo,
  classe,
}: {
  empresaId: string;
  tipo: Tipo;
  classe: string;
}) {
  const [aberto, setAberto] = useState(false);
  const router = useRouter();

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className={classe}>
        <Plus size={14} /> Adicionar Lançamento
      </button>
      <LancamentoModal
        empresaId={empresaId}
        aberto={aberto}
        tipo={tipo}
        onFechar={() => setAberto(false)}
        onSalvo={() => {
          setAberto(false);
          router.refresh();
        }}
      />
    </>
  );
}

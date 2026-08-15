"use client";

// Compatibilidade: o modal de transferência foi unificado dentro do LancamentoModal.
// Mantido como atalho fino para não quebrar imports antigos.
import LancamentoModal from "@/components/lancamentos/lancamento-modal";

export default function TransferModal({
  empresaId,
  aberto,
  onFechar,
}: {
  empresaId: string;
  aberto: boolean;
  onFechar: () => void;
}) {
  return (
    <LancamentoModal
      empresaId={empresaId}
      aberto={aberto}
      tipo="transferencia"
      travar
      onFechar={onFechar}
      onSalvo={onFechar}
    />
  );
}

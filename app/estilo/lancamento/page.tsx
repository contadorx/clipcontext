"use client";

import { useState } from "react";
import { notFound } from "next/navigation";
import GuardaDialogo from "@/components/ui/guarda-dialogo";
import LancamentoModal from "@/components/lancamentos/lancamento-modal";
import { bancadaLiberada } from "@/lib/bancada";
import DadosFalsos from "@/components/bancada/dados-falsos";

/**
 * Bancada do formulário de lançamento **de verdade**.
 *
 * A `/estilo/foco` testa a mecânica do foco numa caixa sintética. Esta monta o
 * componente real, com as mesmas listas vazias que ele teria antes de o banco
 * responder — porque é nesse estado que a pessoa começa a digitar.
 */
export default function BancadaLancamento() {
  if (!bancadaLiberada()) notFound();
  const [aberto, setAberto] = useState(true);
  return (
    <DadosFalsos>
      <div className="min-h-screen bg-surface p-6">
        <GuardaDialogo />
        <button onClick={() => setAberto(true)}>abrir</button>
        <LancamentoModal
          empresaId="00000000-0000-0000-0000-000000000001"
          aberto={aberto}
          tipo="saida"
          onFechar={() => setAberto(false)}
          onSalvo={() => setAberto(false)}
        />
      </div>
    </DadosFalsos>
  );
}

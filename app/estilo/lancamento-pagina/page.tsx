"use client";

import { notFound } from "next/navigation";
import LancamentoObjeto, {
  type LancObjeto,
} from "@/components/lancamentos/lancamento-objeto";
import { bancadaLiberada } from "@/lib/bancada";
import DadosFalsos from "@/components/bancada/dados-falsos";

/**
 * Bancada da **página** do lançamento (`/movimentacoes/<id>`).
 *
 * O formulário é o mesmo do diálogo, mas a moldura é outra e o que está em volta
 * também: cabeçalho que colapsa ao rolar, navegação por âncora, seções de
 * rateio e anexos. Este caminho precisa de bancada própria porque nada dele
 * passa pelo `GuardaDialogo` — aqui não há diálogo nenhum.
 */
const LANC: LancObjeto = {
  id: "11111111-1111-1111-1111-111111111111",
  valor: 8400,
  descricao: "Aluguel",
  categoria_id: "cat-00000000-0000-0000-0000-000000000001",
  conta_id: "ct-00000000-0000-0000-0000-000000000001",
  cliente_fornecedor_id: null,
  centro_custo_id: null,
  data_competencia: "2026-08-01",
  data_vencimento: "2026-08-13",
  data_pagamento: null,
  data_agendamento: null,
  numero_documento: null,
  forma_pagamento: null,
  pagamento_dados: null,
  tipo: "saida",
  conciliado: false,
  exportado_em: null,
  recorrencia_id: null,
  transferencia: false,
  categoria_nome: "Aluguel e condomínio",
  conta_nome: "Itaú — conta corrente",
  pessoa_nome: null,
  centro_nome: null,
};

export default function BancadaLancamentoPagina() {
  if (!bancadaLiberada()) notFound();
  return (
    <DadosFalsos>
      <div className="min-h-screen bg-surface p-6">
        <LancamentoObjeto
          empresaId="00000000-0000-0000-0000-000000000001"
          lanc={LANC}
          centros={[]}
        />
      </div>
    </DadosFalsos>
  );
}

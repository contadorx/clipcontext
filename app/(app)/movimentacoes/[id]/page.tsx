import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaContext } from "@/lib/empresa";
import LancamentoObjeto, { type LancObjeto } from "@/components/lancamentos/lancamento-objeto";

export const dynamic = "force-dynamic";

/**
 * Página do lançamento — o item ganha URL própria (`/movimentacoes/<id>`).
 * Antes ele só existia dentro de um diálogo: não dava para mandar o link,
 * abrir em outra aba nem voltar pelo botão do navegador.
 */
export default async function LancamentoPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { atual } = await getEmpresaContext();

  const { data } = await supabase
    .from("lancamentos")
    .select(
      "id, tipo, valor, descricao, data_competencia, data_vencimento, data_pagamento, data_agendamento, numero_documento, forma_pagamento, pagamento_dados, categoria_id, conta_id, cliente_fornecedor_id, centro_custo_id, recorrencia_id, conciliado, transferencia, exportado_em, empresa_id, categoria:categorias(nome), conta:contas_bancarias(nome), pessoa:clientes_fornecedores(nome), centro:centros_custo(nome)",
    )
    .eq("id", params.id)
    .maybeSingle();

  // RLS já barra o que não é da carteira do usuário; aqui é só o 404 amigável.
  if (!data) notFound();

  const l = data as unknown as {
    id: string;
    tipo: "entrada" | "saida";
    valor: number;
    descricao: string | null;
    data_competencia: string;
    data_vencimento: string;
    data_pagamento: string | null;
    data_agendamento: string | null;
    numero_documento: string | null;
    forma_pagamento: string | null;
    pagamento_dados: Record<string, string> | null;
    categoria_id: string | null;
    conta_id: string | null;
    cliente_fornecedor_id: string | null;
    centro_custo_id: string | null;
    recorrencia_id: string | null;
    conciliado: boolean;
    transferencia: boolean;
    exportado_em: string | null;
    empresa_id: string;
    categoria: { nome: string } | null;
    conta: { nome: string } | null;
    pessoa: { nome: string } | null;
    centro: { nome: string } | null;
  };

  const empresaId = l.empresa_id || atual?.id || "";

  const { data: centrosRaw } = await supabase
    .from("centros_custo")
    .select("id, nome")
    .eq("empresa_id", empresaId)
    .order("nome");

  // Vizinhos na mesma ordenação da lista (vencimento desc, id desc como
  // desempate estável). Sem isto, conferir dez lançamentos seguidos custa dez
  // idas e voltas à lista — que é exatamente o que a página do objeto veio
  // resolver.
  const [antRes, proxRes] = await Promise.all([
    supabase
      .from("lancamentos")
      .select("id")
      .eq("empresa_id", empresaId)
      .or(`data_vencimento.gt.${l.data_vencimento},and(data_vencimento.eq.${l.data_vencimento},id.gt.${l.id})`)
      .order("data_vencimento", { ascending: true })
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("lancamentos")
      .select("id")
      .eq("empresa_id", empresaId)
      .or(`data_vencimento.lt.${l.data_vencimento},and(data_vencimento.eq.${l.data_vencimento},id.lt.${l.id})`)
      .order("data_vencimento", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const lanc: LancObjeto = {
    id: l.id,
    tipo: l.tipo,
    valor: l.valor,
    descricao: l.descricao,
    categoria_id: l.categoria_id,
    conta_id: l.conta_id,
    cliente_fornecedor_id: l.cliente_fornecedor_id,
    centro_custo_id: l.centro_custo_id,
    data_competencia: l.data_competencia,
    data_vencimento: l.data_vencimento,
    data_pagamento: l.data_pagamento,
    data_agendamento: l.data_agendamento,
    numero_documento: l.numero_documento,
    forma_pagamento: l.forma_pagamento,
    pagamento_dados: l.pagamento_dados,
    conciliado: l.conciliado,
    exportado_em: l.exportado_em,
    recorrencia_id: l.recorrencia_id,
    transferencia: l.transferencia,
    categoria_nome: l.categoria?.nome ?? null,
    conta_nome: l.conta?.nome ?? null,
    pessoa_nome: l.pessoa?.nome ?? null,
    centro_nome: l.centro?.nome ?? null,
  };

  return (
    <LancamentoObjeto
      empresaId={empresaId}
      lanc={lanc}
      centros={(centrosRaw as { id: string; nome: string }[]) ?? []}
      anteriorId={(antRes.data as { id: string } | null)?.id ?? null}
      proximoId={(proxRes.data as { id: string } | null)?.id ?? null}
    />
  );
}

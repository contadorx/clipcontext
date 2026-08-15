import type { SupabaseClient } from "@supabase/supabase-js";

// Competência no formato YYYY-MM (mês atual por padrão).
export function competenciaAtual(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Último dia do mês da competência, como YYYY-MM-DD.
export function ultimoDiaComp(comp: string): string {
  const ano = Number(comp.slice(0, 4));
  const mes = Number(comp.slice(5, 7));
  const d = new Date(ano, mes, 0).getDate();
  return `${comp}-${String(d).padStart(2, "0")}`;
}

type Esc = { id: string; nome?: string | null; valor_mensal?: number | null };

export type ResultadoLancamento = { lancado: boolean; motivo?: string; valor?: number };

// Lança a assinatura de UM escritório como receita na empresa Master,
// para uma competência. Idempotente: não duplica (negocio_faturamento
// tem unique(escritorio_id, competencia)). Usado pela API manual de
// negócio-faturamento e pelo webhook do Asaas (lançamento automático).
export async function lancarFaturamentoEscritorio(
  admin: SupabaseClient,
  esc: Esc,
  comp: string,
): Promise<ResultadoLancamento> {
  const valor = Number(esc.valor_mensal) || 0;
  if (valor <= 0) return { lancado: false, motivo: "sem valor mensal" };

  const { data: cfg } = await admin
    .from("negocio_config")
    .select("empresa_master_id")
    .eq("id", 1)
    .maybeSingle();
  const masterId = (cfg?.empresa_master_id as string | null) ?? null;
  if (!masterId) return { lancado: false, motivo: "sem master" };

  // idempotência por escritório + competência
  const { data: ja } = await admin
    .from("negocio_faturamento")
    .select("id")
    .eq("escritorio_id", esc.id)
    .eq("competencia", comp)
    .maybeSingle();
  if (ja) return { lancado: false, motivo: "já lançado" };

  const venc = ultimoDiaComp(comp);
  const ins = await admin
    .from("lancamentos")
    .insert({
      empresa_id: masterId,
      tipo: "entrada",
      valor,
      descricao: `Assinatura — ${esc.nome ?? "escritório"} — ${comp.slice(5, 7)}/${comp.slice(0, 4)}`,
      data_competencia: comp + "-01",
      data_vencimento: venc,
      conciliado: false,
    })
    .select("id")
    .single();
  if (ins.error) return { lancado: false, motivo: ins.error.message };

  await admin.from("negocio_faturamento").insert({
    escritorio_id: esc.id,
    competencia: comp,
    lancamento_id: ins.data.id,
    valor,
  });
  return { lancado: true, valor };
}

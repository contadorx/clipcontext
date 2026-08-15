import { createClient } from "@/lib/supabase/server";

// Contas ainda não vencidas e em aberto, organizadas por tempo ATÉ o vencimento.
// Espelha a inadimplência, mas olhando pra frente (data_vencimento >= hoje).

export type ItemAVencer = {
  id: string;
  pessoa: string;
  descricao: string;
  data_vencimento: string;
  valor: number;
  dias: number; // dias até vencer
};
export type GrupoAVencer = {
  pessoa: string;
  total: number;
  buckets: number[]; // [até 7, 8-15, 16-30, 30+]
  itens: ItemAVencer[];
};
export type LadoAVencer = { grupos: GrupoAVencer[]; total: number; buckets: number[] };
export type AVencer = { receber: LadoAVencer; pagar: LadoAVencer };

function diasAte(venc: string, hoje: string): number {
  const a = new Date(venc + "T00:00:00").getTime();
  const b = new Date(hoje + "T00:00:00").getTime();
  return Math.max(0, Math.round((a - b) / 86400000));
}
function bucketIndex(dias: number): number {
  if (dias <= 7) return 0;
  if (dias <= 15) return 1;
  if (dias <= 30) return 2;
  return 3;
}

export async function getAVencer(empresaId: string): Promise<AVencer> {
  const supabase = createClient();
  const hoje = new Date().toISOString().slice(0, 10);

  const { data } = await supabase
    .from("lancamentos")
    .select("id, tipo, valor, descricao, data_vencimento, pessoa:clientes_fornecedores(nome)")
    .eq("empresa_id", empresaId)
    .not("transferencia", "is", true)
    .is("data_pagamento", null)
    .gte("data_vencimento", hoje)
    .order("data_vencimento");

  const rows = ((data ?? []) as unknown) as Array<{
    id: string;
    tipo: "entrada" | "saida";
    valor: number;
    descricao: string | null;
    data_vencimento: string;
    pessoa: { nome: string } | null;
  }>;

  function montar(tipo: "entrada" | "saida"): LadoAVencer {
    const porPessoa = new Map<string, GrupoAVencer>();
    for (const r of rows) {
      if (r.tipo !== tipo) continue;
      const nome = r.pessoa?.nome ?? (tipo === "entrada" ? "Sem cliente" : "Sem fornecedor");
      const dias = diasAte(r.data_vencimento, hoje);
      const v = Number(r.valor);
      if (!porPessoa.has(nome)) porPessoa.set(nome, { pessoa: nome, total: 0, buckets: [0, 0, 0, 0], itens: [] });
      const g = porPessoa.get(nome)!;
      g.total += v;
      g.buckets[bucketIndex(dias)] += v;
      g.itens.push({ id: r.id, pessoa: nome, descricao: r.descricao ?? "—", data_vencimento: r.data_vencimento, valor: v, dias });
    }
    const grupos = Array.from(porPessoa.values()).sort((a, b) => b.total - a.total);
    const total = grupos.reduce((s, g) => s + g.total, 0);
    const buckets = [0, 0, 0, 0];
    for (const g of grupos) for (let i = 0; i < 4; i++) buckets[i] += g.buckets[i];
    return { grupos, total, buckets };
  }

  return { receber: montar("entrada"), pagar: montar("saida") };
}

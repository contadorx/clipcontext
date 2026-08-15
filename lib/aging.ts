import { createClient } from "@/lib/supabase/server";
import { carregarRateios, recortarPorCentro } from "@/lib/rateio";

// Aging unificado: contas em aberto (sem pagamento), olhando o vencimento.
// Faixa 0 = a vencer (ainda no prazo); demais = dias de atraso.
// Separa recebíveis (entrada/clientes) e pagáveis (saída/fornecedores).

export type ItemAging = {
  id: string;
  pessoa: string;
  descricao: string;
  data_vencimento: string;
  valor: number;
  dias: number; // dias de atraso (se vencido) ou dias até vencer (se a vencer)
  vencido: boolean;
};
export type GrupoAging = {
  pessoa: string;
  total: number;
  buckets: number[]; // [a vencer, 1-30, 31-60, 61-90, 90+]
  itens: ItemAging[];
};
export type LadoAging = { grupos: GrupoAging[]; total: number; buckets: number[] };
export type Aging = { receber: LadoAging; pagar: LadoAging };

function atrasoDias(venc: string, hoje: string): number {
  const a = new Date(venc + "T00:00:00").getTime();
  const b = new Date(hoje + "T00:00:00").getTime();
  return Math.round((b - a) / 86400000); // > 0 = atraso, <= 0 = a vencer
}
function bucketIndex(atraso: number): number {
  if (atraso <= 0) return 0; // a vencer
  if (atraso <= 30) return 1;
  if (atraso <= 60) return 2;
  if (atraso <= 90) return 3;
  return 4;
}

export async function getAging(empresaId: string, centroId?: string): Promise<Aging> {
  const supabase = createClient();
  const hoje = new Date().toISOString().slice(0, 10);

  const { data } = await supabase
    .from("lancamentos")
    .select("id, tipo, valor, descricao, data_vencimento, centro_custo_id, pessoa:clientes_fornecedores(nome)")
    .eq("empresa_id", empresaId)
    .not("transferencia", "is", true)
    .is("data_pagamento", null)
    .not("data_vencimento", "is", null)
    .order("data_vencimento");

  const rows = ((data ?? []) as unknown) as Array<{
    id: string;
    tipo: "entrada" | "saida";
    valor: number;
    descricao: string | null;
    data_vencimento: string;
    centro_custo_id: string | null;
    pessoa: { nome: string } | null;
  }>;

  // Com rateio, o título entra no centro pela parte que cabe a ele.
  const rateios = centroId ? await carregarRateios(supabase, empresaId, rows.map((r) => r.id)) : null;
  const rowsF = centroId && rateios ? recortarPorCentro(rows, rateios, centroId) : rows;

  function montar(tipo: "entrada" | "saida"): LadoAging {
    const porPessoa = new Map<string, GrupoAging>();
    for (const r of rowsF) {
      if (r.tipo !== tipo) continue;
      const nome = r.pessoa?.nome ?? (tipo === "entrada" ? "Sem cliente" : "Sem fornecedor");
      const atraso = atrasoDias(r.data_vencimento, hoje);
      const v = Number(r.valor);
      if (!porPessoa.has(nome))
        porPessoa.set(nome, { pessoa: nome, total: 0, buckets: [0, 0, 0, 0, 0], itens: [] });
      const g = porPessoa.get(nome)!;
      g.total += v;
      g.buckets[bucketIndex(atraso)] += v;
      g.itens.push({
        id: r.id,
        pessoa: nome,
        descricao: r.descricao ?? "—",
        data_vencimento: r.data_vencimento,
        valor: v,
        dias: Math.abs(atraso),
        vencido: atraso > 0,
      });
    }
    const grupos = Array.from(porPessoa.values()).sort((a, b) => b.total - a.total);
    const total = grupos.reduce((s, g) => s + g.total, 0);
    const buckets = [0, 0, 0, 0, 0];
    for (const g of grupos) for (let i = 0; i < 5; i++) buckets[i] += g.buckets[i];
    return { grupos, total, buckets };
  }

  return { receber: montar("entrada"), pagar: montar("saida") };
}

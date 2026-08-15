import { createClient } from "@/lib/supabase/server";

export type EmpresaRent = {
  empresaId: string;
  nome: string;
  entradas: number;
  saidas: number;
  resultado: number;
  margem: number; // resultado/entradas*100; NaN quando sem entradas
};

export async function getRentabilidade(
  empresas: { id: string; nome: string }[],
  ano: number,
  mes: number,
): Promise<EmpresaRent[]> {
  if (empresas.length === 0) return [];

  const ids = empresas.map((e) => e.id);
  const ini = mes === 0 ? `${ano}-01-01` : `${ano}-${String(mes).padStart(2, "0")}-01`;
  const lastDay = mes === 0 ? 31 : new Date(ano, mes, 0).getDate();
  const fim = mes === 0 ? `${ano}-12-31` : `${ano}-${String(mes).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("lancamentos")
    .select("empresa_id, tipo, valor")
    .in("empresa_id", ids)
    .gte("data_pagamento", ini)
    .lte("data_pagamento", fim)
    .not("data_pagamento", "is", null)
    .not("transferencia", "is", true);

  if (error || !data) return [];

  const acc = new Map<string, { entradas: number; saidas: number }>();
  for (const id of ids) acc.set(id, { entradas: 0, saidas: 0 });
  for (const l of data) {
    const r = acc.get(l.empresa_id);
    if (!r) continue;
    if (l.tipo === "entrada") r.entradas += Number(l.valor);
    else r.saidas += Number(l.valor);
  }

  const nomeMap = new Map(empresas.map((e) => [e.id, e.nome]));
  const result: EmpresaRent[] = [];
  Array.from(acc.entries()).forEach(([id, v]) => {
    if (v.entradas === 0 && v.saidas === 0) return;
    const resultado = v.entradas - v.saidas;
    result.push({
      empresaId: id,
      nome: nomeMap.get(id) ?? id,
      entradas: v.entradas,
      saidas: v.saidas,
      resultado,
      margem: v.entradas > 0 ? (resultado / v.entradas) * 100 : NaN,
    });
  });

  return result.sort((a, b) => b.resultado - a.resultado);
}

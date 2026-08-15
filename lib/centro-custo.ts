import { createClient } from "@/lib/supabase/server";
import { carregarRateios, expandirPorCentro, SEM_CENTRO } from "@/lib/rateio";

// Resultado por centro de custo (regime de competência), no ano.
// Lançamentos sem centro entram em "Sem centro de custo" — nada fica de fora.

export type CentroRow = {
  id: string;
  nome: string;
  receitas: number;
  despesas: number;
  resultado: number;
};
export type RelCentroCusto = {
  usa: boolean; // o escritório ativou o uso de centro de custo
  linhas: CentroRow[];
  totalReceitas: number;
  totalDespesas: number;
  totalResultado: number;
};

const soma = (a: number[]) => a.reduce((x, y) => x + y, 0);

export async function getPorCentroCusto(empresaId: string, ano: number): Promise<RelCentroCusto> {
  const supabase = createClient();
  const [{ data: escr }, { data: centrosRaw }, { data: lancRaw }] = await Promise.all([
    supabase.from("escritorios").select("usar_centro_custo").limit(1).maybeSingle(),
    supabase.from("centros_custo").select("id, nome").eq("empresa_id", empresaId).order("nome"),
    supabase
      .from("lancamentos")
      .select("id, tipo, valor, centro_custo_id, data_competencia")
      .eq("empresa_id", empresaId)
      .not("transferencia", "is", true),
  ]);

  const usa = !!(escr as { usar_centro_custo?: boolean } | null)?.usar_centro_custo;
  const centros = (centrosRaw ?? []) as Array<{ id: string; nome: string }>;
  const lanc = (lancRaw ?? []) as Array<{
    id: string;
    tipo: "entrada" | "saida";
    valor: number;
    centro_custo_id: string | null;
    data_competencia: string;
  }>;

  // Lançamentos rateados entram divididos entre os centros; os demais, inteiros.
  const doAno = lanc.filter((l) => l.data_competencia && Number(l.data_competencia.slice(0, 4)) === ano);
  const rateios = await carregarRateios(supabase, empresaId, doAno.map((l) => l.id));

  const nomePorId = new Map(centros.map((c) => [c.id, c.nome]));
  const SEM = SEM_CENTRO;
  const mapa = new Map<string, { receitas: number; despesas: number }>();

  for (const l of doAno) {
    for (const parte of expandirPorCentro(l, rateios)) {
      const key = parte.centro_custo_id;
      if (!mapa.has(key)) mapa.set(key, { receitas: 0, despesas: 0 });
      const acc = mapa.get(key)!;
      if (l.tipo === "entrada") acc.receitas += parte.valor;
      else acc.despesas += parte.valor;
    }
  }

  const linhas: CentroRow[] = [];
  for (const [key, acc] of Array.from(mapa.entries())) {
    const nome = key === SEM ? "Sem centro de custo" : nomePorId.get(key) ?? "Centro removido";
    linhas.push({
      id: key,
      nome,
      receitas: acc.receitas,
      despesas: acc.despesas,
      resultado: acc.receitas - acc.despesas,
    });
  }
  // sem centro por último; demais por maior resultado
  linhas.sort((a, b) => {
    if (a.id === SEM) return 1;
    if (b.id === SEM) return -1;
    return b.resultado - a.resultado;
  });

  const totalReceitas = soma(linhas.map((l) => l.receitas));
  const totalDespesas = soma(linhas.map((l) => l.despesas));
  return { usa, linhas, totalReceitas, totalDespesas, totalResultado: totalReceitas - totalDespesas };
}

export async function getCentrosLista(empresaId: string): Promise<{ id: string; nome: string }[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("centros_custo")
    .select("id, nome")
    .eq("empresa_id", empresaId)
    .order("nome");
  return (data ?? []) as { id: string; nome: string }[];
}

import { createClient } from "@/lib/supabase/server";

export type CategoriaOR = {
  id: string;
  nome: string;
  orcado: number;
  realizado: number;
};
export type GrupoOR = {
  id: string;
  nome: string;
  eh_receita: boolean;
  orcado: number;
  realizado: number;
  categorias: CategoriaOR[];
};
export type SecaoOR = {
  chave: string;
  titulo: string;
  grupos: GrupoOR[];
  orcadoSub: number; // assinado (receita +, despesa -)
  realizadoSub: number;
  entraResultado: boolean;
};
export type RelOR = {
  secoes: SecaoOR[];
  orcadoResultado: number;
  realizadoResultado: number;
  temGrupos: boolean;
};

const SECOES = [
  { chave: "operacionais", titulo: "Atividades Operacionais", entraResultado: true },
  { chave: "financeiro", titulo: "Resultado Financeiro", entraResultado: true },
  { chave: "caixa", titulo: "Atividades de Caixa", entraResultado: false },
];

export async function getOrcadoRealizado(
  empresaId: string,
  ano: number,
  mes: number, // 0 = ano todo; 1..12 = mês específico
  visao: "realizado" | "previsto",
): Promise<RelOR> {
  const supabase = createClient();
  const [{ data: gruposRaw }, { data: catsRaw }, { data: lancRaw }, { data: orcRaw }] = await Promise.all([
    supabase
      .from("grupos_categoria")
      .select("id, nome, secao, eh_receita, ordem")
      .eq("empresa_id", empresaId)
      .order("ordem"),
    supabase.from("categorias").select("id, grupo_id, nome").eq("empresa_id", empresaId),
    supabase
      .from("lancamentos")
      .select("categoria_id, valor, data_pagamento, data_competencia")
      .eq("empresa_id", empresaId)
      .not("transferencia", "is", true),
    supabase.from("orcamentos").select("categoria_id, mes, valor").eq("empresa_id", empresaId).eq("ano", ano),
  ]);

  const grupos = (gruposRaw ?? []) as Array<{
    id: string;
    nome: string;
    secao: string;
    eh_receita: boolean;
  }>;
  const cats = (catsRaw ?? []) as Array<{ id: string; grupo_id: string; nome: string }>;
  const lanc = (lancRaw ?? []) as Array<{
    categoria_id: string | null;
    valor: number;
    data_pagamento: string | null;
    data_competencia: string;
  }>;
  const orc = (orcRaw ?? []) as Array<{ categoria_id: string; mes: number; valor: number }>;

  const catParaGrupo = new Map<string, string>();
  for (const c of cats) catParaGrupo.set(c.id, c.grupo_id);

  const catsDoGrupo = new Map<string, Array<{ id: string; nome: string }>>();
  for (const c of cats) {
    if (!catsDoGrupo.has(c.grupo_id)) catsDoGrupo.set(c.grupo_id, []);
    catsDoGrupo.get(c.grupo_id)!.push({ id: c.id, nome: c.nome });
  }

  const realizadoPorGrupo = new Map<string, number>();
  const orcadoPorGrupo = new Map<string, number>();
  const realizadoPorCat = new Map<string, number>();
  const orcadoPorCat = new Map<string, number>();
  for (const g of grupos) {
    realizadoPorGrupo.set(g.id, 0);
    orcadoPorGrupo.set(g.id, 0);
  }
  for (const c of cats) {
    realizadoPorCat.set(c.id, 0);
    orcadoPorCat.set(c.id, 0);
  }

  for (const l of lanc) {
    const data = visao === "realizado" ? l.data_pagamento : l.data_competencia;
    if (!data) continue;
    if (Number(data.slice(0, 4)) !== ano) continue;
    if (mes !== 0 && Number(data.slice(5, 7)) !== mes) continue;
    const gid = l.categoria_id ? catParaGrupo.get(l.categoria_id) : undefined;
    if (!gid || !realizadoPorGrupo.has(gid)) continue;
    realizadoPorGrupo.set(gid, realizadoPorGrupo.get(gid)! + Number(l.valor));
    if (l.categoria_id && realizadoPorCat.has(l.categoria_id))
      realizadoPorCat.set(l.categoria_id, realizadoPorCat.get(l.categoria_id)! + Number(l.valor));
  }

  for (const o of orc) {
    if (mes !== 0 && o.mes !== mes) continue;
    const gid = catParaGrupo.get(o.categoria_id);
    if (!gid || !orcadoPorGrupo.has(gid)) continue;
    orcadoPorGrupo.set(gid, orcadoPorGrupo.get(gid)! + Number(o.valor));
    if (orcadoPorCat.has(o.categoria_id))
      orcadoPorCat.set(o.categoria_id, orcadoPorCat.get(o.categoria_id)! + Number(o.valor));
  }

  const secoes: SecaoOR[] = [];
  let orcadoResultado = 0;
  let realizadoResultado = 0;

  for (const s of SECOES) {
    const gs = grupos.filter((g) => g.secao === s.chave);
    if (gs.length === 0) continue;
    const gruposOR: GrupoOR[] = gs.map((g) => ({
      id: g.id,
      nome: g.nome,
      eh_receita: g.eh_receita,
      orcado: orcadoPorGrupo.get(g.id) ?? 0,
      realizado: realizadoPorGrupo.get(g.id) ?? 0,
      categorias: (catsDoGrupo.get(g.id) ?? [])
        .map((c) => ({
          id: c.id,
          nome: c.nome,
          orcado: orcadoPorCat.get(c.id) ?? 0,
          realizado: realizadoPorCat.get(c.id) ?? 0,
        }))
        .filter((c) => c.orcado !== 0 || c.realizado !== 0)
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    }));
    let orcadoSub = 0;
    let realizadoSub = 0;
    for (const g of gruposOR) {
      orcadoSub += g.eh_receita ? g.orcado : -g.orcado;
      realizadoSub += g.eh_receita ? g.realizado : -g.realizado;
    }
    if (s.entraResultado) {
      orcadoResultado += orcadoSub;
      realizadoResultado += realizadoSub;
    }
    secoes.push({ chave: s.chave, titulo: s.titulo, grupos: gruposOR, orcadoSub, realizadoSub, entraResultado: s.entraResultado });
  }

  return { secoes, orcadoResultado, realizadoResultado, temGrupos: grupos.length > 0 };
}

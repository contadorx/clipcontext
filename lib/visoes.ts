// Visões salvas — filtros nomeados de qualquer tela (ver fx_visoes_salvas.sql).
//
// Duas coisas diferentes, propositalmente separadas:
//   1. URL   -> todo filtro vira query string, então qualquer recorte é link.
//   2. Tabela -> o recorte ganha nome e volta amanhã, para você ou para a equipe.
//
// Genérico de propósito: cada tela declara seu próprio conjunto de filtros
// (um objeto plano de string | string[]) e ganha URL + visões sem código novo.
// A chave do objeto é a chave que aparece na URL — escolha nomes curtos.
//
// Se a tabela ainda não existir no banco, `listarVisoes` devolve [] em vez de
// quebrar a tela — o app continua funcionando só com a parte de URL.

import type { SupabaseClient } from "@supabase/supabase-js";

/** Filtros de uma tela: objeto plano, valores string ou lista de strings. */
export type Filtros = Record<string, string | string[]>;

export type Visao = {
  id: string;
  nome: string;
  tela: string;
  filtros: Filtros;
  compartilhada: boolean;
  padrao: boolean;
  minha: boolean;
};

/* ------------------------------------------------------------------ URL --- */

const ehLista = (v: unknown): v is string[] => Array.isArray(v);

/** Filtros -> querystring enxuta: só o que difere do padrão entra na URL. */
export function filtrosParaQuery(f: Filtros, padrao: Filtros): URLSearchParams {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    const d = padrao[k];
    if (ehLista(v)) {
      const atual = [...v].filter(Boolean);
      const base = ehLista(d) ? [...d] : [];
      if (atual.length === 0) continue;
      if (atual.slice().sort().join(",") === base.slice().sort().join(",")) continue;
      p.set(k, atual.join(","));
    } else {
      const atual = (v ?? "").toString().trim();
      if (!atual) continue;
      if (atual === ((d as string) ?? "")) continue;
      p.set(k, atual);
    }
  }
  return p;
}

/** Querystring -> filtros. O que não vier na URL assume o padrão da tela. */
export function queryParaFiltros(sp: URLSearchParams, padrao: Filtros): Filtros {
  const out: Filtros = {};
  for (const [k, d] of Object.entries(padrao)) {
    const bruto = sp.get(k);
    if (ehLista(d)) out[k] = bruto ? bruto.split(",").filter(Boolean) : [...d];
    else out[k] = bruto ?? (d as string);
  }
  return out;
}

/** true quando dois recortes são equivalentes (ordem de lista não importa). */
export function mesmosFiltros(a: Filtros, b: Filtros): boolean {
  const chaves = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of Array.from(chaves)) {
    const x = a[k];
    const y = b[k];
    if (ehLista(x) || ehLista(y)) {
      const lx = (ehLista(x) ? x : []).slice().sort().join(",");
      const ly = (ehLista(y) ? y : []).slice().sort().join(",");
      if (lx !== ly) return false;
    } else if (((x as string) ?? "").trim() !== ((y as string) ?? "").trim()) {
      return false;
    }
  }
  return true;
}

/* --------------------------------------------------------------- tabela --- */

type LinhaVisao = {
  id: string;
  nome: string;
  tela: string;
  filtros: Filtros | null;
  compartilhada: boolean;
  padrao: boolean;
  user_id: string;
};

export async function listarVisoes(
  supabase: SupabaseClient,
  empresaId: string,
  userId: string,
  tela: string,
): Promise<Visao[]> {
  if (!empresaId) return [];
  const { data, error } = await supabase
    .from("visoes_salvas")
    .select("id, nome, tela, filtros, compartilhada, padrao, user_id")
    .eq("empresa_id", empresaId)
    .eq("tela", tela)
    .order("criado_em", { ascending: true });

  // Tabela ainda não criada (fx_visoes_salvas.sql não rodou): degrada em silêncio.
  if (error) return [];

  return ((data as LinhaVisao[]) ?? []).map((r) => ({
    id: r.id,
    nome: r.nome,
    tela: r.tela,
    filtros: (r.filtros ?? {}) as Filtros,
    compartilhada: r.compartilhada,
    padrao: r.padrao,
    minha: r.user_id === userId,
  }));
}

export async function salvarVisao(
  supabase: SupabaseClient,
  empresaId: string,
  tela: string,
  nome: string,
  filtros: Filtros,
  compartilhada: boolean,
): Promise<{ erro?: string; id?: string }> {
  const { data, error } = await supabase
    .from("visoes_salvas")
    .insert({ empresa_id: empresaId, tela, nome: nome.trim(), filtros, compartilhada })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { erro: "Já existe uma visão com esse nome." };
    if (error.code === "42P01")
      return { erro: "Rode o arquivo fx_visoes_salvas.sql no Supabase para ativar as visões salvas." };
    return { erro: error.message };
  }
  return { id: (data as { id: string }).id };
}

export async function apagarVisao(supabase: SupabaseClient, id: string): Promise<string | null> {
  const { error } = await supabase.from("visoes_salvas").delete().eq("id", id);
  return error ? error.message : null;
}

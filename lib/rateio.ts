// Rateio de um lançamento entre centros de custo (ver fx_lancamento_rateios.sql).
//
// Regra única, aplicada em todo lugar que olha para centro de custo:
//   • lançamento sem rateio -> vale o `centro_custo_id` do próprio lançamento
//   • lançamento com rateio -> vale a divisão da tabela `lancamento_rateios`
//
// Os helpers aqui são puros e funcionam tanto no cliente quanto no servidor.
// `carregarRateios` degrada em silêncio se a tabela ainda não existir, então o
// app continua rodando antes de você aplicar o SQL.

import type { SupabaseClient } from "@supabase/supabase-js";

export type ParteRateio = { centro_custo_id: string; valor: number };
export type MapaRateios = Map<string, ParteRateio[]>;

/** Chave usada nos relatórios para "sem centro de custo". */
export const SEM_CENTRO = "__sem__";

export const arredonda2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Carrega os rateios da empresa num mapa `lancamento_id -> partes`.
 * `ids` restringe a busca quando você já sabe de quais lançamentos precisa.
 */
export async function carregarRateios(
  supabase: SupabaseClient,
  empresaId: string,
  ids?: string[],
): Promise<MapaRateios> {
  const mapa: MapaRateios = new Map();
  if (!empresaId) return mapa;
  if (ids && ids.length === 0) return mapa;

  let q = supabase
    .from("lancamento_rateios")
    .select("lancamento_id, centro_custo_id, valor")
    .eq("empresa_id", empresaId);
  if (ids && ids.length > 0) q = q.in("lancamento_id", ids);

  const { data, error } = await q;
  if (error) return mapa; // tabela ainda não criada: segue o jogo sem rateio

  for (const r of (data as { lancamento_id: string; centro_custo_id: string; valor: number }[]) ?? []) {
    const atual = mapa.get(r.lancamento_id) ?? [];
    atual.push({ centro_custo_id: r.centro_custo_id, valor: Number(r.valor) });
    mapa.set(r.lancamento_id, atual);
  }
  return mapa;
}

type LancMinimo = { id?: string | null; valor: number | string; centro_custo_id: string | null };

/**
 * Expande um lançamento nas suas partes por centro.
 * Sem rateio devolve uma parte só, com o valor inteiro — então quem consome
 * não precisa saber se há rateio ou não.
 */
export function expandirPorCentro(l: LancMinimo, rateios: MapaRateios): ParteRateio[] {
  const partes = l.id ? rateios.get(l.id) : undefined;
  if (!partes || partes.length === 0) {
    return [{ centro_custo_id: l.centro_custo_id ?? SEM_CENTRO, valor: Number(l.valor) }];
  }
  const soma = arredonda2(partes.reduce((s, p) => s + p.valor, 0));
  const total = arredonda2(Number(l.valor));
  // Sobra (rateio parcial, ou valor do lançamento editado depois do rateio)
  // não some do relatório: vira "sem centro de custo".
  const resto = arredonda2(total - soma);
  const saida = partes.map((p) => ({ ...p }));
  if (Math.abs(resto) >= 0.01) saida.push({ centro_custo_id: SEM_CENTRO, valor: resto });
  return saida;
}

/**
 * Quanto deste lançamento pertence ao centro pedido.
 * `centroId` aceita SEM_CENTRO. Devolve 0 quando não pertence.
 */
export function valorNoCentro(l: LancMinimo, rateios: MapaRateios, centroId: string): number {
  return arredonda2(
    expandirPorCentro(l, rateios)
      .filter((p) => p.centro_custo_id === centroId)
      .reduce((s, p) => s + p.valor, 0),
  );
}

/** true quando o lançamento entra no recorte daquele centro. */
export function pertenceAoCentro(l: LancMinimo, rateios: MapaRateios, centroId: string): boolean {
  return valorNoCentro(l, rateios, centroId) !== 0;
}

/**
 * Recorta uma lista de lançamentos para um centro de custo.
 *
 * Devolve só os que pertencem ao centro, com `valor` já reduzido à parte que
 * cabe ali. Assim todo o resto do relatório (soma por grupo, por mês, por
 * categoria) continua funcionando sem saber o que é rateio.
 */
export function recortarPorCentro<T extends LancMinimo>(
  lancs: T[],
  rateios: MapaRateios,
  centroId: string,
): T[] {
  const out: T[] = [];
  for (const l of lancs) {
    const v = valorNoCentro(l, rateios, centroId);
    if (v === 0) continue;
    out.push(Number(l.valor) === v ? l : { ...l, valor: v });
  }
  return out;
}

/* ------------------------------------------------------------- gravação --- */

/**
 * Substitui o rateio de um lançamento (apaga o que havia e grava o novo).
 * Lista vazia = lançamento volta a usar o `centro_custo_id` simples.
 */
export async function salvarRateio(
  supabase: SupabaseClient,
  empresaId: string,
  lancamentoId: string,
  partes: ParteRateio[],
): Promise<string | null> {
  const limpas = partes.filter((p) => p.centro_custo_id && p.valor > 0);

  const del = await supabase.from("lancamento_rateios").delete().eq("lancamento_id", lancamentoId);
  if (del.error) {
    if (del.error.code === "42P01")
      return "Rode o arquivo fx_lancamento_rateios.sql no Supabase para ativar o rateio.";
    return del.error.message;
  }
  if (limpas.length === 0) return null;

  const ins = await supabase.from("lancamento_rateios").insert(
    limpas.map((p) => ({
      lancamento_id: lancamentoId,
      empresa_id: empresaId,
      centro_custo_id: p.centro_custo_id,
      valor: arredonda2(p.valor),
    })),
  );
  return ins.error ? ins.error.message : null;
}

/** Aplica o mesmo rateio a vários lançamentos (parcelas de um carnê). */
export async function salvarRateioEmLote(
  supabase: SupabaseClient,
  empresaId: string,
  lancamentoIds: string[],
  partes: ParteRateio[],
): Promise<string | null> {
  for (const id of lancamentoIds) {
    const erro = await salvarRateio(supabase, empresaId, id, partes);
    if (erro) return erro;
  }
  return null;
}

/* ------------------------------------------------------------ validação --- */

export type ValidacaoRateio = { ok: boolean; soma: number; resta: number; erro: string | null };

export function validarRateio(partes: ParteRateio[], total: number): ValidacaoRateio {
  const limpas = partes.filter((p) => p.centro_custo_id && p.valor > 0);
  const soma = arredonda2(limpas.reduce((s, p) => s + p.valor, 0));
  const resta = arredonda2(total - soma);

  if (limpas.length === 0) return { ok: true, soma: 0, resta: total, erro: null }; // sem rateio
  if (limpas.length < 2) return { ok: false, soma, resta, erro: "O rateio precisa de pelo menos dois centros." };

  const centros = new Set(limpas.map((p) => p.centro_custo_id));
  if (centros.size !== limpas.length) return { ok: false, soma, resta, erro: "O mesmo centro aparece duas vezes." };
  if (Math.abs(resta) >= 0.01)
    return {
      ok: false,
      soma,
      resta,
      erro: resta > 0 ? `Faltam R$ ${resta.toFixed(2)} para fechar o valor.` : `Passou R$ ${Math.abs(resta).toFixed(2)} do valor.`,
    };
  return { ok: true, soma, resta: 0, erro: null };
}

/** Divide o total igualmente entre N centros, jogando os centavos na primeira parte. */
export function dividirIgualmente(total: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor((total * 100) / n) / 100;
  const partes = Array.from({ length: n }, () => base);
  const sobra = arredonda2(total - base * n);
  partes[0] = arredonda2(partes[0] + sobra);
  return partes;
}

// ============================================================
// Recorrências vivas — helpers puros (testáveis fora do app)
// ============================================================

// soma meses a uma competência aaaa-mm-01 (sempre dia 01)
export function addMesCompetencia(comp: string, k: number): string {
  const [a, m] = comp.slice(0, 7).split("-").map(Number);
  const base = new Date(Date.UTC(a, m - 1 + k, 1));
  return base.toISOString().slice(0, 10);
}

// competência do mês corrente (aaaa-mm-01) em horário de Brasília
export function competenciaAtual(agora = new Date()): string {
  const br = new Date(agora.getTime() - 3 * 3600 * 1000);
  return `${br.getUTCFullYear()}-${String(br.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

// vencimento numa competência respeitando o dia desejado, com clamp
// para o último dia do mês (dia 31 em fevereiro → 28/29).
export function vencimentoNaCompetencia(comp: string, dia: number): string {
  const [a, m] = comp.slice(0, 7).split("-").map(Number);
  const ultimoDia = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const d = Math.min(Math.max(1, dia), ultimoDia);
  return `${comp.slice(0, 7)}-${String(d).padStart(2, "0")}`;
}

// comparação de competências (aaaa-mm-01): a <= b ?
export function compLE(a: string, b: string): boolean {
  return a.slice(0, 7) <= b.slice(0, 7);
}

export type RecorrenciaViva = {
  id: string;
  empresa_id: string;
  tipo: string;
  valor: number;
  descricao: string | null;
  categoria_id: string | null;
  conta_id: string | null;
  cliente_fornecedor_id: string | null;
  centro_custo_id: string | null;
  dia_vencimento: number;
  ativa: boolean;
  ultima_competencia: string | null;
  proxima_competencia: string;
  fim: string | null;
};

// Quais competências uma recorrência deve materializar até o limite
// (inclusive), sem ultrapassar o fim. Retorna a lista de aaaa-mm-01.
export function competenciasAMaterializar(r: RecorrenciaViva, limite: string): string[] {
  if (!r.ativa) return [];
  const out: string[] = [];
  let comp = r.proxima_competencia.slice(0, 10);
  let guarda = 0;
  while (compLE(comp, limite) && guarda < 120) {
    if (r.fim && !compLE(comp, r.fim)) break;
    out.push(comp);
    comp = addMesCompetencia(comp, 1);
    guarda++;
  }
  return out;
}

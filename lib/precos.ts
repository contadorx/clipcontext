// Motor de preços do FinanceiroX (puro, usado no cliente e no servidor).
export type Ciclo = "mensal" | "semestral" | "anual";
export type Faixa = { ate: number; preco: number };
export type CicloDef = { id: Ciclo; nome: string; meses: number; desc: number; selo?: string };
export type PrecoConfig = { faixas: Faixa[]; piso: number; ciclos: CicloDef[] };

export const CICLOS: CicloDef[] = [
  { id: "mensal", nome: "Mensal", meses: 1, desc: 0 },
  { id: "semestral", nome: "Semestral", meses: 6, desc: 0.1, selo: "−10%" },
  { id: "anual", nome: "Anual", meses: 12, desc: 0.2, selo: "−20% · ~2 meses grátis" },
];

export const FAIXAS: Faixa[] = [
  { ate: 3, preco: 39 },
  { ate: 10, preco: 29 },
  { ate: 25, preco: 19 },
  { ate: Infinity, preco: 12 },
];
export const PISO_MENSAL = 59;

export const CONFIG_PADRAO: PrecoConfig = { faixas: FAIXAS, piso: PISO_MENSAL, ciclos: CICLOS };

type RowFaixa = { ate: number | null; preco: number };
export function configDeRow(
  row: { faixas?: RowFaixa[] | null; piso?: number | null; ciclos?: CicloDef[] | null } | null | undefined,
): PrecoConfig {
  if (!row) return CONFIG_PADRAO;
  const faixas =
    Array.isArray(row.faixas) && row.faixas.length > 0
      ? row.faixas.map((f) => ({ ate: f.ate == null ? Infinity : Number(f.ate), preco: Number(f.preco) }))
      : FAIXAS;
  const ciclos = Array.isArray(row.ciclos) && row.ciclos.length > 0 ? row.ciclos : CICLOS;
  const piso = row.piso == null ? PISO_MENSAL : Number(row.piso);
  return { faixas, piso, ciclos };
}

export function configParaRow(cfg: PrecoConfig): { faixas: RowFaixa[]; piso: number; ciclos: CicloDef[] } {
  return {
    faixas: cfg.faixas.map((f) => ({ ate: Number.isFinite(f.ate) ? f.ate : null, preco: f.preco })),
    piso: cfg.piso,
    ciclos: cfg.ciclos,
  };
}

export function precoMensalBase(n: number, cfg: PrecoConfig = CONFIG_PADRAO): number {
  const empresas = Math.max(0, Math.floor(n));
  let prev = 0;
  let total = 0;
  for (const f of cfg.faixas) {
    const qtd = Math.max(0, Math.min(empresas, f.ate) - prev);
    total += qtd * f.preco;
    prev = f.ate;
    if (empresas <= f.ate) break;
  }
  return Math.max(cfg.piso, total);
}

export function detalheFaixas(
  n: number,
  cfg: PrecoConfig = CONFIG_PADRAO,
): { faixa: string; qtd: number; preco: number; subtotal: number }[] {
  const empresas = Math.max(0, Math.floor(n));
  const out: { faixa: string; qtd: number; preco: number; subtotal: number }[] = [];
  let prev = 0;
  for (const f of cfg.faixas) {
    const qtd = Math.max(0, Math.min(empresas, f.ate) - prev);
    if (qtd > 0) {
      const ini = prev + 1;
      const fim = f.ate === Infinity ? "+" : String(Math.min(empresas, f.ate));
      out.push({ faixa: `${ini}–${fim}`, qtd, preco: f.preco, subtotal: qtd * f.preco });
    }
    prev = f.ate;
    if (empresas <= f.ate) break;
  }
  return out;
}

export type Calculo = {
  base: number;
  mensalEquivalente: number;
  totalCiclo: number;
  economiaCiclo: number;
  desc: number;
  meses: number;
};

export function calcular(n: number, ciclo: Ciclo, cfg: PrecoConfig = CONFIG_PADRAO): Calculo {
  const c = cfg.ciclos.find((x) => x.id === ciclo) ?? cfg.ciclos[0] ?? CICLOS[0];
  const base = precoMensalBase(n, cfg);
  const mensalEquivalente = base * (1 - c.desc);
  const totalCiclo = mensalEquivalente * c.meses;
  const economiaCiclo = base * c.meses - totalCiclo;
  return { base, mensalEquivalente, totalCiclo, economiaCiclo, desc: c.desc, meses: c.meses };
}

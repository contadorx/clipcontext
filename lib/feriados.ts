// Dia útil bancário nacional (para aviso na geração de CNAB).
// Cobre fim de semana + feriados nacionais bancários (fixos e móveis).
// NÃO cobre feriados municipais/estaduais — por isso é usado como AVISO,
// não como bloqueio.

function pascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function maisDias(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

const cache: Record<number, Set<string>> = {};

function feriadosDoAno(ano: number): Set<string> {
  if (cache[ano]) return cache[ano];
  const fixos = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"];
  const set = new Set<string>(fixos.map((md) => `${ano}-${md}`));
  const pa = pascoa(ano);
  set.add(iso(maisDias(pa, -48))); // Carnaval (segunda)
  set.add(iso(maisDias(pa, -47))); // Carnaval (terça)
  set.add(iso(maisDias(pa, -2))); // Sexta-feira Santa
  set.add(iso(maisDias(pa, 60))); // Corpus Christi
  cache[ano] = set;
  return set;
}

/** True se a data ISO (YYYY-MM-DD) for dia útil bancário nacional. */
export function ehDiaUtilBancario(isoData: string): boolean {
  if (!isoData) return true;
  const [a, m, d] = isoData.split("-").map(Number);
  const dt = new Date(a, m - 1, d);
  const dow = dt.getDay();
  if (dow === 0 || dow === 6) return false; // domingo / sábado
  return !feriadosDoAno(a).has(isoData);
}

/** Rótulo do motivo de não ser dia útil (ou null se for). */
export function motivoNaoUtil(isoData: string): string | null {
  if (!isoData) return null;
  const [a, m, d] = isoData.split("-").map(Number);
  const dow = new Date(a, m - 1, d).getDay();
  if (dow === 0) return "domingo";
  if (dow === 6) return "sábado";
  if (feriadosDoAno(a).has(isoData)) return "feriado";
  return null;
}

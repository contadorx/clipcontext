import { cookies } from "next/headers";

export type Preset = "mes" | "3meses" | "ano";

const MESES = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

function ymd(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function getPeriodo() {
  const preset = ((cookies().get("fx_periodo")?.value as Preset) || "mes") as Preset;
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  if (preset === "ano") {
    return { preset, de: ymd(y, 0, 1), ate: ymd(y, 11, 31), label: String(y) };
  }
  if (preset === "3meses") {
    const ini = new Date(y, m - 2, 1);
    const fimDia = new Date(y, m + 1, 0).getDate();
    return {
      preset,
      de: ymd(ini.getFullYear(), ini.getMonth(), 1),
      ate: ymd(y, m, fimDia),
      label: `${MESES[ini.getMonth()]}–${MESES[m]}/${y}`,
    };
  }
  const fimDia = new Date(y, m + 1, 0).getDate();
  return { preset, de: ymd(y, m, 1), ate: ymd(y, m, fimDia), label: `${MESES[m]}/${y}` };
}

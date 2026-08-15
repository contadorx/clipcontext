// Atalhos de digitação para campos de data.
// O campo mais usado do sistema — digitar 2 caracteres em vez de abrir o calendário.
//
//   ""            -> hoje
//   "hoje"        -> hoje
//   "ontem"       -> ontem
//   "amanha"      -> amanhã
//   "+30" / "30d" -> hoje + 30 dias
//   "-7"          -> hoje − 7 dias
//   "15"          -> dia 15 do mês corrente (ou do próximo, se já passou e o usuário digitou só o dia)
//   "15/09"       -> 15 de setembro do ano corrente
//   "15/09/26"    -> 15/09/2026
//   "15/09/2026"  -> 15/09/2026
//   "fim"         -> último dia do mês corrente
//   "fimprox"     -> último dia do mês seguinte
//
// Sempre devolve ISO (yyyy-mm-dd) — formato que os <input type="date"> e o Supabase esperam.

function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dia}`;
}

function hojeLocal(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

/**
 * Interpreta o que o usuário digitou num campo de data.
 * Devolve ISO (yyyy-mm-dd) ou null quando não entendeu — nesse caso o chamador
 * deve manter o valor anterior em vez de apagar o campo.
 */
export function parseDataAtalho(entrada: string, base?: Date): string | null {
  const hoje = base ? new Date(base.getFullYear(), base.getMonth(), base.getDate()) : hojeLocal();
  const s = (entrada || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // tira acento: "amanhã" -> "amanha"

  if (!s || s === "hoje" || s === "h") return iso(hoje);

  if (s === "ontem") {
    const d = new Date(hoje);
    d.setDate(d.getDate() - 1);
    return iso(d);
  }
  if (s === "amanha" || s === "a") {
    const d = new Date(hoje);
    d.setDate(d.getDate() + 1);
    return iso(d);
  }
  if (s === "fim" || s === "fimmes") return iso(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0));
  if (s === "fimprox") return iso(new Date(hoje.getFullYear(), hoje.getMonth() + 2, 0));
  if (s === "inicio") return iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1));

  // já veio em ISO (do próprio input date)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // +30 / -7 / 30d / 45 dias
  const rel = s.match(/^([+-]?)(\d{1,4})\s*(d|dias?)?$/);
  if (rel) {
    const [, sinal, n, sufixo] = rel;
    const num = parseInt(n, 10);
    // "15" sem sinal e sem sufixo = dia do mês; "+15", "15d" e "15 dias" = deslocamento
    if (!sinal && !sufixo) {
      if (num >= 1 && num <= 31) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth(), num);
        // dia inválido para o mês (ex.: 31 em fevereiro) -> último dia do mês
        if (d.getMonth() !== hoje.getMonth()) return iso(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0));
        return iso(d);
      }
      return null;
    }
    const d = new Date(hoje);
    d.setDate(d.getDate() + (sinal === "-" ? -num : num));
    return iso(d);
  }

  // dd/mm  ·  dd/mm/aa  ·  dd/mm/aaaa  (aceita "-" e "." como separador)
  const br = s.match(/^(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2}|\d{4}))?$/);
  if (br) {
    const dia = parseInt(br[1], 10);
    const mes = parseInt(br[2], 10);
    if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return null;
    let ano = hoje.getFullYear();
    if (br[3]) ano = br[3].length === 2 ? 2000 + parseInt(br[3], 10) : parseInt(br[3], 10);
    const d = new Date(ano, mes - 1, dia);
    if (d.getMonth() !== mes - 1) return null; // 31/02 etc.
    return iso(d);
  }

  return null;
}

// A formatação de data mora em lib/formato.ts. Reexportado aqui porque várias
// telas importam `dataBR` junto com `parseDataAtalho` — duas definições da
// mesma função é como elas começam a divergir.
// Caminho relativo (e não o alias @/) porque o script de testes compila este
// arquivo isoladamente, sem o tsconfig que resolve o alias.
export { dataBR } from "./formato";

/** Texto de ajuda padrão, para reaproveitar nos campos. */
export const AJUDA_DATA = "Atalhos: hoje · +30 · 15 (dia do mês) · 15/09 · fim (fim do mês)";

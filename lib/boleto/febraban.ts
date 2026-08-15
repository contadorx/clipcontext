// Matemática do boleto bancário (padrão FEBRABAN).
// Código de barras 44 posições: banco(3) moeda(1) DVgeral(1) fator(4) valor(10) campoLivre(25).
// Linha digitável 47 posições com DVs módulo 10 por campo e DV geral módulo 11.

export function soDigitos(s: string): string {
  return (s ?? "").replace(/\D/g, "");
}

export function pad(s: string | number, n: number): string {
  return String(s).replace(/\D/g, "").padStart(n, "0").slice(-n);
}

// Módulo 10 (FEBRABAN): da direita p/ esquerda ×2,×1...; produto >9 soma algarismos.
export function mod10(num: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = num.length - 1; i >= 0; i--) {
    let p = Number(num[i]) * peso;
    if (p > 9) p = Math.floor(p / 10) + (p % 10);
    soma += p;
    peso = peso === 2 ? 1 : 2;
  }
  return (10 - (soma % 10)) % 10;
}

// Módulo 11 (DV geral do código de barras): pesos 2..9 cíclicos da direita.
// Resultado 0, 10 ou 11 vira 1 (regra FEBRABAN).
export function mod11Geral(num: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = num.length - 1; i >= 0; i--) {
    soma += Number(num[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const dv = 11 - (soma % 11);
  return dv === 0 || dv === 10 || dv === 11 ? 1 : dv;
}

// Módulo 11 "comum" (usado em DV de nosso número de vários bancos):
// pesos 2..N cíclicos; quem chama trata os restos especiais.
export function mod11Resto(num: string, pesoMax = 9): number {
  let soma = 0;
  let peso = 2;
  for (let i = num.length - 1; i >= 0; i--) {
    soma += Number(num[i]) * peso;
    peso = peso === pesoMax ? 2 : peso + 1;
  }
  return soma % 11;
}

// Fator de vencimento. Rolagem oficial FEBRABAN: 21/02/2025 = 9999 e
// 22/02/2025 recomeça em 1000. Vencimentos atuais usam a base nova.
const BASE_NOVA = Date.UTC(2025, 1, 22); // 22/02/2025
const BASE_ANTIGA = Date.UTC(1997, 9, 7); // 07/10/1997
export function fatorVencimento(vencISO: string): string {
  const [a, m, d] = vencISO.slice(0, 10).split("-").map(Number);
  const data = Date.UTC(a, m - 1, d);
  const dia = 24 * 3600 * 1000;
  if (data >= BASE_NOVA) {
    return pad(1000 + Math.round((data - BASE_NOVA) / dia), 4);
  }
  // títulos antigos (pré-rolagem)
  return pad(Math.round((data - BASE_ANTIGA) / dia), 4);
}

export function valor10(valor: number): string {
  return pad(Math.round(valor * 100), 10);
}

// Monta o código de barras (44) a partir de banco, vencimento, valor e campo livre.
export function montarCodigoBarras(banco: string, vencISO: string, valor: number, campoLivre: string): string {
  if (campoLivre.length !== 25) throw new Error(`Campo livre deve ter 25 posições (veio ${campoLivre.length}).`);
  const b = pad(banco, 3);
  const fator = fatorVencimento(vencISO);
  const v = valor10(valor);
  const semDv = `${b}9${fator}${v}${campoLivre}`; // posição do DV preenchida depois
  const dv = mod11Geral(`${b}9${fator}${v}${campoLivre}`);
  return `${b}9${dv}${fator}${v}${campoLivre}`;
  void semDv;
}

// Linha digitável (47) a partir do código de barras (44).
export function linhaDigitavel(barras: string): string {
  if (barras.length !== 44) throw new Error("Código de barras deve ter 44 posições.");
  const banco = barras.slice(0, 3);
  const moeda = barras.slice(3, 4);
  const dvGeral = barras.slice(4, 5);
  const fator = barras.slice(5, 9);
  const valor = barras.slice(9, 19);
  const cl = barras.slice(19, 44);

  const c1 = `${banco}${moeda}${cl.slice(0, 5)}`;
  const c2 = cl.slice(5, 15);
  const c3 = cl.slice(15, 25);
  const f1 = `${c1}${mod10(c1)}`;
  const f2 = `${c2}${mod10(c2)}`;
  const f3 = `${c3}${mod10(c3)}`;
  return (
    `${f1.slice(0, 5)}.${f1.slice(5)} ` +
    `${f2.slice(0, 5)}.${f2.slice(5)} ` +
    `${f3.slice(0, 5)}.${f3.slice(5)} ` +
    `${dvGeral} ` +
    `${fator}${valor}`
  );
}

// ---- Código de barras visual: Interleaved 2 of 5 (ITF) ----
// Retorna sequência de módulos [largura, éBarra] para desenhar em SVG.
// n = estreito (1), w = largo (2.5x). Dígitos codificados aos pares.
const ITF: Record<string, string> = {
  "0": "nnwwn",
  "1": "wnnnw",
  "2": "nwnnw",
  "3": "wwnnn",
  "4": "nnwnw",
  "5": "wnwnn",
  "6": "nwwnn",
  "7": "nnnww",
  "8": "wnnwn",
  "9": "nwnwn",
};
export function itfModulos(digitos: string): { w: number; bar: boolean }[] {
  if (digitos.length % 2 !== 0) digitos = "0" + digitos;
  const N = 1;
  const W = 2.5;
  const out: { w: number; bar: boolean }[] = [];
  // start: barra n, espaço n, barra n, espaço n
  out.push({ w: N, bar: true }, { w: N, bar: false }, { w: N, bar: true }, { w: N, bar: false });
  for (let i = 0; i < digitos.length; i += 2) {
    const a = ITF[digitos[i]];
    const b = ITF[digitos[i + 1]];
    for (let j = 0; j < 5; j++) {
      out.push({ w: a[j] === "w" ? W : N, bar: true });
      out.push({ w: b[j] === "w" ? W : N, bar: false });
    }
  }
  // stop: barra w, espaço n, barra n
  out.push({ w: W, bar: true }, { w: N, bar: false }, { w: N, bar: true });
  return out;
}

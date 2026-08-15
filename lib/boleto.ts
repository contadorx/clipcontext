// Validação da linha digitável de boleto bancário (47 dígitos).
// Confere os 3 dígitos verificadores de campo (módulo 10), que pegam a maior
// parte dos erros de digitação antes de a remessa ir para o banco.
// (O DV geral por módulo 11 do código de barras foi deixado de fora de
// propósito: a remontagem do código é a parte arriscada e, errada, bloquearia
// boletos válidos — o ganho aqui já é grande sem esse risco.)

function soDig(v: string): string {
  return (v || "").replace(/\D/g, "");
}

function modulo10(campo: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = campo.length - 1; i >= 0; i--) {
    let n = parseInt(campo[i], 10) * peso;
    if (n > 9) n = Math.floor(n / 10) + (n % 10);
    soma += n;
    peso = peso === 2 ? 1 : 2;
  }
  const resto = soma % 10;
  return resto === 0 ? 0 : 10 - resto;
}

/** Valida os dígitos verificadores de uma linha digitável de boleto bancário (47 dígitos). */
export function linhaDigitavelValida(linhaRaw: string): boolean {
  const l = soDig(linhaRaw);
  if (l.length !== 47) return false;
  if (modulo10(l.slice(0, 9)) !== Number(l[9])) return false;
  if (modulo10(l.slice(10, 20)) !== Number(l[20])) return false;
  if (modulo10(l.slice(21, 31)) !== Number(l[31])) return false;
  return true;
}

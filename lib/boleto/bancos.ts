// Campo livre (25 posições) e formatação do nosso número por banco.
// Estruturas conforme manuais de cobrança CNAB de cada banco.
// IMPORTANTE: toda implantação de cobrança passa por homologação no banco —
// confira o primeiro boleto/remessa com o gerente antes de enviar a clientes.

import { mod10, mod11Resto, pad } from "@/lib/boleto/febraban";

export type DadosCobranca = {
  bancoCodigo: string; // 341, 001, 237, 033, 104, 756
  agencia: string;
  agenciaDv?: string | null;
  conta: string;
  contaDv?: string | null;
  convenio?: string | null; // código do cedente/beneficiário no banco
  carteira: string;
  nossoNumero: number; // sequencial reservado pela conta
};

export type TituloBanco = {
  campoLivre: string; // 25 posições
  nossoNumeroFmt: string; // como exibir no boleto (com DV quando houver)
};

type Builder = (d: DadosCobranca) => TituloBanco;

// ---------- Itaú (341) ----------
// NN 8 dígitos · DAC = mod10(agência4 + conta5 + carteira3 + NN8)
// CL: carteira(3) NN(8) DAC(1) agência(4) conta(5) DAC ag/conta(1) "000"
const itau: Builder = (d) => {
  const ag = pad(d.agencia, 4);
  const cc = pad(d.conta, 5);
  const cart = pad(d.carteira, 3);
  const nn = pad(d.nossoNumero, 8);
  const dacNN = mod10(`${ag}${cc}${cart}${nn}`);
  const dacAgCc = mod10(`${ag}${cc}`);
  return {
    campoLivre: `${cart}${nn}${dacNN}${ag}${cc}${dacAgCc}000`,
    nossoNumeroFmt: `${cart}/${nn}-${dacNN}`,
  };
};

// ---------- Banco do Brasil (001), convênio de 7 dígitos ----------
// NN 17 = convênio(7) + sequencial(10), sem DV exibido
// CL: "000000" + NN(17) + carteira(2)
const bb: Builder = (d) => {
  const conv = pad(d.convenio ?? "", 7);
  const nn = `${conv}${pad(d.nossoNumero, 10)}`;
  return {
    campoLivre: `000000${nn}${pad(d.carteira, 2)}`,
    nossoNumeroFmt: nn,
  };
};

// ---------- Bradesco (237) ----------
// NN 11 · DV = mod11 base 7 de carteira(2)+NN(11); resto 0 → "0", resto 1 → "P"
// CL: agência(4) carteira(2) NN(11) conta(7) "0"
const bradesco: Builder = (d) => {
  const ag = pad(d.agencia, 4);
  const cart = pad(d.carteira, 2);
  const nn = pad(d.nossoNumero, 11);
  const resto = mod11Resto(`${cart}${nn}`, 7);
  const dv = resto === 0 ? "0" : resto === 1 ? "P" : String(11 - resto);
  return {
    campoLivre: `${ag}${cart}${nn}${pad(d.conta, 7)}0`,
    nossoNumeroFmt: `${cart}/${nn}-${dv}`,
  };
};

// ---------- Santander (033) ----------
// NN 13 = sequencial(12) + DV mod11; DV >9 → 0
// CL: "9" + código do cedente(7) + NN(13) + IOF "0" + carteira(3)
const santander: Builder = (d) => {
  const seq = pad(d.nossoNumero, 12);
  const resto = mod11Resto(seq, 9);
  const dvCalc = 11 - resto;
  const dv = dvCalc > 9 ? 0 : dvCalc;
  const nn = `${seq}${dv}`;
  return {
    campoLivre: `9${pad(d.convenio ?? "", 7)}${nn}0${pad(d.carteira, 3)}`,
    nossoNumeroFmt: `${seq}-${dv}`,
  };
};

// ---------- Caixa (104, SIGCB) ----------
// NN 17 = modalidade(2, ex.: 14 registrada) + sequencial(15)
// CL: beneficiário(6) DV(1) NN[3..5](3) "1"? — estrutura SIGCB:
//   beneficiário(6) + DVbenef(1) + seq1(3) + const1(1) + seq2(3) + const2(1) + seq3(9) + DVcl(1)
// onde NN(17) = const1 + const2 + seq1+seq2+seq3 rearranjados conforme manual.
// ATENÇÃO: conferir na homologação com a CAIXA antes de uso em produção.
const caixa: Builder = (d) => {
  const benef = pad(d.convenio ?? "", 6);
  const dvBenef = (() => {
    const r = mod11Resto(benef, 9);
    const dv = 11 - r;
    return dv > 9 ? 0 : dv;
  })();
  const modalidade = pad(d.carteira || "14", 2); // 14 = cobrança registrada (carteira informa a modalidade)
  const seq15 = pad(d.nossoNumero, 15);
  const nn17 = `${modalidade}${seq15}`;
  const seq1 = nn17.slice(2, 5);
  const seq2 = nn17.slice(5, 8);
  const seq3 = nn17.slice(8, 17);
  const const1 = nn17.slice(0, 1);
  const const2 = nn17.slice(1, 2);
  const semDv = `${benef}${dvBenef}${seq1}${const1}${seq2}${const2}${seq3}`;
  const rCl = mod11Resto(semDv, 9);
  const dvCl = 11 - rCl > 9 ? 0 : 11 - rCl;
  return {
    campoLivre: `${semDv}${dvCl}`,
    nossoNumeroFmt: nn17,
  };
};

// ---------- Sicoob (756) ----------
// NN 8 = sequencial(7) + DV (mod11 com pesos da constante "3197")
// CL: carteira(1) agência(4) modalidade(2) convênio(7) NN(8) parcela(3 = "001")
// ATENÇÃO: conferir na homologação com o Sicoob antes de uso em produção.
const sicoob: Builder = (d) => {
  const ag = pad(d.agencia, 4);
  const conv = pad(d.convenio ?? "", 7);
  const seq = pad(d.nossoNumero, 7);
  // DV Sicoob: base = agência(4)+convênio(10)+seq(7), pesos repetindo 3,1,9,7
  const base = `${ag}${pad(d.convenio ?? "", 10)}${seq}`;
  const pesos = [3, 1, 9, 7];
  let soma = 0;
  for (let i = 0; i < base.length; i++) soma += Number(base[i]) * pesos[i % 4];
  const resto = soma % 11;
  const dv = resto === 0 || resto === 1 ? 0 : 11 - resto;
  const nn = `${seq}${dv}`;
  const carteira1 = pad(d.carteira || "1", 1);
  return {
    campoLivre: `${carteira1}${ag}01${conv}${nn}001`,
    nossoNumeroFmt: `${seq}-${dv}`,
  };
};

// ---------- Sicredi (748) ----------
// NN 9 = ano(2) + byte(1, "2" = gerado pelo beneficiário) + sequencial(5) + DV
// DV do NN: mod11 sobre agência(4)+posto(2)+cedente(5)+ano(2)+byte(1)+seq(5)
// CL: tipoCobrança(1,"1") carteira(1,"1") NN(9) agência(4) posto(2) cedente(5)
//     temValor(1,"1") filler(1,"0") DV do campo livre(1, mod11)
// CONVENÇÃO: no campo "Convênio" da conta, informe POSTO(2)+CÓDIGO DO
// BENEFICIÁRIO(5) — ex.: posto 02 e cedente 12345 → 0212345.
const sicredi: Builder = (d) => {
  const ag = pad(d.agencia, 4);
  const conv = pad(d.convenio ?? "", 7);
  const posto = conv.slice(0, 2);
  const cedente = conv.slice(2, 7);
  const ano = String(new Date().getFullYear()).slice(-2);
  const byte = "2";
  const seq = pad(d.nossoNumero, 5);
  const baseNN = `${ag}${posto}${cedente}${ano}${byte}${seq}`;
  const rNN = mod11Resto(baseNN, 9);
  const dvNNCalc = 11 - rNN;
  const dvNN = dvNNCalc > 9 ? 0 : dvNNCalc;
  const nn9 = `${ano}${byte}${seq}${dvNN}`;
  const semDv = `11${nn9}${ag}${posto}${cedente}10`;
  const rCl = mod11Resto(semDv, 9);
  const dvClCalc = 11 - rCl;
  const dvCl = dvClCalc > 9 ? 0 : dvClCalc;
  return {
    campoLivre: `${semDv}${dvCl}`,
    nossoNumeroFmt: `${ano}/${byte}${seq}-${dvNN}`,
  };
};

// ---------- Banrisul (041) ----------
// NN 8 + duplo dígito "NC" (mod10 e mod11 encadeados, com ajuste no resto 1)
// CL: produto(1,"2") constante(1,"1") agência(4) cedente(7) NN(8) "40" + NC(2)
const dvDuploBanrisul = (base: string): string => {
  let dv1 = mod10(base);
  for (;;) {
    const resto = mod11Resto(`${base}${dv1}`, 9);
    if (resto === 1) {
      dv1 = dv1 === 9 ? 0 : dv1 + 1; // ajusta o 1º DV e recalcula
      continue;
    }
    const dv2 = resto === 0 ? 0 : 11 - resto;
    return `${dv1}${dv2}`;
  }
};
const banrisul: Builder = (d) => {
  const ag = pad(d.agencia, 4);
  const cedente = pad(d.convenio ?? d.conta, 7);
  const nn = pad(d.nossoNumero, 8);
  const base = `21${ag}${cedente}${nn}40`;
  const nc = dvDuploBanrisul(base);
  return {
    campoLivre: `${base}${nc}`,
    nossoNumeroFmt: `${nn}-${nc}`,
  };
};

// ---------- Safra (422) ----------
// NN 9 = sequencial(8) + DV mod11
// CL: "7"(1) agência(5) conta(9) NN(9) "2"(1)
const safra: Builder = (d) => {
  const seq = pad(d.nossoNumero, 8);
  const resto = mod11Resto(seq, 9);
  const dvCalc = 11 - resto;
  const dv = dvCalc > 9 ? 0 : dvCalc;
  const nn = `${seq}${dv}`;
  const ag = pad(`${d.agencia}${d.agenciaDv ?? ""}`, 5);
  const cc = pad(`${d.conta}${d.contaDv ?? ""}`, 9);
  return {
    campoLivre: `7${ag}${cc}${nn}2`,
    nossoNumeroFmt: `${seq}-${dv}`,
  };
};

export const BANCOS_COBRANCA: Record<string, { nome: string; builder: Builder; homologar?: boolean }> = {
  "341": { nome: "Itaú", builder: itau },
  "001": { nome: "Banco do Brasil", builder: bb },
  "237": { nome: "Bradesco", builder: bradesco },
  "033": { nome: "Santander", builder: santander },
  "104": { nome: "Caixa", builder: caixa, homologar: true },
  "756": { nome: "Sicoob", builder: sicoob, homologar: true },
  "748": { nome: "Sicredi", builder: sicredi, homologar: true },
  "041": { nome: "Banrisul", builder: banrisul, homologar: true },
  "422": { nome: "Safra", builder: safra, homologar: true },
};

export function montarTitulo(d: DadosCobranca): TituloBanco {
  const banco = BANCOS_COBRANCA[pad(d.bancoCodigo, 3)];
  if (!banco) throw new Error(`Banco ${d.bancoCodigo} sem suporte de cobrança ainda.`);
  return banco.builder(d);
}

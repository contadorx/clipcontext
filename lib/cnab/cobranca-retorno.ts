// Retorno CNAB 240 de COBRANÇA: segmentos T (título + código de movimento)
// e U (valores pagos e datas). É com ele que a liquidação dá baixa automática.

export type RetornoCobrancaItem = {
  nossoNumeroDigitos: string; // dígitos do campo 38-57 do T (pode incluir DV)
  seuNumero: string; // T 59-73 (uso da empresa quando devolvido) — apoio ao casamento
  movimento: string; // 02 entrada, 03 rejeitada, 06 liquidação, 09 baixa, 17 liq. após baixa...
  valorPago: number;
  jurosMulta: number;
  dataOcorrencia: string | null; // yyyy-mm-dd
  dataCredito: string | null;
  motivos: string[]; // códigos de motivo (T 214-223, pares de 2)
};

export const MOVIMENTOS_COBRANCA: Record<string, string> = {
  "02": "Entrada confirmada (registrado)",
  "03": "Entrada rejeitada",
  "04": "Transferência de carteira (entrada)",
  "06": "Liquidação",
  "09": "Baixa",
  "12": "Confirmação de abatimento",
  "17": "Liquidação após baixa",
  "19": "Confirmação de protesto",
  "23": "Remessa a cartório",
  "26": "Instrução rejeitada",
  "27": "Confirmação de alteração",
  "28": "Débito de tarifas",
  "30": "Alteração rejeitada",
};

function dataDdmmaaaa(s: string): string | null {
  const d = s.replace(/\D/g, "");
  if (d.length !== 8 || d === "00000000") return null;
  return `${d.slice(4, 8)}-${d.slice(2, 4)}-${d.slice(0, 2)}`;
}
function cent(s: string): number {
  const n = Number(s.replace(/\D/g, ""));
  return Number.isFinite(n) ? n / 100 : 0;
}

export function parseRetornoCobranca(conteudo: string): { itens: RetornoCobrancaItem[]; ehRetornoCobranca: boolean } {
  const linhas = conteudo.split(/\r?\n/).filter((l) => l.length >= 230);
  let ehRetornoCobranca = false;
  const itens: RetornoCobrancaItem[] = [];
  let atual: RetornoCobrancaItem | null = null;

  for (const l of linhas) {
    const tipoRegistro = l[7];
    if (tipoRegistro === "1") {
      // header de lote: serviço 01 = cobrança
      if (l.slice(9, 11) === "01") ehRetornoCobranca = true;
      continue;
    }
    if (tipoRegistro !== "3") continue;
    const seg = l[13];
    if (seg === "T") {
      const motivosRaw = l.slice(213, 223);
      const motivos: string[] = [];
      for (let i = 0; i < 10; i += 2) {
        const m = motivosRaw.slice(i, i + 2).trim();
        if (m && m !== "00") motivos.push(m);
      }
      atual = {
        nossoNumeroDigitos: l.slice(37, 57).replace(/\D/g, ""),
        seuNumero: l.slice(58, 73).trim(),
        movimento: l.slice(15, 17),
        valorPago: 0,
        jurosMulta: 0,
        dataOcorrencia: null,
        dataCredito: null,
        motivos,
      };
      itens.push(atual);
    } else if (seg === "U" && atual) {
      atual.jurosMulta = cent(l.slice(17, 32));
      atual.valorPago = cent(l.slice(77, 92));
      atual.dataOcorrencia = dataDdmmaaaa(l.slice(137, 145));
      atual.dataCredito = dataDdmmaaaa(l.slice(145, 153));
      atual = null;
    }
  }
  return { itens, ehRetornoCobranca };
}

// Casa o nosso número do retorno com o sequencial do título.
// Bancos devolvem o campo com DV e/ou prefixos (carteira, convênio, modalidade);
// testa o valor cheio, sem o DV final, e as caudas dos tamanhos usados
// (8 Itaú, 10 BB, 11 Bradesco, 12 Santander, 15 Caixa, 7 Sicoob).
export function casaNossoNumero(retornoDigitos: string, nossoNumero: number): boolean {
  const nn = String(nossoNumero);
  const limpa = (s: string) => s.replace(/^0+/, "") || "0";
  // Sicredi: ano(2)+byte(1)+seq(5)+DV(1) = 9 dígitos, sequencial no meio
  if (retornoDigitos.length === 9 && limpa(retornoDigitos.slice(3, 8)) === nn) return true;
  // cortes do fim: 0 (cheio), 1 (DV), 3 (DV + parcela, Sicoob)
  for (const corte of [0, 1, 3]) {
    const base = corte > 0 ? retornoDigitos.slice(0, -corte) : retornoDigitos;
    if (!base) continue;
    if (limpa(base) === nn) return true;
    for (const len of [7, 8, 10, 11, 12, 15]) {
      if (limpa(base.slice(-len)) === nn) return true;
    }
  }
  return false;
}

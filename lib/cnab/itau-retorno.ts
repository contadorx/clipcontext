// Parser do arquivo RETORNO CNAB 240 do Itaú (SISPAG).
// Lê os segmentos A (transferências/Pix) e J (boletos), extraindo "seu número"
// (para casar com o lançamento), ocorrências, valor e data efetivos.

export type RetornoItem = {
  segmento: "A" | "J";
  seuNumero: string;
  nossoNumero: string;
  ocorrencias: string[];
  efetuado: boolean; // ocorrência "00"
  valor: number; // reais
  dataEfetiva: string | null; // ISO YYYY-MM-DD
};

// Descrição amigável das ocorrências mais comuns (Nota 8 do manual).
export const OCORRENCIAS: Record<string, string> = {
  "00": "Pagamento efetuado",
  BD: "Pagamento agendado",
  CE: "Pagamento cancelado",
  NA: "Cancelado por falta de autorização",
  SS: "Cancelado por saldo insuficiente / limite excedido",
  AE: "Data de pagamento alterada",
  IR: "Pagamento alterado",
  RJ: "Registro rejeitado",
  BI: "CNPJ/CPF do favorecido inválido",
  AN: "Conta do favorecido inválida",
  AM: "Agência do favorecido inválida",
  AL: "Banco do favorecido inválido",
  II: "Data de vencimento inválida / QR expirado",
};

export function descreveOcorrencia(cod: string): string {
  return OCORRENCIAS[cod] ?? cod;
}

function parseData(ddmmaaaa: string): string | null {
  const s = (ddmmaaaa || "").trim();
  if (!/^\d{8}$/.test(s) || s === "00000000") return null;
  const dd = s.slice(0, 2);
  const mm = s.slice(2, 4);
  const aaaa = s.slice(4, 8);
  return `${aaaa}-${mm}-${dd}`;
}

export function parseRetornoItau(conteudo: string): { itens: RetornoItem[]; ehRetorno: boolean } {
  let linhas = conteudo.split(/\r?\n/).filter((l) => l.length >= 240);
  if (linhas.length === 0 && conteudo.length >= 240) {
    linhas = [];
    for (let i = 0; i + 240 <= conteudo.length; i += 240) linhas.push(conteudo.slice(i, i + 240));
  }

  const header = linhas[0] || "";
  const ehRetorno = header.slice(7, 8) === "0" && header.slice(142, 143) === "2";

  const itens: RetornoItem[] = [];
  for (const l of linhas) {
    if (l[7] !== "3") continue;
    const seg = l[13];
    if (seg !== "A" && seg !== "J") continue;
    if (seg === "J" && l.slice(17, 19) === "52") continue; // J-52 é complemento

    const ocStr = l.slice(230, 240);
    const ocorrencias: string[] = [];
    for (let i = 0; i < 10; i += 2) {
      const c = ocStr.slice(i, i + 2).trim();
      if (c) ocorrencias.push(c);
    }

    let seuNumero: string;
    let nossoNumero: string;
    let dataStr: string;
    let valorStr: string;

    if (seg === "A") {
      seuNumero = l.slice(73, 93).trim();
      nossoNumero = l.slice(134, 149).trim();
      dataStr = l.slice(154, 162); // data efetiva
      valorStr = l.slice(162, 177); // valor efetivo
      if (parseData(dataStr) === null) dataStr = l.slice(93, 101); // fallback: data prevista
      if (parseInt(valorStr || "0", 10) === 0) valorStr = l.slice(119, 134); // fallback: valor previsto
    } else {
      seuNumero = l.slice(182, 202).trim();
      nossoNumero = l.slice(215, 230).trim();
      dataStr = l.slice(144, 152); // data pagamento
      valorStr = l.slice(152, 167); // valor pagamento
    }

    itens.push({
      segmento: seg,
      seuNumero,
      nossoNumero,
      ocorrencias,
      efetuado: ocorrencias.includes("00"),
      valor: parseInt(valorStr || "0", 10) / 100,
      dataEfetiva: parseData(dataStr),
    });
  }

  return { itens, ehRetorno };
}

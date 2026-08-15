// Gerador de remessa CNAB 240 do Bradesco (237) — pagamento.
// Baseado no "Manual de Procedimentos Multipag Bradesco (240 posições)", v6 jul/2023,
// sobre o motor FEBRABAN compartilhado (./febraban240).
//
// Implementa:
//  - Crédito em conta/poupança e TED a fornecedor (Segmento A + Segmento B — no
//    Bradesco o B é OBRIGATÓRIO no pagamento por crédito/TED, não só no Pix);
//  - Pagamento de boletos bancários (Segmento J + J-52).
// NÃO implementa Pix (fica para depois) nem tributos (Segmentos N/O).
//
// HOMOLOGAÇÃO: o Bradesco valida o arquivo pelo Validador Universal / gerência (não
// há marca 'TS' no arquivo como no BB). O parâmetro `teste` é aceito por simetria de
// API com os demais bancos, mas não altera o conteúdo.
//
// Particularidades do Bradesco respeitadas aqui:
//  - Header de lote de PAGAMENTO usa layout '045' e leva '01' em 223-224 (indicativo
//    de forma de pagamento); o header de lote de TÍTULOS usa layout '040' sem isso.
//  - Segmento J leva o código de moeda (Real = '09') em 223-224.
//  - J-52: posição 15 em branco; código de movimento em 16-17.
//  - Ocorrências (231-240) na remessa ficam em branco (o manual não pede zeros).

import {
  so,
  txt,
  num,
  valorCent,
  ddmmaaaa,
  dataHoje,
  horaAgora,
  linhaParaBarras,
  registro,
} from "./febraban240";
import type { TransferenciaCnab, BoletoCnab, RemessaResultado } from "./itau-pagamento";

const COD = "237";
const NOME_BANCO = "BANCO BRADESCO SA";
const VERSAO_ARQ = "089";
const VERSAO_LOTE_PAG = "045"; // header de lote de pagamento (crédito/TED)
const VERSAO_LOTE_TIT = "040"; // header de lote de títulos (boletos)

export type PagadorBradesco = {
  documento: string; // CNPJ/CPF do pagador (debitado)
  nome: string;
  agencia: string;
  agenciaDv?: string | null;
  contaNumero: string;
  contaDv?: string | null;
  convenio: string; // Código do Convênio no Banco (33-52, alfa)
};

// Dígito verificador: último caractere, em maiúsculo (X), ou branco se vazio.
const dvUp = (v?: string | null) => String(v ?? "").trim().toUpperCase().slice(-1) || " ";
// Convênio (33-52, 20 alfa): à esquerda com brancos à direita.
const campoConvenio = (c: string) => txt(c, 20);

function headerArquivo(p: PagadorBradesco, agora: Date): string {
  const tipoInsc = so(p.documento).length === 14 ? "2" : "1";
  const r = registro();
  r.put(1, 3, COD);
  r.put(4, 4, "0000");
  r.put(8, 1, "0");
  // 9-17 CNAB brancos
  r.put(18, 1, tipoInsc);
  r.put(19, 14, num(p.documento, 14));
  r.put(33, 20, campoConvenio(p.convenio));
  r.put(53, 5, num(p.agencia, 5));
  r.put(58, 1, dvUp(p.agenciaDv));
  r.put(59, 12, num(p.contaNumero, 12));
  r.put(71, 1, dvUp(p.contaDv));
  // 72 DV ag/conta — branco
  r.put(73, 30, txt(p.nome, 30));
  r.put(103, 30, txt(NOME_BANCO, 30));
  // 133-142 CNAB brancos
  r.put(143, 1, "1"); // remessa
  r.put(144, 8, dataHoje(agora));
  r.put(152, 6, horaAgora(agora));
  r.put(158, 6, num(1, 6)); // NSA
  r.put(164, 3, VERSAO_ARQ);
  r.put(167, 5, "00000"); // densidade
  // 172-240 brancos (identificação Pix / reservados)
  return r.build();
}

function trailerArquivo(qtdLotes: number, qtdRegistros: number): string {
  const r = registro();
  r.put(1, 3, COD);
  r.put(4, 4, "9999");
  r.put(8, 1, "9");
  r.put(18, 6, num(qtdLotes, 6));
  r.put(24, 6, num(qtdRegistros, 6));
  r.put(30, 6, "000000"); // qtd. de contas p/ conciliação
  return r.build();
}

// Header de lote. titulos=false → pagamento (crédito/TED): layout '045' + '01' em 223-224.
// titulos=true → títulos de cobrança (boletos): layout '040', sem o indicativo.
function headerLote(
  p: PagadorBradesco,
  lote: number,
  tipoServico: string,
  forma: string,
  titulos: boolean,
): string {
  const tipoInsc = so(p.documento).length === 14 ? "2" : "1";
  const r = registro();
  r.put(1, 3, COD);
  r.put(4, 4, num(lote, 4));
  r.put(8, 1, "1");
  r.put(9, 1, "C");
  r.put(10, 2, tipoServico);
  r.put(12, 2, forma);
  r.put(14, 3, titulos ? VERSAO_LOTE_TIT : VERSAO_LOTE_PAG);
  // 17 CNAB branco
  r.put(18, 1, tipoInsc);
  r.put(19, 14, num(p.documento, 14));
  r.put(33, 20, campoConvenio(p.convenio));
  r.put(53, 5, num(p.agencia, 5));
  r.put(58, 1, dvUp(p.agenciaDv));
  r.put(59, 12, num(p.contaNumero, 12));
  r.put(71, 1, dvUp(p.contaDv));
  // 72 DV ag/conta — branco; 73-102 nome; 103-222 mensagem/endereço (opcionais, brancos)
  r.put(73, 30, txt(p.nome, 30));
  if (!titulos) r.put(223, 2, "01"); // indicativo de forma de pagamento (só no header de pagamento)
  // 231-240 ocorrências: na remessa, brancos
  return r.build();
}

function trailerLote(lote: number, qtdRegistros: number, somaValor: number): string {
  const r = registro();
  r.put(1, 3, COD);
  r.put(4, 4, num(lote, 4));
  r.put(8, 1, "5");
  r.put(18, 6, num(qtdRegistros, 6)); // header + detalhes + trailer
  r.put(24, 18, valorCent(somaValor, 18));
  r.put(42, 18, num(0, 18)); // somatória qtd. de moeda
  r.put(60, 6, "000000"); // número aviso de débito
  // 231-240 ocorrências: brancos
  return r.build();
}

// Forma de lançamento (header de lote): crédito conta Bradesco '01', poupança '05',
// TED para outro banco '41'.
function formaBradesco(banco: string, tipo?: string | null): "01" | "05" | "41" {
  if (so(banco) === "237") return tipo === "poupanca" ? "05" : "01";
  return "41";
}
// Câmara centralizadora (Segmento A, 18-20): TED '018'; crédito no próprio banco '000'.
function camaraBradesco(forma: string): string {
  return forma === "41" ? "018" : "000";
}

export function gerarRemessaBradescoTransferencias(opts: {
  pagador: PagadorBradesco;
  transferencias: TransferenciaCnab[];
  agora?: Date;
  teste?: boolean;
}): RemessaResultado {
  const { pagador } = opts;
  const agora = opts.agora ?? new Date();
  const ignorados: RemessaResultado["ignorados"] = [];

  type Prep = TransferenciaCnab & { forma: "01" | "05" | "41"; doc: string };
  const prep: Prep[] = [];
  for (const t of opts.transferencias) {
    const banco = so(t.bancoFavorecido);
    const ag = so(t.agenciaFavorecido);
    const cc = so(t.contaFavorecido);
    if (banco.length !== 3 || !ag || !cc) {
      ignorados.push({ descricao: t.nomeFavorecido, motivo: "linha_invalida" });
      continue;
    }
    const doc = so(t.docFavorecido);
    if (doc.length !== 11 && doc.length !== 14) {
      ignorados.push({ descricao: t.nomeFavorecido, motivo: "sem_doc_favorecido" });
      continue;
    }
    prep.push({ ...t, forma: formaBradesco(banco, t.contaTipo), doc });
  }

  const linhas: string[] = [headerArquivo(pagador, agora)];

  const grupos = new Map<"01" | "05" | "41", Prep[]>();
  for (const p of prep) {
    const arr = grupos.get(p.forma) ?? [];
    arr.push(p);
    grupos.set(p.forma, arr);
  }

  let lote = 0;
  let totalRegistros = 1; // header de arquivo
  let valorTotal = 0;

  for (const [forma, lista] of Array.from(grupos.entries())) {
    lote++;
    linhas.push(headerLote(pagador, lote, "20", forma, false));
    totalRegistros++;

    let seq = 0;
    let valorLote = 0;
    for (const t of lista) {
      const docFav = so(t.docFavorecido);
      const tipoFav = docFav.length === 14 ? "2" : "1";

      // Segmento A
      seq++;
      {
        const r = registro();
        r.put(1, 3, COD);
        r.put(4, 4, num(lote, 4));
        r.put(8, 1, "3");
        r.put(9, 5, num(seq, 5));
        r.put(14, 1, "A");
        r.put(15, 1, "0"); // tipo de movimento: inclusão
        r.put(16, 2, "00"); // código da instrução
        r.put(18, 3, camaraBradesco(forma));
        r.put(21, 3, num(t.bancoFavorecido, 3));
        r.put(24, 5, num(t.agenciaFavorecido, 5));
        r.put(29, 1, " "); // DV da agência do favorecido (não informado)
        r.put(30, 12, num(t.contaFavorecido, 12));
        r.put(42, 1, dvUp(t.contaDvFavorecido));
        r.put(43, 1, " "); // DV ag/conta
        r.put(44, 30, txt(t.nomeFavorecido, 30));
        r.put(74, 20, txt(t.seuNumero || "", 20));
        r.put(94, 8, ddmmaaaa(t.dataPagamento));
        r.put(102, 3, "BRL");
        r.put(105, 15, "000000000000000"); // quantidade da moeda
        r.put(120, 15, valorCent(t.valor, 15));
        // 135-217 nosso número / data real / valor real / informação 2: brancos
        // 218-219 finalidade doc, 220-224 finalidade TED: brancos (a confirmar p/ TED)
        r.put(230, 1, "0"); // aviso ao favorecido
        // 231-240 ocorrências: brancos na remessa
        linhas.push(r.build());
      }
      // Segmento B (obrigatório no Bradesco)
      seq++;
      {
        const r = registro();
        r.put(1, 3, COD);
        r.put(4, 4, num(lote, 4));
        r.put(8, 1, "3");
        r.put(9, 5, num(seq, 5));
        r.put(14, 1, "B");
        // 15-17 forma de iniciação (Pix): branco para não-Pix
        r.put(18, 1, tipoFav);
        r.put(19, 14, num(docFav, 14));
        // 33-226 dados complementares/endereço; 227-240 SIAPE/ISPB: brancos
        linhas.push(r.build());
      }
      totalRegistros += 2;
      valorLote += t.valor;
    }

    linhas.push(trailerLote(lote, 2 + lista.length * 2, valorLote));
    totalRegistros++;
    valorTotal += valorLote;
  }

  linhas.push(trailerArquivo(lote, totalRegistros + 1));
  return { conteudo: linhas.join("\r\n") + "\r\n", quantidade: prep.length, valorTotal, ignorados };
}

// Forma de lançamento p/ boleto (header de lote): boleto Bradesco '30', outros bancos '31'.
function formaBoletoBradesco(barras: string): "30" | "31" {
  return so(barras).slice(0, 3) === "237" ? "30" : "31";
}

export function gerarRemessaBradescoBoletos(opts: {
  pagador: PagadorBradesco;
  boletos: BoletoCnab[];
  agora?: Date;
  teste?: boolean;
}): RemessaResultado {
  const { pagador } = opts;
  const agora = opts.agora ?? new Date();
  const ignorados: RemessaResultado["ignorados"] = [];

  type Prep = BoletoCnab & { barras: string; doc: string };
  const prep: Prep[] = [];
  for (const b of opts.boletos) {
    const barras = linhaParaBarras(b.linhaDigitavel);
    if (!barras) {
      ignorados.push({ descricao: b.nomeFavorecido, motivo: "linha_invalida" });
      continue;
    }
    const doc = so(b.docFavorecido);
    if (doc.length !== 11 && doc.length !== 14) {
      ignorados.push({ descricao: b.nomeFavorecido, motivo: "sem_doc_favorecido" });
      continue;
    }
    prep.push({ ...b, barras, doc });
  }

  const docPag = so(pagador.documento);
  const tipoPag = docPag.length === 14 ? "2" : "1";
  const linhas: string[] = [headerArquivo(pagador, agora)];

  const grupos = new Map<"30" | "31", Prep[]>();
  for (const p of prep) {
    const f = formaBoletoBradesco(p.barras);
    const arr = grupos.get(f) ?? [];
    arr.push(p);
    grupos.set(f, arr);
  }

  let lote = 0;
  let totalRegistros = 1;
  let valorTotal = 0;

  for (const [forma, lista] of Array.from(grupos.entries())) {
    lote++;
    linhas.push(headerLote(pagador, lote, "98", forma, true)); // títulos: layout '040'
    totalRegistros++;

    let seq = 0;
    let valorLote = 0;
    for (const b of lista) {
      seq++;
      const docFav = so(b.docFavorecido);
      const tipoFav = docFav.length === 14 ? "2" : "1";

      // Segmento J
      {
        const r = registro();
        r.put(1, 3, COD);
        r.put(4, 4, num(lote, 4));
        r.put(8, 1, "3");
        r.put(9, 5, num(seq, 5));
        r.put(14, 1, "J");
        r.put(15, 1, "0"); // tipo de movimento
        r.put(16, 2, "00"); // código da instrução
        r.put(18, 44, b.barras);
        r.put(62, 30, txt(b.nomeFavorecido, 30));
        r.put(92, 8, ddmmaaaa(b.dataPagamento));
        r.put(100, 15, valorCent(b.valor, 15));
        r.put(115, 15, valorCent(0, 15));
        r.put(130, 15, valorCent(0, 15));
        r.put(145, 8, ddmmaaaa(b.dataPagamento));
        r.put(153, 15, valorCent(b.valor, 15));
        r.put(168, 15, "000000000000000"); // quantidade da moeda
        r.put(183, 20, txt(b.seuNumero || "", 20));
        // 203-222 nosso número: branco
        r.put(223, 2, "09"); // código de moeda (Real)
        // 225-230 CNAB brancos; 231-240 ocorrências brancos
        linhas.push(r.build());
      }
      // Segmento J-52
      {
        const r = registro();
        r.put(1, 3, COD);
        r.put(4, 4, num(lote, 4));
        r.put(8, 1, "3");
        r.put(9, 5, num(seq, 5));
        r.put(14, 1, "J");
        // 15 CNAB branco
        r.put(16, 2, "00"); // código de movimento (remessa)
        r.put(18, 2, "52");
        r.put(20, 1, tipoPag);
        r.put(21, 15, num(docPag, 15));
        r.put(36, 40, txt(pagador.nome, 40));
        r.put(76, 1, tipoFav);
        r.put(77, 15, num(docFav, 15));
        r.put(92, 40, txt(b.nomeFavorecido, 40));
        r.put(132, 1, "0"); // tipo inscrição sacador (sem sacador)
        r.put(133, 15, "000000000000000"); // inscrição do sacador: zeros
        // 148-240 brancos
        linhas.push(r.build());
      }
      totalRegistros += 2;
      valorLote += b.valor;
    }

    linhas.push(trailerLote(lote, 2 + lista.length * 2, valorLote));
    totalRegistros++;
    valorTotal += valorLote;
  }

  linhas.push(trailerArquivo(lote, totalRegistros + 1));
  return { conteudo: linhas.join("\r\n") + "\r\n", quantidade: prep.length, valorTotal, ignorados };
}

// Gerador de remessa CNAB 240 do Santander (033) — pagamento.
// Baseado no "Pagamento a Fornecedores — Layout CNAB 240", manual oficial Santander
// YLEC_2403 V11.3.1 (04/2021), sobre o motor FEBRABAN compartilhado (./febraban240).
//
// Implementa:
//  - Crédito em conta/poupança e TED a fornecedor (Segmento A + Segmento B; no Santander
//    o B é OBRIGATÓRIO para TED/DOC e opcional para crédito — geramos sempre);
//  - Pagamento de boletos bancários (Segmento J + J-52).
// NÃO implementa Pix (Segmentos A/B/J-52 Pix), OCT (Segmento I), tributos (N/O) nem o
// Segmento C (conta de pagamento). Ficam para depois.
//
// HOMOLOGAÇÃO: o Santander valida o arquivo pelo Internet Banking (relatório de crítica).
// Não há marca de teste no arquivo; se a conta tiver "Sequencial para Teste" contratado,
// um NSA de 1 a 10 é tratado como teste. O parâmetro `teste` é aceito por simetria de API.
//
// Particularidades do Santander respeitadas aqui (vs. Bradesco/BB):
//  - Código do banco "033"; versões de layout: arquivo "060", lote crédito/TED "031",
//    lote de títulos "030".
//  - Forma de lançamento: crédito em conta "01", poupança "05", transferência a outro
//    banco (DOC/TED) "03"; boleto próprio Santander "30", outros bancos "31".
//  - Câmara (Segmento A): conta no próprio banco "000", TED "018".
//  - DV da agência/conta (posição 72 do header) e DV da agência do favorecido (posição 29
//    do Segmento A) ficam em branco.
//  - Header de lote NÃO leva indicativo em 223-224 (filler branco) — diferente do Bradesco.
//  - Segmento A usa finalidade de TED (220-224) e finalidade complementar (225-226 = CC/PP).
//  - Segmento B tem endereço/valores; campos numéricos vazios vão com ZEROS (não branco),
//    conforme o alinhamento exigido pelo manual.

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

const COD = "033";
const NOME_BANCO = "BANCO SANTANDER";
const VERSAO_ARQ = "060";
const VERSAO_LOTE_PAG = "031"; // header de lote crédito/poupança/DOC/TED
const VERSAO_LOTE_TIT = "030"; // header de lote de títulos (boletos)
const TIPO_SERVICO = "20"; // pagamento a fornecedor
const FINALIDADE_TED = "00005"; // pagamento a fornecedores (tabela de finalidades do BCB)

export type PagadorSantander = {
  documento: string; // CNPJ/CPF do pagador (debitado)
  nome: string;
  agencia: string;
  agenciaDv?: string | null;
  contaNumero: string;
  contaDv?: string | null;
  convenio: string; // número do convênio de Pagamento a Fornecedores no Santander
};

const dvUp = (v?: string | null) => String(v ?? "").trim().toUpperCase().slice(-1) || " ";
const tipoInscricao = (doc: string) => (so(doc).length === 14 ? "2" : "1");

// Convênio (33-52), formato Nota G009: "0033" + agência (4) + número do convênio (12),
// tudo numérico com zeros à esquerda.
function campoConvenio(p: PagadorSantander): string {
  return "0033" + num(p.agencia, 4) + num(p.convenio, 12);
}

function headerArquivo(p: PagadorSantander, agora: Date, nsa: number): string {
  const r = registro();
  r.put(1, 3, COD);
  r.put(4, 4, "0000");
  r.put(8, 1, "0");
  // 9-17 brancos
  r.put(18, 1, tipoInscricao(p.documento));
  r.put(19, 14, num(p.documento, 14));
  r.put(33, 20, campoConvenio(p));
  r.put(53, 5, num(p.agencia, 5));
  r.put(58, 1, dvUp(p.agenciaDv)); // DV agência (opcional)
  r.put(59, 12, num(p.contaNumero, 12));
  r.put(71, 1, dvUp(p.contaDv));
  // 72 DV ag/conta — branco
  r.put(73, 30, txt(p.nome, 30));
  r.put(103, 30, txt(NOME_BANCO, 30));
  // 133-142 brancos
  r.put(143, 1, "1"); // remessa
  r.put(144, 8, dataHoje(agora));
  r.put(152, 6, horaAgora(agora));
  r.put(158, 6, num(nsa, 6)); // NSA
  r.put(164, 3, VERSAO_ARQ);
  // 167-230 brancos (densidade/reservados); 231-240 ocorrências branco
  return r.build();
}

function trailerArquivo(qtdLotes: number, qtdRegistros: number): string {
  const r = registro();
  r.put(1, 3, COD);
  r.put(4, 4, "9999");
  r.put(8, 1, "9");
  // 9-17 brancos
  r.put(18, 6, num(qtdLotes, 6));
  r.put(24, 6, num(qtdRegistros, 6));
  // 30-240 brancos (o Santander não tem campo de contas conciliadas aqui)
  return r.build();
}

// titulos=false → crédito/poupança/DOC/TED (layout "031"); titulos=true → boletos ("030").
function headerLote(p: PagadorSantander, lote: number, forma: string, titulos: boolean): string {
  const r = registro();
  r.put(1, 3, COD);
  r.put(4, 4, num(lote, 4));
  r.put(8, 1, "1");
  r.put(9, 1, "C");
  r.put(10, 2, TIPO_SERVICO);
  r.put(12, 2, forma);
  r.put(14, 3, titulos ? VERSAO_LOTE_TIT : VERSAO_LOTE_PAG);
  // 17 branco
  r.put(18, 1, tipoInscricao(p.documento));
  r.put(19, 14, num(p.documento, 14));
  r.put(33, 20, campoConvenio(p));
  r.put(53, 5, num(p.agencia, 5));
  r.put(58, 1, dvUp(p.agenciaDv));
  r.put(59, 12, num(p.contaNumero, 12));
  r.put(71, 1, dvUp(p.contaDv));
  // 72 DV ag/conta branco
  r.put(73, 30, txt(p.nome, 30));
  // 103-142 mensagem (branco); 143-222 endereço (branco); 223-230 filler brancos
  // 231-240 ocorrências brancos na remessa
  return r.build();
}

function trailerLote(lote: number, qtdRegistros: number, somaValor: number): string {
  const r = registro();
  r.put(1, 3, COD);
  r.put(4, 4, num(lote, 4));
  r.put(8, 1, "5");
  // 9-17 brancos
  r.put(18, 6, num(qtdRegistros, 6));
  r.put(24, 18, valorCent(somaValor, 18)); // somatória dos valores (16 + 2 decimais)
  r.put(42, 18, num(0, 18)); // somatória quantidade de moedas
  r.put(60, 6, "000000"); // número aviso de débito
  // 231-240 ocorrências brancos
  return r.build();
}

// Forma de lançamento: crédito conta Santander "01", poupança "05", outro banco "03".
function formaSantander(banco: string, tipo?: string | null): "01" | "03" | "05" {
  if (so(banco) === "033") return tipo === "poupanca" ? "05" : "01";
  return "03";
}
// Câmara (Segmento A, 18-20): outro banco (TED) "018"; mesmo banco "000".
function camaraSantander(forma: string): string {
  return forma === "03" ? "018" : "000";
}

export function gerarRemessaSantanderTransferencias(opts: {
  pagador: PagadorSantander;
  transferencias: TransferenciaCnab[];
  agora?: Date;
  teste?: boolean;
}): RemessaResultado {
  const { pagador } = opts;
  const agora = opts.agora ?? new Date();
  const ignorados: RemessaResultado["ignorados"] = [];

  type Prep = TransferenciaCnab & { forma: "01" | "03" | "05"; doc: string };
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
    prep.push({ ...t, forma: formaSantander(banco, t.contaTipo), doc });
  }

  const linhas: string[] = [headerArquivo(pagador, agora, 1)];

  const grupos = new Map<"01" | "03" | "05", Prep[]>();
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
    linhas.push(headerLote(pagador, lote, forma, false));
    totalRegistros++;

    let seq = 0;
    let valorLote = 0;
    for (const t of lista) {
      const docFav = so(t.docFavorecido);
      const tipoFav = tipoInscricao(docFav);

      // Segmento A
      seq++;
      {
        const r = registro();
        r.put(1, 3, COD);
        r.put(4, 4, num(lote, 4));
        r.put(8, 1, "3");
        r.put(9, 5, num(seq, 5));
        r.put(14, 1, "A");
        r.put(15, 1, "0"); // inclusão
        r.put(16, 2, "00"); // inclusão de registro liberado
        r.put(18, 3, camaraSantander(forma));
        r.put(21, 3, num(t.bancoFavorecido, 3));
        r.put(24, 5, num(t.agenciaFavorecido, 5));
        r.put(29, 1, " "); // DV agência favorecido — branco
        r.put(30, 12, num(t.contaFavorecido, 12));
        r.put(42, 1, dvUp(t.contaDvFavorecido));
        r.put(43, 1, " "); // DV ag/conta
        r.put(44, 30, txt(t.nomeFavorecido, 30));
        r.put(74, 20, txt(t.seuNumero || "", 20));
        r.put(94, 8, ddmmaaaa(t.dataPagamento));
        r.put(102, 3, "BRL");
        r.put(105, 15, "000000000000000"); // quantidade de moeda
        r.put(120, 15, valorCent(t.valor, 15));
        // 135-154 nosso número (alfa) — branco
        r.put(155, 8, "00000000"); // data real (retorno)
        r.put(163, 15, valorCent(0, 15)); // valor real
        // 178-217 informação 2 — branco
        // 218-219 finalidade DOC — branco
        if (forma === "03") r.put(220, 5, FINALIDADE_TED); // finalidade da TED
        if (forma === "05") r.put(225, 2, "PP"); // tipo de conta poupança (CC é o default)
        r.put(230, 1, "0"); // não emite aviso
        // 231-240 ocorrências brancos
        linhas.push(r.build());
      }
      // Segmento B (obrigatório para TED; geramos sempre)
      seq++;
      {
        const r = registro();
        r.put(1, 3, COD);
        r.put(4, 4, num(lote, 4));
        r.put(8, 1, "3");
        r.put(9, 5, num(seq, 5));
        r.put(14, 1, "B");
        // 15-17 filler brancos (não-Pix)
        r.put(18, 1, tipoFav);
        r.put(19, 14, num(docFav, 14));
        // 33-127 endereço (alfa) — brancos
        r.put(63, 5, "00000"); // número do local (numérico) — zeros
        r.put(118, 8, "00000000"); // CEP (numérico) — zeros
        r.put(128, 8, "00000000"); // data de vencimento — zeros
        r.put(136, 15, valorCent(0, 15)); // valor do documento
        r.put(151, 15, valorCent(0, 15)); // abatimento
        r.put(166, 15, valorCent(0, 15)); // desconto
        r.put(181, 15, valorCent(0, 15)); // mora
        r.put(196, 15, valorCent(0, 15)); // multa
        r.put(211, 4, "0000"); // horário de envio de TED
        r.put(226, 4, "0000"); // código histórico para crédito
        r.put(230, 1, "0"); // não emite aviso
        // 231 filler branco; 232 TED para IF — branco; 233-240 ISPB — branco
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

// Forma p/ boleto: próprio Santander "30", outros bancos "31".
function formaBoletoSantander(barras: string): "30" | "31" {
  return so(barras).slice(0, 3) === "033" ? "30" : "31";
}

export function gerarRemessaSantanderBoletos(opts: {
  pagador: PagadorSantander;
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
  const tipoPag = tipoInscricao(docPag);
  const linhas: string[] = [headerArquivo(pagador, agora, 1)];

  const grupos = new Map<"30" | "31", Prep[]>();
  for (const p of prep) {
    const f = formaBoletoSantander(p.barras);
    const arr = grupos.get(f) ?? [];
    arr.push(p);
    grupos.set(f, arr);
  }

  let lote = 0;
  let totalRegistros = 1;
  let valorTotal = 0;

  for (const [forma, lista] of Array.from(grupos.entries())) {
    lote++;
    linhas.push(headerLote(pagador, lote, forma, true));
    totalRegistros++;

    let seq = 0;
    let valorLote = 0;
    for (const b of lista) {
      seq++;
      const docFav = so(b.docFavorecido);
      const tipoFav = tipoInscricao(docFav);

      // Segmento J
      {
        const r = registro();
        r.put(1, 3, COD);
        r.put(4, 4, num(lote, 4));
        r.put(8, 1, "3");
        r.put(9, 5, num(seq, 5));
        r.put(14, 1, "J");
        r.put(15, 1, "0");
        r.put(16, 2, "00");
        r.put(18, 44, b.barras);
        r.put(62, 30, txt(b.nomeFavorecido, 30));
        r.put(92, 8, ddmmaaaa(b.dataPagamento));
        r.put(100, 15, valorCent(b.valor, 15));
        r.put(115, 15, valorCent(0, 15)); // desconto + abatimento
        r.put(130, 15, valorCent(0, 15)); // multa + juros
        r.put(145, 8, ddmmaaaa(b.dataPagamento));
        r.put(153, 15, valorCent(b.valor, 15));
        r.put(168, 15, "000000000000000"); // quantidade de moeda
        r.put(183, 20, txt(b.seuNumero || "", 20));
        // 203-222 nosso número (alfa) — branco
        r.put(223, 2, "09"); // código da moeda (Real)
        // 225-230 brancos; 231-240 ocorrências brancos
        linhas.push(r.build());
      }
      // Segmento J-52 (obrigatório; identifica pagador e beneficiário)
      {
        const r = registro();
        r.put(1, 3, COD);
        r.put(4, 4, num(lote, 4));
        r.put(8, 1, "3");
        r.put(9, 5, num(seq, 5));
        r.put(14, 1, "J");
        // 15 filler branco
        r.put(16, 2, "00"); // código de movimento remessa
        r.put(18, 2, "52");
        r.put(20, 1, tipoPag);
        r.put(21, 15, num(docPag, 15));
        r.put(36, 40, txt(pagador.nome, 40));
        r.put(76, 1, tipoFav);
        r.put(77, 15, num(docFav, 15));
        r.put(92, 40, txt(b.nomeFavorecido, 40));
        r.put(132, 1, "0"); // sem sacador
        r.put(133, 15, "000000000000000"); // inscrição do sacador — zeros
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

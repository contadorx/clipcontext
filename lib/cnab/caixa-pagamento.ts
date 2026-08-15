// Gerador de remessa CNAB 240 da CAIXA (104) — pagamento.
// Baseado no manual oficial "MANUAL OPERACIONAL — Pagamento de Salários, Pagamento/Crédito
// a Fornecedor e Autopagamento e Débito Automático" (37.270 v036), banco 104, sobre o
// motor FEBRABAN compartilhado (./febraban240).
//
// Implementa:
//  - Crédito em conta/poupança e TED a fornecedor (Segmento A + Segmento B; na CAIXA o B é
//    obrigatório para crédito em conta, DOC, OP e TED — geramos sempre);
//  - Pagamento de boletos da CAIXA e de outros bancos (Segmento J + J-52).
// NÃO implementa Pix QR Code (J/J-52 Pix), tributos/concessionárias (segmentos O/N/W/K),
// OP, Guia de Depósito Judicial nem Débito Automático. Ficam para depois.
//
// HOMOLOGAÇÃO: a CAIXA valida em três etapas (pré-crítica em até 30 min, crítica D+0 e
// retorno financeiro). O ambiente (teste/produção) é definido no cadastro do convênio.
// Recomenda-se enviar arquivo em ambiente de teste antes de produção.
//
// PARTICULARIDADES DA CAIXA respeitadas aqui (vs. Itaú/Santander/Sicoob):
//  - Banco "104", nome "CAIXA"; versão do leiaute de arquivo "080", do lote "041",
//    densidade "01600".
//  - O convênio CAIXA tem 3 partes: Código do Convênio (6) + Tipo de Compromisso (2) +
//    Número do Compromisso (4). Para pagamento a fornecedor o Tipo de Compromisso é "01".
//    Aceitamos o campo `convenio` com 6 dígitos (assume tipo "01" e compromisso "0001") ou
//    com as 12 posições completas (código+tipo+compromisso).
//  - Tipo de serviço do lote (G025) = "20" (pagamento fornecedor); Tipo de Operação = "C".
//  - Forma de lançamento (G029): crédito em conta CAIXA "01", poupança CAIXA "05",
//    TED (mesma ou outra titularidade) "41"; boleto da CAIXA "30", de outros bancos "31".
//    Um lote só pode conter UMA forma — agrupamos por forma e geramos um lote para cada.
//  - Câmara (Segmento A, 18-20): crédito em conta CAIXA "000"; TED "018". A CAIXA NÃO usa
//    código de finalidade de TED de 5 dígitos no Segmento A (diferente do Itaú/Santander);
//    a finalidade é dada pela câmara + tipo de conta (A.18). Finalidade DOC (A.33) = "00".
//  - Número do Documento atribuído pela Empresa (A.16 / J.22): 6 dígitos, obrigatório, não
//    pode ser zero e deve evoluir de 1 em 1 para cada registro dentro do ARQUIVO — usamos
//    um contador próprio que atravessa os lotes.
//  - Conta corrente (12 dígitos): para contas CAIXA com Operação, são operação(4)+conta(8);
//    no novo padrão sem Operação, é o número da conta (12). O valor é usado como vier no
//    cadastro (mesma regra para a conta do favorecido quando for da CAIXA).
//  - Trailer de arquivo TEM "Quantidade de Contas para Conciliação" (zeros) — como Sicoob.
//  - J-52: moeda "09"; ordem Pagador (convenente) -> Beneficiário (cedente) -> Sacador.

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

const COD = "104";
const NOME_BANCO = "CAIXA";
const VERSAO_ARQ = "080"; // versão do leiaute do header de arquivo (0.26)
const VERSAO_LOTE = "041"; // versão do leiaute do header de lote (1.07)
const DENSIDADE = "01600"; // densidade de gravação (0.27)
const TIPO_SERVICO = "20"; // G025 — pagamento fornecedor
const TIPO_COMPROMISSO_FORNECEDOR = "01"; // Quadro 1 — pagamento a fornecedor

export type PagadorCaixa = {
  documento: string; // CNPJ/CPF do convenente (conta debitada)
  nome: string;
  agencia: string;
  agenciaDv?: string | null;
  contaNumero: string; // 12 dígitos: operação(4)+conta(8) OU conta(12) no padrão novo
  contaDv?: string | null;
  convenio: string; // 6 dígitos (código) ou 12 (código+tipo compromisso+nº compromisso)
};

const dvUp = (v?: string | null) => String(v ?? "").trim().toUpperCase().slice(-1) || " ";
const tipoInscricao = (doc: string) => (so(doc).length === 14 ? "2" : "1");

// Decompõe o convênio CAIXA em código (6) + tipo de compromisso (2) + nº compromisso (4).
// Aceita o campo já completo (>=12 dígitos) ou apenas o código (assume compromisso de
// pagamento a fornecedor "01" e número "0001").
function convCaixa(conv: string): { codigo: string; tipo: string; comp: string } {
  const d = so(conv);
  if (d.length >= 12) {
    return { codigo: d.slice(0, 6), tipo: d.slice(6, 8), comp: d.slice(8, 12) };
  }
  return { codigo: num(d, 6), tipo: TIPO_COMPROMISSO_FORNECEDOR, comp: "0001" };
}

function headerArquivo(p: PagadorCaixa, agora: Date, nsa: number): string {
  const cv = convCaixa(p.convenio);
  const r = registro();
  r.put(1, 3, COD);
  r.put(4, 4, "0000");
  r.put(8, 1, "0");
  // 9-17 filler brancos
  r.put(18, 1, tipoInscricao(p.documento));
  r.put(19, 14, num(p.documento, 14));
  r.put(33, 6, cv.codigo); // 0.07 código do convênio (6)
  r.put(39, 2, "00"); // 0.08 parâmetro de transmissão (a confirmar — zeros)
  r.put(41, 1, "P"); // 0.09 ambiente do cliente: produção
  // 42 ambiente CAIXA — branco
  // 43-45 origem aplicativo — branco
  r.put(46, 4, "0000"); // 0.12 número de versão — zeros
  // 50-52 filler brancos
  r.put(53, 5, num(p.agencia, 5));
  r.put(58, 1, num(p.agenciaDv ?? "", 1)); // DV da agência (numérico; 0 se ausente)
  r.put(59, 12, num(p.contaNumero, 12));
  r.put(71, 1, dvUp(p.contaDv));
  // 72 DV ag/conta — branco
  r.put(73, 30, txt(p.nome, 30));
  r.put(103, 30, txt(NOME_BANCO, 30));
  // 133-142 filler brancos
  r.put(143, 1, "1"); // tipo do arquivo: remessa
  r.put(144, 8, dataHoje(agora));
  r.put(152, 6, horaAgora(agora));
  r.put(158, 6, num(nsa, 6)); // NSA
  r.put(164, 3, VERSAO_ARQ); // 0.26 versão do leiaute do arquivo
  r.put(167, 5, DENSIDADE); // 0.27 densidade
  // 172-191 exclusivo Pix — branco; 192-211 reservado empresa — branco
  // 212-222 uso FEBRABAN — branco; 223-225 ident. cobrança — branco
  r.put(226, 3, "000"); // 0.32 uso exclusivo das VAN — zeros
  // 229-230 tipo de serviço — branco; 231-240 ocorrência cob. sem papel — branco
  return r.build();
}

function trailerArquivo(qtdLotes: number, qtdRegistros: number): string {
  const r = registro();
  r.put(1, 3, COD);
  r.put(4, 4, "9999");
  r.put(8, 1, "9");
  // 9-17 filler brancos
  r.put(18, 6, num(qtdLotes, 6)); // 9.05 quantidade de lotes
  r.put(24, 6, num(qtdRegistros, 6)); // 9.06 quantidade de registros do arquivo
  r.put(30, 6, "000000"); // 9.07 quantidade de contas para conciliação — zeros
  // 36-240 uso FEBRABAN — branco
  return r.build();
}

function headerLote(p: PagadorCaixa, lote: number, forma: string): string {
  const cv = convCaixa(p.convenio);
  const r = registro();
  r.put(1, 3, COD);
  r.put(4, 4, num(lote, 4));
  r.put(8, 1, "1");
  r.put(9, 1, "C"); // 1.04 tipo de operação: compromisso de pagamento
  r.put(10, 2, TIPO_SERVICO); // 1.05 tipo de serviço (G025)
  r.put(12, 2, forma); // 1.06 forma de lançamento (G029)
  r.put(14, 3, VERSAO_LOTE); // 1.07 versão do leiaute do lote
  // 17 filler branco
  r.put(18, 1, tipoInscricao(p.documento));
  r.put(19, 14, num(p.documento, 14));
  r.put(33, 6, cv.codigo); // 1.11 código do convênio (6)
  r.put(39, 2, cv.tipo); // 1.12 tipo de compromisso
  r.put(41, 4, cv.comp); // 1.13 código do compromisso
  // 45-46 parâmetro de transmissão (X) — branco (a confirmar)
  // 47-52 filler brancos
  r.put(53, 5, num(p.agencia, 5));
  r.put(58, 1, dvUp(p.agenciaDv)); // 1.17 DV da agência (opcional)
  r.put(59, 12, num(p.contaNumero, 12));
  r.put(71, 1, dvUp(p.contaDv));
  // 72 dígito ag/conta — branco
  r.put(73, 30, txt(p.nome, 30));
  // 103-142 mensagem de aviso 1 — branco
  // 143-172 logradouro (alfa) — branco
  r.put(173, 5, "00000"); // 1.24 número no local (numérico) — zeros
  // 178-192 complemento — branco; 193-212 cidade — branco
  r.put(213, 5, "00000"); // 1.27 CEP (numérico) — zeros
  // 218-220 complemento CEP — branco; 221-222 UF — branco
  // 223-230 uso FEBRABAN — branco; 231-240 ocorrências — branco
  return r.build();
}

function trailerLote(lote: number, qtdRegistros: number, somaValor: number): string {
  const r = registro();
  r.put(1, 3, COD);
  r.put(4, 4, num(lote, 4));
  r.put(8, 1, "5");
  // 9-17 uso FEBRABAN brancos
  r.put(18, 6, num(qtdRegistros, 6)); // 5.05 quantidade de registros no lote
  r.put(24, 18, valorCent(somaValor, 18)); // 5.06 somatória dos valores (16 + 2)
  r.put(42, 18, num(0, 18)); // 5.07 somatório de quantidade de moeda — zeros
  r.put(60, 6, "000000"); // 5.08 número aviso de débito — zeros
  // 66-230 uso FEBRABAN-2 brancos; 231-240 ocorrências brancos
  return r.build();
}

// Forma de lançamento da transferência: crédito conta CAIXA "01", poupança CAIXA "05",
// outro banco via TED "41".
function formaTransfCaixa(banco: string, tipo?: string | null): "01" | "05" | "41" {
  if (so(banco) === "104") return tipo === "poupanca" ? "05" : "01";
  return "41";
}
// Câmara (Segmento A, 18-20): TED "018"; crédito em conta CAIXA "000".
function camaraCaixa(forma: string): string {
  return forma === "41" ? "018" : "000";
}
// Tipo de conta / finalidade TED (A.18): "2" poupança, "1" conta corrente.
function tipoContaA18(tipo?: string | null): "1" | "2" {
  return tipo === "poupanca" ? "2" : "1";
}

export function gerarRemessaCaixaTransferencias(opts: {
  pagador: PagadorCaixa;
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
    prep.push({ ...t, forma: formaTransfCaixa(banco, t.contaTipo), doc });
  }

  const linhas: string[] = [headerArquivo(pagador, agora, 1)];

  const grupos = new Map<"01" | "05" | "41", Prep[]>();
  for (const p of prep) {
    const arr = grupos.get(p.forma) ?? [];
    arr.push(p);
    grupos.set(p.forma, arr);
  }

  let lote = 0;
  let numDoc = 0; // número do documento atribuído pela empresa — único por arquivo
  let totalRegistros = 1; // header de arquivo
  let valorTotal = 0;

  for (const [forma, lista] of Array.from(grupos.entries())) {
    lote++;
    linhas.push(headerLote(pagador, lote, forma));
    totalRegistros++;

    let seq = 0;
    let valorLote = 0;
    for (const t of lista) {
      const docFav = so(t.docFavorecido);
      const tipoFav = tipoInscricao(docFav);
      numDoc++;

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
        r.put(16, 2, "00"); // código instrução movimento
        r.put(18, 3, camaraCaixa(forma));
        r.put(21, 3, num(t.bancoFavorecido, 3));
        r.put(24, 5, num(t.agenciaFavorecido, 5));
        // 29 DV agência do favorecido — branco (não capturado)
        r.put(30, 12, num(t.contaFavorecido, 12));
        r.put(42, 1, dvUp(t.contaDvFavorecido));
        // 43 DV ag/conta — branco
        r.put(44, 30, txt(t.nomeFavorecido, 30));
        r.put(74, 6, num(numDoc, 6)); // número documento atribuído pela empresa
        // 80-92 filler brancos
        r.put(93, 1, tipoContaA18(t.contaTipo)); // tipo de conta / finalidade TED
        r.put(94, 8, ddmmaaaa(t.dataPagamento));
        r.put(102, 3, "BRL");
        r.put(105, 15, "000000000000000"); // quantidade de moeda
        r.put(120, 15, valorCent(t.valor, 15));
        // 135-143 número documento banco — branco
        r.put(147, 2, "01"); // quantidade de parcelas
        r.put(149, 1, "N"); // indicador de bloqueio
        r.put(150, 1, "1"); // indicador forma de parcelamento (a confirmar)
        // 151-152 período/dia (X) — branco
        r.put(153, 2, "00"); // número da parcela
        r.put(155, 8, "00000000"); // data da efetivação (retorno)
        r.put(163, 15, valorCent(0, 15)); // valor real efetivado (retorno)
        // 178-217 informação 2 — branco
        r.put(218, 2, "00"); // finalidade DOC
        // 220-229 uso FEBRABAN — branco
        r.put(230, 1, "0"); // aviso ao favorecido: não emite
        // 231-240 ocorrências brancos
        linhas.push(r.build());
      }
      // Segmento B (obrigatório na CAIXA para crédito em conta/DOC/OP/TED)
      seq++;
      {
        const r = registro();
        r.put(1, 3, COD);
        r.put(4, 4, num(lote, 4));
        r.put(8, 1, "3");
        r.put(9, 5, num(seq, 5));
        r.put(14, 1, "B");
        // 15-17 uso FEBRABAN brancos
        r.put(18, 1, tipoFav);
        r.put(19, 14, num(docFav, 14));
        // 33-62 logradouro (alfa) — branco
        r.put(63, 5, "00000"); // número no local (numérico) — zeros
        // 68-82 complemento — branco; 83-97 bairro — branco; 98-117 cidade — branco
        r.put(118, 5, "00000"); // CEP (numérico) — zeros
        // 123-125 complemento CEP — branco; 126-127 UF — branco
        r.put(128, 8, ddmmaaaa(t.dataPagamento)); // data de vencimento
        r.put(136, 15, valorCent(0, 15)); // valor do documento
        r.put(151, 15, valorCent(0, 15)); // abatimento
        r.put(166, 15, valorCent(0, 15)); // desconto
        r.put(181, 15, valorCent(0, 15)); // mora
        r.put(196, 15, valorCent(0, 15)); // multa
        // 211-225 código documento favorecido — branco; 226-240 uso FEBRABAN — branco
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

// Forma de lançamento do boleto: próprio CAIXA "30", outros bancos "31".
function formaBoletoCaixa(barras: string): "30" | "31" {
  return so(barras).slice(0, 3) === "104" ? "30" : "31";
}

export function gerarRemessaCaixaBoletos(opts: {
  pagador: PagadorCaixa;
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
    const f = formaBoletoCaixa(p.barras);
    const arr = grupos.get(f) ?? [];
    arr.push(p);
    grupos.set(f, arr);
  }

  let lote = 0;
  let numDoc = 0; // número do documento atribuído pela empresa — único por arquivo
  let totalRegistros = 1;
  let valorTotal = 0;

  for (const [forma, lista] of Array.from(grupos.entries())) {
    lote++;
    linhas.push(headerLote(pagador, lote, forma));
    totalRegistros++;

    let seq = 0;
    let valorLote = 0;
    for (const b of lista) {
      const docFav = so(b.docFavorecido);
      const tipoFav = tipoInscricao(docFav);
      numDoc++;

      // Segmento J
      seq++;
      {
        const r = registro();
        r.put(1, 3, COD);
        r.put(4, 4, num(lote, 4));
        r.put(8, 1, "3");
        r.put(9, 5, num(seq, 5));
        r.put(14, 1, "J");
        r.put(15, 1, "0"); // tipo de movimento: inclusão
        r.put(16, 2, "00"); // código de movimento (G061)
        r.put(18, 44, b.barras); // banco+moeda+DV+fator+valor+campo livre (44)
        r.put(62, 30, txt(b.nomeFavorecido, 30)); // nome do cedente
        r.put(92, 8, ddmmaaaa(b.dataPagamento)); // data de vencimento
        r.put(100, 15, valorCent(b.valor, 15)); // valor do título
        r.put(115, 15, valorCent(0, 15)); // desconto + abatimento
        r.put(130, 15, valorCent(0, 15)); // mora + multa
        r.put(145, 8, ddmmaaaa(b.dataPagamento)); // data do pagamento
        r.put(153, 15, valorCent(b.valor, 15)); // valor do pagamento
        r.put(168, 15, "000000000000000"); // quantidade de moeda
        r.put(183, 6, num(numDoc, 6)); // número documento atribuído pela empresa
        // 189-222 fillers/nosso número — brancos
        r.put(223, 2, "09"); // código da moeda (Real)
        // 225-230 uso FEBRABAN — branco; 231-240 ocorrências — branco
        linhas.push(r.build());
      }
      // Segmento J-52 (obrigatório; identifica pagador, beneficiário e sacador)
      seq++;
      {
        const r = registro();
        r.put(1, 3, COD);
        r.put(4, 4, num(lote, 4));
        r.put(8, 1, "3");
        r.put(9, 5, num(seq, 5));
        r.put(14, 1, "J");
        // 15 uso FEBRABAN branco; 16-17 código de movimento — branco
        r.put(18, 2, "52"); // identificação de registro
        r.put(20, 1, tipoPag); // tipo inscrição do pagador (convenente)
        r.put(21, 15, num(docPag, 15));
        r.put(36, 40, txt(pagador.nome, 40));
        r.put(76, 1, tipoFav); // tipo inscrição do beneficiário (cedente)
        r.put(77, 15, num(docFav, 15));
        r.put(92, 40, txt(b.nomeFavorecido, 40));
        r.put(132, 1, "0"); // tipo inscrição do sacador — sem sacador
        r.put(133, 15, "000000000000000"); // número inscrição do sacador — zeros
        r.put(148, 40, "0".repeat(40)); // nome do sacador — zeros (sem sacador, conforme manual J52.17)
        // 188-240 uso FEBRABAN — branco
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

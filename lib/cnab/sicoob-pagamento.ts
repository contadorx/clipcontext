// Gerador de remessa CNAB 240 do Sicoob (756) — pagamento.
// Baseado no "Guia de Importação de Arquivos CNAB 240", documento oficial Sicoob
// versão 3.2 (Sicoobnet Empresarial), sobre o motor FEBRABAN compartilhado (./febraban240).
//
// Implementa:
//  - Transferência entre contas da rede Sicoob e TED para outros bancos
//    (Segmento A + Segmento B, ambos obrigatórios);
//  - Pagamento de boletos de cobrança (Segmento J + J-52).
// NÃO implementa Pix (Segmento J-52-Pix / forma de iniciação no B), convênios/tributos
// (Segmentos O/N/W) nem folha de pagamento. Ficam para depois.
//
// HOMOLOGAÇÃO: valide o arquivo pelo próprio Sicoobnet Empresarial (a importação valida
// o leiaute e aponta rejeições por arquivo ou por registro) antes de usar em produção.
//
// Particularidades do Sicoob respeitadas aqui (vs. Bradesco/Santander):
//  - Código do banco "756"; versão de layout do arquivo "087"; versões de lote
//    "045" (transferência/TED) e "040" (títulos).
//  - Forma de lançamento: crédito em conta na rede Sicoob "01", poupança "05",
//    TED para outra titularidade "41" (mesma titularidade seria "43"); boleto do próprio
//    Sicoob "30", de outros bancos "31".
//  - Câmara (Segmento A): TED "018"; conta na rede Sicoob "000".
//  - Trailer de arquivo TEM o campo "quantidade de contas para conciliação" (pos 30-35).
//  - Header de lote de pagamento NÃO leva indicativo em 223-224 (filler/opcional em branco).
//  - Segmento B de transferência é mínimo (identifica o favorecido; demais campos de Pix
//    ficam em branco), igual ao Bradesco.
//  - Convênio = código do Sicoobnet Empresarial, alfanumérico de 20 posições.

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

const COD = "756";
const NOME_BANCO = "SICOOB";
const VERSAO_ARQ = "087";
const VERSAO_LOTE_PAG = "045"; // header de lote transferência/TED
const VERSAO_LOTE_TIT = "040"; // header de lote de títulos (boletos)
const TIPO_SERVICO = "20"; // pagamento a fornecedor
const FINALIDADE_TED = "00005"; // pagamento a fornecedores (tabela de finalidades do BCB)

export type PagadorSicoob = {
  documento: string; // CNPJ/CPF do pagador (debitado)
  nome: string;
  agencia: string;
  agenciaDv?: string | null;
  contaNumero: string;
  contaDv?: string | null;
  convenio: string; // código do convênio CNAB no Sicoobnet Empresarial
};

const dvUp = (v?: string | null) => String(v ?? "").trim().toUpperCase().slice(-1) || " ";
const tipoInscricao = (doc: string) => (so(doc).length === 14 ? "2" : "1");

function headerArquivo(p: PagadorSicoob, agora: Date, nsa: number): string {
  const r = registro();
  r.put(1, 3, COD);
  r.put(4, 4, "0000");
  r.put(8, 1, "0");
  // 9-17 brancos
  r.put(18, 1, tipoInscricao(p.documento));
  r.put(19, 14, num(p.documento, 14));
  r.put(33, 20, txt(p.convenio, 20)); // código do convênio (Sicoobnet)
  r.put(53, 5, num(p.agencia, 5));
  r.put(58, 1, dvUp(p.agenciaDv));
  r.put(59, 12, num(p.contaNumero, 12));
  r.put(71, 1, dvUp(p.contaDv));
  // 72 DV ag/conta — branco
  r.put(73, 30, txt(p.nome, 30));
  r.put(103, 30, txt(NOME_BANCO, 30));
  // 133-142 brancos
  r.put(143, 1, "1"); // remessa
  r.put(144, 8, dataHoje(agora));
  r.put(152, 6, horaAgora(agora));
  r.put(158, 6, num(nsa, 6));
  r.put(164, 3, VERSAO_ARQ);
  // 167-240 brancos (densidade/reservados)
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
  r.put(30, 6, "000000"); // quantidade de contas para conciliação
  // 36-240 brancos
  return r.build();
}

// titulos=false → transferência/TED (layout "045"); titulos=true → boletos ("040").
function headerLote(p: PagadorSicoob, lote: number, forma: string, titulos: boolean): string {
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
  r.put(33, 20, txt(p.convenio, 20));
  r.put(53, 5, num(p.agencia, 5));
  r.put(58, 1, dvUp(p.agenciaDv));
  r.put(59, 12, num(p.contaNumero, 12));
  r.put(71, 1, dvUp(p.contaDv));
  // 72 DV ag/conta branco
  r.put(73, 30, txt(p.nome, 30));
  // 103-142 mensagem (branco); 143-222 endereço (branco)
  // 223-224 indicativo de forma de pagamento (opcional) — em branco; 225-230 brancos
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

// Forma de lançamento: crédito na rede Sicoob "01", poupança "05", TED a outro banco "41".
function formaSicoob(banco: string, tipo?: string | null): "01" | "05" | "41" {
  if (so(banco) === "756") return tipo === "poupanca" ? "05" : "01";
  return "41";
}
// Câmara (Segmento A, 18-20): TED "018"; rede Sicoob "000".
function camaraSicoob(forma: string): string {
  return forma === "41" || forma === "43" ? "018" : "000";
}

export function gerarRemessaSicoobTransferencias(opts: {
  pagador: PagadorSicoob;
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
    prep.push({ ...t, forma: formaSicoob(banco, t.contaTipo), doc });
  }

  const linhas: string[] = [headerArquivo(pagador, agora, 1)];

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
        r.put(18, 3, camaraSicoob(forma));
        r.put(21, 3, num(t.bancoFavorecido, 3));
        r.put(24, 5, num(t.agenciaFavorecido, 5));
        r.put(29, 1, " "); // DV agência favorecido (alfa, opcional)
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
        // 178-219 info 2 + CNAB — brancos
        if (forma === "41") r.put(220, 5, FINALIDADE_TED); // finalidade da TED
        if (forma === "05") r.put(225, 2, "PP"); // tipo de conta poupança (CC é o default)
        r.put(230, 1, "0"); // não emite aviso
        // 231-240 ocorrências brancos
        linhas.push(r.build());
      }
      // Segmento B (obrigatório; identifica o favorecido)
      seq++;
      {
        const r = registro();
        r.put(1, 3, COD);
        r.put(4, 4, num(lote, 4));
        r.put(8, 1, "3");
        r.put(9, 5, num(seq, 5));
        r.put(14, 1, "B");
        // 15-17 forma de iniciação (Pix) — branco
        r.put(18, 1, tipoFav);
        r.put(19, 14, num(docFav, 14));
        // 33-226 informações 10/11/12 (Pix) — brancos
        // 227-232 UG SIAPE — branco; 233-240 brancos
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

// Forma p/ boleto: próprio Sicoob "30", outros bancos "31".
function formaBoletoSicoob(barras: string): "30" | "31" {
  return so(barras).slice(0, 3) === "756" ? "30" : "31";
}

export function gerarRemessaSicoobBoletos(opts: {
  pagador: PagadorSicoob;
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
    const f = formaBoletoSicoob(p.barras);
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
        r.put(130, 15, valorCent(0, 15)); // mora + multa
        r.put(145, 8, ddmmaaaa(b.dataPagamento));
        r.put(153, 15, valorCent(b.valor, 15));
        r.put(168, 15, "000000000000000"); // quantidade de moeda
        r.put(183, 20, txt(b.seuNumero || "", 20));
        // 203-222 nosso número (alfa) — branco
        r.put(223, 2, "09"); // código da moeda (Real)
        // 225-230 brancos; 231-240 ocorrências brancos
        linhas.push(r.build());
      }
      // Segmento J-52 (obrigatório; sacado = pagador, cedente = beneficiário)
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

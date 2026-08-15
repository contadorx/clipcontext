// Gerador de remessa CNAB 240 do Banco do Brasil (001) — pagamento.
// Baseado no manual "Particularidades BB - CNAB240" (nov/2020), sobre o motor
// FEBRABAN compartilhado (./febraban240).
//
// Implementa:
//  - Crédito em conta/poupança e TED a fornecedor (Segmento A);
//  - Pagamento de boletos bancários (Segmento J + J-52).
// NÃO implementa Pix (o BB não aceita Pix por remessa CNAB) nem tributos/
// concessionárias (Segmentos N/O), que ficam para depois.
//
// HOMOLOGAÇÃO: com teste=true o arquivo sai marcado como teste ('TS' nas posições
// 51-52 do header), que é o que o BB espera no ciclo de homologação. Só passar
// teste=false (produção) depois que o banco aprovar o arquivo.

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

const COD = "001";
const NOME_BANCO = "BANCO DO BRASIL SA";
const BB2 = "0126"; // código fixo do convênio (posições 42-45)
const VERSAO_ARQ = "083"; // nº da versão do layout do arquivo — não criticado pelo BB
const VERSAO_LOTE = "040"; // nº da versão do layout do lote — não criticado pelo BB

export type PagadorBB = {
  documento: string; // CNPJ/CPF do pagador (debitado)
  nome: string;
  agencia: string;
  agenciaDv?: string | null;
  contaNumero: string;
  contaDv?: string | null;
  convenio: string; // convênio de PAGAMENTO do BB (9 dígitos)
};

// Dígito verificador: último caractere, em maiúsculo (X), ou branco se vazio.
const dvUp = (v?: string | null) => String(v ?? "").trim().toUpperCase().slice(-1) || " ";

// Campo "Código do Convênio no Banco" (33-52): convênio(9) + '0126' + brancos(5) + teste(2).
function campoConvenio(convenio: string, teste: boolean): string {
  return num(convenio, 9) + BB2 + "     " + (teste ? "TS" : "  ");
}

function headerArquivo(p: PagadorBB, agora: Date, teste: boolean): string {
  const tipoInsc = so(p.documento).length === 14 ? "2" : "1";
  const r = registro();
  r.put(1, 3, COD);
  r.put(4, 4, "0000");
  r.put(8, 1, "0");
  r.put(18, 1, tipoInsc);
  r.put(19, 14, num(p.documento, 14));
  r.put(33, 20, campoConvenio(p.convenio, teste));
  r.put(53, 5, num(p.agencia, 5));
  r.put(58, 1, dvUp(p.agenciaDv));
  r.put(59, 12, num(p.contaNumero, 12));
  r.put(71, 1, dvUp(p.contaDv));
  r.put(72, 1, "0");
  r.put(73, 30, txt(p.nome, 30));
  r.put(103, 30, txt(NOME_BANCO, 30));
  r.put(143, 1, "1"); // remessa
  r.put(144, 8, dataHoje(agora));
  r.put(152, 6, horaAgora(agora));
  r.put(158, 6, num(1, 6)); // NSA — não criticado
  r.put(164, 3, VERSAO_ARQ);
  r.put(167, 5, "00000");
  r.put(226, 3, "000");
  r.put(229, 2, "00");
  r.put(231, 10, "0000000000");
  return r.build();
}

function headerLote(
  p: PagadorBB,
  lote: number,
  tipoServico: string,
  forma: string,
  teste: boolean,
): string {
  const tipoInsc = so(p.documento).length === 14 ? "2" : "1";
  const r = registro();
  r.put(1, 3, COD);
  r.put(4, 4, num(lote, 4));
  r.put(8, 1, "1");
  r.put(9, 1, "C");
  r.put(10, 2, tipoServico);
  r.put(12, 2, forma);
  r.put(14, 3, VERSAO_LOTE);
  r.put(18, 1, tipoInsc);
  r.put(19, 14, num(p.documento, 14));
  r.put(33, 20, campoConvenio(p.convenio, teste));
  r.put(53, 5, num(p.agencia, 5));
  r.put(58, 1, dvUp(p.agenciaDv));
  r.put(59, 12, num(p.contaNumero, 12));
  r.put(71, 1, dvUp(p.contaDv));
  r.put(72, 1, "0");
  r.put(73, 30, txt(p.nome, 30));
  // 103-142 mensagem (uso do BB) e endereço da empresa: opcionais
  r.put(173, 5, "00000"); // número do local (opcional)
  r.put(213, 5, "00000"); // CEP (opcional)
  r.put(231, 10, "0000000000");
  return r.build();
}

function trailerLote(lote: number, qtdRegistros: number, somaValor: number): string {
  const r = registro();
  r.put(1, 3, COD);
  r.put(4, 4, num(lote, 4));
  r.put(8, 1, "5");
  r.put(18, 6, num(qtdRegistros, 6)); // tipos 1 + 3 + 5
  r.put(24, 18, valorCent(somaValor, 18));
  r.put(42, 18, num(0, 18));
  r.put(60, 6, "000000"); // número aviso débito
  r.put(231, 10, "0000000000");
  return r.build();
}

function trailerArquivo(qtdLotes: number, qtdRegistros: number): string {
  const r = registro();
  r.put(1, 3, COD);
  r.put(4, 4, "9999");
  r.put(8, 1, "9");
  r.put(18, 6, num(qtdLotes, 6));
  r.put(24, 6, num(qtdRegistros, 6)); // tipos 0 + 1 + 3 + 5 + 9
  r.put(30, 6, "000000"); // qtd contas p/ conciliação
  return r.build();
}

// Forma de lançamento (header de lote): crédito em conta BB '01', poupança BB '05',
// TED para outro banco '41'.
function formaBB(banco: string, tipo?: string | null): "01" | "05" | "41" {
  if (so(banco) === "001") return tipo === "poupanca" ? "05" : "01";
  return "41";
}
// Câmara centralizadora (Segmento A, 18-20): TED via STR/CIP '018'; crédito no BB '000'.
function camaraBB(forma: string): string {
  return forma === "41" ? "018" : "000";
}

export function gerarRemessaBBTransferencias(opts: {
  pagador: PagadorBB;
  transferencias: TransferenciaCnab[];
  agora?: Date;
  teste?: boolean;
}): RemessaResultado {
  const { pagador } = opts;
  const agora = opts.agora ?? new Date();
  const teste = opts.teste ?? false;
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
    prep.push({ ...t, forma: formaBB(banco, t.contaTipo), doc });
  }

  const linhas: string[] = [headerArquivo(pagador, agora, teste)];

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
    linhas.push(headerLote(pagador, lote, "20", forma, teste));
    totalRegistros++;

    let seq = 0;
    let valorLote = 0;
    for (const t of lista) {
      seq++;
      const r = registro();
      r.put(1, 3, COD);
      r.put(4, 4, num(lote, 4));
      r.put(8, 1, "3");
      r.put(9, 5, num(seq, 5));
      r.put(14, 1, "A");
      r.put(15, 1, "0"); // inclusão
      r.put(16, 2, "00");
      r.put(18, 3, camaraBB(forma));
      r.put(21, 3, num(t.bancoFavorecido, 3));
      r.put(24, 5, num(t.agenciaFavorecido, 5));
      r.put(29, 1, " "); // DV da agência do favorecido (não informado)
      r.put(30, 12, num(t.contaFavorecido, 12));
      r.put(42, 1, dvUp(t.contaDvFavorecido));
      r.put(43, 1, " "); // DV agência/conta
      r.put(44, 30, txt(t.nomeFavorecido, 30));
      r.put(74, 20, txt(t.seuNumero || "", 20));
      r.put(94, 8, ddmmaaaa(t.dataPagamento));
      r.put(102, 3, "BRL");
      r.put(105, 15, "000000000000000");
      r.put(120, 15, valorCent(t.valor, 15));
      r.put(230, 1, "0"); // aviso ao favorecido
      r.put(231, 10, "0000000000"); // ocorrências: na remessa o BB exige zeros
      linhas.push(r.build());
      totalRegistros++;
      valorLote += t.valor;
    }

    linhas.push(trailerLote(lote, 2 + lista.length, valorLote));
    totalRegistros++;
    valorTotal += valorLote;
  }

  linhas.push(trailerArquivo(lote, totalRegistros + 1));
  return { conteudo: linhas.join("\r\n") + "\r\n", quantidade: prep.length, valorTotal, ignorados };
}

// Forma de lançamento p/ boleto (header de lote): boleto BB '30', outros bancos '31'.
function formaBoletoBB(barras: string): "30" | "31" {
  return so(barras).slice(0, 3) === "001" ? "30" : "31";
}

export function gerarRemessaBBBoletos(opts: {
  pagador: PagadorBB;
  boletos: BoletoCnab[];
  agora?: Date;
  teste?: boolean;
}): RemessaResultado {
  const { pagador } = opts;
  const agora = opts.agora ?? new Date();
  const teste = opts.teste ?? false;
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
  const linhas: string[] = [headerArquivo(pagador, agora, teste)];

  const grupos = new Map<"30" | "31", Prep[]>();
  for (const p of prep) {
    const f = formaBoletoBB(p.barras);
    const arr = grupos.get(f) ?? [];
    arr.push(p);
    grupos.set(f, arr);
  }

  let lote = 0;
  let totalRegistros = 1;
  let valorTotal = 0;

  for (const [forma, lista] of Array.from(grupos.entries())) {
    lote++;
    linhas.push(headerLote(pagador, lote, "98", forma, teste));
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
        r.put(15, 3, "000");
        r.put(18, 44, b.barras);
        r.put(62, 30, txt(b.nomeFavorecido, 30));
        r.put(92, 8, ddmmaaaa(b.dataPagamento));
        r.put(100, 15, valorCent(b.valor, 15));
        r.put(115, 15, valorCent(0, 15));
        r.put(130, 15, valorCent(0, 15));
        r.put(145, 8, ddmmaaaa(b.dataPagamento));
        r.put(153, 15, valorCent(b.valor, 15));
        r.put(168, 15, "000000000000000");
        r.put(183, 20, txt(b.seuNumero || "", 20));
        // 203-222 nosso número fica em branco; 223-224 código de moeda Real (G065).
        r.put(223, 2, "09");
        r.put(231, 10, "0000000000"); // ocorrências: na remessa o BB exige zeros
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
        r.put(16, 2, "00"); // código de movimento (remessa); pos 15 fica em branco
        r.put(18, 2, "52");
        r.put(20, 1, tipoPag); // pagador
        r.put(21, 15, num(docPag, 15));
        r.put(36, 40, txt(pagador.nome, 40));
        r.put(76, 1, tipoFav); // beneficiário
        r.put(77, 15, num(docFav, 15));
        r.put(92, 40, txt(b.nomeFavorecido, 40));
        r.put(132, 1, "0"); // sem sacador avalista
        r.put(133, 15, "000000000000000"); // inscrição do sacador (não usado): zeros
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

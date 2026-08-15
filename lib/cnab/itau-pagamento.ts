// Gerador de remessa CNAB 240 do Itaú (SISPAG) — pagamento de boletos.
// Segmentos J + J-52, conforme o manual SISPAG CNAB v085.
// Suporta apenas boletos BANCÁRIOS (linha digitável de 47 dígitos); concessionárias
// (48 dígitos / Segmento O) ficam para uma fase seguinte.

import {
  so,
  txt,
  txtCase,
  num,
  valorCent,
  ddmmaaaa,
  dataHoje,
  horaAgora,
  linhaParaBarras,
  registro,
  tipoChavePix,
} from "./febraban240";
// Re-exporta o que era público neste módulo (compatibilidade com importadores externos).
export { linhaParaBarras, tipoChavePix };


export type PagadorCnab = {
  documento: string; // CNPJ/CPF do pagador (debitado)
  nome: string;
  agencia: string;
  contaNumero: string;
  contaDv?: string | null;
};

export type BoletoCnab = {
  linhaDigitavel: string; // 47 dígitos (aceita máscara)
  nomeFavorecido: string; // cedente / beneficiário do boleto
  docFavorecido: string; // CNPJ/CPF do cedente — obrigatório no J-52
  valor: number; // reais
  dataPagamento: string; // ISO YYYY-MM-DD
  seuNumero?: string;
};

export type RemessaResultado = {
  conteudo: string;
  quantidade: number;
  valorTotal: number;
  ignorados: { descricao: string; motivo: "linha_invalida" | "sem_doc_favorecido" }[];
};


export type PixCnab = {
  chavePix: string;
  nomeFavorecido: string;
  docFavorecido: string; // CNPJ/CPF do favorecido (obrigatório p/ Pix)
  valor: number;
  dataPagamento: string; // ISO
  seuNumero?: string;
};


// Remessa de Pix Transferência por chave. Por regra do manual, Pix vai em ARQUIVO
// separado das demais formas — esta função gera um arquivo só de Pix.
export type TransferenciaCnab = {
  bancoFavorecido: string; // código FEBRABAN (3 dígitos)
  agenciaFavorecido: string;
  contaFavorecido: string;
  contaDvFavorecido?: string | null;
  contaTipo?: string | null; // "cc" | "poupanca"
  nomeFavorecido: string;
  docFavorecido: string;
  valor: number;
  dataPagamento: string;
  seuNumero?: string;
};

// Forma de pagamento (Nota 5): 01 crédito c/c Itaú, 05 poupança Itaú, 41 TED outro banco.
function formaTransferencia(banco: string, tipo?: string | null): "01" | "05" | "41" {
  if (so(banco) === "341") return tipo === "poupanca" ? "05" : "01";
  return "41";
}

// Agência/conta do favorecido (campo 24-43, 20 posições) conforme Nota 11.
function agenciaConta(banco: string, agencia: string, conta: string, dv?: string | null): string {
  if (so(banco) === "341") {
    // zeros(1) + ag(4) + branco(1) + zeros(6) + conta(6) + branco(1) + dac(1)
    return "0" + num(agencia, 4) + " " + "000000" + num(conta, 6) + " " + num(dv || "0", 1);
  }
  // ag(5) + branco(1) + conta(12) + branco(1) + dac(1)
  return num(agencia, 5) + " " + num(conta, 12) + " " + num(dv || "0", 1);
}

export function gerarRemessaItauTransferencias(opts: {
  pagador: PagadorCnab;
  transferencias: TransferenciaCnab[];
  agora?: Date;
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
    prep.push({ ...t, forma: formaTransferencia(banco, t.contaTipo), doc });
  }

  const docPag = so(pagador.documento);
  const tipoPag = docPag.length === 14 ? "2" : "1";
  const linhas: string[] = [];

  // Header de Arquivo
  {
    const r = registro();
    r.put(1, 3, "341");
    r.put(4, 4, "0000");
    r.put(8, 1, "0");
    r.put(15, 3, "080");
    r.put(18, 1, tipoPag);
    r.put(19, 14, num(docPag, 14));
    r.put(53, 5, num(pagador.agencia, 5));
    r.put(59, 12, num(pagador.contaNumero, 12));
    r.put(72, 1, num(pagador.contaDv || "0", 1));
    r.put(73, 30, txt(pagador.nome, 30));
    r.put(103, 30, txt("BANCO ITAU SA", 30));
    r.put(143, 1, "1");
    r.put(144, 8, dataHoje(agora));
    r.put(152, 6, horaAgora(agora));
    r.put(167, 5, "00000");
    linhas.push(r.build());
  }

  const grupos = new Map<"01" | "05" | "41", Prep[]>();
  for (const p of prep) {
    const arr = grupos.get(p.forma) ?? [];
    arr.push(p);
    grupos.set(p.forma, arr);
  }

  let lote = 0;
  let totalRegistros = 1;
  let valorTotal = 0;

  for (const [forma, lista] of Array.from(grupos.entries())) {
    lote++;
    // Header de Lote (Segmento A — layout 040)
    {
      const r = registro();
      r.put(1, 3, "341");
      r.put(4, 4, num(lote, 4));
      r.put(8, 1, "1");
      r.put(9, 1, "C");
      r.put(10, 2, "20");
      r.put(12, 2, forma);
      r.put(14, 3, "040");
      r.put(18, 1, tipoPag);
      r.put(19, 14, num(docPag, 14));
      r.put(53, 5, num(pagador.agencia, 5));
      r.put(59, 12, num(pagador.contaNumero, 12));
      r.put(72, 1, num(pagador.contaDv || "0", 1));
      r.put(73, 30, txt(pagador.nome, 30));
      linhas.push(r.build());
    }
    totalRegistros++;

    let seq = 0;
    let valorLote = 0;
    for (const t of lista) {
      seq++;
      const r = registro();
      r.put(1, 3, "341");
      r.put(4, 4, num(lote, 4));
      r.put(8, 1, "3");
      r.put(9, 5, num(seq, 5));
      r.put(14, 1, "A");
      r.put(15, 3, "000");
      r.put(18, 3, "000"); // câmara (não corretora/Pix)
      r.put(21, 3, num(t.bancoFavorecido, 3));
      r.put(24, 20, agenciaConta(t.bancoFavorecido, t.agenciaFavorecido, t.contaFavorecido, t.contaDvFavorecido));
      r.put(44, 30, txt(t.nomeFavorecido, 30));
      r.put(74, 20, txt(t.seuNumero || "", 20));
      r.put(94, 8, ddmmaaaa(t.dataPagamento));
      r.put(102, 3, "REA");
      r.put(120, 15, valorCent(t.valor, 15));
      r.put(204, 14, num(t.doc, 14));
      r.put(230, 1, "0");
      linhas.push(r.build());
      totalRegistros++;
      valorLote += t.valor;
    }

    // Trailer de Lote
    {
      const r = registro();
      r.put(1, 3, "341");
      r.put(4, 4, num(lote, 4));
      r.put(8, 1, "5");
      r.put(18, 6, num(2 + lista.length, 6)); // header + N detalhe + trailer
      r.put(24, 18, valorCent(valorLote, 18));
      r.put(42, 18, num(0, 18));
      linhas.push(r.build());
    }
    totalRegistros++;
    valorTotal += valorLote;
  }

  // Trailer de Arquivo
  {
    const r = registro();
    r.put(1, 3, "341");
    r.put(4, 4, "9999");
    r.put(8, 1, "9");
    r.put(18, 6, num(lote, 6));
    r.put(24, 6, num(totalRegistros + 1, 6));
    linhas.push(r.build());
  }

  return { conteudo: linhas.join("\r\n") + "\r\n", quantidade: prep.length, valorTotal, ignorados };
}

export function gerarRemessaItauPix(opts: {
  pagador: PagadorCnab;
  pix: PixCnab[];
  agora?: Date;
}): RemessaResultado {
  const { pagador } = opts;
  const agora = opts.agora ?? new Date();
  const ignorados: RemessaResultado["ignorados"] = [];

  type Prep = PixCnab & { tipoChave: "01" | "02" | "03" | "04"; doc: string };
  const prep: Prep[] = [];
  for (const p of opts.pix) {
    if (!p.chavePix || !p.chavePix.trim()) {
      ignorados.push({ descricao: p.nomeFavorecido, motivo: "linha_invalida" });
      continue;
    }
    const tipoChave = tipoChavePix(p.chavePix);
    let doc = so(p.docFavorecido);
    if (doc.length !== 11 && doc.length !== 14) {
      // se a própria chave for CPF/CNPJ, usa-a como documento
      if (tipoChave === "03") doc = so(p.chavePix);
    }
    if (doc.length !== 11 && doc.length !== 14) {
      ignorados.push({ descricao: p.nomeFavorecido, motivo: "sem_doc_favorecido" });
      continue;
    }
    prep.push({ ...p, tipoChave, doc });
  }

  const docPag = so(pagador.documento);
  const tipoPag = docPag.length === 14 ? "2" : "1";
  const linhas: string[] = [];

  // Header de Arquivo
  {
    const r = registro();
    r.put(1, 3, "341");
    r.put(4, 4, "0000");
    r.put(8, 1, "0");
    r.put(15, 3, "080");
    r.put(18, 1, tipoPag);
    r.put(19, 14, num(docPag, 14));
    r.put(53, 5, num(pagador.agencia, 5));
    r.put(59, 12, num(pagador.contaNumero, 12));
    r.put(72, 1, num(pagador.contaDv || "0", 1));
    r.put(73, 30, txt(pagador.nome, 30));
    r.put(103, 30, txt("BANCO ITAU SA", 30));
    r.put(143, 1, "1");
    r.put(144, 8, dataHoje(agora));
    r.put(152, 6, horaAgora(agora));
    r.put(167, 5, "00000");
    linhas.push(r.build());
  }

  let totalRegistros = 1;
  let valorTotal = 0;

  if (prep.length > 0) {
    // Header de Lote (forma 45 = Pix Transferência)
    {
      const r = registro();
      r.put(1, 3, "341");
      r.put(4, 4, "0001");
      r.put(8, 1, "1");
      r.put(9, 1, "C");
      r.put(10, 2, "20");
      r.put(12, 2, "45");
      r.put(14, 3, "040");
      r.put(18, 1, tipoPag);
      r.put(19, 14, num(docPag, 14));
      r.put(53, 5, num(pagador.agencia, 5));
      r.put(59, 12, num(pagador.contaNumero, 12));
      r.put(72, 1, num(pagador.contaDv || "0", 1));
      r.put(73, 30, txt(pagador.nome, 30));
      linhas.push(r.build());
    }
    totalRegistros++;

    let seq = 0;
    for (const p of prep) {
      seq++;
      const tipoFav = p.doc.length === 14 ? "2" : "1";
      // Segmento A
      {
        const r = registro();
        r.put(1, 3, "341");
        r.put(4, 4, "0001");
        r.put(8, 1, "3");
        r.put(9, 5, num(seq, 5));
        r.put(14, 1, "A");
        r.put(15, 3, "000");
        r.put(18, 3, "009"); // câmara = PIX (SPI)
        r.put(21, 3, "000"); // banco favorecido (resolvido pela chave)
        // agência/conta favorecido (24-43) = zeros para chave Pix
        r.put(44, 30, txt(p.nomeFavorecido, 30));
        r.put(74, 20, txt(p.seuNumero || "", 20));
        r.put(94, 8, ddmmaaaa(p.dataPagamento));
        r.put(102, 3, "REA");
        r.put(113, 2, "04"); // identificação: chave Pix
        r.put(120, 15, valorCent(p.valor, 15));
        r.put(204, 14, num(p.doc, 14));
        r.put(230, 1, "0"); // sem aviso
        linhas.push(r.build());
      }
      // Segmento B (obrigatório para Pix)
      {
        const r = registro();
        r.put(1, 3, "341");
        r.put(4, 4, "0001");
        r.put(8, 1, "3");
        r.put(9, 5, num(seq, 5));
        r.put(14, 1, "B");
        r.put(15, 2, p.tipoChave);
        r.put(18, 1, tipoFav);
        r.put(19, 14, num(p.doc, 14));
        r.put(128, 100, txtCase(p.chavePix.trim(), 100));
        linhas.push(r.build());
      }
      totalRegistros += 2;
      valorTotal += p.valor;
    }

    // Trailer de Lote
    {
      const r = registro();
      r.put(1, 3, "341");
      r.put(4, 4, "0001");
      r.put(8, 1, "5");
      r.put(18, 6, num(2 + prep.length * 2, 6));
      r.put(24, 18, valorCent(valorTotal, 18));
      r.put(42, 18, num(0, 18));
      linhas.push(r.build());
    }
    totalRegistros++;
  }

  // Trailer de Arquivo
  {
    const r = registro();
    r.put(1, 3, "341");
    r.put(4, 4, "9999");
    r.put(8, 1, "9");
    r.put(18, 6, num(prep.length > 0 ? 1 : 0, 6));
    r.put(24, 6, num(totalRegistros + 1, 6));
    linhas.push(r.build());
  }

  return { conteudo: linhas.join("\r\n") + "\r\n", quantidade: prep.length, valorTotal, ignorados };
}

export function gerarRemessaItauBoletos(opts: {
  pagador: PagadorCnab;
  boletos: BoletoCnab[];
  agora?: Date;
}): RemessaResultado {
  const { pagador } = opts;
  const agora = opts.agora ?? new Date();
  const ignorados: RemessaResultado["ignorados"] = [];

  type Prep = BoletoCnab & { barras: string; forma: "30" | "31" };
  const prep: Prep[] = [];
  for (const b of opts.boletos) {
    const barras = linhaParaBarras(b.linhaDigitavel);
    if (!barras) {
      ignorados.push({ descricao: b.nomeFavorecido || b.linhaDigitavel, motivo: "linha_invalida" });
      continue;
    }
    const doc = so(b.docFavorecido);
    if (doc.length !== 11 && doc.length !== 14) {
      ignorados.push({ descricao: b.nomeFavorecido, motivo: "sem_doc_favorecido" });
      continue;
    }
    prep.push({ ...b, barras, forma: barras.slice(0, 3) === "341" ? "30" : "31" });
  }

  const docPag = so(pagador.documento);
  const tipoPag = docPag.length === 14 ? "2" : "1";
  const linhas: string[] = [];

  // Header de Arquivo
  {
    const r = registro();
    r.put(1, 3, "341");
    r.put(4, 4, "0000");
    r.put(8, 1, "0");
    r.put(15, 3, "080");
    r.put(18, 1, tipoPag);
    r.put(19, 14, num(docPag, 14));
    r.put(53, 5, num(pagador.agencia, 5));
    r.put(59, 12, num(pagador.contaNumero, 12));
    r.put(72, 1, num(pagador.contaDv || "0", 1));
    r.put(73, 30, txt(pagador.nome, 30));
    r.put(103, 30, txt("BANCO ITAU SA", 30));
    r.put(143, 1, "1");
    r.put(144, 8, dataHoje(agora));
    r.put(152, 6, horaAgora(agora));
    r.put(167, 5, "00000");
    linhas.push(r.build());
  }

  // Agrupa por forma (30 = boleto Itaú, 31 = outros bancos) — cada forma é um lote.
  const grupos = new Map<"30" | "31", Prep[]>();
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
    // Header de Lote
    {
      const r = registro();
      r.put(1, 3, "341");
      r.put(4, 4, num(lote, 4));
      r.put(8, 1, "1");
      r.put(9, 1, "C");
      r.put(10, 2, "20"); // tipo de pagamento: fornecedores
      r.put(12, 2, forma);
      r.put(14, 3, "030");
      r.put(18, 1, tipoPag);
      r.put(19, 14, num(docPag, 14));
      r.put(53, 5, num(pagador.agencia, 5));
      r.put(59, 12, num(pagador.contaNumero, 12));
      r.put(72, 1, num(pagador.contaDv || "0", 1));
      r.put(73, 30, txt(pagador.nome, 30));
      linhas.push(r.build());
    }
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
        r.put(1, 3, "341");
        r.put(4, 4, num(lote, 4));
        r.put(8, 1, "3");
        r.put(9, 5, num(seq, 5));
        r.put(14, 1, "J");
        r.put(15, 3, "000");
        r.put(18, 44, b.barras); // banco+moeda+dv+fator+valor+campo livre
        r.put(62, 30, txt(b.nomeFavorecido, 30));
        r.put(92, 8, ddmmaaaa(b.dataPagamento));
        r.put(100, 15, valorCent(b.valor, 15));
        r.put(115, 15, valorCent(0, 15));
        r.put(130, 15, valorCent(0, 15));
        r.put(145, 8, ddmmaaaa(b.dataPagamento));
        r.put(153, 15, valorCent(b.valor, 15));
        r.put(168, 15, num(0, 15));
        r.put(183, 20, txt(b.seuNumero || "", 20));
        linhas.push(r.build());
      }
      // Segmento J-52
      {
        const r = registro();
        r.put(1, 3, "341");
        r.put(4, 4, num(lote, 4));
        r.put(8, 1, "3");
        r.put(9, 5, num(seq, 5));
        r.put(14, 1, "J");
        r.put(15, 3, "000");
        r.put(18, 2, "52");
        r.put(20, 1, tipoPag); // sacado = pagador
        r.put(21, 15, num(docPag, 15));
        r.put(36, 40, txt(pagador.nome, 40));
        r.put(76, 1, tipoFav); // cedente = favorecido
        r.put(77, 15, num(docFav, 15));
        r.put(92, 40, txt(b.nomeFavorecido, 40));
        r.put(132, 1, "0"); // sem sacador avalista
        linhas.push(r.build());
      }
      totalRegistros += 2;
      valorLote += b.valor;
    }

    // Trailer de Lote
    {
      const r = registro();
      r.put(1, 3, "341");
      r.put(4, 4, num(lote, 4));
      r.put(8, 1, "5");
      r.put(18, 6, num(2 + lista.length * 2, 6)); // header + (J+J52)*N + trailer
      r.put(24, 18, valorCent(valorLote, 18));
      r.put(42, 18, num(0, 18));
      linhas.push(r.build());
    }
    totalRegistros++;
    valorTotal += valorLote;
  }

  // Trailer de Arquivo
  {
    const r = registro();
    r.put(1, 3, "341");
    r.put(4, 4, "9999");
    r.put(8, 1, "9");
    r.put(18, 6, num(lote, 6));
    r.put(24, 6, num(totalRegistros + 1, 6));
    linhas.push(r.build());
  }

  return {
    conteudo: linhas.join("\r\n") + "\r\n",
    quantidade: prep.length,
    valorTotal,
    ignorados,
  };
}

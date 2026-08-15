// Remessa CNAB 240 de COBRANÇA (registro de boletos no banco).
// Layout FEBRABAN: header de arquivo + lote serviço 01 + segmentos P/Q por
// título + trailers. O campo "identificação do título no banco" (P 38-57)
// segue a regra de nosso número de cada banco (mesmos DVs do boleto impresso).
// Homologue a primeira remessa com o banco antes de uso recorrente.

import { registro, txt, num, valorCent, ddmmaaaa, dataHoje, horaAgora, so, semAcento } from "@/lib/cnab/febraban240";
import { mod10, mod11Resto, pad } from "@/lib/boleto/febraban";

export type ContaCedente = {
  banco_codigo: string;
  agencia: string;
  agencia_dv: string | null;
  conta_numero: string;
  conta_dv: string | null;
  convenio: string | null;
  carteira: string | null;
  juros_mes_pct?: number | null;
  multa_pct?: number | null;
};

export type TituloRemessa = {
  id: string;
  nosso_numero: number;
  numero_documento: string | null;
  valor: number;
  vencimento: string; // yyyy-mm-dd
  sacado_nome: string | null;
  sacado_documento: string | null;
  sacado_logradouro: string | null;
  sacado_cep: string | null;
  sacado_municipio: string | null;
  sacado_uf: string | null;
};

export type RemessaCobranca = {
  conteudo: string;
  nomeArquivo: string;
  quantidadeTitulos: number;
  valorTotal: number;
};

function diaSeguinte(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
function pct15(p: number): string {
  return String(Math.round(p * 100)).padStart(15, "0");
}

const NOMES_BANCO: Record<string, string> = {
  "341": "BANCO ITAU SA",
  "001": "BANCO DO BRASIL S.A.",
  "237": "BANCO BRADESCO S.A.",
  "033": "BANCO SANTANDER",
  "104": "CAIXA ECONOMICA FEDERAL",
  "756": "BANCOOB",
  "748": "BANCO COOPERATIVO SICREDI",
  "041": "BANRISUL",
  "422": "BANCO SAFRA S.A.",
};

// Identificação do título no banco (P 38-57), por banco — coerente com o
// nosso número impresso no boleto (lib/boleto/bancos.ts).
function idTituloBanco(banco: string, c: ContaCedente, nn: number): string {
  const b = pad(banco, 3);
  if (b === "341") {
    // carteira(3) + NN(8) + DAC(1), demais brancos
    const ag = pad(c.agencia, 4);
    const cc = pad(c.conta_numero, 5);
    const cart = pad(c.carteira ?? "", 3);
    const n8 = pad(nn, 8);
    const dac = mod10(`${ag}${cc}${cart}${n8}`);
    return `${cart}${n8}${dac}`.padEnd(20, " ");
  }
  if (b === "001") {
    // convênio(7) + sequencial(10) = 17 dígitos
    return `${pad(c.convenio ?? "", 7)}${pad(nn, 10)}`.padEnd(20, " ");
  }
  if (b === "237") {
    // NN(11) + DV (mod11 base 7 de carteira+NN)
    const cart = pad(c.carteira ?? "", 2);
    const n11 = pad(nn, 11);
    const resto = mod11Resto(`${cart}${n11}`, 7);
    const dv = resto === 0 ? "0" : resto === 1 ? "P" : String(11 - resto);
    return `${n11}${dv}`.padEnd(20, " ");
  }
  if (b === "033") {
    // NN(12) + DV mod11
    const seq = pad(nn, 12);
    const resto = mod11Resto(seq, 9);
    const dvc = 11 - resto;
    return `${seq}${dvc > 9 ? 0 : dvc}`.padEnd(20, " ");
  }
  if (b === "104") {
    // modalidade(2, da carteira) + sequencial(15)
    return `${pad(c.carteira ?? "14", 2)}${pad(nn, 15)}`.padEnd(20, " ");
  }
  if (b === "756") {
    // sequencial(7) + DV (pesos 3197) + parcela 01
    const ag = pad(c.agencia, 4);
    const seq = pad(nn, 7);
    const base = `${ag}${pad(c.convenio ?? "", 10)}${seq}`;
    const pesos = [3, 1, 9, 7];
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * pesos[i % 4];
    const resto = soma % 11;
    const dv = resto === 0 || resto === 1 ? 0 : 11 - resto;
    return `${seq}${dv}01`.padEnd(20, " ");
  }
  if (b === "748") {
    // Sicredi: ano(2)+byte(1)+seq(5)+DV — convênio guarda posto(2)+cedente(5)
    const ag = pad(c.agencia, 4);
    const conv = pad(c.convenio ?? "", 7);
    const posto = conv.slice(0, 2);
    const cedente = conv.slice(2, 7);
    const ano = String(new Date().getFullYear()).slice(-2);
    const byte = "2";
    const seq = pad(nn, 5);
    const resto = mod11Resto(`${ag}${posto}${cedente}${ano}${byte}${seq}`, 9);
    const dvc = 11 - resto;
    const dv = dvc > 9 ? 0 : dvc;
    return `${ano}${byte}${seq}${dv}`.padEnd(20, " ");
  }
  if (b === "041") {
    // Banrisul: NN(8) sem os DVs duplos no campo de remessa
    return pad(nn, 8).padEnd(20, " ");
  }
  if (b === "422") {
    // Safra: sequencial(8) + DV mod11
    const seq = pad(nn, 8);
    const resto = mod11Resto(seq, 9);
    const dvc = 11 - resto;
    return `${seq}${dvc > 9 ? 0 : dvc}`.padEnd(20, " ");
  }
  return pad(nn, 20);
}

export function gerarRemessaCobranca(opts: {
  conta: ContaCedente;
  cedenteNome: string;
  cedenteDocumento: string; // CNPJ/CPF, só dígitos
  titulos: TituloRemessa[];
  sequencialArquivo: number;
  agora?: Date;
}): RemessaCobranca {
  const { conta, titulos } = opts;
  const banco = pad(conta.banco_codigo, 3);
  const nomeBanco = NOMES_BANCO[banco] ?? `BANCO ${banco}`;
  const agora = opts.agora ?? new Date();
  const doc = so(opts.cedenteDocumento);
  const tpInsc = doc.length === 11 ? "1" : "2";
  const linhas: string[] = [];

  // ---------- header de arquivo ----------
  {
    const r = registro();
    r.put(1, 3, banco);
    r.put(4, 4, "0000");
    r.put(8, 1, "0");
    r.put(18, 1, tpInsc);
    r.put(19, 14, doc.padStart(14, "0"));
    r.put(33, 20, txt(conta.convenio ?? "", 20));
    r.put(53, 5, num(conta.agencia, 5));
    r.put(58, 1, txt(conta.agencia_dv ?? "", 1));
    r.put(59, 12, num(conta.conta_numero, 12));
    r.put(71, 1, txt(conta.conta_dv ?? "", 1));
    r.put(73, 30, txt(semAcento(opts.cedenteNome), 30));
    r.put(103, 30, txt(nomeBanco, 30));
    r.put(143, 1, "1"); // remessa
    r.put(144, 8, dataHoje(agora));
    r.put(152, 6, horaAgora(agora));
    r.put(158, 6, num(opts.sequencialArquivo, 6));
    r.put(164, 3, "087"); // versão layout arquivo FEBRABAN
    linhas.push(r.build());
  }

  // ---------- header de lote (serviço 01 = cobrança) ----------
  {
    const r = registro();
    r.put(1, 3, banco);
    r.put(4, 4, "0001");
    r.put(8, 1, "1");
    r.put(9, 1, "R");
    r.put(10, 2, "01");
    r.put(14, 3, "045"); // versão layout lote cobrança
    r.put(18, 1, tpInsc);
    r.put(19, 15, doc.padStart(15, "0"));
    r.put(34, 20, txt(conta.convenio ?? "", 20));
    r.put(54, 5, num(conta.agencia, 5));
    r.put(59, 1, txt(conta.agencia_dv ?? "", 1));
    r.put(60, 12, num(conta.conta_numero, 12));
    r.put(72, 1, txt(conta.conta_dv ?? "", 1));
    r.put(74, 30, txt(semAcento(opts.cedenteNome), 30));
    r.put(184, 8, num(opts.sequencialArquivo, 8));
    r.put(192, 8, dataHoje(agora));
    linhas.push(r.build());
  }

  // ---------- títulos: P + Q ----------
  let nReg = 0;
  let valorTotal = 0;
  for (const t of titulos) {
    valorTotal += t.valor;

    // segmento P
    nReg++;
    {
      const r = registro();
      r.put(1, 3, banco);
      r.put(4, 4, "0001");
      r.put(8, 1, "3");
      r.put(9, 5, num(nReg, 5));
      r.put(14, 1, "P");
      r.put(16, 2, "01"); // movimento: entrada de título
      r.put(18, 5, num(conta.agencia, 5));
      r.put(23, 1, txt(conta.agencia_dv ?? "", 1));
      r.put(24, 12, num(conta.conta_numero, 12));
      r.put(36, 1, txt(conta.conta_dv ?? "", 1));
      r.put(38, 20, idTituloBanco(banco, conta, t.nosso_numero));
      r.put(58, 1, num((conta.carteira ?? "1").slice(-1), 1)); // código da carteira (1 díg.)
      r.put(59, 1, "1"); // cadastramento: com registro
      r.put(60, 1, "1"); // documento tradicional
      r.put(61, 1, "2"); // emissão do boleto: pelo beneficiário
      r.put(62, 1, "2"); // distribuição: pelo beneficiário
      r.put(63, 15, txt(t.numero_documento ?? t.id.slice(0, 15).toUpperCase(), 15));
      r.put(78, 8, ddmmaaaa(t.vencimento));
      r.put(86, 15, valorCent(t.valor, 15));
      r.put(101, 5, "00000"); // agência cobradora
      r.put(106, 1, "0");
      r.put(107, 2, "02"); // espécie: DM
      r.put(109, 1, "N"); // aceite
      r.put(110, 8, dataHoje(agora)); // emissão
      const juros = Number(conta.juros_mes_pct ?? 0);
      if (juros > 0) {
        r.put(118, 1, "2"); // juros: taxa mensal
        r.put(119, 8, ddmmaaaa(diaSeguinte(t.vencimento)));
        r.put(127, 15, pct15(juros));
      } else {
        r.put(118, 1, "3"); // juros: isento
        r.put(119, 8, "00000000");
        r.put(127, 15, num(0, 15));
      }
      r.put(142, 1, "0"); // desconto: sem
      r.put(143, 8, "00000000");
      r.put(151, 15, num(0, 15));
      r.put(166, 15, num(0, 15)); // IOF
      r.put(181, 15, num(0, 15)); // abatimento
      r.put(196, 25, txt(t.id.slice(0, 25).toUpperCase(), 25)); // uso da empresa (seu número)
      r.put(221, 1, "3"); // não protestar
      r.put(222, 2, "00");
      r.put(224, 1, "1"); // baixar/devolver
      r.put(225, 3, "060"); // prazo de baixa
      r.put(228, 3, "09"); // moeda real
      linhas.push(r.build());
    }

    // segmento Q (sacado)
    nReg++;
    {
      const docS = so(t.sacado_documento ?? "");
      const r = registro();
      r.put(1, 3, banco);
      r.put(4, 4, "0001");
      r.put(8, 1, "3");
      r.put(9, 5, num(nReg, 5));
      r.put(14, 1, "Q");
      r.put(16, 2, "01");
      r.put(18, 1, docS.length === 11 ? "1" : "2");
      r.put(19, 15, docS.padStart(15, "0"));
      r.put(34, 40, txt(semAcento(t.sacado_nome ?? ""), 40));
      r.put(74, 40, txt(semAcento(t.sacado_logradouro ?? ""), 40));
      r.put(114, 15, txt("", 15)); // bairro
      const cep = so(t.sacado_cep ?? "").padStart(8, "0");
      r.put(129, 5, cep.slice(0, 5));
      r.put(134, 3, cep.slice(5, 8));
      r.put(137, 15, txt(semAcento(t.sacado_municipio ?? ""), 15));
      r.put(152, 2, txt((t.sacado_uf ?? "").toUpperCase(), 2));
      r.put(154, 1, "0"); // sem avalista
      r.put(155, 15, num(0, 15));
      r.put(210, 3, "000");
      linhas.push(r.build());
    }

    // segmento R (multa) — só quando configurada na conta
    const multa = Number(conta.multa_pct ?? 0);
    if (multa > 0) {
      nReg++;
      const r = registro();
      r.put(1, 3, banco);
      r.put(4, 4, "0001");
      r.put(8, 1, "3");
      r.put(9, 5, num(nReg, 5));
      r.put(14, 1, "R");
      r.put(16, 2, "01");
      r.put(18, 1, "0"); // desconto 2: sem
      r.put(19, 8, "00000000");
      r.put(27, 15, num(0, 15));
      r.put(42, 1, "0"); // desconto 3: sem
      r.put(43, 8, "00000000");
      r.put(51, 15, num(0, 15));
      r.put(66, 1, "2"); // multa: percentual
      r.put(67, 8, ddmmaaaa(diaSeguinte(t.vencimento)));
      r.put(75, 15, pct15(multa));
      linhas.push(r.build());
    }
  }

  // ---------- trailer de lote ----------
  {
    const r = registro();
    r.put(1, 3, banco);
    r.put(4, 4, "0001");
    r.put(8, 1, "5");
    r.put(18, 6, num(nReg + 2, 6)); // registros do lote (header + segmentos + trailer)
    r.put(24, 6, num(titulos.length, 6)); // qtde títulos cobrança simples
    r.put(30, 17, valorCent(valorTotal, 17)); // valor total cobrança simples
    linhas.push(r.build());
  }

  // ---------- trailer de arquivo ----------
  {
    const r = registro();
    r.put(1, 3, banco);
    r.put(4, 4, "9999");
    r.put(8, 1, "9");
    r.put(18, 6, "000001"); // qtde lotes
    r.put(24, 6, num(linhas.length + 1, 6)); // total de registros do arquivo
    linhas.push(r.build());
  }

  const conteudo = linhas.join("\r\n") + "\r\n";
  const nomeArquivo = `COB_${banco}_${dataHoje(agora)}_${num(opts.sequencialArquivo, 6)}.REM`;
  return { conteudo, nomeArquivo, quantidadeTitulos: titulos.length, valorTotal };
}

// lib/contabil/adapters.ts
// Adapters de arquivo contábil nativo, alimentados pelas partidas do exportador.
// Client-safe: nada de Buffer do Node nem require(). Cada adapter recebe uma lista
// de LINHAS (uma partida = um débito + um crédito + valor) e devolve o arquivo no
// formato do sistema. Encoding Latin-1 feito byte-a-byte (sem dependência externa).

export type LinhaContabil = {
  data: string; // ISO yyyy-mm-dd
  contaDebito: string;
  contaCredito: string;
  valor: number; // reais, positivo
  codHistorico: string; // código de histórico (opcional; "" quando não houver)
  complemento: string; // texto livre
};

export type CtxExport = {
  cnpj: string; // pode vir formatado; normalizamos
  nome?: string; // razão social (usada no 0000 do SPED ECD)
  ano: number;
  mes: number; // 1-12
  loteNumero?: number;
  loteDescricao?: string;
};

export type ArquivoExport = { nomeArquivo: string; conteudo: string | Uint8Array; mime: string };

const CRLF = "\r\n";

function onlyDigits(s: string): string {
  return (s || "").replace(/\D/g, "");
}
function limpar(s: string): string {
  return (s || "").replace(/[\r\n]+/g, " ").trim();
}
function dataBarra(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}
function dataCompacta(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}${m}${a}`;
}
function centavos(v: number): number {
  return Math.round(v * 100);
}
function valorSemSep(v: number): string {
  return String(centavos(v));
}
function valorVirgula(v: number): string {
  return v.toFixed(2).replace(".", ",");
}
function valorPonto(v: number): string {
  return v.toFixed(2);
}
function campoNum(v: string | number, n: number): string {
  const s = onlyDigits(String(v));
  return s.slice(-n).padStart(n, "0");
}
function campoAlpha(v: string, n: number): string {
  const s = limpar(v);
  return s.slice(0, n).padEnd(n, " ");
}
function valorCampoFixo(v: number, n: number): string {
  return campoNum(centavos(v), n);
}
function tag(ctx: CtxExport): string {
  return `${ctx.ano}${String(ctx.mes).padStart(2, "0")}`;
}
function compIso(ctx: CtxExport): string {
  return `${ctx.ano}-${String(ctx.mes).padStart(2, "0")}-01`;
}
// Latin-1 (ISO-8859-1) byte-a-byte. Chars fora da faixa viram "?".
function latin1(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    out[i] = c <= 0xff ? c : 0x3f;
  }
  return out;
}

// ============================================================================
// DOMÍNIO — leiaute "com separador" (pipe). Registros 0000 / 6000 / 6100.
// ============================================================================
function dominio(linhas: LinhaContabil[], ctx: CtxExport): ArquivoExport {
  const cnpj = onlyDigits(ctx.cnpj);
  const out: string[] = [];
  out.push(["0000", cnpj].join("|"));
  out.push(["6000", "M", dataBarra(compIso(ctx))].join("|"));
  for (const l of linhas) {
    out.push(
      ["6100", dataBarra(l.data), l.contaDebito, l.contaCredito, valorSemSep(l.valor), l.codHistorico, limpar(l.complemento)].join("|"),
    );
  }
  return { nomeArquivo: `dominio_${cnpj}_${tag(ctx)}.txt`, conteudo: latin1(out.join(CRLF) + CRLF), mime: "text/plain; charset=ISO-8859-1" };
}

// ============================================================================
// ALTERDATA — Importação Personalizada (Texto). 10 colunas entre aspas, vírgula.
// ============================================================================
function alterdata(linhas: LinhaContabil[], ctx: CtxExport): ArquivoExport {
  const aspas = (v: string) => `"${(v || "").replace(/"/g, "'")}"`;
  const out = linhas.map((l) =>
    ["", l.contaDebito, l.contaCredito, dataBarra(l.data), valorVirgula(l.valor), l.codHistorico, limpar(l.complemento), "", "", ""]
      .map(aspas)
      .join(","),
  );
  return { nomeArquivo: `alterdata_${onlyDigits(ctx.cnpj)}_${tag(ctx)}.txt`, conteudo: latin1(out.join(CRLF) + CRLF), mime: "text/plain; charset=ISO-8859-1" };
}

// ============================================================================
// SAGE / FOLHAMATIC / EBS / IOB — "Lote Normal" posicional (100 bytes/registro).
// Registro C (capa) + N registros L. Valor 9(15)V99; data DDMMAAAA; contas (6).
// ============================================================================
function sageEbs(linhas: LinhaContabil[], ctx: CtxExport): ArquivoExport {
  const cnpj = campoNum(ctx.cnpj, 14);
  const loteNum = ctx.loteNumero ?? 0;
  let seq = 1;
  const totalCent = linhas.reduce((acc, l) => acc + centavos(l.valor), 0);

  const capa =
    "C" +
    "M" +
    dataCompacta(compIso(ctx)) +
    campoNum(totalCent, 15) +
    campoAlpha(ctx.loteDescricao ?? "FINANCEIROSIMPLES", 20) +
    campoAlpha("OUT", 3) +
    campoAlpha("", 10) +
    "L" +
    cnpj +
    campoAlpha("", 22) +
    campoNum(seq++, 5);

  const ls = linhas.map(
    (l) =>
      "L" +
      dataCompacta(l.data) +
      campoNum(l.contaDebito, 6) +
      campoNum(l.contaCredito, 6) +
      campoNum(l.codHistorico, 3) +
      campoAlpha(l.complemento, 25) +
      valorCampoFixo(l.valor, 15) +
      campoNum("", 3) +
      campoAlpha("", 14) +
      campoAlpha("", 14) +
      campoNum(seq++, 5),
  );

  const nnnnn = String(loteNum).padStart(5, "0");
  return { nomeArquivo: `LOTD${nnnnn}_${cnpj}.TXT`, conteudo: latin1([capa, ...ls].join(CRLF) + CRLF), mime: "text/plain; charset=ISO-8859-1" };
}

// ============================================================================
// QUESTOR — delimitado por ";". Valor com PONTO; data DDMMAAAA.
// ============================================================================
function questor(linhas: LinhaContabil[], ctx: CtxExport): ArquivoExport {
  const out = linhas.map(
    (l) => [dataCompacta(l.data), l.contaDebito, l.contaCredito, valorPonto(l.valor), l.codHistorico, `"${limpar(l.complemento)}"`].join(";") + ";",
  );
  return { nomeArquivo: `questor_${onlyDigits(ctx.cnpj)}_${tag(ctx)}.txt`, conteudo: out.join(CRLF) + CRLF, mime: "text/plain" };
}

// ============================================================================
// PLANILHA — presets de coluna POR SISTEMA (config-driven).
// O app gera partidas em 1ª fórmula (um débito + um crédito por linha); o preset de
// cada sistema define cabeçalho, ordem das colunas e saída (xlsx/csv).
// ⚠️ Os presets abaixo são padrões sensatos. Para casar exatamente com um sistema,
//    extraia a planilha modelo nele e ajuste a entrada dele em PRESETS_PLANILHA.
// ============================================================================
type CampoPlanilha = "data" | "contaDebito" | "contaCredito" | "valor" | "codHistorico" | "complemento";
type ColunaPlanilha = { header: string; campo: CampoPlanilha };
type PresetPlanilha = { colunas: ColunaPlanilha[]; saida: "xlsx" | "csv"; sep?: string };

const COLUNAS_PADRAO: ColunaPlanilha[] = [
  { header: "Data", campo: "data" },
  { header: "Conta Débito", campo: "contaDebito" },
  { header: "Conta Crédito", campo: "contaCredito" },
  { header: "Valor", campo: "valor" },
  { header: "Histórico", campo: "codHistorico" },
  { header: "Complemento", campo: "complemento" },
];

const PRESETS_PLANILHA: Record<string, PresetPlanilha> = {
  Contmatic: { colunas: COLUNAS_PADRAO, saida: "xlsx" },
  Fortes: { colunas: COLUNAS_PADRAO, saida: "xlsx" },
  Calima: { colunas: COLUNAS_PADRAO, saida: "xlsx" },
  Makrosystem: { colunas: COLUNAS_PADRAO, saida: "xlsx" },
  Netspeed: { colunas: COLUNAS_PADRAO, saida: "csv", sep: ";" },
  // Planilha de lote contábil padrão — a maioria dos sistemas importa este formato.
  // Serve de saída utilizável para qualquer sistema ainda sem layout nativo próprio.
  "Planilha de lançamentos (padrão)": { colunas: COLUNAS_PADRAO, saida: "xlsx" },
};

function baseNomePlanilha(nome: string, ctx: CtxExport): string {
  return `${nome.toLowerCase().replace(/\W+/g, "_")}_${onlyDigits(ctx.cnpj)}_${tag(ctx)}`;
}

function valorCelula(l: LinhaContabil, campo: CampoPlanilha, paraXlsx: boolean): string | number {
  switch (campo) {
    case "data":
      return dataBarra(l.data);
    case "contaDebito":
      return l.contaDebito;
    case "contaCredito":
      return l.contaCredito;
    case "valor":
      return paraXlsx ? Number(l.valor.toFixed(2)) : valorVirgula(l.valor);
    case "codHistorico":
      return l.codHistorico;
    case "complemento":
      return limpar(l.complemento);
  }
}

function gerarAdapterPlanilha(nome: string, preset: PresetPlanilha) {
  return async (linhas: LinhaContabil[], ctx: CtxExport): Promise<ArquivoExport> => {
    const headers = preset.colunas.map((c) => c.header);
    if (preset.saida === "csv") {
      const sep = preset.sep ?? ";";
      const cell = (v: string | number) => {
        const s = String(v);
        return s.includes(sep) ? `"${s.replace(/"/g, "'")}"` : s;
      };
      const head = headers.join(sep);
      const body = linhas.map((l) => preset.colunas.map((c) => cell(valorCelula(l, c.campo, false))).join(sep));
      return {
        nomeArquivo: `${baseNomePlanilha(nome, ctx)}.csv`,
        conteudo: "\uFEFF" + [head, ...body].join(CRLF) + CRLF,
        mime: "text/csv;charset=utf-8",
      };
    }
    const XLSX = await import("xlsx");
    const corpo = linhas.map((l) => preset.colunas.map((c) => valorCelula(l, c.campo, true)));
    const ws = XLSX.utils.aoa_to_sheet([headers, ...corpo]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Lancamentos");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    return {
      nomeArquivo: `${baseNomePlanilha(nome, ctx)}.xlsx`,
      conteudo: new Uint8Array(buf),
      mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  };
}

// ============================================================================
// SPED ECD — camada de LANÇAMENTOS (I200/I250) + envelope estrutural.
// Pipe-delimitado, Latin-1, DDMMAAAA, decimal com vírgula.
// ⚠️ ESCOPO: gera os lançamentos no formato ECD (um I200 + duas partidas I250 por
//    partida do app) com os contadores de bloco. NÃO é um ECD transmissível: faltam
//    plano de contas (I050), saldos (I150/I155) e DRE (bloco J), e o 0000 traz só os
//    campos de identidade. Complete e valide no PVA / no contábil.
// ============================================================================
function spedEcd(linhas: LinhaContabil[], ctx: CtxExport): ArquivoExport {
  const cnpj = onlyDigits(ctx.cnpj);
  const mm = String(ctx.mes).padStart(2, "0");
  const dtIni = `01${mm}${ctx.ano}`;
  const ultimo = new Date(ctx.ano, ctx.mes, 0).getDate();
  const dtFim = `${String(ultimo).padStart(2, "0")}${mm}${ctx.ano}`;
  const nome = limpar(ctx.nome ?? "").replace(/\|/g, " ");
  const texto = (s: string) => limpar(s).replace(/\|/g, " ");
  const reg = (campos: (string | number)[]) => "|" + campos.join("|") + "|";

  // Bloco 0 (identidade — 0000 só com os campos centrais; demais ficam para o PVA)
  const b0: string[] = [];
  b0.push(reg(["0000", "LECD", dtIni, dtFim, nome, cnpj]));
  b0.push(reg(["0001", "0"]));
  b0.push(reg(["0990", b0.length + 1]));

  // Bloco I (lançamentos)
  const bI: string[] = [];
  bI.push(reg(["I001", "0"]));
  let num = 1;
  for (const l of linhas) {
    const dt = dataCompacta(l.data);
    const val = valorVirgula(l.valor);
    const hist = texto(l.complemento);
    bI.push(reg(["I200", num, dt, val, "N"]));
    bI.push(reg(["I250", l.contaDebito, "", val, "D", "", "", l.codHistorico, hist]));
    bI.push(reg(["I250", l.contaCredito, "", val, "C", "", "", l.codHistorico, hist]));
    num++;
  }
  bI.push(reg(["I990", bI.length + 1]));

  const content = [...b0, ...bI];

  // Bloco 9 (contadores) — auto-referente conforme o padrão SPED
  const counts: Record<string, number> = {};
  const ordem: string[] = [];
  for (const line of content) {
    const t = line.split("|")[1];
    counts[t] = (counts[t] || 0) + 1;
    if (!ordem.includes(t)) ordem.push(t);
  }
  const tipos = [...ordem, "9001", "9900", "9990", "9999"];
  const n9900 = tipos.length;
  const cnt = (t: string) =>
    t === "9001" || t === "9990" || t === "9999" ? 1 : t === "9900" ? n9900 : counts[t];
  const b9: string[] = [];
  b9.push(reg(["9001", "0"]));
  for (const t of tipos) b9.push(reg(["9900", t, cnt(t)]));
  const linhasB9 = 1 + n9900 + 1; // 9001 + 9900s + 9990 (sem 9999)
  b9.push(reg(["9990", linhasB9]));
  const total = content.length + b9.length + 1; // + a própria 9999
  b9.push(reg(["9999", total]));

  const conteudo = [...content, ...b9].join(CRLF) + CRLF;
  return { nomeArquivo: `ecd_lancamentos_${cnpj}_${tag(ctx)}.txt`, conteudo: latin1(conteudo), mime: "text/plain; charset=ISO-8859-1" };
}

const REG: Record<string, (l: LinhaContabil[], c: CtxExport) => ArquivoExport | Promise<ArquivoExport>> = {
  "SPED ECD": spedEcd,
  Domínio: dominio,
  Alterdata: alterdata,
  Sage: sageEbs,
  Folhamatic: sageEbs,
  IOB: sageEbs,
  Questor: questor,
  ...Object.fromEntries(
    Object.entries(PRESETS_PLANILHA).map(([nome, preset]) => [nome, gerarAdapterPlanilha(nome, preset)]),
  ),
};

/** Lista dos formatos que têm arquivo nativo (para marcar como "configurados"). */
export const FORMATOS_NATIVOS = Object.keys(REG);

export function temAdapter(formato: string): boolean {
  return formato in REG;
}

export async function gerarArquivo(
  formato: string,
  linhas: LinhaContabil[],
  ctx: CtxExport,
): Promise<ArquivoExport | null> {
  const fn = REG[formato];
  return fn ? await fn(linhas, ctx) : null;
}

// Montagem da DPS (Declaração de Prestação de Serviço) — NFS-e Nacional, leiaute 1.00.
// O XML é gerado de forma CANÔNICA (sem espaços entre tags, atributos fixos,
// sem self-closing) para que a assinatura digital calcule o digest sobre
// exatamente os bytes transmitidos.

export type DadosDps = {
  ambiente: "homologacao" | "producao"; // tpAmb: 1 produção, 2 homologação
  dhEmi: string; // ISO com offset, ex.: 2026-06-12T10:00:00-03:00
  serie: string;
  numero: number;
  competencia: string; // yyyy-mm-dd
  emitente: {
    cnpj: string; // só dígitos (14)
    inscricaoMunicipal?: string | null;
    codigoMunicipioIbge: string; // 7 dígitos
    opSimples: "optante" | "mei" | "nao_optante";
    razaoSocial: string;
  };
  tomador: {
    documento: string; // CPF (11) ou CNPJ (14), só dígitos
    nome: string;
    codigoMunicipioIbge?: string | null;
    cep?: string | null;
    logradouro?: string | null;
    numero?: string | null;
    complemento?: string | null;
    bairro?: string | null;
    municipio?: string | null;
    uf?: string | null;
  };
  servico: {
    itemLc116: string; // ex.: "17.19" → vira cTribNac 6 díg "171900"? Não: 17.19 → "1719"
    codigoTributacaoMunicipal?: string | null;
    discriminacao: string;
    valor: number;
    aliquotaIss: number; // %
    issRetido: boolean;
    exigibilidade: string; // exigivel | nao_incidencia | isencao | imunidade | suspensa
  };
};

function dig(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}
function esc(s: string): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
function dec2(v: number): string {
  return v.toFixed(2);
}

// Identificador da DPS (atributo Id): "DPS" + cMun(7) + tpInsc(1: 1=CPF 2=CNPJ)
// + inscrição(14, CPF completa com zeros) + série(5) + número(15).
export function idDps(d: DadosDps): string {
  const doc = dig(d.emitente.cnpj).padStart(14, "0");
  const tp = dig(d.emitente.cnpj).length === 11 ? "1" : "2";
  return `DPS${d.emitente.codigoMunicipioIbge}${tp}${doc}${d.serie.padStart(5, "0")}${String(d.numero).padStart(15, "0")}`;
}

// cTribNac: item da LC 116 em 6 dígitos (ex.: 17.19 → "171900"; 01.07 → "010700").
export function cTribNac(itemLc116: string): string {
  const partes = dig(itemLc116);
  return partes.padEnd(6, "0").slice(0, 6);
}

const EXIG_COD: Record<string, string> = {
  // tpImunidade/exigibilidade simplificada do leiaute nacional (tribISSQN):
  // 1 = operação tributável, 2 = imunidade, 3 = exportação, 4 = não incidência
  exigivel: "1",
  imunidade: "2",
  nao_incidencia: "4",
  isencao: "1", // tributável com benefício — detalhamento de benefício fica para evolução
  suspensa: "1",
};

// opSimpNac: 1 = não optante, 2 = MEI, 3 = ME/EPP optante
const SIMPLES_COD: Record<string, string> = {
  nao_optante: "1",
  mei: "2",
  optante: "3",
};

// Monta o elemento <infDPS> (o que é assinado) e o envelope <DPS>.
export function montarDpsXml(d: DadosDps): { xml: string; infDps: string; id: string } {
  const id = idDps(d);
  const tpAmb = d.ambiente === "producao" ? "1" : "2";
  const docTomador = dig(d.tomador.documento);
  const tagDocTomador = docTomador.length === 11 ? `<CPF>${docTomador}</CPF>` : `<CNPJ>${docTomador.padStart(14, "0")}</CNPJ>`;
  const im = dig(d.emitente.inscricaoMunicipal ?? "");
  const issRet = d.servico.issRetido ? "2" : "1"; // tpRetISSQN: 1 não retido, 2 retido pelo tomador

  const nroTomador = esc((d.tomador.numero ?? "").slice(0, 60).trim() || "S/N");
  const cplTomador = (d.tomador.complemento ?? "").slice(0, 156).trim();
  const bairroTomador = esc((d.tomador.bairro ?? "").slice(0, 60).trim() || "NAO INFORMADO");
  const endTomador =
    d.tomador.codigoMunicipioIbge || d.tomador.cep
      ? `<end><endNac><cMun>${dig(d.tomador.codigoMunicipioIbge ?? "")}</cMun><CEP>${dig(d.tomador.cep ?? "").padStart(8, "0")}</CEP></endNac><xLgr>${esc((d.tomador.logradouro ?? "").slice(0, 255) || "NAO INFORMADO")}</xLgr><nro>${nroTomador}</nro>${cplTomador ? `<xCpl>${esc(cplTomador)}</xCpl>` : ""}<xBairro>${bairroTomador}</xBairro></end>`
      : "";

  const infDps =
    `<infDPS Id="${id}">` +
    `<tpAmb>${tpAmb}</tpAmb>` +
    `<dhEmi>${d.dhEmi}</dhEmi>` +
    `<verAplic>FinanceiroSimples1.0</verAplic>` +
    `<serie>${d.serie.padStart(5, "0")}</serie>` +
    `<nDPS>${d.numero}</nDPS>` +
    `<dCompet>${d.competencia}</dCompet>` +
    `<tpEmit>1</tpEmit>` + // 1 = prestador
    `<cLocEmi>${d.emitente.codigoMunicipioIbge}</cLocEmi>` +
    `<prest>` +
    `<CNPJ>${dig(d.emitente.cnpj).padStart(14, "0")}</CNPJ>` +
    (im ? `<IM>${im}</IM>` : "") +
    `<xNome>${esc(d.emitente.razaoSocial.slice(0, 300))}</xNome>` +
    `<regTrib><opSimpNac>${SIMPLES_COD[d.emitente.opSimples] ?? "3"}</opSimpNac><regEspTrib>0</regEspTrib></regTrib>` +
    `</prest>` +
    `<toma>` +
    tagDocTomador +
    `<xNome>${esc(d.tomador.nome.slice(0, 300))}</xNome>` +
    endTomador +
    `</toma>` +
    `<serv>` +
    `<locPrest><cLocPrestacao>${d.emitente.codigoMunicipioIbge}</cLocPrestacao></locPrest>` +
    `<cServ>` +
    `<cTribNac>${cTribNac(d.servico.itemLc116)}</cTribNac>` +
    (d.servico.codigoTributacaoMunicipal ? `<cTribMun>${dig(d.servico.codigoTributacaoMunicipal).padStart(3, "0").slice(0, 3)}</cTribMun>` : "") +
    `<xDescServ>${esc(d.servico.discriminacao.slice(0, 2000) || "Prestacao de servicos")}</xDescServ>` +
    `</cServ>` +
    `</serv>` +
    `<valores>` +
    `<vServPrest><vServ>${dec2(d.servico.valor)}</vServ></vServPrest>` +
    `<trib>` +
    `<tribMun>` +
    `<tribISSQN>${EXIG_COD[d.servico.exigibilidade] ?? "1"}</tribISSQN>` +
    `<tpRetISSQN>${issRet}</tpRetISSQN>` +
    (d.servico.aliquotaIss > 0 ? `<pAliq>${dec2(d.servico.aliquotaIss)}</pAliq>` : "") +
    `</tribMun>` +
    `<totTrib><indTotTrib>0</indTotTrib></totTrib>` +
    `</trib>` +
    `</valores>` +
    `</infDPS>`;

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00">` +
    infDps +
    `</DPS>`;

  return { xml, infDps, id };
}

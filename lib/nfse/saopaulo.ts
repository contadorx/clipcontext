import crypto from "crypto";
import https from "https";
import type { CertA1 } from "@/lib/nfse/assinatura";
import { assinarPedidoSp } from "@/lib/nfse/assinatura";
import type { DadosDps } from "@/lib/nfse/dps";

// ============================================================
// Adapter NFS-e da Prefeitura de São Paulo (capital, IBGE 3550308)
//
// São Paulo NÃO aderiu ao sistema nacional (Sefin). Usa o próprio
// web service SOAP ("Nota do Milhão" / PadrãoNFe). Diferenças centrais
// em relação ao nacional:
//   - SOAP/XML, não REST/JSON
//   - cada RPS é assinado com RSA-SHA1 sobre uma string de campos em
//     POSIÇÃO FIXA (não é XMLDSig)
//   - o XML do pedido inteiro também é assinado (assinatura do lote)
//   - identificador: número do RPS + Inscrição Municipal (CCM)
//
// Endpoint: nfe.prefeitura.sp.gov.br/ws/lotenfe.asmx
// Método usado: EnvioRPS (emissão síncrona de 1 RPS por vez)
// ============================================================

// Endpoint síncrono recomendado (manual 3.3.4): nfews.prefeitura.sp.gov.br/lotenfe.asmx
// comporta os layouts v1 e v2. O antigo nfe.prefeitura.sp.gov.br/ws/lotenfe.asmx será
// desativado. Host e path mudaram (não tem mais /ws/).
const HOST = "nfews.prefeitura.sp.gov.br";
const PATH = "/lotenfe.asmx";

function esc(s: string): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
function dig(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}
// remove acentos e força maiúsculas — SP rejeita alguns caracteres
function asciiUpper(s: string): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

// ---- assinatura RSA-SHA1 de um RPS (string de posições fixas) ----
//
// A "Assinatura" do RPS em SP é o resultado de assinar, com a chave privada
// do certificado (RSA-SHA1) e codificar em base64, uma STRING montada com os
// campos abaixo concatenados, cada um com largura/formato fixos:
//
//   IM do prestador        8  posições, dígitos, padded à esquerda com '0'
//   Série do RPS           5  posições, à esquerda com espaços
//   Número do RPS         12  posições, dígitos, padded à esquerda com '0'
//   Data de emissão        8  posições, AAAAMMDD
//   Tributação do RPS      1  posição  ('T' tributado no município)
//   Status do RPS          1  posição  ('N' normal)
//   ISS retido             1  posição  ('S' sim, 'N' não)
//   Valor dos serviços    15  posições, centavos, padded à esquerda com '0'
//   Valor das deduções    15  posições, centavos, padded à esquerda com '0'
//   Código do serviço      5  posições, dígitos, padded à esquerda com '0'
//   Indicador CPF/CNPJ
//     do tomador           1  posição  ('1' CPF, '2' CNPJ, '3' não informado)
//   CPF/CNPJ do tomador   14  posições, dígitos, padded à esquerda com '0'
//
function num(n: number): string {
  // valor em centavos, sem separador — USADO SÓ NA STRING DE ASSINATURA (86 pos)
  return String(Math.round(Number(n) * 100));
}
function reais(n: number): string {
  // valor em reais com ponto decimal (tpValor) — USADO NOS ELEMENTOS XML.
  // O manual (p.45) escreve <ValorServicos>20500</ValorServicos> para R$20.500
  // e usa centavos (2050000) apenas na assinatura. Escrever centavos no XML faz
  // SP reler o número como reais (100x maior), quebrando a conferência de
  // assinatura do RPS (1206) e o total do lote (1204).
  return (Math.round(Number(n) * 100) / 100).toFixed(2);
}
function padL(s: string, len: number, ch = "0"): string {
  return s.length >= len ? s.slice(-len) : ch.repeat(len - s.length) + s;
}
function padR(s: string, len: number, ch = " "): string {
  return s.length >= len ? s.slice(0, len) : s + ch.repeat(len - s.length);
}

export type RpsSp = {
  inscricaoMunicipal: string; // CCM do prestador (8 díg)
  serie: string;
  numero: number;
  dataEmissao: string; // AAAA-MM-DD
  issRetido: boolean;
  valorServicos: number;
  valorDeducoes: number;
  codigoServico: string; // código de serviço do município de SP (lista própria)
  aliquota: number; // ex.: 0.05 para 5%
  discriminacao: string;
  tomador: {
    documento: string; // CPF/CNPJ só dígitos
    razaoSocial: string;
    email?: string | null;
    // endereço (opcional, mas recomendado)
    tipoLogradouro?: string | null;
    logradouro?: string | null;
    numero?: string | null;
    complemento?: string | null;
    bairro?: string | null;
    cidadeIbge?: string | null; // código IBGE da cidade do tomador
    uf?: string | null;
    cep?: string | null;
  };
};

// assina o RPS com RSA-SHA1 sobre a string de posições fixas
export function assinarRps(rps: RpsSp, chavePem: string): string {
  const im = padL(dig(rps.inscricaoMunicipal), 8);
  const serie = padR(rps.serie || "", 5);
  const numero = padL(String(rps.numero), 12);
  const data = rps.dataEmissao.replace(/-/g, "");
  const tributacao = "T";
  const status = "N";
  const issRet = rps.issRetido ? "S" : "N";
  const vServ = padL(num(rps.valorServicos), 15);
  const vDed = padL(num(rps.valorDeducoes || 0), 15);
  const codServ = padL(dig(rps.codigoServico), 5);
  const docTom = dig(rps.tomador.documento);
  const indTom = docTom.length === 11 ? "1" : docTom.length === 14 ? "2" : "3";
  const cpfCnpj = padL(docTom, 14);

  const cadeia = im + serie + numero + data + tributacao + status + issRet + vServ + vDed + codServ + indTom + cpfCnpj;
  const signer = crypto.createSign("RSA-SHA1");
  signer.update(cadeia, "latin1");
  signer.end();
  return signer.sign(chavePem, "base64");
}

// ---- montagem do XML do PedidoEnvioRPS ----
//
// O EnvioRPS transmite UM RPS. O XML carrega o cabeçalho (CPF/CNPJ do
// remetente) e o RPS com a Assinatura calculada acima.
export function montarPedidoEnvioRps(opts: {
  cnpjRemetente: string; // CNPJ do prestador (remetente)
  rps: RpsSp;
  assinaturaRps: string;
}): string {
  const { cnpjRemetente, rps, assinaturaRps } = opts;
  const docTom = dig(rps.tomador.documento);
  const tipoTom = docTom.length === 11 ? "<CPF>" + docTom + "</CPF>" : docTom.length === 14 ? "<CNPJ>" + docTom + "</CNPJ>" : "";
  const aliquotaFmt = rps.aliquota.toFixed(4); // ex.: 0.0500

  const enderecoTom =
    rps.tomador.cep && rps.tomador.logradouro
      ? `<EnderecoTomador>` +
        `<TipoLogradouro>${esc(asciiUpper(rps.tomador.tipoLogradouro || "R"))}</TipoLogradouro>` +
        `<Logradouro>${esc(asciiUpper(rps.tomador.logradouro).slice(0, 50))}</Logradouro>` +
        `<NumeroEndereco>${esc((rps.tomador.numero || "S/N").slice(0, 10))}</NumeroEndereco>` +
        (rps.tomador.complemento ? `<ComplementoEndereco>${esc(asciiUpper(rps.tomador.complemento).slice(0, 30))}</ComplementoEndereco>` : "") +
        `<Bairro>${esc(asciiUpper(rps.tomador.bairro || "").slice(0, 30))}</Bairro>` +
        `<Cidade>${dig(rps.tomador.cidadeIbge || "")}</Cidade>` +
        `<UF>${esc((rps.tomador.uf || "SP").toUpperCase().slice(0, 2))}</UF>` +
        `<CEP>${dig(rps.tomador.cep)}</CEP>` +
        `</EnderecoTomador>`
      : "";

  // Cabecalho: versão 1, com CPFCNPJRemetente
  const cabecalho =
    `<Cabecalho xmlns="" Versao="1">` +
    `<CPFCNPJRemetente><CNPJ>${dig(cnpjRemetente)}</CNPJ></CPFCNPJRemetente>` +
    `</Cabecalho>`;

  const rpsXml =
    `<RPS xmlns="">` +
    `<Assinatura>${assinaturaRps}</Assinatura>` +
    `<ChaveRPS>` +
    `<InscricaoPrestador>${dig(rps.inscricaoMunicipal)}</InscricaoPrestador>` +
    `<SerieRPS>${esc(rps.serie || "")}</SerieRPS>` +
    `<NumeroRPS>${rps.numero}</NumeroRPS>` +
    `</ChaveRPS>` +
    `<TipoRPS>RPS</TipoRPS>` +
    `<DataEmissao>${rps.dataEmissao}</DataEmissao>` +
    `<StatusRPS>N</StatusRPS>` +
    `<TributacaoRPS>T</TributacaoRPS>` +
    `<ValorServicos>${reais(rps.valorServicos)}</ValorServicos>` +
    `<ValorDeducoes>${reais(rps.valorDeducoes || 0)}</ValorDeducoes>` +
    `<CodigoServico>${dig(rps.codigoServico)}</CodigoServico>` +
    `<AliquotaServicos>${aliquotaFmt}</AliquotaServicos>` +
    `<ISSRetido>${rps.issRetido ? "true" : "false"}</ISSRetido>` +
    (tipoTom ? `<CPFCNPJTomador>${tipoTom}</CPFCNPJTomador>` : "") +
    `<RazaoSocialTomador>${esc(asciiUpper(rps.tomador.razaoSocial).slice(0, 75))}</RazaoSocialTomador>` +
    enderecoTom +
    (rps.tomador.email ? `<EmailTomador>${esc(rps.tomador.email).slice(0, 75)}</EmailTomador>` : "") +
    `<Discriminacao>${esc(rps.discriminacao).slice(0, 2000)}</Discriminacao>` +
    `</RPS>`;

  return `<?xml version="1.0" encoding="UTF-8"?><PedidoEnvioRPS xmlns="http://www.prefeitura.sp.gov.br/nfe" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">${cabecalho}${rpsXml}</PedidoEnvioRPS>`;
}

// ---- montagem do XML do PedidoEnvioLoteRPS (lote com 1 RPS) ----
//
// O EnvioLoteRPS é o método principal e estável do web service de SP,
// usado por todas as bibliotecas em produção. O cabeçalho do lote leva
// CPFCNPJRemetente, transação, data de início/fim e os totais do lote.
export function montarPedidoEnvioLoteRps(opts: {
  cnpjRemetente: string;
  rps: RpsSp;
  assinaturaRps: string;
  cert: CertA1;
}): string {
  const { cnpjRemetente, rps, assinaturaRps, cert } = opts;
  const docTom = dig(rps.tomador.documento);
  const tipoTom = docTom.length === 11 ? "<CPF>" + docTom + "</CPF>" : docTom.length === 14 ? "<CNPJ>" + docTom + "</CNPJ>" : "";
  const aliquotaFmt = rps.aliquota.toFixed(4);

  const enderecoTom =
    rps.tomador.cep && rps.tomador.logradouro
      ? `<EnderecoTomador>` +
        `<TipoLogradouro>${esc(asciiUpper(rps.tomador.tipoLogradouro || "R"))}</TipoLogradouro>` +
        `<Logradouro>${esc(asciiUpper(rps.tomador.logradouro).slice(0, 50))}</Logradouro>` +
        `<NumeroEndereco>${esc((rps.tomador.numero || "S/N").slice(0, 10))}</NumeroEndereco>` +
        (rps.tomador.complemento ? `<ComplementoEndereco>${esc(asciiUpper(rps.tomador.complemento).slice(0, 30))}</ComplementoEndereco>` : "") +
        `<Bairro>${esc(asciiUpper(rps.tomador.bairro || "").slice(0, 30))}</Bairro>` +
        `<Cidade>${dig(rps.tomador.cidadeIbge || "")}</Cidade>` +
        `<UF>${esc((rps.tomador.uf || "SP").toUpperCase().slice(0, 2))}</UF>` +
        `<CEP>${dig(rps.tomador.cep)}</CEP>` +
        `</EnderecoTomador>`
      : "";

  // Ordem dos elementos do tpRPS conforme o schema (manual 3.3.6, p.31-32):
  // Assinatura, ChaveRPS, TipoRPS, DataEmissao, StatusRPS, TributacaoRPS,
  // ValorServicos, ValorDeducoes, ..., CodigoServico, AliquotaServicos,
  // ISSRetido, CPFCNPJTomador, [InscricaoMunicipalTomador,] RazaoSocialTomador,
  // EnderecoTomador, EmailTomador, ..., Discriminacao.
  const rpsXml =
    `<RPS xmlns="">` +
    `<Assinatura>${assinaturaRps}</Assinatura>` +
    `<ChaveRPS>` +
    `<InscricaoPrestador>${dig(rps.inscricaoMunicipal)}</InscricaoPrestador>` +
    `<SerieRPS>${esc(rps.serie || "")}</SerieRPS>` +
    `<NumeroRPS>${rps.numero}</NumeroRPS>` +
    `</ChaveRPS>` +
    `<TipoRPS>RPS</TipoRPS>` +
    `<DataEmissao>${rps.dataEmissao}</DataEmissao>` +
    `<StatusRPS>N</StatusRPS>` +
    `<TributacaoRPS>T</TributacaoRPS>` +
    `<ValorServicos>${reais(rps.valorServicos)}</ValorServicos>` +
    `<ValorDeducoes>${reais(rps.valorDeducoes || 0)}</ValorDeducoes>` +
    `<CodigoServico>${dig(rps.codigoServico)}</CodigoServico>` +
    `<AliquotaServicos>${aliquotaFmt}</AliquotaServicos>` +
    `<ISSRetido>${rps.issRetido ? "true" : "false"}</ISSRetido>` +
    (tipoTom ? `<CPFCNPJTomador>${tipoTom}</CPFCNPJTomador>` : "") +
    `<RazaoSocialTomador>${esc(asciiUpper(rps.tomador.razaoSocial).slice(0, 75))}</RazaoSocialTomador>` +
    enderecoTom +
    (rps.tomador.email ? `<EmailTomador>${esc(rps.tomador.email).slice(0, 75)}</EmailTomador>` : "") +
    `<Discriminacao>${esc(rps.discriminacao).slice(0, 2000)}</Discriminacao>` +
    `</RPS>`;

  // Cabecalho do lote: transação true, 1 RPS, data início = fim = emissão,
  // e os totais do lote (1 RPS, soma dos valores).
  const cabecalho =
    `<Cabecalho xmlns="" Versao="1">` +
    `<CPFCNPJRemetente><CNPJ>${dig(cnpjRemetente)}</CNPJ></CPFCNPJRemetente>` +
    `<transacao>true</transacao>` +
    `<dtInicio>${rps.dataEmissao}</dtInicio>` +
    `<dtFim>${rps.dataEmissao}</dtFim>` +
    // ATENÇÃO: o schema XSD em produção (versão 1) exige <QtdRPS>, NÃO <QtdeRPS>.
    // O manual 3.3.6 (p.50) escreve "QtdeRPS", mas o validador real rejeita esse
    // nome e exige "QtdRPS". Vale o schema, não o manual.
    `<QtdRPS>1</QtdRPS>` +
    `<ValorTotalServicos>${reais(rps.valorServicos)}</ValorTotalServicos>` +
    `<ValorTotalDeducoes>${reais(rps.valorDeducoes || 0)}</ValorTotalDeducoes>` +
    `</Cabecalho>`;

  const docSemAssinatura = `<?xml version="1.0" encoding="UTF-8"?><PedidoEnvioLoteRPS xmlns="http://www.prefeitura.sp.gov.br/nfe" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">${cabecalho}${rpsXml}</PedidoEnvioLoteRPS>`;
  // A mensagem inteira leva uma assinatura XMLDSig enveloped (ds:Signature),
  // separada da <Assinatura> do RPS. O schema exige Cabecalho + RPS + Signature.
  return assinarPedidoSp(docSemAssinatura, cert, "</PedidoEnvioLoteRPS>");
}

// ---- envelope SOAP do método EnvioRPS ----
export function envelopeEnvioRps(xmlPedidoAssinado: string, metodo = "EnvioRPS"): string {
  // o XML do pedido vai como conteúdo do parâmetro VersaoSchema + MensagemXML
  const payload = xmlPedidoAssinado.replace(/<\?xml[^>]*\?>/, "");
  // SOAP 1.2 (namespace www.w3.org/2003/05/soap-envelope). O web service de SP
  // espera SOAP 1.2 — com SOAP 1.1 ele responde "did not recognize the value
  // of HTTP Header SOAPAction", porque no 1.2 a ação vai no Content-Type, não
  // num header SOAPAction separado.
  return (
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">` +
    `<soap12:Body>` +
    `<${metodo} xmlns="http://www.prefeitura.sp.gov.br/nfe">` +
    `<VersaoSchema>1</VersaoSchema>` +
    `<MensagemXML>${escForSoap(payload)}</MensagemXML>` +
    `</${metodo}>` +
    `</soap12:Body>` +
    `</soap12:Envelope>`
  );
}
// dentro do SOAP, o XML do pedido vai ESCAPADO (como texto)
function escForSoap(xml: string): string {
  return xml.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ---- transmissão SOAP com cert cliente (mesma A1) ----
function postSoap(opts: { body: string; soapAction: string; key: string; cert: string }): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: HOST,
        path: PATH,
        method: "POST",
        key: opts.key,
        cert: opts.cert,
        headers: {
          // SOAP 1.2: a ação vai no parâmetro action do Content-Type
          // (application/soap+xml), e NÃO num header SOAPAction separado.
          "Content-Type": `application/soap+xml; charset=utf-8; action="${opts.soapAction}"`,
          "Content-Length": Buffer.byteLength(opts.body),
        },
        timeout: 30000,
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: data }));
      },
    );
    req.on("timeout", () => req.destroy(new Error("Tempo esgotado falando com a Prefeitura de SP.")));
    req.on("error", reject);
    req.write(opts.body);
    req.end();
  });
}

// ---- parsing do retorno (RetornoEnvioRPS dentro do SOAP) ----
export type ResultadoSp = {
  ok: boolean;
  nfseNumero: string | null;
  codigoVerificacao: string | null;
  nfseXml: string | null;
  erro: string | null;
  status: number;
};

function extrairTag(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? m[1] : null;
}
function desescapar(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

// Extrai a mensagem real de um SOAP Fault ou de uma lista de <Erro> no corpo,
// mesmo quando o HTTP veio com status de erro. SP devolve HTTP 500 com o detalhe
// no body — é onde mora o motivo verdadeiro da recusa.
// casa o conteúdo de uma tag IGNORANDO prefixo de namespace (soap:, a:, etc.)
function tagNs(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<(?:[\\w]+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:[\\w]+:)?${tag}>`, "i"));
  return m ? m[1].trim() : null;
}

function extrairErroSoap(body: string): string | null {
  if (!body) return null;
  const txt = desescapar(body);
  // 1) lista de <Erro><Codigo/><Descricao/></Erro> (pode haver vários, com ou sem ns)
  const erros: string[] = [];
  const re = /<(?:[\w]+:)?Erro\b[^>]*>([\s\S]*?)<\/(?:[\w]+:)?Erro>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(txt)) !== null) {
    const bloco = m[1];
    const cod = tagNs(bloco, "Codigo");
    const desc = tagNs(bloco, "Descricao");
    const linha = [cod, desc].filter(Boolean).join(" - ");
    if (linha) erros.push(linha);
  }
  if (erros.length > 0) return erros.join("; ");
  // 2) SOAP Fault (com ou sem prefixo de namespace; SOAP 1.1 e 1.2)
  const fault = tagNs(txt, "faultstring") || tagNs(txt, "Text") || tagNs(txt, "Reason") || tagNs(txt, "faultcode");
  if (fault) return fault.replace(/<[^>]+>/g, "").trim();
  // 3) campos avulsos que SP/.NET costumam usar
  const avulso = tagNs(txt, "Descricao") || tagNs(txt, "Mensagem") || tagNs(txt, "Message") || tagNs(txt, "Alerta");
  if (avulso) return avulso;
  return null;
}

export function parseRetornoSp(soapBody: string, metodo = "EnvioRPS"): ResultadoSp {
  // o RetornoEnvioLoteRPS vem escapado dentro de {metodo}Result. O nome do
  // elemento de resposta varia (EnvioLoteRPSResult, EnvioLoteRPSRequestResult,
  // RetornoEnvioLoteRPS), então tentamos candidatos e caímos no corpo inteiro.
  let inner =
    tagNs(soapBody, `${metodo}Result`) ??
    tagNs(soapBody, `${metodo}RequestResult`) ??
    tagNs(soapBody, "EnvioLoteRPSResult") ??
    tagNs(soapBody, "EnvioRPSResult") ??
    soapBody;
  inner = desescapar(inner);

  const sucesso = (tagNs(inner, "Sucesso") ?? "").toLowerCase() === "true";
  if (sucesso) {
    const numero = tagNs(inner, "NumeroNFe") ?? tagNs(inner, "NumeroNFse");
    const cod = tagNs(inner, "CodigoVerificacao");
    return { ok: true, nfseNumero: numero, codigoVerificacao: cod, nfseXml: inner, erro: null, status: 200 };
  }
  // erro: usa o extrator reforçado (lista de Erro, Fault, campos avulsos, com/sem ns)
  let erro = extrairErroSoap(inner) || extrairErroSoap(soapBody);
  if (!erro) {
    // formato desconhecido: anexa um trecho limpo do corpo para diagnóstico
    const trecho = inner.replace(/\s+/g, " ").trim().slice(0, 300);
    erro = trecho ? `Resposta não reconhecida da Prefeitura de SP: ${trecho}` : "RPS rejeitado pela Prefeitura de SP (sem corpo).";
  }
  return { ok: false, nfseNumero: null, codigoVerificacao: null, nfseXml: inner, erro, status: 200 };
}

// ---- CANCELAMENTO DE NFS-e (SP, método CancelamentoNFe) ----
// A assinatura do cancelamento é RSA-SHA1 sobre a concatenação:
//   Inscrição do Prestador (8 posições, zeros à esquerda) +
//   Número da NFS-e        (12 posições, zeros à esquerda).
export function assinarCancelamento(inscricaoMunicipal: string, numeroNfe: string, chavePem: string): string {
  const cadeia = padL(dig(inscricaoMunicipal), 8) + padL(dig(numeroNfe), 12);
  const signer = crypto.createSign("RSA-SHA1");
  signer.update(cadeia, "latin1");
  signer.end();
  return signer.sign(chavePem, "base64");
}

export function montarPedidoCancelamento(opts: {
  cnpjRemetente: string;
  inscricaoMunicipal: string;
  numeroNfe: string;
  cert: CertA1;
}): string {
  const { cnpjRemetente, inscricaoMunicipal, numeroNfe, cert } = opts;
  const assinatura = assinarCancelamento(inscricaoMunicipal, numeroNfe, cert.chavePem);
  const cabecalho =
    `<Cabecalho xmlns="" Versao="1">` +
    `<CPFCNPJRemetente><CNPJ>${dig(cnpjRemetente)}</CNPJ></CPFCNPJRemetente>` +
    `<transacao>true</transacao>` +
    `</Cabecalho>`;
  const detalhe =
    `<Detalhe xmlns="">` +
    `<ChaveNFe>` +
    `<InscricaoPrestador>${dig(inscricaoMunicipal)}</InscricaoPrestador>` +
    `<NumeroNFe>${dig(numeroNfe)}</NumeroNFe>` +
    `</ChaveNFe>` +
    `<AssinaturaCancelamento>${assinatura}</AssinaturaCancelamento>` +
    `</Detalhe>`;
  const docSemAssinatura =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<PedidoCancelamentoNFe xmlns="http://www.prefeitura.sp.gov.br/nfe" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">` +
    `${cabecalho}${detalhe}</PedidoCancelamentoNFe>`;
  return assinarPedidoSp(docSemAssinatura, cert, "</PedidoCancelamentoNFe>");
}

export async function cancelarNfeSp(opts: {
  cnpjRemetente: string;
  inscricaoMunicipal: string;
  numeroNfe: string;
  cert: CertA1;
}): Promise<{ ok: boolean; erro: string | null; status: number; xmlEnviado: string }> {
  let pedido = "";
  try {
    pedido = montarPedidoCancelamento(opts);
    const metodo = "CancelamentoNFe";
    const envelope = envelopeEnvioRps(pedido, `${metodo}Request`);
    const actionsCandidatas = [
      "http://www.prefeitura.sp.gov.br/nfe/ws/cancelamentonfe",
      "http://www.prefeitura.sp.gov.br/nfe/ws/cancelamento",
      `http://www.prefeitura.sp.gov.br/nfe/${metodo}`,
      "http://www.prefeitura.sp.gov.br/nfe/ws/CancelamentoNFe",
    ];
    let resp: { status: number; body: string } | null = null;
    for (const soapAction of actionsCandidatas) {
      const tentativa = await postSoap({ body: envelope, soapAction, key: opts.cert.chavePem, cert: opts.cert.certPem });
      const corpo = tentativa.body || "";
      if (/was not recognized|did not recognize|n[ãa]o (foi )?reconhecid/i.test(corpo)) {
        resp = tentativa;
        continue;
      }
      resp = tentativa;
      break;
    }
    if (!resp) return { ok: false, erro: "Sem resposta da Prefeitura de SP.", status: 0, xmlEnviado: pedido };
    const r = parseRetornoSp(resp.body, "CancelamentoNFe");
    return { ok: r.ok, erro: r.erro, status: resp.status, xmlEnviado: pedido };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "erro ao cancelar", status: 0, xmlEnviado: pedido };
  }
}

// ---- orquestração: monta, assina, transmite, parseia ----
export async function emitirRpsSp(opts: {
  cnpjRemetente: string;
  rps: RpsSp;
  cert: CertA1;
  teste?: boolean; // em SP, homologação = método de TESTE (valida sem gerar nota real)
}): Promise<ResultadoSp & { xmlEnviado: string }> {
  let pedido = "";
  try {
    const assinatura = assinarRps(opts.rps, opts.cert.chavePem);
    pedido = montarPedidoEnvioLoteRps({ cnpjRemetente: opts.cnpjRemetente, rps: opts.rps, assinaturaRps: assinatura, cert: opts.cert });

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │ HOMOLOGAÇÃO = NÃO TRANSMITE.                                         │
    // │ Em São Paulo, QUALQUER envio ao web service registra a nota de       │
    // │ verdade — não existe URL/endpoint de "sandbox" separado. Para        │
    // │ garantir, por construção, que homologação JAMAIS gere documento      │
    // │ fiscal real, validamos localmente (a montagem e a assinatura do RPS  │
    // │ acima já rodaram sem lançar erro) e retornamos sucesso SEM enviar    │
    // │ nada à Prefeitura. A emissão real só ocorre com o ambiente em        │
    // │ produção.                                                            │
    // └─────────────────────────────────────────────────────────────────────┘
    if (opts.teste === true) {
      return {
        ok: true,
        nfseNumero: null,
        codigoVerificacao: null,
        nfseXml: null,
        erro: null,
        status: 200,
        xmlEnviado: pedido,
      };
    }

    const metodo = "EnvioLoteRPS";
    // CRÍTICO: o elemento wrapper do corpo SOAP leva o sufixo "Request".
    // O ASMX (document/literal) roteia a operação pelo NOME DO WRAPPER — com o
    // nome sem "Request" ele não acha a operação e relata a action como "não
    // reconhecida". O envio real usa <EnvioLoteRPSRequest>.
    const envelope = envelopeEnvioRps(pedido, `${metodo}Request`);

    // A action acompanha o método de produção. Mantemos variantes como rede de
    // segurança; paramos na primeira reconhecida.
    const actionsCandidatas = [
      "http://www.prefeitura.sp.gov.br/nfe/ws/envio",
      "http://www.prefeitura.sp.gov.br/nfe/ws/enviolote",
      `http://www.prefeitura.sp.gov.br/nfe/${metodo}`,
      "http://www.prefeitura.sp.gov.br/nfe/ws/EnvioLoteRPS",
    ];

    let resp: { status: number; body: string } | null = null;
    let actionUsada = "";
    for (const soapAction of actionsCandidatas) {
      const tentativa = await postSoap({
        body: envelope,
        soapAction,
        key: opts.cert.chavePem,
        cert: opts.cert.certPem,
      });
      const corpo = tentativa.body || "";
      const actionNaoReconhecida = /was not recognized|did not recognize|n[ãa]o (foi )?reconhecid/i.test(corpo);
      if (actionNaoReconhecida) {
        console.error(`[nfse-sp] action recusada: ${soapAction}`);
        resp = tentativa; // guarda a última, caso todas falhem
        continue;
      }
      // o servidor reconheceu a action — esta é a resposta de verdade
      resp = tentativa;
      actionUsada = soapAction;
      console.error(`[nfse-sp] action aceita: ${soapAction} (status ${tentativa.status})`);
      break;
    }
    if (!resp) {
      return { ok: false, nfseNumero: null, codigoVerificacao: null, nfseXml: null, erro: "Sem resposta da Prefeitura de SP.", status: 0, xmlEnviado: pedido };
    }
    if (!actionUsada) {
      // nenhuma action foi reconhecida — reporta com o corpo para diagnóstico
      console.error("[nfse-sp] nenhuma action reconhecida. Corpo:", (resp.body || "").slice(0, 1500));
      const det = extrairErroSoap(resp.body);
      return {
        ok: false,
        nfseNumero: null,
        codigoVerificacao: null,
        nfseXml: resp.body || null,
        erro: det ? `${det} (HTTP ${resp.status})` : `Prefeitura de SP não reconheceu nenhuma das ações testadas (HTTP ${resp.status}).`,
        status: resp.status,
        xmlEnviado: pedido,
      };
    }
    if (resp.status < 200 || resp.status >= 300) {
      // a action foi aceita, mas houve erro: o detalhe está no corpo (SOAP Fault / Erro)
      console.error("[nfse-sp] resposta de erro (status", resp.status + "):", (resp.body || "").slice(0, 1500));
      const detalhe = extrairErroSoap(resp.body) || parseRetornoSp(resp.body, metodo).erro;
      return {
        ok: false,
        nfseNumero: null,
        codigoVerificacao: null,
        nfseXml: resp.body || null,
        erro: detalhe ? `${detalhe} (HTTP ${resp.status})` : `HTTP ${resp.status} — sem detalhe no corpo`,
        status: resp.status,
        xmlEnviado: pedido,
      };
    }
    const r = parseRetornoSp(resp.body, metodo);
    if (!r.ok) console.error("[nfse-sp] RPS rejeitado. Corpo:", (resp.body || "").slice(0, 1500));
    return { ...r, xmlEnviado: pedido };
  } catch (e) {
    return {
      ok: false,
      nfseNumero: null,
      codigoVerificacao: null,
      nfseXml: null,
      erro: `Falha no envio à Prefeitura de SP: ${e instanceof Error ? e.message : "erro desconhecido"}`,
      status: 0,
      xmlEnviado: pedido,
    };
  }
}

// mapeia DadosDps (modelo do nacional) para o RPS de SP
export function dadosParaRpsSp(d: DadosDps, codigoServicoSp: string): RpsSp {
  return {
    inscricaoMunicipal: d.emitente.inscricaoMunicipal || "",
    serie: d.serie || "",
    numero: d.numero,
    dataEmissao: (d.dhEmi || "").slice(0, 10),
    issRetido: d.servico.issRetido,
    valorServicos: d.servico.valor,
    valorDeducoes: 0,
    codigoServico: codigoServicoSp,
    aliquota: Number(d.servico.aliquotaIss) / 100,
    discriminacao: d.servico.discriminacao,
    tomador: {
      documento: d.tomador.documento,
      razaoSocial: d.tomador.nome,
      logradouro: d.tomador.logradouro,
      numero: d.tomador.numero,
      complemento: d.tomador.complemento,
      bairro: d.tomador.bairro,
      cidadeIbge: d.tomador.codigoMunicipioIbge,
      uf: d.tomador.uf,
      cep: d.tomador.cep,
    },
  };
}

import type { CertA1 } from "@/lib/nfse/assinatura";
import type { DadosDps } from "@/lib/nfse/dps";
import { montarDpsXml } from "@/lib/nfse/dps";
import { assinarDps } from "@/lib/nfse/assinatura";
import { emitirDps, urlDanfse, type AmbienteNfse } from "@/lib/nfse/nacional";
import { emitirRpsSp, dadosParaRpsSp } from "@/lib/nfse/saopaulo";

// Código IBGE do município de São Paulo (capital). SP não aderiu ao nacional.
export const IBGE_SAO_PAULO = "3550308";

// Lista de municípios com sistema próprio (não-nacional). Por ora só SP capital;
// outros municípios podem ser adicionados aqui conforme novos adapters.
export function municipioTemSistemaProprio(codigoIbge: string): boolean {
  return (codigoIbge ?? "").replace(/\D/g, "") === IBGE_SAO_PAULO;
}

export type ResultadoEmissao = {
  ok: boolean;
  status: number;
  nfseNumero: string | null;
  chaveAcesso: string | null;
  nfseXml: string | null;
  xmlEnviado: string;
  erro: string | null;
  pdfUrl: string | null;
  provedor: "nacional" | "saopaulo";
};

/**
 * Roteia a emissão para o adapter correto conforme o município do EMITENTE.
 * - São Paulo capital (3550308): adapter SOAP da Prefeitura (RPS)
 * - Demais municípios: Sefin Nacional (DPS, mTLS)
 *
 * `codigoServicoSp` é o código de serviço municipal de SP (vem de
 * servicos.codigo_tributacao_municipal); só é usado no caminho de SP.
 */
export async function emitirNfseDispatch(opts: {
  dados: DadosDps;
  cert: CertA1;
  ambiente: AmbienteNfse;
  codigoServicoSp?: string | null;
}): Promise<ResultadoEmissao> {
  try {
    const ibgeEmitente = (opts.dados.emitente.codigoMunicipioIbge ?? "").replace(/\D/g, "");

    // ---- caminho São Paulo capital ----
    if (municipioTemSistemaProprio(ibgeEmitente)) {
      const codServ = (opts.codigoServicoSp ?? "").replace(/\D/g, "");
      if (!codServ) {
        return {
          ok: false,
          status: 400,
          nfseNumero: null,
          chaveAcesso: null,
          nfseXml: null,
          xmlEnviado: "",
          erro: "Para São Paulo, informe o código de serviço municipal no cadastro do serviço (campo Código de tributação municipal).",
          pdfUrl: null,
          provedor: "saopaulo",
        };
      }
      if (!opts.dados.emitente.inscricaoMunicipal) {
        return {
          ok: false,
          status: 400,
          nfseNumero: null,
          chaveAcesso: null,
          nfseXml: null,
          xmlEnviado: "",
          erro: "Para São Paulo, a Inscrição Municipal (CCM) é obrigatória em Configurações → NFS-e.",
          pdfUrl: null,
          provedor: "saopaulo",
        };
      }
      const rps = dadosParaRpsSp(opts.dados, codServ);
      const r = await emitirRpsSp({
        cnpjRemetente: opts.dados.emitente.cnpj,
        rps,
        cert: opts.cert,
        teste: opts.ambiente === "homologacao",
      });
      return {
        ok: r.ok,
        status: r.status,
        nfseNumero: r.nfseNumero,
        chaveAcesso: r.codigoVerificacao,
        nfseXml: r.nfseXml,
        xmlEnviado: r.xmlEnviado,
        erro: r.erro,
        pdfUrl: null,
        provedor: "saopaulo",
      };
    }

    // ---- caminho nacional (Sefin) ----
    const { xml, infDps, id } = montarDpsXml(opts.dados);
    const xmlAssinado = assinarDps(xml, infDps, id, opts.cert);
    const resp = await emitirDps(opts.ambiente, xmlAssinado, opts.cert);
    return {
      ok: resp.ok,
      status: resp.status,
      nfseNumero: resp.nfseNumero ?? null,
      chaveAcesso: resp.chaveAcesso || id,
      nfseXml: resp.nfseXml ?? null,
      xmlEnviado: xmlAssinado,
      erro: resp.ok ? null : resp.erro ?? `HTTP ${resp.status}`,
      pdfUrl: resp.ok && resp.chaveAcesso ? urlDanfse(opts.ambiente, resp.chaveAcesso) : null,
      provedor: "nacional",
    };
  } catch (e) {
    // qualquer exceção (montagem/assinatura/transmissão) vira erro estruturado,
    // nunca um 500 cego — a mensagem ajuda a depurar.
    const ibge = (opts.dados.emitente.codigoMunicipioIbge ?? "").replace(/\D/g, "");
    return {
      ok: false,
      status: 500,
      nfseNumero: null,
      chaveAcesso: null,
      nfseXml: null,
      xmlEnviado: "",
      erro: `Falha ao gerar/transmitir a nota: ${e instanceof Error ? e.message : "erro desconhecido"}`,
      pdfUrl: null,
      provedor: municipioTemSistemaProprio(ibge) ? "saopaulo" : "nacional",
    };
  }
}

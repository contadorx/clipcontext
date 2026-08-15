// Evento de cancelamento da NFS-e Nacional (e101101).
// Mesmo princípio da DPS: XML canônico byte a byte, assinado no infPedReg.

import { type CertA1, assinarElemento } from "@/lib/nfse/assinatura";

export const MOTIVOS_CANCELAMENTO: Record<string, string> = {
  "1": "Erro na emissão",
  "2": "Serviço não prestado",
  "9": "Outros",
};

function esc(s: string): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function montarEventoCancelamento(d: {
  ambiente: "homologacao" | "producao";
  chaveAcesso: string; // 50 dígitos
  cnpjAutor: string; // emitente, só dígitos
  dhEvento: string; // ISO com offset
  codigoMotivo: string; // 1 | 2 | 9
  motivo: string; // texto livre (15-255)
  numeroPedido?: number; // sequencial do pedido (1 na primeira tentativa)
}): { xml: string; infCanonico: string; id: string } {
  const chave = d.chaveAcesso.replace(/\D/g, "");
  const nPed = d.numeroPedido ?? 1;
  // Id do pedido: "PRE" + chave(50) + código do evento(6) + sequencial(3)
  const id = `PRE${chave}101101${String(nPed).padStart(3, "0")}`;
  const tpAmb = d.ambiente === "producao" ? "1" : "2";
  const xMotivo = esc((d.motivo || "Cancelamento solicitado pelo emitente").slice(0, 255).padEnd(15, "."));

  const infPedReg =
    `<infPedReg Id="${id}">` +
    `<tpAmb>${tpAmb}</tpAmb>` +
    `<verAplic>FinanceiroSimples1.0</verAplic>` +
    `<dhEvento>${d.dhEvento}</dhEvento>` +
    `<CNPJAutor>${d.cnpjAutor.replace(/\D/g, "").padStart(14, "0")}</CNPJAutor>` +
    `<chNFSe>${chave}</chNFSe>` +
    `<nPedRegEvento>${nPed}</nPedRegEvento>` +
    `<e101101>` +
    `<xDesc>Cancelamento de NFS-e</xDesc>` +
    `<cMotivo>${d.codigoMotivo}</cMotivo>` +
    `<xMotivo>${xMotivo}</xMotivo>` +
    `</e101101>` +
    `</infPedReg>`;

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<pedRegEvento xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00">` +
    infPedReg +
    `</pedRegEvento>`;

  const infCanonico = infPedReg.replace("<infPedReg Id=", `<infPedReg xmlns="http://www.sped.fazenda.gov.br/nfse" Id=`);
  return { xml, infCanonico, id };
}

export function assinarEvento(xml: string, infCanonico: string, id: string, cert: CertA1): string {
  return assinarElemento(xml, infCanonico, id, cert, "</pedRegEvento>");
}

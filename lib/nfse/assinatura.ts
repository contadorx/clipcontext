// Assinatura digital da DPS (XMLDSig enveloped) com o certificado A1.
// Como o XML é gerado canônico (lib/nfse/dps.ts), o digest é calculado sobre
// os bytes exatos do elemento <infDPS> com o namespace herdado aplicado.

import crypto from "crypto";
import forge from "node-forge";
import { SignedXml } from "xml-crypto";

export type CertA1 = {
  chavePem: string;
  certPem: string;
  caPem: string[]; // intermediários da cadeia (ICP-Brasil), para o mTLS
  certDerBase64: string; // certificado do titular em DER/base64 para o <X509Certificate>
};

// Abre o PFX (A1) e extrai chave privada + certificado(s) em PEM.
// Importante: muitos A1 ICP-Brasil usam algoritmos legados (RC2/3DES, MAC SHA1)
// que o OpenSSL 3 do Node recusa no handshake TLS ("Unsupported PKCS12 PFX data").
// O node-forge abre esses PFX sem problema; por isso convertemos para PEM aqui e
// usamos PEM (não o PFX bruto) tanto na assinatura quanto na transmissão mTLS.
export function abrirPfx(pfx: Buffer, senha: string): CertA1 {
  const asn1 = forge.asn1.fromDer(forge.util.createBuffer(pfx.toString("binary")));
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, senha);

  const keyBags =
    p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ??
    p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag];
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [];
  const key = keyBags?.[0]?.key;
  if (!key || certBags.length === 0) throw new Error("Certificado A1 sem chave ou certificado legíveis.");

  // o certificado do titular é o que casa com a chave privada (tem o localKeyId);
  // na ausência de pista, assume o primeiro. Os demais são a cadeia (intermediários).
  const titularBag = certBags.find((b) => b.cert && b.cert.publicKey) ?? certBags[0];
  const cert = titularBag.cert!;
  const cadeia = certBags.filter((b) => b !== titularBag && b.cert).map((b) => b.cert!);

  const chavePem = forge.pki.privateKeyToPem(key);
  const certPem = forge.pki.certificateToPem(cert);
  const caPem = cadeia.map((c) => forge.pki.certificateToPem(c));
  const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const certDerBase64 = forge.util.encode64(certDer);
  return { chavePem, certPem, caPem, certDerBase64 };
}

// O digest do XMLDSig é calculado sobre o elemento assinado em forma canônica.
// Com transform "enveloped-signature" + C14N, o infDPS canônico recebe o
// namespace do pai (xmlns da DPS) declarado no próprio elemento.
export function infDpsCanonico(infDps: string): string {
  return infDps.replace("<infDPS Id=", `<infDPS xmlns="http://www.sped.fazenda.gov.br/nfse" Id=`);
}

// Assina um elemento identificado por Id dentro de um envelope XML.
// `elementoCanonico` é o elemento com o xmlns do pai já declarado;
// a <Signature> entra antes de `tagFechamento` (ex.: "</DPS>").
export function assinarElemento(
  xml: string,
  elementoCanonico: string,
  idRef: string,
  cert: CertA1,
  tagFechamento: string,
): string {
  const digest = crypto.createHash("sha1").update(elementoCanonico, "utf8").digest("base64");

  // SignedInfo canônico (C14N: namespace declarado, sem espaços supérfluos)
  const signedInfo =
    `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">` +
    `<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></CanonicalizationMethod>` +
    `<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"></SignatureMethod>` +
    `<Reference URI="#${idRef}">` +
    `<Transforms>` +
    `<Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></Transform>` +
    `<Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></Transform>` +
    `</Transforms>` +
    `<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></DigestMethod>` +
    `<DigestValue>${digest}</DigestValue>` +
    `</Reference>` +
    `</SignedInfo>`;

  const signer = crypto.createSign("RSA-SHA1");
  signer.update(signedInfo, "utf8");
  const assinatura = signer.sign(cert.chavePem, "base64");

  const signature =
    `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">` +
    signedInfo.replace(` xmlns="http://www.w3.org/2000/09/xmldsig#"`, "") +
    `<SignatureValue>${assinatura}</SignatureValue>` +
    `<KeyInfo><X509Data><X509Certificate>${cert.certDerBase64}</X509Certificate></X509Data></KeyInfo>` +
    `</Signature>`;

  return xml.replace(tagFechamento, `${signature}${tagFechamento}`);
}

export function assinarDps(xmlDps: string, infDps: string, idRef: string, cert: CertA1): string {
  return assinarElemento(xmlDps, infDpsCanonico(infDps), idRef, cert, "</DPS>");
}

// Verificação local (sanidade): o SignatureValue confere com a chave pública?
export function verificarAssinaturaLocal(xmlAssinado: string, certPem: string): boolean {
  const m = xmlAssinado.match(/<SignedInfo.*?<\/SignedInfo>/s);
  const v = xmlAssinado.match(/<SignatureValue>(.*?)<\/SignatureValue>/s);
  if (!m || !v) return false;
  let signedInfo = m[0];
  if (!signedInfo.includes("xmlns=")) {
    signedInfo = signedInfo.replace("<SignedInfo", `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#"`);
  }
  const verifier = crypto.createVerify("RSA-SHA1");
  verifier.update(signedInfo, "utf8");
  const pub = crypto.createPublicKey(certPem);
  return verifier.verify(pub, v[1], "base64");
}

// ---- Assinatura XMLDSig para a Prefeitura de São Paulo ----
// SP exige (manual 3.3.6, item 3.2.3): XMLDSig Enveloped, RSA-SHA1, SHA-1,
// transforms Enveloped + C14N, cadeia EndCertOnly (só o cert do titular no
// X509Certificate, SEM KeyValue/RSAKeyValue/X509SubjectName etc.).
// O PedidoEnvioLoteRPS NÃO tem atributo Id: a Reference usa URI="" (assina o
// documento inteiro). O digest é calculado sobre o documento canônico SEM a
// Signature (o transform enveloped remove a própria Signature do cálculo);
// como a Signature é inserida só depois, o digest é sobre `docCanonico`.
export function assinarPedidoSp(xmlDocumento: string, cert: CertA1, _tagFechamento: string): string {
  // Usa xml-crypto para C14N REAL. A assinatura à mão falhava com erro 1057
  // ("Assinatura difere do calculado") porque a canonicalização manual do
  // SignedInfo/documento divergia da C14N que SP recalcula (ordem de atributos,
  // namespaces herdados, forma das tags vazias). O xml-crypto canonicaliza de
  // verdade, então o digest e a assinatura conferem do lado da Prefeitura.
  // Exigências de SP atendidas: Enveloped + C14N, RSA-SHA1, Reference URI=""
  // (isEmptyUri, sem Id), KeyInfo só com X509Certificate (EndCertOnly, sem
  // KeyValue/RSAKeyValue/X509SubjectName).
  const sig = new SignedXml({
    privateKey: cert.chavePem,
    signatureAlgorithm: "http://www.w3.org/2000/09/xmldsig#rsa-sha1",
    canonicalizationAlgorithm: "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
  });
  sig.addReference({
    xpath: "/*",
    transforms: [
      "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
      "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
    ],
    digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1",
    uri: "",
    isEmptyUri: true,
  });
  sig.getKeyInfoContent = () => `<X509Data><X509Certificate>${cert.certDerBase64}</X509Certificate></X509Data>`;
  sig.computeSignature(xmlDocumento, {
    location: { reference: "/*", action: "append" },
  });
  return sig.getSignedXml();
}

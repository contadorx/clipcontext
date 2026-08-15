// Client da API da NFS-e Nacional (Sefin Nacional).
// Autenticação: TLS mútuo (mTLS) com o certificado A1 do emitente.
// Envio: POST /nfse com a DPS assinada, compactada (gzip) e em base64.

import https from "https";
import zlib from "zlib";
import type { CertA1 } from "@/lib/nfse/assinatura";

const HOSTS = {
  producao: "sefin.nfse.gov.br",
  homologacao: "sefin.producaorestrita.nfse.gov.br",
} as const;

export type AmbienteNfse = keyof typeof HOSTS;

export type RespostaEmissao = {
  ok: boolean;
  status: number;
  chaveAcesso?: string;
  nfseNumero?: string;
  nfseXml?: string;
  erro?: string;
  bruto?: unknown;
};

function requestMtls(opts: {
  host: string;
  path: string;
  method: "GET" | "POST";
  key: string;
  cert: string;
  ca?: string[];
  body?: string;
}): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    // O certificado do cliente + seus intermediários vão CONCATENADOS em `cert`
    // (é assim que o mTLS envia a cadeia ao servidor). Os intermediários NÃO
    // entram em `ca`: `ca` no Node serve para validar o SERVIDOR e, se preenchido,
    // SUBSTITUI as raízes padrão — o que quebraria a validação da Sefin com
    // "unable to get local issuer certificate".
    const certComCadeia =
      opts.ca && opts.ca.length > 0 ? [opts.cert, ...opts.ca].join("\n") : opts.cert;

    const req = https.request(
      {
        host: opts.host,
        path: opts.path,
        method: opts.method,
        // PEM extraído do A1 pelo node-forge: evita o erro "Unsupported PKCS12
        // PFX data" que o OpenSSL 3 lança ao receber PFX com cifra/MAC legados.
        key: opts.key,
        cert: certComCadeia,
        // sem `ca`: usa as raízes padrão do Node para validar o servidor da Sefin.
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(opts.body ? { "Content-Length": Buffer.byteLength(opts.body) } : {}),
        },
        timeout: 30000,
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: data }));
      },
    );
    req.on("timeout", () => {
      req.destroy(new Error("Tempo esgotado falando com a Sefin Nacional."));
    });
    req.on("error", reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

function gunzipB64(b64: string): string {
  try {
    return zlib.gunzipSync(Buffer.from(b64, "base64")).toString("utf8");
  } catch {
    return "";
  }
}

export async function emitirDps(
  ambiente: AmbienteNfse,
  xmlAssinado: string,
  cert: CertA1,
): Promise<RespostaEmissao> {
  const gz = zlib.gzipSync(Buffer.from(xmlAssinado, "utf8")).toString("base64");
  const body = JSON.stringify({ dpsXmlGZipB64: gz });
  try {
    const r = await requestMtls({
      host: HOSTS[ambiente],
      path: "/sefinnacional/nfse",
      method: "POST",
      key: cert.chavePem,
      cert: cert.certPem,
      ca: cert.caPem,
      body,
    });
    let json: Record<string, unknown> = {};
    try {
      json = JSON.parse(r.body);
    } catch {
      /* resposta não-JSON cai no erro abaixo */
    }
    if (r.status === 200 || r.status === 201) {
      const chave = (json["chaveAcesso"] ?? json["idDps"] ?? "") as string;
      const nfseGz = json["nfseXmlGZipB64"] as string | undefined;
      const nfseXml = nfseGz ? gunzipB64(nfseGz) : undefined;
      const numero = nfseXml?.match(/<nNFSe>(\d+)<\/nNFSe>/)?.[1];
      return { ok: true, status: r.status, chaveAcesso: chave, nfseNumero: numero, nfseXml, bruto: json };
    }
    // erros estruturados da Sefin vêm em "erros"/"mensagens"
    const erros = (json["erros"] ?? json["mensagens"] ?? json["erro"] ?? r.body) as unknown;
    const texto = Array.isArray(erros)
      ? erros
          .map((e) => {
            const o = e as Record<string, unknown>;
            return `${o["codigo"] ?? ""} ${o["descricao"] ?? o["mensagem"] ?? JSON.stringify(o)}`.trim();
          })
          .join("; ")
      : typeof erros === "string"
        ? erros.slice(0, 500)
        : JSON.stringify(erros).slice(0, 500);
    return { ok: false, status: r.status, erro: texto || `HTTP ${r.status}`, bruto: json };
  } catch (e) {
    return { ok: false, status: 0, erro: e instanceof Error ? e.message : "Falha de conexão com a Sefin." };
  }
}

// Link público do DANFSe (PDF) pela chave de acesso.
export function urlDanfse(ambiente: AmbienteNfse, chaveAcesso: string): string {
  return `https://${HOSTS[ambiente]}/sefinnacional/danfse/${chaveAcesso}`;
}

// Registra um evento na NFS-e (ex.: cancelamento) — POST /nfse/{chave}/eventos.
export async function registrarEvento(
  ambiente: AmbienteNfse,
  chaveAcesso: string,
  xmlEventoAssinado: string,
  cert: CertA1,
): Promise<RespostaEmissao> {
  const gz = zlib.gzipSync(Buffer.from(xmlEventoAssinado, "utf8")).toString("base64");
  const body = JSON.stringify({ pedidoRegistroEventoXmlGZipB64: gz });
  try {
    const r = await requestMtls({
      host: HOSTS[ambiente],
      path: `/sefinnacional/nfse/${chaveAcesso.replace(/\D/g, "")}/eventos`,
      method: "POST",
      key: cert.chavePem,
      cert: cert.certPem,
      ca: cert.caPem,
      body,
    });
    let json: Record<string, unknown> = {};
    try {
      json = JSON.parse(r.body);
    } catch {
      /* resposta não-JSON cai no erro abaixo */
    }
    if (r.status === 200 || r.status === 201) {
      return { ok: true, status: r.status, bruto: json };
    }
    const erros = (json["erros"] ?? json["mensagens"] ?? json["erro"] ?? r.body) as unknown;
    const texto = Array.isArray(erros)
      ? erros
          .map((e) => {
            const o = e as Record<string, unknown>;
            return `${o["codigo"] ?? ""} ${o["descricao"] ?? o["mensagem"] ?? JSON.stringify(o)}`.trim();
          })
          .join("; ")
      : typeof erros === "string"
        ? erros.slice(0, 500)
        : JSON.stringify(erros).slice(0, 500);
    return { ok: false, status: r.status, erro: texto || `HTTP ${r.status}`, bruto: json };
  } catch (e) {
    return { ok: false, status: 0, erro: e instanceof Error ? e.message : "Falha de conexão com a Sefin." };
  }
}

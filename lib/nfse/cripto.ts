// Cifra/decifra segredos curtos (senha do certificado A1) com AES-256-GCM.
// Chave: env NFSE_CRYPTO_KEY — 64 caracteres hex (32 bytes). Gere com:
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
// Formato armazenado: base64( iv(12) | authTag(16) | ciphertext ).

import crypto from "crypto";

function chave(): Buffer {
  const hex = process.env.NFSE_CRYPTO_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("NFSE_CRYPTO_KEY ausente ou inválida (esperado 64 caracteres hex).");
  }
  return Buffer.from(hex, "hex");
}

export function cifrarSegredo(texto: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", chave(), iv);
  const ct = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decifrarSegredo(blob: string): string {
  const buf = Buffer.from(blob, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", chave(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

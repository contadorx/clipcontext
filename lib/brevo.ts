// Envio de e-mail transacional via Brevo (server-only).
// Requer as env vars no Vercel:
//   BREVO_API_KEY        — chave de API (Brevo → SMTP & API)
//   BREVO_SENDER_EMAIL   — remetente verificado (ex.: contato@financeirox.com.br)
//   BREVO_SENDER_NAME    — opcional (default "FinanceiroX")

type EnviarParams = {
  para: string;
  paraNome?: string;
  assunto: string;
  html: string;
  remetenteNome?: string;
};

export async function enviarEmail({ para, paraNome, assunto, html, remetenteNome }: EnviarParams): Promise<void> {
  const key = process.env.BREVO_API_KEY;
  const remetente = process.env.BREVO_SENDER_EMAIL;
  const nomeRemetente = remetenteNome || process.env.BREVO_SENDER_NAME || "FinanceiroX";

  if (!key || !remetente) {
    throw new Error("E-mail não configurado (defina BREVO_API_KEY e BREVO_SENDER_EMAIL no Vercel).");
  }

  const resp = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": key,
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: remetente, name: nomeRemetente },
      to: [{ email: para, name: paraNome || para }],
      subject: assunto,
      htmlContent: html,
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`Brevo respondeu ${resp.status}: ${txt.slice(0, 300)}`);
  }
}

// Layout simples e neutro para os e-mails transacionais.
export function layoutEmail(opts: { titulo: string; corpoHtml: string; botao?: { texto: string; url: string } }): string {
  const { titulo, corpoHtml, botao } = opts;
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#F1F5F9;padding:24px">
    <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #E2E8F0">
      <div style="background:#0F172A;padding:18px 24px">
        <span style="color:#fff;font-size:18px;font-weight:800;letter-spacing:.2px">FinanceiroX</span>
      </div>
      <div style="padding:24px">
        <h1 style="margin:0 0 12px;font-size:20px;color:#0F172A">${titulo}</h1>
        <div style="font-size:14px;line-height:1.6;color:#334155">${corpoHtml}</div>
        ${
          botao
            ? `<div style="margin:22px 0 6px"><a href="${botao.url}" style="display:inline-block;background:#12A594;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:10px">${botao.texto}</a></div>
               <p style="font-size:12px;color:#94A3B8;word-break:break-all">Ou copie este link: ${botao.url}</p>`
            : ""
        }
      </div>
    </div>
  </div>`;
}

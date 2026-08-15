import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarEmail, layoutEmail } from "@/lib/brevo";
import { brl, dataBR } from "@/lib/formato";
import { urlDoApp } from "@/lib/urls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Lembretes de boletos ao SACADO (cliente do BPO): antes do vencimento,
// no dia e após. Configurado por empresa em boleto_lembretes_config.
// Dedup: unique (titulo_id, tipo) em boleto_lembretes.

type Tipo = "antes" | "vencimento" | "apos";

function isoMaisDias(baseISO: string, dias: number): string {
  const d = new Date(baseISO + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function corpoEmail(opts: {
  tipo: Tipo;
  clienteNome: string;
  empresaNome: string;
  valor: number;
  vencimento: string;
  linhaDigitavel: string | null;
  numeroDocumento: string | null;
  urlBoleto: string | null;
}): { assunto: string; html: string } {
  const venc = dataBR(opts.vencimento);
  const valor = brl(opts.valor);
  const doc = opts.numeroDocumento ? ` (doc. ${opts.numeroDocumento})` : "";

  const abertura =
    opts.tipo === "antes"
      ? `Este é um lembrete amigável: o boleto abaixo, emitido por <b>${opts.empresaNome}</b>, vence em <b>${venc}</b>.`
      : opts.tipo === "vencimento"
        ? `O boleto abaixo, emitido por <b>${opts.empresaNome}</b>, <b>vence hoje (${venc})</b>.`
        : `O boleto abaixo, emitido por <b>${opts.empresaNome}</b>, venceu em <b>${venc}</b> e consta como não pago. Se você já pagou, desconsidere este aviso — a baixa bancária pode levar 1 dia útil.`;

  const assunto =
    opts.tipo === "antes"
      ? `Lembrete: boleto de ${valor} vence em ${venc} — ${opts.empresaNome}`
      : opts.tipo === "vencimento"
        ? `Seu boleto de ${valor} vence hoje — ${opts.empresaNome}`
        : `Boleto de ${valor} em aberto — ${opts.empresaNome}`;

  const linha = opts.linhaDigitavel
    ? `<p style="margin:16px 0 6px;font-size:13px;color:#475569">Linha digitável (copie e cole no app do seu banco):</p>
       <p style="margin:0;padding:12px 14px;background:#F1F5F9;border:1px dashed #CBD5E1;border-radius:10px;font-family:monospace;font-size:14px;letter-spacing:.5px;word-break:break-all">${opts.linhaDigitavel}</p>`
    : "";

  const html = layoutEmail({
    titulo: assunto,
    corpoHtml: `
      <p>Olá, ${opts.clienteNome}!</p>
      <p>${abertura}</p>
      <table style="width:100%;border-collapse:collapse;margin:14px 0;font-size:14px">
        <tr><td style="padding:6px 0;color:#64748B">Valor</td><td style="padding:6px 0;text-align:right;font-weight:bold">${valor}</td></tr>
        <tr><td style="padding:6px 0;color:#64748B">Vencimento</td><td style="padding:6px 0;text-align:right;font-weight:bold">${venc}</td></tr>
        <tr><td style="padding:6px 0;color:#64748B">Referente a</td><td style="padding:6px 0;text-align:right">${opts.empresaNome}${doc}</td></tr>
      </table>
      ${linha}
      ${
        opts.urlBoleto
          ? `<p style="margin:18px 0 0;text-align:center"><a href="${opts.urlBoleto}" style="display:inline-block;background:#12A594;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;padding:12px 22px;border-radius:10px">Ver boleto completo</a></p>`
          : ""
      }
      <p style="margin-top:16px;font-size:12px;color:#94A3B8">Em caso de dúvidas, responda este e-mail ou fale direto com ${opts.empresaNome}.</p>
    `,
  });
  return { assunto, html };
}

async function processar(req: Request) {
  // valida o segredo do cron (a Vercel envia Authorization: Bearer <CRON_SECRET>)
  const auth = req.headers.get("authorization");
  /*
    Sem `CRON_SECRET` configurado, esta linha era um `if` que nunca entrava: a
    ausência da variável liberava a rota para qualquer um. Enquanto o middleware
    devolvia 307 para o login em tudo que era `/api`, uma segunda fechadura
    escondia o problema — e ela foi removida de propósito, porque quebrava o
    webhook do Asaas e os próprios crons. Sem segredo, ninguém entra: um GET
    anônimo em `/api/cron/expurgo-documentos` apagaria documento de todas as
    contas.
  */
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const admin = createAdminClient();
  const base = urlDoApp();
  const hoje = new Date().toISOString().slice(0, 10);

  const { data: configs, error: errCfg } = await admin
    .from("boleto_lembretes_config")
    .select("empresa_id, ativa, dias_antes, no_vencimento, dias_depois")
    .eq("ativa", true);
  if (errCfg) return NextResponse.json({ error: errCfg.message }, { status: 500 });

  let verificados = 0;
  let enviados = 0;
  let semEmail = 0;
  const falhas: string[] = [];

  for (const cfg of configs ?? []) {
    // alvos de vencimento desta empresa hoje
    const alvos: { tipo: Tipo; vencimento: string }[] = [];
    if (cfg.dias_antes > 0) alvos.push({ tipo: "antes", vencimento: isoMaisDias(hoje, cfg.dias_antes) });
    if (cfg.no_vencimento) alvos.push({ tipo: "vencimento", vencimento: hoje });
    if (cfg.dias_depois > 0) alvos.push({ tipo: "apos", vencimento: isoMaisDias(hoje, -cfg.dias_depois) });
    if (alvos.length === 0) continue;

    const { data: empresa } = await admin
      .from("empresas")
      .select("nome, razao_social")
      .eq("id", cfg.empresa_id)
      .maybeSingle();
    const empresaNome = empresa?.razao_social || empresa?.nome || "sua contabilidade";

    for (const alvo of alvos) {
      const { data: titulos } = await admin
        .from("cobranca_titulos")
        .select("id, valor, vencimento, numero_documento, linha_digitavel, cliente_fornecedor_id, sacado_nome, token_publico")
        .eq("empresa_id", cfg.empresa_id)
        .eq("vencimento", alvo.vencimento)
        .in("status", ["gerado", "em_remessa", "registrado"]);

      for (const t of titulos ?? []) {
        verificados++;
        // e-mail do sacado
        let email: string | null = null;
        let nome = t.sacado_nome ?? "cliente";
        if (t.cliente_fornecedor_id) {
          const { data: cli } = await admin
            .from("clientes_fornecedores")
            .select("nome, email")
            .eq("id", t.cliente_fornecedor_id)
            .maybeSingle();
          email = cli?.email ?? null;
          nome = cli?.nome ?? nome;
        }
        if (!email) {
          semEmail++;
          continue;
        }

        // dedup: o insert falha se este toque já foi enviado para este título
        const { error: dupErr } = await admin
          .from("boleto_lembretes")
          .insert({ empresa_id: cfg.empresa_id, titulo_id: t.id, tipo: alvo.tipo, email });
        if (dupErr) continue;

        const { assunto, html } = corpoEmail({
          tipo: alvo.tipo,
          clienteNome: nome,
          empresaNome,
          valor: Number(t.valor),
          vencimento: t.vencimento,
          linhaDigitavel: t.linha_digitavel,
          numeroDocumento: t.numero_documento,
          urlBoleto: await (async () => {
            let token = (t as { token_publico?: string | null }).token_publico ?? null;
            if (!token) {
              // título anterior ao link público: gera agora
              token = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
              const { error: errTok } = await admin
                .from("cobranca_titulos")
                .update({ token_publico: token })
                .eq("id", t.id);
              if (errTok) token = null;
            }
            return token ? `${base}/b/${token}` : null;
          })(),
        });
        try {
          await enviarEmail({ para: email, paraNome: nome, assunto, html, remetenteNome: empresaNome });
          enviados++;
        } catch (e) {
          // remove o registro de dedup para tentar de novo no próximo ciclo
          await admin.from("boleto_lembretes").delete().eq("titulo_id", t.id).eq("tipo", alvo.tipo);
          falhas.push(`${t.id.slice(0, 8)}: ${e instanceof Error ? e.message.slice(0, 80) : "erro"}`);
        }
      }
    }
  }

  return NextResponse.json({ ok: true, verificados, enviados, semEmail, falhas: falhas.slice(0, 10) });
}

export async function GET(req: Request) {
  return processar(req);
}
export async function POST(req: Request) {
  return processar(req);
}

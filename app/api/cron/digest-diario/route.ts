import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarEmail, layoutEmail } from "@/lib/brevo";
import { getDigestData, corpoDigest } from "@/lib/digest";
import { urlDoApp } from "@/lib/urls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Digest diário: resumo da operação por e-mail ao owner do escritório.
// Opt-in via digest_config.ativo. Dedup por ultimo_envio (1x por dia).
// Por padrão só em dias úteis. Não envia se não houver nada relevante.

function hojeISO(tz = "America/Sao_Paulo"): string {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  return f.format(new Date());
}
function ehDiaUtil(tz = "America/Sao_Paulo"): boolean {
  const dia = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(new Date());
  return !["Sat", "Sun"].includes(dia);
}

export async function GET(req: Request) {
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
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();
  const hoje = hojeISO();
  const diaUtil = ehDiaUtil();

  const { data: configs } = await admin
    .from("digest_config")
    .select("escritorio_id, ativo, apenas_dias_uteis, ultimo_envio")
    .eq("ativo", true);

  let enviados = 0;
  let pulados = 0;
  const erros: string[] = [];

  for (const cfg of (configs ?? []) as Array<{
    escritorio_id: string;
    apenas_dias_uteis: boolean;
    ultimo_envio: string | null;
  }>) {
    // já enviado hoje?
    if (cfg.ultimo_envio === hoje) {
      pulados++;
      continue;
    }
    // respeita dias úteis
    if (cfg.apenas_dias_uteis && !diaUtil) {
      pulados++;
      continue;
    }

    const { data: esc } = await admin
      .from("escritorios")
      .select("id, nome, owner_id")
      .eq("id", cfg.escritorio_id)
      .maybeSingle();
    if (!esc?.owner_id) {
      pulados++;
      continue;
    }

    const { data: u } = await admin.auth.admin.getUserById(esc.owner_id as string);
    const email = u?.user?.email;
    if (!email) {
      pulados++;
      continue;
    }

    try {
      const dados = await getDigestData(esc.id as string, (esc.nome as string) || "seu escritório");
      // nada relevante hoje: não manda (evita e-mail vazio diário)
      if (!dados.temAlgoRelevante) {
        pulados++;
        // ainda marca o envio pra não reprocessar o escritório o dia todo
        await admin.from("digest_config").update({ ultimo_envio: hoje }).eq("escritorio_id", cfg.escritorio_id);
        continue;
      }

      const site = urlDoApp();
      const { assunto, html } = corpoDigest(dados, `${site}/painel`);
      await enviarEmail({
        para: email,
        paraNome: (esc.nome as string) || undefined,
        assunto,
        html: layoutEmail({
          titulo: "Resumo do dia",
          corpoHtml: html,
          botao: { texto: "Abrir o painel", url: `${site}/painel` },
        }),
      });
      await admin.from("digest_config").update({ ultimo_envio: hoje }).eq("escritorio_id", cfg.escritorio_id);
      enviados++;
    } catch (e) {
      erros.push(`${cfg.escritorio_id}: ${e instanceof Error ? e.message : "erro"}`);
    }
  }

  return NextResponse.json({ ok: true, enviados, pulados, erros });
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarEmail, layoutEmail } from "@/lib/brevo";
import { getDigestData, corpoDigest } from "@/lib/digest";
import { urlDoApp } from "@/lib/urls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Disparo MANUAL do digest diário, restrito a super_admin.
// Diferente do cron: ignora o dedup (ultimo_envio) para permitir testes
// repetidos, e oferece o modo "só para mim" (envia ao próprio admin,
// usando a carteira do escritório dele) — sem afetar produção.

async function exigirSuperAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Não autenticado.", status: 401 as const };
  const { data: adminRow } = await supabase
    .from("membros")
    .select("super_admin")
    .eq("user_id", user.id)
    .eq("super_admin", true)
    .maybeSingle();
  if (!adminRow) return { erro: "Acesso restrito.", status: 403 as const };
  return { ok: true as const, userId: user.id, userEmail: user.email ?? "" };
}

export async function POST(req: Request) {
  const guard = await exigirSuperAdmin();
  if (!("ok" in guard)) return NextResponse.json({ erro: guard.erro }, { status: guard.status });

  const body = (await req.json().catch(() => ({}))) as { soParaMim?: boolean };
  const soParaMim = body.soParaMim !== false; // default: só para mim (modo teste seguro)

  const admin = createAdminClient();
  const site = urlDoApp();

  // descobre o escritório do super_admin (para o modo "só para mim")
  const { data: meuMembro } = await admin
    .from("membros")
    .select("escritorio_id")
    .eq("user_id", guard.userId)
    .maybeSingle();
  const meuEscritorio = (meuMembro?.escritorio_id as string) ?? "";

  if (soParaMim) {
    if (!guard.userEmail) {
      return NextResponse.json({ erro: "Sua conta não tem e-mail para receber o teste." }, { status: 400 });
    }
    if (!meuEscritorio) {
      return NextResponse.json({ erro: "Você não está vinculado a um escritório para testar o resumo." }, { status: 400 });
    }
    const { data: esc } = await admin
      .from("escritorios")
      .select("nome")
      .eq("id", meuEscritorio)
      .maybeSingle();
    try {
      const dados = await getDigestData(meuEscritorio, (esc?.nome as string) || "seu escritório");
      const { assunto, html } = corpoDigest(dados, `${site}/painel`);
      await enviarEmail({
        para: guard.userEmail,
        paraNome: (esc?.nome as string) || undefined,
        assunto: `[teste] ${assunto}`,
        html: layoutEmail({
          titulo: "Resumo do dia (teste)",
          corpoHtml:
            `<p style="margin:0 0 12px;font-size:12px;color:#94A3B8">Este é um disparo de teste, enviado só para você. Em produção, o resumo vai para o responsável de cada escritório.</p>` +
            html,
          botao: { texto: "Abrir o painel", url: `${site}/painel` },
        }),
      });
      return NextResponse.json({
        ok: true,
        modo: "so_para_mim",
        enviadoPara: guard.userEmail,
        tinhaAlgoRelevante: dados.temAlgoRelevante,
      });
    } catch (e) {
      return NextResponse.json({ erro: e instanceof Error ? e.message : "Falha ao gerar o resumo." }, { status: 500 });
    }
  }

  // modo real: dispara para todos os escritórios com digest ativo, IGNORANDO o dedup.
  // (não atualiza ultimo_envio para não interferir no cron do dia)
  const { data: configs } = await admin
    .from("digest_config")
    .select("escritorio_id")
    .eq("ativo", true);

  let enviados = 0;
  let pulados = 0;
  const erros: string[] = [];

  for (const cfg of (configs ?? []) as Array<{ escritorio_id: string }>) {
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
      if (!dados.temAlgoRelevante) {
        pulados++;
        continue;
      }
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
      enviados++;
    } catch (e) {
      erros.push(`${cfg.escritorio_id}: ${e instanceof Error ? e.message : "erro"}`);
    }
  }

  return NextResponse.json({ ok: true, modo: "real", enviados, pulados, erros });
}

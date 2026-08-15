import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  return { ok: true as const };
}

function validarTexto(body: { quando?: number; assunto?: string; corpo?: string; botao_texto?: string }) {
  const assunto = (body.assunto || "").trim();
  const corpo = (body.corpo || "").trim();
  const botaoTexto = (body.botao_texto || "").trim();
  const quando = Math.round(Number(body.quando));
  if (!assunto) return { erro: "Informe o assunto do e-mail." };
  if (!corpo) return { erro: "Informe o texto do e-mail." };
  if (!botaoTexto) return { erro: "Informe o texto do botão." };
  if (!Number.isFinite(quando) || quando < -365 || quando > 365) {
    return { erro: "Os dias devem estar entre 365 antes e 365 depois do vencimento." };
  }
  return { ok: true as const, assunto, corpo, botaoTexto, quando };
}

export async function POST(req: Request) {
  const guard = await exigirSuperAdmin();
  if (!("ok" in guard)) return NextResponse.json({ erro: guard.erro }, { status: guard.status });

  const body = (await req.json().catch(() => ({}))) as {
    acao?: "config" | "passo" | "criar" | "excluir";
    ativa?: boolean;
    id?: string;
    quando?: number;
    assunto?: string;
    corpo?: string;
    botao_texto?: string;
    ativo?: boolean;
  };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ erro: "Configuração do servidor incompleta." }, { status: 500 });
  }

  // liga/desliga geral
  if (body.acao === "config") {
    const { error } = await admin
      .from("cobranca_config")
      .update({ ativa: Boolean(body.ativa), atualizado_em: new Date().toISOString() })
      .eq("id", 1);
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // editar um toque existente
  if (body.acao === "passo") {
    if (!body.id) return NextResponse.json({ erro: "Toque não informado." }, { status: 400 });
    const v = validarTexto(body);
    if (!("ok" in v)) return NextResponse.json({ erro: v.erro }, { status: 400 });
    const { error } = await admin
      .from("cobranca_passos")
      .update({ quando: v.quando, assunto: v.assunto, corpo: v.corpo, botao_texto: v.botaoTexto, ativo: Boolean(body.ativo) })
      .eq("id", body.id);
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // criar um novo toque
  if (body.acao === "criar") {
    const v = validarTexto(body);
    if (!("ok" in v)) return NextResponse.json({ erro: v.erro }, { status: 400 });
    // ordem/dias são colunas legadas (não usadas pela lógica nova); preenche para satisfazer NOT NULL
    const { error } = await admin.from("cobranca_passos").insert({
      ordem: 0,
      dias: 0,
      quando: v.quando,
      assunto: v.assunto,
      corpo: v.corpo,
      botao_texto: v.botaoTexto,
      ativo: true,
    });
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // excluir um toque
  if (body.acao === "excluir") {
    if (!body.id) return NextResponse.json({ erro: "Toque não informado." }, { status: 400 });
    const { error } = await admin.from("cobranca_passos").delete().eq("id", body.id);
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ erro: "Ação inválida." }, { status: 400 });
}

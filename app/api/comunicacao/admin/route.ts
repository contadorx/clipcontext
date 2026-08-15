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

export async function POST(req: Request) {
  const guard = await exigirSuperAdmin();
  if (!("ok" in guard)) return NextResponse.json({ erro: guard.erro }, { status: guard.status });

  const body = (await req.json().catch(() => ({}))) as {
    acao?: "config" | "passo";
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

  // liga/desliga geral da régua
  if (body.acao === "config") {
    const { error } = await admin
      .from("comunicacao_config")
      .update({ ativa: Boolean(body.ativa), atualizado_em: new Date().toISOString() })
      .eq("id", 1);
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // edição de um toque (texto, dia, liga/desliga). O destino (path) não é editável.
  if (body.acao === "passo") {
    if (!body.id) return NextResponse.json({ erro: "Toque não informado." }, { status: 400 });

    const assunto = (body.assunto || "").trim();
    const corpo = (body.corpo || "").trim();
    const botaoTexto = (body.botao_texto || "").trim();
    const quando = Math.round(Number(body.quando));

    if (!assunto) return NextResponse.json({ erro: "Informe o assunto do e-mail." }, { status: 400 });
    if (!corpo) return NextResponse.json({ erro: "Informe o texto do e-mail." }, { status: 400 });
    if (!botaoTexto) return NextResponse.json({ erro: "Informe o texto do botão." }, { status: 400 });
    if (!Number.isFinite(quando) || quando < 0 || quando > 365) {
      return NextResponse.json({ erro: "O dia do toque deve ser entre 0 e 365." }, { status: 400 });
    }

    const { error } = await admin
      .from("comunicacao_passos")
      .update({
        assunto,
        corpo,
        botao_texto: botaoTexto,
        quando,
        ativo: Boolean(body.ativo),
      })
      .eq("id", body.id);
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ erro: "Ação inválida." }, { status: 400 });
}

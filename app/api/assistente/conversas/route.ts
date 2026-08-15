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

export async function GET(req: Request) {
  const guard = await exigirSuperAdmin();
  if (!("ok" in guard)) return NextResponse.json({ erro: guard.erro }, { status: guard.status });

  const soHumano = new URL(req.url).searchParams.get("humano") === "1";
  let conversas: unknown[] = [];
  try {
    const admin = createAdminClient();
    let q = admin
      .from("assistente_conversas")
      .select("id, escritorio_nome, contador_nome, contador_email, mensagens, precisa_humano, atualizado_em")
      .order("atualizado_em", { ascending: false })
      .limit(80);
    if (soHumano) q = q.eq("precisa_humano", true);
    const { data } = await q;
    conversas = data ?? [];
  } catch {
    /* tabela ainda não criada */
  }
  return NextResponse.json({ ok: true, conversas });
}

export async function DELETE(req: Request) {
  const guard = await exigirSuperAdmin();
  if (!("ok" in guard)) return NextResponse.json({ erro: guard.erro }, { status: guard.status });

  const params = new URL(req.url).searchParams;
  const id = params.get("id");
  const all = params.get("all") === "1";
  if (!id && !all) return NextResponse.json({ erro: "Informe id ou all=1." }, { status: 400 });

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ erro: "Configuração do servidor incompleta." }, { status: 500 });
  }

  let q = admin.from("assistente_conversas").delete();
  q = all ? q.neq("id", "00000000-0000-0000-0000-000000000000") : q.eq("id", id as string);
  const { error } = await q;
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

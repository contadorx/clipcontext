import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PERSONA_PADRAO } from "@/lib/assistente";

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

export async function GET() {
  const guard = await exigirSuperAdmin();
  if (!("ok" in guard)) return NextResponse.json({ erro: guard.erro }, { status: guard.status });

  let system_prompt = "";
  let modelo = "";
  let atualizado_em: string | null = null;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("assistente_config")
      .select("system_prompt, modelo, atualizado_em")
      .eq("id", 1)
      .maybeSingle();
    system_prompt = data?.system_prompt || "";
    modelo = data?.modelo || "";
    atualizado_em = data?.atualizado_em || null;
  } catch {
    /* tabela ainda não criada */
  }

  return NextResponse.json({ ok: true, system_prompt, modelo, atualizado_em, padrao: PERSONA_PADRAO });
}

export async function POST(req: Request) {
  const guard = await exigirSuperAdmin();
  if (!("ok" in guard)) return NextResponse.json({ erro: guard.erro }, { status: guard.status });

  const body = (await req.json().catch(() => ({}))) as { system_prompt?: string; modelo?: string };
  const system_prompt = String(body.system_prompt || "").slice(0, 40000);
  const modelo = String(body.modelo || "").slice(0, 60).trim();

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ erro: "Configuração do servidor incompleta." }, { status: 500 });
  }

  const { error } = await admin
    .from("assistente_config")
    .upsert({ id: 1, system_prompt, modelo, atualizado_em: new Date().toISOString() }, { onConflict: "id" });
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

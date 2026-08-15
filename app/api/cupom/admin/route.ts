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
    acao?: "criar" | "toggle";
    id?: string;
    ativo?: boolean;
    codigo?: string;
    percentual?: number;
    duracaoMeses?: number | null;
    maxUsos?: number | null;
  };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ erro: "Configuração do servidor incompleta." }, { status: 500 });
  }

  if (body.acao === "toggle") {
    if (!body.id) return NextResponse.json({ erro: "Cupom não informado." }, { status: 400 });
    const { error } = await admin.from("cupons").update({ ativo: Boolean(body.ativo) }).eq("id", body.id);
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // criar
  const codigo = (body.codigo || "").trim().toUpperCase();
  const percentual = Math.round(Number(body.percentual) || 0);
  if (!codigo) return NextResponse.json({ erro: "Informe o código do cupom." }, { status: 400 });
  if (!/^[A-Z0-9]{3,24}$/.test(codigo)) {
    return NextResponse.json({ erro: "Use de 3 a 24 letras/números, sem espaços." }, { status: 400 });
  }
  if (percentual < 1 || percentual > 100) {
    return NextResponse.json({ erro: "O desconto deve ser entre 1% e 100%." }, { status: 400 });
  }
  const duracaoMeses = body.duracaoMeses != null && Number(body.duracaoMeses) > 0 ? Math.round(Number(body.duracaoMeses)) : null;
  const maxUsos = body.maxUsos != null && Number(body.maxUsos) > 0 ? Math.round(Number(body.maxUsos)) : null;

  const { error } = await admin.from("cupons").insert({
    codigo,
    percentual,
    duracao_meses: duracaoMeses,
    max_usos: maxUsos,
    ativo: true,
  });
  if (error) {
    const msg = error.code === "23505" ? "Já existe um cupom com esse código." : error.message;
    return NextResponse.json({ erro: msg }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

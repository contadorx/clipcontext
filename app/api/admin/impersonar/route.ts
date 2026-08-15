import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  // só super_admin pode impersonar
  const { data: adminRow } = await supabase
    .from("membros")
    .select("super_admin")
    .eq("user_id", user.id)
    .eq("super_admin", true)
    .maybeSingle();
  if (!adminRow) return NextResponse.json({ erro: "Acesso restrito." }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { escritorio_id?: string };
  if (!body.escritorio_id) return NextResponse.json({ erro: "Escritório não informado." }, { status: 400 });

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ erro: "Configuração do servidor incompleta." }, { status: 500 });
  }

  // escritório alvo + dono
  const { data: esc } = await admin
    .from("escritorios")
    .select("id, nome, owner_id")
    .eq("id", body.escritorio_id)
    .maybeSingle();
  if (!esc?.owner_id) return NextResponse.json({ erro: "Escritório sem usuário dono." }, { status: 404 });

  // e-mail do dono
  const { data: ownerData, error: ownerErr } = await admin.auth.admin.getUserById(esc.owner_id as string);
  const email = ownerData?.user?.email;
  if (ownerErr || !email) return NextResponse.json({ erro: "Não foi possível localizar o usuário do escritório." }, { status: 404 });

  // guarda a sessão do admin ANTES de trocar (para poder voltar)
  const { data: sessData } = await supabase.auth.getSession();
  const adminSess = sessData?.session;
  if (!adminSess) return NextResponse.json({ erro: "Sessão de admin indisponível." }, { status: 401 });

  // gera um token de sessão para o dono e troca a sessão atual por ele
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = (linkData?.properties as { hashed_token?: string } | undefined)?.hashed_token;
  if (linkErr || !tokenHash) return NextResponse.json({ erro: "Não foi possível gerar o acesso." }, { status: 500 });

  const { error: otpErr } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
  if (otpErr) return NextResponse.json({ erro: "Falha ao iniciar o acesso impersonado." }, { status: 500 });

  // a partir daqui os cookies de sessão são do dono. guarda a sessão do admin e marca a impersonação.
  const cookieStore = cookies();
  const opts = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 8 };
  cookieStore.set(
    "fx_admin_sess",
    JSON.stringify({ a: adminSess.access_token, r: adminSess.refresh_token, uid: user.id }),
    opts,
  );
  cookieStore.set("fx_imp", esc.nome ?? "escritório", opts);

  // auditoria
  await admin.from("impersonacoes").insert({
    admin_user_id: user.id,
    admin_email: user.email,
    escritorio_id: esc.id,
    escritorio_nome: esc.nome,
  });

  return NextResponse.json({ ok: true });
}

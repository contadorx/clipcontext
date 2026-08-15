import { NextResponse } from "next/server";
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

  // só super_admin
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

  const { data: esc } = await admin
    .from("escritorios")
    .select("id, owner_id")
    .eq("id", body.escritorio_id)
    .maybeSingle();
  if (!esc) return NextResponse.json({ erro: "Escritório não encontrado." }, { status: 404 });

  // trava de segurança: não excluir o próprio escritório por aqui
  if (esc.owner_id === user.id) {
    return NextResponse.json({ erro: "Você não pode excluir o seu próprio escritório por aqui." }, { status: 400 });
  }

  // apaga todos os dados (transacional dentro da função; valida super_admin de novo).
  // chamado com a sessão do usuário para que is_super_admin() (auth.uid()) funcione.
  const { data: paths, error } = await supabase.rpc("admin_excluir_escritorio", {
    p_escritorio: body.escritorio_id,
  });
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  // remove os arquivos do Storage (best-effort)
  const arr = (paths as string[] | null) ?? [];
  if (arr.length > 0) {
    try {
      await admin.storage.from("documentos-entrada").remove(arr);
    } catch {
      /* não bloqueia: dados já foram apagados */
    }
  }

  // remove o usuário dono do Auth (best-effort)
  if (esc.owner_id) {
    try {
      await admin.auth.admin.deleteUser(esc.owner_id as string);
    } catch {
      /* não bloqueia */
    }
  }

  return NextResponse.json({ ok: true });
}

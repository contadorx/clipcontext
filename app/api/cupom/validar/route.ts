import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validarCupom } from "@/lib/cupons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ valido: false, erro: "Não autenticado." }, { status: 401 });

  const { codigo } = (await req.json().catch(() => ({}))) as { codigo?: string };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ valido: false, erro: "Configuração do servidor incompleta." }, { status: 500 });
  }

  const r = await validarCupom(admin, codigo ?? "");
  if (!r.ok) return NextResponse.json({ valido: false, erro: r.erro });
  return NextResponse.json({
    valido: true,
    codigo: r.codigo,
    percentual: r.percentual,
    duracaoMeses: r.duracaoMeses,
  });
}

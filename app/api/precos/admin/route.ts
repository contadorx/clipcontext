import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { configDeRow, configParaRow, type Faixa, type CicloDef } from "@/lib/precos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function exigirSuperAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: "Não autenticado.", status: 401 as const };
  const { data: adminRow } = await supabase
    .from("membros").select("super_admin").eq("user_id", user.id).eq("super_admin", true).maybeSingle();
  if (!adminRow) return { erro: "Acesso restrito.", status: 403 as const };
  return { ok: true as const };
}

export async function GET() {
  const guard = await exigirSuperAdmin();
  if (!("ok" in guard)) return NextResponse.json({ erro: guard.erro }, { status: guard.status });
  let admin;
  try { admin = createAdminClient(); } catch { return NextResponse.json({ erro: "Configuração do servidor incompleta." }, { status: 500 }); }
  const { data } = await admin.from("precos_config").select("faixas, piso, ciclos").eq("id", 1).maybeSingle();
  return NextResponse.json({ config: configParaRow(configDeRow(data as Parameters<typeof configDeRow>[0])) });
}

function validar(faixas: unknown, piso: unknown, ciclos: unknown): string | null {
  if (!Array.isArray(faixas) || faixas.length === 0) return "Informe ao menos uma faixa.";
  for (const f of faixas as Faixa[]) if (typeof f.preco !== "number" || f.preco < 0) return "Preço de faixa inválido.";
  for (let i = 0; i < faixas.length - 1; i++) {
    const ate = (faixas[i] as { ate: number | null }).ate;
    if (typeof ate !== "number" || ate <= 0) return "As faixas intermediárias precisam de um teto positivo.";
  }
  if (typeof piso !== "number" || piso < 0) return "Piso inválido.";
  if (!Array.isArray(ciclos) || ciclos.length === 0) return "Informe ao menos um ciclo.";
  for (const c of ciclos as CicloDef[]) {
    if (typeof c.meses !== "number" || c.meses < 1) return "Ciclo com meses inválido.";
    if (typeof c.desc !== "number" || c.desc < 0 || c.desc >= 1) return "Desconto de ciclo deve ficar entre 0 e 1.";
  }
  return null;
}

export async function POST(req: Request) {
  const guard = await exigirSuperAdmin();
  if (!("ok" in guard)) return NextResponse.json({ erro: guard.erro }, { status: guard.status });
  const body = (await req.json().catch(() => ({}))) as { faixas?: { ate: number | null; preco: number }[]; piso?: number; ciclos?: CicloDef[]; };
  const erro = validar(body.faixas, body.piso, body.ciclos);
  if (erro) return NextResponse.json({ erro }, { status: 400 });
  const faixas = [...(body.faixas ?? [])];
  faixas.forEach((f, i) => { if (i === faixas.length - 1) f.ate = null; });
  let admin;
  try { admin = createAdminClient(); } catch { return NextResponse.json({ erro: "Configuração do servidor incompleta." }, { status: 500 }); }
  const { error } = await admin.from("precos_config").upsert(
    { id: 1, faixas, piso: body.piso, ciclos: body.ciclos, atualizado_em: new Date().toISOString() }, { onConflict: "id" });
  if (error) return NextResponse.json({ erro: "Não foi possível salvar." }, { status: 500 });
  return NextResponse.json({ ok: true, config: { faixas, piso: body.piso, ciclos: body.ciclos } });
}

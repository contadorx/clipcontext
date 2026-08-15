import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "documentos-entrada";

// Extratos (OFX/CSV) que o cliente subiu pelo portal e ainda não foram
// importados na conciliação. GET lista; POST baixa o conteúdo de um para
// o front parsear com o mesmo motor da importação manual.

async function autorizado(supabase: ReturnType<typeof createClient>, empresaId: string): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("empresas")
    .select("id, escritorio_id, membros:membros!inner(user_id)")
    .eq("id", empresaId)
    .eq("membros.user_id", user.id)
    .maybeSingle();
  return !!data;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const empresaId = searchParams.get("empresaId") || "";
  if (!empresaId) return NextResponse.json({ error: "empresaId obrigatório" }, { status: 400 });

  const supabase = createClient();
  if (!(await autorizado(supabase, empresaId))) return NextResponse.json({ error: "sem acesso" }, { status: 403 });

  const admin = createAdminClient();
  const { data } = await admin
    .from("documentos_recebidos")
    .select("id, arquivo_nome, tamanho, enviado_por_nome, enviado_por_email, criado_em")
    .eq("empresa_id", empresaId)
    .eq("eh_extrato", true)
    .eq("extrato_importado", false)
    .order("criado_em", { ascending: false })
    .limit(20);

  return NextResponse.json({ extratos: data ?? [] });
}

export async function POST(req: Request) {
  const { empresaId, documentoId } = (await req.json().catch(() => ({}))) as {
    empresaId?: string;
    documentoId?: string;
  };
  if (!empresaId || !documentoId) return NextResponse.json({ error: "parâmetros incompletos" }, { status: 400 });

  const supabase = createClient();
  if (!(await autorizado(supabase, empresaId))) return NextResponse.json({ error: "sem acesso" }, { status: 403 });

  const admin = createAdminClient();
  const { data: doc } = await admin
    .from("documentos_recebidos")
    .select("arquivo_path, arquivo_nome, eh_extrato, extrato_importado")
    .eq("id", documentoId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (!doc || !doc.eh_extrato) return NextResponse.json({ error: "extrato não encontrado" }, { status: 404 });

  const dl = await admin.storage.from(BUCKET).download(doc.arquivo_path);
  if (dl.error || !dl.data) return NextResponse.json({ error: "não foi possível ler o arquivo" }, { status: 500 });

  // texto bruto (latin1 e utf8 cobrem OFX/CSV brasileiros); o front decide o parser pela extensão
  const buf = Buffer.from(await dl.data.arrayBuffer());
  const ext = (doc.arquivo_nome.split(".").pop() || "").toLowerCase();
  return NextResponse.json({
    nome: doc.arquivo_nome,
    ext,
    conteudo_b64: buf.toString("base64"),
  });
}

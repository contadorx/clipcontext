import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "documentos-entrada";

export async function POST(req: Request) {
  try {
    const { documentoId, marcar } = (await req.json().catch(() => ({}))) as { documentoId?: string; marcar?: boolean };
    if (!documentoId) return NextResponse.json({ error: "Documento não informado." }, { status: 400 });

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    // RLS garante que só um membro do escritório da empresa enxerga o documento.
    const { data: doc } = await supabase
      .from("documentos_recebidos")
      .select("id, arquivo_path, arquivo_nome, status")
      .eq("id", documentoId)
      .maybeSingle();
    if (!doc) return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });


    const admin = createAdminClient();
    const { data: signed, error } = await admin.storage.from(BUCKET).createSignedUrl(doc.arquivo_path as string, 300);
    if (error || !signed) return NextResponse.json({ error: "Não foi possível gerar o link." }, { status: 500 });

    /*
      Marca como baixado na primeira vez — mas só quando quem chamou pediu.

      A pré-visualização do modal "Lançar" usa esta mesma rota, e marcava o
      documento como baixado só por ter sido aberto para conferência. Pior: a
      lista não era atualizada nesse caminho, então a linha continuava dizendo
      "Novo" enquanto o banco já dizia "baixado". Agora quem entrega o arquivo
      de verdade (o botão "Abrir") passa `marcar` ausente ou true; a
      pré-visualização passa `false`.
    */
    if (doc.status === "novo" && marcar !== false) {
      await supabase
        .from("documentos_recebidos")
        .update({ status: "baixado", baixado_em: new Date().toISOString(), baixado_por: user.id })
        .eq("id", documentoId);
    }

    return NextResponse.json({ url: signed.signedUrl, nome: doc.arquivo_nome });
  } catch {
    return NextResponse.json({ error: "Erro inesperado." }, { status: 500 });
  }
}

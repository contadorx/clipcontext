import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// CRUD da Central de Ajuda (tabelas globais faq / ajuda_videos).
// Só super_admin. Writes com service role (não depende de RLS).
export async function POST(req: Request) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: adminRow } = await supabase
      .from("membros")
      .select("super_admin")
      .eq("user_id", user?.id ?? "")
      .eq("super_admin", true)
      .maybeSingle();
    if (!adminRow) return NextResponse.json({ erro: "Acesso restrito." }, { status: 403 });

    const body = (await req.json().catch(() => ({}))) as {
      tipo?: "faq" | "video";
      acao?: "salvar" | "excluir";
      registro?: Record<string, unknown>;
    };
    const { tipo, acao, registro } = body;
    if (!tipo || !acao || !registro) return NextResponse.json({ erro: "Parâmetros incompletos." }, { status: 400 });

    const admin = createAdminClient();
    const tabela = tipo === "faq" ? "faq" : "ajuda_videos";
    const id = (registro.id as string) || null;

    if (acao === "excluir") {
      if (!id) return NextResponse.json({ erro: "Sem id." }, { status: 400 });
      const { error } = await admin.from(tabela).delete().eq("id", id);
      if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    // salvar (upsert): monta o payload conforme a tabela
    let payload: Record<string, unknown>;
    if (tipo === "faq") {
      payload = {
        categoria: String(registro.categoria ?? "").trim() || "Geral",
        pergunta: String(registro.pergunta ?? "").trim(),
        resposta: String(registro.resposta ?? "").trim(),
        imagem_url: String(registro.imagem_url ?? "").trim() || null,
        destaque: !!registro.destaque,
        publicado: registro.publicado === undefined ? true : !!registro.publicado,
        ordem: Number(registro.ordem ?? 0) || 0,
      };
      if (!payload.pergunta || !payload.resposta)
        return NextResponse.json({ erro: "Pergunta e resposta são obrigatórias." }, { status: 400 });
    } else {
      payload = {
        titulo: String(registro.titulo ?? "").trim(),
        descricao: String(registro.descricao ?? "").trim() || null,
        url: String(registro.url ?? "").trim() || null,
        em_breve: !!registro.em_breve,
        publicado: registro.publicado === undefined ? true : !!registro.publicado,
        ordem: Number(registro.ordem ?? 0) || 0,
      };
      if (!payload.titulo) return NextResponse.json({ erro: "Título é obrigatório." }, { status: 400 });
    }

    if (id) {
      const { data, error } = await admin.from(tabela).update(payload).eq("id", id).select().single();
      if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, registro: data });
    } else {
      const { data, error } = await admin.from(tabela).insert(payload).select().single();
      if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, registro: data });
    }
  } catch (e) {
    return NextResponse.json({ erro: e instanceof Error ? e.message : "Erro." }, { status: 500 });
  }
}

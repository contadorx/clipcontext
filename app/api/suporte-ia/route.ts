import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { anthropic } from "@/lib/anthropic";
import { montarSystem } from "@/lib/assistente";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Faq = { categoria: string; pergunta: string; resposta: string };
type Turno = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      pergunta?: string;
      historico?: Turno[];
      conversaId?: string;
    };
    const pergunta = (body.pergunta || "").trim();
    if (!pergunta) return NextResponse.json({ erro: "Pergunta vazia." }, { status: 400 });

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // base de conhecimento (FAQ publicada)
    const { data } = await supabase.from("faq").select("categoria, pergunta, resposta").eq("publicado", true);
    const faqs = ((data as Faq[]) ?? []).slice(0, 80);
    const base = faqs.map((f) => `• [${f.categoria}] ${f.pergunta}\n${f.resposta}`).join("\n\n");

    // treino editável (persona + modelo). Best-effort: sem service role, cai no padrão.
    let persona: string | null = null;
    let modelo: string | undefined;
    try {
      const admin = createAdminClient();
      const { data: cfg } = await admin
        .from("assistente_config")
        .select("system_prompt, modelo")
        .eq("id", 1)
        .maybeSingle();
      persona = cfg?.system_prompt || null;
      modelo = cfg?.modelo || undefined;
    } catch {
      /* usa a persona padrão */
    }

    const system = montarSystem(persona, base);
    const historico = (body.historico || []).slice(-6);
    const messages: Turno[] = [...historico, { role: "user", content: pergunta }];

    const raw = await anthropic(messages, system, 700, modelo);
    let resposta = raw;
    let escalar = false;
    try {
      const limpo = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(limpo) as { resposta?: string; escalar?: boolean };
      resposta = parsed.resposta || raw;
      escalar = Boolean(parsed.escalar);
    } catch {
      /* se não vier JSON, usa o texto puro */
    }

    // histórico de conversas (best-effort; não quebra a resposta se falhar)
    if (body.conversaId) {
      try {
        const admin = createAdminClient();
        let escritorioNome: string | null = null;
        if (user) {
          const { data: esc } = await admin
            .from("escritorios")
            .select("nome")
            .eq("owner_id", user.id)
            .maybeSingle();
          escritorioNome = (esc?.nome as string) ?? null;
        }
        const mensagens = [...messages, { role: "assistant" as const, content: resposta }];
        const registro: Record<string, unknown> = {
          id: body.conversaId,
          escritorio_nome: escritorioNome,
          contador_email: user?.email ?? null,
          mensagens,
          atualizado_em: new Date().toISOString(),
        };
        if (escalar) registro.precisa_humano = true; // só liga, nunca desliga
        await admin.from("assistente_conversas").upsert(registro, { onConflict: "id" });
      } catch {
        /* salvar histórico é best-effort */
      }
    }

    return NextResponse.json({ ok: true, resposta, escalar });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro no assistente.";
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}

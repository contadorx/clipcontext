import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { enviarEmail, layoutEmail } from "@/lib/brevo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { empresaId, empresaNome, email, nome } = (await req.json().catch(() => ({}))) as {
      empresaId?: string;
      empresaNome?: string;
      email?: string;
      nome?: string;
    };
    if (!empresaId) return NextResponse.json({ error: "Empresa não informada." }, { status: 400 });
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    // Garante um token ATIVO para a empresa (RLS exige ser membro do escritório).
    /*
      Esta leitura não pode falhar aberta.

      Com o erro descartado, `existente` fica indefinido e o caminho seguinte
      GERA UM TOKEN NOVO e faz `upsert` com `onConflict: empresa_id` — ou seja,
      troca o token do portal. Todos os links que o cliente já recebeu param de
      funcionar, por causa de uma leitura que falhou.
    */
    const linkAtual = await supabase.from("portal_links").select("token, ativo").eq("empresa_id", empresaId).maybeSingle();
    if (linkAtual.error) {
      return NextResponse.json({ error: `Não foi possível ler o portal desta empresa: ${linkAtual.error.message}` }, { status: 400 });
    }
    const existente = linkAtual.data;

    let token = existente?.token as string | undefined;
    if (!token) {
      token = randomUUID().replace(/-/g, "");
      const { error } = await supabase
        .from("portal_links")
        .upsert({ empresa_id: empresaId, token, ativo: true }, { onConflict: "empresa_id" });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    } else if (existente && existente.ativo === false) {
      // reativar o link é pré-requisito do convite: sem isso o e-mail sai com um
      // endereço que responde "portal desativado", e quem recebe conclui que o
      // contador mandou um link quebrado
      const on = await supabase.from("portal_links").update({ ativo: true }).eq("empresa_id", empresaId);
      if (on.error) return NextResponse.json({ error: `Não foi possível reativar o portal: ${on.error.message}` }, { status: 400 });
    }

    const origin = new URL(req.url).origin;
    const link = `${origin}/portal/${token}`;
    const nomeEmpresa = (empresaNome && String(empresaNome).trim()) || "sua empresa";

    const html = layoutEmail({
      titulo: "Seu portal financeiro está pronto",
      corpoHtml: `Preparamos um portal online com o resumo financeiro de <b>${nomeEmpresa}</b>.<br><br>
        É só clicar no botão abaixo para acompanhar entradas, saídas e o resultado de cada mês — sem instalar nada e sem senha.`,
      botao: { texto: "Acessar meu portal", url: link },
    });

    await enviarEmail({
      para: email,
      paraNome: nome || undefined,
      assunto: `Portal financeiro — ${nomeEmpresa}`,
      html,
    });

    return NextResponse.json({ ok: true, link, token });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao enviar o convite.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

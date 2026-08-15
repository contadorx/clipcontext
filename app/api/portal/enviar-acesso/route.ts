import { NextResponse } from "next/server";
import { randomBytes, createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { enviarEmail, layoutEmail } from "@/lib/brevo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { empresaId, empresaNome, usuarioId, email, nome } = (await req
      .json()
      .catch(() => ({}))) as {
      empresaId?: string;
      empresaNome?: string;
      usuarioId?: string;
      email?: string;
      nome?: string;
    };

    if (!empresaId || !usuarioId || !email || !email.includes("@")) {
      return NextResponse.json({ error: "Dados incompletos." }, { status: 400 });
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    // Garante um link de portal ativo na empresa (o magic link redireciona pra ele).
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
    if (!existente?.token) {
      const t = randomBytes(16).toString("hex");
      const { error } = await supabase
        .from("portal_links")
        .upsert({ empresa_id: empresaId, token: t, ativo: true }, { onConflict: "empresa_id" });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    } else if (existente.ativo === false) {
      // mesmo caso do convite: mandar o acesso antes de reativar entrega um
      // link que não abre
      const on = await supabase.from("portal_links").update({ ativo: true }).eq("empresa_id", empresaId);
      if (on.error) return NextResponse.json({ error: `Não foi possível reativar o portal: ${on.error.message}` }, { status: 400 });
    }

    // Gera o magic link: guarda só o hash; o token cru vai no e-mail.
    const tokenCru = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(tokenCru).digest("hex");
    const expira = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(); // 24h

    const { error: insErr } = await supabase.from("portal_magiclinks").insert({
      empresa_id: empresaId,
      portal_usuario_id: usuarioId,
      email: String(email).toLowerCase(),
      token_hash: tokenHash,
      expira_em: expira,
    });
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });

    const origin = new URL(req.url).origin;
    const link = `${origin}/portal/entrar?t=${tokenCru}`;
    const nomeEmpresa = (empresaNome && String(empresaNome).trim()) || "sua empresa";

    const html = layoutEmail({
      titulo: "Seu acesso ao portal financeiro",
      corpoHtml: `Use o botão abaixo para entrar no portal de <b>${nomeEmpresa}</b> e acompanhar o financeiro.<br><br>
        O link é pessoal e vale por 24 horas — não precisa de senha. Se expirar, é só pedir um novo.`,
      botao: { texto: "Entrar no portal", url: link },
    });

    await enviarEmail({
      para: String(email),
      paraNome: nome || undefined,
      assunto: `Acesso ao portal — ${nomeEmpresa}`,
      html,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao enviar o acesso.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

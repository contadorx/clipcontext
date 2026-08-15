import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cookieSessao } from "@/lib/portal-sessao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DUAS_SEMANAS = 60 * 60 * 24 * 14;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const t = url.searchParams.get("t") || "";

  const invalido = NextResponse.redirect(`${origin}/portal/acesso-invalido`);
  if (!t) return invalido;

  /*
    Chave de SERVIÇO para consumir o magic link.

    Antes era a anônima — só porque estava à mão — e por isso
    `portal_validar_magiclink` precisava de `execute` para o `anon`, cuja chave
    vai no pacote do navegador. Quem quisesse podia chutar tokens direto na RPC,
    fora desta rota, sem passar por nada nosso; um acerto vira sessão de 14
    dias. O visitante do portal não tem sessão Supabase, mas também nunca chama
    esta função: quem chama é este servidor.

    Sem a chave de serviço o portal já não funciona (`sessaoDoPortal` recusa
    todo mundo), então parar aqui não tira nada de ninguém — e ainda preserva o
    magic link, que antes era consumido por uma validação que não levava a lugar
    nenhum.

    O destino é `?motivo=config`, e não a mensagem padrão: mandar "link
    inválido, peça outro" para uma falha nossa põe o cliente num laço — ele
    pede, recebe outro link, e ele também não funciona. A tela do portal já
    fazia essa distinção com `PortalIndisponivel`; o consumo do link acontece
    antes dela, então a distinção precisa existir aqui também.
  */
  let supabase: ReturnType<typeof createAdminClient>;
  try {
    supabase = createAdminClient();
  } catch {
    console.error("portal: chave de serviço ausente — magic link não pode ser validado");
    return NextResponse.redirect(`${origin}/portal/acesso-invalido?motivo=config`);
  }

  const { data, error } = await supabase.rpc("portal_validar_magiclink", { p_token: t });
  const row = (Array.isArray(data) ? data[0] : data) as
    | { ok: boolean; sessao_token: string | null; portal_token: string | null }
    | null;

  if (error || !row || !row.ok || !row.sessao_token || !row.portal_token) {
    return invalido;
  }

  const res = NextResponse.redirect(`${origin}/portal/${row.portal_token}`);
  /*
    Um cookie POR PORTAL, com o token no nome.

    Ele é o que amarra a sessão ao portal: a validação devolve a empresa, não o
    token, e é o token que está na URL. Com um cookie único, entrar no portal da
    segunda empresa do mesmo cliente derrubava o acesso ao da primeira.

    `secure` só em produção: em `http://192.168.x.x:3000` — que é exatamente
    como se testa um portal no celular — o navegador descarta o `Set-Cookie` com
    `secure`, e o resultado é uma tela de "peça acesso" que parece defeito do
    magic link.
  */
  res.cookies.set(cookieSessao(row.portal_token), row.sessao_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DUAS_SEMANAS,
  });

  /*
    Registra o acesso na auditoria.

    O painel se chama "Acessos e envios de documentos" e só registrava envio —
    a palavra "acessos" era falsa. Este é o único momento em que dá para afirmar
    que alguém entrou: o consumo do magic link. Falhar aqui não pode impedir a
    entrada; fica no log.
  */
  try {
    const sess = await supabase.rpc("portal_validar_sessao", { p_token: row.sessao_token });
    const s = (Array.isArray(sess.data) ? sess.data[0] : sess.data) as
      | { valido: boolean; empresa_id: string; portal_usuario_id: string; email: string }
      | null;
    if (!sess.error && s?.valido) {
      const reg = await supabase.from("portal_auditoria").insert({
        empresa_id: s.empresa_id,
        portal_usuario_id: s.portal_usuario_id,
        email: s.email,
        // "login" é o rótulo que `portal-auditoria.tsx:19` sabe traduzir
        acao: "login",
        detalhe: null,
      });
      if (reg.error) console.error("portal: auditoria recusou o registro de acesso", { erro: reg.error.message });
    }
  } catch (e) {
    console.error("portal: acesso não registrado na auditoria", e);
  }

  return res;
}

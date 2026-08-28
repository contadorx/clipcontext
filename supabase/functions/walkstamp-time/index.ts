/* Portal do cliente: assentos, convite, faturas, histórico, configuração e
   modelos de documento.

   Quem é o administrador NÃO vem do corpo do pedido — vem do JWT que o link
   mágico produziu. Aceitar um e-mail por parâmetro aqui seria deixar qualquer
   pessoa administrar o cliente de qualquer outra escrevendo o endereço dela.

   E o navegador nunca fala com as tabelas: fala com esta função, que confere o
   token e usa service_role. É a mesma forma da função de licença, e é o que
   permite não ter caminho anônimo nenhum para dados de fatura. */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

function emailDoToken(req: Request): string | null {
  const h = req.headers.get("Authorization") || "";
  const t = h.replace(/^Bearer\s+/i, "");
  if (!t || t.split(".").length !== 3) return null;
  try {
    const p = JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    /* `role` tem que ser authenticated: o token anônimo do site também é um JWT
       válido, e sem esta linha ele passaria com email indefinido. */
    if (p.role !== "authenticated" || !p.email) return null;
    return String(p.email).toLowerCase().trim();
  } catch { return null; }
}

async function rpc(nome: string, args: Record<string, unknown>) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const r = await fetch(`${url}/rest/v1/rpc/${nome}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error(await r.text());
  return await r.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "metodo" }, 405);

  const admin = emailDoToken(req);
  if (!admin) return json({ erro: "sem_sessao" }, 401);

  let c: Record<string, unknown> = {};
  try { c = await req.json(); } catch { /* corpo vazio é "listar" */ }
  const acao = String(c.acao || "listar");

  try {
    let p: unknown;
    if (acao === "listar") {
      p = await rpc("walkstamp_time_painel", { p_admin: admin });
      return json(p ?? { erro: "nao_admin" }, p ? 200 : 403);
    } else if (acao === "bloquear") {
      p = await rpc("walkstamp_time_bloquear", {
        p_admin: admin, p_email: String(c.email || ""), p_bloquear: c.bloquear !== false });
    } else if (acao === "ajustar") {
      p = await rpc("walkstamp_time_ajustar", {
        p_admin: admin, p_dias: Number(c.dias) || 90, p_assentos: Number(c.assentos) || 25 });
    } else if (acao === "convidar") {
      p = await rpc("walkstamp_time_convidar", { p_admin: admin, p_email: String(c.email || "") });
    } else if (acao === "config") {
      p = await rpc("walkstamp_time_config", { p_admin: admin, p_config: c.config || {} });
    } else if (acao === "modelo") {
      p = await rpc("walkstamp_time_modelo", {
        p_admin: admin,
        p_id: c.id == null ? null : Number(c.id),
        p_nome: c.nome == null ? null : String(c.nome),
        p_escopo: c.escopo === "personal" ? "personal" : "time",
        p_dados: c.dados || {},
        p_apagar: c.apagar === true });
    } else {
      return json({ erro: "acao" }, 400);
    }
    return json(p, p && (p as any).erro ? 400 : 200);
  } catch (e) {
    return json({ erro: "falha", detalhe: String(e).slice(0, 200) }, 500);
  }
});

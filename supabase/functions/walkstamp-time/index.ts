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
  try { c = await req.json(); } catch { /* corpo vazio não é ação nenhuma */ }
  const acao = String(c.acao || "");

  try {
    /* ---- SOBROU UMA AÇÃO, E É A ÚNICA QUE ALGUÉM CHAMA ----

       Esta função nasceu com seis: listar, bloquear, ajustar, convidar, config
       e modelo. Medido em 28/08, no repositório inteiro: **cinco delas não têm
       um único chamador.** Quem administra o time faz isso no painel da conta,
       que é Next e chama as mesmas RPCs direto — `walkstamp_time_ajustar`,
       `_bloquear`, `_config`, `_convidar`, `_modelo`.

       Ou seja: eram duas implementações do mesmo portal, e uma delas nunca era
       usada. Código morto com `service_role` na mão não é neutro — é superfície
       de ataque que ninguém revisa, porque ninguém a exercita.

       Sobrou o `modelo`, que a ferramenta chama de verdade: ela salva um modelo
       de documento do próprio usuário, e não tem como falar com o painel — a
       sessão dela vem do FRAGMENTO do link mágico, que nunca chega a servidor
       nenhum, então não há cookie para uma rota do Next ler. É por isso que
       esta função continua existindo em vez de virar rota: o `verify_jwt` do
       Supabase já confere o token antes de ela rodar, de graça e certo. */
    if (acao !== "modelo") return json({ erro: "acao" }, 400);
    const p = await rpc("walkstamp_time_modelo", {
      p_admin: admin,
      p_id: c.id == null ? null : Number(c.id),
      p_nome: c.nome == null ? null : String(c.nome),
      /* `personal` é o padrão, e `time` exige ser dito: um modelo salvo DA
         ferramenta é de quem salvou. Empurrar o padrão para a equipe inteira é
         decisão de quem administra, e ela se toma no painel. */
      p_escopo: c.escopo === "time" ? "time" : "personal",
      p_dados: c.dados || {},
      p_apagar: c.apagar === true });
    return json(p, p && (p as any).erro ? 400 : 200);
  } catch (e) {
    return json({ erro: "falha", detalhe: String(e).slice(0, 200) }, 500);
  }
});

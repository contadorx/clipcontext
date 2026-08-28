/* O que a sessão traz para a ferramenta: os chamados da pessoa e os padrões do
   cliente dela (empresa, logotipo, rótulo, ambiente, modelos de documento).

   O e-mail vem do JWT do link mágico, nunca do corpo do pedido — aceitar um
   e-mail por parâmetro deixaria qualquer pessoa ler os chamados e os padrões de
   qualquer outra escrevendo o endereço dela.

   Nada aqui é CONTEÚDO: não há vídeo, áudio, transcrição nem documento. São
   preferências e uma lista de chamados. */
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

  const email = emailDoToken(req);
  if (!email) return json({ erro: "sem_sessao" }, 401);

  try {
    /* Os dois numa chamada só: a ferramenta pede isto uma vez, na abertura da
       sessão, e duas viagens de rede aí são duas chances de meia resposta. */
    const [chamados, perfil] = await Promise.all([
      rpc("walkstamp_meus_chamados", { p_email: email }),
      rpc("walkstamp_perfil_do_usuario", { p_email: email }),
    ]);
    return json({ email, chamados, perfil });
  } catch (e) {
    return json({ erro: "falha", detalhe: String(e).slice(0, 200) }, 500);
  }
});

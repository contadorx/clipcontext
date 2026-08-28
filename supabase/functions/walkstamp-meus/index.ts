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

  let c: Record<string, unknown> = {};
  try { c = await req.json(); } catch { /* corpo vazio é o pedido de leitura */ }

  try {
    /* ---- A ÚNICA ESCRITA DESTA FUNÇÃO, e por que ela mora aqui ----

       Guardar o vocabulário é o único caso em que a ferramenta escreve uma
       preferência da PESSOA (o `modelo` de documento vai pela outra função,
       porque é do cliente). Ela vem para cá e não para uma rota do Next pelo
       mesmo motivo de sempre: a sessão da ferramenta chega no FRAGMENTO do link
       mágico, que nunca chega a servidor nenhum, então não há cookie para uma
       rota ler — e o `verify_jwt` daqui já confere o token de graça.

       A LISTA CARREGA TERMOS DO CLIENTE: nome de sistema, de projeto, código de
       transação. Por isso o `p_guardar` é obrigatório e explícito: sem a marca
       da pessoa, o banco não só deixa de guardar como apaga o que estava lá. */
    if (c.acao === "vocabulario") {
      const p = await rpc("walkstamp_voc_guardar", {
        p_email: email,
        p_texto: c.texto == null ? null : String(c.texto),
        p_guardar: c.guardar === true,
      });
      return json(p, p && (p as any).erro ? 400 : 200);
    }
    if (c.acao != null && c.acao !== "") return json({ erro: "acao" }, 400);

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

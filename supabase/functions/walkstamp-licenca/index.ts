/* Emite a chave do plano pago para um e-mail JÁ VERIFICADO.

   Quem prova o e-mail é o Supabase Auth: a pessoa pede um link mágico, clica no
   que chegou na caixa dela, e volta com uma sessão. Esta função só aceita essa
   sessão — `verify_jwt` confere a assinatura, e aqui dentro exigimos
   `role = 'authenticated'` e um e-mail dentro do token. Não há campo de e-mail
   vindo do corpo do pedido: se houvesse, qualquer um pediria a chave de
   qualquer um.

   A chave assinada aqui é conferida OFFLINE no navegador, contra a chave
   pública que está no HTML. Nada volta a falar com este servidor depois — é a
   promessa do produto, e ela vale também para quem paga.

   O material de assinatura vem do segredo WS_LIC_PRIV e não mora neste arquivo.
   Ele também NÃO é a chave mestra: há duas. A do Leandro emite qualquer licença
   e nunca sai da máquina dele. Esta emite só o que o navegador aceita de uma
   assinatura automática — no máximo 100 dias e 25 assentos, com `s:'auto'` no
   corpo. Se este projeto for comprometido, o estrago máximo é um punhado de
   licenças curtas, nunca uma licença perpétua. */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const PRIV = Deno.env.get("WS_LIC_PRIV") ?? "";
const SITE = Deno.env.get("WS_SITE") ?? "https://walkstamp.com";
const SUPA = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/* Tetos que esta chave não pode ultrapassar, repetidos no navegador. Escritos
   aqui também porque um erro de dado na tabela não pode virar licença eterna. */
const MAX_DIAS = 100;
const MAX_ASSENTOS = 25;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const b64url = (u8: Uint8Array) =>
  btoa(String.fromCharCode(...u8)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function des64(txt: string): Uint8Array {
  const s = txt.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s + "=".repeat((4 - s.length % 4) % 4));
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

function responder(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

/* O JWT já teve a assinatura conferida pela plataforma; aqui só lemos o corpo.
   A checagem que importa é `role`: a chave anônima também é um JWT válido deste
   projeto, e sem esta linha ela passaria como se fosse gente. */
function doToken(req: Request): { email: string } | null {
  const auth = req.headers.get("Authorization") || "";
  const t = auth.replace(/^Bearer\s+/i, "");
  const partes = t.split(".");
  if (partes.length !== 3) return null;
  try {
    const p = JSON.parse(new TextDecoder().decode(des64(partes[1])));
    if (p.role !== "authenticated") return null;
    const email = String(p.email || "").trim().toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return null;
    return { email };
  } catch (_) { return null; }
}

/* As tabelas moram no esquema `walkstamp`, que o PostgREST não expõe — é de
   propósito. As duas portas em `public` são security definer e só o
   service_role tem permissão de execução. */
async function rpc(nome: string, args: Record<string, unknown>) {
  const r = await fetch(`${SUPA}/rest/v1/rpc/${nome}`, {
    method: "POST",
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error(`rpc ${nome}: ${r.status} ${await r.text()}`);
  const txt = await r.text();
  return txt ? JSON.parse(txt) : null;
}

async function assinar(corpo: Uint8Array): Promise<string> {
  const material = des64(PRIV);
  let k: CryptoKey;
  try {
    k = await crypto.subtle.importKey("raw", material, { name: "Ed25519" }, false, ["sign"]);
  } catch (_) {
    /* Algumas versões do Deno só importam Ed25519 privado em PKCS#8. Mesmo
       material, outro envelope — para a função não morrer por causa disso. */
    const pk8 = new Uint8Array([
      0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70,
      0x04, 0x22, 0x04, 0x20, ...material,
    ]);
    k = await crypto.subtle.importKey("pkcs8", pk8, { name: "Ed25519" }, false, ["sign"]);
  }
  const ass = new Uint8Array(await crypto.subtle.sign("Ed25519", k, corpo));
  return `WS1.${b64url(corpo)}.${b64url(ass)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return responder({ erro: "metodo" }, 405);
  if (!PRIV) return responder({ erro: "sem_segredo" }, 500);

  const quem = doToken(req);
  if (!quem) return responder({ erro: "sem_sessao" }, 401);

  let decisao;
  try {
    const linhas = await rpc("walkstamp_plano_de", { p_email: quem.email });
    decisao = Array.isArray(linhas) ? linhas[0] : linhas;
  } catch (e) {
    return responder({ erro: "banco", detalhe: String(e) }, 500);
  }
  if (!decisao || !decisao.plano) {
    return responder({ erro: decisao?.motivo || "sem_plano" }, 403);
  }

  const dias = Math.min(Number(decisao.dias) || 14, MAX_DIAS);
  const assentos = Math.min(Number(decisao.assentos) || 1, MAX_ASSENTOS);
  const vence = new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10);

  /* O plano assinado é o plano que a pessoa TEM. Antes esta linha era `p:
     "time"` fixo, porque só existia o Time; com o Personal à venda, uma licença
     que mente sobre o plano vira um dado errado dentro de um objeto assinado —
     e o que está assinado não dá para corrigir depois sem reemitir.

     O navegador aceita os dois. O que ele destrava é o mesmo nos dois: a marca
     do cliente no documento. A diferença entre Personal e Team mora na conta —
     assentos, convite, bloqueio e padrão do time —, não aqui. */
  const plano = decisao.plano === "personal" ? "personal" : "time";

  /* O corpo é o mesmo objeto do emissor manual, com dois campos a mais: `e`, o
     e-mail a quem a licença foi dada — que o app mostra na tela, para o repasse
     ter nome —, e `s`, dizendo que a assinatura é automática, que é o que faz o
     navegador aplicar os tetos. As chaves do JSON saem em ordem alfabética de
     propósito: o emissor manual assina o mesmo objeto, e um byte de diferença
     na serialização é uma assinatura diferente. */
  const corpo = new TextEncoder().encode(JSON.stringify({
    a: vence,
    e: quem.email,
    n: assentos,
    p: plano,
    q: decisao.cliente || quem.email,
    s: "auto",
  }));

  let chave: string;
  try { chave = await assinar(corpo); }
  catch (e) { return responder({ erro: "assinatura", detalhe: String(e) }, 500); }

  /* O que se GRAVA é o direito, e o direito de quem está testando é 'teste'.
     Gravar o plano pago aqui criava uma conta paga a cada teste — e a partir
     daí a pessoa renovava sozinha para sempre. */
  try {
    await rpc("walkstamp_registrar_emissao", {
      p_email: quem.email,
      p_plano: decisao.motivo === "teste" ? "teste" : plano,
      p_assentos: assentos, p_dias: dias,
      p_cliente: decisao.cliente, p_vence: vence,
    });
  } catch (_) { /* o registro é para nós; não é motivo para negar a chave */ }

  const q = new URLSearchParams({ lic: chave });
  if (decisao.cliente) q.set("marca", decisao.cliente);

  return responder({
    link: `${SITE}/app?${q.toString()}`,
    chave,
    email: quem.email,
    vence,
    assentos,
    plano,
    origem: decisao.motivo,
  });
});

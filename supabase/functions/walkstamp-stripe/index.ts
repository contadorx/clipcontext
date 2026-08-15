/* Webhook da Stripe: a cobrança vira uma linha de fatura.

   `verify_jwt` é FALSO aqui de propósito, e essa é a única função do projeto
   onde isso vale: quem chama é a Stripe, que não tem sessão do Supabase. A
   autenticação é a ASSINATURA do webhook — e por ela ser a fechadura inteira,
   mora num módulo próprio, com teste (`assinatura.mjs`). Sem o segredo
   configurado a função recusa tudo: um webhook aberto é um jeito de qualquer
   pessoa marcar a própria fatura como paga.

   O que ela NÃO faz: emitir nota fiscal. A Stripe não emite NFS-e brasileira e
   diz isso na documentação dela; a nota sai do sistema fiscal depois do
   pagamento, e aqui só entra o endereço dela quando existir. */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { assinaturaConfere } from "./assinatura.mjs";

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
  if (req.method !== "POST") return new Response("metodo", { status: 405 });
  const segredo = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!segredo) return new Response("sem segredo", { status: 503 });

  const corpo = await req.text();
  const cabec = req.headers.get("stripe-signature") || "";
  if (!(await assinaturaConfere(corpo, cabec, segredo)))
    return new Response("assinatura", { status: 401 });

  let ev: any;
  try { ev = JSON.parse(corpo); } catch { return new Response("corpo", { status: 400 }); }
  const o = ev?.data?.object || {};

  /* Só os eventos de fatura interessam. O resto do catálogo da Stripe é ruído
     aqui — responder 200 e ignorar é o certo, porque ela reenvia o que não
     recebe 2xx. */
  const mapa: Record<string, string> = {
    "invoice.paid": "paga",
    "invoice.payment_succeeded": "paga",
    "invoice.payment_failed": "vencida",
    "invoice.finalized": "aberta",
    "invoice.created": "aberta",
    "invoice.voided": "cancelada",
  };
  const status = mapa[ev?.type];
  if (!status) return new Response("ok", { status: 200 });

  try {
    await rpc("walkstamp_fatura_da_stripe", {
      p_stripe_id: String(o.id || ""),
      p_stripe_cliente: String(o.customer || ""),
      p_email: String(o.customer_email || ""),
      p_numero: o.number ? String(o.number) : null,
      p_valor: Number(o.amount_due ?? o.total ?? 0),
      p_moeda: String(o.currency || "brl").toUpperCase(),
      p_status: status,
      p_vence: o.due_date ? new Date(o.due_date * 1000).toISOString().slice(0, 10) : null,
      p_url: o.hosted_invoice_url || null,
    });
  } catch (e) {
    /* 500 faz a Stripe tentar de novo, que é o que se quer quando o banco
       piscou. Engolir com 200 perderia a fatura em silêncio. */
    return new Response(String(e).slice(0, 200), { status: 500 });
  }
  return new Response("ok", { status: 200 });
});

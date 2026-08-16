/* O webhook da Stripe.
 *
 * A fechadura é a ASSINATURA do corpo, e é só ela: quem chama é a Stripe, que
 * não tem sessão. Sem `STRIPE_WEBHOOK_SECRET` configurado a rota recusa tudo,
 * inclusive o que for legítimo — um webhook aberto é um jeito de qualquer
 * pessoa marcar a própria fatura como paga e liberar o plano pago para si.
 *
 * A conferência é a da biblioteca oficial (`constructEvent`): comparação em
 * tempo constante e janela de tolerância no relógio, coisas que dá para
 * escrever à mão e não dá para escrever à mão *bem*.
 *
 * Ele responde 200 para o que não entende de propósito. A Stripe reenvia o que
 * não recebe 2xx, e o catálogo dela é grande; responder 500 para um evento que
 * não nos interessa é combinar uma fila de reentrega que nunca vai passar.
 */
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { PLANOS, planoDoPreco, stripe, temStripe } from '@/lib/stripe';
import { rpc, temChaveDeServico } from '@/lib/supabase/servico';

// o corpo precisa chegar cru: qualquer reserialização muda os bytes e invalida
// a assinatura, que é calculada sobre eles
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUS_DA_FATURA: Record<string, string> = {
  'invoice.paid': 'paga',
  'invoice.payment_succeeded': 'paga',
  'invoice.payment_failed': 'vencida',
  'invoice.finalized': 'aberta',
  'invoice.created': 'aberta',
  'invoice.voided': 'cancelada',
};

/** O que a assinatura comprou, do jeito que o banco entende. */
async function gravarAssinatura(assinatura: Stripe.Subscription, emailDoEvento?: string | null) {
  const item = assinatura.items.data[0];
  const plano = planoDoPreco(item?.price?.id) ?? 'personal';
  const cfg = PLANOS[plano];
  /* A quantidade da Stripe manda nos assentos: quem comprou 12 lugares no Team
     tem 12, não os 5 do padrão. O padrão só vale quando ela não diz nada. */
  const assentos = item?.quantity && item.quantity > 0 ? item.quantity : cfg.assentos;

  /* De onde vem o e-mail, na ordem: o do evento, o que o checkout carimbou nos
     metadados da assinatura, e só então uma ida à Stripe. As duas primeiras
     resolvem quase sempre — e cada ida à Stripe dentro de um webhook é tempo
     que conta para o limite de resposta dela e uma chance a mais de reentrega. */
  let email = emailDoEvento || assinatura.metadata?.email || null;
  if (!email && typeof assinatura.customer === 'string' && temStripe) {
    const cli = await stripe().customers.retrieve(assinatura.customer);
    if (!('deleted' in cli)) email = cli.email;
  }

  await rpc('walkstamp_assinatura_da_stripe', {
    p_email: (email || '').toLowerCase(),
    p_stripe_cliente: typeof assinatura.customer === 'string' ? assinatura.customer : '',
    p_stripe_assinatura: assinatura.id,
    p_plano: plano,
    p_status: assinatura.status,
    p_assentos: assentos,
    p_dias: cfg.dias,
  });
}

export async function POST(req: Request) {
  const segredo = process.env.STRIPE_WEBHOOK_SECRET;
  if (!segredo || !temStripe) return new NextResponse('sem segredo', { status: 503 });
  if (!temChaveDeServico) return new NextResponse('sem chave de serviço', { status: 503 });

  const corpo = await req.text();
  const assinado = req.headers.get('stripe-signature') || '';

  let ev: Stripe.Event;
  try {
    ev = stripe().webhooks.constructEvent(corpo, assinado, segredo);
  } catch {
    // sem detalhe na resposta: dizer *por que* a assinatura falhou é ajudar
    // quem está tentando forjar uma
    return new NextResponse('assinatura', { status: 401 });
  }

  try {
    if (ev.type === 'checkout.session.completed') {
      const s = ev.data.object as Stripe.Checkout.Session;
      if (s.subscription) {
        const id = typeof s.subscription === 'string' ? s.subscription : s.subscription.id;
        const assinatura = await stripe().subscriptions.retrieve(id);
        await gravarAssinatura(assinatura, s.customer_details?.email || s.customer_email);
      }
    } else if (ev.type.startsWith('customer.subscription.')) {
      const a = ev.data.object as Stripe.Subscription;
      /* `deleted` chega com o status que a assinatura tinha antes de morrer;
         o banco só considera vivo `active` e `trialing`, então o evento é
         reescrito para o que ele de fato significa. */
      if (ev.type === 'customer.subscription.deleted') a.status = 'canceled';
      await gravarAssinatura(a);
    } else if (STATUS_DA_FATURA[ev.type]) {
      const f = ev.data.object as Stripe.Invoice;
      await rpc('walkstamp_fatura_da_stripe', {
        p_stripe_id: String(f.id || ''),
        p_stripe_cliente: typeof f.customer === 'string' ? f.customer : '',
        p_email: String(f.customer_email || ''),
        p_numero: f.number ? String(f.number) : null,
        p_valor: Number(f.amount_due ?? f.total ?? 0),
        p_moeda: String(f.currency || 'brl').toUpperCase(),
        p_status: STATUS_DA_FATURA[ev.type],
        p_vence: f.due_date ? new Date(f.due_date * 1000).toISOString().slice(0, 10) : null,
        p_url: f.hosted_invoice_url || null,
      });
    }
  } catch (e) {
    /* 500 faz a Stripe tentar de novo, que é o que se quer quando o banco
       piscou. Engolir com 200 perderia a compra em silêncio — e a pessoa
       pagou. */
    return new NextResponse(String(e).slice(0, 200), { status: 500 });
  }

  return new NextResponse('ok', { status: 200 });
}

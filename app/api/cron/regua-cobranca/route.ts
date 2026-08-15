import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarEmail, layoutEmail } from "@/lib/brevo";
import { calcular } from "@/lib/precos";
import { carregarPrecoConfig } from "@/lib/precos-server";
import { asaasFetch, cicloAsaas, type Ciclo } from "@/lib/asaas";
import { urlDoApp } from "@/lib/urls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PassoCobranca = { quando: number; assunto: string; corpo: string; botao_texto: string };

// dias inteiros (UTC, meia-noite) desde a epoch para uma data AAAA-MM-DD
function emDias(iso: string): number | null {
  const [a, m, d] = iso.split("-").map(Number);
  if (!a || !m || !d) return null;
  return Math.floor(Date.UTC(a, m - 1, d) / 86400000);
}

// Régua de cobrança. Configurada pelo Painel do negócio (cobranca_config + cobranca_passos).
// "quando" é relativo ao vencimento: negativo = antes, 0 = no dia, positivo = depois.
// Usa proximo_vencimento (a fatura em aberto). Dedup por ciclo via cobranca_envios.
// O Asaas não notifica o cliente (notificationDisabled) — quem avisa é esta régua.
async function processarCobranca(
  admin: ReturnType<typeof createAdminClient>,
  base: string,
  hojeISO: string,
): Promise<{ verificados: number; enviados: number }> {
  // chave geral
  const { data: cfg } = await admin.from("cobranca_config").select("ativa").eq("id", 1).maybeSingle();
  if (cfg && cfg.ativa === false) return { verificados: 0, enviados: 0 };

  const { data: passosRaw } = await admin
    .from("cobranca_passos")
    .select("quando, assunto, corpo, botao_texto")
    .eq("ativo", true)
    .order("quando", { ascending: true });
  const passos = (passosRaw ?? []) as PassoCobranca[];
  if (passos.length === 0) return { verificados: 0, enviados: 0 };

  const hojeDias = emDias(hojeISO);
  if (hojeDias === null) return { verificados: 0, enviados: 0 };

  // pagantes com fatura em aberto (ativos ou em atraso); trial e cancelados ficam de fora
  const { data: lista, error } = await admin
    .from("escritorios")
    .select("id, nome, owner_id, proximo_vencimento, cobranca_fatura_url, assinatura_status")
    .neq("assinatura_status", "cancelada")
    .not("proximo_vencimento", "is", null);
  if (error) throw new Error(error.message);

  let enviados = 0;
  for (const e of lista ?? []) {
    const vencDias = emDias(e.proximo_vencimento as string);
    if (vencDias === null) continue;
    const rel = hojeDias - vencDias; // <0 antes do vencimento, >0 depois

    const passo = passos.find((p) => p.quando === rel);
    if (!passo) continue;

    // dedup por ciclo: um envio por (escritório, vencimento-alvo, quando)
    const { error: dupErr } = await admin
      .from("cobranca_envios")
      .insert({ escritorio_id: e.id, venc_alvo: e.proximo_vencimento, quando: passo.quando });
    if (dupErr) continue; // já enviado neste ciclo

    const { data: u } = await admin.auth.admin.getUserById(e.owner_id as string);
    const email = u?.user?.email;
    if (!email) continue;

    const url = (e.cobranca_fatura_url as string) || `${base}/configuracoes/assinatura`;
    const diasAbs = String(Math.abs(rel));
    const assunto = passo.assunto.replace(/\{dias\}/g, diasAbs);
    const corpo = passo.corpo.replace(/\{dias\}/g, diasAbs);
    try {
      await enviarEmail({
        para: email,
        assunto,
        html: layoutEmail({ titulo: assunto, corpoHtml: corpo, botao: { texto: passo.botao_texto, url } }),
      });
      enviados++;
    } catch {
      // registro de dedup já gravado; não reenvia (evita spam por falha pontual)
    }
  }
  return { verificados: lista?.length ?? 0, enviados };
}

type PassoComunic = {
  momento: "apos_cadastro" | "pos_pagamento";
  quando: number; // dia do toque
  assunto: string;
  corpo: string;
  botao_texto: string;
  path: string;
};

// Régua de comunicação do ciclo de vida. Configurada pelo Painel do negócio
// (tabelas comunicacao_config + comunicacao_passos). Dedup via comunicacao_envios.
async function processarComunicacao(admin: ReturnType<typeof createAdminClient>, base: string): Promise<number> {
  const agora = Date.now();
  let enviados = 0;

  // chave geral: se a régua estiver desligada, não envia nada
  const { data: cfg } = await admin
    .from("comunicacao_config")
    .select("ativa")
    .eq("id", 1)
    .maybeSingle();
  if (cfg && cfg.ativa === false) return 0;

  // passos ativos, na ordem definida na tela
  const { data: passosRaw } = await admin
    .from("comunicacao_passos")
    .select("momento, quando, assunto, corpo, botao_texto, path")
    .eq("ativo", true)
    .order("ordem", { ascending: true });
  const passos = (passosRaw ?? []) as PassoComunic[];
  if (passos.length === 0) return 0;

  const { data: escs } = await admin
    .from("escritorios")
    .select("id, owner_id, criado_em, ultimo_pagamento_em, assinatura_status");

  for (const e of escs ?? []) {
    for (const p of passos) {
      let baseDate: string | null = null;
      if (p.momento === "apos_cadastro") {
        // conversão: ainda não pagou e não cancelou
        if (e.ultimo_pagamento_em || e.assinatura_status === "cancelada") continue;
        baseDate = (e.criado_em as string) ?? null;
      } else {
        // retenção: pagante ativo, contado do último pagamento
        if (!e.ultimo_pagamento_em || e.assinatura_status !== "ativa") continue;
        baseDate = (e.ultimo_pagamento_em as string) ?? null;
      }
      if (!baseDate) continue;

      const dias = Math.floor((agora - Date.parse(baseDate)) / 86400000);
      if (dias < p.quando) continue; // ainda não chegou o dia do toque

      // trava o slot (dedup): se já existe, o insert falha por unique e pulamos
      const { error: dupErr } = await admin
        .from("comunicacao_envios")
        .insert({ escritorio_id: e.id, momento: p.momento, quando: p.quando });
      if (dupErr) continue;

      const { data: u } = await admin.auth.admin.getUserById(e.owner_id as string);
      const email = u?.user?.email;
      if (!email) continue;

      try {
        await enviarEmail({
          para: email,
          assunto: p.assunto,
          html: layoutEmail({ titulo: p.assunto, corpoHtml: p.corpo, botao: { texto: p.botao_texto, url: `${base}${p.path}` } }),
        });
        enviados++;
      } catch {
        // registro de dedup já gravado; não reenvia (evita spam por falha pontual)
      }
    }
  }
  return enviados;
}

async function processar(req: Request) {
  // valida o segredo do cron (a Vercel envia Authorization: Bearer <CRON_SECRET>)
  const auth = req.headers.get("authorization");
  /*
    Sem `CRON_SECRET` configurado, esta linha era um `if` que nunca entrava: a
    ausência da variável liberava a rota para qualquer um. Enquanto o middleware
    devolvia 307 para o login em tudo que era `/api`, uma segunda fechadura
    escondia o problema — e ela foi removida de propósito, porque quebrava o
    webhook do Asaas e os próprios crons. Sem segredo, ninguém entra: um GET
    anônimo em `/api/cron/expurgo-documentos` apagaria documento de todas as
    contas.
  */
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const base = urlDoApp();
  const hojeISO = new Date().toISOString().slice(0, 10);
  const admin = createAdminClient();

  const { verificados, enviados } = await processarCobranca(admin, base, hojeISO);

  // ===== Recuperação de churn: e-mail "volte" alguns dias após o cancelamento =====
  let recuperados = 0;
  const corteRecup = new Date(Date.now() - 3 * 86400000).toISOString(); // cancelou há ≥ 3 dias
  const { data: cancelados } = await admin
    .from("escritorios")
    .select("id, owner_id, cancelado_em")
    .eq("assinatura_status", "cancelada")
    .is("recuperacao_enviada_em", null)
    .not("cancelado_em", "is", null)
    .lte("cancelado_em", corteRecup);

  for (const e of cancelados ?? []) {
    const { data: u } = await admin.auth.admin.getUserById(e.owner_id as string);
    const email = u?.user?.email;
    if (!email) continue;
    const assunto = "Que tal voltar ao FinanceiroX?";
    const corpo = `Notamos que você deixou o FinanceiroX há alguns dias — e seus dados continuam guardados.<br><br>
      Se quiser retomar de onde parou, é só reativar a assinatura: leva um minuto e você volta com tudo no lugar.`;
    try {
      await enviarEmail({
        para: email,
        assunto,
        html: layoutEmail({
          titulo: assunto,
          corpoHtml: corpo,
          botao: { texto: "Reativar assinatura", url: `${base}/configuracoes/assinatura` },
        }),
      });
      await admin.from("escritorios").update({ recuperacao_enviada_em: new Date().toISOString() }).eq("id", e.id);
      recuperados++;
    } catch {
      // falha de envio não interrompe o lote; tenta de novo amanhã
    }
  }

  // ===== Reversão de cupom expirado: volta a assinatura ao preço cheio =====
  let cuponsRevertidos = 0;
  const { data: expirados } = await admin
    .from("escritorios")
    .select("id, assinatura_qtd, ciclo_cobranca, asaas_subscription_id, cupom_codigo")
    .not("cupom_expira_em", "is", null)
    .lte("cupom_expira_em", new Date().toISOString())
    .not("asaas_subscription_id", "is", null);

  const cfg = await carregarPrecoConfig();
  for (const e of expirados ?? []) {
    const ciclo = (e.ciclo_cobranca as Ciclo) || "mensal";
    const qtd = Number(e.assinatura_qtd) || 1;
    const calc = calcular(qtd, ciclo, cfg);
    const valorCiclo = Number(calc.totalCiclo.toFixed(2));
    const valorMensal = Number(calc.mensalEquivalente.toFixed(2));
    try {
      await asaasFetch(`/subscriptions/${e.asaas_subscription_id}`, {
        method: "PUT",
        body: JSON.stringify({
          value: valorCiclo,
          cycle: cicloAsaas(ciclo),
          description: `FinanceiroX — ${qtd} empresa(s) · ${ciclo}`,
        }),
      });
      await admin
        .from("escritorios")
        .update({
          valor_mensal: valorMensal,
          cupom_codigo: null,
          cupom_percentual: null,
          cupom_expira_em: null,
        })
        .eq("id", e.id);
      cuponsRevertidos++;
    } catch {
      // se o Asaas falhar, tenta de novo no próximo ciclo do cron
    }
  }

  const comunicados = await processarComunicacao(admin, base);

  return NextResponse.json({ ok: true, verificados, enviados, recuperados, cuponsRevertidos, comunicados });
}

export async function GET(req: Request) {
  return processar(req);
}
export async function POST(req: Request) {
  return processar(req);
}

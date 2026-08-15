import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarEmail, layoutEmail } from "@/lib/brevo";
import { urlDoApp } from "@/lib/urls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Régua de COMUNICAÇÃO (ciclo de vida). Não toca em pagamento — só dispara e-mail
// (Brevo) em momentos do ciclo, para CONVERTER (ainda não pagou, contado do cadastro)
// e RETER (pagante ativo, contado do último pagamento). 1 envio por conta/momento/dia.

type Momento = "apos_cadastro" | "pos_pagamento";
type Passo = { momento: Momento; quando: number; assunto: string; corpo: string; botao: string; path: string };

const PASSOS: Passo[] = [
  // ---- Conversão: ainda não pagou e não cancelou (contado do cadastro) ----
  {
    momento: "apos_cadastro",
    quando: 1,
    assunto: "Bem-vindo ao FinanceiroX",
    corpo: `Que bom ter você aqui! O FinanceiroX organiza o financeiro dos seus clientes num lugar só — lançamentos, conciliação, relatórios e portal.<br><br>
      Comece cadastrando uma empresa e importando um extrato. Em poucos minutos você já vê o caixa do mês tomando forma.`,
    botao: "Abrir o FinanceiroX",
    path: "/painel",
  },
  {
    momento: "apos_cadastro",
    quando: 4,
    assunto: "Já conciliou seu primeiro extrato?",
    corpo: `Uma dica que economiza horas: importe o extrato OFX do banco e use a conciliação para casar com os lançamentos. O que sobra vira lançamento com um clique.<br><br>
      É a parte que mais surpreende quem testa — vale experimentar antes de o período acabar.`,
    botao: "Continuar de onde parei",
    path: "/conciliacao",
  },
  {
    momento: "apos_cadastro",
    quando: 8,
    assunto: "Pronto para deixar o financeiro no automático?",
    corpo: `Você já viu como o FinanceiroX organiza a operação. Para continuar com tudo liberado e seus dados a salvo, escolha um plano quando fizer sentido.<br><br>
      A cobrança é por volume: quanto mais empresas, menor o preço de cada uma.`,
    botao: "Escolher meu plano",
    path: "/configuracoes/assinatura",
  },
  // ---- Retenção: pagante ativo (contado do último pagamento) ----
  {
    momento: "pos_pagamento",
    quando: 1,
    assunto: "Obrigado! Vamos tirar o máximo do FinanceiroX",
    corpo: `Seu pagamento está confirmado — obrigado pela confiança.<br><br>
      Uma boa próxima parada: publique a análise do mês de um cliente e ligue o portal. É o que faz o cliente perceber valor e parar de olhar só o preço.`,
    botao: "Abrir o FinanceiroX",
    path: "/painel",
  },
  {
    momento: "pos_pagamento",
    quando: 15,
    assunto: "Uma dica para a sua operação render mais",
    corpo: `Como vão as coisas por aí? Se ainda não usou, vale conhecer os relatórios (DRE e fluxo de caixa) e os centros de custo — ajudam a mostrar resultado pro cliente e a achar onde o dinheiro escapa.<br><br>
      Qualquer dúvida, é só responder este e-mail.`,
    botao: "Ver meus relatórios",
    path: "/relatorios",
  },
];

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

  const { data: escs, error } = await admin
    .from("escritorios")
    .select("id, nome, owner_id, assinatura_status, criado_em, ultimo_pagamento_em")
    .neq("is_teste", true);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  let enviados = 0;

  for (const p of PASSOS) {
    for (const e of escs ?? []) {
      // elegibilidade conforme o momento do ciclo de vida
      let baseEm: string | null = null;
      if (p.momento === "apos_cadastro") {
        // conversão: ainda não pagou e não cancelou
        if (e.ultimo_pagamento_em || e.assinatura_status === "cancelada") continue;
        baseEm = e.criado_em as string | null;
      } else {
        // retenção: pagante ativo
        if (!e.ultimo_pagamento_em || e.assinatura_status !== "ativa") continue;
        baseEm = e.ultimo_pagamento_em as string;
      }
      if (!baseEm) continue;

      const dias = Math.floor((Date.parse(hojeISO) - Date.parse(String(baseEm).slice(0, 10))) / 86400000);
      if (dias !== p.quando) continue;

      // dedup: 1 envio por conta/momento/dia
      const { data: ja } = await admin
        .from("comunicacao_envios")
        .select("id")
        .eq("escritorio_id", e.id)
        .eq("momento", p.momento)
        .eq("quando", p.quando)
        .maybeSingle();
      if (ja) continue;

      const { data: u } = await admin.auth.admin.getUserById(e.owner_id as string);
      const email = u?.user?.email;
      if (!email) continue;

      const url = `${base}${p.path}`;
      try {
        await enviarEmail({
          para: email,
          assunto: p.assunto,
          html: layoutEmail({ titulo: p.assunto, corpoHtml: p.corpo, botao: { texto: p.botao, url } }),
        });
        await admin.from("comunicacao_envios").insert({ escritorio_id: e.id, momento: p.momento, quando: p.quando });
        enviados++;
      } catch {
        // falha de envio não interrompe o lote; tenta de novo amanhã
      }
    }
  }

  return NextResponse.json({ ok: true, verificados: escs?.length ?? 0, enviados });
}

export async function GET(req: Request) {
  return processar(req);
}
export async function POST(req: Request) {
  return processar(req);
}

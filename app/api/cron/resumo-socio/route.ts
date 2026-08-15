import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarEmail, layoutEmail } from "@/lib/brevo";
import { getPainelData } from "@/lib/painel";
import { brl } from "@/lib/formato";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Resumo financeiro periódico ao sócio de cada empresa (diário/semanal/quinzenal/mensal).
// Roda todo dia; cada empresa recebe conforme a periodicidade configurada.

function hojeISO(tz = "America/Sao_Paulo"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function ehDiaUtil(tz = "America/Sao_Paulo"): boolean {
  const dia = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(new Date());
  return !["Sat", "Sun"].includes(dia);
}
function diasEntre(aISO: string, bISO: string): number {
  return Math.floor((Date.parse(bISO + "T00:00:00Z") - Date.parse(aISO + "T00:00:00Z")) / 86400000);
}
function deveEnviar(periodicidade: string, ultimo: string | null, hoje: string, diaUtil: boolean): boolean {
  if (periodicidade === "mensal") return !ultimo || ultimo.slice(0, 7) !== hoje.slice(0, 7);
  const gap = ultimo ? diasEntre(ultimo, hoje) : 9999;
  if (periodicidade === "diario") return diaUtil && gap >= 1;
  if (periodicidade === "semanal") return gap >= 7;
  if (periodicidade === "quinzenal") return gap >= 14;
  return false;
}
const ROTULO: Record<string, string> = { diario: "diário", semanal: "semanal", quinzenal: "quinzenal", mensal: "mensal" };

export async function GET(req: Request) {
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
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();
  const hoje = hojeISO();
  const diaUtil = ehDiaUtil();
  const inicioMes = hoje.slice(0, 7) + "-01";

  const { data: configs } = await admin
    .from("resumo_socio_config")
    .select("id, empresa_id, periodicidade, email_socio, ultimo_envio")
    .eq("ativo", true);

  let enviados = 0;
  const erros: string[] = [];

  for (const cfg of configs ?? []) {
    const email = (cfg.email_socio as string | null)?.trim();
    if (!email) continue;
    if (!deveEnviar(cfg.periodicidade as string, cfg.ultimo_envio as string | null, hoje, diaUtil)) continue;

    try {
      const { data: emp } = await admin.from("empresas").select("nome").eq("id", cfg.empresa_id).maybeSingle();
      const nomeEmpresa = (emp?.nome as string) ?? "sua empresa";
      const d = await getPainelData(cfg.empresa_id as string, inicioMes, hoje);

      const linha = (rot: string, val: string, cor = "#0F172A") =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #EEF2F6;font-size:14px;color:#64748B">${rot}</td><td style="padding:8px 0;border-bottom:1px solid #EEF2F6;font-size:14px;font-weight:700;text-align:right;color:${cor}">${val}</td></tr>`;
      const corpo =
        `<p style="margin:0 0 14px;font-size:14px;color:#334155">Resumo financeiro de <b>${nomeEmpresa}</b> — competência ${hoje.slice(8, 10)}/${hoje.slice(5, 7)}/${hoje.slice(0, 4)}.</p>` +
        `<table style="width:100%;border-collapse:collapse">` +
        linha("Saldo atual", brl(d.saldoAtual)) +
        linha("Recebido no mês", brl(d.recebidos), "#12A594") +
        linha("Pago no mês", brl(d.despesas), "#E11D48") +
        linha("A receber em aberto", brl(d.aReceberMes)) +
        linha("A pagar em aberto", brl(d.aPagarMes)) +
        linha("Saldo previsto", brl(d.previsto)) +
        `</table>` +
        `<p style="margin:16px 0 0;font-size:12px;color:#94A3B8">Você recebe este resumo ${ROTULO[cfg.periodicidade as string] ?? ""} por meio da sua contabilidade.</p>`;

      await enviarEmail({
        para: email,
        assunto: `Resumo financeiro — ${nomeEmpresa}`,
        html: layoutEmail({ titulo: "Seu resumo financeiro", corpoHtml: corpo }),
      });
      await admin.from("resumo_socio_config").update({ ultimo_envio: hoje }).eq("id", cfg.id);
      enviados++;
    } catch (e) {
      erros.push(`${cfg.empresa_id}: ${e instanceof Error ? e.message : "erro"}`);
    }
  }

  return NextResponse.json({ ok: true, enviados, erros });
}

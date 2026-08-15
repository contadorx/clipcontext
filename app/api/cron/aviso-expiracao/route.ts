import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarEmail, layoutEmail } from "@/lib/brevo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Aviso mensal do que vai expirar.
 *
 * O portal sempre disse que os documentos "são apagados automaticamente depois",
 * sem dizer quando, e ninguém era avisado. O arquivo simplesmente deixava de
 * existir — perda silenciosa, do tipo que só se descobre no dia em que se
 * precisa dele.
 *
 * O aviso é **mensal e agrupado**, não um e-mail por documento na véspera. Um
 * cliente que manda cem notas por mês receberia cem e-mails, e cem e-mails
 * viram zero e-mails lidos. Uma vez por mês, com a lista do que sai nos
 * próximos trinta dias, é informação que dá para agir em cima.
 *
 * `avisado_expiracao_em` impede repetir o mesmo documento no mês seguinte. Ele é
 * gravado **depois** do envio bem-sucedido: falha de e-mail não pode consumir o
 * único aviso que aquele documento teria.
 */
const DIAS_RETENCAO = 365;
/**
 * Janela do aviso: 45 dias, e não 30.
 *
 * O cron roda todo dia 1. Entre dois dias 1 há gaps de 28 a 31 dias — sete
 * deles, por ano, com 31. Com janela de 30, um documento que estivesse com 334
 * dias na execução chegaria à seguinte com 365 e cairia fora do limite superior:
 * expurgado sem nunca ter sido avisado. São ~24 h de envios por gap, quase 2% de
 * tudo que entra num ano.
 *
 * Quarenta e cinco cobre qualquer gap com folga e ainda dá ao cliente pelo menos
 * duas semanas entre o aviso e a exclusão.
 */
const JANELA_AVISO = 45;

type Doc = {
  id: string;
  empresa_id: string;
  arquivo_nome: string;
  enviado_em: string;
  tipo: string | null;
  enviado_por_email: string | null;
};

export async function GET(req: Request) {
  return processar(req);
}
export async function POST(req: Request) {
  return processar(req);
}

async function processar(req: Request) {
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
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const admin = createAdminClient();
  const agora = Date.now();
  // expira quem foi enviado antes de (hoje − retenção + janela)
  const corteAviso = new Date(agora - (DIAS_RETENCAO - JANELA_AVISO) * 86400000).toISOString();
  const corteJaExpirado = new Date(agora - DIAS_RETENCAO * 86400000).toISOString();

  const { data, error } = await admin
    .from("documentos_recebidos")
    .select("id, empresa_id, arquivo_nome, enviado_em, tipo, enviado_por_email")
    .neq("status", "expurgado")
    .lte("enviado_em", corteAviso)
    .gt("enviado_em", corteJaExpirado)
    .is("avisado_expiracao_em", null)
    .order("enviado_em")
    .limit(20000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  /*
    O filtro do XML é o mesmo do expurgo, e feito no mesmo lugar: em JS.

    Estava como `.neq("tipo", "xml")` na consulta, e `tipo <> 'xml'` descarta o
    nulo junto — documento sem tipo era expurgado aos 365 dias e **nunca**
    avisado. Justamente a perda silenciosa que esta rotina existe para acabar, na
    população mais antiga. A regra do aviso tem de ser o complemento exato da
    regra do expurgo; escrever as duas de jeitos diferentes é como elas divergem.
  */
  const docs = ((data ?? []) as Doc[]).filter((d) => (d.tipo ?? "").toLowerCase() !== "xml");
  if (docs.length === 0) return NextResponse.json({ empresas: 0, documentos: 0 });

  // agrupa por empresa: um e-mail por cliente, não um por documento
  const porEmpresa = new Map<string, Doc[]>();
  for (const d of docs) {
    const lista = porEmpresa.get(d.empresa_id) ?? [];
    lista.push(d);
    porEmpresa.set(d.empresa_id, lista);
  }

  const ids = Array.from(porEmpresa.keys());
  /*
    O destinatário vem de `portal_usuarios`, não de `empresas`.

    `empresas` não tem coluna de e-mail — nenhum lugar do app lê ou grava uma —,
    então buscar `email` ali devolveria erro de coluna, e como o erro seria
    engolido pela desestruturação, o cron rodaria feliz mandando zero e-mails e
    devolvendo 200. Quem tem e-mail do cliente é o portal, que é também quem
    enviou os documentos e tem os originais para guardar.

    `ativo` importa: funcionário demitido em março não pode receber, em outubro,
    a lista com os nomes dos arquivos da empresa.
  */
  const [{ data: empresasRaw }, { data: usuariosRaw }] = await Promise.all([
    admin.from("empresas").select("id, nome").in("id", ids),
    admin.from("portal_usuarios").select("empresa_id, email, nome").eq("ativo", true).in("empresa_id", ids),
  ]);
  const empresas = new Map(
    ((empresasRaw ?? []) as { id: string; nome: string | null }[]).map((e) => [e.id, e]),
  );
  const contatos = new Map<string, { email: string; nome: string | null }>();
  for (const u of (usuariosRaw ?? []) as { empresa_id: string; email: string | null; nome: string | null }[]) {
    if (!u.email?.trim() || contatos.has(u.empresa_id)) continue;
    contatos.set(u.empresa_id, { email: u.email.trim(), nome: u.nome });
  }

  let enviados = 0;
  const avisados: string[] = [];
  const falhas: string[] = [];

  for (const [empresaId, lista] of Array.from(porEmpresa.entries())) {
    const emp = empresas.get(empresaId);
    const contato = contatos.get(empresaId);
    const para = contato?.email;
    if (!para) {
      falhas.push(empresaId);
      continue;
    }

    const linhas = lista
      .slice(0, 60)
      .map((d: Doc) => {
        const expira = new Date(new Date(d.enviado_em).getTime() + DIAS_RETENCAO * 86400000);
        const dia = expira.toISOString().slice(0, 10).split("-").reverse().join("/");
        return `<li style="margin:4px 0">${escapar(d.arquivo_nome)} <span style="color:#94A3B8">— sai em ${dia}</span></li>`;
      })
      .join("");
    const resto = lista.length > 60 ? `<p style="color:#94A3B8;font-size:12px">…e mais ${lista.length - 60}.</p>` : "";

    try {
      await enviarEmail({
        para,
        paraNome: contato?.nome ?? emp?.nome ?? undefined,
        // assinado com o nome da empresa, e não com o da plataforma: este e-mail
        // vai para o cliente final do escritório, que não precisa descobrir qual
        // software o contador dele usa — mesmo cuidado de `lembretes-boletos`
        remetenteNome: emp?.nome ?? undefined,
        assunto: `${lista.length} documento(s) saem do sistema nas próximas semanas`,
        html: layoutEmail({
          titulo: "Documentos prestes a expirar",
          corpoHtml: `
            <p>Estes documentos completam <b>12 meses</b> no sistema e serão apagados nas datas abaixo. Se você
            ainda não tem a sua cópia, baixe agora.</p>
            <ul style="padding-left:18px">${linhas}</ul>
            ${resto}
            <p style="font-size:12px;color:#64748B">Notas fiscais enviadas em <b>XML</b> não expiram — elas ficam
            guardadas por prazo indeterminado, porque o XML é o documento fiscal válido. O PDF (DANFE) é só a
            representação impressa dele.</p>
          `,
        }),
      });
      enviados++;
      /*
        Só marca como avisado quem foi nomeado no e-mail.

        A lista é cortada em 60 nomes; marcar os 300 faria os 240 restantes
        "já avisados" para sempre, sem nunca terem aparecido em lugar nenhum. Os
        que sobram entram na varredura do mês seguinte — a janela de 45 dias dá
        tempo para isso.
      */
      for (const d of lista.slice(0, 60)) avisados.push(d.id);
    } catch {
      // e-mail que não saiu não gasta o aviso: sem marcar, este documento entra
      // de novo na varredura do mês que vem
      falhas.push(empresaId);
    }
  }

  /*
    Em lotes de 500: o `.in()` do PostgREST vai na query string, ~37 bytes por
    UUID. Dez mil ids são 370 KB de URL e um 414 — e o retorno nem era conferido,
    então o update falharia calado e os mesmos documentos seriam reavisados no
    mês seguinte.
  */
  let marcados = 0;
  for (let i = 0; i < avisados.length; i += 500) {
    const lote = avisados.slice(i, i + 500);
    const { error: upErr } = await admin
      .from("documentos_recebidos")
      .update({ avisado_expiracao_em: new Date().toISOString() })
      .in("id", lote);
    if (!upErr) marcados += lote.length;
  }

  return NextResponse.json({
    empresas: porEmpresa.size,
    emails_enviados: enviados,
    documentos_avisados: marcados,
    sem_destinatario_ou_falha: falhas.length,
  });
}

function escapar(s: string): string {
  return s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c] ?? c);
}

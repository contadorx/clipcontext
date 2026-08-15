import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "documentos-entrada";

/**
 * Retenção: 12 meses, contados do envio.
 *
 * Era 45 dias do envio **ou** 15 dias depois de o contador baixar, o que viesse
 * primeiro — e na prática mandava o segundo: documento baixado em dois dias saía
 * em ~17. A vida útil média não subiu de 45 para 365; subiu de ~17 para 365,
 * mais de vinte vezes. É esse o número que dimensiona o Storage em regime, e é
 * bom que ele esteja escrito aqui em vez de ser redescoberto na fatura.
 *
 * Aquilo foi desenhado quando uma foto de nota ocupava 2 a 4 MB. Com a
 * compressão no navegador ela passou a ocupar ~200 KB, e os 100 GB gratuitos do
 * plano viraram cerca de meio milhão de documentos — o expurgo agressivo deixou
 * de comprar economia relevante e continuava cobrando caro: o contador que
 * precisa da nota de março para responder a uma fiscalização em outubro não a
 * tinha, e a linha ficava na tela dizendo que existiu.
 *
 * Doze meses cobrem o exercício, que é o horizonte em que fechamento e
 * fiscalização acontecem.
 *
 * O gatilho da baixa não foi substituído por outro: hoje **nada** sai antes dos
 * 12 meses, nem extrato bancário, nem documento anexado por engano — e o app não
 * tem botão de apagar. Fica registrado como o custo conhecido desta decisão.
 */
const DIAS_RETENCAO = 365;

/**
 * XML nunca é expurgado.
 *
 * Para NF-e e NFC-e, o XML **é** o documento fiscal; o PDF (DANFE) é
 * representação impressa dele. Apagar o XML e guardar o PDF é jogar fora o
 * original e ficar com a fotocópia. E o custo é irrisório: um XML tem 3 a 8 KB
 * contra os ~200 KB de uma foto — vinte a cinquenta vezes menos. Um cliente com
 * 200 notas por mês gera cerca de 12 MB de XML por ano.
 */
const TIPOS_PERMANENTES = new Set(["xml"]);

export async function GET(req: Request) {
  return processar(req);
}
export async function POST(req: Request) {
  return processar(req);
}

async function processar(req: Request) {
  // A Vercel envia Authorization: Bearer <CRON_SECRET>.
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
  const corte = new Date(Date.now() - DIAS_RETENCAO * 86400000).toISOString();

  const { data, error } = await admin
    .from("documentos_recebidos")
    .select("id, arquivo_path, tipo")
    .neq("status", "expurgado")
    .lte("enviado_em", corte)
    /*
      `or` em vez de `neq` puro: `tipo <> 'xml'` descarta a linha de tipo nulo
      junto, e documento sem tipo nunca seria expurgado — arquivo eterno,
      invisível para a única rotina que deveria limpá-lo. E o corte precisa ser
      no banco, não em JS: os XML satisfazem "não expurgado e com mais de 365
      dias" todo dia, para sempre, e seriam baixados diariamente só para serem
      descartados. Em cinco anos isso é o acervo inteiro, toda madrugada.
    */
    .or("tipo.is.null,tipo.neq.xml")
    .order("enviado_em")
    .limit(5000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const todos = (data ?? []) as { id: string; arquivo_path: string; tipo: string | null }[];
  /*
    O filtro do XML é feito aqui, e não na consulta, de propósito: `tipo` pode
    ser nulo em linhas antigas, e um `neq("tipo", "xml")` no PostgREST descarta
    o nulo junto — documento sem tipo nunca entraria nesta varredura e o arquivo
    ficaria para sempre, invisível para a rotina que deveria limpá-lo.
  */
  const docs = todos.filter((d) => !TIPOS_PERMANENTES.has((d.tipo ?? "").toLowerCase()));
  if (docs.length === 0) {
    return NextResponse.json({ expurgados: 0, preservados_xml: todos.length });
  }

  const paths = docs.map((d) => d.arquivo_path).filter(Boolean);
  if (paths.length > 0) {
    const { error: rmErr } = await admin.storage.from(BUCKET).remove(paths);
    /*
      Se o Storage recusar, a linha NÃO é marcada como expurgada.

      Marcar assim mesmo esconderia o documento da tela — o app trata
      "expurgado" como "não dá para abrir" — enquanto o arquivo continuaria
      ocupando espaço e sendo cobrado. O pior dos dois mundos: some da vista e
      continua na fatura. Melhor deixar para a execução de amanhã.
    */
    if (rmErr) return NextResponse.json({ error: rmErr.message, expurgados: 0 }, { status: 500 });
  }

  const ids = docs.map((d) => d.id);
  const { error: upErr } = await admin
    .from("documentos_recebidos")
    .update({ status: "expurgado", expurgado_em: new Date().toISOString() })
    .in("id", ids);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  return NextResponse.json({
    expurgados: ids.length,
    preservados_xml: todos.length - ids.length,
    retencao_dias: DIAS_RETENCAO,
  });
}

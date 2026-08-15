import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { anthropic } from "@/lib/anthropic";
import { enviarEmail, layoutEmail } from "@/lib/brevo";
import { brl } from "@/lib/formato";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Lanc = { tipo: "entrada" | "saida"; valor: number; categoria: { nome: string } | null };
type Resu = { entradas: number; saidas: number; saldo: number; topSaidas: [string, number][] };

function fimMes(comp: string): string {
  const [a, m] = comp.split("-").map(Number);
  return new Date(a, m, 0).toISOString().slice(0, 10);
}
function mesAnterior(comp: string): string {
  const [a, m] = comp.split("-").map(Number);
  const d = new Date(a, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
const MESES_PT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
function competenciaLabel(comp: string): string {
  const [a, m] = comp.split("-");
  const i = parseInt(m, 10) - 1;
  return MESES_PT[i] ? `${MESES_PT[i]} de ${a}` : comp;
}

async function resumo(supabase: ReturnType<typeof createClient>, empresaId: string, comp: string): Promise<Resu> {
  const ini = `${comp}-01`;
  const fim = fimMes(comp);
  const { data } = await supabase
    .from("lancamentos")
    .select("tipo, valor, categoria:categorias(nome)")
    .eq("empresa_id", empresaId)
    .not("transferencia", "is", true)
    .gte("data_competencia", ini)
    .lte("data_competencia", fim);
  const rows = ((data as unknown) as Lanc[]) ?? [];
  let entradas = 0;
  let saidas = 0;
  const porCat: Record<string, number> = {};
  for (const r of rows) {
    const v = Number(r.valor);
    if (r.tipo === "entrada") entradas += v;
    else {
      saidas += v;
      const nome = r.categoria?.nome || "Sem categoria";
      porCat[nome] = (porCat[nome] || 0) + v;
    }
  }
  const topSaidas = Object.entries(porCat)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5) as [string, number][];
  return { entradas, saidas, saldo: entradas - saidas, topSaidas };
}

function montarIndicadores(atual: Resu, ant: Resu) {
  return {
    entradas: atual.entradas,
    saidas: atual.saidas,
    saldo: atual.saldo,
    antEntradas: ant.entradas,
    antSaidas: ant.saidas,
    antSaldo: ant.saldo,
    topSaidas: atual.topSaidas,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const empresaId = searchParams.get("empresaId") || "";
  const competencia = searchParams.get("competencia") || "";
  const supabase = createClient();

  const { data } = await supabase
    .from("analises_ia")
    .select("resumo, analise, conteudo, indicadores, publicada, publicado_em, criado_em")
    .eq("empresa_id", empresaId)
    .eq("competencia", competencia)
    .maybeSingle();

  let creditos = 0;
  const { data: emp } = await supabase.from("empresas").select("escritorio_id").eq("id", empresaId).maybeSingle();
  if (emp?.escritorio_id) {
    const { data: esc } = await supabase
      .from("escritorios")
      .select("creditos_ia")
      .eq("id", emp.escritorio_id)
      .maybeSingle();
    creditos = esc?.creditos_ia ?? 0;
  }

  let indicadoresAovivo = null;
  if (empresaId && /^\d{4}-\d{2}$/.test(competencia)) {
    const atual = await resumo(supabase, empresaId, competencia);
    const ant = await resumo(supabase, empresaId, mesAnterior(competencia));
    indicadoresAovivo = montarIndicadores(atual, ant);
  }

  return NextResponse.json({ ok: true, analise: data ?? null, indicadoresAovivo, creditos });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      empresaId?: string;
      competencia?: string;
      action?: string;
      resumo?: string;
      analise?: string;
    };
    const empresaId = body.empresaId || "";
    const competencia = body.competencia || "";
    const action = body.action || "gerar";
    if (!/^\d{4}-\d{2}$/.test(competencia)) {
      return NextResponse.json({ erro: "Competência inválida (use AAAA-MM)." }, { status: 400 });
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

    const { data: emp } = await supabase.from("empresas").select("escritorio_id").eq("id", empresaId).maybeSingle();
    const escId = emp?.escritorio_id as string | undefined;
    if (!escId) return NextResponse.json({ erro: "Empresa não encontrada." }, { status: 404 });

    // --- Salvar rascunho (edição do operador, sem IA, sem crédito) ---
    if (action === "salvar") {
      const resumoTxt = body.resumo ?? "";
      const analiseTxt = body.analise ?? "";
      const conteudo = [resumoTxt.trim(), analiseTxt.trim()].filter(Boolean).join("\n\n");
      const { error } = await supabase
        .from("analises_ia")
        .upsert(
          { empresa_id: empresaId, competencia, resumo: resumoTxt, analise: analiseTxt, conteudo },
          { onConflict: "empresa_id,competencia" },
        );
      if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    // --- Despublicar ---
    if (action === "despublicar") {
      // "despublicada" com a análise ainda visível no portal do cliente é o
      // pior desfecho possível aqui: o contador tira do ar o que não saiu do ar
      const desp = await supabase
        .from("analises_ia")
        .update({ publicada: false })
        .eq("empresa_id", empresaId)
        .eq("competencia", competencia);
      if (desp.error) return NextResponse.json({ erro: desp.error.message }, { status: 500 });
      return NextResponse.json({ ok: true, publicada: false });
    }

    // --- Publicar: trava o snapshot de indicadores e consolida o texto p/ o portal ---
    if (action === "publicar") {
      const atual = await resumo(supabase, empresaId, competencia);
      const ant = await resumo(supabase, empresaId, mesAnterior(competencia));
      const indicadores = montarIndicadores(atual, ant);
      const resumoTxt = (body.resumo ?? "").trim();
      const analiseTxt = (body.analise ?? "").trim();
      const conteudo = [resumoTxt, analiseTxt].filter(Boolean).join("\n\n");
      const { error } = await supabase.from("analises_ia").upsert(
        {
          empresa_id: empresaId,
          competencia,
          resumo: resumoTxt,
          analise: analiseTxt,
          conteudo,
          indicadores,
          publicada: true,
          publicado_em: new Date().toISOString(),
        },
        { onConflict: "empresa_id,competencia" },
      );
      if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

      // Notifica os clientes do portal que o relatório foi publicado (best-effort:
      // falha de e-mail não desfaz a publicação). Respeita o liga/desliga da empresa.
      try {
        const { data: emp } = await supabase
          .from("empresas")
          .select("nome, avisar_relatorio")
          .eq("id", empresaId)
          .maybeSingle();
        if (emp && emp.avisar_relatorio !== false) {
          const [{ data: link }, { data: usuarios }] = await Promise.all([
            supabase.from("portal_links").select("token").eq("empresa_id", empresaId).eq("ativo", true).maybeSingle(),
            supabase.from("portal_usuarios").select("email, nome").eq("empresa_id", empresaId).eq("ativo", true),
          ]);
          if (link?.token && usuarios && usuarios.length > 0) {
            const url = `${new URL(req.url).origin}/portal/${link.token}`;
            const nomeEmp = (emp.nome ?? "sua empresa").toString().trim();
            const rotulo = competenciaLabel(competencia);
            const html = layoutEmail({
              titulo: `Relatório de ${rotulo} disponível`,
              corpoHtml: `O relatório financeiro de <b>${nomeEmp}</b> referente a ${rotulo} já está no seu portal — com o resumo do mês, os indicadores e a análise.`,
              botao: { texto: "Ver meu relatório", url },
            });
            await Promise.allSettled(
              usuarios.map((u) =>
                enviarEmail({
                  para: String((u as { email: string }).email),
                  paraNome: (u as { nome?: string }).nome || undefined,
                  assunto: `Relatório de ${rotulo} — ${nomeEmp}`,
                  html,
                }),
              ),
            );
          }
        }
      } catch (e) {
        console.error("notificar relatório (publicação) falhou:", e);
      }

      return NextResponse.json({ ok: true, publicada: true });
    }

    // --- Gerar com IA (rascunho dos blocos resumo/análise) ---
    // Toda geração consome 1 crédito (inclui regerar). O débito é atômico e acontece
    // ANTES de chamar a Anthropic; se a geração falhar, o crédito é estornado.
    const TETO_IA_DIA = 50;

    // calcula os números primeiro — sem movimento, não cobra
    const atual = await resumo(supabase, empresaId, competencia);
    const ant = await resumo(supabase, empresaId, mesAnterior(competencia));
    if (atual.entradas === 0 && atual.saidas === 0) {
      return NextResponse.json({ erro: "Sem lançamentos neste mês para analisar." }, { status: 400 });
    }

    // reserva o crédito de forma atômica: checa o teto diário e debita se houver saldo
    const { data: reserva, error: resErr } = await supabase.rpc("reservar_credito_ia", {
      p_escritorio: escId,
      p_empresa: empresaId,
      p_competencia: competencia,
      p_teto_dia: TETO_IA_DIA,
    });
    if (resErr) return NextResponse.json({ erro: resErr.message }, { status: 500 });
    const r = (reserva ?? {}) as { ok?: boolean; motivo?: string; saldo?: number; uso_id?: string };
    if (!r.ok) {
      if (r.motivo === "teto") {
        return NextResponse.json(
          { erro: `Limite diário de ${TETO_IA_DIA} análises por IA atingido. Tente novamente amanhã.`, tetoDia: true },
          { status: 429 },
        );
      }
      return NextResponse.json({ erro: "Você está sem créditos de análise por IA.", semCreditos: true }, { status: 402 });
    }

    const dados = [
      `Competência: ${competencia}`,
      `Entradas: ${brl(atual.entradas)}`,
      `Saídas: ${brl(atual.saidas)}`,
      `Saldo (entradas - saídas): ${brl(atual.saldo)}`,
      `Mês anterior — Entradas: ${brl(ant.entradas)}, Saídas: ${brl(ant.saidas)}, Saldo: ${brl(ant.saldo)}`,
      `Maiores saídas por categoria: ${atual.topSaidas.map(([n, v]) => `${n} (${brl(v)})`).join("; ") || "—"}`,
    ].join("\n");

    const system =
      "Você é um analista financeiro do FinanceiroX ajudando um contador de BPO a comentar o mês de um cliente. " +
      "Escreva em português do Brasil, claro e direto, sem jargão contábil pesado. " +
      'Responda APENAS um objeto JSON válido, sem markdown e sem nenhum texto fora dele, no formato {"resumo": "...", "analise": "..."}. ' +
      "'resumo' = 1 parágrafo curto (2 a 3 frases) com o destaque do mês. " +
      "'analise' = 2 a 4 parágrafos curtos: leitura do resultado, comparação com o mês anterior, maiores despesas e 1 a 3 recomendações práticas. " +
      "Não invente dados além dos fornecidos.";

    let raw: string;
    try {
      raw = await anthropic(
        [{ role: "user", content: `Gere a análise para os números abaixo:\n\n${dados}` }],
        system,
        1200,
      );
    } catch (e) {
      /*
        A IA não entregou: estorna o crédito reservado.

        `.rpc()` também devolve `{ data, error }` e não lança. Sem ler o erro, o
        crédito fica reservado para sempre — o cliente pagou por uma análise que
        não recebeu e o saldo caiu do mesmo jeito. Não há conserto pela
        interface, só SQL; então no mínimo isso vai para o log com o `uso_id`,
        e a mensagem não finge que ficou tudo certo.
      */
      const est = await supabase.rpc("estornar_credito_ia", { p_escritorio: escId, p_uso_id: r.uso_id });
      const msg = e instanceof Error ? e.message : "Falha ao gerar a análise.";
      /*
        Duas conferências para a mesma pergunta, de propósito.

        `estornar_credito_ia` levanta exceção quando não consegue estornar, e
        isso chega aqui como `est.error`. Mas depender só disso deixa o app
        refém da função: a primeira versão dela devolvia `{ok:false}` em
        silêncio, e um estorno que nunca aconteceu passava por bem-sucedido —
        crédito pago que o cliente não recebe de volta, sem rastro. Ler também o
        `ok` custa uma linha e sobrevive a quem reescrever o SQL amanhã.
      */
      const estornou = !est.error && (est.data as { ok?: boolean } | null)?.ok === true;
      if (!estornou) {
        console.error("analise-mes: estorno de crédito falhou", {
          escId,
          usoId: r.uso_id,
          erro: est.error?.message ?? `resposta inesperada: ${JSON.stringify(est.data)}`,
        });
        return NextResponse.json(
          { erro: `${msg} O crédito não foi estornado automaticamente — fale com o suporte.` },
          { status: 502 },
        );
      }
      return NextResponse.json({ erro: msg }, { status: 502 });
    }

    let resumoTxt = "";
    let analiseTxt = "";
    try {
      const j = JSON.parse(raw.replace(/```json|```/g, "").trim());
      resumoTxt = String(j.resumo ?? "");
      analiseTxt = String(j.analise ?? "");
    } catch {
      analiseTxt = raw;
    }

    const conteudo = [resumoTxt.trim(), analiseTxt.trim()].filter(Boolean).join("\n\n");
    const { error: upErr } = await supabase
      .from("analises_ia")
      .upsert(
        { empresa_id: empresaId, competencia, resumo: resumoTxt, analise: analiseTxt, conteudo },
        { onConflict: "empresa_id,competencia" },
      );
    if (upErr) return NextResponse.json({ erro: upErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, resumo: resumoTxt, analise: analiseTxt, creditos: r.saldo ?? 0 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao gerar a análise.";
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}

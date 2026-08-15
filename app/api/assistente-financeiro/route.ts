import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { anthropic } from "@/lib/anthropic";
import { brl } from "@/lib/formato";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Lanc = { tipo: "entrada" | "saida"; valor: number; categoria: { nome: string } | null };
type Resu = { entradas: number; saidas: number; saldo: number; topSaidas: [string, number][] };
type Turno = { role: "user" | "assistant"; content: string };

const TETO_IA_DIA = 50;
const MESES_PT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function fimMes(comp: string): string {
  const [a, m] = comp.split("-").map(Number);
  return new Date(a, m, 0).toISOString().slice(0, 10);
}
function mesAnterior(comp: string): string {
  const [a, m] = comp.split("-").map(Number);
  const d = new Date(a, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
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
    .slice(0, 8) as [string, number][];
  return { entradas, saidas, saldo: entradas - saidas, topSaidas };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      empresaId?: string;
      competencia?: string;
      pergunta?: string;
      historico?: Turno[];
    };
    const empresaId = body.empresaId || "";
    const competencia = body.competencia || "";
    const pergunta = (body.pergunta || "").trim();
    if (!empresaId) return NextResponse.json({ erro: "Empresa não informada." }, { status: 400 });
    if (!/^\d{4}-\d{2}$/.test(competencia)) return NextResponse.json({ erro: "Competência inválida." }, { status: 400 });
    if (!pergunta) return NextResponse.json({ erro: "Pergunta vazia." }, { status: 400 });

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

    // RLS garante que o contador só lê empresas do próprio escritório
    const { data: emp } = await supabase.from("empresas").select("escritorio_id, nome").eq("id", empresaId).maybeSingle();
    const escId = emp?.escritorio_id as string | undefined;
    if (!escId) return NextResponse.json({ erro: "Empresa não encontrada." }, { status: 404 });

    // contexto financeiro (mesma base da análise mensal)
    const atual = await resumo(supabase, empresaId, competencia);
    const ant = await resumo(supabase, empresaId, mesAnterior(competencia));

    // sem movimento: responde sem cobrar crédito
    if (atual.entradas === 0 && atual.saidas === 0) {
      return NextResponse.json({
        ok: true,
        resposta: `Não encontrei lançamentos de ${competenciaLabel(competencia)} para essa empresa. Lance o movimento do mês (ou confira a competência selecionada) e eu consigo analisar.`,
        semDados: true,
      });
    }

    // reserva 1 crédito de forma atômica (teto diário + saldo); estorna se a IA falhar
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
          { erro: `Limite diário de ${TETO_IA_DIA} usos de IA atingido. Tente novamente amanhã.`, tetoDia: true },
          { status: 429 },
        );
      }
      return NextResponse.json({ erro: "Você está sem créditos de análise por IA.", semCreditos: true }, { status: 402 });
    }

    const contexto = [
      `Empresa: ${emp?.nome ?? "(sem nome)"}`,
      `Competência analisada: ${competenciaLabel(competencia)}`,
      `Entradas: ${brl(atual.entradas)}`,
      `Saídas: ${brl(atual.saidas)}`,
      `Saldo do mês (entradas - saídas): ${brl(atual.saldo)}`,
      `Mês anterior — Entradas: ${brl(ant.entradas)}, Saídas: ${brl(ant.saidas)}, Saldo: ${brl(ant.saldo)}`,
      `Maiores saídas por categoria (mês atual): ${atual.topSaidas.map(([n, v]) => `${n} (${brl(v)})`).join("; ") || "—"}`,
    ].join("\n");

    const system =
      "Você é um analista financeiro do FinanceiroX, ajudando um contador de BPO a entender os números de um cliente. " +
      "Responda em português do Brasil, claro e direto, sem jargão contábil pesado, em 1 a 3 parágrafos curtos. " +
      "Baseie-se SOMENTE nos dados abaixo. Se a pergunta pedir algo que não está nos dados, diga com honestidade que não tem esse dado aqui e sugira onde o contador pode olhar no sistema (relatórios, fluxo de caixa, conciliação). " +
      "Nunca invente números.\n\nDADOS DO PERÍODO:\n" +
      contexto;

    const historico = (body.historico || []).slice(-6);
    const messages: Turno[] = [...historico, { role: "user", content: pergunta }];

    let resposta: string;
    try {
      resposta = await anthropic(messages, system, 800);
    } catch (e) {
      // mesmo caso da análise do mês: `.rpc()` não lança, e um estorno perdido
      // é crédito pago que o cliente nunca mais vê
      const est = await supabase.rpc("estornar_credito_ia", { p_escritorio: escId, p_uso_id: r.uso_id });
      const msg = e instanceof Error ? e.message : "Falha ao consultar a IA.";
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
        console.error("assistente: estorno de crédito falhou", {
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

    return NextResponse.json({ ok: true, resposta, creditos: r.saldo ?? 0 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro no assistente.";
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}

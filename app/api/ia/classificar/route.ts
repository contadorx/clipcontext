import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { anthropic } from "@/lib/anthropic";
import { assinaturaRegra, normNome } from "@/lib/conciliacao/regras";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Classificação de transações em lote (Haiku, ~R$ 0,001/transação).
// Fluxo: cache (ia_sugestoes) primeiro; só o que nunca foi visto vai à IA.
// O aceite no front vira conciliacao_regras — a IA ensina e sai do caminho.
// Decisão de produto: NÃO consome créditos neste MVP (modelo alvo é uplift
// por empresa; o custo marginal é desprezível). Guard: máx. 60 itens/chamada.

const MODELO = "claude-haiku-4-5";
const MAX_ITENS = 60;
// No período de teste, a categorização por IA é limitada a este número de chamadas.
// Pagantes não têm limite. Ajuste à vontade (o custo por chamada é desprezível —
// o objetivo é evitar abuso no trial, não cobrar por isso).
const LIMITE_IA_TRIAL = 100;

type ItemReq = { id: string; descricao: string | null; tipo: "entrada" | "saida" };
type Sugestao = {
  id: string;
  categoria_id: string | null;
  cliente_fornecedor_id: string | null;
  confianca: number;
  origem: "cache" | "ia";
};

export async function POST(req: Request) {
  try {
    const { empresaId, itens } = (await req.json().catch(() => ({}))) as { empresaId?: string; itens?: ItemReq[] };
    if (!empresaId || !Array.isArray(itens) || itens.length === 0) {
      return NextResponse.json({ error: "Parâmetros incompletos." }, { status: 400 });
    }
    if (itens.length > MAX_ITENS) {
      return NextResponse.json({ error: `Máximo de ${MAX_ITENS} transações por chamada.` }, { status: 400 });
    }

    const supabase = createClient(); // RLS do usuário protege o acesso à empresa
    const [{ data: cats }, { data: pess }] = await Promise.all([
      supabase.from("categorias").select("id, nome, tipo").eq("empresa_id", empresaId),
      supabase.from("clientes_fornecedores").select("id, nome").eq("empresa_id", empresaId).limit(300),
    ]);
    const categorias = (cats ?? []) as { id: string; nome: string; tipo: string }[];
    const pessoas = (pess ?? []) as { id: string; nome: string }[];
    if (categorias.length === 0) {
      return NextResponse.json({ error: "Empresa sem categorias (ou sem acesso)." }, { status: 403 });
    }

    // mapas de resolução nome → id
    const catPorNome = new Map<string, { id: string; tipo: string }[]>();
    for (const c of categorias) {
      const k = normNome(c.nome);
      catPorNome.set(k, [...(catPorNome.get(k) ?? []), { id: c.id, tipo: c.tipo }]);
    }
    const pessoaPorNome = new Map<string, string>();
    for (const p of pessoas) pessoaPorNome.set(normNome(p.nome), p.id);
    const resolverCategoria = (nome: string, tipo: string): string | null => {
      const tCat = tipo === "entrada" ? "receber" : "pagar";
      const cands = catPorNome.get(normNome(nome)) ?? [];
      return (cands.find((c) => c.tipo === tCat) ?? cands[0])?.id ?? null;
    };

    // ---- trial: a categorização por IA é limitada no período de teste ----
    let escTrial: { id: string; uso: number } | null = null;
    let bloquearIaTrial = false;
    try {
      const { data: emp } = await supabase.from("empresas").select("escritorio_id").eq("id", empresaId).maybeSingle();
      const escritorioId = (emp?.escritorio_id as string | undefined) ?? null;
      if (escritorioId) {
        const admin = createAdminClient();
        const { data: esc } = await admin
          .from("escritorios")
          .select("assinatura_status, ia_uso_trial")
          .eq("id", escritorioId)
          .maybeSingle();
        if (esc && esc.assinatura_status === "trial") {
          const uso = Number(esc.ia_uso_trial ?? 0);
          escTrial = { id: escritorioId, uso };
          if (uso >= LIMITE_IA_TRIAL) bloquearIaTrial = true;
        }
      }
    } catch {
      /* best-effort: erro no guard não bloqueia a categorização */
    }

    // ---- 1) cache ----
    const porAssinatura = new Map<string, ItemReq[]>();
    for (const it of itens) {
      const ass = assinaturaRegra(it.descricao);
      if (!ass) continue;
      const k = `${ass}\u0000${it.tipo}`;
      porAssinatura.set(k, [...(porAssinatura.get(k) ?? []), it]);
    }
    const assinaturas = Array.from(new Set(Array.from(porAssinatura.keys()).map((k) => k.split("\u0000")[0])));
    const { data: cacheRows } = await supabase
      .from("ia_sugestoes")
      .select("assinatura, tipo, categoria_id, cliente_fornecedor_id, confianca")
      .eq("empresa_id", empresaId)
      .in("assinatura", assinaturas);

    const out: Sugestao[] = [];
    const pendentes: { item: ItemReq; assinatura: string }[] = [];
    const cacheMap = new Map<string, { categoria_id: string | null; cliente_fornecedor_id: string | null; confianca: number }>();
    for (const r of cacheRows ?? []) cacheMap.set(`${r.assinatura}\u0000${r.tipo}`, r);

    for (const [k, lista] of Array.from(porAssinatura.entries())) {
      const hit = cacheMap.get(k);
      if (hit && hit.categoria_id) {
        for (const it of lista)
          out.push({
            id: it.id,
            categoria_id: hit.categoria_id,
            cliente_fornecedor_id: hit.cliente_fornecedor_id,
            confianca: Number(hit.confianca),
            origem: "cache",
          });
      } else {
        // só o primeiro de cada assinatura vai à IA; o resultado vale para os irmãos
        pendentes.push({ item: lista[0], assinatura: k.split("\u0000")[0] });
      }
    }

    // ---- 2) IA para o que nunca foi visto ----
    if (pendentes.length > 0) {
      if (bloquearIaTrial) {
        return NextResponse.json(
          {
            error: `Limite de IA do período de teste atingido (${LIMITE_IA_TRIAL} usos). Assine para liberar a categorização por IA sem limite.`,
            sugestoes: out,
            limiteTrial: true,
          },
          { status: 429 },
        );
      }
      const nomesCategorias = {
        entrada: categorias.filter((c) => c.tipo === "receber").map((c) => c.nome),
        saida: categorias.filter((c) => c.tipo === "pagar").map((c) => c.nome),
      };
      const nomesPessoas = pessoas.map((p) => p.nome);

      const system = [
        "Você classifica transações bancárias de empresas brasileiras.",
        "Responda APENAS um array JSON, sem markdown e sem texto extra, no formato:",
        '[{"i": <índice>, "categoria": "<nome exato da lista>", "pessoa": "<nome exato da lista ou null>", "confianca": <0 a 1>}]',
        "Regras: use SOMENTE nomes que estão nas listas fornecidas (cópia exata);",
        'se nenhuma categoria servir bem, use confianca abaixo de 0.4;',
        "pessoa é o cliente/fornecedor provável — null se não tiver certeza;",
        "ignore números de protocolo e datas na descrição.",
      ].join(" ");

      const userMsg = [
        `Categorias de ENTRADA: ${JSON.stringify(nomesCategorias.entrada)}`,
        `Categorias de SAÍDA: ${JSON.stringify(nomesCategorias.saida)}`,
        `Clientes/fornecedores: ${JSON.stringify(nomesPessoas)}`,
        "Transações:",
        ...pendentes.map((p, i) => `${i}. [${p.item.tipo.toUpperCase()}] ${p.item.descricao ?? ""}`),
      ].join("\n");

      let bruto = "";
      try {
        bruto = await anthropic([{ role: "user", content: userMsg }], system, 120 + pendentes.length * 60, MODELO);
      } catch (e) {
        return NextResponse.json(
          { error: `IA indisponível: ${e instanceof Error ? e.message.slice(0, 140) : "erro"}`, sugestoes: out },
          { status: 502 },
        );
      }

      // contabiliza 1 uso de IA no trial (pagantes não entram aqui)
      if (escTrial) {
        try {
          const admin = createAdminClient();
          await admin.from("escritorios").update({ ia_uso_trial: escTrial.uso + 1 }).eq("id", escTrial.id);
        } catch {
          /* best-effort */
        }
      }

      let parsed: { i: number; categoria?: string; pessoa?: string | null; confianca?: number }[] = [];
      try {
        parsed = JSON.parse(bruto.replace(/```json|```/g, "").trim());
        if (!Array.isArray(parsed)) parsed = [];
      } catch {
        parsed = [];
      }

      const upserts: Record<string, unknown>[] = [];
      for (const r of parsed) {
        const pend = pendentes[r.i];
        if (!pend || !r.categoria) continue;
        const categoriaId = resolverCategoria(r.categoria, pend.item.tipo);
        if (!categoriaId) continue; // a IA inventou um nome fora da lista — descarta
        const pessoaId = r.pessoa ? (pessoaPorNome.get(normNome(r.pessoa)) ?? null) : null;
        const confianca = Math.max(0, Math.min(1, Number(r.confianca ?? 0)));
        if (confianca < 0.4) continue; // baixa confiança não vira sugestão
        upserts.push({
          empresa_id: empresaId,
          assinatura: pend.assinatura,
          tipo: pend.item.tipo,
          categoria_id: categoriaId,
          cliente_fornecedor_id: pessoaId,
          confianca,
          modelo: MODELO,
        });
        // aplica a todos os itens da mesma assinatura
        const irmaos = porAssinatura.get(`${pend.assinatura}\u0000${pend.item.tipo}`) ?? [];
        for (const it of irmaos)
          out.push({ id: it.id, categoria_id: categoriaId, cliente_fornecedor_id: pessoaId, confianca, origem: "ia" });
      }
      if (upserts.length > 0) {
        await supabase.from("ia_sugestoes").upsert(upserts, { onConflict: "empresa_id,assinatura,tipo" });
      }
    }

    return NextResponse.json({ sugestoes: out });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro inesperado." }, { status: 500 });
  }
}

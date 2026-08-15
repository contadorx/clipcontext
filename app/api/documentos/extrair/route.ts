import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { anthropic, type ContentBlock } from "@/lib/anthropic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BUCKET = "documentos-entrada";
const MODELO = "claude-haiku-4-5";
// No período de teste, a leitura por IA é limitada a este número de usos.
// Pagantes não têm limite. Mesmo padrão da categorização por IA.
const LIMITE_IA_TRIAL = 100;
const IMG: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" };

// Lê um documento (boleto/nota/fatura) já no Storage e devolve os campos do
// lançamento. Não grava nada nem ocupa storage extra — só lê o arquivo que já existe.
export async function POST(req: Request) {
  const { documentoId } = (await req.json().catch(() => ({}))) as { documentoId?: string };
  if (!documentoId) return NextResponse.json({ error: "Documento não informado." }, { status: 400 });

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Configuração do servidor incompleta." }, { status: 500 });
  }

  const { data: doc } = await admin
    .from("documentos_recebidos")
    .select("arquivo_path, arquivo_nome, tipo, empresa_id")
    .eq("id", documentoId)
    .maybeSingle();
  if (!doc) return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });

  // acesso: precisa ser membro da empresa do documento
  const { data: acesso } = await supabase
    .from("empresas")
    .select("id, escritorio_id, membros:membros!inner(user_id)")
    .eq("id", doc.empresa_id)
    .eq("membros.user_id", user.id)
    .maybeSingle();
  if (!acesso) return NextResponse.json({ error: "Sem acesso a este documento." }, { status: 403 });

  // trial: a leitura por IA é limitada no período de teste (pagantes sem limite)
  const escritorioId = (acesso as { escritorio_id?: string }).escritorio_id ?? null;
  let escTrial: { id: string; uso: number } | null = null;
  if (escritorioId) {
    try {
      const { data: esc } = await admin
        .from("escritorios")
        .select("assinatura_status, ia_uso_trial")
        .eq("id", escritorioId)
        .maybeSingle();
      if (esc && esc.assinatura_status === "trial") {
        const uso = Number(esc.ia_uso_trial ?? 0);
        if (uso >= LIMITE_IA_TRIAL) {
          return NextResponse.json(
            {
              error: `Limite de leitura por IA do período de teste atingido (${LIMITE_IA_TRIAL} usos). Assine para liberar sem limite.`,
              limiteTrial: true,
            },
            { status: 429 },
          );
        }
        escTrial = { id: escritorioId, uso };
      }
    } catch {
      /* best-effort: erro no guard não bloqueia a leitura */
    }
  }

  const ext = (doc.tipo || doc.arquivo_nome.split(".").pop() || "").toLowerCase();
  const isPdf = ext === "pdf";
  if (!isPdf && !IMG[ext]) {
    return NextResponse.json({ error: "A leitura por IA funciona só para PDF e imagens (JPG, PNG)." }, { status: 400 });
  }

  const dl = await admin.storage.from(BUCKET).download(doc.arquivo_path);
  if (dl.error || !dl.data) return NextResponse.json({ error: "Não foi possível ler o arquivo." }, { status: 500 });
  const b64 = Buffer.from(await dl.data.arrayBuffer()).toString("base64");

  const bloco: ContentBlock = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } }
    : { type: "image", source: { type: "base64", media_type: IMG[ext], data: b64 } };

  const system =
    "Você extrai dados de um documento financeiro brasileiro (boleto, nota fiscal, fatura ou comprovante). " +
    "Responda APENAS um JSON válido, sem nenhum texto fora dele, no formato exato: " +
    '{"valor": number|null, "vencimento": "YYYY-MM-DD"|null, "descricao": string|null, "fornecedor": string|null}. ' +
    "valor = valor total a pagar/receber em reais, com ponto decimal (ex.: 1234.56). " +
    "vencimento = data de vencimento. descricao = descrição curta do que é (ex.: 'Energia elétrica junho'). " +
    "fornecedor = nome do emissor/beneficiário. Campo não identificado com clareza = null.";

  let bruto: string;
  try {
    bruto = await anthropic(
      [{ role: "user", content: [bloco, { type: "text", text: "Extraia os dados deste documento." }] }],
      system,
      400,
      MODELO,
    );
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha na leitura por IA." }, { status: 500 });
  }

  // contabiliza 1 uso de IA no trial (pagantes não entram aqui)
  if (escTrial) {
    try {
      await admin.from("escritorios").update({ ia_uso_trial: escTrial.uso + 1 }).eq("id", escTrial.id);
    } catch {
      /* best-effort */
    }
  }

  try {
    const m = bruto.match(/\{[\s\S]*\}/);
    const dados = JSON.parse(m ? m[0] : bruto) as {
      valor: number | null;
      vencimento: string | null;
      descricao: string | null;
      fornecedor: string | null;
    };
    return NextResponse.json({ ok: true, ...dados });
  } catch {
    return NextResponse.json({ error: "A IA não retornou dados legíveis." }, { status: 502 });
  }
}

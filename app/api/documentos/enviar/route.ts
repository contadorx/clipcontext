import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { camposDocumento, inserirDocumento, acharDuplicata } from "@/lib/documento-campos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Anexar arquivo de dentro do app (contador/escritório), em dois passos.
 *
 * É o gêmeo de `app/api/portal/enviar-documento`, que já existia para o cliente
 * final. Mesma mecânica — URL de upload assinada, arquivo sobe direto para o
 * Storage sem passar pelo servidor do app — mudando só quem autoriza: ali é a
 * sessão do portal, aqui é o usuário logado, e o vínculo com a empresa vem da
 * RLS em vez do token do link.
 *
 * A verificação de acesso à empresa é feita com o cliente do usuário (sujeito à
 * RLS) de propósito: se a pessoa não enxerga a empresa, a consulta volta vazia e
 * o upload nem é assinado. O cliente admin só entra depois disso, para falar com
 * o Storage — que não tem RLS por linha.
 */
const BUCKET = "documentos-entrada";
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB
const EXT_OK = new Set(["pdf", "jpg", "jpeg", "png", "xml", "ofx", "csv", "doc", "docx"]);

function extDe(nome: string): string {
  const i = nome.lastIndexOf(".");
  return i >= 0 ? nome.slice(i + 1).toLowerCase() : "";
}

function sanitizar(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.\-]+/g, "_")
    .slice(-120);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      acao?: string;
      empresaId?: string;
      lancamentoId?: string;
      nome?: string;
      tamanho?: number;
      path?: string;
      dados?: unknown;
    };

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const empresaId = (body.empresaId ?? "").trim();
    if (!empresaId) return NextResponse.json({ error: "Empresa não informada." }, { status: 400 });

    // RLS decide: se a empresa não aparece, a pessoa não tem acesso a ela.
    const { data: emp } = await supabase.from("empresas").select("id").eq("id", empresaId).maybeSingle();
    if (!emp) return NextResponse.json({ error: "Empresa não encontrada." }, { status: 403 });

    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return NextResponse.json({ error: "Configuração do servidor incompleta (service role)." }, { status: 500 });
    }

    // Passo 1 — assinar
    if (body.acao === "assinar") {
      const nome = (body.nome ?? "").trim();
      const ext = extDe(nome);
      if (!nome || !EXT_OK.has(ext)) {
        return NextResponse.json(
          { error: `Tipo de arquivo não permitido. Aceitos: ${Array.from(EXT_OK).join(", ")}.` },
          { status: 400 },
        );
      }
      if (typeof body.tamanho === "number" && body.tamanho > MAX_BYTES) {
        return NextResponse.json({ error: "Arquivo acima de 20 MB." }, { status: 400 });
      }
      const path = `${empresaId}/${randomUUID()}-${sanitizar(nome)}`;
      const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
      if (error || !data) {
        return NextResponse.json(
          { error: "Não foi possível preparar o upload.", detalhe: error?.message ?? `bucket "${BUCKET}" ausente?` },
          { status: 500 },
        );
      }
      return NextResponse.json({ path: data.path, token: data.token });
    }

    // Passo 2 — registrar (e já vincular ao lançamento, se veio de lá)
    if (body.acao === "registrar") {
      const path = (body.path ?? "").trim();
      const nome = (body.nome ?? "").trim();
      if (!path || !nome) return NextResponse.json({ error: "Dados incompletos." }, { status: 400 });
      // o caminho é montado no passo 1; conferir de novo evita gravar uma linha
      // apontando para a pasta de outra empresa se alguém chamar direto
      if (!path.startsWith(`${empresaId}/`)) {
        return NextResponse.json({ error: "Caminho inválido." }, { status: 400 });
      }

      let lancamentoId: string | null = null;
      if (body.lancamentoId) {
        // de novo por RLS: só vincula a um lançamento que a pessoa enxerga
        const { data: lanc } = await supabase
          .from("lancamentos")
          .select("id")
          .eq("id", body.lancamentoId)
          .eq("empresa_id", empresaId)
          .maybeSingle();
        if (!lanc) return NextResponse.json({ error: "Lançamento não encontrado." }, { status: 404 });
        lancamentoId = body.lancamentoId;
      }

      const ext = extDe(nome);
      // mesmo critério do envio pelo portal — senão um extrato CSV enviado por
      // aqui nunca aparece na lista de extratos da conciliação
      const ehExtrato = ext === "ofx" || ext === "csv";
      // A gravação usa o cliente admin, como o envio pelo portal e o expurgo:
      // a tabela não tem policy de INSERT para usuário autenticado (o app só lê
      // e atualiza). O direito de escrever já foi conferido acima, por RLS, em
      // `empresas` e em `lancamentos`.
      // `inserirDocumento` e não `.insert()` direto: se a migração de retenção
      // ainda não rodou, ele repete sem os campos novos em vez de recusar o
      // documento com o arquivo já dentro do Storage
      const campos = camposDocumento(body.dados);
      // marca de quem é cópia; não bloqueia o envio
      const duplicataDe = await acharDuplicata(admin, empresaId, campos.sha256);
      const { data, error } = await inserirDocumento(
        admin,
        {
          empresa_id: empresaId,
          arquivo_path: path,
          arquivo_nome: nome,
          tipo: ext || null,
          eh_extrato: ehExtrato,
          tamanho: typeof body.tamanho === "number" ? body.tamanho : null,
          // hash e dados da nota, lidos no navegador — sobrevivem ao expurgo
          ...campos,
        duplicata_de: duplicataDe,
          // "baixado" é como o app já marca documento ligado a lançamento
          // (ver documentos-client). Um valor novo aqui — "lancado", por
          // exemplo — sumiria das duas abas da caixa de entrada, que filtram
          // por igualdade, e o documento ficaria invisível.
          status: lancamentoId ? "baixado" : "novo",
          lancamento_id: lancamentoId,
        },
        "id, arquivo_nome, enviado_em, tipo",
      );
      if (error) {
        return NextResponse.json({ error: "Falha ao registrar o documento.", detalhe: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, documento: data });
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Erro inesperado." }, { status: 500 });
  }
}

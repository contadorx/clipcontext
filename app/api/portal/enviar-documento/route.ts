import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sessaoDoPortal } from "@/lib/portal-sessao";
import { camposDocumento, inserirDocumento, acharDuplicata } from "@/lib/documento-campos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "documentos-entrada";
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB
/*
  `ofx` e `csv` faltavam nesta lista.

  A tela do portal oferece os dois em `accept` e o formulário tem "Extrato
  bancário" entre as naturezas — e mais abaixo, neste mesmo arquivo, existe um
  `ehExtrato = ext === "ofx" || ext === "csv"` que nunca podia ser verdadeiro,
  porque a extensão morria aqui antes de chegar lá. O cliente que aceitasse o
  convite de mandar o extrato tomava "Tipo de arquivo não permitido". A lista do
  app (`api/documentos/enviar`) já incluía os dois.
*/
const EXT_OK = new Set(["pdf", "jpg", "jpeg", "png", "xml", "doc", "docx", "ofx", "csv"]);

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

async function empresaDoToken(admin: ReturnType<typeof createAdminClient>, token: string): Promise<string | null> {
  if (!token) return null;
  const { data } = await admin
    .from("portal_links")
    .select("empresa_id")
    .eq("token", token)
    .eq("ativo", true)
    .maybeSingle();
  return (data?.empresa_id as string) ?? null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      acao?: string;
      token?: string;
      nome?: string;
      tipo?: string;
      tamanho?: number;
      path?: string;
      observacao?: string;
      natureza?: string;
      dados?: unknown;
    };
    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return NextResponse.json({ error: "Configuração do servidor incompleta (service role)." }, { status: 500 });
    }
    const empresaId = await empresaDoToken(admin, body.token ?? "");
    if (!empresaId) return NextResponse.json({ error: "Link inválido ou inativo." }, { status: 403 });

    /*
      Upload rastreado: exige login e que a sessão seja desta empresa.

      `sessaoDoPortal` confere o cookie deste token e se o usuário continua
      `ativo` — sem isso, alguém revogado continuaria enviando documento em nome
      da empresa. A comparação de `empresaId` abaixo fica: ela vem de
      `empresaDoToken`, que consulta o banco, e é a checagem mais forte das
      duas.
    */
    const sessao = await sessaoDoPortal(body.token ?? "");
    if (!sessao) {
      return NextResponse.json(
        { error: "Para enviar documentos, entre pelo link de acesso que sua contabilidade enviou por e-mail." },
        { status: 401 },
      );
    }
    if (sessao.empresaId !== empresaId) {
      return NextResponse.json({ error: "Sua sessão não corresponde a esta empresa." }, { status: 403 });
    }

    // Passo 1: assinar — devolve uma URL de upload assinada (o arquivo sobe direto pro Storage).
    if (body.acao === "assinar") {
      const nome = (body.nome ?? "").trim();
      const ext = extDe(nome);
      if (!nome || !EXT_OK.has(ext)) {
        return NextResponse.json({ error: "Tipo de arquivo não permitido." }, { status: 400 });
      }
      if (typeof body.tamanho === "number" && body.tamanho > MAX_BYTES) {
        return NextResponse.json({ error: "Arquivo acima de 20 MB." }, { status: 400 });
      }
      const path = `${empresaId}/${randomUUID()}-${sanitizar(nome)}`;
      const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
      if (error || !data) {
        console.error("createSignedUploadUrl falhou:", error?.message);
        return NextResponse.json(
          { error: "Não foi possível preparar o upload.", detalhe: error?.message ?? `bucket "${BUCKET}" não encontrado?` },
          { status: 500 },
        );
      }
      return NextResponse.json({ path: data.path, token: data.token });
    }

    // Passo 2: registrar — grava a linha na caixa do contador (status 'novo').
    if (body.acao === "registrar") {
      const path = (body.path ?? "").trim();
      const nome = (body.nome ?? "").trim();
      if (!path || !nome) return NextResponse.json({ error: "Dados incompletos." }, { status: 400 });
      if (!path.startsWith(`${empresaId}/`)) {
        return NextResponse.json({ error: "Caminho inválido." }, { status: 400 });
      }
      const ext = (extDe(nome) || "").toLowerCase();
      const ehExtrato = ext === "ofx" || ext === "csv";
      const NATUREZAS = new Set(["a_pagar", "paga", "a_receber", "recebida", "extrato", "outro"]);
      const natureza = NATUREZAS.has(body.natureza ?? "") ? body.natureza : ehExtrato ? "extrato" : null;
      // `inserirDocumento` e não `.insert()` direto: se a migração de retenção
      // ainda não rodou, ele repete sem os campos novos em vez de recusar o
      // documento com o arquivo já dentro do Storage
      const campos = camposDocumento(body.dados);
      // marca de quem é cópia; não bloqueia o envio
      const duplicataDe = await acharDuplicata(admin, empresaId, campos.sha256);
      const { error } = await inserirDocumento(admin, {
        empresa_id: empresaId,
        arquivo_path: path,
        arquivo_nome: nome,
        tipo: ext || null,
        eh_extrato: ehExtrato,
        natureza,
        tamanho: typeof body.tamanho === "number" ? body.tamanho : null,
        observacao: (body.observacao ?? "").trim() || null,
        // hash e dados da nota, lidos no navegador — sobrevivem ao expurgo
        ...campos,
        duplicata_de: duplicataDe,
        status: "novo",
        enviado_por_usuario_id: sessao.usuarioId,
        enviado_por_email: sessao.email,
        enviado_por_nome: sessao.nome,
      });
      if (error) return NextResponse.json({ error: "Falha ao registrar o documento." }, { status: 500 });

      // Auditoria do envio (append-only). Não bloqueia o sucesso do upload se falhar.
      await admin.from("portal_auditoria").insert({
        empresa_id: empresaId,
        portal_usuario_id: sessao.usuarioId,
        email: sessao.email,
        acao: "upload",
        detalhe: nome,
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Erro inesperado." }, { status: 500 });
  }
}

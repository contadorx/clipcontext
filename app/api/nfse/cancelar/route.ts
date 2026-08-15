import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decifrarSegredo } from "@/lib/nfse/cripto";
import { abrirPfx } from "@/lib/nfse/assinatura";
import { montarEventoCancelamento, assinarEvento, MOTIVOS_CANCELAMENTO } from "@/lib/nfse/evento";
import { registrarEvento, type AmbienteNfse } from "@/lib/nfse/nacional";
import { cancelarNfeSp } from "@/lib/nfse/saopaulo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function dhAgora(): string {
  const agora = new Date(Date.now() - 3 * 3600 * 1000);
  return `${agora.toISOString().slice(0, 19)}-03:00`;
}

export async function POST(req: Request) {
  try {
    const { empresaId, nfseId, codigoMotivo, motivo } = (await req.json().catch(() => ({}))) as {
      empresaId?: string;
      nfseId?: string;
      codigoMotivo?: string;
      motivo?: string;
    };
    if (!empresaId || !nfseId || !codigoMotivo || !MOTIVOS_CANCELAMENTO[codigoMotivo]) {
      return NextResponse.json({ error: "Parâmetros incompletos (motivo do cancelamento é obrigatório)." }, { status: 400 });
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const [{ data: nota }, { data: cfg }, { data: empresa }] = await Promise.all([
      supabase
        .from("nfse")
        .select("id, status, chave_acesso, nfse_numero, ambiente, origem, venda_id, contrato_faturamento_id")
        .eq("id", nfseId)
        .eq("empresa_id", empresaId)
        .maybeSingle(),
      supabase
        .from("nfse_config")
        .select("cert_path, cert_senha_cripto, codigo_municipio_ibge, inscricao_municipal")
        .eq("empresa_id", empresaId)
        .maybeSingle(),
      supabase.from("empresas").select("cnpj_cpf").eq("id", empresaId).maybeSingle(),
    ]);
    if (!nota) return NextResponse.json({ error: "Nota não encontrada." }, { status: 404 });
    if (nota.status !== "emitida") {
      return NextResponse.json({ error: "Só é possível cancelar uma nota emitida." }, { status: 400 });
    }

    const ehSaoPaulo = (cfg?.codigo_municipio_ibge ?? "").replace(/\D/g, "") === "3550308";
    if (!ehSaoPaulo && (!nota.chave_acesso || nota.chave_acesso.replace(/\D/g, "").length < 40)) {
      return NextResponse.json({ error: "Nota sem chave de acesso válida." }, { status: 400 });
    }
    if (ehSaoPaulo && !nota.nfse_numero) {
      return NextResponse.json({ error: "Nota de SP sem número da NFS-e — não é possível cancelar pelo web service." }, { status: 400 });
    }
    if (ehSaoPaulo && !cfg?.inscricao_municipal) {
      return NextResponse.json({ error: "Inscrição municipal (CCM) não configurada." }, { status: 400 });
    }
    if (!cfg?.cert_path || !cfg.cert_senha_cripto) {
      return NextResponse.json({ error: "Certificado A1 não configurado." }, { status: 400 });
    }

    const admin = createAdminClient();
    const dl = await admin.storage.from("certificados").download(cfg.cert_path);
    if (dl.error || !dl.data) return NextResponse.json({ error: "Não foi possível ler o certificado." }, { status: 500 });
    const pfx = Buffer.from(await dl.data.arrayBuffer());
    let senha = "";
    try {
      senha = decifrarSegredo(cfg.cert_senha_cripto);
    } catch {
      return NextResponse.json({ error: "NFSE_CRYPTO_KEY mudou desde o envio do certificado — reenvie o A1." }, { status: 500 });
    }

    const ambiente = (nota.ambiente === "producao" ? "producao" : "homologacao") as AmbienteNfse;
    let xmlAssinado = "";
    let a1: ReturnType<typeof abrirPfx>;
    try {
      a1 = abrirPfx(pfx, senha);
    } catch (e) {
      return NextResponse.json(
        {
          error: `Não foi possível abrir o certificado A1: ${e instanceof Error ? e.message : "erro"}. Confira a senha e o arquivo .pfx.`,
        },
        { status: 500 },
      );
    }

    let cancelOk = false;
    let cancelErro: string | null = null;

    if (ehSaoPaulo) {
      // SP cancela pelo método CancelamentoNFe (chave = IM + NumeroNFe + assinatura
      // própria). Não há ambiente de teste: cancelar SEMPRE fala com a Prefeitura
      // real — o que é o esperado, já que a nota a cancelar é real.
      const r = await cancelarNfeSp({
        cnpjRemetente: empresa?.cnpj_cpf ?? "",
        inscricaoMunicipal: cfg!.inscricao_municipal!,
        numeroNfe: String(nota.nfse_numero),
        cert: a1,
      });
      cancelOk = r.ok;
      cancelErro = r.erro ?? `HTTP ${r.status}`;
    } else {
      try {
        const ev = montarEventoCancelamento({
          ambiente,
          chaveAcesso: nota.chave_acesso,
          cnpjAutor: empresa?.cnpj_cpf ?? "",
          dhEvento: dhAgora(),
          codigoMotivo,
          motivo: motivo ?? "",
        });
        xmlAssinado = assinarEvento(ev.xml, ev.infCanonico, ev.id, a1);
      } catch (e) {
        return NextResponse.json(
          { error: `Falha ao montar/assinar o evento: ${e instanceof Error ? e.message : "erro"}` },
          { status: 500 },
        );
      }
      const resp = await registrarEvento(ambiente, nota.chave_acesso, xmlAssinado, a1);
      cancelOk = resp.ok;
      cancelErro = resp.erro ?? `HTTP ${resp.status}`;
    }

    if (!cancelOk) {
      return NextResponse.json({ ok: false, erro: cancelErro });
    }

    /*
      O cancelamento já aconteceu na prefeitura. O que sobra aqui é registrar.

      Nenhuma destas duas escritas pode devolver erro e desfazer o
      cancelamento — ele é irreversível. Mas cada uma tem consequência própria
      se falhar em silêncio: a nota continua "emitida" na tela (e some da lista
      de canceladas, o que faz parecer que o cancelamento não foi aceito), e a
      origem continua "emitida" (e aí a venda cancelada **não volta** para a
      fila, então a substituição que motivou o cancelamento nunca é emitida).
    */
    const marcaNota = await supabase
      .from("nfse")
      .update({
        status: "cancelada",
        motivo_erro: `Cancelada: ${MOTIVOS_CANCELAMENTO[codigoMotivo]}${motivo ? ` — ${motivo.slice(0, 200)}` : ""}`,
      })
      .eq("id", nfseId);
    const marcaOrigem =
      nota.origem === "venda" && nota.venda_id
        ? await supabase.from("vendas").update({ nfse_status: "pendente" }).eq("id", nota.venda_id)
        : nota.contrato_faturamento_id
        ? await supabase.from("contrato_faturamentos").update({ nfse_status: "pendente" }).eq("id", nota.contrato_faturamento_id)
        : null;
    const problema = marcaNota.error ?? marcaOrigem?.error ?? null;
    if (problema) {
      console.error("[nfse/cancelar] cancelada na prefeitura, registro incompleto", { nfseId, erro: problema.message });
      return NextResponse.json({
        ok: true,
        aviso: `A nota foi cancelada na prefeitura, mas o registro aqui não ficou completo (${problema.message}). Recarregue e confira o status antes de reemitir.`,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro inesperado." }, { status: 500 });
  }
}

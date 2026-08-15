import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { asaasFetch } from "@/lib/asaas";
import { decifrarSegredo } from "@/lib/nfse/cripto";
import { montarDpsXml, type DadosDps } from "@/lib/nfse/dps";
import { resolverIbgeEmitente } from "@/lib/nfse/ibge";
import { abrirPfx, assinarDps } from "@/lib/nfse/assinatura";
import { emitirDps, urlDanfse, type AmbienteNfse } from "@/lib/nfse/nacional";
import { lancarFaturamentoEscritorio } from "@/lib/negocio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Emite a NFS-e de UMA assinatura paga (admin total).
// Emitente = empresa emissora configurada em admin_nfse_config.
// Tomador = cliente Asaas do escritório assinante.

type AsaasCustomer = {
  name?: string;
  cpfCnpj?: string;
  postalCode?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string; // bairro, no Asaas
  cityName?: string;
  state?: string;
};

function dhEmiAgora(): string {
  const agora = new Date(Date.now() - 3 * 3600 * 1000);
  return `${agora.toISOString().slice(0, 19)}-03:00`;
}

async function ibgePorCep(cep: string): Promise<{ ibge: string; municipio: string; bairro: string } | null> {
  const d = cep.replace(/\D/g, "");
  if (d.length !== 8) return null;
  try {
    const r = await fetch(`https://viacep.com.br/ws/${d}/json/`, { cache: "no-store" });
    const j = (await r.json()) as { ibge?: string; localidade?: string; bairro?: string; erro?: boolean };
    if (!r.ok || j.erro || !j.ibge) return null;
    return { ibge: j.ibge, municipio: j.localidade ?? "", bairro: j.bairro ?? "" };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const { escritorioId, competencia, valor } = (await req.json().catch(() => ({}))) as {
      escritorioId?: string;
      competencia?: string; // aaaa-mm
      valor?: number;
    };
    if (!escritorioId || !competencia || !/^\d{4}-\d{2}$/.test(competencia) || !valor || valor <= 0) {
      return NextResponse.json({ error: "Parâmetros incompletos (assinante, competência e valor)." }, { status: 400 });
    }

    // ---- só super admin ----
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    const { data: membro } = await supabase
      .from("membros")
      .select("super_admin")
      .eq("user_id", user.id)
      .eq("super_admin", true)
      .maybeSingle();
    if (!membro) return NextResponse.json({ error: "Acesso restrito." }, { status: 403 });

    const admin = createAdminClient();

    // ---- config do emissor ----
    const { data: cfgAdmin } = await admin
      .from("admin_nfse_config")
      .select("empresa_emissora_id, servico_id")
      .eq("id", 1)
      .maybeSingle();
    if (!cfgAdmin?.empresa_emissora_id || !cfgAdmin.servico_id) {
      return NextResponse.json({ error: "Configure a empresa emissora e o serviço fiscal no topo da tela." }, { status: 400 });
    }
    const emissoraId = cfgAdmin.empresa_emissora_id;

    const [{ data: cfg }, { data: emissora }, { data: serv }, { data: esc }] = await Promise.all([
      admin
        .from("nfse_config")
        .select("inscricao_municipal, codigo_municipio_ibge, op_simples, serie_dps, ambiente, cert_path, cert_senha_cripto")
        .eq("empresa_id", emissoraId)
        .maybeSingle(),
      admin.from("empresas").select("nome, razao_social, cnpj_cpf, municipio, uf").eq("id", emissoraId).maybeSingle(),
      admin
        .from("servicos")
        .select("nome, descricao, item_lc116, codigo_tributacao_municipal, aliquota_iss, iss_retido, exigibilidade_iss")
        .eq("id", cfgAdmin.servico_id)
        .maybeSingle(),
      admin
        .from("escritorios")
        .select("nome, asaas_customer_id, assinatura_qtd, ciclo_cobranca")
        .eq("id", escritorioId)
        .maybeSingle(),
    ]);
    if (!esc) return NextResponse.json({ error: "Assinante não encontrado." }, { status: 404 });
    if (!cfg?.cert_path || !cfg.cert_senha_cripto) {
      return NextResponse.json(
        { error: "A empresa emissora não tem o certificado A1 em Configurações → NFS-e." },
        { status: 400 },
      );
    }
    // Código IBGE do emitente: usa o salvo (se válido) ou deriva de município + UF.
    const { codigo: codigoIbgeEmit, derivado: ibgeDerivado } = await resolverIbgeEmitente({
      codigoSalvo: cfg.codigo_municipio_ibge,
      municipio: emissora?.municipio,
      uf: emissora?.uf,
    });
    if (!codigoIbgeEmit) {
      return NextResponse.json(
        { error: "Não foi possível identificar o código do município da empresa emissora. Verifique município e UF no cadastro." },
        { status: 400 },
      );
    }
    if (ibgeDerivado) {
      try {
        await admin.from("nfse_config").update({ codigo_municipio_ibge: codigoIbgeEmit }).eq("empresa_id", emissoraId);
      } catch {
        /* não bloqueia */
      }
    }
    const cnpjEmit = (emissora?.cnpj_cpf ?? "").replace(/\D/g, "");
    if (cnpjEmit.length !== 14) {
      return NextResponse.json({ error: "A empresa emissora está sem CNPJ no cadastro." }, { status: 400 });
    }
    if (!serv?.item_lc116) {
      return NextResponse.json({ error: "O serviço fiscal configurado está sem item LC 116." }, { status: 400 });
    }
    if (!esc.asaas_customer_id) {
      return NextResponse.json({ error: "Este assinante não tem cliente Asaas vinculado (sem dados do tomador)." }, { status: 400 });
    }

    // ---- dedup ----
    const referencia = `assinatura:${escritorioId}:${competencia}`;
    const { data: jaExiste } = await admin
      .from("nfse")
      .select("id, status")
      .eq("referencia", referencia)
      .in("status", ["emitida", "processando", "pendente"])
      .maybeSingle();
    if (jaExiste) {
      return NextResponse.json({ error: `Já existe nota desta competência para este assinante (${jaExiste.status}).` }, { status: 400 });
    }

    // ---- tomador via Asaas ----
    let cust: AsaasCustomer;
    try {
      cust = await asaasFetch<AsaasCustomer>(`/customers/${esc.asaas_customer_id}`);
    } catch (e) {
      return NextResponse.json(
        { error: `Não foi possível ler o cliente no Asaas: ${e instanceof Error ? e.message.slice(0, 150) : "erro"}` },
        { status: 502 },
      );
    }
    const docTomador = (cust.cpfCnpj ?? "").replace(/\D/g, "");
    if (docTomador.length !== 11 && docTomador.length !== 14) {
      return NextResponse.json({ error: "O cliente Asaas deste assinante está sem CPF/CNPJ válido." }, { status: 400 });
    }
    const end = cust.postalCode ? await ibgePorCep(cust.postalCode) : null;

    // ---- monta, assina e transmite ----
    const dl = await admin.storage.from("certificados").download(cfg.cert_path);
    if (dl.error || !dl.data) return NextResponse.json({ error: "Não foi possível ler o certificado da emissora." }, { status: 500 });
    const pfx = Buffer.from(await dl.data.arrayBuffer());
    let senha = "";
    try {
      senha = decifrarSegredo(cfg.cert_senha_cripto);
    } catch {
      return NextResponse.json({ error: "NFSE_CRYPTO_KEY mudou desde o envio do certificado — reenvie o A1 da emissora." }, { status: 500 });
    }

    const { data: numero, error: errNum } = await admin.rpc("next_numero_dps", { p_empresa: emissoraId });
    if (errNum || numero == null) {
      return NextResponse.json({ error: "Falha ao reservar o número da DPS (rode fs_nfse_emissao.sql)." }, { status: 500 });
    }

    const [a, m] = competencia.split("-");
    const discriminacao = `Assinatura FinanceiroX — competencia ${m}/${a}${esc.assinatura_qtd ? ` — ${esc.assinatura_qtd} empresa(s)` : ""} — ${esc.nome}`;
    const ambiente = (cfg.ambiente === "producao" ? "producao" : "homologacao") as AmbienteNfse;

    const dados: DadosDps = {
      ambiente,
      dhEmi: dhEmiAgora(),
      serie: cfg.serie_dps || "1",
      numero: Number(numero),
      competencia: `${competencia}-01`,
      emitente: {
        cnpj: cnpjEmit,
        inscricaoMunicipal: cfg.inscricao_municipal,
        codigoMunicipioIbge: codigoIbgeEmit,
        opSimples: (cfg.op_simples as DadosDps["emitente"]["opSimples"]) ?? "optante",
        razaoSocial: emissora?.razao_social || emissora?.nome || "",
      },
      tomador: {
        documento: docTomador,
        nome: cust.name || esc.nome,
        codigoMunicipioIbge: end?.ibge ?? null,
        cep: end ? cust.postalCode : null,
        logradouro: cust.address ?? null,
        numero: cust.addressNumber ?? null,
        complemento: cust.complement ?? null,
        bairro: cust.province || end?.bairro || null,
        municipio: end?.municipio || cust.cityName || null,
        uf: cust.state ?? null,
      },
      servico: {
        itemLc116: serv.item_lc116,
        codigoTributacaoMunicipal: serv.codigo_tributacao_municipal,
        discriminacao,
        valor: Number(valor),
        aliquotaIss: Number(serv.aliquota_iss),
        issRetido: !!serv.iss_retido,
        exigibilidade: serv.exigibilidade_iss,
      },
    };

    let xmlAssinado = "";
    let dpsId = "";
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
    try {
      const { xml, infDps, id } = montarDpsXml(dados);
      dpsId = id;
      xmlAssinado = assinarDps(xml, infDps, id, a1);
    } catch (e) {
      return NextResponse.json(
        { error: `Falha ao montar/assinar a DPS: ${e instanceof Error ? e.message : "erro"}` },
        { status: 500 },
      );
    }

    const resp = await emitirDps(ambiente, xmlAssinado, a1);

    const { error: errNota } = await admin.from("nfse").insert({
      empresa_id: emissoraId,
      origem: "assinatura",
      referencia,
      valor_servico: Number(valor),
      discriminacao,
      item_lc116: serv.item_lc116,
      codigo_tributacao_municipal: serv.codigo_tributacao_municipal,
      aliquota_iss: Number(serv.aliquota_iss),
      iss_retido: !!serv.iss_retido,
      exigibilidade_iss: serv.exigibilidade_iss,
      ambiente,
      dps_serie: cfg.serie_dps || "1",
      dps_numero: Number(numero),
      xml_dps: xmlAssinado,
      status: resp.ok ? "emitida" : "rejeitada",
      nfse_numero: resp.nfseNumero ?? null,
      chave_acesso: resp.chaveAcesso || dpsId,
      xml_nfse: resp.nfseXml ?? null,
      pdf_url: resp.ok && resp.chaveAcesso ? urlDanfse(ambiente, resp.chaveAcesso) : null,
      motivo_erro: resp.ok ? null : resp.erro ?? `HTTP ${resp.status}`,
      emitida_em: resp.ok ? new Date().toISOString() : null,
    });
    if (errNota) return NextResponse.json({ error: errNota.message }, { status: 500 });

    // NFS-e emitida com sucesso cria o "a receber" na empresa Master.
    // Idempotente por escritório+competência (negocio_faturamento). A baixa é
    // feita depois pela conciliação bancária — não pelo pagamento. Best-effort.
    if (resp.ok) {
      try {
        await lancarFaturamentoEscritorio(
          admin,
          { id: escritorioId, nome: esc.nome, valor_mensal: Number(valor) },
          competencia,
        );
      } catch {
        /* não bloqueia a emissão se o lançamento falhar */
      }
    }

    return NextResponse.json({
      ok: resp.ok,
      nfseNumero: resp.nfseNumero ?? null,
      pdfUrl: resp.ok && resp.chaveAcesso ? urlDanfse(ambiente, resp.chaveAcesso) : null,
      erro: resp.ok ? null : resp.erro ?? `HTTP ${resp.status}`,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro inesperado." }, { status: 500 });
  }
}

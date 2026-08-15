import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decifrarSegredo } from "@/lib/nfse/cripto";
import { type DadosDps } from "@/lib/nfse/dps";
import { abrirPfx } from "@/lib/nfse/assinatura";
import { type AmbienteNfse } from "@/lib/nfse/nacional";
import { resolverIbgeEmitente } from "@/lib/nfse/ibge";
import { emitirNfseDispatch } from "@/lib/nfse/dispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type ItemFiscal = { servico_id: string; descricao: string | null; quantidade: number; valor_unitario: number };

function dhEmiAgora(): string {
  // horário de Brasília (UTC-3, sem horário de verão vigente)
  const agora = new Date(Date.now() - 3 * 3600 * 1000);
  return `${agora.toISOString().slice(0, 19)}-03:00`;
}

export async function POST(req: Request) {
  try {
    const { empresaId, origem, vendaId, faturamentoId } = (await req.json().catch(() => ({}))) as {
      empresaId?: string;
      origem?: "venda" | "contrato";
      vendaId?: string;
      faturamentoId?: string;
    };
    if (!empresaId || !origem || (origem === "venda" && !vendaId) || (origem === "contrato" && !faturamentoId)) {
      return NextResponse.json({ error: "Parâmetros incompletos." }, { status: 400 });
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    // RLS valida vínculo com a empresa em todas as leituras abaixo.
    const [{ data: cfg }, { data: empresa }] = await Promise.all([
      supabase
        .from("nfse_config")
        .select("inscricao_municipal, codigo_municipio_ibge, op_simples, serie_dps, ambiente, cert_path, cert_senha_cripto")
        .eq("empresa_id", empresaId)
        .maybeSingle(),
      supabase.from("empresas").select("nome, razao_social, cnpj_cpf, municipio, uf").eq("id", empresaId).maybeSingle(),
    ]);
    if (!empresa) return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });

    // Código IBGE do município emissor: usa o salvo (se válido) ou deriva
    // automaticamente de município + UF da empresa (que vêm da Receita).
    const { codigo: codigoIbgeEmit, derivado: ibgeDerivado } = await resolverIbgeEmitente({
      codigoSalvo: cfg?.codigo_municipio_ibge,
      municipio: empresa.municipio,
      uf: empresa.uf,
    });
    if (!codigoIbgeEmit) {
      return NextResponse.json(
        {
          error:
            "Não foi possível identificar o código do município do emitente. Verifique se o município e a UF da empresa estão corretos no cadastro.",
        },
        { status: 400 },
      );
    }
    // grava o código derivado para as próximas emissões (best-effort)
    if (ibgeDerivado && empresaId) {
      try {
        await supabase.from("nfse_config").update({ codigo_municipio_ibge: codigoIbgeEmit }).eq("empresa_id", empresaId);
      } catch {
        /* não bloqueia a emissão se a gravação falhar */
      }
    }
    if (!cfg?.cert_path || !cfg?.cert_senha_cripto) {
      return NextResponse.json({ error: "Envie o certificado A1 em Configurações → NFS-e." }, { status: 400 });
    }
    const cnpjEmit = (empresa.cnpj_cpf ?? "").replace(/\D/g, "");
    if (cnpjEmit.length !== 14) {
      return NextResponse.json({ error: "CNPJ da empresa emitente ausente ou inválido (Dados da empresa)." }, { status: 400 });
    }

    // ---- carrega o objeto da fila e consolida itens ----
    let clienteId = "";
    let itens: ItemFiscal[] = [];
    let competencia = "";
    let valorFaturamento = 0;
    if (origem === "venda") {
      const { data: venda } = await supabase
        .from("vendas")
        .select("id, cliente_fornecedor_id, data_venda, descricao, status, gera_nfse, nfse_status")
        .eq("id", vendaId!)
        .maybeSingle();
      if (!venda || venda.status === "cancelada") return NextResponse.json({ error: "Venda não encontrada." }, { status: 404 });
      if (venda.nfse_status === "emitida") return NextResponse.json({ error: "Esta venda já tem NFS-e emitida." }, { status: 400 });
      const { data: vi } = await supabase
        .from("venda_itens")
        .select("servico_id, descricao, quantidade, valor_unitario")
        .eq("venda_id", vendaId!);
      clienteId = venda.cliente_fornecedor_id;
      itens = (vi ?? []) as ItemFiscal[];
      competencia = venda.data_venda;
    } else {
      const { data: fat } = await supabase
        .from("contrato_faturamentos")
        .select("id, contrato_id, competencia, valor, nfse_status, contrato:contratos(cliente_fornecedor_id, nome)")
        .eq("id", faturamentoId!)
        .maybeSingle();
      if (!fat) return NextResponse.json({ error: "Faturamento não encontrado." }, { status: 404 });
      if (fat.nfse_status === "emitida") return NextResponse.json({ error: "Este faturamento já tem NFS-e emitida." }, { status: 400 });
      const contrato = fat.contrato as unknown as { cliente_fornecedor_id: string } | null;
      const { data: ci } = await supabase
        .from("contrato_itens")
        .select("servico_id, descricao, quantidade, valor_unitario")
        .eq("contrato_id", fat.contrato_id);
      clienteId = contrato?.cliente_fornecedor_id ?? "";
      itens = (ci ?? []) as ItemFiscal[];
      competencia = fat.competencia;
      valorFaturamento = Number(fat.valor) || 0;
    }
    if (itens.length === 0) return NextResponse.json({ error: "Sem itens de serviço para emitir." }, { status: 400 });

    const { data: cliente } = await supabase
      .from("clientes_fornecedores")
      .select("id, nome, razao_social, cpf_cnpj, cep, logradouro, endereco_numero, complemento, bairro, municipio, uf, codigo_ibge")
      .eq("id", clienteId)
      .maybeSingle();
    if (!cliente?.cpf_cnpj) return NextResponse.json({ error: "Cliente sem CPF/CNPJ." }, { status: 400 });

    const servicoIds = Array.from(new Set(itens.map((i) => i.servico_id)));
    const { data: servicos } = await supabase
      .from("servicos")
      .select("id, nome, descricao, valor, item_lc116, codigo_tributacao_municipal, aliquota_iss, iss_retido, exigibilidade_iss")
      .in("id", servicoIds);
    const sMap = new Map((servicos ?? []).map((s) => [s.id, s]));

    // consolidação fiscal: a NFS-e emite UM enquadramento por nota.
    const fiscais = servicoIds.map((id) => sMap.get(id)).filter(Boolean) as NonNullable<ReturnType<typeof sMap.get>>[];
    const emitenteEhSaoPaulo = (codigoIbgeEmit ?? "").replace(/\D/g, "") === "3550308";
    if (emitenteEhSaoPaulo) {
      // São Paulo usa o código de serviço municipal, não o item LC 116
      const semCod = fiscais.filter((s) => !s.codigo_tributacao_municipal);
      if (semCod.length > 0) {
        return NextResponse.json(
          {
            error: `Serviço(s) sem código de serviço municipal de SP: ${semCod
              .map((s) => s.nome)
              .join(", ")}. Preencha o campo "Código de tributação municipal" em Configurações → Serviços.`,
          },
          { status: 400 },
        );
      }
    } else {
      const semLc = fiscais.filter((s) => !s.item_lc116);
      if (semLc.length > 0) {
        return NextResponse.json(
          { error: `Serviço(s) sem item LC 116: ${semLc.map((s) => s.nome).join(", ")}. Complete em Configurações → Serviços.` },
          { status: 400 },
        );
      }
    }
    const enquad = new Set(
      fiscais.map((s) => (emitenteEhSaoPaulo ? s.codigo_tributacao_municipal : s.item_lc116)),
    );
    const aliqs = new Set(fiscais.map((s) => Number(s.aliquota_iss)));
    if (enquad.size > 1 || aliqs.size > 1) {
      return NextResponse.json(
        { error: "Os serviços têm enquadramentos ou alíquotas diferentes — a NFS-e aceita um por nota. Separe em vendas distintas." },
        { status: 400 },
      );
    }
    const ref = fiscais[0];
    const totalItens = itens.reduce((s, i) => s + Number(i.quantidade) * Number(i.valor_unitario), 0);
    // Faturamento de contrato guarda o valor em contrato_faturamentos.valor; os
    // contrato_itens podem não ter valor_unitario preenchido (o valor real é o
    // do faturamento). Sem este fallback, o total ia a 0 e SP rejeitava com
    // 1204 (Valor Total de Serviços não confere) e 1206 (assinatura do RPS, que
    // inclui o valor zerado na string).
    // Fallback 3: preço cadastrado do serviço (servicos.valor) × quantidade,
    // para quando itens e faturamento estão zerados (caso comum em itens de
    // teste e contratos onde o preço real mora em servicos.valor).
    const totalServicoCadastro = itens.reduce((s, i) => {
      const sv = sMap.get(i.servico_id);
      return s + Number(i.quantidade) * Number(sv?.valor ?? 0);
    }, 0);
    const total = totalItens > 0 ? totalItens : valorFaturamento > 0 ? valorFaturamento : totalServicoCadastro;
    if (!(total > 0)) {
      return NextResponse.json(
        { error: "Valor da nota é zero. Confira o valor do faturamento ou os itens (quantidade × valor unitário)." },
        { status: 400 },
      );
    }
    const discriminacao = (() => {
      if (totalItens > 0) {
        return itens
          .map((i) => {
            const s = sMap.get(i.servico_id);
            const nome = i.descricao || s?.descricao || s?.nome || "Servico";
            return `${nome} (${Number(i.quantidade)} x ${Number(i.valor_unitario).toFixed(2)})`;
          })
          .join("; ");
      }
      // valor veio do faturamento: descreve sem repetir o "x 0.00" dos itens
      return itens
        .map((i) => {
          const s = sMap.get(i.servico_id);
          return i.descricao || s?.descricao || s?.nome || "Servico";
        })
        .join("; ");
    })();

    // ---- numeração da DPS ----
    // Reaproveita a DPS de uma tentativa anterior NÃO concluída para a mesma
    // origem (rejeitada, ou validada em homologação) em vez de reservar um
    // número novo a cada clique. Isso evita "queimar" a numeração — em SP,
    // gaps ou repetição de RPS podem gerar rejeição. Só reserva um número novo
    // numa primeira emissão real ou quando a última nota da origem é definitiva
    // (emitida/cancelada — esse número já está consumido).
    const consultaOrigem =
      origem === "venda"
        ? supabase.from("nfse").select("id, dps_numero, dps_serie, status").eq("venda_id", vendaId!)
        : supabase.from("nfse").select("id, dps_numero, dps_serie, status").eq("contrato_faturamento_id", faturamentoId!);
    const { data: ultimaNota } = await consultaOrigem.order("criado_em", { ascending: false }).limit(1).maybeSingle();

    const podeReaproveitar =
      !!ultimaNota &&
      (ultimaNota.status === "rejeitada" || ultimaNota.status === "homologacao") &&
      ultimaNota.dps_numero != null;

    let numero: number;
    let serieUsada: string;
    let notaExistenteId: string | null = null;
    if (podeReaproveitar) {
      numero = Number(ultimaNota!.dps_numero);
      serieUsada = ultimaNota!.dps_serie || cfg.serie_dps || "1";
      notaExistenteId = ultimaNota!.id;
    } else {
      const { data: novoNumero, error: errNum } = await supabase.rpc("next_numero_dps", { p_empresa: empresaId });
      if (errNum || novoNumero == null) {
        return NextResponse.json({ error: "Falha ao reservar o número da DPS (rode a migration fs_nfse_emissao.sql)." }, { status: 500 });
      }
      numero = Number(novoNumero);
      serieUsada = cfg.serie_dps || "1";
    }

    // ---- certificado: baixa o PFX e decifra a senha ----
    const admin = createAdminClient();
    const dl = await admin.storage.from("certificados").download(cfg.cert_path);
    if (dl.error || !dl.data) return NextResponse.json({ error: "Não foi possível ler o certificado armazenado." }, { status: 500 });
    const pfx = Buffer.from(await dl.data.arrayBuffer());
    let senha = "";
    try {
      senha = decifrarSegredo(cfg.cert_senha_cripto);
    } catch {
      return NextResponse.json({ error: "NFSE_CRYPTO_KEY mudou desde o envio do certificado — reenvie o A1." }, { status: 500 });
    }

    const ambiente = (cfg.ambiente === "producao" ? "producao" : "homologacao") as AmbienteNfse;
    const dados: DadosDps = {
      ambiente,
      dhEmi: dhEmiAgora(),
      serie: serieUsada,
      numero: numero,
      competencia,
      emitente: {
        cnpj: cnpjEmit,
        inscricaoMunicipal: cfg.inscricao_municipal,
        codigoMunicipioIbge: codigoIbgeEmit,
        opSimples: (cfg.op_simples as DadosDps["emitente"]["opSimples"]) ?? "optante",
        razaoSocial: empresa.razao_social || empresa.nome,
      },
      tomador: {
        documento: cliente.cpf_cnpj,
        nome: cliente.razao_social || cliente.nome,
        codigoMunicipioIbge: cliente.codigo_ibge,
        cep: cliente.cep,
        logradouro: cliente.logradouro,
        numero: cliente.endereco_numero,
        complemento: cliente.complemento,
        bairro: cliente.bairro,
        municipio: cliente.municipio,
        uf: cliente.uf,
      },
      servico: {
        itemLc116: ref.item_lc116!,
        codigoTributacaoMunicipal: ref.codigo_tributacao_municipal,
        discriminacao,
        valor: total,
        aliquotaIss: Number(ref.aliquota_iss),
        issRetido: !!ref.iss_retido,
        exigibilidade: ref.exigibilidade_iss,
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
    // ---- emissão roteada por município (SP capital → SOAP; demais → nacional) ----
    const resp = await emitirNfseDispatch({
      dados,
      cert: a1,
      ambiente,
      codigoServicoSp: ref.codigo_tributacao_municipal,
    });
    xmlAssinado = resp.xmlEnviado;
    dpsId = resp.chaveAcesso || "";

    // ---- grava a nota e atualiza o pai ----
    // Em homologação (SP = método de teste; nacional = ambiente de teste) NÃO
    // existe nota fiscal real: registramos como "homologacao" e NÃO marcamos a
    // venda/faturamento como emitido, para que a emissão real (produção) ainda
    // seja possível depois.
    const ehHomologacao = ambiente === "homologacao";
    const nota = {
      empresa_id: empresaId,
      origem,
      venda_id: origem === "venda" ? vendaId : null,
      contrato_faturamento_id: origem === "contrato" ? faturamentoId : null,
      cliente_fornecedor_id: clienteId,
      valor_servico: total,
      discriminacao,
      item_lc116: ref.item_lc116,
      codigo_tributacao_municipal: ref.codigo_tributacao_municipal,
      aliquota_iss: Number(ref.aliquota_iss),
      iss_retido: !!ref.iss_retido,
      exigibilidade_iss: ref.exigibilidade_iss,
      ambiente,
      dps_serie: serieUsada,
      dps_numero: numero,
      xml_dps: xmlAssinado,
      status: resp.ok ? (ehHomologacao ? "homologacao" : "emitida") : "rejeitada",
      nfse_numero: resp.ok && !ehHomologacao ? resp.nfseNumero ?? null : null,
      chave_acesso: resp.chaveAcesso || dpsId,
      xml_nfse: resp.nfseXml ?? null,
      pdf_url: ehHomologacao ? null : resp.pdfUrl,
      motivo_erro: resp.ok ? null : resp.erro ?? `HTTP ${resp.status}`,
      emitida_em: resp.ok && !ehHomologacao ? new Date().toISOString() : null,
    };
    // Retentativa da mesma origem: atualiza a linha existente (mesmo número) em
    // vez de empilhar uma nova rejeitada. Primeira tentativa: insere.
    const { error: errNota } = notaExistenteId
      ? await supabase.from("nfse").update(nota).eq("id", notaExistenteId)
      : await supabase.from("nfse").insert(nota);
    if (errNota) return NextResponse.json({ error: errNota.message }, { status: 500 });

    /*
      A nota já foi emitida na prefeitura quando esta linha roda.

      Se a marca na origem não grava, a venda (ou o faturamento do contrato)
      continua com `nfse_status` pendente: ela reaparece na fila de emissão e a
      pessoa emite **a mesma nota de novo** — segunda NF-e, imposto em dobro,
      cancelamento manual na prefeitura para desfazer. Não dá para devolver erro
      (a nota existe e o número dela está na resposta), mas dá para avisar, e o
      log guarda o id de quem ficou para trás.
    */
    let avisoOrigem: string | null = null;
    if (resp.ok && !ehHomologacao) {
      const marca =
        origem === "venda"
          ? await supabase.from("vendas").update({ nfse_status: "emitida" }).eq("id", vendaId!)
          : await supabase.from("contrato_faturamentos").update({ nfse_status: "emitida" }).eq("id", faturamentoId!);
      if (marca.error) {
        console.error("[nfse/emitir] nota emitida sem marcar a origem", {
          origem,
          id: origem === "venda" ? vendaId : faturamentoId,
          chaveAcesso: nota.chave_acesso,
          erro: marca.error.message,
        });
        avisoOrigem =
          "A nota foi emitida, mas não foi possível marcar a origem como emitida. NÃO emita de novo — recarregue e confira antes.";
      }
    }

    return NextResponse.json({
      aviso: avisoOrigem,
      ok: resp.ok,
      homologacao: ehHomologacao,
      status: resp.status,
      chaveAcesso: nota.chave_acesso,
      nfseNumero: nota.nfse_numero,
      pdfUrl: nota.pdf_url,
      erro: nota.motivo_erro,
    });
  } catch (e) {
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    // aparece no log de runtime da Vercel para diagnóstico
    console.error("[nfse/emitir] erro não tratado:", msg, e instanceof Error ? e.stack : "");
    return NextResponse.json({ error: `Erro ao emitir: ${msg || "exceção sem mensagem"}` }, { status: 500 });
  }
}

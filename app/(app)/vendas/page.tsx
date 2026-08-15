import { createClient } from "@/lib/supabase/server";
import { getEmpresaContext } from "@/lib/empresa";
import VendasHub from "@/components/vendas/vendas-hub";
import PageHeader from "@/components/ui/page-header";

/**
 * Teto da varredura de vínculos de cobrança.
 *
 * Alto de propósito: são quatro colunas de id por linha, e o custo de errar
 * para baixo é cobrar o cliente duas vezes. Se um dia for atingido, a tela
 * desliga a geração de boletos em vez de adivinhar.
 */
const TETO_VINCULOS = 20000;

export default async function VendasPage() {
  const { atual } = await getEmpresaContext();
  const empresaId = atual?.id ?? "";

  const supabase = createClient();
  const [vendas, vendaItens, vendaParcelas, contratos, contratoItens, servicos, clientes, categorias, contas, nfseConfig, notas, fatsPend, titulos, vinculos, fatsBoleto, lancReceber] =
    await Promise.all([
      supabase
        .from("vendas")
        .select(
          "id, cliente_fornecedor_id, data_venda, descricao, categoria_id, conta_id, parcelas, primeiro_vencimento, status, gera_nfse, nfse_status, gera_boleto, boleto_status, observacoes",
        )
        .eq("empresa_id", empresaId)
        .order("criado_em", { ascending: false }),
      supabase
        .from("venda_itens")
        .select("id, venda_id, servico_id, descricao, quantidade, valor_unitario")
        .eq("empresa_id", empresaId),
      supabase
        .from("venda_parcelas")
        .select("id, venda_id, numero, valor, vencimento, lancamento_id")
        .eq("empresa_id", empresaId),
      supabase
        .from("contratos")
        .select(
          "id, cliente_fornecedor_id, nome, ciclo, dia_faturamento, data_inicio, data_fim, categoria_id, conta_id, status, gera_nfse, gera_boleto, observacoes",
        )
        .eq("empresa_id", empresaId)
        .order("criado_em", { ascending: false }),
      supabase
        .from("contrato_itens")
        .select("id, contrato_id, servico_id, descricao, quantidade, valor_unitario")
        .eq("empresa_id", empresaId),
      supabase
        .from("servicos")
        .select("id, nome, valor, unidade, ativo, item_lc116, codigo_tributacao_municipal")
        .eq("empresa_id", empresaId)
        .order("nome"),
      supabase
        .from("clientes_fornecedores")
        .select("id, nome, cpf_cnpj, tipo, municipio, uf, cep, logradouro, endereco_numero, codigo_ibge")
        .eq("empresa_id", empresaId)
        .in("tipo", ["cliente", "ambos"])
        .order("nome"),
      supabase
        .from("categorias")
        .select("id, nome, tipo")
        .eq("empresa_id", empresaId)
        .eq("tipo", "receber")
        .order("nome"),
      supabase
        .from("contas_bancarias")
        .select("id, nome, banco_codigo, agencia, agencia_dv, conta_numero, conta_dv, convenio, carteira, juros_mes_pct, multa_pct")
        .eq("empresa_id", empresaId)
        .order("nome"),
      supabase
        .from("nfse_config")
        .select("codigo_municipio_ibge, inscricao_municipal, ambiente, cert_path, cert_validade")
        .eq("empresa_id", empresaId)
        .maybeSingle(),
      supabase
        .from("nfse")
        .select(
          "id, origem, venda_id, contrato_faturamento_id, cliente_fornecedor_id, valor_servico, status, ambiente, nfse_numero, dps_numero, pdf_url, motivo_erro, emitida_em, criado_em",
        )
        .eq("empresa_id", empresaId)
        .order("criado_em", { ascending: false })
        .limit(100),
      supabase
        .from("contrato_faturamentos")
        .select("id, contrato_id, competencia, valor, contrato:contratos(nome, cliente_fornecedor_id)")
        .eq("empresa_id", empresaId)
        .eq("nfse_status", "pendente")
        .order("competencia", { ascending: false }),
      supabase
        .from("cobranca_titulos")
        .select(
          "id, conta_id, origem, venda_parcela_id, contrato_faturamento_id, lancamento_id, nfse_id, cliente_fornecedor_id, nosso_numero, nosso_numero_fmt, numero_documento, valor, vencimento, sacado_nome, sacado_documento, sacado_logradouro, sacado_cep, sacado_municipio, sacado_uf, status, criado_em, token_publico",
        )
        .eq("empresa_id", empresaId)
        .order("criado_em", { ascending: false })
        .limit(200),
      /*
        Vínculos de TODOS os títulos, em projeção mínima.

        A lista acima tem teto de 200 e é o que a Central de boletos mostra. O
        problema é que ela também respondia "este item já tem boleto?" — e
        passando de 200 títulos, os mais antigos saíam da lista e seus itens
        **reapareciam na fila "A gerar"** como se nunca tivessem sido cobrados.
        Um clique em "Gerar N boleto(s)" emitia cobrança duplicada.

        Estas quatro colunas de id são o suficiente para a pergunta, e cabem
        num teto muito mais alto pelo mesmo custo de rede. Quando nem este teto
        basta, a tela desliga a geração em vez de arriscar (ver `vinculosNoTeto`
        em boletos.tsx): não saber o que já foi cobrado e cobrar assim mesmo é
        o pior desfecho possível.
      */
      supabase
        .from("cobranca_titulos")
        .select("venda_parcela_id, contrato_faturamento_id, lancamento_id, nfse_id, status")
        .eq("empresa_id", empresaId)
        .limit(TETO_VINCULOS),
      supabase
        .from("contrato_faturamentos")
        .select("id, contrato_id, competencia, valor, lancamento_id, contrato:contratos(nome, cliente_fornecedor_id), lancamento:lancamentos(data_vencimento)")
        .eq("empresa_id", empresaId)
        .eq("boleto_status", "pendente")
        .order("competencia", { ascending: false }),
      supabase
        .from("lancamentos")
        .select("id, valor, data_vencimento, cliente_fornecedor_id, numero_documento, descricao")
        .eq("empresa_id", empresaId)
        .eq("tipo", "entrada")
        .is("data_pagamento", null)
        .or("transferencia.is.null,transferencia.eq.false")
        .not("cliente_fornecedor_id", "is", null)
        .not("data_vencimento", "is", null)
        .order("data_vencimento", { ascending: true })
        .limit(500),
    ]);

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Serviços"
        sub={
          <>
            Vendas avulsas e contratos recorrentes — com entrada, NFS-e e boleto. O catálogo fica em Configurações → Serviços. Empresa:{" "}
            <span className="font-semibold text-ink">{atual?.nome}</span>
          </>
        }
      />
      <VendasHub
        empresaId={empresaId}
        vendas={vendas.data ?? []}
        vendaItens={vendaItens.data ?? []}
        vendaParcelas={vendaParcelas.data ?? []}
        contratos={contratos.data ?? []}
        contratoItens={contratoItens.data ?? []}
        servicos={servicos.data ?? []}
        clientes={clientes.data ?? []}
        categorias={categorias.data ?? []}
        contas={contas.data ?? []}
        nfseConfig={nfseConfig.data ?? null}
        notas={notas.data ?? []}
        fatsPendentes={(fatsPend.data ?? []) as never}
        titulos={titulos.data ?? []}
        vinculos={(vinculos.data ?? []) as never}
        /*
          Erro na consulta conta como "não sei", e não como "não tem nada".

          `vinculos.data ?? []` com `vinculosNoTeto = false` era falha aberta: um
          timeout nesta consulta — a mais pesada da página — esvaziaria todos os
          conjuntos de "já tem boleto" e devolveria a carteira inteira para a
          fila, com a trava desligada. Um clique geraria boleto para tudo de
          novo. Pior que o bug de 200 que este bloco existe para consertar.
        */
        vinculosNoTeto={!!vinculos.error || (vinculos.data?.length ?? 0) >= TETO_VINCULOS}
        fatsBoleto={(fatsBoleto.data ?? []) as never}
        lancamentosReceber={lancReceber.data ?? []}
      />
    </div>
  );
}

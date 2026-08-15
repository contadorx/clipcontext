import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaContext } from "@/lib/empresa";
import ContratosClient from "@/components/vendas/contratos-client";
import PageHeader from "@/components/ui/page-header";
import ObjectStatus from "@/components/ui/object-status";
import NavIrmaos from "@/components/ui/nav-irmaos";
import { vizinhos } from "@/lib/vizinhos";
import { brl, dataBR } from "@/lib/formato";

export const dynamic = "force-dynamic";

const CICLO: Record<string, string> = {
  mensal: "mensal",
  bimestral: "bimestral",
  trimestral: "trimestral",
  semestral: "semestral",
  anual: "anual",
};

/**
 * Página do contrato.
 *
 * O formulário tem 208 linhas com itens de serviço, ciclo de faturamento,
 * vigência e as opções de NFS-e e boleto. Em diálogo, mexer nos itens rolava
 * uma caixa que já estava dentro de uma tela rolando.
 *
 * Carrega só este contrato — mas os itens de apoio (serviços, clientes,
 * categorias, contas) vêm inteiros: são as listas dos seletores do formulário,
 * e sem elas o contrato apareceria com "categoria removida" no lugar do nome.
 */
export default async function ContratoPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { atual } = await getEmpresaContext();
  const empresaId = atual?.id ?? "";

  const [contrato, itens, servicos, clientes, categorias, contas] = await Promise.all([
    supabase
      .from("contratos")
      .select(
        "id, cliente_fornecedor_id, nome, ciclo, dia_faturamento, data_inicio, data_fim, categoria_id, conta_id, status, gera_nfse, gera_boleto, observacoes, criado_em",
      )
      .eq("id", params.id)
      .maybeSingle(),
    supabase
      .from("contrato_itens")
      .select("id, contrato_id, servico_id, descricao, quantidade, valor_unitario")
      .eq("contrato_id", params.id),
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
  ]);

  // A RLS já barra o que não é da carteira; aqui é só o 404 amigável.
  if (!contrato.data) notFound();

  const c = contrato.data as {
    cliente_fornecedor_id: string;
    nome: string | null;
    ciclo: string | null;
    data_inicio: string | null;
    status: string | null;
    criado_em: string;
  };
  const linhas = (itens.data ?? []) as { quantidade: number | null; valor_unitario: number | null }[];
  const total = linhas.reduce((s, i) => s + Number(i.quantidade ?? 0) * Number(i.valor_unitario ?? 0), 0);
  const cliente =
    ((clientes.data ?? []) as { id: string; nome: string }[]).find((p) => p.id === c.cliente_fornecedor_id)?.nome ?? "—";
  const ativo = (c.status ?? "ativo") === "ativo";

  /*
    `criado_em` decrescente — a MESMA ordem da lista (`/vendas`).

    A primeira versão usava `id`, com a desculpa de que UUID dá "ordem total e
    estável". Dá, e é a ordem errada: as setas andavam numa sequência que a tela
    não mostra em lugar nenhum, e "anterior"/"próximo" ficavam sem referente.
    Ordem total não basta; tem de ser a ordem que a pessoa está vendo.
  */
  const { anteriorId, proximoId } = await vizinhos(supabase, {
    tabela: "contratos",
    coluna: "criado_em",
    valor: c.criado_em,
    id: params.id,
    escopo: { empresa_id: empresaId },
    crescente: false,
  });

  return (
    <div className="space-y-4">
      <PageHeader
        titulo={c.nome || cliente}
        voltar={{ href: "/vendas", label: "Serviços" }}
        sub={[
          cliente,
          c.ciclo ? `faturamento ${CICLO[c.ciclo] ?? c.ciclo}` : null,
          total > 0 ? brl(total) : null,
          c.data_inicio ? `desde ${dataBR(c.data_inicio)}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        acoes={
          <span className="flex items-center gap-2">
            <ObjectStatus pilula tom={ativo ? "positivo" : "neutro"}>
              {ativo ? "Ativo" : "Encerrado"}
            </ObjectStatus>
            <NavIrmaos base="/contratos" anteriorId={anteriorId} proximoId={proximoId} rotulo="Contrato" />
          </span>
        }
      />
      <ContratosClient
        empresaId={empresaId}
        soId={params.id}
        initial={[contrato.data as never]}
        initialItens={(itens.data ?? []) as never}
        servicos={(servicos.data ?? []) as never}
        clientes={(clientes.data ?? []) as never}
        categorias={(categorias.data ?? []) as never}
        contas={(contas.data ?? []) as never}
      />
    </div>
  );
}

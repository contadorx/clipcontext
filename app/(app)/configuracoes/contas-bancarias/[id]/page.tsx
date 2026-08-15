import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaContext } from "@/lib/empresa";
import ContasCrud from "@/components/contas/contas-crud";
import PageHeader from "@/components/ui/page-header";
import { brl } from "@/lib/formato";
import NavIrmaos from "@/components/ui/nav-irmaos";
import { vizinhos } from "@/lib/vizinhos";

export const dynamic = "force-dynamic";

const CAMPOS =
  "id, nome, banco, agencia, agencia_dv, conta_numero, conta_dv, banco_codigo, convenio, convenio_pagamento, carteira, pagador_documento, pagador_nome, nosso_numero_proximo, cnab_seq_cobranca, juros_mes_pct, multa_pct, data_inicio, saldo_inicial";

/**
 * Página da conta bancária.
 *
 * Era o maior formulário em diálogo do app — 303 linhas, com dados da conta,
 * saldo inicial e parâmetros de CNAB e de cobrança. Numa caixa de altura máxima
 * com rolagem própria, dentro de uma página que também rola, achar o campo do
 * convênio custava duas rolagens em eixos diferentes.
 */
export default async function ContaBancariaPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { atual } = await getEmpresaContext();

  const { data } = await supabase.from("contas_bancarias").select(CAMPOS).eq("id", params.id).maybeSingle();
  // A RLS já barra o que não é da carteira; aqui é só o 404 amigável.
  if (!data) notFound();

  const c = data as {
    nome: string;
    banco: string | null;
    agencia: string | null;
    conta_numero: string | null;
    saldo_inicial: number | null;
  };
  const identificacao = [c.banco, c.agencia && `ag. ${c.agencia}`, c.conta_numero && `c/c ${c.conta_numero}`]
    .filter(Boolean)
    .join(" · ");

  // Mesma ordem da lista de contas (nome A→Z).
  const { anteriorId, proximoId } = await vizinhos(supabase, {
    tabela: "contas_bancarias",
    coluna: "nome",
    valor: c.nome,
    id: params.id,
    escopo: { empresa_id: atual?.id ?? "" },
  });

  return (
    <div className="space-y-4">
      <PageHeader
        titulo={c.nome}
        voltar={{ href: "/configuracoes/contas-bancarias", label: "Contas Bancárias" }}
        sub={[identificacao, `saldo inicial ${brl(Number(c.saldo_inicial ?? 0))}`, atual?.nome]
          .filter(Boolean)
          .join(" · ")}
        acoes={
          <NavIrmaos base="/configuracoes/contas-bancarias" anteriorId={anteriorId} proximoId={proximoId} rotulo="Conta" />
        }
      />
      <ContasCrud empresaId={atual?.id ?? ""} initial={[data as never]} soId={params.id} />
    </div>
  );
}

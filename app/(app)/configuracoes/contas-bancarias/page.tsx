
import { createClient } from "@/lib/supabase/server";
import { getEmpresaContext } from "@/lib/empresa";
import ContasCrud from "@/components/contas/contas-crud";
import PageHeader from "@/components/ui/page-header";

export default async function ContasBancariasPage() {
  const { atual } = await getEmpresaContext();
  const empresaId = atual?.id ?? "";

  const supabase = createClient();
  const { data } = await supabase
    .from("contas_bancarias")
    .select("id, nome, banco, agencia, agencia_dv, conta_numero, conta_dv, banco_codigo, convenio, convenio_pagamento, carteira, pagador_documento, pagador_nome, nosso_numero_proximo, cnab_seq_cobranca, juros_mes_pct, multa_pct, data_inicio, saldo_inicial")
    .eq("empresa_id", empresaId)
    .order("nome");

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Contas Bancárias"
        voltar={{ href: "/configuracoes", label: "Configurações" }}
        sub={
          <>
            Empresa: <span className="font-semibold text-ink">{atual?.nome}</span>
          </>
        }
      />

      <ContasCrud empresaId={empresaId} initial={data ?? []} />
    </div>
  );
}

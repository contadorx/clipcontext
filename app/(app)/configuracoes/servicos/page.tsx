import { createClient } from "@/lib/supabase/server";
import { getEmpresaContext } from "@/lib/empresa";
import ServicosCrud from "@/components/vendas/servicos-crud";
import PageHeader from "@/components/ui/page-header";

export default async function ConfigServicosPage() {
  const { atual } = await getEmpresaContext();
  const empresaId = atual?.id ?? "";

  const supabase = createClient();
  const { data } = await supabase
    .from("servicos")
    .select(
      "id, nome, descricao, valor, unidade, ativo, item_lc116, codigo_tributacao_municipal, cnae, aliquota_iss, iss_retido, exigibilidade_iss",
    )
    .eq("empresa_id", empresaId)
    .order("nome");

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Serviços"
        voltar={{ href: "/configuracoes", label: "Configurações" }}
        sub={
          <>
            Catálogo de serviços usado nas vendas e nos contratos, com os dados fiscais da NFS-e. Empresa:{" "}
            <span className="font-semibold text-ink">{atual?.nome}</span>
          </>
        }
      />
      <ServicosCrud empresaId={empresaId} initial={data ?? []} />
    </div>
  );
}

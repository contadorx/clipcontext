
import { createClient } from "@/lib/supabase/server";
import { getEmpresaContext } from "@/lib/empresa";
import OrcamentoTabs from "@/components/cadastros/orcamento-tabs";
import PageHeader from "@/components/ui/page-header";

export default async function OrcamentoPage() {
  const { atual } = await getEmpresaContext();
  const empresaId = atual?.id ?? "";

  const supabase = createClient();
  const [grupos, cats, centros] = await Promise.all([
    supabase.from("grupos_categoria").select("id, nome, ordem").eq("empresa_id", empresaId).order("ordem"),
    supabase.from("categorias").select("id, nome, grupo_id, tipo").eq("empresa_id", empresaId).order("nome"),
    supabase.from("centros_custo").select("id, nome").eq("empresa_id", empresaId).order("nome"),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Orçamento"
        voltar={{ href: "/configuracoes", label: "Configurações" }}
        sub={
          <>
            Meta orçada por categoria ou por centro de custo, mês a mês. Empresa:{" "}
          <span className="font-semibold text-ink">{atual?.nome}</span>
          </>
        }
      />
      <OrcamentoTabs
        empresaId={empresaId}
        grupos={grupos.data ?? []}
        categorias={cats.data ?? []}
        centros={centros.data ?? []}
      />
    </div>
  );
}

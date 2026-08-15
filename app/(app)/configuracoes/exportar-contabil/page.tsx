
import { createClient } from "@/lib/supabase/server";
import { getEmpresaContext } from "@/lib/empresa";
import ExportarContabil from "@/components/contabil/exportar-contabil";
import PageHeader from "@/components/ui/page-header";

export default async function ExportarContabilPage() {
  const { atual } = await getEmpresaContext();
  const empresaId = atual?.id ?? "";

  const supabase = createClient();
  const [emp, contas] = await Promise.all([
    supabase.from("empresas").select("sistema_contabil").eq("id", empresaId).single(),
    supabase
      .from("contas_bancarias")
      .select("id, nome, codigo_contabil")
      .eq("empresa_id", empresaId)
      .order("nome"),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Exportação Contábil"
        voltar={{ href: "/configuracoes", label: "Configurações" }}
        sub={
          <>
            Gere o arquivo de lançamentos contábeis do período. Empresa:{" "}
          <span className="font-semibold text-ink">{atual?.nome}</span>
          </>
        }
      />
      <ExportarContabil
        empresaId={empresaId}
        empresaNome={atual?.nome ?? ""}
        sistema={emp.data?.sistema_contabil ?? ""}
        contas={contas.data ?? []}
      />
    </div>
  );
}


import { createClient } from "@/lib/supabase/server";
import { getEmpresaContext } from "@/lib/empresa";
import CentrosCustoCrud from "@/components/cadastros/centros-custo-crud";
import UsarCentroToggle from "@/components/cadastros/usar-centro-toggle";
import PageHeader from "@/components/ui/page-header";

export default async function CentrosCustoPage() {
  const { atual } = await getEmpresaContext();
  const empresaId = atual?.id ?? "";

  const supabase = createClient();
  const [{ data }, { data: esc }] = await Promise.all([
    supabase.from("centros_custo").select("id, nome").eq("empresa_id", empresaId).order("nome"),
    supabase.from("escritorios").select("id, usar_centro_custo").limit(1).maybeSingle(),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Centros de Custo"
        voltar={{ href: "/configuracoes", label: "Configurações" }}
        sub={
          <>
            Empresa: <span className="font-semibold text-ink">{atual?.nome}</span>
          </>
        }
      />
      <UsarCentroToggle escritorioId={esc?.id ?? ""} inicial={Boolean(esc?.usar_centro_custo)} />
      <CentrosCustoCrud empresaId={empresaId} initial={data ?? []} />
    </div>
  );
}

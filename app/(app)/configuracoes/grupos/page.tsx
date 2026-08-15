
import { createClient } from "@/lib/supabase/server";
import { getEmpresaContext } from "@/lib/empresa";
import GruposDfcManager from "@/components/cadastros/grupos-dfc-manager";
import PageHeader from "@/components/ui/page-header";

export default async function GruposPage() {
  const { atual } = await getEmpresaContext();
  const empresaId = atual?.id ?? "";

  const supabase = createClient();
  const [g, c] = await Promise.all([
    supabase
      .from("grupos_categoria")
      .select("id, nome, secao, eh_receita, ordem")
      .eq("empresa_id", empresaId)
      .order("ordem"),
    supabase.from("categorias").select("id, grupo_id").eq("empresa_id", empresaId),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Grupos de Categorias (DFC)"
        voltar={{ href: "/configuracoes", label: "Configurações" }}
        sub={
          <>
            A estrutura do relatório de fluxo de caixa. Empresa:{" "}
          <span className="font-semibold text-ink">{atual?.nome}</span>
          </>
        }
      />
      <GruposDfcManager empresaId={empresaId} gruposIni={g.data ?? []} categorias={c.data ?? []} />
    </div>
  );
}

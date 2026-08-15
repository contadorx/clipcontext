
import { createClient } from "@/lib/supabase/server";
import { getEmpresaContext } from "@/lib/empresa";
import CategoriasManager from "@/components/cadastros/categorias-manager";
import PageHeader from "@/components/ui/page-header";

export default async function CategoriasPage() {
  const { atual } = await getEmpresaContext();
  const empresaId = atual?.id ?? "";

  const supabase = createClient();
  const [g, c] = await Promise.all([
    supabase
      .from("grupos_categoria")
      .select("id, nome, secao, eh_receita, ordem")
      .eq("empresa_id", empresaId)
      .order("ordem"),
    supabase
      .from("categorias")
      .select("id, nome, grupo_id, tipo")
      .eq("empresa_id", empresaId)
      .order("nome"),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Categorias e Grupos"
        voltar={{ href: "/configuracoes", label: "Configurações" }}
        sub={
          <>
            As categorias alimentam os lançamentos e o relatório. Empresa:{" "}
          <span className="font-semibold text-ink">{atual?.nome}</span>
          </>
        }
      />
      <CategoriasManager empresaId={empresaId} grupos={g.data ?? []} categorias={c.data ?? []} />
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { getEmpresaContext } from "@/lib/empresa";
import ImportarHub from "@/components/importar/importar-hub";
import PageHeader from "@/components/ui/page-header";

const TITULOS: Record<string, string> = {
  clientes: "Importar clientes e fornecedores",
  categorias: "Importar categorias financeiras",
  contas: "Importar contas bancárias",
  plano: "Importar plano de contas contábil",
  lancamentos: "Importar lançamentos",
};

export default async function ImportarPage({ searchParams }: { searchParams: { tipo?: string } }) {
  const tipo = searchParams?.tipo;
  const { atual } = await getEmpresaContext();
  const empresaId = atual?.id ?? "";

  const supabase = createClient();
  const [cat, conta, pessoa, centro, grupo, lancCount, planoCount] = await Promise.all([
    supabase.from("categorias").select("id, nome, tipo").eq("empresa_id", empresaId),
    supabase.from("contas_bancarias").select("id, nome").eq("empresa_id", empresaId),
    supabase.from("clientes_fornecedores").select("id, nome").eq("empresa_id", empresaId),
    supabase.from("centros_custo").select("id, nome").eq("empresa_id", empresaId),
    supabase.from("grupos_categoria").select("id, nome").eq("empresa_id", empresaId),
    supabase.from("lancamentos").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId),
    supabase.from("plano_contas").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId),
  ]);

  const titulo = tipo && TITULOS[tipo] ? TITULOS[tipo] : "Importar dados";

  return (
    <div className="space-y-5">
      <PageHeader
        titulo={titulo}
        sub={
          <>
            Traga dados de uma planilha (Excel ou CSV) ou de outro sistema. Empresa:{" "}
            <span className="font-semibold text-ink">{atual?.nome}</span>
          </>
        }
      />
      <ImportarHub
        empresaId={empresaId}
        contagens={{ lancamentos: lancCount.count ?? 0, plano: planoCount.count ?? 0 }}
        categorias={cat.data ?? []}
        contas={conta.data ?? []}
        pessoas={pessoa.data ?? []}
        centros={centro.data ?? []}
        grupos={grupo.data ?? []}
        inicial={tipo}
      />
    </div>
  );
}

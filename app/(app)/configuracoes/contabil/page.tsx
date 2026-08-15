
import { createClient } from "@/lib/supabase/server";
import { getEmpresaContext } from "@/lib/empresa";
import ContabilConfig from "@/components/cadastros/contabil-config";
import PlanoContasManager from "@/components/cadastros/plano-contas-manager";
import PageHeader from "@/components/ui/page-header";

export default async function ContabilPage() {
  const { atual } = await getEmpresaContext();
  const empresaId = atual?.id ?? "";

  const supabase = createClient();
  const [emp, contas, grupos, cats, contatos, plano] = await Promise.all([
    supabase
      .from("empresas")
      .select(
        "sistema_contabil, versao_contabil, cont_juros_pago, cont_juros_receb, cont_multa, cont_desc_obtido, cont_desc_concedido, cont_pessoas_modo, cont_clientes, cont_fornecedores, cont_historico",
      )
      .eq("id", empresaId)
      .single(),
    supabase
      .from("contas_bancarias")
      .select("id, nome, codigo_contabil")
      .eq("empresa_id", empresaId)
      .order("nome"),
    supabase
      .from("grupos_categoria")
      .select("id, nome, ordem")
      .eq("empresa_id", empresaId)
      .order("ordem"),
    supabase
      .from("categorias")
      .select("id, nome, grupo_id, codigo_contabil, provisionamento, codigo_provisao, visao")
      .eq("empresa_id", empresaId)
      .order("nome"),
    supabase
      .from("clientes_fornecedores")
      .select("id, nome, tipo, codigo_contabil")
      .eq("empresa_id", empresaId)
      .order("nome"),
    supabase
      .from("plano_contas")
      .select("id, codigo, nome, tipo, natureza, analitica")
      .eq("empresa_id", empresaId)
      .order("codigo"),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Configurações Contábeis"
        voltar={{ href: "/configuracoes", label: "Configurações" }}
        sub={
          <>
            Sistema contábil e plano de contas para a exportação. Empresa:{" "}
          <span className="font-semibold text-ink">{atual?.nome}</span>
          </>
        }
      />
      <PlanoContasManager empresaId={empresaId} inicial={plano.data ?? []} />
      <ContabilConfig
        empresaId={empresaId}
        sistemaInicial={emp.data?.sistema_contabil ?? ""}
        versaoInicial={emp.data?.versao_contabil ?? ""}
        encargosInicial={{
          jurosPago: emp.data?.cont_juros_pago ?? "",
          jurosReceb: emp.data?.cont_juros_receb ?? "",
          multa: emp.data?.cont_multa ?? "",
          descObtido: emp.data?.cont_desc_obtido ?? "",
          descConcedido: emp.data?.cont_desc_concedido ?? "",
        }}
        pessoasModoInicial={emp.data?.cont_pessoas_modo === "analitico" ? "analitico" : "sintetico"}
        clientesInicial={emp.data?.cont_clientes ?? ""}
        fornecedoresInicial={emp.data?.cont_fornecedores ?? ""}
        historicoInicial={emp.data?.cont_historico ?? ""}
        contas={contas.data ?? []}
        grupos={grupos.data ?? []}
        categorias={cats.data ?? []}
        contatos={contatos.data ?? []}
        planoContas={(plano.data ?? [])
          .filter((c: { analitica: boolean }) => c.analitica)
          .map((c: { codigo: string; nome: string }) => ({ codigo: c.codigo, nome: c.nome }))}
      />
    </div>
  );
}

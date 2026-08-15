
import { createClient } from "@/lib/supabase/server";
import { getEmpresaContext } from "@/lib/empresa";
import DadosEmpresa from "@/components/empresa/dados-empresa";
import PageHeader from "@/components/ui/page-header";

export default async function DadosEmpresaPage() {
  const { atual } = await getEmpresaContext();
  const empresaId = atual?.id ?? "";

  const supabase = createClient();
  const { data } = await supabase
    .from("empresas")
    .select("nome, cnpj_cpf, razao_social, nome_fantasia, regime_tributario, uf, municipio")
    .eq("id", empresaId)
    .single();

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Dados da empresa"
        voltar={{ href: "/configuracoes", label: "Configurações" }}
        sub={
          <>
            Identificação e dados fiscais. Empresa: <span className="font-semibold text-ink">{atual?.nome}</span>
          </>
        }
      />
      <DadosEmpresa
        empresaId={empresaId}
        inicial={{
          nome: data?.nome ?? "",
          cnpjCpf: data?.cnpj_cpf ?? "",
          razaoSocial: data?.razao_social ?? "",
          nomeFantasia: data?.nome_fantasia ?? "",
          regimeTributario: data?.regime_tributario ?? "",
          uf: data?.uf ?? "",
          municipio: data?.municipio ?? "",
        }}
      />
    </div>
  );
}

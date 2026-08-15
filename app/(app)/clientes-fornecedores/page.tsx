import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/page-header";
import { getEmpresaContext } from "@/lib/empresa";
import ClientesFornecedoresCrud from "@/components/cadastros/clientes-fornecedores-crud";

export default async function ClientesFornecedoresPage() {
  const { atual } = await getEmpresaContext();
  const empresaId = atual?.id ?? "";

  const supabase = createClient();
  const { data } = await supabase
    .from("clientes_fornecedores")
    .select(
      "id, nome, tipo, pessoa_tipo, email, telefone, cpf_cnpj, razao_social, nome_fantasia, inscricao_estadual, inscricao_municipal, codigo_contabil, cep, logradouro, endereco_numero, complemento, bairro, municipio, uf, codigo_ibge, fav_banco_codigo, fav_agencia, fav_conta, fav_conta_dv, fav_conta_tipo, fav_chave_pix, fav_tipo_chave_pix, tags, ativo, observacoes",
    )
    .eq("empresa_id", empresaId)
    .order("nome");

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Clientes e Fornecedores"
        sub={<>Empresa: <span className="font-semibold text-ink">{atual?.nome}</span></>}
      />
      <ClientesFornecedoresCrud empresaId={empresaId} initial={data ?? []} />
    </div>
  );
}

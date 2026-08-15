import { createClient } from "@/lib/supabase/server";
import { getEmpresaContext } from "@/lib/empresa";
import NfseConfigClient from "@/components/nfse/nfse-config-client";
import PageHeader from "@/components/ui/page-header";

export default async function ConfigNfsePage() {
  const { atual } = await getEmpresaContext();
  const empresaId = atual?.id ?? "";

  const supabase = createClient();
  const [{ data: config }, { data: empresa }] = await Promise.all([
    supabase
      .from("nfse_config")
      .select(
        "inscricao_municipal, codigo_municipio_ibge, op_simples, serie_dps, proximo_numero_dps, ambiente, cert_path, cert_validade, cert_cn",
      )
      .eq("empresa_id", empresaId)
      .maybeSingle(),
    supabase
      .from("empresas")
      .select("nome, cnpj_cpf, razao_social, regime_tributario, municipio, uf")
      .eq("id", empresaId)
      .maybeSingle(),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Nota fiscal (NFS-e)"
        voltar={{ href: "/configuracoes", label: "Configurações" }}
        sub={
          <>
            Dados do emitente e certificado digital para emissão pela NFS-e Nacional. Empresa:{" "}
            <span className="font-semibold text-ink">{atual?.nome}</span>
          </>
        }
      />
      <NfseConfigClient empresaId={empresaId} config={config} empresa={empresa} />
    </div>
  );
}


import { createClient } from "@/lib/supabase/server";
import { getEmpresaContext } from "@/lib/empresa";
import ModelosPlanoContas from "@/components/cadastros/modelos-plano-contas";
import PageHeader from "@/components/ui/page-header";

export default async function ModelosPlanoContasPage() {
  const supabase = createClient();
  const { empresas } = await getEmpresaContext();
  const { data: esc } = await supabase.from("escritorios").select("id").limit(1).maybeSingle();
  const { data: modelos } = await supabase
    .from("modelos_plano_contas")
    .select("id, nome, estrutura, criado_em")
    .order("criado_em");

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Modelos de plano de contas"
        voltar={{ href: "/configuracoes", label: "Configurações" }}
        sub="Padrões do escritório que você aplica em qualquer empresa para padronizar o plano de contas."
      />
      <ModelosPlanoContas
        escritorioId={esc?.id ?? ""}
        empresas={empresas}
        modelosIni={(modelos as never) ?? []}
      />
    </div>
  );
}

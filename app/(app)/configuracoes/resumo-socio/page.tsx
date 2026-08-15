import { createClient } from "@/lib/supabase/server";
import { getEmpresaContext } from "@/lib/empresa";
import ResumoSocioConfig, { type ResumoCfg } from "@/components/digest/resumo-socio-config";
import PageHeader from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

export default async function ResumoSocioPage() {
  const { atual } = await getEmpresaContext();
  const empresaId = atual?.id ?? "";
  const supabase = createClient();

  let inicial: ResumoCfg | null = null;
  if (empresaId) {
    const { data } = await supabase
      .from("resumo_socio_config")
      .select("ativo, periodicidade, email_socio")
      .eq("empresa_id", empresaId)
      .maybeSingle();
    inicial = (data as ResumoCfg) ?? null;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Resumo financeiro ao sócio"
        voltar={{ href: "/configuracoes", label: "Configurações" }}
        sub={
          <>
            Envie automaticamente um resumo financeiro de <b>{atual?.nome ?? "esta empresa"}</b> para o sócio,
            na periodicidade que você escolher.
          </>
        }
      />
      <div className="mx-auto max-w-2xl">
        <ResumoSocioConfig empresaId={empresaId} inicial={inicial} />
      </div>
    </div>
  );
}

import { getEmpresaContext } from "@/lib/empresa";
import FluxoClient from "@/components/fluxo/fluxo-client";
import PageHeader from "@/components/ui/page-header";

export default async function FluxoPage() {
  const { atual } = await getEmpresaContext();
  return (
    <div className="space-y-5">
      <PageHeader titulo="Fluxo de Caixa" sub="Projeção do saldo por conta, com o previsto e o realizado." />
      <FluxoClient empresaId={atual?.id ?? ""} />
    </div>
  );
}

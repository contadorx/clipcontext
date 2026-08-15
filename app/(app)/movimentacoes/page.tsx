import { getEmpresaContext } from "@/lib/empresa";
import MovimentacoesContas from "@/components/movimentacoes/movimentacoes-contas";
import PageHeader from "@/components/ui/page-header";

export default async function MovimentacoesPage() {
  const { atual } = await getEmpresaContext();
  const id = atual?.id ?? "";
  return (
    <div className="space-y-4">
      <PageHeader titulo="Movimentações & contas" sub="Lançamentos e extrato por conta no mesmo lugar." />
      <MovimentacoesContas empresaId={id} />
    </div>
  );
}

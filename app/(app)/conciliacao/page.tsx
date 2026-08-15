import { createClient } from "@/lib/supabase/server";
import { getEmpresaContext } from "@/lib/empresa";
import ConciliacaoClient from "@/components/conciliacao/conciliacao-client";

/**
 * O `PageHeader` desta tela mora no cliente, e não aqui.
 *
 * A conta bancária é o controle que manda em tudo — trocá-la refaz as seis
 * consultas da tela. Ela vivia numa faixa branca própria abaixo do cabeçalho,
 * junto de quatro botões de importar; a faixa inteira existia para hospedar um
 * `<select>`. Para a conta subir ao cabeçalho, o cabeçalho precisa enxergar o
 * estado do cliente, então ele desceu para lá.
 */
export default async function ConciliacaoPage() {
  const { atual } = await getEmpresaContext();
  const empresaId = atual?.id ?? "";

  const supabase = createClient();
  const { data } = await supabase
    .from("contas_bancarias")
    .select("id, nome")
    .eq("empresa_id", empresaId)
    .order("nome");

  return (
    <div className="space-y-5">
      <ConciliacaoClient empresaId={empresaId} empresaNome={atual?.nome ?? ""} contas={data ?? []} />
    </div>
  );
}


import { createClient } from "@/lib/supabase/server";
import GerenciarClient, { type EmpresaGestao } from "@/components/carteira/gerenciar-client";
import { configParaRow } from "@/lib/precos";
import { carregarPrecoConfig } from "@/lib/precos-server";
import PageHeader from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

export default async function GerenciarCarteiraPage() {
  const supabase = createClient();
  const [emp, colab] = await Promise.all([
    supabase
      .from("empresas")
      .select("id, nome, cnpj_cpf, status, entrada_em, arquivada_em, honorario, responsavel_id")
      .order("status")
      .order("nome"),
    supabase.rpc("listar_colaboradores"),
  ]);
  const empresas = (emp.data ?? []) as EmpresaGestao[];
  const colaboradores = ((colab.data as { user_id: string; email: string }[]) ?? []).map((c) => ({
    user_id: c.user_id,
    email: c.email,
  }));

  const cfg = configParaRow(await carregarPrecoConfig());

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Gerenciar carteira"
        voltar={{ href: "/carteira", label: "Carteira" }}
        sub="Suas empresas, ativas e arquivadas. Arquive as que saíram da operação e reative quando voltarem — assim sua
          carteira reflete só quem você atende hoje."
      />
      <GerenciarClient empresas={empresas} colaboradores={colaboradores} cfg={cfg} />
    </div>
  );
}

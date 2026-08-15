
import { createClient } from "@/lib/supabase/server";
import AssinaturaConfig from "@/components/cadastros/assinatura-config";
import { configParaRow } from "@/lib/precos";
import { carregarPrecoConfig } from "@/lib/precos-server";
import type { Ciclo } from "@/lib/precos";
import PageHeader from "@/components/ui/page-header";

export default async function AssinaturaPage() {
  const supabase = createClient();
  const [{ data: esc }, { count }] = await Promise.all([
    supabase
      .from("escritorios")
      .select("id, assinatura_status, ciclo_cobranca, trial_expira_em, asaas_subscription_id, assinatura_qtd")
      .limit(1)
      .maybeSingle(),
    supabase.from("empresas").select("id", { count: "exact", head: true }).eq("status", "ativa"),
  ]);

  const cfg = configParaRow(await carregarPrecoConfig());

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Assinatura"
        voltar={{ href: "/configuracoes", label: "Configurações" }}
        sub="Escolha o ciclo. O preço acompanha o número de empresas, com desconto por volume."
      />
      <AssinaturaConfig
        escritorioId={esc?.id ?? ""}
        nEmpresas={count ?? 0}
        qtdContratada={esc?.assinatura_qtd ?? null}
        statusInicial={esc?.assinatura_status ?? "trial"}
        cicloInicial={(esc?.ciclo_cobranca as Ciclo | null) ?? null}
        trialExpira={esc?.trial_expira_em ?? null}
        temAssinatura={Boolean(esc?.asaas_subscription_id)}
        cfg={cfg}
      />
    </div>
  );
}


import { createClient } from "@/lib/supabase/server";
import MarcaConfig from "@/components/cadastros/marca-config";
import PageHeader from "@/components/ui/page-header";

export default async function MarcaPage() {
  const supabase = createClient();
  const { data: esc } = await supabase
    .from("escritorios")
    .select("id, nome, logo_url")
    .limit(1)
    .maybeSingle();

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Marca do escritório"
        voltar={{ href: "/configuracoes", label: "Configurações" }}
        sub="Nome e logo que aparecem no app e no portal do cliente."
      />
      <MarcaConfig
        escritorioId={esc?.id ?? ""}
        nomeInicial={esc?.nome ?? ""}
        logoInicial={esc?.logo_url ?? null}
      />
    </div>
  );
}

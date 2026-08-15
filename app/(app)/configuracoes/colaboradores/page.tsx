
import { createClient } from "@/lib/supabase/server";
import Colaboradores from "@/components/cadastros/colaboradores";
import PageHeader from "@/components/ui/page-header";

export default async function ColaboradoresPage() {
  const supabase = createClient();
  const { data } = await supabase.from("empresas").select("id, nome").order("nome");
  const empresas = (data as { id: string; nome: string }[]) ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Colaboradores"
        voltar={{ href: "/configuracoes", label: "Configurações" }}
        sub="Convide pessoas para a sua equipe e defina o acesso. Analistas só enxergam as empresas vinculadas a eles."
      />

      <Colaboradores empresas={empresas} />
    </div>
  );
}


import { createClient } from "@/lib/supabase/server";
import { getEmpresaContext } from "@/lib/empresa";
import DigestConfigClient from "@/components/digest/digest-config";
import PageHeader from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

export default async function ResumoDiarioPage() {
  const { atual } = await getEmpresaContext();
  const empresaId = atual?.id ?? "";
  const supabase = createClient();

  // resolve escritorio_id + papel do usuário
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let escritorioId = "";
  let podeEditar = false;
  let emailDestino = "";
  let inicial: { ativo: boolean; apenas_dias_uteis: boolean } | null = null;

  if (user && empresaId) {
    const { data: emp } = await supabase.from("empresas").select("escritorio_id").eq("id", empresaId).maybeSingle();
    escritorioId = (emp?.escritorio_id as string) ?? "";
    if (escritorioId) {
      const [{ data: membro }, { data: esc }, { data: cfg }] = await Promise.all([
        supabase.from("membros").select("papel").eq("user_id", user.id).eq("escritorio_id", escritorioId).maybeSingle(),
        supabase.from("escritorios").select("owner_id").eq("id", escritorioId).maybeSingle(),
        supabase
          .from("digest_config")
          .select("ativo, apenas_dias_uteis")
          .eq("escritorio_id", escritorioId)
          .maybeSingle(),
      ]);
      const papel = (membro?.papel as string) ?? "membro";
      podeEditar = papel === "owner" || papel === "gestor";
      inicial = cfg ?? null;
      // e-mail destino = e-mail do owner (quem recebe o digest)
      if (esc?.owner_id === user.id) emailDestino = user.email ?? "";
      else emailDestino = "o e-mail do responsável pelo escritório";
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Resumo diário por e-mail"
        voltar={{ href: "/configuracoes", label: "Configurações" }}
        sub="A operação da sua carteira inteira, todo dia de manhã."
      />
      <DigestConfigClient
        escritorioId={escritorioId}
        podeEditar={podeEditar}
        emailDestino={emailDestino}
        inicial={inicial}
      />
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Lock } from "lucide-react";
import { PERSONA_PADRAO } from "@/lib/assistente";
import AdminAssistente from "@/components/admin/admin-assistente";

export const dynamic = "force-dynamic";

export default async function AssistentePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: adminRow } = await supabase
    .from("membros")
    .select("super_admin")
    .eq("user_id", user?.id ?? "")
    .eq("super_admin", true)
    .maybeSingle();

  if (!adminRow) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-sm rounded-xl2 bg-white p-8 text-center shadow-card">
          <Lock size={24} className="mx-auto text-ink-soft" />
          <h1 className="mt-2 text-lg font-bold text-ink">Página restrita</h1>
          <p className="mt-1 text-sm text-ink-muted">O assistente é configurável só por administradores.</p>
        </div>
      </div>
    );
  }

  let systemPrompt = "";
  let modelo = "";
  let atualizadoEm: string | null = null;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("assistente_config")
      .select("system_prompt, modelo, atualizado_em")
      .eq("id", 1)
      .maybeSingle();
    systemPrompt = data?.system_prompt || "";
    modelo = data?.modelo || "";
    atualizadoEm = data?.atualizado_em || null;
  } catch {
    /* tabela ainda não criada */
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <AdminAssistente
        systemPromptInicial={systemPrompt}
        modeloInicial={modelo}
        atualizadoEm={atualizadoEm}
        padrao={PERSONA_PADRAO}
      />
    </div>
  );
}

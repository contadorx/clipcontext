import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Lock } from "lucide-react";
import AdminComunicacao, { type PassoRow } from "@/components/admin/admin-comunicacao";

export const dynamic = "force-dynamic";

export default async function ComunicacaoPage() {
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
          <p className="mt-1 text-sm text-ink-muted">A régua de comunicação é visível só para administradores.</p>
        </div>
      </div>
    );
  }

  let ativa = true;
  let passos: PassoRow[] = [];
  try {
    const admin = createAdminClient();
    const { data: cfg } = await admin
      .from("comunicacao_config")
      .select("ativa")
      .eq("id", 1)
      .maybeSingle();
    if (cfg) ativa = cfg.ativa;
    const { data } = await admin
      .from("comunicacao_passos")
      .select("id, momento, quando, assunto, corpo, botao_texto, path, ativo, ordem")
      .order("ordem", { ascending: true });
    passos = (data ?? []) as PassoRow[];
  } catch {
    /* sem service role: tela vazia */
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <AdminComunicacao ativaInicial={ativa} passos={passos} />
    </div>
  );
}

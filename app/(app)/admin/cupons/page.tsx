import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Lock } from "lucide-react";
import AdminCupons, { type CupomRow } from "@/components/admin/admin-cupons";

export const dynamic = "force-dynamic";

export default async function CuponsPage() {
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
          <p className="mt-1 text-sm text-ink-muted">Os cupons são visíveis só para administradores.</p>
        </div>
      </div>
    );
  }

  let cupons: CupomRow[] = [];
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("cupons")
      .select("id, codigo, percentual, duracao_meses, ativo, max_usos, usos, criado_em")
      .order("criado_em", { ascending: false });
    cupons = (data ?? []) as CupomRow[];
  } catch {
    /* sem service role: lista vazia */
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <AdminCupons cupons={cupons} />
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { carregarPrecoConfig } from "@/lib/precos-server";
import { configParaRow } from "@/lib/precos";
import PrecosConfigAdmin from "@/components/admin/precos-config";
import { Lock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminPrecosPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let isAdmin = false;
  if (user) {
    const { data } = await supabase.from("membros").select("super_admin").eq("user_id", user.id).eq("super_admin", true).maybeSingle();
    isAdmin = !!data;
  }
  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-sm rounded-xl2 bg-white p-8 text-center shadow-card">
          <Lock size={24} className="mx-auto text-ink-soft" />
          <h1 className="mt-2 text-lg font-bold text-ink">Painel restrito</h1>
          <p className="mt-1 text-sm text-ink-muted">Esta área é só para administradores do FinanceiroX.</p>
        </div>
      </div>
    );
  }
  const cfg = configParaRow(await carregarPrecoConfig());
  return <PrecosConfigAdmin inicial={cfg} />;
}

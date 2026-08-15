import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Lock } from "lucide-react";
import AdminAjuda, { type FaqRow, type VideoRow } from "@/components/admin/admin-ajuda";

export const dynamic = "force-dynamic";

export default async function AjudaAdminPage() {
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
          <p className="mt-1 text-sm text-ink-muted">A Central de Ajuda é editável só por administradores.</p>
        </div>
      </div>
    );
  }

  let faqs: FaqRow[] = [];
  let videos: VideoRow[] = [];
  try {
    const admin = createAdminClient();
    const [{ data: f }, { data: v }] = await Promise.all([
      admin.from("faq").select("id, categoria, pergunta, resposta, imagem_url, destaque, publicado, ordem").order("ordem"),
      admin.from("ajuda_videos").select("id, titulo, descricao, url, em_breve, publicado, ordem").order("ordem"),
    ]);
    faqs = (f ?? []) as FaqRow[];
    videos = (v ?? []) as VideoRow[];
  } catch {
    /* sem service role */
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <AdminAjuda faqsIni={faqs} videosIni={videos} />
    </div>
  );
}

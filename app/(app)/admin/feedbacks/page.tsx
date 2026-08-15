import { Lock, Lightbulb, Bug, Heart, Inbox } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/page-header";

type FeedbackRow = {
  id: string;
  tipo: string;
  mensagem: string;
  pagina: string | null;
  created_at: string;
  escritorio: { nome: string | null } | null;
};

const META: Record<string, { l: string; cls: string; Icon: typeof Lightbulb }> = {
  ideia: { l: "Ideia", cls: "bg-brand-light text-brand-dark", Icon: Lightbulb },
  problema: { l: "Problema", cls: "bg-rose-50 text-danger", Icon: Bug },
  elogio: { l: "Elogio", cls: "bg-amber-100 text-amber-800", Icon: Heart },
};

function quando(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default async function FeedbacksPage() {
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
          <p className="mt-1 text-sm text-ink-muted">Os feedbacks são visíveis só para administradores.</p>
        </div>
      </div>
    );
  }

  const { data } = await supabase
    .from("feedbacks")
    .select("id, tipo, mensagem, pagina, created_at, escritorio:escritorios(nome)")
    .order("created_at", { ascending: false })
    .limit(300);
  const lista = ((data ?? []) as unknown) as FeedbackRow[];

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Feedbacks"
        voltar={{ href: "/admin", label: "Painel do negócio" }}
        sub="O que os escritórios estão enviando pela aba lateral."
      />

      {lista.length === 0 ? (
        <div className="rounded-xl2 bg-white p-10 text-center shadow-card">
          <Inbox size={26} className="mx-auto text-ink-soft" />
          <p className="mt-2 text-sm text-ink-muted">Nenhum feedback ainda.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {lista.map((f) => {
            const m = META[f.tipo] ?? META.ideia;
            return (
              <div key={f.id} className="rounded-xl2 bg-white p-4 shadow-card">
                <div className="mb-1.5 flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${m.cls}`}>
                    <m.Icon size={12} /> {m.l}
                  </span>
                  <span className="text-xs font-medium text-ink">{f.escritorio?.nome ?? "—"}</span>
                  <span className="ml-auto text-[11px] text-ink-soft">{quando(f.created_at)}</span>
                </div>
                <p className="whitespace-pre-line text-sm text-ink-muted">{f.mensagem}</p>
                {f.pagina && <p className="mt-1.5 text-[11px] text-ink-soft">em {f.pagina}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

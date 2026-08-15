"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const DENSIDADES = [
  { id: "compacta", label: "Compacta", sub: "mais linhas por tela" },
  { id: "confortavel", label: "Confortável", sub: "tamanho natural" },
  { id: "ampla", label: "Ampla", sub: "texto maior" },
] as const;

export default function UserMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [densidade, setDensidade] = useState<string>("compacta");
  const router = useRouter();
  const inicial = (email.trim()[0] || "U").toUpperCase();

  useEffect(() => {
    const atual = document.documentElement.getAttribute("data-densidade");
    if (atual) setDensidade(atual);
  }, []);

  // Densidade da interface: antes era 0.9 fixo no CSS para todo mundo — quem
  // precisava de texto maior só tinha o zoom do navegador. Agora é preferência
  // de cada pessoa, gravada em cookie e aplicada na hora.
  function mudarDensidade(id: string) {
    setDensidade(id);
    document.documentElement.setAttribute("data-densidade", id);
    document.cookie = `fx_densidade=${id}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  }

  async function sair() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-light text-xs font-bold text-brand-dark transition hover:bg-brand/20"
        title={email}
      >
        {inicial}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1.5 w-56 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-card">
            <p className="truncate px-3 py-2 text-xs text-ink-muted">{email}</p>

            <div className="border-t border-line px-3 pb-1.5 pt-2">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-ink-soft">
                Densidade da tela
              </p>
              {DENSIDADES.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => mudarDensidade(d.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left transition hover:bg-surface"
                >
                  <span className="flex-1">
                    <span className="block text-[13px] font-semibold text-ink">{d.label}</span>
                    <span className="block text-[10.5px] text-ink-soft">{d.sub}</span>
                  </span>
                  {densidade === d.id && <Check size={14} className="text-brand" />}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={sair}
              className="flex w-full items-center gap-2 border-t border-line px-3 py-2 text-left text-sm text-ink transition hover:bg-surface"
            >
              <LogOut size={16} className="text-ink-soft" />
              Sair
            </button>
          </div>
        </>
      )}
    </div>
  );
}

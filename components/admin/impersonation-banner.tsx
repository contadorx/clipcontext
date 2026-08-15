"use client";

import { useState } from "react";
import { ShieldAlert } from "lucide-react";

export default function ImpersonationBanner({ nome }: { nome: string }) {
  const [saindo, setSaindo] = useState(false);

  async function sair() {
    setSaindo(true);
    try {
      await fetch("/api/admin/impersonar/sair", { method: "POST" });
    } catch {
      /* ignora; recarrega de qualquer forma */
    }
    // recarrega forçando a nova sessão (do admin)
    window.location.href = "/admin";
  }

  return (
    <div className="sticky top-0 z-[60] flex items-center justify-center gap-3 bg-danger px-4 py-2 text-sm text-white shadow">
      <ShieldAlert size={16} className="shrink-0" />
      <span className="text-center">
        Acesso de suporte — você está usando o sistema como <b>{nome}</b>.
      </span>
      <button
        type="button"
        onClick={sair}
        disabled={saindo}
        className="shrink-0 rounded-lg bg-white/15 px-3 py-1 text-xs font-semibold transition hover:bg-white/25 disabled:opacity-60"
      >
        {saindo ? "Saindo…" : "Sair do acesso"}
      </button>
    </div>
  );
}

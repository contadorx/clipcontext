"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, ChevronDown, Check, Plus, Search, ListChecks } from "lucide-react";
import type { Empresa } from "@/lib/empresa";
import { selecionarEmpresa } from "@/app/actions";
import { NovaEmpresaModal } from "@/components/empresa/nova-empresa";

export default function EmpresaSelector({
  empresas,
  atualId,
  papel = "membro",
}: {
  empresas: Empresa[];
  atualId: string;
  papel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [novaAberto, setNovaAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const router = useRouter();
  const sel = empresas.find((e) => e.id === atualId) ?? empresas[0];
  const filtradas = empresas.filter((e) => e.nome.toLowerCase().includes(busca.trim().toLowerCase()));

  // atalho global: "E" abre o seletor de empresa (ignora quando digitando)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key !== "e" && e.key !== "E") return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
      e.preventDefault();
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function escolher(id: string) {
    setOpen(false);
    if (id === atualId) return;
    await selecionarEmpresa(id);
    router.refresh();
  }

  async function aoCriarEmpresa(id: string) {
    await selecionarEmpresa(id);
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 items-center gap-2 rounded-md border border-line bg-white px-2.5 text-[12.5px] font-semibold text-ink transition hover:border-brand"
      >
        <Building2 size={16} className="text-brand" />
        <span className="max-w-[180px] truncate">{sel?.nome}</span>
        <kbd className="hidden rounded border border-line px-1 text-[10px] font-semibold text-ink-soft sm:inline">E</kbd>
        <ChevronDown size={16} className="text-ink-soft" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => { setOpen(false); setBusca(""); }} />
          <div className="absolute left-0 z-20 mt-1.5 w-64 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-card">
            <div className="px-2 pb-1.5 pt-1">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft" />
                <input
                  autoFocus
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar empresa…"
                  className="w-full rounded-lg border border-line py-1.5 pl-8 pr-2 text-sm outline-none focus:border-brand"
                />
              </div>
            </div>
            <div className="max-h-72 overflow-auto">
              {filtradas.length === 0 ? (
                <p className="px-3 py-3 text-center text-xs text-ink-soft">Nada encontrado</p>
              ) : (
                filtradas.map((e) => {
                  const active = e.id === sel?.id;
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => { setBusca(""); escolher(e.id); }}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-ink transition hover:bg-surface"
                    >
                      <span className={active ? "font-semibold text-brand" : ""}>
                        {e.nome}
                      </span>
                      {active && <Check size={16} className="text-brand" />}
                    </button>
                  );
                })
              )}
            </div>
            {papel !== "analista" && papel !== "contabilidade" && (
              <button
                type="button"
                onClick={() => { setOpen(false); setNovaAberto(true); }}
                className="flex w-full items-center gap-2 border-t border-line px-3 py-2.5 text-left text-sm font-semibold text-brand transition hover:bg-surface"
              >
                <Plus size={16} /> Nova empresa
              </button>
            )}
            {papel !== "analista" && papel !== "contabilidade" && sel && (
              <button
                type="button"
                onClick={() => { setOpen(false); setBusca(""); router.push(`/empresas/${sel.id}/configurar`); }}
                className="flex w-full items-center gap-2 border-t border-line px-3 py-2.5 text-left text-sm font-medium text-ink-muted transition hover:bg-surface"
              >
                <ListChecks size={15} /> Configurar empresa
              </button>
            )}
          </div>
        </>
      )}

      <NovaEmpresaModal aberto={novaAberto} onFechar={() => setNovaAberto(false)} aoCriar={aoCriarEmpresa} />
    </div>
  );
}

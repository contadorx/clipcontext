"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, ChevronDown, Check } from "lucide-react";
import { selecionarPeriodo } from "@/app/actions";

const OPCOES = [
  { v: "mes", label: "Este mês" },
  { v: "3meses", label: "Últimos 3 meses" },
  { v: "ano", label: "Este ano" },
];

export default function PeriodoSelector({
  preset,
  label,
}: {
  preset: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function escolher(v: string) {
    setOpen(false);
    if (v === preset) return;
    await selecionarPeriodo(v);
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 items-center gap-2 rounded-md border border-line bg-white px-2.5 text-[12.5px] font-medium text-ink-muted transition hover:border-brand"
      >
        <Calendar size={16} className="text-ink-soft" />
        <span className="num">{label}</span>
        <ChevronDown size={16} className="text-ink-soft" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1.5 w-52 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-card">
            {OPCOES.map((o) => {
              const ativo = o.v === preset;
              return (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => escolher(o.v)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-ink transition hover:bg-surface"
                >
                  <span className={ativo ? "font-semibold text-brand" : ""}>{o.label}</span>
                  {ativo && <Check size={16} className="text-brand" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

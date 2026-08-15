"use client";

import { useRouter } from "next/navigation";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function PortalPeriodo({
  base,
  ano,
  v,
  t,
  m,
  aba = "resultado",
}: {
  base: string;
  ano: number;
  v: string;
  t: number;
  m: number;
  aba?: string;
}) {
  const router = useRouter();
  const go = (p: { v?: string; t?: number; m?: number }) => {
    const nv = p.v ?? v;
    const nt = p.t ?? t;
    const nm = p.m ?? m;
    router.push(`${base}?aba=${aba}&ano=${ano}&v=${nv}&t=${nt}&m=${nm}`);
  };

  const opcoes = [
    { v: "ano", l: "Ano" },
    { v: "tri", l: "Trimestre" },
    { v: "mes", l: "Mês" },
  ];
  const on = "rounded-md bg-ink px-3 py-1.5 text-sm font-semibold text-white";
  const off = "rounded-md px-3 py-1.5 text-sm font-medium text-ink-muted transition hover:bg-surface";
  const sel = "rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-1 items-center gap-0.5 rounded-lg border border-line p-0.5 sm:flex-none">
        {opcoes.map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => go({ v: o.v })}
            className={`flex-1 sm:flex-none ${v === o.v ? on : off}`}
          >
            {o.l}
          </button>
        ))}
      </div>

      {v === "tri" && (
        <select value={t} onChange={(e) => go({ t: Number(e.target.value) })} className={sel}>
          {[1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>
              {n}º trimestre
            </option>
          ))}
        </select>
      )}

      {v === "mes" && (
        <select value={m} onChange={(e) => go({ m: Number(e.target.value) })} className={sel}>
          {MESES.map((mes, i) => (
            <option key={mes} value={i + 1}>
              {mes}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

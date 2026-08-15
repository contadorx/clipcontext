"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, Wallet, TrendingUp, GitCompareArrows } from "lucide-react";
import LancamentosClient from "@/components/lancamentos/lancamentos-client";
import ExtratosClient from "@/components/extratos/extratos-client";
import FluxoClient from "@/components/fluxo/fluxo-client";
import NovoLancamento from "@/components/lancamentos/novo-lancamento";

type Aba = "lancamentos" | "extratos" | "fluxo";

const ABAS: { id: Aba; label: string; icon: typeof Wallet }[] = [
  { id: "lancamentos", label: "Movimentações", icon: ArrowLeftRight },
  { id: "extratos", label: "Contas e extratos", icon: Wallet },
  { id: "fluxo", label: "Fluxo de caixa", icon: TrendingUp },
];

export default function PainelHub({ empresaId }: { empresaId: string }) {
  const [aba, setAba] = useState<Aba>("lancamentos");

  return (
    <div className="space-y-4">
      {/* barra de ações + abas */}
      <div className="flex flex-col gap-3 rounded-xl2 bg-white p-2 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1">
          {ABAS.map(({ id, label, icon: Icon }) => {
            const ativo = aba === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setAba(id)}
                className={[
                  "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition",
                  ativo ? "bg-brand text-white" : "text-ink-muted hover:bg-surface",
                ].join(" ")}
              >
                <Icon size={15} /> {label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2 sm:pr-1">
          {aba !== "lancamentos" && <NovoLancamento empresaId={empresaId} variant="button" />}
          <Link
            href="/conciliacao"
            className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink transition hover:border-brand hover:text-brand"
          >
            <GitCompareArrows size={15} /> Conciliar
          </Link>
        </div>
      </div>

      {/* conteúdo da aba */}
      <div>
        {aba === "lancamentos" && <LancamentosClient empresaId={empresaId} />}
        {aba === "extratos" && <ExtratosClient empresaId={empresaId} />}
        {aba === "fluxo" && <FluxoClient empresaId={empresaId} />}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Card from "@/components/ui/card";
import { Inbox } from "lucide-react";
import type { LinhaLanc } from "@/lib/painel";
import CriarLancamentoBotao from "@/components/painel/criar-lancamento-botao";
import { brl, dataBR } from "@/lib/formato";
import EmptyState from "@/components/ui/empty-state";

type Tom = "brand" | "accent";
type Dados = { emAberto: LinhaLanc[]; efetuados: LinhaLanc[]; vencidos: LinhaLanc[] };

export default function ContasList({
  titulo,
  tom,
  dados,
  empresaId,
}: {
  titulo: string;
  tom: Tom;
  dados: Dados;
  empresaId: string;
}) {
  const [aba, setAba] = useState<keyof Dados>("emAberto");
  const linhas = dados[aba];
  const total = linhas.reduce((s, l) => s + Number(l.valor), 0);

  // Cor é significado: entrada em teal, saída em tinta neutra. O magenta é cor
  // de marca — usá-lo como "a pagar" fazia toda despesa parecer problema.
  const cor = tom === "brand" ? "text-brand" : "text-ink";
  const borda = tom === "brand" ? "border-brand" : "border-line";
  const botao = tom === "brand" ? "bg-brand hover:bg-brand-dark" : "bg-ink hover:bg-rail-hover";

  const abas: { chave: keyof Dados; label: string }[] = [
    { chave: "emAberto", label: "Em aberto" },
    { chave: "efetuados", label: "Efetuados" },
    { chave: "vencidos", label: "Vencidos" },
  ];

  return (
    <Card
      titulo={titulo}
      acoes={
        <CriarLancamentoBotao
          empresaId={empresaId}
          tipo={tom === "brand" ? "entrada" : "saida"}
          classe={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold text-white transition ${botao}`}
        />
      }
      rodape={
        <>
          <span className="font-semibold text-ink-muted">Total</span>
          <span className="num font-bold text-ink">{brl(total)}</span>
        </>
      }
    >

      <div className="mb-2 flex gap-4 border-b border-line">
        {abas.map((a) => {
          const ativa = a.chave === aba;
          return (
            <button
              key={a.chave}
              type="button"
              onClick={() => setAba(a.chave)}
              className={[
                "-mb-px border-b-2 pb-2 text-xs font-semibold transition",
                ativa ? `${borda} ${cor}` : "border-transparent text-ink-soft hover:text-ink-muted",
              ].join(" ")}
            >
              {a.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-[80px_1fr_110px] gap-2 py-1.5 text-[11px] font-semibold text-ink-soft">
        <span>Venc.</span>
        <span>Descrição</span>
        <span className="text-right">Valor</span>
      </div>

      {linhas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-ink-soft">
          <Inbox size={24} strokeWidth={1.5} />
          <EmptyState compacto titulo="Não há dados" />
        </div>
      ) : (
        <div className="max-h-56 overflow-auto">
          {linhas.map((l) => (
            <div
              key={l.id}
              className="grid grid-cols-[80px_1fr_110px] items-center gap-2 border-b border-line py-2 text-sm last:border-0"
            >
              <span className="num text-ink-muted">{dataBR(l.data_vencimento)}</span>
              <span className="truncate text-ink">{l.descricao || "—"}</span>
              <span className={`num text-right font-medium ${cor}`}>{brl(Number(l.valor))}</span>
            </div>
          ))}
        </div>
      )}

    </Card>
  );
}

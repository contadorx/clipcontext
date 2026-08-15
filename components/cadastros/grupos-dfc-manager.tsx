"use client";

import Link from "next/link";

import { FolderTree } from "lucide-react";
import EmptyState from "@/components/ui/empty-state";

type Grupo = { id: string; nome: string; secao: string; eh_receita: boolean; ordem: number };
type Categoria = { id: string; grupo_id: string };

const SECOES = [
  { v: "operacionais", l: "Atividades Operacionais", resultado: true },
  { v: "financeiro", l: "Resultado Financeiro", resultado: true },
  { v: "caixa", l: "Atividades de Caixa", resultado: false },
];

export default function GruposDfcManager({
  gruposIni,
  categorias,
}: {
  empresaId: string;
  gruposIni: Grupo[];
  categorias: Categoria[];
}) {
  const grupos = gruposIni;
  const contar = (id: string) => categorias.filter((c) => c.grupo_id === id).length;
  const daSecao = (s: string) =>
    grupos.filter((g) => g.secao === s).sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome));

  return (
    <div className="space-y-5">
      <p className="rounded-xl2 border border-line bg-surface/50 px-4 py-3 text-sm text-ink-muted">
        Os grupos são fixos e padronizados — não dá para criar nem renomear. Você organiza suas contas nos{" "}
        <b>subgrupos</b>,{" "}
        <Link href="/configuracoes/categorias" className="font-semibold text-brand underline underline-offset-2">
          na tela de Categorias
        </Link>
        . As seções Operacional e Financeiro entram no resultado; Investimento e Financiamento são só movimentação de
        caixa (fora do resultado).
      </p>

      {SECOES.map((s) => {
        const lista = daSecao(s.v);
        return (
          <div key={s.v} className="rounded-xl2 bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <h2 className="text-[13px] font-bold text-ink">{s.l}</h2>
              {!s.resultado && (
                <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-ink-soft">
                  fora do resultado
                </span>
              )}
            </div>
            {lista.length === 0 ? (
              <EmptyState compacto titulo="Nenhum grupo nesta seção" />
            ) : (
              <div className="px-5 py-1">
                {lista.map((g) => (
                  <div key={g.id} className="flex items-center gap-3 border-b border-line/60 py-2.5 last:border-0">
                    <FolderTree size={14} className="text-ink-soft" />
                    <span className="flex-1 text-sm text-ink">{g.nome}</span>
                    <span className="w-24 text-right text-[11px] text-ink-soft">{contar(g.id)} subgrupo(s)</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

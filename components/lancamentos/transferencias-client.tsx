"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, ArrowRight, Repeat2, Inbox, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import LancamentoModal from "@/components/lancamentos/lancamento-modal";
import { SortToggle, ordenar, toggleOrd, type Ordenacao } from "@/components/ui/sort";
import PageHeader from "@/components/ui/page-header";
import { SkeletonLinhas } from "@/components/ui/skeleton";
import { brl, dataBR } from "@/lib/formato";

type Linha = {
  par: string;
  data: string;
  valor: number;
  origem: string;
  destino: string;
  ids: string[];
};

export default function TransferenciasClient({ empresaId }: { empresaId: string }) {
  const router = useRouter();
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [ord, setOrd] = useState<Ordenacao>({ campo: "data", dir: "desc" });
  const [transfer, setTransfer] = useState(false);

  const carregar = useCallback(async () => {
    if (!empresaId) return;
    setCarregando(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("lancamentos")
      .select("id, tipo, valor, data_pagamento, data_vencimento, transferencia_par_id, conta:contas_bancarias(nome)")
      .eq("empresa_id", empresaId)
      .eq("transferencia", true)
      .order("data_vencimento", { ascending: false });

    const rows =
      (data as unknown as Array<{
        id: string;
        tipo: "entrada" | "saida";
        valor: number;
        data_pagamento: string | null;
        data_vencimento: string;
        transferencia_par_id: string | null;
        conta: { nome: string } | null;
      }>) ?? [];

    // agrupa por par (saída = origem, entrada = destino)
    const mapa = new Map<string, Linha>();
    for (const r of rows) {
      const par = r.transferencia_par_id ?? r.id;
      const atual =
        mapa.get(par) ??
        ({ par, data: r.data_pagamento ?? r.data_vencimento, valor: Number(r.valor), origem: "—", destino: "—", ids: [] } as Linha);
      if (r.tipo === "saida") atual.origem = r.conta?.nome ?? "—";
      else atual.destino = r.conta?.nome ?? "—";
      atual.valor = Number(r.valor);
      atual.data = r.data_pagamento ?? r.data_vencimento;
      atual.ids.push(r.id);
      mapa.set(par, atual);
    }
    setLinhas(Array.from(mapa.values()).sort((a, b) => b.data.localeCompare(a.data)));
    setCarregando(false);
  }, [empresaId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function excluir(l: Linha) {
    if (!confirm("Excluir esta transferência? As duas pontas serão removidas.")) return;
    const supabase = createClient();
    const { error } = await supabase.from("lancamentos").delete().in("id", l.ids);
    if (error) {
      alert(error.message);
      return;
    }
    await carregar();
    router.refresh();
  }

  const total = linhas.reduce((s, l) => s + l.valor, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Transferências"
        sub="Movimentações entre contas da mesma empresa — não entram no resultado."
        acoes={
          <button
            type="button"
            onClick={() => setTransfer(true)}
            className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
          >
            <Plus size={15} /> Nova transferência
          </button>
        }
      />

      <div className="rounded-xl2 bg-white shadow-card max-xl:overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="[&>th]:sticky [&>th]:top-[calc(52px_+_var(--fs-cab,0px))] [&>th]:z-10 [&>th]:bg-white border-b border-line text-[11px] font-semibold text-ink-soft">
              <th className="px-5 py-2.5 text-left"><SortToggle label="Data" campo="data" inicial="asc" ord={ord} onToggle={(c, i) => setOrd((o) => toggleOrd(o, c, i))} /></th>
              <th className="px-4 py-2.5 text-left">De</th>
              <th className="px-4 py-2.5 text-left">Para</th>
              <th className="px-4 py-2.5 text-right"><SortToggle label="Valor" campo="valor" align="right" ord={ord} onToggle={(c, i) => setOrd((o) => toggleOrd(o, c, i))} /></th>
              <th className="px-5 py-2.5 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr>
                <td colSpan={5} className="p-0">
                  <SkeletonLinhas linhas={5} colunas={5} />
                </td>
              </tr>
            ) : linhas.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-ink-soft">
                  <span className="flex flex-col items-center gap-2">
                    <Inbox size={24} strokeWidth={1.5} />
                    Nenhuma transferência ainda.
                  </span>
                </td>
              </tr>
            ) : (
              ordenar(linhas, ord, { data: (l) => l.data, valor: (l) => Number(l.valor) }).map((l) => (
                <tr key={l.par} className="border-b border-line/60 last:border-0">
                  <td className="num px-5 py-2.5 text-ink-muted">{dataBR(l.data)}</td>
                  <td className="px-4 py-2.5 text-ink">{l.origem}</td>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-1.5 text-ink">
                      <ArrowRight size={13} className="text-ink-soft" /> {l.destino}
                    </span>
                  </td>
                  <td className="num px-4 py-2.5 text-right font-semibold text-ink">{brl(l.valor)}</td>
                  <td className="px-5 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => excluir(l)}
                      title="Excluir transferência"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition hover:bg-rose-50 hover:text-danger"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))
            )}
            {linhas.length > 0 && (
              <tr className="border-t border-line">
                <td className="px-5 py-2.5 text-xs font-semibold text-ink-muted" colSpan={3}>
                  Total movimentado entre contas
                </td>
                <td className="num px-4 py-2.5 text-right font-bold text-ink">{brl(total)}</td>
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="flex items-center gap-1.5 text-[11px] text-ink-soft">
        <Repeat2 size={13} /> Transferências movem o saldo entre contas e não entram nos relatórios de resultado.
      </p>

      <LancamentoModal
        empresaId={empresaId}
        aberto={transfer}
        tipo="transferencia"
        travar
        onFechar={() => setTransfer(false)}
        onSalvo={() => carregar()}
      />
    </div>
  );
}

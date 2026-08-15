"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileCheck, Download, Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import EmptyState from "@/components/ui/empty-state";
import { brl } from "@/lib/formato";

export type RetornoResumo = {
  id: string;
  criado_em: string;
  arquivo_nome: string | null;
  quantidade: number | null;
  valor_total: number | null;
};

function dataHora(s: string): string {
  return new Date(s).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RetornosProcessados({ retornos }: { retornos: RetornoResumo[] }) {
  const router = useRouter();
  const [baixando, setBaixando] = useState<string | null>(null);
  const [aExcluir, setAExcluir] = useState<RetornoResumo | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function baixar(r: RetornoResumo) {
    setBaixando(r.id);
    setErro(null);
    const supabase = createClient();
    const { data, error } = await supabase.from("cnab_retornos").select("conteudo, arquivo_nome").eq("id", r.id).single();
    setBaixando(null);
    const conteudo = (data as { conteudo: string | null } | null)?.conteudo;
    if (error || !conteudo) {
      setErro("Não foi possível recuperar o arquivo deste retorno.");
      return;
    }
    const blob = new Blob([conteudo], { type: "text/plain;charset=us-ascii" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (data as { arquivo_nome: string | null }).arquivo_nome || `retorno_${r.id.slice(0, 8)}.RET`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function excluir(r: RetornoResumo) {
    setExcluindo(true);
    setErro(null);
    const supabase = createClient();
    const { error } = await supabase.from("cnab_retornos").delete().eq("id", r.id);
    setExcluindo(false);
    if (error) {
      setErro("Não foi possível excluir o arquivo.");
      return;
    }
    setAExcluir(null);
    router.refresh();
  }

  return (
    <div className="rounded-xl2 bg-white shadow-card">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <FileCheck size={16} className="text-ink-soft" />
        <h2 className="text-[13px] font-bold text-ink">Retornos processados</h2>
      </div>

      {erro && (
        <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg border border-danger/30 bg-rose-50 px-3 py-2 text-xs text-danger">
          <AlertTriangle size={14} /> {erro}
        </div>
      )}

      {retornos.length === 0 ? (
        <EmptyState compacto titulo="Nenhum arquivo de retorno processado ainda" />
      ) : (
        <div className="divide-y divide-line/60">
          {retornos.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span className="min-w-0 flex-1 truncate text-ink-muted">
                {dataHora(r.criado_em)}
                {r.arquivo_nome && <span className="ml-2 truncate text-ink-soft">· {r.arquivo_nome}</span>}
              </span>
              <span className="shrink-0 text-ink">{r.quantidade ?? 0} baixa(s)</span>
              <span className="num shrink-0 font-semibold text-ink">{brl(Number(r.valor_total ?? 0))}</span>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => baixar(r)}
                  disabled={baixando === r.id}
                  title="Baixar arquivo"
                  className="flex items-center justify-center rounded-lg p-1.5 text-ink-soft transition hover:bg-surface hover:text-brand disabled:opacity-60"
                >
                  {baixando === r.id ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                </button>
                <button
                  type="button"
                  onClick={() => setAExcluir(r)}
                  title="Excluir do histórico"
                  className="flex items-center justify-center rounded-lg p-1.5 text-ink-soft transition hover:bg-surface hover:text-danger"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {aExcluir && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-rail/50 backdrop-blur-[1px] p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAExcluir(null);
          }}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="dlg-excluir-retorno-titulo" className="w-full max-w-md rounded-xl2 bg-white shadow-card">
            <div className="flex items-center gap-2 border-b border-line px-5 py-3">
              <AlertTriangle size={18} className="text-danger" />
              <h3 id="dlg-excluir-retorno-titulo" className="text-[13px] font-bold text-ink">Excluir arquivo de retorno</h3>
            </div>
            <div className="px-5 py-4 text-sm text-ink-muted">
              <p>
                Excluir <b className="text-ink">{aExcluir.arquivo_nome || "este retorno"}</b> do histórico?
              </p>
              <p className="mt-2 text-[13px] text-ink-soft">
                Isso remove apenas o arquivo guardado. As baixas já aplicadas nos lançamentos não são desfeitas.
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
              <button
                type="button"
                data-fechar
                onClick={() => setAExcluir(null)}
                className="rounded-md border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-muted transition hover:border-brand hover:text-brand"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={() => excluir(aExcluir)}
                disabled={excluindo}
                className="rounded-lg bg-danger px-3 py-1.5 text-[12.5px] font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
              >
                {excluindo ? "Excluindo…" : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

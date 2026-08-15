import { FileText } from "lucide-react";
import EmptyState from "@/components/ui/empty-state";
import { brl } from "@/lib/formato";

export type RemessaResumo = {
  id: string;
  criado_em: string;
  tipo: string | null;
  quantidade: number | null;
  valor_total: number | null;
  sequencial: number | null;
};

function dataHora(s: string): string {
  const d = new Date(s);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RemessasEnviadas({ remessas }: { remessas: RemessaResumo[] }) {
  return (
    <div className="rounded-xl2 bg-white shadow-card">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <FileText size={16} className="text-ink-soft" />
        <h2 className="text-[13px] font-bold text-ink">Remessas enviadas</h2>
      </div>

      {remessas.length === 0 ? (
        <EmptyState compacto titulo="Nenhuma remessa gerada ainda" />
      ) : (
        <div className="divide-y divide-line/60">
          {remessas.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span className="text-ink-muted">
                {dataHora(r.criado_em)}
                <span className="ml-2 rounded bg-surface px-1.5 py-0.5 text-[10px] font-medium text-ink-soft">
                  seq {String(r.sequencial ?? 0).padStart(5, "0")}
                </span>
              </span>
              <span className="text-ink">{r.quantidade ?? 0} pagamento(s)</span>
              <span className="num font-semibold text-ink">{brl(Number(r.valor_total ?? 0))}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

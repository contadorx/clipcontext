import { LogIn, Upload, Activity } from "lucide-react";
import EmptyState from "@/components/ui/empty-state";

export type AuditoriaItem = {
  id: string;
  acao: string;
  detalhe: string | null;
  email: string | null;
  criado_em: string;
};

const fmtData = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

function descreve(acao: string): { label: string; Icon: typeof LogIn } {
  if (acao === "upload") return { label: "Enviou documento", Icon: Upload };
  if (acao === "login") return { label: "Acessou o portal", Icon: LogIn };
  return { label: acao, Icon: Activity };
}

export default function PortalAuditoria({ itens }: { itens: AuditoriaItem[] }) {
  return (
    <div className="rounded-xl2 border border-line bg-surface p-5 shadow-card">
      <div className="flex items-center gap-2">
        <Activity size={18} className="text-brand" />
        <h2 className="text-base font-bold text-ink">Registro de atividade</h2>
      </div>
      <p className="mt-1 text-sm text-ink-muted">
        Acessos e envios de documentos feitos pelos usuários do portal desta empresa.
      </p>

      <div className="mt-4">
        {itens.length === 0 ? (
          <EmptyState titulo="Nenhuma atividade registrada ainda." />
        ) : (
          <ul className="divide-y divide-line">
            {itens.map((it) => {
              const { label, Icon } = descreve(it.acao);
              return (
                <li key={it.id} className="flex items-start gap-3 py-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                    <Icon size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">
                      {label}
                      {it.acao === "upload" && it.detalhe && (
                        <span className="font-normal text-ink-muted"> · {it.detalhe}</span>
                      )}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-ink-soft">
                      {it.email ?? "—"} · {fmtData.format(new Date(it.criado_em))}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Sun } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function DigestConfigClient({
  escritorioId,
  podeEditar,
  emailDestino,
  inicial,
}: {
  escritorioId: string;
  podeEditar: boolean;
  emailDestino: string;
  inicial: { ativo: boolean; apenas_dias_uteis: boolean } | null;
}) {
  const router = useRouter();
  const [ativo, setAtivo] = useState(inicial?.ativo ?? false);
  const [diasUteis, setDiasUteis] = useState(inicial?.apenas_dias_uteis ?? true);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function salvar(novoAtivo: boolean, novoDiasUteis: boolean) {
    if (!podeEditar) return;
    setSalvando(true);
    setMsg(null);
    const supabase = createClient();
    const { error } = await supabase.from("digest_config").upsert(
      {
        escritorio_id: escritorioId,
        ativo: novoAtivo,
        apenas_dias_uteis: novoDiasUteis,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "escritorio_id" },
    );
    setSalvando(false);
    setMsg(error ? error.message : "Preferência salva.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5 rounded-xl2 border border-line bg-surface/50 px-4 py-3">
        <Sun size={18} className="mt-0.5 shrink-0 text-brand" />
        <p className="text-xs text-ink-muted">
          Receba todo dia de manhã, por e-mail, uma fotografia da sua carteira: o que vence hoje, o que está em
          atraso, o que entrou e saiu ontem e o saldo consolidado. Some os números de todas as empresas ativas num
          único resumo.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl2 bg-white shadow-card">
        <label className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3.5">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">Enviar o resumo diário</p>
            <p className="text-[11px] text-ink-soft">
              Chega às 7h (horário de Brasília) em <span className="font-medium text-ink-muted">{emailDestino || "—"}</span>
            </p>
          </div>
          <input
            type="checkbox"
            checked={ativo}
            disabled={!podeEditar || salvando}
            onChange={(e) => {
              setAtivo(e.target.checked);
              salvar(e.target.checked, diasUteis);
            }}
            className="h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full bg-line transition checked:bg-brand disabled:opacity-50 relative before:absolute before:left-0.5 before:top-0.5 before:h-4 before:w-4 before:rounded-full before:bg-white before:transition checked:before:translate-x-4"
          />
        </label>

        <div className="border-t border-line/60">
          <label className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3.5">
            <div className="min-w-0">
              <p className={`text-sm font-semibold ${ativo ? "text-ink" : "text-ink-soft"}`}>Apenas em dias úteis</p>
              <p className="text-[11px] text-ink-soft">Não envia aos sábados e domingos</p>
            </div>
            <input
              type="checkbox"
              checked={diasUteis}
              disabled={!podeEditar || salvando || !ativo}
              onChange={(e) => {
                setDiasUteis(e.target.checked);
                salvar(ativo, e.target.checked);
              }}
              className="h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full bg-line transition checked:bg-brand disabled:opacity-50 relative before:absolute before:left-0.5 before:top-0.5 before:h-4 before:w-4 before:rounded-full before:bg-white before:transition checked:before:translate-x-4"
            />
          </label>
        </div>
      </div>

      {msg && <p className="text-xs font-semibold text-brand">{msg}</p>}

      <p className="flex items-center gap-1.5 text-[11px] text-ink-soft">
        <Mail size={12} /> Dias sem nada a vencer, vencer ou movimentar não geram e-mail — o resumo só chega quando há
        algo que vale a sua atenção.
      </p>

      {!podeEditar && (
        <p className="text-[11px] text-ink-soft">
          Só o responsável (owner) ou um gestor pode alterar esta preferência.
        </p>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import EmptyState from "@/components/ui/empty-state";
import { brl, dataBR } from "@/lib/formato";
import Botao from "@/components/ui/botao";

type Config = { ativa: boolean; dias_antes: number; no_vencimento: boolean; dias_depois: number } | null;
type Lembrete = { id: string; tipo: string; email: string; enviado_em: string; titulo: { sacado_nome: string | null; valor: number; vencimento: string } | null };

const TIPOS: Record<string, string> = { antes: "antes do vencimento", vencimento: "no vencimento", apos: "após o vencimento" };

export default function LembretesConfig({
  empresaId,
  config,
  lembretes,
  clientesSemEmail,
}: {
  empresaId: string;
  config: Config;
  lembretes: Lembrete[];
  clientesSemEmail: number;
}) {
  const router = useRouter();
  const [ativa, setAtiva] = useState(config?.ativa ?? false);
  const [diasAntes, setDiasAntes] = useState(String(config?.dias_antes ?? 3));
  const [noVenc, setNoVenc] = useState(config?.no_vencimento ?? true);
  const [diasDepois, setDiasDepois] = useState(String(config?.dias_depois ?? 5));
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  async function salvar() {
    setSalvando(true);
    setMsg(null);
    const supabase = createClient();
    const { error } = await supabase.from("boleto_lembretes_config").upsert({
      empresa_id: empresaId,
      ativa,
      dias_antes: Math.max(0, Math.min(30, Number(diasAntes) || 0)),
      no_vencimento: noVenc,
      dias_depois: Math.max(0, Math.min(60, Number(diasDepois) || 0)),
      atualizado_em: new Date().toISOString(),
    });
    setSalvando(false);
    if (error) {
      setMsg({ tipo: "erro", texto: error.message });
      return;
    }
    setMsg({ tipo: "ok", texto: ativa ? "Lembretes ativos — os envios saem uma vez por dia, pela manhã." : "Lembretes salvos (desativados)." });
    router.refresh();
  }

  const inputCls = "num w-20 rounded-md border border-line px-2.5 py-1.5 text-[12.5px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";

  return (
    <div className="space-y-4">
      <div className="rounded-xl2 bg-white p-4 shadow-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BellRing size={16} className="text-brand" />
            <h2 className="text-[13px] font-bold text-ink">Lembretes automáticos por e-mail</h2>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-ink">
            <input type="checkbox" checked={ativa} onChange={(e) => setAtiva(e.target.checked)} className="h-4 w-4 accent-[#12A594]" />
            {ativa ? "Ativos" : "Desativados"}
          </label>
        </div>
        <p className="mt-1 text-xs text-ink-muted">
          O cliente recebe um e-mail com o valor, o vencimento e a linha digitável do boleto. Vale para boletos gerados,
          em remessa ou registrados — boletos liquidados nunca recebem lembrete.
        </p>

        <div className="mt-4 space-y-3 text-sm text-ink">
          <div className="flex items-center gap-2">
            <input
              value={diasAntes}
              onChange={(e) => setDiasAntes(e.target.value.replace(/\D/g, ""))}
              className={inputCls}
            />
            <span>dias <b>antes</b> do vencimento (0 = não enviar)</span>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={noVenc} onChange={(e) => setNoVenc(e.target.checked)} className="h-4 w-4 accent-[#12A594]" />
            <span>enviar <b>no dia</b> do vencimento</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={diasDepois}
              onChange={(e) => setDiasDepois(e.target.value.replace(/\D/g, ""))}
              className={inputCls}
            />
            <span>dias <b>após</b> o vencimento, se não pago (0 = não enviar)</span>
          </div>
        </div>

        {clientesSemEmail > 0 && (
          <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-ink">
            <b>{clientesSemEmail} cliente(s) sem e-mail</b> no cadastro não receberão lembretes — complete em Clientes e Fornecedores.
          </p>
        )}

        {msg && (
          <p className={`mt-3 text-xs font-semibold ${msg.tipo === "erro" ? "text-danger" : "text-brand"}`}>{msg.texto}</p>
        )}

        <Botao variante="primario" className="mt-4"
          onClick={salvar}
          disabled={salvando}
        >
          <Save size={14} /> {salvando ? "Salvando…" : "Salvar"}
        </Botao>
      </div>

      <div className="overflow-hidden rounded-xl2 bg-white shadow-card">
        <div className="border-b border-line bg-surface/50 px-4 py-2.5">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Últimos lembretes enviados</p>
        </div>
        {lembretes.length === 0 ? (
          <EmptyState compacto titulo="Nenhum lembrete enviado ainda" />
        ) : (
          lembretes.map((l) => (
            <div key={l.id} className="flex items-center gap-3 border-b border-line/60 px-4 py-2.5 text-sm last:border-0">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">{l.titulo?.sacado_nome ?? l.email}</p>
                <p className="text-[11px] text-ink-soft">
                  {TIPOS[l.tipo] ?? l.tipo} · {l.email} · boleto venc. {l.titulo ? dataBR(l.titulo.vencimento) : "—"}
                </p>
              </div>
              {l.titulo && <span className="num shrink-0 text-xs font-semibold text-ink">{brl(l.titulo.valor)}</span>}
              <span className="shrink-0 text-[11px] text-ink-soft">{dataBR(l.enviado_em)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Check } from "lucide-react";
import MessageStrip from "@/components/ui/message-strip";
import Botao from "@/components/ui/botao";

export type ResumoCfg = { ativo: boolean; periodicidade: string; email_socio: string | null };

const PERIODOS = [
  { v: "diario", l: "Diário (dias úteis)" },
  { v: "semanal", l: "Semanal" },
  { v: "quinzenal", l: "Quinzenal" },
  { v: "mensal", l: "Mensal" },
];

export default function ResumoSocioConfig({ empresaId, inicial }: { empresaId: string; inicial: ResumoCfg | null }) {
  const [ativo, setAtivo] = useState(inicial?.ativo ?? false);
  const [periodicidade, setPeriodicidade] = useState(inicial?.periodicidade ?? "mensal");
  const [email, setEmail] = useState(inicial?.email_socio ?? "");
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setErro(null);
    setMsg(null);
    if (ativo && (!email.trim() || !email.includes("@"))) {
      setErro("Informe um e-mail válido do sócio para ativar o envio.");
      return;
    }
    setSalvando(true);
    const supabase = createClient();
    const { error } = await supabase.from("resumo_socio_config").upsert(
      { empresa_id: empresaId, ativo, periodicidade, email_socio: email.trim() || null },
      { onConflict: "empresa_id" },
    );
    setSalvando(false);
    if (error) setErro(error.message);
    else setMsg("Configuração salva.");
  }

  const inp = "w-full rounded-md border border-line px-2.5 py-1.5 text-[12.5px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";

  return (
    <div className="space-y-4 rounded-xl2 bg-white p-4 shadow-card">
      <label className="flex items-center gap-3">
        <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="h-4 w-4" />
        <span className="text-sm font-semibold text-ink">Enviar resumo financeiro ao sócio</span>
      </label>

      <div>
        <label className="mb-1 block text-[11px] font-semibold text-ink-soft">E-mail do sócio</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="socio@empresa.com.br" className={inp} />
      </div>

      <div>
        <label className="mb-1 block text-[11px] font-semibold text-ink-soft">Periodicidade</label>
        <select value={periodicidade} onChange={(e) => setPeriodicidade(e.target.value)} className={inp}>
          {PERIODOS.map((p) => (
            <option key={p.v} value={p.v}>{p.l}</option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-ink-soft">
          O resumo traz saldo atual, recebido e pago no mês, a receber e a pagar em aberto, e saldo previsto.
        </p>
      </div>

      {erro && <MessageStrip tipo="erro">{erro}</MessageStrip>}
      {msg && <p className="flex items-center gap-1.5 text-sm font-medium text-brand"><Check size={15} /> {msg}</p>}

      <Botao variante="primario" onClick={salvar} disabled={salvando}>
        {salvando ? "Salvando…" : "Salvar"}
      </Botao>
    </div>
  );
}

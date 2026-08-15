"use client";

import { useState } from "react";
import { Building2, Check, Zap } from "lucide-react";
import PageHeader from "@/components/ui/page-header";
import MessageStrip from "@/components/ui/message-strip";
import { brl } from "@/lib/formato";
import Botao from "@/components/ui/botao";
import { classeControle } from "@/components/ui/campo";

export type EmpresaOpt = { id: string; nome: string };

function mesAtual(): string {
  return new Date().toISOString().slice(0, 7);
}

export default function NegocioFaturamento({ empresas, masterIdIni }: { empresas: EmpresaOpt[]; masterIdIni: string | null }) {
  const [masterId, setMasterId] = useState(masterIdIni ?? "");
  const [comp, setComp] = useState(mesAtual());
  const [salvandoMaster, setSalvandoMaster] = useState(false);
  const [lancando, setLancando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ lancados: number; total: number; ja_feitos: number; erros: string[] } | null>(null);

  async function definirMaster() {
    setErro(null); setMsg(null);
    setSalvandoMaster(true);
    const res = await fetch("/api/admin/negocio-faturamento", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao: "definir_master", empresa_master_id: masterId || null }),
    });
    const j = await res.json().catch(() => ({}));
    setSalvandoMaster(false);
    if (!res.ok) setErro(j.erro || "Falha ao salvar.");
    else setMsg("Empresa Master definida.");
  }

  async function lancar() {
    setErro(null); setMsg(null); setResultado(null);
    if (!masterId) { setErro("Defina a empresa Master primeiro."); return; }
    setLancando(true);
    const res = await fetch("/api/admin/negocio-faturamento", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao: "lancar", competencia: comp }),
    });
    const j = await res.json().catch(() => ({}));
    setLancando(false);
    if (!res.ok) { setErro(j.erro || "Falha ao lançar."); return; }
    setResultado({ lancados: j.lancados ?? 0, total: j.total ?? 0, ja_feitos: j.ja_feitos ?? 0, erros: j.erros ?? [] });
  }

  const inp = "w-full rounded-md border border-line px-2.5 py-1.5 text-[12.5px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Faturamento do negócio"
        sub="Lança a receita de assinatura dos escritórios pagantes como contas a receber na sua empresa Master."
      />

      {erro && <MessageStrip tipo="erro">{erro}</MessageStrip>}
      {msg && <p className="flex items-center gap-1.5 text-sm font-medium text-brand"><Check size={15} /> {msg}</p>}

      {/* empresa Master */}
      <div className="space-y-3 rounded-xl2 bg-white p-4 shadow-card">
        <h2 className="flex items-center gap-2 text-sm font-bold text-ink"><Building2 size={16} /> Empresa Master</h2>
        <p className="text-[12px] text-ink-soft">Onde os faturamentos vão entrar (a sua própria empresa).</p>
        <select value={masterId} onChange={(e) => setMasterId(e.target.value)} className={inp}>
          <option value="">— escolher empresa —</option>
          {empresas.map((e) => (
            <option key={e.id} value={e.id}>{e.nome}</option>
          ))}
        </select>
        <Botao variante="primario" onClick={definirMaster} disabled={salvandoMaster}>
          {salvandoMaster ? "Salvando…" : "Salvar empresa Master"}
        </Botao>
      </div>

      {/* lançar */}
      <div className="space-y-3 rounded-xl2 bg-white p-4 shadow-card">
        <h2 className="flex items-center gap-2 text-sm font-bold text-ink"><Zap size={16} /> Lançar faturamentos do mês</h2>
        <p className="text-[12px] text-ink-soft">
          Cria uma conta a receber por escritório pagante na competência escolhida. Pode rodar mais de uma vez — não duplica.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-ink-soft">Competência</label>
            <input type="month" value={comp} onChange={(e) => setComp(e.target.value)} className={classeControle("md", false, "num")} />
          </div>
          <Botao variante="primario" onClick={lancar} disabled={lancando}>
            <Zap size={14} /> {lancando ? "Lançando…" : "Lançar faturamentos"}
          </Botao>
        </div>
        {resultado && (
          <div className="rounded-lg bg-brand-light px-3 py-2 text-sm text-brand-dark">
            {resultado.lancados} lançamento(s) criado(s) · {brl(resultado.total)}.
            {resultado.ja_feitos > 0 && ` ${resultado.ja_feitos} já estavam lançados (pulados).`}
            {resultado.erros.length > 0 && (
              <span className="mt-1 block text-danger">{resultado.erros.length} erro(s): {resultado.erros.slice(0, 3).join(" · ")}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Save, Send, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import EmptyState from "@/components/ui/empty-state";
import { brl, dataBR } from "@/lib/formato";
import Botao from "@/components/ui/botao";
import { classeControle } from "@/components/ui/campo";

export type EmpresaOpt = { id: string; nome: string };
export type ServicoOpt = { id: string; nome: string; item_lc116: string | null };
export type Assinante = {
  id: string;
  nome: string;
  assinatura_status: string;
  ciclo_cobranca: string | null;
  valor_mensal: number | null;
  assinatura_qtd: number | null;
  ultimo_pagamento_em: string | null;
  asaas_customer_id: string | null;
};
export type NotaAdmin = {
  id: string;
  referencia: string | null;
  valor_servico: number;
  status: string;
  ambiente: string;
  nfse_numero: string | null;
  pdf_url: string | null;
  motivo_erro: string | null;
  emitida_em: string | null;
  criado_em: string;
};

function mesAtual(): string {
  return new Date().toISOString().slice(0, 7);
}

export default function AdminNotasClient({
  configInicial,
  masterIdIni,
  empresas,
  servicos,
  assinantes,
  notas,
}: {
  configInicial: { empresa_emissora_id: string | null; servico_id: string | null } | null;
  masterIdIni: string | null;
  empresas: EmpresaOpt[];
  servicos: ServicoOpt[];
  assinantes: Assinante[];
  notas: NotaAdmin[];
}) {
  const router = useRouter();
  const [emissoraId, setEmissoraId] = useState(configInicial?.empresa_emissora_id ?? "");
  const [servicoId, setServicoId] = useState(configInicial?.servico_id ?? "");
  const [salvandoCfg, setSalvandoCfg] = useState(false);
  const [masterId, setMasterId] = useState(masterIdIni ?? "");
  const [salvandoMaster, setSalvandoMaster] = useState(false);
  const [comp, setComp] = useState(mesAtual());
  const [valores, setValores] = useState<Record<string, string>>({});
  const [emitindo, setEmitindo] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  const servicosDaEmissora = useMemo(() => servicos.filter((s) => true), [servicos]);
  const configPronta = !!emissoraId && !!servicoId;

  // notas da competência selecionada, indexadas por escritório (via referencia)
  const notaPorEscritorio = useMemo(() => {
    const m = new Map<string, NotaAdmin>();
    for (const n of notas) {
      const match = n.referencia?.match(/^assinatura:([0-9a-f-]+):(\d{4}-\d{2})$/);
      if (match && match[2] === comp && (n.status === "emitida" || n.status === "rejeitada")) {
        // mantém a mais recente por escritório (lista já vem desc)
        if (!m.has(match[1])) m.set(match[1], n);
      }
    }
    return m;
  }, [notas, comp]);

  async function salvarConfig() {
    setSalvandoCfg(true);
    setMsg(null);
    const supabase = createClient();
    const { error } = await supabase.from("admin_nfse_config").upsert({
      id: 1,
      empresa_emissora_id: emissoraId || null,
      servico_id: servicoId || null,
      atualizado_em: new Date().toISOString(),
    });
    setSalvandoCfg(false);
    if (error) setMsg({ tipo: "erro", texto: error.message });
    else setMsg({ tipo: "ok", texto: "Emissor configurado." });
    router.refresh();
  }

  async function definirMaster() {
    setSalvandoMaster(true);
    setMsg(null);
    const res = await fetch("/api/admin/negocio-faturamento", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao: "definir_master", empresa_master_id: masterId || null }),
    });
    const j = (await res.json().catch(() => ({}))) as { erro?: string };
    setSalvandoMaster(false);
    if (!res.ok) setMsg({ tipo: "erro", texto: j.erro || "Falha ao salvar a empresa Master." });
    else setMsg({ tipo: "ok", texto: "Empresa Master definida." });
  }

  async function emitir(a: Assinante) {
    const valor = Number((valores[a.id] ?? String(a.valor_mensal ?? "")).replace(",", "."));
    if (!valor || valor <= 0) {
      setMsg({ tipo: "erro", texto: `Informe o valor da nota de ${a.nome}.` });
      return;
    }
    setEmitindo(a.id);
    setMsg(null);
    const resp = await fetch("/api/admin/nfse/emitir", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ escritorioId: a.id, competencia: comp, valor }),
    });
    const j = (await resp.json().catch(() => ({}))) as { ok?: boolean; nfseNumero?: string | null; erro?: string | null; error?: string };
    setEmitindo(null);
    if (j.ok) setMsg({ tipo: "ok", texto: `Nota de ${a.nome} emitida${j.nfseNumero ? ` (nº ${j.nfseNumero})` : ""}.` });
    else setMsg({ tipo: "erro", texto: j.erro ?? j.error ?? "Falha na emissão." });
    router.refresh();
  }

  const inputCls = "w-full rounded-md border border-line px-2.5 py-1.5 text-[12.5px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";

  return (
    <div className="space-y-4">
      {/* config do emissor */}
      <div className="rounded-xl2 bg-white p-4 shadow-card">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Emissor</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-ink-soft">Empresa emissora (a operadora do FinanceiroX)</label>
            <select value={emissoraId} onChange={(e) => setEmissoraId(e.target.value)} className={inputCls}>
              <option value="">Selecione</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>{e.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-ink-soft">Serviço fiscal (ex.: licença de software, LC 1.05)</label>
            <select value={servicoId} onChange={(e) => setServicoId(e.target.value)} className={inputCls}>
              <option value="">Selecione</option>
              {servicosDaEmissora.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}{s.item_lc116 ? ` (LC ${s.item_lc116})` : " (sem LC 116!)"}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Botao variante="primario" tamanho="sm"
              onClick={salvarConfig}
              disabled={salvandoCfg}
            >
              <Save size={13} /> Salvar
            </Botao>
          </div>
        </div>
        <div className="mt-3 grid gap-3 border-t border-line pt-3 sm:grid-cols-[1fr_auto]">
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-ink-soft">Empresa Master (onde entra o contas a receber)</label>
            <select value={masterId} onChange={(e) => setMasterId(e.target.value)} className={inputCls}>
              <option value="">Selecione</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>{e.nome}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Botao variante="primario" tamanho="sm"
              onClick={definirMaster}
              disabled={salvandoMaster}
            >
              <Save size={13} /> Salvar Master
            </Botao>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-ink-soft">
          A nota usa a configuração NFS-e (certificado, IBGE, ambiente) da empresa emissora. O tomador vem do cadastro
          Asaas do assinante. Uma nota por assinante por competência. Ao emitir, o contas a receber é criado
          automaticamente na empresa Master — a baixa é feita pela conciliação.
        </p>
      </div>

      {msg && <p className={`text-xs font-semibold ${msg.tipo === "erro" ? "text-danger" : "text-brand"}`}>{msg.texto}</p>}

      {/* assinantes pagantes */}
      <div className="overflow-hidden rounded-xl2 bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-line bg-surface/50 px-4 py-2.5">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Assinantes pagantes ({assinantes.length})</p>
          <input
            type="month"
            value={comp}
            onChange={(e) => e.target.value && setComp(e.target.value)}
            className={classeControle("md", false, "num")}
          />
        </div>
        {assinantes.length === 0 ? (
          <EmptyState compacto titulo="Nenhum assinante pagante ainda" />
        ) : (
          assinantes.map((a) => {
            const nota = notaPorEscritorio.get(a.id);
            return (
              <div key={a.id} className="flex items-center gap-3 border-b border-line/60 px-4 py-3 text-sm last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{a.nome}</p>
                  <p className="text-[11px] text-ink-soft">
                    {a.ciclo_cobranca ?? "mensal"} · {a.assinatura_qtd ?? "—"} empresa(s) · último pgto{" "}
                    {a.ultimo_pagamento_em ? dataBR(a.ultimo_pagamento_em) : "—"}
                    {!a.asaas_customer_id && <span className="font-semibold text-danger"> · sem cliente Asaas</span>}
                  </p>
                  {nota?.status === "rejeitada" && (
                    <p className="text-[11px] font-semibold text-danger">Rejeitada: {nota.motivo_erro?.slice(0, 120)}</p>
                  )}
                </div>
                <input
                  inputMode="decimal"
                  value={valores[a.id] ?? String(a.valor_mensal ?? "")}
                  onChange={(e) => setValores((v) => ({ ...v, [a.id]: e.target.value.replace(/[^\d,\.]/g, "") }))}
                  className={classeControle("md", false, "num w-24 shrink-0 text-right")}
                  title="Valor da nota"
                />
                {nota?.status === "emitida" ? (
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className="rounded-full bg-brand-light px-2.5 py-1 text-[10px] font-semibold text-brand-dark">
                      emitida{nota.nfse_numero ? ` ${nota.nfse_numero}` : ""}
                    </span>
                    {nota.pdf_url && (
                      <a href={nota.pdf_url} target="_blank" rel="noreferrer" className="rounded-lg p-1 text-ink-soft hover:text-brand">
                        <ExternalLink size={13} />
                      </a>
                    )}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => emitir(a)}
                    disabled={emitindo !== null || !configPronta || !a.asaas_customer_id}
                    className="flex shrink-0 items-center gap-1.5 rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50"
                  >
                    <Send size={12} /> {emitindo === a.id ? "Emitindo…" : nota?.status === "rejeitada" ? "Reemitir" : "Emitir"}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* notas emitidas */}
      <div className="overflow-hidden rounded-xl2 bg-white shadow-card">
        <div className="border-b border-line bg-surface/50 px-4 py-2.5">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Notas de assinatura ({notas.length})</p>
        </div>
        {notas.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-8 text-ink-soft">
            <FileText size={22} strokeWidth={1.5} />
            <EmptyState compacto titulo="Nenhuma nota de assinatura ainda" />
          </div>
        ) : (
          notas.map((n) => (
            <div key={n.id} className="flex items-center gap-3 border-b border-line/60 px-4 py-2.5 text-sm last:border-0">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">
                  {n.referencia?.split(":")[2] ?? ""} {n.nfse_numero ? `· NFS-e ${n.nfse_numero}` : `· DPS`}
                </p>
                <p className="text-[11px] text-ink-soft">
                  {dataBR(n.emitida_em ?? n.criado_em)} · {n.ambiente}
                  {n.motivo_erro ? ` · ${n.motivo_erro.slice(0, 100)}` : ""}
                </p>
              </div>
              <span className="num shrink-0 text-xs font-semibold text-ink">{brl(n.valor_servico)}</span>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                  n.status === "emitida" ? "bg-brand-light text-brand-dark" : n.status === "rejeitada" ? "bg-rose-50 text-danger" : "bg-surface text-ink-soft"
                }`}
              >
                {n.status}
              </span>
              {n.pdf_url && (
                <a href={n.pdf_url} target="_blank" rel="noreferrer" className="shrink-0 rounded-lg p-1.5 text-ink-soft hover:text-brand">
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

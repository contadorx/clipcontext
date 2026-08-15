"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Check, AlertTriangle, CircleHelp, FileCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { parseRetornoCnab240, descreveOcorrencia, type RetornoItem } from "@/lib/cnab/cnab-retorno";
import { nomesBancosPagamento } from "@/lib/cnab/registry";
import { Msg } from "@/components/ui/message-strip";
import { brl } from "@/lib/formato";
import Botao from "@/components/ui/botao";

export type MapaRemessa = { seu_numero: string; lancamento_id: string; valor: number };

type Linha = RetornoItem & { lancamentoId: string | null };

export default function ProcessarRetorno({ mapa }: { mapa: MapaRemessa[] }) {
  const router = useRouter();
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [aplicando, setAplicando] = useState(false);
  const [baixados, setBaixados] = useState<Set<string>>(new Set());

  const indice = new Map(mapa.map((m) => [m.seu_numero.toUpperCase().trim(), m]));

  async function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg(null);
    setAviso(null);
    setBaixados(new Set());
    try {
      const texto = await file.text();
      const { itens, ehRetorno } = parseRetornoCnab240(texto);
      if (!ehRetorno) setAviso("Este arquivo não parece um retorno CNAB 240 (cabeçalho sem marca de retorno). Conferindo mesmo assim.");
      if (itens.length === 0) {
        setLinhas([]);
        setMsg({ tipo: "erro", texto: "Não encontrei registros de pagamento (Segmento A/J) no arquivo." });
        return;
      }
      const ls: Linha[] = itens.map((i) => ({
        ...i,
        lancamentoId: indice.get(i.seuNumero.toUpperCase().trim())?.lancamento_id ?? null,
      }));
      setLinhas(ls);
    } catch {
      setMsg({ tipo: "erro", texto: "Não consegui ler o arquivo. Verifique se é o arquivo retorno (.RET) do banco." });
    } finally {
      e.target.value = "";
    }
  }

  const confirmados = (linhas ?? []).filter((l) => l.efetuado && l.lancamentoId);
  const aBaixar = confirmados.filter((l) => !baixados.has(l.lancamentoId!));
  const erros = (linhas ?? []).filter((l) => !l.efetuado);
  const semVinculo = (linhas ?? []).filter((l) => l.efetuado && !l.lancamentoId);

  async function aplicarBaixa() {
    if (aBaixar.length === 0) return;
    setAplicando(true);
    setMsg(null);
    try {
      const supabase = createClient();
      const ok = new Set(baixados);
      for (const l of aBaixar) {
        const data = l.dataEfetiva ?? new Date().toISOString().slice(0, 10);
        const { error } = await supabase
          .from("lancamentos")
          .update({ data_pagamento: data })
          .eq("id", l.lancamentoId!)
          .is("data_pagamento", null);
        if (!error) ok.add(l.lancamentoId!);
      }
      setBaixados(ok);
      setMsg({
        tipo: "ok",
        texto: `Baixa aplicada em ${ok.size} pagamento(s). Eles ficam como Liquidados.`,
      });
      router.refresh();
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("fs-mov-changed"));
    } catch (e) {
      setMsg({ tipo: "erro", texto: e instanceof Error ? e.message : "Falha ao aplicar a baixa." });
    } finally {
      setAplicando(false);
    }
  }

  return (
    <div className="rounded-xl2 bg-white p-4 shadow-card">
      <div className="flex items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-light text-brand">
          <FileCheck size={20} />
        </div>
        <div>
          <h2 className="text-[13px] font-bold text-ink">Processar arquivo retorno (CNAB 240)</h2>
          <p className="text-xs text-ink-muted">
            Suba o retorno (.RET) que o banco devolve — vale para {nomesBancosPagamento()}. Os pagamentos confirmados recebem baixa automática.
          </p>
        </div>
      </div>

      {msg && <Msg msg={msg} />}

      <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-surface/40 px-4 py-6 text-sm font-semibold text-ink-muted transition hover:border-brand hover:text-brand">
        <Upload size={16} /> Escolher arquivo de retorno (.RET)
        <input type="file" accept=".ret,.txt,.rem,text/plain" onChange={aoEscolher} className="hidden" />
      </label>

      {aviso && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{aviso}</p>}

      {linhas && linhas.length > 0 && (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-brand-light px-2.5 py-1 font-semibold text-brand-dark">
              {confirmados.length} confirmado(s)
            </span>
            {erros.length > 0 && (
              <span className="rounded-full bg-rose-50 px-2.5 py-1 font-semibold text-danger">
                {erros.length} com pendência
              </span>
            )}
            {semVinculo.length > 0 && (
              <span className="rounded-full bg-surface px-2.5 py-1 font-semibold text-ink-soft">
                {semVinculo.length} sem vínculo
              </span>
            )}
          </div>

          <div className="overflow-hidden rounded-lg border border-line">
            <ul className="divide-y divide-line/60">
              {linhas.map((l, idx) => {
                const baixado = l.lancamentoId && baixados.has(l.lancamentoId);
                return (
                  <li key={idx} className="flex items-center gap-3 px-3 py-2.5">
                    {l.efetuado ? (
                      l.lancamentoId ? (
                        <Check size={15} className="shrink-0 text-brand" />
                      ) : (
                        <CircleHelp size={15} className="shrink-0 text-ink-soft" />
                      )
                    ) : (
                      <AlertTriangle size={15} className="shrink-0 text-danger" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="num truncate text-sm font-medium text-ink">{l.seuNumero || "(sem seu número)"}</p>
                      <p className="text-[11px] text-ink-soft">
                        {l.segmento === "J" ? "Boleto" : "Transf./Pix"}
                        {" · "}
                        {l.ocorrencias.map(descreveOcorrencia).join(", ") || "—"}
                        {!l.lancamentoId && l.efetuado && " · não encontrei o lançamento desta empresa"}
                        {baixado && " · baixado ✓"}
                      </p>
                    </div>
                    <span className="num shrink-0 text-sm font-semibold text-ink">{brl(l.valor)}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <Botao variante="primario"
            onClick={aplicarBaixa}
            disabled={aplicando || aBaixar.length === 0}
          >
            <Check size={15} /> {aplicando ? "Aplicando…" : `Aplicar baixa (${aBaixar.length})`}
          </Botao>
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { Sparkles, RefreshCw, Coins, X, ExternalLink, Save, Eye, EyeOff } from "lucide-react";
import { PACOTES_IA } from "@/lib/pacotes-ia";
import { Msg } from "@/components/ui/message-strip";
import { SkeletonLinhas } from "@/components/ui/skeleton";
import { brl } from "@/lib/formato";
import Botao from "@/components/ui/botao";
import { classeControle } from "@/components/ui/campo";

type Indic = {
  entradas: number;
  saidas: number;
  saldo: number;
  antEntradas: number;
  antSaidas: number;
  antSaldo: number;
  topSaidas: [string, number][];
};

function compAtual() {
  // padrão = mês anterior (último mês fechado), que é o que se relata
  const n = new Date();
  return new Date(Date.UTC(n.getFullYear(), n.getMonth() - 1, 1)).toISOString().slice(0, 7);
}

export default function AnaliseIA({ empresaId }: { empresaId: string }) {
  const [competencia, setCompetencia] = useState(compAtual());
  const [resumo, setResumo] = useState("");
  const [analise, setAnalise] = useState("");
  const [indic, setIndic] = useState<Indic | null>(null);
  const [publicada, setPublicada] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [creditos, setCreditos] = useState<number | null>(null);
  const [compraAberta, setCompraAberta] = useState(false);
  const [comprando, setComprando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!empresaId) return;
    setCarregando(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/analise-mes?empresaId=${encodeURIComponent(empresaId)}&competencia=${competencia}`);
      const data = await res.json();
      setResumo(data?.analise?.resumo ?? "");
      setAnalise(data?.analise?.analise ?? "");
      setPublicada(Boolean(data?.analise?.publicada));
      setIndic(data?.indicadoresAovivo ?? null);
      if (typeof data?.creditos === "number") setCreditos(data.creditos);
    } catch {
      setResumo("");
      setAnalise("");
      setPublicada(false);
      setIndic(null);
    } finally {
      setCarregando(false);
    }
  }, [empresaId, competencia]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function gerar() {
    // Toda geração consome 1 crédito. Se já existe rascunho, confirma antes de regerar.
    const jaTemRascunho = resumo.trim().length > 0 || analise.trim().length > 0;
    if (jaTemRascunho) {
      const ok = window.confirm("Regerar a análise consome 1 crédito de IA e substitui o texto atual. Continuar?");
      if (!ok) return;
    }
    setGerando(true);
    setMsg(null);
    try {
      const res = await fetch("/api/analise-mes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresaId, competencia, action: "gerar" }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.semCreditos) {
          setCreditos(0);
          setCompraAberta(true);
          throw new Error("Você está sem créditos de análise. Compre um pacote para continuar.");
        }
        throw new Error(data?.erro || "Não foi possível gerar a análise.");
      }
      setResumo(data.resumo ?? "");
      setAnalise(data.analise ?? "");
      if (typeof data?.creditos === "number") setCreditos(data.creditos);
      setMsg({ tipo: "ok", texto: "Rascunho gerado pela IA. Ajuste o texto e publique quando quiser." });
    } catch (e) {
      setMsg({ tipo: "erro", texto: e instanceof Error ? e.message : "Erro ao gerar." });
    } finally {
      setGerando(false);
    }
  }

  async function salvar() {
    setSalvando(true);
    setMsg(null);
    try {
      const res = await fetch("/api/analise-mes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresaId, competencia, action: "salvar", resumo, analise }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.erro || "Não foi possível salvar.");
      setMsg({ tipo: "ok", texto: "Rascunho salvo." });
    } catch (e) {
      setMsg({ tipo: "erro", texto: e instanceof Error ? e.message : "Erro ao salvar." });
    } finally {
      setSalvando(false);
    }
  }

  async function togglePublicar() {
    const novo = !publicada;
    setSalvando(true);
    setMsg(null);
    try {
      const res = await fetch("/api/analise-mes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresaId, competencia, action: novo ? "publicar" : "despublicar", resumo, analise }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.erro || "Não foi possível atualizar.");
      setPublicada(novo);
      setMsg({
        tipo: "ok",
        texto: novo ? "Publicada no portal — indicadores travados neste fechamento." : "Publicação removida.",
      });
    } catch (e) {
      setMsg({ tipo: "erro", texto: e instanceof Error ? e.message : "Erro ao publicar." });
    } finally {
      setSalvando(false);
    }
  }

  async function comprarPacote(id: string, doc?: string) {
    setComprando(id);
    setMsg(null);
    try {
      const res = await fetch("/api/ia/comprar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pacote: id, cpfCnpj: doc }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.precisaDoc) {
          const cpf = window.prompt("Informe seu CPF ou CNPJ para a cobrança (somente números):") || "";
          if (cpf.replace(/\D/g, "").length >= 11) return comprarPacote(id, cpf);
          return;
        }
        throw new Error(data?.erro || "Não foi possível gerar a compra.");
      }
      if (data.invoiceUrl) window.open(data.invoiceUrl, "_blank", "noopener");
      setCompraAberta(false);
      setMsg({ tipo: "ok", texto: "Cobrança criada! Abra a fatura para pagar — os créditos entram após a confirmação." });
    } catch (e) {
      setMsg({ tipo: "erro", texto: e instanceof Error ? e.message : "Erro ao comprar." });
    } finally {
      setComprando(null);
    }
  }

  const variacao = indic ? indic.saldo - indic.antSaldo : 0;
  const corSaldo = (v: number) => (v < 0 ? "text-danger" : v > 0 ? "text-brand" : "text-ink-soft");
  const taTextarea =
    "w-full rounded-lg border border-line px-3 py-2.5 text-sm leading-relaxed text-ink outline-none focus:border-brand";

  return (
    <div className="rounded-xl2 bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
          <Sparkles size={16} className="text-brand" /> Análise do mês
        </h2>
        <div className="flex items-center gap-2">
          {creditos !== null && (
            <button
              type="button"
              onClick={() => setCompraAberta(true)}
              title="Comprar créditos de análise"
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold transition ${
                creditos > 0 ? "border-line text-ink-muted hover:bg-surface" : "border-amber-300 bg-amber-50 text-amber-700"
              }`}
            >
              <Coins size={13} /> {creditos} crédito{creditos === 1 ? "" : "s"}
            </button>
          )}
          <input
            type="month"
            value={competencia}
            onChange={(e) => setCompetencia(e.target.value)}
            className={classeControle("md", false, "num")}
          />
          <Botao variante="primario"
            onClick={gerar}
            disabled={gerando}
          >
            {gerando ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {gerando ? "Gerando…" : "Gerar com IA"}
          </Botao>
        </div>
      </div>

      {msg && <Msg msg={msg} />}

      {carregando ? (
        <SkeletonLinhas linhas={4} colunas={1} className="mt-4" />
      ) : (
        <div className="mt-4 space-y-5">
          {/* Indicadores */}
          {indic && (
            <div>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Indicadores</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-line bg-surface/40 px-3 py-2.5">
                  <div className="text-[11px] text-ink-soft">Entradas</div>
                  <div className="num text-base font-bold text-brand">{brl(indic.entradas)}</div>
                </div>
                <div className="rounded-lg border border-line bg-surface/40 px-3 py-2.5">
                  <div className="text-[11px] text-ink-soft">Saídas</div>
                  <div className="num text-base font-bold text-ink">{brl(indic.saidas)}</div>
                </div>
                <div className="rounded-lg border border-line bg-surface/40 px-3 py-2.5">
                  <div className="text-[11px] text-ink-soft">Resultado</div>
                  <div className={`num text-base font-bold ${corSaldo(indic.saldo)}`}>{brl(indic.saldo)}</div>
                </div>
                <div className="rounded-lg border border-line bg-surface/40 px-3 py-2.5">
                  <div className="text-[11px] text-ink-soft">vs mês anterior</div>
                  <div className={`num text-base font-bold ${corSaldo(variacao)}`}>
                    {variacao >= 0 ? "+" : ""}
                    {brl(variacao)}
                  </div>
                </div>
              </div>
              {indic.topSaidas.length > 0 && (
                <p className="mt-2 text-[11px] text-ink-soft">
                  Maiores despesas: {indic.topSaidas.map(([n, v]) => `${n} (${brl(v)})`).join(" · ")}
                </p>
              )}
            </div>
          )}

          {/* Resumo */}
          <div>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Resumo</h3>
            <textarea
              value={resumo}
              onChange={(e) => setResumo(e.target.value)}
              rows={2}
              placeholder="Um parágrafo curto com o destaque do mês. Gere com a IA ou escreva você mesmo."
              className={taTextarea}
            />
          </div>

          {/* Análise */}
          <div>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Análise</h3>
            <textarea
              value={analise}
              onChange={(e) => setAnalise(e.target.value)}
              rows={8}
              placeholder="A leitura do mês e as recomendações para o cliente. Gere com a IA e ajuste, ou escreva do zero."
              className={taTextarea}
            />
          </div>

          {/* Ações */}
          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <button
              type="button"
              onClick={salvar}
              disabled={salvando}
              className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink-muted transition hover:bg-surface disabled:opacity-60"
            >
              <Save size={13} /> Salvar rascunho
            </button>
            <button
              type="button"
              onClick={togglePublicar}
              disabled={salvando}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition disabled:opacity-60 ${
                publicada ? "border-brand/40 bg-brand-light text-brand-dark" : "border-line text-ink-muted hover:bg-surface"
              }`}
            >
              {publicada ? <Eye size={13} /> : <EyeOff size={13} />}
              {publicada ? "Publicada no portal" : "Publicar no portal"}
            </button>
            <span className="text-[11px] text-ink-soft">
              Ao publicar, os indicadores ficam congelados neste fechamento. Para o cliente ver, ative também “Liberar
              análise” no Portal daquela empresa.
            </span>
          </div>
        </div>
      )}

      {compraAberta && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-rail/50 p-4"
          onClick={() => setCompraAberta(false)}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="dlg-creditos-ia-titulo" className="w-full max-w-md rounded-xl2 bg-white p-5 shadow-card" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 id="dlg-creditos-ia-titulo" className="flex items-center gap-2 text-base font-bold text-ink">
                <Coins size={16} className="text-brand" /> Comprar créditos de IA
              </h3>
              <button aria-label="Fechar"
                type="button"
                onClick={() => setCompraAberta(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition hover:bg-surface"
              >
                <X size={16} />
              </button>
            </div>
            <p className="mt-1 text-xs text-ink-muted">
              Cada análise nova de um mês consome 1 crédito. Regerar um mês já analisado é grátis.
            </p>
            <div className="mt-4 space-y-2">
              {PACOTES_IA.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => comprarPacote(p.id)}
                  disabled={comprando !== null}
                  className="flex w-full items-center justify-between rounded-lg border border-line px-4 py-3 text-left transition hover:border-brand hover:bg-surface disabled:opacity-60"
                >
                  <span>
                    <span className="text-sm font-bold text-ink">{p.creditos} análises</span>
                    {p.selo && (
                      <span className="ml-2 rounded-full bg-brand-light px-2 py-0.5 text-[10px] font-bold text-brand-dark">
                        {p.selo}
                      </span>
                    )}
                    <span className="block text-[11px] text-ink-soft">{brl(p.preco / p.creditos)} por análise</span>
                  </span>
                  <span className="num text-base font-extrabold text-brand">
                    {comprando === p.id ? "…" : brl(p.preco)}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-soft">
              <ExternalLink size={12} /> O pagamento abre no Asaas (Pix, boleto ou cartão). Os créditos entram após a
              confirmação.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useMemo } from "react";
import { brl, mascaraCpfCnpj } from "@/lib/formato";
import { useRouter } from "next/navigation";
import { Check, AlertTriangle, Info, Sparkles, ExternalLink, Minus, Plus, TrendingDown } from "lucide-react";
import { configDeRow, calcular, detalheFaixas, precoMensalBase, type Ciclo, type CicloDef } from "@/lib/precos";
import MessageStrip, { Msg } from "@/components/ui/message-strip";
import Botao from "@/components/ui/botao";
import { classeControle, CampoTexto } from "@/components/ui/campo";

export default function AssinaturaConfig({
  escritorioId,
  nEmpresas,
  qtdContratada,
  statusInicial,
  cicloInicial,
  trialExpira,
  temAssinatura,
  cfg,
}: {
  escritorioId: string;
  nEmpresas: number;
  qtdContratada: number | null;
  statusInicial: string;
  cicloInicial: Ciclo | null;
  trialExpira: string | null;
  temAssinatura: boolean;
  cfg: { faixas: { ate: number | null; preco: number }[]; piso: number; ciclos: CicloDef[] };
}) {
  const router = useRouter();
  const cfgM = useMemo(() => configDeRow(cfg), [cfg]);
  const [sel, setSel] = useState<Ciclo>(cicloInicial ?? "anual");
  const [status, setStatus] = useState(statusInicial);
  const [salvando, setSalvando] = useState(false);
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [verComoCalcula, setVerComoCalcula] = useState(false);
  const [cupom, setCupom] = useState("");
  const [cupomInfo, setCupomInfo] = useState<{ codigo: string; percentual: number; duracaoMeses: number | null } | null>(null);
  const [cupomMsg, setCupomMsg] = useState<string | null>(null);
  const [validandoCupom, setValidandoCupom] = useState(false);

  // quantidade contratada (nunca abaixo do nº real de empresas)
  const [qtd, setQtd] = useState<number>(Math.max(nEmpresas, qtdContratada ?? nEmpresas, 1));

  const faixas = detalheFaixas(qtd, cfgM);
  const base = precoMensalBase(qtd, cfgM);
  const mediaPorEmpresa = qtd > 0 ? base / qtd : base;
  // precisa atualizar a assinatura? (já assina, mas tem mais empresas do que o contratado)
  const precisaAtualizar = temAssinatura && qtdContratada !== null && nEmpresas > qtdContratada;

  const trialDias = trialExpira
    ? Math.max(0, Math.ceil((Date.parse(trialExpira) - Date.now()) / 86400000))
    : null;

  async function aplicarCupom() {
    const cod = cupom.trim();
    if (!cod) return;
    setValidandoCupom(true);
    setCupomMsg(null);
    try {
      const res = await fetch("/api/cupom/validar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo: cod }),
      });
      const j = await res.json();
      if (!res.ok || !j.valido) {
        setCupomInfo(null);
        setCupomMsg(j.erro || "Cupom inválido.");
        return;
      }
      setCupomInfo({ codigo: j.codigo, percentual: j.percentual, duracaoMeses: j.duracaoMeses ?? null });
      setCupomMsg(null);
    } catch {
      setCupomMsg("Não foi possível validar o cupom agora.");
    } finally {
      setValidandoCupom(false);
    }
  }

  function removerCupom() {
    setCupomInfo(null);
    setCupom("");
    setCupomMsg(null);
  }

  async function assinar() {
    const doc = cpfCnpj.replace(/\D/g, "");
    if (doc.length !== 11 && doc.length !== 14) {
      setMsg({ tipo: "erro", texto: "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido." });
      return;
    }
    setSalvando(true);
    setMsg(null);
    try {
      const res = await fetch("/api/assinatura/criar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ciclo: sel, cpfCnpj: doc, qtd, cupom: cupomInfo?.codigo || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.erro || "Não foi possível criar a assinatura.");
      setStatus("selecionada");
      setInvoiceUrl(data.invoiceUrl ?? null);
      if (data.invoiceUrl) window.open(data.invoiceUrl, "_blank", "noopener");
      setMsg({
        tipo: "ok",
        texto: "Assinatura criada! Abra a fatura para pagar — a conta é ativada assim que o pagamento é confirmado.",
      });
      router.refresh();
    } catch (e) {
      setMsg({ tipo: "erro", texto: e instanceof Error ? e.message : "Erro ao assinar." });
    } finally {
      setSalvando(false);
    }
  }

  async function abrirFatura() {
    setMsg(null);
    try {
      const res = await fetch("/api/assinatura/fatura");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.erro || "Fatura indisponível.");
      if (data.invoiceUrl) window.open(data.invoiceUrl, "_blank", "noopener");
    } catch (e) {
      setMsg({ tipo: "erro", texto: e instanceof Error ? e.message : "Erro ao abrir a fatura." });
    }
  }

  return (
    <div className="space-y-5">
      {msg && <Msg msg={msg} />}

      {/* status atual */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl2 bg-white p-4 shadow-card">
        <div>
          <p className="text-xs font-semibold text-ink-soft">Situação</p>
          <p className="text-sm font-bold text-ink">
            {status === "ativa"
              ? "Assinatura ativa"
              : status === "selecionada"
                ? `Plano ${cicloLabel(sel, cfgM.ciclos)} selecionado (pagamento pendente)`
                : status === "cancelada"
                  ? "Assinatura cancelada"
                  : trialDias !== null
                    ? `Em teste — ${trialDias} dia(s) restantes`
                    : "Em teste"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold text-ink-soft">Empresas na conta</p>
          <p className="num text-lg font-extrabold text-ink">{nEmpresas}</p>
        </div>
      </div>

      {precisaAtualizar && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl2 border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="shrink-0 text-amber-600" />
          <span className="flex-1">
            Sua assinatura cobre <b>{qtdContratada}</b> empresa(s), mas você já tem <b>{nEmpresas}</b>. Atualize para
            ajustar o valor e manter tudo em dia.
          </span>
        </div>
      )}

      {/* quantidade contratada + cross-sell */}
      <div className="rounded-xl2 bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-ink">Empresas contratadas</p>
            <p className="text-xs text-ink-muted">
              Pague pelo que usa — e contrate à frente para garantir o melhor valor por empresa conforme cresce.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button aria-label="Diminuir a quantidade"
              type="button"
              onClick={() => setQtd((q) => Math.max(nEmpresas, 1, q - 1))}
              disabled={qtd <= Math.max(nEmpresas, 1)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink-muted transition hover:bg-surface disabled:opacity-40"
            >
              <Minus size={15} />
            </button>
            {/*
              Rótulo por `aria-label`: o campo divide a linha com os botões − e +,
              e "Empresas contratadas" já está escrito ao lado — um rótulo visível
              aqui repetiria o título e quebraria o alinhamento dos três.
            */}
            <input
              id="assinatura-qtd"
              aria-label="Quantidade de empresas contratadas"
              type="number"
              value={qtd}
              min={Math.max(nEmpresas, 1)}
              onChange={(e) => setQtd(Math.max(nEmpresas, 1, Math.floor(Number(e.target.value) || 0)))}
              className="num w-16 rounded-lg border border-line py-2 text-center text-base font-bold text-ink outline-none focus:border-brand"
            />
            <button aria-label="Aumentar a quantidade"
              type="button"
              onClick={() => setQtd((q) => q + 1)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink-muted transition hover:bg-surface"
            >
              <Plus size={15} />
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-3 rounded-lg bg-brand-light/30 px-4 py-3">
          <div>
            <p className="text-[11px] font-semibold text-ink-soft">Custo médio por empresa</p>
            <p className="num text-xl font-extrabold text-brand-dark">{brl(mediaPorEmpresa)}<span className="text-xs font-semibold text-ink-soft">/mês</span></p>
          </div>
          <p className="flex items-center gap-1.5 text-xs font-medium text-brand-dark">
            <TrendingDown size={14} /> Quanto mais empresas, menor o valor por empresa.
          </p>
        </div>

        {/* simulação de cross-sell: próximos patamares */}
        {(() => {
          const marcos = [10, 25, 50, 100].filter((m) => m > qtd);
          if (marcos.length === 0) return null;
          return (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {marcos.slice(0, 4).map((m) => {
                const media = precoMensalBase(m, cfgM) / m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setQtd(m)}
                    className="rounded-lg border border-line px-3 py-2 text-center transition hover:border-brand hover:bg-surface"
                  >
                    <p className="num text-sm font-bold text-ink">{m} empresas</p>
                    <p className="num text-[11px] text-brand-dark">{brl(media)}/empresa</p>
                  </button>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* ciclos */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cfgM.ciclos.map((c) => {
          const calc = calcular(qtd, c.id, cfgM);
          const ativo = sel === c.id;
          const destaque = c.id === "anual";
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setSel(c.id)}
              className={[
                "relative rounded-xl2 border bg-white p-5 text-left shadow-card transition",
                ativo ? "border-brand ring-2 ring-brand" : "border-line hover:border-brand/50",
              ].join(" ")}
            >
              {destaque && (
                <span className="absolute -top-2.5 right-4 flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-white">
                  <Sparkles size={11} /> melhor preço
                </span>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-ink">{c.nome}</span>
                {ativo && <Check size={16} className="text-brand" />}
              </div>
              {c.selo && <span className="text-[11px] font-semibold text-brand">{c.selo}</span>}
              <p className="num mt-3 text-2xl font-extrabold text-ink">
                {brl(calc.mensalEquivalente)}
                <span className="text-xs font-semibold text-ink-soft">/mês</span>
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                {c.meses === 1 ? "cobrado mensalmente" : `${brl(calc.totalCiclo)} a cada ${c.meses} meses`}
              </p>
              {calc.economiaCiclo > 0 && (
                <p className="mt-1 text-xs font-semibold text-brand">economiza {brl(calc.economiaCiclo)} no ciclo</p>
              )}
            </button>
          );
        })}
      </div>

      {/* como é calculado */}
      <div className="rounded-xl2 bg-white p-4 shadow-card">
        <button
          type="button"
          onClick={() => setVerComoCalcula((v) => !v)}
          className="flex items-center gap-2 text-sm font-semibold text-ink"
        >
          <Info size={15} className="text-brand" /> Como o preço é calculado
        </button>
        {verComoCalcula && (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-ink-muted">
              O preço cresce por faixas — cada faixa de volume tem um valor por empresa menor (piso de {brl(cfgM.piso)}/mês).
            </p>
            <div className="overflow-hidden rounded-lg border border-line">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-surface/60 text-ink-soft">
                    <th className="px-3 py-1.5 text-left">Faixa (empresas)</th>
                    <th className="px-3 py-1.5 text-right">Qtd.</th>
                    <th className="px-3 py-1.5 text-right">R$/empresa</th>
                    <th className="px-3 py-1.5 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {faixas.map((f, i) => (
                    <tr key={i} className="border-t border-line/60">
                      <td className="px-3 py-1.5 text-ink">{f.faixa}</td>
                      <td className="num px-3 py-1.5 text-right text-ink-muted">{f.qtd}</td>
                      <td className="num px-3 py-1.5 text-right text-ink-muted">{brl(f.preco)}</td>
                      <td className="num px-3 py-1.5 text-right font-semibold text-ink">{brl(f.subtotal)}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-line bg-surface/40">
                    <td className="px-3 py-1.5 font-bold text-ink" colSpan={3}>
                      Mensal cheio (antes do desconto de ciclo)
                    </td>
                    <td className="num px-3 py-1.5 text-right font-extrabold text-ink">{brl(base)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ação: assinar via Asaas */}
      <div className="rounded-xl2 bg-white p-4 shadow-card">
        {/* cupom */}
        <div className="mb-4 border-b border-line pb-4">
          {!cupomInfo ? (
            <div>
              <label htmlFor="assinatura-cupom" className="mb-1 block text-xs font-semibold text-ink-soft">
                Tem um cupom?
              </label>
              <div className="flex gap-2">
                <input
                  id="assinatura-cupom"
                  value={cupom}
                  onChange={(e) => setCupom(e.target.value.toUpperCase())}
                  placeholder="Código do cupom"
                  className={classeControle("md", false, "max-w-[220px] uppercase")}
                />
                <button
                  type="button"
                  onClick={aplicarCupom}
                  disabled={validandoCupom || !cupom.trim()}
                  className="shrink-0 rounded-lg border border-brand px-4 py-2 text-sm font-semibold text-brand transition hover:bg-brand-light disabled:opacity-50"
                >
                  {validandoCupom ? "Validando…" : "Aplicar"}
                </button>
              </div>
              {cupomMsg && <MessageStrip tipo="erro" className="mt-1.5">{cupomMsg}</MessageStrip>}
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between rounded-lg bg-brand-light px-3 py-2.5">
                <div className="text-sm text-brand-dark">
                  <span className="font-semibold">{cupomInfo.codigo}</span> · −{cupomInfo.percentual}%
                  {cupomInfo.duracaoMeses
                    ? ` por ${cupomInfo.duracaoMeses} ${cupomInfo.duracaoMeses === 1 ? "mês" : "meses"}`
                    : ""}
                </div>
                <button
                  type="button"
                  onClick={removerCupom}
                  className="text-xs font-semibold text-ink-soft transition hover:text-danger"
                >
                  remover
                </button>
              </div>
              <p className="mt-2 text-xs text-ink-muted">
                {(() => {
                  const calc = calcular(qtd, sel, cfgM);
                  const comDesc = calc.totalCiclo * (1 - cupomInfo.percentual / 100);
                  return (
                    <>
                      Total do ciclo:{" "}
                      <span className="num text-ink-soft line-through">{brl(calc.totalCiclo)}</span>{" "}
                      <span className="num font-semibold text-brand">{brl(comDesc)}</span>
                      {cupomInfo.duracaoMeses ? " — depois volta ao preço cheio" : ""}
                    </>
                  );
                })()}
              </p>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <CampoTexto
            id="assinatura-documento"
            rotulo="CPF ou CNPJ para a cobrança"
            className="w-full sm:max-w-xs"
            inputClassName="num"
            value={cpfCnpj}
            onChange={(e) => setCpfCnpj(mascaraCpfCnpj(e.target.value))}
            inputMode="numeric"
            placeholder="Somente números"
            ajuda="Pagamento por Pix, boleto ou cartão na tela do Asaas. A conta é ativada assim que o pagamento é confirmado."
          />
          <Botao variante="primario" className="shadow-card"
            onClick={assinar}
            disabled={salvando}
          >
            {salvando
              ? "Processando…"
              : temAssinatura
                ? `Atualizar assinatura (${qtd} empresa${qtd > 1 ? "s" : ""})`
                : `Assinar plano ${cicloLabel(sel, cfgM.ciclos)}`}
          </Botao>
        </div>

        {(invoiceUrl || temAssinatura || status === "selecionada" || status === "ativa") && (
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
            {invoiceUrl && (
              <a
                href={invoiceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-light px-3 py-2 text-sm font-semibold text-brand-dark transition hover:bg-brand-light/70"
              >
                <ExternalLink size={14} /> Abrir fatura para pagar
              </a>
            )}
            <button
              type="button"
              onClick={abrirFatura}
              className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink transition hover:border-brand hover:text-brand"
            >
              <ExternalLink size={14} /> 2ª via / pagar fatura atual
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function cicloLabel(c: Ciclo, ciclos: CicloDef[]) {
  return ciclos.find((x) => x.id === c)?.nome ?? c;
}

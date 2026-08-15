"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Power } from "lucide-react";
import PageHeader from "@/components/ui/page-header";
import MessageStrip, { Msg } from "@/components/ui/message-strip";
import Botao from "@/components/ui/botao";
import { classeControle } from "@/components/ui/campo";

export type PassoRow = {
  id: string;
  momento: "apos_cadastro" | "pos_pagamento";
  quando: number;
  assunto: string;
  corpo: string;
  botao_texto: string;
  path: string;
  ativo: boolean;
  ordem: number;
};

const GRUPOS: { momento: PassoRow["momento"]; titulo: string; sub: string; ref: string }[] = [
  {
    momento: "apos_cadastro",
    titulo: "Conversão",
    sub: "Durante o teste grátis, para quem ainda não assinou.",
    ref: "após o cadastro",
  },
  {
    momento: "pos_pagamento",
    titulo: "Retenção",
    sub: "Para assinantes ativos, depois que o pagamento entra.",
    ref: "após o pagamento",
  },
];

export default function AdminComunicacao({
  ativaInicial,
  passos,
}: {
  ativaInicial: boolean;
  passos: PassoRow[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [ativa, setAtiva] = useState(ativaInicial);
  const [msgGeral, setMsgGeral] = useState<string | null>(null);

  async function toggleGeral() {
    const nova = !ativa;
    setAtiva(nova);
    setMsgGeral(null);
    const res = await fetch("/api/comunicacao/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao: "config", ativa: nova }),
    });
    if (!res.ok) {
      setAtiva(!nova); // reverte
      setMsgGeral("Não foi possível salvar.");
      return;
    }
    start(() => router.refresh());
  }

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Régua de comunicação"
        sub="E-mails automáticos enviados ao longo do ciclo de vida do cliente. O envio roda uma vez por dia."
      />

      {/* chave geral */}
      <div className="flex items-center justify-between rounded-xl2 bg-white p-4 shadow-card">
        <div className="flex items-start gap-3">
          <Power size={18} className={ativa ? "mt-0.5 text-brand" : "mt-0.5 text-ink-soft"} />
          <div>
            <p className="text-sm font-semibold text-ink">Régua {ativa ? "ligada" : "desligada"}</p>
            <p className="text-xs text-ink-muted">
              {ativa
                ? "Os toques ativos abaixo estão sendo enviados normalmente."
                : "Nenhum e-mail da régua é enviado enquanto estiver desligada."}
            </p>
            {msgGeral && <MessageStrip tipo="erro" className="mt-1">{msgGeral}</MessageStrip>}
          </div>
        </div>
        <button
          onClick={toggleGeral}
          disabled={pending}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
            ativa ? "bg-brand" : "bg-neutral-300"
          } disabled:opacity-60`}
          aria-label="Ligar ou desligar a régua"
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
              ativa ? "left-[22px]" : "left-0.5"
            }`}
          />
        </button>
      </div>

      {GRUPOS.map((g) => {
        const doGrupo = passos.filter((p) => p.momento === g.momento);
        if (doGrupo.length === 0) return null;
        return (
          <div key={g.momento} className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">{g.titulo}</h2>
              <p className="text-xs text-ink-muted">{g.sub}</p>
            </div>
            {doGrupo.map((p) => (
              <PassoCard key={p.id} passo={p} refTempo={g.ref} reguaAtiva={ativa} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function PassoCard({
  passo,
  refTempo,
  reguaAtiva,
}: {
  passo: PassoRow;
  refTempo: string;
  reguaAtiva: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [quando, setQuando] = useState<number>(passo.quando);
  const [assunto, setAssunto] = useState(passo.assunto);
  const [corpo, setCorpo] = useState(passo.corpo);
  const [botao, setBotao] = useState(passo.botao_texto);
  const [ativo, setAtivo] = useState(passo.ativo);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  async function salvar() {
    setMsg(null);
    const res = await fetch("/api/comunicacao/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        acao: "passo",
        id: passo.id,
        quando,
        assunto,
        corpo,
        botao_texto: botao,
        ativo,
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg({ tipo: "erro", texto: j.erro || "Não foi possível salvar." });
      return;
    }
    setMsg({ tipo: "ok", texto: "Alterações salvas." });
    start(() => router.refresh());
  }

  return (
    <div
      className={`rounded-xl2 border bg-white p-5 shadow-card ${
        ativo && reguaAtiva ? "border-line" : "border-line opacity-75"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="num text-base font-bold text-brand">Dia {quando}</span>
          <span className="text-xs text-ink-soft">{refTempo}</span>
        </div>
        <button
          onClick={() => setAtivo((v) => !v)}
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
            ativo ? "bg-brand-light text-brand-dark" : "bg-rail text-ink-soft"
          }`}
        >
          {ativo ? <Check size={12} /> : <X size={12} />}
          {ativo ? "Ativo" : "Inativo"}
        </button>
      </div>

      <div className="mt-4 space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[120px_1fr]">
          <label className="block">
            <span className="text-xs font-medium text-ink-muted">Dia do envio</span>
            <input
              type="number"
              min={0}
              max={365}
              value={quando}
              onChange={(e) => setQuando(Number(e.target.value))}
              className={classeControle("md", false, "num mt-1")}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-ink-muted">Assunto</span>
            <input
              value={assunto}
              onChange={(e) => setAssunto(e.target.value)}
              className={classeControle("md", false, "mt-1")}
            />
          </label>
        </div>

        <label className="block">
          <span className="text-xs font-medium text-ink-muted">Texto do e-mail</span>
          <textarea
            value={corpo}
            onChange={(e) => setCorpo(e.target.value)}
            rows={4}
            className={classeControle("md", false, "mt-1 leading-relaxed")}
          />
          <span className="mt-1 block text-[11px] text-ink-soft">
            Use &lt;br&gt; para quebrar linha. Aceita HTML simples.
          </span>
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-ink-muted">Texto do botão</span>
            <input
              value={botao}
              onChange={(e) => setBotao(e.target.value)}
              className={classeControle("md", false, "mt-1")}
            />
          </label>
          <div className="block">
            <span className="text-xs font-medium text-ink-muted">Botão leva para</span>
            <div className="num mt-1 w-full rounded-lg border border-line bg-rail px-3 py-2 text-sm text-ink-soft">
              {passo.path}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Botao variante="primario"
          onClick={salvar}
          disabled={pending}
        >
          Salvar alterações
        </Botao>
        {msg && <Msg msg={msg} />}
      </div>
    </div>
  );
}

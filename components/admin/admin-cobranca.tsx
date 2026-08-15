"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Power, Plus, Trash2 } from "lucide-react";
import PageHeader from "@/components/ui/page-header";
import MessageStrip, { Msg } from "@/components/ui/message-strip";
import Botao from "@/components/ui/botao";
import { classeControle } from "@/components/ui/campo";

export type CobrancaPassoRow = {
  id: string;
  quando: number;
  assunto: string;
  corpo: string;
  botao_texto: string;
  ativo: boolean;
};

type Draft = { localId: string };

export default function AdminCobranca({
  ativaInicial,
  passos,
}: {
  ativaInicial: boolean;
  passos: CobrancaPassoRow[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [ativa, setAtiva] = useState(ativaInicial);
  const [msgGeral, setMsgGeral] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);

  async function toggleGeral() {
    const nova = !ativa;
    setAtiva(nova);
    setMsgGeral(null);
    const res = await fetch("/api/cobranca/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao: "config", ativa: nova }),
    });
    if (!res.ok) {
      setAtiva(!nova);
      setMsgGeral("Não foi possível salvar.");
      return;
    }
    start(() => router.refresh());
  }

  function addDraft() {
    setDrafts((d) => [...d, { localId: Math.random().toString(36).slice(2) }]);
  }
  function removeDraft(localId: string) {
    setDrafts((d) => d.filter((x) => x.localId !== localId));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Régua de cobrança"
        sub="E-mails automáticos ligados ao vencimento da fatura — antes (lembrete) e depois (cobrança). O envio roda uma vez por dia, e cada toque sai uma vez por ciclo de cobrança. Quem avisa o cliente é esta régua; o Asaas não envia notificações."
      />

      {/* chave geral */}
      <div className="flex items-center justify-between rounded-xl2 bg-white p-4 shadow-card">
        <div className="flex items-start gap-3">
          <Power size={18} className={ativa ? "mt-0.5 text-brand" : "mt-0.5 text-ink-soft"} />
          <div>
            <p className="text-sm font-semibold text-ink">Régua {ativa ? "ligada" : "desligada"}</p>
            <p className="text-xs text-ink-muted">
              {ativa
                ? "Os toques ativos abaixo estão sendo enviados conforme o vencimento."
                : "Nenhum e-mail de cobrança é enviado enquanto estiver desligada."}
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

      <div className="space-y-3">
        {passos.map((p) => (
          <CobrancaCard key={p.id} passo={p} reguaAtiva={ativa} />
        ))}
        {drafts.map((d) => (
          <CobrancaCard key={d.localId} reguaAtiva={ativa} onCancelarNovo={() => removeDraft(d.localId)} />
        ))}
      </div>

      <button
        onClick={addDraft}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line px-4 py-2 text-sm font-semibold text-ink-muted transition hover:border-brand hover:text-brand"
      >
        <Plus size={15} /> Adicionar toque
      </button>
    </div>
  );
}

type Tipo = "antes" | "dia" | "depois";
function tipoDeQuando(q: number): Tipo {
  if (q < 0) return "antes";
  if (q > 0) return "depois";
  return "dia";
}

function CobrancaCard({
  passo,
  reguaAtiva,
  onCancelarNovo,
}: {
  passo?: CobrancaPassoRow;
  reguaAtiva: boolean;
  onCancelarNovo?: () => void;
}) {
  const router = useRouter();
  const novo = !passo;
  const [pending, start] = useTransition();
  const [tipo, setTipo] = useState<Tipo>(passo ? tipoDeQuando(passo.quando) : "antes");
  const [dias, setDias] = useState<number>(passo ? Math.abs(passo.quando) : 3);
  const [assunto, setAssunto] = useState(passo?.assunto ?? "");
  const [corpo, setCorpo] = useState(passo?.corpo ?? "");
  const [botao, setBotao] = useState(passo?.botao_texto ?? "Pagar fatura");
  const [ativo, setAtivo] = useState(passo?.ativo ?? true);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  const quando = tipo === "dia" ? 0 : tipo === "antes" ? -Math.abs(dias) : Math.abs(dias);
  const legenda =
    tipo === "dia"
      ? "Enviado no dia do vencimento"
      : tipo === "antes"
        ? `Enviado ${Math.abs(dias)} dia(s) antes do vencimento`
        : `Enviado ${Math.abs(dias)} dia(s) depois do vencimento`;

  async function salvar() {
    setMsg(null);
    const res = await fetch("/api/cobranca/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        acao: novo ? "criar" : "passo",
        id: passo?.id,
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
    setMsg({ tipo: "ok", texto: "Salvo." });
    start(() => router.refresh());
  }

  async function excluir() {
    if (novo) {
      onCancelarNovo?.();
      return;
    }
    if (!window.confirm("Excluir este toque da régua?")) return;
    const res = await fetch("/api/cobranca/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao: "excluir", id: passo?.id }),
    });
    if (res.ok) start(() => router.refresh());
  }

  return (
    <div
      className={`rounded-xl2 border bg-white p-5 shadow-card ${
        (ativo && reguaAtiva) || novo ? "border-line" : "border-line opacity-75"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-brand">{novo ? "Novo toque" : legenda}</span>
        {!novo && (
          <button
            onClick={() => setAtivo((v) => !v)}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
              ativo ? "bg-brand-light text-brand-dark" : "bg-rail text-ink-soft"
            }`}
          >
            {ativo ? <Check size={12} /> : <X size={12} />}
            {ativo ? "Ativo" : "Inativo"}
          </button>
        )}
      </div>

      <div className="mt-4 space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
          <label className="block">
            <span className="text-xs font-medium text-ink-muted">Quando enviar</span>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as Tipo)}
              className={classeControle("md", false, "mt-1 bg-white")}
            >
              <option value="antes">Antes do vencimento</option>
              <option value="dia">No dia do vencimento</option>
              <option value="depois">Depois do vencimento</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-ink-muted">Dias</span>
            <input
              type="number"
              min={1}
              max={365}
              value={dias}
              disabled={tipo === "dia"}
              onChange={(e) => setDias(Number(e.target.value))}
              className={classeControle("md", false, "num mt-1 disabled:bg-rail disabled:text-ink-soft")}
            />
          </label>
        </div>

        <label className="block">
          <span className="text-xs font-medium text-ink-muted">Assunto</span>
          <input
            value={assunto}
            onChange={(e) => setAssunto(e.target.value)}
            placeholder="Ex.: Sua fatura vence em breve"
            className={classeControle("md", false, "mt-1")}
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-ink-muted">Texto do e-mail</span>
          <textarea
            value={corpo}
            onChange={(e) => setCorpo(e.target.value)}
            rows={4}
            placeholder="Escreva a mensagem. Use {dias} para o número de dias e <br> para quebrar linha."
            className={classeControle("md", false, "mt-1 leading-relaxed")}
          />
          <span className="mt-1 block text-[11px] text-ink-soft">
            Use &lt;br&gt; para quebrar linha. Escreva <b>{"{dias}"}</b> para inserir o número de dias (antes ou depois).
          </span>
        </label>

        <label className="block sm:max-w-xs">
          <span className="text-xs font-medium text-ink-muted">Texto do botão</span>
          <input
            value={botao}
            onChange={(e) => setBotao(e.target.value)}
            className={classeControle("md", false, "mt-1")}
          />
          <span className="mt-1 block text-[11px] text-ink-soft">Leva para a fatura em aberto do cliente.</span>
        </label>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Botao variante="primario"
          onClick={salvar}
          disabled={pending}
        >
          {novo ? "Criar toque" : "Salvar alterações"}
        </Botao>
        <button
          onClick={excluir}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-ink-soft transition hover:text-danger"
        >
          <Trash2 size={14} /> {novo ? "Cancelar" : "Excluir"}
        </button>
        {msg && <Msg msg={msg} />}
      </div>
    </div>
  );
}

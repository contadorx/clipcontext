"use client";

import { useEffect, useState, useTransition } from "react";
import { Bot, User, Trash2, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import PageHeader from "@/components/ui/page-header";
import { SkeletonLinhas } from "@/components/ui/skeleton";
import Botao from "@/components/ui/botao";
import { classeControle } from "@/components/ui/campo";

type Turno = { role: "user" | "assistant"; content: string };
type Conversa = {
  id: string;
  escritorio_nome: string | null;
  contador_nome: string | null;
  contador_email: string | null;
  mensagens: Turno[];
  precisa_humano: boolean;
  atualizado_em: string;
};

function quando(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export default function AdminAssistente({
  systemPromptInicial,
  modeloInicial,
  atualizadoEm,
  padrao,
}: {
  systemPromptInicial: string;
  modeloInicial: string;
  atualizadoEm: string | null;
  padrao: string;
}) {
  const [pending, start] = useTransition();

  // ---- Treino ----
  const [prompt, setPrompt] = useState(systemPromptInicial);
  const [modelo, setModelo] = useState(modeloInicial);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvarTreino() {
    setSalvando(true);
    setMsg(null);
    try {
      const res = await fetch("/api/assistente/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system_prompt: prompt, modelo }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ tipo: "erro", texto: j.erro || "Não foi possível salvar." });
        return;
      }
      setMsg({ tipo: "ok", texto: "Treino salvo." });
    } finally {
      setSalvando(false);
    }
  }

  // ---- Conversas ----
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [soHumano, setSoHumano] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [aberta, setAberta] = useState<string | null>(null);

  async function carregar(humano: boolean) {
    setCarregando(true);
    try {
      const res = await fetch(`/api/assistente/conversas${humano ? "?humano=1" : ""}`);
      const j = await res.json().catch(() => ({}));
      setConversas(j.conversas ?? []);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar(soHumano);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soHumano]);

  async function excluir(id: string) {
    if (!window.confirm("Excluir esta conversa?")) return;
    const res = await fetch(`/api/assistente/conversas?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) start(() => carregar(soHumano));
  }
  async function limparTudo() {
    if (!window.confirm("Excluir TODAS as conversas? Isso não pode ser desfeito.")) return;
    const res = await fetch("/api/assistente/conversas?all=1", { method: "DELETE" });
    if (res.ok) start(() => carregar(soHumano));
  }

  return (
    <div className="space-y-8">
      <PageHeader titulo="Assistente de suporte" sub="Base de treino e histórico das conversas atendidas pelo bot." />

      {/* ===== Treino ===== */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Treino</h2>
          <p className="text-xs text-ink-muted">
            Instruções e personalidade do assistente. A base de ajuda (FAQ) e o formato da resposta são adicionados
            automaticamente — aqui você define o tom e as regras. Se deixar em branco, usa o texto padrão.
          </p>
        </div>
        <div className="rounded-xl2 bg-white p-4 shadow-card">
          <label className="block">
            <span className="text-xs font-medium text-ink-muted">Instruções do assistente</span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={8}
              placeholder={padrao}
              className={classeControle("md", false, "mt-1 leading-relaxed")}
            />
          </label>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="block sm:max-w-xs">
              <span className="text-xs font-medium text-ink-muted">Modelo (opcional)</span>
              <input
                value={modelo}
                onChange={(e) => setModelo(e.target.value)}
                placeholder="padrão do sistema"
                className={classeControle("md", false, "mt-1")}
              />
              <span className="mt-1 block text-[11px] text-ink-soft">Deixe vazio para usar o modelo padrão.</span>
            </label>
            <button
              onClick={() => setPrompt(padrao)}
              type="button"
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-muted transition hover:border-brand hover:text-brand"
            >
              <RotateCcw size={14} /> Usar texto padrão
            </button>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Botao variante="primario"
              onClick={salvarTreino}
              disabled={salvando}
            >
              Salvar treino
            </Botao>
            {msg && <span className={`text-sm ${msg.tipo === "ok" ? "text-brand" : "text-danger"}`}>{msg.texto}</span>}
            {atualizadoEm && !msg && (
              <span className="text-xs text-ink-soft">Atualizado em {quando(atualizadoEm)}</span>
            )}
          </div>
        </div>
      </section>

      {/* ===== Conversas ===== */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">Conversas</h2>
            <p className="text-xs text-ink-muted">Últimas conversas com o assistente (até 80).</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
              <input type="checkbox" checked={soHumano} onChange={(e) => setSoHumano(e.target.checked)} />
              Só as que pedem atendimento
            </label>
            {conversas.length > 0 && (
              <button
                onClick={limparTudo}
                disabled={pending}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-soft transition hover:text-danger"
              >
                <Trash2 size={13} /> Limpar todas
              </button>
            )}
          </div>
        </div>

        {carregando ? (
          <SkeletonLinhas linhas={5} colunas={2} />
        ) : conversas.length === 0 ? (
          <div className="rounded-xl2 bg-white p-8 text-center text-sm text-ink-soft shadow-card">
            Nenhuma conversa {soHumano ? "que peça atendimento humano " : ""}por aqui ainda.
          </div>
        ) : (
          <div className="space-y-2">
            {conversas.map((c) => {
              const aberto = aberta === c.id;
              const titulo = c.escritorio_nome || c.contador_email || "Conversa";
              return (
                <div key={c.id} className="overflow-hidden rounded-xl2 bg-white shadow-card">
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <button
                      onClick={() => setAberta(aberto ? null : c.id)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      {aberto ? (
                        <ChevronUp size={15} className="shrink-0 text-ink-soft" />
                      ) : (
                        <ChevronDown size={15} className="shrink-0 text-ink-soft" />
                      )}
                      <span className="truncate text-sm font-semibold text-ink">{titulo}</span>
                      {c.precisa_humano && (
                        <span className="shrink-0 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-danger">
                          pede atendimento
                        </span>
                      )}
                    </button>
                    <span className="shrink-0 text-xs text-ink-soft">{quando(c.atualizado_em)}</span>
                    <button
                      onClick={() => excluir(c.id)}
                      disabled={pending}
                      className="shrink-0 text-ink-soft transition hover:text-danger"
                      aria-label="Excluir conversa"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {aberto && (
                    <div className="space-y-3 border-t border-line bg-rail/40 px-4 py-3">
                      {(c.contador_email || c.contador_nome) && (
                        <p className="text-[11px] text-ink-soft">
                          {c.contador_nome ? c.contador_nome + " · " : ""}
                          {c.contador_email}
                        </p>
                      )}
                      {(c.mensagens ?? []).map((m, i) => (
                        <div key={i} className="flex gap-2">
                          <span className="mt-0.5 shrink-0">
                            {m.role === "user" ? (
                              <User size={14} className="text-ink-soft" />
                            ) : (
                              <Bot size={14} className="text-brand" />
                            )}
                          </span>
                          <p className="whitespace-pre-wrap text-sm text-ink-muted">{m.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

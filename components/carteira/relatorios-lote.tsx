"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Check, AlertTriangle, Send } from "lucide-react";
import Botao from "@/components/ui/botao";

type Emp = { id: string; nome: string };

// Gera/publica a análise de IA de vários clientes de uma vez, em lote.
// O loop roda no navegador, chamando os endpoints que já existem (um por empresa) —
// evita timeout do servidor e mostra o progresso. Geração cria rascunho; publicar avisa o cliente.
export default function RelatoriosLote({
  pendentes,
  rascunhos,
  competencia,
  mesNome,
  creditos,
}: {
  pendentes: Emp[];
  rascunhos: Emp[];
  competencia: string;
  mesNome: string;
  creditos: number;
}) {
  const router = useRouter();
  const [rodando, setRodando] = useState<null | "gerar" | "publicar">(null);
  const [prog, setProg] = useState({ feito: 0, total: 0, nome: "" });
  const [resultado, setResultado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function gerarTodos() {
    if (!pendentes.length || rodando) return;
    setRodando("gerar");
    setResultado(null);
    setErro(null);
    let ok = 0;
    for (let i = 0; i < pendentes.length; i++) {
      const e = pendentes[i];
      setProg({ feito: i, total: pendentes.length, nome: e.nome });
      try {
        const res = await fetch("/api/analise-mes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ empresaId: e.id, competencia, action: "gerar" }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          setErro(`Parou em ${e.nome}: ${j.error || "erro ao gerar"}. ${ok} de ${pendentes.length} geradas.`);
          setRodando(null);
          if (ok > 0) router.refresh();
          return;
        }
        ok++;
      } catch {
        setErro(`Falha de rede em ${e.nome}. ${ok} de ${pendentes.length} geradas.`);
        setRodando(null);
        if (ok > 0) router.refresh();
        return;
      }
    }
    setResultado(`${ok} ${ok === 1 ? "análise gerada" : "análises geradas"} como rascunho. Revise e publique.`);
    setRodando(null);
    router.refresh();
  }

  async function publicarTodos() {
    if (!rascunhos.length || rodando) return;
    setRodando("publicar");
    setResultado(null);
    setErro(null);
    let ok = 0;
    for (let i = 0; i < rascunhos.length; i++) {
      const e = rascunhos[i];
      setProg({ feito: i, total: rascunhos.length, nome: e.nome });
      try {
        // busca o rascunho salvo e publica com o mesmo texto
        const g = await fetch(`/api/analise-mes?empresaId=${encodeURIComponent(e.id)}&competencia=${competencia}`);
        const gj = await g.json().catch(() => ({}));
        const resumo = gj?.analise?.resumo ?? "";
        const analise = gj?.analise?.analise ?? "";
        const res = await fetch("/api/analise-mes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ empresaId: e.id, competencia, action: "publicar", resumo, analise }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          setErro(`Parou em ${e.nome}: ${j.error || "erro ao publicar"}. ${ok} de ${rascunhos.length} publicadas.`);
          setRodando(null);
          if (ok > 0) router.refresh();
          return;
        }
        ok++;
      } catch {
        setErro(`Falha em ${e.nome}. ${ok} de ${rascunhos.length} publicadas.`);
        setRodando(null);
        if (ok > 0) router.refresh();
        return;
      }
    }
    setResultado(`${ok} ${ok === 1 ? "relatório publicado" : "relatórios publicados"} no portal. Clientes avisados.`);
    setRodando(null);
    router.refresh();
  }

  if (!pendentes.length && !rascunhos.length) return null;

  return (
    <div className="rounded-xl2 bg-white p-4 shadow-card">
      <div className="flex items-center gap-2">
        <FileText size={16} className="text-ink-muted" />
        <h3 className="text-[13px] font-bold text-ink">Relatórios de {mesNome} em lote</h3>
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        Gere a análise de IA de todos os clientes de uma vez (rascunho), revise e publique — sem ir um por um.
      </p>

      {rodando && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-surface px-3 py-2 text-xs text-ink-muted">
          <Loader2 size={14} className="animate-spin" />
          {rodando === "gerar" ? "Gerando" : "Publicando"} {Math.min(prog.feito + 1, prog.total)} de {prog.total}
          {prog.nome ? ` — ${prog.nome}` : ""}…
        </div>
      )}
      {erro && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-danger/30 bg-rose-50 px-3 py-2 text-xs text-danger">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {erro}
        </div>
      )}
      {resultado && !erro && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-brand/30 bg-brand-light px-3 py-2 text-xs text-brand-dark">
          <Check size={14} className="mt-0.5 shrink-0" /> {resultado}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {pendentes.length > 0 && (
          <Botao variante="primario" tamanho="sm"
            onClick={gerarTodos}
            disabled={!!rodando}
          >
            <FileText size={14} /> Gerar análise de {pendentes.length} cliente{pendentes.length > 1 ? "s" : ""}
          </Botao>
        )}
        {rascunhos.length > 0 && (
          <button
            type="button"
            onClick={publicarTodos}
            disabled={!!rodando}
            className="flex items-center gap-1.5 rounded-lg border border-brand/40 bg-brand-light px-3 py-2 text-xs font-semibold text-brand-dark transition hover:bg-brand/15 disabled:opacity-60"
          >
            <Send size={14} /> Publicar {rascunhos.length} rascunho{rascunhos.length > 1 ? "s" : ""}
          </button>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
        <span className="text-ink-soft">
          Saldo de IA: <b className="text-ink">{creditos}</b> crédito{creditos === 1 ? "" : "s"}
        </span>
        {pendentes.length > 0 && (
          <span className="text-ink-soft">
            · gerar os {pendentes.length} pendente{pendentes.length > 1 ? "s" : ""} consome até <b className="text-ink">{pendentes.length}</b> crédito{pendentes.length > 1 ? "s" : ""}
          </span>
        )}
        {pendentes.length > 0 && creditos < pendentes.length && (
          <span className="font-semibold text-amber-600">
            · saldo cobre {creditos}; os outros {pendentes.length - creditos} ficam pendentes até comprar mais
          </span>
        )}
      </div>
      <p className="mt-1 text-[11px] text-ink-soft">Publicar rascunho não consome crédito.</p>
    </div>
  );
}

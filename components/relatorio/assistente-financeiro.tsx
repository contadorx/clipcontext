"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, Coins } from "lucide-react";
import MessageStrip from "@/components/ui/message-strip";
import Botao from "@/components/ui/botao";
import { classeControle } from "@/components/ui/campo";

type Msg = { autor: "bot" | "user"; texto: string };

function compAtual() {
  return new Date().toISOString().slice(0, 7);
}

const SAUDACAO =
  "Pergunte sobre os números desta empresa no mês selecionado — por exemplo: por que o saldo mudou em relação ao mês anterior? quais as maiores despesas? Cada pergunta usa 1 crédito de IA.";

export default function AssistenteFinanceiro({ empresaId }: { empresaId: string }) {
  const [competencia, setCompetencia] = useState(compAtual());
  const [msgs, setMsgs] = useState<Msg[]>([{ autor: "bot", texto: SAUDACAO }]);
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const [creditos, setCreditos] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);

  // saldo de créditos (reusa o GET da análise mensal, que devolve creditos)
  useEffect(() => {
    if (!empresaId) return;
    (async () => {
      try {
        const res = await fetch(
          `/api/analise-mes?empresaId=${encodeURIComponent(empresaId)}&competencia=${competencia}`,
        );
        const data = await res.json();
        if (typeof data?.creditos === "number") setCreditos(data.creditos);
      } catch {
        /* ignora */
      }
    })();
  }, [empresaId, competencia]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  async function enviar() {
    const q = texto.trim();
    if (!q || pensando) return;
    setErro(null);
    setTexto("");
    const historico = msgs
      .filter((m, i) => !(i === 0 && m.autor === "bot"))
      .slice(-6)
      .map((m) => ({ role: m.autor === "user" ? ("user" as const) : ("assistant" as const), content: m.texto }));
    setMsgs((m) => [...m, { autor: "user", texto: q }]);
    setPensando(true);
    try {
      const res = await fetch("/api/assistente-financeiro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresaId, competencia, pergunta: q, historico }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.semCreditos) {
          setCreditos(0);
          setErro("Você está sem créditos de IA. Compre um pacote na seção de análise acima para continuar.");
        } else {
          setErro(data?.erro || "Não foi possível responder.");
        }
        return;
      }
      setMsgs((m) => [...m, { autor: "bot", texto: data.resposta }]);
      if (typeof data?.creditos === "number") setCreditos(data.creditos);
    } catch {
      setErro("Erro de conexão. Tente de novo.");
    } finally {
      setPensando(false);
    }
  }

  if (!empresaId) return null;

  return (
    <div className="rounded-xl2 bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-brand" />
          <h3 className="text-[13px] font-bold text-ink">Pergunte à IA sobre os números</h3>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={competencia}
            onChange={(e) => setCompetencia(e.target.value)}
            className={classeControle("md")}
          />
          {creditos !== null && (
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                creditos > 0 ? "border-line text-ink-muted" : "border-amber-300 bg-amber-50 text-amber-700"
              }`}
            >
              <Coins size={13} /> {creditos} crédito{creditos === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 max-h-96 space-y-3 overflow-y-auto">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.autor === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-xl2 px-3.5 py-2.5 text-sm ${
                m.autor === "user" ? "bg-brand text-white" : "bg-surface text-ink"
              }`}
            >
              {m.texto}
            </div>
          </div>
        ))}
        {pensando && (
          <div className="flex justify-start">
            <div className="rounded-xl2 bg-surface px-3.5 py-2.5 text-sm text-ink-muted">Analisando…</div>
          </div>
        )}
        <div ref={fimRef} />
      </div>

      {erro && <MessageStrip tipo="erro" className="mt-3">{erro}</MessageStrip>}

      <div className="mt-3 flex items-end gap-2">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              enviar();
            }
          }}
          rows={1}
          placeholder="Ex.: por que o saldo caiu em relação ao mês passado?"
          className={classeControle("md", false, "flex-1 resize-none")}
        />
        <Botao variante="primario"
          onClick={enviar}
          disabled={pensando || !texto.trim()}
        >
          <Send size={15} /> Enviar
        </Botao>
      </div>
    </div>
  );
}

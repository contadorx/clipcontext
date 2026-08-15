"use client";

import { useState } from "react";
import { Send, Loader2, Check, AlertCircle } from "lucide-react";
import Botao from "@/components/ui/botao";

export default function DigestDisparo() {
  const [enviando, setEnviando] = useState(false);
  const [soParaMim, setSoParaMim] = useState(true);
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null);

  async function disparar() {
    setEnviando(true);
    setResultado(null);
    try {
      const r = await fetch("/api/admin/digest/disparar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ soParaMim }),
      });
      const j = await r.json();
      if (!r.ok) {
        setResultado({ ok: false, texto: j.erro || "Falha ao disparar." });
      } else if (j.modo === "so_para_mim") {
        setResultado({
          ok: true,
          texto: j.tinhaAlgoRelevante
            ? `Enviado para ${j.enviadoPara}. Confira sua caixa de entrada.`
            : `Enviado para ${j.enviadoPara} — mas hoje não há nada a vencer, vencer ou movimentar, então o resumo veio "vazio" (em produção, dias assim não geram e-mail).`,
        });
      } else {
        setResultado({
          ok: true,
          texto: `Disparo real: ${j.enviados} enviado(s), ${j.pulados} pulado(s)${
            j.erros?.length ? `, ${j.erros.length} com erro` : ""
          }.`,
        });
      }
    } catch (e) {
      setResultado({ ok: false, texto: e instanceof Error ? e.message : "Falha de conexão." });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="rounded-xl2 bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-ink">Resumo diário</p>
          <p className="text-[11px] text-ink-soft">Dispare o e-mail de resumo na hora, para testar.</p>
        </div>
        <Botao variante="primario"
          onClick={disparar}
          disabled={enviando}
        >
          {enviando ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          {enviando ? "Enviando..." : "Disparar agora"}
        </Botao>
      </div>

      <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-ink-muted">
        <input
          type="checkbox"
          checked={soParaMim}
          onChange={(e) => setSoParaMim(e.target.checked)}
          disabled={enviando}
          className="h-4 w-4 rounded border-line accent-brand"
        />
        Enviar só para mim (teste) — desmarque para disparar de verdade a todos os escritórios com o resumo ativado
      </label>

      {resultado && (
        <div
          className={`mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${
            resultado.ok ? "bg-brand/8 text-brand-dark" : "bg-danger/8 text-danger"
          }`}
        >
          {resultado.ok ? <Check size={14} className="mt-0.5 shrink-0" /> : <AlertCircle size={14} className="mt-0.5 shrink-0" />}
          <span>{resultado.texto}</span>
        </div>
      )}
    </div>
  );
}

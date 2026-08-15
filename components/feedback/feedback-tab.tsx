"use client";

import { useState } from "react";
import { MessageSquarePlus, X, Lightbulb, Bug, Heart, Check, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Botao from "@/components/ui/botao";
import { classeControle } from "@/components/ui/campo";

type TipoFb = "ideia" | "problema" | "elogio";

const TIPOS: { v: TipoFb; l: string; Icon: typeof Lightbulb }[] = [
  { v: "ideia", l: "Ideia", Icon: Lightbulb },
  { v: "problema", l: "Problema", Icon: Bug },
  { v: "elogio", l: "Elogio", Icon: Heart },
];

export default function FeedbackTab({ escritorioId }: { escritorioId: string }) {
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState<TipoFb>("ideia");
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function abrir() {
    setTipo("ideia");
    setMensagem("");
    setEnviado(false);
    setErro(null);
    setAberto(true);
  }

  async function enviar() {
    if (!mensagem.trim()) {
      setErro("Escreva sua mensagem.");
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await supabase.from("feedbacks").insert({
        escritorio_id: escritorioId,
        user_id: user?.id ?? null,
        tipo,
        mensagem: mensagem.trim(),
        pagina: typeof window !== "undefined" ? window.location.pathname : null,
      });
      if (error) throw error;
      setEnviado(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui enviar agora. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      {/* aba vertical na lateral direita */}
      <Botao variante="primario" tamanho="sm" className="fixed right-0 top-1/2 z-40 -translate-y-1/2 -lg shadow-card [writing-mode:vertical-rl] rotate-180"
        onClick={abrir}
        title="Enviar feedback"
      >
        <MessageSquarePlus size={15} className="rotate-90" />
        Feedback
      </Botao>

      {aberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-rail/50 p-4"
          onClick={() => setAberto(false)}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="dlg-feedback-titulo" className="w-full max-w-sm rounded-xl2 bg-white p-5 shadow-card" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 id="dlg-feedback-titulo" className="text-base font-bold text-ink">Deixe seu feedback</h3>
              <button aria-label="Fechar"
                type="button"
                onClick={() => setAberto(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft hover:bg-surface"
              >
                <X size={18} />
              </button>
            </div>

            {enviado ? (
              <div className="py-6 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-light text-brand">
                  <Check size={24} />
                </div>
                <p className="text-sm font-semibold text-ink">Recebido! Obrigado pela ajuda.</p>
                <p className="mt-1 text-xs text-ink-muted">Sua mensagem chega direto para a equipe do FinanceiroX.</p>
                <button
                  type="button"
                  onClick={() => setAberto(false)}
                  className="mt-4 rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark"
                >
                  Fechar
                </button>
              </div>
            ) : (
              <>
                <p className="mb-3 text-xs text-ink-muted">
                  O que você quer nos contar? Sua opinião ajuda a melhorar o sistema.
                </p>

                <div className="mb-3 grid grid-cols-3 gap-1.5">
                  {TIPOS.map(({ v, l, Icon }) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setTipo(v)}
                      className={[
                        "flex flex-col items-center gap-1 rounded-lg border py-2.5 text-xs font-semibold transition",
                        tipo === v ? "border-brand bg-brand-light text-brand-dark" : "border-line text-ink-muted hover:bg-surface",
                      ].join(" ")}
                    >
                      <Icon size={18} className={tipo === v ? "text-brand" : "text-ink-soft"} />
                      {l}
                    </button>
                  ))}
                </div>

                <textarea
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  rows={4}
                  placeholder={
                    tipo === "problema"
                      ? "Descreva o que deu errado e em qual tela…"
                      : tipo === "ideia"
                        ? "Conte a ideia ou o que facilitaria seu dia…"
                        : "Conte o que você curtiu…"
                  }
                  className={classeControle("md", false, "resize-none bg-white")}
                />

                {erro && (
                  <p className="mt-2 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-danger">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {erro}
                  </p>
                )}

                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setAberto(false)}
                    className="rounded-md border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-muted transition hover:bg-surface"
                  >
                    Cancelar
                  </button>
                  <Botao variante="primario"
                    onClick={enviar}
                    disabled={enviando}
                  >
                    {enviando ? "Enviando…" : "Enviar"}
                  </Botao>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

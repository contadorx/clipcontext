"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, LifeBuoy } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Botao from "@/components/ui/botao";
import { classeControle } from "@/components/ui/campo";

type Faq = { id: string; categoria: string; pergunta: string; resposta: string };
type Msg = { autor: "bot" | "user"; texto: string };

const SAUDACAO =
  "Oi! Sou o assistente do FinanceiroX. Posso ajudar com dúvidas sobre o sistema — lançamentos, conciliação, relatórios, portal e mais. O que você precisa?";

const PARAR = new Set([
  "a", "o", "os", "as", "de", "da", "do", "das", "dos", "e", "ou", "um", "uma", "para",
  "por", "com", "no", "na", "nos", "nas", "que", "como", "qual", "quais", "meu", "minha",
  "se", "em", "ao", "à", "é", "eu", "the", "of",
]);

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !PARAR.has(w));
}

export default function SuporteChat() {
  const [aberto, setAberto] = useState(false);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [msgs, setMsgs] = useState<Msg[]>([{ autor: "bot", texto: SAUDACAO }]);
  const [texto, setTexto] = useState("");
  const [modoEscala, setModoEscala] = useState(false);
  const [nome, setNome] = useState("");
  const [contato, setContato] = useState("");
  const [ultimaPergunta, setUltimaPergunta] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [pensando, setPensando] = useState(false);
  const conversaIdRef = useRef<string>("");
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto || faqs.length) return;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("faq")
        .select("id, categoria, pergunta, resposta")
        .eq("publicado", true);
      setFaqs((data as Faq[]) ?? []);
    })();
  }, [aberto, faqs.length]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, modoEscala]);

  function melhorResposta(q: string): Faq | null {
    const tq = tokens(q);
    if (!tq.length) return null;
    let melhor: Faq | null = null;
    let melhorScore = 0;
    for (const f of faqs) {
      const alvo = tokens(f.pergunta + " " + f.categoria + " " + f.resposta);
      const set = new Set(alvo);
      let score = 0;
      for (const w of tq) if (set.has(w)) score++;
      // peso extra para acerto no título
      const tituloSet = new Set(tokens(f.pergunta + " " + f.categoria));
      for (const w of tq) if (tituloSet.has(w)) score += 1;
      if (score > melhorScore) {
        melhorScore = score;
        melhor = f;
      }
    }
    return melhorScore >= 2 ? melhor : null;
  }

  async function enviar() {
    const q = texto.trim();
    if (!q || pensando) return;
    setTexto("");
    setUltimaPergunta(q);
    const historico = msgs
      .filter((m, i) => !(i === 0 && m.autor === "bot")) // pula a saudação
      .slice(-6)
      .map((m) => ({ role: m.autor === "user" ? ("user" as const) : ("assistant" as const), content: m.texto }));
    setMsgs((m) => [...m, { autor: "user", texto: q }]);
    setPensando(true);
    if (!conversaIdRef.current) {
      conversaIdRef.current =
        typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
    }
    try {
      const res = await fetch("/api/suporte-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pergunta: q, historico, conversaId: conversaIdRef.current }),
      });
      const data = await res.json();
      if (!res.ok || !data.resposta) throw new Error(data?.erro || "falha");
      setMsgs((m) => [...m, { autor: "bot", texto: data.resposta }]);
      if (data.escalar) setModoEscala(true);
    } catch {
      // fallback: busca local na base
      const r = melhorResposta(q);
      if (r) {
        setMsgs((m) => [...m, { autor: "bot", texto: `${r.resposta}\n\n(Tema: ${r.categoria})` }]);
      } else {
        setMsgs((m) => [
          ...m,
          {
            autor: "bot",
            texto:
              "Não consegui responder agora. Posso encaminhar para a equipe — me deixa seu nome e o melhor contato.",
          },
        ]);
        setModoEscala(true);
      }
    } finally {
      setPensando(false);
    }
  }

  async function escalar() {
    if (!contato.trim()) return;
    const supabase = createClient();
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      await supabase.from("suporte_solicitacoes").insert({
        user_id: user?.id ?? null,
        nome: nome.trim() || null,
        contato: contato.trim(),
        mensagem: ultimaPergunta || "(sem mensagem)",
      });
    } catch {
      /* best-effort */
    }
    setEnviado(true);
    setModoEscala(false);
    setMsgs((m) => [
      ...m,
      {
        autor: "bot",
        texto: `Obrigado${nome ? ", " + nome.split(" ")[0] : ""}! Registramos seu contato e a equipe retorna em breve. 💚`,
      },
    ]);
  }

  return (
    <>
      {/* bolinha */}
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        className="fixed bottom-5 right-5 z-40 flex h-13 w-13 items-center justify-center rounded-full bg-brand p-3.5 text-white shadow-lg transition hover:bg-brand-dark"
        title="Ajuda do FinanceiroX"
        style={{ height: 52, width: 52 }}
      >
        {aberto ? <X size={22} /> : <MessageCircle size={22} />}
      </button>

      {/* painel */}
      {aberto && (
        <div className="fixed bottom-20 right-5 z-40 flex max-h-[70vh] w-[min(92vw,360px)] flex-col overflow-hidden rounded-xl2 border border-line bg-white shadow-2xl">
          <div className="flex items-center gap-2 bg-rail px-4 py-3 text-white">
            <LifeBuoy size={18} />
            <div className="leading-tight">
              <p className="text-sm font-bold">Assistente</p>
              <p className="text-[11px] text-white/60">FinanceiroX</p>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {msgs.map((m, i) => (
              <div key={i} className={m.autor === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={[
                    "max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm",
                    m.autor === "user"
                      ? "bg-brand text-white"
                      : "border border-line bg-surface text-ink",
                  ].join(" ")}
                >
                  {m.texto}
                </div>
              </div>
            ))}

            {pensando && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-line bg-surface px-3 py-2 text-sm text-ink-soft">
                  digitando…
                </div>
              </div>
            )}

            {modoEscala && !enviado && (
              <div className="rounded-xl border border-line bg-white p-3">
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Seu nome"
                  className={classeControle("md", false, "mb-2")}
                />
                <input
                  value={contato}
                  onChange={(e) => setContato(e.target.value)}
                  placeholder="E-mail ou WhatsApp"
                  className={classeControle("md", false, "mb-2")}
                />
                <Botao variante="primario" largura
                  onClick={escalar}
                  disabled={!contato.trim()}
                >
                  Encaminhar para a equipe
                </Botao>
              </div>
            )}
            <div ref={fimRef} />
          </div>

          {!modoEscala && (
            <div className="flex items-center gap-2 border-t border-line p-2.5">
              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") enviar();
                }}
                placeholder="Escreva sua dúvida…"
                className={classeControle("md", false, "flex-1")}
              />
              <Botao variante="primario" className="h-9 w-9" aria-label="Enviar"
                onClick={enviar}
              >
                <Send size={16} />
              </Botao>
            </div>
          )}
        </div>
      )}
    </>
  );
}

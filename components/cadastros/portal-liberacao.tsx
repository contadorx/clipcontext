"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, CalendarRange, Inbox, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import MessageStrip from "@/components/ui/message-strip";
import Card from "@/components/ui/card";

export default function PortalLiberacao({
  empresaId,
  liberaAnalise,
  liberaDocumentos,
  avisarRelatorio,
  periodo,
}: {
  empresaId: string;
  liberaAnalise: boolean;
  liberaDocumentos: boolean;
  avisarRelatorio: boolean;
  periodo: string;
}) {
  const router = useRouter();
  const [analise, setAnalise] = useState(liberaAnalise);
  const [docs, setDocs] = useState(liberaDocumentos);
  const [avisar, setAvisar] = useState(avisarRelatorio);
  const [per, setPer] = useState(periodo === "mensal" ? "mensal" : "anual");

  const [erro, setErro] = useState<string | null>(null);

  /**
   * Grava uma das chaves do que o cliente enxerga.
   *
   * As quatro chaves passavam por aqui com o erro descartado, e todas viram na
   * tela antes de o banco confirmar. Desligar "Receber documentos no portal" e
   * a gravação falhar significava: a chave aparecia desligada, o
   * `router.refresh()` a trazia de volta ligada, e o cliente continuava
   * enviando documento — sem que ninguém soubesse que o comando não pegou.
   *
   * Devolve `false` quando falha, para quem chamou desfazer o estado otimista.
   */
  async function salvar(campos: Record<string, unknown>): Promise<boolean> {
    const supabase = createClient();
    setErro(null);
    const r = await supabase.from("empresas").update(campos).eq("id", empresaId);
    if (r.error) {
      setErro(`Não foi possível salvar (${r.error.message}). Nada mudou para o cliente.`);
      return false;
    }
    router.refresh();
    return true;
  }

  return (
    <Card titulo="O que o cliente vê no portal">
      <div className="space-y-3">
      {erro && <MessageStrip tipo="erro" fechavel onFechar={() => setErro(null)}>{erro}</MessageStrip>}
      <div className="flex items-center justify-between gap-4 rounded-lg border border-line p-3">
        <div className="flex items-start gap-2.5">
          <Sparkles size={18} className="mt-0.5 shrink-0 text-brand" />
          <div>
            <p className="text-sm font-semibold text-ink">Liberar a análise do mês (IA)</p>
            <p className="text-xs text-ink-soft">
              Mostra no portal a última análise que você publicar (em Relatórios → Análise do mês).
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            const novo = !analise;
            setAnalise(novo);
            void salvar({ portal_libera_analise: novo }).then((ok) => !ok && setAnalise(!novo));
          }}
          aria-pressed={analise}
          aria-label="Liberar a análise do mês (IA) no portal"
          className={`relative h-6 w-11 shrink-0 rounded-full transition ${analise ? "bg-brand" : "bg-line"}`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
              analise ? "left-[22px]" : "left-0.5"
            }`}
          />
        </button>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-lg border border-line p-3">
        <div className="flex items-start gap-2.5">
          <Inbox size={18} className="mt-0.5 shrink-0 text-brand" />
          <div>
            <p className="text-sm font-semibold text-ink">Receber documentos no portal</p>
            <p className="text-xs text-ink-soft">
              Mostra ao cliente a aba para enviar notas, boletos e comprovantes. Desligue para esconder o envio.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            const novo = !docs;
            setDocs(novo);
            void salvar({ portal_libera_documentos: novo }).then((ok) => !ok && setDocs(!novo));
          }}
          aria-pressed={docs}
          aria-label="Receber documentos pelo portal"
          className={`relative h-6 w-11 shrink-0 rounded-full transition ${docs ? "bg-brand" : "bg-line"}`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
              docs ? "left-[22px]" : "left-0.5"
            }`}
          />
        </button>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-lg border border-line p-3">
        <div className="flex items-start gap-2.5">
          <Mail size={18} className="mt-0.5 shrink-0 text-brand" />
          <div>
            <p className="text-sm font-semibold text-ink">Avisar quando eu publicar o relatório</p>
            <p className="text-xs text-ink-soft">
              Envia um e-mail aos clientes do portal com o link, toda vez que você publicar a análise do mês.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            const novo = !avisar;
            setAvisar(novo);
            void salvar({ avisar_relatorio: novo }).then((ok) => !ok && setAvisar(!novo));
          }}
          aria-pressed={avisar}
          aria-label="Avisar o cliente quando eu publicar o relatório"
          className={`relative h-6 w-11 shrink-0 rounded-full transition ${avisar ? "bg-brand" : "bg-line"}`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
              avisar ? "left-[22px]" : "left-0.5"
            }`}
          />
        </button>
      </div>

      <div className="rounded-lg border border-line p-3">
        <div className="mb-2 flex items-center gap-2.5">
          <CalendarRange size={18} className="text-brand" />
          <div>
            <p className="text-sm font-semibold text-ink">Visualização</p>
            <p className="text-xs text-ink-soft">Como o cliente enxerga o resumo financeiro.</p>
          </div>
        </div>
        <div className="flex gap-1.5">
          {(["mensal", "anual"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                const antes = per;
                setPer(p);
                void salvar({ portal_periodo: p }).then((ok) => !ok && setPer(antes));
              }}
              className={
                per === p
                  ? "rounded-lg bg-brand px-4 py-1.5 text-xs font-semibold text-white"
                  : "rounded-lg border border-line px-4 py-1.5 text-xs font-medium text-ink-muted transition hover:bg-surface"
              }
            >
              {p === "mensal" ? "Mensal" : "Anual"}
            </button>
          ))}
        </div>
      </div>
      </div>
    </Card>
  );
}

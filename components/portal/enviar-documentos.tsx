"use client";

import { useRef, useState } from "react";
import { Upload, Check, Loader2, AlertTriangle, FileText, X, Paperclip, Info } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { comprimirImagem } from "@/lib/comprimir-imagem";
import { lerDadosDocumento } from "@/lib/documento-impressao";
import Botao from "@/components/ui/botao";
import { classeControle } from "@/components/ui/campo";

const BUCKET = "documentos-entrada";
const MAX_MB = 20;
const ACEITA = ".pdf,.jpg,.jpeg,.png,.xml,.doc,.docx,.ofx,.csv";

type ItemStatus = "pendente" | "enviando" | "ok" | "erro";
type Item = { id: string; file: File; status: ItemStatus; erro?: string; encolheu?: { de: number; para: number } };

function tamanhoHumano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function EnviarDocumentos({
  token,
  identidade,
}: {
  token: string;
  identidade?: { nome: string | null; email: string } | null;
}) {
  const [itens, setItens] = useState<Item[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [obs, setObs] = useState("");
  const [natureza, setNatureza] = useState("");
  const [enviados, setEnviados] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  function adicionar(files: FileList | null) {
    if (!files || files.length === 0) return;
    const novos: Item[] = Array.from(files).map((f) => ({ id: crypto.randomUUID(), file: f, status: "pendente" }));
    setItens((s) => [...s, ...novos]);
  }
  /*
    O X tira o arquivo da fila de verdade, e não só da tela.

    `enviar()` fotografa a lista de pendentes antes do laço; `remover` mexia só
    em `itens`. Quem clicasse no X durante o envio via a linha sumir enquanto o
    arquivo continuava sendo comprimido, subindo, registrado em
    `documentos_recebidos` e gravado na auditoria do portal com o nome e o
    e-mail de quem enviou. Já era assim antes; a compressão alargou a janela de
    um segundo para dezenas, e um cliente que percebe ter anexado a foto errada
    tem esses segundos para se arrepender.
  */
  const removidos = useRef<Set<string>>(new Set());
  function remover(id: string) {
    removidos.current.add(id);
    setItens((s) => s.filter((i) => i.id !== id));
  }

  async function enviarUm(
    it: Item,
    supabase: ReturnType<typeof createClient>,
  ): Promise<{ ok: boolean; erro?: string; encolheu?: { de: number; para: number } }> {
    try {
      /*
        A redução acontece **antes** da checagem dos 20 MB, e isso é de propósito.

        Este é o caminho do cliente final, que fotografa a nota com o celular: um
        aparelho recente entrega 4 a 8 MB, e alguns passam do limite. Antes, a
        resposta era "acima de 20 MB" e o problema virava dele — sem saber o que
        fazer, ele desiste ou manda por WhatsApp, que é exatamente o que este
        canal existe para substituir. Reduzindo primeiro, a foto entra.
      */
      const { arquivo, comprimido, bytesAntes, bytesDepois } = await comprimirImagem(it.file);
      if (arquivo.size > MAX_MB * 1024 * 1024) return { ok: false, erro: `acima de ${MAX_MB} MB` };
      const dados = await lerDadosDocumento(arquivo);

      const r1 = await fetch("/api/portal/enviar-documento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "assinar", token, nome: arquivo.name, tipo: arquivo.type, tamanho: arquivo.size }),
      });
      const d1 = await r1.json();
      if (!r1.ok) return { ok: false, erro: d1.detalhe ? `${d1.error} (${d1.detalhe})` : d1.error || "falha ao preparar" };
      const up = await supabase.storage.from(BUCKET).uploadToSignedUrl(d1.path, d1.token, arquivo);
      if (up.error) return { ok: false, erro: "falha no upload" };
      const r2 = await fetch("/api/portal/enviar-documento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "registrar", token, path: d1.path, nome: arquivo.name, tamanho: arquivo.size, observacao: obs, natureza, dados }),
      });
      const d2 = await r2.json();
      if (!r2.ok) return { ok: false, erro: d2.error || "falha ao registrar" };
      return { ok: true, encolheu: comprimido ? { de: bytesAntes, para: bytesDepois } : undefined };
    } catch {
      return { ok: false, erro: "erro inesperado" };
    }
  }

  async function enviar() {
    const pend = itens.filter((i) => i.status === "pendente" || i.status === "erro");
    if (pend.length === 0) return;
    setEnviando(true);
    const supabase = createClient();
    let ok = 0;
    for (const it of pend) {
      if (removidos.current.has(it.id)) continue;
      setItens((s) => s.map((i) => (i.id === it.id ? { ...i, status: "enviando", erro: undefined } : i)));
      const r = await enviarUm(it, supabase);
      // pode ter sido cancelado enquanto comprimia/subia: não conta nem pinta
      if (removidos.current.has(it.id)) continue;
      if (r.ok) ok++;
      setItens((s) =>
        s.map((i) =>
          i.id === it.id ? { ...i, status: r.ok ? "ok" : "erro", erro: r.erro, encolheu: r.encolheu } : i,
        ),
      );
    }
    if (ok > 0) {
      setEnviados((n) => n + ok);
      setObs("");
      setNatureza("");
    }
    setEnviando(false);
  }

  const pendentes = itens.filter((i) => i.status !== "ok").length;

  return (
    <div className="rounded-xl2 bg-white p-4 shadow-card">
      <div className="flex items-center gap-2">
        <Paperclip size={16} className="text-brand" />
        <h2 className="text-[13px] font-bold text-ink">Enviar documentos</h2>
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        Envie notas fiscais, boletos e comprovantes direto para a sua contabilidade — sem e-mail nem WhatsApp. PDF,
        imagens, XML, extrato ou Word. Fotos de celular são reduzidas antes de subir, mantendo o documento legível;
        os demais arquivos vão até {MAX_MB} MB.
      </p>

      {!identidade ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-line bg-surface px-3 py-3 text-xs text-ink-muted">
          <Info size={15} className="mt-0.5 shrink-0 text-ink-soft" />
          <span>
            Para enviar documentos com segurança, é preciso entrar pelo <b>link de acesso</b> que a sua
            contabilidade envia por e-mail. Assim cada envio fica registrado em seu nome. Peça o seu acesso à
            contabilidade.
          </span>
        </div>
      ) : (
        <>
          <p className="mt-2 text-[11px] font-medium text-brand-dark">
            Enviando como {identidade.nome?.trim() || identidade.email}.
          </p>
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-surface px-3 py-2 text-[11px] text-ink-muted">
        <Info size={14} className="mt-0.5 shrink-0 text-ink-soft" />
        <span>
          Este é um canal de <b>envio</b>, não um arquivo. Os documentos ficam disponíveis por <b>12 meses</b> e
          depois são apagados — avisamos por e-mail antes. Notas fiscais em <b>XML</b> não expiram. Guarde sempre a
          sua cópia original.
        </span>
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line py-6 text-sm font-medium text-ink-muted transition hover:border-brand hover:text-brand"
      >
        <Upload size={18} /> Escolher arquivos
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACEITA}
        className="hidden"
        onChange={(e) => {
          adicionar(e.target.files);
          e.target.value = "";
        }}
      />

      {itens.length > 0 && (
        <ul className="mt-3 space-y-2">
          {itens.map((it) => (
            <li key={it.id} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
              <FileText size={15} className="shrink-0 text-ink-soft" />
              <span className="min-w-0 flex-1 truncate text-ink">{it.file.name}</span>
              {/* mostrar a redução é o que impede o "sumiu qualidade da minha
                  foto?": o número diz que foi de propósito e quanto foi */}
              <span className="shrink-0 text-[11px] text-ink-soft">
                {it.encolheu ? (
                  <>
                    <span className="line-through">{tamanhoHumano(it.encolheu.de)}</span>{" "}
                    <span className="font-semibold text-brand-dark">{tamanhoHumano(it.encolheu.para)}</span>
                  </>
                ) : (
                  tamanhoHumano(it.file.size)
                )}
              </span>
              {it.status === "ok" ? (
                <Check size={15} className="shrink-0 text-brand" />
              ) : it.status === "enviando" ? (
                <Loader2 size={15} className="shrink-0 animate-spin text-ink-soft" />
              ) : it.status === "erro" ? (
                <span className="flex shrink-0 items-center gap-1 text-[11px] text-danger">
                  <AlertTriangle size={13} /> {it.erro}
                </span>
              ) : (
                <button aria-label="Remover este arquivo da lista" type="button" onClick={() => remover(it.id)} className="shrink-0 text-ink-soft hover:text-danger">
                  <X size={15} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {itens.some((i) => i.status === "pendente") && (
        <div className="mt-3">
          <label className="mb-1 block text-[11px] font-semibold text-ink-soft">O que é este documento?</label>
          <select
            value={natureza}
            onChange={(e) => setNatureza(e.target.value)}
            className={classeControle("md")}
          >
            <option value="">Não sei dizer</option>
            <option value="a_pagar">Conta a pagar (boleto/fatura a vencer)</option>
            <option value="paga">Comprovante de algo que paguei</option>
            <option value="a_receber">Cobrança que emiti (a receber)</option>
            <option value="recebida">Comprovante de algo que recebi</option>
            <option value="extrato">Extrato bancário</option>
            <option value="outro">Outro</option>
          </select>
          <p className="mt-1 text-[10px] text-ink-soft">Ajuda a sua contabilidade a tratar mais rápido. Vale para os arquivos deste envio.</p>
        </div>
      )}

      {itens.some((i) => i.status === "pendente") && (
        <div className="mt-3">
          <label className="mb-1 block text-[11px] font-semibold text-ink-soft">Observação (opcional)</label>
          <input
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="Ex.: nota de junho, boleto do fornecedor X…"
            className={classeControle("md")}
          />
        </div>
      )}

      {pendentes > 0 && (
        <Botao variante="primario" className="mt-3 shadow-card"
          onClick={enviar}
          disabled={enviando}
        >
          {enviando ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
          {enviando ? "Enviando…" : `Enviar ${pendentes} arquivo${pendentes > 1 ? "s" : ""}`}
        </Botao>
      )}

      {enviados > 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-brand-dark">
          <Check size={14} /> {enviados} documento{enviados > 1 ? "s" : ""} enviado{enviados > 1 ? "s" : ""} para a sua contabilidade.
        </p>
      )}
        </>
      )}
    </div>
  );
}

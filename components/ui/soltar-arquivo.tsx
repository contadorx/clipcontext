"use client";

import { useRef, useState } from "react";
import { Paperclip, UploadCloud } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { comprimirImagem } from "@/lib/comprimir-imagem";
import { lerDadosDocumento } from "@/lib/documento-impressao";
import MessageStrip from "@/components/ui/message-strip";

/**
 * Área de arrastar-e-soltar que envia direto para o Storage.
 *
 * O arquivo **não** passa pelo servidor do app: o servidor só assina uma URL de
 * upload (que é onde a permissão é conferida) e o navegador manda os bytes para
 * o Storage. Um PDF de 15 MB atravessando a função serverless custaria memória e
 * tempo limite, e não haveria ganho nenhum — o servidor não olha o conteúdo.
 *
 * Os dois passos existem por isso: `assinar` autoriza, `registrar` grava a linha
 * só depois que os bytes chegaram. Se o upload falhar no meio, não fica um
 * documento fantasma apontando para um arquivo que não existe.
 */
const BUCKET = "documentos-entrada";

export type DocEnviado = { id: string; arquivo_nome: string; enviado_em: string; tipo: string | null };

export default function SoltarArquivo({
  empresaId,
  lancamentoId,
  onEnviado,
  ajuda,
}: {
  empresaId: string;
  /** quando presente, o documento já nasce ligado a este lançamento */
  lancamentoId?: string;
  onEnviado: (doc: DocEnviado) => void;
  ajuda?: React.ReactNode;
}) {
  const [sobre, setSobre] = useState(false);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function enviarUm(bruto: File) {
    setErro(null);
    setEnviando(bruto.name);
    try {
      // encolhe foto antes de assinar: o que é assinado e registrado tem de ser
      // o arquivo que realmente vai subir, senão o `tamanho` gravado mente
      const { arquivo: file } = await comprimirImagem(bruto);
      // hash e dados da nota são lidos DEPOIS de comprimir: a impressão digital
      // tem de ser a do arquivo que realmente vai subir
      const dados = await lerDadosDocumento(file);

      const r1 = await fetch("/api/documentos/enviar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ acao: "assinar", empresaId, nome: file.name, tamanho: file.size }),
      });
      const d1 = await r1.json();
      if (!r1.ok) throw new Error(d1.error ?? "Não foi possível preparar o upload.");

      const up = await createClient().storage.from(BUCKET).uploadToSignedUrl(d1.path, d1.token, file);
      if (up.error) throw new Error("O arquivo não chegou ao servidor de armazenamento.");

      const r2 = await fetch("/api/documentos/enviar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          acao: "registrar",
          empresaId,
          lancamentoId,
          path: d1.path,
          nome: file.name,
          tamanho: file.size,
          dados,
        }),
      });
      const d2 = await r2.json();
      if (!r2.ok) throw new Error(d2.error ?? "Falha ao registrar o documento.");
      onEnviado(d2.documento as DocEnviado);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha no envio.");
    } finally {
      setEnviando(null);
    }
  }

  async function enviarVarios(files: FileList | null) {
    if (!files?.length) return;
    // um de cada vez: em paralelo, um erro no meio deixaria metade enviada sem
    // dizer qual metade
    for (const f of Array.from(files)) await enviarUm(f);
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setSobre(true);
        }}
        onDragLeave={() => setSobre(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSobre(false);
          enviarVarios(e.dataTransfer.files);
        }}
        className={`rounded-lg border border-dashed p-4 text-center transition ${
          sobre ? "border-brand bg-brand-light" : "border-line bg-surface/60"
        }`}
      >
        <UploadCloud size={20} className={`mx-auto ${sobre ? "text-brand-dark" : "text-ink-soft"}`} />
        <p className="mt-1.5 text-[12.5px] text-ink-muted">
          {enviando ? (
            <span className="inline-flex items-center gap-1.5">
              <Paperclip size={12} /> enviando {enviando}…
            </span>
          ) : (
            <>
              Arraste a nota ou o boleto aqui ·{" "}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="font-semibold text-brand-dark hover:underline"
              >
                selecione um arquivo
              </button>
            </>
          )}
        </p>
        {ajuda && <p className="mt-1 text-[10.5px] leading-snug text-ink-soft">{ajuda}</p>}
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.xml,.ofx,.csv,.doc,.docx"
          onChange={(e) => {
            enviarVarios(e.target.files);
            // permite reenviar o mesmo arquivo depois de um erro
            e.target.value = "";
          }}
        />
      </div>
      {erro && (
        <MessageStrip tipo="erro" className="mt-2">
          {erro}
        </MessageStrip>
      )}
    </div>
  );
}

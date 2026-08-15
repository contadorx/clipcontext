"use client";

import { useState } from "react";
import { FileUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { parseRetornoCobranca, casaNossoNumero, MOVIMENTOS_COBRANCA } from "@/lib/cnab/cobranca-retorno";
import { Msg } from "@/components/ui/message-strip";

// Processa o retorno (.RET) de COBRANÇA: registra, liquida (com baixa automática
// no contas a receber) e marca rejeições. Usado em Liquidações e em Boletos.
export default function ProcessarRetornoCobranca({
  empresaId,
  onProcessado,
}: {
  empresaId: string;
  onProcessado?: () => void;
}) {
  const [processando, setProcessando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  async function processar(file: File) {
    setProcessando(true);
    setMsg(null);
    const texto = await file.text();
    const { itens: eventos, ehRetornoCobranca } = parseRetornoCobranca(texto);
    if (!ehRetornoCobranca || eventos.length === 0) {
      setProcessando(false);
      setMsg({ tipo: "erro", texto: "Este arquivo não parece um retorno de cobrança (lote serviço 01) ou está vazio." });
      return;
    }
    const supabase = createClient();
    const { data: abertos } = await supabase
      .from("cobranca_titulos")
      .select("id, nosso_numero, numero_documento, lancamento_id, status")
      .eq("empresa_id", empresaId)
      // `liquidado` entra porque o reprocessamento precisa reencontrar o título
      // cuja baixa no lançamento falhou — sem ele, a saída prometida na mensagem
      // não existia e a parcela ficava cobrável para sempre
      .in("status", ["gerado", "em_remessa", "registrado", "erro", "liquidado"]);
    const lista = (abertos ?? []) as { id: string; nosso_numero: number; numero_documento: string | null; lancamento_id: string | null; status: string }[];
    let registrados = 0;
    let liquidados = 0;
    let baixados = 0;
    let rejeitados = 0;
    let semPar = 0;
    /*
      Contadores que só sobem quando a gravação aconteceu.

      Todos os quatro `update` deste laço tinham o erro descartado, e os
      contadores incrementavam de qualquer jeito: a mensagem final anunciava um
      resultado que podia não ter acontecido em lugar nenhum.
    */
    let falhas = 0;
    const conferir = (erro: { message: string } | null) => {
      if (erro) falhas++;
      return !erro;
    };
    for (const ev of eventos) {
      const titulo = lista.find(
        (t) =>
          (ev.seuNumero && t.numero_documento && ev.seuNumero === t.numero_documento) ||
          casaNossoNumero(ev.nossoNumeroDigitos, t.nosso_numero),
      );
      if (!titulo) {
        semPar++;
        continue;
      }
      if (ev.movimento === "02") {
        const r = await supabase.from("cobranca_titulos").update({ status: "registrado", motivo_erro: null }).eq("id", titulo.id);
        if (conferir(r.error)) registrados++;
      } else if (ev.movimento === "06" || ev.movimento === "17") {
        const r = await supabase
          .from("cobranca_titulos")
          .update({ status: "liquidado", valor_pago: ev.valorPago || null, liquidado_em: ev.dataOcorrencia })
          .eq("id", titulo.id);
        if (!conferir(r.error)) continue;
        if (titulo.lancamento_id && ev.dataOcorrencia) {
          // baixa automática no contas a receber
          const b = await supabase.from("lancamentos").update({ data_pagamento: ev.dataOcorrencia }).eq("id", titulo.lancamento_id);
          /*
            Este é o pior dos quatro. O título liquidado sem a baixa deixa a
            Central dizendo "pago" e o contas a receber continuando a cobrar —
            a parcela entra em relatório de inadimplência e o cliente que já
            pagou recebe cobrança. E a mensagem final afirmava, literalmente,
            "N liquidado(s) com baixa no financeiro" mesmo quando nenhuma baixa
            tinha sido gravada.
          */
          if (!conferir(b.error)) continue;
        }
        liquidados++;
      } else if (ev.movimento === "09") {
        const r = await supabase.from("cobranca_titulos").update({ status: "baixado" }).eq("id", titulo.id);
        if (conferir(r.error)) baixados++;
      } else if (["03", "26", "30"].includes(ev.movimento)) {
        const motivo = `${MOVIMENTOS_COBRANCA[ev.movimento] ?? "Rejeitado"}${ev.motivos.length ? ` (motivos ${ev.motivos.join(", ")})` : ""}`;
        const r = await supabase.from("cobranca_titulos").update({ status: "erro", motivo_erro: motivo }).eq("id", titulo.id);
        // rejeição não registrada é pior que parece: o título parece bom, entra
        // na próxima remessa e é rejeitado de novo, indefinidamente
        if (conferir(r.error)) rejeitados++;
      }
    }
    setProcessando(false);
    setMsg({
      tipo: rejeitados > 0 || falhas > 0 ? "erro" : "ok",
      texto:
        `Retorno processado: ${registrados} registrado(s), ${liquidados} liquidado(s) com baixa no financeiro, ` +
        `${baixados} baixado(s), ${rejeitados} rejeitado(s)` +
        (semPar > 0 ? `, ${semPar} sem correspondência` : "") +
        (falhas > 0
          ? `. ATENÇÃO: ${falhas} atualização(ões) falharam — parte pode ter sido aplicada. Processe o mesmo arquivo de novo: o que já foi gravado é reescrito com o mesmo valor e o que faltou é concluído.`
          : "."),
    });
    onProcessado?.();
  }

  return (
    <div>
      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand">
        <FileUp size={13} /> {processando ? "Processando…" : "Processar retorno de cobrança (.RET)"}
        <input
          type="file"
          accept=".ret,.RET,.txt"
          className="hidden"
          disabled={processando}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) processar(f);
            e.target.value = "";
          }}
        />
      </label>
      {msg && <Msg msg={msg} />}
    </div>
  );
}

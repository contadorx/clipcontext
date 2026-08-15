"use client";

import { useEffect, useMemo, useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { gerarRemessaCobranca } from "@/lib/cnab/cobranca240";
import { reservarSequencialCobranca } from "@/lib/cnab/sequencial-cobranca";
import { Msg } from "@/components/ui/message-strip";
import { brl } from "@/lib/formato";
import Botao from "@/components/ui/botao";
import { classeControle } from "@/components/ui/campo";

type Conta = {
  id: string;
  nome: string;
  banco_codigo: string | null;
  agencia: string | null;
  agencia_dv: string | null;
  conta_numero: string | null;
  conta_dv: string | null;
  convenio: string | null;
  carteira: string | null;
  juros_mes_pct: number | null;
  multa_pct: number | null;
};
type Titulo = {
  id: string;
  conta_id: string | null;
  nosso_numero: number;
  numero_documento: string | null;
  valor: number;
  vencimento: string;
  sacado_nome: string | null;
  sacado_documento: string | null;
  sacado_logradouro: string | null;
  sacado_cep: string | null;
  sacado_municipio: string | null;
  sacado_uf: string | null;
};

export default function GerarRemessaCobranca({ empresaId }: { empresaId: string }) {
  const [contas, setContas] = useState<Conta[]>([]);
  const [titulos, setTitulos] = useState<Titulo[]>([]);
  const [contaId, setContaId] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  async function carregar() {
    const supabase = createClient();
    const [{ data: cs }, { data: ts }] = await Promise.all([
      supabase
        .from("contas_bancarias")
        .select("id, nome, banco_codigo, agencia, agencia_dv, conta_numero, conta_dv, convenio, carteira, juros_mes_pct, multa_pct")
        .eq("empresa_id", empresaId)
        .order("nome"),
      supabase
        .from("cobranca_titulos")
        .select("id, conta_id, nosso_numero, numero_documento, valor, vencimento, sacado_nome, sacado_documento, sacado_logradouro, sacado_cep, sacado_municipio, sacado_uf")
        .eq("empresa_id", empresaId)
        .eq("status", "gerado"),
    ]);
    const contasL = (cs ?? []) as Conta[];
    setContas(contasL);
    setTitulos((ts ?? []) as Titulo[]);
    setContaId((prev) => prev || contasL[0]?.id || "");
    setCarregando(false);
  }
  useEffect(() => {
    if (empresaId) carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  const conta = useMemo(() => contas.find((c) => c.id === contaId) ?? null, [contas, contaId]);
  const lote = useMemo(() => titulos.filter((t) => t.conta_id === contaId), [titulos, contaId]);
  const totalLote = lote.reduce((s, t) => s + Number(t.valor), 0);

  async function gerar() {
    if (!conta) {
      setMsg({ tipo: "erro", texto: "Escolha a conta de cobrança." });
      return;
    }
    if (!conta.banco_codigo || !conta.carteira) {
      setMsg({ tipo: "erro", texto: "A conta precisa de banco e carteira de cobrança (Configurações → Contas)." });
      return;
    }
    if (lote.length === 0) {
      setMsg({ tipo: "erro", texto: "Nenhum boleto gerado aguardando remessa nesta conta." });
      return;
    }
    setGerando(true);
    setMsg(null);
    const supabase = createClient();
    const { data: emp } = await supabase.from("empresas").select("nome, razao_social, cnpj_cpf").eq("id", empresaId).maybeSingle();

    let arquivo;
    let avisoSeq: string | null = null;
    try {
      const reserva = await reservarSequencialCobranca(supabase, conta.id);
      const seq = reserva.seq;
      avisoSeq = reserva.aviso;
      arquivo = gerarRemessaCobranca({
        conta: {
          banco_codigo: conta.banco_codigo ?? "",
          agencia: conta.agencia ?? "",
          agencia_dv: conta.agencia_dv,
          conta_numero: conta.conta_numero ?? "",
          conta_dv: conta.conta_dv,
          convenio: conta.convenio,
          carteira: conta.carteira,
          juros_mes_pct: conta.juros_mes_pct,
          multa_pct: conta.multa_pct,
        },
        cedenteNome: emp?.razao_social || emp?.nome || "",
        cedenteDocumento: (emp?.cnpj_cpf ?? "").replace(/\D/g, ""),
        titulos: lote.map((t) => ({
          id: t.id,
          nosso_numero: t.nosso_numero,
          numero_documento: t.numero_documento,
          valor: t.valor,
          vencimento: t.vencimento,
          sacado_nome: t.sacado_nome,
          sacado_documento: t.sacado_documento,
          sacado_logradouro: t.sacado_logradouro,
          sacado_cep: t.sacado_cep,
          sacado_municipio: t.sacado_municipio,
          sacado_uf: t.sacado_uf,
        })),
        sequencialArquivo: seq,
      });

      /*
        Sem registro, o arquivo não é baixado — o download vem depois do `try`.

        O erro era descartado na desestruturação: o lote seguia para o banco com
        `remessa_id` nulo e sem histórico, e o retorno depois não casava com
        nada. E o `update` para `em_remessa`, também sem verificação, deixava o
        título em `gerado` — ele entraria numa segunda remessa e o cliente
        receberia o mesmo boleto duas vezes.
      */
      const rem = await supabase
        .from("cnab_remessas")
        .insert({
          empresa_id: empresaId,
          conta_id: conta.id,
          banco_codigo: conta.banco_codigo,
          tipo: "cobranca",
          sequencial: seq,
          quantidade: arquivo.quantidadeTitulos,
          valor_total: arquivo.valorTotal,
          arquivo_nome: arquivo.nomeArquivo,
          conteudo: arquivo.conteudo,
          itens: lote.map((t) => ({ titulo_id: t.id, nosso_numero: t.nosso_numero, valor: t.valor })),
        })
        .select("id")
        .single();
      if (rem.error || !rem.data) {
        setGerando(false);
        setMsg({ tipo: "erro", texto: `Não foi possível registrar a remessa — nada foi baixado. ${rem.error?.message ?? ""}` });
        return;
      }
      const remessaId = (rem.data as { id: string }).id;
      const marc = await supabase
        .from("cobranca_titulos")
        .update({ status: "em_remessa", remessa_id: remessaId })
        .in("id", lote.map((t) => t.id));
      if (marc.error) {
        setGerando(false);
        setMsg({
          tipo: "erro",
          texto: `A remessa foi registrada mas os títulos não mudaram de status — NÃO envie o arquivo, recarregue e tente de novo. ${marc.error.message}`,
        });
        return;
      }
    } catch (e) {
      setGerando(false);
      setMsg({ tipo: "erro", texto: e instanceof Error ? e.message : "Falha ao montar a remessa." });
      return;
    }

    // download
    const blob = new Blob([arquivo.conteudo], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = arquivo.nomeArquivo;
    a.click();
    URL.revokeObjectURL(a.href);

    // remove os enviados da lista local
    setTitulos((l) => l.filter((t) => !lote.some((x) => x.id === t.id)));
    setGerando(false);
    setMsg({
      // o arquivo desta vez está certo; o aviso é sobre a numeração da próxima
      tipo: avisoSeq ? "erro" : "ok",
      texto:
        `Remessa gerada com ${lote.length} boleto(s), ${brl(totalLote)}. Suba o arquivo no internet banking. Os títulos foram para "em remessa".` +
        (avisoSeq ? " " + avisoSeq : ""),
    });
  }

  if (carregando) return <p className="text-xs text-ink-soft">Carregando…</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px]">
          <label className="mb-1 block text-[11px] font-semibold text-ink-soft">Conta de cobrança</label>
          <select value={contaId} onChange={(e) => setContaId(e.target.value)} className={classeControle("md")}>
            {contas.length === 0 && <option value="">— nenhuma conta —</option>}
            {contas.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>
        <Botao variante="primario"
          onClick={gerar}
          disabled={gerando || lote.length === 0}
        >
          {gerando ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
          {gerando ? "Gerando…" : `Gerar remessa (${lote.length})`}
        </Botao>
        {lote.length > 0 && <span className="text-xs text-ink-soft">{lote.length} boleto(s) · {brl(totalLote)}</span>}
      </div>
      {msg && <Msg msg={msg} />}
    </div>
  );
}

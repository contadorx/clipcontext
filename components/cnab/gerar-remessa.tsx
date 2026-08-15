"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileText, Landmark, QrCode, ArrowRightLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Msg } from "@/components/ui/message-strip";
import { brl } from "@/lib/formato";
import EmptyState from "@/components/ui/empty-state";
import Botao from "@/components/ui/botao";
import { classeControle } from "@/components/ui/campo";
import {
  gerarRemessaItauBoletos,
  gerarRemessaItauPix,
  gerarRemessaItauTransferencias,
  type BoletoCnab,
  type PixCnab,
  type TransferenciaCnab,
} from "@/lib/cnab/itau-pagamento";

export type ContaPagadora = {
  id: string;
  nome: string;
  banco_codigo: string | null;
  agencia: string | null;
  conta_numero: string | null;
  conta_dv: string | null;
  pagador_documento: string | null;
  pagador_nome: string | null;
  cnab_sequencial: number | null;
  convenio: string | null;
  agencia_dv: string | null;
};

export type ItemAgendado = {
  id: string;
  descricao: string;
  valor: number;
  data_agendamento: string;
  favorecido_nome: string;
  favorecido_doc: string;
  linha_digitavel?: string; // boleto
  chave_pix?: string; // pix
  fav_banco_codigo?: string | null; // ted
  fav_agencia?: string | null;
  fav_conta?: string | null;
  fav_conta_dv?: string | null;
  fav_conta_tipo?: string | null;
};

const soDig = (s: string) => (s || "").replace(/\D/g, "");

export default function GerarRemessa({
  empresaId,
  contas,
  itens,
  modo,
}: {
  empresaId: string;
  contas: ContaPagadora[];
  itens: ItemAgendado[];
  modo: "boleto" | "pix" | "ted";
}) {
  const router = useRouter();
  const [contaId, setContaId] = useState(contas[0]?.id ?? "");
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [gerando, setGerando] = useState(false);

  const conta = contas.find((c) => c.id === contaId) ?? null;
  const isPix = modo === "pix";
  const isTed = modo === "ted";

  const lista = useMemo(
    () =>
      itens.map((b) => {
        const docOk = soDig(b.favorecido_doc).length === 11 || soDig(b.favorecido_doc).length === 14;
        let pronto: boolean;
        let motivo: string | null = null;
        if (isTed) {
          const bancoOk = soDig(b.fav_banco_codigo || "").length === 3;
          const contaOk = Boolean(soDig(b.fav_agencia || "")) && Boolean(soDig(b.fav_conta || ""));
          pronto = bancoOk && contaOk && docOk;
          motivo = !bancoOk
            ? "Falta o banco do favorecido (Clientes e Fornecedores → Dados para pagamento)."
            : !contaOk
              ? "Falta agência/conta do favorecido."
              : !docOk
                ? "Falta o CNPJ/CPF do favorecido."
                : null;
        } else if (isPix) {
          const chaveOk = Boolean((b.chave_pix || "").trim());
          // se a chave for o próprio CPF/CNPJ, o documento é suprido por ela
          const chaveEhDoc = soDig(b.chave_pix || "").length === 11 || soDig(b.chave_pix || "").length === 14;
          pronto = chaveOk && (docOk || chaveEhDoc);
          motivo = !chaveOk
            ? "Falta a chave Pix."
            : !(docOk || chaveEhDoc)
              ? "Falta o CNPJ/CPF do favorecido (Clientes e Fornecedores)."
              : null;
        } else {
          const linhaOk = soDig(b.linha_digitavel || "").length === 47;
          pronto = linhaOk && docOk;
          motivo = !linhaOk
            ? "Linha digitável precisa ter 47 dígitos (boleto bancário)."
            : !docOk
              ? "Falta o CNPJ/CPF do favorecido (Clientes e Fornecedores)."
              : null;
        }
        return { ...b, pronto, motivo };
      }),
    [itens, isPix, isTed],
  );

  const prontos = lista.filter((i) => i.pronto);
  const selecionados = prontos.filter((i) => sel[i.id]);
  const totalSel = selecionados.reduce((s, i) => s + i.valor, 0);
  const contaConfigurada = Boolean(conta?.pagador_documento && conta?.agencia && conta?.conta_numero);

  function toggleTodos() {
    if (selecionados.length === prontos.length) {
      setSel({});
    } else {
      const novo: Record<string, boolean> = {};
      prontos.forEach((i) => (novo[i.id] = true));
      setSel(novo);
    }
  }

  async function gerar() {
    if (!conta || !contaConfigurada) {
      setMsg({ tipo: "erro", texto: "Configure os dados bancários da conta pagadora acima (CNPJ, agência e conta)." });
      return;
    }
    if (selecionados.length === 0) {
      setMsg({ tipo: "erro", texto: isTed ? "Selecione ao menos uma transferência." : isPix ? "Selecione ao menos um Pix." : "Selecione ao menos um boleto." });
      return;
    }
    setGerando(true);
    setMsg(null);
    try {
      const pagador = {
        documento: conta.pagador_documento || "",
        nome: conta.pagador_nome || conta.nome,
        agencia: conta.agencia || "",
        contaNumero: conta.conta_numero || "",
        contaDv: conta.conta_dv,
      };
      const seq = (conta.cnab_sequencial ?? 0) + 1;

      const res = isTed
        ? gerarRemessaItauTransferencias({
            pagador,
            transferencias: selecionados.map<TransferenciaCnab>((i) => ({
              bancoFavorecido: i.fav_banco_codigo || "",
              agenciaFavorecido: i.fav_agencia || "",
              contaFavorecido: i.fav_conta || "",
              contaDvFavorecido: i.fav_conta_dv,
              contaTipo: i.fav_conta_tipo,
              nomeFavorecido: i.favorecido_nome,
              docFavorecido: i.favorecido_doc,
              valor: i.valor,
              dataPagamento: i.data_agendamento,
              seuNumero: i.id.slice(0, 20),
            })),
          })
        : isPix
          ? gerarRemessaItauPix({
              pagador,
              pix: selecionados.map<PixCnab>((i) => ({
                chavePix: i.chave_pix || "",
                nomeFavorecido: i.favorecido_nome,
                docFavorecido: i.favorecido_doc,
                valor: i.valor,
                dataPagamento: i.data_agendamento,
                seuNumero: i.id.slice(0, 20),
              })),
            })
          : gerarRemessaItauBoletos({
              pagador,
              boletos: selecionados.map<BoletoCnab>((i) => ({
                linhaDigitavel: i.linha_digitavel || "",
                nomeFavorecido: i.favorecido_nome,
                docFavorecido: i.favorecido_doc,
                valor: i.valor,
                dataPagamento: i.data_agendamento,
                seuNumero: i.id.slice(0, 20),
              })),
            });

      /*
        Grava primeiro, baixa depois.

        O arquivo era baixado **antes** de qualquer registro, e o erro do
        `insert` era descartado na própria desestruturação (`const { data: rem }`
        — o `error` nem era lido). Quando o insert falhava, o `.REM` já estava na
        pasta de downloads e ia para o Bankline: o banco pagava e o sistema não
        tinha registro nenhum da remessa nem dos `seu_numero`, então o retorno
        não casava com nada. E os `update` dos lançamentos, também sem
        verificação, deixavam o item na lista "a fazer" — ele entrava na próxima
        remessa e **o fornecedor recebia duas vezes**.

        Invertendo a ordem, o pior caso passa a ser um sequencial queimado e uma
        remessa registrada que ninguém enviou. Buraco de sequencial o banco
        aceita; pagamento em dobro, não.
      */
      const supabase = createClient();
      const itensRemessa = selecionados.map((i) => ({
        lancamento_id: i.id,
        seu_numero: i.id.slice(0, 20).toUpperCase(),
        valor: i.valor,
      }));
      const rem = await supabase
        .from("cnab_remessas")
        .insert({
          empresa_id: empresaId,
          conta_id: conta.id,
          banco_codigo: "341",
          tipo: "pagamento",
          sequencial: seq,
          quantidade: res.quantidade,
          valor_total: res.valorTotal,
          itens: itensRemessa,
        })
        .select("id")
        .single();
      if (rem.error || !rem.data) {
        setGerando(false);
        setMsg({
          tipo: "erro",
          texto: `Não foi possível registrar a remessa — nada foi baixado, nenhum pagamento foi agendado. ${rem.error?.message ?? ""}`,
        });
        return;
      }
      const remessaId = (rem.data as { id: string }).id;

      // marca os lançamentos como Agendados e vincula à remessa (saem da lista "a fazer")
      const marcados = await Promise.all(
        selecionados.map((i) =>
          supabase
            .from("lancamentos")
            .update({ data_agendamento: i.data_agendamento, remessa_id: remessaId })
            .eq("id", i.id),
        ),
      );
      const naoMarcados = marcados.filter((r) => r.error).length;
      if (naoMarcados > 0) {
        /*
          Item que não saiu da lista "a fazer" volta na próxima remessa. Como o
          arquivo ainda não foi baixado, dá para parar aqui: a remessa fica
          registrada mas não enviada, e refazer é seguro — o `seu_numero` é o id
          do lançamento, então a remessa nova cobre os mesmos itens.
        */
        setGerando(false);
        setMsg({
          tipo: "erro",
          texto: `${naoMarcados} de ${selecionados.length} pagamento(s) não foram marcados como agendados — o arquivo NÃO foi baixado, para não pagar em duplicidade. Recarregue e gere de novo.`,
        });
        return;
      }
      const seqOk = await supabase.from("contas_bancarias").update({ cnab_sequencial: seq }).eq("id", conta.id);
      // sequencial não avançado é rejeição do banco no arquivo seguinte, não
      // pagamento errado: avisa e segue, porque os pagamentos já estão marcados
      const avisoSeq = seqOk.error
        ? " ATENÇÃO: o sequencial da conta não foi atualizado — confira em Configurações → CNAB antes da próxima remessa."
        : "";

      // baixa o arquivo .REM — agora que tudo está registrado
      const hoje = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const tag = isTed ? "TED" : isPix ? "PIX" : "BOLETOS";
      const blob = new Blob([res.conteudo], { type: "text/plain;charset=us-ascii" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ITAU_${tag}_${String(seq).padStart(5, "0")}_${hoje}.REM`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setMsg({
        tipo: "ok",
        texto: `Remessa gerada com ${res.quantidade} pagamento(s), total ${brl(res.valorTotal)}. Os itens viraram Agendados. Suba o arquivo no Itaú Bankline (use o Validador de Layout antes).${avisoSeq}`,
      });
      setSel({});
      router.refresh();
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("fs-mov-changed"));
    } catch (e) {
      setMsg({ tipo: "erro", texto: e instanceof Error ? e.message : "Falha ao gerar a remessa." });
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="rounded-xl2 bg-white p-4 shadow-card">
      <div className="flex items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-light text-brand">
          {isTed ? <ArrowRightLeft size={20} /> : isPix ? <QrCode size={20} /> : <FileText size={20} />}
        </div>
        <div>
          <h2 className="text-[13px] font-bold text-ink">
            {isTed
              ? "Gerar remessa de TED / crédito em conta — Itaú"
              : isPix
                ? "Gerar remessa de Pix — Itaú"
                : "Gerar remessa de pagamento (boletos) — Itaú"}
          </h2>
          <p className="text-xs text-ink-muted">
            {isTed
              ? "Crédito em conta no Itaú e TED para outros bancos, a partir dos pagamentos a fazer com dados bancários do favorecido."
              : isPix
                ? "Arquivo CNAB 240 só de Pix (regra do banco), a partir dos Pix a pagar por chave."
                : "Monta o arquivo CNAB 240 com os boletos a pagar para você subir no Bankline e o Itaú pagar."}
          </p>
        </div>
      </div>

      {msg && <Msg msg={msg} />}

      {/* conta pagadora */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Landmark size={15} className="text-ink-soft" />
        <span className="text-xs font-semibold text-ink-soft">Conta que paga:</span>
        <select
          value={contaId}
          onChange={(e) => setContaId(e.target.value)}
          className={classeControle("md")}
        >
          {contas.length === 0 && <option value="">Nenhuma conta Itaú</option>}
          {contas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </div>

      {contas.length === 0 ? (
        <EmptyState compacto titulo="Nenhuma conta com banco Itaú (341) configurada" descricao="Defina o banco da conta nos dados bancários acima." />
      ) : !contaConfigurada ? (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-3 text-xs text-amber-800">
          Complete os dados da conta pagadora acima (CNPJ do pagador, agência e conta) para liberar a geração.
        </p>
      ) : itens.length === 0 ? (
        <p className="mt-4 rounded-lg bg-surface/60 px-3 py-3 text-xs text-ink-muted">
          {isTed
            ? "Não há transferências a pagar pendentes. Lance saídas com forma “TED/Transferência” e cadastre os dados bancários do favorecido."
            : isPix
              ? "Não há Pix a pagar pendentes. Lance saídas com forma “Pix” e a chave."
              : "Não há boletos a pagar pendentes. Lance saídas com forma “Boleto” e linha digitável."}
        </p>
      ) : (
        <>
          <div className="mt-4 overflow-hidden rounded-lg border border-line">
            <div className="flex items-center justify-between bg-surface/60 px-3 py-2">
              <button type="button" onClick={toggleTodos} className="text-xs font-semibold text-brand hover:underline">
                {selecionados.length === prontos.length && prontos.length > 0 ? "Limpar seleção" : "Selecionar todos"}
              </button>
              <span className="text-[11px] text-ink-soft">
                {selecionados.length} selecionado(s) · {brl(totalSel)}
              </span>
            </div>
            <ul className="divide-y divide-line/60">
              {lista.map((i) => (
                <li key={i.id} className="flex items-center gap-3 px-3 py-2.5">
                  <input
                    type="checkbox"
                    disabled={!i.pronto}
                    checked={Boolean(sel[i.id])}
                    onChange={(e) => setSel((s) => ({ ...s, [i.id]: e.target.checked }))}
                    className="h-4 w-4 shrink-0 accent-brand disabled:opacity-40"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{i.favorecido_nome || i.descricao}</p>
                    <p className="text-[11px] text-ink-soft">
                      vence {i.data_agendamento.split("-").reverse().join("/")}
                      {i.motivo && <span className="ml-1 text-danger">· {i.motivo}</span>}
                    </p>
                  </div>
                  <span className="num shrink-0 text-sm font-semibold text-ink">{brl(i.valor)}</span>
                </li>
              ))}
            </ul>
          </div>

          <Botao variante="primario" className="mt-4"
            onClick={gerar}
            disabled={gerando || selecionados.length === 0}
          >
            <Download size={15} /> {gerando ? "Gerando…" : `Gerar remessa (${selecionados.length})`}
          </Botao>
        </>
      )}
    </div>
  );
}

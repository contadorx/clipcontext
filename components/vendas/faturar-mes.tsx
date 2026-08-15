"use client";

// Faturar o mês: roda a competência inteira em um clique —
// (A) fatura os contratos elegíveis, (B) emite as NFS-e pendentes,
// (C) gera os boletos — com relatório linha a linha do que passou e do que falhou.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, X, CheckCircle2, XCircle, MinusCircle, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { montarTitulo, BANCOS_COBRANCA } from "@/lib/boleto/bancos";
import { montarCodigoBarras, linhaDigitavel } from "@/lib/boleto/febraban";
import type { ContaCobranca } from "@/components/vendas/boletos";
import type { NfseConfigInfo } from "@/components/vendas/notas-fiscais";
import MessageStrip from "@/components/ui/message-strip";
import { brl } from "@/lib/formato";
import Botao from "@/components/ui/botao";
import { classeControle } from "@/components/ui/campo";
import Tabela, { LinhaTabela } from "@/components/ui/tabela";
import type { ColunaDef } from "@/components/ui/config-colunas";

type ContratoRef = {
  id: string;
  nome: string | null;
  cliente_fornecedor_id: string;
  ciclo: string;
  dia_faturamento: number;
  data_inicio: string;
  data_fim: string | null;
  status: string;
  categoria_id: string | null;
  conta_id: string | null;
  gera_nfse: boolean;
  gera_boleto: boolean;
};
type ItemRef = { contrato_id: string; servico_id: string; quantidade: number; valor_unitario: number };
type ClienteRef = { id: string; nome: string; cpf_cnpj: string | null; cep: string | null; logradouro: string | null; municipio: string | null; uf: string | null; codigo_ibge: string | null };
type ServicoRef = { id: string; nome: string; item_lc116: string | null };

type EtapaStatus = { s: "pendente" | "rodando" | "ok" | "erro" | "pulado" | "na"; msg?: string };
type Linha = {
  contrato: ContratoRef;
  valor: number;
  jaFaturado: boolean;
  fatId: string | null;
  lancamentoId: string | null;
  vencimento: string;
  nfseStatus: string | null;
  boletoStatus: string | null;
  faturar: EtapaStatus;
  nfse: EtapaStatus;
  boleto: EtapaStatus;
};

// — mesma régua de competência do gerador de contratos (validada) —
const PASSO: Record<string, number> = { mensal: 1, trimestral: 3, semestral: 6, anual: 12 };
function diffMeses(aISO: string, bISO: string): number {
  return (Number(bISO.slice(0, 4)) - Number(aISO.slice(0, 4))) * 12 + (Number(bISO.slice(5, 7)) - Number(aISO.slice(5, 7)));
}
function compete(c: ContratoRef, compISO: string): boolean {
  if (c.status !== "ativo") return false;
  const comp = compISO + "-01";
  const ano = Number(compISO.slice(0, 4));
  const mes = Number(compISO.slice(5, 7));
  const ultimo = new Date(ano, mes, 0).getDate();
  const fimMesISO = `${ano}-${String(mes).padStart(2, "0")}-${String(ultimo).padStart(2, "0")}`;
  if (c.data_inicio > fimMesISO) return false;
  if (c.data_fim && c.data_fim < comp) return false;
  const d = diffMeses(c.data_inicio.slice(0, 7) + "-01", compISO);
  if (d < 0) return false;
  return d % (PASSO[c.ciclo] ?? 1) === 0;
}
function clampVenc(compISO: string, dia: number): string {
  const ano = Number(compISO.slice(0, 4));
  const mes = Number(compISO.slice(5, 7));
  const ultimo = new Date(ano, mes, 0).getDate();
  const d = Math.min(Math.max(1, dia || 1), ultimo);
  return `${ano}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function mesAtual(): string {
  return new Date().toISOString().slice(0, 7);
}
function mesBR(compISO: string): string {
  return `${compISO.slice(5, 7)}/${compISO.slice(0, 4)}`;
}

function Selo({ st }: { st: EtapaStatus }) {
  if (st.s === "na") return <MinusCircle size={14} className="text-line" aria-label="não se aplica" />;
  if (st.s === "rodando") return <Loader2 size={14} className="animate-spin text-brand" />;
  if (st.s === "ok") return <CheckCircle2 size={14} className="text-brand" />;
  if (st.s === "erro") return <XCircle size={14} className="text-danger" />;
  if (st.s === "pulado") return <MinusCircle size={14} className="text-ink-soft" aria-label="já feito" />;
  return <span className="inline-block h-3.5 w-3.5 rounded-full border border-line" />;
}

const COLUNAS_FAT: ColunaDef[] = [
  { id: "cliente", label: "Cliente / contrato", largura: "1.6fr" },
  { id: "valor", label: "Valor", largura: "110px", alinha: "dir" },
  { id: "faturar", label: "Faturar", largura: "86px" },
  { id: "nfse", label: "NFS-e", largura: "86px" },
  { id: "boleto", label: "Boleto", largura: "86px" },
];
const GRID_FAT = COLUNAS_FAT.map((c) => c.largura).join(" ");

export default function FaturarMes({
  empresaId,
  contratos,
  itens,
  clientes,
  servicos,
  contas,
  nfseConfig,
}: {
  empresaId: string;
  contratos: ContratoRef[];
  itens: ItemRef[];
  clientes: ClienteRef[];
  servicos: ServicoRef[];
  contas: ContaCobranca[];
  nfseConfig: NfseConfigInfo;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [comp, setComp] = useState(mesAtual());
  const [dataAte, setDataAte] = useState(() => clampVenc(mesAtual(), 31));
  const [contaId, setContaId] = useState(contas[0]?.id ?? "");
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [executando, setExecutando] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const clienteMap = useMemo(() => new Map(clientes.map((c) => [c.id, c])), [clientes]);
  const servicoMap = useMemo(() => new Map(servicos.map((s) => [s.id, s])), [servicos]);
  const itensPorContrato = useMemo(() => {
    const m = new Map<string, ItemRef[]>();
    itens.forEach((i) => {
      const arr = m.get(i.contrato_id) ?? [];
      arr.push(i);
      m.set(i.contrato_id, arr);
    });
    return m;
  }, [itens]);

  const conta = contas.find((c) => c.id === contaId) ?? null;
  const precisaBoleto = (linhas ?? []).some((l) => l.contrato.gera_boleto);
  const bancoInfo = conta?.banco_codigo ? BANCOS_COBRANCA[conta.banco_codigo] : null;
  const exigeConvenio = ["001", "033", "104", "756", "748"].includes(conta?.banco_codigo ?? "");
  const contaPronta = !!(bancoInfo && conta?.agencia && conta?.conta_numero && conta?.carteira && (!exigeConvenio || conta?.convenio));

  function abrir() {
    setAberto(true);
    setLinhas(null);
    setConcluido(false);
    setErroGeral(null);
    analisar(comp);
  }

  async function analisar(competencia: string) {
    setAnalisando(true);
    setErroGeral(null);
    setConcluido(false);
    const supabase = createClient();
    const { data: fats, error } = await supabase
      .from("contrato_faturamentos")
      .select("id, contrato_id, valor, nfse_status, boleto_status, lancamento_id, lancamento:lancamentos(data_vencimento)")
      .eq("empresa_id", empresaId)
      .eq("competencia", competencia + "-01");
    if (error) {
      setErroGeral(error.message);
      setAnalisando(false);
      return;
    }
    type FatRow = {
      id: string;
      contrato_id: string;
      valor: number;
      nfse_status: string | null;
      boleto_status: string | null;
      lancamento_id: string | null;
      lancamento: { data_vencimento: string } | { data_vencimento: string }[] | null;
    };
    const vencDe = (f: FatRow): string | null => {
      const l = f.lancamento;
      if (!l) return null;
      return Array.isArray(l) ? (l[0]?.data_vencimento ?? null) : l.data_vencimento;
    };
    const fatPorContrato = new Map((fats ?? []).map((f) => [f.contrato_id as string, f as unknown as FatRow]));
    const elegiveis = contratos.filter((c) => compete(c, competencia));
    const novas: Linha[] = elegiveis.map((c) => {
      const fat = fatPorContrato.get(c.id) ?? null;
      const valor =
        fat?.valor ?? (itensPorContrato.get(c.id) ?? []).reduce((s, i) => s + Number(i.quantidade) * Number(i.valor_unitario), 0);
      const nfseFeita = fat?.nfse_status === "emitida";
      const boletoFeito = fat?.boleto_status === "emitido";
      return {
        contrato: c,
        valor,
        jaFaturado: !!fat,
        fatId: fat?.id ?? null,
        lancamentoId: fat?.lancamento_id ?? null,
        vencimento: (fat ? vencDe(fat) : null) ?? clampVenc(competencia, c.dia_faturamento),
        nfseStatus: fat?.nfse_status ?? null,
        boletoStatus: fat?.boleto_status ?? null,
        faturar: { s: fat ? "pulado" : "pendente", msg: fat ? "já faturado" : undefined },
        nfse: !c.gera_nfse ? { s: "na" } : nfseFeita ? { s: "pulado", msg: "já emitida" } : { s: "pendente" },
        boleto: !c.gera_boleto ? { s: "na" } : boletoFeito ? { s: "pulado", msg: "já gerado" } : { s: "pendente" },
      };
    });
    setLinhas(novas);
    setAnalisando(false);
  }

  function atualizaLinha(i: number, parte: Partial<Linha>) {
    setLinhas((ls) => (ls ? ls.map((l, x) => (x === i ? { ...l, ...parte } : l)) : ls));
  }

  async function executar(cutoff?: string) {
    if (!linhas || linhas.length === 0) return;
    const alvo = cutoff ? linhas.filter((l) => l.vencimento <= cutoff) : linhas;
    const querNfse = alvo.some((l) => l.nfse.s === "pendente");
    const querBoleto = alvo.some((l) => l.boleto.s === "pendente");
    if (querNfse && (!nfseConfig?.codigo_municipio_ibge || !nfseConfig?.cert_path)) {
      setErroGeral("Há notas a emitir, mas o emitente NFS-e não está completo (Configurações → NFS-e). Você pode configurar e rodar de novo — o que já foi feito não se repete.");
    }
    if (querBoleto && !contaPronta) {
      setErroGeral("Há boletos a gerar — escolha uma conta com os dados de cobrança completos (banco, carteira e convênio quando exigido).");
      return;
    }
    setExecutando(true);
    setErroGeral(null);
    const supabase = createClient();
    const ls = [...linhas];

    for (let i = 0; i < ls.length; i++) {
      const l = ls[i];
      if (cutoff && l.vencimento > cutoff) continue; // modo "previstos até a data"
      const c = l.contrato;
      const cliente = clienteMap.get(c.cliente_fornecedor_id);

      // ---- etapa A: faturar ----
      if (l.faturar.s === "pendente") {
        atualizaLinha(i, { faturar: { s: "rodando" } });
        const descricao = `Contrato${c.nome ? " " + c.nome : ""} — ${cliente?.nome ?? ""} — ${mesBR(comp)}`;
        const ins = await supabase
          .from("lancamentos")
          .insert({
            empresa_id: empresaId,
            tipo: "entrada",
            valor: l.valor,
            descricao,
            categoria_id: c.categoria_id,
            conta_id: c.conta_id,
            cliente_fornecedor_id: c.cliente_fornecedor_id,
            data_competencia: comp + "-01",
            data_vencimento: l.vencimento,
            conciliado: false,
          })
          .select("id")
          .single();
        if (ins.error || !ins.data) {
          l.faturar = { s: "erro", msg: ins.error?.message ?? "falha ao lançar" };
          l.nfse = l.nfse.s === "pendente" ? { s: "erro", msg: "sem faturamento" } : l.nfse;
          l.boleto = l.boleto.s === "pendente" ? { s: "erro", msg: "sem faturamento" } : l.boleto;
          atualizaLinha(i, { faturar: l.faturar, nfse: l.nfse, boleto: l.boleto });
          continue;
        }
        const fat = await supabase
          .from("contrato_faturamentos")
          .insert({
            empresa_id: empresaId,
            contrato_id: c.id,
            competencia: comp + "-01",
            lancamento_id: ins.data.id,
            valor: l.valor,
            nfse_status: c.gera_nfse ? "pendente" : null,
            boleto_status: c.gera_boleto ? "pendente" : null,
          })
          .select("id")
          .single();
        if (fat.error || !fat.data) {
          /*
            Rollback que falha em silêncio deixa a entrada a receber sem
            registro de faturamento — e na rodada seguinte `fatPorContrato` não
            acha nada, marca o contrato como pendente e **fatura o mesmo mês de
            novo**. O aviso precisa dizer que sobrou algo, não só que falhou.
          */
          const rb = await supabase.from("lancamentos").delete().eq("id", ins.data.id);
          l.faturar = {
            s: "erro",
            msg: rb.error
              ? `${fat.error?.message ?? "falha no faturamento"} — e o lançamento não pôde ser desfeito. Confira em Movimentações ANTES de rodar de novo.`
              : (fat.error?.message ?? "falha no faturamento"),
          };
          atualizaLinha(i, { faturar: l.faturar });
          continue;
        }
        l.fatId = fat.data.id;
        l.lancamentoId = ins.data.id;
        l.faturar = { s: "ok" };
        atualizaLinha(i, { faturar: l.faturar, fatId: l.fatId, lancamentoId: l.lancamentoId });
      }

      // ---- etapa B: NFS-e ----
      if (l.nfse.s === "pendente" && l.fatId) {
        atualizaLinha(i, { nfse: { s: "rodando" } });
        try {
          const resp = await fetch("/api/nfse/emitir", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ empresaId, origem: "contrato", faturamentoId: l.fatId }),
          });
          const j = (await resp.json().catch(() => ({}))) as { ok?: boolean; nfseNumero?: string | null; erro?: string | null; error?: string; aviso?: string | null };
          // `aviso`: a nota foi emitida mas o faturamento continua "pendente" —
          // a linha precisa mostrar isso, senão a próxima rodada reemite
          l.nfse = j.ok
            ? j.aviso
              ? { s: "erro", msg: `emitida${j.nfseNumero ? ` nº ${j.nfseNumero}` : ""} — ${j.aviso}`.slice(0, 200) }
              : { s: "ok", msg: j.nfseNumero ? `nº ${j.nfseNumero}` : undefined }
            : { s: "erro", msg: (j.erro ?? j.error ?? "rejeitada").slice(0, 160) };
        } catch {
          l.nfse = { s: "erro", msg: "falha de conexão" };
        }
        atualizaLinha(i, { nfse: l.nfse });
      }

      // ---- etapa C: boleto ----
      if (l.boleto.s === "pendente" && l.fatId && conta && contaPronta) {
        atualizaLinha(i, { boleto: { s: "rodando" } });
        if (!cliente?.cpf_cnpj) {
          l.boleto = { s: "erro", msg: "cliente sem CPF/CNPJ" };
          atualizaLinha(i, { boleto: l.boleto });
          continue;
        }
        const { data: nn, error: errNN } = await supabase.rpc("next_nosso_numero", { p_conta: conta.id });
        if (errNN || nn == null) {
          l.boleto = { s: "erro", msg: "falha ao reservar nosso número" };
          atualizaLinha(i, { boleto: l.boleto });
          continue;
        }
        try {
          const t = montarTitulo({
            bancoCodigo: conta.banco_codigo ?? "",
            agencia: conta.agencia ?? "",
            agenciaDv: conta.agencia_dv,
            conta: conta.conta_numero ?? "",
            contaDv: conta.conta_dv,
            convenio: conta.convenio,
            carteira: conta.carteira ?? "",
            nossoNumero: Number(nn),
          });
          const barras = montarCodigoBarras(conta.banco_codigo ?? "", l.vencimento, l.valor, t.campoLivre);
          const linha = linhaDigitavel(barras);
          const ins = await supabase.from("cobranca_titulos").insert({
            empresa_id: empresaId,
            token_publico: (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, ""),
            conta_id: conta.id,
            origem: "contrato_faturamento",
            contrato_faturamento_id: l.fatId,
            lancamento_id: l.lancamentoId,
            cliente_fornecedor_id: c.cliente_fornecedor_id,
            nosso_numero: Number(nn),
            nosso_numero_fmt: t.nossoNumeroFmt,
            numero_documento: `CT-${l.fatId.slice(0, 6).toUpperCase()}`,
            valor: l.valor,
            vencimento: l.vencimento,
            sacado_nome: cliente.nome,
            sacado_documento: cliente.cpf_cnpj,
            sacado_logradouro: cliente.logradouro ?? null,
            sacado_cep: cliente.cep ?? null,
            sacado_municipio: cliente.municipio ?? null,
            sacado_uf: cliente.uf ?? null,
            linha_digitavel: linha,
            codigo_barras: barras,
            status: "gerado",
          });
          if (ins.error) {
            l.boleto = { s: "erro", msg: ins.error.message.slice(0, 120) };
          } else {
            /*
              O título de cobrança já existe quando esta linha roda.

              Se ela falha em silêncio, `boletoFeito` (que lê
              `fat.boleto_status === "emitido"`) continua falso e a próxima
              rodada gera **um segundo boleto, com novo nosso-número, para a
              mesma parcela**. O cliente recebe duas cobranças do mesmo mês, e o
              rodapé desta tela diz que "o que já foi feito não se repete".
            */
            const mb = await supabase
              .from("contrato_faturamentos")
              .update({ boleto_status: "emitido" })
              .eq("id", l.fatId);
            l.boleto = mb.error
              ? {
                  s: "erro",
                  msg: "boleto gerado, mas o contrato não foi marcado — NÃO rode de novo antes de conferir, há risco de emitir duas vezes",
                }
              : { s: "ok" };
          }
        } catch (e) {
          l.boleto = { s: "erro", msg: e instanceof Error ? e.message.slice(0, 120) : "falha ao montar o boleto" };
        }
        atualizaLinha(i, { boleto: l.boleto });
      }
    }

    setExecutando(false);
    setConcluido(true);
    router.refresh();
  }

  // resumo da prévia/resultado
  const resumo = useMemo(() => {
    if (!linhas) return null;
    const cont = (sel: (l: Linha) => EtapaStatus) => ({
      fazer: linhas.filter((l) => sel(l).s === "pendente").length,
      ok: linhas.filter((l) => sel(l).s === "ok").length,
      erro: linhas.filter((l) => sel(l).s === "erro").length,
    });
    return { fat: cont((l) => l.faturar), nfse: cont((l) => l.nfse), bol: cont((l) => l.boleto) };
  }, [linhas]);

  const boletosGerados = (linhas ?? []).filter((l) => l.boleto.s === "ok").length;
  const totalMes = (linhas ?? []).reduce((s, l) => s + l.valor, 0);
  const aFaturar = (linhas ?? []).filter((l) => l.faturar.s === "pendente");
  const noCorte = aFaturar.filter((l) => l.vencimento <= dataAte).length;
  const dataAteBR = dataAte ? dataAte.split("-").reverse().join("/") : "—";

  return (
    <>
      <Botao variante="primario" tamanho="sm"
        onClick={abrir}
      >
        <Zap size={14} /> Faturar o mês
      </Botao>

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-rail/50 p-4">
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-xl2 bg-white shadow-card" role="dialog" aria-modal="true" aria-labelledby="dlg-faturar-mes-titulo">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div>
                <h3 id="dlg-faturar-mes-titulo" className="text-base font-bold text-ink">Faturar o mês</h3>
                <p className="text-xs text-ink-muted">Fatura os contratos da competência (NFS-e e boletos juntos). Use "previstos até" para faturar só os que vencem até uma data, ou "todos do mês".</p>
              </div>
              <button aria-label="Fechar"
                type="button"
                onClick={() => setAberto(false)}
                disabled={executando}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft hover:bg-surface disabled:opacity-40"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-wrap items-end gap-3 border-b border-line px-5 py-3">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-ink-soft">Competência</label>
                <input
                  type="month"
                  value={comp}
                  onChange={(e) => {
                    setComp(e.target.value);
                    if (e.target.value) {
                      setDataAte(clampVenc(e.target.value, 31));
                      analisar(e.target.value);
                    }
                  }}
                  disabled={executando}
                  className={classeControle("md", false, "num")}
                />
              </div>
              {precisaBoleto && (
                <div className="min-w-[220px] flex-1">
                  <label className="mb-1 block text-[11px] font-semibold text-ink-soft">Conta de cobrança (boletos)</label>
                  <select
                    value={contaId}
                    onChange={(e) => setContaId(e.target.value)}
                    disabled={executando}
                    className={classeControle("md")}
                  >
                    {contas.map((ct) => (
                      <option key={ct.id} value={ct.id}>
                        {ct.nome}
                      </option>
                    ))}
                  </select>
                  {!contaPronta && (
                    <p className="mt-1 text-[11px] font-semibold text-danger">Conta sem dados de cobrança completos.</p>
                  )}
                </div>
              )}
              {resumo && (
                <p className="ml-auto text-xs text-ink-muted">
                  {linhas?.length ?? 0} contrato(s) · {brl(totalMes)} no mês
                </p>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-auto px-5 py-3">
              {analisando ? (
                <p className="py-8 text-center text-sm text-ink-soft">Analisando a competência…</p>
              ) : !linhas || linhas.length === 0 ? (
                <p className="py-8 text-center text-sm text-ink-soft">
                  Nenhum contrato ativo compete em {mesBR(comp)}.
                </p>
              ) : (
                /*
                  A `Tabela` do app, sem moldura nem cabeçalho grudento: está
                  dentro de um diálogo com rolagem própria, onde o sticky
                  grudaria no contêiner errado e o cartão duplicaria a sombra.
                */
                <Tabela
                  colunas={COLUNAS_FAT}
                  gridTemplate={GRID_FAT}
                  larguraMinima="640px"
                  moldura={false}
                  grudento={false}
                >
                  {linhas.map((l) => {
                    const cli = clienteMap.get(l.contrato.cliente_fornecedor_id);
                    const obs = [l.faturar.msg, l.nfse.msg, l.boleto.msg].filter(Boolean).join(" · ");
                    const fiscaisFaltando = l.contrato.gera_nfse
                      ? (itensPorContrato.get(l.contrato.id) ?? [])
                          .map((it) => servicoMap.get(it.servico_id))
                          .filter((s) => s && !s.item_lc116)
                          .map((s) => s!.nome)
                      : [];
                    return (
                      <LinhaTabela key={l.contrato.id} gridTemplate={GRID_FAT} className="!items-start">
                        <div className="min-w-0">
                          <p title={cli?.nome ?? undefined} className="truncate font-semibold text-ink">{cli?.nome ?? "Cliente"}</p>
                          <p className="text-[11px] text-ink-soft">
                            {l.contrato.nome || "contrato"} · previsto {l.vencimento.split("-").reverse().join("/")}
                            {l.faturar.s === "pendente" && l.vencimento > dataAte && (
                              <span className="ml-1 font-semibold text-ink-soft/80">· após {dataAteBR}</span>
                            )}
                          </p>
                          {(obs || fiscaisFaltando.length > 0) && (
                            <p className="text-[11px] text-ink-soft">
                              {obs}
                              {fiscaisFaltando.length > 0 && (
                                <span className="font-semibold text-danger">
                                  {obs ? " · " : ""}serviço sem LC 116: {fiscaisFaltando.join(", ")}
                                </span>
                              )}
                            </p>
                          )}
                        </div>
                        <span className="num text-right font-semibold text-ink">{brl(l.valor)}</span>
                        <span className="flex justify-center"><Selo st={l.faturar} /></span>
                        <span className="flex justify-center"><Selo st={l.nfse} /></span>
                        <span className="flex justify-center"><Selo st={l.boleto} /></span>
                      </LinhaTabela>
                    );
                  })}
                </Tabela>
              )}
            </div>

            <div className="border-t border-line px-5 py-4">
              {erroGeral && (
                <MessageStrip tipo="erro">{erroGeral}</MessageStrip>
              )}
              {concluido && resumo && (
                <p className="mb-2 rounded-lg bg-brand-light px-3 py-2 text-xs font-medium text-brand-dark">
                  Concluído: {resumo.fat.ok} faturado(s), {resumo.nfse.ok} nota(s) emitida(s), {resumo.bol.ok} boleto(s) gerado(s).
                  {resumo.fat.erro + resumo.nfse.erro + resumo.bol.erro > 0 &&
                    ` ${resumo.fat.erro + resumo.nfse.erro + resumo.bol.erro} pendência(s) — corrija o que está marcado em vermelho e rode de novo (o que já foi feito não se repete).`}
                  {boletosGerados > 0 && " Agora gere a remessa na aba Boletos."}
                </p>
              )}
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAberto(false)}
                  disabled={executando}
                  className="rounded-md border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-muted transition hover:bg-surface disabled:opacity-40"
                >
                  {concluido ? "Fechar" : "Cancelar"}
                </button>
                {!concluido && (
                  <>
                    <div className="flex items-center gap-1.5 rounded-lg border border-line px-2 py-1">
                      <span className="text-[11px] font-semibold text-ink-soft">previstos até</span>
                      <input
                        type="date"
                        value={dataAte}
                        onChange={(e) => setDataAte(e.target.value)}
                        disabled={executando}
                        className="num rounded-md border border-line px-2 py-1 text-sm outline-none focus:border-brand"
                      />
                      <button
                        type="button"
                        onClick={() => executar(dataAte)}
                        disabled={executando || analisando || noCorte === 0}
                        title={`Fatura os ${noCorte} contrato(s) com previsão até ${dataAteBR}`}
                        className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50"
                      >
                        {executando ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                        Faturar ({noCorte})
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => executar()}
                      disabled={executando || analisando || aFaturar.length === 0}
                      className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50"
                    >
                      {executando ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                      {executando ? "Faturando…" : `Faturar todos do mês (${aFaturar.length})`}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

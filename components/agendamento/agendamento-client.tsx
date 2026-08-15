"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Pencil,
  CalendarClock,
  CheckCircle2,
  Search,
  Download,
  FileText,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { liquidarLancamentos, avisarMovimentacaoMudou } from "@/lib/liquidar";
import BarraVisoes from "@/components/ui/barra-visoes";
import { useVisoes } from "@/components/ui/use-visoes";
import { queryParaFiltros, type Filtros } from "@/lib/visoes";
import CockpitCaixa from "@/components/agendamento/cockpit-caixa";
import PageHeader from "@/components/ui/page-header";
import FooterBar, { FooterSep } from "@/components/ui/footer-bar";
import EmptyState from "@/components/ui/empty-state";
import { SkeletonLinhas } from "@/components/ui/skeleton";
import MultiSelect from "@/components/ui/multi-select";
import { SortToggle, ordenar, toggleOrd, type Ordenacao } from "@/components/ui/sort";
import { gerarRemessasDaSelecao, validarItem, type ItemParaRemessa, type ContaPagadora } from "@/lib/cnab/gerar-remessas";
import { nomeBancoCnab, suportaPagamento, nomesBancosPagamento } from "@/lib/cnab/registry";
import ObjectStatus, { type Tom } from "@/components/ui/object-status";
import { brl, dataBR } from "@/lib/formato";
import Botao from "@/components/ui/botao";
import { classeControle } from "@/components/ui/campo";
import { useListaNavegavel } from "@/components/ui/use-lista-navegavel";

// ── tipos ────────────────────────────────────────────
type Tipo = "entrada" | "saida";
type LancAgend = {
  id: string;
  tipo: Tipo;
  valor: number;
  descricao: string | null;
  data_vencimento: string;
  data_pagamento: string | null;
  data_agendamento: string | null;
  numero_documento: string | null;
  forma_pagamento: string | null;
  pagamento_dados: Record<string, string> | null;
  categoria_id: string | null;
  conta_id: string | null;
  cliente_fornecedor_id: string | null;
  centro_custo_id: string | null;
  categoria: { nome: string } | null;
  conta: { nome: string } | null;
  pessoa: {
    nome: string | null;
    cpf_cnpj: string | null;
    fav_banco_codigo: string | null;
    fav_agencia: string | null;
    fav_conta: string | null;
    fav_conta_dv: string | null;
    fav_conta_tipo: string | null;
  } | null;
};
type Situacao = "vencida" | "hoje" | "prevista" | "agendada";

// ── helpers ──────────────────────────────────────────
function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}
function addDias(base: string, n: number): string {
  const d = new Date(base + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function classifica(l: LancAgend): Situacao {
  if (l.data_agendamento) return "agendada";
  if (l.data_vencimento < hoje()) return "vencida";
  if (l.data_vencimento === hoje()) return "hoje";
  return "prevista";
}

const SIT: Record<Situacao, { label: string; tom: Tom }> = {
  vencida: { label: "Vencida", tom: "negativo" },
  hoje: { label: "Vence hoje", tom: "critico" },
  agendada: { label: "Agendada", tom: "info" },
  prevista: { label: "Prevista", tom: "neutro" },
};

const FORMA_LABEL: Record<string, string> = {
  boleto: "Boleto", pix: "Pix", ted: "TED",
  dinheiro: "Dinheiro", cartao: "Cartão", debito_automatico: "Déb. automático",
};

// ── componente principal ──────────────────────────────
export default function AgendamentoClient({
  empresaId,
  contasCnab,
}: {
  empresaId: string;
  contasCnab: ContaPagadora[];
}) {
  const router = useRouter();
  const h = hoje();

  // filtros desta tela na URL + visões salvas (mesmas chaves que aparecem no link)
  const padraoFiltros = useMemo<Filtros>(
    () => ({ tipo: "saida", de: addDias(h, -30), ate: addDias(h, 90), sit: "previstas", q: "", contas: [] }),
    [h],
  );
  const inicial = useMemo(
    () =>
      queryParaFiltros(
        new URLSearchParams(typeof window === "undefined" ? "" : window.location.search),
        padraoFiltros,
      ),
    // só na montagem
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [tipo, setTipo] = useState<Tipo>(inicial.tipo as Tipo);
  const [de, setDe] = useState(inicial.de as string);
  const [ate, setAte] = useState(inicial.ate as string);
  const [situacaoFiltro, setSituacaoFiltro] = useState<"previstas" | "agendadas" | "todas">(
    inicial.sit as "previstas" | "agendadas" | "todas",
  );
  const [busca, setBusca] = useState(inicial.q as string);
  const buscaRef = useRef<HTMLInputElement>(null);
  const [contasSel, setContasSel] = useState<string[]>(inicial.contas as string[]);
  const [contas, setContas] = useState<{ id: string; nome: string }[]>([]);
  const [lista, setLista] = useState<LancAgend[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [ord, setOrd] = useState<Ordenacao>({ campo: "venc", dir: "asc" });
  const [expandido, setExpandido] = useState<string | null>(null);
  const [copiado, setCopiado] = useState("");
  const [processando, setProcessando] = useState<string>(""); // id ou 'bulk'
  const [agendarAlvo, setAgendarAlvo] = useState<LancAgend | null>(null);
  const [agendarData, setAgendarData] = useState(h);
  const [bulkAgendarData, setBulkAgendarData] = useState(h);
  // dar baixa (marcar pago/recebido) — fluxo manual do internet banking
  const [pagarAlvo, setPagarAlvo] = useState<{ ids: string[]; resumo: string } | null>(null);
  const [pagarData, setPagarData] = useState(h);
  const [pagarConta, setPagarConta] = useState<string>("");
  // remessa CNAB a partir da seleção
  const [cnabModal, setCnabModal] = useState(false);
  const [cnabConta, setCnabConta] = useState<string>("");

  const filtros = useMemo<Filtros>(
    () => ({ tipo, de, ate, sit: situacaoFiltro, q: busca, contas: contasSel }),
    [tipo, de, ate, situacaoFiltro, busca, contasSel],
  );
  const aplicarFiltros = useCallback((f: Filtros) => {
    setTipo(f.tipo as Tipo);
    setDe(f.de as string);
    setAte(f.ate as string);
    setSituacaoFiltro(f.sit as "previstas" | "agendadas" | "todas");
    setBusca((f.q as string) ?? "");
    setContasSel((f.contas as string[]) ?? []);
    setSel(new Set());
  }, []);
  const vis = useVisoes({ empresaId, tela: "liquidacoes", padrao: padraoFiltros, filtros, aplicar: aplicarFiltros });
  const [cnabGerando, setCnabGerando] = useState(false);
  const [cnabMsg, setCnabMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  // ── carga ─────────────────────────────────────────
  const carregar = useCallback(async () => {
    if (!empresaId) return;
    setCarregando(true);
    setSel(new Set());
    const supabase = createClient();
    let lancQuery = supabase
      .from("lancamentos")
      .select(
        "id, tipo, valor, descricao, data_vencimento, data_pagamento, data_agendamento, numero_documento, forma_pagamento, pagamento_dados, categoria_id, conta_id, cliente_fornecedor_id, centro_custo_id, categoria:categorias(nome), conta:contas_bancarias(nome), pessoa:clientes_fornecedores(nome, cpf_cnpj, fav_banco_codigo, fav_agencia, fav_conta, fav_conta_dv, fav_conta_tipo)",
      )
      .eq("empresa_id", empresaId)
      .eq("tipo", tipo)
      .not("transferencia", "is", true)
      .is("data_pagamento", null)
      .gte("data_vencimento", de)
      .lte("data_vencimento", ate);
    if (situacaoFiltro === "previstas") lancQuery = lancQuery.is("data_agendamento", null);
    else if (situacaoFiltro === "agendadas") lancQuery = lancQuery.not("data_agendamento", "is", null);
    const [contasRes, lancRes] = await Promise.all([
      supabase
        .from("contas_bancarias")
        .select("id, nome")
        .eq("empresa_id", empresaId)
        .order("nome"),
      lancQuery.order("data_vencimento", { ascending: true }),
    ]);
    setContas((contasRes.data as { id: string; nome: string }[]) ?? []);
    setLista(((lancRes.data as unknown) as LancAgend[]) ?? []);
    setCarregando(false);
  }, [empresaId, tipo, de, ate, situacaoFiltro, h]);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => {
    const h2 = () => carregar();
    window.addEventListener("fs-mov-changed", h2);
    return () => window.removeEventListener("fs-mov-changed", h2);
  }, [carregar]);

  // ── filtros client-side ───────────────────────────
  const filtrada = lista.filter((l) => {
    if (contasSel.length > 0 && !contasSel.includes(l.conta_id ?? "")) return false;
    if (busca.trim()) {
      const b = busca.trim().toLowerCase();
      return (
        (l.descricao ?? "").toLowerCase().includes(b) ||
        (l.pessoa?.nome ?? "").toLowerCase().includes(b) ||
        (l.numero_documento ?? "").toLowerCase().includes(b)
      );
    }
    return true;
  });

  const ordenada = ordenar(filtrada, ord, {
    venc: (l) => l.data_vencimento,
    valor: (l) => Number(l.valor),
  });

  /*
    Mesma navegação de Movimentações — e o mesmo destino, já que o objeto é o
    lançamento. Espaço marca a linha: esta tela existe para montar lote (baixa
    em massa, remessa CNAB), então percorrer sem conseguir marcar seria meio
    caminho.

    Desligado enquanto qualquer um dos três diálogos está aberto.
  */
  const nav = useListaNavegavel({
    itens: ordenada,
    abrir: (l) => abrirEdicao(l),
    aoMarcar: (l) => toggleSel(l.id),
    buscaRef,
    desligado: Boolean(agendarAlvo) || Boolean(pagarAlvo) || cnabModal,
  });

  // ── seleção ───────────────────────────────────────
  const toggleSel = (id: string) =>
    setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const todosVisiveis = filtrada.length > 0 && filtrada.every((l) => sel.has(l.id));
  const alternarTodos = () =>
    setSel((s) => {
      if (filtrada.every((l) => s.has(l.id))) {
        const n = new Set(s); filtrada.forEach((l) => n.delete(l.id)); return n;
      }
      const n = new Set(s); filtrada.forEach((l) => n.add(l.id)); return n;
    });

  // ── copiar ────────────────────────────────────────
  function copiar(txt: string) {
    navigator.clipboard.writeText(txt).catch(() => {});
    setCopiado(txt);
    setTimeout(() => setCopiado(""), 2000);
  }
  /**
   * Funções chamadas, não componentes. Definidas no corpo do render e usadas
   * como `<BtnCopiar>` / `<DetalhesPagamento>`, teriam identidade nova a cada
   * render: o React remontava o botão a cada clique (que perdia o foco na hora)
   * e a lista inteira a cada tecla na busca. É o mesmo antipadrão que fez um
   * campo de texto do app aceitar só uma letra.
   */
  const btnCopiar = (val: string) => {
    const ok = copiado === val;
    return (
      <button
        type="button"
        onClick={() => copiar(val)}
        title="Copiar"
        className="flex h-7 w-7 items-center justify-center rounded-lg border border-line transition hover:bg-surface"
      >
        {ok ? <Check size={13} className="text-brand" /> : <Copy size={13} className="text-ink-soft" />}
      </button>
    );
  };

  // ── export ────────────────────────────────────────
  function detalheTexto(l: LancAgend): string {
    const f = l.forma_pagamento;
    const d = l.pagamento_dados ?? {};
    if (!f) return "";
    if (f === "pix")
      return [d.chave_pix && `Chave: ${d.chave_pix}`, d.copia_cola && `Copia-e-cola: ${d.copia_cola}`]
        .filter(Boolean)
        .join(" | ");
    if (f === "boleto") return d.linha_digitavel ? `Linha: ${d.linha_digitavel}` : "";
    if (f === "ted")
      return [
        d.banco && `Banco ${d.banco}`,
        d.agencia && `Ag ${d.agencia}`,
        d.conta && `Cc ${d.conta}`,
        d.favorecido && `Fav ${d.favorecido}`,
      ]
        .filter(Boolean)
        .join(" / ");
    return "";
  }

  function exportarCSV() {
    if (filtrada.length === 0) return;
    const sep = ";";
    const head = [
      "Vencimento",
      "Situação",
      "Descrição",
      "Conta",
      "Documento",
      tipo === "saida" ? "Fornecedor" : "Cliente",
      "Forma",
      "Detalhes pagamento",
      "Valor",
    ];
    const linhas = filtrada.map((l) =>
      [
        dataBR(l.data_vencimento),
        SIT[classifica(l)].label,
        l.descricao ?? "",
        l.conta?.nome ?? "",
        l.numero_documento ?? "",
        l.pessoa?.nome ?? "",
        l.forma_pagamento ? FORMA_LABEL[l.forma_pagamento] ?? l.forma_pagamento : "",
        detalheTexto(l),
        Number(l.valor).toFixed(2).replace(".", ","),
      ]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(sep),
    );
    const csv = "\uFEFF" + [head.join(sep), ...linhas].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agendamento-${tipo}-${hoje()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── ações ─────────────────────────────────────────
  async function agendarCom(ids: string[], data: string) {
    if (!data || ids.length === 0) return;
    setProcessando(ids.length === 1 ? ids[0] : "bulk");
    const supabase = createClient();
    /*
      Agendar sem verificação era a pior das três: a lista mostrava "Agendada",
      o usuário parava de acompanhar aquele pagamento, e o banco nunca soube.
      Conta vencida com juros e multa, descoberta pelo fornecedor.
    */
    const rAg = await supabase.from("lancamentos").update({ data_agendamento: data }).in("id", ids);
    if (rAg.error) {
      setProcessando("");
      setCnabMsg({ tipo: "erro", texto: `Não foi possível agendar: ${rAg.error.message}` });
      return;
    }
    setProcessando("");
    setAgendarAlvo(null);
    setSel(new Set());
    await carregar();
    router.refresh();
    window.dispatchEvent(new CustomEvent("fs-mov-changed"));
  }

  // remove o agendamento (volta a ser uma pendência em aberto). Não mexe em data_pagamento.
  async function desagendar(ids: string[]) {
    if (ids.length === 0) return;
    setProcessando(ids.length === 1 ? ids[0] : "bulk");
    const supabase = createClient();
    /*
      Sem verificação, o usuário via a lista mudar e o banco não. Desagendar que
      não acontece é pagamento que continua marcado e pode entrar na próxima
      remessa — o oposto do que a pessoa acabou de pedir.
    */
    const r = await supabase.from("lancamentos").update({ data_agendamento: null }).in("id", ids);
    setProcessando("");
    if (r.error) {
      setCnabMsg({ tipo: "erro", texto: `Não foi possível desagendar: ${r.error.message}` });
      return;
    }
    setSel(new Set());
    await carregar();
    router.refresh();
    window.dispatchEvent(new CustomEvent("fs-mov-changed"));
  }

  // dá baixa: marca data_pagamento (e a conta), limpa agendamento. O item sai da tela e entra no extrato.
  function abrirPagar(ids: string[], resumo: string, contaPadrao: string) {
    setPagarAlvo({ ids, resumo });
    setPagarData(h);
    setPagarConta(contaPadrao);
  }
  async function efetivar() {
    if (!pagarAlvo || !pagarData || !pagarConta) return;
    const ids = pagarAlvo.ids;
    setProcessando(ids.length === 1 ? ids[0] : "bulk");
    // o `update` vive em lib/liquidar.ts porque o Fluxo dá baixa também
    const { error } = await liquidarLancamentos(ids, pagarData, pagarConta);
    setProcessando("");
    if (error) {
      // o erro era descartado: o diálogo fechava, o item voltava para a lista e
      // ninguém sabia por quê. Agora o helper devolve, então dá para avisar.
      setCnabMsg({ tipo: "erro", texto: `Não foi possível dar baixa: ${error.message}` });
      return;
    }
    setPagarAlvo(null);
    setSel(new Set());
    await carregar();
    router.refresh();
    avisarMovimentacaoMudou();
  }

  // Mesmo destino de Movimentações: o lançamento tem página própria.
  // Abrir o mesmo objeto de dois jeitos diferentes confunde mais do que ajuda.
  function abrirEdicao(l: LancAgend) {
    router.push(`/movimentacoes/${l.id}`);
  }

  // ── detalhe do pagamento ──────────────────────────
  const detalhesPagamento = (l: LancAgend) => {
    const f = l.forma_pagamento;
    const d = l.pagamento_dados ?? {};
    if (!f || f === "dinheiro" || f === "cartao" || f === "debito_automatico") return null;
    return (
      <div className="mt-2 rounded-lg border border-brand/20 bg-brand-light/30 p-3 text-xs">
        <p className="mb-2 font-semibold text-ink">
          Como {tipo === "saida" ? "pagar" : "receber"} — {FORMA_LABEL[f]}
        </p>
        {f === "boleto" && d.linha_digitavel && (
          <div className="flex items-center gap-2">
            <span className="num flex-1 select-all rounded bg-white px-2 py-1.5 font-mono text-ink">
              {d.linha_digitavel}
            </span>
            {btnCopiar(d.linha_digitavel)}
          </div>
        )}
        {f === "pix" && (
          <div className="space-y-2">
            {d.chave_pix && (
              <div className="flex items-center gap-2">
                <span className="text-ink-muted">Chave:</span>
                <span className="flex-1 font-medium text-ink">{d.chave_pix}</span>
                {btnCopiar(d.chave_pix)}
              </div>
            )}
            {d.copia_cola && (
              <div className="flex items-start gap-2">
                <span className="shrink-0 text-ink-muted">Copia e cola:</span>
                <span className="flex-1 break-all select-all rounded bg-white px-2 py-1.5 font-mono text-ink">
                  {d.copia_cola}
                </span>
                {btnCopiar(d.copia_cola)}
              </div>
            )}
          </div>
        )}
        {f === "ted" && (
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
            {[
              ["Banco", d.banco],
              ["Agência", d.agencia],
              ["Conta", d.conta],
              ["Favorecido", d.favorecido],
            ].map(([label, val]) =>
              val ? (
                <div key={label}>
                  <span className="text-ink-muted">{label}:</span>
                  <div className="flex items-center gap-1">
                    <span className="font-medium text-ink">{val}</span>
                    {btnCopiar(val)}
                  </div>
                </div>
              ) : null,
            )}
          </div>
        )}
      </div>
    );
  };

  // ── remessa CNAB a partir da seleção ──────────────
  function itensCnabSelecionados(): ItemParaRemessa[] {
    return lista
      .filter(
        (l) => sel.has(l.id) && l.forma_pagamento && ["boleto", "pix", "ted"].includes(l.forma_pagamento),
      )
      .map((l) => ({
        id: l.id,
        valor: Number(l.valor),
        descricao: l.descricao ?? "",
        forma: l.forma_pagamento as "boleto" | "pix" | "ted",
        favorecido_nome: l.pessoa?.nome ?? l.descricao ?? "",
        favorecido_doc: l.pessoa?.cpf_cnpj ?? "",
        dataPagamento: l.data_agendamento ?? l.data_vencimento, // paga na data agendada; senão, no vencimento
        // valor de antes, para a reversão da remessa não apagar agendamento manual
        prev_data_agendamento: l.data_agendamento,
        linha_digitavel: l.pagamento_dados?.linha_digitavel ?? "",
        chave_pix: l.pagamento_dados?.chave_pix ?? "",
        fav_banco_codigo: l.pessoa?.fav_banco_codigo ?? "",
        fav_agencia: l.pessoa?.fav_agencia ?? "",
        fav_conta: l.pessoa?.fav_conta ?? "",
        fav_conta_dv: l.pessoa?.fav_conta_dv ?? "",
        fav_conta_tipo: l.pessoa?.fav_conta_tipo ?? "",
      }));
  }
  function abrirCnab() {
    setCnabMsg(null);
    setCnabConta((c) => c || contasCnab[0]?.id || "");
    setCnabModal(true);
  }
  async function gerarRemessaCnab() {
    const conta = contasCnab.find((c) => c.id === cnabConta);
    if (!conta) {
      setCnabMsg({ tipo: "erro", texto: "Selecione a conta que paga." });
      return;
    }
    if (!suportaPagamento(conta.banco_codigo)) {
      setCnabMsg({ tipo: "erro", texto: `Remessa CNAB ainda não disponível para o banco ${nomeBancoCnab(conta.banco_codigo)}.` });
      return;
    }
    const itens = itensCnabSelecionados();
    if (itens.length === 0) {
      setCnabMsg({ tipo: "erro", texto: "Nenhum item selecionado tem forma boleto, Pix ou TED." });
      return;
    }
    setCnabGerando(true);
    setCnabMsg(null);
    try {
      const r = await gerarRemessasDaSelecao(empresaId, conta, itens);
      /*
        Falha de gravação é mostrada mesmo quando algum lote deu certo.

        Antes, `gerados > 0` fechava o modal e limpava a seleção — e um lote que
        não pôde ser registrado (e por isso não foi baixado) sumia da vista sem
        uma palavra. O modal fica aberto quando há falha: o usuário precisa
        saber quais pagamentos NÃO saíram antes de conferir o extrato do banco.
      */
      if (r.falhas.length > 0) {
        setCnabMsg({
          tipo: "erro",
          texto:
            (r.gerados > 0 ? `${r.gerados} pagamento(s) gerados. ` : "") +
            r.falhas.join(" ") +
            " Recarregue a página e tente de novo para os que faltaram.",
        });
        await carregar();
      } else if (r.gerados === 0) {
        setCnabMsg({
          tipo: "erro",
          texto: r.ignorados[0]?.motivo
            ? `Nada gerado. ${r.ignorados[0].motivo}`
            : "Nada gerado: os itens não têm dados completos.",
        });
      } else {
        setCnabModal(false);
        setSel(new Set());
        await carregar();
      }
    } catch (e) {
      setCnabMsg({ tipo: "erro", texto: e instanceof Error ? e.message : "Falha ao gerar a remessa." });
    } finally {
      setCnabGerando(false);
    }
  }

  // avaliação dos selecionados (para o modal)
  const cnabSelRender = cnabModal ? itensCnabSelecionados() : [];
  const cnabAval = cnabSelRender.map((i) => ({ i, v: validarItem(i) }));
  const cnabProntos = cnabAval.filter((x) => x.v.pronto);
  const cnabIgnor = cnabAval.filter((x) => !x.v.pronto);
  const cnabContaSel = cnabModal ? contasCnab.find((c) => c.id === cnabConta) ?? null : null;
  const cnabBancoOk = suportaPagamento(cnabContaSel?.banco_codigo);

  // ── grid ──────────────────────────────────────────
  const COLS = "grid-cols-[34px_80px_100px_1.5fr_1fr_88px_116px_230px]";

  return (
    <div className="space-y-5">
      {/* cabeçalho: título + abas presos abaixo da shell bar */}
      <PageHeader
        titulo="Liquidações"
        sub={`Pendências de ${tipo === "saida" ? "pagamento" : "recebimento"}. Pague pelo banco copiando os dados e marque como ${tipo === "saida" ? "pago" : "recebido"} para dar baixa, ou gere a remessa CNAB. Itens pagos saem desta lista; use o filtro de situação para ver os agendados.`}
      >
        <div className="flex gap-5">
          {(["saida", "entrada"] as Tipo[]).map((t) => {
            const ativa = tipo === t;
            const cor = t === "saida" ? "border-ink-soft text-ink" : "border-brand text-brand";
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTipo(t)}
                className={[
                  "-mb-px border-b-2 pb-2 text-sm font-semibold transition",
                  ativa ? cor : "border-transparent text-ink-soft hover:text-ink-muted",
                ].join(" ")}
              >
                {t === "saida" ? "A pagar" : "A receber"}
              </button>
            );
          })}
        </div>
      </PageHeader>

      <BarraVisoes
        visoes={vis.visoes}
        ativaId={vis.ativaId}
        sujo={vis.sujo}
        onAplicar={vis.aplicarVisao}
        onLimpar={vis.limpar}
        onSalvar={vis.salvar}
        onApagar={vis.apagar}
      />

      {/* cockpit de caixa */}
      <CockpitCaixa empresaId={empresaId} />

      {/* filtros */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-ink-soft">Vencimento de</label>
          <input type="date" value={de} onChange={(e) => setDe(e.target.value)}
            className={classeControle("md", false, "num")} />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-ink-soft">até</label>
          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)}
            className={classeControle("md", false, "num")} />
        </div>
        <MultiSelect
          label="Conta"
          opcoes={contas.map((c) => ({ value: c.id, label: c.nome }))}
          selecionados={contasSel}
          onChange={setContasSel}
          placeholder="Buscar conta…"
        />
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-ink-soft">Situação</label>
          <div className="flex items-center gap-0.5 rounded-lg border border-line p-0.5 text-sm">
            {[
              { v: "previstas", l: "Previstas" },
              { v: "agendadas", l: "Agendadas" },
              { v: "todas", l: "Todas" },
            ].map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setSituacaoFiltro(o.v as "previstas" | "agendadas" | "todas")}
                className={
                  situacaoFiltro === o.v
                    ? "rounded-md bg-ink px-2.5 py-1.5 font-semibold text-white"
                    : "rounded-md px-2.5 py-1.5 font-medium text-ink-muted transition hover:bg-surface"
                }
              >
                {o.l}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-ink-soft">Buscar</label>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft" />
            <input ref={buscaRef} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Descrição ou fornecedor"
              className="w-48 rounded-lg border border-line py-2 pl-8 pr-2 text-sm outline-none focus:border-brand" />
          </div>
        </div>
        <button
          type="button"
          onClick={exportarCSV}
          disabled={filtrada.length === 0}
          title="Exportar a lista filtrada (CSV)"
          className="ml-auto flex items-center gap-1.5 self-end rounded-md border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-muted transition hover:border-brand hover:text-brand disabled:opacity-50"
        >
          <Download size={14} /> Exportar CSV
        </button>
      </div>

      {/* barra de ação em lote */}
      {/* Footer bar: as ações do lote descem para o rodapé. Antes elas nasciam
          acima da tabela, então marcar uma linha empurrava a lista inteira para
          baixo — e a linha seguinte saía de debaixo do cursor. */}
      <FooterBar
        quando={sel.size > 0}
        info={
          <>
            <span className="font-semibold text-brand-dark">{sel.size} selecionado(s)</span>
            <span className="num text-ink-muted">
              {brl(lista.filter((l) => sel.has(l.id)).reduce((t, l) => t + Number(l.valor), 0))}
            </span>
            <FooterSep />
          </>
        }
      >
          <button
            type="button"
            onClick={() => abrirPagar(Array.from(sel), `${sel.size} item(ns)`, "")}
            disabled={processando === "bulk"}
            className="flex items-center gap-1.5 rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
          >
            <CheckCircle2 size={14} /> Marcar como {tipo === "saida" ? "pago" : "recebido"}
          </button>
          <span className="flex items-center gap-1.5">
            <input
              type="date"
              value={bulkAgendarData}
              onChange={(e) => setBulkAgendarData(e.target.value)}
              className="num rounded-lg border border-amber-300 px-2 py-1.5 text-xs outline-none focus:border-amber-500"
            />
            <button
              type="button"
              onClick={() => agendarCom(Array.from(sel), bulkAgendarData)}
              disabled={processando === "bulk"}
              className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-600 disabled:opacity-60"
            >
              <CalendarClock size={14} /> {tipo === "saida" ? "Agendei no banco" : "Agendar"}
            </button>
          </span>
          {tipo === "saida" ? (
            <Botao variante="primario" tamanho="sm"
              onClick={abrirCnab}
            >
              <FileText size={14} /> Gerar remessa CNAB
            </Botao>
          ) : (
            <button
              type="button"
              disabled
              title="Remessa de cobrança (boletos) — em breve"
              className="flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft opacity-70"
            >
              <FileText size={14} /> Gerar cobrança (em breve)
            </button>
          )}
          <button type="button" onClick={() => setSel(new Set())}
            className="text-xs font-medium text-ink-soft underline-offset-2 hover:underline">
            limpar seleção
          </button>
      </FooterBar>

      {/* tabela */}
      <div className="rounded-xl2 bg-white shadow-card max-xl:overflow-x-auto">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-[13px] font-bold text-ink">{tipo === "saida" ? "Contas a pagar" : "Contas a receber"}</h2>
          <p className="text-[11px] text-ink-soft">
            {tipo === "saida"
              ? "Pague pelo banco (copie os dados) e marque como pago, ou agende se já colocou no banco e ainda não compensou."
              : "Acompanhe o que está por receber. Marque como recebido quando o dinheiro entrar."}
          </p>
        </div>
        <div className="min-w-[1000px]">
          {/* cabeçalho */}
          <div className={`sticky top-[calc(52px_+_var(--fs-cab,0px))] z-10 grid ${COLS} gap-3 border-b border-line bg-white px-4 py-2.5 text-[11px] font-semibold text-ink-soft`}>
            <span className="flex items-center">
              <input type="checkbox" checked={todosVisiveis} onChange={alternarTodos}
                className="h-4 w-4 accent-brand" title="Selecionar todos" />
            </span>
            <span><SortToggle label="Vencimento" campo="venc" inicial="asc" ord={ord} onToggle={(c, i) => setOrd((o) => toggleOrd(o, c, i))} /></span>
            <span>Situação</span>
            <span>Descrição / Conta</span>
            <span>{tipo === "saida" ? "Fornecedor" : "Cliente"}</span>
            <span>Forma</span>
            <span className="text-right"><SortToggle label="Valor" campo="valor" align="right" ord={ord} onToggle={(c, i) => setOrd((o) => toggleOrd(o, c, i))} /></span>
            <span className="text-right">Ações</span>
          </div>

          {carregando ? (
            <SkeletonLinhas linhas={6} colunas={6} />
          ) : filtrada.length === 0 ? (
            <EmptyState
              filtrado
              titulo="Nada pendente neste período"
              descricao="Ajuste o intervalo de datas ou a situação para ver mais títulos."
            />
          ) : (
            ordenada.map((l) => {
              const sit = classifica(l);
              const { label: sitLabel, tom: sitTom } = SIT[sit];
              const temDetalhe = l.forma_pagamento && !["dinheiro", "cartao", "debito_automatico"].includes(l.forma_pagamento) && l.pagamento_dados && Object.values(l.pagamento_dados).some(Boolean);
              const expanded = expandido === l.id;
              const busy = processando === l.id;

              return (
                <div key={l.id} className={`border-b border-line/60 last:border-0 ${sel.has(l.id) ? "bg-brand-light/20" : sit === "vencida" ? "bg-rose-50/10" : ""}`}>
                  {(() => {
                    const { onClick, emFoco, ...resto } = nav.propsLinha(l);
                    return (
                      <div
                        {...resto}
                        onClick={onClick}
                        className={`grid ${COLS} cursor-pointer items-center gap-3 px-4 py-3 text-sm ${
                          emFoco ? "ring-2 ring-inset ring-brand/40 hover:bg-surface/60" : "hover:bg-surface/60"
                        }`}
                      >
                    {/* checkbox */}
                    <span className="flex items-center">
                      <input type="checkbox" checked={sel.has(l.id)} onChange={() => toggleSel(l.id)}
                        className="h-4 w-4 accent-brand" />
                    </span>

                    {/* vencimento */}
                    <span className={`num font-medium ${sit === "vencida" ? "font-bold text-ink" : sit === "hoje" ? "font-bold text-orange-700" : "text-ink-muted"}`}>
                      {dataBR(l.data_vencimento)}
                    </span>

                    {/* situação */}
                    <ObjectStatus tom={sitTom}>{sitLabel}</ObjectStatus>

                    {/* descrição + conta */}
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink">{l.descricao || "—"}</span>
                      <span className="block truncate text-[11px] text-ink-soft">
                        {l.conta?.nome ?? "—"}
                        {l.numero_documento && ` · ${l.numero_documento}`}
                      </span>
                    </span>

                    {/* pessoa */}
                    <span className="truncate text-ink-muted">{l.pessoa?.nome || "—"}</span>

                    {/* forma */}
                    <span>
                      {l.forma_pagamento ? (
                        <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-ink-muted">
                          {FORMA_LABEL[l.forma_pagamento] ?? l.forma_pagamento}
                        </span>
                      ) : (
                        <span className="text-xs text-ink-soft">—</span>
                      )}
                    </span>

                    {/* valor */}
                    <span className={`num text-right font-bold ${tipo === "saida" ? "text-ink" : "text-brand"}`}>
                      {brl(Number(l.valor))}
                    </span>

                    {/* ações */}
                    <span className="flex items-center justify-end gap-1">
                      {/* expandir detalhes de pagamento */}
                      {temDetalhe && (
                        <button type="button" onClick={() => setExpandido(expanded ? null : l.id)}
                          title="Detalhes de pagamento"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition hover:bg-surface hover:text-brand">
                          {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                        </button>
                      )}
                      {/* dar baixa */}
                      <button type="button" disabled={busy}
                        onClick={() => abrirPagar([l.id], `${l.descricao || "Lançamento"} · ${brl(Number(l.valor))}`, l.conta_id ?? "")}
                        title={tipo === "saida" ? "Marcar como pago" : "Marcar como recebido"}
                        className="flex h-8 items-center gap-1 rounded-lg border border-brand/40 px-2 text-[11px] font-semibold text-brand transition hover:bg-brand-light disabled:opacity-50">
                        <CheckCircle2 size={13} />
                        {busy ? "…" : tipo === "saida" ? "Pago" : "Recebido"}
                      </button>
                      {/* agendar / desagendar */}
                      {l.data_agendamento ? (
                        <button type="button" disabled={busy}
                          onClick={() => desagendar([l.id])}
                          title="Remover agendamento (volta a ficar em aberto)"
                          className="flex h-8 items-center gap-1 rounded-lg border border-line px-2 text-[11px] font-semibold text-ink-muted transition hover:bg-surface disabled:opacity-50">
                          <CalendarClock size={13} />
                          {busy ? "…" : "Desagendar"}
                        </button>
                      ) : (
                        <button type="button" disabled={busy}
                          onClick={() => { setAgendarAlvo(l); setAgendarData(h); }}
                          title={tipo === "saida" ? "Agendar (coloquei no banco)" : "Agendar (lancei a cobrança)"}
                          className="flex h-8 items-center gap-1 rounded-lg border border-amber-300 px-2 text-[11px] font-semibold text-amber-700 transition hover:bg-amber-50 disabled:opacity-50">
                          <CalendarClock size={13} />
                          {busy ? "…" : "Agendar"}
                        </button>
                      )}
                      {/* editar */}
                      <button type="button" onClick={() => abrirEdicao(l)} title="Editar"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition hover:bg-surface">
                        <Pencil size={14} />
                      </button>
                    </span>
                      </div>
                    );
                  })()}

                  {/* expansão de detalhes */}
                  {expanded && (
                    <div className="px-4 pb-4 pt-0">
                      {detalhesPagamento(l)}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* rodapé */}
          {filtrada.length > 0 && (
            <div className="flex flex-wrap items-center justify-end gap-6 border-t border-line px-4 py-3 text-sm">
              <span className="text-ink-soft">
                {filtrada.length} item(ns) visível(is)
              </span>
              <span className="font-semibold text-ink-muted">
                Total filtrado{" "}
                <span className={`num font-bold ${tipo === "saida" ? "text-ink" : "text-brand"}`}>
                  {brl(filtrada.reduce((s, l) => s + Number(l.valor), 0))}
                </span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* espaço para a footer bar não cobrir a última linha */}

      {agendarAlvo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-rail/50 backdrop-blur-[1px] p-4" onClick={() => setAgendarAlvo(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="dlg-agendar-titulo" className="w-full max-w-sm rounded-xl2 bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 id="dlg-agendar-titulo" className="flex items-center gap-2 text-sm font-bold text-ink">
              <CalendarClock size={16} className="text-amber-600" /> Agendar pagamento
            </h3>
            <p className="mt-1 text-xs text-ink-soft truncate">{agendarAlvo.descricao || "Lançamento"} · {brl(Number(agendarAlvo.valor))}</p>
            <label className="mt-4 mb-1 block text-[11px] font-semibold text-ink-soft">Data de agendamento (quando coloquei no banco)</label>
            <input
              type="date"
              value={agendarData}
              onChange={(e) => setAgendarData(e.target.value)}
              className={classeControle("md", false, "num")}
            />
            <p className="mt-2 text-[11px] text-ink-soft">A conta continua a vencer/receber no vencimento. Vira efetivada ao pagar ou na conciliação.</p>
            <div className="mt-4 flex gap-2">
              <button data-fechar type="button" onClick={() => setAgendarAlvo(null)}
                className="flex-1 rounded-lg border border-line py-2 text-sm font-semibold text-ink-muted transition hover:bg-surface">
                Cancelar
              </button>
              <button type="button" onClick={() => agendarCom([agendarAlvo.id], agendarData)}
                className="flex-1 rounded-lg bg-brand py-2 text-sm font-semibold text-white transition hover:bg-brand-dark">
                Agendar
              </button>
            </div>
          </div>
        </div>
      )}

      {pagarAlvo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-rail/50 backdrop-blur-[1px] p-4" onClick={() => setPagarAlvo(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="dlg-baixar-titulo" className="w-full max-w-sm rounded-xl2 bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 id="dlg-baixar-titulo" className="flex items-center gap-2 text-sm font-bold text-ink">
              <CheckCircle2 size={16} className="text-brand" /> Marcar como {tipo === "saida" ? "pago" : "recebido"}
            </h3>
            <p className="mt-1 truncate text-xs text-ink-soft">{pagarAlvo.resumo}</p>
            <label className="mt-4 mb-1 block text-[11px] font-semibold text-ink-soft">
              Data do {tipo === "saida" ? "pagamento" : "recebimento"}
            </label>
            <input
              type="date"
              value={pagarData}
              onChange={(e) => setPagarData(e.target.value)}
              className={classeControle("md", false, "num")}
            />
            <label className="mt-3 mb-1 block text-[11px] font-semibold text-ink-soft">Conta</label>
            <select
              value={pagarConta}
              onChange={(e) => setPagarConta(e.target.value)}
              className={classeControle("md")}
            >
              <option value="">Selecione…</option>
              {contas.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
            {!pagarConta && (
              <p className="mt-2 text-[11px] text-ink-soft">Escolha a conta para o lançamento entrar no extrato dela.</p>
            )}
            <div className="mt-4 flex gap-2">
              <button data-fechar type="button" onClick={() => setPagarAlvo(null)}
                className="flex-1 rounded-lg border border-line py-2 text-sm font-semibold text-ink-muted transition hover:bg-surface">
                Cancelar
              </button>
              <Botao variante="primario" className="flex-1" onClick={efetivar} disabled={!pagarConta || processando !== ""}>
                {processando !== "" ? "Salvando…" : "Confirmar"}
              </Botao>
            </div>
          </div>
        </div>
      )}

      {cnabModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-rail/50 backdrop-blur-[1px] p-4" onClick={() => !cnabGerando && setCnabModal(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="dlg-remessa-cnab-titulo" className="w-full max-w-md rounded-xl2 bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 id="dlg-remessa-cnab-titulo" className="flex items-center gap-2 text-sm font-bold text-ink">
              <FileText size={16} className="text-brand" /> Gerar remessa CNAB
            </h3>

            {contasCnab.length === 0 ? (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-3 text-xs text-amber-800">
                Nenhuma conta com banco configurado. Configure em Configurações → CNAB (banco da conta e dados do
                pagador).
              </p>
            ) : (
              <>
                <div className="mt-3">
                  <label className="mb-1 block text-[11px] font-semibold text-ink-soft">Conta que paga</label>
                  <select
                    value={cnabConta}
                    onChange={(e) => setCnabConta(e.target.value)}
                    className={classeControle("md")}
                  >
                    {contasCnab.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome} · {nomeBancoCnab(c.banco_codigo)}
                      </option>
                    ))}
                  </select>
                  {!cnabBancoOk && (
                    <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                      Remessa CNAB ainda não disponível para o banco {nomeBancoCnab(cnabContaSel?.banco_codigo)}. Hoje
                      está disponível para {nomesBancosPagamento()} — para os demais, pague pelo internet banking
                      copiando os dados.
                    </p>
                  )}
                </div>

                <div className="mt-3 rounded-lg border border-line bg-surface/50 p-3 text-xs">
                  {cnabProntos.length > 0 ? (
                    <p className="text-ink">
                      <span className="font-semibold text-brand-dark">{cnabProntos.length}</span> pronto(s) para remessa
                      · {brl(cnabProntos.reduce((s, x) => s + x.i.valor, 0))}
                    </p>
                  ) : (
                    <EmptyState compacto titulo="Nenhum dos selecionados está pronto para remessa" />
                  )}
                  {cnabIgnor.length > 0 && (
                    <ul className="mt-2 space-y-1 text-ink-soft">
                      {cnabIgnor.slice(0, 4).map((x, idx) => (
                        <li key={idx}>
                          • {x.i.favorecido_nome || x.i.descricao}: {x.v.motivo}
                        </li>
                      ))}
                      {cnabIgnor.length > 4 && <li>• … e mais {cnabIgnor.length - 4}</li>}
                    </ul>
                  )}
                  <p className="mt-2 text-[11px] text-ink-soft">
                    Pix, boleto e TED viram arquivos separados (regra do banco). Os itens gerados viram Agendados e saem
                    da lista.
                  </p>
                </div>

                {cnabMsg && (
                  <p className={`mt-3 text-xs ${cnabMsg.tipo === "ok" ? "text-brand-dark" : "text-danger"}`}>
                    {cnabMsg.texto}
                  </p>
                )}

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    disabled={cnabGerando}
                    data-fechar
                    onClick={() => setCnabModal(false)}
                    className="flex-1 rounded-lg border border-line py-2 text-sm font-semibold text-ink-muted transition hover:bg-surface disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <Botao variante="primario" className="flex-1"
                    disabled={cnabGerando || cnabProntos.length === 0 || !cnabBancoOk}
                    onClick={gerarRemessaCnab}
                  >
                    {cnabGerando ? "Gerando…" : `Gerar (${cnabProntos.length})`}
                  </Botao>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

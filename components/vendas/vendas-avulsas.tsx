"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X, Search, BadgeDollarSign, CheckCircle2, FileText, Receipt } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import ComboBusca from "@/components/conciliacao/combo-busca";
import { useSujo } from "@/components/ui/modal";
import EmptyState from "@/components/ui/empty-state";
import { brl, dataBR } from "@/lib/formato";
import MessageStrip from "@/components/ui/message-strip";
import Botao from "@/components/ui/botao";

export type Venda = {
  id: string;
  cliente_fornecedor_id: string;
  data_venda: string;
  descricao: string | null;
  categoria_id: string | null;
  conta_id: string | null;
  parcelas: number;
  primeiro_vencimento: string;
  status: string; // faturada | agendada | cancelada
  gera_nfse: boolean;
  nfse_status: string | null;
  gera_boleto: boolean;
  boleto_status: string | null;
  observacoes: string | null;
};

export type VendaItem = {
  id: string;
  venda_id: string;
  servico_id: string;
  descricao: string | null;
  quantidade: number;
  valor_unitario: number;
};

export type VendaParcela = {
  id: string;
  venda_id: string;
  numero: number;
  valor: number;
  vencimento: string;
  lancamento_id: string | null;
};

type ItemForm = { servico_id: string; descricao: string; quantidade: string; valor_unitario: string };
type Apoio = { id: string; nome: string };
type Cliente = { id: string; nome: string; cpf_cnpj: string | null; tipo: string };
type Servico = { id: string; nome: string; valor: number; unidade: string | null; ativo: boolean };

function parseValor(s: string): number {
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
function fmtValor(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function addMeses(iso: string, n: number): string {
  const ano = Number(iso.slice(0, 4));
  const mes = Number(iso.slice(5, 7));
  const dia = Number(iso.slice(8, 10));
  const total = mes - 1 + n;
  const ano2 = ano + Math.floor(total / 12);
  const mes2 = (total % 12) + 1;
  const ultimo = new Date(ano2, mes2, 0).getDate();
  const d = Math.min(dia, ultimo);
  return `${ano2}-${String(mes2).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function dividirParcelas(total: number, n: number): number[] {
  const base = Math.floor((total / n) * 100) / 100;
  const primeira = Math.round((total - base * (n - 1)) * 100) / 100;
  return [primeira, ...Array(n - 1).fill(base)];
}

const itemVazio: ItemForm = { servico_id: "", descricao: "", quantidade: "1", valor_unitario: "0,00" };

/**
 * Desfaz uma venda meio-criada e diz se conseguiu.
 *
 * Os rollbacks desta tela apagavam lançamentos, parcelas e a venda sem olhar o
 * resultado — e cada um deles, falhando calado, deixa um estado pior que o erro
 * original: entrada a receber sem venda (que reaparece na fila de boletos como
 * cobrança a gerar), ou parcela sem lançamento (que trava o refaturamento para
 * sempre, porque a trava de duplicidade passa a acusar).
 *
 * Devolve `false` quando alguma parte não saiu, para a mensagem poder dizer
 * que sobrou coisa em vez de mandar "tente de novo".
 */
async function desfazerVenda(
  supabase: ReturnType<typeof createClient>,
  vendaId: string,
  lancIds: string[],
  apagarVenda: boolean,
): Promise<boolean> {
  let limpo = true;
  if (lancIds.length > 0) {
    const r = await supabase.from("lancamentos").delete().in("id", lancIds);
    if (r.error) limpo = false;
  }
  const rp = await supabase.from("venda_parcelas").delete().eq("venda_id", vendaId);
  if (rp.error) limpo = false;
  if (apagarVenda) {
    const rv = await supabase.from("vendas").delete().eq("id", vendaId);
    if (rv.error) limpo = false;
  }
  return limpo;
}

/** o que dizer quando o desfazer não completou */
const AVISO_SUJO =
  " ATENÇÃO: não foi possível desfazer tudo — pode ter sobrado lançamento ou parcela. Confira em Movimentações antes de tentar de novo.";

/**
 * Selo de etapa da venda (entrada, NFS-e, boleto). Vive no escopo do módulo:
 * definido dentro do render, ganharia identidade nova a cada tecla na busca e o
 * React remontaria a lista de vendas inteira.
 */
function BadgeEtapa({
  ok,
  pendente,
  rotulo,
  icone: Icone,
}: {
  ok: boolean;
  pendente: boolean;
  rotulo: string;
  icone: typeof FileText;
}) {
  if (!ok && !pendente) return null;
  return (
    <span
      className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        ok ? "bg-brand-light text-brand-dark" : "bg-surface text-ink-soft"
      }`}
    >
      <Icone size={11} /> {rotulo}
    </span>
  );
}

export default function VendasAvulsas({
  empresaId,
  initial,
  initialItens,
  initialParcelas,
  servicos,
  clientes,
  categorias,
  contas,
}: {
  empresaId: string;
  initial: Venda[];
  initialItens: VendaItem[];
  initialParcelas: VendaParcela[];
  servicos: Servico[];
  clientes: Cliente[];
  categorias: Apoio[];
  contas: Apoio[];
}) {
  const router = useRouter();
  const [vendas, setVendas] = useState<Venda[]>(initial);
  const [itens, setItens] = useState<VendaItem[]>(initialItens);
  const [parcelas, setParcelas] = useState<VendaParcela[]>(initialParcelas);
  const [busca, setBusca] = useState("");
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  // modal
  const [aberto, setAberto] = useState(false);
  // guarda contra perder o que foi digitado ao fechar sem salvar
  const form = useSujo(aberto);
  const [salvando, setSalvando] = useState(false);
  const [fCliente, setFCliente] = useState("");
  const [fData, setFData] = useState("");
  const [fDescricao, setFDescricao] = useState("");
  const [fCategoria, setFCategoria] = useState("");
  const [fConta, setFConta] = useState("");
  const [fParcelas, setFParcelas] = useState("1");
  const [fVenc1, setFVenc1] = useState("");
  const [fAgendar, setFAgendar] = useState(false);
  const [faturandoId, setFaturandoId] = useState<string | null>(null);
  const [fNfse, setFNfse] = useState(false);
  const [fBoleto, setFBoleto] = useState(false);
  const [fObs, setFObs] = useState("");
  const [fItens, setFItens] = useState<ItemForm[]>([{ ...itemVazio }]);
  const [msgModal, setMsgModal] = useState<string | null>(null);

  const nomeCliente = useMemo(() => {
    const m = new Map<string, string>();
    clientes.forEach((c) => m.set(c.id, c.nome));
    return m;
  }, [clientes]);
  const nomeServico = useMemo(() => {
    const m = new Map<string, Servico>();
    servicos.forEach((s) => m.set(s.id, s));
    return m;
  }, [servicos]);
  const itensPorVenda = useMemo(() => {
    const m = new Map<string, VendaItem[]>();
    itens.forEach((i) => {
      const arr = m.get(i.venda_id) ?? [];
      arr.push(i);
      m.set(i.venda_id, arr);
    });
    return m;
  }, [itens]);
  const parcelasPorVenda = useMemo(() => {
    const m = new Map<string, VendaParcela[]>();
    parcelas.forEach((p) => {
      const arr = m.get(p.venda_id) ?? [];
      arr.push(p);
      m.set(p.venda_id, arr.sort((a, b) => a.numero - b.numero));
    });
    return m;
  }, [parcelas]);

  function totalVenda(id: string): number {
    return (itensPorVenda.get(id) ?? []).reduce((s, i) => s + i.quantidade * i.valor_unitario, 0);
  }

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return vendas;
    return vendas.filter(
      (v) =>
        (nomeCliente.get(v.cliente_fornecedor_id) ?? "").toLowerCase().includes(q) ||
        (v.descricao ?? "").toLowerCase().includes(q),
    );
  }, [vendas, busca, nomeCliente]);

  function abrirNova() {
    const hoje = new Date().toISOString().slice(0, 10);
    setFCliente("");
    setFData(hoje);
    setFDescricao("");
    setFCategoria(categorias.length === 1 ? categorias[0].id : "");
    setFConta("");
    setFParcelas("1");
    setFVenc1(hoje);
    setFAgendar(false);
    setFNfse(false);
    setFBoleto(false);
    setFObs("");
    setFItens([{ ...itemVazio }]);
    setMsgModal(null);
    setAberto(true);
  }

  function setItem(i: number, patch: Partial<ItemForm>) {
    setFItens((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function escolherServico(i: number, servicoId: string) {
    const s = nomeServico.get(servicoId);
    setItem(i, { servico_id: servicoId, valor_unitario: s ? fmtValor(s.valor) : "0,00" });
  }

  const totalForm = fItens.reduce((s, r) => s + parseValor(r.quantidade) * parseValor(r.valor_unitario), 0);
  const nParcelas = Math.min(Math.max(1, Number(fParcelas) || 1), 36);
  const previewParcelas = totalForm > 0 ? dividirParcelas(totalForm, nParcelas) : [];

  async function salvar() {
    if (!fCliente) {
      setMsgModal("Escolha o cliente da venda.");
      return;
    }
    if (!fCategoria) {
      setMsgModal("Escolha a categoria de receita (necessária para a entrada sair certa).");
      return;
    }
    if (!fVenc1) {
      setMsgModal("Informe o primeiro vencimento.");
      return;
    }
    const linhas = fItens.filter((r) => r.servico_id && parseValor(r.valor_unitario) > 0);
    if (linhas.length === 0) {
      setMsgModal("Adicione ao menos um serviço com valor.");
      return;
    }
    setSalvando(true);
    setMsgModal(null);
    const supabase = createClient();
    const total = totalForm;
    const cliente = nomeCliente.get(fCliente) ?? "";

    // 1) venda
    const { data: venda, error: errVenda } = await supabase
      .from("vendas")
      .insert({
        empresa_id: empresaId,
        cliente_fornecedor_id: fCliente,
        data_venda: fData,
        descricao: fDescricao.trim() || null,
        categoria_id: fCategoria,
        conta_id: fConta || null,
        parcelas: nParcelas,
        primeiro_vencimento: fVenc1,
        status: fAgendar ? "agendada" : "faturada",
        gera_nfse: fNfse,
        nfse_status: !fAgendar && fNfse ? "pendente" : null,
        gera_boleto: fBoleto,
        boleto_status: !fAgendar && fBoleto ? "pendente" : null,
        observacoes: fObs.trim() || null,
      })
      .select("id")
      .single();
    if (errVenda || !venda) {
      setSalvando(false);
      setMsgModal(errVenda?.message ?? "Falha ao salvar a venda.");
      return;
    }

    // 2) itens
    const novosItens = linhas.map((r) => ({
      empresa_id: empresaId,
      venda_id: venda.id,
      servico_id: r.servico_id,
      descricao: r.descricao.trim() || null,
      quantidade: parseValor(r.quantidade) || 1,
      valor_unitario: parseValor(r.valor_unitario),
    }));
    const { data: insItens, error: errItens } = await supabase.from("venda_itens").insert(novosItens).select();
    if (errItens) {
      const limpo = await desfazerVenda(supabase, venda.id, [], true);
      setSalvando(false);
      setMsgModal(`${errItens.message}${limpo ? "" : AVISO_SUJO}`);
      return;
    }

    // 3) entradas no contas a receber (uma por parcela) + registro das parcelas
    // Se "agendar", a venda fica registrada sem lançar nada agora — o contas a
    // receber só é criado quando o usuário clicar em "Faturar".
    const novasParcelas: VendaParcela[] = [];
    if (!fAgendar) {
      const valores = dividirParcelas(total, nParcelas);
      for (let n = 0; n < nParcelas; n++) {
      const venc = addMeses(fVenc1, n);
      const sufixo = nParcelas > 1 ? ` (${n + 1}/${nParcelas})` : "";
      const ins = await supabase
        .from("lancamentos")
        .insert({
          empresa_id: empresaId,
          tipo: "entrada",
          valor: valores[n],
          descricao: `Venda — ${cliente}${fDescricao.trim() ? " — " + fDescricao.trim() : ""}${sufixo}`,
          categoria_id: fCategoria,
          conta_id: fConta || null,
          cliente_fornecedor_id: fCliente,
          data_competencia: fData,
          data_vencimento: venc,
          conciliado: false,
        })
        .select("id")
        .single();
      if (ins.error || !ins.data) {
        // desfaz tudo para não deixar venda meio-faturada
        const ids = novasParcelas.map((p) => p.lancamento_id).filter(Boolean) as string[];
        const limpo = await desfazerVenda(supabase, venda.id, ids, true);
        setSalvando(false);
        setMsgModal(`Falha ao gerar a parcela ${n + 1}: ${ins.error?.message ?? ""}${limpo ? "" : AVISO_SUJO}`);
        return;
      }
      const par = await supabase
        .from("venda_parcelas")
        .insert({
          empresa_id: empresaId,
          venda_id: venda.id,
          numero: n + 1,
          valor: valores[n],
          vencimento: venc,
          lancamento_id: ins.data.id,
        })
        .select()
        .single();
      /*
        O erro daqui era descartado — `const { data: par }` seguido de `if (par)`.

        O `lancamentos` da linha acima já existe quando esta inserção falha. Sem
        a parcela, aquela entrada no contas a receber fica órfã: nada a liga à
        venda, ela não aparece na fila de boleto por parcela, e a venda é dada
        como salva sem uma palavra. Pior: ela passa a se qualificar como
        "lançamento avulso a receber" e reaparece na fila de boletos como
        cobrança a gerar — o cliente recebe boleto de uma parcela que o sistema
        acha que nunca foi registrada.

        O rollback agora inclui o lançamento desta volta, que ainda não estava
        em `novasParcelas`, e as parcelas já gravadas.
      */
      if (par.error || !par.data) {
        const ids = [...novasParcelas.map((p) => p.lancamento_id), ins.data.id].filter(Boolean) as string[];
        const limpo = await desfazerVenda(supabase, venda.id, ids, true);
        setSalvando(false);
        setMsgModal(`Falha ao registrar a parcela ${n + 1}: ${par.error?.message ?? ""}${limpo ? "" : AVISO_SUJO}`);
        return;
      }
      novasParcelas.push(par.data as VendaParcela);
    }
    }

    // estado local
    const novaVenda: Venda = {
      id: venda.id,
      cliente_fornecedor_id: fCliente,
      data_venda: fData,
      descricao: fDescricao.trim() || null,
      categoria_id: fCategoria,
      conta_id: fConta || null,
      parcelas: nParcelas,
      primeiro_vencimento: fVenc1,
      status: fAgendar ? "agendada" : "faturada",
      gera_nfse: fNfse,
      nfse_status: !fAgendar && fNfse ? "pendente" : null,
      gera_boleto: fBoleto,
      boleto_status: !fAgendar && fBoleto ? "pendente" : null,
      observacoes: fObs.trim() || null,
    };
    setVendas((l) => [novaVenda, ...l]);
    setItens((l) => [...l, ...((insItens ?? []) as VendaItem[])]);
    setParcelas((l) => [...l, ...novasParcelas]);
    setSalvando(false);
    setAberto(false);
    setMsg({
      tipo: "ok",
      texto: fAgendar
        ? `Venda agendada — nada foi lançado ainda. Use "Faturar" quando quiser gerar o contas a receber.`
        : `Venda registrada: ${nParcelas} entrada(s) de ${brl(total)} no contas a receber.`,
    });
    router.refresh();
  }

  async function faturarAgendada(v: Venda) {
    const itensV = itensPorVenda.get(v.id) ?? [];
    const total = itensV.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0);
    if (total <= 0) {
      setMsg({ tipo: "erro", texto: "Venda sem itens com valor — cancele e refaça." });
      return;
    }
    if (!v.categoria_id) {
      setMsg({ tipo: "erro", texto: "Venda sem categoria de receita — cancele e refaça." });
      return;
    }
    if (!confirm(`Faturar a venda de ${nomeCliente.get(v.cliente_fornecedor_id) ?? "cliente"}? Isso gera as entradas no contas a receber agora.`)) return;
    setFaturandoId(v.id);
    const supabase = createClient();

    /*
      Trava contra faturar a mesma venda duas vezes.

      O rollback desta função apagava os lançamentos e **não** as
      `venda_parcelas` já gravadas, e a venda continuava `agendada`. Ou seja: uma
      tentativa que falhasse no meio deixava parcelas apontando para lançamentos
      apagados, e o próximo clique em "Faturar" — que continua disponível, porque
      o status não mudou — criava tudo de novo por cima. A venda terminava com o
      dobro das parcelas e o cliente com o dobro das cobranças.

      A pergunta é feita ao banco, e não ao estado da tela: outra aba, outro
      usuário do escritório ou uma tentativa anterior desta mesma sessão podem
      ter deixado parcela para trás.
    */
    const jaTem = await supabase.from("venda_parcelas").select("id").eq("venda_id", v.id).limit(1);
    if (jaTem.error) {
      // erro na trava conta como "não sei", nunca como "pode faturar": o custo
      // de errar aqui é o cliente receber a cobrança duas vezes
      setFaturandoId(null);
      setMsg({ tipo: "erro", texto: `Não deu para conferir se esta venda já foi faturada. Tente de novo. (${jaTem.error.message})` });
      return;
    }
    if (jaTem.data && jaTem.data.length > 0) {
      setFaturandoId(null);
      setMsg({
        tipo: "erro",
        texto:
          "Esta venda já tem parcelas registradas — provavelmente um faturamento anterior parou no meio. Confira em Movimentações antes de faturar de novo.",
      });
      return;
    }

    const cliente = nomeCliente.get(v.cliente_fornecedor_id) ?? "";
    const n = Math.max(1, v.parcelas || 1);
    const valores = dividirParcelas(total, n);
    const hoje = new Date().toISOString().slice(0, 10);
    const novasParcelas: VendaParcela[] = [];

    for (let k = 0; k < n; k++) {
      const venc = addMeses(v.primeiro_vencimento, k);
      const sufixo = n > 1 ? ` (${k + 1}/${n})` : "";
      const ins = await supabase
        .from("lancamentos")
        .insert({
          empresa_id: empresaId,
          tipo: "entrada",
          valor: valores[k],
          descricao: `Venda — ${cliente}${v.descricao ? " — " + v.descricao : ""}${sufixo}`,
          categoria_id: v.categoria_id,
          conta_id: v.conta_id || null,
          cliente_fornecedor_id: v.cliente_fornecedor_id,
          data_competencia: hoje,
          data_vencimento: venc,
          conciliado: false,
        })
        .select("id")
        .single();
      if (ins.error || !ins.data) {
        // desfaz os dois lados: parcelas também, senão a próxima tentativa
        // encontra a trava lá em cima e a venda fica travada para sempre
        const ids = novasParcelas.map((p) => p.lancamento_id).filter(Boolean) as string[];
        const limpo = await desfazerVenda(supabase, v.id, ids, false);
        setFaturandoId(null);
        setMsg({
          tipo: "erro",
          texto: `Falha ao gerar a parcela ${k + 1}: ${ins.error?.message ?? ""}${limpo ? "" : AVISO_SUJO}`,
        });
        return;
      }
      const par = await supabase
        .from("venda_parcelas")
        .insert({
          empresa_id: empresaId,
          venda_id: v.id,
          numero: k + 1,
          valor: valores[k],
          vencimento: venc,
          lancamento_id: ins.data.id,
        })
        .select()
        .single();
      if (par.error || !par.data) {
        const ids = [...novasParcelas.map((p) => p.lancamento_id), ins.data.id].filter(Boolean) as string[];
        const limpo = await desfazerVenda(supabase, v.id, ids, false);
        setFaturandoId(null);
        setMsg({
          tipo: "erro",
          texto: `Falha ao registrar a parcela ${k + 1}: ${par.error?.message ?? ""}${limpo ? "" : AVISO_SUJO}`,
        });
        return;
      }
      novasParcelas.push(par.data as VendaParcela);
    }

    const novoNfse = v.gera_nfse ? "pendente" : null;
    const novoBoleto = v.gera_boleto ? "pendente" : null;
    const { error: errUpd } = await supabase
      .from("vendas")
      .update({ status: "faturada", nfse_status: novoNfse, boleto_status: novoBoleto })
      .eq("id", v.id);
    if (errUpd) {
      setFaturandoId(null);
      setMsg({ tipo: "erro", texto: errUpd.message });
      return;
    }

    setParcelas((l) => [...l, ...novasParcelas]);
    setVendas((l) =>
      l.map((x) => (x.id === v.id ? { ...x, status: "faturada", nfse_status: novoNfse, boleto_status: novoBoleto } : x)),
    );
    setFaturandoId(null);
    setMsg({ tipo: "ok", texto: `Venda faturada: ${n} entrada(s) de ${brl(total)} no contas a receber.` });
    router.refresh();
  }

  async function cancelar(v: Venda) {
    const pars = parcelasPorVenda.get(v.id) ?? [];
    const lancIds = pars.map((p) => p.lancamento_id).filter(Boolean) as string[];
    const supabase = createClient();
    // bloqueia se alguma parcela já foi conciliada/recebida
    if (lancIds.length > 0) {
      /*
        Esta trava não pode falhar aberta.

        O erro era descartado, e `lancs ?? []` vira "nenhuma parcela recebida" —
        exatamente a resposta que libera o cancelamento. Aí o bloco abaixo apaga
        os lançamentos, inclusive os já conciliados com o extrato: a
        conciliação some, o saldo da conta muda e a transação do banco volta
        para a fila sem par. Um timeout de rede não pode ter esse efeito.
      */
      const cons = await supabase.from("lancamentos").select("id, conciliado, data_pagamento").in("id", lancIds);
      if (cons.error) {
        setMsg({
          tipo: "erro",
          texto: `Não foi possível conferir se alguma parcela já foi recebida (${cons.error.message}). A venda NÃO foi cancelada — tente de novo.`,
        });
        return;
      }
      const lancs = cons.data;
      const recebida = (lancs ?? []).some(
        (l: { conciliado: boolean; data_pagamento: string | null }) => l.conciliado || l.data_pagamento,
      );
      if (recebida) {
        setMsg({
          tipo: "erro",
          texto: "Esta venda tem parcela já recebida/conciliada — estorne na conciliação antes de cancelar.",
        });
        return;
      }
    }
    if (!confirm(`Cancelar a venda de ${nomeCliente.get(v.cliente_fornecedor_id) ?? "cliente"}? As entradas em aberto serão removidas.`)) return;
    /*
      As entradas saem ANTES do status mudar — e se não saírem, o cancelamento
      não acontece.

      O delete tinha o erro descartado: quando ele falhava e o update passava, a
      venda ficava "cancelada" e as parcelas **continuavam no contas a receber**,
      indo para a fila de boletos e para a cobrança. E a mensagem afirmava
      "Venda cancelada e entradas em aberto removidas". Cancelar sem remover é
      pior que não cancelar: some da vista e continua cobrando.

      As parcelas também são apagadas, senão a venda cancelada fica com parcelas
      órfãs apontando para lançamentos que não existem mais.
    */
    if (lancIds.length > 0) {
      const rl = await supabase.from("lancamentos").delete().in("id", lancIds);
      if (rl.error) {
        setMsg({
          tipo: "erro",
          texto: `Não foi possível remover as entradas a receber (${rl.error.message}). A venda NÃO foi cancelada — as cobranças continuariam ativas.`,
        });
        return;
      }
    }
    const rp = await supabase.from("venda_parcelas").delete().eq("venda_id", v.id);
    const { error } = await supabase
      .from("vendas")
      .update({ status: "cancelada", nfse_status: v.gera_nfse ? "cancelada" : null, boleto_status: v.gera_boleto ? "cancelado" : null })
      .eq("id", v.id);
    if (error) {
      setMsg({
        tipo: "erro",
        texto: `${error.message} — as entradas a receber${rp.error ? "" : " e as parcelas"} já foram removidas, mas a venda continua marcada como faturada. Cancele de novo (repetir é seguro: o que já saiu não sai duas vezes).`,
      });
      return;
    }
    setParcelas((l) => l.filter((x) => x.venda_id !== v.id));
    setVendas((l) => l.map((x) => (x.id === v.id ? { ...x, status: "cancelada" } : x)));
    setMsg({
      tipo: rp.error ? "erro" : "ok",
      texto: rp.error
        ? "Venda cancelada e entradas removidas, mas sobraram parcelas registradas — confira antes de refazer esta venda."
        : "Venda cancelada e entradas em aberto removidas.",
    });
    router.refresh();
  }

  const inputCls = "w-full rounded-md border border-line px-2.5 py-1.5 text-[12.5px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";
  const labelCls = "mb-1 block text-xs font-semibold text-ink-muted";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative max-w-xs flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por cliente ou descrição…"
            className="w-full rounded-lg border border-line py-2 pl-9 pr-3 text-sm outline-none focus:border-brand"
          />
        </div>
        <Botao variante="primario"
          onClick={abrirNova}
        >
          <Plus size={16} /> Nova venda
        </Botao>
      </div>

      {msg && (
        <p className={`text-xs font-semibold ${msg.tipo === "erro" ? "text-danger" : "text-brand"}`}>{msg.texto}</p>
      )}

      {vendas.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl2 border border-dashed border-line py-16 text-ink-soft">
          <BadgeDollarSign size={28} strokeWidth={1.5} />
          <EmptyState compacto titulo="Nenhuma venda ainda" descricao="A venda gera as entradas no contas a receber na hora." />
          <button type="button" onClick={abrirNova} className="mt-3 text-sm font-semibold text-brand hover:underline">
            Registrar a primeira
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl2 bg-white shadow-card">
          {filtradas.map((v) => {
            const total = totalVenda(v.id);
            const pars = parcelasPorVenda.get(v.id) ?? [];
            const cancelada = v.status === "cancelada";
            const agendada = v.status === "agendada";
            return (
              <div key={v.id} className={`flex items-center gap-3 border-b border-line/60 px-4 py-3 last:border-0 hover:bg-surface/40 ${cancelada ? "opacity-55" : ""}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-ink">
                      {nomeCliente.get(v.cliente_fornecedor_id) ?? "Cliente"}
                    </span>
                    {v.descricao && <span className="truncate text-xs text-ink-muted">· {v.descricao}</span>}
                    {cancelada ? (
                      <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-ink-soft">cancelada</span>
                    ) : agendada ? (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">agendada</span>
                    ) : (
                      <>
                        <BadgeEtapa ok pendente={false} rotulo={`entrada ${pars.length > 1 ? pars.length + "x" : "✓"}`} icone={CheckCircle2} />
                        {v.gera_nfse && <BadgeEtapa ok={v.nfse_status === "emitida"} pendente rotulo={`NFS-e ${v.nfse_status ?? ""}`} icone={FileText} />}
                        {v.gera_boleto && <BadgeEtapa ok={v.boleto_status === "emitido"} pendente rotulo={`boleto ${v.boleto_status ?? ""}`} icone={Receipt} />}
                      </>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-ink-soft">
                    <span>
                      {dataBR(v.data_venda)} · {(itensPorVenda.get(v.id) ?? []).length} serviço(s)
                      {v.parcelas > 1 ? ` · ${v.parcelas}x` : ""}
                    </span>
                    {agendada && <span className="font-semibold text-amber-700">previsto p/ {dataBR(v.primeiro_vencimento)}</span>}
                    {pars.length > 0 && <span>1º venc. {dataBR(pars[0].vencimento)}</span>}
                  </div>
                </div>
                <span className="num shrink-0 text-sm font-semibold text-ink">{brl(total)}</span>
                {agendada && (
                  <button
                    type="button"
                    onClick={() => faturarAgendada(v)}
                    disabled={faturandoId === v.id}
                    className="shrink-0 rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
                  >
                    {faturandoId === v.id ? "Faturando…" : "Faturar"}
                  </button>
                )}
                {!cancelada && (
                  <button
                    type="button"
                    onClick={() => cancelar(v)}
                    className="shrink-0 rounded-lg p-1.5 text-ink-soft transition hover:bg-surface hover:text-danger"
                    aria-label="Cancelar venda"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            );
          })}
          {filtradas.length === 0 && <EmptyState compacto titulo="Nenhuma venda bate com a busca" />}
        </div>
      )}

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-rail/50 p-4 backdrop-blur-[1px]">
          <div className="my-8 w-full max-w-2xl rounded-xl2 bg-white shadow-xl" role="dialog" aria-modal="true" aria-labelledby="dlg-venda-avulsa-titulo" {...form.campos}>
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <h2 id="dlg-venda-avulsa-titulo" className="text-[13px] font-bold text-ink">Nova venda</h2>
              <button aria-label="Fechar" type="button" onClick={() => form.confirmar() && setAberto(false)} className="rounded-lg p-1 text-ink-soft hover:bg-surface">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 px-5 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Cliente *</label>
                  <ComboBusca
                    value={fCliente}
                    onChange={setFCliente}
                    options={clientes.map((p) => ({ id: p.id, nome: p.nome, sub: p.cpf_cnpj }))}
                    placeholder="Escolha o cliente…"
                  />
                </div>
                <div>
                  <label className={labelCls}>Data da venda</label>
                  <input type="date" value={fData} onChange={(e) => setFData(e.target.value)} className={`num ${inputCls}`} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Descrição (opcional)</label>
                <input value={fDescricao} onChange={(e) => setFDescricao(e.target.value)} placeholder="ex.: Projeto de implantação" className={inputCls} />
              </div>

              {/* serviços vendidos */}
              <div className="rounded-lg border border-line p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-ink">Serviços vendidos</span>
                  <button type="button" onClick={() => setFItens((r) => [...r, { ...itemVazio }])} className="text-xs font-semibold text-brand hover:underline">
                    + adicionar serviço
                  </button>
                </div>
                <div className="space-y-2">
                  {fItens.map((r, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <select value={r.servico_id} onChange={(e) => escolherServico(i, e.target.value)} className={`flex-1 ${inputCls}`}>
                        <option value="">Serviço…</option>
                        {servicos
                          .filter((s) => s.ativo || s.id === r.servico_id)
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.nome}
                            </option>
                          ))}
                      </select>
                      <input inputMode="decimal" value={r.quantidade} onChange={(e) => setItem(i, { quantidade: e.target.value })} placeholder="qtd" className={`num w-16 ${inputCls}`} />
                      <input inputMode="decimal" value={r.valor_unitario} onChange={(e) => setItem(i, { valor_unitario: e.target.value })} placeholder="0,00" className={`num w-28 ${inputCls}`} />
                      {fItens.length > 1 && (
                        <button type="button" onClick={() => setFItens((rows) => rows.filter((_, idx) => idx !== i))} className="rounded-lg p-1.5 text-ink-soft transition hover:bg-surface" aria-label="Remover">
                          <X size={15} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-right text-sm font-bold text-ink">
                  Total: <span className="num text-brand">{brl(totalForm)}</span>
                </p>
                {servicos.length === 0 && <p className="mt-1 text-[11px] text-danger">Cadastre os serviços na aba Serviços primeiro.</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Categoria de receita *</label>
                  <ComboBusca value={fCategoria} onChange={setFCategoria} options={categorias.map((c) => ({ id: c.id, nome: c.nome }))} placeholder="Escolha…" />
                </div>
                <div>
                  <label className={labelCls}>Conta de recebimento (opcional)</label>
                  <select value={fConta} onChange={(e) => setFConta(e.target.value)} className={inputCls}>
                    <option value="">Definir na conciliação</option>
                    {contas.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Parcelas</label>
                  <input type="number" min={1} max={36} value={fParcelas} onChange={(e) => setFParcelas(e.target.value)} className={`num ${inputCls}`} />
                </div>
                <div>
                  <label className={labelCls}>1º vencimento *</label>
                  <input type="date" value={fVenc1} onChange={(e) => setFVenc1(e.target.value)} className={`num ${inputCls}`} />
                </div>
              </div>
              {previewParcelas.length > 1 && (
                <p className="text-[11px] text-ink-soft">
                  {previewParcelas.length}x: 1ª de {brl(previewParcelas[0])}, demais de {brl(previewParcelas[1])} — vencimentos mensais a partir de {fVenc1 ? dataBR(fVenc1) : "—"}.
                </p>
              )}

              <label className="flex items-start gap-2 rounded-lg border border-line bg-surface/40 px-3 py-2 text-sm text-ink">
                <input type="checkbox" checked={fAgendar} onChange={(e) => setFAgendar(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-line text-brand focus:ring-brand" />
                <span>
                  <b>Agendar para faturar depois</b> — registra a venda sem lançar no contas a receber agora. Você fatura com um clique quando quiser (o vencimento acima vira a data prevista).
                </span>
              </label>

              <div className="flex flex-wrap gap-5">
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" checked={fNfse} onChange={(e) => setFNfse(e.target.checked)} className="h-4 w-4 rounded border-line text-brand focus:ring-brand" />
                  Emitir NFS-e (entra na fila de emissão)
                </label>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" checked={fBoleto} onChange={(e) => setFBoleto(e.target.checked)} className="h-4 w-4 rounded border-line text-brand focus:ring-brand" />
                  Gerar boleto (entra na fila de cobrança)
                </label>
              </div>

              <div>
                <label className={labelCls}>Observações</label>
                <textarea value={fObs} onChange={(e) => setFObs(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
              </div>

              {msgModal && <MessageStrip tipo="erro">{msgModal}</MessageStrip>}
            </div>

            <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
              <button type="button" onClick={() => form.confirmar() && setAberto(false)} className="rounded-md border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-muted transition hover:bg-surface">
                Cancelar
              </button>
              <Botao variante="primario" onClick={salvar} disabled={salvando}>
                {salvando ? (fAgendar ? "Agendando…" : "Faturando…") : fAgendar ? "Agendar venda" : "Salvar e faturar"}
              </Botao>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, X, Search, FileSignature, Zap, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import ComboBusca from "@/components/conciliacao/combo-busca";
import { useSujo } from "@/components/ui/modal";
import EmptyState from "@/components/ui/empty-state";
import { brl } from "@/lib/formato";
import MessageStrip from "@/components/ui/message-strip";
import Botao from "@/components/ui/botao";
import { classeControle } from "@/components/ui/campo";
import { useListaNavegavel } from "@/components/ui/use-lista-navegavel";

type Contrato = {
  id: string;
  cliente_fornecedor_id: string;
  nome: string | null;
  ciclo: string; // mensal | trimestral | semestral | anual
  dia_faturamento: number;
  data_inicio: string;
  data_fim: string | null;
  categoria_id: string | null;
  conta_id: string | null;
  status: string; // ativo | suspenso | encerrado
  gera_nfse: boolean;
  gera_boleto: boolean;
  observacoes: string | null;
};

type Item = {
  id: string;
  contrato_id: string;
  servico_id: string;
  descricao: string | null;
  quantidade: number;
  valor_unitario: number;
};

type ItemForm = { servico_id: string; descricao: string; quantidade: string; valor_unitario: string };

type Apoio = { id: string; nome: string };
type Cliente = { id: string; nome: string; cpf_cnpj: string | null; tipo: string };
type Servico = { id: string; nome: string; valor: number; unidade: string | null; ativo: boolean };

const CICLOS: { v: string; l: string }[] = [
  { v: "mensal", l: "Mensal" },
  { v: "trimestral", l: "Trimestral" },
  { v: "semestral", l: "Semestral" },
  { v: "anual", l: "Anual" },
];
const PASSO: Record<string, number> = { mensal: 1, trimestral: 3, semestral: 6, anual: 12 };
const STATUS: { v: string; l: string }[] = [
  { v: "ativo", l: "Ativo" },
  { v: "suspenso", l: "Suspenso" },
  { v: "encerrado", l: "Encerrado" },
];

function parseValor(s: string): number {
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
function fmtValor(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function mesAtualISO(): string {
  return new Date().toISOString().slice(0, 7);
}
function mesBR(compISO: string): string {
  const [a, m] = compISO.split("-");
  return `${m}/${a}`;
}
function diffMeses(inicioISO: string, compISO: string): number {
  const a1 = Number(inicioISO.slice(0, 4));
  const m1 = Number(inicioISO.slice(5, 7));
  const a2 = Number(compISO.slice(0, 4));
  const m2 = Number(compISO.slice(5, 7));
  return (a2 - a1) * 12 + (m2 - m1);
}
function compete(c: Contrato, compISO: string): boolean {
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

const itemVazio: ItemForm = { servico_id: "", descricao: "", quantidade: "1", valor_unitario: "0,00" };

export default function ContratosClient({
  empresaId,
  initial,
  initialItens,
  soId,
  servicos,
  clientes,
  categorias,
  contas,
}: {
  empresaId: string;
  initial: Contrato[];
  initialItens: Item[];
  /** modo página: só este contrato, na própria URL */
  soId?: string;
  servicos: Servico[];
  clientes: Cliente[];
  categorias: Apoio[];
  contas: Apoio[];
}) {
  const router = useRouter();
  const [contratos, setContratos] = useState<Contrato[]>(initial);
  const [itens, setItens] = useState<Item[]>(initialItens);
  const [busca, setBusca] = useState("");
  const buscaRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  // faturamento
  const [comp, setComp] = useState(mesAtualISO());
  const [faturados, setFaturados] = useState<Set<string>>(new Set());
  const [faturando, setFaturando] = useState(false);

  // modal
  const [aberto, setAberto] = useState(false);
  // guarda contra perder o que foi digitado ao fechar sem salvar
  const form = useSujo(aberto);
  const [editId, setEditId] = useState<string | null>(null);
  const comoPagina = Boolean(soId);
  const [salvando, setSalvando] = useState(false);
  const [fNome, setFNome] = useState("");
  const [fCliente, setFCliente] = useState("");
  const [fCiclo, setFCiclo] = useState("mensal");
  const [fDia, setFDia] = useState("5");
  const [fInicio, setFInicio] = useState("");
  const [fFim, setFFim] = useState("");
  const [fCategoria, setFCategoria] = useState("");
  const [fConta, setFConta] = useState("");
  const [fStatus, setFStatus] = useState("ativo");
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
  const itensPorContrato = useMemo(() => {
    const m = new Map<string, Item[]>();
    itens.forEach((i) => {
      const arr = m.get(i.contrato_id) ?? [];
      arr.push(i);
      m.set(i.contrato_id, arr);
    });
    return m;
  }, [itens]);

  function totalContrato(id: string): number {
    return (itensPorContrato.get(id) ?? []).reduce((s, i) => s + i.quantidade * i.valor_unitario, 0);
  }

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return contratos;
    return contratos.filter(
      (c) =>
        (c.nome ?? "").toLowerCase().includes(q) ||
        (nomeCliente.get(c.cliente_fornecedor_id) ?? "").toLowerCase().includes(q),
    );
  }, [contratos, busca, nomeCliente]);

  /*
    Linha clicável e teclado — o contrato tem página própria (`/contratos/[id]`),
    e era alcançável só pelo ícone na ponta direita.
  */
  const nav = useListaNavegavel({
    itens: filtrados,
    abrir: (c) => router.push(`/contratos/${c.id}`),
    buscaRef,
    desligado: aberto,
  });

  // carrega quais contratos já foram faturados na competência escolhida
  useEffect(() => {
    if (!comp || contratos.length === 0) {
      setFaturados(new Set());
      return;
    }
    const supabase = createClient();
    supabase
      .from("contrato_faturamentos")
      .select("contrato_id")
      .eq("empresa_id", empresaId)
      .eq("competencia", comp + "-01")
      .then(({ data }) => setFaturados(new Set((data ?? []).map((r: { contrato_id: string }) => r.contrato_id))));
  }, [comp, empresaId, contratos.length]);

  const elegiveis = useMemo(
    () => contratos.filter((c) => compete(c, comp) && !faturados.has(c.id) && totalContrato(c.id) > 0.004),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contratos, comp, faturados, itens],
  );

  async function gerarFaturamentos() {
    if (elegiveis.length === 0) return;
    setFaturando(true);
    setMsg(null);
    const supabase = createClient();
    let ok = 0;
    let falhas = 0;
    /** algum rollback falhou: existe lançamento órfão que vai duplicar receita */
    let erroRollback = false;
    for (const c of elegiveis) {
      const linhas = itensPorContrato.get(c.id) ?? [];
      const total = linhas.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0);
      const cliente = nomeCliente.get(c.cliente_fornecedor_id) ?? "";
      const descricao = `Contrato${c.nome ? " " + c.nome : ""} — ${cliente} — ${mesBR(comp)}`;
      const ins = await supabase
        .from("lancamentos")
        .insert({
          empresa_id: empresaId,
          tipo: "entrada",
          valor: total,
          descricao,
          categoria_id: c.categoria_id,
          conta_id: c.conta_id,
          cliente_fornecedor_id: c.cliente_fornecedor_id,
          data_competencia: comp + "-01",
          data_vencimento: clampVenc(comp, c.dia_faturamento),
          conciliado: false,
        })
        .select("id")
        .single();
      if (ins.error || !ins.data) {
        falhas++;
        continue;
      }
      const fat = await supabase.from("contrato_faturamentos").insert({
        empresa_id: empresaId,
        contrato_id: c.id,
        competencia: comp + "-01",
        lancamento_id: ins.data.id,
        valor: total,
        nfse_status: c.gera_nfse ? "pendente" : null,
        boleto_status: c.gera_boleto ? "pendente" : null,
      });
      if (fat.error) {
        // corrida/duplicidade: desfaz o lançamento para não duplicar a receber
        /*
          Rollback silencioso deixa receita duplicada: o lançamento fica sem
          `contrato_faturamentos`, o contrato continua em `elegiveis` (o Set
          `faturados` vem justamente daquela tabela) e a próxima geração o
          fatura de novo.
        */
        const rb = await supabase.from("lancamentos").delete().eq("id", ins.data.id);
        if (rb.error) erroRollback = true;
        falhas++;
        continue;
      }
      ok++;
      setFaturados((prev) => new Set(prev).add(c.id));
    }
    setFaturando(false);
    setMsg({
      tipo: falhas > 0 ? "erro" : "ok",
      texto:
        `${ok} lançamento(s) a receber gerado(s) para ${mesBR(comp)}.` +
        (falhas > 0 ? ` ${falhas} falhou(aram) — tente de novo.` : "") +
        // "tente de novo" só é conselho seguro quando o desfazer funcionou
        (erroRollback
          ? " ATENÇÃO: um lançamento não pôde ser desfeito e ficou sem faturamento. Confira em Movimentações ANTES de gerar de novo, ou a receita entra em dobro."
          : ""),
    });
    router.refresh();
  }

  // Modo página: abre o contrato assim que ele chega.
  useEffect(() => {
    if (!soId) return;
    const c = contratos.find((x) => x.id === soId);
    if (c) abrirEditar(c);
    // só na montagem
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soId]);

  function abrirNovo() {
    setEditId(null);
    setFNome("");
    setFCliente("");
    setFCiclo("mensal");
    setFDia("5");
    setFInicio(new Date().toISOString().slice(0, 10));
    setFFim("");
    setFCategoria(categorias.length === 1 ? categorias[0].id : "");
    setFConta("");
    setFStatus("ativo");
    setFNfse(false);
    setFBoleto(false);
    setFObs("");
    setFItens([{ ...itemVazio }]);
    setMsgModal(null);
    setAberto(true);
  }
  function abrirEditar(c: Contrato) {
    setEditId(c.id);
    setFNome(c.nome ?? "");
    setFCliente(c.cliente_fornecedor_id);
    setFCiclo(c.ciclo);
    setFDia(String(c.dia_faturamento));
    setFInicio(c.data_inicio);
    setFFim(c.data_fim ?? "");
    setFCategoria(c.categoria_id ?? "");
    setFConta(c.conta_id ?? "");
    setFStatus(c.status);
    setFNfse(c.gera_nfse);
    setFBoleto(c.gera_boleto);
    setFObs(c.observacoes ?? "");
    const linhas = (itensPorContrato.get(c.id) ?? []).map((i) => ({
      servico_id: i.servico_id,
      descricao: i.descricao ?? "",
      quantidade: String(i.quantidade),
      valor_unitario: fmtValor(i.valor_unitario),
    }));
    setFItens(linhas.length > 0 ? linhas : [{ ...itemVazio }]);
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

  async function salvar() {
    if (!fCliente) {
      setMsgModal("Escolha o cliente do contrato.");
      return;
    }
    if (!fInicio) {
      setMsgModal("Informe a data de início.");
      return;
    }
    if (!fCategoria) {
      setMsgModal("Escolha a categoria de receita (necessária para o lançamento sair certo).");
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
    const payload = {
      empresa_id: empresaId,
      cliente_fornecedor_id: fCliente,
      nome: fNome.trim() || null,
      ciclo: fCiclo,
      dia_faturamento: Math.min(Math.max(1, Number(fDia) || 1), 31),
      data_inicio: fInicio,
      data_fim: fFim || null,
      categoria_id: fCategoria,
      conta_id: fConta || null,
      status: fStatus,
      gera_nfse: fNfse,
      gera_boleto: fBoleto,
      observacoes: fObs.trim() || null,
    };
    let contratoId = editId;
    if (editId) {
      const { error } = await supabase.from("contratos").update(payload).eq("id", editId);
      if (error) {
        setSalvando(false);
        setMsgModal(error.message);
        return;
      }
    } else {
      const { data, error } = await supabase.from("contratos").insert(payload).select("id").single();
      if (error || !data) {
        setSalvando(false);
        setMsgModal(error?.message ?? "Falha ao salvar o contrato.");
        return;
      }
      contratoId = data.id;
    }
    /*
      Substituir o conjunto de itens só é seguro se o delete tiver acontecido.

      O erro era descartado: se o delete falhava e o insert logo abaixo passava,
      o contrato ficava com **os itens em dobro** — e `totalContrato` dobra, e o
      faturamento do mês seguinte cobra o dobro do valor. Pior, o `setItens` no
      fim desta função filtra o contrato e injeta só os novos, então a tela
      **esconde a duplicação** até alguém recarregar a página.
    */
    /*
      Os itens de antes, lidos do banco — não do estado da tela, que pode estar
      velho — para poder voltar atrás.

      Delete e insert aqui são duas escritas sem transação. Consertar só o
      delete resolve metade: se o delete passa e o insert falha, o contrato fica
      com **zero itens**, e `elegiveis` exige `totalContrato > 0.004`. O contrato
      some do faturamento do mês sem aparecer em lista de erro nenhuma — o
      cliente simplesmente para de ser cobrado. É pior que a duplicação.
    */
    const COLS_ITEM = "id, empresa_id, contrato_id, servico_id, descricao, quantidade, valor_unitario";
    let anteriores: Record<string, unknown>[] = [];
    if (editId) {
      const ant = await supabase.from("contrato_itens").select(COLS_ITEM).eq("contrato_id", contratoId!);
      if (ant.error) {
        setSalvando(false);
        setMsgModal(
          `Não foi possível ler os serviços atuais do contrato (${ant.error.message}). Nada foi alterado nos itens — tente de novo.`,
        );
        return;
      }
      anteriores = (ant.data ?? []) as Record<string, unknown>[];
    }
    const delItens = await supabase.from("contrato_itens").delete().eq("contrato_id", contratoId!);
    if (delItens.error) {
      setSalvando(false);
      setMsgModal(
        `Não foi possível substituir os serviços do contrato (${delItens.error.message}). Nada foi alterado nos itens — tente de novo.`,
      );
      return;
    }
    const novos = linhas.map((r) => ({
      empresa_id: empresaId,
      contrato_id: contratoId!,
      servico_id: r.servico_id,
      descricao: r.descricao.trim() || null,
      quantidade: parseValor(r.quantidade) || 1,
      valor_unitario: parseValor(r.valor_unitario),
    }));
    const { data: insItens, error: errItens } = await supabase.from("contrato_itens").insert(novos).select();
    if (errItens) {
      // devolve os itens antigos com os mesmos ids: o contrato volta ao estado
      // de antes de salvar, e não para um contrato vazio que não fatura
      const volta = anteriores.length > 0 ? await supabase.from("contrato_itens").insert(anteriores) : null;
      setSalvando(false);
      if (volta && volta.error) {
        setMsgModal(
          `Não foi possível gravar os serviços (${errItens.message}) e também não deu para restaurar os anteriores (${volta.error.message}). ATENÇÃO: o contrato está SEM serviços e não vai entrar no faturamento do mês. Reabra e cadastre os serviços antes de faturar.`,
        );
        // no banco não sobrou item nenhum: a tela não pode seguir mostrando os
        // antigos, senão o contrato aparece como faturável e não é
        setItens((l) => l.filter((i) => i.contrato_id !== contratoId));
      } else if (anteriores.length > 0) {
        setMsgModal(`Não foi possível gravar os serviços (${errItens.message}). Os serviços anteriores foram mantidos — tente de novo.`);
      } else {
        setMsgModal(
          `Não foi possível gravar os serviços (${errItens.message}). O contrato ficou sem serviços e não entra no faturamento — reabra e cadastre os serviços.`,
        );
        setItens((l) => l.filter((i) => i.contrato_id !== contratoId));
      }
      /*
        O contrato em si JÁ foi gravado antes deste bloco (update ou insert).
        A lista precisa refletir isso em todos os ramos, senão o cabeçalho que
        o usuário acabou de mudar (status, ciclo, dia) continua aparecendo com
        o valor antigo enquanto o banco já tem o novo.
      */
      const gravado: Contrato = { id: contratoId!, ...payload, empresa_id: undefined } as unknown as Contrato;
      setContratos((l) =>
        editId ? l.map((c) => (c.id === editId ? { ...c, ...gravado, id: editId } : c)) : [{ ...gravado, id: contratoId! }, ...l],
      );
      /*
        E, no contrato novo, o formulário passa a EDITAR o que foi criado.

        Sem isto, o modal continua aberto com `editId` nulo: o clique óbvio em
        "Salvar de novo" cria um SEGUNDO contrato para o mesmo cliente, e o
        faturamento do mês cobra os dois.
      */
      if (!editId) setEditId(contratoId!);
      return;
    }
    setSalvando(false);
    // atualiza estado local
    const atualizado: Contrato = { id: contratoId!, ...payload, empresa_id: undefined } as unknown as Contrato;
    setContratos((l) =>
      editId ? l.map((c) => (c.id === editId ? { ...c, ...atualizado, id: editId } : c)) : [{ ...atualizado, id: contratoId! }, ...l],
    );
    setItens((l) => [...l.filter((i) => i.contrato_id !== contratoId), ...((insItens ?? []) as Item[])]);
    // Modo página: não há diálogo para fechar.
    if (comoPagina) {
      form.limpar();
      router.refresh();
      return;
    }
    setAberto(false);
    router.refresh();
  }

  async function excluir(c: Contrato) {
    const nome = c.nome || nomeCliente.get(c.cliente_fornecedor_id) || "contrato";
    if (!confirm(`Excluir o contrato "${nome}"? Os lançamentos já gerados continuam no financeiro.`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("contratos").delete().eq("id", c.id);
    if (error) {
      setMsg({ tipo: "erro", texto: error.message });
      return;
    }
    setContratos((l) => l.filter((x) => x.id !== c.id));
    setItens((l) => l.filter((i) => i.contrato_id !== c.id));
    router.refresh();
  }

  const inputCls = "w-full rounded-md border border-line px-2.5 py-1.5 text-[12.5px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";
  const labelCls = "mb-1 block text-xs font-semibold text-ink-muted";
  const ciclosLabel: Record<string, string> = { mensal: "mensal", trimestral: "trimestral", semestral: "semestral", anual: "anual" };

  // Mesmo corpo nas duas molduras (diálogo e página).
  const corpoFormulario = (
    <>
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
                  <label className={labelCls}>Nome do contrato (opcional)</label>
                  <input value={fNome} onChange={(e) => setFNome(e.target.value)} placeholder="ex.: Plano Completo" className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className={labelCls}>Ciclo</label>
                  <select value={fCiclo} onChange={(e) => setFCiclo(e.target.value)} className={inputCls}>
                    {CICLOS.map((o) => (
                      <option key={o.v} value={o.v}>
                        {o.l}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Dia do venc.</label>
                  <input type="number" min={1} max={31} value={fDia} onChange={(e) => setFDia(e.target.value)} className={`num ${inputCls}`} />
                </div>
                <div>
                  <label className={labelCls}>Início *</label>
                  <input type="date" value={fInicio} onChange={(e) => setFInicio(e.target.value)} className={`num ${inputCls}`} />
                </div>
                <div>
                  <label className={labelCls}>Fim (opcional)</label>
                  <input type="date" value={fFim} onChange={(e) => setFFim(e.target.value)} className={`num ${inputCls}`} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Categoria de receita *</label>
                  <ComboBusca
                    value={fCategoria}
                    onChange={setFCategoria}
                    options={categorias.map((c) => ({ id: c.id, nome: c.nome }))}
                    placeholder="Escolha…"
                  />
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

              {/* serviços do contrato */}
              <div className="rounded-lg border border-line p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-ink">Serviços do contrato</span>
                  <button
                    type="button"
                    onClick={() => setFItens((r) => [...r, { ...itemVazio }])}
                    className="text-xs font-semibold text-brand hover:underline"
                  >
                    + adicionar serviço
                  </button>
                </div>
                <div className="space-y-2">
                  {fItens.map((r, i) => (
                    <div key={i} className="space-y-2 rounded-lg border border-line/70 p-2">
                      <div className="flex items-center gap-2">
                        <select
                          value={r.servico_id}
                          onChange={(e) => escolherServico(i, e.target.value)}
                          className={`flex-1 ${inputCls}`}
                        >
                          <option value="">Serviço…</option>
                          {servicos
                            .filter((s) => s.ativo || s.id === r.servico_id)
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.nome}
                              </option>
                            ))}
                        </select>
                        <input
                          inputMode="decimal"
                          value={r.quantidade}
                          onChange={(e) => setItem(i, { quantidade: e.target.value })}
                          placeholder="qtd"
                          className={`num w-16 ${inputCls}`}
                        />
                        <input
                          inputMode="decimal"
                          value={r.valor_unitario}
                          onChange={(e) => setItem(i, { valor_unitario: e.target.value })}
                          placeholder="0,00"
                          className={`num w-28 ${inputCls}`}
                        />
                        {fItens.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setFItens((rows) => rows.filter((_, idx) => idx !== i))}
                            className="rounded-lg p-1.5 text-ink-soft transition hover:bg-surface"
                            aria-label="Remover serviço"
                          >
                            <X size={15} />
                          </button>
                        )}
                      </div>
                      <input
                        value={r.descricao}
                        onChange={(e) => setItem(i, { descricao: e.target.value })}
                        placeholder="descrição própria neste contrato (opcional)"
                        className={inputCls}
                      />
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-right text-sm font-bold text-ink">
                  Total por ciclo: <span className="num text-brand">{brl(totalForm)}</span>
                </p>
                {servicos.length === 0 && (
                  <p className="mt-1 text-[11px] text-danger">Cadastre os serviços na tela Serviços primeiro.</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Status</label>
                  <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className={inputCls}>
                    {STATUS.map((o) => (
                      <option key={o.v} value={o.v}>
                        {o.l}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col justify-end gap-1.5 pb-1">
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={fNfse}
                      onChange={(e) => setFNfse(e.target.checked)}
                      className="h-4 w-4 rounded border-line text-brand focus:ring-brand"
                    />
                    Emitir NFS-e ao faturar (fila de emissão)
                  </label>
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={fBoleto}
                      onChange={(e) => setFBoleto(e.target.checked)}
                      className="h-4 w-4 rounded border-line text-brand focus:ring-brand"
                    />
                    Gerar boleto ao faturar (fila de cobrança)
                  </label>
                </div>
              </div>

              <div>
                <label className={labelCls}>Observações</label>
                <textarea value={fObs} onChange={(e) => setFObs(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
              </div>

              {msgModal && <MessageStrip tipo="erro">{msgModal}</MessageStrip>}
                </>
  );

  if (comoPagina) {
    return (
      <div className="rounded-xl2 bg-white shadow-card" {...form.campos}>
        <div className="space-y-3 px-5 py-4">{corpoFormulario}</div>
        <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-4">
          <Link
            href="/contratos"
            className="rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink-muted transition hover:bg-surface"
          >
            Voltar à lista
          </Link>
          <Botao variante="primario"
            onClick={salvar}
            disabled={salvando}
          >
            {salvando ? "Salvando…" : "Salvar"}
          </Botao>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* gerador de faturamento */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl2 bg-white p-4 shadow-card">
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-brand" />
          <span className="text-sm font-bold text-ink">Faturamento da competência</span>
        </div>
        <input type="month" value={comp} onChange={(e) => setComp(e.target.value)} className={classeControle("md", false, "num")} />
        <span className="text-xs text-ink-muted">
          {elegiveis.length > 0
            ? `${elegiveis.length} contrato(s) a faturar · ${brl(elegiveis.reduce((s, c) => s + totalContrato(c.id), 0))}`
            : "Nenhum contrato pendente nesta competência."}
        </span>
        <Botao variante="primario" className="ml-auto"
          onClick={gerarFaturamentos}
          disabled={faturando || elegiveis.length === 0}
        >
          {faturando ? "Gerando…" : `Gerar ${elegiveis.length > 0 ? elegiveis.length + " " : ""}lançamento(s)`}
        </Botao>
        {msg && (
          <p className={`w-full text-xs font-semibold ${msg.tipo === "erro" ? "text-danger" : "text-brand"}`}>{msg.texto}</p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative max-w-xs flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input
            ref={buscaRef}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar contrato ou cliente…"
            className="w-full rounded-lg border border-line py-2 pl-9 pr-3 text-sm outline-none focus:border-brand"
          />
        </div>
        <Botao variante="primario"
          onClick={abrirNovo}
        >
          <Plus size={16} /> Novo contrato
        </Botao>
      </div>

      {contratos.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl2 border border-dashed border-line py-16 text-ink-soft">
          <FileSignature size={28} strokeWidth={1.5} />
          <EmptyState compacto titulo="Nenhum contrato ainda" descricao="O contrato gera o faturamento recorrente no contas a receber." />
          <button type="button" onClick={abrirNovo} className="mt-3 text-sm font-semibold text-brand hover:underline">
            Criar o primeiro
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl2 bg-white shadow-card">
          {filtrados.map((c) => {
            const linhas = itensPorContrato.get(c.id) ?? [];
            const total = totalContrato(c.id);
            const jaFaturado = faturados.has(c.id);
            const { onClick, emFoco, ...resto } = nav.propsLinha(c);
            return (
              <div
                key={c.id}
                {...resto}
                onClick={onClick}
                className={`flex cursor-pointer items-center gap-3 border-b border-line/60 px-4 py-3 last:border-0 ${
                  emFoco ? "ring-2 ring-inset ring-brand/40 hover:bg-surface/40" : "hover:bg-surface/40"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-ink">
                      {nomeCliente.get(c.cliente_fornecedor_id) ?? "Cliente"}
                    </span>
                    {c.nome && <span className="truncate text-xs text-ink-muted">· {c.nome}</span>}
                    {c.status !== "ativo" && (
                      <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-ink-soft">
                        {c.status}
                      </span>
                    )}
                    {jaFaturado && c.status === "ativo" && (
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-brand-light px-2 py-0.5 text-[10px] font-semibold text-brand-dark">
                        <CheckCircle2 size={11} /> faturado {mesBR(comp)}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-ink-soft">
                    <span>
                      {linhas.length} serviço(s) · {ciclosLabel[c.ciclo] ?? c.ciclo} · vence dia {c.dia_faturamento}
                    </span>
                    <span>
                      início {c.data_inicio.split("-").reverse().join("/")}
                      {c.data_fim ? ` · fim ${c.data_fim.split("-").reverse().join("/")}` : ""}
                    </span>
                  </div>
                </div>
                <span className="num shrink-0 text-sm font-semibold text-ink">
                  {brl(total)}
                  <span className="text-[11px] font-normal text-ink-soft">/{ciclosLabel[c.ciclo] === "mensal" ? "mês" : "ciclo"}</span>
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  <Link href={`/contratos/${c.id}`} className="rounded-lg p-1.5 text-ink-soft transition hover:bg-surface hover:text-brand" aria-label="Abrir contrato">
                    <Pencil size={15} />
                  </Link>
                  <button type="button" onClick={() => excluir(c)} className="rounded-lg p-1.5 text-ink-soft transition hover:bg-surface hover:text-danger" aria-label="Excluir">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
          {filtrados.length === 0 && <EmptyState compacto titulo="Nenhum contrato bate com a busca" />}
        </div>
      )}

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-rail/50 p-4 backdrop-blur-[1px]">
          <div className="my-8 w-full max-w-2xl rounded-xl2 bg-white shadow-xl" role="dialog" aria-modal="true" aria-labelledby="dlg-contrato-titulo" {...form.campos}>
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <h2 id="dlg-contrato-titulo" className="text-[13px] font-bold text-ink">{editId ? "Editar contrato" : "Novo contrato"}</h2>
              <button aria-label="Fechar" type="button" onClick={() => form.confirmar() && setAberto(false)} className="rounded-lg p-1 text-ink-soft hover:bg-surface">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 px-5 py-4">
              {corpoFormulario}
            </div>

            <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
              <button
                type="button"
                onClick={() => form.confirmar() && setAberto(false)}
                className="rounded-md border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-muted transition hover:bg-surface"
              >
                Cancelar
              </button>
              <Botao variante="primario"
                onClick={salvar}
                disabled={salvando}
              >
                {salvando ? "Salvando…" : "Salvar contrato"}
              </Botao>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

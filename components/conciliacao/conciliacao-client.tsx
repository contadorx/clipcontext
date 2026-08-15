"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { scoreAderencia, bandaDoScore, dentroDaTolerancia, similaridadeTexto } from "@/lib/conciliacao/aderencia";
import { carregarRegrasCombinadas } from "@/lib/conciliacao/regras-client";
import { useRouter } from "next/navigation";
import { UploadCloud, Link2, PlusCircle, SearchX, CheckCheck, Search, Sparkles, Filter, X, ArrowLeftRight, Trash2, Layers, ChevronDown, ChevronUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { SortToggle, ordenar, toggleOrd, type Ordenacao } from "@/components/ui/sort";
import ComboBusca from "@/components/conciliacao/combo-busca";
import MessageStrip, { Msg } from "@/components/ui/message-strip";
import { SkeletonLinhas } from "@/components/ui/skeleton";
import EmptyState from "@/components/ui/empty-state";
import ObjectStatus, { type Tom } from "@/components/ui/object-status";
import Card from "@/components/ui/card";
import PageHeader from "@/components/ui/page-header";
import { brl, dataBR } from "@/lib/formato";
import Botao from "@/components/ui/botao";
import { classeControle } from "@/components/ui/campo";

/**
 * Teto de cada fila da conciliação.
 *
 * As duas listas (transações do extrato × lançamentos em aberto) são cruzadas
 * uma contra a outra para pontuar aderência — o custo é o produto das duas. Sem
 * teto, uma conta com anos de pendência trava o navegador.
 */
const TETO_FILA = 1200;

type Conta = { id: string; nome: string };
type Transacao = {
  id: string;
  data: string;
  descricao: string | null;
  valor: number;
  fitid: string;
};
type TransacaoOutra = Transacao & { conta_id: string };
type Regra = { id: string; padrao: string; tipo: string; categoria_id: string; cliente_fornecedor_id: string | null; origem?: "empresa" | "escritorio" };
type EstornoCand = { id: string; valor: number; descricao: string | null; data_pagamento: string | null; categoria_id: string | null; cliente_fornecedor_id: string | null; categoria_nome: string | null; pessoa_nome: string | null };
type Lanc = {
  id: string;
  tipo: string;
  valor: number;
  descricao: string | null;
  data_vencimento: string;
  data_pagamento: string | null;
  /** conta antes da conciliação — precisa voltar se o link não gravar */
  conta_id: string | null;
  categoria_id: string | null;
  cliente_fornecedor_id: string | null;
  categoria_nome: string | null;
  pessoa_nome: string | null;
};
type AjusteTipo = "desconto" | "juros" | "tarifa" | "outro";
type RateioRow = { categoria_id: string; pessoa_id: string; valor: string; descricao: string };
type LinkRow = {
  empresa_id: string;
  conta_id: string;
  transacao_id: string;
  lancamento_id: string | null;
  evento_id: string | null;
  criado_aqui: boolean;
  prev_data_pagamento: string | null;
};
type ConcLinkRow = {
  transacao_id: string;
  lancamento_id: string | null;
  evento_id: string | null;
  criado_em: string;
  transacao: { data: string; descricao: string | null; valor: number } | null;
};
type ConcGrupo = {
  chave: string; // evento_id, ou transacao_id no legado 1×N
  evento_id: string | null;
  transacao_id: string; // âncora (1ª transação)
  data: string;
  descricao: string | null;
  valor: number; // soma das transações do grupo
  qtd: number; // nº de lançamentos
  qtdT: number; // nº de transações
  criado_em: string;
};
type Sugestao = {
  id: string;
  transacoes: Transacao[];
  lancamentos: Lanc[];
  tipo: "1xN" | "Mx1" | "1x1~";
  banda: "alta" | "media" | "baixa";
  diferenca?: number; // positivo = banco pagou a mais (juros/multa); negativo = a menos (desconto)
};

function pickNome(v: { nome: string } | { nome: string }[] | null | undefined): string | null {
  if (!v) return null;
  if (Array.isArray(v)) return v[0]?.nome ?? null;
  return v.nome ?? null;
}

function mapEstornoRows(data: unknown): EstornoCand[] {
  const rows = ((data ?? []) as unknown) as {
    id: string;
    valor: number;
    descricao: string | null;
    data_pagamento: string | null;
    categoria_id: string | null;
    cliente_fornecedor_id: string | null;
    categoria: { nome: string } | { nome: string }[] | null;
    pessoa: { nome: string } | { nome: string }[] | null;
  }[];
  return rows.map((r) => ({
    id: r.id,
    valor: r.valor,
    descricao: r.descricao,
    data_pagamento: r.data_pagamento,
    categoria_id: r.categoria_id,
    cliente_fornecedor_id: r.cliente_fornecedor_id,
    categoria_nome: pickNome(r.categoria),
    pessoa_nome: pickNome(r.pessoa),
  }));
}

function decodificar(buf: ArrayBuffer): string {
  const utf8 = new TextDecoder("utf-8").decode(buf);
  if (utf8.includes("\uFFFD")) {
    try {
      return new TextDecoder("windows-1252").decode(buf);
    } catch {
      return utf8;
    }
  }
  return utf8;
}
function parseValorBR(x: string): number {
  const s = (x || "").trim();
  if (!s) return 0;
  const n = s.includes(",") ? Number(s.replace(/\./g, "").replace(",", ".")) : Number(s);
  return isNaN(n) ? 0 : n;
}

function diffDias(a: string, b: string): number {
  return Math.round((Date.parse(a) - Date.parse(b)) / 86400000);
}

// ---------- OFX ----------
function tagOFX(bloco: string, nome: string): string {
  const m = bloco.match(new RegExp(`<${nome}>([^<\\r\\n]*)`, "i"));
  return m ? m[1].trim() : "";
}
function parseOFX(texto: string): Transacao[] {
  let blocos = Array.from(texto.matchAll(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi), (m) => m[1]);
  if (blocos.length === 0) {
    blocos = texto
      .split(/<STMTTRN>/i)
      .slice(1)
      .map((b) => b.split(/<\/STMTTRN>|<\/BANKTRANLIST>/i)[0]);
  }
  const out: Transacao[] = [];
  for (const b of blocos) {
    const dt = tagOFX(b, "DTPOSTED").replace(/[^0-9]/g, "").slice(0, 8);
    const amt = parseFloat(tagOFX(b, "TRNAMT").replace(",", "."));
    if (dt.length !== 8 || isNaN(amt)) continue;
    const data = `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}`;
    const nome = tagOFX(b, "NAME");
    const memo = tagOFX(b, "MEMO");
    const desc = [nome, memo].filter(Boolean).join(" · ");
    let fit = tagOFX(b, "FITID");
    if (!fit) fit = `ofx-${data}-${amt}-${desc}`.slice(0, 80);
    out.push({ id: "", data, valor: amt, descricao: desc || null, fitid: fit });
  }
  return out;
}

// ---------- CSV planilha ----------
function detectarDelim(linha: string): string {
  return (linha.match(/;/g) || []).length >= (linha.match(/,/g) || []).length ? ";" : ",";
}
function parseGrid(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  let f = "",
    row: string[] = [],
    q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          f += '"';
          i++;
        } else q = false;
      } else f += c;
    } else if (c === '"') q = true;
    else if (c === delim) {
      row.push(f);
      f = "";
    } else if (c === "\n") {
      row.push(f);
      rows.push(row);
      row = [];
      f = "";
    } else if (c !== "\r") f += c;
  }
  if (f || row.length) {
    row.push(f);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}
function norm(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}
function parseDataLivre(s: string): string | null {
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (!m) return null;
  let [, d, mo, y] = m;
  if (y.length === 2) y = "20" + y;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}
function parseValorSinal(s: string): number {
  let t = s.replace(/[^\d.,-]/g, "").trim();
  if (!t) return NaN;
  const neg = t.startsWith("-");
  t = t.replace(/-/g, "");
  if (t.includes(".") && t.includes(",")) {
    if (t.lastIndexOf(",") > t.lastIndexOf(".")) t = t.replace(/\./g, "").replace(",", ".");
    else t = t.replace(/,/g, "");
  } else if (t.includes(",")) t = t.replace(",", ".");
  const n = parseFloat(t);
  if (isNaN(n)) return NaN;
  return neg ? -n : n;
}
function gridParaTransacoes(grid: string[][], prefixo: string): Transacao[] {
  if (grid.length < 2) return [];
  const header = grid[0].map(norm);
  const iData = header.findIndex((h) => ["data", "data_lancamento", "dt"].includes(h));
  const iDesc = header.findIndex((h) => ["descricao", "historico", "memo", "lancamento"].includes(h));
  const iValor = header.findIndex((h) => ["valor", "value", "amount"].includes(h));
  if (iData < 0 || iValor < 0) return [];
  const out: Transacao[] = [];
  for (let i = 1; i < grid.length; i++) {
    const r = grid[i];
    const data = parseDataLivre(r[iData] ?? "");
    const valor = parseValorSinal(r[iValor] ?? "");
    if (!data || isNaN(valor)) continue;
    const desc = iDesc >= 0 ? (r[iDesc] ?? "").trim() : "";
    out.push({
      id: "",
      data,
      valor,
      descricao: desc || null,
      fitid: `${prefixo}-${data}-${valor}-${desc}`.slice(0, 80),
    });
  }
  return out;
}
function parseCSVExtrato(texto: string): Transacao[] {
  const primeira = texto.split("\n").find((l) => l.trim() !== "") ?? "";
  const delim = detectarDelim(primeira);
  return gridParaTransacoes(parseGrid(texto, delim), "csv");
}

// ---------- PDF (heurístico, aproximado) ----------
function parsePDFTexto(linhas: string[], anoPadrao: number): Transacao[] {
  const reData = /(\d{2})\/(\d{2})(?:\/(\d{2,4}))?/;
  const reValor = /-?\(?\s*R?\$?\s*\d{1,3}(?:\.\d{3})*,\d{2}\)?/g;
  const out: Transacao[] = [];
  for (const linha of linhas) {
    const md = linha.match(reData);
    if (!md) continue;
    const valores = linha.match(reValor);
    if (!valores || valores.length === 0) continue;
    const bruto = valores[valores.length - 1];
    let valor = parseValorSinal(bruto);
    if (isNaN(valor) || valor === 0) continue;
    const temD = /(\s|^)D(\s|$)/.test(linha) || bruto.includes("(") || bruto.trim().startsWith("-");
    const temC = /(\s|^)C(\s|$)/.test(linha);
    if (temD && !temC) valor = -Math.abs(valor);
    else if (temC) valor = Math.abs(valor);
    const d = md[1];
    const m = md[2];
    const y = md[3];
    const ano = y ? (y.length === 2 ? "20" + y : y) : String(anoPadrao);
    const data = `${ano}-${m}-${d}`;
    const desc = linha.replace(md[0], "").replace(bruto, "").replace(/\s+/g, " ").trim().slice(0, 80);
    out.push({
      id: "",
      data,
      valor,
      descricao: desc || null,
      fitid: `pdf-${data}-${valor}-${desc}`.slice(0, 80),
    });
  }
  return out;
}

/**
 * Desfaz lançamentos criados por uma conciliação que falhou no meio do caminho.
 *
 * Devolve `false` quando o banco recusou o apagamento. Isso importa: o
 * lançamento órfão já nasceu `conciliado = true` e com data de pagamento, então
 * ele está no resultado e no saldo, mas a transação do extrato continua na fila
 * — e os botões que chamam isto (aceite da IA, criar pela regra, transferência)
 * são exatamente os que a pessoa clica de novo sem pensar. Dizer "Nada foi
 * alterado" nessa hora é o que transforma um erro de gravação em receita
 * duplicada.
 */
async function apagarLancamentos(supabase: ReturnType<typeof createClient>, ids: string[]): Promise<boolean> {
  if (ids.length === 0) return true;
  const r = await supabase.from("lancamentos").delete().in("id", ids);
  return !r.error;
}

/** Mensagem de falha de conciliação, honesta sobre o que sobrou no banco. */
function textoFalhaConciliacao(motivo: string, limpou: boolean): string {
  return limpou
    ? `Não foi possível conciliar (${motivo}). Nada foi alterado — tente de novo.`
    : `Não foi possível conciliar (${motivo}) e o lançamento criado não pôde ser apagado. ATENÇÃO: confira em Movimentações antes de tentar de novo — repetir agora cria um lançamento em dobro.`;
}

export default function ConciliacaoClient({
  empresaId,
  empresaNome,
  contas,
}: {
  empresaId: string;
  empresaNome: string;
  contas: Conta[];
}) {
  const router = useRouter();
  const [contaId, setContaId] = useState(contas[0]?.id ?? "");
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  // Uma das filas bateu no teto: a tela precisa dizer, não fingir que é tudo.
  // São dois sinais separados porque cada um invalida um número diferente: o do
  // extrato invalida a soma a conciliar, o dos lançamentos invalida a contagem
  // de lançamentos em aberto. Um só faria a tela esconder o número certo.
  const [extratoNoTeto, setExtratoNoTeto] = useState(false);
  const [lancsNoTeto, setLancsNoTeto] = useState(false);
  const filaNoTeto = extratoNoTeto || lancsNoTeto;
  // as contagens só valem depois da carga: antes delas, 0 não é "tudo
  // conciliado", é "ainda não perguntei ao banco"
  const [contagensProntas, setContagensProntas] = useState(false);
  const [outrasTransacoes, setOutrasTransacoes] = useState<TransacaoOutra[]>([]);
  const [lancs, setLancs] = useState<Lanc[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [pdfLinhas, setPdfLinhas] = useState<string[] | null>(null);
  const [pdfAno, setPdfAno] = useState(new Date().getFullYear());
  const [pdfMarcados, setPdfMarcados] = useState<Set<number>>(new Set());
  const [categorias, setCategorias] = useState<{ id: string; nome: string; tipo: string }[]>([]);

  // quadro de match
  const [selTId, setSelTId] = useState<string | null>(null);
  const [selTsExtra, setSelTsExtra] = useState<Set<string>>(new Set()); // transações extras do evento M×N (além da âncora selTId)
  const [selLancs, setSelLancs] = useState<Set<string>>(new Set());
  const [sugDispensadas, setSugDispensadas] = useState<Set<string>>(new Set());
  const [sugAberto, setSugAberto] = useState(true);
  const [concCount, setConcCount] = useState(0); // total de transações já conciliadas na conta (p/ barra de progresso)
  const [pendCount, setPendCount] = useState(0); // total real de pendentes — a lista tem teto, a contagem não
  const [buscaLanc, setBuscaLanc] = useState("");
  // busca do lado do extrato: a tela nunca teve nenhuma. Com centenas de
  // pendentes, ordenar por data ou valor é tudo que havia para achar uma linha.
  const [buscaExtrato, setBuscaExtrato] = useState("");
  const [menuImportar, setMenuImportar] = useState(false);
  const buscaLancRef = useRef<HTMLInputElement | null>(null);
  // atalho: "/" foca a busca de lançamentos (ignora quando já digitando)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
      e.preventDefault();
      buscaLancRef.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // menu "outros formatos": fecha ao clicar fora e no Esc
  const menuImportarRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!menuImportar) return;
    function fora(e: MouseEvent) {
      if (!menuImportarRef.current?.contains(e.target as Node)) setMenuImportar(false);
    }
    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuImportar(false);
    }
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [menuImportar]);
  const [ajusteCategoria, setAjusteCategoria] = useState("");
  // categorias padrão para o lote de aproximadas (uma escolha vale para o lote)
  const [catAjusteReceber, setCatAjusteReceber] = useState("");
  const [catAjustePagar, setCatAjustePagar] = useState("");
  const [conciliandoMatch, setConciliandoMatch] = useState(false);
  const [conciliados, setConciliados] = useState<ConcGrupo[]>([]);
  const [ordT, setOrdT] = useState<Ordenacao>({ campo: "data", dir: "desc" });
  const [ordC, setOrdC] = useState<Ordenacao>({ campo: "data", dir: "desc" });
  const [pessoas, setPessoas] = useState<{ id: string; nome: string; tipo: string; cpf_cnpj: string | null }[]>([]);
  // filtros do painel de candidatos
  const [fCategoria, setFCategoria] = useState("");
  const [fPessoa, setFPessoa] = useState("");
  const [fDe, setFDe] = useState("");
  const [fAte, setFAte] = useState("");
  const [fValMin, setFValMin] = useState("");
  const [fValMax, setFValMax] = useState("");
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  // criar a partir do extrato
  const [criarAlvo, setCriarAlvo] = useState<Transacao | null>(null);
  const [cModo, setCModo] = useState<"lancamento" | "transferencia" | "estorno" | "rateio">("lancamento");
  const [cDescricao, setCDescricao] = useState("");
  const [cCategoria, setCCategoria] = useState("");
  const [cPessoa, setCPessoa] = useState("");
  const [cCompetencia, setCCompetencia] = useState("");
  const [cContraConta, setCContraConta] = useState("");
  // rateio: dividir uma linha do extrato em vários lançamentos
  const [rateioRows, setRateioRows] = useState<RateioRow[]>([{ categoria_id: "", pessoa_id: "", valor: "", descricao: "" }]);
  const [salvandoCriar, setSalvandoCriar] = useState(false);
  // regras de classificação (memorização)
  const [regras, setRegras] = useState<Regra[]>([]);
  const [escritorioId, setEscritorioId] = useState<string | null>(null);
  const [iaSug, setIaSug] = useState<Map<string, { categoria_id: string; cliente_fornecedor_id: string | null; confianca: number }>>(new Map());
  const [classificando, setClassificando] = useState(false);
  // extratos enviados pelo cliente no portal, aguardando importação
  const [extratosPortal, setExtratosPortal] = useState<
    { id: string; arquivo_nome: string; enviado_por_nome: string | null; criado_em: string }[]
  >([]);
  const [importandoPortal, setImportandoPortal] = useState<string | null>(null);
  const [regrasModal, setRegrasModal] = useState(false);
  const [nrPadrao, setNrPadrao] = useState("");
  const [nrTipo, setNrTipo] = useState<"entrada" | "saida">("saida");
  const [nrCategoria, setNrCategoria] = useState("");
  const [nrPessoa, setNrPessoa] = useState("");
  // estorno / devolução
  const [estornoCands, setEstornoCands] = useState<EstornoCand[]>([]);
  const [cEstornoOrig, setCEstornoOrig] = useState("");
  const [cEstornoBusca, setCEstornoBusca] = useState("");

  const carregar = useCallback(async () => {
    if (!contaId) return;
    setCarregando(true);
    setContagensProntas(false);
    setSelTId(null);
    setSelTsExtra(new Set());
    setSelLancs(new Set());
    // a busca do extrato é da conta que estava aberta; carregá-la na próxima
    // esconderia linhas da conta nova sem que ninguém tivesse digitado nada
    setBuscaExtrato("");
    const supabase = createClient();
    const [t, l, c, o, cc, pc] = await Promise.all([
      // Teto de TETO_FILA em cada lado. As duas listas são cruzadas uma contra a
      // outra para pontuar aderência, então o custo é o produto: 5.000 × 5.000 é
      // um travamento de navegador. As mais recentes são as que têm par; e
      // quando o teto é atingido, a tela diz (ver o aviso de fila cheia) em vez
      // de fingir que aquilo é tudo.
      supabase
        .from("transacoes_extrato")
        .select("id, data, descricao, valor, fitid")
        .eq("conta_id", contaId)
        .eq("conciliado", false)
        .order("data", { ascending: false })
        .limit(TETO_FILA),
      supabase
        .from("lancamentos")
        .select(
          "id, tipo, valor, descricao, data_vencimento, data_pagamento, conta_id, categoria_id, cliente_fornecedor_id, categoria:categorias(nome), pessoa:clientes_fornecedores(nome)",
        )
        .or(`conta_id.eq.${contaId},conta_id.is.null`)
        .eq("conciliado", false)
        .order("data_vencimento", { ascending: false })
        .limit(TETO_FILA),
      supabase
        .from("conciliacao_links")
        .select("transacao_id, lancamento_id, evento_id, criado_em, transacao:transacoes_extrato(data, descricao, valor)")
        .eq("conta_id", contaId)
        .order("criado_em", { ascending: false })
        .limit(240),
      supabase
        .from("transacoes_extrato")
        .select("id, conta_id, data, descricao, valor, fitid")
        .eq("empresa_id", empresaId)
        .eq("conciliado", false)
        .neq("conta_id", contaId)
        .order("data", { ascending: false })
        .limit(500),
      supabase
        .from("transacoes_extrato")
        .select("id", { count: "exact", head: true })
        .eq("conta_id", contaId)
        .eq("conciliado", true),
      // Pendentes vêm de uma contagem própria, e não de `transacoes.length`:
      // aquela lista tem teto, e usar o tamanho dela como denominador faria a
      // barra de progresso subir justamente nas contas mais atrasadas.
      supabase
        .from("transacoes_extrato")
        .select("id", { count: "exact", head: true })
        .eq("conta_id", contaId)
        .eq("conciliado", false),
    ]);
    setConcCount(cc.count ?? 0);
    setPendCount(pc.count ?? 0);
    setContagensProntas(true);
    setExtratoNoTeto((t.data?.length ?? 0) >= TETO_FILA);
    setLancsNoTeto((l.data?.length ?? 0) >= TETO_FILA);
    setTransacoes((t.data as Transacao[]) ?? []);
    setOutrasTransacoes((o.data as TransacaoOutra[]) ?? []);
    const lancRows = ((l.data ?? []) as unknown) as (Omit<Lanc, "categoria_nome" | "pessoa_nome"> & {
      categoria: { nome: string } | { nome: string }[] | null;
      pessoa: { nome: string } | { nome: string }[] | null;
    })[];
    setLancs(
      lancRows.map((r) => ({
        id: r.id,
        tipo: r.tipo,
        valor: r.valor,
        descricao: r.descricao,
        data_vencimento: r.data_vencimento,
        data_pagamento: r.data_pagamento,
        conta_id: r.conta_id ?? null,
        categoria_id: r.categoria_id ?? null,
        cliente_fornecedor_id: r.cliente_fornecedor_id ?? null,
        categoria_nome: pickNome(r.categoria),
        pessoa_nome: pickNome(r.pessoa),
      })),
    );
    const linksRows = ((c.data ?? []) as unknown) as ConcLinkRow[];
    type Acc = ConcGrupo & { _trans: Set<string>; _lancs: Set<string> };
    const grupos = new Map<string, Acc>();
    for (const r of linksRows) {
      if (!r.transacao) continue;
      const chave = r.evento_id ?? r.transacao_id;
      let g = grupos.get(chave);
      if (!g) {
        g = {
          chave,
          evento_id: r.evento_id,
          transacao_id: r.transacao_id,
          data: r.transacao.data,
          descricao: r.transacao.descricao,
          valor: 0,
          qtd: 0,
          qtdT: 0,
          criado_em: r.criado_em,
          _trans: new Set(),
          _lancs: new Set(),
        };
        grupos.set(chave, g);
      }
      if (!g._trans.has(r.transacao_id)) {
        g._trans.add(r.transacao_id);
        g.valor += Number(r.transacao.valor);
        g.qtdT += 1;
      }
      if (r.lancamento_id && !g._lancs.has(r.lancamento_id)) {
        g._lancs.add(r.lancamento_id);
        g.qtd += 1;
      }
    }
    setConciliados(
      Array.from(grupos.values()).map(({ _trans, _lancs, ...g }) => {
        void _trans;
        void _lancs;
        return g;
      }),
    );
    setCarregando(false);
  }, [contaId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (!empresaId) return;
    const supabase = createClient();
    supabase
      .from("categorias")
      .select("id, nome, tipo")
      .eq("empresa_id", empresaId)
      .order("nome")
      .then(({ data }) => setCategorias((data as { id: string; nome: string; tipo: string }[]) ?? []));
  }, [empresaId]);

  useEffect(() => {
    if (!empresaId) return;
    const supabase = createClient();
    supabase
      .from("clientes_fornecedores")
      .select("id, nome, tipo, cpf_cnpj")
      .eq("empresa_id", empresaId)
      .order("nome")
      .then(({ data }) => setPessoas((data as { id: string; nome: string; tipo: string; cpf_cnpj: string | null }[]) ?? []));
  }, [empresaId]);

  const carregarRegras = useCallback(async () => {
    if (!empresaId) return;
    const r = await carregarRegrasCombinadas(empresaId, categorias, pessoas);
    setRegras(r.combinadas);
    setEscritorioId(r.escritorioId);
  }, [empresaId, categorias, pessoas]);

  useEffect(() => {
    carregarRegras();
  }, [carregarRegras]);

  useEffect(() => {
    if (!criarAlvo) {
      setEstornoCands([]);
      return;
    }
    const t = criarAlvo;
    const oposto = t.valor >= 0 ? "saida" : "entrada";
    const supabase = createClient();
    supabase
      .from("lancamentos")
      .select(
        "id, valor, descricao, data_pagamento, categoria_id, cliente_fornecedor_id, categoria:categorias(nome), pessoa:clientes_fornecedores(nome)",
      )
      .eq("empresa_id", empresaId)
      .eq("tipo", oposto)
      .not("data_pagamento", "is", null)
      .order("data_pagamento", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        const rows = ((data ?? []) as unknown) as {
          id: string;
          valor: number;
          descricao: string | null;
          data_pagamento: string | null;
          categoria_id: string | null;
          cliente_fornecedor_id: string | null;
          categoria: { nome: string } | { nome: string }[] | null;
          pessoa: { nome: string } | { nome: string }[] | null;
        }[];
        const list: EstornoCand[] = rows.map((r) => ({
          id: r.id,
          valor: r.valor,
          descricao: r.descricao,
          data_pagamento: r.data_pagamento,
          categoria_id: r.categoria_id,
          cliente_fornecedor_id: r.cliente_fornecedor_id,
          categoria_nome: pickNome(r.categoria),
          pessoa_nome: pickNome(r.pessoa),
        }));
        setEstornoCands(list);
        const abs = Math.abs(t.valor);
        const best = list.find((r) => Math.abs(Number(r.valor) - abs) < 0.005);
        setCEstornoOrig(best?.id ?? "");
      });
  }, [criarAlvo, empresaId]);

  // busca no servidor: encontra originais antigos (além dos 100 recentes) por descrição
  // ou nome do fornecedor/cliente, conforme o usuário digita.
  useEffect(() => {
    if (!criarAlvo) return;
    const term = cEstornoBusca.trim();
    if (term.length < 2) return;
    const t = criarAlvo;
    const oposto = t.valor >= 0 ? "saida" : "entrada";
    const handle = setTimeout(async () => {
      const supabase = createClient();
      const sel =
        "id, valor, descricao, data_pagamento, categoria_id, cliente_fornecedor_id, categoria:categorias(nome), pessoa:clientes_fornecedores(nome)";
      const base = () =>
        supabase
          .from("lancamentos")
          .select(sel)
          .eq("empresa_id", empresaId)
          .eq("tipo", oposto)
          .not("data_pagamento", "is", null)
          .order("data_pagamento", { ascending: false })
          .limit(40);
      const pess = await supabase
        .from("clientes_fornecedores")
        .select("id")
        .eq("empresa_id", empresaId)
        .ilike("nome", `%${term}%`)
        .limit(20);
      const pids = (((pess.data ?? []) as unknown) as { id: string }[]).map((x) => x.id);
      const r1 = await base().ilike("descricao", `%${term}%`);
      const r2 = pids.length ? await base().in("cliente_fornecedor_id", pids) : { data: [] as unknown };
      const novos = [...mapEstornoRows(r1.data), ...mapEstornoRows((r2 as { data: unknown }).data)];
      if (novos.length === 0) return;
      setEstornoCands((prev) => {
        const byId = new Map(prev.map((c) => [c.id, c]));
        for (const c of novos) if (!byId.has(c.id)) byId.set(c.id, c);
        return Array.from(byId.values());
      });
    }, 300);
    return () => clearTimeout(handle);
  }, [cEstornoBusca, criarAlvo, empresaId]);

  useEffect(() => {
    if (!pdfLinhas) return;
    const n = parsePDFTexto(pdfLinhas, pdfAno).length;
    setPdfMarcados(new Set(Array.from({ length: n }, (_, i) => i)));
  }, [pdfLinhas, pdfAno]);

  // ---------- match helpers ----------
  const difValor = (a: number, b: number) => Math.abs(a - b);

  function tokens(str: string | null): string[] {
    return (str ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3);
  }

  // semelhança de texto: quanto do nome do lançamento/fornecedor aparece na descrição do banco
  function textoScore(t: Transacao, l: Lanc): number {
    const alvo = new Set(tokens(t.descricao));
    if (alvo.size === 0) return 0;
    const cand = tokens(`${l.descricao ?? ""} ${l.pessoa_nome ?? ""}`);
    if (cand.length === 0) return 0;
    let hit = 0;
    for (const w of cand) if (alvo.has(w)) hit++;
    return hit / cand.length;
  }

  // confiança 0..1 = valor (60%) + proximidade de data (25%) + texto/fornecedor (15%)
  function scoreLanc(t: Transacao, l: Lanc): number {
    const abs = Math.abs(t.valor);
    const dv = difValor(Number(l.valor), abs);
    const tol = Math.max(abs * 0.02, 5);
    const sv = dv < 0.005 ? 1 : dv >= tol ? 0 : 1 - dv / tol;
    const dd = Math.abs(diffDias(l.data_vencimento, t.data));
    const sd = Math.max(0, 1 - dd / 30);
    const st = textoScore(t, l);
    return sv * 0.6 + sd * 0.25 + st * 0.15;
  }

  function banda(score: number, exato: boolean): "alta" | "media" | "baixa" {
    if (exato || score >= 0.85) return "alta";
    if (score >= 0.55) return "media";
    return "baixa";
  }

  function statusDe(t: Transacao): "alta" | "media" | "baixa" | "sem" {
    const tipo = t.valor >= 0 ? "entrada" : "saida";
    const mesmos = lancs.filter((l) => l.tipo === tipo);
    if (mesmos.length === 0) return "sem";
    const abs = Math.abs(t.valor);
    let best = 0;
    let exato = false;
    for (const l of mesmos) {
      const s = scoreLanc(t, l);
      if (s > best) best = s;
      if (difValor(Number(l.valor), abs) < 0.005) exato = true;
    }
    if (exato || best >= 0.85) return "alta";
    if (best >= 0.55) return "media";
    if (best >= 0.35) return "baixa";
    return "sem";
  }

  function passaFiltros(l: Lanc): boolean {
    if (fCategoria && l.categoria_id !== fCategoria) return false;
    if (fPessoa && l.cliente_fornecedor_id !== fPessoa) return false;
    if (fDe && l.data_vencimento < fDe) return false;
    if (fAte && l.data_vencimento > fAte) return false;
    const v = Number(l.valor);
    if (fValMin && v < Number(fValMin.replace(",", "."))) return false;
    if (fValMax && v > Number(fValMax.replace(",", "."))) return false;
    return true;
  }

  /** casa com a busca livre do painel direito: descrição ou nome da pessoa */
  function passaBuscaLanc(l: Lanc): boolean {
    const b = buscaLanc.trim().toLowerCase();
    if (!b) return true;
    return (
      (l.descricao ?? "").toLowerCase().includes(b) || (l.pessoa_nome ?? "").toLowerCase().includes(b)
    );
  }

  function candidatosPara(t: Transacao, tipoForcado?: "entrada" | "saida"): Lanc[] {
    const tipo = tipoForcado ?? (t.valor >= 0 ? "entrada" : "saida");
    return lancs
      .filter((l) => l.tipo === tipo)
      .filter(passaBuscaLanc)
      .filter(passaFiltros)
      .sort((x, y) => scoreLanc(t, y) - scoreLanc(t, x));
  }

  /**
   * A lista quando nada está selecionado no extrato.
   *
   * Sem transação âncora não existe score de aderência nem sinal para filtrar
   * entrada × saída — então esta lista é **os dois tipos, por vencimento**, e
   * muda de critério assim que uma linha do extrato é escolhida. O painel
   * direito antes nascia como um retângulo de 270px dizendo "Nada selecionado",
   * e com ele nasciam mortas a busca, os seis filtros e o atalho "/" — todos
   * viviam dentro do ramo que só existia depois do clique.
   */
  function lancamentosEmAberto(): Lanc[] {
    return lancs
      .filter(passaBuscaLanc)
      .filter(passaFiltros)
      .slice()
      .sort((a, b) => (a.data_vencimento < b.data_vencimento ? -1 : a.data_vencimento > b.data_vencimento ? 1 : 0));
  }

  // palpite 1:N — subconjunto de k lançamentos cuja soma bate com o alvo
  function buscaSubset(pool: Lanc[], k: number, alvo: number): Lanc[] | null {
    const escolha: Lanc[] = [];
    const rec = (start: number, faltam: number, restante: number): boolean => {
      if (faltam === 0) return Math.abs(restante) < 0.01;
      for (let i = start; i <= pool.length - faltam; i++) {
        const v = Number(pool[i].valor);
        if (v > restante + 0.01) continue;
        escolha.push(pool[i]);
        if (rec(i + 1, faltam - 1, restante - v)) return true;
        escolha.pop();
      }
      return false;
    };
    return rec(0, k, alvo) ? [...escolha] : null;
  }

  // versão genérica do subset-sum (serve para lançamentos OU transações)
  function subsetSoma<T>(pool: T[], getVal: (x: T) => number, k: number, alvo: number): T[] | null {
    const escolha: T[] = [];
    const rec = (start: number, faltam: number, restante: number): boolean => {
      if (faltam === 0) return Math.abs(restante) < 0.01;
      for (let i = start; i <= pool.length - faltam; i++) {
        const v = getVal(pool[i]);
        if (v > restante + 0.01) continue;
        escolha.push(pool[i]);
        if (rec(i + 1, faltam - 1, restante - v)) return true;
        escolha.pop();
      }
      return false;
    };
    return rec(0, k, alvo) ? [...escolha] : null;
  }

  function acharCombo(t: Transacao): Lanc[] | null {
    const tipo = t.valor >= 0 ? "entrada" : "saida";
    const abs = Math.abs(t.valor);
    const pool = lancs
      .filter(
        (l) =>
          l.tipo === tipo &&
          Number(l.valor) <= abs + 0.005 &&
          Math.abs(diffDias(l.data_vencimento, t.data)) <= 20,
      )
      .sort((a, b) => Number(a.valor) - Number(b.valor))
      .slice(0, 14);
    for (let k = 2; k <= 4; k++) {
      const combo = buscaSubset(pool, k, abs);
      if (combo) return combo;
    }
    return null;
  }

  function selecionarT(t: Transacao) {
    setSelTId(t.id);
    setSelTsExtra(new Set());
    setAjusteCategoria("");
    // A busca e os seis filtros **não** são mais limpos aqui.
    //
    // Eles eram, e fazia sentido enquanto só existiam depois do clique: o clique
    // era o começo da conversa. Agora o painel nasce com eles ligados, então a
    // sequência natural passou a ser procurar o lançamento, achá-lo, e só então
    // marcar a transação à esquerda — e limpar aqui apagaria exatamente o que a
    // pessoa acabou de digitar para chegar até ali.
    const tipo = t.valor >= 0 ? "entrada" : "saida";
    const abs = Math.abs(t.valor);
    const exato = lancs
      .filter((l) => l.tipo === tipo && difValor(Number(l.valor), abs) < 0.005)
      // Consequência de manter os filtros: o par exato só entra marcado se
      // estiver visível. Marcar um lançamento escondido pelo filtro deixaria a
      // barra de rodapé somando uma linha que não está na lista e ninguém
      // conseguiria desmarcar.
      .filter((l) => passaBuscaLanc(l) && passaFiltros(l))
      .sort((a, b) => Math.abs(diffDias(a.data_vencimento, t.data)) - Math.abs(diffDias(b.data_vencimento, t.data)))[0];
    setSelLancs(exato ? new Set([exato.id]) : new Set());
  }

  function toggleLanc(id: string) {
    setSelLancs((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  // empilha/desempilha uma transação no evento M×N (não pode ser a âncora)
  function toggleTExtra(id: string) {
    if (id === selTId) return;
    setSelTsExtra((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  // Pares exatos (atribuição única) para a conciliação em massa.
  function montarPares(): { t: Transacao; lanc: Lanc }[] {
    const usados = new Set<string>();
    const ordenadas = [...transacoes].sort((a, b) => a.data.localeCompare(b.data));
    const pares: { t: Transacao; lanc: Lanc }[] = [];
    for (const t of ordenadas) {
      const tipo = t.valor >= 0 ? "entrada" : "saida";
      const abs = Math.abs(t.valor);
      const cands = lancs
        .filter((c) => c.tipo === tipo && difValor(Number(c.valor), abs) < 0.005 && !usados.has(c.id))
        .sort((a, b) => {
          // desempate inteligente: data próxima + aderência do texto/cliente
          const sa = scoreAderencia({
            valorTransacao: abs, valorLancamento: abs, diasDistancia: diffDias(a.data_vencimento, t.data),
            textoTransacao: t.descricao, textoLancamento: textoLanc(a),
          });
          const sb = scoreAderencia({
            valorTransacao: abs, valorLancamento: abs, diasDistancia: diffDias(b.data_vencimento, t.data),
            textoTransacao: t.descricao, textoLancamento: textoLanc(b),
          });
          return sb - sa;
        });
      if (cands[0]) {
        usados.add(cands[0].id);
        pares.push({ t, lanc: cands[0] });
      }
    }
    return pares;
  }
  const paresExatos = useMemo(() => montarPares(), [transacoes, lancs]); // eslint-disable-line react-hooks/exhaustive-deps
  const statusMap = useMemo(() => {
    const m = new Map<string, "alta" | "media" | "baixa" | "sem">();
    for (const t of transacoes) m.set(t.id, statusDe(t));
    return m;
  }, [transacoes, lancs]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- motor de sugestão de combinações (1×N e M×1) ----------
  function chaveSug(tids: string[], lids: string[]): string {
    return [...tids].sort().join("+") + "|" + [...lids].sort().join("+");
  }
  function textoLanc(l: Lanc): string {
    return `${l.descricao ?? ""} ${l.pessoa_nome ?? ""}`;
  }
  function bandaCombo(txs: Transacao[], lcs: Lanc[]): "alta" | "media" | "baixa" {
    // a soma já bate ao centavo; confiança = proximidade de datas + aderência de texto
    let piorDias = 0;
    let melhorSim = 0;
    for (const t of txs)
      for (const l of lcs) {
        piorDias = Math.max(piorDias, Math.abs(diffDias(l.data_vencimento, t.data)));
        melhorSim = Math.max(melhorSim, similaridadeTexto(t.descricao, textoLanc(l)));
      }
    const score = 45 + Math.round(30 * (1 - Math.min(piorDias, 25) / 25)) + Math.round(25 * melhorSim);
    return bandaDoScore(score);
  }
  const sugestoes = useMemo<Sugestao[]>(() => {
    if (transacoes.length === 0 || lancs.length === 0) return [];
    const usadasT = new Set<string>();
    const usadosL = new Set<string>();
    // reserva o que já casa 1×1 exato (resolve pelo "Conciliar exatos") para não roubar desses pares
    for (const { t, lanc } of paresExatos) {
      usadasT.add(t.id);
      usadosL.add(lanc.id);
    }
    const out: Sugestao[] = [];
    // 1×N — uma transação = soma de vários lançamentos
    for (const t of transacoes) {
      if (usadasT.has(t.id)) continue;
      const tipo = t.valor >= 0 ? "entrada" : "saida";
      const abs = Math.abs(t.valor);
      const pool = lancs
        .filter(
          (l) =>
            l.tipo === tipo &&
            !usadosL.has(l.id) &&
            Number(l.valor) <= abs + 0.005 &&
            Math.abs(diffDias(l.data_vencimento, t.data)) <= 25,
        )
        .sort((a, b) => Number(a.valor) - Number(b.valor))
        .slice(0, 14);
      let combo: Lanc[] | null = null;
      for (let k = 2; k <= 4; k++) {
        combo = subsetSoma(pool, (l) => Number(l.valor), k, abs);
        if (combo) break;
      }
      if (combo) {
        usadasT.add(t.id);
        combo.forEach((l) => usadosL.add(l.id));
        out.push({ id: chaveSug([t.id], combo.map((l) => l.id)), transacoes: [t], lancamentos: combo, tipo: "1xN", banda: bandaCombo([t], combo) });
      }
    }
    // M×1 — várias transações = um lançamento
    for (const l of lancs) {
      if (usadosL.has(l.id)) continue;
      const tipo = l.tipo;
      const abs = Number(l.valor);
      const pool = transacoes
        .filter(
          (t) =>
            !usadasT.has(t.id) &&
            (t.valor >= 0 ? "entrada" : "saida") === tipo &&
            Math.abs(t.valor) <= abs + 0.005 &&
            Math.abs(diffDias(l.data_vencimento, t.data)) <= 25,
        )
        .sort((a, b) => Math.abs(a.valor) - Math.abs(b.valor))
        .slice(0, 14);
      let combo: Transacao[] | null = null;
      for (let k = 2; k <= 4; k++) {
        combo = subsetSoma(pool, (t) => Math.abs(t.valor), k, abs);
        if (combo) break;
      }
      if (combo) {
        usadosL.add(l.id);
        combo.forEach((t) => usadasT.add(t.id));
        out.push({ id: chaveSug(combo.map((t) => t.id), [l.id]), transacoes: combo, lancamentos: [l], tipo: "Mx1", banda: bandaCombo(combo, [l]) });
      }
    }
    // 1×1 aproximado — valor quase igual (juros/multa pagos a mais, ou desconto):
    // o caso mais comum do dia a dia de cobrança. Exige aderência mínima.
    for (const t of transacoes) {
      if (usadasT.has(t.id)) continue;
      const tipo = t.valor >= 0 ? "entrada" : "saida";
      const abs = Math.abs(t.valor);
      let melhor: { l: Lanc; score: number } | null = null;
      for (const l of lancs) {
        if (usadosL.has(l.id) || l.tipo !== tipo) continue;
        if (!dentroDaTolerancia(abs, Number(l.valor))) continue;
        const dias = Math.abs(diffDias(l.data_vencimento, t.data));
        if (dias > 25) continue;
        const score = scoreAderencia({
          valorTransacao: abs,
          valorLancamento: Number(l.valor),
          diasDistancia: dias,
          textoTransacao: t.descricao,
          textoLancamento: textoLanc(l),
        });
        if (score >= 55 && (!melhor || score > melhor.score)) melhor = { l, score };
      }
      if (melhor) {
        usadasT.add(t.id);
        usadosL.add(melhor.l.id);
        out.push({
          id: chaveSug([t.id], [melhor.l.id]),
          transacoes: [t],
          lancamentos: [melhor.l],
          tipo: "1x1~",
          banda: bandaDoScore(melhor.score),
          diferenca: Math.round((abs - Number(melhor.l.valor)) * 100) / 100,
        });
      }
    }
    // mais confiáveis primeiro
    const rank = { alta: 0, media: 1, baixa: 2 };
    return out.sort((a, b) => rank[a.banda] - rank[b.banda]);
  }, [transacoes, lancs, paresExatos]); // eslint-disable-line react-hooks/exhaustive-deps
  const sugestoesVisiveis = sugestoes.filter((s) => !sugDispensadas.has(s.id));
  const sugAltaCount = sugestoesVisiveis.filter((s) => s.banda === "alta" && s.tipo !== "1x1~").length;
  // aproximadas de alta confiança: entram em lote com a categoria de ajuste escolhida uma vez
  const sugAprox = sugestoesVisiveis.filter((s) => s.banda === "alta" && s.tipo === "1x1~");

  // ---------- progresso do mês + filas (caixa de entrada) ----------
  const totalConta = pendCount + concCount;
  const pctConc = totalConta > 0 ? Math.round((concCount / totalConta) * 100) : 0;
  const valorPendente = transacoes.reduce((s, t) => s + Math.abs(Number(t.valor)), 0);
  /**
   * A busca do extrato filtra **só o que a lista mostra**, e não `transacoes`.
   *
   * Os pares exatos, as sugestões e o status de cada linha continuam sendo
   * calculados contra o extrato inteiro: esconder metade das transações não
   * pode mudar o que "Conciliar exatos (N)" faz nem rebaixar uma linha de
   * "Prontas" para "Sem par" porque o texto digitado não bateu.
   */
  const filas = useMemo(() => {
    const b = buscaExtrato.trim().toLowerCase();
    const visiveis = b
      ? transacoes.filter(
          (t) =>
            (t.descricao ?? "").toLowerCase().includes(b) ||
            // A âncora e as pernas empilhadas no evento M×N ficam sempre à
            // vista. Sem esta exceção, digitar na busca some com a linha que a
            // barra de rodapé está prometendo conciliar: o botão "Conciliar
            // evento" agiria sobre transações que ninguém está vendo, e as
            // pernas escondidas não teriam como ser desempilhadas — o "✓ evento"
            // só existe na linha renderizada.
            t.id === selTId ||
            selTsExtra.has(t.id),
        )
      : transacoes;
    const ord = ordenar(visiveis, ordT, { data: (t) => t.data, valor: (t) => Number(t.valor) });
    const prontos: Transacao[] = [];
    const revisar: Transacao[] = [];
    const semPar: Transacao[] = [];
    for (const t of ord) {
      const s = statusMap.get(t.id) ?? "sem";
      if (s === "alta") prontos.push(t);
      else if (s === "media" || s === "baixa") revisar.push(t);
      else semPar.push(t);
    }
    return { prontos, revisar, semPar, total: visiveis.length };
  }, [transacoes, ordT, statusMap, buscaExtrato, selTId, selTsExtra]);

  // perna oposta em OUTRA conta (mesmo valor, sinal contrário, data próxima) => provável transferência
  function parCruzado(t: Transacao): TransacaoOutra | null {
    const abs = Math.abs(t.valor);
    const cands = outrasTransacoes.filter(
      (o) =>
        Math.sign(o.valor) !== Math.sign(t.valor) &&
        difValor(Math.abs(o.valor), abs) < 0.005 &&
        Math.abs(diffDias(o.data, t.data)) <= 5,
    );
    cands.sort((a, b) => Math.abs(diffDias(a.data, t.data)) - Math.abs(diffDias(b.data, t.data)));
    return cands[0] ?? null;
  }
  const idsComPar = useMemo(() => {
    const set = new Set<string>();
    for (const t of transacoes) if (parCruzado(t)) set.add(t.id);
    return set;
  }, [transacoes, outrasTransacoes]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- regras de classificação (memorização) ----------
  function palavrasChave(s: string | null): string[] {
    return tokens(s).filter((w) => !/^\d+$/.test(w));
  }
  function assinatura(s: string | null): string {
    return palavrasChave(s).join(" ");
  }
  function matchRule(t: Transacao): Regra | null {
    const tipo = t.valor >= 0 ? "entrada" : "saida";
    const palavras = new Set(palavrasChave(t.descricao));
    if (palavras.size === 0) return null;
    let melhor: Regra | null = null;
    let melhorN = 0;
    for (const r of regras) {
      if (r.tipo !== tipo) continue;
      const rp = r.padrao.split(" ").filter(Boolean);
      if (rp.length === 0) continue;
      if (rp.every((w) => palavras.has(w)) && rp.length > melhorN) {
        melhor = r;
        melhorN = rp.length;
      }
    }
    return melhor;
  }
  const regrasMap = useMemo(() => {
    const m = new Map<string, Regra>();
    for (const t of transacoes) {
      const r = matchRule(t);
      if (r) m.set(t.id, r);
    }
    return m;
  }, [transacoes, regras]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- importação ----------
  const carregarExtratosPortal = useCallback(async () => {
    if (!empresaId) return;
    try {
      const r = await fetch(`/api/conciliacao/extratos-portal?empresaId=${empresaId}`);
      const j = await r.json();
      if (r.ok) setExtratosPortal(j.extratos ?? []);
    } catch {
      /* silencioso: a ponte é um plus, não pode quebrar a tela */
    }
  }, [empresaId]);

  useEffect(() => {
    carregarExtratosPortal();
  }, [carregarExtratosPortal]);

  async function importarExtratoPortal(doc: { id: string; arquivo_nome: string }) {
    if (!contaId) {
      setMsg({ tipo: "erro", texto: "Escolha a conta deste extrato antes de importar." });
      return;
    }
    setImportandoPortal(doc.id);
    setMsg(null);
    try {
      const r = await fetch("/api/conciliacao/extratos-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresaId, documentoId: doc.id }),
      });
      const j = await r.json();
      if (!r.ok) {
        setMsg({ tipo: "erro", texto: j.error ?? "Falha ao ler o extrato." });
        setImportandoPortal(null);
        return;
      }
      const buf = Uint8Array.from(atob(j.conteudo_b64), (c) => c.charCodeAt(0));
      const texto = decodificar(buf.buffer);
      const linhas = j.ext === "ofx" ? parseOFX(texto) : parseCSVExtrato(texto);
      if (linhas.length === 0) {
        setMsg({ tipo: "erro", texto: "Não reconheci transações neste extrato do cliente." });
        setImportandoPortal(null);
        return;
      }
      await importar(linhas);
      // sem a marca o extrato continua na fila do portal como se não tivesse
      // sido importado — e importar de novo é o convite óbvio da tela
      const supabase = createClient();
      const marca = await supabase
        .from("documentos_recebidos")
        .update({ extrato_importado: true, extrato_importado_em: new Date().toISOString() })
        .eq("id", doc.id);
      if (marca.error) {
        setMsg({
          tipo: "erro",
          texto: `O extrato foi importado, mas continua marcado como pendente no portal (${marca.error.message}). Não importe de novo antes de conferir as transações.`,
        });
      }
      await carregarExtratosPortal();
    } catch {
      setMsg({ tipo: "erro", texto: "Erro ao importar o extrato do portal." });
    }
    setImportandoPortal(null);
  }

  async function importar(linhas: Transacao[]) {
    if (!contaId) {
      setMsg({ tipo: "erro", texto: "Escolha uma conta primeiro." });
      return;
    }
    if (linhas.length === 0) {
      setMsg({ tipo: "erro", texto: "Nenhuma transação reconhecida no arquivo." });
      return;
    }
    const rows = linhas.map((l) => ({
      empresa_id: empresaId,
      conta_id: contaId,
      data: l.data,
      descricao: l.descricao,
      valor: l.valor,
      fitid: l.fitid,
      conciliado: false,
    }));
    const supabase = createClient();
    const { data, error } = await supabase
      .from("transacoes_extrato")
      .upsert(rows, { onConflict: "conta_id,fitid", ignoreDuplicates: true })
      .select("id");
    if (error) {
      setMsg({ tipo: "erro", texto: error.message });
      return;
    }
    const novas = data?.length ?? 0;
    const repetidas = rows.length - novas;
    setMsg({
      tipo: "ok",
      texto: `${novas} novas transações importadas${repetidas > 0 ? ` · ${repetidas} já existiam` : ""}.`,
    });
    await carregar();
  }

  async function lerArquivo(e: React.ChangeEvent<HTMLInputElement>, tipo: "ofx" | "csv" | "xlsx" | "pdf") {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setMsg(null);
    const buf = await file.arrayBuffer();

    if (tipo === "xlsx") {
      try {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const grid = (XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" }) as unknown[][]).map((row) =>
          row.map((c) => String(c ?? "")),
        );
        await importar(gridParaTransacoes(grid, "xlsx"));
      } catch {
        setMsg({ tipo: "erro", texto: "Não consegui ler o XLSX. Confira se tem colunas data e valor." });
      }
      return;
    }

    if (tipo === "pdf") {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pdfjs: any = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
        const doc = await pdfjs.getDocument({ data: buf }).promise;
        const linhas: string[] = [];
        for (let p = 1; p <= doc.numPages; p++) {
          const page = await doc.getPage(p);
          const tc = await page.getTextContent();
          const porY = new Map<number, { x: number; s: string }[]>();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for (const it of tc.items as any[]) {
            if (typeof it.str !== "string") continue;
            const y = Math.round(it.transform[5]);
            const arr = porY.get(y) ?? [];
            arr.push({ x: it.transform[4], s: it.str });
            porY.set(y, arr);
          }
          const ys = Array.from(porY.keys()).sort((a, b) => b - a);
          for (const y of ys) {
            const linha = porY
              .get(y)!
              .sort((a, b) => a.x - b.x)
              .map((o) => o.s)
              .join(" ")
              .replace(/\s+/g, " ")
              .trim();
            if (linha) linhas.push(linha);
          }
        }
        setPdfAno(new Date().getFullYear());
        setPdfLinhas(linhas);
        if (parsePDFTexto(linhas, new Date().getFullYear()).length === 0) {
          setMsg({ tipo: "erro", texto: "Não encontrei transações no PDF (pode ser um extrato escaneado/imagem)." });
        }
      } catch {
        setMsg({ tipo: "erro", texto: "Não consegui ler o PDF." });
      }
      return;
    }

    const texto = decodificar(buf);
    const linhas = tipo === "ofx" ? parseOFX(texto) : parseCSVExtrato(texto);
    await importar(linhas);
  }

  const pdfPendentes = pdfLinhas ? parsePDFTexto(pdfLinhas, pdfAno) : [];
  async function importarPDF() {
    const sel = pdfPendentes.filter((_, i) => pdfMarcados.has(i));
    if (sel.length === 0) {
      setMsg({ tipo: "erro", texto: "Selecione ao menos uma linha." });
      return;
    }
    setPdfLinhas(null);
    await importar(sel);
  }

  // ---------- conciliação ----------
  /**
   * Grava os vínculos da conciliação — e desfaz tudo se não conseguir.
   *
   * Este é o ponto mais perigoso da tela, e era o único sem verificação. A
   * sequência de toda conciliação é: marca o lançamento como conciliado, marca
   * a transação como conciliada, grava o link. As duas primeiras eram
   * verificadas; a terceira, não.
   *
   * O link não é registro acessório: **é a única fonte do card "Conciliados"**,
   * que por sua vez é o único lugar do produto com o botão Desfazer. Sem ele, o
   * lançamento e a transação ficam presos em `conciliado = true` — somem das
   * duas filas, não aparecem em nenhum grupo, e não existe caminho na interface
   * para trazê-los de volta. O dinheiro entra no resultado e fica lá.
   *
   * Por isso a falha aqui reverte os dois lados usando os próprios ids do link:
   * o item volta para a fila e a pessoa tenta de novo. Perder o trabalho de uma
   * conciliação é barato; perder a linha do extrato não é.
   */
  async function gravarLinks(
    supabase: ReturnType<typeof createClient>,
    /** `prev_conta_id` é só para a reversão — não é coluna da tabela */
    links: (LinkRow & { prev_conta_id?: string | null })[],
  ): Promise<string | null> {
    if (links.length === 0) return null;
    const paraGravar = links.map(({ prev_conta_id: _pc, ...resto }) => {
      void _pc;
      return resto;
    });
    const r = await supabase.from("conciliacao_links").insert(paraGravar);
    if (!r.error) return null;

    /*
      Só libera a transação que **este** conjunto de links estava criando.

      Reverter todas as `transacao_id` dos links era largo demais: no lote de
      aproximadas, o link do ajuste é gravado depois de a transação já ter sido
      conciliada e ligada pelo link principal. Falhando o do ajuste, a transação
      era marcada como não conciliada com o link principal ainda de pé — ela
      aparecia ao mesmo tempo na fila de pendentes e no card "Conciliados", e um
      segundo pareamento contaria o dinheiro duas vezes.
    */
    const transCandidatas = Array.from(new Set(links.map((l) => l.transacao_id).filter(Boolean)));
    const consulta = await supabase.from("conciliacao_links").select("transacao_id").in("transacao_id", transCandidatas);
    /*
      Esta leitura não pode falhar aberta.

      Com o erro descartado, `jaLigadas` virava vazio e `comOutroLink` também —
      ou seja, "nenhuma transação tem outro link", que é justamente a resposta
      que libera a reversão larga. No lote de aproximadas isso solta uma
      transação cujo link principal continua de pé, e ela passa a aparecer ao
      mesmo tempo na fila de pendentes e no card "Conciliados". Sem saber, o
      certo é não soltar nada.
    */
    const comOutroLink = new Set(
      (((consulta.data ?? []) as unknown) as { transacao_id: string }[]).map((x) => x.transacao_id),
    );
    /*
      Falha nesta leitura tira SÓ a parte que depende dela.

      A consulta serve para decidir quais transações podem ser soltas. Ela não
      diz nada sobre os lançamentos — e abortar a reversão inteira por causa
      dela (a primeira tentativa de conserto fez isso) é pior que o problema
      original: o lançamento fica `conciliado = true` sem link, fora das duas
      filas e sem Desfazer. Então: lançamento volta sempre; transação, só quando
      dá para saber que ela não tem outro link vivo.
    */
    const transIds = consulta.error ? [] : transCandidatas.filter((id) => !comOutroLink.has(id));
    let revertido = !consulta.error;
    if (transIds.length > 0) {
      const rt = await supabase
        .from("transacoes_extrato")
        .update({ conciliado: false, lancamento_id: null })
        .in("id", transIds);
      if (rt.error) revertido = false;
    }
    /*
      Os lançamentos criados aqui (`criado_aqui`) são apagados; os que já
      existiam voltam a `conciliado = false` com a data de pagamento anterior.
      Apagar um lançamento que a pessoa já tinha seria pior que o problema.
    */
    const criados = links.filter((l) => l.criado_aqui && l.lancamento_id).map((l) => l.lancamento_id as string);
    const preexistentes = links.filter((l) => !l.criado_aqui && l.lancamento_id);
    if (criados.length > 0) {
      const rc = await supabase.from("lancamentos").delete().in("id", criados);
      if (rc.error) revertido = false;
    }
    for (const l of preexistentes) {
      /*
        `conta_id` volta junto. A conciliação grava a conta do extrato no
        lançamento; sem devolver, um lançamento que estava sem conta (e por isso
        aparecia na fila de todas) fica preso na conta em que a tentativa
        falhou, e some da fila da conta certa para sempre.
      */
      const rl = await supabase
        .from("lancamentos")
        .update({
          conciliado: false,
          data_pagamento: l.prev_data_pagamento,
          ...(l.prev_conta_id !== undefined ? { conta_id: l.prev_conta_id } : {}),
        })
        .eq("id", l.lancamento_id as string);
      if (rl.error) revertido = false;
    }
    if (revertido) return `Não foi possível registrar a conciliação (${r.error.message}). Nada foi alterado — tente de novo.`;
    if (consulta.error)
      return `Não foi possível registrar a conciliação (${r.error.message}). Os lançamentos voltaram, mas a transação do extrato não pôde ser liberada com segurança (${consulta.error.message}) e continua marcada como conciliada. Recarregue a página e confira antes de repetir.`;
    return `Não foi possível registrar a conciliação (${r.error.message}) e a reversão também falhou. Recarregue a página e confira o lançamento antes de repetir.`;
  }

  async function conciliarUm(supabase: ReturnType<typeof createClient>, t: Transacao, lanc: Lanc) {
    const contaAntes = lanc.conta_id ?? null;
    const u1 = await supabase.from("lancamentos").update({ conciliado: true, data_pagamento: t.data, conta_id: contaId }).eq("id", lanc.id);
    if (u1.error) return u1.error.message;
    const u2 = await supabase
      .from("transacoes_extrato")
      .update({ conciliado: true, lancamento_id: lanc.id })
      .eq("id", t.id);
    if (u2.error) return u2.error.message;
    return await gravarLinks(supabase, [
      {
        empresa_id: empresaId,
        conta_id: contaId,
        transacao_id: t.id,
        lancamento_id: lanc.id,
        evento_id: null,
        criado_aqui: false,
        prev_data_pagamento: lanc.data_pagamento,
        prev_conta_id: contaAntes,
      },
    ]);
  }

  async function conciliarExatos() {
    if (paresExatos.length === 0) return;
    setProcessando(true);
    const supabase = createClient();
    let ok = 0;
    let falhas = 0;
    for (const { t, lanc } of paresExatos) {
      const erro = await conciliarUm(supabase, t, lanc);
      if (erro) falhas++;
      else ok++;
    }
    setProcessando(false);
    setMsg({ tipo: falhas ? "erro" : "ok", texto: `${ok} conciliadas${falhas ? ` · ${falhas} falharam` : ""}.` });
    await carregar();
    router.refresh();
  }

  // persiste um evento (1×N, M×1 ou M×N) de soma exata — usado pelo motor de sugestão
  async function persistirEvento(
    supabase: ReturnType<typeof createClient>,
    txs: Transacao[],
    lcs: Lanc[],
  ): Promise<string | null> {
    const eventoId = txs.length > 1 ? crypto.randomUUID() : null;
    const dataPg = txs[0].data;
    const u1 = await supabase
      .from("lancamentos")
      .update({ conciliado: true, data_pagamento: dataPg, conta_id: contaId })
      .in("id", lcs.map((l) => l.id));
    if (u1.error) return u1.error.message;
    const u2 = await supabase
      .from("transacoes_extrato")
      .update({ conciliado: true, lancamento_id: eventoId ? null : lcs[0]?.id ?? null })
      .in("id", txs.map((t) => t.id));
    if (u2.error) return u2.error.message;
    const ancora = txs[0].id;
    const links: (LinkRow & { prev_conta_id?: string | null })[] = lcs.map((l) => ({
      empresa_id: empresaId,
      conta_id: contaId,
      transacao_id: ancora,
      lancamento_id: l.id,
      evento_id: eventoId,
      criado_aqui: false,
      prev_data_pagamento: l.data_pagamento,
      prev_conta_id: l.conta_id ?? null,
    }));
    for (const tx of txs.slice(1)) {
      links.push({
        empresa_id: empresaId,
        conta_id: contaId,
        transacao_id: tx.id,
        lancamento_id: null,
        evento_id: eventoId,
        criado_aqui: false,
        prev_data_pagamento: null,
      });
    }
    /*
      Este é o caminho de "Aplicar sugestões" e das aproximadas em lote — o mais
      usado da tela, e o que ficou de fora quando `gravarLinks` foi criado.

      Aqui o erro do insert era lido, mas ninguém revertia: um link que falhasse
      no meio de um lote de doze deixava aquele lançamento e aquela transação
      presos em `conciliado = true`, sem grupo em "Conciliados" e sem Desfazer,
      enquanto a tela dizia apenas "11 conciliada(s) · 1 falharam". Ler o erro
      não é o mesmo que tratá-lo.
    */
    return await gravarLinks(supabase, links);
  }

  async function aplicarSugestoes(lista: Sugestao[]) {
    lista = lista.filter((s) => s.tipo !== "1x1~"); // aproximadas exigem revisão (categoria do ajuste)
    if (lista.length === 0) return;
    setProcessando(true);
    const supabase = createClient();
    let ok = 0;
    let falhas = 0;
    for (const s of lista) {
      const erro = await persistirEvento(supabase, s.transacoes, s.lancamentos);
      if (erro) falhas++;
      else ok++;
    }
    setProcessando(false);
    setMsg({
      tipo: falhas ? "erro" : "ok",
      texto: `${ok} sugestão(ões) conciliada(s)${falhas ? ` · ${falhas} falharam` : ""}.`,
    });
    await carregar();
    router.refresh();
  }

  /**
   * Conciliação em lote das 1×1 aproximadas de alta confiança.
   *
   * Eram justamente as que sobravam para revisão item a item: valor quase igual,
   * faltando só decidir onde entra a diferença (juros/multa ou desconto).
   * Aqui a categoria da diferença é escolhida uma vez e vale para o lote —
   * cada match continua gerando seu lançamento de ajuste, e o "Desfazer" da
   * transação segue funcionando porque o ajuste entra como criado_aqui.
   */
  function dadosAjusteDaSugestao(s: Sugestao) {
    const t = s.transacoes[0];
    const l = s.lancamentos[0];
    const abs = Math.abs(Number(t.valor));
    const val = Number(l.valor);
    const diff = Math.round((abs - val) * 100) / 100;
    const entradaT = Number(t.valor) >= 0;
    const ajusteEntrada = diff > 0 ? entradaT : !entradaT;
    const kind: AjusteTipo = diff > 0 ? "juros" : "desconto";
    return { t, l, diff, ajusteEntrada, kind };
  }

  async function aplicarAproximadas(lista: Sugestao[]) {
    const alvos = lista.filter((s) => s.tipo === "1x1~");
    if (alvos.length === 0) return;
    setProcessando(true);
    const supabase = createClient();
    let ok = 0;
    let falhas = 0;

    for (const s of alvos) {
      const { t, l, diff, ajusteEntrada, kind } = dadosAjusteDaSugestao(s);
      const erro = await persistirEvento(supabase, [t], [l]);
      if (erro) {
        falhas++;
        continue;
      }
      if (Math.abs(diff) >= 0.005) {
        const cat = ajusteEntrada ? catAjusteReceber : catAjustePagar;
        const ins = await supabase
          .from("lancamentos")
          .insert({
            empresa_id: empresaId,
            tipo: ajusteEntrada ? "entrada" : "saida",
            valor: Math.abs(diff),
            descricao: rotuloAjuste(kind, diff),
            conta_id: contaId,
            categoria_id: cat || null,
            pagamento_dados: { ajuste: kind },
            data_competencia: t.data,
            data_vencimento: t.data,
            data_pagamento: t.data,
            conciliado: true,
          })
          .select("id")
          .single();
        if (ins.error || !ins.data) {
          falhas++;
          continue;
        }
        /*
          Sem este link, o Desfazer do grupo **não apaga o ajuste**: o
          lançamento de juros ou desconto vira receita/despesa fantasma
          permanente, e nem aparece no grupo para alguém notar.
        */
        const eAjuste = await gravarLinks(supabase, [
          {
            empresa_id: empresaId,
            conta_id: contaId,
            transacao_id: t.id,
            lancamento_id: (ins.data as { id: string }).id,
            evento_id: null,
            criado_aqui: true,
            prev_data_pagamento: null,
          },
        ]);
        if (eAjuste) {
          falhas++;
          continue;
        }
      }
      ok++;
    }

    setProcessando(false);
    setMsg({
      tipo: falhas ? "erro" : "ok",
      texto: `${ok} aproximada(s) conciliada(s) com ajuste${falhas ? ` · ${falhas} falharam` : ""}.`,
    });
    await carregar();
    router.refresh();
  }

  // joga a sugestão no quadro de match para o usuário conferir antes de confirmar
  function revisarSugestao(s: Sugestao) {
    setSelTId(s.transacoes[0].id);
    setSelTsExtra(new Set(s.transacoes.slice(1).map((t) => t.id)));
    setSelLancs(new Set(s.lancamentos.map((l) => l.id)));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function dispensarSugestao(id: string) {
    setSugDispensadas((s) => new Set(s).add(id));
  }

  function addRateioRow() {
    const alvo = criarAlvo ? Math.abs(criarAlvo.valor) : 0;
    setRateioRows((rows) => {
      const soma = rows.reduce((s, r) => s + parseValorBR(r.valor), 0);
      const resta = Math.round((alvo - soma) * 100) / 100;
      return [...rows, { categoria_id: "", pessoa_id: "", valor: resta > 0 ? resta.toFixed(2).replace(".", ",") : "", descricao: "" }];
    });
  }
  function updateRateioRow(i: number, patch: Partial<RateioRow>) {
    setRateioRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function removeRateioRow(i: number) {
    setRateioRows((rows) => rows.filter((_, idx) => idx !== i));
  }

  async function salvarCriarRateio() {
    const t = criarAlvo;
    if (!t) return;
    const alvo = Math.abs(t.valor);
    const rows = rateioRows.map((r) => ({ ...r, v: parseValorBR(r.valor) }));
    if (rows.some((r) => !r.categoria_id || r.v <= 0)) {
      setMsg({ tipo: "erro", texto: "Cada item precisa de categoria e valor maior que zero." });
      return;
    }
    const soma = Math.round(rows.reduce((s, r) => s + r.v, 0) * 100) / 100;
    if (Math.abs(alvo - soma) >= 0.005) {
      setMsg({ tipo: "erro", texto: "A soma dos itens precisa fechar o total da linha." });
      return;
    }
    setSalvandoCriar(true);
    const supabase = createClient();
    const tipo = t.valor >= 0 ? "entrada" : "saida";
    const payload = rows.map((r) => ({
      empresa_id: empresaId,
      tipo,
      valor: r.v,
      descricao: r.descricao.trim() || null,
      categoria_id: r.categoria_id,
      cliente_fornecedor_id: r.pessoa_id || null,
      conta_id: contaId,
      data_competencia: t.data,
      data_vencimento: t.data,
      data_pagamento: t.data,
      conciliado: true,
    }));
    const ins = await supabase.from("lancamentos").insert(payload).select("id");
    if (ins.error || !ins.data) {
      setSalvandoCriar(false);
      setMsg({ tipo: "erro", texto: ins.error?.message ?? "Falha ao criar os lançamentos." });
      return;
    }
    const lancIds = (ins.data as { id: string }[]).map((x) => x.id);
    const u = await supabase
      .from("transacoes_extrato")
      .update({ conciliado: true, lancamento_id: lancIds[0] })
      .eq("id", t.id);
    if (u.error) {
      setSalvandoCriar(false);
      setMsg({ tipo: "erro", texto: u.error.message });
      return;
    }
    const eLink = await gravarLinks(
      supabase,
      lancIds.map((id) => ({
        empresa_id: empresaId,
        conta_id: contaId,
        transacao_id: t.id,
        lancamento_id: id,
        evento_id: null,
        criado_aqui: true,
        prev_data_pagamento: null,
      })),
    );
    if (eLink) {
      setSalvandoCriar(false);
      setMsg({ tipo: "erro", texto: eLink });
      return;
    }
    setSalvandoCriar(false);
    setCriarAlvo(null);
    setSelTId(null);
    setSelLancs(new Set());
    setMsg({ tipo: "ok", texto: `Linha dividida em ${lancIds.length} lançamento(s).` });
    await carregar();
    router.refresh();
  }

  function abrirCriar(t: Transacao) {
    setCriarAlvo(t);
    setCModo("lancamento");
    setCDescricao(t.descricao ?? "");
    const r = matchRule(t);
    setCCategoria(r?.categoria_id ?? "");
    setCPessoa(r?.cliente_fornecedor_id ?? "");
    setCCompetencia(t.data);
    setCContraConta(contas.find((c) => c.id !== contaId)?.id ?? "");
    setCEstornoBusca("");
    setRateioRows([{ categoria_id: "", pessoa_id: "", valor: "", descricao: "" }]);
  }

  async function salvarCriarLancamento() {
    const t = criarAlvo;
    if (!t) return;
    if (!cCategoria) {
      setMsg({ tipo: "erro", texto: "Escolha uma categoria." });
      return;
    }
    setSalvandoCriar(true);
    const supabase = createClient();
    const tipo = t.valor >= 0 ? "entrada" : "saida";
    const ins = await supabase
      .from("lancamentos")
      .insert({
        empresa_id: empresaId,
        tipo,
        valor: Math.abs(t.valor),
        descricao: cDescricao.trim() || t.descricao,
        categoria_id: cCategoria,
        cliente_fornecedor_id: cPessoa || null,
        conta_id: contaId,
        data_competencia: cCompetencia || t.data,
        data_vencimento: t.data,
        data_pagamento: t.data,
        conciliado: true,
      })
      .select("id")
      .single();
    if (ins.error || !ins.data) {
      setSalvandoCriar(false);
      setMsg({ tipo: "erro", texto: ins.error?.message ?? "Falha ao criar lançamento." });
      return;
    }
    const u = await supabase
      .from("transacoes_extrato")
      .update({ conciliado: true, lancamento_id: ins.data.id })
      .eq("id", t.id);
    if (u.error) {
      setSalvandoCriar(false);
      setMsg({ tipo: "erro", texto: u.error.message });
      return;
    }
    const eLink = await gravarLinks(supabase, [
      { empresa_id: empresaId, conta_id: contaId, transacao_id: t.id, lancamento_id: ins.data.id, evento_id: null, criado_aqui: true, prev_data_pagamento: null },
    ]);
    if (eLink) {
      setSalvandoCriar(false);
      setMsg({ tipo: "erro", texto: eLink });
      return;
    }
    setSalvandoCriar(false);
    setCriarAlvo(null);
    setSelTId(null);
    setSelLancs(new Set());
    await aprenderRegra(supabase, t.descricao, tipo, cCategoria, cPessoa || null);
    setMsg({ tipo: "ok", texto: "Lançamento criado e conciliado." });
    await carregar();
    await carregarRegras();
    router.refresh();
  }

  async function salvarCriarTransferencia() {
    const t = criarAlvo;
    if (!t) return;
    if (!cContraConta || cContraConta === contaId) {
      setMsg({ tipo: "erro", texto: "Escolha a outra conta da transferência." });
      return;
    }
    setSalvandoCriar(true);
    const supabase = createClient();
    const par =
      typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());
    const estaConta = contaId;
    const outra = cContraConta;
    const entrada = t.valor >= 0; // entrada nesta conta => o dinheiro chegou aqui (esta conta é o destino)
    const origem = entrada ? outra : estaConta;
    const destino = entrada ? estaConta : outra;
    const nomeEsta = contas.find((c) => c.id === estaConta)?.nome ?? "conta";
    const nomeOutra = contas.find((c) => c.id === outra)?.nome ?? "conta";
    const nomeDestino = entrada ? nomeEsta : nomeOutra;
    const nomeOrigem = entrada ? nomeOutra : nomeEsta;
    const base = {
      empresa_id: empresaId,
      categoria_id: null,
      valor: Math.abs(t.valor),
      data_competencia: t.data,
      data_vencimento: t.data,
      data_pagamento: t.data,
      transferencia: true,
      transferencia_par_id: par,
    };
    const ins = await supabase
      .from("lancamentos")
      .insert([
        {
          ...base,
          conta_id: origem,
          tipo: "saida",
          descricao: cDescricao.trim() || `Transferência para ${nomeDestino}`,
          conciliado: origem === estaConta,
        },
        {
          ...base,
          conta_id: destino,
          tipo: "entrada",
          descricao: cDescricao.trim() || `Transferência de ${nomeOrigem}`,
          conciliado: destino === estaConta,
        },
      ])
      .select("id, conta_id");
    if (ins.error || !ins.data) {
      setSalvandoCriar(false);
      setMsg({ tipo: "erro", texto: ins.error?.message ?? "Falha ao registrar transferência." });
      return;
    }
    const estaPerna = ins.data.find((r) => r.conta_id === estaConta) ?? ins.data[0];
    const u = await supabase
      .from("transacoes_extrato")
      .update({ conciliado: true, lancamento_id: estaPerna.id })
      .eq("id", t.id);
    if (u.error) {
      setSalvandoCriar(false);
      setMsg({ tipo: "erro", texto: u.error.message });
      return;
    }
    const eLink = await gravarLinks(supabase, [
      { empresa_id: empresaId, conta_id: contaId, transacao_id: t.id, lancamento_id: estaPerna.id, evento_id: null, criado_aqui: true, prev_data_pagamento: null },
    ]);
    if (eLink) {
      setSalvandoCriar(false);
      setMsg({ tipo: "erro", texto: eLink });
      return;
    }
    setSalvandoCriar(false);
    setCriarAlvo(null);
    setSelTId(null);
    setSelLancs(new Set());
    setMsg({
      tipo: "ok",
      texto: `Transferência registrada. A outra perna fica em aberto em ${nomeOutra} e concilia quando você importar o extrato dela.`,
    });
    await carregar();
    router.refresh();
  }

  /**
   * Libera lançamentos e transações de um conjunto de links — e só apaga os
   * links no fim, se tudo tiver dado certo.
   *
   * A ordem importa mais que a verificação. O código antigo revertia os
   * lançamentos, apagava os links e liberava as transações, sem checar nada — e
   * o link é a única coisa que faz o grupo aparecer em "Conciliados", que é o
   * único lugar com botão Desfazer. Apagar o link primeiro e falhar depois
   * significa perder a própria possibilidade de tentar de novo: o lançamento
   * fica `conciliado = true` sem grupo, invisível nas duas filas.
   *
   * Agora o link é a última coisa a sair. Uma falha no meio deixa o grupo
   * intacto na tela e um segundo clique em Desfazer refaz o caminho.
   */
  async function liberarConciliacao(
    supabase: ReturnType<typeof createClient>,
    links: { transacao_id?: string; lancamento_id: string | null; criado_aqui: boolean; prev_data_pagamento: string | null }[],
    transacaoIds: string[],
  ): Promise<string | null> {
    const lancLinks = links.filter((l): l is typeof l & { lancamento_id: string } => !!l.lancamento_id);
    const apagar = lancLinks.filter((l) => l.criado_aqui).map((l) => l.lancamento_id);
    const reverter = lancLinks.filter((l) => !l.criado_aqui);
    let feitos = 0;

    for (const l of reverter) {
      const r = await supabase
        .from("lancamentos")
        .update({ conciliado: false, data_pagamento: l.prev_data_pagamento ?? null })
        .eq("id", l.lancamento_id);
      /*
        "Nada foi desfeito" só é verdade na primeira volta. Depois disso, alguns
        lançamentos já voltaram para a fila enquanto o grupo continua em
        "Conciliados" — e daí dá para reconciliar um deles com outra transação e
        depois clicar Desfazer no grupo velho.
      */
      if (r.error)
        return feitos === 0
          ? `Não foi possível liberar um lançamento (${r.error.message}). Nada foi desfeito — tente de novo.`
          : `Parte da conciliação foi desfeita e parte não (${r.error.message}). O grupo continua na lista: clique em Desfazer de novo antes de reconciliar qualquer coisa.`;
      feitos++;
    }

    let legIds: string[] = [];
    if (apagar.length) {
      // pernas de transferência: achar o par e tratar as duas pontas (mesmo em outra conta)
      const { data: pares } = await supabase.from("lancamentos").select("id, transferencia_par_id").in("id", apagar);
      const parIds = (((pares ?? []) as unknown) as { id: string; transferencia_par_id: string | null }[])
        .map((r) => r.transferencia_par_id)
        .filter((v): v is string => !!v);
      legIds = [...apagar];
      if (parIds.length) {
        const { data: irmaos } = await supabase.from("lancamentos").select("id").in("transferencia_par_id", parIds);
        legIds = Array.from(new Set([...apagar, ...(((irmaos ?? []) as unknown) as { id: string }[]).map((r) => r.id)]));
      }
      // qualquer transação (em qualquer conta) apontando para essas pernas volta a ficar em aberto
      const rt = await supabase.from("transacoes_extrato").update({ conciliado: false, lancamento_id: null }).in("lancamento_id", legIds);
      if (rt.error)
        return `Não foi possível liberar as transações (${rt.error.message}). Parte pode ter sido desfeita — o grupo continua na lista, clique em Desfazer de novo.`;
    }

    if (transacaoIds.length) {
      const rt2 = await supabase
        .from("transacoes_extrato")
        .update({ conciliado: false, lancamento_id: null })
        .in("id", transacaoIds);
      if (rt2.error)
        return `Não foi possível liberar a transação (${rt2.error.message}). Parte pode ter sido desfeita — o grupo continua na lista, clique em Desfazer de novo.`;
    }

    /*
      Tenta apagar o lançamento antes do link — e recua se o banco não deixar.

      A regra desta função é que o link é a última coisa a sair: ele é a única
      fonte do card "Conciliados", que é o único lugar com botão Desfazer. Se o
      link sai primeiro e o `delete` de `lancamentos` falha depois (uma FK de
      documento ou de parcela de venda segurando), sobra um lançamento
      `criado_aqui` com `conciliado = true` e sem grupo: invisível nas duas
      filas, sem caminho de volta na interface.

      Só que a ordem inversa tem um risco próprio, e ele é pior: se
      `conciliacao_links.lancamento_id` tiver FK sem cascade, apagar o
      lançamento primeiro devolve 23503 SEMPRE, e o Desfazer fica impossível
      para todo grupo com lançamento criado aqui. O DDL desta tabela não está no
      repositório (`fx_zerar_empresa.sql` apaga os links antes justamente "para
      não travar as FKs abaixo"), então adivinhar seria apostar.

      Daí o recuo — mas só quando a FK que barrou é a DO PRÓPRIO LINK.

      Outras tabelas também apontam para `lancamentos` (documento anexado,
      parcela de venda, título de cobrança). Se uma delas é que está segurando,
      apagar o link não resolve nada e ainda destrói a única forma de tentar de
      novo: o segundo delete falha igual, e sobra lançamento órfão sem grupo. Por
      isso o recuo confere o nome da tabela na mensagem do Postgres, que traz a
      constraint e a tabela referenciadora.
    */
    if (legIds.length) {
      let rd = await supabase.from("lancamentos").delete().in("id", legIds);
      const fkDoLink =
        rd.error?.code === "23503" &&
        /conciliacao_links/.test(`${rd.error.message ?? ""} ${(rd.error as { details?: string }).details ?? ""}`);
      if (fkDoLink) {
        const rlAntes = await supabase.from("conciliacao_links").delete().in("lancamento_id", legIds);
        if (rlAntes.error)
          return `Não foi possível apagar o lançamento criado na conciliação (${rlAntes.error.message}). O grupo continua na lista — clique em Desfazer de novo.`;
        rd = await supabase.from("lancamentos").delete().in("id", legIds);
        if (rd.error)
          return `A conciliação foi liberada e o registro saiu, mas o lançamento criado aqui não foi apagado (${rd.error.message}). Confira em Movimentações e exclua à mão.`;
        return null;
      }
      if (rd.error)
        return `Não foi possível apagar o lançamento criado na conciliação (${rd.error.message}). O grupo continua na lista — clique em Desfazer de novo.`;
      const rl = await supabase.from("conciliacao_links").delete().in("lancamento_id", legIds);
      if (rl.error) return `A conciliação foi liberada, mas o registro não saiu (${rl.error.message}). Clique em Desfazer de novo.`;
    }
    return null;
  }

  async function desfazer(transacaoId: string) {
    setProcessando(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("conciliacao_links")
      .select("lancamento_id, criado_aqui, prev_data_pagamento")
      .eq("transacao_id", transacaoId);
    const links = ((data ?? []) as unknown) as {
      lancamento_id: string;
      criado_aqui: boolean;
      prev_data_pagamento: string | null;
    }[];
    const erro = await liberarConciliacao(supabase, links, [transacaoId]);
    if (erro) {
      setProcessando(false);
      setMsg({ tipo: "erro", texto: erro });
      await carregar();
      return;
    }
    const rl = await supabase.from("conciliacao_links").delete().eq("transacao_id", transacaoId);
    setProcessando(false);
    setMsg(
      rl.error
        ? { tipo: "erro", texto: `A conciliação foi desfeita, mas o registro continua na lista (${rl.error.message}). Recarregue a página.` }
        : { tipo: "ok", texto: "Conciliação desfeita — lançamentos voltaram para em aberto." },
    );
    await carregar();
    router.refresh();
  }

  // desfaz um evento M×N inteiro (todas as transações e lançamentos do evento)
  async function desfazerEvento(eventoId: string) {
    setProcessando(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("conciliacao_links")
      .select("transacao_id, lancamento_id, criado_aqui, prev_data_pagamento")
      .eq("evento_id", eventoId);
    const links = ((data ?? []) as unknown) as {
      transacao_id: string;
      lancamento_id: string | null;
      criado_aqui: boolean;
      prev_data_pagamento: string | null;
    }[];
    const transacaoIds = Array.from(new Set(links.map((l) => l.transacao_id)));
    const lancLinks = links.filter((l): l is typeof l & { lancamento_id: string } => !!l.lancamento_id);
    const erro = await liberarConciliacao(supabase, lancLinks, transacaoIds);
    if (erro) {
      setProcessando(false);
      setMsg({ tipo: "erro", texto: erro });
      await carregar();
      return;
    }
    const rl = await supabase.from("conciliacao_links").delete().eq("evento_id", eventoId);
    setProcessando(false);
    setMsg(
      rl.error
        ? { tipo: "erro", texto: `O evento foi desfeito, mas o registro continua na lista (${rl.error.message}). Recarregue a página.` }
        : { tipo: "ok", texto: "Evento desfeito — transações e lançamentos voltaram para em aberto." },
    );
    await carregar();
    router.refresh();
  }

  function desfazerGrupo(g: ConcGrupo) {
    if (g.evento_id) return desfazerEvento(g.evento_id);
    return desfazer(g.transacao_id);
  }

  async function conciliarTransfCruzada(a: Transacao, b: TransacaoOutra) {
    setProcessando(true);
    const supabase = createClient();
    const par =
      typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());
    const aNeg = a.valor < 0; // a saiu (origem) ou entrou (destino)?
    const negativa = aNeg ? { id: a.id, conta: contaId, data: a.data } : { id: b.id, conta: b.conta_id, data: b.data };
    const positiva = aNeg ? { id: b.id, conta: b.conta_id, data: b.data } : { id: a.id, conta: contaId, data: a.data };
    const valor = Math.abs(a.valor);
    const nomeOrigem = contas.find((c) => c.id === negativa.conta)?.nome ?? "conta";
    const nomeDestino = contas.find((c) => c.id === positiva.conta)?.nome ?? "conta";
    const base = {
      empresa_id: empresaId,
      categoria_id: null,
      valor,
      data_competencia: negativa.data,
      data_vencimento: negativa.data,
      transferencia: true,
      transferencia_par_id: par,
      conciliado: true,
    };
    const ins = await supabase
      .from("lancamentos")
      .insert([
        { ...base, conta_id: negativa.conta, tipo: "saida", descricao: `Transferência para ${nomeDestino}`, data_pagamento: negativa.data },
        { ...base, conta_id: positiva.conta, tipo: "entrada", descricao: `Transferência de ${nomeOrigem}`, data_pagamento: positiva.data },
      ])
      .select("id, conta_id");
    if (ins.error || !ins.data) {
      setProcessando(false);
      setMsg({ tipo: "erro", texto: ins.error?.message ?? "Falha ao registrar transferência." });
      return;
    }
    const pernaNeg = ins.data.find((r) => r.conta_id === negativa.conta) ?? ins.data[0];
    const pernaPos = ins.data.find((r) => r.conta_id === positiva.conta) ?? ins.data[1];
    /*
      As duas pernas precisam ser marcadas, ou nenhuma.

      Marcar só uma deixa **meia transferência conciliada**: o saldo de uma
      conta muda e o da outra não, e a perna que sobrou volta para a fila para
      ser conciliada contra outra coisa qualquer.
    */
    const m1 = await supabase.from("transacoes_extrato").update({ conciliado: true, lancamento_id: pernaNeg.id }).eq("id", negativa.id);
    const m2 = await supabase.from("transacoes_extrato").update({ conciliado: true, lancamento_id: pernaPos.id }).eq("id", positiva.id);
    if (m1.error || m2.error) {
      const motivo = (m1.error ?? m2.error)?.message ?? "erro desconhecido";
      /*
        A ordem importa: a transação é solta ANTES de o lançamento sair.

        Se o lançamento sumisse primeiro e a soltura falhasse, a transação
        ficaria `conciliado = true` apontando para um `lancamento_id` que não
        existe mais — fora das duas filas e sem Desfazer, porque o card
        "Conciliados" se apoia no link, que aqui ainda nem foi criado.
      */
      const rt = await supabase.from("transacoes_extrato").update({ conciliado: false, lancamento_id: null }).in("id", [negativa.id, positiva.id]);
      // se a soltura falhou, o lançamento NÃO pode sair: a transação ficaria
      // `conciliado = true` apontando para um id que não existe mais, fora das
      // duas filas e sem link, portanto sem Desfazer
      const limpou = !rt.error && (await apagarLancamentos(supabase, [pernaNeg.id, pernaPos.id]));
      setProcessando(false);
      setMsg({
        tipo: "erro",
        texto: limpou
          ? `Não foi possível conciliar as duas pontas (${motivo}). Nada foi alterado — tente de novo.`
          : `Não foi possível conciliar as duas pontas (${motivo}) e a reversão também falhou. ATENÇÃO: confira as duas contas em Movimentações antes de repetir — repetir agora lança a transferência em dobro.`,
      });
      if (!limpou) await carregar();
      return;
    }
    const eLink = await gravarLinks(supabase, [
      { empresa_id: empresaId, conta_id: negativa.conta, transacao_id: negativa.id, lancamento_id: pernaNeg.id, evento_id: null, criado_aqui: true, prev_data_pagamento: null },
      { empresa_id: empresaId, conta_id: positiva.conta, transacao_id: positiva.id, lancamento_id: pernaPos.id, evento_id: null, criado_aqui: true, prev_data_pagamento: null },
    ]);
    if (eLink) {
      setProcessando(false);
      setMsg({ tipo: "erro", texto: eLink });
      return;
    }
    setProcessando(false);
    setSelTId(null);
    setSelLancs(new Set());
    setMsg({ tipo: "ok", texto: `Transferência entre ${nomeOrigem} e ${nomeDestino} conciliada nas duas contas.` });
    await carregar();
    router.refresh();
  }

  async function aprenderRegra(
    supabase: ReturnType<typeof createClient>,
    descricao: string | null,
    tipo: string,
    categoriaId: string,
    pessoaId: string | null,
  ) {
    if (!categoriaId) return;
    const padrao = assinatura(descricao);
    if (!padrao) return;
    await supabase.from("conciliacao_regras").upsert(
      {
        empresa_id: empresaId,
        padrao,
        tipo,
        categoria_id: categoriaId,
        cliente_fornecedor_id: pessoaId || null,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "empresa_id,padrao,tipo" },
    );
  }

  async function classificarComIA() {
    // Transações sem par e sem regra — o que sobrou pra decisão humana.
    //
    // Sai de `transacoes`, e não de `filas.semPar`: a fila passou a ser
    // filtrada pela busca do extrato, e uma ação em lote que muda de tamanho
    // conforme o texto digitado no campo ao lado não tem como ser entendida —
    // "Classificar com IA" classificaria 6 em vez de 60 sem dizer nada.
    const alvo = transacoes
      .filter((t) => (statusMap.get(t.id) ?? "sem") === "sem")
      .filter((t) => !regrasMap.has(t.id) && !iaSug.has(t.id))
      .slice(0, 60);
    if (alvo.length === 0) {
      setMsg({ tipo: "ok", texto: "Nada para classificar: tudo já tem par, regra ou sugestão." });
      return;
    }
    setClassificando(true);
    setMsg(null);
    const resp = await fetch("/api/ia/classificar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        empresaId,
        itens: alvo.map((t) => ({ id: t.id, descricao: t.descricao, tipo: t.valor >= 0 ? "entrada" : "saida" })),
      }),
    });
    const j = (await resp.json().catch(() => ({}))) as {
      sugestoes?: { id: string; categoria_id: string | null; cliente_fornecedor_id: string | null; confianca: number }[];
      error?: string;
    };
    setClassificando(false);
    if (!resp.ok && !j.sugestoes?.length) {
      setMsg({ tipo: "erro", texto: j.error ?? "Falha na classificação." });
      return;
    }
    const m = new Map(iaSug);
    for (const s of j.sugestoes ?? []) {
      if (s.categoria_id) m.set(s.id, { categoria_id: s.categoria_id, cliente_fornecedor_id: s.cliente_fornecedor_id, confianca: s.confianca });
    }
    setIaSug(m);
    const n = (j.sugestoes ?? []).length;
    setMsg({
      tipo: "ok",
      texto: n > 0 ? `${n} sugestão(ões) da IA — confira na linha de cada transação.` : "A IA não teve confiança suficiente para sugerir nada aqui.",
    });
  }

  async function criarPelaIA(t: Transacao) {
    const s = iaSug.get(t.id);
    if (!s) return;
    setProcessando(true);
    const supabase = createClient();
    const tipo = t.valor >= 0 ? "entrada" : "saida";
    const ins = await supabase
      .from("lancamentos")
      .insert({
        empresa_id: empresaId,
        tipo,
        valor: Math.abs(t.valor),
        descricao: t.descricao,
        categoria_id: s.categoria_id,
        cliente_fornecedor_id: s.cliente_fornecedor_id,
        conta_id: contaId,
        data_competencia: t.data,
        data_vencimento: t.data,
        data_pagamento: t.data,
        conciliado: true,
      })
      .select("id")
      .single();
    if (ins.error || !ins.data) {
      setProcessando(false);
      setMsg({ tipo: "erro", texto: ins.error?.message ?? "Falha ao criar pela sugestão." });
      return;
    }
    /*
      O lançamento já existe quando esta linha roda. Se a transação não for
      marcada, ela continua em "sem par" — e o aceite da IA é um botão que a
      pessoa clica de novo sem pensar duas vezes, criando **um segundo
      lançamento com o mesmo valor**.
    */
    const mt = await supabase.from("transacoes_extrato").update({ conciliado: true, lancamento_id: ins.data.id }).eq("id", t.id);
    if (mt.error) {
      const limpou = await apagarLancamentos(supabase, [ins.data.id]);
      setProcessando(false);
      setMsg({ tipo: "erro", texto: textoFalhaConciliacao(mt.error.message, limpou) });
      if (!limpou) await carregar();
      return;
    }
    const eLink = await gravarLinks(supabase, [
      { empresa_id: empresaId, conta_id: contaId, transacao_id: t.id, lancamento_id: ins.data.id, evento_id: null, criado_aqui: true, prev_data_pagamento: null },
    ]);
    if (eLink) {
      setProcessando(false);
      setMsg({ tipo: "erro", texto: eLink });
      return;
    }
    // o aceite vira regra determinística: da próxima vez nem precisa de IA
    await aprenderRegra(supabase, t.descricao, tipo, s.categoria_id, s.cliente_fornecedor_id);
    setIaSug((m) => {
      const n = new Map(m);
      n.delete(t.id);
      return n;
    });
    setProcessando(false);
    setMsg({ tipo: "ok", texto: "Conciliado pela sugestão da IA — e a regra foi aprendida." });
    await Promise.all([carregar(), carregarRegras()]);
    router.refresh();
  }

  function dispensarIA(id: string) {
    setIaSug((m) => {
      const n = new Map(m);
      n.delete(id);
      return n;
    });
  }

  async function criarPelaRegra(t: Transacao, regra: Regra) {
    setProcessando(true);
    const supabase = createClient();
    const tipo = t.valor >= 0 ? "entrada" : "saida";
    const ins = await supabase
      .from("lancamentos")
      .insert({
        empresa_id: empresaId,
        tipo,
        valor: Math.abs(t.valor),
        descricao: t.descricao,
        categoria_id: regra.categoria_id,
        cliente_fornecedor_id: regra.cliente_fornecedor_id,
        conta_id: contaId,
        data_competencia: t.data,
        data_vencimento: t.data,
        data_pagamento: t.data,
        conciliado: true,
      })
      .select("id")
      .single();
    if (ins.error || !ins.data) {
      setProcessando(false);
      setMsg({ tipo: "erro", texto: ins.error?.message ?? "Falha ao criar pela regra." });
      return;
    }
    // mesma armadilha do aceite da IA: a regra dispara sozinha na fila, então o
    // duplo clique é o comportamento esperado do usuário
    const mt = await supabase.from("transacoes_extrato").update({ conciliado: true, lancamento_id: ins.data.id }).eq("id", t.id);
    if (mt.error) {
      const limpou = await apagarLancamentos(supabase, [ins.data.id]);
      setProcessando(false);
      setMsg({ tipo: "erro", texto: textoFalhaConciliacao(mt.error.message, limpou) });
      if (!limpou) await carregar();
      return;
    }
    const eLink = await gravarLinks(supabase, [
      { empresa_id: empresaId, conta_id: contaId, transacao_id: t.id, lancamento_id: ins.data.id, evento_id: null, criado_aqui: true, prev_data_pagamento: null },
    ]);
    if (eLink) {
      setProcessando(false);
      setMsg({ tipo: "erro", texto: eLink });
      return;
    }
    setProcessando(false);
    setSelTId(null);
    setSelLancs(new Set());
    setMsg({ tipo: "ok", texto: "Lançamento criado pela regra e conciliado." });
    await carregar();
    router.refresh();
  }

  async function promoverRegra(r: Regra) {
    if (!escritorioId) return;
    const catNome = categorias.find((c) => c.id === r.categoria_id)?.nome;
    if (!catNome) return;
    const pesNome = r.cliente_fornecedor_id
      ? (pessoas.find((p) => p.id === r.cliente_fornecedor_id)?.nome ?? null)
      : null;
    const supabase = createClient();
    const { error } = await supabase.from("regras_escritorio").upsert(
      {
        escritorio_id: escritorioId,
        padrao: r.padrao,
        tipo: r.tipo,
        categoria_nome: catNome,
        pessoa_nome: pesNome,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "escritorio_id,padrao,tipo" },
    );
    if (error) {
      setMsg({ tipo: "erro", texto: "Não foi possível promover (rode fs_regras_escritorio.sql)." });
      return;
    }
    setMsg({ tipo: "ok", texto: `Regra "${r.padrao}" agora vale para todas as empresas do escritório.` });
    await carregarRegras();
  }

  /*
    Excluir regra que não exclui é confuso de um jeito específico: a regra some
    da lista (o `carregarRegras` recarrega do banco, mas a tela já rolou) e
    continua classificando transações sozinha na próxima importação. A pessoa
    procura de onde vem a categoria errada e não acha, porque acabou de apagar.
  */
  async function excluirRegraGlobal(id: string) {
    const supabase = createClient();
    const r = await supabase.from("regras_escritorio").delete().eq("id", id);
    if (r.error) setMsg({ tipo: "erro", texto: `Não foi possível excluir a regra do escritório (${r.error.message}).` });
    await carregarRegras();
  }

  async function excluirRegra(id: string) {
    const supabase = createClient();
    const r = await supabase.from("conciliacao_regras").delete().eq("id", id);
    if (r.error) setMsg({ tipo: "erro", texto: `Não foi possível excluir a regra (${r.error.message}).` });
    await carregarRegras();
  }

  async function salvarRegraManual() {
    if (!nrPadrao.trim() || !nrCategoria) {
      setMsg({ tipo: "erro", texto: "Informe o texto e a categoria da regra." });
      return;
    }
    const padrao = assinatura(nrPadrao);
    if (!padrao) {
      setMsg({ tipo: "erro", texto: "O texto da regra precisa ter ao menos uma palavra." });
      return;
    }
    const supabase = createClient();
    // esta é a criação explícita de regra pelo usuário, não o aprendizado
    // automático: dizer "Regra salva." e não ter salvo nada é mentira direta
    const rNova = await supabase.from("conciliacao_regras").upsert(
      {
        empresa_id: empresaId,
        padrao,
        tipo: nrTipo,
        categoria_id: nrCategoria,
        cliente_fornecedor_id: nrPessoa || null,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "empresa_id,padrao,tipo" },
    );
    if (rNova.error) {
      setMsg({ tipo: "erro", texto: `Não foi possível salvar a regra (${rNova.error.message}).` });
      return;
    }
    setNrPadrao("");
    setNrCategoria("");
    setNrPessoa("");
    await carregarRegras();
    setMsg({ tipo: "ok", texto: "Regra salva." });
  }

  async function salvarCriarEstorno() {
    const t = criarAlvo;
    if (!t) return;
    const orig = estornoCands.find((e) => e.id === cEstornoOrig);
    if (!orig) {
      setMsg({ tipo: "erro", texto: "Escolha o lançamento original que está sendo estornado." });
      return;
    }
    setSalvandoCriar(true);
    const supabase = createClient();
    const tipo = t.valor >= 0 ? "entrada" : "saida";
    const ins = await supabase
      .from("lancamentos")
      .insert({
        empresa_id: empresaId,
        tipo,
        valor: Math.abs(t.valor),
        descricao: cDescricao.trim() || `Estorno: ${orig.descricao ?? "lançamento"}`,
        categoria_id: orig.categoria_id,
        cliente_fornecedor_id: orig.cliente_fornecedor_id,
        conta_id: contaId,
        data_competencia: t.data,
        data_vencimento: t.data,
        data_pagamento: t.data,
        conciliado: true,
        pagamento_dados: { estorno_de: orig.id },
      })
      .select("id")
      .single();
    if (ins.error || !ins.data) {
      setSalvandoCriar(false);
      setMsg({ tipo: "erro", texto: ins.error?.message ?? "Falha ao registrar estorno." });
      return;
    }
    const u = await supabase
      .from("transacoes_extrato")
      .update({ conciliado: true, lancamento_id: ins.data.id })
      .eq("id", t.id);
    if (u.error) {
      setSalvandoCriar(false);
      setMsg({ tipo: "erro", texto: u.error.message });
      return;
    }
    const eLink = await gravarLinks(supabase, [
      { empresa_id: empresaId, conta_id: contaId, transacao_id: t.id, lancamento_id: ins.data.id, evento_id: null, criado_aqui: true, prev_data_pagamento: null },
    ]);
    if (eLink) {
      setSalvandoCriar(false);
      setMsg({ tipo: "erro", texto: eLink });
      return;
    }
    setSalvandoCriar(false);
    setCriarAlvo(null);
    setSelTId(null);
    setSelLancs(new Set());
    setMsg({ tipo: "ok", texto: "Estorno registrado — anula o efeito do lançamento original no resultado." });
    await carregar();
    router.refresh();
  }

  function rotuloAjuste(tipo: AjusteTipo, diff: number): string {
    if (tipo === "desconto") return "Desconto";
    if (tipo === "juros") return "Juros/multa";
    if (tipo === "tarifa") return "Tarifa bancária";
    return diff > 0 ? "Ajuste (a mais)" : "Ajuste (a menos)";
  }

  // ---------- valores do match ativo ----------
  const selT = selTId ? transacoes.find((t) => t.id === selTId) ?? null : null;
  // evento M×N: âncora + transações extras empilhadas
  const transacoesEvento = selT
    ? [selT, ...transacoes.filter((t) => selTsExtra.has(t.id) && t.id !== selT.id)]
    : [];
  const modoEvento = transacoesEvento.length >= 2;
  const valorAlvo = modoEvento
    ? transacoesEvento.reduce((s, t) => s + Number(t.valor), 0)
    : selT
      ? Number(selT.valor)
      : 0;
  const entradaT = valorAlvo >= 0;
  const target = Math.abs(valorAlvo);
  const selecionados = lancs.filter((l) => selLancs.has(l.id));
  const soma = selecionados.reduce((s, l) => s + Number(l.valor), 0);
  const diff = Math.round((target - soma) * 100) / 100;
  const precisaAjuste = Math.abs(diff) >= 0.005;
  const ajusteEntrada = diff > 0 ? entradaT : !entradaT;
  // a diferença é classificada automaticamente: banco pagou a MAIS = juros/multa; a MENOS = desconto
  const ajusteKind: AjusteTipo = diff > 0 ? "juros" : "desconto";
  const catsAjuste = categorias.filter((c) => c.tipo === (ajusteEntrada ? "receber" : "pagar"));
  /**
   * Memoizado porque a lista deixou de ser pequena e ocasional.
   *
   * Antes ela só existia depois de um clique e já vinha cortada pelo tipo da
   * transação. Agora nasce com a tela e pode ter até TETO_FILA linhas — e sem
   * memo ela era refeita (filtro + filtro + ordenação) a cada render, inclusive
   * a cada tecla digitada na busca do **extrato**, que não tem nada a ver com
   * este painel.
   */
  const candidatos = useMemo(
    () =>
      selT
        ? candidatosPara(selT, modoEvento ? (entradaT ? "entrada" : "saida") : undefined)
        : lancamentosEmAberto(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selT, modoEvento, entradaT, lancs, buscaLanc, fCategoria, fPessoa, fDe, fAte, fValMin, fValMax],
  );
  const qtdFiltros = [fCategoria, fPessoa, fDe, fAte, fValMin, fValMax].filter(Boolean).length;
  const temExato = selT
    ? lancs.some((l) => l.tipo === (entradaT ? "entrada" : "saida") && difValor(Number(l.valor), target) < 0.005)
    : false;
  const comboCache = useMemo(() => {
    const tt = selTId ? transacoes.find((x) => x.id === selTId) : null;
    return tt ? acharCombo(tt) : null;
  }, [selTId, transacoes, lancs]); // eslint-disable-line react-hooks/exhaustive-deps
  const comboSugerido = selT && !modoEvento && selLancs.size === 0 && !temExato ? comboCache : null;
  const parDaSelecionada = selT && !modoEvento ? parCruzado(selT) : null;
  const regraSel = selT && !modoEvento ? matchRule(selT) : null;

  async function conciliarMatch() {
    if (!selT) return;
    const t = selT;
    if (selecionados.length === 0) {
      setMsg({ tipo: "erro", texto: `Selecione os lançamentos do match — faltam ${brl(target)} para fechar.` });
      return;
    }
    setConciliandoMatch(true);
    const supabase = createClient();
    const ids = selecionados.map((l) => l.id);
    const eventoId = modoEvento ? crypto.randomUUID() : null;
    const u1 = await supabase.from("lancamentos").update({ conciliado: true, data_pagamento: t.data, conta_id: contaId }).in("id", ids);
    if (u1.error) {
      setConciliandoMatch(false);
      setMsg({ tipo: "erro", texto: u1.error.message });
      return;
    }
    let lancRef = ids[0];
    if (precisaAjuste) {
      const ins = await supabase
        .from("lancamentos")
        .insert({
          empresa_id: empresaId,
          tipo: ajusteEntrada ? "entrada" : "saida",
          valor: Math.abs(diff),
          descricao: rotuloAjuste(ajusteKind, diff),
          conta_id: contaId,
          categoria_id: ajusteCategoria || null,
          pagamento_dados: { ajuste: ajusteKind },
          data_competencia: t.data,
          data_vencimento: t.data,
          data_pagamento: t.data,
          conciliado: true,
        })
        .select("id")
        .single();
      if (ins.error || !ins.data) {
        setConciliandoMatch(false);
        setMsg({ tipo: "erro", texto: ins.error?.message ?? "Falha ao lançar a diferença." });
        return;
      }
      lancRef = ins.data.id;
    }
    const u2 = await supabase
      .from("transacoes_extrato")
      .update({ conciliado: true, lancamento_id: modoEvento ? null : lancRef })
      .in("id", transacoesEvento.map((x) => x.id));
    setConciliandoMatch(false);
    if (u2.error) {
      setMsg({ tipo: "erro", texto: u2.error.message });
      return;
    }
    const links: LinkRow[] = selecionados.map((l) => ({
      empresa_id: empresaId,
      conta_id: contaId,
      transacao_id: t.id,
      lancamento_id: l.id,
      evento_id: eventoId,
      criado_aqui: false,
      prev_data_pagamento: l.data_pagamento,
    }));
    if (precisaAjuste) {
      links.push({
        empresa_id: empresaId,
        conta_id: contaId,
        transacao_id: t.id,
        lancamento_id: lancRef,
        evento_id: eventoId,
        criado_aqui: true,
        prev_data_pagamento: null,
      });
    }
    // no evento M×N, cada transação extra entra como vínculo sem lançamento próprio
    if (modoEvento) {
      for (const tx of transacoesEvento) {
        if (tx.id === t.id) continue;
        links.push({
          empresa_id: empresaId,
          conta_id: contaId,
          transacao_id: tx.id,
          lancamento_id: null,
          evento_id: eventoId,
          criado_aqui: false,
          prev_data_pagamento: null,
        });
      }
    }
    /*
      Caminho manual principal da conciliação — e o que mais custa quando falha:
      um evento M×N inteiro (N lançamentos e M transações, mais o lançamento de
      ajuste) fica preso de uma vez, sem grupo em "Conciliados" e sem Desfazer.
    */
    const eLink = await gravarLinks(supabase, links);
    if (eLink) {
      setConciliandoMatch(false);
      setMsg({ tipo: "erro", texto: eLink });
      return;
    }
    if (!modoEvento && selecionados.length === 1 && selecionados[0].categoria_id) {
      await aprenderRegra(
        supabase,
        t.descricao,
        t.valor >= 0 ? "entrada" : "saida",
        selecionados[0].categoria_id,
        selecionados[0].cliente_fornecedor_id,
      );
    }
    setMsg({
      tipo: "ok",
      texto: modoEvento
        ? `Evento conciliado: ${transacoesEvento.length} transações × ${ids.length} lançamento(s)${precisaAjuste ? " + " + rotuloAjuste(ajusteKind, diff).toLowerCase() : ""}.`
        : `Conciliado: ${ids.length} lançamento(s)${precisaAjuste ? " + " + rotuloAjuste(ajusteKind, diff).toLowerCase() : ""}.`,
    });
    setSelTId(null);
    setSelTsExtra(new Set());
    setSelLancs(new Set());
    await carregar();
    await carregarRegras();
    router.refresh();
  }

  const STATUS: Record<"alta" | "media" | "baixa" | "sem", { label: string; tom: Tom }> = {
    alta: { label: "Sugerido", tom: "positivo" },
    media: { label: "Provável", tom: "critico" },
    baixa: { label: "Possível", tom: "info" },
    sem: { label: "Sem par", tom: "neutro" },
  };
  return (
    <div className="space-y-5">
      {/*
        Conta e importar sobem para o cabeçalho da página. A faixa branca que
        eles ocupavam existia para hospedar um `<select>` e quatro botões de
        formato — quatro caminhos para a mesma tarefa, com o mesmo ícone,
        disputando a linha de cima da tela.

        O `<select>` continua sendo um `<select>` nativo, só que estilizado como
        chip: trocar de conta pelo teclado, a lista do sistema no celular e o
        rótulo lido em voz alta vêm de graça, e nenhum deles sairia igual num
        menu escrito à mão.
      */}
      <PageHeader
        titulo="Conciliação bancária"
        sub={
          <>
            Extrato do banco (OFX, planilha ou PDF) contra os seus lançamentos. Empresa:{" "}
            <span className="font-semibold text-ink">{empresaNome}</span>
          </>
        }
        acoes={
          <>
            <label className="flex items-center gap-1.5 rounded-md border border-line bg-white pl-2.5 text-xs font-semibold text-ink">
              <span className="text-ink-soft">Conta</span>
              <select
                id="conciliacao-conta"
                value={contaId}
                onChange={(e) => setContaId(e.target.value)}
                className="h-8 cursor-pointer rounded-r-md border-0 bg-transparent pr-2 text-xs font-semibold text-ink outline-none focus:ring-2 focus:ring-brand/40"
              >
                {contas.length === 0 && <option value="">Nenhuma conta cadastrada</option>}
                {contas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </label>

            {/* Clique = OFX, que é o caminho de todo dia; o ▾ guarda os outros
                três. Um menu puro cobraria um clique a mais de todo mundo para
                economizar espaço de três botões que quase ninguém usa. */}
            <div className="relative flex" ref={menuImportarRef}>
              <label className="flex h-8 cursor-pointer items-center gap-1.5 rounded-l-md bg-brand px-3 text-xs font-semibold text-white transition hover:bg-brand-dark">
                <UploadCloud size={14} /> Importar OFX
                <input
                  type="file"
                  accept=".ofx,text/plain"
                  className="hidden"
                  // a face fica DENTRO do ref do menu, então o clique nela não
                  // conta como "clique fora": sem isto o menu ficava pendurado
                  // sobre o cabeçalho durante e depois da importação
                  onClick={() => setMenuImportar(false)}
                  onChange={(e) => lerArquivo(e, "ofx")}
                />
              </label>
              <button
                type="button"
                onClick={() => setMenuImportar((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuImportar}
                aria-label="Outros formatos de extrato"
                title="Outros formatos: CSV, XLSX e PDF"
                className="flex h-8 items-center rounded-r-md border-l border-white/25 bg-brand px-1.5 text-white transition hover:bg-brand-dark"
              >
                <ChevronDown size={14} />
              </button>
              {menuImportar && (
                <div
                  role="menu"
                  className="absolute right-0 top-9 z-30 w-52 overflow-hidden rounded-lg border border-line bg-white py-1 shadow-lg"
                >
                  {/*
                    Cada item é um `<label>` com o `<input type=file>` escondido —
                    padrão que já era usado nos quatro botões antigos. A diferença
                    é que ali não havia promessa de menu; aqui há `role="menu"`, e
                    um menu que o teclado não alcança é pior que nenhum. Por isso
                    `tabIndex` e o Enter/Espaço disparando o input.
                  */}
                  {(
                    [
                      { chave: "csv", rotulo: "Planilha CSV", accept: ".csv,text/csv", beta: false },
                      {
                        chave: "xlsx",
                        rotulo: "Planilha XLSX",
                        accept:
                          ".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        beta: false,
                      },
                      { chave: "pdf", rotulo: "Extrato em PDF", accept: ".pdf,application/pdf", beta: true },
                    ] as const
                  ).map((f) => (
                    <label
                      key={f.chave}
                      role="menuitem"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter" && e.key !== " ") return;
                        e.preventDefault();
                        e.currentTarget.querySelector("input")?.click();
                      }}
                      className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs font-semibold text-ink outline-none transition hover:bg-surface focus:bg-surface"
                    >
                      <UploadCloud size={14} className="text-ink-soft" /> {f.rotulo}
                      {f.beta && (
                        <span className="rounded bg-surface px-1 text-[9px] font-bold uppercase text-ink-muted">
                          beta
                        </span>
                      )}
                      <input
                        type="file"
                        accept={f.accept}
                        className="hidden"
                        onChange={(e) => {
                          setMenuImportar(false);
                          lerArquivo(e, f.chave);
                        }}
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
          </>
        }
      />

      {extratosPortal.length > 0 && (
        <div className="rounded-xl2 border border-violet-200 bg-violet-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <UploadCloud size={16} className="shrink-0 text-violet-700" />
            <span className="text-sm font-semibold text-violet-800">
              {extratosPortal.length === 1
                ? "Seu cliente enviou um extrato pelo portal"
                : `Seu cliente enviou ${extratosPortal.length} extratos pelo portal`}
            </span>
          </div>
          <div className="mt-2 space-y-1.5">
            {extratosPortal.map((ex) => (
              <div key={ex.id} className="flex items-center gap-2 rounded-md bg-white/70 px-2.5 py-1.5 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink">{ex.arquivo_nome}</span>
                  <span className="block truncate text-[11px] text-ink-soft">
                    enviado por {ex.enviado_por_nome || "cliente"} ·{" "}
                    {ex.criado_em.slice(0, 10).split("-").reverse().join("/")}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => importarExtratoPortal(ex)}
                  disabled={importandoPortal !== null || !contaId}
                  title={!contaId ? "Escolha a conta acima primeiro" : "Importar para a conta selecionada"}
                  className="shrink-0 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
                >
                  {importandoPortal === ex.id ? "Importando…" : "Importar"}
                </button>
              </div>
            ))}
          </div>
          {!contaId && (
            <p className="mt-1.5 text-[11px] font-medium text-violet-700">
              Selecione a conta correspondente no seletor acima para importar.
            </p>
          )}
        </div>
      )}

      {msg && <Msg msg={msg} />}

      {filaNoTeto && (
        <MessageStrip tipo="alerta">
          Esta conta tem mais de {TETO_FILA} itens pendentes de um dos lados. A tela está
          trabalhando com os <b>{TETO_FILA} mais recentes</b> — concilie ou dispense os
          antigos para que eles voltem a aparecer. O limite existe porque cada transação é
          comparada com cada lançamento em aberto.
        </MessageStrip>
      )}

      {/*
        Uma faixa de contexto, no lugar de duas.

        Havia uma faixa de progresso ("0 de 6 conciliadas (0%)" com barra) e,
        logo abaixo, uma de contagens repetindo o número de pendentes. Numa tela
        que se abre justamente porque nada foi conciliado, a barra é sempre zero
        na abertura e gastava uma faixa inteira para dizer isso.

        O que **não** podia morrer com ela: `concCount` e `pendCount` vêm de duas
        contagens `count: exact` no banco e são os únicos números honestos aqui.
        Todo o resto é a lista carregada, com teto de TETO_FILA. Por isso o
        contador de pendentes usa `pendCount`, e não `transacoes.length` — que é
        o que a faixa antiga fazia, discordando em silêncio da barra logo acima
        sempre que a conta passava do teto. Pelo mesmo motivo o valor a conciliar
        some quando a fila está no teto: seria a soma de um pedaço, com cara de
        soma do todo.
      */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-xl2 border border-line bg-surface/40 px-4 py-3 text-sm">
        <span className="text-ink-muted">
          {!contagensProntas ? (
            /* antes da resposta do banco os contadores são 0, e "0 pendentes"
               lido como "tudo conciliado" é a pior mentira possível numa tela
               de conferência — inclusive na troca de conta, em que o número
               velho ficaria no ar falando da conta nova */
            <span className="text-ink-soft">Carregando a conta…</span>
          ) : totalConta === 0 ? (
            <b className="text-ink">Nenhum extrato importado nesta conta ainda.</b>
          ) : (
            <>
              <b className="text-ink">
                {concCount} de {totalConta}
              </b>{" "}
              conciliadas ({pctConc}%) ·{" "}
              {pendCount === 0 ? (
                <b className="text-ink">nada pendente</b>
              ) : (
                <>
                  <b className="text-ink">{pendCount}</b> a conciliar
                  {/* a soma sai da lista carregada; se ela foi cortada no teto,
                      seria a soma de um pedaço com cara de soma do todo */}
                  {!extratoNoTeto && (
                    <>
                      {" "}
                      · <b className="text-ink">{brl(valorPendente)}</b>
                    </>
                  )}
                </>
              )}{" "}
              · <b className="text-ink">{lancs.length}{lancsNoTeto ? "+" : ""}</b> lançamentos em aberto
              {sugestoesVisiveis.length > 0 && (
                <span className="font-semibold text-brand-dark">
                  {" "}
                  · {sugestoesVisiveis.length} sugestão(ões) prontas
                </span>
              )}
            </>
          )}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setRegrasModal(true)}
            className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-muted transition hover:bg-white"
          >
            <Sparkles size={14} /> Regras{regras.length > 0 ? ` (${regras.length})` : ""}
          </button>
          <Botao variante="primario" tamanho="sm"
            onClick={conciliarExatos}
            disabled={processando || paresExatos.length === 0}
          >
            <CheckCheck size={14} /> {processando ? "Conciliando…" : `Conciliar exatos (${paresExatos.length})`}
          </Botao>
        </div>
      </div>

      {selT && parDaSelecionada && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl2 border border-sky-200 bg-sky-50 px-4 py-3">
          <span className="flex items-center gap-2 text-sm text-sky-800">
            <ArrowLeftRight size={16} className="shrink-0" />
            <span>
              Parece transferência entre contas: a outra ponta está em{" "}
              <b>{contas.find((c) => c.id === parDaSelecionada.conta_id)?.nome ?? "outra conta"}</b> (
              {dataBR(parDaSelecionada.data)} · {brl(parDaSelecionada.valor)}).
            </span>
          </span>
          <button
            type="button"
            onClick={() => conciliarTransfCruzada(selT, parDaSelecionada)}
            disabled={processando}
            className="shrink-0 rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-700 disabled:opacity-60"
          >
            Conciliar como transferência (as duas pontas)
          </button>
        </div>
      )}

      {/* sugestões de combinação (motor 1×N / M×1) */}
      {sugestoesVisiveis.length > 0 && (
        <div className="rounded-xl2 border border-brand/30 bg-brand-light/20 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <button
              type="button"
              onClick={() => setSugAberto((v) => !v)}
              className="flex items-center gap-2 text-sm font-bold text-brand-dark"
            >
              <Sparkles size={15} /> Sugestões de combinação ({sugestoesVisiveis.length})
              {sugAberto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {sugAltaCount > 0 && (
              <button
                type="button"
                onClick={() => aplicarSugestoes(sugestoesVisiveis.filter((s) => s.banda === "alta" && s.tipo !== "1x1~"))}
                disabled={processando}
                className="flex items-center gap-1.5 rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
              >
                <CheckCheck size={14} /> Conciliar {sugAltaCount} de alta confiança
              </button>
            )}
          </div>

          {/* lote das aproximadas: escolhe a categoria da diferença uma vez só */}
          {sugAprox.length > 0 && (
            <div className="flex flex-wrap items-end gap-2 border-t border-line/60 px-4 py-2.5">
              <div className="min-w-0">
                <p className="text-xs font-bold text-ink">
                  {sugAprox.length} aproximada(s) de alta confiança
                </p>
                <p className="text-[11px] text-ink-muted">
                  Valor quase igual — falta só dizer onde entra a diferença (juros/multa ou desconto).
                </p>
              </div>
              {sugAprox.some((s) => dadosAjusteDaSugestao(s).ajusteEntrada) && (
                <label className="text-[11px] font-semibold text-ink-muted">
                  <span className="mb-0.5 block">Diferença a receber</span>
                  <select
                    value={catAjusteReceber}
                    onChange={(e) => setCatAjusteReceber(e.target.value)}
                    className="rounded-lg border border-line bg-white px-2 py-1.5 text-xs outline-none focus:border-brand"
                  >
                    <option value="">Sem categoria</option>
                    {categorias
                      .filter((c) => c.tipo === "receber")
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              {sugAprox.some((s) => !dadosAjusteDaSugestao(s).ajusteEntrada) && (
                <label className="text-[11px] font-semibold text-ink-muted">
                  <span className="mb-0.5 block">Diferença a pagar</span>
                  <select
                    value={catAjustePagar}
                    onChange={(e) => setCatAjustePagar(e.target.value)}
                    className="rounded-lg border border-line bg-white px-2 py-1.5 text-xs outline-none focus:border-brand"
                  >
                    <option value="">Sem categoria</option>
                    {categorias
                      .filter((c) => c.tipo === "pagar")
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              <button
                type="button"
                onClick={() => aplicarAproximadas(sugAprox)}
                disabled={processando}
                className="ml-auto flex items-center gap-1.5 rounded-lg border border-brand bg-white px-3 py-1.5 text-xs font-bold text-brand-dark transition hover:bg-brand-light disabled:opacity-60"
              >
                <CheckCheck size={14} /> Conciliar as {sugAprox.length} com ajuste
              </button>
            </div>
          )}
          {sugAberto && (
            <div className="max-h-[40vh] divide-y divide-line/60 overflow-auto border-t border-line/60">
              {sugestoesVisiveis.map((s) => {
                const bd = STATUS[s.banda];
                const valor = s.tipo === "Mx1" ? Number(s.lancamentos[0].valor) : Math.abs(s.transacoes[0].valor);
                const entrada = s.tipo === "Mx1" ? s.lancamentos[0].tipo === "entrada" : s.transacoes[0].valor >= 0;
                return (
                  <div key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-ink-muted ring-1 ring-inset ring-line">
                      {s.tipo === "1xN" ? `1×${s.lancamentos.length}` : s.tipo === "Mx1" ? `${s.transacoes.length}×1` : "1×1 ±"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-ink">
                        {s.tipo === "Mx1"
                          ? `${s.transacoes.length} transações → ${s.lancamentos[0].pessoa_nome ?? s.lancamentos[0].descricao ?? "lançamento"}`
                          : s.tipo === "1xN"
                            ? `${dataBR(s.transacoes[0].data)} · ${s.transacoes[0].descricao || "—"} → ${s.lancamentos.length} lançamentos`
                            : `${dataBR(s.transacoes[0].data)} · ${s.transacoes[0].descricao || "—"} → ${s.lancamentos[0].pessoa_nome ?? s.lancamentos[0].descricao ?? "lançamento"}`}
                      </span>
                      {s.tipo === "1x1~" && s.diferenca != null && (
                        <span className="mt-0.5 mr-1 inline-block text-[10px] font-semibold text-ink-muted">
                          {s.diferenca > 0
                            ? `${brl(s.diferenca)} a mais (juros/multa?)`
                            : `${brl(Math.abs(s.diferenca))} a menos (desconto?)`}{" "}
                          — revise para classificar
                        </span>
                      )}
                      <ObjectStatus pilula tom={bd.tom} className="mt-0.5">
                        {bd.label}
                      </ObjectStatus>
                    </span>
                    <span className={`num shrink-0 font-semibold ${entrada ? "text-brand" : "text-ink"}`}>{brl(valor)}</span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {s.tipo !== "1x1~" && (
                        <button
                          type="button"
                          onClick={() => aplicarSugestoes([s])}
                          disabled={processando}
                          className="rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
                        >
                          Conciliar
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => revisarSugestao(s)}
                        className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                          s.tipo === "1x1~"
                            ? "bg-brand text-white hover:bg-brand-dark"
                            : "border border-line text-ink-muted hover:border-brand hover:text-brand"
                        }`}
                      >
                        Revisar
                      </button>
                      <button
                        type="button"
                        onClick={() => dispensarSugestao(s.id)}
                        title="Dispensar"
                        className="rounded-md border border-line px-2 py-1 text-ink-soft transition hover:border-danger hover:text-danger"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* quadro de dois lados */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* EXTRATO (banco) */}
        <Card
          corpoSemPadding
          titulo="Extrato (banco)"
          sub="Organizado por confiança. Clique numa linha para casar."
          acoes={
            <div className="flex shrink-0 items-center gap-3 text-[11px] text-ink-soft">
              <span>Ordenar:</span>
              <SortToggle label="Data" campo="data" ord={ordT} onToggle={(c, i) => setOrdT((o) => toggleOrd(o, c, i))} />
              <SortToggle label="Valor" campo="valor" ord={ordT} onToggle={(c, i) => setOrdT((o) => toggleOrd(o, c, i))} />
            </div>
          }
        >

          {/* Busca do extrato. Não existia: com centenas de linhas pendentes,
              os dois botões de ordenar eram tudo que havia para achar uma. */}
          {transacoes.length > 0 && (
            <div className="border-b border-line px-3 py-2">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft" />
                <input
                  id="conciliacao-busca-extrato"
                  value={buscaExtrato}
                  onChange={(e) => setBuscaExtrato(e.target.value)}
                  placeholder="Buscar na descrição do banco…"
                  className="w-full rounded-lg border border-line py-1.5 pl-8 pr-8 text-sm outline-none focus:border-brand"
                />
                {buscaExtrato && (
                  <button
                    type="button"
                    onClick={() => setBuscaExtrato("")}
                    aria-label="Limpar a busca do extrato"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-soft transition hover:text-ink"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          )}

          {carregando ? (
            <SkeletonLinhas linhas={6} colunas={5} />
          ) : transacoes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-ink-soft">
              <SearchX size={26} strokeWidth={1.5} />
              <EmptyState compacto titulo="Nenhuma transação pendente" descricao="Importe um extrato acima." />
            </div>
          ) : filas.total === 0 ? (
            /* a lista tem itens, mas nenhum bate com a busca — sem isto os três
               grupos somem e sobra um cartão em branco, sem explicação */
            <div className="flex flex-col items-center justify-center py-14 text-ink-soft">
              <SearchX size={26} strokeWidth={1.5} />
              <EmptyState
                compacto
                titulo="Nenhuma transação com esse texto"
                descricao={`${pendCount} pendente(s) nesta conta não casam com “${buscaExtrato}”.`}
              />
            </div>
          ) : (
            <div className="max-h-[64vh] overflow-auto">
              {(
                [
                  { chave: "prontos", titulo: "Prontas pra conciliar", cls: "text-brand-dark", itens: filas.prontos },
                  { chave: "revisar", titulo: "Revisar", cls: "text-amber-700", itens: filas.revisar },
                  { chave: "sem", titulo: "Sem par", cls: "text-ink-soft", itens: filas.semPar },
                ] as const
              ).map((fila) =>
                fila.itens.length === 0 ? null : (
                  <div key={fila.chave}>
                    <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-line bg-surface/95 px-4 py-1.5">
                      <span className={`text-[11px] font-bold uppercase tracking-wide ${fila.cls}`}>{fila.titulo}</span>
                      <span className="flex items-center gap-2">
                        {fila.chave === "sem" && fila.itens.some((t) => !regrasMap.has(t.id) && !iaSug.has(t.id)) && (
                          <Botao variante="primario"
                            onClick={classificarComIA}
                            disabled={classificando || processando}
                          >
                            <Sparkles size={11} /> {classificando ? "Classificando…" : "Classificar com IA"}
                          </Botao>
                        )}
                        <span className="text-[11px] font-semibold text-ink-soft">{fila.itens.length}</span>
                      </span>
                    </div>
                    {fila.itens.map((t) => {
                const entrada = t.valor >= 0;
                const st = STATUS[statusMap.get(t.id) ?? "sem"];
                const ehAncora = selTId === t.id;
                const noEvento = selTsExtra.has(t.id);
                return (
                  <div
                    key={t.id}
                    className={`flex items-center gap-1 border-b border-line/60 pr-2 transition last:border-0 ${
                      ehAncora
                        ? "bg-brand-light/40 ring-1 ring-inset ring-brand/40"
                        : noEvento
                          ? "bg-brand-light/20"
                          : "hover:bg-surface/50"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => selecionarT(t)}
                      className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-sm">
                          <span className="num text-ink-soft">{dataBR(t.data)}</span>
                          <span className="truncate font-medium text-ink">{t.descricao || "—"}</span>
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1">
                          <ObjectStatus pilula tom={st.tom}>
                            {st.label}
                          </ObjectStatus>
                          {idsComPar.has(t.id) && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
                              <ArrowLeftRight size={10} /> transferência?
                            </span>
                          )}
                          {regrasMap.has(t.id) && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-brand-light px-1.5 py-0.5 text-[10px] font-semibold text-brand-dark">
                              <Sparkles size={10} /> regra
                            </span>
                          )}
                          {!regrasMap.has(t.id) && iaSug.has(t.id) && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
                              <Sparkles size={10} /> IA:{" "}
                              {categorias.find((c) => c.id === iaSug.get(t.id)?.categoria_id)?.nome ?? ""}
                              {" "}({Math.round((iaSug.get(t.id)?.confianca ?? 0) * 100)}%)
                            </span>
                          )}
                        </span>
                      </span>
                      <span className={`num shrink-0 font-semibold ${entrada ? "text-brand" : "text-ink"}`}>
                        {brl(t.valor)}
                      </span>
                    </button>
                    {ehAncora ? (
                      <span className="shrink-0 rounded-md bg-brand px-2 py-1 text-[10px] font-semibold text-white">âncora</span>
                    ) : selTId ? (
                      <button
                        type="button"
                        onClick={() => toggleTExtra(t.id)}
                        title="Empilhar no evento de conciliação (M×N)"
                        className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-semibold transition ${
                          noEvento
                            ? "bg-brand text-white hover:bg-brand-dark"
                            : "border border-line text-ink-muted hover:border-brand hover:text-brand"
                        }`}
                      >
                        {noEvento ? "✓ evento" : "+ evento"}
                      </button>
                    ) : null}
                  </div>
                      );
                    })}
                  </div>
                ),
              )}
            </div>
          )}
        </Card>

        {/* LANÇAMENTOS EM ABERTO */}
        <Card
          corpoSemPadding
          titulo="Lançamentos em aberto"
          sub={
            !selT
              ? `Em aberto, por vencimento${lancsNoTeto ? ` (os ${TETO_FILA} mais recentes)` : ""}. Selecione uma linha do extrato para casar.`
              : modoEvento
                ? `Marque os lançamentos que somam o evento de ${transacoesEvento.length} transações.`
                : "Marque 1 ou vários para casar. Em outras linhas do extrato, use + evento para somar M×N."
          }
        >


          {/*
            O painel nasce populado.

            Antes ele era um retângulo de 270px dizendo "Nada selecionado" até
            alguém clicar à esquerda — metade da tela reservada para um convite,
            numa tela chamada "Conciliação" que promete extrato contra
            lançamentos. Junto com o retângulo nasciam mortas a busca, os seis
            filtros e o atalho "/", todos dentro deste mesmo ramo: sem seleção,
            apertar "/" engolia a tecla e não focava nada.

            O que a frase "Selecione uma linha do extrato à esquerda" carregava
            era a única explicação de que a esquerda comanda a direita. Ela não
            some: virou o subtítulo do cartão e a dica sobre as caixas.
          */}
          <>
            {!selT && (
              <div className="flex items-center gap-1.5 border-b border-line bg-surface/60 px-3 py-2 text-[11px] text-ink-muted">
                <Link2 size={13} className="shrink-0" />
                <span>
                  Selecione uma transação à esquerda para casar — as caixas ligam quando houver uma.
                </span>
              </div>
            )}
            {selT && regraSel && !temExato && (
                <div className="flex items-center justify-between gap-2 border-b border-line bg-brand-light/40 px-3 py-2">
                  <span className="flex min-w-0 items-center gap-1.5 text-xs text-brand-dark">
                    <Sparkles size={13} className="shrink-0" />
                    <span className="truncate">
                      Regra: {categorias.find((c) => c.id === regraSel.categoria_id)?.nome ?? "categoria"}
                      {regraSel.cliente_fornecedor_id
                        ? " · " + (pessoas.find((p) => p.id === regraSel.cliente_fornecedor_id)?.nome ?? "")
                        : ""}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => criarPelaRegra(selT, regraSel)}
                    disabled={processando}
                    className="shrink-0 rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
                  >
                    Criar pela regra
                  </button>
                </div>
              )}
              {!regraSel && !temExato && selT && iaSug.has(selT.id) && (
                <div className="flex items-center justify-between gap-2 border-b border-line bg-violet-50 px-3 py-2">
                  <span className="flex min-w-0 items-center gap-1.5 text-xs text-violet-700">
                    <Sparkles size={13} className="shrink-0" />
                    <span className="truncate">
                      IA sugere: {categorias.find((c) => c.id === iaSug.get(selT.id)?.categoria_id)?.nome ?? "categoria"}
                      {iaSug.get(selT.id)?.cliente_fornecedor_id
                        ? " · " + (pessoas.find((p) => p.id === iaSug.get(selT.id)?.cliente_fornecedor_id)?.nome ?? "")
                        : ""}{" "}
                      ({Math.round((iaSug.get(selT.id)?.confianca ?? 0) * 100)}%)
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => criarPelaIA(selT)}
                      disabled={processando}
                      className="rounded-md bg-violet-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:opacity-60"
                    >
                      Aceitar
                    </button>
                    <button aria-label="Dispensar esta sugestão"
                      type="button"
                      onClick={() => dispensarIA(selT.id)}
                      className="rounded-md border border-line px-2 py-1 text-xs text-ink-soft transition hover:border-danger hover:text-danger"
                    >
                      <X size={12} />
                    </button>
                  </span>
                </div>
              )}
              {/* busca + filtros */}
              <div className="space-y-2 border-b border-line px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft" />
                    <input
                      id="conciliacao-busca-lancamento"
                      data-busca-local
                      ref={buscaLancRef}
                      value={buscaLanc}
                      onChange={(e) => setBuscaLanc(e.target.value)}
                      placeholder="Buscar descrição ou fornecedor…"
                      className="w-full rounded-lg border border-line py-1.5 pl-8 pr-2 text-sm outline-none focus:border-brand"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setMostrarFiltros((v) => !v)}
                    className={`flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                      mostrarFiltros || qtdFiltros > 0
                        ? "border-brand text-brand"
                        : "border-line text-ink-muted hover:bg-surface"
                    }`}
                  >
                    <Filter size={13} /> Filtros{qtdFiltros > 0 ? ` (${qtdFiltros})` : ""}
                  </button>
                </div>

                {mostrarFiltros && (
                  <div className="grid grid-cols-2 gap-2 rounded-lg border border-line bg-surface/50 p-2">
                    <div className="col-span-2">
                      <ComboBusca
                        value={fPessoa}
                        onChange={setFPessoa}
                        options={pessoas.map((p) => ({ id: p.id, nome: p.nome, sub: p.cpf_cnpj }))}
                        placeholder="Fornecedor/cliente (todos)"
                      />
                    </div>
                    <div className="col-span-2">
                      <ComboBusca
                        value={fCategoria}
                        onChange={setFCategoria}
                        /* sem transação selecionada não há sinal: a lista é dos
                           dois tipos, e restringir a categoria a "receber"
                           esconderia metade dos lançamentos que ela mostra */
                        options={(selT
                          ? categorias.filter((c) => c.tipo === (entradaT ? "receber" : "pagar"))
                          : categorias
                        ).map((c) => ({ id: c.id, nome: c.nome }))}
                        placeholder="Categoria (todas)"
                      />
                    </div>
                    {/* rótulo acima do controle, como na barra de filtros das
                        outras telas — aqui eles eram rótulos à esquerda com
                        largura fixa de 40px, que cortava "R$ de" */}
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-ink-soft">Vencimento de</label>
                      <input
                        type="date"
                        value={fDe}
                        onChange={(e) => setFDe(e.target.value)}
                        className={classeControle("sm", false, "num")}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-ink-soft">Até</label>
                      <input
                        type="date"
                        value={fAte}
                        onChange={(e) => setFAte(e.target.value)}
                        className={classeControle("sm", false, "num")}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-ink-soft">Valor de</label>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={fValMin}
                        onChange={(e) => setFValMin(e.target.value)}
                        placeholder="0"
                        className={classeControle("sm", false, "num")}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-ink-soft">Até</label>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={fValMax}
                        onChange={(e) => setFValMax(e.target.value)}
                        placeholder="sem limite"
                        className={classeControle("sm", false, "num")}
                      />
                    </div>
                    {qtdFiltros > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setFPessoa("");
                          setFCategoria("");
                          setFDe("");
                          setFAte("");
                          setFValMin("");
                          setFValMax("");
                        }}
                        className="col-span-2 flex h-8 items-center justify-center rounded-lg px-2.5 text-xs font-semibold text-ink-soft transition hover:bg-surface hover:text-ink"
                      >
                        Limpar filtros
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* palpite de combinação 1:N */}
              {comboSugerido && comboSugerido.length > 0 && (
                <div className="flex items-center justify-between gap-2 border-b border-line bg-brand-light/40 px-3 py-2">
                  <span className="flex items-center gap-1.5 text-xs text-brand-dark">
                    <Sparkles size={13} className="shrink-0" /> Palpite: {comboSugerido.length} lançamentos somam {brl(target)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelLancs(new Set(comboSugerido.map((l) => l.id)))}
                    className="shrink-0 rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-brand-dark"
                  >
                    Usar palpite
                  </button>
                </div>
              )}

              <div className="max-h-[46vh] overflow-auto">
                {candidatos.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-ink-soft">
                    {qtdFiltros > 0 || buscaLanc
                      ? "Nenhum lançamento bate com esses filtros."
                      : selT
                        ? `Nenhum lançamento de ${entradaT ? "entrada" : "saída"} em aberto. Crie um a partir do extrato abaixo.`
                        : "Nenhum lançamento em aberto nesta conta."}
                  </p>
                ) : (
                  candidatos.map((c) => {
                    const on = selLancs.has(c.id);
                    // sem âncora não há alvo nem score: nada de "valor igual"
                    // nem de pílula de força — seriam inventados
                    const exato = selT ? difValor(Number(c.valor), target) < 0.005 : false;
                    const bd = selT ? banda(scoreLanc(selT, c), exato) : null;
                    const meta = [c.pessoa_nome, c.categoria_nome].filter(Boolean).join(" · ");
                    const entradaL = c.tipo === "entrada";
                    return (
                      <label
                        key={c.id}
                        title={selT ? undefined : "Selecione uma transação do extrato para casar este lançamento"}
                        className={`flex items-center gap-3 border-b border-line/60 px-4 py-2.5 transition last:border-0 ${
                          selT ? "cursor-pointer hover:bg-surface/50" : "cursor-default"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={!selT}
                          onChange={() => toggleLanc(c.id)}
                          className="h-4 w-4 accent-brand disabled:cursor-not-allowed disabled:opacity-40"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-sm text-ink">{c.descricao || c.pessoa_nome || "lançamento"}</span>
                            {bd === "alta" && (
                              <span className="shrink-0 rounded-full bg-brand-light px-1.5 py-0.5 text-[9px] font-bold text-brand-dark">
                                forte
                              </span>
                            )}
                            {bd === "media" && (
                              <span className="shrink-0 rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
                                provável
                              </span>
                            )}
                            {/* com os dois tipos na mesma lista, o sinal precisa
                                estar escrito — o valor sai sempre positivo */}
                            {!selT && (
                              <span
                                className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                                  entradaL ? "bg-brand-light text-brand-dark" : "bg-surface text-ink-muted"
                                }`}
                              >
                                {entradaL ? "a receber" : "a pagar"}
                              </span>
                            )}
                          </span>
                          <span className="block truncate text-[11px] text-ink-soft">
                            {meta ? `${meta} · ` : ""}venc. {dataBR(c.data_vencimento)}
                            {exato && <span className="ml-1 text-brand-dark">· valor igual</span>}
                          </span>
                        </span>
                        <span className="num shrink-0 text-sm font-semibold text-ink">{brl(Number(c.valor))}</span>
                      </label>
                    );
                  })
                )}
              </div>
              {selT && (
                <div className="border-t border-line px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => abrirCriar(selT)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted transition hover:text-brand"
                  >
                    <PlusCircle size={14} /> Criar lançamento a partir do extrato
                  </button>
                </div>
              )}
          </>
        </Card>
      </div>

      {/* Barra de match: gruda no rodapé da janela enquanto você escolhe as
          linhas no quadro acima. Antes ela ficava logo abaixo do quadro, ou
          seja, fora da tela justamente quando havia muitas linhas para
          escolher — e confirmar exigia rolar até o fim e voltar.

          `sticky` e não `fixed` (que é o que a FooterBar usa): esta barra tem
          várias linhas — resumo dos dois lados, diferença, seletor de categoria
          de ajuste e a explicação do ajuste. Fixa, cobriria metade da tela. */}
      {selT && <div className="h-2" aria-hidden />}
      {selT && (
        <div className="sticky bottom-3 z-30 rounded-xl2 border border-brand/30 bg-white/95 p-4 shadow-[0_-2px_12px_rgba(90,107,123,.14)] backdrop-blur">
          {modoEvento && (
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-brand-dark">
              <Layers size={14} /> Evento M×N · {transacoesEvento.length} transações do extrato somadas
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span className="text-ink-soft">
              {modoEvento ? `Extrato (${transacoesEvento.length})` : "Banco"}{" "}
              <span className="num font-semibold text-ink">{brl(target)}</span>
            </span>
            <span className="text-ink-soft">
              Selecionado ({selecionados.length}) <span className="num font-semibold text-ink">{brl(soma)}</span>
            </span>
            <span className="text-ink-soft">
              Diferença{" "}
              <span className={`num font-bold ${precisaAjuste ? "text-ink" : "text-brand"}`}>{brl(diff)}</span>
            </span>
          </div>

          {precisaAjuste && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface/50 p-3">
              <span className="text-xs font-semibold text-ink">
                {diff > 0 ? (
                  <>
                    O banco {entradaT ? "recebeu" : "pagou"} {brl(Math.abs(diff))} a mais →{" "}
                    <b className="text-danger">juros/multa</b>
                  </>
                ) : (
                  <>
                    O banco {entradaT ? "recebeu" : "pagou"} {brl(Math.abs(diff))} a menos →{" "}
                    <b className="text-brand">desconto</b>
                  </>
                )}
              </span>
              <ComboBusca
                value={ajusteCategoria}
                onChange={setAjusteCategoria}
                options={catsAjuste.map((c) => ({ id: c.id, nome: c.nome }))}
                placeholder="Categoria (opcional)"
                className="min-w-[180px]"
              />
              <span className="w-full text-[11px] text-ink-soft">
                Lança automaticamente uma {ajusteEntrada ? "entrada" : "saída"} de {brl(Math.abs(diff))} (
                {rotuloAjuste(ajusteKind, diff).toLowerCase()}), fechando o match. Sem categoria, vai para a conta de
                encargo parametrizada na exportação contábil.
              </span>
            </div>
          )}

          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setSelTId(null);
                setSelTsExtra(new Set());
                setSelLancs(new Set());
              }}
              className="rounded-md border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-muted transition hover:bg-surface"
            >
              Cancelar
            </button>
            <Botao variante="primario"
              onClick={conciliarMatch}
              disabled={conciliandoMatch || selecionados.length === 0}
            >
              <CheckCheck size={15} />{" "}
              {conciliandoMatch ? "Conciliando…" : modoEvento ? "Conciliar evento" : "Conciliar"}
            </Botao>
          </div>
        </div>
      )}

      {/* conciliados recentes (desfazer) */}
      {conciliados.length > 0 && (
        <Card
          corpoSemPadding
          titulo="Conciliados recentes"
          sub="Desfazer volta os lançamentos para em aberto e remove os ajustes/lançamentos criados na conciliação."
          acoes={
            <div className="flex shrink-0 items-center gap-3 text-[11px] text-ink-soft">
              <span>Ordenar:</span>
              <SortToggle label="Data" campo="data" ord={ordC} onToggle={(c, i) => setOrdC((o) => toggleOrd(o, c, i))} />
              <SortToggle label="Valor" campo="valor" ord={ordC} onToggle={(c, i) => setOrdC((o) => toggleOrd(o, c, i))} />
            </div>
          }
        >

          <div className="max-h-[40vh] overflow-auto">
            {ordenar(conciliados, ordC, { data: (g) => g.data, valor: (g) => Number(g.valor) }).map((g) => {
              const entrada = g.valor >= 0;
              const ehEvento = g.qtdT > 1;
              return (
                <div
                  key={g.chave}
                  className="flex items-center gap-3 border-b border-line/60 px-4 py-2.5 text-sm last:border-0"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="num text-ink-soft">{dataBR(g.data)}</span>
                      <span className="truncate text-ink">{g.descricao || "—"}</span>
                      {ehEvento && (
                        <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-brand-light px-1.5 py-0.5 text-[10px] font-semibold text-brand-dark">
                          <Layers size={10} /> evento
                        </span>
                      )}
                    </span>
                    <span className="block text-[11px] text-ink-soft">
                      {ehEvento
                        ? `${g.qtdT} transações × ${g.qtd} lançamento(s)`
                        : `${g.qtd} lançamento(s) conciliado(s)`}
                    </span>
                  </span>
                  <span className={`num shrink-0 font-semibold ${entrada ? "text-brand" : "text-ink"}`}>
                    {brl(g.valor)}
                  </span>
                  <button
                    type="button"
                    onClick={() => desfazerGrupo(g)}
                    disabled={processando}
                    className="shrink-0 rounded-md border border-line px-2.5 py-1 text-xs font-semibold text-ink-muted transition hover:border-danger hover:text-danger disabled:opacity-50"
                  >
                    Desfazer
                  </button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* regras de classificação */}
      {regrasModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-rail/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl2 bg-white shadow-card" role="dialog" aria-modal="true" aria-labelledby="dlg-regras-classificacao-titulo">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div>
                <h3 id="dlg-regras-classificacao-titulo" className="text-base font-bold text-ink">Regras de classificação</h3>
                <p className="text-xs text-ink-soft">
                  Memorizam descrição do banco → categoria/fornecedor para auto-classificar as próximas linhas.
                </p>
              </div>
              <button aria-label="Fechar"
                type="button"
                onClick={() => setRegrasModal(false)}
                className="rounded-lg p-1 text-ink-soft transition hover:bg-surface"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2 border-b border-line bg-surface/40 px-5 py-3">
              <p className="text-xs font-semibold text-ink-muted">Nova regra</p>
              <input
                value={nrPadrao}
                onChange={(e) => setNrPadrao(e.target.value)}
                placeholder="Texto que aparece no extrato (ex.: tarifa pacote)"
                className={classeControle("md", false, "bg-white")}
              />
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={nrTipo}
                  onChange={(e) => setNrTipo(e.target.value as "entrada" | "saida")}
                  className="rounded-lg border border-line bg-white px-2 py-2 text-sm outline-none focus:border-brand"
                >
                  <option value="saida">Saída</option>
                  <option value="entrada">Entrada</option>
                </select>
                <ComboBusca
                  value={nrCategoria}
                  onChange={setNrCategoria}
                  options={categorias
                    .filter((c) => c.tipo === (nrTipo === "entrada" ? "receber" : "pagar"))
                    .map((c) => ({ id: c.id, nome: c.nome }))}
                  placeholder="Categoria…"
                />
                <ComboBusca
                  value={nrPessoa}
                  onChange={setNrPessoa}
                  options={pessoas.map((p) => ({ id: p.id, nome: p.nome, sub: p.cpf_cnpj }))}
                  placeholder="Fornecedor/cliente…"
                />
              </div>
              <Botao variante="primario" tamanho="sm"
                onClick={salvarRegraManual}
              >
                Salvar regra
              </Botao>
            </div>

            <div className="flex-1 overflow-y-auto">
              {regras.length === 0 ? (
                <EmptyState compacto titulo="Nenhuma regra ainda" descricao="Elas surgem sozinhas quando você classifica linhas do extrato." />
              ) : (
                regras.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 border-b border-line/60 px-5 py-2.5 text-sm last:border-0"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink">
                        {r.padrao}
                        {r.origem === "escritorio" && (
                          <span className="ml-2 rounded-full bg-brand-light px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-brand-dark">
                            escritório
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-[11px] text-ink-soft">
                        {r.tipo === "entrada" ? "entrada" : "saída"} ·{" "}
                        {categorias.find((c) => c.id === r.categoria_id)?.nome ?? "categoria"}
                        {r.cliente_fornecedor_id
                          ? " · " + (pessoas.find((p) => p.id === r.cliente_fornecedor_id)?.nome ?? "")
                          : ""}
                      </span>
                    </span>
                    {r.origem !== "escritorio" && escritorioId && (
                      <button
                        type="button"
                        onClick={() => promoverRegra(r)}
                        title="Valer para todas as empresas do escritório"
                        className="shrink-0 rounded-md border border-line px-2 py-1 text-[10px] font-semibold text-ink-muted transition hover:border-brand hover:text-brand"
                      >
                        <Layers size={13} />
                      </button>
                    )}
                    <button aria-label="Excluir"
                      type="button"
                      onClick={() => (r.origem === "escritorio" ? excluirRegraGlobal(r.id) : excluirRegra(r.id))}
                      className="shrink-0 rounded-lg border border-line p-1.5 text-ink-soft transition hover:border-danger hover:text-danger"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="border-t border-line px-5 py-3 text-right">
              <button
                type="button"
                onClick={() => setRegrasModal(false)}
                className="rounded-md border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-muted transition hover:bg-surface"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* criar a partir do extrato (lançamento ou transferência) */}
      {criarAlvo &&
        (() => {
          const t = criarAlvo;
          const entrada = t.valor >= 0;
          const catsCriar = categorias.filter((c) => c.tipo === (entrada ? "receber" : "pagar"));
          const pessoasCriar = pessoas.filter((p) =>
            entrada ? p.tipo === "cliente" || p.tipo === "ambos" : p.tipo === "fornecedor" || p.tipo === "ambos",
          );
          const outras = contas.filter((c) => c.id !== contaId);
          const campoCls =
            "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand";
          const labelCls = "mb-1 block text-xs font-semibold text-ink-muted";
          const rateioTotal = Math.abs(t.valor);
          const rateioSoma = Math.round(rateioRows.reduce((s, r) => s + parseValorBR(r.valor), 0) * 100) / 100;
          const rateioResta = Math.round((rateioTotal - rateioSoma) * 100) / 100;
          const rateioOk = Math.abs(rateioResta) < 0.005 && rateioRows.every((r) => r.categoria_id && parseValorBR(r.valor) > 0);
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-rail/50 p-4">
              <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-xl2 bg-white shadow-card" role="dialog" aria-modal="true" aria-labelledby="dlg-criar-do-extrato-titulo">
                <div className="border-b border-line px-5 py-4">
                  <div className="flex items-center justify-between">
                    <h3 id="dlg-criar-do-extrato-titulo" className="text-base font-bold text-ink">Criar a partir do extrato</h3>
                    <button aria-label="Fechar"
                      type="button"
                      onClick={() => setCriarAlvo(null)}
                      className="rounded-lg p-1 text-ink-soft transition hover:bg-surface"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <p className="mt-1 flex items-center gap-2 text-xs text-ink-soft">
                    <span className="num">{dataBR(t.data)}</span>
                    <span className="min-w-0 flex-1 truncate">{t.descricao || "—"}</span>
                    <span className={`num font-semibold ${entrada ? "text-brand" : "text-ink"}`}>{brl(t.valor)}</span>
                  </p>
                </div>

                <div className="flex gap-1 border-b border-line px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setCModo("lancamento")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      cModo === "lancamento" ? "bg-brand text-white" : "text-ink-muted hover:bg-surface"
                    }`}
                  >
                    Lançamento
                  </button>
                  {outras.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setCModo("transferencia")}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        cModo === "transferencia" ? "bg-brand text-white" : "text-ink-muted hover:bg-surface"
                      }`}
                    >
                      Transferência entre contas
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setCModo("estorno")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      cModo === "estorno" ? "bg-brand text-white" : "text-ink-muted hover:bg-surface"
                    }`}
                  >
                    Estorno/devolução
                  </button>
                  <button
                    type="button"
                    onClick={() => setCModo("rateio")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      cModo === "rateio" ? "bg-brand text-white" : "text-ink-muted hover:bg-surface"
                    }`}
                  >
                    Rateio
                  </button>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                  {cModo === "lancamento" ? (
                    <>
                      <div>
                        <label className={labelCls}>Tipo</label>
                        <span
                          className={`inline-block rounded-lg px-2.5 py-1 text-sm font-semibold ${
                            entrada ? "bg-brand-light text-brand-dark" : "bg-rose-50 text-danger"
                          }`}
                        >
                          {entrada ? "Entrada (recebimento)" : "Saída (pagamento)"}
                        </span>
                      </div>
                      <div>
                        <label className={labelCls}>Descrição</label>
                        <input value={cDescricao} onChange={(e) => setCDescricao(e.target.value)} className={campoCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Categoria *</label>
                        <ComboBusca
                          value={cCategoria}
                          onChange={setCCategoria}
                          options={catsCriar.map((c) => ({ id: c.id, nome: c.nome }))}
                          placeholder="Escolha…"
                        />
                        {catsCriar.length === 0 && (
                          <p className="mt-1 text-[11px] text-danger">
                            Cadastre uma categoria de {entrada ? "recebimento" : "pagamento"} primeiro.
                          </p>
                        )}
                      </div>
                      <div>
                        <label className={labelCls}>{entrada ? "Cliente" : "Fornecedor"} (opcional)</label>
                        <ComboBusca
                          value={cPessoa}
                          onChange={setCPessoa}
                          options={pessoasCriar.map((p) => ({ id: p.id, nome: p.nome, sub: p.cpf_cnpj }))}
                          placeholder="—"
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Data de competência</label>
                        <input
                          type="date"
                          value={cCompetencia}
                          onChange={(e) => setCCompetencia(e.target.value)}
                          className={`num ${campoCls}`}
                        />
                        <p className="mt-1 text-[11px] text-ink-soft">Pago em {dataBR(t.data)} (data do extrato).</p>
                      </div>
                    </>
                  ) : cModo === "transferencia" ? (
                    <>
                      <p className="text-xs text-ink-soft">
                        Esta linha é uma transferência entre suas contas. Vamos criar as duas pernas (saída e entrada) e
                        conciliar este lado.
                      </p>
                      <div>
                        <label className={labelCls}>{entrada ? "Veio de qual conta?" : "Foi para qual conta?"}</label>
                        <select value={cContraConta} onChange={(e) => setCContraConta(e.target.value)} className={campoCls}>
                          <option value="">Escolha a conta…</option>
                          {outras.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nome}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Descrição (opcional)</label>
                        <input value={cDescricao} onChange={(e) => setCDescricao(e.target.value)} className={campoCls} />
                      </div>
                      <p className="rounded-lg bg-surface/60 p-2 text-[11px] text-ink-soft">
                        A outra perna fica em aberto na conta escolhida e concilia quando você importar o extrato dela.
                      </p>
                    </>
                  ) : cModo === "estorno" ? (
                    <>
                      <p className="text-xs text-ink-soft">
                        Esta linha cancela um lançamento anterior (estorno ou devolução). Escolha o original — ele será
                        lançado na mesma categoria, anulando o efeito no resultado.
                      </p>
                      <div className="relative">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft" />
                        <input
                          value={cEstornoBusca}
                          onChange={(e) => setCEstornoBusca(e.target.value)}
                          placeholder="Buscar por descrição ou fornecedor…"
                          className="w-full rounded-lg border border-line py-2 pl-8 pr-2 text-sm outline-none focus:border-brand"
                        />
                      </div>
                      <div className="max-h-52 overflow-y-auto rounded-lg border border-line">
                        {(() => {
                          const bq = cEstornoBusca.trim().toLowerCase();
                          const abs = Math.abs(t.valor);
                          const lista = estornoCands
                            .filter(
                              (e) =>
                                !bq ||
                                (e.descricao ?? "").toLowerCase().includes(bq) ||
                                (e.pessoa_nome ?? "").toLowerCase().includes(bq),
                            )
                            .sort((x, y) => Math.abs(Number(x.valor) - abs) - Math.abs(Number(y.valor) - abs));
                          if (lista.length === 0)
                            return (
                              <EmptyState compacto titulo="Nenhum lançamento pago do tipo oposto encontrado" />
                            );
                          return lista.map((e) => {
                            const igual = Math.abs(Number(e.valor) - abs) < 0.005;
                            return (
                              <label
                                key={e.id}
                                className="flex cursor-pointer items-center gap-2 border-b border-line/60 px-3 py-2 text-sm last:border-0 hover:bg-surface/50"
                              >
                                <input
                                  type="radio"
                                  name="estornoOrig"
                                  checked={cEstornoOrig === e.id}
                                  onChange={() => setCEstornoOrig(e.id)}
                                  className="h-4 w-4 accent-brand"
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-ink">{e.descricao || e.pessoa_nome || "lançamento"}</span>
                                  <span className="block truncate text-[11px] text-ink-soft">
                                    {[e.pessoa_nome, e.categoria_nome].filter(Boolean).join(" · ")}
                                    {e.data_pagamento ? ` · pago ${dataBR(e.data_pagamento)}` : ""}
                                  </span>
                                </span>
                                <span className={`num shrink-0 text-sm font-semibold ${igual ? "text-brand-dark" : "text-ink"}`}>
                                  {brl(Number(e.valor))}
                                </span>
                              </label>
                            );
                          });
                        })()}
                      </div>
                      <div>
                        <label className={labelCls}>Descrição (opcional)</label>
                        <input value={cDescricao} onChange={(e) => setCDescricao(e.target.value)} className={campoCls} />
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-ink-soft">
                        Divida esta linha do extrato em vários lançamentos (categorias diferentes). A soma precisa fechar
                        o total de <span className="num font-semibold text-ink">{brl(t.valor)}</span>.
                      </p>
                      {rateioRows.map((r, i) => (
                        <div key={i} className="space-y-2 rounded-lg border border-line p-2">
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <ComboBusca
                                value={r.categoria_id}
                                onChange={(id) => updateRateioRow(i, { categoria_id: id })}
                                options={catsCriar.map((c) => ({ id: c.id, nome: c.nome }))}
                                placeholder="Categoria…"
                              />
                            </div>
                            <input
                              inputMode="decimal"
                              value={r.valor}
                              onChange={(e) => updateRateioRow(i, { valor: e.target.value })}
                              placeholder="0,00"
                              className={`num w-24 ${campoCls}`}
                            />
                            {rateioRows.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeRateioRow(i)}
                                className="rounded-lg p-1.5 text-ink-soft transition hover:bg-surface"
                                aria-label="Remover item"
                              >
                                <X size={15} />
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <ComboBusca
                                value={r.pessoa_id}
                                onChange={(id) => updateRateioRow(i, { pessoa_id: id })}
                                options={pessoasCriar.map((p) => ({ id: p.id, nome: p.nome, sub: p.cpf_cnpj }))}
                                placeholder={`${entrada ? "Cliente" : "Fornecedor"} (opcional)`}
                              />
                            </div>
                            <input
                              value={r.descricao}
                              onChange={(e) => updateRateioRow(i, { descricao: e.target.value })}
                              placeholder="descrição (opcional)"
                              className={`flex-[2] ${campoCls}`}
                            />
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={addRateioRow}
                        className="w-full rounded-lg border border-dashed border-line py-2 text-xs font-semibold text-ink-muted transition hover:bg-surface"
                      >
                        + Adicionar item
                      </button>
                      <div className="flex items-center justify-between rounded-md bg-surface/60 px-2.5 py-1.5 text-xs">
                        <span className="text-ink-soft">
                          Soma <span className="num font-semibold text-ink">{brl(rateioSoma)}</span> de{" "}
                          <span className="num font-semibold text-ink">{brl(rateioTotal)}</span>
                        </span>
                        <span className={`num font-bold ${rateioOk ? "text-brand" : "text-ink"}`}>
                          {Math.abs(rateioResta) < 0.005
                            ? "fecha ✓"
                            : rateioResta > 0
                              ? "falta " + brl(rateioResta)
                              : "sobra " + brl(-rateioResta)}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
                  <button
                    type="button"
                    onClick={() => setCriarAlvo(null)}
                    className="rounded-md border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-muted transition hover:bg-surface"
                  >
                    Cancelar
                  </button>
                  {cModo === "lancamento" ? (
                    <Botao variante="primario"
                      onClick={salvarCriarLancamento}
                      disabled={salvandoCriar || !cCategoria}
                    >
                      {salvandoCriar ? "Criando…" : "Criar e conciliar"}
                    </Botao>
                  ) : cModo === "transferencia" ? (
                    <Botao variante="primario"
                      onClick={salvarCriarTransferencia}
                      disabled={salvandoCriar || !cContraConta}
                    >
                      {salvandoCriar ? "Registrando…" : "Registrar transferência"}
                    </Botao>
                  ) : cModo === "estorno" ? (
                    <Botao variante="primario"
                      onClick={salvarCriarEstorno}
                      disabled={salvandoCriar || !cEstornoOrig}
                    >
                      {salvandoCriar ? "Registrando…" : "Registrar estorno"}
                    </Botao>
                  ) : (
                    <Botao variante="primario"
                      onClick={salvarCriarRateio}
                      disabled={salvandoCriar || !rateioOk}
                    >
                      {salvandoCriar ? "Dividindo…" : "Dividir e conciliar"}
                    </Botao>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

      {/* preview do PDF */}
      {pdfLinhas !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-rail/50 p-4">
          <div className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-xl2 bg-white shadow-card" role="dialog" aria-modal="true" aria-labelledby="dlg-revisar-pdf-titulo">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div>
                <h3 id="dlg-revisar-pdf-titulo" className="text-base font-bold text-ink">Revisar transações do PDF</h3>
                <p className="text-xs text-ink-muted">
                  Extração aproximada — confira e desmarque o que vier errado antes de importar.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-ink-soft">Ano</label>
                <input
                  type="number"
                  value={pdfAno}
                  onChange={(e) => setPdfAno(Number(e.target.value) || new Date().getFullYear())}
                  className="num w-20 rounded-md border border-line px-2 py-1 text-sm outline-none focus:border-brand"
                  title="Usado nas datas sem ano (dd/mm)"
                />
              </div>
            </div>

            <div className="flex items-center justify-between border-b border-line px-5 py-2">
              <label className="flex items-center gap-2 text-xs font-medium text-ink">
                <input
                  type="checkbox"
                  checked={pdfPendentes.length > 0 && pdfMarcados.size === pdfPendentes.length}
                  onChange={(e) => setPdfMarcados(e.target.checked ? new Set(pdfPendentes.map((_, i) => i)) : new Set())}
                  className="h-4 w-4 accent-brand"
                />
                Selecionar todas ({pdfPendentes.length})
              </label>
              <span className="text-xs text-ink-soft">{pdfMarcados.size} marcadas</span>
            </div>

            <div className="flex-1 overflow-y-auto">
              {pdfPendentes.length === 0 ? (
                <EmptyState compacto titulo="Nenhuma transação reconhecida no PDF" />
              ) : (
                pdfPendentes.map((t, i) => {
                  const entrada = t.valor >= 0;
                  return (
                    <label
                      key={i}
                      className="flex cursor-pointer items-center gap-3 border-b border-line/60 px-5 py-2.5 text-sm last:border-0 hover:bg-surface/50"
                    >
                      <input
                        type="checkbox"
                        checked={pdfMarcados.has(i)}
                        onChange={() =>
                          setPdfMarcados((s) => {
                            const n = new Set(s);
                            if (n.has(i)) n.delete(i);
                            else n.add(i);
                            return n;
                          })
                        }
                        className="h-4 w-4 accent-brand"
                      />
                      <span className="num w-20 text-ink-muted">{dataBR(t.data)}</span>
                      <span className="flex-1 truncate text-ink">{t.descricao || "—"}</span>
                      <span className={`num font-semibold ${entrada ? "text-brand" : "text-ink"}`}>{brl(t.valor)}</span>
                    </label>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
              <button
                type="button"
                data-fechar
                onClick={() => setPdfLinhas(null)}
                className="rounded-md border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink transition hover:bg-surface"
              >
                Cancelar
              </button>
              <Botao variante="primario"
                onClick={importarPDF}
                disabled={pdfMarcados.size === 0}
              >
                Importar {pdfMarcados.size} para conciliar
              </Botao>
            </div>
          </div>
        </div>
      )}

      <p className="text-[11px] text-ink-soft">
        Conciliar marca o(s) lançamento(s) como pago(s) na data do extrato e tira a linha da lista. Diferenças (desconto,
        juros, tarifa) viram um lançamento de ajuste conciliado. A mesma transação do extrato não é importada duas vezes.
      </p>
    </div>
  );
}

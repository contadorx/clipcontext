"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, FileDown, AlertTriangle, CheckCircle2, Info, BellRing } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { temAdapter, gerarArquivo, FORMATOS_NATIVOS } from "@/lib/contabil/adapters";
import MessageStrip from "@/components/ui/message-strip";
import Card from "@/components/ui/card";
import { dataBR } from "@/lib/formato";
import Botao from "@/components/ui/botao";
import { classeControle } from "@/components/ui/campo";

type Conta = { id: string; nome: string; codigo_contabil: string | null };
type LancRaw = {
  id: string;
  tipo: string;
  valor: number;
  juros: number | null;
  multa: number | null;
  desconto: number | null;
  pagamento_dados: { ajuste?: string } | null;
  descricao: string | null;
  data_pagamento: string | null;
  data_competencia: string;
  conta: { nome: string; codigo_contabil: string | null } | null;
  categoria: {
    nome: string;
    codigo_contabil: string | null;
    provisionamento: string | null;
    codigo_provisao: string | null;
    visao: string | null;
  } | null;
  pessoa: { nome: string; codigo_contabil: string | null } | null;
};
type Partida = { data: string; debito: string; credito: string; valor: number; historico: string };
type EncargosCfg = { jurosPago: string; jurosReceb: string; multa: string; descObtido: string; descConcedido: string };
type PessoasCfg = { modo: "analitico" | "sintetico"; clientes: string; fornecedores: string };
type MotivoFalta = "resultado" | "banco" | "provisao" | "pessoa" | "pessoaSintetica" | "juros" | "multa" | "desconto";
type DiagData = {
  cnpjAusente: boolean;
  spedNota: boolean;
  cats: string[];
  pessoas: string[];
  contrapartida: string[];
  contas: string[];
  provisao: string[];
  encargos: string[];
  ignorados: number;
};

// Monta as partidas de um lançamento conforme o provisionamento da categoria.
// Retorna também os MOTIVOS de falta (código de resultado, conta, provisão ou encargo)
// quando uma partida que caía no período ficou sem o código necessário.
function partidasDe(
  l: LancRaw,
  base: "caixa" | "competencia",
  de: string,
  ate: string,
  enc: EncargosCfg,
  pessoas: PessoasCfg,
): { partidas: Partida[]; motivos: MotivoFalta[] } {
  const entrada = l.tipo === "entrada";
  const codContato = l.pessoa?.codigo_contabil?.trim() || "";
  const temPessoa = !!l.pessoa;
  // Conta de RESULTADO: sempre a da categoria (receita/despesa).
  let result = l.categoria?.codigo_contabil?.trim() || "";
  // Ajuste de conciliação (juros/desconto) sem categoria: roteia para a conta de encargo parametrizada.
  const natAjuste = l.pagamento_dados?.ajuste;
  if (!result && natAjuste === "juros") result = (entrada ? enc.jurosReceb : enc.jurosPago).trim();
  if (!result && natAjuste === "desconto") result = (entrada ? enc.descObtido : enc.descConcedido).trim();
  // CONTRAPARTIDA patrimonial (a receber / a pagar), usada na provisão e na baixa:
  //  - com pessoa, modo analítico  -> conta da própria pessoa;
  //  - com pessoa, modo sintético  -> conta única da empresa (clientes/fornecedores);
  //  - sem pessoa                  -> código de provisão da categoria.
  let balance = "";
  let balanceMotivo: MotivoFalta | null = null;
  if (temPessoa) {
    if (pessoas.modo === "analitico") {
      balance = codContato;
      if (!balance) balanceMotivo = "pessoa";
    } else {
      balance = (entrada ? pessoas.clientes : pessoas.fornecedores).trim();
      if (!balance) balanceMotivo = "pessoaSintetica";
    }
  } else {
    balance = l.categoria?.codigo_provisao?.trim() || "";
    if (!balance) balanceMotivo = "provisao";
  }
  const bank = l.conta?.codigo_contabil?.trim() || "";
  const prov = l.categoria?.provisionamento || "nao_provisionado";
  const comp = l.data_competencia;
  const pag = l.data_pagamento;
  const total = Number(l.valor) || 0;
  const juros = Number(l.juros) || 0;
  const multa = Number(l.multa) || 0;
  const desconto = Number(l.desconto) || 0;
  const round2 = (x: number) => Math.round(x * 100) / 100;
  // `valor` é o total que circulou no banco; o principal (categoria) tira os encargos.
  const principal = round2(total - juros - multa + desconto);
  const inRange = (d: string | null): d is string => !!d && d >= de && d <= ate;
  const hist = (pref: string) =>
    `${pref} ${l.descricao || l.categoria?.nome || ""}${l.pessoa?.nome ? " - " + l.pessoa.nome : ""}`.trim();

  const partidas: Partida[] = [];
  const motivos = new Set<MotivoFalta>();

  // Encargos lançados contra o banco, no momento em que o caixa se move.
  const pushEncargos = (d: string) => {
    if (juros > 0) {
      const cod = (entrada ? enc.jurosReceb : enc.jurosPago).trim();
      if (cod && bank)
        partidas.push({ data: d, debito: entrada ? bank : cod, credito: entrada ? cod : bank, valor: juros, historico: hist(entrada ? "JUROS REC" : "JUROS PAG") });
      else { if (!cod) motivos.add("juros"); if (!bank) motivos.add("banco"); }
    }
    if (multa > 0) {
      const cod = enc.multa.trim();
      if (cod && bank)
        partidas.push({ data: d, debito: entrada ? bank : cod, credito: entrada ? cod : bank, valor: multa, historico: hist("MULTA") });
      else { if (!cod) motivos.add("multa"); if (!bank) motivos.add("banco"); }
    }
    if (desconto > 0) {
      const cod = (entrada ? enc.descConcedido : enc.descObtido).trim();
      if (cod && bank)
        partidas.push({ data: d, debito: entrada ? cod : bank, credito: entrada ? bank : cod, valor: desconto, historico: hist(entrada ? "DESC CONCEDIDO" : "DESC OBTIDO") });
      else { if (!cod) motivos.add("desconto"); if (!bank) motivos.add("banco"); }
    }
  };

  if (prov === "nao_provisionado") {
    const d = base === "caixa" ? pag : comp;
    if (inRange(d)) {
      if (principal !== 0) {
        if (result && bank)
          partidas.push({
            data: d,
            debito: entrada ? bank : result,
            credito: entrada ? result : bank,
            valor: principal,
            historico: hist(entrada ? "REC" : "PAG"),
          });
        else { if (!result) motivos.add("resultado"); if (!bank) motivos.add("banco"); }
      }
      pushEncargos(d);
    }
  }

  if (prov === "provisao" || prov === "provisao_e_baixa") {
    if (inRange(comp)) {
      if (principal !== 0) {
        if (result && balance)
          partidas.push({
            data: comp,
            debito: entrada ? balance : result,
            credito: entrada ? result : balance,
            valor: principal,
            historico: hist(entrada ? "PROV REC" : "PROV PAG"),
          });
        else { if (!result) motivos.add("resultado"); if (!balance && balanceMotivo) motivos.add(balanceMotivo); }
      }
    }
  }

  if (prov === "baixa_provisao" || prov === "provisao_e_baixa") {
    if (inRange(pag)) {
      if (principal !== 0) {
        if (balance && bank)
          partidas.push({
            data: pag,
            debito: entrada ? bank : balance,
            credito: entrada ? balance : bank,
            valor: principal,
            historico: hist(entrada ? "REC" : "PAG"),
          });
        else { if (!balance && balanceMotivo) motivos.add(balanceMotivo); if (!bank) motivos.add("banco"); }
      }
      pushEncargos(pag);
    }
  }

  return { partidas, motivos: Array.from(motivos) };
}

// Converte o diagnóstico em blocos legíveis para o painel de prontidão.
function blocosDiag(d: DiagData): { label: string; itens?: string[]; obs?: string }[] {
  const out: { label: string; itens?: string[]; obs?: string }[] = [];
  if (d.cnpjAusente) out.push({ label: "CNPJ da empresa não cadastrado", obs: "o arquivo sai sem CNPJ no nome e no cabeçalho" });
  if (d.cats.length) out.push({ label: "Categorias sem código contábil", itens: d.cats });
  if (d.pessoas.length) out.push({ label: "Clientes/fornecedores sem código contábil (modo analítico)", itens: d.pessoas });
  if (d.contrapartida.length) out.push({ label: "Contrapartida sintética não configurada", itens: d.contrapartida, obs: "defina em Configurações Contábeis → Clientes e fornecedores" });
  if (d.contas.length) out.push({ label: "Contas bancárias sem código contábil", itens: d.contas });
  if (d.provisao.length) out.push({ label: "Categorias sem código de provisão", itens: d.provisao });
  if (d.encargos.length) {
    const lbl: Record<string, string> = { juros: "Juros", multa: "Multa", desconto: "Desconto" };
    out.push({ label: "Encargos sem conta configurada", itens: d.encargos.map((e) => lbl[e] || e), obs: "defina em Configurações Contábeis → Contas de encargos" });
  }
  return out;
}

type Cfg = {
  sep: string;
  data: "br" | "iso" | "compact";
  decimal: "virgula" | "ponto" | "sem";
  header: boolean;
  ext: "csv" | "txt";
};

// Lista completa de sistemas contábeis (referência Nibo)
const SISTEMAS = [
  "Accounting Manager", "Alterdata", "Apollo", "Asplan", "Athenas 3000", "Calima",
  "Contab Milenium", "Contabil-Tec", "Contmatic", "Controller", "Cordilheira", "Cuca Fresca",
  "Dexion", "Digibyte", "Domínio", "DPCont", "E-Contab", "Exactus", "Folhamatic", "Fortes",
  "Frim Informática", "Glandata", "HiTech", "IOB", "JBCepil", "Ledware", "Lider", "Makrosystem",
  "Mastermaa", "Mega Contábil", "Microsiga", "MMBuilders", "Módulos", "Mxm", "Nasajon",
  "Netspeed", "Nooven", "Nosso Programa", "Ph Software", "Prosis", "Prosoft", "Prosol",
  "Questor", "QYON", "Radar", "Rm", "RTA Sistemas", "Rumo", "Sage", "Sci", "Sibrax", "Sismont",
  "Sofolha", "SoftGuils", "Sophia", "Super Soft", "Tron", "ZCon", "Outros",
];

// Layouts já validados oficialmente (por enquanto nenhum — só o CSV genérico).
const CONFIGURADOS = new Set<string>(["Genérico (CSV)", ...FORMATOS_NATIVOS]);

function presetFor(s: string): Cfg {
  if (s === "Genérico (CSV)") return { sep: ";", data: "br", decimal: "virgula", header: true, ext: "csv" };
  if (s === "Domínio") return { sep: "|", data: "br", decimal: "sem", header: false, ext: "txt" };
  return { sep: ";", data: "br", decimal: "virgula", header: false, ext: "txt" };
}

function inicioMes(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function fimMes(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
}
function fmtData(iso: string, modo: Cfg["data"]): string {
  const [a, m, d] = iso.split("-");
  if (modo === "iso") return iso;
  if (modo === "compact") return `${d}${m}${a}`;
  return `${d}/${m}/${a}`;
}
function fmtValor(v: number, modo: Cfg["decimal"]): string {
  if (modo === "sem") return String(Math.round(v * 100));
  if (modo === "ponto") return v.toFixed(2);
  return v.toFixed(2).replace(".", ",");
}

export default function ExportarContabil({
  empresaId,
  empresaNome,
  sistema,
  contas,
}: {
  empresaId: string;
  empresaNome: string;
  sistema: string;
  contas: Conta[];
}) {
  const [de, setDe] = useState(inicioMes());
  const [ate, setAte] = useState(fimMes());
  const [base, setBase] = useState<"caixa" | "competencia">("caixa");
  const [idsExport, setIdsExport] = useState<string[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set(contas.map((c) => c.id)));
  const [gerando, setGerando] = useState(false);
  const [partidas, setPartidas] = useState<Partida[] | null>(null);
  const [ignorados, setIgnorados] = useState(0);
  const [diag, setDiag] = useState<DiagData | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // definições contábeis da empresa (somente leitura aqui — editadas em Configurações Contábeis)
  const [enc, setEnc] = useState<EncargosCfg>({ jurosPago: "", jurosReceb: "", multa: "", descObtido: "", descConcedido: "" });
  const [pessoas, setPessoas] = useState<PessoasCfg>({ modo: "sintetico", clientes: "", fornecedores: "" });
  const [cnpj, setCnpj] = useState("");
  const [histPadrao, setHistPadrao] = useState("");

  const formatoInicial = SISTEMAS.includes(sistema) ? sistema : "Genérico (CSV)";
  const [formato, setFormato] = useState<string>(formatoInicial);
  const [custom, setCustom] = useState<Cfg>({ sep: ";", data: "br", decimal: "virgula", header: true, ext: "txt" });
  const cfg: Cfg = formato === "Personalizado" ? custom : presetFor(formato);

  // solicitação de layout oficial
  const [contato, setContato] = useState("");
  const [obs, setObs] = useState("");
  const [solicitando, setSolicitando] = useState(false);
  const [pedidos, setPedidos] = useState<Set<string>>(new Set());

  useEffect(() => {
    setContato("");
    setObs("");
  }, [formato]);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("empresas")
      .select(
        "cont_juros_pago, cont_juros_receb, cont_multa, cont_desc_obtido, cont_desc_concedido, cont_pessoas_modo, cont_clientes, cont_fornecedores, cont_historico, cnpj_cpf",
      )
      .eq("id", empresaId)
      .maybeSingle()
      .then(({ data }) => {
        const e = data as Record<string, string | null> | null;
        if (e) {
          setEnc({
            jurosPago: e.cont_juros_pago ?? "",
            jurosReceb: e.cont_juros_receb ?? "",
            multa: e.cont_multa ?? "",
            descObtido: e.cont_desc_obtido ?? "",
            descConcedido: e.cont_desc_concedido ?? "",
          });
          setPessoas({
            modo: e.cont_pessoas_modo === "analitico" ? "analitico" : "sintetico",
            clientes: e.cont_clientes ?? "",
            fornecedores: e.cont_fornecedores ?? "",
          });
          setHistPadrao(e.cont_historico ?? "");
          setCnpj(e.cnpj_cpf ?? "");
        }
      });
  }, [empresaId]);

  const precisaConfig = formato !== "Personalizado" && !CONFIGURADOS.has(formato);
  const jaPedido = pedidos.has(formato);

  function toggleConta(id: string) {
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function solicitar() {
    setSolicitando(true);
    const supabase = createClient();
    const { error } = await supabase.from("solicitacoes_layout_contabil").insert({
      empresa_id: empresaId,
      sistema: formato,
      contato: contato.trim() || null,
      observacao: obs.trim() || null,
    });
    setSolicitando(false);
    if (error) {
      setMsg("Não consegui registrar o pedido: " + error.message);
      return;
    }
    setPedidos((s) => new Set(s).add(formato));
  }

  async function gerar() {
    setMsg(null);
    setGerando(true);
    setPartidas(null);
    setDiag(null);
    const supabase = createClient();
    const contaIds = sel.size > 0 ? Array.from(sel) : contas.map((c) => c.id);

    let q = supabase
      .from("lancamentos")
      .select(
        "id, tipo, valor, juros, multa, desconto, pagamento_dados, descricao, data_pagamento, data_competencia, conta:contas_bancarias(nome, codigo_contabil), categoria:categorias(nome, codigo_contabil, provisionamento, codigo_provisao, visao), pessoa:clientes_fornecedores(nome, codigo_contabil)",
      )
      .eq("empresa_id", empresaId)
      .in("conta_id", contaIds)
      .or(
        `and(data_competencia.gte.${de},data_competencia.lte.${ate}),and(data_pagamento.gte.${de},data_pagamento.lte.${ate})`,
      );

    const { data, error } = await q.order("data_competencia");
    setGerando(false);
    if (error) {
      setMsg("Erro ao buscar lançamentos: " + error.message);
      return;
    }
    const lancs = ((data as unknown) as LancRaw[]) ?? [];
    const out: Partida[] = [];
    const catsSem = new Set<string>();
    const pessoasSem = new Set<string>();
    const contrapSem = new Set<string>();
    const contasSem = new Set<string>();
    const provSem = new Set<string>();
    const encSem = new Set<string>();
    let ign = 0;
    const idsExp: string[] = [];
    for (const l of lancs) {
      const { partidas, motivos } = partidasDe(l, base, de, ate, enc, pessoas);
      out.push(...partidas);
      if (partidas.length > 0) idsExp.push(l.id);
      if (motivos.length === 0) continue;
      ign++;
      for (const m of motivos) {
        if (m === "resultado") {
          if (l.categoria) catsSem.add(l.categoria.nome);
          else if (l.pagamento_dados?.ajuste === "juros") encSem.add("juros");
          else if (l.pagamento_dados?.ajuste === "desconto") encSem.add("desconto");
        } else if (m === "banco") contasSem.add(l.conta?.nome || "(sem conta)");
        else if (m === "pessoa") pessoasSem.add(l.pessoa?.nome || "(sem nome)");
        else if (m === "pessoaSintetica") contrapSem.add(l.tipo === "entrada" ? "Clientes a receber" : "Fornecedores a pagar");
        else if (m === "provisao" && l.categoria) provSem.add(l.categoria.nome);
        else if (m === "juros" || m === "multa" || m === "desconto") encSem.add(m);
      }
    }
    out.sort((a, b) => a.data.localeCompare(b.data));
    setPartidas(out);
    setIdsExport(idsExp);
    setIgnorados(ign);
    setDiag({
      cnpjAusente: !cnpj.trim(),
      spedNota: formato === "SPED ECD",
      cats: Array.from(catsSem),
      pessoas: Array.from(pessoasSem),
      contrapartida: Array.from(contrapSem),
      contas: Array.from(contasSem),
      provisao: Array.from(provSem),
      encargos: Array.from(encSem),
      ignorados: ign,
    });
    if (out.length === 0)
      setMsg(
        ign > 0
          ? `Nenhuma partida gerada: ${ign} lançamento(s) sem código contábil. Veja o diagnóstico abaixo.`
          : "Nenhum lançamento no período/contas selecionados.",
      );
  }

  /**
   * Marca os lançamentos como exportados — e diz se não conseguiu.
   *
   * O arquivo já foi baixado e vai para o contador quando esta função roda. Se
   * a marcação falha em silêncio, os mesmos lançamentos saem **de novo** na
   * próxima exportação e entram em dobro no sistema contábil do cliente —
   * problema que só aparece do outro lado, semanas depois, e que ninguém
   * relaciona com um botão de download.
   */
  async function marcarExportados(): Promise<string | null> {
    if (idsExport.length === 0) return null;
    const supabase = createClient();
    const r = await supabase
      .from("lancamentos")
      .update({ exportado_em: new Date().toISOString() })
      .in("id", idsExport);
    return r.error
      ? `O arquivo foi gerado, mas os lançamentos não foram marcados como exportados (${r.error.message}). Marque como exportado em Movimentações, ou eles sairão de novo na próxima exportação.`
      : null;
  }

  async function baixar() {
    if (!partidas || partidas.length === 0) return;
    if (temAdapter(formato)) {
      const [ano, mes] = de.split("-").map((x) => Number(x));
      const linhas = partidas.map((p) => ({
        data: p.data,
        contaDebito: p.debito,
        contaCredito: p.credito,
        valor: p.valor,
        codHistorico: histPadrao.trim(),
        complemento: p.historico,
      }));
      const arq = await gerarArquivo(formato, linhas, {
        cnpj,
        nome: empresaNome,
        ano: ano || new Date().getFullYear(),
        mes: mes || 1,
        loteNumero: 1,
      });
      if (arq) {
        const blob = new Blob([arq.conteudo], { type: arq.mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = arq.nomeArquivo;
        a.click();
        URL.revokeObjectURL(url);
        const aviso = await marcarExportados();
        if (aviso) setMsg(aviso);
      }
      return;
    }
    const esc = (s: string) => (cfg.sep === ";" || cfg.sep === "," ? `"${s.replace(/"/g, '""')}"` : s);
    const linhas: string[] = [];
    if (cfg.header) linhas.push(["Data", "Debito", "Credito", "Valor", "Historico"].join(cfg.sep));
    for (const p of partidas) {
      linhas.push(
        [fmtData(p.data, cfg.data), p.debito, p.credito, fmtValor(p.valor, cfg.decimal), esc(p.historico)].join(
          cfg.sep,
        ),
      );
    }
    const conteudo = linhas.join("\r\n");
    const blob = new Blob([cfg.ext === "csv" ? "\uFEFF" + conteudo : conteudo], {
      type: cfg.ext === "csv" ? "text/csv;charset=utf-8" : "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const tag = formato.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    a.href = url;
    a.download = `contabil-${tag}-${de}_a_${ate}.${cfg.ext}`;
    a.click();
    URL.revokeObjectURL(url);
    const aviso = await marcarExportados();
    if (aviso) setMsg(aviso);
  }

  const inputData = "num rounded-md border border-line px-2.5 py-1.5 text-[12.5px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";
  const selCls = "rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand";
  const blocos = diag ? blocosDiag(diag) : [];

  return (
    <div className="space-y-5">
      {/* parâmetros */}
      <div className="rounded-xl2 bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-ink-soft">De</label>
            <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className={inputData} />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-ink-soft">Até</label>
            <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className={inputData} />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-ink-soft">Base (sem provisão)</label>
            <div className="flex items-center gap-0.5 rounded-lg border border-line p-0.5 text-xs">
              {[
                { v: "caixa", l: "Caixa (pago)" },
                { v: "competencia", l: "Competência" },
              ].map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setBase(o.v as "caixa" | "competencia")}
                  className={
                    base === o.v
                      ? "rounded-md bg-brand px-3 py-1.5 font-semibold text-white"
                      : "rounded-md px-3 py-1.5 font-medium text-ink-muted transition hover:bg-surface"
                  }
                >
                  {o.l}
                </button>
              ))}
            </div>
          </div>
          <Botao variante="primario" className="ml-auto"
            onClick={gerar}
            disabled={gerando}
          >
            {gerando ? "Gerando…" : "Gerar prévia"}
          </Botao>
        </div>

        {contas.length > 0 && (
          <div className="mt-4 border-t border-line pt-3">
            <p className="mb-2 text-[11px] font-semibold text-ink-soft">Contas bancárias</p>
            <div className="flex flex-wrap gap-2">
              {contas.map((c) => (
                <label
                  key={c.id}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition ${
                    sel.has(c.id) ? "border-brand bg-brand-light text-brand-dark" : "border-line text-ink-muted"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={sel.has(c.id)}
                    onChange={() => toggleConta(c.id)}
                    className="h-3.5 w-3.5 accent-brand"
                  />
                  {c.nome}
                  {!c.codigo_contabil && <span className="text-danger">(sem código)</span>}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* formato do arquivo */}
      <Card titulo="Formato do arquivo">
        <div className="mt-3 flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-ink-soft">Sistema contábil</label>
            <select value={formato} onChange={(e) => setFormato(e.target.value)} className={selCls}>
              <option value="Genérico (CSV)">Genérico (CSV)</option>
              <option value="Planilha de lançamentos (padrão)">Planilha de lançamentos (padrão)</option>
              <option value="SPED ECD">SPED ECD (lançamentos)</option>
              {SISTEMAS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
              <option value="Personalizado">Personalizado</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-ink-soft">Separador</label>
            <select
              value={cfg.sep}
              disabled={formato !== "Personalizado"}
              onChange={(e) => setCustom((c) => ({ ...c, sep: e.target.value }))}
              className={`${selCls} disabled:opacity-60`}
            >
              <option value=";">; (ponto e vírgula)</option>
              <option value="|">| (pipe)</option>
              <option value=",">, (vírgula)</option>
              <option value={"\t"}>Tab</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-ink-soft">Data</label>
            <select
              value={cfg.data}
              disabled={formato !== "Personalizado"}
              onChange={(e) => setCustom((c) => ({ ...c, data: e.target.value as Cfg["data"] }))}
              className={`${selCls} disabled:opacity-60`}
            >
              <option value="br">dd/mm/aaaa</option>
              <option value="iso">aaaa-mm-dd</option>
              <option value="compact">ddmmaaaa</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-ink-soft">Valor</label>
            <select
              value={cfg.decimal}
              disabled={formato !== "Personalizado"}
              onChange={(e) => setCustom((c) => ({ ...c, decimal: e.target.value as Cfg["decimal"] }))}
              className={`${selCls} disabled:opacity-60`}
            >
              <option value="virgula">1234,56</option>
              <option value="ponto">1234.56</option>
              <option value="sem">123456 (centavos)</option>
            </select>
          </div>
          <label className="flex items-center gap-2 pb-2 text-xs text-ink">
            <input
              type="checkbox"
              checked={cfg.header}
              disabled={formato !== "Personalizado"}
              onChange={(e) => setCustom((c) => ({ ...c, header: e.target.checked }))}
              className="h-4 w-4 accent-brand disabled:opacity-60"
            />
            Cabeçalho
          </label>
        </div>

        {temAdapter(formato) && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-brand/30 bg-brand-light px-3 py-2.5 text-xs text-brand-dark">
            <Info size={15} className="mt-0.5 shrink-0" />
            <span>
              Gera o arquivo nativo do <b>{formato}</b>{cnpj ? "" : " (cadastre o CNPJ da empresa para o nome do arquivo e o cabeçalho)"}. Os
              campos de separador/data/valor acima não se aplicam. Confirme o layout no seu sistema antes de produção — o
              histórico vai no complemento; o código de histórico padrão é definido em Configurações Contábeis.
              {formato === "SPED ECD" &&
                " Atenção: gera só a camada de lançamentos (I200/I250); plano de contas, saldos, DRE e a validação no PVA precisam ser completados no contábil."}
            </span>
          </div>
        )}

        {/* aviso + pedido de configuração oficial */}
        {precisaConfig &&
          (jaPedido ? (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-brand/30 bg-brand-light px-3 py-2.5 text-xs text-brand-dark">
              <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
              <span>
                Pedido registrado para <b>{formato}</b>! Vamos configurar o layout oficial e entrar em contato. Por
                enquanto, dá pra exportar no formato genérico ou ajustar em “Personalizado”.
              </span>
            </div>
          ) : (
            <div className="mt-3 rounded-lg border border-line bg-surface px-3 py-3">
              <div className="flex items-start gap-2 text-xs text-ink-muted">
                <Info size={15} className="mt-0.5 shrink-0 text-ink-soft" />
                <span>
                  O layout oficial do <b>{formato}</b> ainda não está configurado (o que sai aqui é um formato
                  genérico, ponto de partida). Quer que a gente configure o layout exato dele pra você? Deixe um
                  contato que avisamos quando estiver pronto.
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  value={contato}
                  onChange={(e) => setContato(e.target.value)}
                  placeholder="Seu e-mail ou WhatsApp (opcional)"
                  className={classeControle("md", false, "flex-1")}
                />
                <button
                  type="button"
                  onClick={solicitar}
                  disabled={solicitando}
                  className="flex items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                >
                  <BellRing size={14} /> {solicitando ? "Enviando…" : "Quero configurar este sistema"}
                </button>
              </div>
            </div>
          ))}
      </Card>

      {msg && (
        <MessageStrip tipo="erro">{msg}</MessageStrip>
      )}

      {/* diagnóstico de prontidão */}
      {diag && (
        <div
          className={`rounded-xl2 border px-5 py-4 text-sm shadow-card ${
            blocos.length === 0 ? "border-brand/30 bg-brand-light" : "border-amber-300 bg-amber-50"
          }`}
        >
          <div className="flex items-center gap-2 font-semibold">
            {blocos.length === 0 ? (
              <CheckCircle2 size={16} className="text-brand" />
            ) : (
              <AlertTriangle size={16} className="text-amber-600" />
            )}
            <span className={blocos.length === 0 ? "text-brand-dark" : "text-amber-800"}>
              {blocos.length === 0 ? "Pronto para exportar — tudo mapeado neste período." : "Diagnóstico de prontidão"}
            </span>
          </div>
          {blocos.length > 0 && (
            <>
              <ul className="mt-2 space-y-1.5 text-xs text-amber-900">
                {blocos.map((b, i) => (
                  <li key={i}>
                    <b>{b.label}</b>
                    {b.itens && `: ${b.itens.join(", ")}`}
                    {b.obs && <span className="text-amber-700"> — {b.obs}</span>}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-amber-700">
                {diag.ignorados > 0 && `${diag.ignorados} lançamento(s) ficaram de fora do arquivo. `}
                Ajuste em{" "}
                <Link href="/configuracoes/contabil" className="font-semibold underline">
                  Configurações Contábeis
                </Link>
                .
              </p>
            </>
          )}
          {diag.spedNota && (
            <p className="mt-2 text-[11px] text-ink-soft">
              SPED ECD: o app ainda não guarda UF, inscrição estadual e código do município — o registro 0000 sai com
              identidade mínima (CNPJ e nome). Complete no contábil/PVA.
            </p>
          )}
        </div>
      )}

      {/* prévia */}
      {partidas && partidas.length > 0 && (
        <div className="rounded-xl2 bg-white shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 size={16} className="text-brand" />
              <span className="font-semibold text-ink">{partidas.length} partidas</span>
              {ignorados > 0 && <span className="text-ink-soft">· {ignorados} sem código contábil</span>}
            </div>
            <Botao variante="primario"
              onClick={baixar}
            >
              <Download size={15} /> Baixar ({temAdapter(formato) ? formato + " (nativo)" : formato + " · ." + cfg.ext})
            </Botao>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[680px]">
              <div className="grid grid-cols-[90px_100px_100px_110px_1fr] gap-3 border-b border-line px-5 py-2 text-[11px] font-semibold text-ink-soft">
                <span>Data</span>
                <span>Débito</span>
                <span>Crédito</span>
                <span className="text-right">Valor</span>
                <span>Histórico</span>
              </div>
              {partidas.slice(0, 80).map((p, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[90px_100px_100px_110px_1fr] gap-3 border-b border-line/60 px-5 py-2 text-xs last:border-0"
                >
                  <span className="num text-ink-muted">{dataBR(p.data)}</span>
                  <span className="num text-ink">{p.debito}</span>
                  <span className="num text-ink">{p.credito}</span>
                  <span className="num text-right font-semibold text-ink">{fmtValor(p.valor, cfg.decimal)}</span>
                  <span className="truncate text-ink-muted">{p.historico}</span>
                </div>
              ))}
              {partidas.length > 80 && (
                <p className="px-5 py-2 text-[11px] text-ink-soft">
                  Mostrando 80 de {partidas.length} — o arquivo terá todas.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {!partidas && (
        <div className="flex flex-col items-center justify-center rounded-xl2 border border-dashed border-line bg-white py-16 text-ink-soft">
          <FileDown size={28} strokeWidth={1.5} />
          <p className="mt-2 text-sm">Escolha o período e o formato, depois “Gerar prévia”.</p>
        </div>
      )}
    </div>
  );
}

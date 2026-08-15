"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UploadCloud, Download, CheckCircle2, ArrowLeft, ArrowRight, Wand2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { lerArquivoComoGrid } from "@/lib/importador/config";
import Tabela, { LinhaTabela } from "@/components/ui/tabela";
import type { ColunaDef } from "@/components/ui/config-colunas";
import { matchRegra, type RegraClassificacao } from "@/lib/conciliacao/regras";
import { carregarRegrasCombinadas } from "@/lib/conciliacao/regras-client";
import MessageStrip from "@/components/ui/message-strip";
import Card from "@/components/ui/card";
import { brl } from "@/lib/formato";
import Botao from "@/components/ui/botao";
import { classeControle } from "@/components/ui/campo";

type Opt = { id: string; nome: string; tipo?: string };

type CampoId = "tipo" | "venc" | "comp" | "pag" | "valor" | "descricao" | "categoria" | "conta" | "pessoa" | "centro";

type LinhaParse = {
  linha: number;
  tipo: "entrada" | "saida" | null;
  valor: number;
  venc: string | null;
  comp: string | null;
  pag: string | null;
  descricao: string;
  categoriaNome: string;
  categoriaId: string | null;
  contaNome: string;
  contaId: string | null;
  pessoaNome: string;
  pessoaId: string | null;
  centroNome: string;
  centroId: string | null;
  erros: string[];
};

const CAMPOS: { id: CampoId; label: string; obrig: boolean; dica?: string }[] = [
  { id: "tipo", label: "Tipo (entrada/saída)", obrig: true },
  { id: "venc", label: "Data de vencimento", obrig: true },
  { id: "valor", label: "Valor", obrig: true },
  { id: "comp", label: "Data de competência", obrig: false, dica: "se vazio, usa o vencimento" },
  { id: "pag", label: "Data de pagamento", obrig: false, dica: "deixa o lançamento já baixado" },
  { id: "descricao", label: "Descrição / histórico", obrig: false },
  { id: "categoria", label: "Categoria", obrig: false, dica: "casada pelo nome" },
  { id: "conta", label: "Conta bancária", obrig: false, dica: "casada pelo nome" },
  { id: "pessoa", label: "Cliente / fornecedor", obrig: false, dica: "casado pelo nome" },
  { id: "centro", label: "Centro de custo", obrig: false, dica: "casado pelo nome" },
];

// Sinônimos para auto-detecção. Cobrem o modelo do FinanceiroX, o Conta Azul e nomes genéricos de planilha.
const SINONIMOS: Record<CampoId, string[]> = {
  tipo: ["tipo", "tipo de lancamento", "natureza", "operacao", "receita/despesa", "entrada/saida", "credito/debito"],
  venc: ["data_vencimento", "vencimento", "data de vencimento", "data venc", "vencto", "data", "due date"],
  comp: ["data_competencia", "competencia", "data de competencia"],
  pag: ["data_pagamento", "pagamento", "data de pagamento", "data_pagto", "data pagamento", "data de recebimento", "data de baixa", "data baixa", "liquidacao"],
  valor: ["valor", "valor (r$)", "valor bruto", "valor liquido", "montante", "total", "value"],
  descricao: ["descricao", "historico", "descr", "observacao", "memo", "lancamento", "detalhes"],
  categoria: ["categoria", "categoria financeira", "plano de contas", "classificacao"],
  conta: ["conta", "conta_bancaria", "conta bancaria", "conta corrente", "banco"],
  pessoa: ["cliente_fornecedor", "cliente/fornecedor", "cliente fornecedor", "cliente", "fornecedor", "contato", "razao social", "nome", "sacado", "beneficiario"],
  centro: ["centro_custo", "centro de custo", "centro_de_custo", "centro", "centro de resultado"],
};

type PerfilId = "fs" | "contaazul";
const PERFIS: { id: PerfilId; nome: string; desc: string }[] = [
  { id: "fs", nome: "Modelo FinanceiroX", desc: "A planilha que você baixa aqui." },
  { id: "contaazul", nome: "Conta Azul", desc: "Exportação de contas a pagar/receber do Conta Azul." },
];

function norm(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}
function detectarDelim(linha: string): string {
  const pv = (linha.match(/;/g) || []).length;
  const v = (linha.match(/,/g) || []).length;
  const tab = (linha.match(/\t/g) || []).length;
  if (tab > 0 && tab >= pv && tab >= v) return "\t";
  return pv >= v ? ";" : ",";
}
function parseCSV(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === delim) { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch !== "\r") field += ch;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}
function parseData(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (!m) return null;
  let [, d, mo, y] = m;
  if (y.length === 2) y = "20" + y;
  const pad = (x: string) => x.padStart(2, "0");
  return `${y}-${pad(mo)}-${pad(d)}`;
}
function parseValor(s: string): { valor: number; negativo: boolean } {
  const original = s.trim();
  let t = original.replace(/[^\d.,-]/g, "").trim();
  const negativo = /^-/.test(t) || /\(.*\)/.test(original);
  t = t.replace(/-/g, "");
  if (!t) return { valor: NaN, negativo };
  const temPonto = t.includes(".");
  const temVirg = t.includes(",");
  if (temPonto && temVirg) {
    if (t.lastIndexOf(",") > t.lastIndexOf(".")) t = t.replace(/\./g, "").replace(",", ".");
    else t = t.replace(/,/g, "");
  } else if (temVirg) t = t.replace(",", ".");
  const n = parseFloat(t);
  return { valor: isNaN(n) ? NaN : Math.abs(n), negativo };
}
function parseTipo(s: string): "entrada" | "saida" | null {
  const n = norm(s);
  if (/(entr|receb|receita|credito|credit)/.test(n)) return "entrada";
  if (/(sai|pag|despes|debito|debit)/.test(n)) return "saida";
  return null;
}

type ModoTipo = "coluna" | "entrada" | "saida" | "sinal";

export default function ImportarCsv({
  empresaId,
  categorias,
  contas,
  pessoas,
  centros,
}: {
  empresaId: string;
  categorias: Opt[];
  contas: Opt[];
  pessoas: Opt[];
  centros: Opt[];
}) {
  const router = useRouter();
  const [fase, setFase] = useState<"upload" | "mapear" | "preview">("upload");
  const [regras, setRegras] = useState<RegraClassificacao[]>([]);
  useEffect(() => {
    void carregarRegrasCombinadas(
      empresaId,
      categorias.map((c) => ({ id: c.id, nome: c.nome, tipo: c.tipo ?? "" })),
      pessoas,
    ).then((r) => setRegras(r.combinadas));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);
  const [fileName, setFileName] = useState("");
  const [colado, setColado] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [grid, setGrid] = useState<string[][]>([]);
  const [perfil, setPerfil] = useState<PerfilId>("fs");
  const [mapa, setMapa] = useState<Record<CampoId, number>>({} as Record<CampoId, number>);
  const [modoTipo, setModoTipo] = useState<ModoTipo>("coluna");
  const [linhas, setLinhas] = useState<LinhaParse[]>([]);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: number } | null>(null);

  const catMap = useMemo(() => {
    const m = new Map<string, Opt[]>();
    for (const c of categorias) { const k = norm(c.nome); m.set(k, [...(m.get(k) ?? []), c]); }
    return m;
  }, [categorias]);
  const contaMap = useMemo(() => new Map(contas.map((c) => [norm(c.nome), c.id])), [contas]);
  const pessoaMap = useMemo(() => new Map(pessoas.map((p) => [norm(p.nome), p.id])), [pessoas]);
  const centroMap = useMemo(() => new Map(centros.map((c) => [norm(c.nome), c.id])), [centros]);

  function autoMapear(hdrs: string[]): Record<CampoId, number> {
    const normH = hdrs.map(norm);
    const m = {} as Record<CampoId, number>;
    for (const campo of CAMPOS) {
      const alts = SINONIMOS[campo.id];
      let achou = normH.findIndex((h) => alts.includes(h));
      if (achou < 0) achou = normH.findIndex((h) => alts.some((a) => h.includes(a) || a.includes(h)));
      m[campo.id] = achou;
    }
    return m;
  }

  function baixarModelo() {
    const ls = [
      "tipo;data_vencimento;data_competencia;valor;descricao;categoria;conta;cliente_fornecedor;data_pagamento;centro_custo",
      "entrada;10/06/2026;;1500,00;Mensalidade cliente X;Receita com servicos;Conta Corrente;Cliente X;10/06/2026;",
      "saida;15/06/2026;;350,50;Conta de luz;Luz;Conta Corrente;;;Administrativo",
    ].join("\n");
    const blob = new Blob(["\uFEFF" + ls], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "modelo-lancamentos.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  async function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResultado(null);
    setErroGeral(null);
    try {
      processarGrid(await lerArquivoComoGrid(file));
    } catch {
      setErroGeral("Não consegui ler este arquivo. Tente salvar como .xlsx ou .csv.");
    }
  }

  function carregarGrid(texto: string) {
    setResultado(null);
    setErroGeral(null);
    const primeira = texto.split("\n").find((l) => l.trim() !== "") ?? "";
    processarGrid(parseCSV(texto, detectarDelim(primeira)));
  }

  function processarGrid(g: string[][]) {
    if (g.length < 2) {
      setErroGeral("O arquivo não tem linhas de dados (só cabeçalho?).");
      return;
    }
    const hdrs = g[0].map((h) => h.trim());
    setHeaders(hdrs);
    setGrid(g.slice(1));
    const m = autoMapear(hdrs);
    setMapa(m);
    setModoTipo(m.tipo >= 0 ? "coluna" : "entrada");
    setFase("mapear");
  }

  function aplicarPerfil(p: PerfilId) {
    setPerfil(p);
    // Reaplica a auto-detecção; o usuário pode então ajustar manualmente.
    const m = autoMapear(headers);
    setMapa(m);
    setModoTipo(m.tipo >= 0 ? "coluna" : "entrada");
  }

  function gerarPreview() {
    const out: LinhaParse[] = [];
    const get = (r: string[], campo: CampoId) => {
      const i = mapa[campo];
      return i != null && i >= 0 ? (r[i] ?? "").trim() : "";
    };
    for (let i = 0; i < grid.length; i++) {
      const r = grid[i];
      const erros: string[] = [];

      const parsedValor = parseValor(get(r, "valor"));
      const valor = parsedValor.valor;
      if (isNaN(valor) || valor <= 0) erros.push("valor inválido");

      let tipo: "entrada" | "saida" | null;
      if (modoTipo === "entrada") tipo = "entrada";
      else if (modoTipo === "saida") tipo = "saida";
      else if (modoTipo === "sinal") tipo = parsedValor.negativo ? "saida" : "entrada";
      else { tipo = parseTipo(get(r, "tipo")); if (!tipo) erros.push("tipo inválido (use entrada/saida)"); }

      const venc = parseData(get(r, "venc"));
      if (!venc) erros.push("vencimento inválido");
      const comp = parseData(get(r, "comp")) || venc;
      const pag = parseData(get(r, "pag"));

      const categoriaNome = get(r, "categoria");
      let categoriaId: string | null = null;
      if (categoriaNome) {
        const cands = catMap.get(norm(categoriaNome)) ?? [];
        const tCat = tipo === "entrada" ? "receber" : "pagar";
        categoriaId = (cands.find((c) => c.tipo === tCat) ?? cands[0])?.id ?? null;
      }
      const contaNome = get(r, "conta");
      const contaId = contaNome ? contaMap.get(norm(contaNome)) ?? null : null;
      const pessoaNome = get(r, "pessoa");
      let pessoaId = pessoaNome ? pessoaMap.get(norm(pessoaNome)) ?? null : null;
      // sem categoria na planilha? As regras da empresa (as mesmas da conciliação) tentam classificar pela descrição.
      if (!categoriaId && tipo) {
        const rg = matchRegra(get(r, "descricao"), tipo, regras);
        if (rg) {
          const tCat = tipo === "entrada" ? "receber" : "pagar";
          const cat = categorias.find((c) => c.id === rg.categoria_id && c.tipo === tCat);
          if (cat) categoriaId = cat.id;
          if (!pessoaId && rg.cliente_fornecedor_id) pessoaId = rg.cliente_fornecedor_id;
        }
      }
      const centroNome = get(r, "centro");
      const centroId = centroNome ? centroMap.get(norm(centroNome)) ?? null : null;

      out.push({
        linha: i + 2, tipo, valor: isNaN(valor) ? 0 : valor, venc, comp, pag,
        descricao: get(r, "descricao"),
        categoriaNome, categoriaId, contaNome, contaId,
        pessoaNome, pessoaId, centroNome, centroId, erros,
      });
    }
    setLinhas(out);
    setFase("preview");
  }

  const faltaObrig = useMemo(() => {
    const f: string[] = [];
    if (modoTipo === "coluna" && (mapa.tipo == null || mapa.tipo < 0)) f.push("tipo");
    if (mapa.venc == null || mapa.venc < 0) f.push("data de vencimento");
    if (mapa.valor == null || mapa.valor < 0) f.push("valor");
    return f;
  }, [mapa, modoTipo]);

  const validas = linhas.filter((l) => l.erros.length === 0);
  const invalidas = linhas.filter((l) => l.erros.length > 0);

  async function importar() {
    if (validas.length === 0) return;
    setImportando(true);
    setErroGeral(null);
    const supabase = createClient();
    const payloads = validas.map((l) => ({
      empresa_id: empresaId, tipo: l.tipo, valor: l.valor,
      descricao: l.descricao || null, categoria_id: l.categoriaId, conta_id: l.contaId,
      cliente_fornecedor_id: l.pessoaId, centro_custo_id: l.centroId,
      data_vencimento: l.venc, data_competencia: l.comp, data_pagamento: l.pag,
    }));
    let ok = 0;
    for (let i = 0; i < payloads.length; i += 500) {
      const chunk = payloads.slice(i, i + 500);
      const { error } = await supabase.from("lancamentos").insert(chunk);
      if (error) {
        setImportando(false);
        setErroGeral(`Erro ao importar (linha aprox. ${i + 2}): ${error.message}`);
        return;
      }
      ok += chunk.length;
    }
    setImportando(false);
    setResultado({ ok });
    router.refresh();
  }

  function reiniciar() {
    setFase("upload"); setLinhas([]); setHeaders([]); setGrid([]);
    setFileName(""); setColado(""); setErroGeral(null);
  }

  if (resultado) {
    return (
      <div className="rounded-xl2 bg-white p-8 text-center shadow-card">
        <CheckCircle2 size={40} className="mx-auto text-brand" />
        <h2 className="mt-3 text-lg font-bold text-ink">{resultado.ok} lançamentos importados</h2>
        <p className="mt-1 text-sm text-ink-muted">Já aparecem nas Entradas/Saídas, no painel e no relatório.</p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <Link href="/lancamentos" className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark">
            Ver lançamentos
          </Link>
          <button type="button" onClick={() => { setResultado(null); reiniciar(); }} className="rounded-md border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink transition hover:bg-surface">
            Importar outra planilha
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Passos fase={fase} />

      {fase === "upload" && (
        <div className="rounded-xl2 bg-white p-4 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[13px] font-bold text-ink">Envie qualquer planilha de lançamentos</h2>
              <p className="text-xs text-ink-muted">
                Aceita o modelo do FinanceiroX ou a exportação de outro sistema (Conta Azul, etc.).
                No próximo passo você diz qual coluna é o quê.
              </p>
            </div>
            <button type="button" onClick={baixarModelo} className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink transition hover:bg-surface">
              <Download size={15} /> Baixar modelo CSV
            </button>
          </div>

          <label className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line py-8 text-center transition hover:border-brand">
            <UploadCloud size={26} className="text-ink-soft" />
            <span className="text-sm font-medium text-ink">{fileName || "Clique para escolher um .csv ou .xlsx"}</span>
            <span className="text-[11px] text-ink-soft">Aceita separador ; , ou tabulação e valores no formato 1.234,56</span>
            <input type="file" accept=".csv,.xlsx,.xls,text/csv" onChange={aoEscolher} className="hidden" />
          </label>

          <div className="mt-3">
            <p className="mb-1.5 text-xs font-semibold text-ink-muted">ou cole aqui (direto do Excel/Google Sheets)</p>
            <textarea value={colado} onChange={(e) => setColado(e.target.value)} rows={5}
              placeholder={"Cole o conteúdo com o cabeçalho na 1ª linha"}
              className={classeControle("md", false, "num resize-none bg-white")} />
            <button type="button" onClick={() => { if (!colado.trim()) return; setFileName("texto colado"); carregarGrid(colado); }}
              disabled={!colado.trim()}
              className="mt-2 rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60">
              Processar texto colado
            </button>
          </div>
        </div>
      )}

      {fase === "mapear" && (
        <div className="space-y-4">
          <Card titulo="De qual sistema veio esta planilha?" sub="Isso só ajusta a sugestão automática. Você confere o de-para abaixo de qualquer jeito.">
            <div className="mt-3 flex flex-wrap gap-2">
              {PERFIS.map((p) => (
                <button key={p.id} type="button" onClick={() => aplicarPerfil(p.id)}
                  className={`rounded-lg border px-3 py-2 text-left text-xs transition ${perfil === p.id ? "border-brand bg-brand-light" : "border-line hover:bg-surface"}`}>
                  <span className="block font-semibold text-ink">{p.nome}</span>
                  <span className="block text-ink-soft">{p.desc}</span>
                </button>
              ))}
            </div>
          </Card>

          <div className="rounded-xl2 bg-white p-4 shadow-card">
            <div className="flex items-center gap-2">
              <Wand2 size={16} className="text-brand" />
              <h2 className="text-[13px] font-bold text-ink">Relacione as colunas</h2>
            </div>
            <p className="mt-0.5 text-xs text-ink-muted">
              Detectamos {headers.length} colunas e {grid.length} linhas. As sugestões abaixo já vêm preenchidas — ajuste o que precisar.
            </p>

            <div className="mt-4 space-y-2.5">
              {/* Tipo tem tratamento especial: pode vir de uma coluna ou ser definido para a planilha toda */}
              <div className="grid grid-cols-[180px_1fr] items-center gap-3">
                <span className="text-xs font-semibold text-ink">
                  Tipo (entrada/saída) <span className="text-danger">*</span>
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <select value={modoTipo} onChange={(e) => setModoTipo(e.target.value as ModoTipo)}
                    className="rounded-lg border border-line px-3 py-2 text-xs text-ink focus:border-brand focus:outline-none">
                    <option value="coluna">Vem de uma coluna</option>
                    <option value="entrada">Tudo é entrada (recebimentos)</option>
                    <option value="saida">Tudo é saída (pagamentos)</option>
                    <option value="sinal">Pelo sinal do valor (negativo = saída)</option>
                  </select>
                  {modoTipo === "coluna" && (
                    <select value={mapa.tipo ?? -1} onChange={(e) => setMapa((m) => ({ ...m, tipo: Number(e.target.value) }))}
                      className="min-w-[180px] flex-1 rounded-lg border border-line px-3 py-2 text-xs text-ink focus:border-brand focus:outline-none">
                      <option value={-1}>— escolha a coluna —</option>
                      {headers.map((h, i) => <option key={i} value={i}>{h || `Coluna ${i + 1}`}</option>)}
                    </select>
                  )}
                </div>
              </div>

              {CAMPOS.filter((c) => c.id !== "tipo").map((campo) => (
                <div key={campo.id} className="grid grid-cols-[180px_1fr] items-center gap-3">
                  <span className="text-xs font-semibold text-ink">
                    {campo.label} {campo.obrig && <span className="text-danger">*</span>}
                    {campo.dica && <span className="block text-[10px] font-normal text-ink-soft">{campo.dica}</span>}
                  </span>
                  <select value={mapa[campo.id] ?? -1} onChange={(e) => setMapa((m) => ({ ...m, [campo.id]: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-line px-3 py-2 text-xs text-ink focus:border-brand focus:outline-none">
                    <option value={-1}>— ignorar —</option>
                    {headers.map((h, i) => <option key={i} value={i}>{h || `Coluna ${i + 1}`}</option>)}
                  </select>
                </div>
              ))}
            </div>

            {/* amostra dos dados — a `Tabela` do app, colunas vindas do arquivo */}
            {grid.length > 0 && (
              (() => {
                const colunasPrev: ColunaDef[] = headers.map((h, i) => ({
                  id: `c${i}`,
                  label: h || `Col ${i + 1}`,
                  largura: "minmax(110px,1fr)",
                }));
                const gridPrev = colunasPrev.map((c) => c.largura).join(" ");
                return (
                  <div className="mt-4 overflow-x-auto rounded-lg border border-line">
                    <Tabela
                      colunas={colunasPrev}
                      gridTemplate={gridPrev}
                      larguraMinima={`${Math.max(320, headers.length * 110)}px`}
                      moldura={false}
                      grudento={false}
                    >
                      {grid.slice(0, 3).map((r, ri) => (
                        <LinhaTabela key={ri} gridTemplate={gridPrev} className="!py-1.5">
                          {headers.map((_, ci) => (
                            <span key={ci} title={r[ci] ?? ""} className="truncate text-[11px] text-ink-muted">{r[ci] ?? ""}</span>
                          ))}
                        </LinhaTabela>
                      ))}
                    </Tabela>
                  </div>
                );
              })()
            )}

            {faltaObrig.length > 0 && (
              <MessageStrip tipo="erro">Faltam campos obrigatórios: {faltaObrig.join(", ")}.</MessageStrip>
            )}

            <div className="mt-4 flex items-center justify-between">
              <button type="button" onClick={reiniciar} className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted transition hover:text-brand">
                <ArrowLeft size={14} /> Trocar arquivo
              </button>
              <button type="button" onClick={gerarPreview} disabled={faltaObrig.length > 0}
                className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60">
                Pré-visualizar <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {erroGeral && (
        <MessageStrip tipo="erro">{erroGeral}</MessageStrip>
      )}

      {fase === "preview" && linhas.length > 0 && (
        <div className="rounded-xl2 bg-white shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div className="flex items-center gap-4 text-sm">
              <span className="font-semibold text-brand">{validas.length} válidos</span>
              {invalidas.length > 0 && <span className="font-semibold text-danger">{invalidas.length} com erro</span>}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setFase("mapear")} className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink transition hover:bg-surface">
                <ArrowLeft size={14} /> Ajustar colunas
              </button>
              <Botao variante="primario" onClick={importar} disabled={importando || validas.length === 0}>
                {importando ? "Importando…" : `Importar ${validas.length} lançamentos`}
              </Botao>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[820px]">
              <div className="grid grid-cols-[40px_70px_84px_1fr_1fr_1fr_1fr_110px] gap-3 border-b border-line px-5 py-2 text-[11px] font-semibold text-ink-soft">
                <span>Linha</span><span>Tipo</span><span>Venc.</span><span>Descrição</span>
                <span>Categoria</span><span>Conta</span><span>Cliente/Forn.</span><span className="text-right">Valor</span>
              </div>
              {linhas.slice(0, 60).map((l) => {
                const erro = l.erros.length > 0;
                return (
                  <div key={l.linha} className={`grid grid-cols-[40px_70px_84px_1fr_1fr_1fr_1fr_110px] items-center gap-3 border-b border-line/60 px-5 py-2 text-xs last:border-0 ${erro ? "bg-rose-50" : ""}`}>
                    <span className="num text-ink-soft">{l.linha}</span>
                    <span className={l.tipo === "entrada" ? "text-brand" : l.tipo === "saida" ? "text-ink" : "text-ink-soft"}>{l.tipo ?? "—"}</span>
                    <span className="num text-ink-muted">{l.venc ? l.venc.split("-").reverse().join("/") : "—"}</span>
                    <span className="truncate text-ink">{erro ? <span className="text-danger-dark">{l.erros.join("; ")}</span> : l.descricao || "—"}</span>
                    <span className="truncate text-ink-muted">{l.categoriaNome ? (l.categoriaId ? l.categoriaNome : `${l.categoriaNome} (nova)`) : "—"}</span>
                    <span className="truncate text-ink-muted">{l.contaNome ? (l.contaId ? l.contaNome : `${l.contaNome} (?)`) : "—"}</span>
                    <span className="truncate text-ink-muted">{l.pessoaNome ? (l.pessoaId ? l.pessoaNome : `${l.pessoaNome} (?)`) : "—"}</span>
                    <span className="num text-right font-semibold text-ink">{brl(l.valor)}</span>
                  </div>
                );
              })}
              {linhas.length > 60 && (
                <p className="px-5 py-2 text-[11px] text-ink-soft">Mostrando as primeiras 60 linhas; todas as {validas.length} válidas serão importadas.</p>
              )}
            </div>
          </div>

          <p className="border-t border-line px-5 py-3 text-[11px] text-ink-soft">
            Categoria/conta/cliente não encontrados pelo nome ficam em branco no lançamento — você ajusta depois. Linhas com erro são ignoradas.
          </p>
        </div>
      )}

      <Link href="/lancamentos" className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted transition hover:text-brand">
        <ArrowLeft size={14} /> Voltar para lançamentos
      </Link>
    </div>
  );
}

function Passos({ fase }: { fase: "upload" | "mapear" | "preview" }) {
  const passos = [
    { id: "upload", n: 1, label: "Enviar planilha" },
    { id: "mapear", n: 2, label: "Relacionar colunas" },
    { id: "preview", n: 3, label: "Conferir e importar" },
  ];
  const idx = passos.findIndex((p) => p.id === fase);
  return (
    <div className="flex items-center gap-2 text-xs">
      {passos.map((p, i) => (
        <div key={p.id} className="flex items-center gap-2">
          <span className={`flex h-6 w-6 items-center justify-center rounded-full font-bold ${i <= idx ? "bg-brand text-white" : "bg-surface text-ink-soft"}`}>{p.n}</span>
          <span className={i <= idx ? "font-semibold text-ink" : "text-ink-soft"}>{p.label}</span>
          {i < passos.length - 1 && <span className="mx-1 h-px w-6 bg-line" />}
        </div>
      ))}
    </div>
  );
}

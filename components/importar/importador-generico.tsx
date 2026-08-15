"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, Download, CheckCircle2, AlertTriangle, ArrowLeft, ArrowRight, Wand2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Botao from "@/components/ui/botao";
import { classeControle } from "@/components/ui/campo";
import Tabela, { LinhaTabela } from "@/components/ui/tabela";
import type { ColunaDef } from "@/components/ui/config-colunas";
import {
  type EntidadeConfig, type CampoDef,
  norm, detectarDelim, parseCSV, parseData, parseValor, parseBool, casarOpcao, lerArquivoComoGrid,
} from "@/lib/importador/config";

type RefItem = { id: string; nome: string };

type LinhaParse = { linha: number; payload: Record<string, unknown>; rotulo: string; refsNaoAchadas: string[]; erros: string[] };

export default function ImportadorGenerico({
  entidade,
  empresaId,
  refs = {},
  onVoltar,
}: {
  entidade: EntidadeConfig;
  empresaId: string;
  refs?: Record<string, RefItem[]>;
  onVoltar?: () => void;
}) {
  const router = useRouter();
  const [fase, setFase] = useState<"upload" | "mapear" | "preview">("upload");
  const [fileName, setFileName] = useState("");
  const [colado, setColado] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [grid, setGrid] = useState<string[][]>([]);
  const [mapa, setMapa] = useState<Record<string, number>>({});
  const [modo, setModo] = useState<Record<string, "coluna" | "fixo">>({});
  const [fixos, setFixos] = useState<Record<string, string>>({});
  const [linhas, setLinhas] = useState<LinhaParse[]>([]);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: number } | null>(null);

  const refMaps = useMemo(() => {
    const out: Record<string, Map<string, string>> = {};
    for (const [k, items] of Object.entries(refs)) out[k] = new Map(items.map((i) => [norm(i.nome), i.id]));
    return out;
  }, [refs]);

  function autoMapear(hdrs: string[]) {
    const normH = hdrs.map(norm);
    const m: Record<string, number> = {};
    const md: Record<string, "coluna" | "fixo"> = {};
    const fx: Record<string, string> = {};
    for (const campo of entidade.campos) {
      let achou = normH.findIndex((h) => campo.sinonimos.includes(h));
      if (achou < 0) achou = normH.findIndex((h) => campo.sinonimos.some((a) => h.includes(a) || a.includes(h)));
      m[campo.id] = achou;
      if (campo.tipo === "opcao" || campo.tipo === "bool") {
        md[campo.id] = achou >= 0 ? "coluna" : "fixo";
        if (campo.opcoes?.length) fx[campo.id] = campo.opcoes[0].canonico;
        else fx[campo.id] = "true";
      }
    }
    setMapa(m); setModo(md); setFixos(fx);
  }

  function baixarModelo() {
    const linhasM = [entidade.modeloCsv.header, ...entidade.modeloCsv.exemplos].join("\n");
    const blob = new Blob(["\uFEFF" + linhasM], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `modelo-${entidade.id}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  async function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResultado(null); setErroGeral(null);
    try {
      const g = await lerArquivoComoGrid(file);
      processarGrid(g);
    } catch {
      setErroGeral("Não consegui ler este arquivo. Tente salvar como .xlsx ou .csv.");
    }
  }

  function processarGrid(g: string[][]) {
    if (g.length < 2) { setErroGeral("O arquivo não tem linhas de dados (só cabeçalho?)."); return; }
    const hdrs = g[0].map((h) => h.trim());
    setHeaders(hdrs); setGrid(g.slice(1)); autoMapear(hdrs); setFase("mapear");
  }

  function carregarGrid(texto: string) {
    setResultado(null); setErroGeral(null);
    const primeira = texto.split("\n").find((l) => l.trim() !== "") ?? "";
    processarGrid(parseCSV(texto, detectarDelim(primeira)));
  }

  function valorCampo(campo: CampoDef, r: string[]): { valor: unknown; bruto: string; refFalhou?: boolean } {
    const idx = mapa[campo.id];
    const cel = idx != null && idx >= 0 ? (r[idx] ?? "").trim() : "";
    if (campo.tipo === "opcao") {
      if (modo[campo.id] === "fixo") return { valor: fixos[campo.id] || null, bruto: fixos[campo.id] || "" };
      return { valor: cel ? casarOpcao(cel, campo.opcoes ?? []) : null, bruto: cel };
    }
    if (campo.tipo === "bool") {
      if (modo[campo.id] === "fixo") return { valor: fixos[campo.id] === "true", bruto: fixos[campo.id] };
      return { valor: cel ? parseBool(cel) : null, bruto: cel };
    }
    if (campo.tipo === "valor") return { valor: cel ? parseValor(cel) : null, bruto: cel };
    if (campo.tipo === "data") return { valor: cel ? parseData(cel) : null, bruto: cel };
    if (campo.tipo === "ref") {
      if (!cel) return { valor: null, bruto: "" };
      const id = refMaps[campo.refKey ?? ""]?.get(norm(cel)) ?? null;
      return { valor: id, bruto: cel, refFalhou: !id };
    }
    return { valor: cel || null, bruto: cel };
  }

  function gerarPreview() {
    const out: LinhaParse[] = [];
    for (let i = 0; i < grid.length; i++) {
      const r = grid[i];
      const payload: Record<string, unknown> = { empresa_id: empresaId };
      const erros: string[] = [];
      const refsNaoAchadas: string[] = [];
      let rotulo = "";
      for (const campo of entidade.campos) {
        const { valor, bruto, refFalhou } = valorCampo(campo, r);
        payload[campo.col] = valor;
        if (campo.id === "nome" || campo.id === "codigo") rotulo = rotulo || bruto;
        if (campo.obrig && (valor == null || valor === "")) erros.push(`${campo.label} obrigatório`);
        if (refFalhou) refsNaoAchadas.push(`${campo.label}: "${bruto}"`);
      }
      const final = entidade.posProcessar ? entidade.posProcessar(payload, {}) : payload;
      out.push({ linha: i + 2, payload: final, rotulo: rotulo || "(sem nome)", refsNaoAchadas, erros });
    }
    setLinhas(out);
    setFase("preview");
  }

  const faltaObrig = useMemo(() => {
    const f: string[] = [];
    for (const campo of entidade.campos) {
      if (!campo.obrig) continue;
      if ((campo.tipo === "opcao" || campo.tipo === "bool") && modo[campo.id] === "fixo") continue;
      if (mapa[campo.id] == null || mapa[campo.id] < 0) f.push(campo.label);
    }
    return f;
  }, [mapa, modo, entidade]);

  const validas = linhas.filter((l) => l.erros.length === 0);
  const invalidas = linhas.filter((l) => l.erros.length > 0);

  async function importar() {
    if (validas.length === 0) return;
    setImportando(true); setErroGeral(null);
    const supabase = createClient();
    const payloads = validas.map((l) => l.payload);
    let ok = 0;
    for (let i = 0; i < payloads.length; i += 500) {
      const chunk = payloads.slice(i, i + 500);
      const { error } = await supabase.from(entidade.tabela).insert(chunk);
      if (error) { setImportando(false); setErroGeral(`Erro ao importar (linha aprox. ${i + 2}): ${error.message}`); return; }
      ok += chunk.length;
    }
    setImportando(false); setResultado({ ok }); router.refresh();
  }

  function reiniciar() { setFase("upload"); setLinhas([]); setHeaders([]); setGrid([]); setFileName(""); setColado(""); setErroGeral(null); }

  if (resultado) {
    return (
      <div className="rounded-xl2 bg-white p-8 text-center shadow-card">
        <CheckCircle2 size={40} className="mx-auto text-brand" />
        <h2 className="mt-3 text-lg font-bold text-ink">{resultado.ok} registros importados</h2>
        <p className="mt-1 text-sm text-ink-muted">{entidade.nome} já estão cadastrados na empresa.</p>
        <div className="mt-5 flex items-center justify-center gap-2">
          {onVoltar && <button type="button" onClick={onVoltar} className="rounded-md border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink transition hover:bg-surface">Importar outro tipo</button>}
          <button type="button" onClick={() => { setResultado(null); reiniciar(); }} className="rounded-md bg-brand px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark">Importar outra planilha</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Passos fase={fase} />
        {onVoltar && fase === "upload" && (
          <button type="button" onClick={onVoltar} className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted transition hover:text-brand">
            <ArrowLeft size={14} /> Trocar tipo
          </button>
        )}
      </div>

      {fase === "upload" && (
        <div className="rounded-xl2 bg-white p-4 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[13px] font-bold text-ink">Envie a planilha de {entidade.nome.toLowerCase()}</h2>
              <p className="text-xs text-ink-muted">Aceita o modelo do FinanceiroX ou a exportação de outro sistema. No próximo passo você relaciona as colunas.</p>
            </div>
            <button type="button" onClick={baixarModelo} className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink transition hover:bg-surface">
              <Download size={15} /> Baixar modelo CSV
            </button>
          </div>
          <label className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line py-8 text-center transition hover:border-brand">
            <UploadCloud size={26} className="text-ink-soft" />
            <span className="text-sm font-medium text-ink">{fileName || "Clique para escolher um .csv ou .xlsx"}</span>
            <span className="text-[11px] text-ink-soft">Excel (.xlsx, .xls) ou CSV — separador ; , ou tabulação</span>
            <input type="file" accept=".csv,.xlsx,.xls,text/csv" onChange={aoEscolher} className="hidden" />
          </label>
          <div className="mt-3">
            <p className="mb-1.5 text-xs font-semibold text-ink-muted">ou cole aqui (direto do Excel/Google Sheets)</p>
            <textarea value={colado} onChange={(e) => setColado(e.target.value)} rows={4} placeholder="Cole com o cabeçalho na 1ª linha"
              className={classeControle("md", false, "num resize-none bg-white")} />
            <button type="button" onClick={() => { if (!colado.trim()) return; setFileName("texto colado"); carregarGrid(colado); }} disabled={!colado.trim()}
              className="mt-2 rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60">Processar texto colado</button>
          </div>
        </div>
      )}

      {fase === "mapear" && (
        <div className="rounded-xl2 bg-white p-4 shadow-card">
          <div className="flex items-center gap-2"><Wand2 size={16} className="text-brand" /><h2 className="text-[13px] font-bold text-ink">Relacione as colunas</h2></div>
          <p className="mt-0.5 text-xs text-ink-muted">Detectamos {headers.length} colunas e {grid.length} linhas. As sugestões já vêm preenchidas — ajuste o que precisar.</p>

          <div className="mt-4 space-y-2.5">
            {entidade.campos.map((campo) => (
              <div key={campo.id} className="grid grid-cols-[190px_1fr] items-center gap-3">
                <span className="text-xs font-semibold text-ink">
                  {campo.label} {campo.obrig && <span className="text-danger">*</span>}
                  {campo.dica && <span className="block text-[10px] font-normal text-ink-soft">{campo.dica}</span>}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {(campo.tipo === "opcao" || campo.tipo === "bool") && (
                    <select value={modo[campo.id] ?? "coluna"} onChange={(e) => setModo((m) => ({ ...m, [campo.id]: e.target.value as "coluna" | "fixo" }))}
                      className="rounded-lg border border-line px-2 py-2 text-xs text-ink focus:border-brand focus:outline-none">
                      <option value="coluna">Vem de uma coluna</option>
                      <option value="fixo">Valor fixo</option>
                    </select>
                  )}
                  {(campo.tipo === "opcao" || campo.tipo === "bool") && modo[campo.id] === "fixo" ? (
                    campo.tipo === "bool" ? (
                      <select value={fixos[campo.id] ?? "true"} onChange={(e) => setFixos((f) => ({ ...f, [campo.id]: e.target.value }))}
                        className="flex-1 rounded-lg border border-line px-3 py-2 text-xs text-ink focus:border-brand focus:outline-none">
                        <option value="true">Sim (analítica)</option><option value="false">Não (sintética)</option>
                      </select>
                    ) : (
                      <select value={fixos[campo.id] ?? ""} onChange={(e) => setFixos((f) => ({ ...f, [campo.id]: e.target.value }))}
                        className="flex-1 rounded-lg border border-line px-3 py-2 text-xs text-ink focus:border-brand focus:outline-none">
                        {campo.opcoes?.map((o) => <option key={o.canonico} value={o.canonico}>{o.rotulo}</option>)}
                      </select>
                    )
                  ) : (
                    <select value={mapa[campo.id] ?? -1} onChange={(e) => setMapa((m) => ({ ...m, [campo.id]: Number(e.target.value) }))}
                      className="min-w-[170px] flex-1 rounded-lg border border-line px-3 py-2 text-xs text-ink focus:border-brand focus:outline-none">
                      <option value={-1}>{campo.obrig ? "— escolha a coluna —" : "— ignorar —"}</option>
                      {headers.map((h, i) => <option key={i} value={i}>{h || `Coluna ${i + 1}`}</option>)}
                    </select>
                  )}
                </div>
              </div>
            ))}
          </div>

          {grid.length > 0 && (
            /*
              Prévia com a `Tabela` do app. As colunas vêm do próprio arquivo,
              então a definição é montada na hora; sem moldura nem sticky —
              está dentro de um cartão do assistente, com rolagem própria.
            */
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
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-danger/30 bg-rose-50 px-3 py-2 text-xs text-danger">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /><span>Faltam campos obrigatórios: {faltaObrig.join(", ")}.</span>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between">
            <button type="button" onClick={reiniciar} className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted transition hover:text-brand"><ArrowLeft size={14} /> Trocar arquivo</button>
            <button type="button" onClick={gerarPreview} disabled={faltaObrig.length > 0} className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60">Pré-visualizar <ArrowRight size={15} /></button>
          </div>
        </div>
      )}

      {erroGeral && (
        <div className="flex items-start gap-2 rounded-xl2 border border-danger/30 bg-rose-50 px-4 py-3 text-sm text-danger">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" /><span>{erroGeral}</span>
        </div>
      )}

      {fase === "preview" && linhas.length > 0 && (
        <div className="rounded-xl2 bg-white shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div className="flex items-center gap-4 text-sm">
              <span className="font-semibold text-brand">{validas.length} válidos</span>
              {invalidas.length > 0 && <span className="font-semibold text-danger">{invalidas.length} com erro</span>}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setFase("mapear")} className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink transition hover:bg-surface"><ArrowLeft size={14} /> Ajustar colunas</button>
              <Botao variante="primario" onClick={importar} disabled={importando || validas.length === 0}>{importando ? "Importando…" : `Importar ${validas.length}`}</Botao>
            </div>
          </div>
          <div className="divide-y divide-line/60">
            {linhas.slice(0, 60).map((l) => {
              const erro = l.erros.length > 0;
              return (
                <div key={l.linha} className={`flex items-center justify-between gap-3 px-5 py-2 text-xs ${erro ? "bg-rose-50/40" : ""}`}>
                  <span className="num w-10 shrink-0 text-ink-soft">{l.linha}</span>
                  <span className="flex-1 truncate text-ink">{l.rotulo}</span>
                  <span className="flex-1 truncate text-right text-ink-muted">
                    {erro ? <span className="text-danger-dark">{l.erros.join("; ")}</span> : l.refsNaoAchadas.length > 0 ? <span className="text-ink-soft">{l.refsNaoAchadas.join(" · ")} (em branco)</span> : "ok"}
                  </span>
                </div>
              );
            })}
            {linhas.length > 60 && <p className="px-5 py-2 text-[11px] text-ink-soft">Mostrando 60 de {linhas.length}; todas as {validas.length} válidas serão importadas.</p>}
          </div>
          <p className="border-t border-line px-5 py-3 text-[11px] text-ink-soft">Referências (grupo, etc.) não encontradas pelo nome ficam em branco — você ajusta depois. Linhas com erro são ignoradas.</p>
        </div>
      )}
    </div>
  );
}

function Passos({ fase }: { fase: "upload" | "mapear" | "preview" }) {
  const passos = [{ id: "upload", n: 1, label: "Enviar" }, { id: "mapear", n: 2, label: "Relacionar colunas" }, { id: "preview", n: 3, label: "Conferir e importar" }];
  const idx = passos.findIndex((p) => p.id === fase);
  return (
    <div className="flex items-center gap-2 text-xs">
      {passos.map((p, i) => (
        <div key={p.id} className="flex items-center gap-2">
          <span className={`flex h-6 w-6 items-center justify-center rounded-full font-bold ${i <= idx ? "bg-brand text-white" : "bg-surface text-ink-soft"}`}>{p.n}</span>
          <span className={i <= idx ? "font-semibold text-ink" : "text-ink-soft"}>{p.label}</span>
          {i < passos.length - 1 && <span className="mx-1 h-px w-5 bg-line" />}
        </div>
      ))}
    </div>
  );
}

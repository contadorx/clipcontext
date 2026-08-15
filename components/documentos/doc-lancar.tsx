"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X, Loader2, FileText, Plus, Link2, Search, Check, AlertTriangle, Unlink, RefreshCw, Info, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { DocRow } from "@/components/documentos/documentos-client";
import { brl, dataBR } from "@/lib/formato";

type Cat = { id: string; nome: string; tipo: string };
type Conta = { id: string; nome: string };
type Pessoa = { id: string; nome: string; tipo: string };
type LancExistente = {
  id: string;
  tipo: string;
  valor: number;
  descricao: string | null;
  data_vencimento: string;
  data_pagamento: string | null;
};

const IMG = new Set(["jpg", "jpeg", "png"]);

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}
function parseValor(s: string): number {
  return parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;
}

export default function DocLancar({
  doc,
  empresaId,
  empresaNome,
  natureza,
  onFechar,
  onVinculo,
  onProximo,
}: {
  doc: DocRow;
  empresaId: string;
  empresaNome?: string;
  natureza?: string;
  onFechar: () => void;
  onVinculo: (docId: string, lancamentoId: string | null) => void;
  onProximo?: () => boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [previewErro, setPreviewErro] = useState(false);
  const [cats, setCats] = useState<Cat[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);

  // vínculo atual
  const [vinculadoId, setVinculadoId] = useState<string | null>(doc.lancamento_id);
  const [vinc, setVinc] = useState<LancExistente | null>(null);
  const [carregandoVinc, setCarregandoVinc] = useState<boolean>(!!doc.lancamento_id);
  const [trocar, setTrocar] = useState(false);

  const [modo, setModo] = useState<"criar" | "vincular">("criar");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [extraindo, setExtraindo] = useState(false);

  // criar
  const [tipoLanc, setTipoLanc] = useState<"saida" | "entrada">(
    natureza === "a_receber" || natureza === "recebida" ? "entrada" : "saida",
  );
  const [valor, setValor] = useState("");
  const [venc, setVenc] = useState(hoje());
  const [situacao, setSituacao] = useState<"previsto" | "efetivado">("previsto");
  const [pessoaId, setPessoaId] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [contaId, setContaId] = useState("");
  const [descricao, setDescricao] = useState(doc.observacao || doc.arquivo_nome.replace(/\.[^.]+$/, ""));

  // vincular
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<LancExistente[]>([]);
  const [buscando, setBuscando] = useState(false);

  const ext = (doc.tipo || "").toLowerCase();

  useEffect(() => {
    // preview
    /*
      `marcar: false` — abrir para lançar não é o mesmo que baixar.

      A rota marca `status = "baixado"` quando o status era "novo", e este
      efeito roda na abertura do modal. Ou seja: abrir "Lançar" e fechar sem
      fazer nada já mudava o documento para "baixado" no banco — enquanto a
      linha continuava mostrando "Novo" na tela, porque o estado local não é
      tocado nesse caminho. A tela e o banco discordavam até alguém recarregar.

      Quem marca é o botão "Abrir", que é o que de fato entrega o arquivo.
    */
    fetch("/api/documentos/baixar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentoId: doc.id, marcar: false }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (j.url) setUrl(j.url);
        else setPreviewErro(true);
      })
      .catch(() => setPreviewErro(true));
    // cadastros
    const supabase = createClient();
    Promise.all([
      supabase.from("categorias").select("id, nome, tipo").eq("empresa_id", empresaId).order("nome"),
      supabase.from("contas_bancarias").select("id, nome").eq("empresa_id", empresaId).order("nome"),
      supabase.from("clientes_fornecedores").select("id, nome, tipo").eq("empresa_id", empresaId).order("nome"),
    ]).then(([c1, c2, c3]) => {
      setCats((c1.data as Cat[]) ?? []);
      setContas((c2.data as Conta[]) ?? []);
      setPessoas((c3.data as Pessoa[]) ?? []);
    });
    // lançamento já vinculado (se houver)
    if (doc.lancamento_id) {
      supabase
        .from("lancamentos")
        .select("id, tipo, valor, descricao, data_vencimento, data_pagamento")
        .eq("id", doc.lancamento_id)
        .maybeSingle()
        .then(({ data }) => {
          setVinc((data as LancExistente) ?? null);
          setCarregandoVinc(false);
        });
    }
  }, [doc.id, doc.lancamento_id, empresaId]);

  const catsFiltradas = useMemo(
    () => cats.filter((c) => (tipoLanc === "entrada" ? c.tipo === "receber" : c.tipo === "pagar")),
    [cats, tipoLanc],
  );

  async function preencherIA() {
    setExtraindo(true);
    setErro(null);
    try {
      const res = await fetch("/api/documentos/extrair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentoId: doc.id }),
      });
      const j = await res.json();
      if (!res.ok) {
        setErro(j.error || "Não foi possível ler o documento.");
        setExtraindo(false);
        return;
      }
      if (j.valor != null && !Number.isNaN(Number(j.valor))) {
        setValor(String(j.valor).replace(".", ","));
      }
      if (j.vencimento && /^\d{4}-\d{2}-\d{2}$/.test(j.vencimento)) setVenc(j.vencimento);
      if (j.descricao) setDescricao(String(j.descricao));
      if (j.fornecedor) {
        const alvo = String(j.fornecedor).toLowerCase().trim();
        const match = pessoas.find(
          (p) => p.nome.toLowerCase().includes(alvo) || alvo.includes(p.nome.toLowerCase()),
        );
        if (match) setPessoaId(match.id);
      }
    } catch {
      setErro("Falha ao chamar a IA.");
    }
    setExtraindo(false);
  }

  /** id do lançamento já criado, quando só o vínculo falhou — evita duplicar */
  const criadoIdRef = useRef<string | null>(null);

  async function salvarCriar(avancar = false) {
    setErro(null);
    const v = parseValor(valor);
    if (v <= 0) return setErro("Informe um valor maior que zero.");
    if (situacao === "efetivado" && !contaId)
      return setErro("Para marcar como efetivado, escolha a conta — é o que faz o lançamento aparecer no extrato (Movimentações).");
    setSalvando(true);
    const supabase = createClient();
    const payload = {
      empresa_id: empresaId,
      tipo: tipoLanc,
      valor: v,
      data_competencia: venc,
      data_vencimento: venc,
      data_pagamento: situacao === "efetivado" ? venc : null,
      categoria_id: categoriaId || null,
      conta_id: contaId || null,
      cliente_fornecedor_id: pessoaId || null,
      descricao: descricao.trim() || null,
    };
    /*
      Se o lançamento já foi criado numa tentativa anterior, reaproveita.

      São duas escritas sem transação: cria o lançamento, depois anexa o
      documento a ele. Quando a segunda falhava, a mensagem dizia só "não foi
      possível anexar" — e o lançamento ficava criado, órfão, sem nada na tela
      apontando para ele. Clicar de novo criava um SEGUNDO lançamento idêntico,
      com o mesmo valor e a mesma data, e a pessoa só descobria em Movimentações.
    */
    if (criadoIdRef.current) {
      /*
        Atualiza antes de anexar, em vez de anexar às cegas.

        Só reaproveitar o id anexaria o lançamento da tentativa anterior com os
        valores da tentativa anterior — e a pessoa acabou de corrigir o campo
        que a fez clicar de novo. O formulário passaria a impressão de ter sido
        usado, e o valor errado entraria no financeiro sem uma palavra.
      */
      const upd = await supabase.from("lancamentos").update(payload).eq("id", criadoIdRef.current);
      if (upd.error) {
        setSalvando(false);
        return setErro(upd.error.message || "Não foi possível atualizar o lançamento.");
      }
      await vincular(criadoIdRef.current, avancar);
      return;
    }
    const ins = await supabase.from("lancamentos").insert(payload).select("id").single();
    if (ins.error || !ins.data) {
      setSalvando(false);
      return setErro(ins.error?.message || "Não foi possível criar o lançamento.");
    }
    criadoIdRef.current = ins.data.id as string;
    await vincular(ins.data.id as string, avancar);
  }

  async function buscar() {
    setBuscando(true);
    const supabase = createClient();
    let q = supabase
      .from("lancamentos")
      .select("id, tipo, valor, descricao, data_vencimento, data_pagamento")
      .eq("empresa_id", empresaId)
      .order("data_vencimento", { ascending: false })
      .limit(20);
    const termo = busca.trim();
    if (termo) {
      const num = parseValor(termo);
      if (num > 0) q = q.or(`descricao.ilike.%${termo}%,valor.eq.${num}`);
      else q = q.ilike("descricao", `%${termo}%`);
    }
    const { data } = await q;
    setResultados((data as LancExistente[]) ?? []);
    setBuscando(false);
  }

  // anexa o documento a um lançamento e conclui (fecha o overlay ou vai ao próximo)
  async function vincular(lancamentoId: string, avancar = false) {
    setSalvando(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("documentos_recebidos")
      .update({ lancamento_id: lancamentoId })
      .eq("id", doc.id);
    setSalvando(false);
    if (error) return setErro("Não foi possível anexar ao lançamento.");
    setVinculadoId(lancamentoId);
    onVinculo(doc.id, lancamentoId);
    if (avancar && onProximo) {
      const avancou = onProximo();
      if (!avancou) onFechar();
    } else {
      onFechar();
    }
  }

  // remove o vínculo, mas mantém o overlay aberto para um novo lançamento/vínculo
  async function desvincular() {
    setErro(null);
    setSalvando(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("documentos_recebidos")
      .update({ lancamento_id: null })
      .eq("id", doc.id);
    setSalvando(false);
    if (error) return setErro("Não foi possível desvincular.");
    setVinculadoId(null);
    setVinc(null);
    setTrocar(false);
    onVinculo(doc.id, null);
  }

  const inp = "w-full rounded-md border border-line px-2.5 py-1.5 text-[12.5px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";
  const lbl = "mb-1 block text-[11px] font-semibold text-ink-soft";

  // mostra o painel de vínculo atual quando há lançamento e o usuário não pediu para trocar
  const mostrarVinculoAtual = !!vinculadoId && !trocar;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-rail/50 backdrop-blur-[1px] p-4">
      <div
        className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl2 bg-white shadow-rail"
        role="dialog"
        aria-modal="true"
        // O título aqui é o nome do arquivo, num <span> junto de um badge de
        // empresa — não há cabeçalho para apontar com aria-labelledby.
        aria-label={`Documento ${doc.arquivo_nome}`}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <FileText size={16} className="shrink-0 text-ink-soft" />
            {empresaNome && (
              <span className="shrink-0 rounded bg-brand-light px-2 py-0.5 text-[11px] font-bold text-brand-dark">{empresaNome}</span>
            )}
            <span className="truncate text-sm font-semibold text-ink">{doc.arquivo_nome}</span>
          </div>
          <button aria-label="Fechar" type="button" onClick={onFechar} className="rounded-lg p-1.5 text-ink-soft hover:bg-surface">
            <X size={18} />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[1fr_420px]">
          {/* preview */}
          <div className="flex min-h-0 items-center justify-center overflow-auto bg-surface p-3">
            {!url && !previewErro ? (
              <Loader2 size={22} className="animate-spin text-ink-soft" />
            ) : previewErro ? (
              <p className="text-sm text-ink-soft">Não foi possível carregar o arquivo.</p>
            ) : ext === "pdf" ? (
              <iframe src={url!} title="documento" className="h-full w-full rounded-lg border border-line bg-white" />
            ) : IMG.has(ext) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url!} alt="documento" className="max-h-full max-w-full rounded-lg object-contain" />
            ) : (
              <div className="text-center">
                <FileText size={36} strokeWidth={1.5} className="mx-auto text-ink-soft" />
                <p className="mt-2 text-sm text-ink-muted">Pré-visualização não disponível para .{ext}.</p>
                <a href={url!} target="_blank" rel="noopener" className="mt-1 inline-block text-xs font-semibold text-brand underline">
                  Abrir em nova aba
                </a>
              </div>
            )}
          </div>

          {/* lado do lançamento */}
          <div className="flex min-h-0 flex-col border-t border-line md:border-l md:border-t-0">
            {mostrarVinculoAtual ? (
              /* ---- vínculo existente ---- */
              <div className="min-h-0 flex-1 overflow-auto p-4">
                {erro && (
                  <div className="mb-3 flex items-center gap-2 rounded-lg border border-danger/30 bg-rose-50 px-3 py-2 text-xs text-danger">
                    <AlertTriangle size={14} /> {erro}
                  </div>
                )}
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Documento anexado a</p>
                {carregandoVinc ? (
                  <div className="mt-3 flex items-center gap-2 text-sm text-ink-soft">
                    <Loader2 size={15} className="animate-spin" /> Carregando lançamento…
                  </div>
                ) : vinc ? (
                  <div className="mt-2 rounded-lg border border-brand/30 bg-brand-light p-3">
                    <p className="text-sm font-medium text-ink">{vinc.descricao || "(sem descrição)"}</p>
                    <p className="mt-0.5 text-[11px] text-ink-soft">
                      venc. {dataBR(vinc.data_vencimento)}
                      {vinc.data_pagamento ? " · pago" : " · previsto"}
                    </p>
                    <p className={`mt-1 text-base font-semibold ${vinc.tipo === "entrada" ? "text-brand-dark" : "text-danger"}`}>
                      {brl(vinc.valor)}
                    </p>
                  </div>
                ) : (
                  <div className="mt-2 rounded-lg border border-line bg-surface p-3 text-xs text-ink-soft">
                    O lançamento vinculado não foi encontrado (pode ter sido excluído). Você pode desvincular e anexar a outro.
                  </div>
                )}

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setTrocar(true); setModo("vincular"); }}
                    className="flex items-center justify-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-muted transition hover:border-brand hover:text-brand"
                  >
                    <RefreshCw size={14} /> Trocar vínculo
                  </button>
                  <button
                    type="button"
                    onClick={desvincular}
                    disabled={salvando}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-danger/40 px-3 py-2 text-sm font-semibold text-danger transition hover:bg-rose-50 disabled:opacity-60"
                  >
                    {salvando ? <Loader2 size={14} className="animate-spin" /> : <Unlink size={14} />} Desvincular
                  </button>
                </div>
              </div>
            ) : (
              /* ---- criar / vincular ---- */
              <>
                <div className="flex gap-0.5 border-b border-line p-2">
                  <button
                    type="button"
                    onClick={() => setModo("criar")}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-sm font-semibold ${modo === "criar" ? "bg-brand text-white" : "text-ink-muted hover:bg-surface"}`}
                  >
                    <Plus size={15} /> Criar lançamento
                  </button>
                  <button
                    type="button"
                    onClick={() => setModo("vincular")}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-sm font-semibold ${modo === "vincular" ? "bg-brand text-white" : "text-ink-muted hover:bg-surface"}`}
                  >
                    <Link2 size={15} /> Vincular a existente
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-auto p-4">
                  {trocar && (
                    <button
                      type="button"
                      onClick={() => setTrocar(false)}
                      className="mb-3 text-xs font-semibold text-ink-soft hover:text-brand"
                    >
                      ← Voltar ao vínculo atual
                    </button>
                  )}
                  {erro && (
                    <div className="mb-3 flex items-center gap-2 rounded-lg border border-danger/30 bg-rose-50 px-3 py-2 text-xs text-danger">
                      <AlertTriangle size={14} /> {erro}
                    </div>
                  )}

                  {modo === "criar" ? (
                    <div className="space-y-3">
                      {(ext === "pdf" || IMG.has(ext)) && (
                        <button
                          type="button"
                          onClick={preencherIA}
                          disabled={extraindo}
                          className="flex w-full items-center justify-center gap-2 rounded-lg border border-brand/40 bg-brand-light px-3 py-2 text-sm font-semibold text-brand-dark transition hover:bg-brand/15 disabled:opacity-60"
                        >
                          {extraindo ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                          {extraindo ? "Lendo o documento…" : "Preencher pela IA"}
                        </button>
                      )}
                      <div className="flex gap-0.5 rounded-lg border border-line p-0.5 text-sm">
                        {[
                          { v: "saida", l: "Pagamento" },
                          { v: "entrada", l: "Recebimento" },
                        ].map((o) => (
                          <button
                            key={o.v}
                            type="button"
                            onClick={() => { setTipoLanc(o.v as "saida" | "entrada"); setCategoriaId(""); }}
                            className={`flex-1 rounded-md py-1.5 font-medium ${tipoLanc === o.v ? "bg-brand text-white" : "text-ink-muted hover:bg-surface"}`}
                          >
                            {o.l}
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={lbl}>Valor</label>
                          <input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" className={inp} />
                        </div>
                        <div>
                          <label className={lbl}>Vencimento</label>
                          <input type="date" value={venc} onChange={(e) => setVenc(e.target.value)} className={`num ${inp}`} />
                        </div>
                      </div>
                      <div>
                        <label className={lbl}>{tipoLanc === "entrada" ? "Cliente" : "Fornecedor"}</label>
                        <select value={pessoaId} onChange={(e) => setPessoaId(e.target.value)} className={inp}>
                          <option value="">—</option>
                          {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={lbl}>Categoria</label>
                        <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className={inp}>
                          <option value="">—</option>
                          {catsFiltradas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={lbl}>Conta</label>
                        <select value={contaId} onChange={(e) => setContaId(e.target.value)} className={inp}>
                          <option value="">—</option>
                          {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={lbl}>Descrição</label>
                        <input value={descricao} onChange={(e) => setDescricao(e.target.value)} className={inp} />
                      </div>
                      <div className="flex gap-0.5 rounded-lg border border-line p-0.5 text-sm">
                        {[
                          { v: "previsto", l: "Previsto" },
                          { v: "efetivado", l: "Efetivado" },
                        ].map((o) => (
                          <button
                            key={o.v}
                            type="button"
                            onClick={() => setSituacao(o.v as "previsto" | "efetivado")}
                            className={`flex-1 rounded-md py-1.5 font-medium ${situacao === o.v ? "bg-brand text-white" : "text-ink-muted hover:bg-surface"}`}
                          >
                            {o.l}
                          </button>
                        ))}
                      </div>
                      <p className="flex items-start gap-1.5 text-[11px] text-ink-soft">
                        <Info size={13} className="mt-0.5 shrink-0" />
                        {situacao === "efetivado"
                          ? "Efetivado com conta aparece também no extrato (Movimentações)."
                          : "Previsto aparece em Lançamentos e no Fluxo. Para entrar no extrato, marque Efetivado e escolha a conta."}
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => salvarCriar(false)}
                          disabled={salvando}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-brand px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
                        >
                          {salvando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Criar e anexar
                        </button>
                        {onProximo && (
                          <button
                            type="button"
                            onClick={() => salvarCriar(true)}
                            disabled={salvando}
                            title="Salva e abre o próximo documento da caixa"
                            className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-brand/40 bg-brand-light px-4 py-2.5 text-sm font-semibold text-brand-dark transition hover:bg-brand/15 disabled:opacity-60"
                          >
                            Criar e próximo →
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <input
                          value={busca}
                          onChange={(e) => setBusca(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && buscar()}
                          placeholder="Buscar por descrição ou valor…"
                          className={inp}
                        />
                        <button type="button" onClick={buscar} disabled={buscando} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-semibold text-ink-muted hover:border-brand hover:text-brand">
                          {buscando ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                        </button>
                      </div>
                      {resultados.length === 0 ? (
                        <p className="py-6 text-center text-xs text-ink-soft">Busque um lançamento para anexar este documento.</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {resultados.map((l) => (
                            <li key={l.id}>
                              <button
                                type="button"
                                onClick={() => vincular(l.id)}
                                disabled={salvando}
                                className="flex w-full items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-left text-sm transition hover:border-brand disabled:opacity-60"
                              >
                                <span className="min-w-0">
                                  <span className="block truncate text-ink">{l.descricao || "(sem descrição)"}</span>
                                  <span className="text-[11px] text-ink-soft">venc. {dataBR(l.data_vencimento)}{l.data_pagamento ? " · pago" : ""}</span>
                                </span>
                                <span className={`shrink-0 text-sm font-semibold ${l.tipo === "entrada" ? "text-brand-dark" : "text-danger"}`}>
                                  {brl(l.valor)}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

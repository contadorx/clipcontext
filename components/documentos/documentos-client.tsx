"use client";

import { useCallback, useMemo, useState } from "react";
import {
  FileText,
  Download,
  Archive,
  Loader2,
  Link2,
  FilePlus2,
  AlertTriangle,
  Landmark,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { selecionarEmpresa } from "@/app/actions";
import { SortToggle, ordenar, toggleOrd, type Ordenacao } from "@/components/ui/sort";
import BarraVisoes from "@/components/ui/barra-visoes";
import SoltarArquivo from "@/components/ui/soltar-arquivo";
import { useVisoes } from "@/components/ui/use-visoes";
import { queryParaFiltros, type Filtros } from "@/lib/visoes";
import DocLancar from "@/components/documentos/doc-lancar";
import EmptyState from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";

export type EmpresaOpt = { id: string; nome: string };

export type DocRow = {
  id: string;
  arquivo_nome: string;
  tipo: string | null;
  tamanho: number | null;
  observacao: string | null;
  status: string;
  enviado_em: string;
  baixado_em: string | null;
  lancamento_id: string | null;
  empresa_id: string;
  empresa_nome?: string;
  natureza?: string | null;
  /** preenchido quando existe outro arquivo idêntico nesta empresa */
  duplicata_de?: string | null;
};

const NATUREZA_INFO: Record<string, { label: string; cls: string }> = {
  a_pagar: { label: "A pagar", cls: "bg-surface text-ink-muted" },
  paga: { label: "Pago", cls: "bg-rose-50 text-danger" },
  a_receber: { label: "A receber", cls: "bg-brand-light text-brand-dark" },
  recebida: { label: "Recebido", cls: "bg-brand-light text-brand-dark" },
  extrato: { label: "Extrato", cls: "bg-surface text-ink-muted" },
  outro: { label: "Outro", cls: "bg-surface text-ink-soft" },
};

type Aba = "novos" | "baixados" | "todos";

function tamanhoHumano(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
function dataHora(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function DocumentosClient({
  inicial,
  userId,
  empresas,
  minhasEmpresasIds,
  empresaInicial = "",
  empresaAtualId = "",
}: {
  inicial: DocRow[];
  userId: string;
  empresas: EmpresaOpt[];
  minhasEmpresasIds: string[];
  empresaInicial?: string;
  /** empresa do contexto — é sob ela que as visões desta tela são guardadas */
  empresaAtualId?: string;
}) {
  // filtros desta tela na URL + visões salvas
  const { toast } = useToast();

  const padraoFiltros = useMemo<Filtros>(
    () => ({ aba: "novos", emp: empresaInicial, nat: "", minhas: "" }),
    [empresaInicial],
  );
  const inicialF = useMemo(
    () =>
      queryParaFiltros(
        new URLSearchParams(typeof window === "undefined" ? "" : window.location.search),
        padraoFiltros,
      ),
    // só na montagem
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [docs, setDocs] = useState<DocRow[]>(inicial);
  const [aba, setAba] = useState<Aba>(inicialF.aba as Aba);
  const [empresaFiltro, setEmpresaFiltro] = useState<string>(inicialF.emp as string);
  const [natFiltro, setNatFiltro] = useState<string>(inicialF.nat as string);
  const [soMinhas, setSoMinhas] = useState((inicialF.minhas as string) === "1");
  const [baixando, setBaixando] = useState<string | null>(null);
  const [ocultando, setOcultando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [lancarDoc, setLancarDoc] = useState<DocRow | null>(null);
  const [indoConciliar, setIndoConciliar] = useState<string | null>(null);
  const [ord, setOrd] = useState<Ordenacao>({ campo: "enviado", dir: "desc" });

  const filtros = useMemo<Filtros>(
    () => ({ aba, emp: empresaFiltro, nat: natFiltro, minhas: soMinhas ? "1" : "" }),
    [aba, empresaFiltro, natFiltro, soMinhas],
  );
  const aplicarFiltros = useCallback((f: Filtros) => {
    setAba((f.aba as Aba) || "novos");
    setEmpresaFiltro((f.emp as string) ?? "");
    setNatFiltro((f.nat as string) ?? "");
    setSoMinhas((f.minhas as string) === "1");
  }, []);
  const vis = useVisoes({
    empresaId: empresaAtualId,
    tela: "caixa-entrada",
    padrao: padraoFiltros,
    filtros,
    aplicar: aplicarFiltros,
  });

  function ehExtrato(d: DocRow): boolean {
    return d.natureza === "extrato" || d.tipo === "ofx" || d.tipo === "csv";
  }

  async function conciliar(d: DocRow) {
    setIndoConciliar(d.id);
    await selecionarEmpresa(d.empresa_id);
    window.location.href = "/conciliacao";
  }

  const minhasSet = useMemo(() => new Set(minhasEmpresasIds), [minhasEmpresasIds]);
  const temMinhas = minhasEmpresasIds.length > 0;

  // empresas que aparecem no filtro: só as que têm documento na caixa
  const empresasComDoc = useMemo(() => {
    const ids = new Set(docs.map((d) => d.empresa_id));
    return empresas.filter((e) => ids.has(e.id));
  }, [docs, empresas]);

  // aplica empresa + minhas empresas (vale para todas as abas e contagens)
  const base = useMemo(() => {
    return docs.filter((d) => {
      if (empresaFiltro && d.empresa_id !== empresaFiltro) return false;
      if (soMinhas && !minhasSet.has(d.empresa_id)) return false;
      if (natFiltro && (d.natureza ?? "") !== natFiltro) return false;
      return true;
    });
  }, [docs, empresaFiltro, soMinhas, minhasSet, natFiltro]);

  // destino do upload: o filtro de empresa da tela ganha do contexto global
  const empresaDoUpload = empresaFiltro || empresaAtualId;
  const nomeEmpresaUpload =
    empresas.find((e) => e.id === empresaDoUpload)?.nome ?? "esta empresa";

  const contagem = useMemo(
    () => ({
      novos: base.filter((d) => d.status === "novo").length,
      baixados: base.filter((d) => d.status === "baixado").length,
      todos: base.length,
    }),
    [base],
  );

  const filtrados = useMemo(() => {
    if (aba === "novos") return base.filter((d) => d.status === "novo");
    if (aba === "baixados") return base.filter((d) => d.status === "baixado");
    return base;
  }, [base, aba]);

  const ordenados = useMemo(
    () => ordenar(filtrados, ord, { enviado: (d) => d.enviado_em }),
    [filtrados, ord],
  );

  // próximo documento da lista atual que ainda precisa de lançamento (não extrato, não anexado)
  function irParaProximo(atualId: string): boolean {
    const idx = ordenados.findIndex((d) => d.id === atualId);
    const ordem = idx >= 0 ? [...ordenados.slice(idx + 1), ...ordenados.slice(0, idx)] : ordenados;
    const prox = ordem.find((d) => d.id !== atualId && !ehExtrato(d) && !d.lancamento_id);
    if (prox) {
      setLancarDoc(prox);
      return true;
    }
    return false;
  }

  async function baixar(d: DocRow) {
    setBaixando(d.id);
    setErro(null);
    try {
      const res = await fetch("/api/documentos/baixar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentoId: d.id }),
      });
      const j = await res.json();
      if (!res.ok) {
        setErro(j.error || "Não foi possível abrir o documento.");
      } else {
        window.open(j.url, "_blank", "noopener");
        setDocs((s) =>
          s.map((x) =>
            x.id === d.id && x.status === "novo"
              ? { ...x, status: "baixado", baixado_em: new Date().toISOString() }
              : x,
          ),
        );
      }
    } catch {
      setErro("Falha ao gerar o link.");
    }
    setBaixando(null);
  }

  /*
    Ocultar passou a ter volta.

    Era um clique sem confirmação, sem desfazer e sem caminho de retorno: não
    existe filtro "mostrar ocultos" nem tela que liste `documentos_ocultos`, e a
    ocultação é por usuário — os colegas continuam vendo. Quem errasse o botão
    perdia o documento da própria caixa para sempre, e sem nem saber que o
    perdeu, porque a lista simplesmente encolhe.

    O desfazer vive no toast, que é onde o app já resolve isso em outras telas,
    e reverte as duas coisas: a linha na tabela e a linha na lista.
  */
  async function ocultar(d: DocRow) {
    setOcultando(d.id);
    setErro(null);
    const supabase = createClient();
    const { error } = await supabase.from("documentos_ocultos").insert({ documento_id: d.id, user_id: userId });
    if (error) {
      setErro("Não foi possível ocultar.");
      setOcultando(null);
      return;
    }
    setDocs((s) => s.filter((x) => x.id !== d.id));
    setOcultando(null);
    toast(`${d.arquivo_nome} saiu da sua caixa.`, {
      desfazer: async () => {
        const r = await createClient()
          .from("documentos_ocultos")
          .delete()
          .eq("documento_id", d.id)
          .eq("user_id", userId);
        if (r.error) {
          setErro("Não foi possível trazer o documento de volta.");
          return;
        }
        setDocs((s) => (s.some((x) => x.id === d.id) ? s : [d, ...s]));
      },
    });
  }

  const abas: { v: Aba; label: string; n: number }[] = [
    { v: "novos", label: "Novos", n: contagem.novos },
    { v: "baixados", label: "Baixados", n: contagem.baixados },
    { v: "todos", label: "Todos", n: contagem.todos },
  ];

  const selCls = "rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-ink outline-none focus:border-brand";

  return (
    <div className="space-y-3">
      {erro && (
        <div className="flex items-center gap-2 rounded-xl2 border border-danger/30 bg-rose-50 px-4 py-3 text-sm text-danger">
          <AlertTriangle size={16} /> {erro}
        </div>
      )}

      {/* Esta tela é da carteira inteira, então o upload precisa dizer para qual
          empresa vai. Quando há um filtro de empresa aplicado, ele manda; senão
          vale a empresa do contexto. Documento gravado na empresa errada é caro
          de desfazer, e o texto abaixo nomeia o destino. */}
      {empresaDoUpload && (
        <SoltarArquivo
          empresaId={empresaDoUpload}
          onEnviado={(doc) => {
            // a lista vive em estado local: `router.refresh()` traria props novas
            // mas não remontaria o componente, e a linha nova não apareceria
            setDocs((d) => [
              {
                id: doc.id,
                arquivo_nome: doc.arquivo_nome,
                tipo: doc.tipo,
                tamanho: null,
                observacao: null,
                status: "novo",
                enviado_em: doc.enviado_em,
                baixado_em: null,
                lancamento_id: null,
                empresa_id: empresaDoUpload,
                empresa_nome: nomeEmpresaUpload,
              },
              ...d,
            ]);
            toast(`${doc.arquivo_nome} entrou na caixa de ${nomeEmpresaUpload}.`);
          }}
          ajuda={`Vai para ${nomeEmpresaUpload}. Arquivos que chegam por e-mail ou WhatsApp entram por aqui, sem depender do portal do cliente.`}
        />
      )}

      <BarraVisoes
        visoes={vis.visoes}
        ativaId={vis.ativaId}
        sujo={vis.sujo}
        onAplicar={vis.aplicarVisao}
        onLimpar={vis.limpar}
        onSalvar={vis.salvar}
        onApagar={vis.apagar}
      />

      {/* filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-0.5 rounded-lg border border-line p-0.5 text-sm">
          {abas.map((a) => (
            <button
              key={a.v}
              type="button"
              onClick={() => setAba(a.v)}
              className={
                aba === a.v
                  ? "rounded-md bg-brand px-3 py-1.5 font-semibold text-white"
                  : "rounded-md px-3 py-1.5 font-medium text-ink-muted transition hover:bg-surface"
              }
            >
              {a.label} <span className={aba === a.v ? "opacity-80" : "text-ink-soft"}>({a.n})</span>
            </button>
          ))}
        </div>

        {temMinhas && (
          <button
            type="button"
            onClick={() => setSoMinhas((v) => !v)}
            className={
              soMinhas
                ? "rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-white"
                : "rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink-muted transition hover:border-brand hover:text-brand"
            }
          >
            Minhas empresas
          </button>
        )}

        <select value={natFiltro} onChange={(e) => setNatFiltro(e.target.value)} className={selCls} title="Filtrar pelo que o cliente marcou">
          <option value="">Toda natureza</option>
          <option value="a_pagar">A pagar</option>
          <option value="paga">Pago</option>
          <option value="a_receber">A receber</option>
          <option value="recebida">Recebido</option>
          <option value="extrato">Extrato</option>
          <option value="outro">Outro</option>
        </select>

        <select value={empresaFiltro} onChange={(e) => setEmpresaFiltro(e.target.value)} className={selCls} title="Filtrar por empresa">
          <option value="">Todas as empresas</option>
          {empresasComDoc.map((e) => (
            <option key={e.id} value={e.id}>{e.nome}</option>
          ))}
        </select>

        <span className="ml-auto text-xs text-ink-soft">
          <SortToggle label="Data de envio" campo="enviado" inicial="asc" ord={ord} onToggle={(c, i) => setOrd((o) => toggleOrd(o, c, i))} />
        </span>
      </div>

      {filtrados.length === 0 ? (
        <EmptyState
          titulo={aba === "novos" ? "Nenhum documento novo" : "Nada por aqui"}
          descricao="Os documentos enviados pelos clientes no portal aparecem aqui."
        />
      ) : (
        <div className="overflow-hidden rounded-xl2 bg-white shadow-card">
          {ordenados.map((d) => (
            <div key={d.id} className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-0">
              <FileText size={18} className="shrink-0 text-ink-soft" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="shrink-0 rounded bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted">{d.empresa_nome}</span>
                  {d.natureza && NATUREZA_INFO[d.natureza] && (
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${NATUREZA_INFO[d.natureza].cls}`}>
                      {NATUREZA_INFO[d.natureza].label}
                    </span>
                  )}
                  <span className="truncate text-sm font-medium text-ink">{d.arquivo_nome}</span>
                  {d.status === "novo" && (
                    <span className="shrink-0 rounded-full bg-brand-light px-2 py-0.5 text-[10px] font-bold text-brand-dark">Novo</span>
                  )}
                  {/* Duplicata: dois arquivos idênticos na caixa é o caso comum
                  (o cliente reenvia por segurança, o contador anexa o que já
                  veio pelo portal). O envio não é bloqueado — só deixa de
                  fingir que são documentos diferentes. */}
              {d.duplicata_de && (
                <span
                  className="shrink-0 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700"
                  title="Já existe um arquivo idêntico nesta empresa"
                >
                  cópia
                </span>
              )}
              {d.lancamento_id && (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-ink-soft">
                      <Link2 size={11} /> Anexado
                    </span>
                  )}
                </div>
                <p className="truncate text-[11px] text-ink-soft">
                  {dataHora(d.enviado_em)}
                  {d.tamanho ? ` · ${tamanhoHumano(d.tamanho)}` : ""}
                  {d.observacao ? ` · ${d.observacao}` : ""}
                </p>
              </div>
              {ehExtrato(d) ? (
                <button
                  type="button"
                  onClick={() => conciliar(d)}
                  disabled={indoConciliar === d.id}
                  title="Importar este extrato na conciliação desta empresa"
                  className="flex shrink-0 items-center gap-1.5 rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
                >
                  {indoConciliar === d.id ? <Loader2 size={14} className="animate-spin" /> : <Landmark size={14} />} Conciliar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setLancarDoc(d)}
                  className="flex shrink-0 items-center gap-1.5 rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-brand-dark"
                >
                  {d.lancamento_id ? <Link2 size={14} /> : <FilePlus2 size={14} />} {d.lancamento_id ? "Ver/relançar" : "Lançar"}
                </button>
              )}
              <button
                type="button"
                onClick={() => baixar(d)}
                disabled={baixando === d.id}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-muted transition hover:border-brand hover:text-brand disabled:opacity-60"
              >
                {baixando === d.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Abrir
              </button>
              <button
                type="button"
                onClick={() => ocultar(d)}
                disabled={ocultando === d.id}
                title="Ocultar para mim"
                className="flex shrink-0 items-center justify-center rounded-lg p-1.5 text-ink-soft transition hover:bg-surface hover:text-ink-muted disabled:opacity-60"
              >
                {ocultando === d.id ? <Loader2 size={14} className="animate-spin" /> : <Archive size={15} />}
              </button>
            </div>
          ))}
        </div>
      )}

      {lancarDoc && (
        <DocLancar
          key={lancarDoc.id}
          doc={lancarDoc}
          empresaId={lancarDoc.empresa_id}
          empresaNome={lancarDoc.empresa_nome}
          natureza={lancarDoc.natureza ?? undefined}
          onFechar={() => setLancarDoc(null)}
          onProximo={() => irParaProximo(lancarDoc.id)}
          onVinculo={(docId, lancamentoId) => {
            setDocs((s) =>
              s.map((x) =>
                x.id === docId
                  ? { ...x, lancamento_id: lancamentoId, status: lancamentoId && x.status === "novo" ? "baixado" : x.status }
                  : x,
              ),
            );
          }}
        />
      )}
    </div>
  );
}

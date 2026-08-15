"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, ExternalLink, Search, ChevronLeft, ChevronRight, Send, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { NfseRow } from "@/components/vendas/notas-fiscais";
import ObjectStatus, { type Tom } from "@/components/ui/object-status";
import FilterBar from "@/components/ui/filter-bar";
import BarraVisoes from "@/components/ui/barra-visoes";
import { useVisoes } from "@/components/ui/use-visoes";
import { queryParaFiltros, type Filtros } from "@/lib/visoes";
import EmptyState from "@/components/ui/empty-state";
import { useSearchParams } from "next/navigation";
import { brl, dataBR } from "@/lib/formato";
import MessageStrip, { Msg } from "@/components/ui/message-strip";
import { classeControle } from "@/components/ui/campo";

type Cliente = { id: string; nome: string };

// Linha de nota com os campos de origem garantidos — resiliente a versões
// antigas de NfseRow que ainda não tenham venda_id/contrato_faturamento_id.
type NotaRow = NfseRow & {
  venda_id: string | null;
  contrato_faturamento_id: string | null;
};

const PAGINA = 25;

const STATUS_NOTA: Record<string, { l: string; tom: Tom }> = {
  pendente: { l: "pendente", tom: "neutro" },
  processando: { l: "processando", tom: "info" },
  emitida: { l: "emitida", tom: "positivo" },
  homologacao: { l: "homologação", tom: "critico" },
  rejeitada: { l: "rejeitada", tom: "negativo" },
  cancelada: { l: "cancelada", tom: "neutro" },
};

// Ordem dos chips de status (o "todas" entra na frente em runtime).
const STATUS_FILTROS = ["emitida", "homologacao", "rejeitada", "cancelada", "processando", "pendente"] as const;

const COLUNAS =
  "id, origem, venda_id, contrato_faturamento_id, cliente_fornecedor_id, valor_servico, status, ambiente, nfse_numero, dps_numero, pdf_url, motivo_erro, emitida_em, criado_em";

function soDigitos(s: string): boolean {
  return /^\d+$/.test(s.trim());
}

export default function CentralNotas({
  empresaId,
  clientes,
  notasIniciais,
  onCancelar,
  onReemitido,
  reloadSignal,
}: {
  empresaId: string;
  clientes: Cliente[];
  notasIniciais: NfseRow[];
  onCancelar: (n: NfseRow) => void;
  onReemitido?: () => void;
  reloadSignal: number;
}) {
  // Filtros na URL + visões salvas: o recorte vira link e vira chip nomeado.
  const padraoFiltros = useMemo<Filtros>(() => ({ status: "todas", de: "", ate: "", q: "" }), []);
  // useSearchParams e não window.location: o servidor também precisa enxergar a
  // URL, senão ele renderiza os filtros vazios, o cliente renderiza os da URL e
  // o React acusa divergência de hidratação ao abrir um link com ?status=…
  const searchParams = useSearchParams();
  const iniciais = useMemo(
    () => queryParaFiltros(new URLSearchParams(searchParams?.toString() ?? ""), padraoFiltros),
    // só na montagem
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [status, setStatus] = useState<string>(iniciais.status as string);
  const [de, setDe] = useState(iniciais.de as string);
  const [ate, setAte] = useState(iniciais.ate as string);
  const [buscaInput, setBuscaInput] = useState(iniciais.q as string);
  const [busca, setBusca] = useState(iniciais.q as string);
  const [pagina, setPagina] = useState(0);

  const [rows, setRows] = useState<NotaRow[]>(notasIniciais as NotaRow[]);
  const [total, setTotal] = useState<number>(notasIniciais.length);
  const [contagens, setContagens] = useState<Record<string, number>>({});
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [reemitindo, setReemitindo] = useState<string | null>(null);
  const [acaoMsg, setAcaoMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  const clienteMap = useMemo(() => {
    const m = new Map<string, Cliente>();
    clientes.forEach((c) => m.set(c.id, c));
    return m;
  }, [clientes]);

  // Resolve o termo de busca: número da nota (só dígitos) ou nome de cliente.
  const filtroBusca = useMemo(() => {
    const t = busca.trim();
    if (!t) return null;
    if (soDigitos(t)) return { tipo: "numero" as const, valor: t };
    const ids = clientes.filter((c) => c.nome.toLowerCase().includes(t.toLowerCase())).map((c) => c.id);
    return { tipo: "cliente" as const, ids };
  }, [busca, clientes]);

  // Aplica empresa + período + busca a qualquer query da tabela nfse.
  const aplicarBase = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (q: any) => {
      q = q.eq("empresa_id", empresaId);
      if (de) q = q.gte("criado_em", de);
      if (ate) q = q.lte("criado_em", `${ate}T23:59:59.999`);
      if (filtroBusca) {
        if (filtroBusca.tipo === "numero") {
          const n = Number(filtroBusca.valor);
          q = q.or(`nfse_numero.ilike.*${filtroBusca.valor}*,dps_numero.eq.${Number.isSafeInteger(n) ? n : -1}`);
        } else {
          // sem cliente correspondente: força resultado vazio
          q = q.in("cliente_fornecedor_id", filtroBusca.ids.length ? filtroBusca.ids : ["00000000-0000-0000-0000-000000000000"]);
        }
      }
      return q;
    },
    [empresaId, de, ate, filtroBusca],
  );

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    const supabase = createClient();
    try {
      // linhas da página atual (com total do filtro corrente)
      let q = aplicarBase(supabase.from("nfse").select(COLUNAS, { count: "exact" }));
      if (status !== "todas") q = q.eq("status", status);
      const desde = pagina * PAGINA;
      const { data, count, error } = await q
        .order("criado_em", { ascending: false })
        .range(desde, desde + PAGINA - 1);
      if (error) throw error;
      setRows((data ?? []) as NotaRow[]);
      setTotal(count ?? 0);

      // contagens por status (respeitam período e busca, ignoram o status selecionado)
      const entradas = await Promise.all(
        STATUS_FILTROS.map(async (s) => {
          const { count: c } = await aplicarBase(
            supabase.from("nfse").select("id", { count: "exact", head: true }),
          ).eq("status", s);
          return [s, c ?? 0] as const;
        }),
      );
      setContagens(Object.fromEntries(entradas));
    } catch (e) {
      setErro("Não foi possível carregar as notas. Tente novamente.");
      setRows([]);
      setTotal(0);
    } finally {
      setCarregando(false);
    }
  }, [aplicarBase, status, pagina]);

  // Reemite a partir da origem da nota rejeitada (mesma rota da fila).
  async function reemitir(n: NotaRow) {
    const origem = n.origem === "venda" ? "venda" : "contrato";
    const idOrigem = origem === "venda" ? n.venda_id : n.contrato_faturamento_id;
    if (!idOrigem) {
      setAcaoMsg({ tipo: "erro", texto: "Não foi possível identificar a origem desta nota para reemitir." });
      return;
    }
    setReemitindo(n.id);
    setAcaoMsg(null);
    try {
      const resp = await fetch("/api/nfse/emitir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empresaId,
          origem,
          vendaId: origem === "venda" ? idOrigem : undefined,
          faturamentoId: origem === "contrato" ? idOrigem : undefined,
        }),
      });
      const j = (await resp.json().catch(() => ({}))) as { ok?: boolean; homologacao?: boolean; nfseNumero?: string | null; erro?: string | null; error?: string; aviso?: string | null };
      if (j.ok) {
        if (j.homologacao) {
          setAcaoMsg({
            tipo: "ok",
            texto: "RPS validado em homologação (teste). Nenhuma nota real foi gerada — mude o ambiente para produção em Configurações → NFS-e para emitir de verdade.",
          });
        } else {
          // `aviso` = a nota saiu mas a origem continua pendente; reemitir duplica
          setAcaoMsg(
            j.aviso
              ? { tipo: "erro", texto: `NFS-e reemitida${j.nfseNumero ? ` (nº ${j.nfseNumero})` : ""}. ${j.aviso}` }
              : { tipo: "ok", texto: `NFS-e reemitida${j.nfseNumero ? ` (nº ${j.nfseNumero})` : ""}.` },
          );
          onReemitido?.();
        }
      } else {
        setAcaoMsg({ tipo: "erro", texto: j.erro ?? j.error ?? "A reemissão foi rejeitada — veja o novo motivo na nota." });
      }
    } catch {
      setAcaoMsg({ tipo: "erro", texto: "Erro de conexão ao reemitir. Tente novamente." });
    } finally {
      setReemitindo(null);
      carregar();
    }
  }

  // recarrega quando filtros/página/sinal externo mudam
  useEffect(() => {
    carregar();
  }, [carregar, reloadSignal]);

  // qualquer mudança de filtro volta para a primeira página
  function mudarStatus(s: string) {
    setStatus(s);
    setPagina(0);
  }
  function aplicarBuscaInput() {
    setBusca(buscaInput);
    setPagina(0);
  }

  const totalContagens = STATUS_FILTROS.reduce((s, k) => s + (contagens[k] ?? 0), 0);
  const totalPaginas = Math.max(1, Math.ceil(total / PAGINA));
  const inicio = total === 0 ? 0 : pagina * PAGINA + 1;
  const fim = Math.min(total, (pagina + 1) * PAGINA);

  const filtros = useMemo<Filtros>(() => ({ status, de, ate, q: busca }), [status, de, ate, busca]);
  const filtrando = Boolean(busca || de || ate || status !== "todas");
  const aplicarFiltros = useCallback((f: Filtros) => {
    setStatus((f.status as string) || "todas");
    setDe((f.de as string) ?? "");
    setAte((f.ate as string) ?? "");
    setBusca((f.q as string) ?? "");
    setBuscaInput((f.q as string) ?? "");
    setPagina(0);
  }, []);
  const vis = useVisoes({ empresaId, tela: "notas-fiscais", padrao: padraoFiltros, filtros, aplicar: aplicarFiltros });

  return (
    <div className="overflow-hidden rounded-xl2 bg-white shadow-card">
      {/* cabeçalho + chips de status */}
      <div className="border-b border-line bg-surface/50 px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="mr-1 text-xs font-bold uppercase tracking-wide text-ink-soft">Notas</p>
          <button
            type="button"
            onClick={() => mudarStatus("todas")}
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
              status === "todas" ? "bg-ink text-white" : "bg-white text-ink-soft hover:bg-surface"
            }`}
          >
            todas {totalContagens}
          </button>
          {STATUS_FILTROS.map((s) => {
            const meta = STATUS_NOTA[s];
            const ativo = status === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => mudarStatus(s)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                  ativo ? "bg-ink text-white" : "bg-white text-ink-soft hover:bg-surface"
                }`}
              >
                {meta.l} {contagens[s] ?? 0}
              </button>
            );
          })}
        </div>

        {/* busca + período */}
        <div className="mt-3">
          <FilterBar
            tela="notas-fiscais"
            ativos={[busca.trim() !== "", de !== "", ate !== "", status !== "todas"].filter(Boolean).length}
            onLimpar={vis.limpar}
            variantes={
              <BarraVisoes
                visoes={vis.visoes}
                ativaId={vis.ativaId}
                sujo={vis.sujo}
                onAplicar={vis.aplicarVisao}
                onLimpar={vis.limpar}
                onSalvar={vis.salvar}
                onApagar={vis.apagar}
              />
            }
            campos={[
              {
                id: "q",
                label: "Tomador / número",
                fixo: true,
                ativo: busca.trim() !== "",
                min: "260px",
                node: (
                  <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft" />
                    <input
                      value={buscaInput}
                      onChange={(e) => setBuscaInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") aplicarBuscaInput();
                      }}
                      onBlur={aplicarBuscaInput}
                      placeholder="Nome do tomador ou número da nota"
                      className={classeControle("sm", false, "bg-white pl-8 pr-2")}
                    />
                  </div>
                ),
              },
              {
                id: "de",
                label: "Criada de",
                ativo: de !== "",
                min: "140px",
                node: (
                  <input
                    type="date"
                    value={de}
                    onChange={(e) => {
                      setDe(e.target.value);
                      setPagina(0);
                    }}
                    className={classeControle("sm", false, "num bg-white")}
                  />
                ),
              },
              {
                id: "ate",
                label: "Até",
                ativo: ate !== "",
                min: "140px",
                node: (
                  <input
                    type="date"
                    value={ate}
                    onChange={(e) => {
                      setAte(e.target.value);
                      setPagina(0);
                    }}
                    className={classeControle("sm", false, "num bg-white")}
                  />
                ),
              },
            ]}
          />
        </div>
      </div>

      {erro && <MessageStrip tipo="erro" className="mx-4 my-2">{erro}</MessageStrip>}
      {acaoMsg && <Msg msg={acaoMsg} className="mx-4 my-2" />}

      {/* lista */}
      {rows.length === 0 && !carregando ? (
        <EmptyState
          filtrado
          icone={FileText}
          titulo={filtrando ? "Nenhuma nota para estes filtros" : "Nenhuma nota ainda"}
          descricao={
            filtrando
              ? "Ajuste o status, a busca ou o período."
              : "As notas transmitidas vão aparecer aqui, com número, status e PDF."
          }
        />
      ) : (
        <div className={carregando ? "opacity-60 transition" : "transition"}>
          {rows.map((n) => {
            const st = STATUS_NOTA[n.status] ?? STATUS_NOTA.pendente;
            const ehRejeitada = n.status === "rejeitada";
            return (
              <div key={n.id} className="border-b border-line/60 last:border-0">
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">
                      {n.cliente_fornecedor_id ? clienteMap.get(n.cliente_fornecedor_id)?.nome ?? "Cliente" : "Cliente"}
                      {n.nfse_numero ? ` · NFS-e ${n.nfse_numero}` : n.dps_numero ? ` · DPS ${n.dps_numero}` : ""}
                    </p>
                    <p className="text-[11px] text-ink-soft">
                      {n.origem} · {dataBR(n.emitida_em ?? n.criado_em)} · {n.ambiente}
                    </p>
                  </div>
                  <span className="num shrink-0 text-sm font-semibold text-ink">{brl(n.valor_servico)}</span>
                  <ObjectStatus pilula tom={st.tom} className="shrink-0">{st.l}</ObjectStatus>
                  {ehRejeitada && (
                    <button
                      type="button"
                      onClick={() => reemitir(n)}
                      disabled={reemitindo !== null}
                      className="flex shrink-0 items-center gap-1.5 rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50"
                    >
                      <Send size={13} /> {reemitindo === n.id ? "Reemitindo…" : "Reemitir"}
                    </button>
                  )}
                  {n.pdf_url && (
                    <a
                      href={n.pdf_url}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 rounded-lg p-1.5 text-ink-soft transition hover:bg-surface hover:text-brand"
                      aria-label="Abrir DANFSe"
                    >
                      <ExternalLink size={14} />
                    </a>
                  )}
                  {n.status === "emitida" && (
                    <button
                      type="button"
                      onClick={() => onCancelar(n)}
                      className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold text-ink-soft transition hover:bg-rose-50 hover:text-danger"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
                {ehRejeitada && n.motivo_erro && (
                  <div className="mx-4 mb-3 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-[11px] text-danger">
                    <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                    <span className="break-words">{n.motivo_erro}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* rodapé: paginação */}
      <div className="flex items-center justify-between gap-3 border-t border-line bg-surface/30 px-4 py-2.5">
        <p className="text-[11px] text-ink-soft">
          {carregando ? "Carregando…" : total === 0 ? "0 nota" : `${inicio}–${fim} de ${total} nota(s)`}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPagina((p) => Math.max(0, p - 1))}
            disabled={pagina === 0 || carregando}
            className="rounded-lg border border-line p-1.5 text-ink-soft transition hover:bg-surface disabled:opacity-40"
            aria-label="Página anterior"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="px-1 text-[11px] font-semibold text-ink-soft">
            {pagina + 1}/{totalPaginas}
          </span>
          <button
            type="button"
            onClick={() => setPagina((p) => (p + 1 < totalPaginas ? p + 1 : p))}
            disabled={pagina + 1 >= totalPaginas || carregando}
            className="rounded-lg border border-line p-1.5 text-ink-soft transition hover:bg-surface disabled:opacity-40"
            aria-label="Próxima página"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

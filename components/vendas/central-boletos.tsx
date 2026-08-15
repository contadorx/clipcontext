"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Search, ChevronLeft, ChevronRight, Printer, Link2, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { TituloRow } from "@/components/vendas/boletos";
import ObjectStatus, { type Tom } from "@/components/ui/object-status";
import FilterBar from "@/components/ui/filter-bar";
import BarraVisoes from "@/components/ui/barra-visoes";
import { useVisoes } from "@/components/ui/use-visoes";
import { queryParaFiltros, type Filtros } from "@/lib/visoes";
import EmptyState from "@/components/ui/empty-state";
import { useSearchParams } from "next/navigation";
import { brl, dataBR } from "@/lib/formato";
import MessageStrip from "@/components/ui/message-strip";
import { classeControle } from "@/components/ui/campo";

const PAGINA = 25;

const STATUS_TITULO: Record<string, { l: string; tom: Tom }> = {
  gerado: { l: "gerado", tom: "neutro" },
  em_remessa: { l: "em remessa", tom: "info" },
  registrado: { l: "registrado", tom: "positivo" },
  liquidado: { l: "liquidado", tom: "positivo" },
  baixado: { l: "baixado", tom: "neutro" },
  erro: { l: "erro", tom: "negativo" },
};

const STATUS_FILTROS = ["gerado", "em_remessa", "registrado", "liquidado", "baixado", "erro"] as const;

const COLUNAS =
  "id, token_publico, conta_id, origem, venda_parcela_id, contrato_faturamento_id, lancamento_id, nfse_id, cliente_fornecedor_id, nosso_numero, nosso_numero_fmt, numero_documento, valor, vencimento, sacado_nome, sacado_documento, sacado_logradouro, sacado_cep, sacado_municipio, sacado_uf, status, criado_em";

function soDigitos(s: string): boolean {
  return /^\d+$/.test(s.trim());
}

export default function CentralBoletos({
  empresaId,
  titulosIniciais,
  onCopiarLink,
  onExcluir,
  reloadSignal,
}: {
  empresaId: string;
  titulosIniciais: TituloRow[];
  onCopiarLink: (t: TituloRow) => void;
  onExcluir: (t: TituloRow) => void;
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

  const [rows, setRows] = useState<TituloRow[]>(titulosIniciais);
  const [total, setTotal] = useState<number>(titulosIniciais.length);
  const [contagens, setContagens] = useState<Record<string, number>>({});
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // termo de busca: número (só dígitos → nosso número) ou nome do sacado.
  const filtroBusca = useMemo(() => {
    const t = busca.trim();
    if (!t) return null;
    return soDigitos(t) ? { tipo: "numero" as const, valor: t } : { tipo: "sacado" as const, valor: t };
  }, [busca]);

  // aplica empresa + período (vencimento) + busca a qualquer query de cobranca_titulos.
  const aplicarBase = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (q: any) => {
      q = q.eq("empresa_id", empresaId);
      if (de) q = q.gte("vencimento", de);
      if (ate) q = q.lte("vencimento", ate);
      if (filtroBusca) {
        if (filtroBusca.tipo === "numero") {
          const n = Number(filtroBusca.valor);
          q = q.or(`nosso_numero_fmt.ilike.*${filtroBusca.valor}*,nosso_numero.eq.${Number.isSafeInteger(n) ? n : -1}`);
        } else {
          q = q.ilike("sacado_nome", `%${filtroBusca.valor}%`);
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
      let q = aplicarBase(supabase.from("cobranca_titulos").select(COLUNAS, { count: "exact" }));
      if (status !== "todas") q = q.eq("status", status);
      const desde = pagina * PAGINA;
      const { data, count, error } = await q
        .order("vencimento", { ascending: false })
        .range(desde, desde + PAGINA - 1);
      if (error) throw error;
      setRows((data ?? []) as TituloRow[]);
      setTotal(count ?? 0);

      const entradas = await Promise.all(
        STATUS_FILTROS.map(async (s) => {
          const { count: c } = await aplicarBase(
            supabase.from("cobranca_titulos").select("id", { count: "exact", head: true }),
          ).eq("status", s);
          return [s, c ?? 0] as const;
        }),
      );
      setContagens(Object.fromEntries(entradas));
    } catch {
      setErro("Não foi possível carregar os boletos. Tente novamente.");
      setRows([]);
      setTotal(0);
    } finally {
      setCarregando(false);
    }
  }, [aplicarBase, status, pagina]);

  useEffect(() => {
    carregar();
  }, [carregar, reloadSignal]);

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
  const vis = useVisoes({ empresaId, tela: "boletos", padrao: padraoFiltros, filtros, aplicar: aplicarFiltros });

  return (
    <div className="overflow-hidden rounded-xl2 bg-white shadow-card">
      <div className="border-b border-line bg-surface/50 px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="mr-1 text-xs font-bold uppercase tracking-wide text-ink-soft">Boletos</p>
          <button
            type="button"
            onClick={() => mudarStatus("todas")}
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
              status === "todas" ? "bg-ink text-white" : "bg-white text-ink-soft hover:bg-surface"
            }`}
          >
            todos {totalContagens}
          </button>
          {STATUS_FILTROS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => mudarStatus(s)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                status === s ? "bg-ink text-white" : "bg-white text-ink-soft hover:bg-surface"
              }`}
            >
              {STATUS_TITULO[s].l} {contagens[s] ?? 0}
            </button>
          ))}
        </div>

        <div className="mt-3">
          <FilterBar
            tela="boletos"
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
                label: "Sacado / nosso número",
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
                      placeholder="Nome do sacado ou nosso número"
                      className={classeControle("sm", false, "bg-white pl-8 pr-2")}
                    />
                  </div>
                ),
              },
              {
                id: "de",
                label: "Vence de",
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

      {rows.length === 0 && !carregando ? (
        <EmptyState
          filtrado
          icone={FileText}
          titulo={filtrando ? "Nenhum boleto para estes filtros" : "Nenhum boleto ainda"}
          descricao={
            filtrando
              ? "Ajuste o status, a busca ou o período de vencimento."
              : "Os boletos gerados vão aparecer aqui, com nosso número, vencimento e status."
          }
        />
      ) : (
        <div className={carregando ? "opacity-60 transition" : "transition"}>
          {rows.map((t) => {
            const st = STATUS_TITULO[t.status] ?? STATUS_TITULO.gerado;
            return (
              <div key={t.id} className="flex items-center gap-3 border-b border-line/60 px-4 py-2.5 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{t.sacado_nome ?? "Sacado"}</p>
                  <p className="num text-[11px] text-ink-soft">
                    NN {t.nosso_numero_fmt ?? t.nosso_numero} · vence {dataBR(t.vencimento)}
                  </p>
                </div>
                <span className="num shrink-0 text-sm font-semibold text-ink">{brl(t.valor)}</span>
                <ObjectStatus pilula tom={st.tom} className="shrink-0">{st.l}</ObjectStatus>
                <a
                  href={`/boleto/${t.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 rounded-lg p-1.5 text-ink-soft transition hover:bg-surface hover:text-brand"
                  aria-label="Imprimir boleto"
                >
                  <Printer size={15} />
                </a>
                <button
                  type="button"
                  onClick={() => onCopiarLink(t)}
                  className="shrink-0 rounded-lg p-1.5 text-ink-soft transition hover:bg-surface hover:text-brand"
                  aria-label="Copiar link público do boleto"
                  title="Copiar link público (o cliente abre sem login)"
                >
                  <Link2 size={15} />
                </button>
                {t.status === "gerado" && (
                  <button
                    type="button"
                    onClick={() => onExcluir(t)}
                    className="shrink-0 rounded-lg p-1.5 text-ink-soft transition hover:bg-surface hover:text-danger"
                    aria-label="Excluir boleto"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-line bg-surface/30 px-4 py-2.5">
        <p className="text-[11px] text-ink-soft">
          {carregando ? "Carregando…" : total === 0 ? "0 boleto" : `${inicio}–${fim} de ${total} boleto(s)`}
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

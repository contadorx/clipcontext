"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Copy,
  Link as LinkIcon,
  Lock,
  Paperclip,
  Split,
  Trash2,
} from "lucide-react";
import LancamentoModal, { type LancEdit, type Tipo } from "@/components/lancamentos/lancamento-modal";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { carregarRateios, type ParteRateio } from "@/lib/rateio";
import { dataBR } from "@/lib/data-atalho";
import MedeCabecalho from "@/components/ui/mede-cabecalho";
import SoltarArquivo from "@/components/ui/soltar-arquivo";
import ObjectStatus, { type Tom } from "@/components/ui/object-status";
import { brl } from "@/lib/formato";
import EmptyState from "@/components/ui/empty-state";

export type LancObjeto = LancEdit & {
  tipo: Tipo;
  conciliado: boolean;
  exportado_em: string | null;
  recorrencia_id: string | null;
  transferencia: boolean;
  categoria_nome: string | null;
  conta_nome: string | null;
  pessoa_nome: string | null;
  centro_nome: string | null;
};

type Anexo = { id: string; arquivo_nome: string; enviado_em: string; tipo: string | null };

/**
 * Um dado do cabeçalho do objeto: rótulo pequeno em cima, valor em destaque
 * embaixo. Vive no escopo do módulo, não dentro do render — definido lá dentro,
 * ganharia identidade nova a cada render e o React remontaria o cabeçalho
 * inteiro sempre que a página recalculasse.
 */
function Facet({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="min-w-[110px]">
      <div className="text-[11px] text-ink-muted">{k}</div>
      <div className="mt-0.5 text-[15px] font-bold">{children}</div>
    </div>
  );
}

/**
 * Página do lançamento.
 *
 * O mesmo formulário do diálogo, agora com URL própria, cabeçalho com os campos
 * que importam de relance (header facets) e seções com âncora. É o que permite
 * mandar o link do item para alguém, abrir em outra aba e voltar pelo navegador.
 */
export default function LancamentoObjeto({
  empresaId,
  lanc,
  centros,
  anteriorId,
  proximoId,
}: {
  empresaId: string;
  lanc: LancObjeto;
  centros: { id: string; nome: string }[];
  /** vizinhos na ordenação da lista, para percorrer sem voltar */
  anteriorId?: string | null;
  proximoId?: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [compacto, setCompacto] = useState(false);
  const [secao, setSecao] = useState("dados");
  const [rateio, setRateio] = useState<ParteRateio[]>([]);
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [disponiveis, setDisponiveis] = useState<Anexo[]>([]);
  const [ligando, setLigando] = useState(false);
  const [duplicando, setDuplicando] = useState(false);
  const refs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    function onScroll() {
      setCompacto(window.scrollY > 90);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Alt+↑/↓ percorre os vizinhos. Alt para não brigar com a rolagem da página
  // nem com o cursor dentro dos campos.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!e.altKey) return;
      if (e.key === "ArrowUp" && anteriorId) {
        e.preventDefault();
        router.push(`/movimentacoes/${anteriorId}`);
      } else if (e.key === "ArrowDown" && proximoId) {
        e.preventDefault();
        router.push(`/movimentacoes/${proximoId}`);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [anteriorId, proximoId, router]);

  /**
   * Duplicar: copia o lançamento e abre a cópia.
   *
   * A cópia nasce limpa do que é específico daquela ocorrência — não vem paga,
   * não vem conciliada, não vem exportada e não herda o vínculo com a
   * recorrência. Herdar qualquer um desses seria criar um lançamento que mente
   * sobre o próprio passado.
   */
  async function duplicar() {
    setDuplicando(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("lancamentos")
      .insert({
        empresa_id: empresaId,
        tipo: lanc.tipo,
        valor: lanc.valor,
        descricao: lanc.descricao,
        categoria_id: lanc.categoria_id,
        conta_id: lanc.conta_id,
        cliente_fornecedor_id: lanc.cliente_fornecedor_id,
        centro_custo_id: lanc.centro_custo_id,
        data_competencia: lanc.data_competencia,
        data_vencimento: lanc.data_vencimento,
        numero_documento: lanc.numero_documento,
        forma_pagamento: lanc.forma_pagamento,
        pagamento_dados: lanc.pagamento_dados,
        data_pagamento: null,
        data_agendamento: null,
        conciliado: false,
      })
      .select("id")
      .single();
    setDuplicando(false);
    if (error || !data) {
      toast("Não foi possível duplicar.", { tom: "erro" });
      return;
    }
    toast("Cópia criada — confira a data antes de salvar.");
    router.push(`/movimentacoes/${(data as { id: string }).id}`);
  }

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const [mapa, docs] = await Promise.all([
        carregarRateios(supabase, empresaId, [lanc.id]),
        supabase
          .from("documentos_recebidos")
          .select("id, arquivo_nome, enviado_em, tipo")
          .eq("lancamento_id", lanc.id)
          .order("enviado_em", { ascending: false }),
      ]);
      setRateio(mapa.get(lanc.id) ?? []);
      setAnexos((docs.data as Anexo[]) ?? []);

      // documentos da empresa ainda sem lançamento — candidatos a anexar aqui
      const { data: livres } = await supabase
        .from("documentos_recebidos")
        .select("id, arquivo_nome, enviado_em, tipo")
        .eq("empresa_id", empresaId)
        .is("lancamento_id", null)
        .neq("status", "expurgado")
        .order("enviado_em", { ascending: false })
        .limit(20);
      setDisponiveis((livres as Anexo[]) ?? []);
    })();
  }, [empresaId, lanc.id]);

  const nomeCentro = useMemo(() => {
    const m = new Map(centros.map((c) => [c.id, c.nome]));
    return (id: string) => m.get(id) ?? "Centro removido";
  }, [centros]);

  const ehEntrada = lanc.tipo === "entrada";
  const hoje = new Date().toISOString().slice(0, 10);
  const situacao: { txt: string; tom: Tom } = lanc.data_pagamento
    ? { txt: "Efetivada", tom: "positivo" }
    : lanc.data_vencimento < hoje
      ? { txt: "Vencido", tom: "negativo" }
      : lanc.data_vencimento === hoje
        ? { txt: "Vence hoje", tom: "critico" }
        : lanc.data_agendamento
          ? { txt: "Agendada", tom: "info" }
          : { txt: "Previsto", tom: "neutro" };

  const SECOES = [
    { id: "dados", label: "Dados" },
    { id: "rateio", label: `Rateio${rateio.length ? ` (${rateio.length})` : ""}` },
    { id: "anexos", label: `Anexos${anexos.length ? ` (${anexos.length})` : ""}` },
    { id: "conciliacao", label: "Conciliação" },
    { id: "trilha", label: "Trilha" },
  ];

  function irPara(id: string) {
    setSecao(id);
    refs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function excluir() {
    if (lanc.exportado_em) {
      toast("Exportado para a contabilidade. Reabra antes de excluir.", { tom: "aviso" });
      return;
    }
    const supabase = createClient();
    // sem backup não há Desfazer, e o Desfazer é o que substitui o confirm()
    const back = await supabase.from("lancamentos").select("*").eq("id", lanc.id).maybeSingle();
    const backup = back.error ? null : back.data;
    const { error } = await supabase.from("lancamentos").delete().eq("id", lanc.id);
    if (error) {
      toast(error.message, { tom: "erro" });
      return;
    }
    router.push("/movimentacoes");
    router.refresh();
    const base = `Lançamento excluído: ${lanc.descricao || "sem descrição"}.`;
    toast(backup ? base : `${base} Não foi possível preparar o Desfazer — para recuperar, lance de novo.`, {
      desfazer: backup
        ? async () => {
            /*
              O Desfazer é a última chance: a linha já saiu do banco e este
              insert é o único caminho de volta. Falhar em silêncio aqui é o
              pior dos dois mundos — a pessoa clicou em Desfazer, o toast
              sumiu, e o lançamento não voltou.
            */
            const volta = await createClient().from("lancamentos").insert(backup as Record<string, unknown>);
            if (volta.error) {
              toast(`Não foi possível restaurar (${volta.error.message}). O lançamento continua excluído.`, { tom: "erro" });
              return;
            }
            router.refresh();
          }
        : undefined,
    });
  }

  /**
   * Anexar = ligar um documento que já está na Caixa de Entrada a este
   * lançamento. Não há upload novo aqui de propósito: o arquivo entra pelo
   * portal (com política de bucket e expurgo próprios) e aqui só se cria o elo.
   */
  async function anexar(doc: Anexo) {
    setLigando(true);
    const { error } = await createClient()
      .from("documentos_recebidos")
      .update({ lancamento_id: lanc.id })
      .eq("id", doc.id);
    setLigando(false);
    if (error) {
      toast(error.message, { tom: "erro" });
      return;
    }
    setAnexos((a) => [doc, ...a]);
    setDisponiveis((d) => d.filter((x) => x.id !== doc.id));
    toast(`Documento anexado: ${doc.arquivo_nome}`, {
      desfazer: async () => {
        const r = await createClient().from("documentos_recebidos").update({ lancamento_id: null }).eq("id", doc.id);
        if (r.error) {
          // sem isto a tela devolvia o documento para a lista de disponíveis
          // enquanto ele seguia vinculado no banco: some da Caixa de entrada e
          // reaparece anexado no próximo carregamento
          toast(`Não foi possível desanexar (${r.error.message}). O documento continua neste lançamento.`, { tom: "erro" });
          return;
        }
        setAnexos((a) => a.filter((x) => x.id !== doc.id));
        setDisponiveis((d) => [doc, ...d]);
      },
    });
  }

  async function desanexar(doc: Anexo) {
    const { error } = await createClient()
      .from("documentos_recebidos")
      .update({ lancamento_id: null })
      .eq("id", doc.id);
    if (error) {
      toast(error.message, { tom: "erro" });
      return;
    }
    setAnexos((a) => a.filter((x) => x.id !== doc.id));
    setDisponiveis((d) => [doc, ...d]);
    toast("Documento desanexado.", {
      desfazer: async () => {
        const r = await createClient().from("documentos_recebidos").update({ lancamento_id: lanc.id }).eq("id", doc.id);
        if (r.error) {
          toast(`Não foi possível reanexar (${r.error.message}). O documento voltou para a Caixa de entrada.`, { tom: "erro" });
          return;
        }
        setAnexos((a) => [doc, ...a]);
        setDisponiveis((d) => d.filter((x) => x.id !== doc.id));
      },
    });
  }

  return (
    <div className="space-y-4">
      {/* cabeçalho do objeto — colapsa ao rolar, como o da lista */}
      <div className="sticky top-[52px] z-20 -mx-5 border-b border-line bg-white px-5 pt-3">
        <MedeCabecalho />
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[11px] text-ink-muted">
              <Link href="/movimentacoes" className="font-semibold text-brand-dark hover:underline">
                Movimentações
              </Link>
              <span>›</span>
              <span>Lançamento</span>
            </div>
            <h1 className="mt-0.5 truncate text-lg font-bold tracking-tight text-ink">
              {lanc.descricao || "(sem descrição)"}
            </h1>
            <p className="truncate text-xs text-ink-muted">
              {[lanc.numero_documento, lanc.pessoa_nome, `/movimentacoes/${lanc.id}`].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(window.location.href);
                toast("Link deste lançamento copiado.");
              }}
              className="flex h-8 items-center gap-1.5 rounded-md border border-line px-2.5 text-xs font-semibold text-ink-muted transition hover:border-brand hover:text-brand-dark"
            >
              <LinkIcon size={13} /> Copiar link
            </button>
            <div className="flex items-center rounded-md border border-line">
              <button
                type="button"
                disabled={!anteriorId}
                onClick={() => anteriorId && router.push(`/movimentacoes/${anteriorId}`)}
                title="Lançamento anterior (Alt+↑)"
                className="flex h-8 w-8 items-center justify-center text-ink-muted transition hover:bg-surface hover:text-ink disabled:opacity-30"
              >
                <ChevronUp size={14} />
              </button>
              <span className="h-4 w-px bg-line" />
              <button
                type="button"
                disabled={!proximoId}
                onClick={() => proximoId && router.push(`/movimentacoes/${proximoId}`)}
                title="Próximo lançamento (Alt+↓)"
                className="flex h-8 w-8 items-center justify-center text-ink-muted transition hover:bg-surface hover:text-ink disabled:opacity-30"
              >
                <ChevronDown size={14} />
              </button>
            </div>
            <button
              type="button"
              onClick={duplicar}
              disabled={duplicando}
              className="flex h-8 items-center gap-1.5 rounded-md border border-line px-2.5 text-xs font-semibold text-ink-muted transition hover:border-brand hover:text-brand-dark disabled:opacity-50"
            >
              <Copy size={13} /> {duplicando ? "Duplicando…" : "Duplicar"}
            </button>
            <button
              type="button"
              onClick={excluir}
              className="flex h-8 items-center gap-1.5 rounded-md border border-line px-2.5 text-xs font-semibold text-danger transition hover:border-danger hover:bg-rose-50"
            >
              <Trash2 size={13} /> Excluir
            </button>
            <Link
              href="/movimentacoes"
              className="flex h-8 items-center gap-1.5 rounded-md border border-line px-2.5 text-xs font-semibold text-ink-muted transition hover:bg-surface"
            >
              <ArrowLeft size={13} /> Voltar à lista
            </Link>
          </div>
        </div>

        {/* header facets */}
        <div
          className={`flex flex-wrap gap-x-7 gap-y-2 overflow-hidden transition-all ${
            compacto ? "max-h-0 opacity-0" : "mt-3 max-h-24 opacity-100"
          }`}
        >
          <Facet k="Valor">
            <span className={`num ${ehEntrada ? "text-brand-dark" : "text-ink"}`}>
              {ehEntrada ? "" : "−"}
              {brl(Number(lanc.valor))}
            </span>
          </Facet>
          <Facet k="Situação">
            <ObjectStatus tom={situacao.tom} className="!text-[13px]">
              {situacao.txt}
            </ObjectStatus>
          </Facet>
          <Facet k="Vencimento"><span className="num">{dataBR(lanc.data_vencimento)}</span></Facet>
          <Facet k="Categoria"><span className="text-[13px]">{lanc.categoria_nome ?? "—"}</span></Facet>
          <Facet k="Conta"><span className="text-[13px]">{lanc.conta_nome ?? "—"}</span></Facet>
          <Facet k="Centro de custo">
            <span className="text-[13px]">
              {rateio.length ? `${rateio.length} centros (rateado)` : lanc.centro_nome ?? "—"}
            </span>
          </Facet>
        </div>

        {compacto && (
          <div className="num flex flex-wrap items-center gap-x-5 gap-y-1 py-1.5 text-[12.5px] text-ink-muted">
            <span className={ehEntrada ? "font-extrabold text-brand-dark" : "font-extrabold text-ink"}>
              {ehEntrada ? "" : "−"}
              {brl(Number(lanc.valor))}
            </span>
            <ObjectStatus tom={situacao.tom} semMarcador>{situacao.txt}</ObjectStatus>
            <span>vence {dataBR(lanc.data_vencimento)}</span>
          </div>
        )}

        {/* navegação por âncora */}
        <div className="flex gap-4 overflow-x-auto">
          {SECOES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => irPara(s.id)}
              className={`whitespace-nowrap border-b-2 pb-2 pt-1 text-[12.5px] font-semibold transition ${
                secao === s.id
                  ? "border-brand text-brand-dark"
                  : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {lanc.exportado_em && (
        <div className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2 text-xs text-ink-muted">
          <Lock size={13} />
          Exportado para a contabilidade em {dataBR(lanc.exportado_em)} — reabra na lista para poder alterar.
        </div>
      )}

      {/* ---------------- seções ---------------- */}
      <div ref={(el) => { refs.current["dados"] = el; }}>
        <LancamentoModal
          empresaId={empresaId}
          aberto
          comoPagina
          tipo={lanc.tipo}
          editLanc={lanc}
          onFechar={() => router.push("/movimentacoes")}
          onSalvo={() => {
            router.refresh();
            toast("Lançamento salvo.");
          }}
        />
      </div>

      <section
        ref={(el) => { refs.current["rateio"] = el; }}
        className="rounded-xl2 bg-white p-5 shadow-card"
      >
        <h3 className="mb-2 flex items-center gap-2 text-sm font-bold">
          <Split size={15} className="text-ink-soft" /> Rateio entre centros de custo
        </h3>
        {rateio.length === 0 ? (
          <p className="text-xs text-ink-muted">
            Sem rateio — vale o centro de custo do lançamento{lanc.centro_nome ? `: ${lanc.centro_nome}` : ""}. Para
            dividir entre centros, use “Ratear entre centros” no formulário acima.
          </p>
        ) : (
          <div className="text-sm">
            {rateio.map((p) => {
              const pct = (p.valor / Number(lanc.valor)) * 100;
              return (
                <div key={p.centro_custo_id} className="flex items-center gap-3 border-b border-line py-2 last:border-0">
                  <span className="flex-1 truncate">{nomeCentro(p.centro_custo_id)}</span>
                  <span className="num w-28 text-right font-semibold">{brl(p.valor)}</span>
                  <span className="num w-14 text-right text-ink-muted">{pct.toFixed(0)}%</span>
                </div>
              );
            })}
            <p className="mt-2 text-[11px] leading-snug text-ink-soft">
              Continua sendo <b>um</b> lançamento — o extrato tem uma linha só. Só o relatório por centro enxerga a
              divisão.
            </p>
          </div>
        )}
      </section>

      <section
        ref={(el) => { refs.current["anexos"] = el; }}
        className="rounded-xl2 bg-white p-5 shadow-card"
      >
        <h3 className="mb-2 flex items-center gap-2 text-sm font-bold">
          <Paperclip size={15} className="text-ink-soft" /> Anexos
        </h3>

        {anexos.length === 0 ? (
          <EmptyState compacto titulo="Nenhum documento ligado a este lançamento" />
        ) : (
          <ul className="mb-3 text-sm">
            {anexos.map((a) => (
              <li key={a.id} className="flex items-center gap-3 border-b border-line py-2 last:border-0">
                <Paperclip size={13} className="shrink-0 text-ink-soft" />
                <span className="flex-1 truncate">{a.arquivo_nome}</span>
                <span className="shrink-0 text-xs text-ink-soft">{dataBR(a.enviado_em?.slice(0, 10))}</span>
                <button
                  type="button"
                  onClick={() => desanexar(a)}
                  className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold text-ink-soft transition hover:bg-surface hover:text-danger"
                >
                  desanexar
                </button>
              </li>
            ))}
          </ul>
        )}

        <SoltarArquivo
          empresaId={empresaId}
          lancamentoId={lanc.id}
          onEnviado={(doc) => {
            setAnexos((a) => [doc, ...a]);
            toast(`${doc.arquivo_nome} anexado.`);
          }}
          ajuda="PDF, imagem, XML, DOC ou OFX, até 20 MB. Fica ligado a este lançamento e não cai na Caixa de Entrada."
        />

        {disponiveis.length > 0 && (
          <div className="mt-3 rounded-lg border border-dashed border-line bg-surface/60 p-3">
            <p className="mb-1.5 text-[11px] font-semibold text-ink-muted">
              Ou ligar um documento que já chegou pela Caixa de Entrada
            </p>
            <div className="flex flex-wrap gap-1.5">
              {disponiveis.slice(0, 6).map((d) => (
                <button
                  key={d.id}
                  type="button"
                  disabled={ligando}
                  onClick={() => anexar(d)}
                  title={`Enviado em ${dataBR(d.enviado_em?.slice(0, 10))}`}
                  className="max-w-full truncate rounded-md border border-line bg-white px-2 py-1 text-[11.5px] font-semibold text-ink-muted transition hover:border-brand hover:text-brand-dark disabled:opacity-50"
                >
                  + {d.arquivo_nome}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10.5px] leading-snug text-ink-soft">
              São os que chegaram pelo{" "}
              <Link href="/documentos" className="font-semibold text-brand-dark hover:underline">
                portal do cliente
              </Link>{" "}
              e ainda não foram classificados.
            </p>
          </div>
        )}
      </section>

      <section
        ref={(el) => { refs.current["conciliacao"] = el; }}
        className="rounded-xl2 bg-white p-5 shadow-card"
      >
        <h3 className="mb-2 text-sm font-bold">Conciliação</h3>
        {lanc.conciliado ? (
          <p className="flex items-center gap-2 text-xs font-semibold text-brand-dark">
            <span className="h-[7px] w-[7px] rounded-full bg-current" /> Conciliado com o extrato.
          </p>
        ) : (
          <p className="text-xs text-ink-muted">
            Ainda não conciliado.{" "}
            <Link href="/conciliacao" className="font-semibold text-brand-dark hover:underline">
              Abrir a fila de conciliação
            </Link>{" "}
            — a sugestão automática aparece quando o extrato da conta for importado.
          </p>
        )}
      </section>

      <section
        ref={(el) => { refs.current["trilha"] = el; }}
        className="rounded-xl2 bg-white p-5 shadow-card"
      >
        <h3 className="mb-2 text-sm font-bold">Trilha</h3>
        <ul className="space-y-1.5 text-xs text-ink-muted">
          <li>Competência {dataBR(lanc.data_competencia)} · vencimento {dataBR(lanc.data_vencimento)}</li>
          {lanc.data_agendamento && <li>Agendado para {dataBR(lanc.data_agendamento)}</li>}
          {lanc.data_pagamento && <li>Efetivado em {dataBR(lanc.data_pagamento)}</li>}
          {lanc.recorrencia_id && <li>Faz parte de uma série recorrente</li>}
          {lanc.exportado_em && <li>Exportado para a contabilidade em {dataBR(lanc.exportado_em)}</li>}
          <li className="pt-1 text-[11px] text-ink-soft">
            Histórico campo a campo ainda não é registrado — a trilha mostra o que o lançamento guarda hoje.
          </li>
        </ul>
      </section>
    </div>
  );
}

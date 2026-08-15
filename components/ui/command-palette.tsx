"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  CornerDownLeft,
  Plus,
  ArrowLeftRight,
  PieChart,
  Landmark,
  Inbox,
  Users,
  FileText,
  Settings,
  UploadCloud,
  CalendarClock,
  BadgeDollarSign,
  HelpCircle,
  LayoutGrid,
  Repeat2,
  FileDown,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { brl } from "@/lib/mock";

/**
 * Command palette (⌘K / Ctrl+K).
 *
 * Um caminho único para quem já sabe o que quer: buscar um lançamento pela
 * descrição, um cliente pelo nome, ou disparar uma ação sem caçar no menu.
 * Aproveita os atalhos que já existiam na tela de movimentações (N, /).
 */

type Comando = {
  id: string;
  grupo: "Ações" | "Ir para" | "Ajuda";
  titulo: string;
  sub?: string;
  icone: React.ComponentType<{ size?: number | string; className?: string }>;
  atalho?: string;
  rodar: () => void;
};

type Achado = {
  id: string;
  tipo: "lancamento" | "pessoa";
  titulo: string;
  sub: string;
  href: string;
};

export default function CommandPalette({ empresaId }: { empresaId: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const [achados, setAchados] = useState<Achado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listaRef = useRef<HTMLDivElement | null>(null);

  const fechar = useCallback(() => {
    setAberto(false);
    setQ("");
    setAchados([]);
    setIdx(0);
  }, []);

  const ir = useCallback(
    (href: string) => {
      fechar();
      router.push(href);
    },
    [router, fechar],
  );

  const comandos = useMemo<Comando[]>(
    () => [
      {
        id: "novo",
        grupo: "Ações",
        titulo: "Novo lançamento",
        sub: "entrada, saída ou transferência",
        icone: Plus,
        atalho: "N",
        rodar: () => {
          fechar();
          router.push("/movimentacoes");
          // a tela de movimentações escuta e abre o modal já montada
          setTimeout(() => window.dispatchEvent(new CustomEvent("fs-novo-lancamento")), 350);
        },
      },
      {
        id: "repetir",
        grupo: "Ações",
        titulo: "Recorrências",
        sub: "repetir lançamentos todo mês",
        icone: Repeat2,
        rodar: () => ir("/configuracoes/recorrencias"),
      },
      {
        id: "importar",
        grupo: "Ações",
        titulo: "Importar extrato ou planilha",
        sub: "OFX, CNAB retorno, CSV",
        icone: UploadCloud,
        rodar: () => ir("/importar?tipo=lancamentos"),
      },
      {
        id: "exportar",
        grupo: "Ações",
        titulo: "Exportação contábil",
        sub: "gerar arquivo para a contabilidade",
        icone: FileDown,
        rodar: () => ir("/configuracoes/exportar-contabil"),
      },
      { id: "em-aberto", grupo: "Ir para", titulo: "Movimentações · em aberto", sub: "previsto e agendado", icone: ArrowLeftRight, rodar: () => ir("/movimentacoes?sit=previsto,agendada") },
      { id: "conciliar-lista", grupo: "Ir para", titulo: "Movimentações · a conciliar", sub: "conciliação: não", icone: ArrowLeftRight, rodar: () => ir("/movimentacoes?conc=nao") },
      { id: "inicio", grupo: "Ir para", titulo: "Início", sub: "tiles do que precisa de atenção", icone: LayoutGrid, rodar: () => ir("/inicio") },
      { id: "painel", grupo: "Ir para", titulo: "Painel", icone: PieChart, rodar: () => ir("/painel") },
      { id: "mov", grupo: "Ir para", titulo: "Movimentações", icone: ArrowLeftRight, rodar: () => ir("/movimentacoes") },
      { id: "liq", grupo: "Ir para", titulo: "Liquidações", icone: CalendarClock, rodar: () => ir("/agendamento") },
      { id: "conc", grupo: "Ir para", titulo: "Conciliação bancária", icone: Landmark, rodar: () => ir("/conciliacao") },
      { id: "docs", grupo: "Ir para", titulo: "Caixa de Entrada", icone: Inbox, rodar: () => ir("/documentos") },
      { id: "pessoas", grupo: "Ir para", titulo: "Clientes e fornecedores", icone: Users, rodar: () => ir("/clientes-fornecedores") },
      { id: "vendas", grupo: "Ir para", titulo: "Serviços", icone: BadgeDollarSign, rodar: () => ir("/vendas") },
      { id: "rel", grupo: "Ir para", titulo: "Relatórios", icone: FileText, rodar: () => ir("/relatorios") },
      { id: "carteira", grupo: "Ir para", titulo: "Carteira de empresas", icone: LayoutGrid, rodar: () => ir("/carteira") },
      { id: "cfg", grupo: "Ir para", titulo: "Configurações", icone: Settings, rodar: () => ir("/configuracoes") },
      { id: "ajuda", grupo: "Ajuda", titulo: "Central de ajuda", icone: HelpCircle, rodar: () => ir("/ajuda") },
    ],
    [ir, router, fechar],
  );

  const comandosFiltrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return comandos;
    return comandos.filter((c) => `${c.titulo} ${c.sub ?? ""} ${c.grupo}`.toLowerCase().includes(t));
  }, [q, comandos]);

  const itens = useMemo(
    () => [
      ...achados.map((a) => ({ tipo: "achado" as const, achado: a })),
      ...comandosFiltrados.map((c) => ({ tipo: "comando" as const, comando: c })),
    ],
    [achados, comandosFiltrados],
  );

  // abrir/fechar com ⌘K (e "/" fora de campos de texto)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const digitando =
        el?.tagName === "INPUT" || el?.tagName === "TEXTAREA" || el?.tagName === "SELECT" || el?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAberto((v) => !v);
        return;
      }
      if (e.key === "/" && !digitando && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // "/" continua focando a busca da tela quando ela existe; aqui só abre
        // o palette se a tela não tiver campo de busca próprio.
        //
        // A checagem era pelo texto do placeholder ("Descrição"), o que só
        // reconhecia uma tela. A Conciliação tem busca própria com outro
        // placeholder: os dois handlers rodavam, o campo da tela ganhava o foco
        // e o palette o roubava 20ms depois. `data-busca-local` é o contrato —
        // o placeholder fica como fallback das telas que ainda não o marcam.
        const temBuscaLocal = document.querySelector<HTMLInputElement>(
          'input[data-busca-local], input[placeholder="Descrição"]',
        );
        if (temBuscaLocal) return;
        e.preventDefault();
        setAberto(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (aberto) setTimeout(() => inputRef.current?.focus(), 20);
  }, [aberto]);

  // a busca da shell bar abre o palette (não duplica campo de busca)
  useEffect(() => {
    const h = () => setAberto(true);
    window.addEventListener("fs-abrir-busca", h);
    return () => window.removeEventListener("fs-abrir-busca", h);
  }, []);

  // busca real no banco (descrição de lançamento e nome de pessoa)
  useEffect(() => {
    const termo = q.trim();
    if (!aberto || termo.length < 2 || !empresaId) {
      setAchados([]);
      return;
    }
    let vivo = true;
    setBuscando(true);
    const t = window.setTimeout(async () => {
      const supabase = createClient();
      const [lanc, pes] = await Promise.all([
        supabase
          .from("lancamentos")
          .select("id, descricao, valor, tipo, data_vencimento")
          .eq("empresa_id", empresaId)
          .ilike("descricao", `%${termo}%`)
          .order("data_vencimento", { ascending: false })
          .limit(6),
        supabase
          .from("clientes_fornecedores")
          .select("id, nome")
          .eq("empresa_id", empresaId)
          .ilike("nome", `%${termo}%`)
          .order("nome")
          .limit(4),
      ]);
      if (!vivo) return;
      const l = ((lanc.data as { id: string; descricao: string | null; valor: number; tipo: string; data_vencimento: string }[]) ?? []).map(
        (r) => ({
          id: r.id,
          tipo: "lancamento" as const,
          titulo: r.descricao || "(sem descrição)",
          sub: `${r.tipo === "entrada" ? "Entrada" : "Saída"} · ${brl(Number(r.valor))} · vence ${r.data_vencimento.split("-").reverse().join("/")}`,
          href: `/movimentacoes?lanc=${r.id}`,
        }),
      );
      const p = ((pes.data as { id: string; nome: string }[]) ?? []).map((r) => ({
        id: r.id,
        tipo: "pessoa" as const,
        titulo: r.nome,
        sub: "cliente / fornecedor",
        href: `/clientes-fornecedores?busca=${encodeURIComponent(r.nome)}`,
      }));
      setAchados([...l, ...p]);
      setBuscando(false);
      setIdx(0);
    }, 220);
    return () => {
      vivo = false;
      window.clearTimeout(t);
    };
  }, [q, aberto, empresaId]);

  useEffect(() => {
    setIdx(0);
  }, [q]);

  function executar(i: number) {
    const it = itens[i];
    if (!it) return;
    if (it.tipo === "achado") ir(it.achado.href);
    else it.comando.rodar();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIdx((i) => Math.min(i + 1, itens.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      executar(idx);
    } else if (e.key === "Escape") {
      e.preventDefault();
      fechar();
    }
  }

  // mantém o item selecionado visível
  useEffect(() => {
    const el = listaRef.current?.querySelector<HTMLElement>(`[data-i="${idx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [idx]);

  if (!aberto) return null;

  let grupoAtual = "";

  return (
    <div
      className="fixed inset-0 z-[65] flex items-start justify-center bg-rail/40 p-4 pt-[12vh] backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) fechar();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        // Esta caixa não tem cabeçalho: o topo dela é o próprio campo de busca.
        // Sem rótulo, o leitor de tela anuncia "diálogo" e para por aí.
        aria-label="Busca e comandos"
        className="w-full max-w-xl overflow-hidden rounded-xl2 bg-white shadow-xl"
      >
        <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
          {buscando ? (
            <Loader2 size={17} className="animate-spin text-ink-soft" />
          ) : (
            <Search size={17} className="text-ink-soft" />
          )}
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Buscar lançamento, cliente… ou digitar um comando"
            className="w-full text-[15px] font-medium outline-none placeholder:font-normal placeholder:text-ink-soft"
          />
          <kbd className="hidden rounded border border-line px-1.5 py-0.5 text-[10px] font-semibold text-ink-soft sm:block">
            Esc
          </kbd>
        </div>

        <div ref={listaRef} className="max-h-[340px] overflow-y-auto p-1.5">
          {itens.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-ink-soft">
              {q.trim().length >= 2 ? "Nada encontrado." : "Digite para buscar."}
            </p>
          )}

          {itens.map((it, i) => {
            const ativo = i === idx;
            if (it.tipo === "achado") {
              const cabecalho = i === 0 ? "Resultados" : null;
              return (
                <div key={`a-${it.achado.id}`}>
                  {cabecalho && <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-ink-soft">{cabecalho}</p>}
                  <button
                    type="button"
                    data-i={i}
                    onMouseEnter={() => setIdx(i)}
                    onClick={() => executar(i)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left ${ativo ? "bg-brand-light" : ""}`}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface text-ink-muted">
                      {it.achado.tipo === "lancamento" ? <ArrowLeftRight size={14} /> : <Users size={14} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{it.achado.titulo}</span>
                      <span className="block truncate text-[11px] text-ink-muted">{it.achado.sub}</span>
                    </span>
                    {ativo && <CornerDownLeft size={13} className="shrink-0 text-ink-soft" />}
                  </button>
                </div>
              );
            }
            const c = it.comando;
            const mostraGrupo = c.grupo !== grupoAtual;
            grupoAtual = c.grupo;
            const Icone = c.icone;
            return (
              <div key={c.id}>
                {mostraGrupo && (
                  <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-ink-soft">{c.grupo}</p>
                )}
                <button
                  type="button"
                  data-i={i}
                  onMouseEnter={() => setIdx(i)}
                  onClick={() => executar(i)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left ${ativo ? "bg-brand-light" : ""}`}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface text-ink-muted">
                    <Icone size={14} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{c.titulo}</span>
                    {c.sub && <span className="block truncate text-[11px] text-ink-muted">{c.sub}</span>}
                  </span>
                  {c.atalho && (
                    <kbd className="rounded border border-line px-1.5 text-[10px] font-semibold text-ink-soft">{c.atalho}</kbd>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-4 border-t border-line px-4 py-2 text-[11px] text-ink-soft">
          <span>
            <kbd className="rounded border border-line px-1 font-semibold">↑</kbd>
            <kbd className="ml-0.5 rounded border border-line px-1 font-semibold">↓</kbd> navegar
          </span>
          <span>
            <kbd className="rounded border border-line px-1 font-semibold">Enter</kbd> abrir
          </span>
          <span className="ml-auto">
            <kbd className="rounded border border-line px-1 font-semibold">⌘K</kbd> abre de qualquer tela
          </span>
        </div>
      </div>
    </div>
  );
}

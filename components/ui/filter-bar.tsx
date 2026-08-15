"use client";

import { cloneElement, isValidElement, useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { ChevronDown, ChevronUp, RotateCcw, SlidersHorizontal } from "lucide-react";

/**
 * Filter bar — a barra de filtros do padrão List Report.
 *
 * O que existia era metade: os campos e os chips de visões salvas. Faltavam as
 * três peças que fazem a barra funcionar no dia a dia de quem usa o sistema
 * todo dia:
 *
 *  - **Adaptar filtros**: cada pessoa filtra por coisas diferentes. Quem cobra
 *    quer Cliente e Vencimento; quem concilia quer Conta e Documento. Sem isso
 *    a barra cresce até virar um formulário de vinte campos que ninguém lê.
 *  - **Ocultar filtros**: depois de montar o recorte, a barra só ocupa altura.
 *    Recolhida, sobra tela para a lista — e o recorte continua na URL.
 *  - **Contagem de filtros ativos**: recolhida, a barra precisa dizer quantos
 *    filtros estão valendo, senão vira uma armadilha ("por que só aparecem 3
 *    lançamentos?").
 *
 * A preferência de quais campos aparecem fica no navegador, por tela — é
 * preferência pessoal, muda toda hora e não vale uma ida ao banco.
 */

export type CampoFiltro = {
  id: string;
  label: string;
  /** o controle em si (input, select, MultiSelect…) */
  node: React.ReactNode;
  /** campos essenciais não podem ser removidos da barra */
  fixo?: boolean;
  /** true quando este filtro está restringindo o resultado */
  ativo?: boolean;
  /** largura mínima do campo; padrão 150px */
  min?: string;
};

const VERSAO = "v1";
const chave = (tela: string) => `fx_filtros_${VERSAO}_${tela}`;

export function useCamposFiltro(tela: string, campos: CampoFiltro[]) {
  const idsPadrao = useMemo(() => campos.map((c) => c.id), [campos]);
  const [ocultos, setOcultos] = useState<string[]>([]);
  const [recolhida, setRecolhida] = useState(false);

  useEffect(() => {
    try {
      const bruto = window.localStorage.getItem(chave(tela));
      if (bruto) {
        const lido = JSON.parse(bruto) as { ocultos?: string[]; recolhida?: boolean };
        setOcultos((lido.ocultos ?? []).filter((id) => idsPadrao.includes(id)));
        setRecolhida(Boolean(lido.recolhida));
      }
    } catch {
      // preferência corrompida: segue no padrão
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tela]);

  const gravar = useCallback(
    (o: string[], r: boolean) => {
      setOcultos(o);
      setRecolhida(r);
      try {
        window.localStorage.setItem(chave(tela), JSON.stringify({ ocultos: o, recolhida: r }));
      } catch {
        // sem localStorage: vale só nesta sessão
      }
    },
    [tela],
  );

  const visiveis = useMemo(
    () => campos.filter((c) => c.fixo || !ocultos.includes(c.id)),
    [campos, ocultos],
  );

  return { ocultos, recolhida, gravar, visiveis };
}

export default function FilterBar({
  tela,
  campos,
  /** chips de visões salvas (BarraVisoes) */
  variantes,
  /**
   * Segmentos de recorte que a tela quer à esquerda das visões — as abas de
   * tipo de Movimentações, por exemplo.
   *
   * Elas cabem aqui porque **são filtro**: manter uma faixa própria só para
   * elas custava uma linha inteira acima da barra, e a lista começava 44px mais
   * abaixo sem ganhar nada. Empilhar não é remover: continuam a um clique.
   */
  segmentos,
  /** botões da direita: Executar, ações da tela */
  acoes,
  /** quantos filtros estão restringindo o resultado agora */
  ativos,
  onLimpar,
}: {
  tela: string;
  campos: CampoFiltro[];
  variantes?: React.ReactNode;
  segmentos?: React.ReactNode;
  acoes?: React.ReactNode;
  ativos?: number;
  onLimpar?: () => void;
}) {
  const { ocultos, recolhida, gravar, visiveis } = useCamposFiltro(tela, campos);
  const [adaptar, setAdaptar] = useState(false);
  const caixaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!adaptar) return;
    function fora(e: MouseEvent) {
      if (caixaRef.current && !caixaRef.current.contains(e.target as Node)) setAdaptar(false);
    }
    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") setAdaptar(false);
    }
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [adaptar]);

  const qtdAtivos = ativos ?? campos.filter((c) => c.ativo).length;

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {segmentos}
        {segmentos && variantes && <span className="h-5 w-px bg-line" />}
        {variantes}
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {recolhida && qtdAtivos > 0 && (
            <span className="rounded-full bg-brand-light px-2.5 py-1 text-[11px] font-bold text-brand-dark">
              {qtdAtivos} filtro{qtdAtivos > 1 ? "s" : ""} ativo{qtdAtivos > 1 ? "s" : ""}
            </span>
          )}

          <div className="relative" ref={caixaRef}>
            <button
              type="button"
              onClick={() => setAdaptar((v) => !v)}
              title="Escolher quais filtros aparecem nesta barra"
              className="flex h-8 items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 text-xs font-semibold text-ink-muted transition hover:border-brand hover:text-brand-dark"
            >
              <SlidersHorizontal size={13} /> Adaptar filtros
              {ocultos.length > 0 && (
                <span className="rounded-full bg-surface px-1.5 text-[10px] font-bold text-ink-soft">
                  −{ocultos.length}
                </span>
              )}
            </button>

            {adaptar && (
              <div className="absolute right-0 top-9 z-30 w-60 rounded-xl2 bg-white p-2 shadow-card">
                <p className="px-1.5 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-soft">
                  Filtros desta tela
                </p>
                <div className="max-h-72 overflow-y-auto">
                  {campos.map((c) => {
                    const visivel = c.fixo || !ocultos.includes(c.id);
                    return (
                      <label
                        key={c.id}
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-surface"
                      >
                        <input
                          type="checkbox"
                          checked={visivel}
                          disabled={c.fixo}
                          onChange={() =>
                            gravar(
                              ocultos.includes(c.id)
                                ? ocultos.filter((x) => x !== c.id)
                                : [...ocultos, c.id],
                              recolhida,
                            )
                          }
                          className="h-3.5 w-3.5 accent-brand disabled:opacity-40"
                        />
                        <span className={`flex-1 truncate text-[13px] ${visivel ? "text-ink" : "text-ink-soft"}`}>
                          {c.label}
                          {c.fixo && <span className="ml-1 text-[10px] text-ink-soft">fixo</span>}
                        </span>
                        {c.ativo && <span className="h-1.5 w-1.5 rounded-full bg-brand" title="filtro ativo" />}
                      </label>
                    );
                  })}
                </div>
                <div className="mt-1.5 flex items-center justify-between border-t border-line pt-1.5">
                  <span className="px-1.5 text-[10.5px] text-ink-soft">Fica salvo neste navegador</span>
                  <button
                    type="button"
                    onClick={() => gravar([], recolhida)}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-ink-muted transition hover:bg-surface"
                  >
                    <RotateCcw size={12} /> Todos
                  </button>
                </div>
              </div>
            )}
          </div>

          {onLimpar && qtdAtivos > 0 && (
            <button
              type="button"
              onClick={onLimpar}
              className="flex h-8 items-center rounded-lg px-2.5 text-xs font-semibold text-ink-soft transition hover:bg-surface hover:text-ink"
            >
              Limpar filtros
            </button>
          )}

          <button
            type="button"
            onClick={() => gravar(ocultos, !recolhida)}
            className="flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-ink-soft transition hover:bg-surface hover:text-ink"
          >
            {recolhida ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            {recolhida ? "Mostrar filtros" : "Ocultar filtros"}
          </button>

          {acoes}
        </div>
      </div>

      {!recolhida && (
        <div className="flex flex-wrap items-end gap-3">
          {visiveis.map((c) => (
            <div key={c.id} style={{ minWidth: c.min ?? "150px" }}>
              {/*
                O rótulo só vira `htmlFor` quando há um campo de verdade para
                apontar.

                A primeira versão injetava o `id` em qualquer nó e punha o
                `htmlFor` sempre. Só que a maioria dos filtros deste app não é um
                `<input>` na raiz: são `<div>` com ícone de busca, `<MultiSelect>`
                (que nem aceita a prop) e até um `<label>` de checkbox. O `id`
                caía num elemento não rotulável, o `htmlFor` apontava para o
                nada, e num caso o resultado era `<label>` dentro de `<label>` —
                pior do que estava antes, com a aparência de resolvido.

                Rotulável é o que o HTML diz que é rotulável. Para o resto, o
                texto continua sendo um rótulo visual, sem promessa de
                associação, até que o consumidor exponha um alvo.
              */}
              {(() => {
                const alvo = `filtro-${tela}-${c.id}`;
                const el = isValidElement(c.node) ? (c.node as ReactElement<{ id?: string }>) : null;
                const rotulavel =
                  !!el && typeof el.type === "string" && ["input", "select", "textarea"].includes(el.type);
                const jaTemId = !!el && !!(el.props as { id?: string }).id;
                const ligar = rotulavel && !jaTemId;
                return (
                  <>
                    <label
                      htmlFor={ligar ? alvo : undefined}
                      className="mb-1 block text-[11px] font-semibold text-ink-soft"
                    >
                      {c.label}
                    </label>
                    {ligar && el ? cloneElement(el, { id: alvo }) : c.node}
                  </>
                );
              })()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Columns3, RotateCcw } from "lucide-react";

/**
 * Colunas por usuário: escolher quais aparecem e em que ordem.
 *
 * É metade do que faz uma tabela de ERP parecer superior — cada pessoa monta a
 * tabela do próprio trabalho (quem cobra quer Cliente e Vencimento; quem
 * concilia quer Conta e Documento) sem que ninguém precise programar nada.
 *
 * Guardado no navegador (localStorage), por tela: é preferência pessoal, muda
 * toda hora e não vale uma ida ao banco a cada ajuste.
 */

export type ColunaDef = {
  id: string;
  label: string;
  /** largura no grid: "92px", "1fr", "1.2fr"… */
  largura: string;
  /** colunas essenciais não podem ser escondidas nem reordenadas para fora */
  fixa?: boolean;
  /** alinhamento da coluna — número alinha à direita, e o cabeçalho junto */
  alinha?: "esq" | "dir";
};

export type ConfigColunas = { ordem: string[]; ocultas: string[] };

const VERSAO = "v1";
const chave = (tela: string) => `fx_colunas_${VERSAO}_${tela}`;

/**
 * Estado das colunas de uma tela.
 * Devolve as colunas visíveis já na ordem escolhida e o `gridTemplateColumns`
 * correspondente (inline style — classe dinâmica do Tailwind não existe em build).
 */
export function useConfigColunas(tela: string, defs: ColunaDef[], ocultasPadrao: string[] = []) {
  const padrao = useMemo<ConfigColunas>(
    () => ({ ordem: defs.map((d) => d.id), ocultas: ocultasPadrao.filter((id) => !defs.find((d) => d.id === id)?.fixa) }),
    [defs, ocultasPadrao],
  );
  const [config, setConfig] = useState<ConfigColunas>(padrao);
  const [pronto, setPronto] = useState(false);

  // lê a preferência depois da montagem (evita divergência entre servidor e cliente)
  useEffect(() => {
    try {
      const bruto = window.localStorage.getItem(chave(tela));
      if (bruto) {
        const lido = JSON.parse(bruto) as ConfigColunas;
        const validos = new Set(defs.map((d) => d.id));
        const ordem = (lido.ordem ?? []).filter((id) => validos.has(id));
        // colunas novas (criadas depois que o usuário salvou) entram no fim
        for (const d of defs) if (!ordem.includes(d.id)) ordem.push(d.id);
        const ocultas = (lido.ocultas ?? []).filter(
          (id) => validos.has(id) && !defs.find((d) => d.id === id)?.fixa,
        );
        setConfig({ ordem, ocultas });
      }
    } catch {
      // preferência corrompida: segue no padrão
    }
    setPronto(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tela]);

  const gravar = useCallback(
    (c: ConfigColunas) => {
      setConfig(c);
      try {
        window.localStorage.setItem(chave(tela), JSON.stringify(c));
      } catch {
        // sem localStorage (aba anônima com restrição): vale só nesta sessão
      }
    },
    [tela],
  );

  const resetar = useCallback(() => {
    try {
      window.localStorage.removeItem(chave(tela));
    } catch {
      /* ignora */
    }
    setConfig(padrao);
  }, [padrao, tela]);

  const ordenadas = useMemo(
    () =>
      config.ordem
        .map((id) => defs.find((d) => d.id === id))
        .filter((d): d is ColunaDef => Boolean(d)),
    [config.ordem, defs],
  );
  const visiveis = useMemo(
    () => ordenadas.filter((d) => !config.ocultas.includes(d.id)),
    [ordenadas, config.ocultas],
  );
  const gridTemplate = useMemo(() => visiveis.map((c) => c.largura).join(" "), [visiveis]);

  return { config, gravar, resetar, ordenadas, visiveis, gridTemplate, pronto, padrao };
}

export default function ConfigColunasBotao({
  ordenadas,
  config,
  onChange,
  onResetar,
  extras,
}: {
  ordenadas: ColunaDef[];
  config: ConfigColunas;
  onChange: (c: ConfigColunas) => void;
  onResetar: () => void;
  /**
   * Outras preferências de exibição da mesma tabela — a segunda linha da
   * descrição, por exemplo. Ficam aqui porque é onde a pessoa já vem quando
   * quer mudar o que a lista mostra; um segundo botão ao lado seria um segundo
   * lugar para procurar a mesma coisa.
   */
  extras?: React.ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const caixaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!aberto) return;
    function fora(e: MouseEvent) {
      if (caixaRef.current && !caixaRef.current.contains(e.target as Node)) setAberto(false);
    }
    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") setAberto(false);
    }
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  function alternar(id: string) {
    const ocultas = config.ocultas.includes(id)
      ? config.ocultas.filter((x) => x !== id)
      : [...config.ocultas, id];
    onChange({ ...config, ocultas });
  }

  function mover(id: string, dir: -1 | 1) {
    const ordem = [...config.ordem];
    const i = ordem.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ordem.length) return;
    [ordem[i], ordem[j]] = [ordem[j], ordem[i]];
    onChange({ ...config, ordem });
  }

  const ocultasQtd = config.ocultas.length;

  return (
    <div className="relative" ref={caixaRef}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        title="Escolher e reordenar colunas"
        className="flex h-8 items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 text-xs font-semibold text-ink-muted transition hover:border-brand hover:text-brand-dark"
      >
        <Columns3 size={14} /> Colunas
        {ocultasQtd > 0 && (
          <span className="rounded-full bg-surface px-1.5 text-[10px] font-bold text-ink-soft">
            −{ocultasQtd}
          </span>
        )}
      </button>

      {aberto && (
        <div className="absolute right-0 top-9 z-30 w-64 rounded-xl2 bg-white p-2 shadow-card">
          <p className="px-1.5 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-soft">
            Colunas da tabela
          </p>
          <div className="max-h-72 overflow-y-auto">
            {ordenadas.map((c, i) => {
              const visivel = !config.ocultas.includes(c.id);
              return (
                <div key={c.id} className="group flex items-center gap-1.5 rounded-lg px-1.5 py-1 hover:bg-surface">
                  <input
                    type="checkbox"
                    checked={visivel}
                    disabled={c.fixa}
                    onChange={() => alternar(c.id)}
                    title={c.fixa ? "Coluna essencial — sempre visível" : "Mostrar/ocultar"}
                    className="h-3.5 w-3.5 accent-brand disabled:opacity-40"
                  />
                  <span className={`flex-1 truncate text-[13px] ${visivel ? "text-ink" : "text-ink-soft"}`}>
                    {c.label}
                    {c.fixa && <span className="ml-1 text-[10px] text-ink-soft">fixa</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => mover(c.id, -1)}
                    disabled={i === 0}
                    title="Subir"
                    className="rounded p-0.5 text-ink-soft transition hover:bg-white hover:text-ink disabled:opacity-25"
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => mover(c.id, 1)}
                    disabled={i === ordenadas.length - 1}
                    title="Descer"
                    className="rounded p-0.5 text-ink-soft transition hover:bg-white hover:text-ink disabled:opacity-25"
                  >
                    <ArrowDown size={13} />
                  </button>
                </div>
              );
            })}
          </div>
          {extras && (
            <div className="mt-1.5 border-t border-line pt-1.5">
              <p className="px-1.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-ink-soft">
                Exibição
              </p>
              {extras}
            </div>
          )}
          <div className="mt-1.5 flex items-center justify-between border-t border-line pt-1.5">
            <span className="px-1.5 text-[10.5px] text-ink-soft">Fica salvo neste navegador</span>
            <button
              type="button"
              onClick={onResetar}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-ink-muted transition hover:bg-surface"
            >
              <RotateCcw size={12} /> Padrão
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

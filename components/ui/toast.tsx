"use client";

/**
 * Toasts com "Desfazer" — substitui o confirm() nas ações de massa.
 *
 * Uso:
 *   const { toast } = useToast();
 *   toast("12 lançamentos efetivados.", { desfazer: async () => { ...reverte... } });
 *
 * O ⌘Z / Ctrl+Z global desfaz o último toast que ainda estiver na tela.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CheckCircle2, AlertTriangle, Undo2, X } from "lucide-react";

export type ToastTom = "ok" | "erro" | "aviso";

type Opcoes = {
  tom?: ToastTom;
  /** Quando informado, mostra o botão Desfazer (e habilita ⌘Z). */
  desfazer?: () => void | Promise<void>;
  /** Milissegundos até sumir. Padrão: 6000 com desfazer, 4000 sem. */
  duracao?: number;
};

type Item = {
  id: number;
  msg: string;
  tom: ToastTom;
  desfazer?: () => void | Promise<void>;
  duracao: number;
  nasce: number;
};

type Ctx = {
  toast: (msg: string, op?: Opcoes) => void;
  /** Desfaz o toast mais recente que tenha ação de desfazer. */
  desfazerUltimo: () => void;
};

const ToastCtx = createContext<Ctx | null>(null);

export function useToast(): Ctx {
  const ctx = useContext(ToastCtx);
  // Fallback silencioso: componentes fora do provider (ex.: telas públicas)
  // continuam funcionando sem quebrar.
  return (
    ctx ?? {
      toast: (msg: string) => {
        if (typeof window !== "undefined") console.info("[toast]", msg);
      },
      desfazerUltimo: () => {},
    }
  );
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [itens, setItens] = useState<Item[]>([]);
  const seq = useRef(0);

  const fechar = useCallback((id: number) => {
    setItens((s) => s.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((msg: string, op?: Opcoes) => {
    const id = ++seq.current;
    const duracao = op?.duracao ?? (op?.desfazer ? 6000 : 4000);
    setItens((s) => [
      ...s.slice(-3), // no máximo 4 na tela
      { id, msg, tom: op?.tom ?? "ok", desfazer: op?.desfazer, duracao, nasce: Date.now() },
    ]);
    window.setTimeout(() => fechar(id), duracao);
  }, [fechar]);

  const rodarDesfazer = useCallback(
    async (t: Item) => {
      fechar(t.id);
      try {
        await t.desfazer?.();
      } catch (e) {
        const m = e instanceof Error ? e.message : "Não foi possível desfazer.";
        toast(m, { tom: "erro" });
      }
    },
    [fechar, toast],
  );

  const desfazerUltimo = useCallback(() => {
    setItens((s) => {
      const alvo = [...s].reverse().find((t) => t.desfazer);
      if (alvo) void rodarDesfazer(alvo);
      return s;
    });
  }, [rodarDesfazer]);

  // ⌘Z / Ctrl+Z global (fora de campos de texto)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z" || e.shiftKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
      e.preventDefault();
      desfazerUltimo();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [desfazerUltimo]);

  const valor = useMemo(() => ({ toast, desfazerUltimo }), [toast, desfazerUltimo]);

  return (
    <ToastCtx.Provider value={valor}>
      {children}
      <div className="pointer-events-none fixed bottom-5 left-5 z-[70] flex flex-col gap-2">
        {itens.map((t) => (
          <ToastCard key={t.id} item={t} onFechar={() => fechar(t.id)} onDesfazer={() => rodarDesfazer(t)} />
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

function ToastCard({
  item,
  onFechar,
  onDesfazer,
}: {
  item: Item;
  onFechar: () => void;
  onDesfazer: () => void;
}) {
  const [larg, setLarg] = useState(100);

  useEffect(() => {
    const t = window.setInterval(() => {
      const passou = Date.now() - item.nasce;
      setLarg(Math.max(0, 100 - (passou / item.duracao) * 100));
    }, 80);
    return () => window.clearInterval(t);
  }, [item.nasce, item.duracao]);

  const Icone = item.tom === "erro" ? AlertTriangle : item.tom === "aviso" ? AlertTriangle : CheckCircle2;
  const corIcone =
    item.tom === "erro" ? "text-rose-300" : item.tom === "aviso" ? "text-amber-300" : "text-brand";

  return (
    <div className="pointer-events-auto relative flex min-w-[300px] max-w-[440px] items-center gap-3 overflow-hidden rounded-xl2 bg-rail px-4 py-3 text-sm font-semibold text-white shadow-card">
      <Icone size={16} className={`shrink-0 ${corIcone}`} />
      <span className="flex-1 leading-snug">{item.msg}</span>
      {item.desfazer && (
        <button
          type="button"
          onClick={onDesfazer}
          className="flex shrink-0 items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-xs font-bold text-brand transition hover:bg-white/20"
        >
          <Undo2 size={13} /> Desfazer
          <kbd className="ml-0.5 hidden rounded border border-white/20 px-1 text-[9px] text-white/70 sm:inline">⌘Z</kbd>
        </button>
      )}
      <button
        type="button"
        onClick={onFechar}
        title="Fechar"
        className="shrink-0 text-white/50 transition hover:text-white"
      >
        <X size={14} />
      </button>
      <span className="absolute bottom-0 left-0 h-0.5 bg-brand transition-[width] duration-100" style={{ width: `${larg}%` }} />
    </div>
  );
}

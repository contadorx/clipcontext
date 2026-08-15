"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle, X } from "lucide-react";

/**
 * Message strip — a faixa de aviso do Fiori.
 *
 * O app tinha seis jeitos diferentes de dizer a mesma coisa: texto solto
 * colorido, pílula rosa sem borda, faixa com borda e ícone, faixa com borda sem
 * ícone, bloco cinza com ring, e o toast. Cada tela escolhia um. Aqui é um só,
 * e a cor volta a significar alguma coisa.
 *
 * Quando usar cada um:
 *  - erro    → a ação falhou, ou o dado impede de continuar
 *  - alerta  → dá para continuar, mas há uma consequência
 *  - ok      → confirmação de algo que aconteceu
 *  - info    → contexto, explicação de como a tela funciona
 */
export type TipoMsg = "erro" | "alerta" | "ok" | "info";

const ESTILO: Record<TipoMsg, { cls: string; Icon: typeof Info }> = {
  erro: { cls: "border-danger/30 bg-rose-50 text-danger-dark", Icon: XCircle },
  alerta: { cls: "border-amber-300/60 bg-amber-50 text-amber-800", Icon: AlertTriangle },
  ok: { cls: "border-brand/30 bg-brand-light text-brand-dark", Icon: CheckCircle2 },
  info: { cls: "border-line bg-surface text-ink-muted", Icon: Info },
};

export default function MessageStrip({
  tipo = "info",
  children,
  /** botão/link à direita, para a ação que resolve a mensagem */
  acao,
  /** mostra o X de fechar */
  fechavel = false,
  onFechar,
  className = "",
}: {
  tipo?: TipoMsg;
  children: React.ReactNode;
  acao?: React.ReactNode;
  fechavel?: boolean;
  onFechar?: () => void;
  className?: string;
}) {
  const [aberta, setAberta] = useState(true);
  const { cls, Icon } = ESTILO[tipo];
  if (!aberta) return null;

  return (
    <div
      role={tipo === "erro" ? "alert" : "status"}
      className={`flex items-start gap-2 rounded-xl2 border px-3.5 py-2.5 text-[12.5px] ${cls} ${className}`}
    >
      <Icon size={15} className="mt-px shrink-0" />
      <div className="min-w-0 flex-1 [&_b]:font-semibold">{children}</div>
      {acao && <div className="shrink-0">{acao}</div>}
      {fechavel && (
        <button
          type="button"
          aria-label="Fechar aviso"
          onClick={() => {
            setAberta(false);
            onFechar?.();
          }}
          className="shrink-0 opacity-60 transition hover:opacity-100"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

/**
 * Atalho para o caso mais comum do app: um estado `msg` com tipo "ok" | "erro".
 * Evita reescrever o ternário de classe em 50 arquivos.
 */
export function Msg({
  msg,
  className,
}: {
  msg: { tipo: "ok" | "erro"; texto: string } | null;
  className?: string;
}) {
  if (!msg) return null;
  return (
    <MessageStrip tipo={msg.tipo === "ok" ? "ok" : "erro"} className={className}>
      {msg.texto}
    </MessageStrip>
  );
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";

/**
 * Ir ao anterior/próximo da lista sem voltar para ela.
 *
 * O par de setas que Movimentações tem no topo da página do objeto. É o que
 * torna "conferir os dez cadastros do mês" uma tarefa de dez teclas em vez de
 * vinte navegações — e sem ele a página do objeto, que existe para dar URL
 * própria ao item, cobra uma volta à lista a cada item.
 *
 * `Alt` e não a seta pura: dentro da página há campos de formulário, e ↑/↓ sem
 * modificador pertencem ao cursor e à rolagem. Este é o mesmo motivo pelo qual
 * a lista usa seta pura (lá não há onde digitar) e a página usa Alt — os dois
 * gestos convivem porque nunca estão na mesma tela.
 *
 * Botão desabilitado quando não há vizinho: a ponta da lista precisa ser
 * visível, senão a tecla parece quebrada.
 */
export default function NavIrmaos({
  base,
  anteriorId,
  proximoId,
  rotulo,
}: {
  /** Prefixo da rota, sem barra no fim: `/clientes-fornecedores`. */
  base: string;
  anteriorId: string | null;
  proximoId: string | null;
  /** Nome do que se navega, para o title: "cliente", "contrato", "lançamento". */
  rotulo: string;
}) {
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!e.altKey) return;

      /*
        Quem está num campo é dono do Alt+seta.

        No macOS, Option+↓ é "ir ao fim do parágrafo" — reflexo de quem escreve
        texto longo, e a página do objeto É um formulário (observações, endereço,
        dados bancários). Sem esta guarda, o gesto navegava para o próximo
        cadastro e levava junto tudo que tinha sido digitado e não salvo, sem
        uma palavra. No Windows e no Linux o estrago é o mesmo, só sem o reflexo.
      */
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;

      if (e.key === "ArrowUp" && anteriorId) {
        e.preventDefault();
        router.push(`${base}/${anteriorId}`);
      } else if (e.key === "ArrowDown" && proximoId) {
        e.preventDefault();
        router.push(`${base}/${proximoId}`);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [anteriorId, proximoId, router, base]);

  // Sem vizinho nenhum (lista de um item só) não há o que navegar: dois botões
  // permanentemente apagados só ocupam espaço e sugerem função que não existe.
  if (!anteriorId && !proximoId) return null;

  return (
    <div className="flex items-center rounded-md border border-line">
      <button
        type="button"
        disabled={!anteriorId}
        onClick={() => anteriorId && router.push(`${base}/${anteriorId}`)}
        title={`${rotulo} anterior (Alt+↑)`}
        aria-label={`${rotulo} anterior`}
        className="flex h-8 w-8 items-center justify-center text-ink-muted transition hover:bg-surface hover:text-ink disabled:opacity-30"
      >
        <ChevronUp size={14} />
      </button>
      <span className="h-4 w-px bg-line" />
      <button
        type="button"
        disabled={!proximoId}
        onClick={() => proximoId && router.push(`${base}/${proximoId}`)}
        title={`Próximo ${rotulo} (Alt+↓)`}
        aria-label={`Próximo ${rotulo}`}
        className="flex h-8 w-8 items-center justify-center text-ink-muted transition hover:bg-surface hover:text-ink disabled:opacity-30"
      >
        <ChevronDown size={14} />
      </button>
    </div>
  );
}

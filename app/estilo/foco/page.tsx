"use client";

import { useState } from "react";
import { notFound } from "next/navigation";
import GuardaDialogo from "@/components/ui/guarda-dialogo";
import { bancadaLiberada } from "@/lib/bancada";

/**
 * Bancada do bug "o campo de texto aceita só uma letra".
 *
 * O diálogo abaixo é **errado de propósito**: `Moldura` está definida no corpo
 * do render, então ganha identidade nova a cada tecla e o React remonta a caixa
 * inteira. É a reprodução exata do que acontecia no formulário de lançamento.
 *
 * Serve para dirigir um navegador de verdade contra ela — digitar uma frase e
 * conferir que a frase inteira chegou no campo, com o cursor no fim. Nenhuma
 * das outras formas de verificação deste app abre uma tela: `tsc`, `next build`
 * e as asserções de regra aprovavam o bug sem hesitar.
 *
 * O repositório não tem Playwright instalado; o roteiro roda de fora, contra o
 * servidor de desenvolvimento. Se um dia alguém "consertar" a `Moldura` daqui,
 * a bancada deixa de testar o que existe para testar.
 */
export default function FocoPage() {
  if (!bancadaLiberada()) notFound();

  const [aberto, setAberto] = useState(true);
  const [txt, setTxt] = useState("");

  // Exatamente o antipadrão: componente definido no corpo do render.
  // Identidade nova a cada tecla → React remonta o diálogo inteiro.
  const Moldura = ({ children }: { children: React.ReactNode }) => (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Bancada de foco"
      className="p-4"
    >
      {children}
    </div>
  );

  if (!aberto) return <button onClick={() => setAberto(true)}>abrir</button>;

  return (
    <>
      <GuardaDialogo />
      <Moldura>
        <button aria-label="Fechar" onClick={() => setAberto(false)}>
          x
        </button>
        <input
          id="alvo"
          data-testid="alvo"
          value={txt}
          onChange={(e) => setTxt(e.target.value)}
        />
        <button>outro</button>
      </Moldura>
    </>
  );
}

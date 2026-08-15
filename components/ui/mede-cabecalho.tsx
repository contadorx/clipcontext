"use client";

import { useEffect, useRef } from "react";

/**
 * Publica a altura do cabeçalho de página numa variável CSS (`--fs-cab`).
 *
 * Existe por um motivo prático: o cabeçalho de coluna da tabela precisa ficar
 * preso logo abaixo do cabeçalho da página, e a altura desse cabeçalho muda de
 * tela para tela (título só, título + subtítulo, título + abas, título +
 * filtros). Cravar um número no CSS daria certo em uma tela e errado nas outras
 * — a linha de cabeçalho sumiria por baixo ou flutuaria com um vão.
 *
 * Renderiza nada; só mede o elemento pai.
 */
export default function MedeCabecalho() {
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const alvo = ref.current?.parentElement;
    if (!alvo) return;

    const aplicar = () => {
      document.documentElement.style.setProperty("--fs-cab", `${Math.round(alvo.offsetHeight)}px`);
    };
    aplicar();

    const ro = new ResizeObserver(aplicar);
    ro.observe(alvo);
    return () => {
      ro.disconnect();
      // ao sair da tela, zera para não deixar o valor da tela anterior valendo
      document.documentElement.style.setProperty("--fs-cab", "0px");
    };
  }, []);

  return <span ref={ref} className="hidden" aria-hidden />;
}

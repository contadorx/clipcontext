"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Preferência de quem usa, guardada neste navegador.
 *
 * Mesmo lugar e mesmo espírito de `useConfigColunas`: é escolha pessoal, muda
 * conforme a tela em que a pessoa trabalha e não pertence à empresa — então não
 * vai para o banco.
 *
 * Começa sempre no padrão e só lê o que estiver salvo **depois** de montar. Ler
 * no primeiro render daria HTML diferente no servidor e no cliente, e a
 * hidratação do React quebraria — de um jeito silencioso, que costuma aparecer
 * bem longe da causa.
 */
export function usePreferencia<T extends boolean | string>(chave: string, padrao: T) {
  const [valor, setValor] = useState<T>(padrao);

  useEffect(() => {
    try {
      const bruto = window.localStorage.getItem(`fx_pref_${chave}`);
      if (bruto === null) return;
      // booleana continua guardada como "1"/"0" — mudar o formato agora apagaria
      // a preferência de quem já escolheu
      if (typeof padrao === "boolean") {
        if (bruto === "1" || bruto === "0") setValor((bruto === "1") as T);
      } else {
        setValor(bruto as T);
      }
    } catch {
      /* sem localStorage (aba anônima com restrição): vale o padrão */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  const trocar = useCallback(
    (novo: T) => {
      setValor(novo);
      try {
        window.localStorage.setItem(
          `fx_pref_${chave}`,
          typeof novo === "boolean" ? (novo ? "1" : "0") : String(novo),
        );
      } catch {
        /* vale só nesta sessão */
      }
    },
    [chave],
  );

  return [valor, trocar] as const;
}

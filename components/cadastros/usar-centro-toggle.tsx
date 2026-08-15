"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function UsarCentroToggle({
  escritorioId,
  inicial,
}: {
  escritorioId: string;
  inicial: boolean;
}) {
  const router = useRouter();
  const [on, setOn] = useState(inicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function alternar() {
    /*
      A chave virava na tela antes de o banco confirmar, e o erro era
      descartado. Falhando, o `router.refresh()` logo abaixo redesenhava o
      estado antigo: a chave voltava sozinha, sem uma palavra, e a pessoa
      concluía que o clique não pegou. Agora a chave volta porque foi revertida,
      e a tela diz por quê.

      O `escritorioId` vazio também produzia isso: a página chamava esta função
      com `""` quando não achava o escritório, e o update erra por uuid
      inválido. Este componente recusa antes de tentar.
    */
    if (!escritorioId) {
      setErro("Escritório não identificado — recarregue a página.");
      return;
    }
    const novo = !on;
    setOn(novo);
    setSalvando(true);
    setErro(null);
    const supabase = createClient();
    const r = await supabase.from("escritorios").update({ usar_centro_custo: novo }).eq("id", escritorioId);
    setSalvando(false);
    if (r.error) {
      setOn(!novo);
      setErro(`Não foi possível salvar (${r.error.message}).`);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex items-center justify-between rounded-xl2 bg-white p-4 shadow-card">
      <div>
        <p className="text-sm font-semibold text-ink">Usar centro de custo nos lançamentos</p>
        <p className="text-xs text-ink-soft">
          Desligado, o campo some do formulário de lançamento para deixar a tela mais limpa.
        </p>
        {erro && <p className="mt-1 text-xs font-semibold text-danger">{erro}</p>}
      </div>
      <button
        type="button"
        onClick={alternar}
        disabled={salvando}
        aria-pressed={on}
        aria-label="Usar centro de custo nos lançamentos"
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-brand" : "bg-line"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
            on ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}

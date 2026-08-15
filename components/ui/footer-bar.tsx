"use client";

/**
 * Footer bar — a barra de ações presa no rodapé.
 *
 * A regra do Fiori é simples: ação que age sobre a seleção não fica no meio da
 * tela. Em Liquidações, selecionar um título fazia aparecer um bloco de botões
 * *acima* da tabela — e a tabela inteira descia, então a linha que você
 * acabou de marcar saía de debaixo do cursor. Preso no rodapé, isso não
 * acontece, e o botão fica sempre no mesmo lugar entre uma tela e outra.
 *
 * Só aparece quando há o que fazer (`quando`), para não roubar altura útil.
 *
 * O `pr-16`/`sm:pr-20` reserva o canto onde mora a bolinha do suporte
 * (`suporte-chat.tsx`, 52px em `bottom-5 right-5`, mesmo `z-40` e pintada
 * depois): sem ele, ela cobre a borda direita do botão principal — que nas
 * telas de formulário é justamente o "Salvar".
 */
export default function FooterBar({
  quando = true,
  /** contexto à esquerda: contagem, soma, avisos da seleção */
  info,
  children,
}: {
  quando?: boolean;
  info?: React.ReactNode;
  children: React.ReactNode;
}) {
  if (!quando) return null;
  return (
    <>
      {/*
        Espaçador: a barra é `fixed`, então não ocupa altura no fluxo.

        Nas telas de seleção isso era compensado à mão em cada consumidor (um
        `<div className="h-12" />` solto no fim do arquivo), e quem adotasse a
        barra depois não tinha como saber. Agora vem junto — e passou a
        importar de verdade: nas telas de formulário a barra é permanente, e
        sem o espaçador ela cobria o último campo, que não recebia mais clique.
      */}
      <div className="h-16" aria-hidden />
      <div className="fixed inset-x-0 bottom-0 z-40 flex flex-wrap items-center gap-3 border-t border-line bg-white/95 px-5 py-2.5 pr-16 text-sm shadow-[0_-2px_8px_rgba(90,107,123,.12)] backdrop-blur sm:pr-20">
        {info}
        <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>
      </div>
    </>
  );
}

/** separador vertical entre blocos da barra */
export function FooterSep() {
  return <span className="h-4 w-px bg-brand/20" />;
}

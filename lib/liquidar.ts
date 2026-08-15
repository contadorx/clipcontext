import { createClient } from "@/lib/supabase/client";

/**
 * Dar baixa num lançamento: marcar a data de pagamento e a conta.
 *
 * Existe como função solta porque duas telas precisam dela. Liquidações sempre
 * teve; o Fluxo passou a ter quando as tabelas de vencidos e futuros deixaram
 * de ser só leitura. Escrever o `update` duas vezes seria criar duas verdades
 * sobre o que significa "pago" — e a segunda envelheceria calada.
 *
 * O que a baixa faz, e por quê:
 * - `data_pagamento` é o que tira o lançamento de "em aberto" e o põe no saldo
 *   realizado. É a única coluna que decide isso no app inteiro.
 * - `conta_id` é obrigatório junto: saldo sem conta não existe, e um pagamento
 *   sem conta some do Fluxo, que filtra `conta_id is not null`.
 * - `data_agendamento` é limpo porque o item deixa a fila de agendados. Sem
 *   isso ele continuaria aparecendo em Liquidações depois de pago.
 *
 * Não dispara `fs-mov-changed` sozinha: quem chama decide quando avisar, porque
 * o evento recarrega várias telas e disparar no meio de um lote seria uma
 * recarga por item.
 */
export async function liquidarLancamentos(ids: string[], dataPagamento: string, contaId: string) {
  if (ids.length === 0) return { error: null };
  const supabase = createClient();
  const { error } = await supabase
    .from("lancamentos")
    .update({ data_pagamento: dataPagamento, conta_id: contaId, data_agendamento: null })
    .in("id", ids)
    /*
      Trava contra dar baixa duas vezes.

      Uma seleção pode envelhecer: a pessoa marca quatro vencidos, alguém liquida
      um deles em outra tela, a lista recarrega e o id continua marcado. Sem esta
      condição, a segunda baixa **sobrescreve** `data_pagamento` e `conta_id` de
      um lançamento já pago — jogando-o para outro mês e outra conta, e quebrando
      a conciliação que já tinha sido feita. O banco recusa em vez de confiar na
      tela: é a única camada por onde as duas telas passam.
    */
    .is("data_pagamento", null);
  return { error };
}

/** avisa as outras telas que o dado mudou — o Fluxo, o Painel e as listas ouvem */
export function avisarMovimentacaoMudou() {
  window.dispatchEvent(new CustomEvent("fs-mov-changed"));
}

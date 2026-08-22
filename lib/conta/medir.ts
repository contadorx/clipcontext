/* A MEDIÇÃO DA ÁREA DA CONTA — três marcos do lado pago, e nenhum a mais.
 *
 * A ferramenta media desde sempre; a conta, não. O efeito era um funil que
 * terminava em "baixou um documento" — e a pergunta que decide o produto
 * começa depois disso: alguém chega a importar um roteiro? alguém conclui um
 * caso? alguém começa a pagar?
 *
 * ---- POR QUE ISTO RESPEITA DO NOT TRACK, SENDO SERVIDOR ----
 *
 * `medir()` no navegador consulta `navigator.doNotTrack` e cala a boca quando
 * a pessoa pediu. Do lado do servidor esse objeto não existe, e a saída
 * preguiçosa seria dizer que "DNT é coisa de navegador" e medir assim mesmo.
 *
 * Isso seria contradizer a política de privacidade por um detalhe de
 * implementação: quem desligou o rastreamento desligou o rastreamento, e não
 * "o rastreamento feito por JavaScript". O navegador manda `DNT: 1` e
 * `Sec-GPC: 1` no cabeçalho de TODA requisição — inclusive na que dispara a
 * ação do servidor —, então dá para honrar o pedido aqui do mesmo jeito.
 *
 * ---- O QUE VAI JUNTO ----
 *
 * Nome do evento, idioma, de onde veio e o rótulo do plano. Nada de e-mail,
 * conta, nome de roteiro, de caso, de sistema, de chamado ou de arquivo — o
 * vocabulário do banco é fechado e recusa o que não está na lista, mas a
 * primeira barreira é não mandar.
 */
import 'server-only';
import { headers } from 'next/headers';
import { rpc, temChaveDeServico } from '@/lib/supabase/servico';

export type MarcoDaConta =
  'importou_roteiro' | 'concluiu_caso' | 'comecou_teste' | 'comecou_pagamento';

/** A pessoa pediu para não ser rastreada, no cabeçalho da própria requisição. */
async function pediuParaNaoMedir(): Promise<boolean> {
  try {
    const h = await headers();
    return h.get('dnt') === '1' || h.get('sec-gpc') === '1';
  } catch {
    /* Fora de uma requisição não há cabeçalho para ler, e medir sem poder
       conferir o pedido é o que esta função existe para não fazer. */
    return true;
  }
}

/** Marca um passo do lado pago. Nunca lança: medição que falha não pode
 *  custar a ação que a pessoa pediu. */
export async function medirConta(
  nome: MarcoDaConta,
  { lang, plano }: { lang?: string; plano?: string } = {},
): Promise<void> {
  try {
    if (!temChaveDeServico) return;
    if (await pediuParaNaoMedir()) return;
    await rpc('walkstamp_evento', {
      p_nome: nome,
      p_idioma: lang || null,
      p_origem: 'conta',
      p_plano: plano === 'time' || plano === 'personal' ? plano : null,
    }).catch(() => {});
  } catch { /* sem barulho, por definição */ }
}

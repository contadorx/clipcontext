import { createClient } from "@/lib/supabase/client";

type SB = ReturnType<typeof createClient>;

export type SequencialReservado = {
  seq: number;
  /**
   * Recado para a tela quando a reserva não ficou registrada. `null` = tudo
   * certo. Não é motivo para cancelar a remessa — o arquivo é válido e o
   * usuário precisa dele agora — mas é motivo para avisar, porque o estrago só
   * aparece no **próximo** arquivo, longe daqui.
   */
  aviso: string | null;
};

/**
 * Sequencial do próximo arquivo de remessa de cobrança da conta.
 *
 * Se a conta tiver `cnab_seq_cobranca` definido (> 0), usa esse número e
 * incrementa — permite continuar a numeração de outro sistema. Senão, conta as
 * remessas já enviadas. Usado em Boletos e em Liquidações, para os dois ficarem
 * consistentes.
 *
 * Os dois erros de banco daqui eram descartados, e cada um tem consequência
 * própria:
 *
 * - o `update` que não grava faz a **próxima** remessa sair com o mesmo número.
 *   Buraco na numeração o banco tolera; número repetido, não — o arquivo é
 *   rejeitado no protocolo e ninguém liga o motivo, porque a falha aconteceu no
 *   envio anterior, que deu certo.
 * - o `select` que falha cai no ramo de contagem e devolve um número de outra
 *   série, o que produz a mesma repetição.
 */
export async function reservarSequencialCobranca(supabase: SB, contaId: string): Promise<SequencialReservado> {
  const cta = await supabase.from("contas_bancarias").select("cnab_seq_cobranca").eq("id", contaId).maybeSingle();
  /*
    Terceiro erro de banco desta função, e o mais traiçoeiro: se a CONTAGEM
    falha, `count` vem `null`, o `?? 0` transforma isso em "nenhuma remessa" e o
    arquivo sai com o sequencial 1 — repetindo o da primeira remessa da conta.
    Repetição é o que o banco rejeita. Devolve o erro junto para virar aviso.
  */
  const contar = async (): Promise<{ seq: number; erro: string | null }> => {
    const r = await supabase
      .from("cnab_remessas")
      .select("id", { count: "exact", head: true })
      .eq("conta_id", contaId)
      .eq("tipo", "cobranca");
    if (r.error) return { seq: 1, erro: r.error.message };
    return { seq: (r.count ?? 0) + 1, erro: null };
  };
  if (cta.error) {
    const c = await contar();
    return {
      seq: c.seq,
      aviso: `Não foi possível ler o sequencial CNAB da conta (${cta.error.message}); o arquivo saiu com um número calculado pelo histórico${
        c.erro ? `, e nem o histórico pôde ser contado (${c.erro}) — o número ${c.seq} pode já ter sido usado` : ""
      }. Confira a numeração em Configurações → CNAB antes da próxima remessa.`,
    };
  }
  const explicito = Number((cta.data as { cnab_seq_cobranca?: number | null } | null)?.cnab_seq_cobranca) || 0;
  if (explicito > 0) {
    const av = await supabase.from("contas_bancarias").update({ cnab_seq_cobranca: explicito + 1 }).eq("id", contaId);
    return {
      seq: explicito,
      aviso: av.error
        ? `O sequencial CNAB da conta não avançou (${av.error.message}). A próxima remessa sairia com o mesmo número ${explicito} e o banco rejeitaria o arquivo — ajuste para ${explicito + 1} em Configurações → CNAB.`
        : null,
    };
  }
  const c = await contar();
  return {
    seq: c.seq,
    aviso: c.erro
      ? `Não foi possível contar as remessas já enviadas desta conta (${c.erro}); o arquivo saiu com o sequencial ${c.seq}, que pode repetir um número já usado — o banco rejeita arquivo com sequencial repetido. Confira antes de enviar.`
      : null,
  };
}

/* A Stripe.
 *
 * Três coisas que valem mais que o código abaixo:
 *
 * 1. **A degustação de 14 dias não passa por aqui.** Quem entra pela primeira
 *    vez já ganha 14 dias com tudo pela `plano_de` do banco, sem cartão, sem
 *    conta na Stripe e sem checkout. A Stripe só entra quando a pessoa decide
 *    pagar. Amarrar o teste a uma assinatura com cartão criaria um pedágio na
 *    porta — exatamente o que o produto promete não ter.
 *
 * 2. **Nada aqui é requisito para usar a ferramenta.** Sem chave configurada,
 *    o botão de comprar diz que a venda ainda não está no ar, e o resto do
 *    produto não muda de comportamento.
 *
 * 3. **A nota fiscal não sai daqui.** A Stripe não emite NFS-e brasileira. A
 *    nota é emitida depois do pagamento, em outro sistema, e o que entra na
 *    fatura é o endereço dela quando existir.
 */
import 'server-only';
import Stripe from 'stripe';

const SEGREDO = process.env.STRIPE_SECRET_KEY;

export const temStripe = Boolean(SEGREDO);

export function stripe(): Stripe {
  if (!SEGREDO) throw new Error('falta STRIPE_SECRET_KEY no ambiente');
  return new Stripe(SEGREDO);
}

/** Os planos vendáveis. O preço mora na Stripe; aqui mora só o que o produto
 *  precisa saber para liberar o que foi comprado. */
export const PLANOS = {
  personal: {
    preco: () => process.env.STRIPE_PRICE_PERSONAL || '',
    assentos: 1,
    // dias de validade da licença que o navegador vai carregar. É o botão de
    // revogação: uma licença curta para de ser reemitida quando a assinatura
    // morre.
    //
    // "SE RENOVA SOZINHA" saiu daqui — 24/08. Era o que esta linha dizia, e não
    // era verdade: nada renovava. A chave vencia em 45 dias e a ferramenta
    // dizia "fale comigo para renovar", no dia seguinte ao vencimento.
    //
    // O que existe agora, e o limite dele: quem abre a ferramenta COM SESSÃO
    // dentro dos últimos dez dias recebe a chave nova sem fazer nada. Sem
    // sessão — que é o caso comum, porque a sessão vive na aba e o token vence
    // — a ferramenta AVISA antes, com o número de dias e o link da conta.
    // Renovar sem sessão exigiria uma credencial de longa duração no navegador
    // ou um cron mandando e-mail; a primeira piora o modelo de ameaça do
    // produto e a segunda cria infraestrutura para manter. A escolha está
    // registrada no `BUILD-6.md`.
    dias: 45,
  },
  time: {
    preco: () => process.env.STRIPE_PRICE_TIME || '',
    // O MÍNIMO DO TEAM MORA AQUI, E SÓ AQUI.
    //
    // Era 5, e cinco pessoas é um time grande demais para ser o primeiro
    // degrau: a agência de três, que é quem mais sofre com a rodada manual,
    // ficava de fora da única versão que resolve o problema dela.
    //
    // `testes/promessa.mjs` lê este número e cobra que a página do caso de UX
    // e a de preços digam a MESMA palavra nos cinco idiomas. Mudar aqui e
    // esquecer o texto reprova a suíte — que é exatamente o que se quer.
    assentos: 3,
    // VINTE E UM, E NÃO QUARENTA E CINCO — 24/08.
    //
    // Este número é o único controle real de revogação que existe sem um
    // servidor no caminho do uso: bloquear um membro impede a PRÓXIMA emissão,
    // e a chave que já está no navegador dele vale até vencer. Com 45, cortar
    // alguém podia levar mês e meio. Com 21, leva no máximo três semanas.
    //
    // Por que não 14, que seria mais rápido: 14 é o prazo da DEGUSTAÇÃO, e a
    // ferramenta identifica degustação por dias restantes. Dois prazos iguais
    // com significados diferentes é a próxima confusão esperando acontecer.
    //
    // O custo é de quem trabalha desconectado: a chave precisa ser renovada
    // mais vezes. Quem abre a ferramenta com sessão renova sozinho (a janela é
    // de 10 dias, e cabe dentro dos 21); quem não tem sessão é avisado antes,
    // com o link da conta. O administrador pode subir até 90 na tela da conta —
    // o controle é dele, e o `timeAviso` explica o que cada escolha custa.
    dias: 21,
  },
} as const;

export type NomeDoPlano = keyof typeof PLANOS;

export const ehPlano = (v: string): v is NomeDoPlano => v === 'personal' || v === 'time';

/** De volta do preço da Stripe para o nome do plano. Sem isso, o webhook
 *  saberia que alguém pagou mas não o quê. */
export function planoDoPreco(precoId: string | null | undefined): NomeDoPlano | null {
  if (!precoId) return null;
  for (const nome of Object.keys(PLANOS) as NomeDoPlano[]) {
    if (PLANOS[nome].preco() === precoId) return nome;
  }
  return null;
}

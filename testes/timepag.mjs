/* A PÁGINA /time FOI APOSENTADA — 23/08. Este arquivo PULA, e diz o que se
 * perdeu com ele.
 *
 * A `/time` era órfã e indexável: nenhuma página do site levava a ela, e ela
 * vendia o mesmo plano que a `/precos`. Duas páginas vendendo a mesma coisa é o
 * defeito que mais custou a este projeto. Ela foi redirecionada — o endereço
 * continua respondendo 308 nos cinco idiomas, e isso é `compra.mjs [6]`.
 *
 * O QUE ESTE ARQUIVO COBRIA E NINGUÉM COBRE HOJE, dito com todas as letras:
 *
 *   [3] e-mail malformado não sai do lugar
 *   [4] pedir o link
 *   [5] o limite de envio é dito, e não engolido
 *   [6] a volta do link mágico entrega o link do plano
 *   [7] degustação já usada tem resposta escrita, e não silêncio
 *   [8] link do e-mail vencido
 *
 * Esse fluxo não morreu com a página: ele mora na conta, em `entrar()` e na
 * rota `/conta/confirmar`. O que morreu foi a maneira de testá-lo daqui. Os
 * blocos acima falsificavam as respostas do Supabase interceptando chamadas do
 * NAVEGADOR (`pg.route('**\/auth/v1/otp**')`), e na conta essas chamadas
 * acontecem no SERVIDOR, dentro de uma ação. Interceptar do lado do navegador
 * não alcança. Reescrever contra a arquitetura nova é trabalho de verdade, e
 * não cabia neste build.
 *
 * ENTÃO ELE PULA, ALTO, EM VEZ DE SER APAGADO. Apagar deixaria a esteira com um
 * número menor e a mesma cobertura — o tipo de verde que este projeto passou
 * três builds aprendendo a não aceitar. O item está na `FILA.md`.
 */
console.log('PULADO  a /time foi aposentada (compra.mjs [6] cobre o redirecionamento).');
console.log('        O fluxo e-mail → link mágico → chave migrou para a conta e');
console.log('        ainda NÃO tem régua: os blocos [3] a [8] deste arquivo falsificavam');
console.log('        o Supabase pelo navegador, e na conta isso roda no servidor.');
console.log('        Seis afirmações a menos de cobertura. Item aberto na FILA.md.');
process.exit(0);

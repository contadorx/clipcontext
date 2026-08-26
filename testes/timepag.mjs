/* A PÁGINA /time FOI APOSENTADA — 23/08, e a dívida dela foi paga em 24/08.
 *
 * A `/time` era órfã e indexável: nenhuma página do site levava a ela, e ela
 * vendia o mesmo plano que a `/precos`. Foi redirecionada — o endereço continua
 * respondendo 308 nos cinco idiomas, e isso é `compra.mjs [6]`.
 *
 * Junto com ela foram OITO blocos deste arquivo, e seis cobriam coisas que
 * ficaram sem régua nenhuma. Ficou escrito aqui, alto, em vez de apagado.
 *
 * PAGO. `testes/entrada2.mjs` devolveu as seis, contra o servidor de verdade:
 *
 *     e-mail malformado não sai do lugar        → entrada2 [1], e são duas travas
 *     pedir o link                              → entrada2 [2]
 *     o limite de envio é dito, e não engolido  → entrada2 [4]
 *     a volta do link mágico                    → entrada2 [5]
 *     link do e-mail vencido                    → entrada2 [5]
 *     o idioma atravessa                        → entrada2 [6]
 *
 * O que faltava não era mecanismo: `WALKSTAMP_SUPA_TESTE` já apontava o cliente
 * de sessão para um endereço local, e o `portal.mjs` já usava isso. Faltava
 * escrever.
 *
 * Este arquivo continua pulando porque a PÁGINA não existe — e some da esteira
 * no dia em que alguém precisar do número. Enquanto ele estiver aqui, o ponteiro
 * para onde cada afirmação foi parar está acima.
 */
console.log('PULADO  a /time foi aposentada; o redirecionamento é compra.mjs [6]');
console.log('        e o fluxo de entrada dela virou entrada2.mjs — dívida paga.');
process.exit(0);

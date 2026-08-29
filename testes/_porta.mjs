/* A PORTA TEM QUE SER NOSSA — e "matar quem estava lá" não basta.
 *
 * O QUE ACONTECEU, EM 28/08. Uma esteira interrompida deixou um `next start`
 * velho segurando a 8807. O `roteiro.mjs` subiu o dele, o segundo morreu com
 * EADDRINUSE, e o teste seguiu FALANDO COM O SERVIDOR ANTIGO — de outro build.
 * Reprovou por um defeito que não existia no código, e a caçada foi atrás de um
 * erro que ninguém tinha cometido. Pior: se o servidor velho casualmente
 * passasse em tudo, o verde seria sobre código que ninguém rodou.
 *
 * E A PRIMEIRA TENTATIVA DE CONSERTO NÃO BASTOU. Ler o log do `next` atrás de
 * "EADDRINUSE" parece suficiente e não é: quem responde o primeiro `fetch` é o
 * servidor VELHO, na hora, e o laço de espera sai satisfeito antes de o novo
 * sequer ter reclamado. Medido — o teste passou inteiro contra o servidor
 * errado, com a leitura do log ligada.
 *
 * O que funciona é não perguntar a ninguém: TENTAR OCUPAR a porta. Se der,
 * ela estava livre e o servidor que subir nela é o nosso. Se não der, ninguém
 * adivinha nada — o teste para e diz o que fechar.
 */
import { execFileSync } from 'child_process';
import net from 'net';

const livre = (porta) => new Promise((resolve) => {
  const s = net.createServer();
  s.once('error', () => resolve(false));
  s.once('listening', () => s.close(() => resolve(true)));
  s.listen(porta, '0.0.0.0');
});

/** Libera a porta e PROVA que ela ficou livre. Sai do processo com 1, e com um
 *  recado que diz o que fazer, quando não conseguir — nunca devolve "talvez". */
export async function garantirPortaLivre(porta, quem = 'este teste') {
  if (await livre(porta)) return;
  try { execFileSync('fuser', ['-k', `${porta}/tcp`], { stdio: 'ignore' }); } catch {}
  /* O sistema não devolve a porta no mesmo instante em que o processo morre. */
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 250));
    if (await livre(porta)) return;
  }
  console.log(`FALHA  a porta ${porta} continua ocupada por outro processo.`);
  console.log(`       ${quem} falaria com um servidor que ele não subiu, de um build`);
  console.log('       que ele não conhece — e um verde desses não vale nada.');
  console.log(`       feche o processo antigo:  fuser -k ${porta}/tcp`);
  process.exit(1);
}

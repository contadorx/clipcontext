/* O MIDDLEWARE DE SESSÃO CASA A CONTA NOS CINCO IDIOMAS.
 *
 * O matcher casava só `/conta`, que é o endereço PORTUGUÊS. A conta existe em
 * `/en/account`, `/es/cuenta`, `/de/konto` e `/fr/compte` — e o middleware roda
 * ANTES das reescritas do `next.config.mjs`, então ele vê o endereço que o
 * navegador pediu, e não o `/conta/<idioma>` interno. Resultado medido: a
 * sessão não era renovada em quatro dos cinco idiomas.
 *
 * O `config` do Next tem de ser estático — não dá para importar `rotas.json`
 * lá dentro. Então a lista é escrita à mão, e esta régua existe para que ela
 * não possa divergir da fonte em silêncio, que é o defeito que mais custou a
 * este projeto.
 *
 * Ela é estática de propósito: lê os dois arquivos e compara. Sem navegador,
 * sem servidor, um segundo.
 */
import fs from 'fs';

import { RAIZ_WS } from './_caminhos.mjs';

let falhas = 0;
const ok = (n, c, e) => {
  console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : ''));
  if (!c) falhas++;
};

const rotas = JSON.parse(fs.readFileSync(`${RAIZ_WS}/src/rotas.json`, 'utf8'));
const fonte = fs.readFileSync(`${RAIZ_WS}/middleware.ts`, 'utf8');

console.log('[1] o matcher existe e é uma lista literal');
const bloco = (fonte.match(/matcher:\s*\[([\s\S]*?)\]/) || [])[1];
ok('achei o matcher em middleware.ts', Boolean(bloco));

const casados = [...(bloco || '').matchAll(/'([^']+)'/g)].map((m) => m[1]);
ok('e ele não está vazio', casados.length > 0, String(casados.length));

console.log('\n[2] cada caminho público da conta está coberto — raiz e subárvore');
const conta = rotas.caminhoConta || {};
ok('o rotas.json traz os cinco idiomas',
   Object.keys(conta).length === rotas.idiomas.length,
   Object.keys(conta).join(','));

for (const L of rotas.idiomas) {
  const base = conta[L];
  if (!base) { ok(`${L}: tem endereço de conta no rotas.json`, false); continue; }
  ok(`${L}: ${base} está no matcher`, casados.includes(base));
  /* A subárvore importa tanto quanto a raiz: `/de/konto/rechnungen` é onde a
     pessoa fica, e é lá que a sessão vence enquanto ela lê a fatura. */
  ok(`${L}: e ${base}/… também`,
     casados.includes(`${base}/:caminho*`),
     casados.filter((c) => c.startsWith(base)).join(' '));
}

console.log('\n[3] e não sobra caminho no matcher que não seja conta');
const legitimos = new Set(rotas.idiomas.flatMap((L) => {
  const b = conta[L];
  return b ? [b, `${b}/:caminho*`] : [];
}));
const sobrando = casados.filter((c) => !legitimos.has(c));
ok('nenhum caminho estranho no matcher', sobrando.length === 0, sobrando.join(' '));

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nMiddleware da conta: tudo passou.');
process.exit(falhas ? 1 : 0);

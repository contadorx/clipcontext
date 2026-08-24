/* NADA QUE A PESSOA ESCREVEU É JOGADO FORA SEM PERGUNTAR.
 *
 * Quatro botões trocam a lista inteira de quadros: varrer de novo, gravar de
 * novo, abrir outro projeto e carregar outro vídeo. Nenhum deles parecia
 * destrutivo — "Extrair frames" parece um refinamento, e na maior parte das
 * vezes é. O que a varredura NÃO refaz é o que a pessoa escreveu: anotação,
 * tarja, impressão digital, clipe. Isso ia embora sem confirmar e sem desfazer.
 *
 * ESTA RÉGUA COBRA AS DUAS METADES, e a segunda importa tanto quanto a primeira:
 *
 *   1. Com trabalho na tela, o botão PERGUNTA — e a pergunta diz QUANTO se
 *      perde, item por item. "Tem certeza?" não é informação.
 *   2. Sem trabalho na tela, o botão NÃO pergunta. Um diálogo que aparece toda
 *      vez vira um clique automático, e aí o diálogo que importa passa junto.
 *      Confirmar demais é o mesmo defeito que não confirmar, com outra cara.
 *
 * E ela existe por um motivo específico: quatro arquivos desta suíte
 * (`clipe`, `juntar`, `anotacao`, `grade`) descartam de propósito e por isso
 * ACEITAM o diálogo. Se o recurso sumisse do produto, os quatro continuariam
 * verdes — aceitar um diálogo que não aparece não custa nada. Sem este arquivo,
 * o recurso e o teste dele morreriam no mesmo gesto.
 */
import http from 'http';
import fs from 'fs';

import { chromium } from './_navegador.mjs';
import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';

const ROOT = `${RAIZ_WS}/public`;
const html = fs.readFileSync(ROOT + '/app.html', 'utf8');
const srv = http.createServer((q, r) => {
  if (q.url.startsWith('/_vercel/')) { r.writeHead(200, { 'Content-Type': 'text/javascript' }); return r.end(''); }
  r.writeHead(200, { 'Content-Type': 'text/html' }); r.end(html);
});
await new Promise((r) => srv.listen(8919, r));

let falhas = 0;
const ok = (n, c, e) => {
  console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : ''));
  if (!c) falhas++;
};

const br = await chromium.launch({ executablePath: CHROME_WS });
const ctx = await br.newContext({ acceptDownloads: true });
const pg = await ctx.newPage();

/* Os diálogos são RECOLHIDOS, e não aceitos cegamente: o texto de cada um é o
   que esta régua veio ler. `resposta` decide o que fazer com o próximo. */
const dialogos = [];
let resposta = 'dismiss';
pg.on('dialog', async (d) => {
  dialogos.push(d.message());
  if (resposta === 'accept') await d.accept(); else await d.dismiss();
});

/* ESPERA POR CONDIÇÃO, E NÃO POR RELÓGIO.
   A primeira versão esperava `#prevCard` aparecer e mais 500 ms. Sozinha, ela
   passava; na regressão, com três Chromiums disputando quatro núcleos, a
   varredura ficou mais lenta que o meio segundo e o teste leu 1 quadro onde
   pedira 3 — vermelho por carga de máquina, e não por defeito.
   É exatamente o defeito que este build veio consertar em `rolar` e `espera2`,
   escrito por mim, no arquivo novo, no mesmo dia. Fica registrado por isso. */
async function extrair(quantos) {
  await pg.selectOption('#mode', 'count');
  await pg.fill('#count', String(quantos));
  await pg.locator('#extract').click();
  await pg.waitForSelector('#prevCard:not(.hide)', { timeout: 40000 });
  await pg.waitForFunction(
    (n) => document.querySelectorAll('#thumbs figure').length >= n,
    quantos, { timeout: 60000 });
}
const quantos = () => pg.locator('#thumbs figure').count();

console.log('[1] sem trabalho na tela, varrer de novo NÃO pergunta');
await pg.goto('http://localhost:8919/app.html?lang=pt&modelo=evidencia');
await pg.waitForTimeout(400);
await pg.setInputFiles('#file', '/tmp/amostra.webm');
await pg.waitForTimeout(2500);
await extrair(3);
ok('a primeira varredura trouxe os quadros', (await quantos()) === 3, String(await quantos()));

dialogos.length = 0;
await extrair(4);
ok('varrer de novo, sem nada escrito, não perguntou nada', dialogos.length === 0,
   dialogos.join(' | '));
ok('e a nova varredura valeu', (await quantos()) === 4, String(await quantos()));

console.log('\n[2] com uma anotação escrita, ele pergunta — e diz o que se perde');
const campos = await pg.locator('#thumbs figure input.nota').all();
ok('há campo de anotação na grade', campos.length > 0, String(campos.length));
await campos[0].fill('O botão de aprovar não respondeu');
await pg.waitForTimeout(300);

dialogos.length = 0;
resposta = 'dismiss';
await pg.selectOption('#mode', 'count');
await pg.fill('#count', '2');
await pg.locator('#extract').click();
/* Aqui a espera é pelo DIÁLOGO, que é o que este bloco veio ver. */
await pg.waitForFunction(() => true, null, { timeout: 1000 }).catch(() => {});
for (let i = 0; i < 40 && dialogos.length === 0; i++) await pg.waitForTimeout(100);

ok('perguntou antes de descartar', dialogos.length === 1, String(dialogos.length));
ok('e a pergunta CONTA o que se perde, em vez de só "tem certeza?"',
   /1/.test(dialogos[0] || '') && (dialogos[0] || '').length > 30, dialogos[0]);

console.log('\n[3] recusar mantém tudo — inclusive o texto');
ok('a lista continua inteira', (await quantos()) === 4, String(await quantos()));
const aindaLa = await pg.locator('#thumbs figure input.nota').first().inputValue();
ok('e a anotação continua lá', aindaLa === 'O botão de aprovar não respondeu', aindaLa);

console.log('\n[4] aceitar descarta de verdade');
dialogos.length = 0;
resposta = 'accept';
await pg.selectOption('#mode', 'count');
await pg.fill('#count', '2');
await pg.locator('#extract').click();
await pg.waitForSelector('#prevCard:not(.hide)', { timeout: 40000 });
/* Pelo mesmo motivo do `extrair()` acima: a lista tem de CHEGAR a dois, e não
   "provavelmente já chegou depois de 700 ms". */
await pg.waitForFunction(
  () => document.querySelectorAll('#thumbs figure').length === 2, null, { timeout: 60000 })
  .catch(() => {});
ok('perguntou de novo', dialogos.length === 1, String(dialogos.length));
ok('e agora a varredura nova valeu', (await quantos()) === 2, String(await quantos()));
const depois = await pg.locator('#thumbs figure input.nota').first().inputValue();
ok('a anotação foi embora, porque foi isso que se pediu', depois === '', depois);

console.log('\n[5] abrir outro projeto também pergunta');
resposta = 'dismiss';
const campos2 = await pg.locator('#thumbs figure input.nota').all();
await campos2[0].fill('anotação nova');
await pg.waitForTimeout(300);
dialogos.length = 0;
/* O `.json` de um projeto qualquer serve: a pergunta acontece ANTES de o
   arquivo ser lido, que é o ponto — perguntar depois de ler seria perguntar
   depois de já ter feito metade do estrago. */
const proj = '/tmp/descarte-projeto.json';
fs.writeFileSync(proj, JSON.stringify({ formato: 1, frames: [] }));
await pg.setInputFiles('#reabrirArq', proj);
await pg.waitForTimeout(900);
ok('perguntou antes de abrir por cima', dialogos.length === 1, String(dialogos.length));
ok('e recusando, o trabalho continua na tela',
   (await pg.locator('#thumbs figure input.nota').first().inputValue()) === 'anotação nova');

await ctx.close();
await br.close();
srv.close();
try { fs.unlinkSync(proj); } catch (e) {}

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nDescarte: nada se perde sem perguntar.');
process.exit(falhas ? 1 : 0);

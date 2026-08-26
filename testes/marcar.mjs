/* MARCAR DEPOIS — e a marcação chega ao documento.
 *
 * O tester está dentro do sistema que testa, com as mãos ocupadas e a aba do
 * produto atrás da tela compartilhada. Marcar ali é caro, e às vezes
 * impossível. Mas a captura automática JÁ GUARDOU a tela: marcar não captura
 * nada — só diz QUAL delas abre um passo. Isso é opinião, e opinião se forma
 * melhor com a imagem grande na frente.
 *
 * Até aqui o `junto` só nascia na captura, pelo botão "mais uma tela deste
 * passo" da janelinha, e não havia como mudar de ideia depois. Quem não
 * conseguiu marcar durante o teste ficava com o agrupamento que o detector
 * adivinhou, sem apelação.
 *
 * O QUE ESTA RÉGUA COBRA, e a última é a que importa:
 *   - a tecla P alterna, e o rótulo diz o ESTADO e não a ação;
 *   - o primeiro quadro mantido não pode juntar-se a ninguém;
 *   - e o agrupamento CHEGA AO DOCUMENTO. Mexer num atributo que o gerador
 *     ignora seria um botão que faz de conta.
 *
 *   node testes/marcar.mjs
 */
import { chromium } from './_navegador.mjs';
import http from 'http'; import fs from 'fs';
import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';

const ROOT = `${RAIZ_WS}/public`;
const html = fs.readFileSync(ROOT + '/app.html', 'utf8');
const srv = http.createServer((q, r) => {
  const u = q.url.split('?')[0];
  if (u.startsWith('/_vercel/')) { r.writeHead(200,{'Content-Type':'text/javascript'}); return r.end('') }
  if (u === '/sw.js') { r.writeHead(200,{'Content-Type':'text/javascript'}); return r.end(fs.readFileSync(ROOT+'/sw.js')) }
  r.writeHead(200, {'Content-Type':'text/html'}); r.end(html);
});
await new Promise(r => srv.listen(8998, r));

let falhas = 0;
const ok = (n, c, e) => { console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : '')); if (!c) falhas++; };

if (!fs.existsSync('/tmp/amostra.webm')) {
  console.log('PULADO  falta /tmp/amostra.webm  (python3 testes/amostras.py)');
  srv.close(); process.exit(0);
}

const br = await chromium.launch({ executablePath: CHROME_WS });
const ctx = await br.newContext({ acceptDownloads: true, viewport: { width: 1250, height: 950 } });
const pg = await ctx.newPage();
const erros = []; pg.on('pageerror', e => erros.push(e.message));
await pg.goto('http://localhost:8998/app.html?lang=pt');
await pg.waitForTimeout(400);
await pg.selectOption('#modelo', 'evidencia').catch(() => {});
await pg.setInputFiles('#file', '/tmp/amostra.webm');
await pg.waitForFunction(() => (document.getElementById('v') || {}).videoWidth > 0, null, { timeout: 40000 });
await pg.selectOption('#mode', 'count'); await pg.fill('#count', '4');
await pg.locator('#extract').click();
await pg.waitForFunction(() => document.querySelectorAll('#thumbs figure').length >= 4, null, { timeout: 60000 });
await pg.waitForTimeout(600);

/* A lente abre pelo botão "Editar" da miniatura — e não por clique nela, que é
   o gesto de DESCARTAR. Confundir os dois numa régua é medir o descarte
   achando que se mediu a lente. */
const abrir = (n) => pg.evaluate((n) => {
  const fig = document.querySelectorAll('#thumbs figure')[n];
  const b = fig && fig.querySelector('.editar');
  if (b) b.click();
}, n);
const estado = () => pg.evaluate(() => {
  const q = (window.__quadros() || []).filter(f => f.keep);
  return { junto: q.map(f => !!f.junto), n: q.length };
});

console.log('[1] a tecla P alterna, e o rótulo diz o estado');
await abrir(1);
await pg.waitForTimeout(500);
ok('a lente abriu no segundo quadro',
   await pg.evaluate(() => !document.getElementById('lente').classList.contains('hide')));
{
  const antes = await estado();
  const rotAntes = (await pg.locator('#passoModo').textContent()).trim();
  await pg.keyboard.press('p'); await pg.waitForTimeout(400);
  const depois = await estado();
  const rotDepois = (await pg.locator('#passoModo').textContent()).trim();
  console.log(`     ${JSON.stringify(antes.junto)} "${rotAntes}"`);
  console.log(`     ${JSON.stringify(depois.junto)} "${rotDepois}"`);
  const virou = antes.junto[1] === false && depois.junto[1] === true;
  ok('o quadro passou a juntar-se ao anterior', virou,
     virou ? '' : JSON.stringify({ antes: antes.junto, depois: depois.junto }));
  /* Rótulo de AÇÃO num botão de duas posições é o que faz a pessoa apertar
     para descobrir o que ele estava fazendo. Aqui ele diz o estado. */
  const rotOk = rotAntes !== rotDepois && /junta/i.test(rotDepois);
  ok('e o rótulo acompanhou o estado', rotOk, rotOk ? '' : rotDepois);
  ok('nenhum quadro foi descartado nem criado', depois.n === antes.n,
     depois.n === antes.n ? '' : `${antes.n} → ${depois.n}`);
  await pg.keyboard.press('p'); await pg.waitForTimeout(400);
  const volta = await estado();
  ok('e P de novo desfaz', volta.junto[1] === false,
     volta.junto[1] === false ? '' : JSON.stringify(volta.junto));
}

console.log('\n[2] o primeiro quadro não tem a quem se juntar');
{
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
  await abrir(0); await pg.waitForTimeout(500);
  const b = pg.locator('#passoModo');
  const desligado = await b.isDisabled();
  ok('o botão está desligado nele', desligado);
  const motivo = await b.getAttribute('title') || '';
  ok('e ele diz por quê, em vez de só não responder', /primeiro/i.test(motivo),
     /primeiro/i.test(motivo) ? '' : (motivo || '(sem motivo)'));
  const antes = await estado();
  await pg.keyboard.press('p'); await pg.waitForTimeout(400);
  const depois = await estado();
  const parado = JSON.stringify(antes.junto) === JSON.stringify(depois.junto);
  ok('e a tecla também não o move', parado, parado ? '' : JSON.stringify(depois.junto));
}

console.log('\n[3] o agrupamento CHEGA AO DOCUMENTO');
{
  /* A afirmação que impede o botão de fazer de conta. Sem ela, mexer num
     atributo que o gerador ignora passaria em tudo acima. */
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
  const passos = () => pg.evaluate(() => {
    return [...document.querySelectorAll('#thumbs figure .passo')].map(e => e.textContent.trim());
  });
  const antes = await passos();
  await abrir(1); await pg.waitForTimeout(400);
  await pg.keyboard.press('p'); await pg.waitForTimeout(500);
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(400);
  const depois = await passos();
  console.log('     antes : ' + antes.join(' | '));
  console.log('     depois: ' + depois.join(' | '));
  const renumerou = JSON.stringify(antes) !== JSON.stringify(depois);
  ok('a numeração dos passos na grade mudou', renumerou,
     renumerou ? '' : 'a grade não renumerou');
  /* Quatro quadros, um deles juntado: sobram três passos. Se a renumeração
     fosse cosmética, o documento continuaria dizendo quatro. */
  const dl = pg.waitForEvent('download', { timeout: 90000 });
  await pg.locator('#html').click();
  await (await dl).saveAs('/tmp/marcar.html');
  const doc = fs.readFileSync('/tmp/marcar.html', 'utf8');
  const quantos = (doc.match(/class="passo"/g) || []).length;
  const secoes = (doc.match(/<section class="passo"/g) || []).length;
  console.log(`     o documento saiu com ${secoes || quantos} passo(s)`);
  const tres = (secoes || quantos) === 3;
  ok('e o documento saiu com três passos, e não quatro', tres,
     tres ? '' : String(secoes || quantos));
}

ok('sem erro de JavaScript', erros.length === 0, erros.join(' | ').slice(0, 200));
await br.close(); srv.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nMarcar depois: tudo passou.');
process.exit(falhas ? 1 : 0);

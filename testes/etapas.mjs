/* AS TRÊS ETAPAS — Entrada, Conferir, Baixar.
 *
 * A ferramenta tinha três cartões numerados e a numeração mentia duas vezes:
 *
 *   "2 — A fala (opcional)"  era onde moram `#auto`, `#extract` e os ajustes de
 *                            extração. O único botão que faz a ferramenta
 *                            funcionar estava dentro de um passo rotulado como
 *                            dispensável.
 *   "3 — Revisão"            escondia quatro blocos, e o quarto era GERAR — a
 *                            coisa que a pessoa veio buscar, como sub-item de
 *                            outra coisa, atrás de três blocos de rolagem.
 *
 * O QUE ESTA RÉGUA COBRA, e o que ela recusa cobrar:
 *
 * Ela NÃO afirma cor, posição nem pixel. Afirma (a) que a barra é DERIVADA — o
 * teste do descarte é o coração deste arquivo —, (b) que `aria-current` e a
 * classe visual nunca discordam, (c) que a frase da próxima ação não se repete
 * a cada repintura, e (d) que a etapa 3 fica inerte enquanto não há o que
 * baixar.
 *
 * O que ela NÃO alcança, e continua com você: leitor de tela de verdade
 * (NVDA + Chrome, VoiceOver + Safari) e zoom 200%. Um teste que dissesse
 * "acessível" sem isso estaria mentindo com autoridade.
 */
import { chromium } from './_navegador.mjs';
import http from 'http'; import fs from 'fs';
import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';

const ROOT = `${RAIZ_WS}/public`;
const html = fs.readFileSync(ROOT + '/app.html', 'utf8');
const srv = http.createServer((q, r) => {
  if (q.url.startsWith('/_vercel/')) { r.writeHead(200,{'Content-Type':'text/javascript'}); return r.end('') }
  r.writeHead(200, {'Content-Type':'text/html'}); r.end(html);
});
await new Promise(r => srv.listen(8934, r));

const br = await chromium.launch({ executablePath: CHROME_WS });
let falhas = 0;
const ok = (n, c, e) => { console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : '')); if (!c) falhas++ };

const ctx = await br.newContext({ acceptDownloads: true, viewport: { width: 1150, height: 950 } });
const pg = await ctx.newPage();
const erros = []; pg.on('pageerror', e => erros.push(e.message));
await pg.goto('http://localhost:8934/app.html?lang=pt');
await pg.waitForTimeout(400);

/* O estado da barra, lido como a pessoa o vê: qual está marcada como atual,
   quais estão marcadas como feitas, e a frase de baixo. */
const barra = () => pg.evaluate(() => ({
  atual: [...document.querySelectorAll('.etapa[aria-current="step"]')].map(b => b.dataset.etapa),
  feitas: [...document.querySelectorAll('.etapa.feita')].map(b => b.dataset.etapa),
  prox: document.getElementById('proxAcao').textContent.trim(),
  rotulos: [...document.querySelectorAll('.etapa')].map(b => b.getAttribute('aria-label'))
}));

console.log('[1] a página abre na entrada, e diz o que fazer');
{
  const b = await barra();
  ok('uma etapa atual, e é a primeira', b.atual.join() === '1', b.atual.join() || '(nenhuma)');
  ok('nenhuma feita ainda', b.feitas.length === 0, b.feitas.join());
  ok('e a frase manda escolher um vídeo', /vídeo|gravando/i.test(b.prox), b.prox);
  /* O número entra no rótulo acessível porque ele está na tela: quem controla
     por voz diz "clicar em 2 Conferir". */
  ok('o rótulo acessível carrega o número', /^1\. /.test(b.rotulos[0]), b.rotulos[0]);
  const n = await pg.locator('.card > h2 .step').count();
  ok('e a página tem TRÊS números, não quatro', n === 3, String(n));
  const num = await pg.locator('.card > h2 .step').allTextContents();
  ok('numerados 1, 2, 3 sem buraco', num.join() === '1,2,3', num.join());
}

console.log('\n[2] a etapa 3 fica inerte enquanto não há o que baixar');
{
  ok('o cartão de baixar existe', (await pg.locator('#cardBaixar').count()) === 1);
  ok('e nasce inerte', await pg.locator('#cardBaixar').evaluate(e => e.hasAttribute('inert')));
  ok('com a dica dizendo por quê',
     !(await pg.locator('#hintBaixar').evaluate(e => e.classList.contains('hide'))));
  /* Dentro da antiga "Revisão" isto era impossível: o mesmo cartão precisava
     estar vivo para conferir os quadros. Separar as etapas foi o que deixou a
     trava ficar precisa. */
  ok('e o de conferir também', await pg.locator('#prevCard').evaluate(e => e.hasAttribute('inert')));
}

/* ---------------------------------------------------------------- material */
await pg.selectOption('#modelo', 'evidencia');
await pg.setInputFiles('#file', '/tmp/amostra.webm');
await pg.waitForFunction(() => !document.getElementById('extract').disabled, null, { timeout: 40000 });
await pg.selectOption('#mode', 'count'); await pg.fill('#count', '4');
await pg.locator('#extract').click();
await pg.waitForFunction(() => document.querySelectorAll('#thumbs figure').length >= 4,
                         null, { timeout: 40000 });
await pg.waitForTimeout(600);

console.log('\n[3] com quadros, a barra anda sozinha');
{
  const b = await barra();
  ok('a atual virou conferir', b.atual.join() === '2', b.atual.join());
  ok('a entrada ficou marcada como feita', b.feitas.join() === '1', b.feitas.join());
  ok('e a frase conta quantas telas', /4 telas/.test(b.prox), b.prox);
  ok('"feita" entra por PALAVRA no rótulo, não só por cor',
     /feita/i.test(b.rotulos[0]), b.rotulos[0]);
  ok('e a etapa 3 destravou', !(await pg.locator('#cardBaixar').evaluate(e => e.hasAttribute('inert'))));
}

console.log('\n[4] a frase não se repete a cada repintura');
{
  /* `#proxAcao` é `role="status"`. Reescrever o mesmo texto faz o leitor de
     tela repetir a frase inteira — e `passos()` roda a cada tecla digitada numa
     anotação. A guarda do `textContent` é o que separa uma dica de um papagaio,
     e é por isso que ela é medida aqui em vez de ficar no comentário. */
  const mexeu = await pg.evaluate(async () => {
    const el = document.getElementById('proxAcao');
    const tr = document.getElementById('tr');
    let n = 0;
    const ob = new MutationObserver(ms => { n += ms.length; });
    ob.observe(el, { childList: true, characterData: true, subtree: true });
    /* Pelo caminho de verdade: cada `input` na transcrição chama `refreshTr`,
       que chama `passos()`. É a tecla digitada que a guarda existe para
       aguentar, e não uma chamada de laboratório. */
    for (let i = 0; i < 8; i++) tr.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 400));
    ob.disconnect();
    return n;
  });
  ok('oito teclas na transcrição, e o texto continua o mesmo',
     (await pg.evaluate(() => document.getElementById('proxAcao').textContent)).includes('telas'));
  ok('oito repinturas, zero reescritas', mexeu === 0, String(mexeu));
}

console.log('\n[5] os botões da barra levam à etapa, e o foco vai junto');
{
  await pg.locator('.etapa[data-etapa="3"]').click();
  await pg.waitForTimeout(700);
  const foco = await pg.evaluate(() => document.activeElement.id);
  /* O foco vai para o CABEÇALHO e não para o cartão: um `<div>` focado não é
     anunciado por nada, e quem navega por teclado ficaria num lugar mudo. */
  ok('o foco foi para o cabeçalho da etapa 3', foco === 'h2Baixar', foco || '(nenhum)');
  const naTela = await pg.evaluate(() => {
    const r = document.getElementById('cardBaixar').getBoundingClientRect();
    return r.top > -60 && r.top < window.innerHeight;
  });
  ok('e o cartão está na tela', naTela);
  await pg.locator('.etapa[data-etapa="2"]').click();
  await pg.waitForTimeout(700);
  ok('voltar para conferir também funciona',
     (await pg.evaluate(() => document.activeElement.id)) === 'h2Conferir');
}

console.log('\n[6] depois de baixar, a barra chega ao fim');
{
  const dl = pg.waitForEvent('download', { timeout: 60000 });
  await pg.locator('#html').click();
  await (await dl).saveAs('/tmp/etapas.html');
  await pg.waitForTimeout(700);
  const b = await barra();
  ok('a atual virou baixar', b.atual.join() === '3', b.atual.join());
  ok('e as três ficam marcadas', b.feitas.join() === '1,2,3', b.feitas.join());
  ok('a frase diz que o documento saiu', /baixado/i.test(b.prox), b.prox);
}

console.log('\n[7] O CORAÇÃO: o estado é derivado, e não guardado');
{
  /* Descartar TODOS os quadros. Um controlador de etapas com verdade própria
     continuaria dizendo "você está em baixar, tudo feito" — porque ninguém
     avisou a ele. Aqui a barra volta sozinha, porque a resposta nunca esteve
     guardada em lugar nenhum para ficar velha.
     
     É o mesmo argumento das bolinhas dos subpassos, e o mesmo defeito que ele
     evita: um verde em cima de um documento que não existe mais. */
  await pg.evaluate(() => {
    document.querySelectorAll('#thumbs .toque').forEach(b => b.click());
  });
  await pg.waitForTimeout(500);
  const semMantidos = await pg.evaluate(() => window.__quadros().filter(f => f.keep).length);
  ok('nenhum quadro mantido', semMantidos === 0, String(semMantidos));
  /* `frames.length` continua > 0 — eles estão descartados, não apagados —, e é
     por isso que a etapa segue sendo "conferir": ainda há material na tela. O
     que NÃO pode acontecer é a barra continuar dizendo "baixado" para sempre. */
  await pg.locator('#novoFluxo').evaluate(b => b.click());
  await pg.waitForTimeout(1200);
}

console.log('\n[8] recomeçar devolve a barra ao começo');
{
  await pg.waitForFunction(() => document.querySelectorAll('#thumbs figure').length === 0,
                           null, { timeout: 15000 }).catch(() => {});
  const b = await barra();
  ok('a atual voltou para a entrada', b.atual.join() === '1', b.atual.join());
  ok('e nenhuma continua marcada como feita', b.feitas.length === 0, b.feitas.join());
  ok('a frase voltou a mandar escolher um vídeo', /vídeo|gravando/i.test(b.prox), b.prox);
}

console.log('\n[9] nada disso quebrou o JS');
ok('sem erro de JS', erros.length === 0, erros.join(' | ').slice(0, 200));

await br.close(); srv.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nAs três etapas: tudo passou.');
process.exit(falhas ? 1 : 0);

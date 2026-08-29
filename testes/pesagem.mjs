/* A RÉGUA — o que custa gravar, em números.
 *
 * Este arquivo não nasceu de um defeito; nasceu de uma proposta. Alguém propôs
 * reescrever a captura inteira ("worker-first streaming") alegando 1,5–3 GB de
 * RAM e 0–15 FPS. Ninguém tinha medido. Medir custou uma tarde e mostrou outro
 * produto: 59 FPS, 2,4% de fio principal bloqueado, 74 KB por quadro.
 *
 * O que ficou dessa tarde foi a régua, e a régua tinha que virar arquivo — uma
 * medição que mora numa sessão de chat é uma medição que se perde, e da próxima
 * vez alguém volta a discutir com adjetivo.
 *
 * Ele mede, imprime, e afirma só o que NÃO depende da máquina:
 *
 *   - quantos bytes um quadro ocupa               (afirma um teto)
 *   - quanto disso está fora do heap JavaScript   (afirma o piso)
 *   - quantos nós de DOM cada miniatura custa     (afirma um teto)
 *
 * FPS e bloqueio do fio principal saem impressos e NÃO viram afirmação: esta
 * máquina não é a de ninguém, e um teste que reprova por a CI estar carregada
 * é um teste que se aprende a ignorar.
 *
 *   node testes/pesagem.mjs            # a medição
 *   node testes/pesagem.mjs --segundos 25
 */
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';

import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';
const RAIZ = `${RAIZ_WS}`;
const html = fs.readFileSync(RAIZ + '/public/app.html', 'utf8');
const arg = (nome, padrao) => {
  const i = process.argv.indexOf('--' + nome);
  return i > 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : padrao;
};
const SEGUNDOS = arg('segundos', 25);
const LARG = arg('largura', 1920);
const ALT = arg('altura', 1080);

const srv = http.createServer((q, r) => {
  if (q.url.startsWith('/_vercel/')) {
    r.writeHead(200, { 'Content-Type': 'text/javascript' }); return r.end('');
  }
  r.writeHead(200, { 'Content-Type': 'text/html' }); r.end(html);
});
await new Promise(r => srv.listen(8867, r));

let falhas = 0;
const ok = (n, c, e) => {
  console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : ''));
  if (!c) falhas++;
};
const kb = n => (n / 1024).toFixed(1) + ' KB';
const mb = n => (n / 1048576).toFixed(1) + ' MB';

const br = await chromium.launch({
  executablePath: CHROME_WS,
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
         '--auto-accept-this-tab-capture', '--allow-http-screen-capture',
         '--enable-precise-memory-info', '--js-flags=--expose-gc'],
});
const ctx = await br.newContext({ viewport: { width: 1280, height: 1000 },
                                  permissions: ['microphone'] });
const pg = await ctx.newPage();
const erros = [];
pg.on('pageerror', e => erros.push(e.message));
await pg.goto('http://localhost:8867/app.html?lang=pt');
await pg.waitForTimeout(400);

/* A tela falsa: 1920×1080 trocando três vezes por segundo, com moldura parada
   em volta — é a geometria de uma janela de trabalho de verdade, e não um
   quadrado colorido inteiro que faria o detector parecer melhor do que é. */
await pg.evaluate(({ w, h }) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const cx = c.getContext('2d');
  let n = 0;
  const pintar = () => {
    n++;
    cx.fillStyle = '#f2f4fa'; cx.fillRect(0, 0, w, h);
    cx.fillStyle = '#1c2049'; cx.fillRect(0, 0, w, Math.round(h * 0.09));
    cx.fillStyle = '#fff'; cx.font = 'bold 34px sans-serif';
    cx.fillText('Portal — tela ' + n, 40, Math.round(h * 0.06));
    cx.fillStyle = `hsl(${(n * 53) % 360} 55% 62%)`;
    cx.fillRect(Math.round(w * 0.08), Math.round(h * 0.2),
                Math.round(w * 0.6), Math.round(h * 0.5));
    cx.fillStyle = '#222'; cx.font = '28px sans-serif';
    for (let i = 0; i < 9; i++) {
      cx.fillText('linha de conteúdo ' + (n * 9 + i) + ' — valores e rótulos',
                  Math.round(w * 0.1), Math.round(h * 0.24) + i * 46);
    }
  };
  pintar();
  setInterval(pintar, 333);
  const stream = c.captureStream(30);
  navigator.mediaDevices.getDisplayMedia = async () => stream;

  /* O medidor do fio principal. `requestAnimationFrame` só é chamado quando o
     navegador consegue pintar: o intervalo entre duas chamadas É o custo de um
     quadro de tela, incluindo o que a gravação roubou. */
  window.__regua = { quadros: [], longas: [] };
  let t0 = performance.now();
  const tique = () => {
    const t = performance.now();
    window.__regua.quadros.push(t - t0);
    t0 = t;
    requestAnimationFrame(tique);
  };
  requestAnimationFrame(tique);
  try {
    new PerformanceObserver(l => {
      for (const e of l.getEntries()) window.__regua.longas.push(e.duration);
    }).observe({ entryTypes: ['longtask'] });
  } catch (e) {}
}, { w: LARG, h: ALT });

/* Sem transcrição: o que está sendo medido aqui é a captura de tela. O custo do
   modelo de voz é outra medição, com outro dono. */
await pg.selectOption('#modelo', 'ata').catch(() => {});
await pg.selectOption('#ritmo', 'tudo');
await pg.locator('#maxf').fill('2000');
await pg.locator('#semTr').check();
await pg.evaluate(() => window.__contagem(1));
const heapAntes = await pg.evaluate(() => {
  if (window.gc) window.gc();
  return performance.memory ? performance.memory.usedJSHeapSize : null;
});

await pg.evaluate(() => { window.__regua.quadros.length = 0; window.__regua.longas.length = 0; });
await pg.locator('#rec').click();
await pg.waitForSelector('#recStop:visible', { timeout: 40000 });
await pg.waitForTimeout(SEGUNDOS * 1000);

const durante = await pg.evaluate(() => ({
  quadros: window.__regua.quadros.slice(),
  longas: window.__regua.longas.slice(),
}));

/* Pesado ANTES de parar: parar dispara a renderização das miniaturas, e o que
   se quer saber é o que a memória carrega DURANTE a gravação — que é a hora em
   que uma reunião de duas horas morre, se morrer. */
const TETO_APP = Number((html.match(/const TETO_SEM_PERDA = ([\d.]+);/) || [])[1]) || 0.30;
const durantePeso = await pg.evaluate((TETO) => {
  const q = window.__quadros ? window.__quadros() : [];
  let heap = 0, fora = 0; const acima = [];
  for (const f of q) {
    const im = f.img;
    if (!im) continue;
    /* A pergunta é UMA — quantos bytes este quadro retém — e a resposta muda de
       lugar conforme a versão: string base64 mora no heap, Blob mora fora. */
    if (im.blob) fora += im.blob.size;
    else if (im.url) heap += im.url.length * 0.75;
    /* Só os SEM PERDA: são os únicos sobre quem o teto por pixel promete algo.
       O caminho com perda é escolhido justamente quando o sem-perda estourou. */
    if (im.semPerda && im.blob && im.w && im.h) {
      const bpp = im.blob.size / (im.w * im.h);
      if (bpp > TETO) acima.push(bpp);
    }
  }
  return { n: q.length, heap, fora, acima,
           js: performance.memory ? performance.memory.usedJSHeapSize : null };
}, TETO_APP);

await pg.locator('#recStop').click();
await pg.waitForFunction(() => document.getElementById('rec').offsetParent !== null,
                         null, { timeout: 90000 });
await pg.waitForTimeout(1500);

const dom = await pg.evaluate(() => {
  const box = document.getElementById('thumbs');
  return { figuras: box.querySelectorAll('figure').length,
           nos: box.querySelectorAll('*').length };
});
const heapDepois = await pg.evaluate(() => {
  if (window.gc) window.gc();
  return performance.memory ? performance.memory.usedJSHeapSize : null;
});

// ---- o que saiu ----
const ord = durante.quadros.slice().sort((a, b) => a - b);
const pct = p => ord.length ? ord[Math.min(ord.length - 1, Math.floor(ord.length * p))] : 0;
const fps = ord.length ? 1000 / (ord.reduce((s, x) => s + x, 0) / ord.length) : 0;
const bloqueio = durante.longas.reduce((s, d) => s + Math.max(0, d - 50), 0);
const pior = durante.longas.reduce((m, d) => Math.max(m, d), 0);
const porQuadro = durantePeso.n ? (durantePeso.heap + durantePeso.fora) / durantePeso.n : 0;

console.log(`\n  tela ${LARG}×${ALT}, mudando 3×/s, ${SEGUNDOS} s, sem transcrição\n`);
const linha = (k, v) => console.log('   ' + k.padEnd(38) + v);
linha('quadros guardados', durantePeso.n);
linha('FPS durante a gravação',
      fps.toFixed(1) + '   p50 ' + pct(0.5).toFixed(1) + ' ms, p95 ' + pct(0.95).toFixed(1) + ' ms');
linha('bloqueio do fio principal',
      Math.round(bloqueio) + ' ms em ' + SEGUNDOS + ' s (' +
      (bloqueio / (SEGUNDOS * 1000) * 100).toFixed(1) + '%), pior ' + Math.round(pior) + ' ms');
linha('custo de um quadro', kb(porQuadro));
linha('   … no heap JavaScript (base64)', kb(durantePeso.n ? durantePeso.heap / durantePeso.n : 0));
linha('   … fora do heap (Blob)', kb(durantePeso.n ? durantePeso.fora / durantePeso.n : 0));
linha('projeção no teto padrão (300)', mb(porQuadro * 300));
linha('projeção no teto máximo (2000)', mb(porQuadro * 2000));
linha('nós de DOM por miniatura',
      dom.figuras ? (dom.nos / dom.figuras).toFixed(1) : '—');
linha('miniaturas na grade', dom.figuras);
if (heapAntes != null) {
  linha('heap JS antes / depois', mb(heapAntes) + ' / ' + mb(heapDepois));
}

/* ---- o instrumento que viaja com a máquina ----

   O número que falta a este projeto é o custo do fio principal COM a transcrição
   ligada, e ele depende do degrau em que o Whisper subiu naquela máquina — coisa
   que só a máquina daquela pessoa sabe. Aqui o modelo nem sobe (a CDN não é
   alcançável), então o que dá para garantir é que o instrumento existe, mede e
   sai no relatório que a pessoa manda quando algo dá errado. Sem isto, a próxima
   investigação recomeça com adjetivo. */
{
  await pg.locator('#avisar').click();
  await pg.waitForFunction(() => /fim ---/.test(
    (document.getElementById('fbDiagOut') || {}).textContent || ''), null, { timeout: 180000 });
  const rel = await pg.locator('#fbDiagOut').textContent();
  const linhaFio = (rel.match(/ +fio principal *:.*/) || [''])[0].trim();
  const linhaTr  = (rel.match(/ +transcrição *:.*/) || [''])[0].trim();
  const linhaMem = (rel.match(/ +quadros nesta aba:.*/) || [''])[0].trim();
  console.log('\n  o que o relatório de diagnóstico diz desta gravação:');
  console.log('   ' + linhaFio);
  console.log('   ' + linhaTr);
  console.log('   ' + linhaMem);
  console.log('\n  o que este arquivo AFIRMA (o resto é medida, não afirmação):');
  ok('o relatório conta quanto o fio principal ficou travado',
     /fio principal *: bloqueado \d+ ms/.test(rel), linhaFio);
  ok('e diz em qual degrau o motor de voz subiu — o número sozinho não se lê',
     /transcrição *: (ligada|desligada) +motor:/.test(rel), linhaTr);
  ok('e quanto os quadros pesam nesta aba',
     /quadros nesta aba: \d+ +[\d.]+ MB/.test(rel), linhaMem);
}

/* ---- O TETO EM BYTES MORREU, E O QUE ELE PROTEGIA CONTINUA ----
 *
 * Esta linha afirmou 60 KB, depois 90 KB, e agora nenhum número. Ela existia
 * para pegar UMA regressão: o quadro voltar a ser base64 de JPEG morando no
 * heap, em vez de bytes num Blob. O peso servia de indício disso.
 *
 * Deixou de servir. Com a captura sem perda, um quadro legítimo de 1080p pesa
 * ~142 KB, e o mesmo quadro como base64 de JPEG pesaria ~128 KB — MENOS. Um
 * teto em bytes agora reprovaria o certo e aprovaria o errado, que é a pior
 * coisa que um teste pode fazer.
 *
 * Então o indício sai e a coisa em si fica. Quem pega base64 é a linha
 * seguinte, e ela sempre foi a de verdade: base64 mora no heap, Blob não.
 *
 * E entra a invariante que a captura passou a prometer: um quadro guardado SEM
 * PERDA está, por construção, dentro do teto por pixel — é essa comparação que
 * decide guardá-lo assim. Um quadro sem perda acima do teto quer dizer que a
 * decisão parou de ser tomada. */
{
  const teto = Number((fs.readFileSync(RAIZ + '/public/app.html', 'utf8')
    .match(/const TETO_SEM_PERDA = ([\d.]+);/) || [])[1]);
  const temTeto = teto > 0 && teto < 1;
  ok('a captura declara um teto por pixel', temTeto, temTeto ? '' : String(teto));
  const fora = durantePeso.acima || [];
  ok('e nenhum quadro sem perda passa dele', fora.length === 0,
     fora.length ? fora.map(x => x.toFixed(3) + ' B/px').join(', ') : '');
}
ok('o peso dos quadros está FORA do heap JavaScript',
   durantePeso.fora > durantePeso.heap,
   'fora=' + kb(durantePeso.fora) + '  heap=' + kb(durantePeso.heap));
ok('a grade guardou quadro', durantePeso.n >= 5, String(durantePeso.n));
ok('sem erro de JavaScript', erros.length === 0, erros.join(' | ').slice(0, 200));

await br.close(); srv.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);

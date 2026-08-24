/* A LARGURA DO QUADRO É A DA TELA.
 *
 * Nasceu de uma queixa de campo com uma frase só: "as imagens estão ruins".
 * A causa estava escrita em número redondo, quatro vezes, nos quatro caminhos
 * de captura: `snap(900, q)`. Toda tela virava 900 pixels de largura, viesse
 * ela de onde viesse.
 *
 * Isso errava nos DOIS sentidos, e o segundo é o que ninguém tinha visto:
 *
 *   - Para BAIXO. Uma tela de 1920 reduzida a 900 é uma redução de 2,1×, e o
 *     que reduz junto é a ALTURA DA LETRA: a fonte de 12 px de um sistema
 *     chega ao documento com 5,6 px. Uma evidência de auditoria em que não se
 *     lê o valor do campo não prova nada — é uma captura de tela que não
 *     mostra a tela.
 *   - Para CIMA. Uma gravação de 640×360 — celular, janela pequena, vídeo
 *     recebido de terceiro — era ESTICADA até 900. O produto inventava 40% de
 *     pixels que ninguém filmou, e o resultado é borrão com peso de arquivo.
 *     Um retrato de 480×854 virava 900×1601.
 *
 * A régua afirma uma coisa só, e ela não tem número dentro: o quadro tem a
 * medida da FONTE. Escrita assim, ela reprova tanto quem repuser um teto
 * quanto quem repuser um piso, e não precisa ser reescrita quando a fonte
 * mudar de tamanho — que é exatamente o defeito que ela existe para impedir.
 *
 * Três fontes de tamanhos deliberadamente diferentes, uma delas mais estreita
 * que os 900 antigos e uma delas em pé:
 *
 *     /tmp/amostra.webm      1280×720   (deitado, maior que 900)
 *     /tmp/so-relogio.webm    640×360   (deitado, MENOR que 900)
 *     /tmp/retrato.webm       480×854   (em pé)
 *
 *   node testes/nitidez.mjs
 */
import { chromium } from './_navegador.mjs';
import http from 'http'; import fs from 'fs';
import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';

const ROOT = `${RAIZ_WS}/public`;
const html = fs.readFileSync(ROOT + '/app.html', 'utf8');
const srv = http.createServer((q, r) => {
  const u = q.url.split('?')[0];
  if (u.startsWith('/_vercel/')) { r.writeHead(200, {'Content-Type':'text/javascript'}); return r.end('') }
  r.writeHead(200, {'Content-Type':'text/html'}); r.end(html);
});
await new Promise(r => srv.listen(8948, r));

let falhas = 0;
const ok = (n, c, e) => { console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : '')); if (!c) falhas++; };

const AMOSTRAS = [
  { arq: '/tmp/amostra.webm',     rotulo: 'deitado, maior que os 900 antigos' },
  { arq: '/tmp/so-relogio.webm',  rotulo: 'deitado, MENOR que os 900 antigos' },
  { arq: '/tmp/retrato.webm',     rotulo: 'em pé' },
];
const faltando = AMOSTRAS.filter(a => !fs.existsSync(a.arq)).map(a => a.arq);
if (faltando.length) {
  console.log('PULADO  faltam as amostras: ' + faltando.join(', ') +
              '  (python3 testes/amostras.py)');
  srv.close(); process.exit(0);
}

const br = await chromium.launch({ executablePath: CHROME_WS });
const ctx = await br.newContext({ viewport: { width: 1250, height: 900 } });
const pg = await ctx.newPage();
const erros = []; pg.on('pageerror', e => erros.push(e.message));

console.log('[1] o quadro tem a medida da fonte — seja ela qual for');
for (const a of AMOSTRAS) {
  await pg.goto('http://localhost:8948/app.html?lang=pt');
  await pg.waitForTimeout(300);
  // o cenário de uso é obrigatório: sem ele o envio de vídeo cobra a escolha
  await pg.selectOption('#modelo', 'ia').catch(() => {});
  await pg.setInputFiles('#file', a.arq);
  await pg.waitForFunction(() => (document.getElementById('v') || {}).videoWidth > 0,
                           null, { timeout: 40000 });
  await pg.selectOption('#mode', 'count'); await pg.fill('#count', '3');
  await pg.locator('#extract').click();
  await pg.waitForFunction(() => document.querySelectorAll('#thumbs figure').length >= 3,
                           null, { timeout: 60000 });
  await pg.waitForTimeout(500);

  const m = await pg.evaluate(async () => {
    const v = document.getElementById('v');
    const qs = (window.__quadros() || []).filter(f => f.img);
    for (const f of qs) await f.img.pronta;
    return {
      fonte: [v.videoWidth, v.videoHeight],
      quadros: qs.map(f => [f.img.w, f.img.h]),
      bytes: Math.round(qs.reduce((s, f) => s + (f.img.blob ? f.img.blob.size : 0), 0) / qs.length),
    };
  });
  const [fw, fh] = m.fonte;
  const todosIguais = m.quadros.length > 0 &&
        m.quadros.every(([w, h]) => w === fw && h === fh);
  console.log(`  ${a.arq}  (${a.rotulo})`);
  console.log(`     fonte ${fw}×${fh}   quadros ${m.quadros.map(q => q.join('×')).join(' ')}` +
              `   ~${(m.bytes/1024).toFixed(1)} KB cada`);
  ok(`${fw}×${fh}: o quadro sai com a medida da fonte`, todosIguais,
     todosIguais ? '' : JSON.stringify(m.quadros));
  /* A metade que o "igual à fonte" já garante, dita em voz alta porque é a
     queixa: nenhum quadro de 900. Se alguém repuser a constante, esta linha
     é a que nomeia o culpado na saída. */
  const semNoventa = m.quadros.every(([w]) => w !== 900);
  ok(`${fw}×${fh}: e nenhum quadro com os 900 de antes`, semNoventa,
     semNoventa ? '' : JSON.stringify(m.quadros));
}

console.log('\n[2] a tela COLADA também guarda a medida dela');
{
  /* Aqui morava a mesma constante, com uma justificativa escrita ao lado que a
     mudança inverteu: "senão sairia com outra escala no documento". O PDF, o
     Word e o PPTX posicionam a imagem pela PROPORÇÃO, nunca pela largura — com
     a captura em nativo, encolher só a colada era a única coisa capaz de criar
     a diferença de escala que a justificativa dizia evitar. */
  const b64 = await pg.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 1600; c.height = 900;
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, 1600, 900);
    g.fillStyle = '#123'; g.font = '20px sans-serif';
    for (let i = 0; i < 20; i++) g.fillText('linha de sistema ' + i + ' — 1234,56', 40, 60 + i * 34);
    return c.toDataURL('image/png').split(',')[1];
  });
  await pg.setInputFiles('#addArq', {
    name: 'print.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
  await pg.waitForTimeout(1200);
  const colada = await pg.evaluate(async () => {
    const q = (window.__quadros() || []).filter(f => f.colado);
    for (const f of q) await f.img.pronta;
    return q.map(f => [f.img.w, f.img.h]);
  });
  ok('a tela colada entra com 1600×900, e não com 900×506',
     colada.length === 1 && colada[0][0] === 1600 && colada[0][1] === 900,
     JSON.stringify(colada));
}

console.log('\n[3] o seletor de qualidade continua sendo a COMPRESSÃO');
{
  /* A largura deixou de ser o botão de tamanho — então o botão de tamanho
     precisa continuar sendo um botão. Duas extrações da mesma fonte, mesma
     largura, qualidades opostas: os pixels são os mesmos e os bytes não. */
  const medir = async (q) => {
    await pg.goto('http://localhost:8948/app.html?lang=pt');
    await pg.waitForTimeout(300);
    await pg.selectOption('#modelo', 'ia').catch(() => {});
    await pg.setInputFiles('#file', '/tmp/amostra.webm');
    await pg.waitForFunction(() => (document.getElementById('v') || {}).videoWidth > 0,
                             null, { timeout: 40000 });
    await pg.selectOption('#quality', q).catch(() => {});
    await pg.evaluate(v => {
      const s = document.getElementById('quality');
      s.value = v; s.dispatchEvent(new Event('change', { bubbles: true }));
    }, q);
    await pg.selectOption('#mode', 'count'); await pg.fill('#count', '3');
    await pg.locator('#extract').click();
    await pg.waitForFunction(() => document.querySelectorAll('#thumbs figure').length >= 3,
                             null, { timeout: 60000 });
    await pg.waitForTimeout(400);
    return pg.evaluate(async () => {
      const qs = (window.__quadros() || []).filter(f => f.img);
      for (const f of qs) await f.img.pronta;
      return { larg: qs[0].img.w,
               bytes: qs.reduce((s, f) => s + (f.img.blob ? f.img.blob.size : 0), 0) };
    });
  };
  const opts = await pg.evaluate(() =>
    [...document.querySelectorAll('#quality option')].map(o => o.value));
  const baixa = opts[0], alta = opts[opts.length - 1];
  const a = await medir(baixa), b = await medir(alta);
  console.log(`     qualidade ${baixa}: ${a.larg}px  ${(a.bytes/1024).toFixed(1)} KB` +
              `   |   qualidade ${alta}: ${b.larg}px  ${(b.bytes/1024).toFixed(1)} KB`);
  ok('a qualidade não mexe mais na largura', a.larg === b.larg,
     a.larg === b.larg ? '' : `${a.larg} vs ${b.larg}`);
  ok('mas continua mexendo nos bytes', a.bytes !== b.bytes,
     a.bytes !== b.bytes ? '' : `${a.bytes} vs ${b.bytes}`);
}

console.log('\n[4] e nenhum caminho de captura carrega largura escrita à mão');
{
  const fonte = fs.readFileSync(ROOT + '/app.html', 'utf8');
  /* `snap(0, …)` é a forma de dizer "a largura da fonte". Qualquer outro
     número no primeiro argumento é a constante voltando. */
  const chamadas = [...fonte.matchAll(/\bsnap\(\s*([A-Za-z0-9_$]+)\s*,/g)].map(m => m[1]);
  const fixas = chamadas.filter(c => /^\d+$/.test(c) && c !== '0');
  const limpas = chamadas.length >= 4 && fixas.length === 0;
  ok('nenhuma chamada de captura passa largura fixa', limpas,
     limpas ? '' : `largura fixa em snap(${fixas.join('), snap(')})`);
  ok('e a largura nativa vem do vídeo, não de uma constante',
     /function larguraNativa\(\)\{ return video\.videoWidth/.test(fonte));
}

ok('sem erro de JavaScript', erros.length === 0, erros.join(' | ').slice(0, 200));

await br.close(); srv.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nA largura do quadro é a da tela: tudo passou.');
process.exit(falhas ? 1 : 0);

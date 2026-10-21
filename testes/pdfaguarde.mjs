/* O AGUARDE DO PDF — o que a pessoa vê enquanto ele é montado.
 *
 * O relato: "quando baixa em PDF, não dá para entender que está montando o
 * PDF". Medido, eram três buracos, e esta régua cobra os três:
 *
 *   1. O botão clicado não mudava. Para a evidência o clique é no botão
 *      RECOMENDADO, que aperta o `#go` de verdade — e o `#go` mora na gaveta
 *      fechada. O recomendado continuava dizendo "Gerar PDF", aceso.
 *   2. A frase era uma só do primeiro ao último segundo.
 *   3. A montagem das páginas é síncrona: nada era repintado até o fim.
 *
 * O TERCEIRO É O QUE SE PROVA AQUI, e de um jeito que não depende de olhar
 * pixel: a amostragem é um `setInterval` DENTRO da página. Ele só dispara
 * quando a montagem devolve a vez ao navegador. Se a montagem não respirasse,
 * a amostragem veria o antes e o depois, e nenhum "quadro 12 de 40" no meio —
 * que é exatamente o que a pessoa via.
 *
 *   node testes/pdfaguarde.mjs
 */
/* O Chromium DAQUI, que abre a gaveta das saídas: o `#go` tem que existir com
   caixa para o recomendado poder apertá-lo como a pessoa aperta. */
import { chromium } from './_navegador.mjs';
import http from 'http'; import fs from 'fs'; import path from 'path';
import { execFileSync } from 'child_process';
import { CHROME_WS } from './_caminhos.mjs';
import { garantirPortaLivre } from './_porta.mjs';

const PORTA = 8884;
const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const app = fs.readFileSync(RAIZ + '/public/app.html', 'utf8');
const LIB = fs.readFileSync(RAIZ + '/public/jspdf.umd.min.js');
let falhas = 0;
const ok = (n, c, e) => { console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : '')); if (!c) falhas++; };

/* As frases do próprio dicionário, e não escritas aqui: uma régua que
   procurasse "quadro 12 de 40" escrito à mão aprovaria a frase que ela
   imagina, e não a que o produto pinta. */
const dic = (chave) => {
  const i = app.indexOf('\n    pt: {');
  const m = i < 0 ? null : app.slice(i, i + 95000).match(new RegExp(chave + ":'([^']*)'"));
  return m ? m[1] : '';
};
const GERAR = dic('pdfBtn'), MONTANDO = dic('pdfBuilding'), SALVA = dic('pdfSalva');
const QUADRO = new RegExp('^' + dic('pdfQuadro').replace(/[.*+?^${}()|[\]\\—]/g, (c) =>
  c === '{' || c === '}' ? c : '\\' + c).replace(/\\?\{0\\?\}|\{0\}/, '(\\d+)')
  .replace(/\\?\{1\\?\}|\{1\}/, '(\\d+)') + '$');

console.log('\n[1] as frases existem, e a da contagem diz em qual quadro está');
ok('o botão tem o nome de sempre', GERAR === 'Gerar PDF', GERAR);
ok('a frase de trabalhando existe', /^Montando o PDF/.test(MONTANDO), MONTANDO);
ok('e a da contagem tem os dois números', /\{0\}.*\{1\}/.test(dic('pdfQuadro')), dic('pdfQuadro'));
ok('e a do salvar avisa que demora', /segundos/.test(SALVA), SALVA);

await garantirPortaLivre(PORTA, 'pdfaguarde.mjs');
const srv = http.createServer((q, r) => {
  const u = q.url.split('?')[0];
  if (u.startsWith('/_vercel/') || u === '/sw.js') {
    r.writeHead(200, { 'Content-Type': 'text/javascript' }); return r.end('');
  }
  /* A biblioteca DE CASA, e de verdade: esta régua mede a montagem, e uma
     montagem falsa não teria o tempo que a pessoa espera. */
  if (u === '/jspdf.umd.min.js') {
    r.writeHead(200, { 'Content-Type': 'text/javascript' }); return r.end(LIB);
  }
  r.writeHead(200, { 'Content-Type': 'text/html' }); r.end(app);
});
await new Promise((r) => srv.listen(PORTA, r));

const br = await chromium.launch({ executablePath: CHROME_WS,
  args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await br.newContext({ viewport: { width: 1280, height: 1000 }, acceptDownloads: true });
await ctx.addInitScript(() => {
  const c = document.createElement('canvas');
  c.width = 1280; c.height = 720;
  const g = c.getContext('2d'); let i = 0;
  setInterval(() => { i++;
    g.fillStyle = `hsl(${(i * 47) % 360} 70% 40%)`; g.fillRect(0, 0, 1280, 720);
    g.fillStyle = '#fff'; g.font = '140px sans-serif'; g.fillText(String(i), 60, 300);
  }, 2200);
  navigator.mediaDevices.getDisplayMedia = async () => c.captureStream(12);
  navigator.mediaDevices.getUserMedia = async () => { throw new Error('sem mic'); };
  try { delete window.documentPictureInPicture; } catch (e) {}
});
const pg = await ctx.newPage();
const erros = []; pg.on('pageerror', (e) => erros.push(e.message));
pg.on('dialog', (d) => d.accept());
await pg.goto(`http://localhost:${PORTA}/app.html?lang=pt`);
await pg.selectOption('#modelo', 'evidencia').catch(() => {});
await pg.locator('#semTr').check();
await pg.evaluate(() => window.__contagem(1));
await pg.locator('#rec').click();
await pg.waitForSelector('#recStop:visible', { timeout: 40000 });
await pg.waitForTimeout(7000);
await pg.locator('#recStop').click({ force: true });
await pg.waitForFunction(() => document.querySelectorAll('#thumbs figure').length > 0,
                         null, { timeout: 60000 });

/* QUARENTA QUADROS, e não os três de uma gravação de sete segundos. Com três
   a montagem inteira cabe em menos de um respiro, e "não vi a contagem no
   meio" seria verdade por falta de meio. As cópias são dos quadros de
   verdade — mesma imagem, mesma estrutura —, com a hora andando. */
const N = await pg.evaluate(() => {
  const fr = window.__quadros();
  const base = fr.slice();
  while (fr.length < 40) {
    const o = base[fr.length % base.length];
    fr.push(Object.assign({}, o, { t: fr[fr.length - 1].t + 0.6, manual: false }));
  }
  return fr.filter((f) => f.keep).length;
});
ok('a evidência de teste tem quarenta quadros', N >= 40, String(N));

/* A AMOSTRAGEM, de dentro da página. Ela é a prova do respiro: um intervalo
   de 15ms que não dispara durante a montagem é uma tela que não é pintada. */
const amostrar = () => pg.evaluate(() => {
  window.__am = [];
  const ler = () => {
    const p = document.getElementById('recPrim'), st = document.getElementById('pdfStatus');
    const w = document.getElementById('pdfBarWrap'), b = document.getElementById('pdfBar');
    const fx = document.getElementById('faixa');
    window.__am.push({
      prim: (p.textContent || '').trim(), primOff: p.disabled,
      primListra: p.classList.contains('montando'),
      go: (document.getElementById('go').textContent || '').trim(),
      st: (st.textContent || '').trim(),
      barra: !!w && !w.classList.contains('hide'), larg: b ? b.style.width : '',
      faixa: !!fx && !fx.classList.contains('hide'),
      faixaTxt: ((document.getElementById('faixaTxt') || {}).textContent || '').trim(),
    });
  };
  ler();
  window.__amTic = setInterval(ler, 15);
});
const parar = () => pg.evaluate(() => { clearInterval(window.__amTic); return window.__am; });

const rodada = async (rotulo) => {
  await amostrar();
  const baixou = pg.waitForEvent('download', { timeout: 120000 });
  await pg.locator('#recPrim').click();
  const dl = await baixou;
  await pg.waitForFunction(() => /PDF gerado/.test(document.getElementById('pdfStatus').textContent),
                           null, { timeout: 60000 }).catch(() => {});
  await pg.waitForTimeout(150);
  const am = await parar();
  const arq = path.join('/tmp', 'pdfaguarde-' + rotulo + '.pdf');
  await dl.saveAs(arq);
  return { am, arq, nome: dl.suggestedFilename() };
};

console.log('\n[2] o botão recomendado é o que a pessoa aperta, e é ele que tem que mudar');
ok('para a evidência, o recomendado é o PDF',
   await pg.evaluate(() => document.getElementById('recPrim').dataset.alvo === 'go'));
const r1 = await rodada('pagina');
const durante = r1.am.filter((a) => a.prim.startsWith(MONTANDO));
ok('durante a montagem ele diz "Montando o PDF…"', durante.length > 0,
   `${durante.length} de ${r1.am.length} amostras`);
ok('  desligado e listrado, e não apagado', durante.length > 0 &&
   durante.every((a) => a.primOff && a.primListra));
ok('  com a porcentagem andando', new Set(durante.map((a) => a.prim)).size >= 3,
   [...new Set(durante.map((a) => a.prim))].slice(0, 6).join(' | '));
ok('  e o botão de verdade, na gaveta, diz o mesmo', durante.every((a) => a.go === a.prim));

console.log('\n[3] a frase diz onde está, e muda enquanto a montagem anda');
const contagens = [...new Set(r1.am.map((a) => a.st).filter((s) => QUADRO.test(s)))];
ok('a contagem de quadros apareceu NO MEIO da montagem', contagens.length >= 2,
   contagens.slice(0, 5).join(' | ') || '(nenhuma — a montagem não respirou)');
const nums = contagens.map((s) => +s.match(QUADRO)[1]);
ok('  e ela só anda para a frente', nums.every((n, i) => !i || n > nums[i - 1]), nums.join(','));
ok('  e o total é o da evidência', contagens.every((s) => +s.match(QUADRO)[2] === N));
ok('a preparação também se anuncia', r1.am.some((a) => a.st === dic('pdfPrepara')));
ok('e o salvar, que é o trecho mais longo, avisa antes', r1.am.some((a) => a.st === SALVA));
/* A BARRA: visível durante, com largura, e nunca para trás. */
const larguras = r1.am.filter((a) => a.barra && a.larg).map((a) => parseInt(a.larg, 10));
ok('a barra aparece e enche', larguras.length >= 2 && Math.max(...larguras) >= 90,
   larguras.slice(-4).join(','));
ok('  sem nunca voltar', larguras.every((w, i) => !i || w >= larguras[i - 1]));
/* A faixa do rodapé é para quem rolou a página. Ela mostra a MESMA frase —
   um segundo texto seria uma segunda verdade para manter. */
const comFaixa = r1.am.filter((a) => a.faixa && QUADRO.test(a.st));
ok('a faixa do rodapé acompanha, com a mesma frase', comFaixa.length > 0 &&
   comFaixa.every((a) => a.faixaTxt === a.st), comFaixa.length ? comFaixa[0].faixaTxt : '(não apareceu)');

console.log('\n[4] e no fim tudo volta a ser o que era');
const fim = r1.am[r1.am.length - 1];
ok('o recomendado volta a se chamar "Gerar PDF", aceso e sem listras',
   fim.prim === GERAR && !fim.primOff && !fim.primListra, JSON.stringify(fim).slice(0, 140));
ok('  e o de verdade também', fim.go === GERAR);
ok('a barra sai, e a faixa junto', !fim.barra && !fim.faixa);
ok('e a frase diz que terminou', /PDF gerado/.test(fim.st), fim.st);
const cabeca = fs.readFileSync(r1.arq).subarray(0, 5).toString();
ok('o arquivo baixado é um PDF', cabeca === '%PDF-' && /\.pdf$/.test(r1.nome), `${cabeca} ${r1.nome}`);
/* As páginas contadas pelo poppler, e não pelo nosso contador: é o leitor de
   PDF de outra pessoa que diz se o arquivo abre. */
const paginas = (arq) => {
  try { return +(/Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [arq]).toString()) || [])[1]; }
  catch (e) { return -1; }
};
/* E AS FIGURAS desenhadas, uma por quadro. `pdfimages` lista cada imagem com
   a máscara dela; contam só as linhas de imagem. Um laço que pulasse um
   quadro — ou que terminasse depois do `save` — daria menos que quarenta. */
const figuras = (arq) => {
  try { return execFileSync('pdfimages', ['-list', arq]).toString().split('\n')
          .filter((l) => /^\s*\d+\s+\d+\s+image\s/.test(l)).length; }
  catch (e) { return -1; }
};
/* O número de páginas que o produto diz na frase final é o que o poppler
   conta? A frase é o que a pessoa lê; o arquivo é o que ela entrega. */
const ditas = (am) => +((am[am.length - 1].st.match(/(\d+) páginas/) || [])[1] || -1);
const p1 = paginas(r1.arq), f1 = figuras(r1.arq);
ok('  e abre fora daqui, com as páginas que a frase diz', p1 > 0 && p1 === ditas(r1.am),
   `poppler ${p1}, frase ${ditas(r1.am)}`);
ok('  e com uma figura por quadro', f1 === N, `${f1} de ${N}`);

console.log('\n[5] na grade também — o laço dela virou outro laço');
{
  /* O LAÇO DA GRADE ERA UM `forEach`, e `await` dentro de `forEach` não
     espera nada: cada volta viraria uma promessa solta, e os quadros sairiam
     fora de ordem ou depois do `save`. Ele virou `for`. Esta rodada prova
     que o PDF em grade continua inteiro. */
  await pg.evaluate(() => {
    const s = document.getElementById('layout');
    s.value = 'grid'; s.dispatchEvent(new Event('change', { bubbles: true }));
  });
  const r2 = await rodada('grade');
  const c2 = [...new Set(r2.am.map((a) => a.st).filter((s) => QUADRO.test(s)))];
  ok('a contagem aparece na grade também', c2.length >= 1, c2.slice(0, 3).join(' | ') || '(nenhuma)');
  const p2 = paginas(r2.arq), f2 = figuras(r2.arq);
  ok('e o PDF em grade abre, mais curto que o de página cheia',
     p2 > 0 && p2 < p1 && p2 === ditas(r2.am), `${p2} páginas (página cheia: ${p1})`);
  ok('  com as quarenta figuras, nenhuma perdida pelo laço novo', f2 === N, `${f2} de ${N}`);
  const fim2 = r2.am[r2.am.length - 1];
  ok('  e o botão volta ao normal de novo', fim2.prim === GERAR && !fim2.primOff);
}

console.log('\n[6] nenhum erro de página no caminho');
ok('sem erro de página', erros.length === 0, erros.slice(0, 3).join(' | '));

await br.close(); srv.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nO aguarde do PDF: tudo passou.');
process.exit(falhas ? 1 : 0);

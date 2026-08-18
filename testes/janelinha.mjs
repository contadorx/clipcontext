/* A janelinha de controle: o tamanho dela.
 *
 * Ela fica POR CIMA da tela que está sendo gravada. Cada pixel dela é um pixel
 * a menos do trabalho que a pessoa está documentando — e ainda aparece nos
 * quadros capturados. Então o tamanho não é gosto: é o custo dela.
 *
 * O `documentPictureInPicture` não existe no navegador de teste, então o que se
 * faz aqui é montar o MESMO CSS e o MESMO corpo que o produto monta, numa
 * página do tamanho exato que ele pede, e medir se o conteúdo cabe. É o CSS do
 * produto, lido do arquivo gerado — não uma réplica escrita à mão.
 */
import { chromium } from 'playwright';
import fs from 'fs';

const app = fs.readFileSync('/root/walkstamp/public/app.html', 'utf8');
let falhas = 0;
const ok = (n, c, e) => { console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : '')); if (!c) falhas++; };

/* O tamanho pedido, o CSS e o corpo, tirados do próprio arquivo. */
const med = app.match(/requestWindow\(\{ width: (\d+), height: (\d+) \}\)/);
ok('a janelinha declara um tamanho', !!med, med ? med[0] : '(não achei)');
const [LARG, ALT] = med ? [ +med[1], +med[2] ] : [258, 282];

const css = app.slice(app.indexOf('const PIP_CSS = `') + 17).split('`;')[0];
ok('o CSS dela foi encontrado', css.length > 400, String(css.length));

/* O corpo: as linhas de `d.body.innerHTML = ...` concatenadas. */
const corpoSrc = app.slice(app.indexOf('d.body.innerHTML ='));
const corpo = (corpoSrc.slice(0, corpoSrc.indexOf(';\n')).match(/'([^']*)'/g) || [])
  .map((x) => x.slice(1, -1)).join('');
ok('e o corpo também', /class="top"/.test(corpo) && /id="stop"/.test(corpo), corpo.slice(0, 60));

const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const pg = await (await br.newContext({ viewport: { width: LARG, height: ALT } })).newPage();
await pg.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head>` +
                    `<body>${corpo}</body></html>`);
await pg.waitForTimeout(200);

const medir = () => pg.evaluate(() => ({
  precisa: document.body.scrollHeight, cabe: document.documentElement.clientHeight,
  vaza: [...document.querySelectorAll('body *')]
    .filter((e) => e.getBoundingClientRect().bottom > innerHeight + 1)
    .map((e) => e.tagName + (e.id ? '#' + e.id : '')).slice(0, 4),
}));

console.log(`\n[1] gravando: cabe em ${LARG}×${ALT}`);
{
  /* Os rótulos são preenchidos pelo JavaScript do produto; aqui eles entram com
     um texto de tamanho realista, que é o que decide se cabe. */
  await pg.evaluate(() => {
    document.body.classList.add('gravando');
    document.querySelector('.txt').textContent = 'Gravando… clique em Parar quando terminar.';
    for (const [id, txt] of [['marcar','Marcar este passo'],['pausa','Pausar'],['stop','Parar']]) {
      const b = document.getElementById(id); if (b) { b.textContent = txt; b.disabled = false; }
    }
    const n = document.getElementById('pipNota');
    if (n) { n.disabled = false; n.placeholder = 'o que aconteceu aqui'; }
  });
  await pg.waitForTimeout(150);
  const m = await medir();
  ok('o conteúdo cabe na altura pedida', m.precisa <= m.cabe + 1, `${m.precisa} de ${m.cabe}`);
  ok('e nada fica para fora', m.vaza.length === 0, m.vaza.join(' '));
  ok('a janela não é maior que a de antes (258×282)', LARG <= 258 && ALT <= 282, `${LARG}×${ALT}`);

  /* O botão de calar nasce escondido, e `.hide` mora no CSS da ABA — a
     janelinha é outro documento. Sem a regra lá dentro ele aparecia como uma
     caixa vazia de 28px: um botão que não faz nada, ocupando tela da pessoa. */
  ok('e o botão escondido está mesmo escondido',
     await pg.evaluate(() => document.getElementById('calar').offsetParent === null));
  const sobra = await pg.evaluate(() => document.body.scrollHeight);
  ok('sem folga desperdiçada nem estouro', Math.abs(sobra - ALT) <= 12, `${sobra} para ${ALT}`);
}

console.log('\n[2] contando: só o número, e ele é grande');
{
  await pg.evaluate(() => {
    document.body.classList.add('contando');
    const t = document.querySelector('.txt');
    t.classList.add('contando'); t.textContent = '3';
  });
  await pg.waitForTimeout(150);
  const m = await medir();
  const n = await pg.evaluate(() => {
    const t = document.querySelector('.txt');
    return { fs: parseFloat(getComputedStyle(t).fontSize), h: t.getBoundingClientRect().height };
  });
  ok('o número é enorme', n.fs >= 56, String(n.fs));
  ok('e mesmo assim cabe', m.precisa <= m.cabe + 1, `${m.precisa} de ${m.cabe}`);
  const escondidos = await pg.evaluate(() => ['.top', '.vus', '.pe', '#pipNota', '#marcar', '#pausa']
    .filter((s) => { const e = document.querySelector(s); return e && e.offsetParent !== null; }));
  ok('e o resto some — é o que deixa o número ser enorme sem a janela crescer',
     escondidos.length === 0, escondidos.join(' '));
  ok('menos o Parar, que vale desde o primeiro segundo',
     await pg.evaluate(() => document.getElementById('stop').offsetParent !== null));
}

await br.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nJanelinha de controle: tudo passou.');
process.exit(falhas ? 1 : 0);

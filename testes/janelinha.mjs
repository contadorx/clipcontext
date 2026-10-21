/* A janelinha de controle: as duas que existem, e o tamanho delas.
 *
 * Ela fica POR CIMA da tela que está sendo gravada. Cada pixel dela é um pixel
 * a menos do trabalho que a pessoa está documentando — e ainda aparece nos
 * quadros capturados. Então o tamanho não é gosto: é o custo dela.
 *
 * ---- O QUE MUDOU NO BUILD 68, E POR QUE ESTA RÉGUA FOI REESCRITA ----
 *
 * Eram três janelas: a completa (uma pilha de 250×470), a fita (uma linha de
 * 560) e a mínima. O pedido: "são três telas, vamos racionalizar — na telinha
 * pequena coloque o botão parar, e faça uma junção entre a tela grande e a
 * tira, no menor formato possível". Ficaram duas, e as duas são a mesma fita:
 *
 *   - a JANELA: três fileiras estreitas — relógio, pausar, microfone, parar e
 *     o tamanho; marcar, mais tela, erro e apontar; e o passo do roteiro (ou a
 *     contagem de quadros) com a fileira de baixo inteira;
 *   - a MÍNIMA: ponto, marcar, apontar, parar e o tamanho.
 *
 * Esta régua media a completa em quatro blocos. A completa não existe mais, e
 * uma régua que mede um desenho que ninguém vê é verde sobre nada — os blocos
 * saíram, e o que eles cobravam e ainda vale (atalhos, nomes, desenhos, cores)
 * foi trazido para cá.
 *
 * ---- E O TAMANHO PASSOU A SER MEDIDO PELO PRODUTO, ANTES DE ABRIR ----
 *
 * A fita era pedida larga e encolhida por `resizeTo`. No Chromium 141 de
 * verdade o `resizeTo` de uma janela de picture-in-picture só é aceito logo
 * depois de um clique dentro dela: o encolher nunca funcionou na tela de
 * ninguém. Agora o produto monta a janela escondida na aba, mede, e pede já do
 * tamanho certo. Esta régua chama A MESMA função (`__medirJanelinha`) e depois
 * confere, num documento daquele tamanho, que nada fica para fora.
 *
 *   node testes/janelinha.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs'; import http from 'http';

import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';
const app = fs.readFileSync(`${RAIZ_WS}/public/app.html`, 'utf8');
let falhas = 0;
const ok = (n, c, e) => { console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : '')); if (!c) falhas++; };

/* O CSS e o corpo, tirados do arquivo gerado — não uma réplica escrita à mão. */
const css = app.slice(app.indexOf('const PIP_CSS = `') + 17).split('`;')[0];
ok('o CSS da janelinha foi encontrado', css.length > 400, String(css.length));
const corpoSrc = app.slice(app.indexOf('function corpoDaJanelinha()'));
const corpo = (corpoSrc.slice(0, corpoSrc.indexOf(';\n')).match(/'([^']*)'/g) || [])
  .map((x) => x.slice(1, -1)).join('');
ok('e o corpo também', /class="top"/.test(corpo) && /id="stop"/.test(corpo), corpo.slice(0, 60));

/* As reservas, para quando a medida falhar. Elas têm que caber no idioma mais
   comprido — senão a reserva é uma janela onde o alemão não cabe. */
const res = app.match(/const TAM_PIP = \{ w: (\d+), h: (\d+) \};/);
const resMin = app.match(/const TAM_PIP_MICRO = \{ w: (\d+), h: (\d+) \};/);
ok('a janela e a mínima declaram uma reserva', !!res && !!resMin,
   `${res && res.slice(1).join('×')}  ${resMin && resMin.slice(1).join('×')}`);
const [RW, RH] = res ? [+res[1], +res[2]] : [380, 104];
const [MW, MH] = resMin ? [+resMin[1], +resMin[2]] : [240, 52];

/* Os rótulos do DICIONÁRIO do app, em cada idioma: uma janela medida com
   palavras inventadas é uma janela de outro produto. */
const dic = (L, chave) => {
  const i = app.indexOf(`\n    ${L}: {`);
  if (i < 0) return '';
  const m = app.slice(i, i + 95000).match(new RegExp(chave + ":'([^']*)'"));
  return m ? m[1] : '';
};
/* id do botão → [chave curta, chave longa], como o `rotularPip` pinta. */
const ROTULOS = { marcar: ['pipCurtoMarcar', 'recMarkBtn'], maisTela: ['pipCurtoTela', 'recTelaBtn'],
                  erro: ['pipCurtoErro', 'recErroBtn'], anotar: ['pipCurtoAnotar', 'pipAnotar'],
                  pausa: ['pipCurtoPausa', 'recPauseBtn'], calar: ['pipCurtoCalar', 'micMudo'],
                  stop: ['pipCurtoParar', 'pipStop'] };
const IDIOMAS = ['pt', 'en', 'es', 'de', 'fr'];

/* O produto de verdade, para chamar a medida dele. */
const PORTA = 8886;
const srv = http.createServer((q, r) => {
  const u = q.url.split('?')[0];
  if (u.startsWith('/_vercel/') || u === '/sw.js') {
    r.writeHead(200, { 'Content-Type': 'text/javascript' }); return r.end('');
  }
  r.writeHead(200, { 'Content-Type': 'text/html' }); r.end(app);
});
await new Promise((r) => srv.listen(PORTA, r));
const br = await chromium.launch({ executablePath: CHROME_WS });
const pApp = await br.newPage();
const erros = []; pApp.on('pageerror', (e) => erros.push(e.message));
const MEDIDA = {};
for (const L of IDIOMAS) {
  await pApp.goto(`http://localhost:${PORTA}/app.html?lang=${L}`);
  await pApp.waitForTimeout(150);
  MEDIDA[L] = await pApp.evaluate(() => window.__medirJanelinha
    ? { min: window.__medirJanelinha('min'), micro: window.__medirJanelinha('micro') } : null);
}

/* Um documento do tamanho que o produto pediria, com o corpo e o CSS dele, e
   os rótulos que ele pinta. */
const pg = await (await br.newContext({ viewport: { width: 400, height: 200 } })).newPage();
const montar = async (L, classe, tam) => {
  await pg.setViewportSize({ width: tam.w, height: tam.h });
  await pg.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head>` +
                      `<body>${corpo}</body></html>`);
  await pg.evaluate(({ classe, rot }) => {
    document.body.className = classe;
    for (const [id, [curto, longo]] of Object.entries(rot)) {
      const b = document.getElementById(id);
      if (b) { b.textContent = curto; b.setAttribute('aria-label', longo); b.title = longo; b.disabled = false; }
    }
    /* O MICROFONE ACESO: ele só existe para quem grava com microfone — que é
       o caso que este produto vende — e é a fileira dele que cresce. */
    document.getElementById('calar').classList.remove('hide');
    document.getElementById('rel').textContent = '12:34';
    document.getElementById('txt').textContent = '14 quadros · 3 marcados';
  }, { classe, rot: Object.fromEntries(Object.entries(ROTULOS)
         .map(([id, [c, l]]) => [id, [dic(L, c), dic(L, l)]])) });
  await pg.waitForTimeout(60);
};
/* O que fica para fora da janela — pela direita ou por baixo. */
const fora = () => pg.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => {
  const s = getComputedStyle(e);
  if (s.display === 'none' || e.getBoundingClientRect().width === 0) return false;
  const q = e.getBoundingClientRect();
  return q.right > innerWidth + 1 || q.bottom > innerHeight + 1;
}).map((e) => e.id || e.className || e.tagName));
/* A fileira de cada elemento: o CENTRO vertical arredondado. O topo não
   serve — o relógio é mais baixo que um botão e fica centrado na fileira, e
   pelo topo ele pareceria estar em outra. */
const fileiras = () => pg.evaluate(() => {
  const vis = (e) => e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0;
  const meio = (e) => { const q = e.getBoundingClientRect(); return Math.round(q.top + q.height / 2); };
  const f = {};
  for (const id of ['marcar', 'maisTela', 'erro', 'anotar', 'pausa', 'calar', 'stop', 'tam', 'txt', 'rot']) {
    const e = document.getElementById(id);
    f[id] = vis(e) ? meio(e) : null;
  }
  const t = document.querySelector('.top');
  f.relogio = vis(t) ? meio(t) : null;
  return f;
});
const mesma = (ys) => ys.every((y) => y != null && Math.abs(y - ys[0]) <= 4);

console.log('\n[1] o tamanho é medido pelo produto, antes de abrir');
{
  ok('a medida do produto responde nos cinco idiomas',
     IDIOMAS.every((L) => MEDIDA[L] && MEDIDA[L].min && MEDIDA[L].micro),
     JSON.stringify(MEDIDA).slice(0, 160));
  ok('o pedido usa a medida, e a reserva só se ela falhar',
     /medirJanelinha\(pipModo\(\)\) \|\|/.test(app));
  /* O ENCOLHER DEPOIS DE ABRIR SAIU, e não pode voltar: o Chrome recusa o
     `resizeTo` sem clique dentro da janelinha. Uma volta dele seria o mesmo
     verde sobre nada de antes. */
  ok('e ninguém mais tenta encolher a janela depois de aberta',
     !/function encolherFita/.test(app) && !/encolherFita\(\)/.test(app));
  /* Sobra UM `resizeTo`, o do editor: ele também é recusado pelo Chrome, mas
     é ele que agenda a medida do que veio para o diagnóstico. Um segundo —
     no roteiro, numa troca de idioma — seria a volta do encolher. */
  const resizes = (app.match(/\.resizeTo\(/g) || []).length;
  ok('nem crescer quando o roteiro chega: sobra só o do editor', resizes === 1, `${resizes} chamadas`);
}

console.log('\n[2] a janela: três fileiras estreitas, nos cinco idiomas');
{
  /* A LARGURA DE CADA IDIOMA, ESCRITA. Medida em 21/10, no Build 68, com
     DejaVu Sans (o `preparar.sh` avisa quando a fonte é outra). Não é para
     congelar o desenho: é para que crescer apareça no diff, com nome e idioma,
     em vez de aparecer no relato de quem usa. */
  const LARGURA = { pt: 294, en: 288, es: 322, de: 360, fr: 322 };
  const ALTURA = 100;
  const FOLGA = 12;
  for (const L of IDIOMAS) {
    const tam = MEDIDA[L] && MEDIDA[L].min;
    if (!tam) { ok(`${L}: medida`, false, '(sem medida)'); continue; }
    await montar(L, 'min gravando', tam);
    const vaza = await fora();
    const f = await fileiras();
    const bate = Math.abs(tam.w - LARGURA[L]) <= FOLGA && Math.abs(tam.h - ALTURA) <= 6;
    ok(`${L}: ${tam.w}×${tam.h}, e nada fica para fora`, bate && vaza.length === 0,
       (bate ? '' : `escrito ${LARGURA[L]}×${ALTURA}; `) + (vaza.length ? 'para fora: ' + vaza.join(' ') : ''));
    if (L === 'pt' || L === 'de') {
      /* AS FILEIRAS DEPOIS DO RELATO "o passo na parte de baixo que sobra":
         os comandos da gravação junto do relógio, os gestos de captura no
         meio, e o passo (ou a contagem) com a fileira de baixo inteira. */
      const linha1 = ['relogio', 'pausa', 'calar', 'stop', 'tam'].map((i) => f[i]);
      const linha2 = ['marcar', 'maisTela', 'erro', 'anotar'].map((i) => f[i]);
      ok(`  ${L}: relógio, pausar, microfone, parar e tamanho na primeira fileira`, mesma(linha1),
         JSON.stringify(f));
      ok(`  ${L}: marcar, mais tela, erro e apontar na segunda`, mesma(linha2) && linha2[0] > linha1[0]);
      ok(`  ${L}: e a contagem de quadros na de baixo`, f.txt != null && f.txt > linha2[0] + 10);
    }
  }
  /* A RESERVA tem que caber no idioma mais comprido, e ser estreita. */
  const maior = Math.max(...IDIOMAS.map((L) => (MEDIDA[L] && MEDIDA[L].min.w) || 0));
  ok('a reserva cobre o idioma mais largo', RW >= maior && RH >= ALTURA, `${RW}×${RH} para ${maior}`);
  /* "O MENOR FORMATO POSSÍVEL": três fileiras, e não uma pilha. 110 é três
     fileiras de 32 com o respiro; passou disso, alguém empilhou uma quarta. */
  ok('e ela continua sendo três fileiras, e não uma pilha', ALTURA <= 110 && maior <= 380,
     `${maior}×${ALTURA}`);

  /* O DETALHE DOS COMANDOS, medido em português. */
  await montar('pt', 'min gravando', MEDIDA.pt.min);
  const baixo = await pg.evaluate(() => {
    const r = (id) => document.getElementById(id).getBoundingClientRect();
    const cs = getComputedStyle(document.body);
    const icone = (id) => {
      const m = getComputedStyle(document.getElementById(id), '::before');
      return /svg/i.test(m.maskImage || m.webkitMaskImage || '');
    };
    return {
      tamNoCanto: Math.abs(innerWidth - parseFloat(cs.paddingRight) - r('tam').right) <= 2,
      pausaSoDesenho: parseFloat(getComputedStyle(document.getElementById('pausa')).fontSize) === 0 &&
                      r('pausa').width <= 34 && icone('pausa'),
      calarSoDesenho: parseFloat(getComputedStyle(document.getElementById('calar')).fontSize) === 0 &&
                      r('calar').width <= 34 && icone('calar'),
      pararTemPalavra: parseFloat(getComputedStyle(document.getElementById('stop')).fontSize) >= 9,
      alvos: ['marcar', 'maisTela', 'erro', 'anotar', 'pausa', 'calar', 'stop', 'tam']
        .every((i) => r(i).width >= 28 && r(i).height >= 28),
    };
  });
  ok('o tamanho fecha a fileira de cima, no canto direito', baixo.tamNoCanto);
  ok('pausar e microfone são só desenho, como o pedido', baixo.pausaSoDesenho && baixo.calarSoDesenho,
     JSON.stringify(baixo));
  ok('o parar continua com a palavra — é o irreversível', baixo.pararTemPalavra);
  ok('e todo alvo se acerta sem mirar', baixo.alvos);
  ok('o medidor de som e a caixa de anotação ficaram de fora, como escolhido',
     await pg.evaluate(() => ['.vus', '.notaCx'].every((s) => getComputedStyle(document.querySelector(s)).display === 'none')));
  ok('e o botão escondido está mesmo escondido',
     await pg.evaluate(() => {
       const c = document.getElementById('calar');
       c.classList.add('hide');
       const escondido = c.offsetParent === null;
       c.classList.remove('hide');
       return escondido;
     }));
}

console.log('\n[3] com roteiro colado: o passo entra na primeira fileira, na mesma altura');
{
  /* O roteiro não muda o tamanho: o passo mora na primeira fileira, no lugar
     da contagem de quadros. Medido no pior caso que ele aceita — uma frase
     inteira —, ele corta com reticências e não empurra nada. */
  for (const L of ['pt', 'de']) {
    await montar(L, 'min gravando comRoteiro', MEDIDA[L].min);
    await pg.evaluate(() => {
      document.getElementById('rot').classList.remove('hide');
      document.getElementById('rotN').textContent = '3/12';
      document.getElementById('rotT').textContent =
        'Abrir a ME21N e conferir se o campo de centro de custo aceita o valor colado da planilha anterior';
    });
    const vaza = await fora();
    const r = await pg.evaluate(() => {
      const t = document.getElementById('rotT'), rot = document.getElementById('rot');
      const m = document.getElementById('marcar').getBoundingClientRect();
      const q = rot.getBoundingClientRect();
      return { corta: t.scrollWidth > t.clientWidth,
               embaixo: q.top >= m.bottom - 1,
               largura: Math.round(q.width), janela: innerWidth,
               contagem: getComputedStyle(document.getElementById('txt')).display };
    });
    ok(`${L}: nada fica para fora, com o passo mais comprido`, vaza.length === 0, vaza.join(' '));
    /* A FILEIRA DE BAIXO INTEIRA: era o pedido, e é o que dá ao passo o
       triplo do texto que caberia no vão ao lado do parar. */
    ok(`  ${L}: o passo fica embaixo, com a fileira inteira, e corta com reticências`,
       r.embaixo && r.largura >= r.janela * 0.85 && r.corta, JSON.stringify(r));
    ok(`  ${L}: e a contagem de quadros sai, para o passo ter o lugar`, r.contagem === 'none');
  }
}

console.log('\n[4] a mínima: ponto, marcar, apontar, parar e o tamanho');
{
  /* O PEDIDO, em dois tempos: "uma janela muito minúscula, com somente o
     botão marcar" (Build 67) e "na telinha pequena coloque o botão parar"
     (Build 68). */
  ok('o botão de tamanho alterna entre as duas, e só entre elas',
     /min:\s+\['micro', 'pipVirarMinima'\]/.test(app) &&
     /micro: \['min',\s+'pipVirarJanela'\]/.test(app) && !/completa: \[/.test(app));
  ok('quem tinha guardado a completa ou a fita abre na janela',
     /localStorage\.getItem\(PIP_MODO_CHAVE\) === 'micro' \? 'micro' : 'min'/.test(app));
  ok('a mínima abre com a classe dela', /d\.body\.classList\.add\('micro'\)/.test(app));
  const larguras = {};
  for (const L of IDIOMAS) {
    const tam = MEDIDA[L].micro;
    larguras[L] = tam.w;
    await montar(L, 'min micro gravando', tam);
    const r = await pg.evaluate(() => {
      const vis = (id) => { const e = document.getElementById(id);
        return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0; };
      const ve = {}; for (const i of ['marcar', 'anotar', 'stop', 'tam', 'maisTela', 'erro', 'pausa', 'calar', 'rel', 'txt']) ve[i] = vis(i);
      const icone = (id) => { const m = getComputedStyle(document.getElementById(id), '::before');
                              return /url\(/.test(m.maskImage || m.webkitMaskImage || ''); };
      const q = (id) => document.getElementById(id).getBoundingClientRect();
      return { ve, icones: icone('marcar') && icone('anotar') && icone('stop'),
               nomes: ['marcar', 'anotar', 'stop'].every((i) =>
                 (document.getElementById(i).getAttribute('aria-label') || '').length > 2 &&
                 (document.getElementById(i).textContent || '').trim().length > 0),
               pararLonge: q('stop').left - q('marcar').right > 40,
               ponto: getComputedStyle(document.querySelector('.dot')).animationName };
    });
    const vaza = await fora();
    if (L === 'pt') {
      ok('na tela ficam marcar, apontar, PARAR e o tamanho — e só eles',
         r.ve.marcar && r.ve.anotar && r.ve.stop && r.ve.tam &&
         !r.ve.maisTela && !r.ve.erro && !r.ve.pausa && !r.ve.calar && !r.ve.rel && !r.ve.txt,
         JSON.stringify(r.ve));
      ok('  e o ponto, que pisca', r.ponto === 'pulsa', r.ponto);
      ok('os três são desenho, e a palavra fica para o leitor de tela', r.icones && r.nomes);
      ok('o parar fica longe do marcar, que se aperta quarenta vezes', r.pararLonge);
    }
    ok(`  ${L}: ${tam.w}×${tam.h}, e nada fica para fora`, vaza.length === 0, vaza.join(' '));
  }
  const ls = Object.values(larguras);
  ok('só desenho quer dizer a mesma largura nos cinco idiomas', Math.max(...ls) - Math.min(...ls) <= 1,
     JSON.stringify(larguras));
  /* O MÍNIMO DO CHROME, medido no Chromium 141: 240×52 de conteúdo. A mínima
     mede menos e vem com 240 — a reserva já é o tamanho que ela tem de fato. */
  ok('a reserva da mínima é o mínimo do Chrome, e cobre a medida',
     MW === 240 && MH === 52 && Math.max(...ls) <= MW, `${MW}×${MH} para ${Math.max(...ls)}`);

  /* ANTES DE GRAVAR: a frase volta, os botões saem, o ponto para e fica cinza. */
  await montar('pt', 'min micro', { w: MW, h: MH });
  const antes = await pg.evaluate(() => {
    const t = document.getElementById('txt'); t.textContent = 'Preparando…';
    const vis = (id) => getComputedStyle(document.getElementById(id)).display !== 'none';
    const d = getComputedStyle(document.querySelector('.dot'));
    return { texto: vis('txt'), larg: Math.round(t.getBoundingClientRect().width),
             marcar: vis('marcar'), anotar: vis('anotar'), stop: vis('stop'),
             pisca: d.animationName, cor: d.backgroundColor };
  });
  ok('antes de gravar, a frase aparece e tem onde caber', antes.texto && antes.larg >= 120, `${antes.larg}px`);
  ok('  e os botões apagados saem da frente', !antes.marcar && !antes.anotar && !antes.stop);
  ok('  e o ponto fica parado e cinza', antes.pisca === 'none' && !/239, 132, 132/.test(antes.cor));

  /* O desenho do tamanho diz para onde ele leva: da janela, encolher; da
     mínima, crescer. */
  const setas = await pg.evaluate(() => {
    const m = () => { const s2 = getComputedStyle(document.getElementById('tam'), '::before');
                      return s2.maskImage || s2.webkitMaskImage; };
    document.body.className = 'min gravando'; const jan = m();
    document.body.className = 'min micro gravando'; const mic = m();
    return { jan, mic };
  });
  ok('o desenho do tamanho: encolher na janela, crescer na mínima',
     setas.jan !== setas.mic && /url\(/.test(setas.mic));
}

console.log('\n[5] contando: o número aparece, grande, e o parar continua');
{
  for (const [modo, classe, tam, px] of [['janela', 'min contando', MEDIDA.pt.min, 24],
                                         ['mínima', 'min micro contando', MEDIDA.pt.micro, 20]]) {
    await montar('pt', classe, tam);
    const r = await pg.evaluate(() => {
      const t = document.getElementById('txt'); t.textContent = '3'; t.classList.add('contando');
      const vis = (s) => { const e = document.querySelector(s);
        return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0; };
      const st = getComputedStyle(document.getElementById('stop'), '::before');
      return { numero: vis('#txt'), px: parseFloat(getComputedStyle(t).fontSize),
               parar: vis('#stop'), desenhoDoParar: st.display !== 'none',
               escondidos: ['#marcar', '#anotar', '#pausa', '.top'].filter(vis) };
    });
    const vaza = await fora();
    ok(`${modo}: o número aparece, com ${px}px ou mais`, r.numero && r.px >= px, `${r.px}px`);
    ok(`  ${modo}: o parar vale desde o primeiro segundo`, r.parar);
    ok(`  ${modo}: o resto sai`, r.escondidos.length === 0, r.escondidos.join(' '));
    ok(`  ${modo}: e nada fica para fora`, vaza.length === 0, vaza.join(' '));
    if (modo === 'mínima') {
      /* Na mínima o parar é só desenho, e a regra da contagem escondia o
         desenho dele: sobrava um quadrado vermelho vazio. */
      ok('  mínima: o parar mostra o desenho dele na contagem', r.desenhoDoParar);
    }
  }
}

console.log('\n[6] a hierarquia dos botões, que é lida de relance');
{
  await montar('pt', 'min gravando', MEDIDA.pt.min);
  const b = await pg.evaluate(() => {
    const g = (id) => { const e = document.getElementById(id), cs = getComputedStyle(e);
      return { fundo: cs.backgroundColor, cor: cs.color }; };
    return { marcar: g('marcar'), maisTela: g('maisTela'), anotar: g('anotar'),
             erro: g('erro'), stop: g('stop'), pausa: g('pausa') };
  });
  /* MARCAR É O ACESO: entre botões iguais, o que se aperta quarenta vezes é
     achado sem procurar. Mais tela e apontar são da família, e mais claros. */
  const azul = (c) => /rgba?\(\s*1[01]\d\s*,\s*1[12]\d\s*,\s*2[34]\d/.test(c);
  ok('marcar é o azul cheio', azul(b.marcar.fundo), b.marcar.fundo);
  ok('mais tela e apontar são da família, e não o azul cheio',
     b.maisTela.fundo !== b.marcar.fundo && b.anotar.fundo !== b.marcar.fundo &&
     (azul(b.maisTela.fundo) || azul(b.maisTela.cor)), b.maisTela.fundo);
  const vermelho = (c) => { const m = c.match(/\d+/g) || []; return +m[0] > 170 && +m[1] < 80 && +m[2] < 80; };
  ok('erro e parar são vermelhos — os dois que se apertam com pressa',
     vermelho(b.erro.fundo) && vermelho(b.stop.fundo), `${b.erro.fundo} / ${b.stop.fundo}`);
  ok('e o pausar fica fora das duas famílias', !azul(b.pausa.fundo) && !vermelho(b.pausa.fundo), b.pausa.fundo);
  /* O desenho vem da cor do próprio texto: pausado, ele fica vermelho junto. */
  ok('o desenho toma a cor do texto do botão',
     await pg.evaluate(() => {
       const e = document.getElementById('pausa');
       const c1 = getComputedStyle(e, '::before').backgroundColor;
       e.classList.add('off');
       const c2 = getComputedStyle(e, '::before').backgroundColor;
       e.classList.remove('off');
       return c1 !== c2;
     }));
  /* Pausado ele oferece o oposto, e o desenho vira a seta — o nome também
     virou "Retomar". Duas barras num botão que retoma mentem. */
  ok('pausado, o desenho vira a seta de retomar',
     await pg.evaluate(() => {
       const e = document.getElementById('pausa');
       const antes = getComputedStyle(e, '::before').maskImage;
       e.classList.add('off');
       const depois = getComputedStyle(e, '::before').maskImage;
       e.classList.remove('off');
       return antes !== depois;
     }));
}

console.log('\n[7] a palavra curta é para os olhos; o nome é a frase inteira');
{
  /* ---- OS ATALHOS DA JANELINHA ----
     Atalho global não existe para uma página — sem foco, o navegador não
     entrega tecla. Mas a janelinha É uma janela, recebe foco com um clique e
     fica sempre por cima: a partir daí a mão fica no teclado em vez de mirar
     um alvo de 32px quarenta vezes por sessão. */
  ok('a janelinha escuta o teclado', /pipWin\.document\.addEventListener\('keydown'/.test(app));
  ok('e ignora quem está digitando num campo',
     /alvo\.tagName === 'INPUT' \|\| alvo\.tagName === 'TEXTAREA'/.test(app));
  for (const [letra, alvo] of [["'m'", 'pipMarcar'], ["'t'", 'pipTela'], ["'p'", 'pipPausa'],
                               ["'s'", 'pipFrames'], ["'e'", 'pipErro'], ["'a'", 'pipAnotar']]) {
    ok(`  ${letra} aciona ${alvo}`,
       new RegExp("k === " + letra + "\\) apertar\\(" + alvo).test(app));
  }
  ok('e o m da aba continua sendo o mesmo gesto', /k === 'm' && liveOn/.test(app));
  ok('a letra aparece no nome do botão, senão ninguém a descobre',
     /btn\.title = longo \+ \(letra \? '  \(' \+ letra \+ '\)' : ''\)/.test(app));
  ok('os botões são rotulados por uma função só', /function rotularPip\(btn, chaveLonga, chaveCurta\)/.test(app));
  ok('o texto visível é sempre o curto: as duas janelas são fita', /btn\.textContent = curto;/.test(app));
  ok('e o nome acessível é sempre a frase inteira, sem a letra',
     /btn\.setAttribute\('aria-label', longo\)/.test(app) && /btn\.title = longo \+/.test(app));
  ok('o botão de tamanho tem nome, porque ele é só desenho',
     /btn\.setAttribute\('aria-label', t\(vira\)\)/.test(app) &&
     /const vira = CICLO_PIP\[pipModo\(\)\]\[1\]/.test(app));
  /* OS NOMES NASCEM COM A JANELA: antes de gravar ela já tem o tamanho dos
     botões rotulados, e um botão vazio ali é uma pílula sem palavra. */
  ok('e os nomes são pintados na abertura, e não só gravando',
     /rotularPip\(pipMarcar, 'recMarkBtn', 'pipCurtoMarcar'\);\n\s+rotularPip\(d\.getElementById\('erro'\)/.test(app));
  for (const chave of ['pipCurtoMarcar', 'pipCurtoTela', 'pipCurtoParar', 'pipCurtoErro',
                       'pipCurtoAnotar', 'pipCurtoPausa', 'pipVirarJanela', 'pipVirarMinima']) {
    const n = (app.match(new RegExp(chave + ":'", 'g')) || []).length;
    ok(`  ${chave}: existe nos cinco idiomas`, n === 5, n === 5 ? '' : String(n));
  }
  ok('e os nomes dos tamanhos que acabaram não sobraram',
     !/pipVirarFita:|pipVirarCompleta:/.test(app));
}

console.log('\n[8] o nome do segundo botão, nos cinco idiomas');
{
  /* "Mais uma tela deste passo" virou "Tela adicional a este passo" — e um nome
     que muda em um idioma só é a forma mais barata de o produto passar a dizer
     duas coisas diferentes. */
  const ESPERADO = {
    pt: 'Tela adicional a este passo',
    en: 'Additional screen for this step',
    es: 'Pantalla adicional de este paso',
    de: 'Zusätzlicher Bildschirm zu diesem Schritt',
    fr: 'Écran supplémentaire pour cette étape',
  };
  for (const [L, txt] of Object.entries(ESPERADO)) {
    const achou = app.includes(`recTelaBtn:'${txt}'`);
    ok(`${L}: ${txt}`, achou, achou ? '' : '(não achei)');
  }
  ok('e o nome antigo não sobrou em lugar nenhum',
     !/recTelaBtn:'[^']*(ais uma tela|ne more screen|na pantalla más|och ein Bildschirm|e plus pour)/
       .test(app));
}

console.log('\n[9] nenhum erro de página ao medir');
ok('sem erro de página', erros.length === 0, erros.slice(0, 2).join(' | '));

await br.close(); srv.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nJanelinha de controle: tudo passou.');
process.exit(falhas ? 1 : 0);

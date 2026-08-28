/* A ACESSIBILIDADE DA FERRAMENTA, MEDIDA — que nunca tinha sido.
 *
 * O site tem régua de a11y há tempos. O `app.html` não tinha nenhuma, e a fila
 * dizia isso com todas as letras: "a acessibilidade da ferramenta nunca foi
 * medida". Para um produto de evidência de auditoria vendido a empresa grande,
 * é a pergunta que aparece no questionário do cliente.
 *
 * O QUE FOI ACHADO, medindo antes de consertar: 231 controles na superfície
 * inteira, e **quatro** sem nome acessível — `recAutoMin`, `compPara`,
 * `compQuem` e `cmpMistura`. Foco visível: 39 de 39. Contraste: nenhum abaixo
 * do mínimo. Um `h1`, sem salto de nível, sem `id` repetido, sem `label for`
 * órfão, nenhuma imagem sem `alt`. A ferramenta estava bem — e ninguém sabia,
 * que é uma forma pior de estar bem.
 *
 * ---- POR QUE ELA MEDE SÓ O QUE ESTÁ VISÍVEL ----
 *
 * A primeira versão revelava tudo (`.hide` fora, `<details>` abertos) e
 * acusava 23 controles sem nome. Dezenove eram FALSO POSITIVO: o texto deles é
 * pintado por JavaScript quando a seção entra em cena, e revelar a seção não
 * pinta nada. Uma régua que acusa dezenove defeitos inexistentes ensina a
 * ignorá-la, e aí ela não serve para os quatro verdadeiros.
 *
 * Visível é a linha certa: um controle visível JÁ FOI PINTADO. O preço é que
 * ela só cobra os estados que consegue dirigir — e por isso ela dirige três.
 *
 *   node testes/nomes-a11y.mjs
 */
import fs from 'fs';
import http from 'http';
import { chromium } from './_navegador.mjs';
import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';

let falhas = 0;
const ok = (n, c, e) => { console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : '')); if (!c) falhas++; };

const APP = fs.readFileSync(`${RAIZ_WS}/public/app.html`, 'utf8');
const srv = http.createServer((q, r) => {
  if (q.url.split('?')[0].startsWith('/_vercel/')) {
    r.writeHead(200, { 'Content-Type': 'text/javascript' }); return r.end('');
  }
  r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); r.end(APP);
});
await new Promise((r) => srv.listen(8897, r));
const br = await chromium.launch({ executablePath: CHROME_WS });

/* O nome acessível como o leitor de tela o monta, na ordem em que ele monta.
   O `placeholder` entra por ÚLTIMO e com ressalva: ele desaparece quando a
   pessoa digita, então serve de nome só na falta de tudo — é por isso que os
   dois campos do compartilhar ganharam `aria-label` mesmo já tendo um. */
const NOME = `(e) => (e.getAttribute('aria-label') ||
   (e.getAttribute('aria-labelledby') ? (document.getElementById(e.getAttribute('aria-labelledby'))||{}).textContent : '') ||
   (e.labels && e.labels.length ? [...e.labels].map((l) => l.textContent).join(' ') : '') ||
   e.textContent || e.getAttribute('title') || e.getAttribute('placeholder') || '').trim()`;

async function abrir(lang = 'pt') {
  const ctx = await br.newContext({ viewport: { width: 1280, height: 900 } });
  const pg = await ctx.newPage();
  await pg.route('**/rpc/*stamp_*', (r) => r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, body: 'null' }));
  await pg.goto(`http://localhost:8897/app.html?lang=${lang}`);
  await pg.waitForTimeout(1800);
  return { ctx, pg };
}

/** Todo controle VISÍVEL tem nome? Devolve os que não têm. */
const semNome = (pg) => pg.evaluate((fonte) => {
  const nome = eval(fonte);
  const vis = (e) => { const s = getComputedStyle(e); return s.display !== 'none' && s.visibility !== 'hidden' && e.offsetParent !== null; };
  return [...document.querySelectorAll('button,input,select,textarea,a[href]')]
    .filter(vis).filter((e) => !nome(e))
    .map((e) => e.tagName + '#' + (e.id || '?'));
}, NOME);

const quantos = (pg) => pg.evaluate(() => {
  const vis = (e) => { const s = getComputedStyle(e); return s.display !== 'none' && s.visibility !== 'hidden' && e.offsetParent !== null; };
  return [...document.querySelectorAll('button,input,select,textarea,a[href]')].filter(vis).length;
});

console.log('[1] a entrada: todo controle visível tem nome');
{
  const { ctx, pg } = await abrir();
  await pg.selectOption('#modelo', 'ia').catch(() => {});
  await pg.evaluate(() => { const v = document.getElementById('viaRec'); if (v) v.classList.remove('hide'); });
  await pg.waitForTimeout(400);
  const n = await quantos(pg); const maus = await semNome(pg);
  ok(`os ${n} controles visíveis têm nome acessível`, maus.length === 0, maus.join(' '));
  await ctx.close();
}

console.log('\n[2] com os ajustes e o modal do clipe abertos');
{
  const { ctx, pg } = await abrir();
  await pg.selectOption('#modelo', 'ia').catch(() => {});
  await pg.evaluate(() => { const v = document.getElementById('viaRec'); if (v) v.classList.remove('hide'); });
  await pg.evaluate(() => { const d = document.getElementById('recAjustes'); if (d) d.open = true; });
  await pg.evaluate(() => { const b = document.getElementById('clipeAbrir'); if (b) b.click(); });
  await pg.waitForTimeout(500);
  const n = await quantos(pg); const maus = await semNome(pg);
  ok(`os ${n} controles visíveis têm nome acessível`, maus.length === 0, maus.join(' '));
  await ctx.close();
}

console.log('\n[2b] os quatro que estavam sem nome continuam com nome');
{
  /* POR QUE ELES SÃO NOMEADOS AQUI, UM A UM.
     Os blocos [1] e [2] andam pelos estados que a régua consegue DIRIGIR, e
     três destes quatro vivem em telas que ela não alcança: o deslizante da
     comparação e os dois campos do compartilhar só existem depois de haver
     quadros. Sem este bloco, o conserto que este build fez ficaria sem régua —
     medi: apagando o `aria-label` do deslizante, os blocos de cima passam.

     E por que não uma regra GERAL sobre a fonte, em vez de quatro nomes?
     Porque ela dá falso positivo. Metade dos controles desta ferramenta recebe
     o texto em tempo de execução, e parte deles por uma VARIÁVEL LOCAL — o
     `lenteRev` faz `const b = $('lenteRev')` e escreve em `b.textContent`.
     Uma varredura por `$('id').textContent` não vê isso e acusa um defeito que
     não existe. Foi o que aconteceu na primeira versão desta régua: 23
     acusações, 19 falsas. Uma régua que acusa dezenove inexistentes ensina a
     ignorá-la, e aí ela não serve para os quatro verdadeiros.

     Quatro nomes escritos é uma lista — e uma lista pequena, fechada e com
     motivo é diferente de uma lista paralela: ela não duplica uma verdade que
     existe noutro lugar, ela registra o que foi medido em 28/08. */
  const QUATRO = ['recAutoMin', 'compPara', 'compQuem', 'cmpMistura'];
  for (const id of QUATRO) {
    const m = APP.match(new RegExp(`id="${id}"[^>]*`));
    const tag = m ? m[0] : '';
    const nomeado = /data-i18n-aria=|aria-label=/.test(tag) ||
                    new RegExp(`<label[^>]*for="${id}"[^>]*data-i18n`).test(APP);
    ok(`${id} tem nome acessível declarado`, nomeado,
       nomeado ? '' : tag.slice(0, 60) || '(não achei o controle)');
  }
  /* E o nome tem que ser TRADUZIDO: um `aria-label` escrito à mão em português
     é um leitor de tela falando português numa tela em alemão. `data-i18n-aria`
     é repintado pelo `applyLang()`, que é por onde toda troca de idioma passa. */
  const chaves = ['ariaRecAutoMin', 'ariaCompPara', 'ariaCompQuem', 'ariaCmpMistura'];
  for (const L of ['pt', 'en', 'es', 'de', 'fr']) {
    const i = APP.indexOf(`\n    ${L}: {`);
    const bloco = i < 0 ? '' : APP.slice(i, i + 95000);
    const faltando = chaves.filter((c) => !new RegExp(c + ":'[^']+'").test(bloco));
    ok(`  ${L}: os quatro nomes existem no dicionário`, faltando.length === 0, faltando.join(' '));
  }
}

console.log('\n[3] a estrutura da página');
{
  const { ctx, pg } = await abrir();
  await pg.waitForTimeout(300);
  const e = await pg.evaluate(() => {
    const vis = (x) => { const s = getComputedStyle(x); return s.display !== 'none' && x.offsetParent !== null; };
    const hs = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(vis).map((h) => +h.tagName[1]);
    const saltos = [];
    for (let i = 1; i < hs.length; i++) if (hs[i] - hs[i - 1] > 1) saltos.push(`${hs[i - 1]}→${hs[i]}`);
    const ids = {}; document.querySelectorAll('[id]').forEach((x) => { ids[x.id] = (ids[x.id] || 0) + 1; });
    return {
      h1: document.querySelectorAll('h1').length,
      saltos,
      dup: Object.entries(ids).filter(([, k]) => k > 1).map(([k]) => k),
      orfaos: [...document.querySelectorAll('label[for]')].filter((l) => !document.getElementById(l.htmlFor)).map((l) => l.htmlFor),
      semAlt: [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).length,
      lang: document.documentElement.lang,
    };
  });
  ok('há exatamente um h1', e.h1 === 1, String(e.h1));
  ok('  e nenhum salto de nível de título', e.saltos.length === 0, e.saltos.join(' '));
  /* `id` repetido não é enfeite: ele quebra `label[for]` e toda referência
     `aria-*`, e quebra em silêncio — a segunda ocorrência simplesmente não é
     encontrada. */
  ok('nenhum id repetido', e.dup.length === 0, e.dup.slice(0, 6).join(' '));
  ok('nenhum label apontando para o vazio', e.orfaos.length === 0, e.orfaos.slice(0, 6).join(' '));
  ok('nenhuma imagem sem alt', e.semAlt === 0, String(e.semAlt));
  ok('o documento declara o idioma', /^[a-z]{2}/.test(e.lang || ''), e.lang);
  await ctx.close();
}

console.log('\n[4] o foco é visível em tudo que recebe foco');
{
  const { ctx, pg } = await abrir();
  await pg.selectOption('#modelo', 'ia').catch(() => {});
  await pg.evaluate(() => { const v = document.getElementById('viaRec'); if (v) v.classList.remove('hide'); });
  await pg.waitForTimeout(300);
  const maus = []; const vistos = new Set();
  for (let i = 0; i < 45; i++) {
    await pg.keyboard.press('Tab');
    const d = await pg.evaluate(() => {
      const a = document.activeElement; if (!a || a === document.body) return null;
      const s = getComputedStyle(a);
      return { marca: a.tagName + '#' + (a.id || ''),
               ok: (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 1) ||
                   (s.boxShadow && s.boxShadow !== 'none'),
               contorno: `${s.outlineStyle} ${s.outlineWidth}` };
    });
    if (!d) break;
    if (vistos.has(d.marca)) continue;
    vistos.add(d.marca);
    if (!d.ok) maus.push(`${d.marca} [${d.contorno}]`);
  }
  ok(`os ${vistos.size} focáveis percorridos mostram o foco`, maus.length === 0,
     maus.slice(0, 5).join(' · '));
  await ctx.close();
}

console.log('\n[5] o contraste do texto');
{
  const { ctx, pg } = await abrir();
  await pg.evaluate(() => { const v = document.getElementById('viaRec'); if (v) v.classList.remove('hide'); });
  await pg.waitForTimeout(300);
  /* A razão da WCAG: 4.5:1 para texto comum, 3:1 para o grande. O fundo é
     procurado subindo a árvore, porque a maioria dos elementos é transparente
     e herda o do pai — comparar contra `transparent` daria razão infinita e
     aprovaria tudo. */
  const ruins = await pg.evaluate(() => {
    const lum = (c) => {
      const [r, g, b] = c.match(/\d+/g).slice(0, 3).map(Number)
        .map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const fundo = (e) => {
      let n = e;
      while (n && n !== document.documentElement) {
        const b = getComputedStyle(n).backgroundColor;
        if (b && !/rgba\(0, 0, 0, 0\)|transparent/.test(b)) return b;
        n = n.parentElement;
      }
      return 'rgb(255,255,255)';
    };
    const out = [];
    for (const e of document.querySelectorAll('p,span,b,li,td,label,button,a,small')) {
      const s = getComputedStyle(e);
      if (s.display === 'none' || !e.offsetParent) continue;
      const txt = [...e.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim())
        .map((n) => n.textContent.trim()).join('');
      if (txt.length < 4) continue;
      const tam = parseFloat(s.fontSize), peso = parseInt(s.fontWeight) || 400;
      const alvo = (tam >= 24 || (tam >= 18.66 && peso >= 700)) ? 3 : 4.5;
      try {
        const l1 = lum(s.color), l2 = lum(fundo(e));
        const r = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        if (r < alvo) out.push(`${r.toFixed(2)}<${alvo} "${txt.slice(0, 20)}"`);
      } catch (err) { /* cor que não é rgb(): não se afirma nada */ }
    }
    return out;
  });
  ok('nenhum texto visível fica abaixo do mínimo da WCAG', ruins.length === 0,
     ruins.slice(0, 4).join(' · '));
  await ctx.close();
}

await br.close(); srv.close();
console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'a ferramenta foi medida, e ela se lê sem mouse e sem enxergar'));
process.exit(falhas ? 1 : 0);

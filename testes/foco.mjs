/* A FERRAMENTA PELO TECLADO — o que nunca tinha sido medido.
 *
 * A fila dizia "a acessibilidade da ferramenta, que nunca foi medida". Medida,
 * ela está em bem melhor estado do que o item sugeria: dos 100 controles
 * visíveis, UM não tinha nome acessível; dos 62 alcançados por tabulação,
 * nenhum sem marca de foco; nenhuma imagem sem `alt`; nenhum texto abaixo do
 * contraste mínimo. O item era lacuna de MEDIÇÃO, e não do produto.
 *
 * O que a medição achou de verdade foi nos DIÁLOGOS.
 *
 * DUAS MEDIÇÕES MINHAS ESTAVAM ERRADAS ANTES DE ESTAREM CERTAS, e as duas
 * ficam escritas porque a próxima pessoa vai cair nelas:
 *
 *   1. Contraste. Ler `color(srgb 0.96 0.97 0.98 / 0.88)` com o mesmo regex de
 *      `rgb(21, 23, 28)` trata 0,96 como se fosse 0,96 de 255 — e trata fundo
 *      semitransparente como opaco. A primeira versão acusou 17 problemas que
 *      não existiam. Canal 0-1 e composição de camadas: zero.
 *   2. Foco. `elemento.focus()` por script NÃO ativa `:focus-visible` em botão
 *      — o navegador só o considera visível quando o foco veio do teclado. A
 *      primeira versão acusou 24 elementos sem marca. Com Tab de verdade: zero.
 *
 * Nas duas, o número era do método e não do produto. É por isso que esta régua
 * tabula com o teclado e compõe as camadas de cor.
 *
 *   node testes/foco.mjs
 */
import { chromium } from './_navegador.mjs';
import http from 'http';
import fs from 'fs';

import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';

const ROOT = `${RAIZ_WS}/public`;
const html = fs.readFileSync(ROOT + '/app.html', 'utf8');
const srv = http.createServer((q, r) => {
  const u = q.url.split('?')[0];
  if (u.startsWith('/_vercel/')) { r.writeHead(200, { 'Content-Type': 'text/javascript' }); return r.end(''); }
  if (u === '/sw.js') { r.writeHead(200, { 'Content-Type': 'text/javascript' }); return r.end(''); }
  r.writeHead(200, { 'Content-Type': 'text/html' }); r.end(html);
});
await new Promise((r) => srv.listen(8974, r));

let falhas = 0;
const ok = (n, c, e) => {
  console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : ''));
  if (!c) falhas++;
};

const br = await chromium.launch({ executablePath: CHROME_WS });
const ctx = await br.newContext({ viewport: { width: 1250, height: 950 } });
const pg = await ctx.newPage();
await pg.route('**/rpc/*stamp_*', (r) =>
  r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, body: 'null' }));
await pg.goto('http://localhost:8974/app.html?lang=pt');
await pg.waitForTimeout(700);

console.log('[1] todo controle tem nome, e o nome não é só o placeholder');
{
  /* Placeholder NÃO é nome acessível: ele some no instante em que a pessoa
     digita, e alguns leitores de tela nem o anunciam. Era o caso da caixa da
     transcrição — o campo central da ferramenta, sem nome nenhum. */
  const r = await pg.evaluate(() => {
    const visivel = (e) => e.offsetParent !== null || getComputedStyle(e).position === 'fixed';
    const controles = [...document.querySelectorAll('input,select,textarea,button,a[href]')].filter(visivel);
    const nomeDe = (e) => {
      const al = e.getAttribute('aria-label');
      if (al && al.trim()) return 'ok';
      const lb = e.getAttribute('aria-labelledby');
      if (lb && document.getElementById(lb.split(/\s+/)[0])) return 'ok';
      if (e.id && document.querySelector(`label[for="${CSS.escape(e.id)}"]`)) return 'ok';
      if (e.closest('label')) return 'ok';
      if (e.getAttribute('title')) return 'ok';
      if ((e.textContent || '').trim()) return 'ok';
      if (e.getAttribute('placeholder')) return 'SO-PLACEHOLDER';
      return 'SEM-NOME';
    };
    const ruins = [];
    for (const e of controles) {
      const n = nomeDe(e);
      if (n !== 'ok') ruins.push(n + ' ' + e.tagName.toLowerCase() + (e.id ? '#' + e.id : ''));
    }
    return { quantos: controles.length, ruins };
  });
  console.log(`     ${r.quantos} controles visíveis`);
  ok('nenhum controle sem nome acessível', r.ruins.length === 0, r.ruins.slice(0, 6).join(' | '));
  /* Se a página não carregou, zero controles passam por vacuidade. */
  ok('e a régua olhou a ferramenta inteira', r.quantos >= 50, String(r.quantos));
}

console.log('\n[2] toda parada da tabulação tem marca de foco');
{
  /* COM TAB DE VERDADE. `focus()` por script não ativa `:focus-visible` em
     botão, e o produto usa `:focus-visible` — medir com script acusaria 24
     elementos sem marca que têm marca. */
  await pg.evaluate(() => { document.body.focus(); });
  const sem = [];
  let visitados = 0;
  for (let i = 0; i < 140; i++) {
    await pg.keyboard.press('Tab');
    const m = await pg.evaluate(() => {
      const e = document.activeElement;
      if (!e || e === document.body) return null;
      if (e.dataset.jaVi === '1') return { repetido: true };
      e.dataset.jaVi = '1';
      const cs = getComputedStyle(e);
      return {
        id: e.tagName.toLowerCase() + (e.id ? '#' + e.id : ''),
        marca: (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) ||
               (cs.boxShadow && cs.boxShadow !== 'none'),
      };
    });
    if (!m) break;
    if (m.repetido) break;
    visitados++;
    if (!m.marca) sem.push(m.id);
  }
  console.log(`     ${visitados} paradas de tabulação`);
  ok('nenhuma parada sem marca de foco', sem.length === 0, sem.slice(0, 8).join(' | '));
  ok('e a tabulação percorreu a ferramenta', visitados >= 30, String(visitados));
}

console.log('\n[3] contraste — com o canal certo e as camadas compostas');
{
  const ruins = await pg.evaluate(() => {
    const canais = (c) => {
      if (!c) return null;
      const m = c.match(/[-\d.]+(?:e[-+]?\d+)?/gi);
      if (!m) return null;
      const n = m.map(Number);
      /* `color(srgb …)` vem em 0-1; `rgb(…)` em 0-255. Ler os dois igual foi o
         que produziu 17 problemas imaginários. */
      const e = /^color\(/.test(c) ? 255 : 1;
      return { r: n[0] * e, g: n[1] * e, b: n[2] * e, a: n.length > 3 ? n[3] : 1 };
    };
    const sobre = (f, t) => ({ r: f.r * f.a + t.r * (1 - f.a), g: f.g * f.a + t.g * (1 - f.a),
                               b: f.b * f.a + t.b * (1 - f.a), a: 1 });
    const lum = (c) => {
      const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    };
    /* O fundo efetivo empilha as camadas semitransparentes até uma opaca —
       parar na primeira com cor mede um fundo que ninguém vê. */
    const fundoDe = (el) => {
      const camadas = [];
      for (let p = el; p; p = p.parentElement) {
        const c = canais(getComputedStyle(p).backgroundColor);
        if (!c || c.a === 0) continue;
        camadas.push(c);
        if (c.a === 1) break;
      }
      if (!camadas.length || camadas[camadas.length - 1].a < 1) camadas.push({ r: 255, g: 255, b: 255, a: 1 });
      let cor = camadas.pop();
      while (camadas.length) cor = sobre(camadas.pop(), cor);
      return cor;
    };
    const saida = []; const vistos = new Set();
    for (const el of document.querySelectorAll('body *')) {
      if (el.offsetParent === null) continue;
      const txt = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('');
      if (txt.length < 2) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.15) continue;
      const cf = canais(cs.color); if (!cf) continue;
      const fundo = fundoDe(el);
      const raz = (() => {
        const l1 = lum(cf.a < 1 ? sobre(cf, fundo) : cf), l2 = lum(fundo);
        return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      })();
      const px = parseFloat(cs.fontSize);
      const minimo = (px >= 24 || (px >= 18.66 && parseInt(cs.fontWeight) >= 700)) ? 3 : 4.5;
      if (raz < minimo) {
        const k = cs.color + '|' + Math.round(px);
        if (vistos.has(k)) continue; vistos.add(k);
        saida.push(`${raz.toFixed(2)}<${minimo} ${Math.round(px)}px "${txt.slice(0, 24)}"`);
      }
    }
    return saida;
  });
  ok('nenhum texto abaixo do contraste mínimo', ruins.length === 0, ruins.slice(0, 5).join(' | '));
}

console.log('\n[4] o diálogo modal prende o foco — ou não é modal');
{
  /* AQUI ESTAVA O DEFEITO DE VERDADE. Os três diálogos declaram
     `aria-modal="true"`, e o do recado deixava o foco sair em 21 de 25
     tabulações: quem usa teclado saía para a página de trás com ele aberto.
     Dizer o falso a um leitor de tela é pior que não dizer nada — ele para de
     anunciar o que está atrás justamente porque acreditou. */
  await pg.locator('#avisar').click();
  await pg.waitForTimeout(500);
  const aberto = await pg.evaluate(() => !document.getElementById('fbModal').classList.contains('hide'));
  ok('o diálogo do recado abre', aberto);

  let foraNaPagina = 0;
  for (let i = 0; i < 25; i++) {
    await pg.keyboard.press('Tab');
    const onde = await pg.evaluate(() => {
      const m = document.getElementById('fbModal');
      const a = document.activeElement;
      if (!a || a === document.body || a === document.documentElement) return 'volta';
      return m.contains(a) ? 'dentro' : 'FORA:' + (a.id || a.tagName);
    });
    if (onde.startsWith('FORA')) foraNaPagina++;
  }
  /* `body` não conta: é a volta do anel de tabulação passando pela barra do
     navegador, e não um controle da página de trás. O que não pode acontecer é
     o foco pousar num controle VIVO atrás do diálogo. */
  ok('o foco não alcança nenhum controle atrás do diálogo', foraNaPagina === 0,
     `${foraNaPagina} de 25 tabulações`);

  /* E o que ficou inerte não pode ficar desbotado: o diálogo já tem véu. */
  const desbotou = await pg.evaluate(() => {
    const e = document.querySelector('[data-inerte-modal]');
    return e ? parseFloat(getComputedStyle(e).opacity) : 1;
  });
  ok('e o fundo não desbota duas vezes', desbotou > 0.9, String(desbotou));

  await pg.keyboard.press('Escape');
  await pg.waitForTimeout(300);
  const depois = await pg.evaluate(() => ({
    fechado: document.getElementById('fbModal').classList.contains('hide'),
    voltou: document.activeElement ? (document.activeElement.id || '') : '',
    sobrouInerte: document.querySelectorAll('[data-inerte-modal]').length,
  }));
  ok('Escape fecha o diálogo', depois.fechado === true);
  ok('e o foco volta para quem o abriu', depois.voltou === 'avisar', depois.voltou);
  /* Um `inert` esquecido deixa metade da página morta para o teclado, e o
     sintoma aparece três telas depois. */
  ok('e nada fica inerte para trás', depois.sobrouInerte === 0, String(depois.sobrouInerte));
}

console.log('\n[5] os três diálogos usam a mesma trava');
{
  /* Só o do recado é exercitado acima — os outros dois precisam de quadros e de
     clipe. O que se cobra aqui é que nenhum deles tenha ficado de fora do
     mecanismo: um `aria-modal` sem trava é a promessa que este build veio
     corrigir, e ela volta calada. */
  const fonte = fs.readFileSync(ROOT + '/app.html', 'utf8');
  const dialogos = (fonte.match(/role="dialog"/g) || []).length;
  const travas = (fonte.match(/modalPrender\(/g) || []).length;
  ok('há três diálogos', dialogos === 3, String(dialogos));
  /* Uma chamada de definição + uma por abertura/fechamento de cada. */
  ok('e todos passam pela trava', travas >= dialogos + 1, `${travas} chamadas`);
  for (const id of ['fbModal', 'lente', 'clipeModal']) {
    const preso = new RegExp(`modalPrender\\(\\$\\('${id}'\\)`).test(fonte);
    ok(`${id} está preso à trava`, preso, preso ? '' : '(não achei a chamada)');
  }
  /* E todo diálogo fecha com Escape. O do recado não fechava. */
  const escapes = (fonte.match(/Escape/g) || []).length;
  ok('e os três fecham com Escape', escapes >= dialogos,
     escapes >= dialogos ? '' : `só ${escapes} menções de Escape`);
}

await br.close();
srv.close();
console.log(falhas ? `\n${falhas} FALHA(S)`
                   : '\nTeclado na ferramenta: nome, foco, contraste e diálogo que prende.');
process.exit(falhas ? 1 : 0);

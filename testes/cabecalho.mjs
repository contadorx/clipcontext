/* UM CABEÇALHO SÓ, E UM RODAPÉ SÓ — nas três telas.
 *
 * O relato: "o menu da ferramenta fica deslocado dos demais, ele aloca o logo um
 * pouco mais para a direita… a ideia é que o cabeçalho e o rodapé não tenham
 * alteração independente da página".
 *
 * Medido a 1440 de largura, antes:
 *
 *     página principal   logo em x=272    cabeçalho 940    rodapé 940
 *     painel da conta    logo em x=272    cabeçalho 940    rodapé 940
 *     FERRAMENTA         logo em x=356    cabeçalho 1240   rodapé 1240
 *
 * E a causa não estava no cabeçalho da ferramenta. Estava numa regra escrita
 * para OUTRA coisa: `body.comBarra .wrap` monta a grade de duas colunas da barra
 * da conta, e `.wrap` é também a do cabeçalho e a do rodapé. Um seletor de
 * classe nua alcança tudo o que ainda não foi escrito — a mesma lição que o
 * `.painelMenu` do site já tinha aprendido com o `nav` nu.
 *
 * Este arquivo mede as três telas e afirma que elas são a MESMA moldura. Ele
 * existe porque nenhum teste de conteúdo pega isto: cada página, sozinha, está
 * perfeita — o defeito só existe na comparação.
 *
 *   node testes/cabecalho.mjs
 */
import { chromium } from 'playwright';
import { spawn, execSync } from 'child_process';

import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';
import { garantirPortaLivre } from './_porta.mjs';
const P = 8831;
const BASE = `http://localhost:${P}`;
const RAIZ = process.env.RAIZ || `${RAIZ_WS}`;
const CHROME = process.env.CHROME || CHROME_WS;

let falhas = 0;
const ok = (n, c, e) => { console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : '')); if (!c) falhas++; };

const matarPorta = () => { try { execSync(`fuser -k ${P}/tcp 2>/dev/null`); } catch {} };
matarPorta();
await new Promise(r => setTimeout(r, 400));
/* A porta é nossa antes de qualquer coisa — o porquê está no `_porta.mjs`,
   e ele custou uma hora de caçada a um defeito que não existia. */
await garantirPortaLivre(P, 'o cabecalho.mjs');

const next = spawn('npx', ['next', 'start', '-p', String(P)], { cwd: RAIZ, stdio: 'ignore' });
process.on('exit', () => { try { next.kill('SIGKILL'); } catch {} matarPorta(); });
for (let i = 0; i < 60; i++) {
  try { const r = await fetch(BASE + '/'); if (r.ok) break; } catch {}
  await new Promise(r => setTimeout(r, 500));
}

const br = await chromium.launch({ executablePath: CHROME });
const ctx = await br.newContext({ viewport: { width: 1440, height: 900 } });
const pg = await ctx.newPage();
const erros = []; pg.on('pageerror', e => erros.push(e.message));

async function medir(rota, rotulo){
  await pg.goto(BASE + rota, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(700);
  const r = await pg.evaluate(() => {
    const q = s => document.querySelector(s);
    const cx = el => el ? Math.round(el.getBoundingClientRect().x) : null;
    const dx = el => el ? Math.round(el.getBoundingClientRect().right) : null;
    const w = el => el ? Math.round(el.getBoundingClientRect().width) : null;
    const nav = q('header nav');
    /* Os links diretos do menu, SEM o botão de ação e sem as siglas de idioma:
       as siglas moram numa caixa própria e são as mesmas cinco em toda parte, e
       a ação é o único item cujo destino depende de onde a pessoa está. */
    const itens = nav
      ? [...nav.querySelectorAll(':scope > a')]
          .filter(a => !a.classList.contains('btnTop') && !a.classList.contains('btnTopo'))
          .map(a => a.textContent.trim())
      : [];
    return {
      logoX: cx(q('header .brand')),
      navFim: dx(nav),
      cabW: w(q('header .wrap')),
      rodW: w(q('footer .wrap')),
      rodX: cx(q('footer .wrap')),
      colunas: document.querySelectorAll('footer .rodapeCols > div').length,
      itens,
      /* O botão de ação leva à ferramenta. Na própria ferramenta ele não
         existe desde o Build 69 — não há conta para onde ele levar. */
      acao: (q('header nav a.btnTop') || q('header nav a.btnTopo') || {}).textContent || '',
      /* O BOTÃO, medido e não olhado. Ele dizia ser cópia do do site e tinha
         quatro diferenças — forro, peso, corpo e a cor da tinta. Comparar as
         REGRAS de CSS não pegaria: são dois arquivos, e o que importa é o que
         sai na tela. */
      botao: (() => {
        const b = q('header nav a.btnTop') || q('header nav a.btnTopo');
        if (!b) return null;
        const c = getComputedStyle(b), r = b.getBoundingClientRect();
        return { alt: Math.round(r.height), corpo: c.fontSize, peso: c.fontWeight,
                 forro: c.paddingTop + ' ' + c.paddingLeft, raio: c.borderRadius,
                 tinta: c.color, fundo: c.backgroundColor };
      })(),
    };
  });
  console.log(`\n${rotulo}`);
  console.log(`  logo x=${r.logoX}   nav termina em ${r.navFim}   cabeçalho ${r.cabW}px   rodapé ${r.rodW}px`);
  console.log(`  menu: ${r.itens.join(' · ')}   [ação: ${r.acao.trim()}]`);
  return r;
}

const site = await medir('/', 'PÁGINA PRINCIPAL');
const app  = await medir('/app?lang=pt', 'FERRAMENTA');
/* O PAINEL DA CONTA era a terceira casca medida aqui, e saiu no Build 71 com
   a conta. Ficam três: o site, a ferramenta e o blog. */
/* O BLOG É A QUARTA CASCA, e foi a última a ser achada — o menu dele não tinha
   o próprio blog. Faltar justo ali é o pior dos casos: quem está lendo um post
   não tem como voltar para a lista sem o botão de voltar do navegador. */
const blog = await medir('/blog', 'BLOG');
const todas = [['site', site], ['ferramenta', app], ['blog', blog]];

console.log('\n  o que este arquivo afirma:');

/* A MEDIDA. Um número por tela, e os três têm que ser o mesmo. */
const iguais = (chave) => {
  const vs = todas.map(([n, r]) => [n, r[chave]]);
  const um = vs[0][1];
  return { ok: vs.every(([, v]) => v === um), texto: vs.map(([n, v]) => n + '=' + v).join('  ') };
};
for (const [chave, nome] of [['logoX', 'o logo começa no mesmo x'],
                             ['navFim', 'o menu termina no mesmo x'],
                             ['cabW', 'o cabeçalho tem a mesma largura'],
                             ['rodW', 'o rodapé tem a mesma largura'],
                             ['rodX', 'o rodapé começa no mesmo x']]) {
  const r = iguais(chave);
  ok(nome, r.ok, r.texto);
}

/* OS ITENS. O blog entrou, e entrou ANTES do botão de ação — o botão é o fim do
   caminho, e o que vem depois dele não é lido.

   ---- BUILD 71: UM MENU SÓ, DE NOVO ----
   No Build 69 a ferramenta perdeu o "Preços" e o site ainda o tinha; no 71 a
   página de preços saiu, e as três telas voltaram a dizer as mesmas três
   palavras. A ferramenta continua sem botão de ação: o botão das outras telas
   leva a ela. */
const ehPrecos = (x) => /pre[çc]os|pricing|precios|preise|tarifs/i.test(x);
for (const [nome, r] of todas) {
  ok(`${nome}: três itens de menu`, r.itens.length === 3, r.itens.join(' · '));
  const iBlog = r.itens.findIndex(x => /blog/i.test(x));
  ok(`${nome}: o Blog está no menu`, iBlog >= 0, r.itens.join(' · '));
  ok(`${nome}: e é o último item`, iBlog === r.itens.length - 1, r.itens.join(' · '));
  ok(`${nome}: nenhum item de preço`, !r.itens.some(ehPrecos), r.itens.join(' · '));
}
/* A raiz do site abre em inglês e a ferramenta e o blog aqui abrem em
   português: compara-se a ferramenta com o blog, que fala a mesma língua. */
ok('a ferramenta e o blog têm o mesmo menu',
   JSON.stringify(app.itens) === JSON.stringify(blog.itens),
   app.itens.join(' · ') + '   ≠   ' + blog.itens.join(' · '));
ok('a ferramenta não tem botão de ação — o botão das outras telas leva a ela',
   app.acao.trim() === '' && app.botao === null, app.acao);

/* ---- OS ENDEREÇOS DA FERRAMENTA TROCAM DE IDIOMA ----

   Ela é um arquivo só que troca de idioma SEM RECARREGAR: os links do menu não
   são escritos no HTML, são montados do `ROTAS_SITE`. Um menu que aponta para
   `/precos` numa tela em alemão — onde a página é `/de/preise` — é um 404 dentro
   do próprio produto, e é exatamente o defeito que o rodapé já teve. */
console.log('\n  o menu da ferramenta, em dois idiomas:');
const linksDe = async (lang) => {
  await pg.goto(BASE + '/app?lang=' + lang, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(700);
  return pg.evaluate(() => [...document.querySelectorAll('header nav > a[data-rota]')]
    .map(a => ({ rota: a.getAttribute('data-rota'), href: a.getAttribute('href') || '',
                 texto: a.textContent.trim() })));
};
const pt = await linksDe('pt'), de = await linksDe('de');
for (const l of de) console.log('     ' + (l.rota + '        ').slice(0, 12) + l.href + '   ' + l.texto);
ok('todo item do menu tem endereço', pt.every(l => /^https?:\/\/.+\/.*/.test(l.href) || l.href.startsWith('/')),
   JSON.stringify(pt.map(l => l.href)));
ok('e texto', pt.every(l => l.texto.length > 1), JSON.stringify(pt.map(l => l.texto)));
/* O alemão é o caso que pega o defeito: lá `comparativo` vira `vergleich`.
   (Até o Build 68 a prova era o `precos` → `preise`; o Preços saiu da
   ferramenta no 69, e o Comparativo é o item que também muda de endereço.) */
const deComp = de.find(l => l.rota === 'comparativo');
ok('em alemão, o endereço do comparativo é o alemão',
   !!deComp && /\/de\/vergleich$/.test(deComp.href), deComp && deComp.href);
ok('e o rótulo também mudou de idioma',
   (pt.find(l => l.rota === 'comparativo') || {}).texto !== (deComp || {}).texto,
   (pt.find(l => l.rota === 'comparativo') || {}).texto + ' / ' + (deComp || {}).texto);
ok('nenhuma rota de preços no menu da ferramenta', !pt.some(l => l.rota === 'precos'),
   pt.map(l => l.rota).join(','));

/* ---- SEM BARRA DA CONTA, E SEM PERGUNTAR POR ELA ----

   Até o Build 68 a ferramenta perguntava `/api/menu` ao abrir e, com sessão,
   desenhava a barra da conta ao lado. No 69 a conta saiu da ferramenta: não
   há barra, e a pergunta também não pode ter sobrado — um pedido a cada
   abertura, para uma resposta que nunca é usada, é custo sem produto. */
console.log('\n  sem barra da conta:');
{
  const ctx2 = await br.newContext({ viewport: { width: 1440, height: 900 },
                                     serviceWorkers: 'block' });
  const pg2 = await ctx2.newPage();
  const erros2 = []; pg2.on('pageerror', e => erros2.push(e.message));
  const perguntas = [];
  pg2.on('request', q => { if (/\/api\/menu/.test(q.url())) perguntas.push(q.url()); });
  await pg2.goto(BASE + '/app?lang=pt', { waitUntil:'domcontentloaded' });
  await pg2.waitForTimeout(1500);
  const r = await pg2.evaluate(() => ({
    barra: !!document.getElementById('barraConta'),
    comBarra: document.body.classList.contains('comBarra'),
    plano: !!document.querySelector('.planoLinha'),
    itensCabecalho: [...document.querySelectorAll('header nav > a')].length,
  }));
  ok('não existe barra da conta', r.barra === false && r.comBarra === false);
  ok('nem etiqueta de plano', r.plano === false);
  ok('e ninguém pergunta pelo menu da conta', perguntas.length === 0, perguntas[0]);
  ok('o cabeçalho tem os três itens do site, sem o Preços', r.itensCabecalho === 3, String(r.itensCabecalho));
  ok('sem erro de página', erros2.length === 0, erros2[0]);
  await pg2.close(); await ctx2.close();
}

/* ---- O BOTÃO DE AÇÃO É O MESMO BOTÃO ----
   Ele é o único item do menu cujo DESTINO muda com a tela. A aparência não pode
   mudar junto: um botão menor e mais gordo numa das telas é a moldura
   desalinhada de novo, no único elemento que salta à vista. */
console.log('\n  o botão de ação, medido:');
/* A ferramenta ficou sem botão no Build 69; o botão é o mesmo nas três telas
   que o têm. */
const comBotao = todas.filter(([n]) => n !== 'ferramenta');
for (const [nome, r] of comBotao) {
  console.log('     ' + nome.padEnd(11) + JSON.stringify(r.botao));
}
for (const chave of ['alt', 'corpo', 'peso', 'forro', 'raio', 'tinta', 'fundo']) {
  const vs = comBotao.map(([n, r]) => [n, r.botao && r.botao[chave]]);
  const um = vs[0][1];
  ok('o botão tem o mesmo ' + chave + ' nas duas telas que o têm',
     vs.every(([, v]) => v === um), vs.map(([n, v]) => n + '=' + v).join('  '));
}

/* ---- E O MENU TEM QUE CABER, EM TODOS OS IDIOMAS ----
   Ele transbordava a moldura em português, espanhol e francês depois de o Blog
   entrar — e transbordar é o desalinhamento voltando por outra porta: o menu
   terminava 31 px à direita da borda na conta e no blog. O espanhol é o pior
   caso e é ele que decide a largura. */
console.log('\n  o menu cabe? (o que precisa contra o que cabe)');
for (const rota of ['/', '/es', '/fr', '/de', '/blog', '/app?lang=pt']) {
  await pg.goto(BASE + rota, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(500);
  const s2 = await pg.evaluate(() => {
    const w = document.querySelector('header .wrap');
    const nav = document.querySelector('header nav');
    const b = document.querySelector('header .brand');
    const cabe = w.getBoundingClientRect().width - 44 - b.getBoundingClientRect().width - 16;
    return { sobra: Math.round(cabe - nav.scrollWidth),
             fim: Math.round(nav.getBoundingClientRect().right),
             borda: Math.round(w.getBoundingClientRect().right - 22) };
  });
  console.log('     ' + rota.padEnd(14) + 'sobra ' + String(s2.sobra).padStart(4) + ' px');
  ok('o menu cabe em ' + rota, s2.sobra >= 0, s2.sobra + ' px de falta');
  ok('e não passa da borda em ' + rota, s2.fim <= s2.borda + 1, s2.fim + ' > ' + s2.borda);
}

ok('o rodapé tem três colunas em todas as telas',
   todas.every(([, r]) => r.colunas === 3), todas.map(([n, r]) => n + '=' + r.colunas).join(' '));
ok('sem erro de página', erros.length === 0, erros[0]);

await br.close();
console.log(falhas ? `\n  ${falhas} falha(s)` : '\n  tudo certo');
process.exit(falhas ? 1 : 0);

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

const P = 8831;
const BASE = `http://localhost:${P}`;
const RAIZ = process.env.RAIZ || '/root/walkstamp';
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

let falhas = 0;
const ok = (n, c, e) => { console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : '')); if (!c) falhas++; };

const matarPorta = () => { try { execSync(`fuser -k ${P}/tcp 2>/dev/null`); } catch {} };
matarPorta();
await new Promise(r => setTimeout(r, 400));
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
      /* O botão de ação muda de destino conforme a tela — na ferramenta ele
         leva à conta, nas outras à ferramenta. É a única diferença legítima. */
      acao: (q('header nav a.btnTop') || q('header nav a.btnTopo') || {}).textContent || '',
    };
  });
  console.log(`\n${rotulo}`);
  console.log(`  logo x=${r.logoX}   nav termina em ${r.navFim}   cabeçalho ${r.cabW}px   rodapé ${r.rodW}px`);
  console.log(`  menu: ${r.itens.join(' · ')}   [ação: ${r.acao.trim()}]`);
  return r;
}

const site = await medir('/', 'PÁGINA PRINCIPAL');
const app  = await medir('/app?lang=pt', 'FERRAMENTA');
const conta = await medir('/conta', 'PAINEL DA CONTA');
const todas = [['site', site], ['ferramenta', app], ['conta', conta]];

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
   caminho, e o que vem depois dele não é lido. */
for (const [nome, r] of todas) {
  ok(`${nome}: quatro itens de menu antes da ação`, r.itens.length === 4, r.itens.join(' · '));
  const iBlog = r.itens.findIndex(x => /blog/i.test(x));
  ok(`${nome}: o Blog está no menu`, iBlog >= 0, r.itens.join(' · '));
  ok(`${nome}: e é o último antes da ação`, iBlog === r.itens.length - 1, r.itens.join(' · '));
}
/* As três telas dizem as mesmas palavras nos mesmos lugares — menos a ação, que
   é o único item cujo destino depende de onde a pessoa está. */
ok('a ferramenta e a conta têm o mesmo menu',
   JSON.stringify(app.itens) === JSON.stringify(conta.itens),
   app.itens.join(' · ') + '   ≠   ' + conta.itens.join(' · '));
ok('e a ação muda de destino, como deve',
   app.acao.trim() !== conta.acao.trim(), app.acao + ' / ' + conta.acao);

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
/* O alemão é o caso que pega o defeito: lá `precos` vira `preise`. */
const dePrecos = de.find(l => l.rota === 'precos');
ok('em alemão, o endereço de preços é o alemão',
   !!dePrecos && /\/de\//.test(dePrecos.href) && !/\/precos$/.test(dePrecos.href),
   dePrecos && dePrecos.href);
ok('e o rótulo também mudou de idioma',
   (pt.find(l => l.rota === 'precos') || {}).texto !== (dePrecos || {}).texto,
   (pt.find(l => l.rota === 'precos') || {}).texto + ' / ' + (dePrecos || {}).texto);

ok('o rodapé tem três colunas nas três telas',
   todas.every(([, r]) => r.colunas === 3), todas.map(([n, r]) => n + '=' + r.colunas).join(' '));
ok('sem erro de página', erros.length === 0, erros[0]);

await br.close();
console.log(falhas ? `\n  ${falhas} falha(s)` : '\n  tudo certo');
process.exit(falhas ? 1 : 0);

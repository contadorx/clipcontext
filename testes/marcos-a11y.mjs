/* O PULO PARA O CONTEÚDO, NAS TRÊS TELAS DO PRODUTO.
 *
 * `<main>` é o marco que diz onde o conteúdo começa. Leitor de tela navega por
 * marcos — `header`, `nav`, `main`, `footer` — e oferece "pular para o conteúdo
 * principal" como comando. Sem `<main>`, esse comando NÃO EXISTE: não é que ele
 * leve ao lugar errado, é que ele não é oferecido.
 *
 * O link de pular é o equivalente para quem enxerga e não usa mouse.
 *
 * O QUE ESTAVA ERRADO, MEDIDO ANTES DE CONSERTAR:
 *
 *   o site      tinha os dois desde sempre — mas o `main` NÃO recebia foco: com
 *               o link focado, o Enter mudava o hash e rolava, e o foco ficava
 *               no `body`. Quem enxerga vê a página andar e não percebe; quem
 *               usa leitor continua lendo do topo e o Tab seguinte recomeça no
 *               cabeçalho. Meia solução, por anos.
 *   a ferramenta tinha `header`, cinco `nav` e dois `footer` — todos os marcos
 *               menos o que importa. E 14 Tabs até o primeiro controle, em toda
 *               visita, com 102 elementos focáveis na página.
 *   a conta     nenhum dos dois.
 *
 * O QUE ESTA RÉGUA PROVA, e ela testa PELO TECLADO, não pelo HTML:
 *   - o primeiro Tab revela o link, e ele fica VISÍVEL (sai por posição, e
 *     `display:none` o teria tirado da ordem de tabulação);
 *   - o Enter leva o FOCO para dentro do `main` — não só a rolagem;
 *   - o `main` contém mesmo o conteúdo, e não é uma casca vazia ao lado dele;
 *   - o texto do link é o MESMO nas três telas, em cada idioma: quem aprendeu a
 *     pular numa não pode ter que reaprender na outra;
 *   - e na ferramenta ele repinta ao trocar de idioma sem recarregar.
 *
 *   node testes/marcos-a11y.mjs
 */
import fs from 'fs';
import http from 'http';
import { chromium } from './_navegador.mjs';
import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';

let falhas = 0;
const ok = (n, c, e) => { console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : '')); if (!c) falhas++; };

const APP = fs.readFileSync(`${RAIZ_WS}/public/app.html`, 'utf8');
/* Os textos saem do próprio app, e não escritos aqui: uma lista escrita na
   régua aprova exatamente o erro que ela deveria pegar.
   O dicionário do app é um objeto `const I18N = { pt:{...}, en:{...}, ... }`, e
   os blocos são abertos por `    pt: {` na coluna quatro. A primeira versão
   deste extrator cortava em `pt:{` sem espaço e caía sempre no bloco do
   português — cinco idiomas devolvendo a mesma frase, e as afirmações
   reprovando o produto por um defeito da régua. */
const I18N_APP = (chave, lang) => {
  const ini = APP.indexOf(`\n    ${lang}: {`);
  if (ini < 0) return '';
  const bloco = APP.slice(ini, ini + 90000);
  const m = bloco.match(new RegExp(chave + ":'([^']*)'"));
  return m ? m[1] : '';
};
const I18N_CONTA = JSON.parse(fs.readFileSync(`${RAIZ_WS}/src/i18n-conta.json`, 'utf8'));
const I18N_SITE = JSON.parse(fs.readFileSync(`${RAIZ_WS}/src/i18n-site.json`, 'utf8'));
const IDIOMAS = ['pt', 'en', 'es', 'de', 'fr'];

console.log('[1] os três dicionários dizem a MESMA frase');
for (const L of IDIOMAS) {
  const site = I18N_SITE[L].pular;
  const conta = I18N_CONTA[L].pular;
  const app = I18N_APP('pular', L);
  ok(`${L}: site, conta e ferramenta pulam com as mesmas palavras`,
     !!site && site === conta && site === app,
     `site="${site}" conta="${conta}" app="${app}"`);
}

console.log('\n[2] o HTML das três telas traz o marco e o link');
{
  const doc = fs.readFileSync(`${RAIZ_WS}/src/site/doc.html`, 'utf8');
  const painel = fs.readFileSync(`${RAIZ_WS}/app/conta/[lang]/Painel.tsx`, 'utf8');
  for (const [nome, txt, alvo] of [
    ['o site', doc, /<main id="conteudo" tabindex="-1">/],
    ['a ferramenta', APP, /<main class="wrap corpo" id="conteudo" tabindex="-1">/],
    ['a conta', painel, /id="conteudo" tabIndex=\{-1\}/],
  ]) {
    /* O detalhe só sai quando REPROVA. Impresso sempre, ele dizia "tem main,
       mas sem tabindex" ao lado de um `ok` — um rótulo contradizendo a própria
       linha, que é o defeito que estas réguas existem para não deixar passar. */
    const tem = alvo.test(txt);
    ok(`${nome}: tem <main id="conteudo"> e ele PODE receber foco`, tem,
       tem ? '' : (/main/.test(txt) ? 'tem main, mas sem tabindex="-1"' : 'sem main'));
  }
  ok('  o site tem o link de pular', /class="pular"/.test(doc));
  ok('  a ferramenta tem o link de pular', /class="pular"/.test(APP));
  ok('  a conta tem o link de pular', /className="pular"/.test(painel));
}

console.log('\n[3] e ele funciona PELO TECLADO na ferramenta');
const srv = http.createServer((q, r) => {
  if (q.url.split('?')[0].startsWith('/_vercel/')) {
    r.writeHead(200, { 'Content-Type': 'text/javascript' }); return r.end('');
  }
  if (q.url.startsWith('/app')) {
    r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return r.end(APP);
  }
  r.writeHead(204); r.end();
});
await new Promise((r) => srv.listen(8879, r));
const br = await chromium.launch({ executablePath: CHROME_WS });
const pg = await (await br.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
await pg.goto('http://localhost:8879/app.html?lang=pt');
await pg.waitForTimeout(1500);
{
  await pg.keyboard.press('Tab');
  const p = await pg.evaluate(() => {
    const a = document.activeElement; const b = a.getBoundingClientRect();
    return { classe: a.className, texto: (a.textContent || '').trim(), x: Math.round(b.left) };
  });
  ok('o PRIMEIRO Tab cai no link de pular', p.classe === 'pular', p.classe);
  /* Visível de verdade: ele sai da tela por posição, e focado tem que voltar.
     `display:none` o tiraria da ordem de tabulação — a afirmação acima teria
     passado com um link que ninguém consegue ver. */
  ok('  e focado ele fica VISÍVEL na tela', p.x >= 0 && p.x < 400, `x=${p.x}`);
  ok('  com o texto do dicionário', p.texto === I18N_APP('pular', 'pt'), p.texto);

  await pg.keyboard.press('Enter');
  await pg.waitForTimeout(350);
  const d = await pg.evaluate(() => ({
    ativo: document.activeElement && document.activeElement.id,
    dentro: (() => {
      const m = document.getElementById('conteudo');
      const alvo = document.getElementById('modelo');
      return !!(m && alvo && m.contains(alvo));
    })(),
  }));
  /* A AFIRMAÇÃO QUE ESTE ARQUIVO EXISTE PARA FAZER. Sem `tabindex="-1"` o hash
     muda, a página rola e o foco fica no `body` — e era assim no site desde
     sempre. "Rolou" não é "pulou". */
  ok('  e o Enter leva o FOCO para dentro do conteúdo', d.ativo === 'conteudo', d.ativo || '(body)');
  ok('  e o conteúdo é mesmo o conteúdo, não uma casca vazia', d.dentro);
}

console.log('\n[4] e o link repinta ao trocar de idioma sem recarregar');
{
  const vistos = new Set();
  for (const L of IDIOMAS) {
    await pg.evaluate((l) => {
      const a = document.querySelector(`#idiomas a[data-l="${l}"]`); if (a) a.click();
    }, L);
    await pg.waitForTimeout(220);
    const txt = await pg.evaluate(() => document.querySelector('a.pular').textContent.trim());
    ok(`${L}: diz "${I18N_APP('pular', L)}"`, txt === I18N_APP('pular', L), txt);
    vistos.add(txt);
  }
  ok('e os cinco são textos diferentes', vistos.size === 5, `${vistos.size} de 5`);
}

await br.close(); srv.close();
console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'o pulo para o conteúdo existe, e leva o foco junto'));
process.exit(falhas ? 1 : 0);

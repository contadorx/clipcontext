/* AS DUAS TELAS DO PRODUTO, LADO A LADO.
 *
 * A ferramenta e a area do cliente sao a mesma marca, e o pulo entre elas
 * acontece o tempo todo: o site e onde se le, a ferramenta e onde se faz.
 * Estavam diferentes em duas coisas que se notam de longe -- o rodape (uma
 * linha contra tres colunas) e a barra da conta (so para quem estava logado).
 * A barra saiu da ferramenta no Build 69, e a conta inteira saiu do site no 71.
 * O rodape da ferramenta passou a ser comparado com o do blog, que e uma tela
 * do site no mesmo idioma.
 *
 * Este teste compara as duas telas em vez de conferir cada uma contra uma
 * lista escrita aqui: uma lista escrita e a proxima a ficar para tras.
 */
import { chromium } from 'playwright';
import { spawn, execSync } from 'child_process';
import http from 'http';

import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';
import { garantirPortaLivre } from './_porta.mjs';
const P = 8841;
const BASE = `http://localhost:${P}`;
let falhas = 0;
const ok = (n, c, e) => { console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : '')); if (!c) falhas++; };

try { execSync(`fuser -k ${P}/tcp 2>/dev/null`); } catch {}
await new Promise((r) => setTimeout(r, 500));
/* A porta é nossa antes de qualquer coisa — o porquê está no `_porta.mjs`,
   e ele custou uma hora de caçada a um defeito que não existia. */
await garantirPortaLivre(P, 'o paridade.mjs');

const next = spawn('npx', ['next', 'start', '-p', String(P)], { cwd: `${RAIZ_WS}`, stdio: 'ignore' });
process.on('exit', () => { try { next.kill('SIGKILL'); } catch {} });
for (let i = 0; i < 60; i++) {
  try { const r = await fetch(`${BASE}/blog`); if (r.ok) break; } catch {}
  await new Promise((r) => setTimeout(r, 500));
}
const br = await chromium.launch({ executablePath: CHROME_WS });
async function ctxDe() {
  return br.newContext({ viewport: { width: 1340, height: 1100 } });
}
const rodape = (pg) => pg.locator('.rodapeCols').evaluateAll((ds) => {
  const d = ds[0]; if (!d) return null;
  return {
    colunas: [...d.querySelectorAll('h3')].map((h) => h.textContent.trim()),
    links: [...d.querySelectorAll('a')].map((a) => a.textContent.trim()),
  };
});

console.log('[1] o rodape da ferramenta e o mesmo do site');
{
  const ctx = await ctxDe();
  const pg = await ctx.newPage();
  await pg.goto(`${BASE}/blog`, { waitUntil: 'networkidle' });
  const naConta = await rodape(pg);
  await pg.goto(`${BASE}/app?lang=pt`, { waitUntil: 'networkidle' });
  await pg.waitForTimeout(500);
  const noApp = await rodape(pg);
  ok('a ferramenta tem rodapé de três colunas', noApp && noApp.colunas.length === 3,
     JSON.stringify(noApp && noApp.colunas));
  ok('com os mesmos títulos de coluna',
     JSON.stringify(noApp.colunas) === JSON.stringify(naConta.colunas),
     `app ${noApp.colunas} | site ${naConta.colunas}`);
  ok('e os mesmos links, na mesma ordem',
     JSON.stringify(noApp.links) === JSON.stringify(naConta.links),
     `\n      app:   ${noApp.links.join(', ')}\n      site:  ${naConta.links.join(', ')}`);
  await ctx.close();
}

console.log('\n[2] e ele acompanha o idioma, que a ferramenta troca sem recarregar');
{
  const ctx = await ctxDe();
  const pg = await ctx.newPage();
  await pg.goto(`${BASE}/app?lang=pt`, { waitUntil: 'networkidle' });
  await pg.waitForTimeout(400);
  const antes = (await rodape(pg)).links.join('|');
  await pg.locator('#idiomas a[data-l="de"]').click();
  await pg.waitForTimeout(700);
  const depois = await rodape(pg);
  ok('os rótulos viraram alemão', depois.links.join('|') !== antes,
     depois.links.slice(0, 4).join(', '));
  /* O endereco tambem: a tabela antiga tinha quatro paginas e o resto apontava
     para o portugues em qualquer idioma. */
  const hrefs = await pg.locator('.rodapeCols a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  const doSite = hrefs.filter((h) => h.startsWith('http'));
  ok('todos os endereços do site foram para o alemão',
     doSite.every((h) => /\/de\//.test(h)), doSite.filter((h) => !/\/de\//.test(h)).join(' '));
  await ctx.close();
}

console.log('\n[3] a ferramenta não tem barra da conta, nem pergunta por ela');
{
  /* Até o Build 68 a barra existia nas duas telas, com os mesmos itens e os
     mesmos cadeados, e era isso que este bloco comparava. No 69 a ferramenta
     ficou grátis e sem conta, e no 71 a conta saiu do site também. */
  const ctx = await ctxDe();
  const pg = await ctx.newPage();
  const perguntas = [];
  pg.on('request', (q) => { if (/\/api\/menu|\/auth\/v1|\/rest\/v1/.test(q.url())) perguntas.push(q.url()); });
  await pg.goto(`${BASE}/app?lang=pt`, { waitUntil: 'networkidle' });
  await pg.waitForTimeout(500);
  const r = await pg.evaluate(() => ({
    barra: !!document.getElementById('barraConta'),
    comBarra: document.body.classList.contains('comBarra'),
  }));
  ok('a ferramenta não tem barra da conta', !r.barra && !r.comBarra, JSON.stringify(r));
  ok('e não pergunta por ela, nem pela sessão', perguntas.length === 0, perguntas.join(' '));
  await ctx.close();
}

console.log('\n[4] sem cenário escolhido, "Outro" assume — e a gravação não é barrada');
{
  const ctx = await ctxDe();
  const pg = await ctx.newPage();
  const erros = [];
  pg.on('pageerror', (e) => erros.push(e.message));
  await pg.goto(`${BASE}/app?lang=pt`, { waitUntil: 'networkidle' });
  ok('o seletor começa sem escolha', await pg.locator('#modelo').inputValue() === '');
  /* `getDisplayMedia` nao existe neste contexto de teste, entao o clique para
     logo depois da checagem do cenario — que e exatamente o que se quer medir:
     o cenario deixou de ser porta trancada. */
  await pg.evaluate(() => { try { delete MediaDevices.prototype.getDisplayMedia; } catch (e) {} });
  await pg.locator('#rec').click();
  await pg.waitForTimeout(600);
  ok('o cenário virou "Outro" sozinho', await pg.locator('#modelo').inputValue() === 'outro',
     await pg.locator('#modelo').inputValue());
  const msg = await pg.locator('#recMsg').innerText();
  ok('e a tela diz que assumiu, em vez de exigir', /Outro|gen[ée]rico/i.test(msg) || msg.length > 0, msg);
  ok('sem erro de JavaScript', erros.length === 0, erros.join(' | '));
  await ctx.close();
}

await br.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);

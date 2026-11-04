import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs';
import { criarProxy, exigirNext } from './proxy.mjs';
import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';
await exigirNext();
const ROOT=`${RAIZ_WS}/public`;
const tipos={'.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml'};
/* O site virou Next.js: as páginas não existem mais como arquivo em public/.
   O servidorzinho estático daqui virou um encaminhador para o Next — mesma
   porta, mesmas URLs no teste, e quem responde é o produto de verdade. */
const srv = criarProxy();
/* A PORTA TEM NOME — 29/08. Ela estava escrita à mão em nove lugares, e num
   deles CODIFICADA: `localhost%3A8961`, dentro de um regex. Quando as portas
   foram desconflitadas, a troca não alcançou aquele ali (o `%3A` cola no
   número e não há fronteira de palavra), e a régua passou a afirmar sobre uma
   porta que não existia mais. Falhou alto, que foi sorte: uma afirmação que
   casa `walkstamp` OU a porta poderia ter continuado verde pelo outro lado. */
const P = 8852;
const BASE = `http://localhost:${P}`;
await new Promise(r=>srv.listen(P,r));
const br=await chromium.launch({executablePath:CHROME_WS});
let falhas=0; const ok=(n,c,e)=>{console.log((c?'  ok   ':'  FALHA')+'  '+n+(e?'  → '+e:''));if(!c)falhas++};
const ctx=await br.newContext({viewport:{width:1200,height:900}});
const pg=await ctx.newPage(); const erros=[]; pg.on('pageerror',e=>erros.push(e.message));
await pg.goto(BASE + '/?lang=pt'); await pg.waitForTimeout(700);

console.log('[1] a aba existe e abre');
ok('a aba está na borda', await pg.locator('#fichaAba').isVisible());
ok('a caixa começa fechada', await pg.locator('#fichaCx').isHidden());
await pg.locator('#fichaAba').click(); await pg.waitForTimeout(300);
ok('abriu', await pg.locator('#fichaCx').isVisible());
ok('com onze notas, de 0 a 10', (await pg.locator('.fichaNota').count()) === 11);
ok('e a pergunta traz a marca', /Walkstamp/.test(await pg.locator('#fichaPasso1').textContent()),
   (await pg.locator('#fichaPasso1').textContent()).slice(0,60));

console.log('\n[2] nota baixa: escuta, não pede divulgação');
await pg.locator('.fichaNota[data-n="4"]').click(); await pg.waitForTimeout(300);
ok('vai para a caixa de texto', await pg.locator('#fichaPasso2').isVisible());
ok('e NÃO pede compartilhamento', await pg.locator('#fichaPasso3').isHidden());
ok('já marcado como problema', await pg.locator('.fichaTipo[data-t="problema"]').evaluate(e=>e.classList.contains('on')));

console.log('\n[3] nota alta: pede o compartilhamento');
{
  const pg2 = await (await br.newContext({viewport:{width:1200,height:900}})).newPage();
  await pg2.goto(BASE + '/?lang=pt'); await pg2.waitForTimeout(600);
  await pg2.locator('#fichaAba').click(); await pg2.waitForTimeout(250);
  await pg2.locator('.fichaNota[data-n="9"]').click(); await pg2.waitForTimeout(300);
  ok('agradece e oferece o LinkedIn', await pg2.locator('#fichaPasso3').isVisible());
  const href = await pg2.locator('#fichaLinkedin').getAttribute('href');
  console.log('     ' + href);
  ok('o link é o compartilhador do LinkedIn', /linkedin\.com\/sharing\/share-offsite/.test(href), href);
  ok('com o endereço do site dentro', new RegExp(`localhost%3A${P}|walkstamp`, 'i').test(href));
  ok('e a caixa de texto não aparece junto', await pg2.locator('#fichaPasso2').isHidden());
  await pg2.close();
}
console.log('\n[4] a nota 7 já conta como quem indica');
{
  const pg3 = await (await br.newContext({viewport:{width:1200,height:900}})).newPage();
  await pg3.goto(BASE + '/?lang=pt'); await pg3.waitForTimeout(600);
  await pg3.locator('#fichaAba').click(); await pg3.waitForTimeout(250);
  await pg3.locator('.fichaNota[data-n="7"]').click(); await pg3.waitForTimeout(300);
  ok('7 recebe o pedido', await pg3.locator('#fichaPasso3').isVisible());
  /* Fechar é pelo X: com a caixa aberta, a aba fica atrás do fundo escuro — e
     isso está certo, é o que um diálogo modal faz. */
  await pg3.locator('#fichaFechar').click(); await pg3.waitForTimeout(250);
  await pg3.locator('#fichaAba').click(); await pg3.waitForTimeout(400);
  ok('e reabrir não pergunta a nota de novo', await pg3.locator('#fichaPasso1').isHidden());
  await pg3.close();
}
console.log('\n[5] o recado abre o e-mail da pessoa, endereçado ao suporte');
{
  /* ATÉ O BUILD 70 o recado ia por HTTP para `/api/chamado` e virava um chamado
     numerado num banco, com consulta pelo número e o tempo médio de resposta
     ao lado. No 71 o site ficou sem servidor: o recado abre o programa de
     e-mail de quem escreve, como o da ferramenta. A régua lê o endereço pelo
     espelho `__ultimoEmail` — um `mailto:` não é pedido de rede — e cobra que
     nenhum pedido HTTP tenha sobrado no caminho. */
  const pg5 = await (await br.newContext({viewport:{width:1200,height:900}})).newPage();
  const http = [];
  pg5.on('request', (r) => { if (/\/api\/|supabase|\/rest\/v1\//.test(r.url())) http.push(r.url()); });
  await pg5.goto(BASE + '/?lang=pt'); await pg5.waitForTimeout(600);
  await pg5.locator('#fichaAba').click(); await pg5.waitForTimeout(250);
  await pg5.locator('.fichaNota[data-n="3"]').click(); await pg5.waitForTimeout(300);
  ok('não pede e-mail — quem manda é o programa da pessoa', (await pg5.locator('#fichaEmail').count()) === 0);
  await pg5.locator('#fichaEnviar').click(); await pg5.waitForTimeout(200);
  ok('recado vazio é recusado aqui mesmo', /Escreva alguma coisa/.test(await pg5.locator('#fichaMsg').textContent()));
  await pg5.fill('#fichaTexto','o botão de gerar não aparece no meu Firefox');
  await pg5.locator('#fichaEnviar').click(); await pg5.waitForTimeout(500);
  const href = await pg5.evaluate(() => window.__ultimoEmail || '');
  const u = href.startsWith('mailto:') ? new URL(href) : null;
  const corpo = u ? (u.searchParams.get('body') || '') : '';
  console.log('     ' + href.slice(0, 120));
  ok('abriu o e-mail endereçado ao suporte', !!u && u.pathname === 'suporte@walkstamp.com', href.slice(0, 60));
  ok('com o tipo no assunto — nota baixa é problema', !!u && /Problema/.test(u.searchParams.get('subject') || ''),
     u ? u.searchParams.get('subject') : '');
  ok('com o texto', /Firefox/.test(corpo), corpo.slice(0, 60));
  ok('e a nota do NPS junto', /3\/10/.test(corpo), corpo.slice(-60));
  ok('a tela diz o que aconteceu', /programa de e-mail/.test(await pg5.locator('#fichaMsg').textContent()),
     await pg5.locator('#fichaMsg').textContent());
  ok('nenhum pedido HTTP no caminho', http.length === 0, http.join(' | '));
  ok('e não há mais consulta de chamado nem tempo de resposta',
     (await pg5.locator('#fichaConsulta, #fichaTempo, #fichaTrocar').count()) === 0);
  await pg5.close();
}

console.log('\n[7] a ficha está nas três línguas');
for (const [u, marca] of [['/en/','Give feedback'],['/es/','Dar tu opinión']]) {
  const p4 = await (await br.newContext({viewport:{width:1100,height:800}})).newPage();
  const r = await p4.goto(BASE+u);
  await p4.waitForTimeout(400);
  ok(u+': a aba está traduzida', (await p4.locator('#fichaAba').textContent()) === marca,
     await p4.locator('#fichaAba').textContent());
  await p4.close();
}
/* [tempo] saiu no Build 71: o tempo médio de resposta vinha do banco, e o
   banco saiu. A regra que ele defendia continua valendo por omissão — não há
   prazo prometido em lugar nenhum. */

ok('sem erro de JS', erros.length===0, erros.join(' | ').slice(0,150));
await br.close(); srv.close();
console.log(falhas?'\n'+falhas+' falha(s)':'\nFicha e NPS: tudo passou.');
process.exit(falhas?1:0);

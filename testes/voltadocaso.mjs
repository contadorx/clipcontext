/* A VOLTA DO CASO — e o formato de onde ela não saía.
 *
 * Quem executa uma rodada paga chega pelo link do caso: `/app?...&rot=1013`. A
 * ferramenta mostra "você veio do caso CT-13", a pessoa grava, gera o
 * documento — e só ENTÃO aparece o botão que marca o caso como feito, levando
 * o nome do arquivo e a impressão das telas. É esse botão que fecha a rodada.
 *
 * O botão nascia dentro do `baixarBlob()`, por onde passam DOCX, PPTX, ZIP,
 * SCORM, HTML e Markdown. O PDF não passa por lá: ele sai pelo `doc.save()`, a
 * porta do próprio jsPDF. Resultado, e ninguém tinha visto:
 *
 *   quem chegava por um caso do cenário EVIDÊNCIA — onde o PDF é a saída
 *   RECOMENDADA, o botão grande que o produto pede para clicar — gerava o
 *   documento e não recebia a volta. A rodada paga não fechava pelo seu
 *   próprio caminho principal.
 *
 * Não dava erro em lugar nenhum: o PDF baixava, o painel dizia "pronto", e o
 * botão simplesmente não existia. A pessoa concluía que precisava avisar o
 * coordenador na mão — que é exatamente o trabalho que o plano vende ter
 * eliminado.
 *
 * O mesmo lugar já tinha sido remendado uma vez pelo mesmo motivo: o comentário
 * ao lado do `doc.save()` conta que sem uma linha ali o PDF era "a única saída
 * do produto que não contava que tinha saído". Consertaram a medição e não a
 * volta. Este arquivo cobra as DUAS portas, para a terceira não repetir.
 *
 *   node testes/voltadocaso.mjs
 */
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs';
import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';

const html = fs.readFileSync(RAIZ_WS + '/public/app.html', 'utf8');
const jspdf = fs.readFileSync(RAIZ_WS + '/vendor/jspdf.umd.min.js', 'utf8');
const srv = http.createServer((q, r) => {
  if (q.url.startsWith('/_vercel/')) { r.writeHead(200, { 'Content-Type': 'text/javascript' }); return r.end(''); }
  r.writeHead(200, { 'Content-Type': 'text/html' }); r.end(html);
});
await new Promise((r) => srv.listen(8986, r));

let falhas = 0;
const ok = (n, c, e) => { console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : '')); if (!c) falhas++; };

const br = await chromium.launch({ executablePath: CHROME_WS });
const ctx = await br.newContext({ viewport: { width: 1250, height: 980 }, acceptDownloads: true });
const pg = await ctx.newPage();
const erros = []; pg.on('pageerror', (e) => erros.push(e.message));
await pg.route('**/rpc/*stamp_*', r => r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, body: 'null' }));
await pg.route('**/jspdf**', r => r.fulfill({ status: 200,
  headers: { 'content-type': 'text/javascript', 'access-control-allow-origin': '*' }, body: jspdf }));

const CASO = 1013;
const ROT = `?lang=pt&caso=CT-13%20%E2%80%94%20Enviar%20para%20aprova%C3%A7%C3%A3o`
          + `&sistema=Portal&chamado=REQ-4113&rot=${CASO}`;

/* O material vem do vídeo de amostra e da extração de verdade — o mesmo
   caminho de `saidarec.mjs`. Plantar quadros direto no estado não é opção:
   `frames` mora dentro do fechamento do aplicativo, e `frames` no escopo da
   página é o `window.frames` do navegador, que é outra coisa. Custa vinte
   segundos por formato e prova o percurso inteiro, que é o que interessa. */
async function comQuadros(modelo) {
  await pg.goto(`http://localhost:8986/app.html${ROT}&modelo=${modelo}`);
  await pg.waitForTimeout(400);
  await pg.setInputFiles('#file', '/tmp/amostra.webm');
  await pg.waitForFunction(() => !document.getElementById('extract').disabled,
                           null, { timeout: 60000 });
  await pg.locator('#extract').click();
  await pg.waitForFunction(() => document.querySelectorAll('#thumbs figure').length >= 2,
                           null, { timeout: 120000 });
  await pg.waitForTimeout(400);
}

const voltou = async () => pg.evaluate(() => {
  const c = document.getElementById('rotVolta');
  const a = c && c.querySelector('a');
  return { visivel: !!c && !c.classList.contains('hide'), href: a ? a.getAttribute('href') : '' };
});

console.log('[1] a ferramenta diz de onde a pessoa veio');
{
  await comQuadros('evidencia');
  const vindo = await pg.evaluate(() => {
    const e = document.getElementById('rotVindo');
    return { visivel: !!e && !e.classList.contains('hide'), txt: (e && e.textContent) || '' };
  });
  ok('o aviso do caso aparece', vindo.visivel);
  ok('  e nomeia o caso', /CT-13/.test(vindo.txt), vindo.txt.slice(0, 70));
  const antes = await voltou();
  ok('e a volta AINDA NÃO existe — não há documento para marcar', !antes.visivel);
}

/* ---- [2] as duas portas de saída ----------------------------------------
   `pdf` sai pelo `doc.save()` do jsPDF; `docx` sai pelo `baixarBlob()`. São
   caminhos diferentes no código, e é essa diferença que abriu o buraco. */
for (const [formato, botao, modelo] of [['pdf', '#go', 'evidencia'],
                                        ['docx', '#docx', 'instrucao']]) {
  console.log(`\n[2.${formato}] o ${formato.toUpperCase()} oferece a volta do caso`);
  await comQuadros(modelo);
  const baixou = pg.waitForEvent('download', { timeout: 60000 }).catch(() => null);
  await pg.evaluate((sel) => document.querySelector(sel).click(), botao);
  const d = await baixou;
  ok(`o documento sai`, !!d, d ? d.suggestedFilename() : 'nenhum download');
  await pg.waitForFunction(() => {
    const c = document.getElementById('rotVolta');
    return c && !c.classList.contains('hide');
  }, null, { timeout: 30000 }).catch(() => {});
  const v = await voltou();
  ok(`e a volta do caso aparece`, v.visivel);
  ok(`  apontando para o caso ${CASO}`, new RegExp(`marcar=${CASO}\\b`).test(v.href),
     v.href.slice(0, 90));
  ok(`  com o nome do arquivo`, /[?&]arq=[^&]+\./.test(v.href),
     (/[?&]arq=([^&]*)/.exec(v.href) || [])[1] || '(sem arq)');
  ok(`  e com a impressão das telas`, /[?&]imp=[0-9a-f]{8,}/.test(v.href),
     (/[?&]imp=([^&]*)/.exec(v.href) || [])[1] || '(sem imp)');
}

/* ---- [3] sem `rot=`, nada disso aparece ---------------------------------
   Um botão de "marcar como feito" numa aba que não veio de caso nenhum é um
   link para uma tela que a pessoa não sabe o que é. */
console.log('\n[3] sem vir de um caso, a volta não existe');
{
  await pg.goto('http://localhost:8986/app.html?lang=pt&modelo=evidencia');
  await pg.waitForTimeout(400);
  const vindo = await pg.evaluate(() =>
    !document.getElementById('rotVindo').classList.contains('hide'));
  ok('nenhum aviso de caso', !vindo);
  const v = await voltou();
  ok('e nenhuma volta', !v.visivel);
}

ok('nenhum erro de página', erros.length === 0, erros.slice(0, 2).join(' | '));
await br.close(); srv.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nA volta do caso: tudo passou.');
process.exit(falhas ? 1 : 0);

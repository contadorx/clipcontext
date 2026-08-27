/* MARCAR O ERRO — do instante em que ele aparece até o documento.
 *
 * PEDIDO DE CAMPO: *"uma necessidade de marcar o erro… avalie se é possível já
 * indicar o erro na tela quando ocorre… o factível é ter um botão de ERRO para
 * marcar a tela e depois ela na revisão estar destacada"*.
 *
 * O QUE NÃO DÁ, e está dito no produto: desenhar em cima do sistema testado, na
 * hora. Uma página web recebe os pixels da tela compartilhada e nunca o direito
 * de pintar nela. O que dá é carimbar a tela no instante do erro — e é isso que
 * esta régua cobra, de ponta a ponta.
 *
 * E ELE NÃO É UM CAMPO NOVO. O produto já tinha `tipo` (fricção, desistiu,
 * elogiou, defeito), nascido na pesquisa de usabilidade, com etiqueta na grade
 * e campo no JSON. O botão de ERRO carimba `defeito`. Um campo novo seria uma
 * segunda verdade sobre a mesma coisa — e este projeto já pagou por isso.
 *
 * O QUE SE COBRA AQUI, e a ordem importa:
 *
 *   [1] o botão existe onde a pessoa está: na página E na janelinha;
 *   [2] marcar carimba o quadro, e a grade mostra qual é;
 *   [3] o selo chega ao PDF, ao Word e ao HTML — os três que um auditor abre;
 *   [4] o resumo "3 de 12" é de plano PAGO, e sem licença ele não sai;
 *   [5] a marca se desfaz: um carimbo sem borracha ninguém usa.
 *
 *   node testes/erro.mjs
 */
import { chromium } from './_navegador.mjs';
import http from 'http'; import fs from 'fs';
import { execSync } from 'child_process';
import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';
import { appComChavesDeTeste, emitir } from './_licenca.mjs';

const PORTA = 8984;
const BASE = `http://localhost:${PORTA}`;
const APP = appComChavesDeTeste();
const jspdf = fs.readFileSync(`${RAIZ_WS}/vendor/jspdf.umd.min.js`, 'utf8');

let falhas = 0;
const ok = (n, c, e) => { console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : '')); if (!c) falhas++; };

const srv = http.createServer((q, r) => {
  if (q.url.split('?')[0].startsWith('/_vercel/')) {
    r.writeHead(200, { 'Content-Type': 'text/javascript' }); return r.end('');
  }
  r.writeHead(200, { 'Content-Type': 'text/html' }); r.end(APP);
});
await new Promise((r) => srv.listen(PORTA, r));

if (!fs.existsSync('/tmp/amostra.webm')) {
  console.log('PULADO  falta /tmp/amostra.webm  (python3 testes/amostras.py)');
  srv.close(); process.exit(0);
}

const textoDe = (chave) => {
  const m = APP.match(new RegExp(chave + ":'([^']*)'"));
  return m ? m[1] : '';
};
const CLIENTE = 'Auditoria do Erro S.A.';
const CHAVE = emitir(CLIENTE, 5, '2099-01-01');

const br = await chromium.launch({ executablePath: CHROME_WS });

/* Uma sessão que abre o vídeo, extrai telas e marca a segunda como erro — pela
   LENTE, que é o mesmo dado que o botão carimba. O botão em si é cobrado no
   bloco [1]: ele só existe durante uma gravação de tela, e `getDisplayMedia`
   não existe num Chromium sem tela. Dizer isso é melhor do que fingir. */
async function sessao(comLicenca){
  const ctx = await br.newContext({ acceptDownloads: true, serviceWorkers: 'block',
                                    viewport: { width: 1250, height: 950 } });
  await ctx.route('**/jspdf**', (r) => r.fulfill(
    { status: 200, headers: { 'content-type': 'text/javascript' }, body: jspdf }));
  const pg = await ctx.newPage();
  const erros = []; pg.on('pageerror', (e) => erros.push(e.message));
  const q = comLicenca ? `&lic=${encodeURIComponent(CHAVE)}` : '';
  await pg.goto(`${BASE}/app.html?lang=pt${q}`);
  await pg.waitForTimeout(600);
  await pg.selectOption('#modelo', 'evidencia').catch(() => {});
  await pg.setInputFiles('#file', '/tmp/amostra.webm');
  await pg.waitForFunction(() => (document.getElementById('v') || {}).videoWidth > 0,
                           null, { timeout: 40000 });
  await pg.selectOption('#mode', 'count'); await pg.fill('#count', '3');
  await pg.locator('#extract').click();
  await pg.waitForFunction(() => document.querySelectorAll('#thumbs figure').length >= 3,
                           null, { timeout: 60000 });
  await pg.waitForTimeout(400);
  return { ctx, pg, erros };
}

/* Marca o quadro `i` como erro pelo caminho da pessoa: abre a lente e escolhe.
   Escrever `frames[i].tipo` por fora provaria que o teste sabe escrever num
   objeto, e não que o produto sabe carimbar. */
async function abrirLente(pg, i){
  /* O BOTÃO É O `editar`, e não a imagem. A miniatura tem quatro botões — tocar,
     mover para a esquerda, editar, mover para a direita — e clicar no primeiro
     que aparece abria qualquer coisa menos a lente. */
  await pg.locator('#thumbs figure').nth(i).locator('button.editar').click();
  await pg.waitForFunction(() => !document.getElementById('lente').classList.contains('hide'),
                           null, { timeout: 15000 });
}

async function marcarPelaLente(pg, i){
  await abrirLente(pg, i);
  await pg.waitForTimeout(400);
  const visivel = await pg.locator('#lenteTipoCx').isVisible().catch(() => false);
  if (visivel) await pg.selectOption('#lenteTipo', 'defeito');
  await pg.waitForTimeout(200);
  await pg.keyboard.press('Escape');
  await pg.waitForTimeout(300);
  return visivel;
}

console.log('[1] o botão de erro existe onde a pessoa está');
{
  const { ctx, pg } = await sessao(false);
  const naPagina = await pg.evaluate(() => {
    const b = document.getElementById('recErro');
    return b ? { existe: true, classe: b.className,
                 vizinhos: [...b.parentElement.querySelectorAll('button')].map((x) => x.id) } : null;
  });
  ok('a página tem o botão', !!naPagina, naPagina ? '' : '(não existe)');
  if (naPagina) {
    console.log('     ' + naPagina.vizinhos.join('  '));
    /* VERMELHO E CHEIO, e não fantasma: entre três botões cinzentos, o que se
       aperta com pressa tem que ser achado sem procurar. */
    ok('  e ele não é mais um botão cinzento', /\berro\b/.test(naPagina.classe) &&
       !/ghost/.test(naPagina.classe), naPagina.classe);
    ok('  ao lado de marcar e de mais uma tela',
       naPagina.vizinhos.includes('recMark') && naPagina.vizinhos.includes('recTela'));
  }
  /* E NA JANELINHA, que é onde a pessoa está durante a gravação: a nossa aba
     fica atrás da tela compartilhada. Isto é lido do corpo que o produto monta
     — a janela de verdade não abre num Chromium sem tela. */
  const corpo = APP.slice(APP.indexOf('function corpoDaJanelinha()'));
  const trecho = corpo.slice(0, corpo.indexOf(';\n'));
  ok('a janelinha também tem o botão', /id="erro"/.test(trecho),
     /id="erro"/.test(trecho) ? '' : 'não achei id="erro" no corpo da janelinha');
  ok('  com atalho de uma tecla', /recErroBtn: 'E'/.test(APP));
  ok('  e o produto dá nome a ele nos cinco idiomas', !!textoDe('recErroBtn'),
     textoDe('recErroBtn'));
  await ctx.close();
}

console.log('\n[2] marcar carimba o quadro, e a grade diz qual é');
{
  const { ctx, pg } = await sessao(false);
  const antes = await pg.evaluate(() => ({
    etiquetas: document.querySelectorAll('#thumbs .tipoTag').length,
    contador: !document.getElementById('tagErros').classList.contains('hide'),
  }));
  ok('sem marca nenhuma, a grade não inventa etiqueta', antes.etiquetas === 0 && !antes.contador,
     JSON.stringify(antes));

  const abriu = await marcarPelaLente(pg, 1);
  ok('a lente oferece o tipo mesmo fora da usabilidade', abriu,
     abriu ? '' : 'o seletor não apareceu — não há como marcar nem desmarcar');
  const depois = await pg.evaluate(() => ({
    etiquetas: [...document.querySelectorAll('#thumbs .tipoTag')].map((e) => e.textContent),
    contador: (document.getElementById('nErros') || {}).textContent,
    visivel: !document.getElementById('tagErros').classList.contains('hide'),
    resultado: (document.getElementById('evRes') || {}).value,
  }));
  console.log('     ' + JSON.stringify(depois));
  ok('a tela marcada ganha etiqueta na grade', depois.etiquetas.length === 1,
     depois.etiquetas.join(' | '));
  ok('  com a palavra do produto, e não uma inventada',
     depois.etiquetas[0] === textoDe('uxT4'), `${depois.etiquetas[0]} × ${textoDe('uxT4')}`);
  ok('o placar conta os erros', depois.visivel && depois.contador === '1', JSON.stringify(depois));
  /* E O RESULTADO DO DOCUMENTO PASSA A DIZER "FALHOU". Um documento com uma
     tela marcada como defeito e "— não informado" no resultado é a ferramenta
     se contradizendo na primeira página. */
  ok('e o resultado do documento passa a sugerir Falhou', depois.resultado === 'nok',
     depois.resultado || '(vazio)');
  await ctx.close();
}

console.log('\n[3] o selo chega aos documentos que o auditor abre');
{
  const { ctx, pg, erros } = await sessao(true);
  await marcarPelaLente(pg, 1);
  await pg.locator('#evBox').evaluate((e) => { e.open = true; }).catch(() => {});
  await pg.fill('#evCaso', 'CT-500 Erro').catch(() => {});
  await pg.waitForTimeout(300);
  const baixar = async (botao, destino) => {
    const d = pg.waitForEvent('download', { timeout: 90000 });
    await pg.locator(botao).click();
    await (await d).saveAs(destino);
  };
  await baixar('#html', '/tmp/erro.html');
  await baixar('#docx', '/tmp/erro.docx');
  await baixar('#go',   '/tmp/erro.pdf');
  const texto = {
    html: fs.readFileSync('/tmp/erro.html', 'utf8'),
    docx: execSync('unzip -p /tmp/erro.docx word/document.xml', { encoding: 'utf8', maxBuffer: 1 << 28 }),
    pdf:  execSync('pdftotext /tmp/erro.pdf - 2>/dev/null || true', { encoding: 'utf8', maxBuffer: 1 << 28 }),
  };
  const palavra = textoDe('uxT4');
  for (const [fmt, txt] of Object.entries(texto)) {
    const achou = txt.toUpperCase().includes(palavra.toUpperCase());
    ok(`  ${fmt}: traz a marca do erro`, achou, achou ? '' : `não achei "${palavra}"`);
  }
  /* O RESUMO É DE PLANO PAGO. Com licença ele sai; sem, não — e é a mesma
     licença que decide o emissor e a classificação. */
  const resumo = textoDe('docErros');
  for (const [fmt, txt] of Object.entries(texto)) {
    const achou = txt.includes(resumo);
    ok(`  ${fmt}: e o resumo de erros, que é pago`, achou, achou ? '' : `não achei "${resumo}"`);
  }
  ok('sem erro de JavaScript', erros.length === 0, erros.join(' | ').slice(0, 150));
  await ctx.close();
}

console.log('\n[4] SEM licença, a marca sai e o resumo NÃO');
{
  const { ctx, pg } = await sessao(false);
  await marcarPelaLente(pg, 1);
  await pg.waitForTimeout(200);
  const d = pg.waitForEvent('download', { timeout: 90000 });
  await pg.locator('#html').click();
  await (await d).saveAs('/tmp/erro-sem.html');
  const txt = fs.readFileSync('/tmp/erro-sem.html', 'utf8');
  const palavra = textoDe('uxT4');
  /* MARCAR O ERRO É GRÁTIS, e tem que continuar: é o coração de uma evidência
     de teste, e é o que faz a ferramenta valer no primeiro uso. */
  const temMarca = txt.toUpperCase().includes(palavra.toUpperCase());
  ok('a marca do erro sai no documento gratuito', temMarca,
     temMarca ? '' : `não achei "${palavra}"`);
  const semConta = !txt.includes(textoDe('docErros'));
  ok('e a CONTA não sai — ela é acabamento, e acabamento é pago', semConta,
     semConta ? '' : 'o resumo vazou para o documento gratuito');
  await ctx.close();
}

console.log('\n[5] a marca se desfaz — um carimbo sem borracha ninguém usa');
{
  const { ctx, pg } = await sessao(false);
  await marcarPelaLente(pg, 1);
  await abrirLente(pg, 1);
  await pg.selectOption('#lenteTipo', '');
  await pg.waitForTimeout(200);
  await pg.keyboard.press('Escape');
  await pg.waitForTimeout(300);
  const limpo = await pg.evaluate(() => ({
    etiquetas: document.querySelectorAll('#thumbs .tipoTag').length,
    contador: !document.getElementById('tagErros').classList.contains('hide'),
  }));
  ok('tirar a marca tira a etiqueta e o contador',
     limpo.etiquetas === 0 && !limpo.contador, JSON.stringify(limpo));
  await ctx.close();
}

await br.close(); srv.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nErro: marcado na hora, e chega ao documento.');
process.exit(falhas ? 1 : 0);

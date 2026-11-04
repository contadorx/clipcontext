/* O EMISSOR E A CLASSIFICAÇÃO CHEGAM AO DOCUMENTO.
 *
 * São duas balas do cartão Team, e as duas estavam listadas no
 * `AUDITORIA-PENDENTE.md` como "sem teste". Medindo, a lista estava meio certa:
 * `matriz.mjs` cobre de onde o emissor VEM (um campo, e não um e-mail) e que
 * a classificação é desenhada no rodapé; `miudos.mjs` cobre a classificação no
 * prompt. Nenhuma das duas abre o arquivo gerado.
 *
 * E essa é a diferença que importa aqui. Afirmação sobre o TEXTO DA FONTE prova
 * que alguém escreveu a linha; só abrir o documento prova que o campo chega ao
 * arquivo que vai para o auditor. Este projeto já pagou por essa distinção
 * quatro vezes — a última foi uma régua que aprovou o produto com o caminho
 * inteiro desligado por um `if (false)`.
 *
 * ATÉ O BUILD 68 OS DOIS ERAM DE TEAM, e a régua cobrava que apareciam com
 * licença e sumiam sem ela. No 69 o Walkstamp ficou inteiramente grátis: o
 * emissor virou um campo que a pessoa escreve, e a classificação, um seletor à
 * vista de todo mundo. Os dois lados continuam cobrados, só que a fronteira
 * mudou de lugar — preenchido, chega ao documento; vazio, não inventa nada.
 *
 *   node testes/emissor.mjs
 */
import { chromium } from './_navegador.mjs';
import http from 'http'; import fs from 'fs';
import { execSync } from 'child_process';
import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';
const APP = fs.readFileSync(`${RAIZ_WS}/public/app.html`, 'utf8');
const jspdf = fs.readFileSync(`${RAIZ_WS}/vendor/jspdf.umd.min.js`, 'utf8');
const srv = http.createServer((q, r) => {
  if (q.url.split('?')[0].startsWith('/_vercel/')) {
    r.writeHead(200, {'Content-Type':'text/javascript'}); return r.end('');
  }
  r.writeHead(200, {'Content-Type':'text/html'}); r.end(APP);
});
await new Promise((r) => srv.listen(8992, r));

let falhas = 0;
const ok = (n, c, e) => { console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : '')); if (!c) falhas++; };

if (!fs.existsSync('/tmp/amostra.webm')) {
  console.log('PULADO  falta /tmp/amostra.webm  (python3 testes/amostras.py)');
  srv.close(); process.exit(0);
}

const CLIENTE = 'Auditoria Interna S.A.';

const br = await chromium.launch({ executablePath: CHROME_WS });

/* Uma sessão que gera os três documentos. `preencher` decide se o emissor e a
   classificação são escritos — é a única diferença entre os dois lados. */
async function gerar(preencher){
  const ctx = await br.newContext({ acceptDownloads: true, serviceWorkers: 'block',
                                    viewport: { width: 1250, height: 950 } });
  await ctx.route('**/jspdf**', (r) => r.fulfill(
    { status: 200, headers: { 'content-type': 'text/javascript' }, body: jspdf }));
  const pg = await ctx.newPage();
  const erros = []; pg.on('pageerror', (e) => erros.push(e.message));
  await pg.goto('http://localhost:8992/app.html?lang=pt');
  await pg.waitForTimeout(600);
  await pg.selectOption('#modelo', 'evidencia').catch(() => {});
  await pg.setInputFiles('#file', '/tmp/amostra.webm');
  await pg.waitForFunction(() => (document.getElementById('v') || {}).videoWidth > 0,
                           null, { timeout: 40000 });
  await pg.selectOption('#mode', 'count'); await pg.fill('#count', '2');
  await pg.locator('#extract').click();
  await pg.waitForFunction(() => document.querySelectorAll('#thumbs figure').length >= 2,
                           null, { timeout: 60000 });
  await pg.waitForTimeout(500);

  /* A classificação é um seletor do bloco de identificação, e ele nasce
     recolhido — o `_navegador.mjs` abre os `details`, mas o valor é escolhido
     aqui. Sem escolher, a classificação sai vazia e a régua mediria a ausência
     achando que mede o produto. */
  await pg.locator('#evBox').evaluate((e) => { e.open = true; }).catch(() => {});
  await pg.fill('#evCaso', 'CT-900 Emissão').catch(() => {});
  /* `#clsRow` À VISTA SEM PLANO NENHUM — desde o Build 69. A visibilidade
     continua sendo parte da afirmação: um seletor escondido seria um recurso
     grátis que ninguém acha. */
  const clsVisivel = await pg.locator('#clsRow').isVisible().catch(() => false);
  let cls = '';
  if (preencher) {
    await pg.fill('#docEmissorCampo', CLIENTE);
    if (clsVisivel) {
      await pg.selectOption('#docClass', 'Conf').catch(() => {});
      cls = (await pg.locator('#docClass option:checked').textContent() || '').trim();
    }
  }
  await pg.waitForTimeout(300);

  const baixar = async (botao, destino) => {
    const d = pg.waitForEvent('download', { timeout: 90000 });
    await pg.locator(botao).click();
    await (await d).saveAs(destino);
  };
  const suf = preencher ? 'com' : 'sem';
  await baixar('#html', `/tmp/em-${suf}.html`);
  await baixar('#docx', `/tmp/em-${suf}.docx`);
  await baixar('#go',   `/tmp/em-${suf}.pdf`);

  /* O EMISSOR FICA LEMBRADO NESTE NAVEGADOR: era a conta que lembrava, e a
     conta saiu. Recarregar a página é o teste de que alguém lembra. */
  let lembrado = '';
  if (preencher) {
    await pg.reload();
    await pg.waitForTimeout(500);
    lembrado = await pg.locator('#docEmissorCampo').inputValue().catch(() => '');
  }
  await ctx.close();
  return { suf, cls, clsVisivel, lembrado, erros };
}

const texto = {
  html: (f) => fs.readFileSync(f, 'utf8'),
  docx: (f) => execSync(`unzip -p ${f} word/document.xml`, { encoding: 'utf8', maxBuffer: 1 << 28 }),
  pdf:  (f) => execSync(`pdftotext ${f} - 2>/dev/null || true`, { encoding: 'utf8', maxBuffer: 1 << 28 }),
};

console.log('[1] preenchido, o emissor entra nos três documentos — sem plano nenhum');
const com = await gerar(true);
console.log(`     classificação escolhida: ${JSON.stringify(com.cls)}`);
ok('o seletor de classificação aparece sem plano', com.clsVisivel);
ok('o emissor fica lembrado neste navegador', com.lembrado === CLIENTE, com.lembrado);
for (const [fmt, arq] of [['html', '/tmp/em-com.html'], ['docx', '/tmp/em-com.docx'],
                          ['pdf', '/tmp/em-com.pdf']]) {
  const t = texto[fmt](arq);
  ok(`  ${fmt}: traz o emissor`, t.includes(CLIENTE),
     t.includes(CLIENTE) ? '' : `não achei "${CLIENTE}"`);
}

console.log('\n[2] e a classificação também');
if (!com.cls) {
  console.log('  BLOCO PULADO  este cenário não oferece seletor de classificação');
} else {
  for (const [fmt, arq] of [['html', '/tmp/em-com.html'], ['docx', '/tmp/em-com.docx'],
                            ['pdf', '/tmp/em-com.pdf']]) {
    const t = texto[fmt](arq).toUpperCase();
    const achou = t.includes(com.cls.toUpperCase());
    ok(`  ${fmt}: traz a classificação`, achou, achou ? '' : `não achei "${com.cls}"`);
  }
}

console.log('\n[3] VAZIO, o emissor não sai — o documento não inventa quem emitiu');
const sem = await gerar(false);
for (const [fmt, arq] of [['html', '/tmp/em-sem.html'], ['docx', '/tmp/em-sem.docx'],
                          ['pdf', '/tmp/em-sem.pdf']]) {
  const t = texto[fmt](arq);
  ok(`  ${fmt}: não traz emissor nenhum`, !t.includes(CLIENTE),
     !t.includes(CLIENTE) ? '' : 'o nome apareceu sem ninguém ter escrito');
  /* E SEM CLASSIFICAÇÃO ESCOLHIDA, NENHUMA TARJA: o seletor está à vista,
     mas "nenhuma" é a escolha de partida. */
  const T = t.toUpperCase();
  ok(`  ${fmt}: não traz tarja de classificação`, !/CONFIDENCIAL|RESTRITO/.test(T));
}

ok('sem erro de JavaScript', com.erros.length === 0 && sem.erros.length === 0,
   [...com.erros, ...sem.erros].join(' | ').slice(0, 160));

await br.close(); srv.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nEmissor e classificação: tudo passou.');
process.exit(falhas ? 1 : 0);

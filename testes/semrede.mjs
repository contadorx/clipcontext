/* "TUDO PROCESSADO NO SEU COMPUTADOR" — a promessa do cartão gratuito, medida
 * na FERRAMENTA e não na página que a anuncia.
 *
 * O que existia antes: `precos.mjs` prova que a PÁGINA de preços não chama a
 * rede, e `terceiros.mjs` prova que a lista de suboperadores publicada é a
 * verdadeira. Nenhum dos dois abre o app. A promessa mais forte do cartão
 * gratuito — a que mais dói se falhar — não tinha régua na ferramenta.
 *
 * E ela NÃO é "o app não usa rede". Usa, e tem de usar: o modelo de transcrição
 * desce de um repositório público, o OCR desce de um CDN, a licença é conferida
 * contra a conta, e um punhado de eventos de uso é contado. A promessa é sobre
 * a DIREÇÃO do que atravessa o fio:
 *
 *     desce   modelo, OCR, biblioteca de PDF, resposta de licença
 *     sobe    NADA que seja vídeo, áudio, quadro ou transcrição
 *
 * Então esta régua mede as duas metades, e a primeira é a que vale:
 *
 *   [1] com o mundo lá fora CORTADO — todo pedido que não seja para esta
 *       máquina é abortado — a evidência sai inteira, nos três formatos. Se
 *       alguma etapa dependesse de um servidor, ela morreria aqui.
 *   [2] nada do que o app tentou mandar para fora levava mídia junto: cada
 *       corpo de pedido externo é lido e pesado, e a régua IMPRIME a lista dos
 *       destinos para quem for auditar.
 *   [3] os quadros existem em memória durante tudo isso — a régua confere que
 *       havia o que vazar. Uma sessão vazia não prova sigilo nenhum.
 *
 *   node testes/semrede.mjs
 */
import { chromium } from './_navegador.mjs';
import http from 'http'; import fs from 'fs'; import path from 'path';
import { execSync } from 'child_process';
import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';

const PORTA = 8991;
const LOCAL = `http://localhost:${PORTA}`;
const APP = fs.readFileSync(`${RAIZ_WS}/public/app.html`, 'utf8');

let falhas = 0;
const ok = (n, c, e) => { console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : '')); if (!c) falhas++; };

/* O SERVIDOR SERVE O QUE UM SERVIDOR DE VERDADE SERVIRIA, e nada além. Os
   outros testes devolvem o `app.html` para qualquer endereço, o que é prático e
   aqui seria desonesto: se `/vendor/jspdf` voltasse como HTML, o teste estaria
   inventando um mundo em que o app tem menos dependências do que tem. */
const srv = http.createServer((q, r) => {
  const rota = q.url.split('?')[0];
  if (rota.startsWith('/vendor/')) {
    const arq = path.join(RAIZ_WS, rota.replace(/^\//, ''));
    if (fs.existsSync(arq)) {
      r.writeHead(200, { 'Content-Type': 'text/javascript' });
      return r.end(fs.readFileSync(arq));
    }
  }
  if (rota.startsWith('/_vercel/')) { r.writeHead(200, { 'Content-Type': 'text/javascript' }); return r.end(''); }
  if (rota === '/app.html' || rota === '/') {
    r.writeHead(200, { 'Content-Type': 'text/html' }); return r.end(APP);
  }
  r.writeHead(404); r.end('');
});
await new Promise((r) => srv.listen(PORTA, r));

if (!fs.existsSync('/tmp/amostra.webm')) {
  console.log('PULADO  falta /tmp/amostra.webm  (python3 testes/amostras.py)');
  srv.close(); process.exit(0);
}

const jspdf = fs.readFileSync(`${RAIZ_WS}/vendor/jspdf.umd.min.js`, 'utf8');
const br = await chromium.launch({ executablePath: CHROME_WS });
const ctx = await br.newContext({ acceptDownloads: true, serviceWorkers: 'block',
                                  viewport: { width: 1250, height: 950 } });

/* ---- A TESOURA, e o caderno ---------------------------------------------- */

const foraDaMaquina = [];        // tudo que apontou para fora, com corpo e tudo
const dentro = [];

/* O jspdf tem rota própria porque em produção ele é servido pela MESMA origem
   (`/vendor/…`) e por um CDN quando aquele falha. Aqui ele vem do disco: é
   biblioteca, não é dado, e baixá-la não é vazar nada. */
await ctx.route('**/*', async (rota) => {
  const req = rota.request();
  const url = req.url();
  if (/jspdf/i.test(url) && !url.startsWith(LOCAL)) {
    return rota.fulfill({ status: 200, headers: { 'content-type': 'text/javascript' }, body: jspdf });
  }
  if (url.startsWith(LOCAL) || url.startsWith('data:') || url.startsWith('blob:')) {
    dentro.push(url); return rota.continue();
  }
  /* O CORPO É LIDO ANTES DE CORTAR. Cortar sem ler provaria só que a rede foi
     cortada — e a pergunta não é essa. A pergunta é o que ele TENTOU mandar. */
  let corpo = '';
  try { corpo = req.postData() || ''; } catch { corpo = '(não legível)'; }
  foraDaMaquina.push({ url, metodo: req.method(), bytes: corpo.length, corpo: corpo.slice(0, 4000),
                       tipo: (req.headers()['content-type'] || '') });
  return rota.abort();
});

const pg = await ctx.newPage();
const erros = []; pg.on('pageerror', (e) => erros.push(e.message));

console.log('[1] com o mundo cortado, a evidência sai inteira');
await pg.goto(`${LOCAL}/app.html?lang=pt`);
await pg.waitForTimeout(600);
await pg.selectOption('#modelo', 'evidencia').catch(() => {});
await pg.setInputFiles('#file', '/tmp/amostra.webm');
await pg.waitForFunction(() => (document.getElementById('v') || {}).videoWidth > 0, null, { timeout: 40000 });
await pg.selectOption('#mode', 'count'); await pg.fill('#count', '3');
await pg.locator('#extract').click();
await pg.waitForFunction(() => document.querySelectorAll('#thumbs figure').length >= 3,
                         null, { timeout: 60000 });
await pg.waitForTimeout(400);
await pg.locator('#evBox').evaluate((e) => { e.open = true; }).catch(() => {});
await pg.fill('#evCaso', 'CT-777 Sem rede').catch(() => {});

/* O DOWNLOAD QUE NÃO VEM É UMA AFIRMAÇÃO, E NÃO UM ACIDENTE. Se alguma etapa
   passar a depender de um servidor, é aqui que ela morre — e morrer com um
   rastro de pilha faria a esteira contar "FALHOU" sem dizer o que falhou. O
   tempo curto é de propósito: com a rede cortada, ou o arquivo sai em segundos
   ou não sai. */
const baixar = async (botao, destino) => {
  try {
    const d = pg.waitForEvent('download', { timeout: 45000 });
    await pg.locator(botao).click();
    await (await d).saveAs(destino);
    return fs.statSync(destino).size;
  } catch (e) {
    ok(`o arquivo de ${botao} saiu com o mundo cortado`, false,
       'o download não veio — alguma etapa depende de um servidor');
    return 0;
  }
};

/* OS ARQUIVOS DA CORRIDA PASSADA MORREM ANTES DESTA. Sem esta linha a régua
   tinha um buraco que ela mesma mostrou: com o download falhando, as afirmações
   de conteúdo abaixo liam o arquivo da corrida ANTERIOR e passavam. Um verde
   lido de um arquivo velho é a pior espécie de verde. */
for (const f of ['/tmp/sr.html', '/tmp/sr.docx', '/tmp/sr.pdf']) fs.rmSync(f, { force: true });

const nHtml = await baixar('#html', '/tmp/sr.html');
const nDocx = await baixar('#docx', '/tmp/sr.docx');
const nPdf  = await baixar('#go',   '/tmp/sr.pdf');
console.log(`     tamanhos: html ${nHtml} · docx ${nDocx} · pdf ${nPdf} bytes`);

/* TAMANHO NÃO É PROVA — um arquivo grande e vazio continua vazio. O que se
   cobra é o conteúdo: o caso digitado e as três imagens dentro de cada um. */
const ler = (n, f) => (n > 0 && fs.existsSync(f)) ? f : '';
const htmlTxt = ler(nHtml, '/tmp/sr.html') ? fs.readFileSync('/tmp/sr.html', 'utf8') : '';
const docxTxt = ler(nDocx, '/tmp/sr.docx')
  ? execSync('unzip -p /tmp/sr.docx word/document.xml', { encoding: 'utf8', maxBuffer: 1 << 28 }) : '';
const pdfTxt  = ler(nPdf, '/tmp/sr.pdf')
  ? execSync('pdftotext /tmp/sr.pdf - 2>/dev/null || true', { encoding: 'utf8', maxBuffer: 1 << 28 }) : '';
for (const [fmt, txt, n] of [['html', htmlTxt, nHtml], ['docx', docxTxt, nDocx], ['pdf', pdfTxt, nPdf]]) {
  ok(`  ${fmt}: traz o caso digitado`, n > 0 && txt.includes('CT-777'),
     n > 0 ? (txt.includes('CT-777') ? '' : 'não achei CT-777') : 'o arquivo não saiu');
}
const imgsHtml = (htmlTxt.match(/<img/g) || []).length;
ok('  html: as três imagens estão dentro do arquivo', imgsHtml >= 3, `${imgsHtml} <img>`);
const imgsDocx = nDocx > 0
  ? Number(execSync('unzip -Z1 /tmp/sr.docx | grep -c "word/media/" || true', { encoding: 'utf8' }).trim()) : 0;
ok('  docx: as três imagens estão dentro do arquivo', imgsDocx >= 3, `${imgsDocx} em word/media/`);
ok('  pdf: tem páginas de verdade', nPdf > 20000, `${nPdf} bytes`);

console.log('\n[2] havia o que vazar — a sessão não estava vazia');
{
  const quadros = await pg.locator('#thumbs figure').count();
  ok('três quadros vivos na memória do navegador', quadros >= 3, String(quadros));
  const temVideo = await pg.evaluate(() => {
    const v = document.getElementById('v');
    return !!(v && v.videoWidth > 0 && v.duration > 0);
  });
  ok('e o vídeo carregado, com duração', temVideo);
}

console.log('\n[3] o que o app tentou mandar para fora — e o que ia dentro');
{
  const porDestino = new Map();
  for (const p of foraDaMaquina) {
    const h = new URL(p.url).host;
    const a = porDestino.get(h) || { n: 0, bytes: 0, metodos: new Set() };
    a.n++; a.bytes = Math.max(a.bytes, p.bytes); a.metodos.add(p.metodo);
    porDestino.set(h, a);
  }
  if (!porDestino.size) console.log('     (nenhum pedido saiu desta máquina)');
  for (const [h, a] of porDestino) {
    console.log(`     ${h}  ${a.n} pedido(s), ${[...a.metodos].join('/')}, maior corpo ${a.bytes} B`);
  }

  /* A AFIRMAÇÃO CENTRAL. Mídia sai grande e sai com cara de mídia. Um corpo com
     `data:image`, `data:video`, `data:audio`, um multipart de arquivo, ou um
     JSON gordo de base64 são as formas que ela tomaria. Nenhuma pode aparecer.
     O teto de 8 KB não é estético: o menor quadro que este app gera passa disso
     com folga, e um evento de uso não chega perto. */
  const TETO = 8192;
  const suspeitos = foraDaMaquina.filter((p) =>
    p.bytes > TETO ||
    /data:(image|video|audio)|multipart\/form-data|application\/octet-stream/i.test(p.tipo + ' ' + p.corpo) ||
    /"(quadros|frames|imagem|imagens|video|audio|transcricao|vtt)"\s*:\s*"[A-Za-z0-9+/]{200,}/.test(p.corpo));
  ok('nenhum pedido externo levava mídia', suspeitos.length === 0,
     suspeitos.map((s) => `${s.metodo} ${s.url.slice(0, 60)} ${s.bytes}B`).join(' | '));

  /* E o que sobe de verdade fica visível: cada corpo externo é impresso inteiro
     até 300 caracteres. Quem auditar lê o que passou, em vez de acreditar. */
  for (const p of foraDaMaquina.filter((p) => p.bytes > 0)) {
    console.log(`     ↑ ${p.metodo} ${new URL(p.url).host}${new URL(p.url).pathname}  ${p.bytes} B`);
    console.log(`       ${p.corpo.replace(/\s+/g, ' ').slice(0, 300)}`);
  }

  /* E NENHUM DELES ERA NECESSÁRIO: o documento acima saiu com todos cortados.
     Esta linha é o fecho — sem ela, [1] e [3] seriam dois fatos soltos. */
  ok('e a evidência saiu mesmo assim, com todos eles cortados',
     nHtml > 0 && nDocx > 0 && nPdf > 0);
}

console.log('\n[4] e nada disso pediu conta');
{
  /* A OUTRA PROMESSA DO CARTÃO GRATUITO — "sem conta para usar" — é cumprida
     pela mesma corrida: os três documentos acima saíram sem login, sem chave e
     sem servidor. Ela ganha afirmação própria aqui porque uma promessa cumprida
     por acidente não é uma promessa provada: sem esta linha, alguém poderia
     colocar um portão na frente do app amanhã e a esteira continuaria verde. */
  const bagagem = await pg.evaluate(() => ({
    cookies: document.cookie,
    guardado: Object.keys(localStorage).filter((k) => /token|sessao|session|access|auth/i.test(k)),
  }));
  ok('nenhum cookie foi preciso', bagagem.cookies === '', bagagem.cookies.slice(0, 80));
  ok('e nenhuma credencial ficou guardada', bagagem.guardado.length === 0, bagagem.guardado.join(', '));
  /* E o app diz, ele mesmo, que está no plano gratuito: se um portão de licença
     tivesse barrado alguma etapa, a mensagem seria outra. */
  const lic = ((await pg.locator('#licMsg').textContent().catch(() => '')) || '').trim();
  console.log(`     o que o app diz da licença: ${JSON.stringify(lic.slice(0, 70)) || '(nada)'}`);
  ok('e a evidência saiu assim mesmo', nHtml > 0 && nDocx > 0 && nPdf > 0);
}

ok('sem erro de JavaScript', erros.length === 0, erros.join(' | ').slice(0, 200));

await br.close(); srv.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nSem rede: a evidência sai inteira, e nada de mídia tentou sair.');
process.exit(falhas ? 1 : 0);

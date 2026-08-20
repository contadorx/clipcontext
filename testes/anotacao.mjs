/* A ANOTAÇÃO AO VIVO — escrever no calor do momento, e ver que guardou.
 *
 * Ela já esteve na tela, saiu, e volta. O motivo da saída não era falso —
 * "confusa, e não ajuda" — e é ele que define o que este arquivo cobra: a
 * versão antiga era um campo de UMA LINHA, que não dizia sobre qual tela se
 * estava escrevendo, sem botão e sem nenhum sinal de que o texto tinha sido
 * guardado. Guardar era um ato de fé.
 *
 * As afirmações:
 *
 *   1. a caixa só aparece DEPOIS de haver o que comentar, e diz sobre o quê —
 *      "Passo 1" quando se marca um passo, "Tela 2 do Passo 1" quando se
 *      acrescenta uma tela ao passo em curso;
 *   2. o botão MUDA DE ESTADO: desligado sem texto novo, cheio com texto
 *      esperando, e "✓ Salvo" depois de guardar;
 *   3. está escrito, em palavras, que guardou e ONDE guardou;
 *   4. trocar de alvo NÃO PERDE o que estava escrito — é a única forma de perda
 *      que este produto não aceita, porque é silenciosa;
 *   5. e o texto sai no DOCUMENTO, que é a razão de tudo isto.
 *
 *   node testes/anotacao.mjs
 */
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'public');
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const html = fs.readFileSync(RAIZ + '/app.html', 'utf8');
const srv = http.createServer((q, r) => {
  const u = q.url.split('?')[0];
  if (u.startsWith('/_vercel/')) { r.writeHead(200,{'Content-Type':'text/javascript'}); return r.end(''); }
  if (u === '/sw.js') { r.writeHead(200,{'Content-Type':'text/javascript'}); return r.end(fs.readFileSync(RAIZ+'/sw.js')); }
  r.writeHead(200, { 'Content-Type':'text/html' }); r.end(html);
});
await new Promise(r => srv.listen(8973, r));

/* Ler um zip sem biblioteca: caminhar pelos cabeçalhos locais. Os nossos vão
   sem compressão para o XML, que é o que este arquivo precisa. */
function lerZip(caminho){
  const b = fs.readFileSync(caminho);
  const saida = {};
  let i = 0;
  while ((i = b.indexOf('PK\x03\x04', i)) !== -1) {
    const nl = b.readUInt16LE(i+26), el = b.readUInt16LE(i+28), n = b.readUInt32LE(i+18);
    const nome = b.subarray(i+30, i+30+nl).toString('utf8');
    saida[nome] = b.subarray(i+30+nl+el, i+30+nl+el+n);
    i = i+30+nl+el+n;
  }
  return saida;
}

let falhas = 0;
const ok = (n, c, e) => { console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : '')); if (!c) falhas++; };

const br = await chromium.launch({ executablePath: CHROME,
  args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await br.newContext({ viewport: { width: 1250, height: 980 }, acceptDownloads: true });
const pg = await ctx.newPage();
const erros = []; pg.on('pageerror', e => erros.push(e.message));
await pg.route('**/rpc/*stamp_*', r => r.fulfill({ status:200, headers:{'access-control-allow-origin':'*'}, body:'null' }));
await pg.addInitScript(() => {
  function tela(){
    const c = document.createElement('canvas'); c.width = 1280; c.height = 720;
    const g = c.getContext('2d'); let i = 0;
    setInterval(() => { i++; g.fillStyle = ['#123','#eee','#567','#fa0','#0af'][i%5];
                        g.fillRect(0,0,1280,720); }, 700);
    return c.captureStream(12);
  }
  navigator.mediaDevices.getDisplayMedia = async () => tela();
  navigator.mediaDevices.getUserMedia = async () => { throw new Error('sem mic'); };
});
await pg.goto('http://localhost:8973/app.html?lang=pt');
await pg.selectOption('#modelo', 'evidencia').catch(() => {});
await pg.waitForTimeout(600);

const estado = () => pg.evaluate(() => {
  const cx = document.getElementById('anotCx');
  const bt = document.getElementById('anotSalvar');
  return {
    visivel: !!cx && !cx.classList.contains('hide'),
    rotulo: (document.getElementById('anotLbl')||{}).textContent || '',
    texto: (document.getElementById('anotTxt')||{}).value || '',
    btTexto: (bt||{}).textContent || '',
    btLigado: !!bt && !bt.disabled,
    btSalvo: !!bt && bt.classList.contains('salvo'),
    msg: (document.getElementById('anotMsg')||{}).textContent || '',
    linhas: (document.getElementById('anotTxt')||{}).rows || 0,
  };
});

console.log('\n[1] antes de haver o que comentar, a caixa não existe');
{
  const e = await estado();
  ok('a caixa nasce escondida', e.visivel === false);
}

await pg.locator('#recTr').uncheck();
await pg.evaluate(() => window.__contagem(1));
await pg.locator('#rec').click();
await pg.waitForSelector('#recStop:visible', { timeout: 40000 });
await pg.waitForTimeout(2500);
{
  const e = await estado();
  ok('e continua escondida com a gravação rolando, antes de marcar', e.visivel === false);
}

console.log('\n[2] marcar um passo abre a caixa, e ela diz sobre o quê');
await pg.locator('#recMark').click();
await pg.waitForTimeout(700);
{
  const e = await estado();
  console.log('     rótulo: ' + e.rotulo);
  ok('a caixa apareceu', e.visivel === true);
  /* A pergunta sem resposta da versão antiga: sobre qual tela eu escrevo? */
  ok('e diz que é do PASSO', /passo/i.test(e.rotulo), e.rotulo);
  /* Uma linha ENSINA a escrever pouco. Descrever o que aconteceu não cabe em
     quarenta caracteres. */
  ok('é uma caixa de texto, e não um campo de uma linha', e.linhas >= 3, String(e.linhas));
  ok('o botão nasce desligado: não há nada novo para salvar', e.btLigado === false);
}

console.log('\n[3] o botão muda de estado, e a tela diz que guardou');
await pg.fill('#anotTxt', 'Cliquei em Salvar e o sistema devolveu a mensagem 4711.');
await pg.waitForTimeout(200);
{
  const e = await estado();
  console.log('     ' + e.btTexto.trim() + '   |   ' + e.msg.trim());
  ok('com texto novo, o botão liga', e.btLigado === true);
  ok('e a tela avisa que ainda não salvou', /não salvo|nao salvo/i.test(e.msg), e.msg);
}
await pg.locator('#anotSalvar').click();
await pg.waitForTimeout(400);
{
  const e = await estado();
  console.log('     ' + e.btTexto.trim() + '   |   ' + e.msg.trim());
  /* O ESTADO DO BOTÃO É A RESPOSTA para "ele salvou?". */
  ok('o botão vira "Salvo"', /salvo/i.test(e.btTexto), e.btTexto);
  ok('e muda de aparência, não só de texto', e.btSalvo === true);
  ok('e desliga: não há mais nada novo para guardar', e.btLigado === false);
  /* Está ESCRITO que guardou, e onde. */
  ok('a mensagem diz que salvou', /salva/i.test(e.msg), e.msg);
  ok('e diz em qual passo', /passo/i.test(e.msg), e.msg);
}

console.log('\n[4] mais uma tela: o rótulo muda, e o texto anterior não se perde');
await pg.locator('#recTela').click();
await pg.waitForTimeout(700);
{
  const e = await estado();
  console.log('     rótulo: ' + e.rotulo);
  ok('agora fala da TELA, e não do passo', /tela/i.test(e.rotulo), e.rotulo);
  ok('e a caixa vem vazia para a tela nova', e.texto === '', e.texto);
}
/* A perda silenciosa: digitar e marcar de novo sem apertar Salvar. */
await pg.fill('#anotTxt', 'A segunda tela mostra o número do documento gerado.');
await pg.waitForTimeout(150);
await pg.locator('#recMark').click();
await pg.waitForTimeout(700);
{
  const guardadas = await pg.evaluate(() => (window.__quadros ? window.__quadros() : [])
    .map(f => f.nota || '').filter(Boolean));
  console.log('     anotações guardadas: ' + guardadas.length);
  ok('o texto não salvo foi guardado ao trocar de alvo', guardadas.length === 2,
     JSON.stringify(guardadas));
  ok('e o primeiro continua lá', guardadas.some(x => /4711/.test(x)), JSON.stringify(guardadas));
  ok('e o segundo também', guardadas.some(x => /documento gerado/.test(x)), JSON.stringify(guardadas));
}

console.log('\n[5] a anotação sai no documento');
await pg.fill('#anotTxt', 'Terceiro passo: a tela de confirmação.');
await pg.locator('#anotSalvar').click();
await pg.waitForTimeout(300);
await pg.locator('#recStop').click();
await pg.waitForTimeout(2500);
{
  const e = await estado();
  ok('ao parar, a caixa se recolhe', e.visivel === false);
  const naGrade = await pg.evaluate(() =>
    [...document.querySelectorAll('.thumbs .nota')].map(i => i.value).filter(Boolean));
  console.log('     na grade: ' + naGrade.length + ' anotações');
  ok('as anotações estão na grade', naGrade.length >= 3, JSON.stringify(naGrade));
  /* O QUE IMPORTA: o texto sai no DOCUMENTO. O `.docx` é o caminho mais curto
     para provar isso sem interpretar PDF — `word/document.xml` é texto puro, e
     é o mesmo `f.nota` que o PDF e o .zip leem. */
  const dl = pg.waitForEvent('download', { timeout: 60000 });
  await pg.locator('#docx').click();
  const d = await dl;
  await d.saveAs('/tmp/anot.docx');
  const doc = lerZip('/tmp/anot.docx')['word/document.xml'].toString('utf8');
  ok('o documento traz a mensagem 4711', doc.includes('4711'));
  ok('e a segunda tela', /documento gerado/.test(doc));
  ok('e a terceira', /confirma/.test(doc));
}
ok('sem erro de página', erros.length === 0, erros[0]);

await br.close(); srv.close();
console.log(falhas ? `\n  ${falhas} falha(s)` : '\n  tudo certo');
process.exit(falhas ? 1 : 0);

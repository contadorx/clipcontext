/* O que a tela faz DURANTE a gravação.
 *
 * Três queixas com a mesma raiz: durante a captura a aba do produto está atrás
 * da tela compartilhada, e tudo que a ferramenta mostra ali é mostrado para
 * ninguém. O espelho do vídeo ocupava meia página sem informar nada, o
 * comentário guardava em silêncio (indistinguível de não guardar), e fechar a
 * janelinha por engano não tinha volta.
 */
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs';

const ROOT = '/root/walkstamp/public';
const html = fs.readFileSync(ROOT + '/app.html', 'utf8');
const srv = http.createServer((q, r) => {
  const u = q.url.split('?')[0];
  if (u.startsWith('/_vercel/')) { r.writeHead(200,{'Content-Type':'text/javascript'}); return r.end('') }
  if (u === '/sw.js') { r.writeHead(200,{'Content-Type':'text/javascript'}); return r.end(fs.readFileSync(ROOT+'/sw.js')) }
  r.writeHead(200, {'Content-Type':'text/html'}); r.end(html);
});
await new Promise(r => srv.listen(8918, r));

let falhas = 0;
const ok = (n, c, e) => { console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : '')); if (!c) falhas++; };

const br = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await br.newContext({ viewport: { width: 1200, height: 950 } });
const pg = await ctx.newPage();
const erros = []; pg.on('pageerror', e => erros.push(e.message));

await pg.addInitScript(() => {
  function tela(){
    const c = document.createElement('canvas'); c.width = 1280; c.height = 720;
    const g = c.getContext('2d'); let i = 0;
    setInterval(() => { i++; g.fillStyle = ['#123','#eee','#567','#fa0','#0af'][i%5]; g.fillRect(0,0,1280,720); }, 700);
    return c.captureStream(12);
  }
  navigator.mediaDevices.getDisplayMedia = async () => tela();
  navigator.mediaDevices.getUserMedia = async () => { throw new Error('sem mic'); };
});

await pg.goto('http://localhost:8918/app.html?lang=pt');
// o cenário de uso passou a ser obrigatório: sem ele o botão Gravar cobra a escolha
await pg.selectOption('#modelo', 'ia').catch(() => {});
await pg.waitForTimeout(700);

console.log('[1] a contagem grande existe nos DOIS lugares');
{
  /* Na aba ela já era grande — e a aba, durante a contagem, está atrás da tela
     que a pessoa acabou de escolher compartilhar. Ou seja: o único lugar onde
     ela era grande era o único lugar onde ninguém estava olhando. */
  const fonte = fs.readFileSync(ROOT + '/app.html', 'utf8');
  ok('a aba tem a contagem grande', /\.contagem\{[^}]*font-size:56px/.test(fonte));
  ok('e a janelinha também, maior ainda', /\.txt\.contando\{[^}]*font-size:64px/.test(fonte));
  ok('e na janelinha sai só o número, que é o que cabe em 250px',
     /pipTexto\.textContent = String\(dados\.n\)/.test(fonte));
  ok('a classe sai quando a contagem acaba',
     (fonte.match(/pipTexto\.classList\.remove\('contando'\)/g) || []).length >= 2);
  /* O número enorme só cabe porque o resto some. Sem esta regra a janela
     cresceria — e crescer é o que ela não pode fazer: ela fica POR CIMA da
     tela que está sendo gravada. */
  ok('e durante a contagem o resto da janelinha some',
     /body\.contando[^{]*\{display:none\}/.test(fonte));
  /* A classe `.hide` mora no CSS da aba, e a janelinha é outro documento. */
  ok('a janelinha sabe o que "escondido" quer dizer',
     /\.hide\{display:none !important\}/.test(fonte));
}

console.log('\n[2] gravando: o espelho do vídeo some — e os quadros continuam vindo');
await pg.locator('#recTr').uncheck();
await pg.evaluate(() => window.__contagem(1));
await pg.locator('#rec').click();
await pg.waitForSelector('#recStop:visible', { timeout: 40000 });
await pg.waitForTimeout(3000);
{
  /* O espelho mostrava, dentro do passo 1, a MESMA tela que a pessoa está
     olhando — e com a tela inteira compartilhada isso vira túnel de espelhos. */
  const cx = await pg.locator('#playerBox').boundingBox();
  ok('o espelho não ocupa altura nenhuma', !cx || cx.height < 2, JSON.stringify(cx));

  /* E a parte que só se descobre quebrando: é DESTE elemento que cada quadro é
     copiado. Escondê-lo por `display:none` faria o navegador parar de
     decodificar, e a gravação terminaria com zero quadros. */
  const v = await pg.evaluate(() => {
    const el = document.querySelector('#v');
    return { w: el.videoWidth, h: el.videoHeight, display: getComputedStyle(el).display };
  });
  ok('mas o vídeo continua sendo decodificado', v.w > 0 && v.h > 0, JSON.stringify(v));
  ok('e não foi escondido por display:none', v.display !== 'none', v.display);
}

console.log('\n[3] o comentário DIZ que guardou');
/* A caixa mora na janelinha enquanto a janelinha está aberta — uma só, e é
   aquela. `localhost` é contexto seguro, então a janelinha existe aqui e o
   Playwright a vê como página. */
const jn = ctx.pages().find(p => p !== pg);
await jn.locator('#marcar').click();
await pg.waitForTimeout(900);
{
  /* Um campo que guarda em silêncio é indistinguível de um campo quebrado, e a
     diferença entre os dois só apareceria meia hora depois, na revisão. */
  const antes = (await pg.locator('#recNotaEst').textContent() || '').trim();
  await jn.locator('#pipNota').fill('o total veio errado');
  await pg.waitForTimeout(200);
  /* O contorno do campo é o aviso da janelinha: em 250px não cabe uma segunda
     linha de texto, e a linha da aba está atrás da tela compartilhada. */
  ok('o campo da janelinha confirma no contorno',
     await jn.locator('#pipNota').evaluate(e => e.classList.contains('guardou')));
  const durante = (await pg.locator('#recNotaEst').textContent() || '').trim();
  ok('e a aba também registra', /guardado/i.test(durante), durante);
  ok('o aviso é diferente do rótulo de antes', durante !== antes, `${antes} → ${durante}`);

  await pg.waitForTimeout(1800);
  ok('o contorno passa', !(await jn.locator('#pipNota').evaluate(e => e.classList.contains('guardou'))));
  ok('e o texto continua no campo',
     (await jn.locator('#pipNota').inputValue()) === 'o total veio errado');
}

console.log('\n[4] a janelinha tem volta');
{
  /* Fechada por engano, e a gravação continua: some o relógio, o medidor, o
     marcar, o pausar e a caixa de comentário. Sem um jeito de trazer de volta,
     a única saída era parar e gravar de novo. */
  const fonte = fs.readFileSync(ROOT + '/app.html', 'utf8');
  ok('o botão de reabrir existe', /id="recPip"/.test(fonte));
  ok('e ele chama a mesma função que abriu a primeira vez',
     /\$\('recPip'\)\.onclick\s*=\s*async \(\) => \{\s*await abrirControle\(\);/.test(fonte));
  ok('a janelinha fechada pede o botão de volta',
     /pagehide[\s\S]{0,700}?pintarVoltarJanelinha\(\)/.test(fonte));
  ok('e ele só aparece com gravação rodando E janelinha fechada',
     /liveOn && !pipWin && 'documentPictureInPicture' in window/.test(fonte));
  /* Neste navegador sem `documentPictureInPicture` ele fica escondido — que é
     a metade da regra que dá para exercitar de verdade aqui. */
  const temPip = await pg.evaluate(() => 'documentPictureInPicture' in window);
  ok('escondido onde a janelinha não existe',
     temPip || await pg.locator('#recPip').evaluate((e) => e.classList.contains('hide')));
}

console.log('\n[5] parando, tudo volta ao normal');
await pg.locator('#recStop').click();
await pg.waitForFunction(() => document.getElementById('rec').offsetParent !== null, null, { timeout: 60000 });
await pg.waitForTimeout(1200);
{
  ok('houve quadros, apesar do espelho escondido',
     (await pg.locator('#thumbs figure').count()) > 0,
     String(await pg.locator('#thumbs figure').count()));
  ok('o comentário chegou na revisão',
     (await pg.locator('#thumbs figure input.nota').evaluateAll((ns) => ns.map((n) => n.value)))
       .includes('o total veio errado'));
  ok('o botão de reabrir a janelinha sumiu',
     await pg.locator('#recPip').evaluate((e) => e.classList.contains('hide')));
  ok('sem erro de JS', erros.length === 0, erros.join(' | ').slice(0, 150));
}

await br.close(); srv.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nA tela durante a gravação: tudo passou.');
process.exit(falhas ? 1 : 0);

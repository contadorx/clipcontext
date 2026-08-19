/* O comentário da marcação.
 *
 * "Marcar este passo" guardava a tela e nada mais. Na revisão, meia hora
 * depois, sobravam sete quadros marcados e nenhum deles dizia POR QUÊ — e o
 * porquê é o que só existe no instante: "aqui o total veio errado" é óbvio na
 * hora e irrecuperável depois.
 *
 * O que este arquivo cobra é a regra, que é onde uma caixa de texto assim
 * costuma dar errado:
 *   - ela comenta a ÚLTIMA marcação, não a próxima;
 *   - marcar de novo NÃO herda o comentário anterior (repetição num documento
 *     de evidência é pior que silêncio: parece confirmação);
 *   - e o que foi digitado tem que CHEGAR na revisão, que é a única razão de
 *     alguém digitar durante uma gravação.
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
await new Promise(r => srv.listen(8907, r));

const br = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--autoplay-policy=no-user-gesture-required']
});
let falhas = 0;
const ok = (n, c, e) => { console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : '')); if (!c) falhas++; };

const ctx = await br.newContext({ viewport: { width: 1100, height: 950 } });
const pg = await ctx.newPage();
const erros = [];
pg.on('pageerror', e => erros.push(e.message));

await pg.addInitScript(() => {
  function tela(){
    const c = document.createElement('canvas'); c.width = 1280; c.height = 720;
    const g = c.getContext('2d'); let i = 0;
    setInterval(() => { i++; g.fillStyle = ['#123','#eee','#567','#fa0','#0af'][i%5]; g.fillRect(0,0,1280,720); }, 800);
    return c.captureStream(12);
  }
  navigator.mediaDevices.getDisplayMedia = async () => tela();
  navigator.mediaDevices.getUserMedia = async () => { throw new Error('sem mic'); };
});

await pg.goto('http://localhost:8907/app.html?lang=pt');
// o cenário de uso passou a ser obrigatório: sem ele o botão Gravar cobra a escolha
await pg.selectOption('#modelo', 'ia').catch(() => {});
await pg.waitForTimeout(500);

console.log('[1] antes de gravar, a caixa não existe na tela');
{
  ok('escondida', await pg.locator('#recNotaCx').evaluate(e => e.classList.contains('hide')));
}

console.log('\n[2] gravando: a caixa é UMA SÓ, e é a da janelinha');
/* Sem transcrever e sem contagem: o que este arquivo prova é a caixa, e baixar
   um modelo de voz de 249 MB para isso seria trocar um teste por uma espera. */
await pg.locator('#recTr').uncheck();
await pg.evaluate(() => window.__contagem(1));
await pg.locator('#rec').click();
await pg.waitForSelector('#recStop:visible', { timeout: 40000 });
await pg.waitForTimeout(2500);

/* A janelinha é um documento de verdade e o Playwright a vê como uma página à
   parte. `localhost` é contexto seguro, então o `documentPictureInPicture`
   existe aqui — e a gravação abre a janelinha sozinha, como no uso real. */
const janela = () => ctx.pages().find(p => p !== pg) || null;
const jn = janela();

{
  /* As duas caixas existiam ao mesmo tempo, espelhadas. Na teoria era
     conveniente; na prática eram dois campos iguais pedindo para serem
     digitados, e ninguém sabe qual dos dois vale — no meio de uma gravação,
     que é quando menos se tem paciência para descobrir. */
  ok('a janelinha abriu', !!jn);
  ok('o cartão recolheu o campo dele',
     await pg.locator('#recNota').evaluate(e => e.classList.contains('hide')));
  ok('e diz para onde ele foi',
     /janelinha/.test(await pg.locator('#recNotaEst').textContent()),
     await pg.locator('#recNotaEst').textContent());
  ok('a caixa da janelinha existe', (await jn.locator('#pipNota').count()) === 1);
  ok('e nasce desligada, dizendo o que espera',
     await jn.locator('#pipNota').isDisabled());
  ok('com o texto certo no lugar do valor',
     /marque um passo/.test(await jn.locator('#pipNota').getAttribute('placeholder')),
     await jn.locator('#pipNota').getAttribute('placeholder'));
}

console.log('\n[3] a primeira marcação liga a caixa da janelinha');
await jn.locator('#marcar').click();
await pg.waitForTimeout(1200);
{
  ok('ligou', !(await jn.locator('#pipNota').isDisabled()));
  ok('vazia', (await jn.locator('#pipNota').inputValue()) === '');
}
await jn.locator('#pipNota').fill('o total veio errado aqui');
await pg.waitForTimeout(400);

console.log('\n[4] Enter confirma — e NÃO para a gravação');
{
  /* O ponto mais perigoso da ferramenta para uma tecla solta: "Parar" está a
     dois centímetros do campo, numa janela de 250px, e parar é irreversível —
     a reunião não se repete. Antes o Enter não tinha dono. */
  await jn.locator('#pipNota').press('Enter');
  await pg.waitForTimeout(500);
  ok('a gravação continua rolando', await pg.locator('#recStop').isVisible());
  ok('e o texto continua no campo',
     (await jn.locator('#pipNota').inputValue()) === 'o total veio errado aqui');
  ok('a janelinha continua aberta', !!janela());
  ok('e o campo confirma que guardou',
     await jn.locator('#pipNota').evaluate(e => e.classList.contains('guardou')));
}

console.log('\n[5] a segunda marcação começa em branco — não herda a anterior');
await pg.waitForTimeout(2200);
await jn.locator('#marcar').click();
await pg.waitForTimeout(1200);
{
  ok('a caixa zerou', (await jn.locator('#pipNota').inputValue()) === '',
     await jn.locator('#pipNota').inputValue());
}
await jn.locator('#pipNota').fill('e aqui a tela travou');
await pg.waitForTimeout(400);

console.log('\n[6] fechando a janelinha, o campo VOLTA para o cartão — com o texto');
{
  /* O texto nunca morou no campo: mora no quadro. Fechar a janelinha por engano
     no meio de uma gravação não pode deixar a pessoa sem lugar nenhum para
     comentar, e muito menos apagar o que ela escreveu. */
  await jn.close();
  await pg.waitForTimeout(900);
  ok('o campo do cartão reapareceu',
     !(await pg.locator('#recNota').evaluate(e => e.classList.contains('hide')))); 
  ok('com o texto que foi digitado na janelinha',
     (await pg.locator('#recNota').inputValue()) === 'e aqui a tela travou',
     await pg.locator('#recNota').inputValue());
  ok('e o rótulo voltou a dizer qual marcação é',
     /marcação 2/.test(await pg.locator('#recNotaEst').textContent()),
     await pg.locator('#recNotaEst').textContent());
  ok('e o botão de trazer a janelinha de volta apareceu',
     await pg.locator('#recPip').isVisible());
}

console.log('\n[7] parando, os comentários chegam na revisão');
await pg.locator('#recStop').click();
await pg.waitForFunction(() => document.getElementById('rec').offsetParent !== null, null, { timeout: 60000 });
await pg.waitForTimeout(1500);
{
  ok('a caixa sumiu com a gravação',
     await pg.locator('#recNotaCx').evaluate(e => e.classList.contains('hide')));

  const notas = await pg.locator('#thumbs figure input.nota').evaluateAll(
    (ns) => ns.map((n) => n.value).filter(Boolean));
  ok('os dois comentários estão nas anotações dos quadros',
     notas.includes('o total veio errado aqui') && notas.includes('e aqui a tela travou'),
     notas.join(' | '));
  /* A ordem importa: se o segundo comentário caísse no primeiro quadro, o
     documento diria que a tela travou antes de o total dar errado. */
  const iA = notas.indexOf('o total veio errado aqui');
  const iB = notas.indexOf('e aqui a tela travou');
  ok('e na ordem em que aconteceram', iA >= 0 && iB > iA, `${iA} < ${iB}`);
}

console.log('\n[8] o documento leva o comentário junto');
{
  /* A prova que importa. Um comentário que aparece na revisão e some no arquivo
     entregue é pior do que não ter comentário: a pessoa acredita que
     documentou. Por isso aqui o documento é GERADO e lido, e não inspecionado
     por dentro. */
  const dl = pg.waitForEvent('download', { timeout: 60000 });
  await pg.locator('#html').click();
  const d = await dl; await d.saveAs('/tmp/comentario-saida.html');
  const doc = fs.readFileSync('/tmp/comentario-saida.html', 'utf8');
  ok('o documento cita o primeiro comentário', doc.includes('o total veio errado aqui'));
  ok('e o segundo', doc.includes('e aqui a tela travou'));
  ok('sem erro de JS em nada disso', erros.length === 0, erros.join(' | ').slice(0, 160));
}

await br.close(); srv.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nComentário da marcação: tudo passou.');
process.exit(falhas ? 1 : 0);

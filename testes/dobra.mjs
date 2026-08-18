/* Cartões colapsados: fecham quando o passo não chegou, abrem quando destrava. */
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT='/root/walkstamp/public';
const T={'.html':'text/html','.css':'text/css','.js':'text/javascript','.webm':'video/webm','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'};
const srv=http.createServer((q,r)=>{
  if(q.url.startsWith('/_vercel/')){r.writeHead(200,{'Content-Type':'text/javascript'});return r.end('')}
  const u=q.url.split('?')[0]; const f=path.join(ROOT,u==='/'?'index.html':u);
  if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
  r.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));});
await new Promise(r=>srv.listen(8878,r));
const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
let falhas=0; const ok=(n,c,e)=>{console.log((c?'  ok   ':'  FALHA')+'  '+n+(e?'  → '+e:''));if(!c)falhas++};
const pg=await br.newPage({viewport:{width:1000,height:900}});
const erros=[]; pg.on('pageerror',e=>erros.push(e.message));
await pg.route('**/rpc/*stamp_*', r=>r.fulfill({status:200,headers:{'access-control-allow-origin':'*'},body:'null'}));
await pg.goto('http://localhost:8878/app.html?lang=pt'); await pg.waitForTimeout(500);
// o cenário de uso passou a ser obrigatório: sem ele o botão Gravar cobra a escolha
await pg.selectOption('#modelo', 'ia').catch(() => {});

const fechado = id => pg.locator('#'+id).evaluate(e=>e.classList.contains('fechado'));
const alturaCorpo = id => pg.locator('#'+id+' .dobra > div').evaluate(e=>e.getBoundingClientRect().height);

console.log('\n[1] página nova');
ok('passo 2 fechado', await fechado('cardTr'));
ok('passo 3 (revisão) fechado', await fechado('prevCard'));
ok('passo 4 (prompt) fechado', await fechado('promptCard'));
ok('o passo 3 EXISTE na tela (a numeração não pula)',
   await pg.locator('#prevCard').isVisible());
ok('e explica quando vai servir',
   /depois do passo 2/.test(await pg.locator('#hintPrev').textContent()),
   await pg.locator('#hintPrev').textContent());
{
  const nums = await pg.locator('.card .step').allTextContents();
  ok('os quatro passos estão numerados em sequência',
     JSON.stringify(nums) === JSON.stringify(['1','2','3','4']), nums.join(','));
}
ok('e o corpo do passo 2 está mesmo com altura zero', (await alturaCorpo('cardTr')) < 2,
   (await alturaCorpo('cardTr')).toFixed(1) + 'px');
ok('mas o cabeçalho e a dica continuam visíveis',
   await pg.locator('#cardTr h2').isVisible() && await pg.locator('#hintTr').isVisible());
const altura = await pg.evaluate(()=>document.documentElement.scrollHeight);
console.log('     altura da página fechada:', altura + 'px');

console.log('\n[1b] o cabeçalho abre o cartão fechado');
await pg.locator('#cardTr h2').click();
await pg.waitForTimeout(450);
ok('clicar no cabeçalho abre o passo 2', !(await fechado('cardTr')));
ok('e os ajustes ficam alcançáveis antes de gravar',
   (await alturaCorpo('cardTr')) > 100 && !(await pg.locator('#gpu').isDisabled()),
   (await alturaCorpo('cardTr')).toFixed(0) + 'px');
ok('dá para marcar a placa de vídeo sem ter vídeo nenhum',
   await pg.locator('#gpu').check().then(()=>true).catch(()=>false));
await pg.locator('#gpu').uncheck();
ok('o cabeçalho é alcançável por teclado',
   (await pg.locator('#cardTr h2').getAttribute('tabindex')) === '0');
await pg.locator('#cardTr h2').click();
await pg.waitForTimeout(450);
ok('e clicar de novo fecha', await fechado('cardTr'));

console.log('\n[2] carregar um vídeo abre o passo 2');
await pg.setInputFiles('#file','/tmp/cinco.webm');
await pg.waitForFunction(()=>!document.getElementById('extract').disabled,null,{timeout:20000});
await pg.waitForTimeout(700);
ok('passo 2 abriu', !(await fechado('cardTr')));
ok('o prompt continua fechado (sem frames ainda)', await fechado('promptCard'));
ok('e o corpo do passo 2 tem altura de verdade', (await alturaCorpo('cardTr')) > 100,
   (await alturaCorpo('cardTr')).toFixed(0) + 'px');
const altura2 = await pg.evaluate(()=>document.documentElement.scrollHeight);
console.log('     altura da página aberta :', altura2 + 'px');
ok('a página fechada é bem menor que a aberta', altura2 > altura * 1.4,
   altura + ' → ' + altura2);

console.log('\n[3] extrair frames abre a revisão e o prompt');
await pg.click('#extract');
await pg.waitForFunction(()=>document.querySelectorAll('#thumbs figure').length>0,null,{timeout:60000});
await pg.waitForTimeout(700);
ok('passo 4 aberto', !(await fechado('prevCard')));
ok('passo 5 aberto', !(await fechado('promptCard')));
ok('e sem dica de trava sobrando', !(await pg.locator('#hintPrompt').isVisible()));

ok('nenhum erro de JS', erros.length===0, erros.join(' | ').slice(0,160));
await br.close(); srv.close();
console.log(falhas?`\n${falhas} FALHA(S)`:'\nColapso dos cartões: tudo passou.');
process.exit(falhas?1:0);

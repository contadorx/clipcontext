/* A BIBLIOTECA DO PDF — de onde ela vem, e o que acontece quando não vem.
 *
 * O relato de campo, de um QA usando a ferramenta de verdade: "algumas vezes o
 * PDF não foi gerado, e embora existam instruções para conversão, acabei
 * utilizando apenas o HTML gerado". Ele tratou como incômodo. Era defeito, e
 * eram DOIS:
 *
 *   1. A versão hospedada carregava o jsPDF do jsdelivr, num `<script>` sem
 *      queda nenhuma. Um proxy corporativo que bloqueie o CDN — rotina no
 *      ambiente de quem testa software — derrubava o PDF e SÓ o PDF, porque o
 *      HTML não usa biblioteca. Daí o sintoma ser "às vezes o PDF". Não era às
 *      vezes: era determinístico por ambiente.
 *   2. E quando falhava, falhava MUDO: o gerador tinha `try/finally` sem
 *      `catch`. A linha de status ficava parada em "Montando o PDF…" para
 *      sempre e o erro virava rejeição não tratada. A pessoa não sabia se
 *      tinha perdido a gravação.
 *
 *   node testes/pdflib.mjs
 */
/* O Chromium DAQUI, e não o do Playwright direto: a gaveta das saídas — onde
   mora o botão de gerar PDF — nasce recolhida, e um elemento dentro de um
   `<details>` fechado não tem caixa para o Playwright clicar. Custou uma
   rodada: "element is not visible" num botão que existe. */
import { chromium } from './_navegador.mjs';
import http from 'http'; import fs from 'fs'; import path from 'path';
import { CHROME_WS } from './_caminhos.mjs';
import { garantirPortaLivre } from './_porta.mjs';

const PORTA = 8883;
const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const app = fs.readFileSync(RAIZ + '/public/app.html', 'utf8');

let falhas = 0;
const ok = (n, c, e) => { console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : '')); if (!c) falhas++; };

/* ---------------------------------------------------------------- [1] ----
   DE ONDE ELA VEM. Isto se afirma no arquivo, sem navegador: é uma questão de
   endereço, e endereço está escrito. */
console.log('\n[1] a versão hospedada busca o jsPDF de CASA, e só quando alguém pede o PDF');
{
  /* ---- NÃO HÁ `<script>` FIXO, E ISSO É DE PROPÓSITO ----
   *
   * O primeiro conserto trocou o endereço do CDN pelo nosso e manteve a tag
   * fixa. A esteira mostrou o preço: VINTE E QUATRO réguas acusaram
   * "Unexpected token '<'", porque o servidorzinho delas responde a página HTML
   * para qualquer endereço — e o navegador tentava executar HTML como script.
   *
   * Consertar vinte e quatro réguas seria tratar o sintoma. A tag fixa era a
   * causa, e tirá-la é melhor produto: 365KB deixam de ser cobrados de TODO
   * mundo que abre a ferramenta por um formato que boa parte nunca exporta, e
   * um endereço que não responde deixa de virar erro de página em toda visita. */
  const tags = [...app.matchAll(/<script[^>]*src="([^"]*jspdf[^"]*)"/g)].map(m => m[1]);
  ok('não há script de jsPDF carregado na abertura', tags.length === 0,
     JSON.stringify(tags));

  /* A LISTA DE ENDEREÇOS, na ordem em que será tentada. De casa primeiro: é o
     endereço que um proxy corporativo não bloqueia. */
  const m = app.match(/const enderecos = \[([^\]]*)\]/);
  ok('a lista de endereços está no artefato', !!m, m ? m[1] : '(não achei)');
  const lista = m ? [...m[1].matchAll(/'([^']*)'/g)].map(x => x[1]).filter(Boolean) : [];
  ok('e o primeiro é o nosso próprio endereço', lista[0] === '/jspdf.umd.min.js',
     JSON.stringify(lista));
  ok('e o CDN vem DEPOIS, como queda e não como fonte',
     lista.length === 2 && /jsdelivr/.test(lista[1]), JSON.stringify(lista));

  /* O ARQUIVO TEM QUE EXISTIR, e ser o MESMO do pacote offline. Duas cópias do
     jsPDF em versões diferentes seria a lista paralela mais cara desta casa:
     ela só apareceria no PDF de quem exportasse. */
  const local = RAIZ + '/public' + (lista[0] || '/x');
  ok('o arquivo está em public/', fs.existsSync(local), local);
  if (fs.existsSync(local)) {
    const a = fs.readFileSync(local);
    const b = fs.readFileSync(RAIZ + '/vendor/jspdf.umd.min.js');
    ok('e é byte a byte o mesmo que o pacote offline embute', a.equals(b),
       `${a.length} contra ${b.length} bytes`);
  }
}

console.log('\n[2] e o pacote offline não cita CDN nenhum — é a promessa dele');
{
  const off = fs.readFileSync(RAIZ + '/offline/walkstamp-offline.html', 'utf8');
  /* ENDEREÇO BUSCADO, e não a palavra: o arquivo pode explicar em comentário
     por que NÃO usa o jsdelivr, e isso não é uma dependência. O que não pode
     existir ali é um endereço que o navegador vá buscar. */
  const buscados = (off.match(/https?:\/\/cdn\.jsdelivr\.net/g) || []).length;
  ok('nenhum endereço do jsdelivr para buscar no arquivo offline',
     buscados === 0, String(buscados));
  ok('e a biblioteca está embutida', /jsPDF/.test(off));
}

/* ---------------------------------------------------------------- [3] ----
   O QUE ACONTECE QUANDO ELA NÃO VEM. Esta é a afirmação que importa: as duas
   de cima provam o endereço, e endereço não é comportamento. */
await garantirPortaLivre(PORTA, 'pdflib.mjs');
const srv = http.createServer((q, r) => {
  const u = q.url.split('?')[0];
  if (u.startsWith('/_vercel/')) { r.writeHead(200, {'Content-Type':'text/javascript'}); return r.end(''); }
  if (u === '/sw.js') { r.writeHead(200, {'Content-Type':'text/javascript'}); return r.end(''); }
  /* O ARQUIVO DE CASA SOME, e o CDN está bloqueado logo abaixo: é exatamente a
     máquina de quem relatou o problema. */
  if (/jspdf/i.test(u)) { r.writeHead(404); return r.end('bloqueado pela regua'); }
  r.writeHead(200, { 'Content-Type':'text/html' }); r.end(app);
});
await new Promise(r => srv.listen(PORTA, r));

console.log('\n[3] sem a biblioteca, o PDF falha DIZENDO por quê — e não em silêncio');
const br = await chromium.launch({ executablePath: CHROME_WS,
  args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await br.newContext({ viewport: { width: 1280, height: 1000 } });
/* Nem de casa, nem de fora. */
await ctx.route('**/jspdf**', (r) => r.abort());
await ctx.addInitScript(() => {
  const c = document.createElement('canvas');
  c.width = 1280; c.height = 720;
  const g = c.getContext('2d'); let i = 0;
  setInterval(() => { i++;
    g.fillStyle = `hsl(${(i * 47) % 360} 70% 40%)`; g.fillRect(0, 0, 1280, 720);
    g.fillStyle = '#fff'; g.font = '140px sans-serif'; g.fillText(String(i), 60, 300);
  }, 2200);
  navigator.mediaDevices.getDisplayMedia = async () => c.captureStream(12);
  navigator.mediaDevices.getUserMedia = async () => { throw new Error('sem mic'); };
  try { delete window.documentPictureInPicture; } catch (e) {}
});
const pg = await ctx.newPage();
pg.on('dialog', d => d.accept());
await pg.goto(`http://localhost:${PORTA}/app.html?lang=pt`);
await pg.selectOption('#modelo', 'evidencia').catch(() => {});
await pg.locator('#semTr').check();
await pg.evaluate(() => window.__contagem(1));
await pg.locator('#rec').click();
await pg.waitForSelector('#recStop:visible', { timeout: 40000 });
await pg.waitForTimeout(7000);
await pg.locator('#recStop').click({ force: true });
await pg.waitForFunction(() => document.querySelectorAll('#thumbs figure').length > 0,
                         null, { timeout: 60000 });
const quadros = await pg.evaluate(() => document.querySelectorAll('#thumbs figure').length);
/* SEM QUADRO, O RESTO NÃO PROVA NADA: o botão de exportar nem estaria vivo, e
   "não baixou PDF" seria verdade por um motivo que não é o desta régua. */
ok('a gravação de teste produziu quadros', quadros > 0, `${quadros} quadros`);

await pg.locator('#go').click();
await pg.waitForFunction(() => {
  const s = document.getElementById('pdfStatus');
  return s && /err/.test(s.innerHTML);
}, null, { timeout: 60000 }).catch(() => {});
const st = await pg.evaluate(() => {
  const s = document.getElementById('pdfStatus');
  return { txt: (s && s.textContent) || '', erro: !!(s && /class="err"/.test(s.innerHTML)) };
});
console.log('     ' + st.txt.slice(0, 140));
ok('a linha de status acusa o problema', st.erro, st.txt.slice(0, 90));
/* E NÃO FICA PARADA EM "Montando o PDF…", que era o defeito: a frase de espera
   sobrevivendo ao fim do trabalho é pior que frase nenhuma, porque ela promete
   que ainda está acontecendo. */
ok('e não ficou parada no "montando"', !/montando/i.test(st.txt), st.txt.slice(0, 90));
ok('e ela explica a causa em vez de mostrar o erro cru do JavaScript',
   /biblioteca|rede|bloqueio/i.test(st.txt) && !/destructure|undefined/i.test(st.txt),
   st.txt.slice(0, 120));
/* A SAÍDA QUE SOBRA TEM QUE SER OFERECIDA. Quem relatou acabou usando o HTML —
   e descobriu sozinho. A frase diz. */
ok('e aponta o caminho que funciona', /HTML/i.test(st.txt), st.txt.slice(0, 120));
/* E o botão volta: sem isso a pessoa não pode nem tentar de novo. */
ok('o botão de exportar volta a funcionar',
   await pg.evaluate(() => !document.getElementById('go').disabled));

await br.close(); srv.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nA biblioteca do PDF: tudo passou.');
process.exit(falhas ? 1 : 0);

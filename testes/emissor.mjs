/* O EMISSOR E A CLASSIFICAÇÃO CHEGAM AO DOCUMENTO.
 *
 * São duas balas do cartão Team, e as duas estavam listadas no
 * `AUDITORIA-PENDENTE.md` como "sem teste". Medindo, a lista estava meio certa:
 * `matriz.mjs` cobre de onde o emissor VEM (`licenca.q`, e não um e-mail) e que
 * a classificação é desenhada no rodapé; `miudos.mjs` cobre a classificação no
 * prompt. Nenhuma das duas abre o arquivo gerado.
 *
 * E essa é a diferença que importa aqui. Afirmação sobre o TEXTO DA FONTE prova
 * que alguém escreveu a linha; só abrir o documento prova que o campo chega ao
 * arquivo que vai para o auditor. Este projeto já pagou por essa distinção
 * quatro vezes — a última foi uma régua que aprovou o produto com o caminho
 * inteiro desligado por um `if (false)`.
 *
 * O EMISSOR É DE TEAM, E SÓ DELE. Sem licença ele não sai, e isso não é
 * detalhe: é o princípio de que acabamento mora em recurso pago. A régua cobra
 * os dois lados — que aparece com licença e que NÃO aparece sem ela.
 *
 * A licença é assinada aqui mesmo, com o par gerado por `_licenca.mjs`: a
 * chave de produção não existe nesta máquina.
 *
 *   node testes/emissor.mjs
 */
import { chromium } from './_navegador.mjs';
import http from 'http'; import fs from 'fs';
import { execSync } from 'child_process';
import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';
import { appComChavesDeTeste, emitir } from './_licenca.mjs';

const APP = appComChavesDeTeste();
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
const CHAVE = emitir(CLIENTE, 5, '2099-01-01');

const br = await chromium.launch({ executablePath: CHROME_WS });

/* Uma sessão que gera os três documentos. `comLicenca` decide se a chave entra
   pelo endereço — é a única diferença entre os dois lados da afirmação. */
async function gerar(comLicenca){
  const ctx = await br.newContext({ acceptDownloads: true, serviceWorkers: 'block',
                                    viewport: { width: 1250, height: 950 } });
  await ctx.route('**/jspdf**', (r) => r.fulfill(
    { status: 200, headers: { 'content-type': 'text/javascript' }, body: jspdf }));
  const pg = await ctx.newPage();
  const erros = []; pg.on('pageerror', (e) => erros.push(e.message));
  const q = comLicenca ? `&lic=${encodeURIComponent(CHAVE)}` : '';
  await pg.goto(`http://localhost:8992/app.html?lang=pt${q}`);
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
  /* `#clsRow` NASCE ESCONDIDA e só aparece com licença de Team — está escrito
     no produto: "uma tarja de Confidencial que qualquer um pode escrever num
     documento gratuito não classifica nada, ela só ensina que a palavra não
     vale". Então a visibilidade dela é parte da afirmação, e não um detalhe de
     como chegar ao seletor. */
  const clsVisivel = await pg.locator('#clsRow').isVisible().catch(() => false);
  let cls = '';
  if (clsVisivel) {
    await pg.selectOption('#docClass', 'Conf').catch(() => {});
    cls = (await pg.locator('#docClass option:checked').textContent() || '').trim();
  }
  await pg.waitForTimeout(300);

  const baixar = async (botao, destino) => {
    const d = pg.waitForEvent('download', { timeout: 90000 });
    await pg.locator(botao).click();
    await (await d).saveAs(destino);
  };
  const suf = comLicenca ? 'com' : 'sem';
  await baixar('#html', `/tmp/em-${suf}.html`);
  await baixar('#docx', `/tmp/em-${suf}.docx`);
  await baixar('#go',   `/tmp/em-${suf}.pdf`);

  const licMsg = (await pg.locator('#licMsg').textContent()) || '';
  await ctx.close();
  return { suf, cls, clsVisivel, licMsg, erros };
}

const texto = {
  html: (f) => fs.readFileSync(f, 'utf8'),
  docx: (f) => execSync(`unzip -p ${f} word/document.xml`, { encoding: 'utf8', maxBuffer: 1 << 28 }),
  pdf:  (f) => execSync(`pdftotext ${f} - 2>/dev/null || true`, { encoding: 'utf8', maxBuffer: 1 << 28 }),
};

console.log('[1] com licença de Team, o emissor entra nos três documentos');
const com = await gerar(true);
console.log(`     licença: ${JSON.stringify(com.licMsg.slice(0, 56))}`);
console.log(`     classificação escolhida: ${JSON.stringify(com.cls)}`);
ok('o seletor de classificação aparece com licença de Team', com.clsVisivel);
ok('a licença ativou', /Licen[çc]a v[áa]lida|Plano Time/.test(com.licMsg),
   /Licen[çc]a v[áa]lida|Plano Time/.test(com.licMsg) ? '' : com.licMsg.slice(0, 70));
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

console.log('\n[3] SEM licença, o emissor não sai — acabamento é de plano pago');
const sem = await gerar(false);
for (const [fmt, arq] of [['html', '/tmp/em-sem.html'], ['docx', '/tmp/em-sem.docx'],
                          ['pdf', '/tmp/em-sem.pdf']]) {
  const t = texto[fmt](arq);
  ok(`  ${fmt}: não traz emissor nenhum`, !t.includes(CLIENTE),
     !t.includes(CLIENTE) ? '' : 'o nome do cliente vazou para o documento gratuito');
}
/* E A CLASSIFICAÇÃO TAMBÉM É DE TEAM. Eu tinha suposto o contrário ao escrever
   esta régua — que ela fosse gratuita — e a medição corrigiu: o `#clsRow`
   nasce escondido e só aparece com licença. O motivo está no produto, e é bom:
   uma tarja de "Confidencial" que qualquer um escreve não classifica nada.
   Então o que se cobra aqui é a ausência do CONTROLE, e não do texto. */
ok('  o seletor de classificação NÃO aparece sem licença', !sem.clsVisivel,
   !sem.clsVisivel ? '' : 'o seletor apareceu no documento gratuito');

ok('sem erro de JavaScript', com.erros.length === 0 && sem.erros.length === 0,
   [...com.erros, ...sem.erros].join(' | ').slice(0, 160));

await br.close(); srv.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nEmissor e classificação: tudo passou.');
process.exit(falhas ? 1 : 0);

/* O "NÃO DÁ" CHEGA ANTES, E NÃO NO MEIO DA AÇÃO.
 *
 * Quatro recursos da ferramenta dependem de algo que o navegador pode não ter:
 * WebGPU, o clipe do momento, a webcam e a leitura de texto da imagem. Medido
 * antes de consertar:
 *
 *   WebGPU    já fazia o certo — a opção SOME quando `navigator.gpu` não
 *             existe. Sem conceito no navegador, não há o que explicar.
 *   clipe     conferia dentro do `clipeAbrir()`, que roda DEPOIS de o relógio
 *             zerar: a pessoa marcava a caixa, escolhia o cenário, clicava em
 *             Gravar, escolhia a tela, esperava a contagem, a gravação COMEÇAVA
 *             — e só então o "este navegador não grava clipe" aparecia na lista
 *             de avisos da gravação em curso. Ela está gravando.
 *   OCR       descobria a espera depois do clique, na mensagem "procurando…",
 *             indistinguível de um botão lento.
 *   webcam    continua conferindo tarde, e é de propósito que ela não esteja
 *             neste build: "o navegador não sabe fazer" e "você não deixou" são
 *             coisas diferentes, e tratá-las igual troca um defeito por outro.
 *             Ela tem build próprio.
 *
 * OS DOIS CONSERTOS NÃO SÃO O MESMO, e a régua cobra cada um do seu jeito:
 *
 *   o clipe   SONDA antes. `MediaRecorder.isTypeSupported` é síncrono, não pede
 *             permissão e custa microssegundos — dá para saber ao pintar.
 *   o OCR     ANUNCIA antes. Aqui a pergunta "o leitor carrega?" É o download:
 *             não existe sondagem barata, e sondar seria pagar o custo que a
 *             sondagem existiria para anunciar.
 *
 * A régua AMPUTA o `MediaRecorder` do navegador para medir o caminho do "não
 * dá". Sem isso ela só provaria o caminho feliz — que é o que já funcionava.
 *
 *   node testes/recursos.mjs
 */
import fs from 'fs';
import http from 'http';
import { chromium } from './_navegador.mjs';
import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';

let falhas = 0;
const ok = (n, c, e) => { console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : '')); if (!c) falhas++; };

const APP = fs.readFileSync(`${RAIZ_WS}/public/app.html`, 'utf8');
/* Os textos saem do próprio app: uma lista escrita aqui aprovaria exatamente o
   erro que ela deveria pegar. O dicionário é `const I18N = { pt: {...}, ... }`. */
const txt = (chave, lang) => {
  const i = APP.indexOf(`\n    ${lang}: {`);
  if (i < 0) return '';
  const m = APP.slice(i, i + 90000).match(new RegExp(chave + ":'([^']*)'"));
  return m ? m[1] : '';
};

const srv = http.createServer((q, r) => {
  if (q.url.split('?')[0].startsWith('/_vercel/')) {
    r.writeHead(200, { 'Content-Type': 'text/javascript' }); return r.end('');
  }
  r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); r.end(APP);
});
await new Promise((r) => srv.listen(8885, r));
const br = await chromium.launch({ executablePath: CHROME_WS });

async function abrir({ semMediaRecorder = false, semGpu = false, lang = 'pt' } = {}) {
  const ctx = await br.newContext({ viewport: { width: 1280, height: 900 } });
  if (semMediaRecorder) {
    await ctx.addInitScript(() => {
      try { delete window.MediaRecorder; } catch (e) { window.MediaRecorder = undefined; }
    });
  }
  if (semGpu) {
    await ctx.addInitScript(() => {
      try { Object.defineProperty(navigator, 'gpu', { get: () => undefined }); } catch (e) {}
    });
  }
  const pg = await ctx.newPage();
  await pg.goto(`http://localhost:8885/app.html?lang=${lang}`);
  await pg.waitForTimeout(1600);
  await pg.evaluate(() => { const v = document.getElementById('viaRec'); if (v) v.classList.remove('hide'); });
  await pg.waitForTimeout(300);
  return { ctx, pg };
}

console.log('[1] o clipe: com MediaRecorder, a opção é oferecida normalmente');
{
  const { ctx, pg } = await abrir();
  await pg.evaluate(() => { const b = document.getElementById('clipeAbrir'); if (b) b.click(); });
  await pg.waitForTimeout(300);
  const r = await pg.evaluate(() => ({
    botao: document.getElementById('clipeAbrir').textContent,
    desab: document.getElementById('recClipe').disabled,
  }));
  ok('a caixa do clipe está habilitada', r.desab === false);
  ok('  e o botão diz o estado normal', r.botao === txt('clipeBotaoOff', 'pt'), r.botao);
  await ctx.close();
}

console.log('\n[2] e SEM MediaRecorder o "não dá" chega ANTES de gravar');
{
  const { ctx, pg } = await abrir({ semMediaRecorder: true });
  await pg.evaluate(() => { const b = document.getElementById('clipeAbrir'); if (b) b.click(); });
  await pg.waitForTimeout(300);
  const r = await pg.evaluate(() => ({
    botao: document.getElementById('clipeAbrir').textContent,
    desab: document.getElementById('recClipe').disabled,
    marc: document.getElementById('recClipe').checked,
    nota: document.getElementById('recClipeNota').textContent,
    existe: !!document.getElementById('recClipe'),
  }));
  ok('o botão já diz que este navegador não grava', r.botao === txt('clipeBotaoNao', 'pt'), r.botao);
  ok('  e a caixa está desabilitada', r.desab === true);
  /* Marcada e desabilitada, ela continuaria dizendo ao resumo dos Ajustes que o
     clipe está ligado — e o resumo é o que a pessoa lê sem abrir a gaveta. */
  ok('  e DESMARCADA, para o resumo dos Ajustes não mentir', r.marc === false);
  ok('  e a nota explica o motivo', r.nota === txt('recClipeNao', 'pt'), r.nota.slice(0, 60));
  /* VISÍVEL, e não escondida: o clipe é anunciado na página de recursos, e uma
     opção que some sem explicação vira "sumiu o recurso que eu vim usar". */
  ok('  e a opção continua EXISTINDO, com o motivo à vista', r.existe === true);
  await ctx.close();
}

console.log('\n[3] o WebGPU continua sumindo — sem conceito, não há o que explicar');
{
  const { ctx, pg } = await abrir({ semGpu: true });
  const escondido = await pg.evaluate(() => {
    const cx = document.getElementById('gpu');
    if (!cx) return 'sem a caixa';
    const l = cx.closest('label');
    return l ? l.classList.contains('hide') : 'sem label';
  });
  ok('sem navigator.gpu, a opção da placa some', escondido === true, String(escondido));
  await ctx.close();
}

console.log('\n[4] o OCR anuncia o download ANTES do clique, nos cinco idiomas');
{
  for (const L of ['pt', 'en', 'es', 'de', 'fr']) {
    const { ctx, pg } = await abrir({ lang: L });
    const r = await pg.evaluate(() => {
      const p = document.getElementById('ocrCusto');
      const b = document.getElementById('ocr');
      if (!p || !b) return null;
      const pb = p.getBoundingClientRect(), bb = b.getBoundingClientRect();
      return { texto: p.textContent.trim(), abaixo: pb.top >= bb.top,
               visivel: !p.classList.contains('hide') };
    });
    ok(`${L}: o aviso está lá, no idioma certo`, !!r && r.texto === txt('ocrCusto', L),
       r ? r.texto.slice(0, 46) : '(não achei)');
    ok(`  ${L}: visível, e ABAIXO do botão que ele explica`, !!r && r.visivel && r.abaixo);
    await ctx.close();
  }
}

console.log('\n[5] e o aviso do OCR some depois que o leitor já veio');
{
  /* Um aviso que sobrevive ao motivo dele é ruído — e ruído ao lado de um botão
     ensina a não ler o que está ao lado dos botões. O `Tesseract` é fingido:
     o de verdade vem de um CDN, e esta régua não fala com a rede. */
  const { ctx, pg } = await abrir();
  const antes = await pg.locator('#ocrCusto').isVisible();
  await pg.evaluate(() => {
    window.Tesseract = { fingido: true };
    document.querySelector('#idiomas a[data-l="pt"]').click();   // força uma repintura
  });
  await pg.waitForTimeout(350);
  const depois = await pg.locator('#ocrCusto').isVisible();
  ok('antes de carregar, o aviso está visível', antes === true);
  ok('  e depois de o leitor existir, ele some', depois === false);
  await ctx.close();
}

await br.close(); srv.close();
console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'o "não dá" e o "vai custar" chegam antes da ação'));
process.exit(falhas ? 1 : 0);

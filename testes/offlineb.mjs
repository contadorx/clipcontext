/* O PACOTE OFFLINE CUMPRE O QUE A PÁGINA DE SEGURANÇA VENDE.
 *
 * A DEC-1 foi decidida em 27/08: caminho A no produto hospedado — "nada do seu
 * conteúdo sai sem um gesto seu", com a matriz de exceções nomeada — e caminho
 * B, zero egressão literal, no artefato offline.
 *
 * B não era uma decisão nova: a página de segurança já dizia, há tempos, "nada
 * nele fala com servidor nenhum" e "na versão offline você perde a transcrição
 * automática e a leitura de texto da imagem". O que faltava era o ARQUIVO
 * obedecer — as duas escolhas continuavam na tela, e clicar numa delas ia
 * buscar o modelo no jsDelivr de dentro do arquivo que promete não buscar nada.
 *
 * O QUE ESTA RÉGUA PROVA:
 *   - que o arquivo NÃO CONTÉM endereço de rede — nem jsDelivr, nem Hugging
 *     Face, nem Supabase, nem medição. A página de segurança convida a pessoa a
 *     conferir procurando no arquivo baixado; é essa conferência, feita aqui;
 *   - que aberto de `file:` ele não faz pedido nenhum para fora, parado;
 *   - que as duas escolhas que precisam de rede SUMIRAM da tela, e que as duas
 *     que funcionam sem rede continuam — trazer transcrição pronta, e não
 *     transcrever;
 *   - que a escolha marcada nunca é uma escolha invisível;
 *   - que a ausência é EXPLICADA, e no idioma de quem lê;
 *   - e que a versão da WEB continua com tudo: o corte é do pacote, não do
 *     produto. Sem esta última, a régua aprovaria alguém matar a transcrição
 *     no site inteiro.
 *
 * O que ela NÃO prova: que o Tesseract e o modelo de voz funcionam na web.
 * Isso é rede, e quem responde por isso são `audio.mjs` e as réguas do OCR.
 *
 *   node testes/offlineb.mjs
 */
import fs from 'fs';
import { chromium } from './_navegador.mjs';
import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';

let falhas = 0;
const ok = (n, c, e) => { console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : '')); if (!c) falhas++; };

const ARQ = `${RAIZ_WS}/offline/walkstamp-offline.html`;
const texto = fs.readFileSync(ARQ, 'utf8');

console.log('[1] o arquivo não tem endereço de rede dentro — é o que a página de segurança manda conferir');
{
  /* A lista é a mesma que a página de segurança cita, mais os dois que o
     Build 36 cortou. Procurar por "http" inteiro não serve: o arquivo tem
     `xmlns` de SVG e endereços de esquema XML, que não são rede. */
  const PROIBIDOS = ['cdn.jsdelivr.net', 'huggingface.co', 'supabase.co',
                     '_vercel/insights', 'googleapis.com', 'unpkg.com'];
  for (const p of PROIBIDOS) {
    const n = texto.split(p).length - 1;
    ok(`nenhuma ocorrência de "${p}"`, n === 0, n ? `${n}×` : '');
  }
  /* E nenhum endereço que o produto possa CHAMAR.
     A distinção não é conveniência: o arquivo embute a biblioteca de PDF
     inteira, e ela traz no próprio texto o repositório dos autores e o site de
     quem escreveu o descompactador — atribuição de terceiro, dentro de
     comentário e de metadado do PDF gerado. Nenhum deles é um destino: são
     texto. Apagá-los seria apagar crédito de quem escreveu a biblioteca.
     O que prova que nada é chamado é o bloco [2], que MEDE — e é por isso que
     ele existe, em vez de esta varredura tentar responder as duas perguntas.
     Aqui ficam os esquemas de XML, que também não são rede. */
  /* Espaços de nome de XML: o .docx, o .pptx e o SCORM os escrevem dentro dos
     arquivos que o produto GERA. São identificadores, não destinos — nenhum
     deles é buscado, nem aqui nem na web. A primeira versão desta linha dizia
     `openxmlformats.com` onde é `.org`, e por isso os quinze do Office
     apareciam como se fossem rede. */
  const CITACAO = /w3\.org|schemas\.openxmlformats\.org|schemas\.microsoft\.com|purl\.org|xml\.org|adlnet\.org\/xsd|imsglobal\.org\/xsd|imsproject\.org\/xsd|walkstamp\.com/;
  /* A BIBLIOTECA DE TERCEIRO SAI DA VARREDURA, e não por uma lista de hosts.
     A primeira versão tentou nomear os sites que ela cita — github, yworks,
     adobe — e a cada rodada aparecia outro: phpied, myersdaily, fpdf, cs.cmu.
     Uma lista de exceções que cresce a cada execução não está protegendo nada;
     está sendo contornada. O jsPDF é embutido no arquivo inteiro, e o que ele
     traz no próprio texto é crédito de quem o escreveu.
     Então a varredura larga olha o arquivo MENOS a biblioteca: assim ela
     continua pegando um endereço novo que alguém acrescente ao PRODUTO, que é
     o que ela existe para pegar. */
  const lib = fs.readFileSync(`${RAIZ_WS}/vendor/jspdf.umd.min.js`, 'utf8');
  const soNosso = texto.split(lib).join('');
  ok('  a biblioteca embutida foi encontrada e separada', soNosso.length < texto.length,
     `${((texto.length - soNosso.length) / 1024).toFixed(0)} KB de terceiro`);
  const urls = [...soNosso.matchAll(/https?:\/\/[^\s'"`)<>]+/g)].map((m) => m[0]);
  const rede = urls.filter((u) => !CITACAO.test(u));
  ok('e nenhum outro endereço de rede sobrou', rede.length === 0,
     [...new Set(rede)].slice(0, 4).join(' '));
}

console.log('\n[2] aberto de file:, ele não fala com ninguém');
const br = await chromium.launch({ executablePath: CHROME_WS });
const ctx = await br.newContext();
const pg = await ctx.newPage();
const fora = []; const erros = [];
pg.on('request', (q) => { const u = q.url(); if (!/^(file|data|blob):/.test(u)) fora.push(q.method() + ' ' + u); });
pg.on('pageerror', (e) => erros.push(String(e).slice(0, 150)));
await pg.goto('file://' + ARQ);
await pg.waitForTimeout(4000);
ok('nenhum pedido para fora do arquivo, parado', fora.length === 0,
   [...new Set(fora)].slice(0, 3).join(' | '));
ok('e nenhum erro de JavaScript', erros.length === 0, erros.slice(0, 2).join(' | '));

console.log('\n[3] o que precisa de rede sumiu, e o que funciona sem ela ficou');
{
  const vis = async (sel) => { try { return await pg.locator(sel).isVisible(); } catch { return false; } };
  ok('a escolha de TRANSCREVER não está na tela', (await vis('#recTr')) === false);
  ok('o botão de LER O TEXTO DA IMAGEM não está na tela', (await vis('#ocr')) === false);
  ok('  mas "usar transcrição pronta" continua', (await vis('#usarPronta')) === true);
  ok('  e "não transcrever" continua', (await vis('#semTr')) === true);
  /* Um rádio marcado e invisível é a pior das duas metades: a pessoa não vê o
     que escolheu e não consegue mudar. */
  const marcadoEscondido = await pg.evaluate(() => {
    for (const r of document.querySelectorAll('input[name="trModo"]')) {
      const cx = r.closest('label.opt');
      if (r.checked && cx && getComputedStyle(cx).display === 'none') return r.id;
    }
    return '';
  });
  ok('nenhuma escolha marcada está escondida', marcadoEscondido === '', marcadoEscondido);
}

console.log('\n[4] a ausência é explicada, e no idioma de quem lê');
{
  /* O idioma da INTERFACE troca pelo `#idiomas`, e não pelo `#lang` — este é o
     idioma da FALA, e mexer nele não repinta nada. A primeira versão deste
     bloco mexia no `#lang`: os cinco idiomas devolviam o mesmo texto em inglês
     e as cinco afirmações passavam, porque elas só olhavam o TAMANHO. Uma
     régua que aprova cinco vezes a mesma tela não está medindo cinco idiomas.
     Agora os textos têm que ser DIFERENTES entre si. */
  const IDIOMAS = ['pt', 'en', 'es', 'de', 'fr'];
  const vistos = new Map();
  for (const L of IDIOMAS) {
    const clicou = await pg.evaluate((l) => {
      const a = document.querySelector(`#idiomas a[data-l="${l}"]`);
      if (!a) return false;
      a.click();
      return true;
    }, L);
    ok(`${L}: o seletor de idioma tem a opção`, clicou);
    await pg.waitForTimeout(300);
    const av = (await pg.locator('#avisoOffline').innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    ok(`  ${L}: o aviso está lá e não está vazio`, av.length > 40, av.slice(0, 55));
    vistos.set(L, av);
  }
  ok('e os cinco avisos são textos DIFERENTES — não é a mesma tela cinco vezes',
     new Set(vistos.values()).size === IDIOMAS.length,
     `${new Set(vistos.values()).size} textos distintos de ${IDIOMAS.length}`);
}

console.log('\n[5] e a versão da WEB continua com tudo — o corte é do pacote, não do produto');
{
  const web = fs.readFileSync(`${RAIZ_WS}/public/app.html`, 'utf8');
  ok('o app da web ainda traz os endereços do modelo',
     web.includes('cdn.jsdelivr.net') && web.includes('huggingface.co'));
  const pg2 = await ctx.newPage();
  /* De `http:` a página não é o pacote offline, e as duas escolhas têm que
     estar de pé. Servida de `file:` ela seria o pacote; por isso um servidor. */
  const http = await import('http');
  const srv = http.createServer((q, r) => {
    r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    r.end(fs.readFileSync(`${RAIZ_WS}/public/app.html`));
  });
  await new Promise((r) => srv.listen(8834, r));
  await pg2.goto('http://localhost:8834/app.html');
  await pg2.waitForTimeout(1500);
  ok('  servida por http, a escolha de transcrever está de pé',
     await pg2.locator('#recTr').isVisible().catch(() => false));
  ok('  e o botão de ler o texto da imagem também',
     await pg2.locator('#ocr').isVisible().catch(() => false));
  ok('  e ali não há aviso de pacote offline',
     (await pg2.locator('#avisoOffline').count()) === 0);
  srv.close();
}

await br.close();
console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'o pacote offline é mudo, e diz por quê'));
process.exit(falhas ? 1 : 0);

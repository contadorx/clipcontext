/* As figuras do documento, nas páginas de caso de uso.
 *
 * O site contava o que sai e nunca MOSTRAVA: cinco páginas com três mil pixels
 * de texto e nenhuma imagem do produto final — que é a única coisa que a pessoa
 * compra. A figura é SVG escrito à mão, e não captura de tela: pesa dois
 * quilobytes em vez de duzentos, é nítida em qualquer zoom e — a parte que
 * importa aqui — não tem uma palavra dentro, então serve aos cinco idiomas sem
 * tradução nenhuma.
 */
import { chromium } from 'playwright';
import fs from 'fs';

import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';
const SITE = 'http://localhost:8802';
const rotas = JSON.parse(fs.readFileSync(`${RAIZ_WS}/src/rotas.json`,'utf8'));
const { idiomas, slugs } = rotas;
const pre = (L) => (L === 'pt' ? '' : '/' + L);
const CASOS = ['casoEv','casoIn','casoAta','casoUx','casoIa'];

let falhas = 0;
const ok = (n,c,e) => { console.log((c?'  ok   ':'  FALHA')+'  '+n+(e?'  → '+e:'')); if(!c) falhas++; };

const br = await chromium.launch({ executablePath: CHROME_WS });
const pg = await (await br.newContext({ viewport: { width: 1200, height: 1000 } })).newPage();

console.log('[1] toda página de caso de uso tem a figura, nos cinco idiomas');
{
  const ruins = [];
  for (const L of idiomas) for (const pgN of CASOS) {
    await pg.goto(SITE + pre(L) + '/' + slugs[pgN][L], { waitUntil: 'domcontentloaded' });
    const n = await pg.locator('.figDoc svg').count();
    if (n !== 1) ruins.push(`${L}/${pgN}=${n}`);
  }
  ok(`${idiomas.length} × ${CASOS.length} = ${idiomas.length*CASOS.length} páginas`,
     ruins.length === 0, ruins.slice(0,5).join(' '));
}

console.log('\n[2] a legenda é traduzida, mas o desenho é o mesmo');
{
  /* É essa a economia: o desenho não tem texto dentro, então cinco idiomas
     custam cinco legendas — e não cinco desenhos. */
  const desenhos = new Set(), legendas = new Set();
  for (const L of idiomas) {
    await pg.goto(SITE + pre(L) + '/' + slugs.casoEv[L], { waitUntil: 'domcontentloaded' });
    desenhos.add(await pg.locator('.figDoc svg').evaluate((e) => e.innerHTML.replace(/<title[^>]*>.*?<\/title>/, '')));
    legendas.add((await pg.locator('.figDoc figcaption').innerText()).trim());
  }
  ok('um desenho só para os cinco', desenhos.size === 1, String(desenhos.size));
  ok('e cinco legendas diferentes', legendas.size === 5, String(legendas.size));
  ok('nenhuma vazia', ![...legendas].some((x) => x.length < 20));
}

console.log('\n[3] cada cenário mostra um documento diferente');
{
  /* Se as cinco figuras fossem iguais, seriam decoração. O que as separa é o
     que o documento daquele cenário de fato leva: a evidência tem hora de
     relógio e impressão digital, o contexto para IA não tem identificação
     nenhuma. */
  const forma = {};
  for (const pgN of CASOS) {
    await pg.goto(SITE + '/' + slugs[pgN].pt, { waitUntil: 'domcontentloaded' });
    forma[pgN] = await pg.locator('.figDoc svg').evaluate((e) => e.innerHTML.length);
  }
  ok('as cinco são diferentes entre si', new Set(Object.values(forma)).size === 5,
     JSON.stringify(forma));
  ok('a evidência é a mais completa', forma.casoEv === Math.max(...Object.values(forma)),
     JSON.stringify(forma));
  ok('e o contexto para IA a mais enxuta', forma.casoIa === Math.min(...Object.values(forma)),
     JSON.stringify(forma));
}

console.log('\n[4] ela é acessível e não pesa');
{
  await pg.goto(SITE + '/' + slugs.casoEv.pt, { waitUntil: 'domcontentloaded' });
  const t = await pg.locator('.figDoc svg title').evaluate((e) => e.textContent.trim());
  ok('o desenho se descreve para quem não o vê', t.length > 30, t.slice(0, 60));
  ok('e a descrição está no idioma da página', /documento/i.test(t), t.slice(0, 40));
  const bytes = await pg.locator('.figDoc svg').evaluate((e) => e.outerHTML.length);
  ok('e cabe em poucos quilobytes', bytes < 8000, `${(bytes/1024).toFixed(1)} KB`);
  /* Sem arquivo externo: a figura viaja no HTML, então não há uma segunda
     requisição para atrasar a página nem uma imagem que pode faltar. */
  const src = await pg.locator('.figDoc img, .figDoc image').count();
  ok('sem imagem externa nenhuma', src === 0, String(src));
}

console.log('\n[5] a home mostra o fluxo, e não só conta');
{
  /* A coisa é ESPACIAL: uma tela entra de um lado, uma página sai do outro, e
     no meio alguém joga fora o que não mudou. Três parágrafos contam isso; um
     desenho mostra em meio segundo. */
  const desenhos = new Set(), legendas = new Set();
  for (const L of idiomas) {
    /* `?lang=` e não só o caminho: a home em português é `/`, e `/` tem a
       detecção de idioma — num navegador em inglês ela redireciona para `/en`
       antes de o teste ler qualquer coisa, e a legenda inglesa aparecia duas
       vezes. A sigla na URL é o sinal explícito que manda em tudo. */
    await pg.goto(SITE + (pre(L) || '') + '/?lang=' + L, { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(250);
    ok(`${L}: a figura do fluxo está lá`, (await pg.locator('.figFluxo svg').count()) === 1);
    desenhos.add(await pg.locator('.figFluxo svg').evaluate(
      (e) => e.innerHTML.replace(/<title[^>]*>.*?<\/title>/, '')));
    legendas.add((await pg.locator('.figFluxo figcaption').innerText()).trim());
  }
  ok('um desenho só para os cinco', desenhos.size === 1, String(desenhos.size));
  ok('e cinco legendas', legendas.size === 5, String(legendas.size));
  /* O quadro descartado é o argumento inteiro do desenho: sem ele seriam três
     retângulos e uma seta. */
  await pg.goto(SITE + '/', { waitUntil: 'domcontentloaded' });
  ok('o desenho tem o quadro DESCARTADO, que é o argumento dele',
     await pg.locator('.figFluxo svg [opacity=".45"]').count() > 0);
}

console.log('\n[5b] a rodada em quatro estados, na página de preços');
{
  /* Esta figura entrou no lugar de um `<video>` que apontava para
     `/demo/rodada.*` — quinze arquivos que não existem no repositório. Nos
     cinco idiomas a página servia um `poster` 404 e um vídeo sem fonte, e nada
     reprovava: um `<video>` quebrado não derruba página, só decepciona.
     O desenho não tem esse jeito de falhar — ou nasce no build, ou o build cai. */
  const desenhos = new Set(), legendas = new Set();
  let bytes = 0, externas = 0, altura = 0;
  for (const L of idiomas) {
    await pg.goto(SITE + pre(L) + '/' + slugs.precos[L], { waitUntil: 'domcontentloaded' });
    ok(`${L}: a figura da rodada está lá`, (await pg.locator('.figRodada svg').count()) === 1);
    const svg = pg.locator('.figRodada svg');
    desenhos.add(await svg.evaluate((e) => e.innerHTML.replace(/<title[^>]*>.*?<\/title>/, '')));
    legendas.add((await pg.locator('.figRodada figcaption').textContent() || '').trim());
    bytes = Math.max(bytes, (await svg.evaluate((e) => e.outerHTML)).length);
    externas += await pg.locator('.figRodada image, .figRodada img').count();
    /* Altura calculada e não zero: um SVG sem altura resolvida colapsa para
       nada em alguns navegadores, e a figura some sem erro nenhum. */
    altura = Math.max(altura, await svg.evaluate((e) => e.getBoundingClientRect().height));
  }
  ok('um desenho só para os cinco', desenhos.size === 1, String(desenhos.size));
  ok('e cinco textos de legenda', legendas.size === 5, String(legendas.size));
  ok('a altura é calculada, e não zero', altura > 40, `${Math.round(altura)}px`);
  ok('não referencia nada externo', externas === 0, String(externas));
  ok('e cabe em poucos quilobytes', bytes < 20000, `${(bytes / 1024).toFixed(1)} KB`);
  /* Os quatro estados são o argumento da figura: sem os quatro, ela vira um
     desenho bonito de uma planilha. */
  await pg.goto(SITE + '/precos', { waitUntil: 'domcontentloaded' });
  const passos = await pg.locator('.figRodada svg text').allTextContents();
  ok('os quatro estados estão numerados', ['1', '2', '3', '4'].every((n) => passos.includes(n)),
     passos.slice(0, 8).join(' '));
}

console.log('\n[6] a página de preços diz o que SAI');
{
  /* O NÚMERO SAI DO CATÁLOGO, e não de um piso escrito aqui.
     Era `>= 10`, e a tira tinha 13 selos escritos à mão em seis cópias — cinco
     páginas de preço e a home — contra 15 saídas no catálogo. Três capacidades
     PRONTAS eram vendidas como inexistentes: o documento por tarefa, o pacote
     em vários idiomas e o prompt para IA. Um piso de 10 nunca ia reprovar isso.
     Agora a tira é gerada, e esta régua cobra a IGUALDADE com a fonte. */
  const catalogo = JSON.parse(fs.readFileSync(`${RAIZ_WS}/src/features.json`, 'utf8'));
  const saidas = (catalogo.grupos.find((g) => g.id === 'saidas') || {}).itens || [];
  ok('o catálogo declara as saídas', saidas.length > 0, String(saidas.length));
  ok('e toda saída tem selo — sem isso a tira encolhe em silêncio',
     saidas.every((i) => i.selo), saidas.filter((i) => !i.selo).map((i) => i.pt).join(' | '));

  for (const L of idiomas) {
    await pg.goto(SITE + pre(L) + '/' + slugs.precos[L], { waitUntil: 'domcontentloaded' });
    const n = await pg.locator('.saidas .saida').count();
    ok(`${L}: a tira mostra as ${saidas.length} saídas do catálogo`, n === saidas.length, String(n));
  }

  /* A HOME É DUAS METADES, e a soma tem de fechar com o catálogo: quatro em
     destaque e o resto na gaveta. Elas eram a sexta e a sétima cópia à mão. */
  await pg.goto(SITE + '/', { waitUntil: 'domcontentloaded' });
  const emCima = await pg.locator('.saidas .saida').count()
                 - await pg.locator('details.maisSaidas .saida').count();
  const naGaveta = await pg.locator('details.maisSaidas .saida').count();
  ok(`a home mostra ${saidas.filter((i) => i.destaque).length} em cima`,
     emCima === saidas.filter((i) => i.destaque).length, String(emCima));
  ok('e o resto na gaveta, sem perder nenhuma',
     emCima + naGaveta === saidas.length, `${emCima} + ${naGaveta}`);
  /* Nomes de formato não se traduzem — é a mesma tira nos cinco. */
  await pg.goto(SITE + '/de/preise', { waitUntil: 'domcontentloaded' });
  const t = await pg.locator('.saidas').innerText();
  ok('com PDF, Word, slides, SCORM e o JSON que traz o documento de volta',
     ['PDF','DOCX','PPTX','SCORM','JSON'].every((x) => t.includes(x)), t.replace(/\n/g,' ').slice(0,70));
}

console.log('\n[7] o comparativo virou gráfico');
{
  await pg.goto(SITE + '/comparativo', { waitUntil: 'domcontentloaded' });
  const marca = await pg.locator('table.legal td.sim').first().evaluate(
    (e) => getComputedStyle(e, '::before').content);
  const contra = await pg.locator('table.legal td.nao').first().evaluate(
    (e) => getComputedStyle(e, '::before').content);
  ok('o que a ferramenta faz ganha um sinal', /✓/.test(marca), marca);
  ok('e o que ela não faz, outro', /✕/.test(contra), contra);
  /* `--err` NUNCA existiu no CSS do site: a classe `.nao` pintava com uma
     variável indefinida, ou seja, não pintava. Ficou vermelho de mentira por
     meses. */
  const cor = await pg.locator('table.legal td.nao').first().evaluate(
    (e) => getComputedStyle(e).color);
  ok('e o vermelho é vermelho de verdade', /rgb\(179, 42, 58\)|rgb\(239, 132, 132\)/.test(cor), cor);
  /* A coluna do produto é a que a pessoa veio comparar contra as outras. */
  const fundo = await pg.locator('table.legal td:nth-child(2)').first().evaluate(
    (e) => getComputedStyle(e).backgroundColor);
  ok('a nossa coluna se distingue das outras', fundo !== 'rgba(0, 0, 0, 0)', fundo);
}

await br.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nFiguras e gráficos do site: tudo passou.');
process.exit(falhas ? 1 : 0);

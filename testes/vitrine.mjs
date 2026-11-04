/* A vitrine: o rodapé e as fichas de saída (a tabela por plano saiu no Build 71).
 *
 * O que este teste protege é uma coisa só, e ela é comercial antes de ser
 * técnica: **o site não pode prometer o que a ferramenta não faz.** Uma marca
 * de visto numa tabela de preço é uma promessa, e uma ficha "PPTX" na home é
 * outra. Aqui elas são conferidas contra o `app.html` de verdade.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import { criarProxy, exigirNext } from './proxy.mjs';
import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';
await exigirNext();

const srv = criarProxy();
await new Promise((r) => srv.listen(8870, r));
const BASE = 'http://localhost:8870';
const br = await chromium.launch({ executablePath: CHROME_WS });
let falhas = 0;
const ok = (n, c, e) => { console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : '')); if (!c) falhas++; };

const feats = JSON.parse(fs.readFileSync(`${RAIZ_WS}/src/features.json`, 'utf8'));
const TOTAL = feats.grupos.reduce((n, g) => n + g.itens.length, 0);
const app = fs.readFileSync(`${RAIZ_WS}/public/app.html`, 'utf8');

const ctx = await br.newContext({ viewport: { width: 1200, height: 900 } });
const pg = await ctx.newPage();
const erros = []; pg.on('pageerror', (e) => erros.push(e.message));

/* [1], [2] e [3] saíram no Build 71: a lista completa por plano, a tradução
   dela e o selo de cada plano moravam na página de preços, e a página e os
   planos saíram juntos. */

console.log('\n[4] a ferramenta não confere licença nenhuma');
{
  /* Até o Build 68 a tese era "a licença destrava UMA coisa dentro do app — a
     marca do cliente no documento", e este bloco contava as travas. No 69 a
     ferramenta ficou inteira grátis: não há trava para contar. A página de
     preços ainda lista o que era de plano até o Build 71, quando ela sai —
     a contagem do `features.json` continua aqui até lá. */
  const pagos = feats.grupos.flatMap((g) => g.itens).filter((i) => !i.planos.includes('f'));
  ok(`${pagos.length} funcionalidades ainda aparecem como pagas no site, de ${TOTAL}`,
     pagos.length < TOTAL / 3, `${pagos.length}/${TOTAL}`);
  /* Uma definição, e não uma menção: os comentários contam a história do
     `temTime()`, e contar a palavra contaria a história. */
  ok('a ferramenta não define checagem de plano',
     !/(function|const|let)\s+temTime\b|(function|const|let)\s+temPago\b/.test(app),
     (app.match(/(function|const|let)\s+tem(Time|Pago)\b/) || [''])[0]);
  ok('nem lê o plano de uma licença', !/dados\.p\b|\.p !== 'time'/.test(app),
     (app.match(/dados\.p\b|\.p !== 'time'/) || [''])[0]);
}

/* ---------------------------------------------------------------- as fichas */
console.log('\n[5] cada ficha de saída na home existe como botão na ferramenta');
{
  await pg.goto(BASE + '/?lang=pt');
  await pg.waitForTimeout(300);
  /* A PROVA MORA NO CATÁLOGO, junto do selo que ela sustenta.
     Até o Build 4 ela morava aqui, num dicionário indexado pelo TEXTO do selo —
     e o texto do selo é decisão de vitrine. Bastou o catálogo ganhar os selos
     de verdade para três fichas ("Multi-idioma", "VTT/SRT", "Prompt") caírem
     com "ficha sem prova declarada no teste": a régua não tinha achado defeito
     nenhum, ela só não conhecia os nomes novos. Duas fichas do mesmo ZIP, ainda
     por cima, colidiam na mesma chave `ZIP` e uma delas ficava sem cobrança.
     Agora cada saída carrega `prova` — o que precisa existir no `app.html` para
     a ficha ser verdadeira — e um selo novo sem prova é vermelho aqui, no build
     em que nasce.
     VTT e SRT não têm botão próprio: viajam DENTRO do .zip, como `legenda.vtt`
     e `legenda.srt`. O formato continua existindo, e é isso que a home promete. */
  const saidas = feats.grupos.find((g) => g.id === 'saidas').itens;
  const fichas = await pg.locator('.saidas .saida').count();
  ok('a home mostra uma ficha para cada saída do catálogo',
     fichas === saidas.length, `${fichas} na página × ${saidas.length} no catálogo`);
  const semProva = saidas.filter((i) => !String(i.prova || '').trim());
  ok('toda saída do catálogo declara a sua prova', semProva.length === 0,
     semProva.map((i) => i.selo).join(', '));
  for (const i of saidas) {
    const nome = i.selo + (i.seloNota ? ' ' + i.seloNota : '');
    ok(`"${nome}" existe de verdade no app.html`, app.includes(i.prova),
       'não achei ' + i.prova);
  }
}

/* ---------------------------------------------------------------- o rodapé */
console.log('\n[6] o rodapé tem os casos de uso, nos três idiomas');
{
  const casos = {
    pt: ['/evidencia-de-teste', '/instrucao-de-trabalho', '/ata-de-reuniao', '/teste-de-usabilidade', '/contexto-para-ia'],
    en: ['/en/test-evidence', '/en/work-instruction', '/en/meeting-minutes', '/en/usability-test', '/en/context-for-ai'],
    es: ['/es/evidencia-de-prueba', '/es/instruccion-de-trabajo', '/es/acta-de-reunion', '/es/prueba-de-usabilidad', '/es/contexto-para-ia'],
  };
  const conta = { pt: '/conta', en: '/en/account', es: '/es/cuenta' };
  for (const [L, rota] of Object.entries({ pt: '/comparativo', en: '/en/compare', es: '/es/comparativa' })) {
    await pg.goto(BASE + rota);
    const links = await pg.locator('footer a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    const faltam = casos[L].filter((c) => !links.includes(c));
    ok(`${L}: os cinco casos de uso estão no rodapé`, faltam.length === 0, faltam.join(' '));
    /* A área do cliente estava no rodapé até o Build 70; saiu no 71. */
    ok(`${L}: e não leva mais à área do cliente`, !links.some((h) => h && h.startsWith(conta[L])), links.join(' '));
    const titulos = await pg.locator('footer .rodapeCols h3').allTextContents();
    ok(`${L}: três colunas com nome`, titulos.length === 3 && titulos.every((t) => t.trim()), titulos.join(' | '));
    /* Endereço de outro idioma no rodapé é o erro clássico de site traduzido:
       a pessoa clica e cai numa página que não fala a língua dela. */
    const forasteiros = links.filter((h) => h && h.startsWith('/') &&
      (L === 'pt' ? /^\/(en|es)\//.test(h) : !h.startsWith(`/${L}/`) && h !== `/${L}` && !h.startsWith('/app')));
    ok(`${L}: nenhum link do rodapé vai para outro idioma`, forasteiros.length === 0, forasteiros.join(' '));
  }
}

/* [7] saiu junto: media a lista completa no telefone, na página de preços. */

ok('sem erro de JS', erros.length === 0, erros.join(' | ').slice(0, 160));
await br.close(); srv.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nVitrine: tudo passou.');
process.exit(falhas ? 1 : 0);

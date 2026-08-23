/* NENHUM TEXTO QUE O PRODUTO ENTREGA CONTÉM `undefined`.
 *
 * O caso que a gerou: o resumo para o Jira chamava `t('wFrames')`, uma verba
 * que não existe em idioma nenhum. `t()` devolve `undefined` para verba
 * inexistente, e o texto que a pessoa cola no chamado saía com a palavra
 * "undefined" dentro — na frente do cliente, no anexo da evidência.
 *
 * O `jira.mjs` IMPRIMIA o defeito e saía zero. Ele estava na tela em toda
 * execução da regressão, e ninguém o via, porque ele não era uma afirmação:
 * era um `console.log`.
 *
 * Esta régua generaliza. Ela não conhece `wFrames`: ela conhece o SINTOMA de
 * uma lista paralela consertada pela metade — e o sintoma é sempre o mesmo
 * punhado de palavras que o JavaScript escreve quando alguém lhe pede um valor
 * que não existe. Ela teria pego o caso do Jira no dia em que ele apareceu, e
 * pega o próximo sem que ninguém escreva uma linha aqui.
 *
 * O QUE ELA OLHA: os quatro artefatos que saem da ferramenta com texto dentro —
 * o resumo do Jira (área de transferência), o nome do arquivo, a linha de
 * status que a pessoa lê, e o Markdown, que é a saída de texto puro. Ela NÃO
 * olha o PDF: lá o texto vira desenho, e um teste de PDF é `pdfev.mjs`.
 */
import http from 'http';
import fs from 'fs';

import { chromium } from './_navegador.mjs';
import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';

const ROOT = `${RAIZ_WS}/public`;
const html = fs.readFileSync(ROOT + '/app.html', 'utf8');
const srv = http.createServer((q, r) => {
  if (q.url.startsWith('/_vercel/')) { r.writeHead(200, { 'Content-Type': 'text/javascript' }); return r.end(''); }
  r.writeHead(200, { 'Content-Type': 'text/html' }); r.end(html);
});
await new Promise((r) => srv.listen(8917, r));

let falhas = 0;
const ok = (n, c, extra) => {
  console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (extra ? '  → ' + extra : ''));
  if (!c) falhas++;
};

/* As palavras que o JavaScript escreve quando lhe pedem o que não existe.
   `null` entra porque `t()` de verba apagada e `campo || null` produzem os dois
   — e a pessoa que lê o chamado não distingue um do outro. */
const PODRE = /\bundefined\b|\bnull\b|\[object Object\]|\bNaN\b/;

function limpo(nome, texto) {
  const m = (texto || '').match(PODRE);
  ok(nome, !m, m ? `achei ${JSON.stringify(m[0])} em "…${texto.slice(Math.max(0, m.index - 40), m.index + 40)}…"` : '');
}

const br = await chromium.launch({ executablePath: CHROME_WS });
const ctx = await br.newContext({
  acceptDownloads: true,
  permissions: ['clipboard-read', 'clipboard-write'],
});
const pg = await ctx.newPage();

/* Nos CINCO idiomas o defeito é o mesmo defeito, e uma verba pode existir em um
   e faltar em outro — que é exatamente como as listas paralelas deste projeto
   costumam quebrar. Rodar os cinco custa segundos; rodar um custa um chamado. */
for (const L of ['pt', 'en', 'es', 'de', 'fr']) {
  console.log(`\n[${L}] o material sai limpo`);
  await pg.goto(`http://localhost:8917/app.html?lang=${L}&modelo=evidencia` +
                '&caso=CT-014&chamado=UAT-4711&sistema=S4P%2F100&quem=Leandro&resultado=ok');
  await pg.waitForTimeout(400);
  await pg.setInputFiles('#file', '/tmp/amostra.webm');
  await pg.waitForTimeout(2500);
  await pg.selectOption('#mode', 'count');
  await pg.fill('#count', '3');
  await pg.locator('#extract').click();
  await pg.waitForSelector('#prevCard:not(.hide)', { timeout: 40000 });
  await pg.waitForTimeout(500);

  /* Uma anotação escrita à mão: sem ela o caminho da nota não é exercitado, e
     é justamente por ele que o título do passo chega ao documento. */
  const campos = await pg.locator('#thumbs figure input').all();
  if (campos.length) { await campos[0].fill('Abrir a ME21N'); await pg.waitForTimeout(200); }

  /* 1. O resumo do Jira — o texto que a pessoa COLA no chamado. */
  await pg.locator('#jira').click();
  await pg.waitForFunction(
    () => /copiad|copied|kopiert|copié/i.test(document.getElementById('pdfStatus').textContent || ''),
    null, { timeout: 15000 },
  ).catch(() => {});
  const resumo = await pg.evaluate(() => navigator.clipboard.readText());
  ok(`${L}: o resumo do Jira não veio vazio`, (resumo || '').length > 40, String((resumo || '').length));
  limpo(`${L}: o resumo do Jira está limpo`, resumo);

  /* 2. O Markdown — a saída de texto puro, e a que mais gente cola em outro
        lugar. Baixada, e não lida da tela: é o arquivo que viaja. */
  const baixa = pg.waitForEvent('download', { timeout: 40000 });
  await pg.locator('#md').click();
  const dl = await baixa;
  const caminho = await dl.path();
  const md = fs.readFileSync(caminho, 'utf8');
  ok(`${L}: o markdown não veio vazio`, md.length > 100, String(md.length));
  limpo(`${L}: o markdown está limpo`, md);

  /* 3. O nome do arquivo, que é o que aparece na lista de anexos do chamado. */
  limpo(`${L}: o nome do arquivo está limpo`, dl.suggestedFilename());

  /* 4. A linha de status, que é o texto que a pessoa lê na hora. */
  limpo(`${L}: a linha de status está limpa`,
        await pg.locator('#pdfStatus').textContent());
}

await ctx.close();
await br.close();
srv.close();

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTexto entregue: nada de undefined.');
process.exit(falhas ? 1 : 0);

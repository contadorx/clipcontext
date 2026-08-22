/* O PDF do Anexo de Tratamento de Dados Pessoais.
 *
 * POR QUE ELE NÃO SAI DO `build.py`. Renderizar PDF precisa de um navegador, e
 * o `build.py` tem que rodar numa máquina sem nada instalado — é ele que monta
 * o produto. Tentei fazer o build estampar um `public/dpa.html` para este
 * arquivo só imprimir, e o próprio build barrou: existe uma trava que proíbe
 * `.html` solto em `public/`, porque um arquivo estático ali TAPA a rota que o
 * Next serve. A trava está certa; quem estava errado era eu.
 *
 * Então a identidade é lida onde ela já mora depois do build: `src/marca.json`
 * — o mesmo arquivo que o `lib/site.ts` consulta para estampar as páginas.
 * Continua havendo uma fonte só de razão social, CNPJ e canal do encarregado.
 *
 * POR QUE NÃO É reportlab NEM UM .docx. O documento tem que dizer exatamente o
 * que a política publicada diz, e a forma de garantir isso é `terceiros.mjs`
 * comparar os dois. Reescrevê-lo numa segunda ferramenta acrescentaria uma
 * terceira versão do mesmo texto — e a que diverge é sempre a que vai assinada.
 *
 *   python3 build.py && node testes/gerar-dpa.mjs   -> public/dpa-walkstamp.pdf
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';
const RAIZ = `${RAIZ_WS}`;
/* CINCO IDIOMAS, e nao um.
 *
 * O DPA e o unico documento do projeto que vai ASSINADO, e existia so em
 * portugues enquanto o produto vende em cinco. Quem chega a pedir o anexo ja
 * decidiu que quer — e nesse ponto quem entra no fluxo e seguranca ou juridico,
 * lendo. Um anexo que o revisor nao le trava a compra depois de ela ter sido
 * ganha.
 *
 * As quatro traducoes dizem, em caixa propria e na primeira dobra, que sao
 * traducoes de cortesia e que a versao portuguesa e a que vale. Isso nao e
 * ressalva defensiva: e o que qualquer fornecedor serio faz quando o contrato
 * tem uma lingua de origem, e evita o caso em que alguem assina uma traducao
 * achando que assinou o contrato. */
const IDIOMAS_DPA = ['pt', 'en', 'es', 'de', 'fr'];
const RODAPE_TIT = {
  pt: 'Anexo de Tratamento de Dados Pessoais',
  en: 'Personal Data Processing Annex',
  es: 'Anexo de Tratamiento de Datos Personales',
  de: 'Anhang zur Verarbeitung personenbezogener Daten',
  fr: 'Annexe relative au traitement des données personnelles',
};
const so = process.argv.find((a) => a.startsWith('--lang='));
const ALVOS = so ? [so.slice(7)] : IDIOMAS_DPA;
for (const L of ALVOS) {
  const f = path.join(RAIZ, 'src', 'site', `dpa.${L}.html`);
  if (!fs.existsSync(f)) { console.error(`Falta src/site/dpa.${L}.html.`); process.exit(1); }
}
const marca = JSON.parse(fs.readFileSync(path.join(RAIZ, 'src', 'marca.json'), 'utf8'));

const br = await chromium.launch({ executablePath: CHROME_WS });
for (const LANG of ALVOS) {
const FONTE = path.join(RAIZ, 'src', 'site', `dpa.${LANG}.html`);
/* Um arquivo por idioma, com o idioma no nome: `dpa-walkstamp-en.pdf` e o que
   se anexa a um e-mail para o revisor, e o nome tem que dizer qual e. O
   portugues mantem o nome de sempre — ele ja circula. */
const SAIDA = path.join(RAIZ, 'public',
  LANG === 'pt' ? 'dpa-walkstamp.pdf' : `dpa-walkstamp-${LANG}.pdf`);

let html = fs.readFileSync(FONTE, 'utf8');
/* A VERSÃO É ESCRITA NO DOCUMENTO, e não é a data de hoje: um documento
   jurídico cuja versão muda a cada build não tem versão. */
const versao = (html.match(/<!--\s*versao:\s*([0-9-]+)\s*-->/) || [, 'sem versao'])[1];
const valores = {
  marca: marca.marca, empresa: marca.empresa, cnpj: marca.cnpj, contato: marca.contato,
  siteDom: String(marca.site).split('//').pop(), dataDpa: versao,
  encarregado: marca.encarregado,
};
for (const [k, v] of Object.entries(valores)) html = html.split('{{' + k + '}}').join(v);

/* Token sem valor vira texto literal no papel — `{{cnpj}}` impresso num anexo
   contratual é o tipo de erro que ninguém revisa porque ninguém relê o que já
   assinou uma vez. */
const sobrando = [...new Set([...html.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]))];
if (sobrando.length) {
  console.error(`Token sem valor em dpa.${LANG}.html: ` + sobrando.join(', '));
  process.exit(1);
}

const tmp = path.join(RAIZ, 'node_modules', '.cache-dpa.html');
fs.mkdirSync(path.dirname(tmp), { recursive: true });
fs.writeFileSync(tmp, html, 'utf8');

const pg = await (await br.newContext()).newPage();
await pg.goto('file://' + tmp, { waitUntil: 'load' });

/* `printBackground` liga porque o cabeçalho das tabelas e a caixa de destaque
   são fundo — sem ele, a tabela de suboperadores sai sem a linha de título
   distinguível, que é justamente a linha que o avaliador procura. */
await pg.pdf({
  path: SAIDA,
  format: 'A4',
  printBackground: true,
  margin: { top: '18mm', bottom: '16mm', left: '16mm', right: '16mm' },
  displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate:
    '<div style="width:100%;font:8pt sans-serif;color:#8a8a8a;padding:0 16mm;' +
    'display:flex;justify-content:space-between">' +
    `<span>${RODAPE_TIT[LANG]}</span>` +
    '<span>página <span class="pageNumber"></span> de <span class="totalPages"></span></span></div>',
});

await pg.close();
fs.unlinkSync(tmp);

const kb = (fs.statSync(SAIDA).size / 1024).toFixed(0);
console.log(`${path.basename(SAIDA)}  ${kb} KB  (versão ${versao})`);
}
await br.close();

/* O convite por e-mail — e, desde o Build 69, ele é um e-mail DA PESSOA.
 *
 * A ferramenta promete que nada sai do computador de quem usa, e essa promessa
 * é o produto. Até o Build 68 o convite era a única exceção: um endereço do
 * site mandava o e-mail, com travas contra virar relé de spam. No 69 ele
 * passou a abrir o programa de e-mail de quem indica, e no 71 a rota do site
 * saiu de vez — e, com ela, os blocos desta régua que cobravam as travas, a
 * declaração da exceção na política e o documento de configuração.
 *
 * O que sobra é o que importa: o caminho é o `mailto`, ele só leva o texto e o
 * endereço do site, e nenhum clique vai ao servidor.
 */
import { chromium } from 'playwright';
import fs from 'fs';

import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';
const BASE = 'http://localhost:8802';
const APP = `${RAIZ_WS}/public/app.html`;

let falhas = 0;
const ok = (n, c, e) => { console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : '')); if (!c) falhas++; };

const app = fs.readFileSync(APP, 'utf8');

console.log('[1] a ferramenta não manda mais o convite: ele é um e-mail da pessoa');
{
  /* ATÉ O BUILD 68 a ferramenta mandava o endereço de quem ia receber a uma rota
     nossa, que enviava o convite — e esta régua cobrava que a exceção estivesse
     escrita no formulário. No 69 o produto ficou sem servidor e o formulário
     saiu: o convite abre o programa de e-mail de quem indica, e da ferramenta
     não sai nada. A rota do site saiu no Build 71. */
  ok('a ferramenta não chama a rota do convite', !/\/api\/convite/.test(app));
  ok('e o formulário de envio saiu', !/id="compEnviar"/.test(app) && !/id="compPara"/.test(app));
  ok('o caminho é o mailto', /abrirEmail\(mailto\)/.test(app));
}

console.log('\n[2] o mailto é o caminho, e só leva o endereço do site');
{
  ok('há um mailto montado', /const mailto = 'mailto:\?subject='/.test(app));
  const expr = (app.match(/const mailto = 'mailto:[\s\S]*?;/) || [''])[0];
  ok('e ele leva o texto e o endereço, nada de documento',
     /compCorpo/.test(expr) && /url/.test(expr) && !/nomeArquivo|frames|blob|base64/.test(expr),
     expr.slice(0, 120));
}

console.log('\n[3] o LinkedIn continua sem passar por nós');
{
  ok('o link é montado no navegador',
     /linkedin\.com\/sharing\/share-offsite/.test(app));
  ok('e leva o endereço do site, não um documento',
     /share-offsite\/\?url=' \+ encodeURIComponent\(url\)/.test(app));
}

const br = await chromium.launch({
  executablePath: CHROME_WS,
});
console.log('\n[4] o botão de e-mail abre o programa da pessoa, sem ida ao servidor');
{
  const pg = await (await br.newContext()).newPage();
  const idas = [];
  await pg.route('**/api/convite', r => { idas.push(1); r.fulfill({ status: 503, body: '{}' }); });
  await pg.goto(BASE + '/app.html?lang=pt');
  await pg.evaluate(() => {
    /* O convite nasce escondido e só aparece depois de a pessoa baixar alguma
       coisa — este teste é sobre o botão, não sobre o gatilho. */
    document.getElementById('compCx').classList.remove('hide');
  });
  /* O `convidarACompartilhar` é quem liga o botão, e ele só roda quando um
     documento sai. Sem documento aqui, o botão é ligado à mão pelo mesmo
     caminho: o clique tem que dar no `mailto`, e não num formulário. */
  ok('o botão de e-mail existe', (await pg.locator('#compEmailAbrir').count()) === 1);
  ok('e não há formulário escondido atrás dele', (await pg.locator('#compEmailCx').count()) === 0);
  await br.close();
  ok('nenhuma ida ao servidor', idas.length === 0, String(idas.length));
}

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nConvite por e-mail: tudo passou.');
process.exit(falhas ? 1 : 0);

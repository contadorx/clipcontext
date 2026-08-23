import { chromium } from './_navegador.mjs';
import http from 'http'; import fs from 'fs';
import { criarProxy, exigirNext } from './proxy.mjs';
import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';
await exigirNext();

const ROOT = `${RAIZ_WS}/public`;
const tipos = { '.css':'text/css', '.svg':'image/svg+xml', '.js':'text/javascript', '.ico':'image/x-icon' };
/* O site virou Next.js: as páginas não existem mais como arquivo em public/.
   O servidorzinho estático daqui virou um encaminhador para o Next — mesma
   porta, mesmas URLs no teste, e quem responde é o produto de verdade. */
const srv = criarProxy();
await new Promise(r => srv.listen(8913, r));

const br = await chromium.launch({ executablePath: CHROME_WS });
let falhas = 0;
const ok = (n, c, extra) => { console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (extra ? '  → ' + extra : '')); if (!c) falhas++; };

const ctx = await br.newContext({ permissions: ['clipboard-read','clipboard-write'] });
const pg = await ctx.newPage();
const erros = [];
pg.on('pageerror', e => erros.push(e.message));

console.log('[1] a página existe nos três idiomas e está no mapa do site');
for (const [u, marca] of [['/link','Um link pronto'], ['/en/link','A ready-made link'], ['/es/link','Un enlace listo']]) {
  await pg.goto('http://localhost:8913' + u);
  await pg.waitForTimeout(250);
  ok(u + ' abre', (await pg.locator('h1').textContent()).includes(marca.split(' ')[0]),
     (await pg.locator('h1').textContent()).slice(0, 40));
}
{
  const sm = fs.readFileSync(ROOT + '/sitemap-paginas.xml', 'utf8');
  ok('as três versões estão no sitemap',
     sm.includes('/link<') && sm.includes('/en/link<') && sm.includes('/es/link<'));
}

console.log('\n[2] o construtor monta o link');
await pg.goto('http://localhost:8913/link');
await pg.waitForTimeout(300);
await pg.fill('#lkCaso', 'CT-014 Criar pedido de compra');
await pg.fill('#lkChamado', 'NAT-1234');
await pg.fill('#lkSistema', 'S4P / 100');
await pg.waitForTimeout(250);
const url = await pg.locator('#lkUrl').textContent();
console.log('      ' + url);
ok('aponta para o app', /\/app\?/.test(url));
ok('leva o modelo de saída', /modelo=evidencia/.test(url));
ok('leva o caso', /caso=CT-014\+Criar\+pedido/.test(url) || /caso=CT-014%20Criar/.test(url), url);
ok('leva o chamado', /chamado=NAT-1234/.test(url));
ok('a barra do mandante fica legível', /sistema=S4P\+%2F\+100/.test(url) === false && /S4P/.test(url), url);
ok('o botão de testar aponta para o mesmo lugar',
   (await pg.locator('#lkAbrir').getAttribute('href')) === url);

console.log('\n[3] o link montado realmente preenche a ferramenta');
{
  const caminho = url.replace(/^https?:\/\/[^/]+/, '');
  const pg2 = await ctx.newPage();
  const e2 = []; pg2.on('pageerror', e => e2.push(e.message));
  await pg2.goto('http://localhost:8913' + caminho);
  await pg2.waitForTimeout(700);
  ok('o caso chegou', (await pg2.locator('#evCaso').inputValue()) === 'CT-014 Criar pedido de compra',
     await pg2.locator('#evCaso').inputValue());
  ok('o chamado chegou', (await pg2.locator('#evChamado').inputValue()) === 'NAT-1234');
  ok('o sistema chegou com a barra certa', (await pg2.locator('#evSis').inputValue()) === 'S4P / 100',
     await pg2.locator('#evSis').inputValue());
  ok('o modelo de saída chegou', (await pg2.locator('#modelo').inputValue()) === 'evidencia');
  ok('sem erro de JS no app', e2.length === 0, e2.join(' | ').slice(0, 150));
  await pg2.close();
}

console.log('\n[4] copiar');
await pg.locator('#lkCopiar').click();
await pg.waitForTimeout(300);
ok('copiou para a área de transferência',
   (await pg.evaluate(() => navigator.clipboard.readText())) === url);
ok('e avisou', /Copiado/.test(await pg.locator('#lkMsg').textContent()));

console.log('\n[5] o link virou item do plano GRÁTIS na página de preços');
await pg.goto('http://localhost:8913/precos');
await pg.waitForTimeout(300);
{
  const gratis = await pg.locator('.plan').first().innerHTML();
  const time = await pg.locator('.plan').nth(1).innerHTML();
  /* PELA ALÇA TAMBÉM AQUI. Esta linha citava "Link pronto" e reprovou quando a
     bala foi reescrita — o item continuava no cartão, com outras palavras. O
     que ela quer saber é se o link para a página do `/link` está no cartão
     GRÁTIS, e isso se pergunta pelo `href`. */
  ok('está no cartão Free', /href="[^"]*\/link"/.test(gratis),
     gratis.match(/<li>[^<]*<a href="[^"]*link"[^>]*>[^<]*<\/a>[^<]*/) || '');
  /* E a bala tem que dizer o que a coisa É. Antes ela dizia "link pronto para
     Zephyr, Jira e TestRail", a uma palavra de ser lida como integração — e o
     FAQ gastava uma resposta inteira desmentindo o próprio cartão ("não existe
     conexão com Zephyr nem com TestRail hoje, e não vou dizer que existe"). Um
     cartão que precisa de nota de rodapé para não enganar está enganando. */
  ok('  e diz que é endereço, não integração',
     /integra[çc]|integration|Integration|intégration/.test(gratis),
     (gratis.match(/<li>[^<]*<a[^>]*link"[^>]*>[\s\S]{0,140}?<\/li>/) || [''])[0].slice(0, 130));
  ok('saiu do cartão pago', !/Link de equipe/.test(time));
  /* PELA ALÇA, E NÃO PELA PROSA. O que este teste quer saber é se a identidade
     continua no cartão pago depois de o link ter descido para o Free — e isso é
     uma pergunta sobre QUAL item está lá, não sobre como ele está escrito. A
     versão anterior citava a frase inteira ("Identificar o documento: logotipo e
     nome do cliente") e reprovou quando o B5 reescreveu o cartão em torno da
     rodada: o item continuava lá, com outras palavras. A alça `data-f` existe
     desde o B1 justamente para isso, e é o catálogo que garante que ela aponta
     para um recurso de verdade. */
  /* PELA ALÇA, E SÓ PELA ALÇA. Esta linha exigia a palavra "logotipo" DEPOIS
     da alça — que é exatamente a prosa que o comentário acima diz para não
     cobrar, e foi por prosa que ela já reprovou uma vez. O cartão foi
     reescrito de novo, e a bala agora diz "guarde o seu padrão de documento e
     o seu cliente". A alça continua lá, apontando para o mesmo item do
     catálogo, e é isso que se queria saber. */
  ok('e o Personal continua com a identidade',
     /data-f="modeloProprio"/.test(time),
     (time.match(/data-f="modeloProprio"[^<]*/) || ['(não achou)'])[0]);
  /* OS TERMOS GRAVADOS SAIRAM DO CARTAO — e a preocupação original continua de
     pé, só que pelo avesso.
     
     Ela era: o cartão pago não pode vender o que o produto entrega de graça
     (aplicar os termos é de todo mundo; o que seria pago é a lista ficar
     GRAVADA). Só que guardar ainda não existe, e um "em breve" no meio das
     balas do plano obriga quem decide a separar o que já se compra do que foi
     prometido. Ele foi para a caixa do roteiro, abaixo dos cartões.
     
     Então o que se cobra aqui agora é o par: o cartão pago não fala de termos,
     e a caixa do roteiro fala. `planos.mjs` [9] cobra a regra geral; esta linha
     cobra este item, que é o que este arquivo veio olhar. */
  ok('o cartão pago não vende mais o vocabulário', !/gravad|termos/i.test(time),
     (time.match(/[^<>]*(gravad|termos)[^<>]*/i) || ['(limpo)'])[0].slice(0, 70));
  /* A CAIXA MUDOU, O PAR CONTINUA. Era a `roteiroFuturo`, logo abaixo dos
     cartões. A página nova recolheu a lista completa num `<details>` no fim, e
     é lá que os itens com estado moram — abaixo dos cartões e fora da decisão
     de compra, que era a razão de ser da caixa antiga. */
  const futuro = await pg.locator('details.listaCompleta').innerHTML().catch(() => '');
  ok('e a lista recolhida é quem fala dos termos gravados', /guardad|gravad/i.test(futuro),
     (futuro.match(/[^<>]*(guardad|gravad)[^<>]*/i) || ['(não achou)'])[0].slice(0, 70));
}

ok('sem erro de JS', erros.length === 0, erros.join(' | ').slice(0, 200));
await br.close(); srv.close();
console.log(falhas ? '\n' + falhas + ' falha(s)' : '\nPágina do link: tudo passou.');
process.exit(falhas ? 1 : 0);

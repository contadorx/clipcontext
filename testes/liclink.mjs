/* O plano Time entra por LINK, e não por chave digitada. */
import { chromium } from './_navegador.mjs';
import http from 'http'; import fs from 'fs';
import { appComChavesDeTeste, emitir, linkDe } from './_licenca.mjs';
import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';
import { criarProxy, exigirNext } from './proxy.mjs';
await exigirNext();

const ROOT = `${RAIZ_WS}/public`;
const tipos = { '.css':'text/css', '.svg':'image/svg+xml', '.js':'text/javascript', '.ico':'image/x-icon' };
const jspdf = fs.readFileSync(`${RAIZ_WS}/vendor/jspdf.umd.min.js`, 'utf8');
/* O site virou Next.js: as páginas não existem mais como arquivo em public/.
   O servidorzinho estático daqui virou um encaminhador para o Next — mesma
   porta, mesmas URLs no teste, e quem responde é o produto de verdade. */
const srv = criarProxy();
await new Promise(r => srv.listen(8820, r));

/* ---- A CHAVE DE PRODUÇÃO NÃO VIAJA, E NÃO PRECISA VIAJAR ----
   Este arquivo pulava em toda corrida por depender de `emitir-licenca.py`, que
   carrega as privadas Ed25519. Agora a régua gera o próprio par, assina a
   chave de teste e serve uma cópia do app com a pública correspondente.
   Ver `_licenca.mjs`. */
const APP = appComChavesDeTeste();   // as de produção não existem nesta máquina
const VALIDA = emitir('Cliente Exemplo — QA', 5, '2030-01-01');
const LINK_EMITIDO = linkDe(VALIDA);

const br = await chromium.launch({ executablePath: CHROME_WS });
let falhas = 0;
const ok = (n, c, extra) => { console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (extra ? '  → ' + extra : '')); if (!c) falhas++; };
const pagina = async () => {
  /* `serviceWorkers: 'block'` — e esta linha é o conserto de verdade.
     O produto registra um service worker que guarda o `app.html` para a
     ferramenta abrir sem rede. As buscas FEITAS PELO WORKER não passam pelo
     `page.route` do Playwright: na primeira visita a régua servia o app com as
     chaves de teste, o worker instalava e guardava o app DE PRODUÇÃO buscado
     por ele mesmo, e na segunda visita devolvia aquele — cuja chave pública
     não bate com a assinatura de teste.
     O sintoma era "a licença some no F5", e passei por duas hipóteses erradas
     (o glob da rota, o sw.js interceptado na página) antes desta. O produto
     estava certo o tempo todo: conferido à parte, a licença persiste. */
  const ctx = await br.newContext({ acceptDownloads: true, serviceWorkers: 'block',
                                    permissions: ['clipboard-read','clipboard-write'] });
  const pg = await ctx.newPage();
  const erros = []; pg.on('pageerror', e => erros.push(e.message));
  /* NO CONTEXTO, e não na página: um dos blocos abre uma SEGUNDA página para
     visitar o link que o produto acabou de montar, e rota registrada na página
     não vale para a irmã. Aquela segunda página recebia o app de produção e a
     licença de teste "não ativava" — o produto, de novo, estava certo. */
  await ctx.route('**/jspdf**', r => r.fulfill({status:200,headers:{'content-type':'text/javascript'},body:jspdf}));
  /* O app servido leva as chaves PÚBLICAS de teste no lugar das de produção.
     A troca é aqui, e não no proxy, porque o proxy encaminha para o Next e
     serve o site inteiro — só o `app.html` precisa da troca. */
  /* Predicado, e nao glob. O glob que eu tinha escrito pegava a PRIMEIRA
     visita e deixava a segunda passar direto para o Next — que devolve o app
     com as chaves de producao, e a licenca de teste "nao confere". A licenca
     parecia sumir no F5, e o produto estava certo o tempo todo.
     (E o glob nao aparece escrito aqui de proposito: ele contem a sequencia
     que fecha um comentario, e escreve-la aqui derruba o arquivo — foi o que
     aconteceu na primeira tentativa deste mesmo comentario.) */
  await ctx.route((u) => u.pathname.endsWith('/app.html'), r => r.fulfill(
    { status: 200, headers: { 'content-type': 'text/html' }, body: APP }));
  /* E O SERVICE WORKER FICA DE FORA. Ele é real e é do produto: guarda o
     `app.html` para a ferramenta abrir sem rede. Só que aqui a régua SUBSTITUI
     o `app.html` por uma cópia com outras chaves públicas — e na segunda visita
     o worker devolvia a cópia GUARDADA, a de produção, cuja chave não bate com
     a assinatura de teste. A licença "sumia no F5", e o defeito era da régua.
     Um `sw.js` vazio: o worker não instala e cada visita busca de verdade. */
  await ctx.route('**/sw.js', r => r.fulfill(
    { status: 200, headers: { 'content-type': 'text/javascript' }, body: '' }));
  return { ctx, pg, erros };
};

console.log('[1] o emissor entrega um link, não só uma chave');
{
  ok('saiu um link para o app', /\/app\?lic=WS1\./.test(LINK_EMITIDO), LINK_EMITIDO.slice(0, 60) + '…');
  ok('e a chave crua continua disponível', VALIDA.startsWith('WS1.'));
  /* ESTA AFIRMAÇÃO É SOBRE O EMISSOR, E NÃO SOBRE O PRODUTO. Ela lia a saída
     do `emitir-licenca.py` procurando o aviso "não cole este link" que ele
     imprime junto. Com a chave gerada aqui, essa saída não existe — e inventar
     um texto para conferir contra ele mesmo seria uma afirmação circular.
     `BLOCO PULADO`, e não `PULADO`: o arquivo rodou, e só esta linha não. */
  console.log('  BLOCO PULADO  o aviso impresso pelo emissor só existe onde o emissor vive');
}

console.log('\n[2] abrir o link ativa o plano — sem ninguém colar nada');
{
  const { ctx, pg, erros } = await pagina();
  await pg.goto(`http://localhost:8820/app.html?lang=pt&lic=${encodeURIComponent(VALIDA)}&marca=${encodeURIComponent('Cliente Exemplo S.A.')}`);
  await pg.waitForTimeout(700);
  ok('o plano está ativo', /Licen[çc]a v[áa]lida/.test(await pg.locator('#licMsg').textContent()),
     (await pg.locator('#licMsg').textContent()).slice(0, 70));
  ok('a marca do cliente apareceu', await pg.locator('#marcaBox').isVisible());
  ok('e já com o nome preenchido', (await pg.locator('#mcNome').inputValue()) === 'Cliente Exemplo S.A.',
     await pg.locator('#mcNome').inputValue());
  ok('a mensagem diz que veio do link',
     /ativado pelo link/i.test(await pg.locator('#licMsg').textContent()),
     (await pg.locator('#licMsg').textContent()).slice(0, 60));

  /* Um endereço com a licença dentro vai parar em print de tela e em histórico
     compartilhado. Ele não fica. */
  const url = await pg.evaluate(() => location.href);
  ok('a chave saiu do endereço', !/lic=/.test(url), url.slice(url.indexOf('?')));
  ok('mas o resto do link continua lá', /marca=/.test(url) && /lang=pt/.test(url));
  ok('a chave ficou guardada no navegador',
     (await pg.evaluate(() => localStorage.getItem('Walkstamp.licenca'))) === VALIDA);
  ok('sem erro de JS', erros.length === 0, erros.join(' | ').slice(0, 150));
  await ctx.close();
}

console.log('\n[3] o F5 mantém: a chave ficou no navegador, não no endereço');
{
  const { ctx, pg } = await pagina();
  await pg.goto(`http://localhost:8820/app.html?lang=pt&lic=${encodeURIComponent(VALIDA)}`);
  await pg.waitForTimeout(600);
  await pg.goto('http://localhost:8820/app.html?lang=pt');
  await pg.waitForTimeout(700);
  ok('continua no plano Time depois de abrir sem o link',
     /Licen[çc]a v[áa]lida/.test(await pg.locator('#licMsg').textContent()));
  await ctx.close();
}

console.log('\n[4] link com chave ruim não engole o erro');
{
  const { ctx, pg } = await pagina();
  await pg.goto(`http://localhost:8820/app.html?lang=pt&lic=${encodeURIComponent(VALIDA.slice(0, -4) + 'AAAA')}`);
  await pg.waitForTimeout(700);
  ok('não ativou', !/Licen[çc]a v[áa]lida/.test(await pg.locator('#licMsg').textContent()));
  ok('a caixa abriu sozinha para mostrar o motivo', await pg.locator('#licBox').isVisible());
  ok('e o motivo está escrito', /não confere/i.test(await pg.locator('#licMsg').textContent()),
     (await pg.locator('#licMsg').textContent()).slice(0, 70));
  ok('a chave ruim também sai do endereço',
     !/lic=/.test(await pg.evaluate(() => location.href)));
  await ctx.close();
}

console.log('\n[5] marca sem licença não passa (é feature paga)');
{
  const { ctx, pg } = await pagina();
  await pg.goto('http://localhost:8820/app.html?lang=pt&marca=Empresa%20Qualquer');
  await pg.waitForTimeout(600);
  ok('a marca do cliente continua escondida', !(await pg.locator('#marcaBox').isVisible()));
  ok('e o nome não foi para o campo', (await pg.locator('#mcNome').inputValue()) === '');
  await ctx.close();
}

console.log('\n[6] o construtor de /link monta o link do Time');
{
  const { ctx, pg, erros } = await pagina();
  await pg.goto('http://localhost:8820/link');
  await pg.waitForTimeout(400);
  ok('o bloco do Time existe e começa fechado',
     (await pg.locator('#lkTimeCx').count()) === 1 &&
     !(await pg.locator('#lkLic').isVisible()));
  await pg.locator('#lkTimeCx summary').click();
  await pg.waitForTimeout(150);
  await pg.fill('#lkCaso', 'CT-014 Criar pedido');
  await pg.fill('#lkLic', VALIDA);
  await pg.fill('#lkMarca', 'Cliente Exemplo S.A.');
  await pg.waitForTimeout(300);
  const url = await pg.locator('#lkUrl').textContent();
  ok('o link leva a licença', url.includes('lic=WS1.'));
  /* Lido como endereço, e não como texto.

     O nome do cliente vai codificado, e o `URLSearchParams` codifica espaço
     como `+` — que o `decodeURIComponent` NÃO desfaz. Procurar o texto cru
     passava por sorte enquanto o nome de exemplo era uma palavra só, e passou a
     falhar assim que o nome ganhou um espaço. Quem sabe desfazer o `+` é o
     próprio `URL`. */
  ok('o link leva a marca',
     new URL(url).searchParams.get('marca') === 'Cliente Exemplo S.A.',
     new URL(url).searchParams.get('marca'));
  ok('e continua levando o caso', /caso=CT-014/.test(url));
  ok('a chave é lembrada para o próximo link',
     (await pg.evaluate(() => localStorage.getItem('walkstamp.lic.construtor'))) === VALIDA);

  /* O link montado tem que funcionar de verdade, e não só parecer certo. */
  const pg2 = await ctx.newPage();
  await pg2.goto('http://localhost:8820' + url.replace(/^https?:\/\/[^/]+/, '').replace('/app?', '/app.html?'));
  await pg2.waitForTimeout(700);
  /* Sem ?lang= o app segue o idioma do navegador — então a prova é a feature
     paga estar na tela, e não a palavra "Plano Time". */
  ok('o link montado ativa o plano', await pg2.locator('#marcaBox').isVisible());
  ok('e traz o cliente', (await pg2.locator('#mcNome').inputValue()) === 'Cliente Exemplo S.A.');
  ok('e traz o caso de teste', (await pg2.locator('#evCaso').inputValue()) === 'CT-014 Criar pedido');
  await pg2.close();

  await pg.locator('#lkLicEsquecer').click();
  await pg.waitForTimeout(300);
  ok('esquecer limpa o campo e o navegador',
     (await pg.locator('#lkLic').inputValue()) === '' &&
     (await pg.evaluate(() => localStorage.getItem('walkstamp.lic.construtor'))) === null);
  ok('e o link volta a ser o gratuito', !(await pg.locator('#lkUrl').textContent()).includes('lic='));
  ok('sem erro de JS', erros.length === 0, erros.join(' | ').slice(0, 150));
  await ctx.close();
}

console.log('\n[7] a chave à mão continua existindo, discreta');
{
  const { ctx, pg } = await pagina();
  await pg.goto('http://localhost:8820/app.html?lang=pt');
  await pg.waitForTimeout(400);
  // o botão de vender saiu do rodapé; a caixa abre pelo link do e-mail
  await pg.evaluate(() => document.getElementById('licBox').classList.remove('hide'));
  ok('o campo não aparece de cara', !(await pg.locator('#licChave').isVisible()));
  await pg.locator('#licManual').click();
  await pg.waitForTimeout(150);
  await pg.fill('#licChave', VALIDA);
  await pg.locator('#licAtivar').click();
  await pg.waitForTimeout(300);
  ok('colar a chave ainda ativa', await pg.locator('#marcaBox').isVisible());
  await ctx.close();
}

await br.close(); srv.close();
console.log(falhas ? '\n' + falhas + ' falha(s)' : '\nLink do plano Time: tudo passou.');
process.exit(falhas ? 1 : 0);

/* INTEIRAMENTE GRÁTIS, E SEM SERVIDOR — Build 69.
 *
 * O pedido: "vamos deixar o walkstamp inteiramente free… não quero ganhar
 * dinheiro com ele", e logo depois "quero reduzir custo de supabase". As duas
 * frases são a mesma decisão vista de dois lados: sem plano não há licença para
 * conferir, sem conta não há sessão para guardar, e sem os dois não há por que
 * a ferramenta falar com servidor nosso.
 *
 * Esta régua cobra a decisão inteira, e não peça por peça — as peças têm as
 * réguas delas (`matriz`, `emissor`, `formato`, `ux`, `diagchamado`):
 *
 *   1. nada trancado: o que era de plano está à vista e funciona;
 *   2. nenhum pedido a servidor nosso, do abrir ao documento pronto;
 *   3. nenhum código de licença, de conta ou de evento sobrou no arquivo —
 *      nem na ferramenta publicada, nem no pacote offline;
 *   4. o que a conta lembrava, o navegador lembra: a marca do cliente sempre,
 *      e o vocabulário SÓ se a pessoa marcar — desmarcar apaga.
 *
 *   node testes/gratis.mjs
 */
import { chromium } from './_navegador.mjs';
import http from 'http'; import fs from 'fs'; import path from 'path';
import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';

const ROOT = `${RAIZ_WS}/public`;
const T = {'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml',
           '.webm':'video/webm','.jpg':'image/jpeg','.png':'image/png','.vtt':'text/vtt'};
const srv = http.createServer((q, r) => {
  if (q.url.startsWith('/_vercel/')) { r.writeHead(200, {'Content-Type':'text/javascript'}); return r.end(''); }
  const u = decodeURIComponent(q.url.split('?')[0]);
  const f = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, {'Content-Type': T[path.extname(f)] || 'application/octet-stream'}); r.end(fs.readFileSync(f));
});
await new Promise(r => srv.listen(8979, r));
const URL_APP = 'http://localhost:8979/app.html?lang=pt';

let falhas = 0;
const ok = (n, c, e) => { console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : '')); if (!c) falhas++; };

const br = await chromium.launch({ executablePath: CHROME_WS });

/* "Servidor nosso" é o que custava: o Supabase (banco, funções, autenticação)
   e as rotas `/api/` do site. CDN de biblioteca e modelo não entram — são de
   terceiros, a matriz de egressão é quem fala deles. */
const NOSSO = /supabase\.co|\/functions\/v1\/|\/rest\/v1\/|\/auth\/v1\/|\/api\/|walkstamp\.com\/api/;

async function abrir(ctx) {
  const pg = await ctx.newPage();
  const erros = []; pg.on('pageerror', e => erros.push(e.message));
  const nossos = []; pg.on('request', q => { if (NOSSO.test(q.url())) nossos.push(q.url()); });
  await pg.goto(URL_APP);
  await pg.waitForTimeout(500);
  return { pg, erros, nossos };
}
async function liberarRevisao(pg) {
  await pg.selectOption('#modelo', 'evidencia');
  await pg.setInputFiles('#file', '/tmp/amostra.webm');
  await pg.waitForFunction(() => !document.getElementById('prevCard').hasAttribute('inert'),
    null, { timeout: 20000 });
}

console.log('[1] nada trancado: o que era de plano está à vista');
{
  const ctx = await br.newContext({ viewport: { width: 1300, height: 1000 } });
  const { pg, erros, nossos } = await abrir(ctx);
  await liberarRevisao(pg);
  const r = await pg.evaluate(() => {
    const visivel = (id) => { const el = document.getElementById(id);
      return !!el && !el.closest('.hide') && el.getClientRects().length > 0; };
    return {
      marca: visivel('marcaBox'), cls: visivel('clsRow'), modelos: visivel('modelosCx'),
      voc: !!document.getElementById('vocGuardarRow') && !document.getElementById('vocGuardarRow').classList.contains('hide'),
      emissor: visivel('docEmissorCampo'),
      /* As peças do plano que saíram, e que não podem voltar escondidas. */
      sobras: ['licBox', 'licAtivar', 'barraConta', 'contaLink', 'fimPonte', 'meusDiag', 'fbEmail',
               'compEnviar'].filter(id => document.getElementById(id)),
      trancados: document.querySelectorAll('.trancado, [data-plano], .soTime, .soPago').length,
    };
  });
  ok('a marca do cliente está à vista', r.marca);
  ok('a classificação também', r.cls);
  ok('o campo de quem emite também', r.emissor);
  ok('os modelos e o arquivo de padrões também', r.modelos);
  ok('e a caixa de lembrar o vocabulário existe para todos', r.voc);
  ok('nenhuma peça de licença ou de conta sobrou na tela', r.sobras.length === 0, r.sobras.join(', '));
  ok('nada marcado como trancado ou de plano', r.trancados === 0, String(r.trancados));
  ok('nenhum pedido a servidor nosso até aqui', nossos.length === 0, nossos[0]);
  ok('sem erro de JS', erros.length === 0, erros.join(' | ').slice(0, 160));
  await ctx.close();
}

console.log('\n[2] do abrir ao documento pronto, nenhum pedido a servidor nosso');
{
  /* O documento sai pelo JSON de recuperação, que é o caminho mais curto até
     um arquivo pronto e passa pelo mesmo `documentoSaiu` dos outros formatos —
     que era onde morava o evento de uso que ia para o banco. */
  const ctx = await br.newContext({ viewport: { width: 1300, height: 1000 }, acceptDownloads: true });
  const { pg, erros, nossos } = await abrir(ctx);
  await liberarRevisao(pg);
  await pg.fill('#mcNome', 'Cliente Grátis');
  const d = pg.waitForEvent('download', { timeout: 60000 });
  await pg.locator('#json').click();
  const arq = await d;
  ok('o documento saiu', !!arq && /\.json$/.test(arq.suggestedFilename()), arq && arq.suggestedFilename());
  await pg.waitForTimeout(800);
  ok('e nenhum pedido a servidor nosso no caminho', nossos.length === 0, nossos.slice(0, 3).join(' | '));
  ok('sem erro de JS', erros.length === 0, erros.join(' | ').slice(0, 160));
  await ctx.close();
}

console.log('\n[3] nenhum código de licença, de conta ou de evento sobrou no arquivo');
{
  /* Lido no ARQUIVO, e não na tela: código morto não aparece na tela, e é
     justamente o que volta a funcionar quando alguém religa um botão. */
  const PROIBIDO = [
    ['a chave pública da licença', /LIC_PUB|__LICPUB/],
    ['a ativação da licença', /licAtivar|licTirar|licManual|pintarLicenca/],
    ['a função que emitia licença', /walkstamp-licenca/],
    ['o endereço do banco', /supabase\.co|__SUPAURL__|__SUPAKEY__/],
    ['a sessão da conta', /SESSAO_CHAVE|daVoltaDoLink|carregarMeus/],
    ['o evento de uso', /walkstamp_evento|MEDIR_URL|stamp_ev/],
    ['as rotas do site', /fetch\([^)]*\/api\//],
  ];
  for (const [nome, arq] of [['ferramenta', `${RAIZ_WS}/public/app.html`],
                             ['pacote offline', `${RAIZ_WS}/offline/walkstamp-offline.html`]]) {
    const html = fs.readFileSync(arq, 'utf8');
    const achados = PROIBIDO.filter(([, re]) => re.test(html)).map(([n, re]) => n + ' (' + (html.match(re) || [''])[0] + ')');
    ok(`${nome}: nada disso no arquivo`, achados.length === 0, achados.join('; '));
  }
}

console.log('\n[4] o que a conta lembrava, o navegador lembra');
{
  const ctx = await br.newContext({ viewport: { width: 1300, height: 1000 } });
  const { pg, erros, nossos } = await abrir(ctx);
  await liberarRevisao(pg);
  /* A MARCA, sempre: é configuração de quem usa, e não dado do cliente. */
  await pg.fill('#mcNome', 'ACME Auditoria');
  /* O VOCABULÁRIO, só se marcar. Primeiro sem marcar: não pode ficar. */
  await pg.locator('#vocModo').click();
  ok('a caixa de lembrar nasce desmarcada', !(await pg.isChecked('#vocGuardar')));
  await pg.fill('#vocLista', 'SAP S/4HANA, Fiori, Ariba');
  const semMarcar = await pg.evaluate(() => localStorage.getItem('Walkstamp.vocabularioLembrado'));
  ok('sem marcar, o vocabulário não fica neste navegador', semMarcar === null, String(semMarcar));

  /* A próxima visita é outra aba: a aba anterior leva o `sessionStorage`. */
  let p2 = await ctx.newPage(); await p2.goto(URL_APP); await p2.waitForTimeout(500);
  ok('a marca volta na próxima visita', await p2.inputValue('#mcNome') === 'ACME Auditoria', await p2.inputValue('#mcNome'));
  ok('o vocabulário não marcado não volta', (await p2.inputValue('#vocLista')) === '', await p2.inputValue('#vocLista'));
  await p2.close();

  /* Agora marcando. */
  await pg.check('#vocGuardar');
  await pg.waitForTimeout(150);
  ok('marcar diz que lembrou', /lembr|guard/i.test(await pg.locator('#vocGuardarMsg').textContent()),
     await pg.locator('#vocGuardarMsg').textContent());
  p2 = await ctx.newPage(); await p2.goto(URL_APP); await p2.waitForTimeout(500);
  ok('marcado, o vocabulário volta na próxima visita',
     (await p2.inputValue('#vocLista')) === 'SAP S/4HANA, Fiori, Ariba', await p2.inputValue('#vocLista'));
  ok('e a caixa volta marcada', await p2.isChecked('#vocGuardar'));
  await p2.close();

  /* Desmarcar APAGA — "pare de lembrar" e "esqueça" são a mesma frase. */
  await pg.uncheck('#vocGuardar');
  await pg.waitForTimeout(150);
  const depois = await pg.evaluate(() => localStorage.getItem('Walkstamp.vocabularioLembrado'));
  ok('desmarcar apaga o que estava lembrado', depois === null, String(depois));
  p2 = await ctx.newPage(); await p2.goto(URL_APP); await p2.waitForTimeout(500);
  ok('e a próxima visita começa sem ele', (await p2.inputValue('#vocLista')) === '', await p2.inputValue('#vocLista'));
  await p2.close();

  /* E esquecer a marca: apagar o nome é esquecer. */
  await pg.fill('#mcNome', '');
  const marca = await pg.evaluate(() => localStorage.getItem('Walkstamp.marcaDoCliente'));
  ok('apagar o nome da marca esquece a marca', marca === null, String(marca).slice(0, 60));
  ok('nenhum pedido a servidor nosso', nossos.length === 0, nossos[0]);
  ok('sem erro de JS', erros.length === 0, erros.join(' | ').slice(0, 160));
  await ctx.close();
}

await br.close(); srv.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nGrátis e sem servidor: tudo passou.');
process.exit(falhas ? 1 : 0);

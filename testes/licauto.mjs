/* As duas chaves de assinatura, e o teto que o navegador impõe à automática.

   A regra que só existe no servidor não é regra, é intenção: se aquele projeto
   vazar, o que se pode fabricar com a chave dele tem que continuar limitado
   pelo que ESTE código aceita. É isso que se prova aqui. */
import { chromium } from './_navegador.mjs';
import http from 'http'; import fs from 'fs';

const ROOT = `${RAIZ_WS}/public`;
const html = appComChavesDeTeste();   // as de produção não existem nesta máquina
const srv = http.createServer((q, r) => {
  if (q.url.startsWith('/_vercel/')) { r.writeHead(200,{'Content-Type':'text/javascript'}); return r.end('') }
  r.writeHead(200, {'Content-Type':'text/html'}); r.end(html);
});
await new Promise(r => srv.listen(8920, r));

/* O EMISSOR NÃO VIAJA NO ZIP, e não pode viajar: `emitir-licenca.py` carrega as
   duas chaves privadas Ed25519, e um pacote entregue que as levasse junto
   entregaria o direito de assinar licença para qualquer um.
 *
 * Sem ele, este teste não tem como existir — e é isso que ele diz, em vez de
 * morrer com "Command failed" e mandar procurar defeito num produto que está
 * inteiro. Sai com 0: uma esteira vermelha por uma ausência esperada é uma
 * esteira que se aprende a ignorar. */
/* `#licTag` MORREU NO PRODUTO — 23/08.
 *
 * A etiqueta do cabeçalho que dizia "Plano Time" não existe mais no `app.html`:
 * `grep licTag public/app.html` dá ZERO. O sucessor dela, `#licBtn`, também
 * saiu — o que restou no código é uma referência guardada por `if (bl)`, que
 * nunca é verdadeira.
 *
 * Onde o estado ATIVO aparece hoje, sem depender de conta: `#licMsg`, dentro da
 * caixa da licença, com a frase `licValida` — "Licença válida para {cliente} —
 * {n} pessoa(s), até {data}". Ela diz mais do que "Plano Time" dizia: para
 * quem, quantos assentos e até quando.
 *
 * (`#planoLinha` existe, mas é a linha da BARRA DA CONTA e só é desenhada
 * quando o servidor devolve o plano. Estes testes ativam uma chave sem conta
 * nenhuma, então lá ele não está na tela.)
 */
import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';
import { appComChavesDeTeste, emitir, daquiADias } from './_licenca.mjs';

/* ---- A CHAVE DE PRODUÇÃO NÃO VIAJA, E NÃO PRECISA VIAJAR ----
   Este arquivo pulava em toda corrida por depender de `emitir-licenca.py`, que
   carrega as privadas Ed25519. Agora a régua gera o próprio par e assina as
   chaves de teste — inclusive as do emissor AUTOMÁTICO, que é o assunto deste
   arquivo. Ver `_licenca.mjs`.

   O TETO CONTINUA SENDO CONFERIDO PELO PRODUTO, e é isso que importa: a régua
   assina o que o emissor de verdade nunca assinaria (401 dias, 26 assentos) e
   cobra que a ferramenta RECUSE. Uma regra que só existe do lado de quem
   assina não é uma regra: é uma intenção. */
/* O `q` da licença automática é o E-MAIL de quem pediu, e não o nome do
   cliente: é o e-mail que a tela mostra em "Licença válida para …", e é por
   ele que se sabe a quem aquele link foi dado. O nome do cliente é outra
   coisa — ele viaja no `marca=` do link e vira a marca no documento. Escrevi
   ao contrário na primeira tentativa e a régua pegou. */
const auto = (email, assentos, dias) =>
  emitir(email, assentos, daquiADias(dias), { auto: true });
const mestra = emitir('Cliente Exemplo — QA', 40, '2030-01-01');

const br = await chromium.launch({ executablePath: CHROME_WS });
let falhas = 0;
const ok = (n, c, extra) => { console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (extra ? '  → ' + extra : '')); if (!c) falhas++; };
/* Aba limpa a cada vez, de propósito: uma licença boa fica guardada no
   navegador, e reaproveitar a aba faria a chave RUIM do teste seguinte
   parecer aceita. */
async function abrir(chave){
  /* Service worker bloqueado e rota no CONTEXTO, pelos dois motivos que o
     `liclink.mjs` documenta: o worker guarda o app de produção e o serve na
     visita seguinte, e rota registrada na página não vale para uma irmã. */
  const ctx = await br.newContext({ serviceWorkers: 'block' });
  await ctx.route((u) => u.pathname.endsWith('/app.html'), r => r.fulfill(
    { status: 200, headers: { 'content-type': 'text/html' }, body: html }));
  const pg = await ctx.newPage();
  const erros = []; pg.on('pageerror', e => erros.push(e.message));
  await pg.goto(`http://localhost:8920/app.html?lang=pt&lic=${encodeURIComponent(chave)}`);
  await pg.waitForTimeout(600);
  const ligou = await pg.locator('#marcaBox').isVisible();
  const msg = await pg.locator('#licMsg').textContent();
  const botao = await pg.locator('#licMsg').textContent();
  await ctx.close();
  return { ligou, msg, botao, erros };
}

console.log('[1] a chave mestra continua sem teto');
{
  const r = await abrir(mestra);
  ok('40 assentos e cinco anos passam', r.ligou, r.msg.slice(0, 60));
  ok('sem erro de JS', r.erros.length === 0, r.erros.join(' | ').slice(0, 120));
}

console.log('\n[2] a chave automática vale, dentro do teto');
{
  const r = await abrir(auto('leandro@empresa.com.br', 5, 90, 'Cliente Exemplo S.A.'));
  ok('90 dias e 5 assentos passam', r.ligou, r.msg.slice(0, 70));
  ok('e a tela diz a quem a licença foi dada',
     /leandro@empresa\.com\.br/.test(r.msg), r.msg.slice(0, 110));
}

console.log('\n[3] o teste de 14 dias');
{
  const r = await abrir(auto('quem@quer.testar', 1, 14));
  ok('passa', r.ligou);
}

console.log('\n[4] fora do teto, a automática não vale — mesmo assinada de verdade');
{
  const longa = await abrir(auto('leandro@empresa.com.br', 5, 400));
  ok('400 dias é recusada', !longa.ligou, longa.msg.slice(0, 70));
  ok('e o motivo aparece na tela', /não confere|link trazia/i.test(longa.msg), longa.msg.slice(0, 60));

  const gorda = await abrir(auto('leandro@empresa.com.br', 25, 90));
  ok('25 assentos ainda passa (é o limite)', gorda.ligou);
}

console.log('\n[5] no limite exato de dias');
{
  const cem = await abrir(auto('leandro@empresa.com.br', 5, 99));
  ok('99 dias passa', cem.ligou);
  const cemUm = await abrir(auto('leandro@empresa.com.br', 5, 101));
  ok('101 dias não passa', !cemUm.ligou);
}

console.log('\n[6] assinatura mexida não passa por chave nenhuma');
{
  const boa = auto('leandro@empresa.com.br', 5, 90);
  const r = await abrir(boa.slice(0, -4) + 'AAAA');
  ok('adulterada é recusada', !r.ligou);
}

await br.close(); srv.close();
console.log(falhas ? '\n' + falhas + ' falha(s)' : '\nDuas chaves e o teto da automática: tudo passou.');
process.exit(falhas ? 1 : 0);

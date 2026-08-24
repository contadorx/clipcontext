/* O FLUXO DE ENTRADA: e-mail, link mágico, e a volta.
 *
 * ESTA RÉGUA PAGA UMA DÍVIDA QUE EU MESMO ABRI. No Build 5 a página `/time` foi
 * aposentada — ela era órfã e vendia o mesmo plano que a de preços — e junto foi
 * o `timepag.mjs`, que tinha OITO blocos. Seis deles cobriam coisas que
 * passaram a não ter régua nenhuma:
 *
 *     e-mail malformado não sai do lugar
 *     pedir o link
 *     o limite de envio é dito, e não engolido
 *     a volta do link mágico
 *     degustação já usada tem resposta escrita, e não silêncio
 *     link do e-mail vencido
 *
 * O fluxo não morreu com a página: ele mora em `entrar()` e na rota
 * `/conta/confirmar`. O que morreu foi a maneira de testá-lo. Os blocos antigos
 * falsificavam o Supabase interceptando chamadas do NAVEGADOR; na conta essas
 * chamadas acontecem no SERVIDOR, dentro de uma ação, e a interceptação do lado
 * do navegador não alcança.
 *
 * O que faltava era um Supabase falso do lado do servidor — e ele já existia:
 * `WALKSTAMP_SUPA_TESTE` aponta o cliente de sessão para um endereço local, e
 * o `portal.mjs` já usa isso. A dívida era de trabalho, não de mecanismo.
 *
 * E ela cobra a INTENÇÃO DE COMPRA atravessando tudo, que é o que o Build 5
 * construiu: o `?plano=` entra no formulário, sai no link do e-mail, e volta.
 * `compra.mjs` mede as pontas; esta mede o meio, com o servidor respondendo.
 */
import http from 'http';
import { spawn, execSync } from 'child_process';

import { chromium } from 'playwright';
import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';

const P = 8823, B = 8824;
const BASE = `http://localhost:${P}`;

let falhas = 0;
const ok = (n, c, e) => {
  console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : ''));
  if (!c) falhas++;
};

/* ------------------------------------------------------- o Supabase falso */

const pedidos = [];          // tudo que o servidor mandou para o "Supabase"
let RESPOSTA_OTP = null;     // { erro } para a próxima chamada de envio
let SESSAO = null;           // quem está logado, ou null

const banco = http.createServer((q, r) => {
  const p = [];
  q.on('data', (d) => p.push(d));
  q.on('end', () => {
    const corpo = Buffer.concat(p).toString('utf8') || '{}';
    let args = {};
    try { args = JSON.parse(corpo); } catch { /* corpo não-JSON */ }
    pedidos.push({ url: q.url, args });
    const j = (o, s = 200) => {
      r.writeHead(s, { 'Content-Type': 'application/json' }); r.end(JSON.stringify(o));
    };
    /* O pedido do link mágico. */
    if (q.url.startsWith('/auth/v1/otp')) {
      if (RESPOSTA_OTP) { const e = RESPOSTA_OTP; RESPOSTA_OTP = null; return j(e, 429); }
      return j({});
    }
    /* A troca do código por sessão, na volta do link. */
    if (q.url.startsWith('/auth/v1/token') || q.url.startsWith('/auth/v1/verify')) {
      if (RESPOSTA_OTP) { const e = RESPOSTA_OTP; RESPOSTA_OTP = null; return j(e, 401); }
      return j({ access_token: 'a', refresh_token: 'r', expires_in: 3600,
                 user: { id: 'u', email: 'quem@exemplo.test' } });
    }
    if (q.url.startsWith('/auth/v1/user')) {
      if (!SESSAO) { r.writeHead(401); return r.end('{}'); }
      return j({ id: 'u', aud: 'authenticated', email: SESSAO });
    }
    j({});
  });
});
await new Promise((r) => banco.listen(B, r));

const matarPorta = () => { try { execSync(`fuser -k ${P}/tcp 2>/dev/null`); } catch {} };
matarPorta();
await new Promise((r) => setTimeout(r, 500));

const next = spawn('npx', ['next', 'start', '-p', String(P)], {
  cwd: `${RAIZ_WS}`, stdio: 'ignore',
  env: { ...process.env,
    SUPABASE_URL: `http://localhost:${B}`,
    SUPABASE_SERVICE_ROLE_KEY: 'chave_de_mentira',
    WALKSTAMP_SUPA_TESTE: `http://localhost:${B}` },
});
process.on('exit', () => { try { next.kill('SIGKILL'); } catch {} matarPorta(); banco.close(); });
let subiu = false;
for (let i = 0; i < 60; i++) {
  try { const r = await fetch(`${BASE}/conta`); if (r.ok) { subiu = true; break; } } catch {}
  await new Promise((r) => setTimeout(r, 500));
}
if (!subiu) {
  console.log('PULADO  o Next não subiu em 30 s nesta máquina.');
  process.exit(0);
}

const br = await chromium.launch({ executablePath: CHROME_WS });
const ctx = await br.newContext();
const pg = await ctx.newPage();

const pedirLink = async (email, rota = '/conta') => {
  await pg.goto(BASE + rota);
  await pg.fill('input[name="email"]', email);
  await Promise.all([
    pg.waitForLoadState('networkidle').catch(() => {}),
    pg.click('form button[type="submit"]'),
  ]);
  await pg.waitForTimeout(300);
};

console.log('[1] e-mail malformado não sai do lugar — e são DUAS travas');
{
  /* A primeira é do NAVEGADOR: o campo é `type="email" required`, e o envio
     nem acontece. Foi isso que a minha primeira versão desta régua leu errado —
     ela procurou o recado do servidor e não achou nenhum, porque o servidor
     nunca foi chamado. A trava certa estava funcionando; a afirmação é que
     descrevia a camada errada. */
  pedidos.length = 0;
  await pedirLink('nao-e-email');
  const foi = pedidos.filter((x) => x.url.startsWith('/auth/v1/otp')).length;
  ok('nenhum pedido de link foi disparado', foi === 0, `${foi} pedido(s)`);
  const barrado = await pg.evaluate(() => {
    const c = document.querySelector('input[name="email"]');
    return !!c && !c.checkValidity();
  });
  ok('o navegador barra antes de enviar', barrado);

  /* A SEGUNDA é do SERVIDOR, e é a que importa: quem chega por fora do
     formulário — um script, um `curl`, um navegador velho — não passa. Aqui o
     campo vira texto simples para o navegador deixar passar, e quem recusa
     passa a ser o `entrar()`. */
  pedidos.length = 0;
  await pg.evaluate(() => {
    const c = document.querySelector('input[name="email"]');
    c.setAttribute('type', 'text'); c.removeAttribute('required');
  });
  await pg.fill('input[name="email"]', 'nao-e-email');
  await Promise.all([
    pg.waitForLoadState('networkidle').catch(() => {}),
    pg.click('form button[type="submit"]'),
  ]);
  await pg.waitForTimeout(400);
  const foi2 = pedidos.filter((x) => x.url.startsWith('/auth/v1/otp')).length;
  ok('e o servidor recusa quando o navegador é contornado', foi2 === 0, `${foi2} pedido(s)`);
  const aviso = await pg.locator('.aviso').first().innerText().catch(() => '');
  ok('dizendo o motivo, em vez de silêncio', /e-mail/i.test(aviso),
     aviso.replace(/\n/g, ' ').slice(0, 90) || '(nenhum recado na tela)');
}

console.log('\n[2] pedir o link — e a intenção de compra vai junto');
{
  pedidos.length = 0;
  await pedirLink('alguem@exemplo.test', '/conta?plano=time');
  const otp = pedidos.filter((x) => x.url.startsWith('/auth/v1/otp'));
  ok('o pedido saiu', otp.length === 1, `${otp.length} pedido(s)`);
  const e = otp[0] && otp[0].args;
  ok('com o e-mail em minúsculas', e && e.email === 'alguem@exemplo.test', e && e.email);
  /* O ENDEREÇO DE VOLTA VIAJA NA QUERY, e não no corpo — a biblioteca do
     Supabase põe `redirect_to` na URL do pedido. Eu li o corpo primeiro e a
     régua reprovou o produto por um defeito meu de leitura.
     É onde a intenção viaja: sem ela, quem clicou "Assinar o Team" volta para
     uma conta que não sabe o que ele queria. */
  const volta = otp[0] ? decodeURIComponent(otp[0].url) : '';
  ok('e o endereço de volta leva o plano', /plano=time/.test(volta), volta.slice(0, 160));
  ok('e leva o idioma', /lang=pt/.test(volta), volta.slice(0, 160));
}

console.log('\n[3] a tela do "olhe o seu e-mail" diz para onde foi');
{
  const txt = await pg.locator('body').innerText();
  ok('o endereço aparece na tela', /alguem@exemplo\.test/.test(txt),
     txt.replace(/\n/g, ' ').slice(0, 110));
  /* E o pedido de outro link não larga a intenção pelo caminho. */
  const outro = await pg.locator('a[href*="plano=time"]').count();
  ok('e pedir outro link preserva o plano', outro >= 1, `${outro} link(s)`);
}

console.log('\n[4] o limite de envio é dito, e não engolido');
{
  /* A Supabase responde 429 quando alguém pede link demais. Engolir isso deixa
     a pessoa clicando de novo, achando que não funcionou. */
  RESPOSTA_OTP = { error: 'over_email_send_rate_limit', msg: 'muitos pedidos' };
  await pedirLink('alguem@exemplo.test');
  const aviso = await pg.locator('.aviso').first().innerText().catch(() => '');
  ok('a recusa vira recado na tela', aviso.length > 15,
     aviso.replace(/\n/g, ' ').slice(0, 110) || '(nenhum recado — a recusa foi engolida)');
  /* E a pessoa NÃO cai na tela de "olhe o seu e-mail": o link não saiu, e dizer
     que saiu é a pior resposta possível — ela vai esperar um e-mail que não vem. */
  const corpo = await pg.locator('body').innerText();
  ok('e ela não vê "olhe o seu e-mail" para um link que não saiu',
     !/olhe seu e-mail/i.test(corpo), corpo.replace(/\n/g, ' ').slice(0, 90));
}

console.log('\n[5] a volta do link mágico');
{
  /* Sem código nenhum: é o caso de quem abre o endereço à mão, ou de um cliente
     de e-mail que "pré-visualiza" o link e gasta o token antes. */
  const r = await pg.request.get(`${BASE}/conta/confirmar?lang=pt`, { maxRedirects: 0 });
  const destino = r.headers()['location'] || '';
  ok('sem código, volta para a conta com o motivo', /\/conta\?erro=/.test(destino),
     destino.slice(0, 120));
  ok('e não deixa a pessoa numa página em branco', [301, 302, 307, 308].includes(r.status()),
     String(r.status()));

  /* Com código, e o servidor aceitando: a intenção atravessa. */
  const r2 = await pg.request.get(`${BASE}/conta/confirmar?lang=pt&code=abc&plano=time`,
                                  { maxRedirects: 0 });
  const d2 = r2.headers()['location'] || '';
  ok('com código, a intenção de compra chega do outro lado', /plano=time/.test(d2), d2.slice(0, 120));

  /* Link velho ou já usado: o recado é escrito, e não silêncio. */
  RESPOSTA_OTP = { error: 'invalid_grant', msg: 'expirado' };
  const r3 = await pg.request.get(`${BASE}/conta/confirmar?lang=pt&code=velho`,
                                  { maxRedirects: 0 });
  const d3 = r3.headers()['location'] || '';
  ok('link vencido tem resposta escrita', /erro=/.test(d3), d3.slice(0, 140));
}

console.log('\n[6] o idioma do pedido volta no idioma do pedido');
{
  pedidos.length = 0;
  await pedirLink('quelquun@exemple.test', '/fr/compte');
  const otp = pedidos.filter((x) => x.url.startsWith('/auth/v1/otp'));
  const volta = otp[0] ? decodeURIComponent(otp[0].url) : '';
  ok('o link de volta carrega o francês', /lang=fr/.test(volta), volta.slice(0, 150));
  const r = await pg.request.get(`${BASE}/conta/confirmar?lang=fr`, { maxRedirects: 0 });
  ok('e a rota devolve para a conta em francês',
     /\/fr\/compte/.test(r.headers()['location'] || ''), r.headers()['location'] || '');
}

await ctx.close();
await br.close();
console.log(falhas ? `\n${falhas} FALHA(S)`
                   : '\nEntrada: o e-mail, o link e a volta — com o servidor respondendo.');
process.exit(falhas ? 1 : 0);

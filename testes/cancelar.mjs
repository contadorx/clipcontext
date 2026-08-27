/* "CANCELA NA CONTA" — a metade da promessa anual que ninguém cobrava.
 *
 * A frase publicada nos cinco cartões de preço é uma só: *cobrança anual, ela
 * renova sozinha e você cancela quando quiser na sua conta*. A renovação ganhou
 * régua no Build 23 — o aviso é pintado de verdade, com licença assinada. O
 * CANCELAMENTO não tinha nenhuma: nenhum teste do repositório mencionava a ação
 * `gerenciar`, que é a porta para o portal da Stripe.
 *
 * ATÉ ONDE ESTA RÉGUA VAI, DITO COM TODAS AS LETRAS:
 *
 *   prova    que quem assina VÊ o caminho, nos cinco idiomas;
 *   prova    que quem não assina não vê (e vê os de compra, no lugar);
 *   prova    que o botão é um formulário que CHEGA AO SERVIDOR e que a ação
 *            EXECUTA — a resposta dela volta pintada na tela;
 *   prova    que sem sessão a ação recusa, mesmo com o pedido forjado à mão;
 *   NÃO prova que o portal da Stripe abre. Isso depende de chave da Stripe
 *            falando com a Stripe, e nenhuma das duas vive nesta máquina. É a
 *            DEC-14, represada por instrução do Leandro.
 *   NÃO separa, no bloco [5], a recusa POR FALTA DE SESSÃO da recusa por a
 *            venda estar desligada neste ambiente: sem chave, as duas caem no
 *            mesmo `volta(lang, 'erro', …)` e devolvem a mesma tela. O que o
 *            bloco prova é que o pedido forjado não abre portal nenhum e não
 *            entrega o painel — e isso vale por si.
 *
 * E UM ACHADO QUE VALE MAIS QUE UMA AFIRMAÇÃO: a trava de sessão do `gerenciar`
 * não é só uma linha que alguém pode apagar. Apagando-a, o `tsc` reprova a
 * build — `email` é `string | null` e o `customers.list({ email })` da Stripe
 * exige `string | undefined`. O compilador segura essa porta antes de qualquer
 * régua, e foi medido apagando a linha de verdade.
 *
 * Dizer "não prova" é o ponto. Uma régua que fingisse ter aberto o portal seria
 * pior que régua nenhuma: ela ocuparia a linha da promessa no
 * `AUDITORIA-PENDENTE.md` e ninguém iria olhar de novo.
 *
 * O banco é falso e mora aqui dentro — o mesmo desenho do `negocio.mjs`: um
 * servidor HTTP que responde `/auth/v1/user` e a RPC da conta, com o Next
 * apontado para ele. Trocar de pessoa é trocar `ASSINANTE`.
 *
 *   node testes/cancelar.mjs
 */
import { chromium } from './_navegador.mjs';
import { spawn, execSync } from 'child_process';
import http from 'http';
import fs from 'fs';

import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';

const P = 8825, B = 8826;
const BASE = `http://localhost:${P}`;
const EMAIL = 'assina@cliente.example';

let falhas = 0;
const ok = (n, c, e) => { console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : '')); if (!c) falhas++; };

/* Os endereços da conta e os rótulos saem dos arquivos que o produto lê. Uma
   lista escrita aqui aprovaria exatamente o erro que ela deveria pegar. */
const CONTA_EM = { pt: '/conta', en: '/en/account', es: '/es/cuenta', de: '/de/konto', fr: '/fr/compte' };
const I18N = JSON.parse(fs.readFileSync(`${RAIZ_WS}/src/i18n-conta.json`, 'utf8'));
const IDIOMAS = Object.keys(CONTA_EM);

/* ----------------------------------------------------------- o banco falso */

let ASSINANTE = true;
const conta = () => ({
  email: EMAIL, plano: 'time', assentos: 3, dias: 90, cliente: 'Cliente de Teste',
  motivo: 'conta', papel: 'admin', vence_em: '2026-11-13', emissoes: 2,
  assinante: ASSINANTE,
  perfil: { cliente: 'Cliente de Teste', config: null, modelos: [] },
  faturas: [], chamados: [], resposta: null, time: null,
});

const banco = http.createServer((q, r) => {
  const j = (o) => { r.writeHead(200, { 'Content-Type': 'application/json' }); r.end(JSON.stringify(o)); };
  if (q.url.startsWith('/auth/v1/user')) return j({ id: 'u', aud: 'authenticated', email: EMAIL });
  const fn = q.url.replace('/rest/v1/rpc/', '');
  if (fn === 'walkstamp_conta_do_usuario') return j(conta());
  if (fn === 'walkstamp_blog_todos') return j([]);
  q.on('data', () => {}); q.on('end', () => j({}));
});
await new Promise((r) => banco.listen(B, r));

const matarPorta = () => { try { execSync(`fuser -k ${P}/tcp 2>/dev/null`); } catch {} };
matarPorta();
await new Promise((r) => setTimeout(r, 400));

/* SEM `STRIPE_SECRET_KEY` DE PROPÓSITO. É o que permite a afirmação [3]: a
   ação, ao executar, responde "a venda ainda não está no ar" — e uma resposta
   dessas só existe se o código do servidor rodou. Com uma chave de mentira, a
   biblioteca da Stripe tentaria a rede e o teste mediria o tempo de espera de
   um DNS em vez de medir o produto. */
const next = spawn('npx', ['next', 'start', '-p', String(P)], {
  cwd: RAIZ_WS, stdio: 'ignore',
  env: { ...process.env,
    SUPABASE_URL: `http://localhost:${B}`,
    SUPABASE_SERVICE_ROLE_KEY: 'chave_de_mentira',
    WALKSTAMP_SUPA_TESTE: `http://localhost:${B}`,
    STRIPE_SECRET_KEY: '' },
});
process.on('exit', () => { try { next.kill('SIGKILL'); } catch {} matarPorta(); banco.close(); });
let subiu = false;
for (let i = 0; i < 60; i++) {
  try { const r = await fetch(`${BASE}/conta`); if (r.ok) { subiu = true; break; } } catch {}
  await new Promise((r) => setTimeout(r, 500));
}
if (!subiu) {
  console.log('PULADO  o Next não subiu em :' + P + '  (npx next build primeiro)');
  try { next.kill('SIGKILL'); } catch {} banco.close(); process.exit(0);
}

const br = await chromium.launch({ executablePath: CHROME_WS });
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

/** Um contexto já logado. O cookie de sessão é do navegador, não da página. */
async function logado() {
  const ctx = await br.newContext({ viewport: { width: 1280, height: 1200 } });
  const jwt = [b64({ alg: 'HS256', typ: 'JWT' }),
    b64({ role: 'authenticated', email: EMAIL, exp: Math.floor(Date.now() / 1000) + 3600 }), 'x'].join('.');
  const sess = { access_token: jwt, token_type: 'bearer', expires_in: 3600,
                 expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r',
                 user: { id: 'u', email: EMAIL } };
  await ctx.addCookies([{ name: 'sb-localhost-auth-token',
    value: 'base64-' + Buffer.from(JSON.stringify(sess)).toString('base64'),
    domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' }]);
  return ctx;
}

const erros = [];
/** O cartão do plano, como ele chega ao navegador. */
async function painel(L) {
  const ctx = await logado();
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push(e.message));
  await pg.goto(BASE + CONTA_EM[L], { waitUntil: 'networkidle' });
  const texto = await pg.locator('.card').first().innerText();
  const botoes = await pg.locator('.card button').allInnerTexts();
  return { ctx, pg, texto, botoes };
}

console.log('[1] quem assina vê o caminho do cancelamento — nos cinco idiomas');
{
  ASSINANTE = true;
  for (const L of IDIOMAS) {
    const { ctx, botoes } = await painel(L);
    /* O RÓTULO SAI DO `i18n-conta.json`, que é de onde a tela o tira. Procurar
       por "cancelar" não serviria: o botão não diz "cancelar", diz "gerenciar
       assinatura" — porque quem cancela é o portal de quem cobra, e a tela que
       promete cancelar sem poder cancelar é a mentira que isto evita. */
    const alvo = I18N[L].gerenciar;
    const tem = botoes.some((b) => b.trim() === alvo);
    ok(`${L}: o botão "${alvo}" está no cartão do plano`, tem, tem ? '' : botoes.join(' | '));
    await ctx.close();
  }
}

console.log('\n[2] e os botões de COMPRA somem — não há o que comprar duas vezes');
{
  ASSINANTE = true;
  const { ctx, botoes } = await painel('pt');
  const comprar = [I18N.pt.assinarPersonal, I18N.pt.assinarTeam];
  const vazou = comprar.filter((c) => botoes.some((b) => b.trim() === c));
  ok('quem já assina não vê os dois de assinar', vazou.length === 0, vazou.join(' | '));
  await ctx.close();
}

console.log('\n[3] quem NÃO assina não vê o caminho do portal');
{
  ASSINANTE = false;
  const { ctx, botoes } = await painel('pt');
  ok('sem assinatura, não há "Gerenciar assinatura"',
     !botoes.some((b) => b.trim() === I18N.pt.gerenciar), botoes.join(' | '));
  ok('e os dois de assinar estão lá',
     [I18N.pt.assinarPersonal, I18N.pt.assinarTeam].every((c) => botoes.some((b) => b.trim() === c)),
     botoes.join(' | '));
  await ctx.close();
}

console.log('\n[4] o botão CHEGA AO SERVIDOR, e a ação executa');
{
  /* A prova é a RESPOSTA DELA de volta na tela. Com a venda desligada neste
     ambiente, `gerenciar` responde `erroVendaDesligada` — e essa frase só
     existe se o código do servidor rodou. Se o formulário não estivesse ligado
     a ação nenhuma, a página recarregaria igual e este bloco reprovaria. */
  ASSINANTE = true;
  const { ctx, pg } = await painel('pt');
  await pg.getByRole('button', { name: I18N.pt.gerenciar }).click();
  await pg.waitForLoadState('networkidle');
  const aviso = (await pg.locator('.aviso').first().innerText().catch(() => '')) || '';
  ok('a ação respondeu, e a resposta apareceu na tela',
     aviso.includes(I18N.pt.erroVendaDesligada), aviso.slice(0, 90) || '(nenhum aviso)');
  await ctx.close();
}

console.log('\n[5] sem sessão, a ação recusa — mesmo com o pedido forjado');
{
  /* Esconder o botão é desenho; recusar o pedido é a trava. O pedido é montado
     à mão pelo caminho SEM JavaScript do Next — o campo `$ACTION_ID_…` que o
     próprio servidor mandou no formulário — e enviado por um contexto novo, sem
     cookie nenhum.
     A PRIMEIRA TENTATIVA DESTA RÉGUA ERRAVA, e a medição mostrou como: com o
     cabeçalho `Next-Action` o servidor devolvia 404 TAMBÉM COM SESSÃO. Ou seja:
     a afirmação teria passado aprovando uma recusa que não era a da sessão —
     era o pedido inteiro sendo descartado. É por isso que o mesmo pedido é
     disparado duas vezes aqui, e o par COM sessão é o que dá sentido ao par
     SEM: se o identificador estivesse morto, os dois voltariam iguais. */
  ASSINANTE = true;
  const { ctx, pg } = await painel('pt');
  const campo = await pg.evaluate((rot) => {
    for (const f of document.querySelectorAll('form')) {
      if (!f.innerText.includes(rot)) continue;
      const c = [...f.querySelectorAll('input')].find((i) => i.name.startsWith('$ACTION_ID_'));
      if (c) return c.name;
    }
    return '';
  }, I18N.pt.gerenciar);
  ok('o formulário do botão traz o identificador da ação', !!campo, campo || '(não achei)');

  if (!campo) {
    console.log('  BLOCO PULADO  sem o identificador, o pedido forjado seria um POST qualquer,');
    console.log('                e recusar um POST qualquer não prova nada sobre a ação.');
    await ctx.close();
  } else {
    const corpo = encodeURIComponent(campo) + '=&lang=pt';
    const cab = { 'Content-Type': 'application/x-www-form-urlencoded' };
    const disparar = (quem) => quem.request.post(BASE + CONTA_EM.pt,
      { headers: cab, data: corpo, maxRedirects: 0, failOnStatusCode: false });

    const comSessao = await disparar(ctx);
    const tCom = await comSessao.text();
    ok('o identificador está VIVO — com sessão, o pedido volta no painel',
       />Gerenciar assinatura</.test(tCom) || tCom.includes(I18N.pt.gerenciar),
       `${comSessao.status()} ${(comSessao.headers()['location'] || '').slice(0, 60)}`);

    const nu = await br.newContext();
    const sem = await disparar(nu);
    const tSem = await sem.text();
    const paraStripe = /billing\.stripe\.com|checkout\.stripe\.com/.test(tSem) ||
                       /stripe\.com/.test(sem.headers()['location'] || '');
    ok('o MESMO pedido, deslogado, não abre portal nenhum', !paraStripe,
       (sem.headers()['location'] || '').slice(0, 80));
    /* E o que volta é a tela de entrar: campo de e-mail, e nenhum botão de
       gerenciar. É a diferença entre "não abriu o portal" e "não fez nada". */
    ok('e o que volta é a tela de entrar, e não o painel',
       /name="email"/.test(tSem) && !/>Gerenciar assinatura</.test(tSem),
       `entrar=${/name="email"/.test(tSem)} gerenciar=${/>Gerenciar assinatura</.test(tSem)}`);
    await nu.close();
    await ctx.close();
  }
}

ok('sem erro de JavaScript em nenhuma das telas', erros.length === 0,
   erros.join(' | ').slice(0, 160));

await br.close();
try { next.kill('SIGKILL'); } catch {}
matarPorta(); banco.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nCancelar na conta: o caminho existe e a ação executa.');
process.exit(falhas ? 1 : 0);

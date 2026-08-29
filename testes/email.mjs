/* O DISPARADOR DE E-MAIL — Brevo, num lugar só.
 *
 * O que este teste prova, e por que:
 *
 *   1. FALTANDO SEGREDO, ELE RECUSA. Um disparador que devolve "ok" sem ter
 *      mandado nada é a pior falha possível: ninguém procura o e-mail que o
 *      sistema jurou ter enviado;
 *   2. o convite fala com o Brevo, no formato do Brevo, com a chave no
 *      cabeçalho `api-key` — e não mais com o Resend;
 *   3. responder um chamado avisa quem escreveu, na LÍNGUA dele;
 *   4. e a falha do aviso NÃO desfaz a resposta: a resposta é o trabalho, o
 *      e-mail é a notícia;
 *   5. o convite de ASSENTO manda a carta de verdade — era a promessa sem
 *      porta do cartão Team, vendida como pronta e sem régua nenhuma;
 *   6. e quando ela não pode sair, o assento fica e a tela DIZ que não saiu.
 */
import { chromium } from 'playwright';
import { spawn, execSync } from 'child_process';
import http from 'http';

import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';
import { garantirPortaLivre } from './_porta.mjs';
const P = 8853, B = 8854, E = 8855;
const BASE = `http://localhost:${P}`;
const DONO = 'dono@email.example';
let falhas = 0;
const ok = (n, c, e) => { console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : '')); if (!c) falhas++; };

/* O Brevo de mentira. Ele guarda o que recebeu — o teste olha o CORPO, porque
   é ali que mora a diferença entre um serviço e outro. */
const CARTAS = [];
let brevoStatus = 201;
const brevo = http.createServer((q, r) => {
  const b = []; q.on('data', (d) => b.push(d));
  q.on('end', () => {
    CARTAS.push({ url: q.url, chave: q.headers['api-key'] || '',
                  corpo: JSON.parse(Buffer.concat(b).toString('utf8') || '{}') });
    r.writeHead(brevoStatus, { 'Content-Type': 'application/json' });
    r.end(JSON.stringify({ messageId: 'x' }));
  });
});
await new Promise((r) => brevo.listen(E, r));

let RESPOSTA = { ok: true, numero: 'CH-9', email: 'quem@escreveu.example' };
let LIMITE_ASSENTO = true;
const chamadas = [];
const banco = http.createServer((q, r) => {
  const b = []; q.on('data', (d) => b.push(d));
  q.on('end', () => {
    const j = (o) => { r.writeHead(200, { 'Content-Type': 'application/json' }); r.end(JSON.stringify(o)); };
    if (q.url.startsWith('/auth/v1/user')) return j({ id: 'u', aud: 'authenticated', email: DONO });
    const fn = q.url.replace('/rest/v1/rpc/', '');
    const a = JSON.parse(Buffer.concat(b).toString('utf8') || '{}');
    chamadas.push({ fn, a });
    if (fn === 'walkstamp_conta_do_usuario') {
      return j({ email: DONO, plano: 'time', assentos: 3, dias: 90, cliente: 'Cliente de Teste',
                 motivo: 'conta', papel: 'admin', vence_em: null, emissoes: 0, assinante: true,
                 perfil: { cliente: 'Cliente de Teste', config: null, modelos: [] },
                 faturas: [], chamados: [], resposta: null,
                 /* Com `time: null` a seção do convite nem é desenhada, e o
                    bloco [5] passaria por não achar o formulário — que é o
                    jeito mais silencioso de um teste morrer. */
                 time: { cliente: 'Cliente de Teste', assentos: 3, usados: 2, dias: 90,
                         dominio: 'email.example', config: null, pessoas: [], modelos: [],
                         emissoes: [] } });
    }
    if (fn === 'walkstamp_negocio_painel') {
      return j({ resumo: { contas: 0, contas30: 0, clientes: 0, clientesAtivos: 0,
        assentosVendidos: 0, assentosUsados: 0, pago: 0, aberto: 0, vencido: 0, nVencidas: 0,
        chamadosAbertos: 1, chamadosParados: 0, chamadosTotal: 1, interesse: 0, interesse30: 0,
        eventos30: 0, emissoes30: 0 },
        clientes: [], contas: [], faturas: [],
        chamados: [{ numero: 'CH-9', tipo: 'erro', status: 'aberto', texto: 'não abriu',
                     resposta: null, email: 'quem@escreveu.example', nota: null, idioma: 'en',
                     cenario: null, origem: 'app', diagnostico: null,
                     criado_em: '2026-08-18T10:00:00Z', respondido_em: null }],
        interesse: [], nps: { total: 0, promotores: 0, passivos: 0, detratores: 0,
                              media: null, nps: null, faixas: [] },
        uso: { formato: [], idioma: [], origem: [], dia: [] } });
    }
    if (fn === 'walkstamp_chamado_responder') return j(RESPOSTA);
    /* A trava de limite mora no banco e devolve booleano. Sem responder aqui, o
       `{}` vira "nao pode" e o convite para em 429 antes de chegar ao Brevo. */
    if (fn === 'walkstamp_convite_pode') return j(true);
    /* O convite de ASSENTO tem limite próprio (60/hora por administrador em vez
       de 5, senão um time de 25 levaria cinco horas para ser montado). Sem esta
       linha o `{}` vira "não pode" e a carta para antes do Brevo. */
    if (fn === 'walkstamp_convite_assento_pode') return j(LIMITE_ASSENTO);
    /* O que a `time_convidar` devolve de verdade é o painel do time, e é de lá
       que sai o nome do cliente que vai no assunto do e-mail. */
    if (fn === 'walkstamp_time_convidar') return j({ cliente: 'Cliente de Teste', assentos: 3, usados: 2 });
    if (fn === 'walkstamp_blog_todos') return j([]);
    j({});
  });
});
await new Promise((r) => banco.listen(B, r));

/* `async` por causa da garantia da porta: matar quem estava lá não é o mesmo
   que ela ter ficado livre, e este arquivo sobe o Next duas vezes. */
async function subir(env) {
  await garantirPortaLivre(P, 'o email.mjs');
  const n = spawn('npx', ['next', 'start', '-p', String(P)], {
    cwd: `${RAIZ_WS}`, stdio: 'ignore',
    env: { ...process.env, SUPABASE_URL: `http://localhost:${B}`,
           SUPABASE_SERVICE_ROLE_KEY: 'x', WALKSTAMP_SUPA_TESTE: `http://localhost:${B}`,
           WALKSTAMP_DONO: DONO, CONVITE_SAL: 'sal-de-teste', ...env },
  });
  return n;
}
async function esperar() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`${BASE}/conta`); if (r.ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
}
let proc;
const br = await chromium.launch({ executablePath: CHROME_WS });
process.on('exit', () => { try { proc && proc.kill('SIGKILL'); } catch {} banco.close(); brevo.close(); });

console.log('[1] sem chave do Brevo, o convite RECUSA — e não finge');
{
  proc = await subir({});
  await esperar();
  const r = await fetch(`${BASE}/api/convite`, {
    method: 'POST',
    /* A origem tem que ser a do site: a trava de origem e conferida ANTES dos
       segredos, de proposito — quem nao e a nossa pagina nem chega a descobrir
       se o disparador esta configurado. Mandar `localhost` aqui testava a
       trava de origem, e nao o disparador. */
    headers: { 'content-type': 'application/json', origin: 'https://walkstamp.com' },
    body: JSON.stringify({ para: 'colega@exemplo.com', lang: 'pt' }),
  });
  ok('responde 503, o código de "este serviço não está de pé"', r.status === 503, String(r.status));
  ok('e nada foi mandado', CARTAS.length === 0, String(CARTAS.length));
  proc.kill('SIGKILL'); await new Promise((r) => setTimeout(r, 800));
}

console.log('\n[2] com a chave, o convite fala BREVO — não Resend');
{
  proc = await subir({ BREVO_API_KEY: 'chave-brevo-de-teste',
                 EMAIL_DE: 'ola@walkstamp.com', EMAIL_DE_NOME: 'Walkstamp',
                 WALKSTAMP_BREVO_BASE: `http://localhost:${E}` });
  await esperar();
  const r = await fetch(`${BASE}/api/convite`, {
    method: 'POST',
    /* A origem tem que ser a do site: a trava de origem e conferida ANTES dos
       segredos, de proposito — quem nao e a nossa pagina nem chega a descobrir
       se o disparador esta configurado. Mandar `localhost` aqui testava a
       trava de origem, e nao o disparador. */
    headers: { 'content-type': 'application/json', origin: 'https://walkstamp.com' },
    body: JSON.stringify({ para: 'colega@exemplo.com', nome: 'Ana', quem: 'Leandro', lang: 'pt' }),
  });
  ok('o envio foi aceito', r.status === 200, String(r.status));
  const c = CARTAS[CARTAS.length - 1];
  ok('bateu no endereço do Brevo', !!c && c.url === '/v3/smtp/email', c && c.url);
  ok('com a chave no cabeçalho `api-key`', !!c && c.chave === 'chave-brevo-de-teste');
  ok('no formato do Brevo (sender/to/htmlContent)',
     !!c && c.corpo.sender && c.corpo.sender.email === 'ola@walkstamp.com'
     && Array.isArray(c.corpo.to) && c.corpo.to[0].email === 'colega@exemplo.com'
     && typeof c.corpo.htmlContent === 'string' && typeof c.corpo.textContent === 'string',
     c && JSON.stringify(Object.keys(c.corpo)));
}

console.log('\n[3] responder um chamado avisa quem escreveu, na língua dele');
{
  const ctx = await br.newContext({ viewport: { width: 1300, height: 1000 } });
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const jwt = [b64({ alg: 'HS256', typ: 'JWT' }),
    b64({ role: 'authenticated', email: DONO, exp: Math.floor(Date.now() / 1000) + 3600 }), 'x'].join('.');
  await ctx.addCookies([{ name: 'sb-localhost-auth-token',
    value: 'base64-' + Buffer.from(JSON.stringify({ access_token: jwt, token_type: 'bearer',
      expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: 'r', user: { id: 'u', email: DONO } })).toString('base64'),
    domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' }]);
  const pg = await ctx.newPage();
  await pg.goto(`${BASE}/conta/negocio/chamados`, { waitUntil: 'networkidle' });
  const antes = CARTAS.length;
  await pg.locator('.negLista li form textarea').fill('Corrigido na versão de hoje.');
  await pg.locator('.negLista li form button').click();
  await pg.waitForURL(/[?&](feito|erro)=/, { timeout: 20000 });
  ok('a resposta foi gravada', /feito=CH-9/.test(pg.url()), pg.url());
  const c = CARTAS[CARTAS.length - 1];
  ok('e saiu um e-mail para quem escreveu', CARTAS.length === antes + 1
     && c.corpo.to[0].email === 'quem@escreveu.example', JSON.stringify(c && c.corpo.to));
  /* O chamado veio com `idioma: 'en'`. O painel é sempre português; o aviso
     tem que sair na língua de QUEM RECEBE. */
  ok('no idioma de quem escreveu, e não no do painel',
     /replied to your ticket/i.test(c.corpo.subject), c.corpo.subject);
  /* Responder ao remetente de disparo é a conversa morrendo na segunda
     mensagem: ninguém lê aquela caixa. */
  ok('com resposta apontando para o contato de gente',
     !!c.corpo.replyTo && /@/.test(c.corpo.replyTo.email), JSON.stringify(c.corpo.replyTo));
  /* O e-mail NÃO repete a resposta inteira: o texto do chamado costuma trazer
     contexto de trabalho de quem escreveu, e um aviso que já diz tudo faz a
     pessoa não voltar à tela onde está o histórico. */
  ok('sem repetir a resposta dentro do e-mail',
     !/Corrigido na versão de hoje/.test(c.corpo.htmlContent + c.corpo.textContent));
  await ctx.close();
}

console.log('\n[4] o disparador cai, e a resposta continua gravada');
{
  brevoStatus = 500;
  RESPOSTA = { ok: true, numero: 'CH-9', email: 'quem@escreveu.example' };
  const ctx = await br.newContext();
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const jwt = [b64({ alg: 'HS256', typ: 'JWT' }),
    b64({ role: 'authenticated', email: DONO, exp: Math.floor(Date.now() / 1000) + 3600 }), 'x'].join('.');
  await ctx.addCookies([{ name: 'sb-localhost-auth-token',
    value: 'base64-' + Buffer.from(JSON.stringify({ access_token: jwt, token_type: 'bearer',
      expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: 'r', user: { id: 'u', email: DONO } })).toString('base64'),
    domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' }]);
  const pg = await ctx.newPage();
  await pg.goto(`${BASE}/conta/negocio/chamados`, { waitUntil: 'networkidle' });
  const antesRpc = chamadas.filter((c) => c.fn === 'walkstamp_chamado_responder').length;
  await pg.locator('.negLista li form textarea').fill('Segunda tentativa.');
  await pg.locator('.negLista li form button').click();
  await pg.waitForURL(/[?&](feito|erro)=/, { timeout: 20000 });
  const depoisRpc = chamadas.filter((c) => c.fn === 'walkstamp_chamado_responder').length;
  /* A resposta é o trabalho; o e-mail é a notícia. Um erro de disparador não
     pode custar o que já foi escrito — e nem sequer aparecer como erro. */
  ok('o banco recebeu a resposta mesmo com o disparador fora',
     depoisRpc === antesRpc + 1, `${antesRpc} → ${depoisRpc}`);
  ok('e a tela diz que deu certo, porque deu', /feito=CH-9/.test(pg.url()), pg.url());
  brevoStatus = 201;
  await ctx.close();
}

/* Uma sessão de administrador, montada como nos blocos acima. */
async function comoAdmin() {
  const ctx = await br.newContext({ viewport: { width: 1300, height: 1200 } });
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const jwt = [b64({ alg: 'HS256', typ: 'JWT' }),
    b64({ role: 'authenticated', email: DONO, exp: Math.floor(Date.now() / 1000) + 3600 }), 'x'].join('.');
  await ctx.addCookies([{ name: 'sb-localhost-auth-token',
    value: 'base64-' + Buffer.from(JSON.stringify({ access_token: jwt, token_type: 'bearer',
      expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: 'r', user: { id: 'u', email: DONO } })).toString('base64'),
    domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' }]);
  return ctx;
}

console.log('\n[5] convidar para um assento MANDA a carta — era a promessa sem porta');
{
  /* O cartão Team vende, em cinco idiomas, "convidar por e-mail, sem ninguém
     digitar chave". Medido em 28/08: o assento era criado e NENHUM e-mail saía.
     Ninguém percebia porque nada olhava — o painel dizia "Salvo." e ia embora. */
  const ctx = await comoAdmin();
  const pg = await ctx.newPage();
  await pg.goto(`${BASE}/conta/time`, { waitUntil: 'networkidle' });
  const antes = CARTAS.length;
  await pg.locator('input[type="email"][name="email"]').first().fill('nova@empresa.example');
  await pg.locator('button:has-text("Convidar")').first().click();
  await pg.waitForURL(/[?&](feito|erro|parcial)=/, { timeout: 20000 });

  /* A CARTA VEM PRIMEIRO, E POR EXPERIÊNCIA. Este bloco nasceu com a tela em
     cima e `CARTAS[CARTAS.length - 1]` embaixo — e quando eu desliguei o envio
     para provar a régua por falha, quatro afirmações continuaram VERDES: a tela
     dizia "enviado" (era o defeito, não a prova) e as outras liam a carta
     ANTERIOR, do bloco [3], que nada tinha a ver com este convite.
     Uma afirmação que passa lendo o artefato de outro é pior do que afirmação
     nenhuma: ela dá o verde e cala. Agora a carta é a DESTE bloco, ou é nula —
     e nula reprova tudo que depende dela. */
  const c = CARTAS.length === antes + 1 ? CARTAS[antes] : null;
  ok('saiu exatamente uma carta, e é desta ação', !!c, `${antes} → ${CARTAS.length}`);
  ok('  e a tela diz que o convite foi enviado', /[?&]feito=/.test(pg.url()),
     pg.url().replace(/^.*\?/, '?').slice(0, 80));
  ok('  para quem foi convidado, e não para quem convidou',
     !!c && c.corpo.to[0].email === 'nova@empresa.example', c && JSON.stringify(c.corpo.to));
  /* O nome do cliente vem do painel que a própria `time_convidar` devolveu —
     escrito no teste, seria o teste provando o teste. */
  ok('  com o nome do cliente no assunto', !!c && /Cliente de Teste/.test(c.corpo.subject),
     c && c.corpo.subject);
  /* A CARTA NÃO CARREGA ACESSO. Um convite com chave dentro vira acesso
     encaminhável: quem recebesse o e-mail repassado entraria no lugar da
     pessoa. O que ela carrega é o endereço da conta, e a entrada é a de
     sempre — o link mágico, pedido pelo próprio convidado. */
  const tudo = (c ? c.corpo.htmlContent + c.corpo.textContent : '');
  ok('  e não leva chave, token nem link de sessão dentro',
     !/access_token|WS-|licen[çc]a=|[?&]token=/i.test(tudo));
  ok('  com resposta apontando para o contato de gente',
     !!c && !!c.corpo.replyTo && /@/.test(c.corpo.replyTo.email), c && JSON.stringify(c.corpo.replyTo));
  /* Mesma moldura das outras duas cartas: desde 28/08 elas saem do
     `lib/carta.ts`. Em e-mail, o molde que divergiu só aparece errado na caixa
     de quem recebe — e essa pessoa não reclama, ela só não clica. */
  ok('  na mesma moldura das outras cartas do produto',
     !!c && /role="presentation"/.test(c.corpo.htmlContent)
         && /Walk<span/.test(c.corpo.htmlContent));
  await ctx.close();
}

console.log('\n[6] estourado o limite do destino, o assento fica e a tela NÃO mente');
{
  /* Reconvidar o mesmo endereço não gasta assento — o insert é `on conflict do
     update` —, então sem limite por destino o convite viraria jeito de
     incomodar alguém. Quando ele trava, o assento continua criado: dizer
     "enviado" faria o administrador ir embora achando que avisou. */
  LIMITE_ASSENTO = false;
  const ctx = await comoAdmin();
  const pg = await ctx.newPage();
  await pg.goto(`${BASE}/conta/time`, { waitUntil: 'networkidle' });
  const antes = CARTAS.length;
  const antesRpc = chamadas.filter((c) => c.fn === 'walkstamp_time_convidar').length;
  await pg.locator('input[type="email"][name="email"]').first().fill('demais@empresa.example');
  await pg.locator('button:has-text("Convidar")').first().click();
  await pg.waitForURL(/[?&](feito|erro|parcial)=/, { timeout: 20000 });

  ok('o assento foi criado assim mesmo',
     chamadas.filter((c) => c.fn === 'walkstamp_time_convidar').length === antesRpc + 1);
  ok('  e nenhuma carta saiu', CARTAS.length === antes, `${antes} → ${CARTAS.length}`);
  ok('  e a tela não diz "enviado"', !/[?&]feito=/.test(pg.url()),
     pg.url().replace(/^.*\?/, '?').slice(0, 80));
  ok('  e conta as duas coisas: o assento existe, o convite não saiu',
     /[?&]parcial=/.test(pg.url()) && /assento/i.test(await pg.locator('body').innerText()),
     pg.url().replace(/^.*\?/, '?').slice(0, 80));
  LIMITE_ASSENTO = true;
  await ctx.close();
}

await br.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);

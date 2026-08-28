/* "SEUS DADOS" — a tela que diz o que o servidor guarda, e o botão que apaga.
 *
 * A DEC-1 foi decidida no caminho A: "nada do seu conteúdo sai sem um gesto
 * seu", com a matriz de exceções nomeada. A DEC-3 fechou junto, também em A: o
 * servidor guarda o que a feature precisa, e a conta mostra o quê.
 *
 * O que torna A defensável não é a tela que lista. É o apagar funcionar, e o
 * apagar obedecer à SESSÃO e não ao formulário. É isso que esta régua cobra.
 *
 * ATÉ ONDE ELA VAI, DITO COM TODAS AS LETRAS:
 *
 *   prova    que as DUAS tabelas aparecem — o que sai e o que fica —, nos cinco
 *            idiomas, com o motivo do que fica escrito ao lado;
 *   prova    que os PRAZOS vêm do banco e não estão escritos na tela: com outros
 *            números no banco, a tela muda;
 *   prova    que a gaveta do apagar NASCE FECHADA;
 *   prova    que o botão CHEGA AO SERVIDOR e que a ação EXECUTA — a confirmação
 *            errada volta pintada na tela;
 *   prova    que o e-mail que chega ao banco é o da SESSÃO, mesmo quando o
 *            formulário é adulterado para dizer outro;
 *   prova    que sem sessão o pedido forjado não apaga nada;
 *   NÃO prova que o `delete` do Postgres apaga as linhas certas. Isso é SQL, e
 *            quem responde por ele é o banco — aqui o banco é falso de
 *            propósito, para que a régua meça o PRODUTO e não a rede.
 *
 * O banco falso é o mesmo desenho do `cancelar.mjs`.
 *
 *   node testes/meusdados.mjs
 */
import { chromium } from './_navegador.mjs';
import { spawn, execSync } from 'child_process';
import http from 'http';
import fs from 'fs';

import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';

const P = 8829, B = 8830;
const BASE = `http://localhost:${P}`;
const EMAIL = 'dono@cliente.example';
const OUTRO = 'vitima@cliente.example';

let falhas = 0;
const ok = (n, c, e) => { console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : '')); if (!c) falhas++; };

/* Os endereços e os rótulos saem dos arquivos que o produto lê. Uma lista
   escrita aqui aprovaria exatamente o erro que deveria pegar. */
const ROTAS = JSON.parse(fs.readFileSync(`${RAIZ_WS}/src/rotas.json`, 'utf8'));
const I18N = JSON.parse(fs.readFileSync(`${RAIZ_WS}/src/i18n-conta.json`, 'utf8'));
const CONTA_EM = ROTAS.caminhoConta;
const SUB = ROTAS.subConta.dados;
const IDIOMAS = Object.keys(CONTA_EM);
const DADOS_EM = (L) => `${CONTA_EM[L]}/${SUB[L]}`;

/* ----------------------------------------------------------- o banco falso */

let PRAZOS = { conta_dias: 90, lista_meses: 24, evento_meses: 18 };
let CONTAGEM = { roteiros: 7, casos: 41, anexos: 3, modelos: 2, chamados: 1, vocabulario: 1 };
/** O que o servidor MANDOU para o banco. É a única testemunha de que o e-mail
 *  usado foi o da sessão, e não o que veio do formulário. */
const chamadas = [];

const meus = () => ({
  email: EMAIL, prazos: PRAZOS,
  apagavel: CONTAGEM,
  fica: { faturas: 4, emissoes: 12 },
  total_apagavel: CONTAGEM.roteiros + CONTAGEM.casos + CONTAGEM.modelos
                  + CONTAGEM.chamados + CONTAGEM.vocabulario,
});

const conta = () => ({
  email: EMAIL, plano: 'time', assentos: 3, dias: 90, cliente: 'Cliente de Teste',
  motivo: 'conta', papel: 'admin', vence_em: '2026-11-13', emissoes: 2, assinante: true,
  perfil: { cliente: 'Cliente de Teste', config: null, modelos: [] },
  faturas: [], chamados: [], resposta: null, time: null,
});

const banco = http.createServer((q, r) => {
  const j = (o) => { r.writeHead(200, { 'Content-Type': 'application/json' }); r.end(JSON.stringify(o)); };
  if (q.url.startsWith('/auth/v1/user')) return j({ id: 'u', aud: 'authenticated', email: EMAIL });
  const fn = q.url.replace('/rest/v1/rpc/', '');
  let cru = '';
  q.on('data', (c) => { cru += c; });
  q.on('end', () => {
    let args = {};
    try { args = JSON.parse(cru || '{}'); } catch {}
    chamadas.push({ fn, args });
    if (fn === 'walkstamp_conta_do_usuario') return j(conta());
    if (fn === 'walkstamp_meus_dados') return j(meus());
    if (fn === 'walkstamp_apagar_meus_dados') {
      /* O banco de verdade compara os dois e recusa. O falso faz o MESMO — se
         ele aceitasse qualquer coisa, o bloco da confirmação errada passaria
         por acidente. */
      const e = String(args.p_email || '').toLowerCase();
      const c = String(args.p_confirmacao || '').toLowerCase();
      if (c !== e) return j({ erro: 'confirmacao_nao_bate' });
      return j({ ok: true, apagados: CONTAGEM, depois: meus(), faxina: [] });
    }
    if (fn === 'walkstamp_blog_todos') return j([]);
    j({});
  });
});
await new Promise((r) => banco.listen(B, r));

const matarPorta = () => { try { execSync(`fuser -k ${P}/tcp 2>/dev/null`); } catch {} };
matarPorta();
await new Promise((r) => setTimeout(r, 400));

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

async function logado() {
  const ctx = await br.newContext({ viewport: { width: 1280, height: 1400 } });
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

async function tela(L, busca = '') {
  const ctx = await logado();
  const pg = await ctx.newPage();
  await pg.goto(BASE + DADOS_EM(L) + busca, { waitUntil: 'networkidle' });
  return { ctx, pg, texto: await pg.locator('.card').first().innerText() };
}

console.log('[1] as DUAS tabelas aparecem — o que sai e o que fica — nos cinco idiomas');
for (const L of IDIOMAS) {
  const { ctx, pg, texto } = await tela(L);
  const T = I18N[L];
  ok(`${L}: diz o que o botão apaga`, texto.includes(T.dadosApagavel), texto.slice(0, 60));
  ok(`  ${L}: e diz o que fica`, texto.includes(T.dadosFica));
  /* O motivo tem que estar AO LADO do que fica. Uma tela que lista o que fica
     sem dizer por quê é uma confissão, não uma prestação de contas. */
  ok(`  ${L}: com o motivo da fatura escrito junto`, texto.includes(T.dadosFaturaPor));
  const n = await pg.locator('table.dados').count();
  ok(`  ${L}: são duas tabelas, não uma`, n === 2, String(n));
  await ctx.close();
}

console.log('\n[2] as contagens são as do banco — a tela não inventa número');
{
  CONTAGEM = { roteiros: 7, casos: 41, anexos: 3, modelos: 2, chamados: 1, vocabulario: 1 };
  const { ctx, pg } = await tela('pt');
  const linha = await pg.locator('table.dados').first().innerText();
  for (const [rot, v] of [[I18N.pt.dadosRoteiros, 7], [I18N.pt.dadosCasos, 41]]) {
    const l = linha.split('\n').find((x) => x.startsWith(rot)) || '';
    ok(`"${rot}" mostra ${v}`, l.includes(String(v)), l);
  }
  await ctx.close();
}

console.log('\n[2b] a tabela é DERIVADA do que o banco conta — não uma lista escrita na tela');
{
  /* O DEFEITO QUE ISTO FECHA. A tabela tinha as cinco linhas escritas uma a
     uma. Quando o vocabulário guardado virou dado no servidor (Build 49), a
     página que existe para dizer TUDO o que guardamos de alguém passaria a
     esconder uma coisa — em silêncio, e sem nada reprovar. Justamente a página
     onde esconder é o pior defeito possível.

     Agora ela percorre o que o `meus_dados` devolveu. Esta régua manda uma
     chave que a tela nunca viu: se ela sumir, a tela voltou a ter lista
     própria; se aparecer, a tela mostra o que existe, com rótulo ou sem. */
  CONTAGEM = { roteiros: 1, casos: 2, anexos: 0, modelos: 0, chamados: 0,
               vocabulario: 1, coisaNovaDoBanco: 9 };
  const { ctx, pg } = await tela('pt');
  const tabela = await pg.locator('table.dados').first().innerText();

  ok('o vocabulário guardado aparece, com o rótulo dele',
     tabela.includes(I18N.pt.dadosVocabulario), I18N.pt.dadosVocabulario);
  /* Sem rótulo sai a chave crua, e é de propósito: linha feia alguém conserta,
     linha que some não aparece para ninguém. */
  ok('e uma chave que a tela não conhece aparece assim mesmo',
     /coisaNovaDoBanco/.test(tabela) && /\b9\b/.test(tabela),
     tabela.split('\n').filter((l) => /coisaNova|9/.test(l)).join(' | ').slice(0, 70));
  ok('  com uma linha por coisa que o banco contou',
     tabela.split('\n').filter((l) => l.trim()).length >= Object.keys(CONTAGEM).length,
     `${tabela.split('\n').filter((l) => l.trim()).length} linha(s) para ${Object.keys(CONTAGEM).length} chave(s)`);
  await ctx.close();
  CONTAGEM = { roteiros: 7, casos: 41, anexos: 3, modelos: 2, chamados: 1, vocabulario: 1 };
}

console.log('\n[3] os PRAZOS vêm do banco, e não escritos na tela');
{
  /* Este é o bloco que separa uma fonte única de uma lista paralela. Os três
     números moravam dentro do `expurgo` e eram repetidos em prosa na política
     de privacidade. Se a tela os tivesse escritos, ela seria a terceira cópia —
     e a cópia que ninguém confere é a que vira mentira. */
  PRAZOS = { conta_dias: 45, lista_meses: 24, evento_meses: 6 };
  const { ctx, texto } = await tela('pt');
  ok('com 45 no banco, a tela diz 45', texto.includes('45'), texto.slice(-260));
  ok('  e com 6 meses no banco, a tela diz 6', /\b6\b/.test(texto));
  ok('  e o 90 antigo não sobrou escrito em lugar nenhum', !texto.includes('90 dias'));
  await ctx.close();
  PRAZOS = { conta_dias: 90, lista_meses: 24, evento_meses: 18 };
}

console.log('\n[4] a gaveta do apagar nasce FECHADA');
{
  const { ctx, pg } = await tela('pt');
  const g = pg.locator('details.apagarDados');
  ok('a gaveta existe', (await g.count()) === 1);
  ok('  e está fechada', (await g.evaluate((e) => e.open)) === false);
  /* Fechada de verdade: o campo de confirmação não é alcançável sem abrir. */
  ok('  o campo de confirmação não está visível',
     !(await pg.locator('#confirmacao').isVisible().catch(() => false)));
  await ctx.close();
}

console.log('\n[5] o botão chega ao servidor, e a confirmação errada é recusada');
{
  const antes = chamadas.length;
  const { ctx, pg } = await tela('pt');
  await pg.locator('details.apagarDados > summary').click();
  await pg.locator('#confirmacao').fill('nao-e-o-meu@example.com');
  await pg.getByRole('button', { name: I18N.pt.dadosConfirmar }).click();
  /* `networkidle` NÃO serve aqui, e a primeira versão desta régua caiu por isso:
     ele volta antes do POST da ação, e a tela lida era a de antes do clique —
     cinco afirmações reprovando por causa de uma espera, não do produto. O que
     se espera é a VOLTA da ação, que vem carimbada no endereço. */
  await pg.waitForURL(/[?&](erro|feito)=/, { timeout: 15000 });
  const texto = await pg.locator('.card').first().innerText();
  ok('a ação respondeu, e a recusa apareceu na tela',
     texto.includes(I18N.pt.dadosNaoBate), texto.slice(0, 120));
  const tentou = chamadas.slice(antes).some((c) => c.fn === 'walkstamp_apagar_meus_dados');
  ok('  e o pedido chegou mesmo ao banco', tentou);
  await ctx.close();
}

console.log('\n[6] o e-mail que chega ao banco é o da SESSÃO, não o do formulário');
{
  /* A trava do produto inteiro está aqui. Se o e-mail viesse do campo, um campo
     escondido trocado apagaria o roteiro de outra pessoa — e este é o único
     botão sem desfazer. O formulário é adulterado no navegador antes de postar:
     é exatamente o que alguém faria com o F12 aberto. */
  const antes = chamadas.length;
  const { ctx, pg } = await tela('pt');
  await pg.locator('details.apagarDados > summary').click();
  await pg.locator('#confirmacao').fill(EMAIL);
  await pg.evaluate((outro) => {
    const f = document.querySelector('details.apagarDados form');
    const i = document.createElement('input');
    i.type = 'hidden'; i.name = 'email'; i.value = outro;
    f.appendChild(i);
    const j = document.createElement('input');
    j.type = 'hidden'; j.name = 'p_email'; j.value = outro;
    f.appendChild(j);
  }, OUTRO);
  await pg.getByRole('button', { name: I18N.pt.dadosConfirmar }).click();
  await pg.waitForURL(/[?&](erro|feito)=/, { timeout: 15000 });

  const usadas = chamadas.slice(antes).filter((c) => c.fn === 'walkstamp_apagar_meus_dados');
  ok('o banco foi chamado', usadas.length > 0, String(usadas.length));
  const emails = usadas.map((c) => String(c.args.p_email || '').toLowerCase());
  /* `every` numa lista VAZIA é verdadeiro: sem o `length`, esta afirmação
     passava justamente quando o banco não tinha sido chamado — que é o caso em
     que ela mais precisa reprovar. */
  ok('  e o e-mail que chegou é o da sessão',
     emails.length > 0 && emails.every((e) => e === EMAIL), emails.join(',') || '(nenhuma chamada)');
  ok('  e o do formulário NÃO chegou', !emails.includes(OUTRO), emails.join(','));

  const texto = await pg.locator('.card').first().innerText();
  ok('  e a tela confirma que apagou', texto.includes(I18N.pt.dadosFeito), texto.slice(0, 120));
  await ctx.close();
}

console.log('\n[7] sem sessão, o pedido forjado não apaga nada');
{
  const { ctx, pg } = await tela('pt');
  await pg.locator('details.apagarDados > summary').click();
  const campo = await pg.evaluate(() => {
    const f = document.querySelector('details.apagarDados form');
    const c = [...f.querySelectorAll('input')].find((i) => i.name.startsWith('$ACTION_ID_'));
    return c ? c.name : '';
  });
  ok('o formulário traz o identificador da ação', !!campo, campo || '(não achei)');

  if (!campo) {
    console.log('  BLOCO PULADO  sem o identificador, o pedido forjado seria um POST qualquer,');
    console.log('                e recusar um POST qualquer não prova nada sobre a ação.');
    await ctx.close();
  } else {
    /* MULTIPART, e não urlencoded: é o `enctype` que o próprio Next põe no
       formulário da ação, e um pedido forjado que fala outra língua seria
       descartado antes de chegar à trava — a régua aprovaria uma recusa que não
       é a da sessão. É o mesmo erro que derrubou a primeira versão do
       `cancelar.mjs`, com outra roupa. */
    const disparar = (quem) => quem.request.post(BASE + DADOS_EM('pt'), {
      multipart: { [campo]: '', lang: 'pt', confirmacao: EMAIL },
      maxRedirects: 0, failOnStatusCode: false,
    });

    /* O par COM sessão é o que dá sentido ao par SEM: se o identificador
       estivesse morto, os dois voltariam iguais e a régua aprovaria uma recusa
       que não era a da sessão. Foi assim que a primeira versão do `cancelar.mjs`
       errou. */
    const a = chamadas.length;
    const com = await disparar(ctx);
    const vivoCom = chamadas.slice(a).some((c) => c.fn === 'walkstamp_apagar_meus_dados');
    ok('o identificador está VIVO — com sessão, o banco é chamado', vivoCom,
       String(com.status()));

    const b = chamadas.length;
    const nu = await br.newContext();
    const sem = await disparar(nu);
    const chamou = chamadas.slice(b).some((c) => c.fn === 'walkstamp_apagar_meus_dados');
    ok('  o MESMO pedido, deslogado, não chega a apagar nada', !chamou,
       `${sem.status()} ${(sem.headers()['location'] || '').slice(0, 60)}`);
    await nu.close();
    await ctx.close();
  }
}

await br.close();
try { next.kill('SIGKILL'); } catch {} matarPorta(); banco.close();
console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'tudo certo'));
process.exit(falhas ? 1 : 0);

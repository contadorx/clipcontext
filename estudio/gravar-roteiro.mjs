/**
 * O TERCEIRO VÍDEO: a rodada paga, do começo ao fim.
 *
 * O tour mostra a ferramenta gratuita — gravar, extrair, gerar. Ele vende bem
 * o mecanismo e não vende o plano, porque o que se paga não é a ferramenta: é
 * a RODADA. Uma planilha com quarenta casos entra, cada pessoa recebe os seus
 * já preenchidos, a execução gera evidência no computador de quem executa, e a
 * planilha volta com situação, data, quem fez e a impressão digital.
 *
 * Isso é impossível de explicar em texto na página de preços. Em sessenta
 * segundos de vídeo é óbvio.
 *
 * ---- por que há um Supabase de mentira aqui ----
 *
 * A tela do roteiro vive atrás de sessão e fala com o banco. Gravar contra a
 * produção significaria ou inventar uma conta de verdade com dados de verdade
 * na base do cliente, ou gravar com a conta de alguém. O banco falso é o mesmo
 * do `testes/roteiro.mjs`, com um detalhe que o teste não precisa e o vídeo
 * precisa: os dados aqui contam uma HISTÓRIA — uma regressão de agosto com
 * quarenta casos, doze concluídos, e o caso 13 que a pessoa vai executar na
 * frente de quem assiste.
 *
 * Se a tela mudar de forma incompatível, este roteiro quebra na hora de gravar.
 * É o mesmo contrato dos outros dois: um vídeo de produto feito à mão envelhece
 * em silêncio; um gerado quebra alto.
 *
 *   node estudio/gravar-roteiro.mjs pt
 *   bash estudio/montar-roteiro.sh pt
 */
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';

import { RAIZ_WS, CHROME_WS } from '../testes/_caminhos.mjs';

const LANG = process.argv[2] || 'pt';
const PORTA_NEXT = 8886;
const PORTA_BANCO = 8887;
const BASE = `http://localhost:${PORTA_NEXT}`;
const SAIDA = `/tmp/roteiro-${LANG}`;
const QUEM = 'coordenacao@exemplo.test';

/* ------------------------------------------------------ o roteiro da história
   Quarenta casos, doze concluídos. Os números não são enfeite: uma rodada de
   três casos não parece trabalho, e a diferença que o plano vende só aparece
   quando a lista é grande o bastante para ninguém querer montá-la à mão. */
/* O endereço da tela em cada idioma sai do `rotas.json`, e NÃO de uma lista
   escrita aqui. A primeira versão deste arquivo tinha a lista à mão, e ela
   estava errada em duas línguas: `/de/konto/faelle` e `/fr/compte/cas`, quando
   o que existe é `testfaelle` e `cas-de-test`. Alemão e francês não gravaram, e
   o erro apareceu como "não achei o link da rodada" — a mesma armadilha que
   este projeto já documentou duas vezes, e que já apagou o hreflang de dois
   idiomas. Lista escrita à mão ao lado de uma fonte que existe é sempre a
   segunda lista. */
const ROTAS = JSON.parse(fs.readFileSync(`${RAIZ_WS}/src/rotas.json`, 'utf8'));
const CAMINHO = Object.fromEntries(ROTAS.idiomas.map((L) =>
  [L, `${ROTAS.caminhoConta[L]}/${ROTAS.subConta.roteiro[L]}`]));
const SISTEMAS = ['Portal de Compras', 'Portal de Compras', 'Aprovações', 'Cadastro'];
const TITULOS = {
  pt: ['Abrir um pedido de compra', 'Anexar a cotação', 'Enviar para aprovação',
       'Recusar por valor acima do limite', 'Corrigir e reenviar', 'Aprovar em segundo nível',
       'Consultar o protocolo', 'Cancelar um pedido', 'Reabrir um pedido cancelado',
       'Exportar o relatório do mês'],
  en: ['Open a purchase request', 'Attach the quote', 'Send for approval',
       'Reject for exceeding the limit', 'Fix and resubmit', 'Approve at second level',
       'Look up the reference number', 'Cancel a request', 'Reopen a cancelled request',
       'Export the monthly report'],
  es: ['Abrir un pedido de compra', 'Adjuntar la cotización', 'Enviar a aprobación',
       'Rechazar por importe sobre el límite', 'Corregir y reenviar', 'Aprobar en segundo nivel',
       'Consultar el número de protocolo', 'Cancelar un pedido', 'Reabrir un pedido cancelado',
       'Exportar el informe del mes'],
  de: ['Eine Bestellanforderung anlegen', 'Das Angebot anhängen', 'Zur Freigabe senden',
       'Wegen Betragsüberschreitung ablehnen', 'Korrigieren und erneut senden',
       'Auf zweiter Stufe freigeben', 'Die Vorgangsnummer nachschlagen', 'Eine Anforderung stornieren',
       'Eine stornierte Anforderung wieder öffnen', 'Den Monatsbericht exportieren'],
  fr: ['Ouvrir une demande d’achat', 'Joindre le devis', 'Envoyer en validation',
       'Refuser pour montant au-dessus du seuil', 'Corriger et renvoyer', 'Valider au second niveau',
       'Consulter le numéro de dossier', 'Annuler une demande', 'Rouvrir une demande annulée',
       'Exporter le rapport du mois'],
};
const NOMES = ['ana@exemplo.test', 'bruno@exemplo.test', 'carla@exemplo.test', 'diego@exemplo.test'];

/* O caso 13 é o que a câmera acompanha: o primeiro pendente, atribuído a quem
   está com a tela aberta. Ele fica no alto da parte de baixo da tabela — nem a
   primeira linha (que parece escolhida a dedo) nem perdido no fim. */
const EXECUTADO = 13;

const CASOS = Array.from({ length: 40 }, (_, i) => {
  const n = i + 1;
  const feito = n < EXECUTADO;
  const titulos = TITULOS[LANG] || TITULOS.pt;
  return {
    id: 1000 + n, ordem: n,
    caso: 'CT-' + String(n).padStart(2, '0'),
    titulo: titulos[i % titulos.length],
    cenario: null,
    sistema: SISTEMAS[i % SISTEMAS.length],
    chamado: 'REQ-' + (4100 + n),
    responsavel: n === EXECUTADO ? QUEM : NOMES[i % NOMES.length],
    feito_em: feito ? `2026-08-${String(10 + (n % 8)).padStart(2, '0')}T13:${String(10 + n).padStart(2, '0')}:00Z` : null,
    feito_por: feito ? NOMES[i % NOMES.length] : null,
    arquivo: feito ? `CT-${String(n).padStart(2, '0')}.pdf` : null,
    impressao: feito ? 'e3b0c44298fc1c14'.slice(0, 16) : null,
    observacao: null, recibo: null, anexo: null,
  };
});

const NOME_RODADA = { pt: 'Regressão de agosto', en: 'August regression',
  es: 'Regresión de agosto', de: 'Regression im August', fr: 'Régression d’août' }[LANG];

const ROTEIRO = {
  id: 7, nome: NOME_RODADA, escopo: 'time', dono: QUEM,
  criado_em: '2026-08-18T09:00:00Z', meu: true, casos: CASOS,
};

const CONTA = {
  email: QUEM, plano: 'time', assentos: 5, dias: 90, cliente: 'Cliente de Exemplo',
  motivo: 'conta', papel: 'admin', vence_em: null, emissoes: 0, assinante: true,
  perfil: { cliente: null, config: null, modelos: [] },
  faturas: [], chamados: [], resposta: null,
  time: { cliente: 'Cliente de Exemplo', assentos: 5, usados: 5, dias: 90, dominios: [],
          pessoas: [{ email: QUEM, papel: 'admin', ativo: true, admin: true, ultima_em: null, vence_em: null }]
            .concat(NOMES.map((e) => ({ email: e, papel: 'membro', ativo: true, admin: false,
                                        ultima_em: null, vence_em: null }))) },
};

/* --------------------------------------------------------- o banco de mentira */
const banco = http.createServer((q, r) => {
  const ps = [];
  q.on('data', (d) => ps.push(d));
  q.on('end', () => {
    const corpo = Buffer.concat(ps).toString('utf8');
    const responde = (o) => { r.writeHead(200, { 'Content-Type': 'application/json' }); r.end(JSON.stringify(o)); };
    if (q.url.startsWith('/auth/v1/user')) {
      return responde({ id: 'uuid-do-video', aud: 'authenticated', email: QUEM,
                        app_metadata: {}, user_metadata: {} });
    }
    const fn = q.url.replace('/rest/v1/rpc/', '');
    const args = JSON.parse(corpo || '{}');
    if (fn === 'walkstamp_conta_do_usuario') return responde(CONTA);
    if (fn === 'walkstamp_roteiro_meus') {
      const feitos = ROTEIRO.casos.filter((c) => c.feito_em).length;
      return responde({ email: args.p_email, roteiros: [
        { id: 7, nome: ROTEIRO.nome, escopo: 'time', dono: ROTEIRO.dono,
          criado_em: ROTEIRO.criado_em, meu: true, total: ROTEIRO.casos.length,
          feitos, meus: ROTEIRO.casos.filter((c) => c.responsavel === QUEM && !c.feito_em).length },
      ] });
    }
    if (fn === 'walkstamp_roteiro_ver') return responde(ROTEIRO);
    /* A VOLTA. É o quadro que fecha o vídeo: o caso que a câmera acabou de ver
       ser executado muda de situação aqui, com data, executor e impressão. */
    if (fn === 'walkstamp_roteiro_feito') {
      /* `p_caso_id`, e não `p_caso`: o nome saiu do `roteiro-acoes.ts`, que é
         quem monta a chamada. Errar aqui não dá erro — a linha simplesmente
         não muda, e o vídeo termina com o caso ainda em aberto. */
      const c = ROTEIRO.casos.find((x) => x.id === Number(args.p_caso_id));
      if (c) {
        c.feito_em = new Date().toISOString();
        c.feito_por = QUEM;
        c.arquivo = args.p_arquivo || `${c.caso}.pdf`;
        c.impressao = args.p_impressao || null;
        c.observacao = args.p_observacao || null;
      }
      return responde({ ...ROTEIRO, id: 7 });
    }
    if (fn === 'walkstamp_roteiro_salvar' || fn === 'walkstamp_roteiro_atribuir') return responde(ROTEIRO);
    responde({});
  });
});
await new Promise((r) => banco.listen(PORTA_BANCO, r));

/* ------------------------------------------------------------------- o Next */
const next = spawn('npx', ['next', 'start', '-p', String(PORTA_NEXT)], {
  cwd: RAIZ_WS,
  env: { ...process.env,
    SUPABASE_URL: `http://localhost:${PORTA_BANCO}`,
    SUPABASE_SERVICE_ROLE_KEY: 'chave_de_mentira',
    WALKSTAMP_SUPA_TESTE: `http://localhost:${PORTA_BANCO}` },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logNext = '';
next.stdout.on('data', (d) => { logNext += d; });
next.stderr.on('data', (d) => { logNext += d; });
const morrer = () => { try { next.kill('SIGKILL'); } catch {} try { banco.close(); } catch {} };
process.on('exit', morrer);

let noAr = false;
for (let i = 0; i < 80; i++) {
  try { const r = await fetch(`${BASE}/conta`); if (r.status < 500) { noAr = true; break; } } catch {}
  await new Promise((r) => setTimeout(r, 500));
}
if (!noAr) { console.log(logNext); throw new Error('o Next não subiu'); }

/* -------------------------------------------------------------- a filmagem */
fs.rmSync(SAIDA, { recursive: true, force: true });
const br = await chromium.launch({
  executablePath: CHROME_WS,
  args: ['--autoplay-policy=no-user-gesture-required', '--force-prefers-reduced-motion=false'],
});

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (email) => [b64({ alg: 'HS256', typ: 'JWT' }),
  b64({ role: 'authenticated', email, exp: Math.floor(Date.now() / 1000) + 3600 }), 'x'].join('.');

const ctx = await br.newContext({
  viewport: { width: 1000, height: 700 },
  recordVideo: { dir: SAIDA, size: { width: 1000, height: 700 } },
  colorScheme: 'light', acceptDownloads: true,
});
await ctx.addCookies([{
  name: 'sb-localhost-auth-token',
  value: 'base64-' + Buffer.from(JSON.stringify({
    access_token: jwt(QUEM), token_type: 'bearer', expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r',
    user: { id: 'uuid-do-video', email: QUEM },
  })).toString('base64'),
  domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax',
}]);

const pg = await ctx.newPage();
pg.on('pageerror', (e) => console.log('ERRO:', e.message));

/* O `app.html` publicado busca o jspdf num CDN. Aqui ele vem do `vendor/`:
   sem isso o vídeo termina antes do PDF, que é justamente o quadro que prova
   que a evidência saiu. */
const jspdf = fs.readFileSync(`${RAIZ_WS}/vendor/jspdf.umd.min.js`, 'utf8');
await pg.route('**/jspdf**', (r) => r.fulfill({ status: 200,
  headers: { 'content-type': 'text/javascript', 'access-control-allow-origin': '*' },
  body: jspdf }));

const T0 = Date.now();
const marca = {};
const reg = (n) => { marca[n] = (Date.now() - T0) / 1000; };

/* O cursor sintético — o Playwright não filma o ponteiro do sistema, e um
   vídeo em que as coisas acontecem sozinhas parece defeito de gravação. */
const cursor = async () => pg.evaluate(() => {
  if (document.getElementById('__cur')) return;
  const c = document.createElement('div');
  c.id = '__cur';
  c.style.cssText = 'position:fixed;left:0;top:0;width:19px;height:19px;border-radius:50%;'
    + 'background:rgba(58,63,158,.28);border:2px solid rgba(58,63,158,.85);z-index:99999;'
    + 'pointer-events:none;transform:translate(-50%,-50%);transition:left .55s cubic-bezier(.4,0,.2,1),'
    + 'top .55s cubic-bezier(.4,0,.2,1),transform .16s;opacity:0';
  document.body.appendChild(c);
  window.__mover = (sel) => {
    const el = document.querySelector(sel); if (!el) return;
    const r = el.getBoundingClientRect();
    c.style.opacity = '1';
    c.style.left = (r.left + r.width / 2) + 'px';
    c.style.top = (r.top + r.height / 2) + 'px';
  };
  window.__pulsar = () => {
    c.style.transform = 'translate(-50%,-50%) scale(.62)';
    setTimeout(() => { c.style.transform = 'translate(-50%,-50%) scale(1)'; }, 170);
  };
});
const apontar = async (sel) => { await pg.evaluate((s) => window.__mover(s), sel); await pg.waitForTimeout(650); };
const clicar = async (sel) => { await apontar(sel); await pg.evaluate(() => window.__pulsar());
                                await pg.waitForTimeout(180); await pg.click(sel); };
const aoCentro = async (sel) => {
  await pg.evaluate((s) => { const e = document.querySelector(s);
    if (e) e.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, sel);
  await pg.waitForTimeout(800);
};

console.log(`[${LANG}] filmando…`);

/* 1 — a lista de rodadas: quantos casos, quantos concluídos */
await pg.goto(BASE + CAMINHO[LANG]);
await pg.waitForLoadState('networkidle');
await cursor();
await pg.waitForTimeout(1600);

/* 2 — abrir a rodada */
await clicar(`a[href*="id=7"]`);
await pg.waitForLoadState('networkidle');
await cursor();
await pg.waitForTimeout(1500);
reg('tabela');

/* 3 — a tabela: quem é o responsável de cada caso, o que já está feito */
await aoCentro('table.legal tbody tr:nth-child(6)');
await pg.waitForTimeout(1400);

/* 4 — o caso que vamos executar. A tabela rola na horizontal: a coluna de
   ações — onde mora o link que abre a ferramenta — fica fora da tela na
   largura do vídeo, e é ela que precisa ser vista. */
const linha = `table.legal tbody tr:nth-child(${EXECUTADO})`;
await aoCentro(linha);
await pg.waitForTimeout(900);
await pg.evaluate(() => {
  const cx = document.querySelector('table.legal').parentElement;
  cx.scrollTo({ left: cx.scrollWidth, behavior: 'smooth' });
});
await pg.waitForTimeout(1100);
await apontar(`${linha} a[href*="/app?"]`);
await pg.waitForTimeout(1300);
reg('abriuCaso');

/* 5 — a ferramenta abre COM O CASO DENTRO. É a peça central do desenho: quem
   executa não digita caso, sistema nem chamado — eles chegam pelo endereço. */
const href = await pg.getAttribute(`${linha} a[href*="/app?"]`, 'href');
await pg.goto(BASE + href);
await pg.waitForLoadState('domcontentloaded');
await pg.waitForTimeout(1500);
await cursor();
await pg.evaluate(() => window.scrollTo({ top: 0 }));
await pg.waitForTimeout(1300);

/* 6 — a faixa que diz de onde a pessoa veio. Ela é o contrato entre as duas
   telas, e é o que faz a rodada existir para quem executa. */
await aoCentro('#rotVindo');
await pg.waitForTimeout(1500);

/* 7 — executar: o vídeo de exemplo, a extração e o documento. É de propósito
   que esta parte é curta — o tour já mostra a ferramenta inteira. Aqui ela é
   um meio, e o assunto é a rodada. */
await clicar('#demo');
await pg.waitForSelector('#playerBox:not(.hide)', { timeout: 40000 });
await pg.waitForTimeout(1400);
reg('scanIni');
await clicar('#extract');
await pg.waitForFunction(() => document.querySelectorAll('#thumbs figure').length > 0,
                         null, { timeout: 120000 });
reg('scanFim');
await pg.waitForTimeout(1600);

/* 8 — gerar o documento, pelo botão que a ferramenta RECOMENDA — que é o que
   uma pessoa clica. O catálogo dos onze formatos mora atrás de `#recTodos`, e
   abri-lo aqui seria mostrar uma decisão que o produto tirou do caminho. É o
   arquivo que sai daqui cujo nome e impressão digital vão para a planilha. */
await aoCentro('#recPrim');
await pg.waitForTimeout(900);
await clicar('#recPrim');
await pg.waitForSelector('#rotVolta:not(.hide)', { timeout: 90000 });
await pg.waitForTimeout(1500);

/* 9 — o botão da volta. Ele só existe depois de o documento sair: marcar como
   feito sem ter gerado nada seria uma rodada que se fecha sozinha. */
await aoCentro('#rotVolta');
await pg.waitForTimeout(1400);
await apontar('#rotVolta a');
await pg.waitForTimeout(900);
reg('voltou');

/* O botão aponta para o site publicado e abre em aba nova — as duas coisas
   certas no produto e erradas aqui. O caminho e a consulta são o que importa;
   a origem vira a deste ensaio, e a navegação acontece na mesma aba para a
   câmera não perder o corte. */
const volta = await pg.getAttribute('#rotVolta a', 'href');
const alvo = volta.replace(/^https?:\/\/[^/]+/, '');
await pg.evaluate(() => window.__pulsar());
await pg.waitForTimeout(260);
await pg.goto(BASE + alvo);
await pg.waitForLoadState('networkidle');
await pg.waitForTimeout(1200);
await cursor();

/* 10 — o recibo, e a confirmação. Marcar como feito é um POST com um botão,
   e não um endereço que grava sozinho: link que grava é link que o histórico
   do navegador reexecuta. O quadro mostra o que vai junto — quantos quadros,
   a impressão do conjunto, a impressão de cada tela — antes de a pessoa
   confirmar. Nenhuma imagem viaja. */
await pg.waitForTimeout(2600);
await apontar('form button[type="submit"]');
await pg.waitForTimeout(900);
await pg.evaluate(() => window.__pulsar());
await pg.waitForTimeout(240);
await pg.click('form button[type="submit"]');
await pg.waitForLoadState('networkidle');
await pg.waitForTimeout(1400);
await cursor();

/* 11 — e a mesma tabela, com o caso fechado: data, quem executou, o arquivo e
   a impressão digital. A planilha sai daqui pelo botão de baixo. */
await aoCentro(linha);
await pg.waitForTimeout(2800);
await aoCentro('a[href*="/conta/planilha"]');
await apontar('a[href*="/conta/planilha"]');
await pg.waitForTimeout(1800);
reg('fim');

fs.writeFileSync(`/tmp/roteiro-marcas-${LANG}.json`, JSON.stringify(marca, null, 1));
await ctx.close();
await br.close();

const bruto = fs.readdirSync(SAIDA).find((f) => f.endsWith('.webm'));
fs.copyFileSync(`${SAIDA}/${bruto}`, `/tmp/roteiro-bruto-${LANG}.webm`);
console.log(`[${LANG}] /tmp/roteiro-bruto-${LANG}.webm`, JSON.stringify(marca));
morrer();
process.exit(0);

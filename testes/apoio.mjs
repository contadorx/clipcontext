/* O RECURSO DIZ O QUE ELE É ANTES DE SER TENTADO.
 *
 * Medido antes do conserto, com `MediaRecorder` ausente do navegador: a caixa
 * "Guardar um clipe dos momentos marcados" ficava VISÍVEL E LIGADA. A pessoa
 * marcava, gravava a reunião inteira, e só ao fim recebia "este navegador não
 * grava clipe" — depois de a gravação ter acontecido sem o que ela pediu. O
 * mesmo com a webcam quando o navegador não expõe `getUserMedia`.
 *
 * O `usar a placa de vídeo` já fazia certo — mas ESCONDENDO o controle. Para
 * estes dois esconder seria pior: quem veio procurar o clipe e não acha nada
 * conclui "isto não existe no produto", e não "o meu navegador não faz". Então
 * o controle fica, desligado, com o motivo do lado.
 *
 *   desligado e dito  = informação
 *   ausente           = mistério
 *   ligado            = promessa falsa
 *
 * O QUE ESTA RÉGUA TAMBÉM COBRA, e é metade dela: que o produto NÃO desligue o
 * que funciona. Uma régua que só verifica o desligamento passaria com tudo
 * desligado sempre, que é o defeito oposto e pior.
 *
 *   node testes/apoio.mjs
 */
import { chromium } from './_navegador.mjs';
import http from 'http';
import fs from 'fs';

import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';

const ROOT = `${RAIZ_WS}/public`;
const html = fs.readFileSync(ROOT + '/app.html', 'utf8');
const srv = http.createServer((q, r) => {
  const u = q.url.split('?')[0];
  if (u.startsWith('/_vercel/')) { r.writeHead(200, { 'Content-Type': 'text/javascript' }); return r.end(''); }
  if (u === '/sw.js') { r.writeHead(200, { 'Content-Type': 'text/javascript' }); return r.end(''); }
  r.writeHead(200, { 'Content-Type': 'text/html' }); r.end(html);
});
await new Promise((r) => srv.listen(8976, r));

let falhas = 0;
const ok = (n, c, e) => {
  console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : ''));
  if (!c) falhas++;
};

const br = await chromium.launch({ executablePath: CHROME_WS });

/** Abre a ferramenta com uma capacidade removida e lê o estado dos controles.
 *  Os dois moram dentro do diálogo do clipe, então ele é aberto antes. */
async function comNavegador(desligar) {
  const ctx = await br.newContext({ viewport: { width: 1250, height: 950 } });
  const pg = await ctx.newPage();
  if (desligar) await pg.addInitScript(desligar);
  await pg.goto('http://localhost:8976/app.html?lang=pt');
  await pg.waitForTimeout(600);
  await pg.evaluate(() => { const b = document.getElementById('clipeAbrir'); if (b) b.click(); });
  await pg.waitForTimeout(350);
  const r = await pg.evaluate(() => {
    const ver = (id) => {
      const e = document.getElementById(id);
      if (!e) return null;
      const rot = e.closest('label');
      const aviso = document.getElementById(id + 'Aviso');
      return {
        visivel: e.offsetParent !== null,
        desligado: !!e.disabled,
        marcado: !!e.checked,
        motivo: (rot && rot.getAttribute('title')) || '',
        /* O nome acessível carrega o motivo junto: quem usa leitor de tela
           ouve "…— este navegador não grava clipe" no mesmo fôlego. */
        nomeAcessivel: (rot && rot.getAttribute('aria-label')) || '',
        avisoVisivel: !!aviso && !aviso.classList.contains('hide'),
        avisoTexto: aviso ? (aviso.textContent || '').trim() : '',
      };
    };
    return { clipe: ver('recClipe'), cam: ver('recCam'),
             gpu: (() => { const g = document.getElementById('gpu');
                           return g ? { visivel: g.offsetParent !== null } : null; })() };
  });
  await ctx.close();
  return r;
}

console.log('[1] com tudo disponível, nada é desligado');
{
  /* METADE DA RÉGUA. Sem este bloco, desligar tudo sempre passaria — e seria
     um defeito pior do que o que este build veio consertar. */
  const r = await comNavegador(null);
  ok('a caixa do clipe está viva', r.clipe.visivel && !r.clipe.desligado,
     JSON.stringify(r.clipe));
  ok('a caixa da webcam está viva', r.cam.visivel && !r.cam.desligado,
     JSON.stringify(r.cam));
  ok('e nenhuma delas mostra motivo', !r.clipe.motivo && !r.cam.motivo,
     r.clipe.motivo || r.cam.motivo);
  ok('nem aviso', !r.clipe.avisoVisivel && !r.cam.avisoVisivel);
}

console.log('\n[2] sem MediaRecorder: o clipe fica, desligado, e diz por quê');
{
  const r = await comNavegador(() => { delete window.MediaRecorder; });
  ok('a caixa CONTINUA na tela', r.clipe.visivel === true, JSON.stringify(r.clipe));
  ok('mas desligada', r.clipe.desligado === true);
  ok('e desmarcada — marcada e desligada é promessa presa', r.clipe.marcado === false);
  ok('com o motivo no rótulo', /não grava clipe/i.test(r.clipe.motivo), r.clipe.motivo);
  ok('e o motivo no nome acessível, junto do nome do controle',
     /clipe/i.test(r.clipe.nomeAcessivel) && /não grava/i.test(r.clipe.nomeAcessivel),
     r.clipe.nomeAcessivel);
  ok('e o aviso visível ao lado', r.clipe.avisoVisivel === true, r.clipe.avisoTexto);
  /* O QUE NÃO PODE ACONTECER: um recurso ausente desligar o vizinho. */
  ok('a webcam não foi arrastada junto', r.cam.desligado === false,
     JSON.stringify(r.cam));
}

console.log('\n[3] sem getUserMedia: a webcam fica, desligada, e diz por quê');
{
  const r = await comNavegador(() => {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia',
                          { get: () => undefined, configurable: true });
  });
  ok('a caixa CONTINUA na tela', r.cam.visivel === true, JSON.stringify(r.cam));
  ok('mas desligada', r.cam.desligado === true);
  ok('com o motivo no rótulo', /não abre webcam/i.test(r.cam.motivo), r.cam.motivo);
  ok('e o clipe não foi arrastado junto', r.clipe.desligado === false,
     JSON.stringify(r.clipe));
}

console.log('\n[4] permissão negada continua sendo descoberta no uso');
{
  /* E ESTÁ CERTO ASSIM. Não há como saber se alguém vai negar a permissão sem
     PEDIR a permissão — e pedir a câmera no carregamento da página, só para
     saber, é exatamente o que nenhum produto deveria fazer. O que dá para
     saber antes é se o navegador tem a porta; se ela abre é outra pergunta, e
     o `recCamNao` já responde a essa, na hora. */
  const r = await comNavegador(() => {
    navigator.mediaDevices.getUserMedia = async () => { throw new Error('NotAllowedError'); };
  });
  ok('a caixa da webcam continua oferecida', r.cam.desligado === false,
     JSON.stringify(r.cam));
  const fonte = fs.readFileSync(ROOT + '/app.html', 'utf8');
  ok('e o aviso de recusa existe para a hora do uso',
     /recCamNao:/.test(fonte) && /camAviso = t\('recCamNao'\)/.test(fonte));
}

console.log('\n[5] o WebGPU continua sumindo — e é a exceção, não a regra');
{
  /* Ele some porque ninguém procura por ele: é um ajuste de motor, não um
     recurso que a pessoa veio buscar. Clipe e webcam ela veio buscar. A
     diferença é deliberada, e esta régua existe para que ela continue sendo
     deliberada em vez de virar inconsistência. */
  const r = await comNavegador(() => {
    Object.defineProperty(navigator, 'gpu', { get: () => undefined, configurable: true });
  });
  ok('sem WebGPU, o ajuste da placa some', r.gpu && r.gpu.visivel === false,
     JSON.stringify(r.gpu));
  const cheio = await comNavegador(null);
  ok('e com WebGPU ele aparece', cheio.gpu && cheio.gpu.visivel === true,
     JSON.stringify(cheio.gpu));
}

console.log('\n[6] as duas frases existem nos cinco idiomas');
{
  const fonte = fs.readFileSync(ROOT + '/app.html', 'utf8');
  for (const chave of ['recCamSemApoio', 'recClipeSemApoio']) {
    const n = (fonte.match(new RegExp(chave + ':', 'g')) || []).length;
    ok(`${chave} nos cinco`, n === 5, String(n));
  }
  /* Uma frase de "não dá" que não diz que o resto continua funcionando manda a
     pessoa embora achando que a ferramenta inteira não serve. */
  ok('e as duas dizem que o resto funciona',
     (fonte.match(/SemApoio:'[^']*(funciona normalmente|works normally|funciona normalmente|funktioniert normal|fonctionne normalement)/g) || []).length >= 8,
     String((fonte.match(/SemApoio:'[^']*(funciona|works|funktioniert|fonctionne)/g) || []).length));
}

await br.close();
srv.close();
console.log(falhas ? `\n${falhas} FALHA(S)`
                   : '\nApoio do navegador: dito antes, e sem desligar o que funciona.');
process.exit(falhas ? 1 : 0);

/* APONTAR NA TELA DURANTE A GRAVAÇÃO — e o que isso custa à evidência.
 *
 * O pedido veio do campo, de muita gente: "queria abrir determinada tela e já
 * fazer a marcação — setas, um retângulo — para não esquecer". Marcar depois já
 * existia, na lente. Marcar AGORA não.
 *
 * O que esta régua cobra não é que o botão exista. É o que ele não pode
 * quebrar:
 *
 *   1. o botão está na fita, e não é um segundo botão com o rótulo de outro —
 *      em alemão o rótulo curto de MARCAR já é "Markieren", e "Markieren" duas
 *      vezes lado a lado é um defeito que só aparece num idioma;
 *   2. apertar CAPTURA a tela e abre a figura dela — e é a tela nova que abre,
 *      e não a anterior;
 *   3. o arrasto escreve no quadro CERTO, medido em `window.__quadros()` e não
 *      no que o código diz que fez;
 *   4. A CAPTURA PARA enquanto se aponta. Este editor é uma janela por cima da
 *      tela compartilhada, e o padrão desta ferramenta é gravar o monitor
 *      inteiro: sem a pausa, os próximos quadros sairiam com a nossa ferramenta
 *      desenhada em cima do sistema do cliente. É a afirmação mais importante
 *      daqui;
 *   5. e ela VOLTA ao salvar — um editor que deixasse a gravação pausada em
 *      silêncio seria a pior forma de perder uma sessão;
 *   6. quem já estava pausado continua pausado depois: o alternador chamado nos
 *      dois cantos despausaria quem pausou de propósito;
 *   7. a marca vai para o ESPELHO em disco. A imagem sobrevive a uma queda do
 *      navegador desde sempre; a seta feita ao vivo passou a sobreviver também,
 *      e é lida do `indice.jsonl` de fora da ferramenta;
 *   8. e há UM gesto de marcação, não dois: a mesma marca desenhada ao vivo é a
 *      que a lente mostra depois, com a mesma forma e a mesma cor.
 *
 *   node testes/edicaoaovivo.mjs
 */
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
import { CHROME_WS } from './_caminhos.mjs';
import { garantirPortaLivre } from './_porta.mjs';

const PORTA = 8874;
const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'public');
const app = fs.readFileSync(RAIZ + '/app.html', 'utf8');

let falhas = 0;
const ok = (n, c, e) => { console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : '')); if (!c) falhas++; };

await garantirPortaLivre(PORTA, 'edicaoaovivo.mjs');
const srv = http.createServer((q, r) => {
  const u = q.url.split('?')[0];
  if (u.startsWith('/_vercel/')) { r.writeHead(200, {'Content-Type':'text/javascript'}); return r.end(''); }
  if (u === '/sw.js') { r.writeHead(200, {'Content-Type':'text/javascript'}); return r.end(''); }
  r.writeHead(200, { 'Content-Type':'text/html' }); r.end(app);
});
await new Promise(r => srv.listen(PORTA, r));

/* ---------------------------------------------------------------- [1] ----
   O que se pode afirmar sem abrir navegador: os rótulos das cinco línguas, e
   que nenhum deles é o rótulo de outro botão da mesma fita. */
console.log('\n[1] o botão existe nas cinco línguas, e não repete o rótulo de outro');
{
  const curtos = [...app.matchAll(/pipCurtoAnotar:'([^']*)'/g)].map(m => m[1]);
  ok('as cinco línguas têm o rótulo curto', curtos.length === 5, `achei ${curtos.length}`);
  const longos = [...app.matchAll(/pipAnotar:'([^']*)'/g)].map(m => m[1]);
  ok('e as cinco têm o rótulo inteiro', longos.length === 5, `achei ${longos.length}`);
  /* A colisão é POR IDIOMA: os rótulos curtos saem na mesma ordem em que os
     idiomas aparecem no arquivo, então a comparação é posição a posição. */
  const marcar = [...app.matchAll(/pipCurtoMarcar:'([^']*)'/g)].map(m => m[1]);
  const tela   = [...app.matchAll(/pipCurtoTela:'([^']*)'/g)].map(m => m[1]);
  const erro   = [...app.matchAll(/pipCurtoErro:'([^']*)'/g)].map(m => m[1]);
  const parar  = [...app.matchAll(/pipCurtoParar:'([^']*)'/g)].map(m => m[1]);
  let colisao = '';
  curtos.forEach((c, i) => {
    const vizinhos = [marcar[i], tela[i], erro[i], parar[i]];
    if (vizinhos.some(v => v && v.toLowerCase() === c.toLowerCase())) {
      colisao += `${c} (idioma ${i + 1}) `;
    }
  });
  ok('e nenhum é igual ao de marcar, tela, erro ou parar', !colisao, colisao);
  console.log('     ' + curtos.join(' · '));
}

/* ---- O NAVEGADOR DE TESTE NÃO TEM `documentPictureInPicture` ----
 *
 * Então ele é montado aqui — e montado de forma que o produto não perceba: o
 * pedido devolve uma janela DE VERDADE (a de um iframe), com documento próprio,
 * `close()` que dispara `pagehide` como a de verdade dispara, e `resizeTo` que
 * muda o tamanho. É a única forma de o arrasto ser um arrasto de mouse sobre a
 * figura, e não um evento fabricado que prova só que o `addEventListener`
 * existe.
 *
 * O tamanho PEDIDO fica guardado em `__pedido`: é ele que diz se a janela de
 * edição foi pedida maior que a fita, que é metade do recurso. */
const shimPip = () => {
  window.__pipPedidos = [];
  const dpip = {
    requestWindow: async ({ width, height }) => {
      const velho = document.getElementById('pipFake');
      if (velho) velho.remove();
      const fr = document.createElement('iframe');
      fr.id = 'pipFake';
      fr.style.cssText = 'position:fixed;right:0;bottom:0;z-index:2147483647;border:0;background:#0b0d11';
      fr.style.width = width + 'px'; fr.style.height = height + 'px';
      document.documentElement.appendChild(fr);
      const w = fr.contentWindow;
      w.document.open();
      w.document.write('<!doctype html><html><head></head><body></body></html>');
      w.document.close();
      window.__pipPedidos.push({ width, height });
      w.close = () => {
        try { w.dispatchEvent(new Event('pagehide')); } catch (e) {}
        fr.remove();
      };
      w.resizeTo = (a, b) => { fr.style.width = a + 'px'; fr.style.height = b + 'px'; };
      return w;
    },
  };
  Object.defineProperty(window, 'documentPictureInPicture', { value: dpip, configurable: true });
};

/* A TELA FALSA MUDA E DEPOIS FICA PARADA, e isso não é detalhe: o modelo de
   evidência guarda um quadro quando a tela MUDA e volta a parar (`parar: 1`),
   com piso de 1,5s entre quadros. Uma tela que pisca sem parar não produz
   quadro nenhum antes dos 10s da válvula — foi o que a primeira versão desta
   régua fez, e a linha de base saiu zero. Aí "não entrou quadro com o editor
   aberto" era verdade e não provava nada. */
const telaFalsa = () => {
  const c = document.createElement('canvas');
  c.width = 1280; c.height = 720;
  const g = c.getContext('2d'); let i = 0;
  setInterval(() => { i++;
    g.fillStyle = `hsl(${(i * 47) % 360} 70% ${28 + (i % 40)}%)`;
    g.fillRect(0, 0, 1280, 720);
    g.fillStyle = '#fff'; g.font = '140px sans-serif'; g.fillText(String(i), 60, 300);
  }, 2200);
  navigator.mediaDevices.getDisplayMedia = async () => c.captureStream(12);
  navigator.mediaDevices.getUserMedia = async () => { throw new Error('sem mic'); };
};

const br = await chromium.launch({ executablePath: CHROME_WS,
  args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await br.newContext({ viewport: { width: 1280, height: 1000 } });
/* OS REMENDOS VÃO NO CONTEXTO, e não na primeira página: o bloco [9] abre uma
   SEGUNDA página, e ela precisa da mesma tela falsa e da mesma janelinha. Presos
   à primeira, a segunda subia sem tela para gravar e o teste morria com um
   tempo esgotado que não dizia nada sobre o produto. */
await ctx.route('**/rpc/*stamp_*', r => r.fulfill({ status: 200, headers: {'access-control-allow-origin':'*'}, body: 'null' }));
await ctx.addInitScript(shimPip);
await ctx.addInitScript(telaFalsa);
const pg = await ctx.newPage();
const erros = []; pg.on('pageerror', e => erros.push(e.message));
pg.on('dialog', d => d.accept());
/* A FITA, E NÃO A JANELA COMPLETA. É na fita que o rótulo curto aparece e é
   nela que a largura é apertada — e ela é o modo que este recurso tem de
   caber. Sem esta linha o teste rodava na janela completa e aprovava um rótulo
   que a fita nunca mostra. */
await pg.addInitScript(() => {
  try { localStorage.setItem('Walkstamp.janelinhaModo', 'min'); } catch (e) {}
});
await pg.goto(`http://localhost:${PORTA}/app.html?lang=pt`);
await pg.selectOption('#modelo', 'evidencia').catch(() => {});
await pg.locator('#semTr').check();
await pg.evaluate(() => window.__contagem(1));
await pg.locator('#rec').click();
await pg.waitForSelector('#recStop:visible', { timeout: 40000 });
await pg.waitForTimeout(1500);

const fita = () => pg.frameLocator('#pipFake');
/* A janela de medida: dois ciclos da tela falsa e uma folga. Menos que isso e a
   linha de base fica na sorte do relógio. */
const JANELA = 7000;
let BASE = 0;
const quantos = () => pg.evaluate(() => (window.__quadros() || []).length);
const marcasDe = (i) => pg.evaluate((n) => {
  const f = (window.__quadros() || [])[n];
  return f ? (f.marcas || []).map(m => ({ tipo: m.tipo, cor: m.cor })) : null;
}, i);
/* `ghost` no botão de pausa quer dizer NÃO PAUSADO — é o estado apagado de um
   botão de duas posições. A primeira versão desta linha leu ao contrário e
   passou a dizer "pausado" exatamente quando não estava; o que a desmentiu foi
   a contagem de quadros ao lado, que dizia o oposto. Um detalhe que contradiz
   o `ok` do lado é o defeito que esta casa já pagou várias vezes. */
const pausado = () => pg.evaluate(() =>
  !(document.getElementById('recPause') || { classList: { contains: () => false } })
     .classList.contains('ghost'));
const ganhouEm = async (ms) => { const a = await quantos();
  await pg.waitForTimeout(ms); return (await quantos()) - a; };

/* A LINHA DE BASE, medida com a gravação correndo e nada aberto: é contra ela
   que o "parou" do bloco [4] vale alguma coisa. */
BASE = await (async () => { const a = await pg.evaluate(() => (window.__quadros()||[]).length);
  await pg.waitForTimeout(JANELA);
  return (await pg.evaluate(() => (window.__quadros()||[]).length)) - a; })();

/* ---------------------------------------------------------------- [2] ---- */
console.log('\n[2] o botão está na fita, e apertar captura a tela e abre a figura dela');
let iEditado = -1;
{
  const bt = fita().locator('#anotar');
  ok('a fita tem o botão de apontar', await bt.count() === 1);
  ok('e ele está ligado durante a gravação', await bt.isEnabled());
  const rotulo = (await bt.textContent() || '').trim();
  ok('com o rótulo curto do idioma', rotulo === 'Apontar', rotulo);

  const antes = await quantos();
  await bt.click();
  await pg.waitForTimeout(900);
  const depois = await quantos();
  ok('apertar CAPTUROU uma tela nova', depois === antes + 1, `${antes} → ${depois}`);
  iEditado = antes;

  const img = fita().locator('#edImg');
  ok('e a figura dela abriu no lugar da fita', await img.count() === 1);
  const tit = (await fita().locator('#edTit').textContent() || '');
  ok('a janela diz de qual passo se trata', /passo\s*\d/i.test(tit), tit);
  const av = (await fita().locator('#edPausa').textContent() || '');
  ok('e diz, em palavras, que a gravação está pausada', /pausada/i.test(av), av);

  const pedidos = await pg.evaluate(() => window.__pipPedidos);
  const fitaP = pedidos[0], edP = pedidos[pedidos.length - 1];
  ok('a janela de edição foi pedida MAIOR que a fita',
     edP.width > fitaP.width && edP.height > fitaP.height,
     `fita ${fitaP.width}×${fitaP.height}  ·  edição ${edP.width}×${edP.height}`);
}

/* ---------------------------------------------------------------- [3] ----
   O ARRASTO É DE MOUSE, sobre a figura. Um evento fabricado provaria que o
   ouvinte existe; só o mouse prova que o gesto chega onde a pessoa aponta. */
console.log('\n[3] o arrasto escreve no quadro certo, e com a ferramenta escolhida');
{
  ok('o quadro começa sem marca nenhuma', (await marcasDe(iEditado) || []).length === 0);
  const cx = await fita().locator('#edImg').boundingBox();
  const arrastar = async (x1, y1, x2, y2) => {
    await pg.mouse.move(cx.x + x1, cx.y + y1);
    await pg.mouse.down();
    await pg.mouse.move(cx.x + x2, cx.y + y2, { steps: 12 });
    await pg.mouse.up();
    await pg.waitForTimeout(250);
  };
  await arrastar(cx.width * 0.2, cx.height * 0.25, cx.width * 0.6, cx.height * 0.6);
  let m = await marcasDe(iEditado);
  ok('uma seta entrou no quadro que está aberto', m.length === 1 && m[0].tipo === 'seta',
     JSON.stringify(m));

  await fita().locator('#edRet').click();
  await arrastar(cx.width * 0.1, cx.height * 0.1, cx.width * 0.4, cx.height * 0.4);
  m = await marcasDe(iEditado);
  ok('e trocar de ferramenta muda o que é desenhado',
     m.length === 2 && m[1].tipo === 'ret', JSON.stringify(m));

  /* O clique parado não pode virar marca de tamanho zero — a regra é a mesma
     da lente porque o código é o mesmo, e é isso que se cobra aqui. */
  await pg.mouse.click(cx.x + cx.width * 0.5, cx.y + cx.height * 0.5);
  await pg.waitForTimeout(250);
  ok('um clique parado não vira marca', (await marcasDe(iEditado)).length === 2);

  ok('e NENHUM outro quadro foi marcado', await pg.evaluate((n) =>
      (window.__quadros() || []).every((f, i) => i === n || !(f.marcas || []).length), iEditado));

  const desf = fita().locator('#edDesfazer');
  ok('o desfazer aparece quando há o que desfazer', await desf.isVisible());
  await desf.click(); await pg.waitForTimeout(200);
  ok('e ele tira a última', (await marcasDe(iEditado)).length === 1);
}

/* ---------------------------------------------------------------- [4] ----
   A AFIRMAÇÃO MAIS IMPORTANTE DESTE ARQUIVO. */
console.log('\n[4] a captura PAROU enquanto a janela de edição está aberta');
{
  ok('a gravação está pausada', await pausado());
  const parada = await ganhouEm(JANELA);
  /* SEM A LINHA DE BASE, ISTO SERIA APROVAR POR VAZIO. "Nenhum quadro novo em
     três segundos" não prova nada numa tela falsa que não gera quadro nenhum —
     e a linha de base foi medida ANTES de abrir o editor, com a mesma tela e o
     mesmo relógio. Se ela vier zero, é a régua que está quebrada, e é ela que
     falha. */
  ok('a tela falsa estava mesmo gerando quadros antes disso',
     BASE > 0, `linha de base: ${BASE} quadros em ${JANELA/1000}s`);
  ok('e com o editor aberto não entrou nenhum',
     parada === 0, `${parada} quadros — a janela de edição estaria dentro deles`);
}

/* ---------------------------------------------------------------- [5] ---- */
console.log('\n[5] salvar fecha a janela, devolve a fita e RETOMA a gravação');
{
  await fita().locator('#edSalvar').click();
  await pg.waitForTimeout(900);
  ok('a figura saiu', await fita().locator('#edImg').count() === 0);
  ok('e a fita voltou com os botões dela', await fita().locator('#anotar').count() === 1);
  ok('a gravação não está mais pausada', !(await pausado()));
  const voltou = await ganhouEm(JANELA);
  ok('e voltou a guardar tela', voltou > 0, `${voltou} quadros em ${JANELA/1000}s`);
  ok('a marcação feita ao vivo continua no quadro', (await marcasDe(iEditado)).length === 1);
}

/* ---------------------------------------------------------------- [6] ---- */
console.log('\n[6] quem já estava pausado continua pausado depois de apontar');
{
  /* Pelo botão do CARTÃO, e não pelo da fita: no modo fita o pausar não é
     desenhado — a fita tem uma linha só, e pausar é o gesto que se dá com a
     aba na frente. É a mesma função nos dois lugares. */
  await pg.locator('#recPause').click();
  await pg.waitForTimeout(400);
  ok('pausei de propósito', await pausado());
  /* Pausado, o botão de apontar fica desligado — como marcar e como a tela.
     Então a entrada é pelo atalho? Não: um botão desligado é a resposta certa,
     e é ela que se cobra. Apontar numa gravação pausada capturaria uma tela que
     a pessoa mandou não capturar. */
  ok('e o botão de apontar fica desligado junto', !(await fita().locator('#anotar').isEnabled()));
  await pg.locator('#recPause').click();
  await pg.waitForTimeout(400);
  ok('despausei, e ele voltou', await fita().locator('#anotar').isEnabled());
}

/* ---------------------------------------------------------------- [7] ---- */
console.log('\n[7] a marcação feita ao vivo foi para o espelho em disco');
{
  const linhas = await pg.evaluate(async () => {
    const out = [];
    try {
      const raiz = await navigator.storage.getDirectory();
      const pai = await raiz.getDirectoryHandle('gravacoes');
      for await (const [, h] of pai.entries()) {
        if (h.kind !== 'directory') continue;
        for await (const [n2, f2] of h.entries()) {
          if (n2 !== 'indice.jsonl') continue;
          const txt = await (await f2.getFile()).text();
          txt.split('\n').filter(Boolean).forEach(l => { try { out.push(JSON.parse(l)); } catch (e) {} });
        }
      }
    } catch (e) {}
    return out;
  });
  const comMarca = linhas.filter(l => Array.isArray(l.marcas) && l.marcas.length);
  /* O ESPELHO TEM QUE EXISTIR AQUI, e não "se existir". Um ramo que pula
     quando o índice vem vazio aprovaria por vazio exatamente no dia em que o
     espelho parasse de gravar — que é o dia que este bloco existe para pegar.
     Ele fica em disco local do navegador e nasce com a gravação. */
  ok('a gravação deixou um índice no espelho', linhas.length > 0,
     `${linhas.length} linhas`);
  ok('e ele tem uma linha com as marcas do quadro editado',
     comMarca.some(l => l.n === iEditado + 1), JSON.stringify(comMarca.slice(0, 2)));
  /* A IMAGEM NO ESPELHO CONTINUA LIMPA. A marca é vetor e vai na lista; um
     espelho já queimado seria uma cópia que ninguém desfaz — e o espelho existe
     para recuperar, não para publicar. */
  const doQuadro = linhas.filter(l => l.n === iEditado + 1);
  ok('e a linha da IMAGEM daquele quadro não foi reescrita com marca dentro',
     doQuadro.some(l => l.arquivo && !l.marcas),
     JSON.stringify(doQuadro.map(l => Object.keys(l))));
}

/* ---------------------------------------------------------------- [8] ----
   UM GESTO, E NÃO DOIS. A prova não é "o código chama a mesma função" — isso é
   afirmar sobre o texto. A prova é que a marca desenhada AO VIVO aparece na
   lente com a mesma forma e a mesma cor, e que só existe um lugar no artefato
   que fabrica uma marca a partir de um arrasto. */
console.log('\n[8] há UM gesto de marcação, e a marca ao vivo é a mesma da revisão');
{
  const antes = await marcasDe(iEditado);
  await pg.locator('#recStop').click({ force: true }).catch(() => {});
  await pg.waitForTimeout(2500);
  const depois = await marcasDe(iEditado);
  ok('a marca sobreviveu ao fim da gravação',
     depois && depois.length === antes.length && depois[0].tipo === antes[0].tipo &&
     depois[0].cor === antes[0].cor, JSON.stringify({ antes, depois }));

  /* Um só fabricante de marca a partir de arrasto. Se alguém copiar o gesto
     para uma terceira superfície em vez de chamar `ligarMarcacao`, este número
     sobe — e é exatamente esse o dia que esta linha existe para pegar. */
  const fabricas = (app.match(/tipo:'caneta', cor: mkCor, pts: \[\[/g) || []).length;
  ok('só um lugar no artefato fabrica uma marca a partir de um arrasto',
     fabricas === 1, `achei ${fabricas}`);
  const ligadas = (app.match(/ligarMarcacao\(\{/g) || []).length;
  ok('e as duas superfícies são ligadas pela MESMA função', ligadas === 2, `achei ${ligadas}`);
}

/* ---------------------------------------------------------------- [9] ----
   TROCAR O TAMANHO DA JANELINHA NO MEIO DA GRAVAÇÃO. Isto não é da edição ao
   vivo — é um defeito ANTIGO que ela desenterrou: `reabrirPip` chamava `agora`,
   que é um apelido criado dentro da função que grava e daqui nunca existiu. A
   janela voltava dizendo "preparando", com o relógio parado, e o erro morria
   em silêncio porque acontecia DEPOIS de a janela já estar montada.
   Fica aqui porque é este arquivo que abre e fecha a janelinha com a gravação
   correndo — e uma régua que não cobre o que ela achou deixa o defeito voltar. */
console.log('\n[9] trocar o tamanho da janelinha durante a gravação não estoura');
{
  const pg2 = await ctx.newPage();
  pg2.on('dialog', d => d.accept());
  const err2 = []; pg2.on('pageerror', e => err2.push(e.message));
  await pg2.goto(`http://localhost:${PORTA}/app.html?lang=pt`);
  await pg2.selectOption('#modelo', 'evidencia').catch(() => {});
  await pg2.locator('#semTr').check();
  await pg2.evaluate(() => window.__contagem(1));
  await pg2.locator('#rec').click();
  await pg2.waitForSelector('#recStop:visible', { timeout: 40000 });
  await pg2.waitForTimeout(1200);
  const f2 = () => pg2.frameLocator('#pipFake');
  await f2().locator('#tam').click();
  await pg2.waitForTimeout(1200);
  ok('a janela voltou depois de trocar de tamanho', await f2().locator('#stop').count() === 1);
  /* O RELÓGIO É A PROVA. "Preparando" com o relógio em 0:00 era exatamente o
     que o defeito produzia, e um `count()` de botão não o teria pego. */
  const rel = (await f2().locator('#rel').textContent() || '').trim();
  ok('e o relógio voltou andando, e não parado em 0:00', rel !== '0:00' && /\d/.test(rel), rel);
  ok('sem erro de página ao trocar o tamanho', err2.length === 0, err2.slice(0, 2).join(' | '));
  await pg2.locator('#recStop').click({ force: true }).catch(() => {});
  await pg2.close();
}

/* --------------------------------------------------------------- [10] ----
   O CROMO DA JANELA DE EDIÇÃO. O tamanho pedido reserva `CROMO_ED` pixels para
   cabeçalho e barra; se o CSS crescer e o número não, a figura sai cortada — e
   ninguém percebe até ver uma tela com o pé faltando dentro de uma evidência. */
console.log('\n[10] o cromo declarado na conta é o cromo desenhado no CSS');
{
  const declarado = +(app.match(/CROMO_ED = (\d+)/) || [])[1];
  ok('a conta declara o cromo', !!declarado, String(declarado));
  const pg3 = await ctx.newPage();
  pg3.on('dialog', d => d.accept());
  await pg3.goto(`http://localhost:${PORTA}/app.html?lang=pt`);
  const medido = await pg3.evaluate(() => {
    const css = [...document.querySelectorAll('script')].map(s2 => s2.textContent).join('\n')
      .match(/const PIP_CSS = `([\s\S]*?)`;/)[1];
    const d = document.createElement('iframe');
    d.style.cssText = 'position:fixed;left:-9999px;width:800px;height:600px;border:0';
    document.body.appendChild(d);
    const doc = d.contentDocument;
    doc.head.innerHTML = '<style>*{box-sizing:border-box;margin:0}' + css + '</style>';
    doc.body.className = 'editando';
    doc.body.innerHTML = '<div class="edTop"><span class="edTit">x</span></div>' +
                         '<div class="edCx"></div><div class="edBar"><button class="edFer">x</button></div>';
    const t2 = doc.querySelector('.edTop').offsetHeight;
    const b2 = doc.querySelector('.edBar').offsetHeight;
    d.remove();
    return { t: t2, b: b2 };
  });
  ok('e ele bate com o cabeçalho mais a barra, medidos no desenho',
     medido.t + medido.b === declarado,
     `cabeçalho ${medido.t} + barra ${medido.b} = ${medido.t + medido.b}, declarado ${declarado}`);
  await pg3.close();
}

console.log('\n[11] nenhum erro de página no caminho todo');
ok('sem erro de página', erros.length === 0, erros.slice(0, 3).join(' | '));

await br.close(); srv.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nApontar durante a gravação: tudo passou.');
process.exit(falhas ? 1 : 0);

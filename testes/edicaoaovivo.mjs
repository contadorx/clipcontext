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
  window.__pipResizes = [];
  window.__pipOpcoes = [];
  window.__pipTeto = null;
  const dpip = {
    requestWindow: async (opcoes) => {
      const { width, height } = opcoes;
      window.__pipOpcoes.push(opcoes);
      /* ---- UM NAVEGADOR QUE RECUSA, e não um que obedece a tudo ----
         O Chrome tem teto próprio para janela de picture-in-picture, e recusar
         é um comportamento que o remendo precisa saber imitar: sem isso, o
         caminho em que a fita já foi fechada e a janela nova não abre nunca é
         exercitado — e é justamente onde a pessoa fica sem janelinha nenhuma no
         meio de uma gravação. */
      if (window.__pipTeto && (width > window.__pipTeto.w || height > window.__pipTeto.h)) {
        throw new Error('teto-do-navegador');
      }
      const velho = document.getElementById('pipFake');
      if (velho) velho.remove();
      const fr = document.createElement('iframe');
      fr.id = 'pipFake';
      fr.style.cssText = 'position:fixed;right:0;bottom:0;z-index:2147483647;border:0;background:#0b0d11';
      /* O NAVEGADOR PODE DEVOLVER MENOS DO QUE FOI PEDIDO — é o que o Chrome
         faz quando restaura o tamanho que a pessoa deixou. `__pipEncolhe` deixa
         a régua reproduzir isso: sem ele o remendo obedece a tudo, e um remendo
         obediente nunca prova o caso em que o produto precisa avisar. */
      const enc = window.__pipEncolhe || 1;
      fr.style.width = Math.round(width * enc) + 'px';
      fr.style.height = Math.round(height * enc) + 'px';
      document.documentElement.appendChild(fr);
      const w = fr.contentWindow;
      w.document.open();
      w.document.write('<!doctype html><html><head></head><body></body></html>');
      w.document.close();
      window.__pipPedidos.push({ width, height });
      /* ---- SUMIR COM UM ELEMENTO, COMO UM DESENHO QUEBRADO FARIA ----
         O sintoma relatado foi um botão VISÍVEL que não fazia nada — e é isso
         que acontece quando a montagem estoura no meio: tudo dali para baixo
         nasce sem `onclick`, e a tela não diz nada. Um `getElementById` que
         devolve nulo para um id é a forma mais fiel de reproduzir isso sem
         pôr um gancho de teste dentro do produto. */
      if (window.__pipSemId) {
        const achar = w.document.getElementById.bind(w.document);
        w.document.getElementById = (id) => (id === window.__pipSemId ? null : achar(id));
      }
      w.close = () => {
        try { w.dispatchEvent(new Event('pagehide')); } catch (e) {}
        fr.remove();
      };
      /* O NAVEGADOR DE VERDADE PODE IGNORAR O TAMANHO PEDIDO NA ABERTURA — o
         Chrome guarda o da janela de picture-in-picture por site e reabre no
         que a pessoa deixou. Por isso o produto manda um `resizeTo` depois de
         aberta, e por isso o remendo anota as chamadas: é o que a régua tem
         para afirmar que ele mandou, e com que números. */
      /* O `__pipEncolhe` vale AQUI TAMBÉM. Um navegador que restaura o tamanho
         lembrado na abertura costuma recusar o `resizeTo` junto — e um remendo
         que obedece ao segundo depois de desobedecer ao primeiro descreve um
         navegador que não existe. Foi o que fez a primeira versão deste bloco
         dar verde sobre nada. */
      w.resizeTo = (a, b) => {
        const enc2 = window.__pipEncolhe || 1;
        fr.style.width = Math.round(a * enc2) + 'px';
        fr.style.height = Math.round(b * enc2) + 'px';
        window.__pipResizes.push({ w: a, h: b });
      };
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
/* ---- A ÁREA DE TRANSFERÊNCIA, ESPIADA E NÃO SIMULADA ----
   O Chromium de teste não dá permissão de escrita na área de transferência sem
   gesto de confiança, e pedir permissão aqui testaria o Playwright e não o
   produto. Então `write` é substituído por um espião que GUARDA o que recebeu —
   os tipos, e o blob de verdade, resolvido da promessa. É o que permite afirmar
   o que foi copiado, e não só que alguém chamou a função.
   `__copiaFalha` faz o navegador recusar, como um sem foco faria. */
await ctx.addInitScript(() => {
  window.__copias = [];
  window.__copiaFalha = '';
  try {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        write: async (itens) => {
          if (window.__copiaFalha) throw new Error(window.__copiaFalha);
          const it = itens[0];
          const tipos = it.types.slice();
          const b = await it.getType(tipos[0]);
          const buf = new Uint8Array(await b.arrayBuffer());
          window.__copias.push({ tipos, bytes: buf.length,
            /* A assinatura do PNG: 89 50 4E 47. Afirmar sobre o TIPO declarado
               provaria só que alguém escreveu a string certa. */
            png: buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47 });
          return true;
        },
        writeText: async () => true,
      },
    });
  } catch (e) {}
});
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
/* Um rótulo do dicionário do PRÓPRIO app, em português. Medir uma barra com
   palavras inventadas é medir outro produto — foi o que `janelinha.mjs` já
   pagou uma vez. */
const dic = (chave) => {
  const i = app.indexOf('\n    pt: {');
  const m = i < 0 ? null : app.slice(i, i + 95000).match(new RegExp(chave + ":'([^']*)'"));
  return m ? m[1] : '';
};
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
  /* ---- E ELA ABRE GRANDE, e não numa janela de espiar ----
     Ela nascia com 72% da tela, com o argumento de "não perder a referência do
     que está atrás". O relato desfez: "minha ação foi abrir ela inteira e me
     perdi". E o argumento já tinha caído antes disso — ele valia enquanto o
     editor disputava tela com a captura, e a captura PARA desde o Build 56.
     Num ERP em tela cheia, o campo que se quer circular tem quatro pixels numa
     janela de 72%. */
  const tela = await pg.evaluate(() => ({ w: screen.availWidth, h: screen.availHeight }));
  ok('e ela ocupa quase toda a tela disponível',
     edP.width >= tela.w * 0.9,
     `${edP.width} de ${tela.w} de largura disponível`);
  /* ---- E PEDIR NA ABERTURA NÃO BASTA ----
     O relato foi "ficou do mesmo tamanho a janelinha", com o pedido correto no
     artefato: o Chrome guarda o tamanho da janela de picture-in-picture POR
     SITE e reabre no que a pessoa deixou, ignorando o pedido — e do lado de cá
     isso é indistinguível de um teto, porque a janela volta igual e sem erro.
     Então o produto manda um `resizeTo` DEPOIS de aberta. É o mesmo caminho
     que o `encolherFita` já usa para apertar a fita; aqui ele serve para o
     contrário. */
  /* ---- A CHAVE QUE FAZ O NAVEGADOR OBEDECER ----
     O Chrome guarda a posição e o tamanho da janela de picture-in-picture POR
     SITE e, na abertura seguinte, RESTAURA o que a pessoa deixou — descartando
     `width` e `height` sem avisar. Do lado de cá é indistinguível de um teto: a
     janela volta igual, sem erro, e pedir maior não muda nada. Foi por isso que
     o relato "ficou do mesmo tamanho" veio duas vezes com o pedido correto no
     artefato. `preferInitialWindowPlacement` é o que manda usar o tamanho
     PEDIDO em vez do lembrado. */
  const opcoes = await pg.evaluate(() => window.__pipOpcoes);
  ok('a abertura pede para ignorar o tamanho que o navegador lembrou',
     opcoes.every(o => o.preferInitialWindowPlacement === true),
     JSON.stringify(opcoes[opcoes.length - 1]));
  const resizes = await pg.evaluate(() => window.__pipResizes);
  const ult = resizes[resizes.length - 1];
  ok('e o produto ainda MANDA o tamanho depois de aberta',
     !!ult && ult.w === edP.width && ult.h === edP.height,
     ult ? `${ult.w}×${ult.h} contra ${edP.width}×${edP.height} pedidos` : '(não mandou)');
  /* E o que voltou fica anotado: sem número, "abriu pequeno" é uma conversa
     sem medida — foi assim que este defeito chegou. */
  await pg.waitForTimeout(400);
  const anotado = await pg.evaluate(() => window.__editorTam && window.__editorTam());
  ok('e o que o navegador devolveu fica anotado para o diagnóstico',
     !!(anotado && anotado.pediu && anotado.veio),
     anotado ? `pediu ${anotado.pediu}, veio ${anotado.veio}` : '(nada anotado)');
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

/* --------------------------------------------------------------- [3a] ----
   ESCREVER, E NÃO SÓ APONTAR. O pedido do campo era "colocando marcações setas
   E ESCREVENDO para não se esquecerem", e a primeira versão deste editor
   entregou só a metade que desenha: a seta diz ONDE, e não diz por quê.

   O QUE ESTE BLOCO NÃO REFAZ: que `f.nota` sai no documento. Isso é o que
   `anotacao.mjs` já cobra, de ponta a ponta, e é literalmente o mesmo campo do
   mesmo quadro. Reprovar duas vezes a mesma coisa não é rigor — é uma segunda
   régua para manter em pé. O que falta provar aqui é o pedaço novo: que o
   texto escrito DENTRO do editor cai no quadro CERTO e sobrevive à gravação. */
console.log('\n[3a] dá para escrever, e o texto vai para o quadro que está aberto');
{
  const campo = fita().locator('#nota');
  ok('o editor tem um campo de texto', await campo.count() === 1);
  ok('e ele já está ligado, apontando para esta tela', await campo.isEnabled());
  const rot = (await fita().locator('#notaLbl').textContent() || '').trim();
  ok('com o rótulo dizendo de qual passo se trata', /passo/i.test(rot), rot);

  const FRASE = 'centro de custo veio vazio';
  await campo.click();
  await campo.fill(FRASE);
  await fita().locator('#notaOk').click();
  await pg.waitForTimeout(400);

  const notas = await pg.evaluate(() => (window.__quadros() || []).map(f => f.nota || ''));
  ok('o texto entrou no quadro que está sendo apontado',
     notas[iEditado] === FRASE, JSON.stringify(notas[iEditado]));
  ok('e em NENHUM outro', notas.filter((n, i) => i !== iEditado && n).length === 0,
     JSON.stringify(notas));
  const msg = (await fita().locator('#notaMsg').textContent() || '').trim();
  ok('e a janela diz, em palavras, que guardou', msg.length > 0, msg);
}

/* --------------------------------------------------------------- [3b] ----
   NADA NA BARRA ESTICA NEM SAI PELA DIREITA.

   O relato veio de uma tela real: "o botão de salvar e voltar ficou quebrado".
   O botão padrão desta folha de estilo é `width:100%` — ela foi escrita para a
   janela completa, que empilha —, e o SALVAR nasceu herdando isso: esticava por
   cima da barra inteira e saía pela direita. É o MESMO tropeço que o `#anotar`
   deu na fita, duas semanas atrás, e nenhuma régua olhava para larguras aqui.

   A afirmação não é sobre o salvar: é sobre a barra. Um botão novo amanhã cai
   nesta mesma linha sem ninguém lembrar de acrescentá-lo. */
console.log('\n[3b] o salvar está à vista em QUALQUER largura de janela');
{
  /* ---- MEDIDO EM VÁRIAS LARGURAS, E NÃO SÓ NA QUE CALHOU ----
   *
   * A primeira versão deste bloco media a janela que estava aberta — 1203px —
   * e dava verde. O relato chegou assim: "o botão de salvar e voltar a gravar
   * não está funcionando". Ele funcionava; NÃO ESTAVA NA TELA. A barra tinha
   * `overflow-x:auto` numa fileira única, e abaixo de uns 700px o salvar ficava
   * à direita do que se vê — alcançável só rolando a barra na horizontal, que
   * ninguém faz numa barra de botões.
   *
   * Uma largura só nunca ia pegar isso. Aqui o corpo do editor é montado com o
   * CSS do produto em cinco larguras, da mais folgada ao piso que o próprio
   * produto aceita (520), e o salvar tem que estar dentro da barra em todas.
   *
   * E O PISO SAI DO PRODUTO, não escrito aqui: se alguém baixar o mínimo
   * amanhã, a régua passa a medir o mínimo novo sozinha. */
  const piso = +(app.match(/Math\.max\(520, guardado\.w\)/) ? 520 : 0) ||
               +(app.match(/w: Math\.max\((\d+), w\)/) || [])[1];
  ok('o produto declara o piso de largura do editor', piso >= 300, String(piso));

  const src = app.slice(app.indexOf('function corpoDaEdicao()'));
  const corpoEd = (src.slice(0, src.indexOf(';\n')).match(/'([^']*)'/g) || [])
    .map((x) => x.slice(1, -1)).join('');
  const pgB = await ctx.newPage();
  pgB.on('dialog', d => d.accept());
  await pgB.goto(`http://localhost:${PORTA}/app.html?lang=pt`);
  const cssEd = await pgB.evaluate(() =>
    [...document.querySelectorAll('script')].map(s2 => s2.textContent).join('\n')
      .match(/const PIP_CSS = `([\s\S]*?)`;/)[1]);

  const LARGURAS = [1203, 900, 700, 620, piso];
  for (const L of LARGURAS) {
    await pgB.setViewportSize({ width: L, height: 620 });
    await pgB.setContent('<!doctype html><html><head><meta charset="utf-8">' +
      '<style>*{box-sizing:border-box;margin:0}' + cssEd + '</style></head>' +
      '<body class="editando">' + corpoEd + '</body></html>');
    /* Com os RÓTULOS QUE O PRODUTO PINTA, e não com texto inventado: uma barra
       medida com palavras que ninguém vê é uma barra medida em outro produto. */
    await pgB.evaluate((rot) => {
      for (const [id, txt] of Object.entries(rot)) {
        const e = document.getElementById(id);
        if (e && txt) { e.textContent = txt; e.classList.remove('hide'); }
      }
      const c = document.getElementById('edCores');
      for (let i = 0; i < 3; i++) {
        const b = document.createElement('button'); b.style.background = '#e0281e'; c.appendChild(b);
      }
    }, {
      edSeta: dic('mkSeta'), edRet: dic('mkRet'), edCaneta: dic('mkCaneta'),
      edDesfazer: dic('mkDesfazer'), edSalvar: dic('edSalvar'), edComo: dic('edComo'),
    });
    const m = await pgB.evaluate(() => {
      const bar = document.querySelector('.edBar'), rb = bar.getBoundingClientRect();
      const sv = document.getElementById('edSalvar'), rs = sv.getBoundingClientRect();
      return { dentro: rs.right <= rb.right + 1 && rs.left >= rb.left - 1 && rs.width > 0,
               dir: Math.round(rs.right), fim: Math.round(rb.right) };
    });
    ok(`  ${L}px: o salvar está dentro da barra`, m.dentro,
       m.dentro ? '' : `termina em ${m.dir}, a barra vai até ${m.fim}`);
  }
  await pgB.close();
}

/* --------------------------------------------------------------- [3c] ----
   O TAMANHO QUE A PESSOA DER FICA. Quem arrastou o canto uma vez não quer
   arrastar quarenta. `documentPictureInPicture` não redimensiona depois de
   aberto, mas o `innerWidth` ao fechar diz no que ela virou — e é isso que se
   guarda, como o tamanho da lente e o modo da fita.
   COM PISO E COM TETO: sem piso, um arrasto sem querer deixa o editor
   inutilizável para sempre; sem teto, um tamanho guardado num monitor de 4K
   abre fora da tela no notebook. */
console.log('\n[3c] o tamanho que a pessoa der ao editor fica para a próxima');
{
  const ESCOLHIDO = { w: 760, h: 540 };
  await pg.evaluate((t) => {
    const fr = document.getElementById('pipFake');
    fr.contentWindow.resizeTo(t.w, t.h);
  }, ESCOLHIDO);
  await pg.waitForTimeout(200);
  await fita().locator('#edSalvar').click();
  await pg.waitForTimeout(2200);
  const guardado = await pg.evaluate(() => {
    try { return localStorage.getItem('Walkstamp.editorTam'); } catch (e) { return null; }
  });
  ok('o tamanho foi guardado ao fechar', guardado === `${ESCOLHIDO.w}x${ESCOLHIDO.h}`, String(guardado));

  await fita().locator('#anotar').click();
  await pg.waitForTimeout(1200);
  const p2 = await pg.evaluate(() => window.__pipPedidos);
  const ed2 = p2[p2.length - 1];
  ok('e a próxima abertura usa esse tamanho, e não o padrão',
     ed2.width === ESCOLHIDO.w && ed2.height === ESCOLHIDO.h,
     `${ed2.width}×${ed2.height}`);

  /* O PISO. Um tamanho absurdo guardado não pode deixar o editor inútil para
     sempre — e sem nenhuma pista do porquê, porque ele abriria assim toda vez. */
  await pg.evaluate(() => {
    const fr = document.getElementById('pipFake');
    fr.contentWindow.resizeTo(120, 90);
  });
  await pg.waitForTimeout(200);
  await fita().locator('#edSalvar').click();
  await pg.waitForTimeout(2200);
  await fita().locator('#anotar').click();
  await pg.waitForTimeout(1200);
  const p3 = await pg.evaluate(() => window.__pipPedidos);
  const ed3 = p3[p3.length - 1];
  ok('um tamanho absurdo guardado não deixa o editor inútil',
     ed3.width >= 520 && ed3.height >= 380, `${ed3.width}×${ed3.height}`);
  /* E volta ao grande para os blocos seguintes medirem o que a pessoa vê. */
  await pg.evaluate(() => { try { localStorage.removeItem('Walkstamp.editorTam'); } catch (e) {} });
  /* `iEditado` NÃO MUDA AQUI, e isto já custou uma rodada vermelha. Este bloco
     abre e fecha o editor duas vezes, então há quadros novos — mas a seta e a
     frase continuam no quadro de [3] e [3a], e é sobre ELE que os blocos
     seguintes afirmam. Apontar a variável para o último quadro fez quatro
     réguas reprovarem por estarem olhando para um quadro em branco. */
}

/* --------------------------------------------------------------- [3d] ----
   QUANDO O NAVEGADOR NÃO DÁ O TAMANHO PEDIDO, A JANELA DIZ ISSO.

   Três voltas deste recurso foram gastas às cegas — "ficou do mesmo tamanho",
   "continua do mesmo jeito" — porque o tamanho que o navegador devolveu não
   estava em lugar nenhum que quem usa pudesse ler. Estava num relatório gravado
   quando a gravação PARA, e uma medida que só existe depois do fato não serve
   para conferir o fato.

   Agora a própria janela diz, e diz o que fazer: arrastar o canto uma vez
   resolve, porque o tamanho que a pessoa deixar é o que fica. Só aparece quando
   há discrepância — nos outros casos seria ruído numa janela que já é apertada. */
console.log('\n[3d] se o navegador der menos do que foi pedido, a janela avisa');
{
  ok('com o tamanho obedecido, o aviso NÃO aparece',
     !(await fita().locator('#edTam').isVisible()));

  await fita().locator('#edSalvar').click();
  await pg.waitForTimeout(1800);
  /* O navegador passa a devolver 60% do pedido, como o Chrome faz quando
     restaura o tamanho lembrado. */
  await pg.evaluate(() => { window.__pipEncolhe = 0.6; });
  await fita().locator('#anotar').click();
  await pg.waitForTimeout(1500);
  const av = fita().locator('#edTam');
  ok('devolvendo menos, o aviso aparece', await av.isVisible());
  const txt = (await av.textContent() || '').trim();
  ok('e ele traz os DOIS números, o que veio e o que foi pedido',
     (txt.match(/\d+x\d+/g) || []).length === 2, txt);
  ok('e diz o que fazer a respeito', /arraste|canto/i.test(txt), txt);
  /* De volta ao normal para os blocos seguintes. */
  await pg.evaluate(() => { window.__pipEncolhe = 1; });
}

/* --------------------------------------------------------------- [3e] ----
   UM BOTÃO QUE FALHA TEM QUE DIZER QUE FALHOU.

   O relato foi "o botão de salvar e voltar a gravar não está funcionando", com
   o botão À VISTA. Um clique que entra numa função que estoura no meio é
   indistinguível, na tela, de um clique que não chegou — e é isso que
   transforma um defeito de uma linha em várias voltas às cegas.

   Aqui o erro é FABRICADO de propósito: sem quebrar o caminho, esta afirmação
   seria sobre um socorro que ninguém nunca viu funcionar. */
console.log('\n[3e] se o caminho do salvar estourar, a janela diz — e não fica muda');
{
  ok('sem falha nenhuma, a testeira não acusa erro',
     !(await fita().locator('#edTam.ruim').count()));

  /* Fecha e reabre o editor com um elemento SUMIDO no meio da montagem — que
     é o que produz o sintoma relatado: botão visível, clique sem efeito. */
  await fita().locator('#edSalvar').click();
  await pg.waitForTimeout(1500);
  await pg.evaluate(() => { window.__pipSemId = 'edDesfazer'; });
  await fita().locator('#anotar').click();
  await pg.waitForTimeout(1500);

  const av = fita().locator('#edTam');
  ok('com a montagem quebrada, a testeira acusa', await av.isVisible());
  const txt = (await av.textContent() || '');
  ok('e diz QUAL foi o erro, e não só que houve um',
     /edDesfazer|null|undefined|propert/i.test(txt), txt.trim());
  ok('e o erro fica guardado para o diagnóstico',
     !!(await pg.evaluate(() => window.__erroEditor && window.__erroEditor())));

  /* ---- E A SAÍDA CONTINUA FUNCIONANDO, que é a metade que importa ----
     O salvar e o Esc são ligados ANTES de qualquer coisa que possa falhar,
     justamente para que um desenho quebrado não prenda a pessoa com a gravação
     pausada e o X do navegador como única porta. */
  await fita().locator('#edSalvar').click();
  await pg.waitForTimeout(1500);
  ok('e o SALVAR ainda leva de volta, mesmo com a montagem quebrada',
     await fita().locator('#anotar').count() === 1);
  ok('e a gravação voltou a correr', !(await pausado()));

  /* Desfeita a sabotagem: senão os blocos seguintes dariam verde sobre um
     editor quebrado, que é outro estado. */
  await pg.evaluate(() => { window.__pipSemId = ''; });
  await fita().locator('#anotar').click();
  await pg.waitForTimeout(1500);
  ok('e desfeita a sabotagem o editor volta inteiro',
     await fita().locator('#edSalvar').count() === 1 &&
     !(await fita().locator('#edTam.ruim').count()));
}

/* --------------------------------------------------------------- [3f] ----
   COPIAR A TELA APONTADA. O pedido veio do uso: apontar o defeito e colar a
   figura num chamado ou num chat NA HORA, sem esperar o documento.

   O QUE PRECISA SER PROVADO não é que o botão existe — é O QUE SAI dele:
   um PNG (a área de transferência do Chrome recusa WebP, que é como os quadros
   nascem) e COM AS MARCAS QUEIMADAS, porque copiar a tela sem as setas é copiar
   exatamente o que não interessa. */
console.log('\n[3f] copiar a tela manda um PNG, e com as marcas dentro');
{
  const bt = fita().locator('#edCopiar');
  ok('o editor tem o botão de copiar', await bt.count() === 1);

  /* O quadro em edição já tem marcas dos blocos anteriores? Garante uma. */
  const cx = await fita().locator('#edImg').boundingBox();
  await pg.mouse.move(cx.x + cx.width * 0.3, cx.y + cx.height * 0.3);
  await pg.mouse.down();
  await pg.mouse.move(cx.x + cx.width * 0.7, cx.y + cx.height * 0.7, { steps: 10 });
  await pg.mouse.up();
  await pg.waitForTimeout(300);
  const iAgora = await pg.evaluate(() => window.__quadros().length - 1);
  ok('há marca no quadro antes de copiar',
     (await pg.evaluate((i) => (window.__quadros()[i].marcas || []).length, iAgora)) > 0);
  /* E ele ainda NÃO está queimado: ao vivo a marca é vetor. É o que torna a
     próxima afirmação interessante. */
  ok('e a figura ainda não estava queimada',
     !(await pg.evaluate((i) => !!window.__quadros()[i].tarjado, iAgora)));

  await bt.click();
  await pg.waitForFunction(() => (window.__copias || []).length > 0, null, { timeout: 15000 });
  const c = await pg.evaluate(() => window.__copias[window.__copias.length - 1]);
  ok('a área de transferência recebeu UM item', !!c, JSON.stringify(c));
  ok('declarado como image/png', c.tipos.length === 1 && c.tipos[0] === 'image/png',
     JSON.stringify(c.tipos));
  /* A ASSINATURA, e não o tipo declarado: dizer 'image/png' e mandar um WebP é
     exatamente o erro que esta linha existe para pegar. */
  ok('e os bytes são mesmo de um PNG', c.png === true);
  ok('com tamanho de imagem de verdade, e não um arquivo vazio', c.bytes > 2000,
     c.bytes + ' bytes');
  ok('e copiar QUEIMOU a figura — é a tela com as setas que vai',
     await pg.evaluate((i) => !!window.__quadros()[i].tarjado, iAgora));

  const msg = (await fita().locator('#edComo').textContent() || '').trim();
  ok('e a barra diz que copiou', /copiado/i.test(msg), msg);

  /* ---- RECUSADO PELO NAVEGADOR, A BARRA DIZ O MOTIVO ----
     A área de transferência exige janela em foco, e uma janela de
     picture-in-picture nem sempre conta. Mudo, a pessoa aperta de novo sem
     saber por quê. */
  await pg.evaluate(() => { window.__copiaFalha = 'sem-foco-da-regua'; });
  await bt.click();
  await pg.waitForTimeout(1200);
  const err = fita().locator('#edComo');
  const txt = (await err.textContent() || '');
  ok('recusado, a barra diz o motivo', /sem-foco-da-regua/.test(txt), txt.trim());
  ok('e o recado sai marcado como problema, e não como confirmação',
     await fita().locator('#edComo.ruim').count() === 1);
  await pg.evaluate(() => { window.__copiaFalha = ''; });
}

/* --------------------------------------------------------------- [3g] ----
   O NAVEGADOR RECUSANDO O TAMANHO — e a pessoa não ficando sem janelinha.

   O relato: "o apontar não está abrindo a tela". Medido no caminho: abrir o
   editor FECHA a fita antes de pedir a janela nova. Recusado o pedido, o
   `catch` zerava tudo e voltava em silêncio — fita sumida, editor não aberto,
   gravação pausada, nada na tela dizendo por quê. E há motivo para recusar:
   desde o Build 58 o editor pede 94% da tela, e o Chrome tem teto próprio.

   Duas afirmações, e a segunda é a que importa: ele TENTA MENOR, e se nem assim
   der, A FITA VOLTA e a gravação volta a correr. */
console.log('\n[3g] recusado o tamanho, ele tenta menor — e a fita nunca some');
{
  await fita().locator('#edSalvar').click();
  await pg.waitForTimeout(1500);

  /* ---- O TAMANHO GUARDADO POR OUTRO BLOCO TEM QUE SAIR DAQUI ----
     O bloco [3d] deixa o editor num tamanho encolhido, e ele FICA guardado: o
     primeiro pedido nascia já pequeno, passava no teto de primeira, e a
     afirmação "tentou o grande antes do pequeno" media outra coisa. Estado de
     um bloco vazando para o seguinte é um verde que não quer dizer nada. */
  await pg.evaluate(() => {
    try { localStorage.removeItem('Walkstamp.editorTam'); } catch (e) {}
    window.__pipTeto = { w: 800, h: 600 };
    window.__pipOpcoes = [];
  });
  await fita().locator('#anotar').click();
  await pg.waitForTimeout(2000);
  ok('o editor abriu mesmo assim', await fita().locator('#edImg').count() === 1);
  const ops = await pg.evaluate(() => window.__pipOpcoes);
  ok('e ele tentou o tamanho grande ANTES do pequeno',
     ops.length >= 2 && ops[0].width > 800, JSON.stringify(ops.map(o => o.width)));
  const usado = ops[ops.length - 1];
  ok('a janela usada cabe no teto do navegador',
     usado.width <= 800 && usado.height <= 600, `${usado.width}x${usado.height}`);
  ok('e a gravação segue pausada, como em qualquer edição', await pausado());
  await fita().locator('#edSalvar').click();
  await pg.waitForTimeout(2000);

  /* ---- E O CASO CRU: nem o menor passa ---- */
  await pg.evaluate(() => { window.__pipTeto = { w: 10, h: 10 }; });
  await fita().locator('#anotar').click();
  await pg.waitForTimeout(2500);
  await pg.evaluate(() => { window.__pipTeto = null; });
  ok('não abrindo de jeito nenhum, o erro fica guardado',
     /recusou|teto-do-navegador/i.test(
       await pg.evaluate(() => (window.__erroEditor && window.__erroEditor()) || '')),
     await pg.evaluate(() => (window.__erroEditor && window.__erroEditor()) || ''));
  /* A METADE QUE IMPORTA: a pessoa não pode ficar sem janelinha e com a
     captura pausada no meio de uma gravação. */
  await pg.waitForTimeout(1500);
  ok('e a gravação voltou a correr sozinha', !(await pausado()));
  const voltou = await ganhouEm(JANELA);
  ok('e voltou a guardar tela', voltou > 0, `${voltou} quadros em ${JANELA / 1000}s`);
  /* ---- E O ESTADO É DEVOLVIDO, senão o bloco seguinte mede outra coisa ----
     Com o teto em 10x10 nem a fita abriu, e a janelinha ficou fora do ar — o
     que é o comportamento certo: a aba mostra o botão de trazer de volta. Aqui
     ela é trazida, e o editor reaberto, porque [4] fala do editor ABERTO.
     Um bloco que deixa o estado pior do que achou faz o seguinte reprovar por
     um motivo que não é dele — foi o que aconteceu na primeira tentativa. */
  ok('sem janelinha, a aba oferece trazer de volta',
     await pg.locator('#recPip').isVisible());
  await pg.locator('#recPip').click();
  await pg.waitForTimeout(1500);
  ok('e ela volta', await fita().locator('#anotar').count() === 1);
  await fita().locator('#anotar').click();
  await pg.waitForTimeout(1800);
  ok('e o editor volta a abrir normalmente', await fita().locator('#edImg').count() === 1);
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
  /* ---- E A RETOMADA NÃO PODE FOTOGRAFAR O PRÓPRIO EDITOR ----
   *
   * O DEFEITO, e ele chegou numa tela real: o passo seguinte saiu com a NOSSA
   * janela de edição desenhada por cima do sistema do cliente. A pausa
   * funcionava; a ORDEM é que estava errada. `fechar` despausava antes de
   * fechar a janela, e `alternarPausa` faz uma captura FORÇADA no instante em
   * que despausa. A foto saía com o editor na frente.
   *
   * A régua anterior não pegava porque contava quadros: ela via "voltou a
   * guardar tela" e dava verde. O que ela não perguntava era O QUE estava na
   * frente quando o quadro entrou. Agora ela amostra as duas coisas juntas, a
   * cada 20ms, e reprova qualquer quadro que tenha entrado com o editor vivo. */
  await pg.evaluate(() => {
    window.__amostras = [];
    window.__amostraTic = setInterval(() => {
      try {
        const fr = document.getElementById('pipFake');
        const doc = fr && fr.contentDocument;
        window.__amostras.push({
          ed: !!(doc && doc.getElementById('edImg')),
          n: (window.__quadros() || []).length,
        });
      } catch (e) { window.__amostraErro = String(e && e.message || e); }
    }, 8);
  });
  await fita().locator('#edSalvar').click();
  await pg.waitForTimeout(2500);
  const veredito = await pg.evaluate(() => {
    clearInterval(window.__amostraTic);
    const a = window.__amostras;
    let comEditor = 0, total = 0, viuEditor = 0;
    /* A CONTAGEM DO EDITOR COMEÇA NO ZERO. A primeira versão começava em 1 —
       o índice de onde a COMPARAÇÃO de quadros precisa começar — e perdia
       justamente a amostra que via o editor aberto, que costuma ser a única.
       São duas contagens diferentes no mesmo laço, e cada uma tem o seu começo. */
    if (a.length && a[0].ed) viuEditor++;
    for (let i = 1; i < a.length; i++) {
      if (a[i].ed) viuEditor++;
      if (a[i].n > a[i - 1].n) { total++; if (a[i - 1].ed || a[i].ed) comEditor++; }
    }
    return { comEditor, total, viuEditor, amostras: a.length,
             erro: window.__amostraErro || '' };
  });
  /* SEM TER VISTO O EDITOR, A AMOSTRAGEM NÃO PROVA NADA — seria aprovar por
     vazio: "nenhum quadro entrou com o editor aberto" é trivialmente verdadeiro
     numa amostragem que começou depois de ele fechar. */
  ok('a amostragem pegou o editor ainda aberto', veredito.viuEditor > 0,
     `${veredito.viuEditor} de ${veredito.amostras} amostras${veredito.erro ? ' · ' + veredito.erro : ''}`);
  ok('e NENHUM quadro entrou com o editor na frente', veredito.comEditor === 0,
     `${veredito.comEditor} de ${veredito.total} quadros — sairiam com o Walkstamp por cima do cliente`);
  await pg.waitForTimeout(600);
  ok('a figura saiu', await fita().locator('#edImg').count() === 0);
  ok('e a fita voltou com os botões dela', await fita().locator('#anotar').count() === 1);
  ok('a gravação não está mais pausada', !(await pausado()));
  const voltou = await ganhouEm(JANELA);
  ok('e voltou a guardar tela', voltou > 0, `${voltou} quadros em ${JANELA/1000}s`);
  ok('a marcação feita ao vivo continua no quadro', (await marcasDe(iEditado)).length === 1);
  ok('e o texto escrito ao vivo também',
     await pg.evaluate((i) => !!(window.__quadros()[i] || {}).nota, iEditado));
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

/* --------------------------------------------------------------- [6a] ----
   FECHAR NO ESC, COM TEXTO POR SALVAR. O campo guarda sozinho ao perder o
   foco — mas fechar a janela não é perder o foco de forma confiável, e o Esc
   fecha com o cursor dentro do campo. Uma frase escrita durante a gravação e
   sumida no fechamento é a perda silenciosa que este produto não aceita. */
console.log('\n[6a] fechar no Esc não engole o que estava escrito');
{
  const antes = await quantos();
  await fita().locator('#anotar').click();
  await pg.waitForTimeout(900);
  ok('o editor abriu de novo', await fita().locator('#edImg').count() === 1);
  const i2 = antes;
  const FRASE2 = 'o botao Salvar ficou cinza';
  await fita().locator('#nota').click();
  /* Digitado de verdade, tecla a tecla: `fill` não dispara o `input` da mesma
     forma que uma pessoa digitando, e é o `input` que marca o texto como não
     salvo. Sem isso a régua testaria um estado que não existe. */
  await fita().locator('#nota').type(FRASE2, { delay: 8 });
  await pg.waitForTimeout(200);
  ok('o botão de salvar está aceso: há texto por guardar',
     await fita().locator('#notaOk').isEnabled());
  await pg.keyboard.press('Escape');
  await pg.waitForTimeout(1200);
  ok('o Esc fechou o editor', await fita().locator('#edImg').count() === 0);
  ok('e o texto foi guardado antes de fechar',
     await pg.evaluate((i) => (window.__quadros()[i] || {}).nota, i2) === FRASE2,
     JSON.stringify(await pg.evaluate((i) => (window.__quadros()[i] || {}).nota, i2)));
  ok('e a gravação voltou a correr', !(await pausado()));
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
  const queimadoAntes = await pg.evaluate((i) => !!(window.__quadros()[i] || {}).tarjado, iEditado);
  /* Queimar é redesenhar 1920px num canvas, e é o custo que não se paga no
     meio da captura. O detalhe fica no comentário e não ao lado do `ok`: um
     texto alarmante junto de uma linha que passou ensina a não ler o detalhe. */
  ok('durante a gravação a figura NÃO foi queimada', !queimadoAntes);
  await pg.locator('#recStop').click({ force: true }).catch(() => {});
  await pg.waitForTimeout(4000);
  /* ---- E A MINIATURA DA REVISÃO TEM QUE MOSTRAR O QUE FOI APONTADO ----
     A grade pinta `telaDe(f)`, que é a figura QUEIMADA ou a original. Sem
     queimar ao parar, quem apontou dez telas ao vivo voltava para quarenta
     miniaturas idênticas — e o recurso existe justamente para não esquecer.
     Foi assim que o Build 56 saiu, e é isto que o 57 conserta. */
  const queimadoDepois = await pg.evaluate((i) => {
    const f = window.__quadros()[i] || {};
    return { tem: !!f.tarjado, url: f.tarjado ? f.tarjado.url : '', orig: f.img ? f.img.url : '' };
  }, iEditado);
  ok('parada a gravação, a figura marcada foi queimada', queimadoDepois.tem);
  ok('e a miniatura passa a mostrar a queimada, e não a limpa',
     !!queimadoDepois.url && queimadoDepois.url !== queimadoDepois.orig);
  /* E quem não tem marca nenhuma não ganha uma queima à toa: queimar tudo
     custaria uma figura redesenhada por quadro numa gravação de duas horas. */
  const semMarca = await pg.evaluate(() =>
    (window.__quadros() || []).filter(f => !(f.marcas || []).length && !(f.tarjas || []).length)
      .every(f => !f.tarjado));
  ok('e quem não foi marcado não foi queimado à toa', semMarca);
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
  /* O CORPO DE VERDADE, e não três seletores escritos aqui. A primeira versão
     somava `.edTop + .edBar` à mão; a caixa de escrever entrou entre os dois e
     a régua seguiu somando dois de três — reprovou um cromo que estava certo.
     Agora ela monta o corpo que o produto monta e soma TUDO o que não é a
     figura. Uma fileira nova amanhã entra na conta sozinha. */
  const src = app.slice(app.indexOf('function corpoDaEdicao()'));
  const corpoEd = (src.slice(0, src.indexOf(';\n')).match(/'([^']*)'/g) || [])
    .map((x) => x.slice(1, -1)).join('');
  ok('o corpo do editor foi encontrado no artefato',
     /id="edCx"/.test(corpoEd) && /id="nota"/.test(corpoEd), corpoEd.slice(0, 50));
  const pg3 = await ctx.newPage();
  pg3.on('dialog', d => d.accept());
  await pg3.goto(`http://localhost:${PORTA}/app.html?lang=pt`);
  const medido = await pg3.evaluate(({ corpo2 }) => {
    const css = [...document.querySelectorAll('script')].map(s2 => s2.textContent).join('\n')
      .match(/const PIP_CSS = `([\s\S]*?)`;/)[1];
    const d = document.createElement('iframe');
    d.style.cssText = 'position:fixed;left:-9999px;width:900px;height:600px;border:0';
    document.body.appendChild(d);
    const doc = d.contentDocument;
    doc.head.innerHTML = '<style>*{box-sizing:border-box;margin:0}' + css + '</style>';
    doc.body.className = 'editando';
    doc.body.innerHTML = corpo2;
    const fileiras = [...doc.body.children]
      .filter((e) => e.id !== 'edCx' && getComputedStyle(e).display !== 'none')
      .map((e) => ({ cls: e.className || e.id, h: e.offsetHeight }));
    d.remove();
    return fileiras;
  }, { corpo2: corpoEd });
  const soma = medido.reduce((a, r) => a + r.h, 0);
  console.log('     ' + medido.map(r => `${r.cls} ${r.h}`).join('  +  ') + '  =  ' + soma);
  ok('e ele bate com tudo o que não é a figura, medido no desenho',
     soma === declarado, soma === declarado ? '' : `medido ${soma}, declarado ${declarado}`);
  await pg3.close();
}

console.log('\n[11] nenhum erro de página no caminho todo');
ok('sem erro de página', erros.length === 0, erros.slice(0, 3).join(' | '));

await br.close(); srv.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nApontar durante a gravação: tudo passou.');
process.exit(falhas ? 1 : 0);

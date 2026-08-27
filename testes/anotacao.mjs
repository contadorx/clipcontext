/* A ANOTAÇÃO AO VIVO — escrever no calor do momento, e ver que guardou.
 *
 * Ela já esteve na tela, saiu, e volta. O motivo da saída não era falso —
 * "confusa, e não ajuda" — e é ele que define o que este arquivo cobra: a
 * versão antiga era um campo de UMA LINHA, que não dizia sobre qual tela se
 * estava escrevendo, sem botão e sem nenhum sinal de que o texto tinha sido
 * guardado. Guardar era um ato de fé.
 *
 * As afirmações:
 *
 *   1. a caixa só aparece DEPOIS de haver o que comentar, e diz sobre o quê —
 *      "Passo 1" quando se marca um passo, "Tela 2 do Passo 1" quando se
 *      acrescenta uma tela ao passo em curso;
 *   2. o botão MUDA DE ESTADO: desligado sem texto novo, cheio com texto
 *      esperando, e "✓ Salvo" depois de guardar;
 *   3. está escrito, em palavras, que guardou e ONDE guardou;
 *   4. trocar de alvo NÃO PERDE o que estava escrito — é a única forma de perda
 *      que este produto não aceita, porque é silenciosa;
 *   5. e o texto sai no DOCUMENTO, que é a razão de tudo isto.
 *
 *   node testes/anotacao.mjs
 */
import { chromium } from './_navegador.mjs';   // abre os painéis e a gaveta das saídas
import http from 'http'; import fs from 'fs'; import path from 'path';

import { CHROME_WS } from './_caminhos.mjs';
const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'public');
const CHROME = process.env.CHROME || CHROME_WS;
const html = fs.readFileSync(RAIZ + '/app.html', 'utf8');
const srv = http.createServer((q, r) => {
  const u = q.url.split('?')[0];
  if (u.startsWith('/_vercel/')) { r.writeHead(200,{'Content-Type':'text/javascript'}); return r.end(''); }
  if (u === '/sw.js') { r.writeHead(200,{'Content-Type':'text/javascript'}); return r.end(fs.readFileSync(RAIZ+'/sw.js')); }
  r.writeHead(200, { 'Content-Type':'text/html' }); r.end(html);
});
await new Promise(r => srv.listen(8973, r));

/* Ler um zip sem biblioteca: caminhar pelos cabeçalhos locais. Os nossos vão
   sem compressão para o XML, que é o que este arquivo precisa. */
function lerZip(caminho){
  const b = fs.readFileSync(caminho);
  const saida = {};
  let i = 0;
  while ((i = b.indexOf('PK\x03\x04', i)) !== -1) {
    const nl = b.readUInt16LE(i+26), el = b.readUInt16LE(i+28), n = b.readUInt32LE(i+18);
    const nome = b.subarray(i+30, i+30+nl).toString('utf8');
    saida[nome] = b.subarray(i+30+nl+el, i+30+nl+el+n);
    i = i+30+nl+el+n;
  }
  return saida;
}

let falhas = 0;
const ok = (n, c, e) => { console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : '')); if (!c) falhas++; };

const br = await chromium.launch({ executablePath: CHROME,
  args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await br.newContext({ viewport: { width: 1250, height: 980 }, acceptDownloads: true });
const pg = await ctx.newPage();
/* O GUARDA DE DESCARTE, E POR QUE ELE É ACEITO AQUI.
   Varrer de novo, gravar de novo, abrir outro projeto e carregar outro vídeo
   passaram a perguntar antes de jogar a lista fora — mas só quando há trabalho
   de verdade para perder (anotação, tarja, impressão digital, clipe). Este
   arquivo tem trabalho na tela e DESCARTA de propósito: é o que ele veio
   afirmar. Sem esta linha o Playwright recusa o diálogo por padrão, o descarte
   não acontece e o teste falha por um motivo que não é o dele.
   Quem prova que o guarda existe é `testes/descarte.mjs`, e é lá que ele tem de
   ser cobrado — aceitar em todo lugar sem uma régua própria seria apagar o
   recurso e o teste dele no mesmo gesto. */
pg.on('dialog', d => d.accept());
const erros = []; pg.on('pageerror', e => erros.push(e.message));
await pg.route('**/rpc/*stamp_*', r => r.fulfill({ status:200, headers:{'access-control-allow-origin':'*'}, body:'null' }));
await pg.addInitScript(() => {
  function tela(){
    const c = document.createElement('canvas'); c.width = 1280; c.height = 720;
    const g = c.getContext('2d'); let i = 0;
    setInterval(() => { i++; g.fillStyle = ['#123','#eee','#567','#fa0','#0af'][i%5];
                        g.fillRect(0,0,1280,720); }, 700);
    return c.captureStream(12);
  }
  navigator.mediaDevices.getDisplayMedia = async () => tela();
  navigator.mediaDevices.getUserMedia = async () => { throw new Error('sem mic'); };
});
await pg.goto('http://localhost:8973/app.html?lang=pt');
await pg.selectOption('#modelo', 'evidencia').catch(() => {});
await pg.waitForTimeout(600);

const estado = () => pg.evaluate(() => {
  const cx = document.getElementById('anotCx');
  const bt = document.getElementById('anotSalvar');
  return {
    visivel: !!cx && !cx.classList.contains('hide'),
    rotulo: (document.getElementById('anotLbl')||{}).textContent || '',
    texto: (document.getElementById('anotTxt')||{}).value || '',
    btTexto: (bt||{}).textContent || '',
    btLigado: !!bt && !bt.disabled,
    btSalvo: !!bt && bt.classList.contains('salvo'),
    msg: (document.getElementById('anotMsg')||{}).textContent || '',
    linhas: (document.getElementById('anotTxt')||{}).rows || 0,
  };
});

console.log('\n[1] a caixa nasce fechada e abre quando há o que comentar');
{
  const e = await estado();
  ok('a caixa nasce escondida', e.visivel === false);
}

await pg.locator('#semTr').check();
await pg.evaluate(() => window.__contagem(1));
await pg.locator('#rec').click();
await pg.waitForSelector('#recStop:visible', { timeout: 40000 });
await pg.waitForTimeout(2500);
{
  /* MUDOU, e para melhor. O primeiro quadro é capturado sozinho ao começar e
     abre o passo 1 do documento — quer dizer, já HÁ o que comentar, e a tela
     inicial não tinha como ser descrita a não ser depois, na grade. A caixa
     aponta para ele. */
  const e = await estado();
  ok('com a gravação rolando, ela já aponta para o passo 1', e.visivel === true);
  ok('e diz que é do Passo 1', /passo 1/i.test(e.rotulo), e.rotulo);
  ok('vazia, com o botão desligado', e.texto === '' && e.btLigado === false);
}

console.log('\n[2] marcar um passo abre a caixa, e ela diz sobre o quê');
await pg.locator('#recMark').click();
await pg.waitForTimeout(700);
{
  const e = await estado();
  console.log('     rótulo: ' + e.rotulo);
  ok('a caixa apareceu', e.visivel === true);
  /* A pergunta sem resposta da versão antiga: sobre qual tela eu escrevo? */
  ok('e diz que é do PASSO', /passo/i.test(e.rotulo), e.rotulo);
  /* Uma linha ENSINA a escrever pouco. Descrever o que aconteceu não cabe em
     quarenta caracteres. */
  ok('é uma caixa de texto, e não um campo de uma linha', e.linhas >= 3, String(e.linhas));
  ok('o botão nasce desligado: não há nada novo para salvar', e.btLigado === false);
  /* ---- O APERTO ----
     Ela mora dentro de um `.row` que é flex. Sem ocupar a linha inteira, ela
     dividia a largura com os botões de gravação: a caixa encolhia, o campo
     encolhia junto e o botão de salvar era empurrado para fora da vista pela
     mensagem ao lado. A régua é geométrica porque a queixa era geométrica. */
  const g = await pg.evaluate(() => {
    const r = el => { const b = el.getBoundingClientRect();
                      return { x:b.x, y:b.y, w:b.width, h:b.height, r:b.right, b:b.bottom }; };
    return { cx: r(document.getElementById('anotCx')),
             tx: r(document.getElementById('anotTxt')),
             bt: r(document.getElementById('anotSalvar')),
             via: r(document.getElementById('viaRec')) };
  });
  console.log('     caixa ' + Math.round(g.cx.w) + 'px  |  campo ' + Math.round(g.tx.w) +
              'px  |  botão ' + Math.round(g.bt.w) + 'x' + Math.round(g.bt.h));
  ok('a caixa ocupa a largura do cartão, e não uma fatia dele',
     g.cx.w > g.via.w * 0.85, Math.round(g.cx.w) + ' de ' + Math.round(g.via.w));
  ok('o campo de texto acompanha', g.tx.w > 300, String(Math.round(g.tx.w)));
  ok('o botão tem tamanho de botão', g.bt.w > 90 && g.bt.h > 24,
     Math.round(g.bt.w) + 'x' + Math.round(g.bt.h));
  ok('e cabe dentro da caixa, sem transbordar',
     g.bt.r <= g.cx.r + 1, Math.round(g.bt.r) + ' > ' + Math.round(g.cx.r));
  /* Clicável DE VERDADE: nada por cima, e dentro da janela. */
  ok('e o clique chega nele', await pg.locator('#anotSalvar').isVisible());
}

console.log('\n[3] o botão muda de estado, e a tela diz que guardou');
await pg.fill('#anotTxt', 'Cliquei em Salvar e o sistema devolveu a mensagem 4711.');
await pg.waitForTimeout(200);
{
  const e = await estado();
  console.log('     ' + e.btTexto.trim() + '   |   ' + e.msg.trim());
  ok('com texto novo, o botão liga', e.btLigado === true);
  ok('e a tela avisa que ainda não salvou', /não salvo|nao salvo/i.test(e.msg), e.msg);
}
await pg.locator('#anotSalvar').click();
await pg.waitForTimeout(400);
{
  const e = await estado();
  console.log('     ' + e.btTexto.trim() + '   |   ' + e.msg.trim());
  /* O ESTADO DO BOTÃO É A RESPOSTA para "ele salvou?". */
  ok('o botão vira "Salvo"', /salvo/i.test(e.btTexto), e.btTexto);
  ok('e muda de aparência, não só de texto', e.btSalvo === true);
  ok('e desliga: não há mais nada novo para guardar', e.btLigado === false);
  /* Está ESCRITO que guardou, e onde. */
  ok('a mensagem diz que salvou', /salva/i.test(e.msg), e.msg);
  ok('e diz em qual passo', /passo/i.test(e.msg), e.msg);
}

console.log('\n[4] mais uma tela: o rótulo muda, e o texto anterior não se perde');
await pg.locator('#recTela').click();
await pg.waitForTimeout(700);
{
  const e = await estado();
  console.log('     rótulo: ' + e.rotulo);
  ok('agora fala da TELA, e não do passo', /tela/i.test(e.rotulo), e.rotulo);
  ok('e a caixa vem vazia para a tela nova', e.texto === '', e.texto);
}
/* A perda silenciosa: digitar e marcar de novo sem apertar Salvar. */
await pg.fill('#anotTxt', 'A segunda tela mostra o número do documento gerado.');
await pg.waitForTimeout(150);
await pg.locator('#recMark').click();
await pg.waitForTimeout(700);
{
  const guardadas = await pg.evaluate(() => (window.__quadros ? window.__quadros() : [])
    .map(f => f.nota || '').filter(Boolean));
  console.log('     anotações guardadas: ' + guardadas.length);
  ok('o texto não salvo foi guardado ao trocar de alvo', guardadas.length === 2,
     JSON.stringify(guardadas));
  ok('e o primeiro continua lá', guardadas.some(x => /4711/.test(x)), JSON.stringify(guardadas));
  ok('e o segundo também', guardadas.some(x => /documento gerado/.test(x)), JSON.stringify(guardadas));
}

console.log('\n[5] a anotação sai no documento');
await pg.fill('#anotTxt', 'Terceiro passo: a tela de confirmação.');
await pg.locator('#anotSalvar').click();
await pg.waitForTimeout(300);
await pg.locator('#recStop').click();
await pg.waitForTimeout(2500);
{
  const e = await estado();
  ok('ao parar, a caixa se recolhe', e.visivel === false);
  const naGrade = await pg.evaluate(() =>
    [...document.querySelectorAll('.thumbs .nota')].map(i => i.value).filter(Boolean));
  console.log('     na grade: ' + naGrade.length + ' anotações');
  ok('as anotações estão na grade', naGrade.length >= 3, JSON.stringify(naGrade));
  /* O QUE IMPORTA: o texto sai no DOCUMENTO. O `.docx` é o caminho mais curto
     para provar isso sem interpretar PDF — `word/document.xml` é texto puro, e
     é o mesmo `f.nota` que o PDF e o .zip leem. */
  const dl = pg.waitForEvent('download', { timeout: 60000 });
  await pg.locator('#docx').click();
  const d = await dl;
  await d.saveAs('/tmp/anot.docx');
  const doc = lerZip('/tmp/anot.docx')['word/document.xml'].toString('utf8');
  ok('o documento traz a mensagem 4711', doc.includes('4711'));
  ok('e a segunda tela', /documento gerado/.test(doc));
  ok('e a terceira', /confirma/.test(doc));
}
console.log('\n[6] a janelinha não corta os botões');
{
  /* A caixa entrou na janelinha também, e ela tem 250px de largura e altura
     fixa. Um corpo mais alto do que a janela, centrado, era cortado nas DUAS
     pontas — e a de baixo é onde ficam PAUSAR e PARAR. */
  await pg.locator('#rec').click().catch(() => {});
  await pg.waitForSelector('#recStop:visible', { timeout: 40000 });
  await pg.waitForTimeout(2500);
  const jn = ctx.pages().find(x => x !== pg);
  if (!jn) { ok('a janelinha abriu', false, 'sem janelinha neste navegador'); }
  else {
    await jn.locator('#marcar').click();
    await jn.waitForTimeout(500);
    /* A GEOMETRIA DA JANELINHA NÃO É MEDIDA AQUI, e antes era — mal.
       Este bloco copiava a altura declarada (`const ALT = 392`) para dentro do
       teste e media o corpo com `scrollHeight`. As duas coisas estavam erradas
       no mesmo lugar: o número copiado envelheceu no dia em que o produto pediu
       outro tamanho, e o `scrollHeight` de um corpo com `height:100vh` devolve
       a altura da janela mesmo com o conteúdo passando dela — quer dizer, a
       afirmação comparava 392 com 392 e dizia ok com o PARAR fora da tela.
       Duas listas para a mesma verdade, e a cópia era a errada.
       Quem mede o tamanho da janelinha é `janelinha.mjs`: ele lê a altura que o
       produto declara, soma os filhos de verdade, e mede as DUAS janelas (com e
       sem roteiro) com o botão do microfone aceso. Aqui fica o que é deste
       arquivo: a caixa de anotação. */
    const m = await jn.evaluate(() => ({
      nota: !!document.getElementById('nota'),
      notaOn: !document.getElementById('nota').disabled,
    }));
    ok('a caixa de anotação está na janelinha', m.nota);
    ok('e liga quando há passo marcado', m.notaOn);

    /* ---- DIGITAR NA JANELINHA, COM TECLADO DE VERDADE ----
       Aqui morava o defeito que impedia de escrever: a regra lia SEMPRE o
       campo do cartão, e durante a gravação o cartão está atrás da tela
       compartilhada. Cada tecla digitada na janelinha era sobrescrita pelo
       vazio do outro campo — o botão acendia, dizia "ainda não salvo", e
       salvava nada. `fill()` não pegaria: ele atribui o valor de uma vez, e o
       defeito estava no caminho de UMA TECLA. */
    await jn.locator('#nota').click();
    await jn.keyboard.type('digitado na janelinha 9182');
    await jn.waitForTimeout(250);
    const v = await jn.evaluate(() => document.getElementById('nota').value);
    ok('o que se digita na janelinha FICA no campo', v === 'digitado na janelinha 9182', v);
    await jn.locator('#notaOk').click();
    await jn.waitForTimeout(400);
    const gv = await pg.evaluate(() => window.__quadros().map(f => f.nota || '').filter(Boolean));
    ok('e chega ao quadro ao salvar', gv.some(x => /janelinha 9182/.test(x)), JSON.stringify(gv));
    /* Os dois campos contam a mesma história: dois textos diferentes sobre o
       mesmo quadro seria pior do que não ter o segundo campo. */
    const naAba = await pg.evaluate(() => document.getElementById('anotTxt').value);
    ok('e o campo do cartão mostra o mesmo texto', /janelinha 9182/.test(naAba), naAba);

    /* ---- SALVAR NÃO PODE TIRAR O TECLADO DA PESSOA ----
       O relato: "o texto depois de salvo não libera para um novo texto". E não
       estava em nenhum dos estados — o campo continuava ligado, o botão voltava
       a acender ao primeiro toque, e o robô que digitava clicando no campo
       antes passava. Estava no FOCO.

       Clicar em Salvar tira o foco do campo antes de o clique chegar. O `blur`
       guarda, o repintar DESLIGA o botão, e um botão desligado não dispara
       clique: o `onclick` nunca rodava, e o foco ficava no `body` — que é o
       lugar onde as teclas não vão para nenhum campo. Quem tinha acabado de
       salvar continuava digitando e via o texto antigo parado na tela.

       Na janelinha isso é pior do que na aba: não há para onde clicar de volta
       sem sair da tela que está sendo gravada.

       A régua digita SEM clicar no campo de novo, que é o gesto de quem
       acabou de salvar e continua escrevendo. `fill()` não serviria: ele
       atribui o valor sem passar pelo teclado, e o defeito era do teclado. */
    const foco = () => jn.evaluate(() =>
      document.activeElement ? (document.activeElement.id || document.activeElement.tagName) : '');
    ok('depois de salvar, o cursor continua no campo', (await foco()) === 'nota', await foco());
    await jn.keyboard.type(' e continuei escrevendo 7766');
    await jn.waitForTimeout(250);
    const seguiu = await jn.evaluate(() => document.getElementById('nota').value);
    ok('e o que se digita depois de salvar ENTRA no campo',
       /7766/.test(seguiu) && /janelinha 9182/.test(seguiu), seguiu);
    /* O botão volta a acender: há coisa nova para guardar outra vez. Sem isto o
       texto novo entraria no campo e não teria como sair dele. */
    const bt = await jn.evaluate(() => {
      const b = document.getElementById('notaOk');
      return { ligado: !b.disabled, texto: b.textContent.trim() };
    });
    ok('e o botão de salvar volta a acender', bt.ligado === true, JSON.stringify(bt));
    /* Com prazo curto, pelo mesmo motivo do clique lá embaixo: com o defeito
       instalado o botão está desligado aqui, e a espera padrão de trinta
       segundos transformaria uma reprovação legível num TimeoutError. */
    let salvouDeNovo = true;
    try { await jn.locator('#notaOk').click({ timeout: 4000 }); }
    catch (e) { salvouDeNovo = false; }
    await jn.waitForTimeout(400);
    const gv2 = await pg.evaluate(() => window.__quadros().map(f => f.nota || '').filter(Boolean));
    ok('e o texto continuado chega ao quadro',
       salvouDeNovo && gv2.some(x => /7766/.test(x)), JSON.stringify(gv2));

    /* O outro campo, o do cartão, tem o mesmo defeito e o mesmo conserto — e
       ele só pode ser medido COM A JANELINHA FECHADA. Com ela aberta o campo
       do cartão não é o que está em uso, e a afirmação passava mesmo com o
       defeito instalado: media um caminho que naquele momento não era
       percorrido. Uma afirmação que não sabe reprovar é pior do que nenhuma,
       porque ocupa o lugar dela.
       Fechada, é a situação de verdade de quem gravou sem janelinha ou fechou
       a dela sem querer. */
    await jn.close();
    await pg.waitForTimeout(500);
    await pg.locator('#recMark').click();
    await pg.waitForTimeout(700);
    await pg.locator('#anotTxt').click();
    await pg.keyboard.type('escrito no cartao 4242');
    await pg.waitForTimeout(150);
    /* O CLIQUE COM PRAZO, e o prazo é a afirmação.
       Com o defeito instalado este clique NÃO ACONTECE: o botão se desliga
       entre o apertar e o soltar, o Playwright se recusa a clicar num botão
       desligado, e o arquivo morria de TimeoutError trinta segundos depois —
       vermelho, mas ilegível. Um teste que só sabe reprovar morrendo obriga
       quem lê a esteira a abrir o registro para descobrir o que quebrou.
       Agora a espera é curta e a recusa vira uma frase. */
    let clicou = true;
    try { await pg.locator('#anotSalvar').click({ timeout: 4000 }); }
    catch (e) { clicou = false; }
    ok('o botão de salvar continua clicável até o fim do clique', clicou,
       clicou ? '' : 'ele se desligou no meio do próprio clique');
    await pg.waitForTimeout(350);
    const focoAba = await pg.evaluate(() =>
      document.activeElement ? (document.activeElement.id || document.activeElement.tagName) : '');
    ok('no cartão também o cursor volta ao campo', focoAba === 'anotTxt', focoAba);
    await pg.keyboard.type(' e continuei 9999');
    await pg.waitForTimeout(250);
    const noCartao = await pg.evaluate(() => document.getElementById('anotTxt').value);
    ok('e o cartão também aceita texto depois de salvo',
       /4242/.test(noCartao) && /9999/.test(noCartao), noCartao);
  }
  await pg.locator('#recStop').click().catch(() => {});
  await pg.waitForTimeout(1200);
}

ok('sem erro de página', erros.length === 0, erros[0]);

await br.close(); srv.close();
console.log(falhas ? `\n  ${falhas} falha(s)` : '\n  tudo certo');
process.exit(falhas ? 1 : 0);

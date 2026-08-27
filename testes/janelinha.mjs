/* A janelinha de controle: o tamanho dela.
 *
 * Ela fica POR CIMA da tela que está sendo gravada. Cada pixel dela é um pixel
 * a menos do trabalho que a pessoa está documentando — e ainda aparece nos
 * quadros capturados. Então o tamanho não é gosto: é o custo dela.
 *
 * O `documentPictureInPicture` não existe no navegador de teste, então o que se
 * faz aqui é montar o MESMO CSS e o MESMO corpo que o produto monta, numa
 * página do tamanho exato que ele pede, e medir se o conteúdo cabe. É o CSS do
 * produto, lido do arquivo gerado — não uma réplica escrita à mão.
 */
import { chromium } from 'playwright';
import fs from 'fs';

import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';
const app = fs.readFileSync(`${RAIZ_WS}/public/app.html`, 'utf8');
let falhas = 0;
const ok = (n, c, e) => { console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : '')); if (!c) falhas++; };

/* O tamanho pedido, o CSS e o corpo, tirados do próprio arquivo. */
/* A altura passou a depender do roteiro: com lista de passos colada, a
   janelinha ganha a linha do passo atual e a do seguinte. Então o arquivo
   declara as DUAS, e a régua mede a menor — a que vale para quem não colou
   roteiro nenhum, que é o caso comum e o mais apertado por quadro de tela. */
/* SÃO DOIS TAMANHOS AGORA, e não um. A completa serve a quem tem tela
   sobrando; quem executa um roteiro num ERP em tela cheia tem UMA janela, e
   cada pixel da janelinha é um pixel a menos do trabalho documentado.
   Esta régua mede as duas, porque as duas podem transbordar — e a mínima
   transborda mais fácil, que é o ponto dela. */
const med = app.match(/width: min \? (\d+) : (\d+), height: min \? (\d+) : \(roteiro\.length \? (\d+) : (\d+)\)/);
ok('a janelinha declara os dois tamanhos', !!med, med ? '' : '(não achei)');
const [LARG_MIN, LARG, ALT_MIN, ALT_ROT, ALT] = med
  ? [ +med[1], +med[2], +med[3], +med[4], +med[5] ] : [390, 250, 56, 560, 430];
console.log(`     completa ${LARG}×${ALT}   com roteiro ${LARG}×${ALT_ROT}   fita ${LARG_MIN}×${ALT_MIN}`);
/* UMA FITA, E NÃO UMA JANELA MENOR. A primeira tentativa foi a mesma pilha de
   botões, mais curta — e testada em uso ainda era uma janela: o relato foi
   "não dá para reduzir mais ou fazer como um controle de mídia fininho?".
   Um teto em pixels é o que impede a fita de voltar a ser janela sem ninguém
   perceber. 72px é mais alto que um botão de 38 com respiro, e muito mais
   baixo que qualquer pilha de dois. */
ok('e a fita é uma FITA, não uma janela menor', ALT_MIN <= 72,
   ALT_MIN <= 72 ? '' : `${ALT_MIN}px de altura`);

const css = app.slice(app.indexOf('const PIP_CSS = `') + 17).split('`;')[0];
ok('o CSS dela foi encontrado', css.length > 400, String(css.length));

/* O corpo: as linhas de `d.body.innerHTML = ...` concatenadas. */
const corpoSrc = app.slice(app.indexOf('d.body.innerHTML ='));
const corpo = (corpoSrc.slice(0, corpoSrc.indexOf(';\n')).match(/'([^']*)'/g) || [])
  .map((x) => x.slice(1, -1)).join('');
ok('e o corpo também', /class="top"/.test(corpo) && /id="stop"/.test(corpo), corpo.slice(0, 60));

const br = await chromium.launch({ executablePath: CHROME_WS });
const pg = await (await br.newContext({ viewport: { width: LARG, height: ALT } })).newPage();
await pg.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head>` +
                    `<body>${corpo}</body></html>`);
await pg.waitForTimeout(200);

/* O QUE ESTA RÉGUA MEDIA, E POR QUE ELA NÃO PODIA REPROVAR.
   `document.body.scrollHeight` NÃO SOBE ACIMA DA JANELA quando o corpo tem
   `height:100vh` — ele devolve o tamanho da janela, sempre. Ou seja: a
   afirmação "o conteúdo cabe na altura pedida" comparava 392 com 392 e dizia
   ok, com o conteúdo em 416 e o PARAR dez pixels para fora. Ela nunca teve
   como reprovar; era uma tautologia com cara de medida.
   Quem pegava o estouro era a lista `vaza`, e por acaso: ela mede o que passa
   da janela e a última vez que isso importou o PARAR passou. Agora a altura é
   SOMADA — filhos visíveis, mais os respiros entre eles, mais o respiro de
   cima e de baixo — e o número é o de verdade. */
const medir = () => pg.evaluate(() => {
  const b = document.body, cs = getComputedStyle(b);
  const vis = [...b.children].filter((e) => getComputedStyle(e).display !== 'none');
  let soma = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  /* EM LINHA A SOMA É OUTRA. A fita põe os filhos lado a lado, e somar as
     alturas de quem está em linha dá o triplo do que a janela precisa — a
     régua reprovaria um desenho correto. Empilhado soma; em linha, o maior. */
  const emLinha = /row/.test(cs.flexDirection || '');
  if (emLinha) {
    let maior = 0;
    for (const e of vis) maior = Math.max(maior, e.getBoundingClientRect().height);
    soma += maior;
  } else {
    for (const e of vis) soma += e.getBoundingClientRect().height;
    soma += parseFloat(cs.rowGap || 0) * Math.max(0, vis.length - 1);
  }
  return {
    precisa: Math.round(soma), cabe: document.documentElement.clientHeight,
    /* Numa fita o que estoura é a LARGURA, e não a altura: quatro controles
       lado a lado numa janela de 250px. Quem só olhasse para baixo aprovaria
       um PARAR pendurado fora pela direita. */
    precisaLarg: Math.round(b.scrollWidth),
    cabeLarg: document.documentElement.clientWidth,
    vaza: [...document.querySelectorAll('body *')]
      .filter((e) => e.getBoundingClientRect().bottom > innerHeight + 1 ||
                     e.getBoundingClientRect().right > innerWidth + 1)
      .map((e) => e.tagName + (e.id ? '#' + e.id : '')).slice(0, 4),
  };
});

console.log(`\n[1] gravando: cabe em ${LARG}×${ALT}`);
{
  /* Os rótulos são preenchidos pelo JavaScript do produto; aqui eles entram com
     um texto de tamanho realista, que é o que decide se cabe. */
  await pg.evaluate(() => {
    document.body.classList.add('gravando');
    document.querySelector('.txt').textContent = 'Gravando… clique em Parar quando terminar.';
    for (const [id, txt] of [['marcar','Marcar este passo'],
                             ['maisTela','Tela adicional a este passo'],
                             ['pausa','Pausar'],['stop','Parar']]) {
      const b = document.getElementById(id); if (b) { b.textContent = txt; b.disabled = false; }
    }
    /* O BOTÃO DO MICROFONE TEM QUE ESTAR ACESO AQUI.
       Ele nasce escondido, e a régua o media escondido — quer dizer, media uma
       janelinha que só existe para quem grava sem microfone. Quem narra o que
       está fazendo, que é o caso que este produto vende, tem esse botão na
       tela: mais 29px e mais um respiro. Foi exatamente essa a linha que
       empurrou o PARAR para fora sem ninguém ver. */
    const c = document.getElementById('calar');
    if (c) { c.classList.remove('hide'); c.textContent = 'Fechar meu microfone'; }
    /* O bloco da anotação com o texto que ele REALMENTE tem: rótulo cheio,
       campo com duas linhas escritas, botão rotulado e a confirmação de que
       salvou. Medi-lo vazio media outra janela — e a janela que transborda é
       sempre a de quem está usando. */
    const n = document.getElementById('nota');
    if (n) { n.disabled = false; n.value = 'Cliquei em Salvar e o sistema devolveu a mensagem 4711.'; }
    const nl = document.getElementById('notaLbl');
    if (nl) nl.textContent = 'Tela 2 do Passo 3';
    const nk = document.getElementById('notaOk');
    if (nk) { nk.disabled = false; nk.textContent = 'Salvar anotação'; }
    const nm = document.getElementById('notaMsg');
    if (nm) nm.textContent = '✓ salvo neste quadro';
  });
  await pg.waitForTimeout(150);
  const m = await medir();
  ok('o conteúdo cabe na altura pedida', m.precisa <= m.cabe + 1, `${m.precisa} de ${m.cabe}`);
  ok('e nada fica para fora', m.vaza.length === 0, m.vaza.join(' '));
  /* O TETO, e o histórico dele — porque a próxima subida precisa de um motivo
     tão bom quanto os anteriores:

       282 → 300  o segundo botão de marcação;
       300 → 392  a caixa de anotação ganhou rótulo, campo de duas linhas,
                  botão e confirmação. Com 300 o corpo tinha `height:100vh` e
                  `justify-content:center`: o conteúdo maior era cortado nas
                  DUAS pontas, e a de baixo é onde ficam PAUSAR e PARAR. Não
                  era estética — era o botão irreversível fora da janela;
       392 → 486  só quando há roteiro, para a linha do passo atual e a do
                  seguinte. Sem roteiro a janelinha continua nos 392.
       392 → 430  o respiro e os tamanhos de letra pedidos no uso: a janelinha
                  estava legível para quem PARA para ler, e ela é lida de
                  relance, por cima do sistema que a pessoa documenta. Subiram
                  o respiro do corpo (6px → 9px), a margem (11 → 14), o
                  "Marcar este passo" (13.5px → 15.5px) e as duas linhas do
                  roteiro. São 38px, e eles não são de graça: são a diferença
                  entre uma janela que se lê sem parar e uma que cobra atenção
                  no pior momento;
       486 → 560  a mesma conta com o roteiro colado, onde o passo atual passou
                  a 16.5px e o rótulo a 12.5px.

     Cada pixel daqui é um pixel a menos do trabalho que a pessoa está
     documentando, e ainda aparece nos quadros. A largura nunca subiu. */
  ok('a largura não passa de 250', LARG <= 250, String(LARG));
  ok('sem roteiro, a altura fica em 430', ALT <= 430, String(ALT));
  ok('com roteiro ela sobe, e só até 560', ALT_ROT > ALT && ALT_ROT <= 560,
     `${ALT} → ${ALT_ROT}`);
  ok('sem folga desperdiçada', ALT - m.precisa <= 24, `${m.precisa} para ${ALT}`);

  /* O botão de calar NASCE escondido, e `.hide` mora no CSS da ABA — a
     janelinha é outro documento. Sem a regra lá dentro ele aparecia como uma
     caixa vazia de 28px: um botão que não faz nada, ocupando tela da pessoa.
     Ele foi aceso lá em cima para a medida; aqui ele volta ao estado de
     nascença, que é o que esta afirmação cobra. */
  ok('e o botão escondido está mesmo escondido',
     await pg.evaluate(() => {
       const c = document.getElementById('calar');
       c.classList.add('hide');
       const escondido = c.offsetParent === null;
       c.classList.remove('hide');
       return escondido;
     }));
}

console.log(`\n[1a] a fita: cabe em ${LARG_MIN}×${ALT_MIN}, e sobra só o que se usa`);
{
  /* A JANELA MÍNIMA É A QUE TRANSBORDA MAIS FÁCIL, porque é a que tem menos
     folga — e é justamente a que vai ficar por cima do trabalho de quem testa
     numa janela só. Medi-la é o preço de oferecê-la.
     O que tem que sobreviver: os DOIS botões de captura, que são o motivo dela
     existir; o relógio, que é como se sabe que ainda está gravando; e o parar,
     que é a única outra coisa que não pode exigir alt-tab. */
  await pg.setViewportSize({ width: LARG_MIN, height: ALT_MIN });
  await pg.evaluate(() => {
    document.body.className = 'min gravando';
    /* OS RÓTULOS CURTOS, E EM ALEMÃO. Na fita o botão mostra a palavra curta e
       guarda a frase inteira no nome acessível — medir com a frase inteira
       punha a fita em 779px de largura, que é a janela completa deitada.
       E o alemão porque é o mais comprido dos cinco: "Bildschirm" tem onze
       letras onde o português tem quatro. Uma fita medida em português passa
       e estoura na primeira gravação em Berlim. */
    for (const [id, txt] of [['marcar','Markieren'],
                             ['maisTela','+ Bildschirm'],
                             ['pausa','Pause'],['stop','Stopp']]) {
      const b = document.getElementById(id); if (b) { b.textContent = txt; b.disabled = false; }
    }
    const c = document.getElementById('calar');
    if (c) { c.classList.remove('hide'); c.textContent = 'Mikrofon schließen'; }
    const r = document.getElementById('rel'); if (r) r.textContent = '12:34';
  });
  await pg.waitForTimeout(150);
  const m = await medir();
  console.log(`     precisa ${m.precisa}×${m.precisaLarg}px, cabe ${m.cabe}×${m.cabeLarg}px`);
  /* Em linha, e não empilhado: é o que separa a fita de uma janela curta. */
  const emLinha = await pg.evaluate(() =>
    /row/.test(getComputedStyle(document.body).flexDirection));
  ok('os controles ficam lado a lado, e não empilhados', emLinha);
  ok('o conteúdo da mínima cabe na altura pedida', m.precisa <= m.cabe,
     m.precisa <= m.cabe ? '' : `precisa ${m.precisa}, cabe ${m.cabe}`);
  ok('e nada fica para fora', m.vaza.length === 0, m.vaza.join(' '));

  const quem = await pg.evaluate(() => {
    const vis = (id) => { const e = document.getElementById(id);
      return !!(e && getComputedStyle(e).display !== 'none' && e.offsetParent !== null); };
    const visC = (sel) => { const e = document.querySelector(sel);
      return !!(e && getComputedStyle(e).display !== 'none'); };
    return { marcar: vis('marcar'), maisTela: vis('maisTela'), stop: vis('stop'),
             relogio: visC('.top'),
             medidor: visC('.vus'), texto: vis('txt'), nota: visC('.notaCx'),
             pausa: vis('pausa'), calar: vis('calar') };
  });
  console.log('     ' + Object.entries(quem).map(([k, v]) => k + (v ? '=sim' : '=não')).join('  '));
  const fica = quem.marcar && quem.maisTela && quem.stop && quem.relogio;
  ok('sobrevivem os dois botões de captura, o relógio e o parar', fica,
     fica ? '' : JSON.stringify(quem));
  const some = !quem.medidor && !quem.texto && !quem.nota && !quem.pausa && !quem.calar;
  ok('e some o que não se usa quarenta vezes por sessão', some,
     some ? '' : JSON.stringify(quem));

  /* ---- A PALAVRA TEM QUE ESTAR LÁ ----
     A primeira fita era só ícone, e o relato de uso foi "ficou bom, mas não dá
     para saber o que é o que". Um obturador, duas telas e um quadrado, lado a
     lado e sem palavra, são três desenhos para adivinhar — e adivinhar durante
     uma gravação custa o passo.
     Esta linha existe porque a régua NÃO PEGOU esse defeito: eu zerei o
     font-size dos botões, instalando a queixa inteira de volta, e ela passou.
     Uma régua que aprova o defeito que motivou o conserto é uma régua que não
     guarda o conserto. */
  const letra = await pg.evaluate(() => {
    const f = (id) => {
      const e = document.getElementById(id); if (!e) return null;
      return { px: parseFloat(getComputedStyle(e).fontSize),
               txt: (e.textContent || '').trim(),
               larg: Math.round(e.getBoundingClientRect().width) };
    };
    return { marcar: f('marcar'), maisTela: f('maisTela'), stop: f('stop') };
  });
  console.log('     ' + Object.entries(letra)
    .map(([k, v]) => `${k} "${v.txt}" ${v.px}px em ${v.larg}px`).join('   '));
  const legivel = Object.values(letra).every(v => v && v.px >= 9 && v.txt.length > 0);
  ok('cada botão da fita mostra a palavra, e não só o desenho', legivel,
     legivel ? '' : JSON.stringify(letra));
  /* E o desenho continua lá: a palavra volta SOMANDO ao ícone, não no lugar
     dele — é o ícone que se lê de relance e a palavra que tira a dúvida. */
  const temIcone = await pg.evaluate(() => ['marcar', 'maisTela', 'stop'].every((id) => {
    const e = document.getElementById(id); if (!e) return false;
    const m = getComputedStyle(e, '::before');
    return /url\(/.test(m.maskImage || m.webkitMaskImage || '');
  }));
  ok('e o desenho continua ao lado dela', temIcone);

  /* ---- E DEVOLVE A PÁGINA COMO ELA ESTAVA ----
     Este bloco mexe em DOIS estados compartilhados: a classe do corpo e o
     tamanho da janela. Sem desfazer, o bloco [3] media a FITA achando que
     media a janela completa — e acusava "a maior letra dos botões: 0px",
     porque na fita o rótulo tem font-size zero de propósito. Quatro falhas
     inventadas, todas em afirmações que não tinham nada de errado.
     Bloco que muda estado compartilhado devolve o estado. */
  await pg.setViewportSize({ width: LARG, height: ALT });
  await pg.evaluate(() => { document.body.className = 'gravando'; });
  await pg.waitForTimeout(120);
}

console.log('\n[1a2] a palavra curta é para os olhos; o nome é a frase inteira');
{
  /* ---- OS ATALHOS DA JANELINHA ----
     Atalho global não existe para uma página — sem foco, o navegador não
     entrega tecla. Mas a janelinha É uma janela, recebe foco com um clique e
     fica sempre por cima: a partir daí a mão fica no teclado em vez de mirar
     um alvo de 32px quarenta vezes por sessão.
     As letras têm que ser as MESMAS da aba, senão são duas línguas para o
     mesmo gesto. E têm que aparecer em algum lugar: um atalho que não se
     anuncia é um atalho que só quem escreveu conhece. */
  ok('a janelinha escuta o teclado', /pipWin\.document\.addEventListener\('keydown'/.test(app));
  ok('e ignora quem está digitando num campo',
     /alvo\.tagName === 'INPUT' \|\| alvo\.tagName === 'TEXTAREA'/.test(app));
  for (const [letra, alvo] of [["'m'", 'pipMarcar'], ["'t'", 'pipTela'],
                               ["'p'", 'pipPausa'], ["'s'", 'pipFrames']]) {
    ok(`  ${letra} aciona ${alvo}`,
       new RegExp("k === " + letra + "\\) apertar\\(" + alvo).test(app));
  }
  /* `m` é a mesma tecla da aba: `marcar` lá, `marcar` aqui. */
  ok('e o m da aba continua sendo o mesmo gesto',
     /k === 'm' && liveOn/.test(app));
  ok('a letra aparece no nome do botão, senão ninguém a descobre',
     /btn\.title = longo \+ \(letra \? '  \(' \+ letra \+ '\)' : ''\)/.test(app));

  /* Quem usa leitor de tela não ganha nada com "+ Tela". O `aria-label` vence
     o texto de dentro do botão, então o curto fica só para quem vê. */
  ok('a fita rotula por uma função só, e não botão a botão',
     /function rotularPip\(btn, chaveLonga, chaveCurta\)/.test(app));
  ok('o texto visível é o curto só no modo fita',
     /btn\.textContent = min \? curto : longo;/.test(app));
  /* O `title` ganhou a letra do atalho no fim; o NOME ACESSÍVEL continua sendo
     só a frase — `aria-label` vence o texto de dentro, e quem ouve não ganha
     nada com um "(M)" no fim de cada botão. */
  ok('e o nome acessível é sempre a frase inteira, sem a letra',
     /btn\.setAttribute\('aria-label', longo\)/.test(app) &&
     /btn\.title = longo \+/.test(app));
  for (const [id, chave] of [['marcar','pipCurtoMarcar'], ['maisTela','pipCurtoTela'],
                             ['stop','pipCurtoParar']]) {
    const n = (app.match(new RegExp(chave + ":'", 'g')) || []).length;
    ok(`  ${id}: a palavra curta existe nos cinco idiomas`, n === 5, n === 5 ? '' : String(n));
  }
}

console.log(`\n[1b] com roteiro colado: cabe em ${LARG}×${ALT_ROT}`);
{
  /* A OUTRA JANELA, e ela nunca tinha sido medida. O arquivo declarava duas
     alturas e a régua só media uma — a menor. A do roteiro é a que tem mais
     coisa dentro, e o passo atual acabou de ganhar dois pontos de letra. */
  const pg2 = await (await br.newContext({ viewport: { width: LARG, height: ALT_ROT } })).newPage();
  await pg2.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head>` +
                       `<body>${corpo}</body></html>`);
  await pg2.evaluate(() => {
    document.body.classList.add('gravando');
    document.querySelector('.txt').textContent = 'Gravando… clique em Parar quando terminar.';
    for (const [id, txt] of [['marcar','Marcar este passo'],
                             ['maisTela','Tela adicional a este passo'],
                             ['pausa','Pausar'],['stop','Parar']]) {
      const b = document.getElementById(id); if (b) { b.textContent = txt; b.disabled = false; }
    }
    const c = document.getElementById('calar');
    if (c) { c.classList.remove('hide'); c.textContent = 'Fechar meu microfone'; }
    const n = document.getElementById('nota');
    if (n) { n.disabled = false; n.value = 'Cliquei em Salvar e o sistema devolveu a mensagem 4711.'; }
    document.getElementById('notaLbl').textContent = 'Tela 2 do Passo 3';
    const nk = document.getElementById('notaOk');
    if (nk) { nk.disabled = false; nk.textContent = 'Salvar anotação'; }
    document.getElementById('notaMsg').textContent = '✓ salvo neste quadro';
    /* O roteiro no pior caso que ele aceita: o passo atual ocupando as três
       linhas do limite, e o seguinte as duas dele. Um passo curto mediria uma
       janela que ninguém tem. */
    const r = document.getElementById('rot'); r.classList.remove('hide');
    document.getElementById('rotN').textContent = 'PASSO 3 DE 12';
    document.getElementById('rotT').textContent =
      'Abrir a ME21N e conferir se o campo de centro de custo aceita o valor ' +
      'colado da planilha anterior sem devolver erro';
    const rp = document.getElementById('rotP'); rp.classList.remove('hide');
    rp.textContent = 'Depois: gravar o pedido e anotar o número devolvido pelo sistema';
  });
  await pg2.waitForTimeout(150);
  const m2 = await pg2.evaluate(() => {
    const b = document.body, cs = getComputedStyle(b);
    const vis = [...b.children].filter((e) => getComputedStyle(e).display !== 'none');
    let soma = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    for (const e of vis) soma += e.getBoundingClientRect().height;
    soma += parseFloat(cs.rowGap || 0) * Math.max(0, vis.length - 1);
    return { precisa: Math.round(soma), cabe: document.documentElement.clientHeight,
             parar: Math.round(document.getElementById('stop').getBoundingClientRect().bottom) };
  });
  ok('o conteúdo cabe na altura com roteiro', m2.precisa <= m2.cabe + 1,
     `${m2.precisa} de ${m2.cabe}`);
  /* PARAR é o irreversível, e é o último da coluna: ele é quem cai para fora
     primeiro. Medi-lo por nome, e não pela soma, é o que torna o estouro
     legível quando ele voltar. */
  ok('e o PARAR termina dentro da janela', m2.parar > 0 && m2.parar <= m2.cabe + 1,
     `${m2.parar} de ${m2.cabe}`);
  await pg2.close();
}

console.log('\n[2] contando: só o número, e ele é grande');
{
  await pg.evaluate(() => {
    document.body.classList.add('contando');
    const t = document.querySelector('.txt');
    t.classList.add('contando'); t.textContent = '3';
  });
  await pg.waitForTimeout(150);
  const m = await medir();
  const n = await pg.evaluate(() => {
    const t = document.querySelector('.txt');
    return { fs: parseFloat(getComputedStyle(t).fontSize), h: t.getBoundingClientRect().height };
  });
  ok('o número é enorme', n.fs >= 56, String(n.fs));
  ok('e mesmo assim cabe', m.precisa <= m.cabe + 1, `${m.precisa} de ${m.cabe}`);
  const escondidos = await pg.evaluate(() => ['.top', '.vus', '.pe', '.notaCx', '#marcar', '#pausa']
    .filter((s) => { const e = document.querySelector(s); return e && e.offsetParent !== null; }));
  ok('e o resto some — é o que deixa o número ser enorme sem a janela crescer',
     escondidos.length === 0, escondidos.join(' '));
  ok('menos o Parar, que vale desde o primeiro segundo',
     await pg.evaluate(() => document.getElementById('stop').offsetParent !== null));
}

console.log('\n[3] a hierarquia dos botões, que é lida de relance');
{
  /* Esta janela fica POR CIMA do sistema que a pessoa está documentando, e ela
     é olhada de relance, no meio de outra coisa. Tudo aqui é sobre isso:
     tamanho de letra que não obriga a parar, e desenho que se reconhece antes
     da palavra. Nada disto é decoração — é o que separa apertar o botão certo
     de apertar o vermelho por engano.

     A medida é do CSS APLICADO, e não do texto do arquivo: uma regra pode
     existir e ser derrubada por outra mais específica, e é o que a pessoa vê
     que decide. */
  await pg.evaluate(() => {
    document.body.classList.remove('contando');
    document.querySelector('.txt').classList.remove('contando');
    const c = document.getElementById('calar');
    if (c) { c.classList.remove('hide'); c.textContent = 'Fechar meu microfone'; }
  });
  await pg.waitForTimeout(120);
  const b = await pg.evaluate(() => {
    const px = (el, p) => parseFloat(getComputedStyle(el)[p]);
    const g = (id) => {
      const e = document.getElementById(id), cs = getComputedStyle(e);
      const antes = getComputedStyle(e, '::before');
      return {
        fonte: px(e, 'fontSize'),
        fundo: cs.backgroundColor,
        cor: cs.color,
        borda: cs.borderTopWidth,
        /* A máscara é como o desenho chega: sem ela o ::before é uma caixa
           vazia, e uma caixa vazia antes de PARAR é pior do que nada. */
        mascara: (antes.maskImage && antes.maskImage !== 'none')
                 ? antes.maskImage : (antes.webkitMaskImage || 'none'),
        larguraIcone: parseFloat(antes.width) || 0,
      };
    };
    return { marcar: g('marcar'), maisTela: g('maisTela'), pausa: g('pausa'),
             calar: g('calar'), stop: g('stop'),
             rotN: px(document.getElementById('rotN'), 'fontSize'),
             rotT: px(document.getElementById('rotT'), 'fontSize'),
             respiro: px(document.body, 'rowGap'),
             margem: px(document.body, 'paddingTop') };
  });

  /* ---- O RESPIRO ---- */
  ok('o corpo respira entre os blocos', b.respiro >= 8, String(b.respiro) + 'px');
  ok('e tem margem nas bordas', b.margem >= 13, String(b.margem) + 'px');

  /* ---- MARCAR É O MAIOR ---- */
  ok('"Marcar este passo" tem a maior letra dos botões', b.marcar.fonte >= 15,
     String(b.marcar.fonte) + 'px');
  ok('e é maior que a da tela adicional', b.marcar.fonte > b.maisTela.fonte,
     `${b.marcar.fonte} vs ${b.maisTela.fonte}`);

  /* ---- A TELA ADICIONAL É DA FAMÍLIA, E É A SEGUNDA ----
     Contorno cinza a colocava junto do pausar e do calar, que são de outra
     natureza: aqueles mexem na gravação, estes dois GUARDAM o que a pessoa
     veio guardar. Agora ela é azul — e mais clara, porque inverter a
     hierarquia faria escolher entre iguais no meio de uma gravação. */
  const azul = (c) => /rgba?\(\s*1[01]\d\s*,\s*1[12]\d\s*,\s*2[34]\d/.test(c);
  ok('a tela adicional é colorida, e não um contorno cinza',
     azul(b.maisTela.fundo) || azul(b.maisTela.cor), b.maisTela.fundo + ' / ' + b.maisTela.cor);
  ok('mas não é o azul cheio do marcar: ela é a segunda',
     b.maisTela.fundo !== b.marcar.fundo, b.maisTela.fundo);
  ok('e o pausar continua fora dessa família',
     !azul(b.pausa.fundo), b.pausa.fundo);

  /* ---- OS TRÊS COMANDOS TÊM DESENHO ---- */
  for (const [id, nome] of [['pausa','Pausar'], ['calar','o microfone'], ['stop','Parar']]) {
    ok(`${nome} tem um desenho antes da palavra`,
       /svg/i.test(b[id].mascara) && b[id].larguraIcone >= 10,
       b[id].mascara.slice(0, 40) + ' | ' + b[id].larguraIcone + 'px');
  }
  /* Desenho E palavra. Um ícone sozinho é adivinhação, e o botão irreversível
     desta janela não pode depender de adivinhação. */
  ok('e a palavra continua lá',
     await pg.evaluate(() => ['pausa','calar','stop']
       .every((i) => (document.getElementById(i).textContent || '').trim().length > 2)));
  /* O desenho vem da cor do próprio texto: pausado e microfone fechado ficam
     vermelhos, e o desenho acompanha sem uma segunda lista de cores. */
  ok('o desenho toma a cor do texto do botão',
     await pg.evaluate(() => {
       const e = document.getElementById('pausa');
       const c1 = getComputedStyle(e, '::before').backgroundColor;
       e.classList.add('off');
       const c2 = getComputedStyle(e, '::before').backgroundColor;
       e.classList.remove('off');
       return c1 !== c2;
     }));
  /* Pausado ele oferece o oposto, e o desenho vira a seta — porque o rótulo
     virou "Retomar". Um botão que diz retomar com duas barras de pausa
     desenhadas nele mente sobre o que vai acontecer. */
  ok('pausado, o desenho vira a seta de retomar',
     await pg.evaluate(() => {
       const e = document.getElementById('pausa');
       const antes = getComputedStyle(e, '::before').maskImage;
       e.classList.add('off');
       const depois = getComputedStyle(e, '::before').maskImage;
       e.classList.remove('off');
       return antes !== depois;
     }));

  /* ---- O ROTEIRO, QUE É O QUE SE LÊ ANTES DE AGIR ---- */
  ok('o passo atual é a maior letra da janela', b.rotT >= 16, String(b.rotT) + 'px');
  ok('e o rótulo "passo" acompanha', b.rotN >= 12, String(b.rotN) + 'px');
  ok('mas o seguinte continua menor que o atual',
     await pg.evaluate(() => parseFloat(getComputedStyle(document.getElementById('rotP')).fontSize))
       < b.rotT);
}

console.log('\n[4] o nome do segundo botão, nos cinco idiomas');
{
  /* "Mais uma tela deste passo" virou "Tela adicional a este passo" — e um nome
     que muda em um idioma só é a forma mais barata de o produto passar a dizer
     duas coisas diferentes. */
  const ESPERADO = {
    pt: 'Tela adicional a este passo',
    en: 'Additional screen for this step',
    es: 'Pantalla adicional de este paso',
    de: 'Zusätzlicher Bildschirm zu diesem Schritt',
    fr: 'Écran supplémentaire pour cette étape',
  };
  for (const [L, txt] of Object.entries(ESPERADO)) {
    ok(`${L}: ${txt}`, app.includes(`recTelaBtn:'${txt}'`), '(não achei)');
  }
  ok('e o nome antigo não sobrou em lugar nenhum',
     !/recTelaBtn:'[^']*(ais uma tela|ne more screen|na pantalla más|och ein Bildschirm|e plus pour)/
       .test(app));
}

await br.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nJanelinha de controle: tudo passou.');
process.exit(falhas ? 1 : 0);

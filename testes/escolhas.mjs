/* AS ESCOLHAS DO CARTÃO DE GRAVAR — o que se decide antes, e o que não.
 *
 * Este arquivo nasceu no Build 26 medindo uma prévia gráfica das duas
 * janelinhas, desenhada dentro do cartão de gravar. O Build 27 apagou aquela
 * prévia, e o motivo é a razão de ser desta régua:
 *
 *   O cartão tinha 821px, dos quais 442 (54%) eram a escolha do tamanho da
 *   janelinha — contra 45px do botão "Gravar a tela". O relato foi direto:
 *   "gravar a tela e as várias decisões se impõem somente depois". A
 *   janelinha NÃO EXISTE até a pessoa gravar; escolher o tamanho dela antes é
 *   escolher entre duas coisas que ninguém viu, e ILUSTRAR essa escolha foi
 *   tratar o sintoma — some a adivinhação, fica o volume.
 *
 * O que esta régua cobra agora é o contrário do que ela cobrava: que o cartão
 * NÃO peça mais o tamanho, que os ajustes fiquem recolhidos dizendo o que têm
 * dentro, e que a pergunta da transcrição responda com UMA nota e não três.
 *
 * O botão que trocou de lugar — o de virar fita, dentro da própria janelinha —
 * é medido pelo `janelinha.mjs`, que é quem monta aquela janela.
 *
 *   node testes/escolhas.mjs
 */
import { chromium } from './_navegador.mjs';
import http from 'http'; import fs from 'fs';
import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';

const PORTA = 8989;
const BASE = `http://localhost:${PORTA}`;
const APP = fs.readFileSync(`${RAIZ_WS}/public/app.html`, 'utf8');

let falhas = 0;
const ok = (n, c, e) => { console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : '')); if (!c) falhas++; };

const srv = http.createServer((q, r) => {
  if (q.url.split('?')[0].startsWith('/_vercel/')) {
    r.writeHead(200, { 'Content-Type': 'text/javascript' }); return r.end('');
  }
  r.writeHead(200, { 'Content-Type': 'text/html' }); r.end(APP);
});
await new Promise((r) => srv.listen(PORTA, r));

/* Os textos saem do próprio app, e não escritos aqui: uma lista escrita na
   régua aprova exatamente o erro que ela deveria pegar. */
const textoDe = (chave) => {
  const m = APP.match(new RegExp(chave + ":'([^']*)'"));
  return m ? m[1] : '';
};

const br = await chromium.launch({ executablePath: CHROME_WS });

/* O MODELO DE VOZ, CONTADO. Ele é buscado num repositório público; aqui todo
   pedido para fora é cortado e anotado — é o mesmo desenho do `semrede.mjs`, e
   pelo mesmo motivo: contar o que o app tentou buscar é a única forma de saber
   se a escolha "só as telas" economiza o download que ela promete economizar. */
const modelo = [];
const ctx = await br.newContext({ viewport: { width: 1320, height: 1000 }, serviceWorkers: 'block' });
await ctx.route('**/*', (rota) => {
  const u = rota.request().url();
  if (u.startsWith(BASE) || u.startsWith('data:') || u.startsWith('blob:')) return rota.continue();
  if (/huggingface|hf\.co|onnx-community|whisper/i.test(u)) modelo.push(u);
  return rota.abort();
});

const pg = await ctx.newPage();
const erros = []; pg.on('pageerror', (e) => erros.push(e.message));
await pg.goto(`${BASE}/app.html?lang=pt`);
await pg.waitForTimeout(900);
/* O cartão de gravar nasce escondido até a pessoa escolher o caminho; abrir
   pela classe é o que os outros testes fazem, e não muda comportamento nenhum. */
await pg.evaluate(() => { const v = document.getElementById('viaRec'); if (v) v.classList.remove('hide'); });
await pg.waitForTimeout(700);

console.log('[1] o cartão de gravar não decide mais pela janelinha');
{
  const cartao = await pg.evaluate(() => {
    const c = document.getElementById('viaRec');
    return {
      escolhaDeTamanho: !!document.getElementById('pipTamBox'),
      previa: document.querySelectorAll('#viaRec iframe').length,
      botao: !!document.getElementById('rec'),
      altura: Math.round(c.getBoundingClientRect().height),
      alturaBotao: Math.round(document.getElementById('rec').getBoundingClientRect().height),
    };
  });
  console.log(`     cartão ${cartao.altura}px, botão ${cartao.alturaBotao}px`);
  ok('a escolha do tamanho saiu do cartão', !cartao.escolhaDeTamanho);
  ok('e as prévias desenhadas também', cartao.previa === 0, String(cartao.previa));
  ok('o botão de gravar continua lá', cartao.botao);
  /* O NÚMERO É A AFIRMAÇÃO. Sem um teto, a próxima decisão que alguém achar
     importante volta a crescer aqui dentro — foi assim que 442px de escolha
     nasceram ao lado de um botão de 45. 620px dá folga para o cartão respirar
     e reprova antes de ele virar formulário de novo. */
  ok('e o cartão cabe em 620px', cartao.altura <= 620, `${cartao.altura}px`);
}

console.log('\n[2] os ajustes ficam recolhidos, e a gaveta diz o que tem dentro');
{
  const g = await pg.evaluate(() => {
    const d = document.getElementById('recAjustes');
    return d ? { aberta: d.open, resumo: (document.getElementById('recAjustesEst') || {}).textContent || '',
                 dentro: d.querySelectorAll('input, button').length } : null;
  });
  ok('a gaveta existe', !!g);
  if (g) {
    console.log(`     resumo: ${JSON.stringify(g.resumo)}  (${g.dentro} controles dentro)`);
    /* FECHADA — LIDO DO ARQUIVO SERVIDO, e não do DOM. O `_navegador.mjs`
       abre TODOS os `details.sub` de propósito, para o resto da suíte poder
       medir o que está dentro deles; perguntar ao DOM aqui responderia sobre a
       régua, e não sobre o produto. O que decide o estado inicial é o atributo
       `open` na marcação — e é ele que se lê. */
    const tag = (APP.match(/<details[^>]*id="recAjustes"[^>]*>/) || [''])[0];
    ok('  e nasce FECHADA (sem `open` na marcação)', !!tag && !/\bopen\b/.test(tag),
       tag || '(não achei a marcação)');
    /* FECHAR NÃO PODE SER ESCONDER. O resumo é a diferença entre as duas
       coisas: quem não vai mexer lê o estado sem abrir. */
    ok('  com o estado escrito no resumo', /45/.test(g.resumo), g.resumo);
    ok('  e os controles continuam lá dentro', g.dentro >= 2, String(g.dentro));
  }

  /* E O RESUMO SAI DOS CONTROLES DE VERDADE. Se ele fosse um texto guardado à
     parte, diria "45 min" com 90 escrito no campo — e uma gaveta que mente
     sobre o que tem dentro é pior que uma gaveta muda. */
  await pg.fill('#recAutoMin', '90');
  await pg.waitForTimeout(250);
  const depois = await pg.evaluate(() => (document.getElementById('recAjustesEst') || {}).textContent || '');
  ok('  e ele acompanha o que está escrito no campo', /90/.test(depois), depois);
  await pg.uncheck('#recAuto');
  await pg.waitForTimeout(250);
  const semParar = await pg.evaluate(() => (document.getElementById('recAjustesEst') || {}).textContent || '');
  ok('  inclusive quando a opção é desligada',
     semParar.trim() === textoDe('recAjustesNaoPara'), semParar);
  await pg.check('#recAuto');
  await pg.fill('#recAutoMin', '45');
  await pg.waitForTimeout(200);
}

console.log('\n[3] a transcrição responde com UMA nota, e não com três');
{
  const notas = () => pg.evaluate(() => ['recTrNote', 'prontaNote', 'semTrNote'].map((i) => {
    const e = document.getElementById(i);
    return !!(e && getComputedStyle(e).display !== 'none' && e.textContent.trim());
  }));
  const inicio = await notas();
  ok('só a nota da opção escolhida aparece', inicio.filter(Boolean).length === 1,
     JSON.stringify(inicio));
  await pg.locator('#semTr').check();
  await pg.waitForTimeout(250);
  const depois = await notas();
  ok('e ela SEGUE a escolha, em vez de acender uma segunda',
     depois.filter(Boolean).length === 1 && depois[2], JSON.stringify(depois));
  /* Esconder não é apagar: o texto das outras continua escrito e volta no
     instante em que a escolha muda. */
  await pg.locator('#recTr').check();
  await pg.waitForTimeout(250);
  const volta = await notas();
  ok('e a de antes volta quando a escolha volta', volta.filter(Boolean).length === 1 && volta[0],
     JSON.stringify(volta));
}

console.log('\n[4] o selo "recomendado" tem UM dono, e o dono é o cenário');
{
  /* Ele estava em DUAS das três opções ao mesmo tempo, e um selo em dois
     lugares não recomenda nada: vira enfeite. Qual das duas é a recomendada
     não é gosto — depende de a pessoa ter, ou não, um arquivo pronto. E a tela
     sabe: quem escolheu `ata` está documentando uma reunião, e reunião do Meet,
     do Teams ou do Zoom já sai transcrita de lá, de graça e melhor. */
  const selos = () => pg.evaluate(() => ['optTr', 'optPronta'].map((i) => {
    const e = document.getElementById(i);
    return !!(e && (e.textContent || '').trim());
  }));
  await pg.selectOption('#modelo', 'evidencia');
  await pg.waitForTimeout(300);
  const emEvidencia = await selos();
  ok('numa evidência, o selo é do "transcrever aqui"',
     emEvidencia[0] && !emEvidencia[1], JSON.stringify(emEvidencia));
  await pg.selectOption('#modelo', 'ata');
  await pg.waitForTimeout(300);
  const emAta = await selos();
  ok('numa ata de reunião, ele muda de dono',
     !emAta[0] && emAta[1], JSON.stringify(emAta));
  /* NUNCA OS DOIS, em cenário nenhum. É a afirmação que o defeito violava. */
  const tudo = [];
  for (const cen of ['evidencia', 'tutorial', 'ata', 'usabilidade', 'ia']) {
    await pg.selectOption('#modelo', cen);
    await pg.waitForTimeout(200);
    const s2 = await selos();
    tudo.push(`${cen}:${s2.filter(Boolean).length}`);
  }
  console.log('     ' + tudo.join('  '));
  ok('e em nenhum cenário aparecem dois', tudo.every((x) => x.endsWith(':1')), tudo.join(' '));
  /* E "só as telas" não leva selo em lugar nenhum: ela é o caminho de quem não
     tem fala para documentar, e recomendá-la a quem tem seria vender a menos. */
  const naTerceira = await pg.evaluate(() => {
    const l = document.getElementById('semTr').closest('label');
    return !!l && !!l.querySelector('.optNota');
  });
  ok('a terceira opção não leva selo nenhum', !naTerceira);
  await pg.selectOption('#modelo', 'evidencia');
  await pg.waitForTimeout(200);
}

console.log('\n[5] a transcrição tem TRÊS escolhas, e são exclusivas');
{
  const trio = await pg.evaluate(() => ['recTr', 'usarPronta', 'semTr'].map((id) => {
    const e = document.getElementById(id);
    return e ? { id, tipo: e.type, grupo: e.name, marcado: e.checked } : { id, tipo: '(ausente)' };
  }));
  console.log('     ' + trio.map((x) => `${x.id}:${x.tipo}${x.marcado ? '*' : ''}`).join('  '));
  ok('as três existem, e são do mesmo grupo',
     trio.every((x) => x.tipo === 'radio') && new Set(trio.map((x) => x.grupo)).size === 1,
     trio.map((x) => x.tipo + '/' + x.grupo).join(' | '));
  ok('e uma delas já vem escolhida — não há estado sem nome',
     trio.filter((x) => x.marcado).length === 1,
     String(trio.filter((x) => x.marcado).length));

  await pg.locator('#semTr').check();
  await pg.waitForTimeout(250);
  const depois = await pg.evaluate(() => ({
    tr: document.getElementById('recTr').checked,
    pronta: document.getElementById('usarPronta').checked,
    sem: document.getElementById('semTr').checked,
    nota: (document.getElementById('semTrNote') || {}).textContent || '',
  }));
  ok('escolher "só as telas" desmarca as outras duas',
     depois.sem && !depois.tr && !depois.pronta, JSON.stringify(depois).slice(0, 90));
  /* A NOTA MUDA. Uma opção que se escolhe e não responde nada parece não ter
     sido registrada — e a nota é a única resposta que esta tela dá. */
  ok('e a nota dela passa a explicar o que vai acontecer',
     depois.nota.trim() === textoDe('semTrOn').replace(/\\'/g, "'"),
     depois.nota.slice(0, 70));
}

console.log('\n[6] e "só as telas" não busca o modelo de voz');
{
  const antes = modelo.length;
  await pg.locator('#semTr').check();
  await pg.waitForTimeout(1500);
  const semTr = modelo.length - antes;
  console.log(`     pedidos ao repositório do modelo: ${antes} até aqui, +${semTr} com "só as telas"`);
  ok('escolher "só as telas" não pede o modelo', semTr === 0, `+${semTr}`);

  /* E O CONTROLE QUE DÁ SENTIDO AO ZERO: voltar para "transcrever aqui" PEDE.
     Sem esta linha, um zero provaria só que a régua não estava olhando. */
  const antes2 = modelo.length;
  await pg.locator('#recTr').check();
  await pg.waitForTimeout(2500);
  const comTr = modelo.length - antes2;
  console.log(`     +${comTr} ao voltar para "transcrever enquanto gravo"`);
  ok('e voltar para "transcrever aqui" pede', comTr > 0, `+${comTr}`);
}

console.log('\n[7] e a escolha é lembrada — a próxima visita não paga o modelo');
{
  /* ESTE BLOCO NASCEU DE UM ACHADO DA PRÓPRIA RÉGUA. O bloco [4] mostrou que
     escolher "só as telas" não pede o modelo — e, ao tentar instalar o defeito
     que o derrubasse, apareceu a razão de verdade: o download começa 1,2 s
     depois de a página ABRIR, com "transcrever aqui" marcado por padrão. A
     escolha não era guardada, então quem nunca quer transcrever pagava 206 MB
     em toda visita.
     O que se cobra aqui é a memória: escolhida a terceira opção, uma visita
     nova abre nela E NÃO BUSCA O MODELO. Sem esta afirmação, a opção seria um
     rótulo bonito em cima do mesmo download. */
  await pg.evaluate(() => { const k = Object.keys(localStorage).find((k) => /transcricaoModo/.test(k)); return k; });
  await pg.locator('#semTr').check();
  await pg.waitForTimeout(300);
  const gravado = await pg.evaluate(() => {
    const k = Object.keys(localStorage).find((k) => /transcricaoModo/.test(k));
    return k ? localStorage.getItem(k) : '(nada)';
  });
  ok('a escolha fica guardada', gravado === 'nenhuma', gravado);

  const antes = modelo.length;
  await pg.reload();
  /* O adiantamento acontece 1200 ms depois de abrir; 3 s dá folga de sobra sem
     transformar a régua numa espera. */
  await pg.waitForTimeout(3000);
  const nova = modelo.length - antes;
  const marcado = await pg.evaluate(() => document.getElementById('semTr').checked);
  ok('a visita nova abre em "só as telas"', marcado);
  ok('e ela NÃO busca o modelo de voz', nova === 0, `+${nova} pedidos`);

  /* O CONTROLE: com "transcrever aqui" guardado, a mesma visita nova PEDE. É o
     que separa "a memória funciona" de "a régua parou de olhar".
     E ele precisa de um GESTO desde o Build 28: o adiantamento deixou de ser um
     relógio e passou a esperar a pessoa. Sem o clique abaixo este controle
     mediria a trava nova em vez da memória, e passaria pelo motivo errado. */
  await pg.locator('#recTr').check();
  await pg.waitForTimeout(300);
  const antes2 = modelo.length;
  await pg.reload();
  await pg.mouse.click(400, 400);
  await pg.waitForTimeout(3000);
  const nova2 = modelo.length - antes2;
  ok('e com "transcrever aqui" guardado, ela pede', nova2 > 0, `+${nova2} pedidos`);
}

console.log('\n[8] e o modelo só desce depois que alguém mexe na página');
{
  /* A QUARTA RECUSA. As outras três — `saveData`, 2g e conexão medida — cuidam
     de quem AVISOU que não quer gastar dados. Esta cuida de quem não avisou
     nada porque acabou de chegar: quem abriu para ver o que o produto é, e
     fechou, não deve 206 MB a ninguém.
     Este bloco sobe uma aba NOVA e limpa, porque o resto do arquivo já mexeu
     em tudo — e "não desce sem gesto" só se mede antes do primeiro gesto. */
  const limpo = await br.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  const pedidos = [];
  await limpo.route('**/*', (rota) => {
    const u = rota.request().url();
    if (u.startsWith(BASE) || u.startsWith('data:') || u.startsWith('blob:')) return rota.continue();
    if (/huggingface|hf\.co|onnx-community|whisper/i.test(u)) pedidos.push(u);
    return rota.abort();
  });
  const p2 = await limpo.newPage();
  await p2.goto(`${BASE}/app.html?lang=pt`);
  /* Quatro segundos: o adiantamento espera 1200 ms DEPOIS do gesto, e sem
     gesto nenhum não há relógio correndo. */
  await p2.waitForTimeout(4000);
  const parado = pedidos.length;
  ok('parada, a página não busca o modelo', parado === 0, `${parado} pedidos`);

  /* E O CONTROLE, que é o que dá sentido ao zero: um clique de verdade e ele
     desce. Sem esta linha, o zero acima poderia ser a régua não olhando. */
  await p2.mouse.click(500, 400);
  await p2.waitForTimeout(4000);
  const depois = pedidos.length - parado;
  console.log(`     sem gesto: ${parado} · depois de um clique: +${depois}`);
  ok('e ao primeiro gesto de verdade, desce', depois > 0, `+${depois}`);
  await limpo.close();
}

ok('sem erro de JavaScript', erros.length === 0, erros.join(' | ').slice(0, 200));

await br.close(); srv.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nEscolhas do cartão: a ação primeiro, as decisões depois.');
process.exit(falhas ? 1 : 0);

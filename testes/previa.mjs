/* AS DUAS ESCOLHAS DO CARTÃO DE GRAVAR, COM A CARA DELAS.
 *
 * Duas mudanças do Build 26, e as duas são sobre a mesma coisa: uma escolha que
 * a pessoa faz sem ver o que está escolhendo.
 *
 *   1. O TAMANHO DA JANELINHA era um `<select>` com duas frases. Frase não
 *      responde "quanta tela isto vai me tomar", que é a pergunta inteira de
 *      quem escolhe entre uma fita e uma janela. Agora são duas opções, cada
 *      uma mostrando a janelinha DE VERDADE — mesmo HTML, mesmo CSS, num
 *      iframe reduzido na mesma escala.
 *
 *      E é aqui que esta régua tem trabalho: uma prévia desenhada à mão seria
 *      uma segunda lista, e no dia em que um botão mudasse de lugar ela
 *      continuaria mostrando a janela antiga. O que se cobra abaixo é que a
 *      prévia mostre o que a janela mostra, e que cada uma use os rótulos do
 *      SEU tamanho — o curto na fita, a frase inteira na completa.
 *
 *   2. A TRANSCRIÇÃO eram duas caixas de marcar com um terceiro estado
 *      escondido: desmarcar as duas queria dizer "não transcrever", e ninguém
 *      escreveu isso em lugar nenhum. Agora são três opções com nome, e a
 *      terceira — "só as telas" — é cobrada onde ela importa: escolhendo-a,
 *      o modelo de voz NÃO é buscado.
 *
 *   node testes/previa.mjs
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

/* Os rótulos saem do próprio app, e não escritos aqui: uma lista escrita na
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

console.log('[1] as duas prévias mostram a janelinha de verdade');
{
  const dentro = await pg.evaluate(() => {
    const ler = (id) => {
      const f = document.getElementById(id);
      const d = f && f.contentDocument;
      if (!d || !d.body) return null;
      return {
        classe: d.body.className,
        botoes: [...d.querySelectorAll('button')].map((b) => b.textContent).filter(Boolean),
        relogio: (d.getElementById('rel') || {}).textContent || '',
        temMedidor: !!d.querySelector('.vus'),
        temNota: !!d.querySelector('.notaCx'),
        larguraPedida: parseInt(f.style.width, 10),
        alturaPedida: parseInt(f.style.height, 10),
        molduraLarg: Math.round(f.parentElement.getBoundingClientRect().width),
        molduraAlt: Math.round(f.parentElement.getBoundingClientRect().height),
      };
    };
    return { completa: ler('pipPrevFull'), fita: ler('pipPrevStrip') };
  });
  ok('a prévia da janela completa foi desenhada', !!dentro.completa, dentro.completa ? '' : '(vazia)');
  ok('a prévia da fita foi desenhada', !!dentro.fita, dentro.fita ? '' : '(vazia)');
  if (dentro.completa && dentro.fita) {
    console.log(`     completa ${dentro.completa.larguraPedida}×${dentro.completa.alturaPedida}` +
                ` na moldura ${dentro.completa.molduraLarg}×${dentro.completa.molduraAlt}`);
    console.log(`     fita     ${dentro.fita.larguraPedida}×${dentro.fita.alturaPedida}` +
                ` na moldura ${dentro.fita.molduraLarg}×${dentro.fita.molduraAlt}`);

    /* A FITA É DEITADA E A JANELA É DE PÉ. É o que a prévia existe para
       mostrar, e é a única coisa que não dá para errar sem que a comparação
       perca o sentido. */
    ok('a fita é mais larga que alta', dentro.fita.larguraPedida > dentro.fita.alturaPedida * 3);
    ok('e a completa é mais alta que larga', dentro.completa.alturaPedida > dentro.completa.larguraPedida);
    /* E AS DUAS ESTÃO NA MESMA RÉGUA. Escalas diferentes fariam a fita parecer
       grande ou a janela parecer pequena — e a comparação viraria propaganda. */
    const e1 = dentro.completa.molduraLarg / dentro.completa.larguraPedida;
    const e2 = dentro.fita.molduraLarg / dentro.fita.larguraPedida;
    ok('as duas reduzidas na MESMA escala', Math.abs(e1 - e2) < 0.02,
       `${e1.toFixed(3)} × ${e2.toFixed(3)}`);
    ok('e reduzidas de verdade — a moldura é menor que a janela', e1 < 0.9, e1.toFixed(3));

    /* OS RÓTULOS DE CADA TAMANHO. Este é o coração: a fita mostra a palavra
       curta e a completa mostra a frase inteira, e as duas aparecem ao mesmo
       tempo na tela. Se a prévia usasse o modo escolhido em vez do próprio,
       uma das duas estaria mentindo sempre. */
    const curtoMarcar = textoDe('pipCurtoMarcar');
    const longoMarcar = textoDe('recMarkBtn');
    ok('a régua leu os dois rótulos do app', !!curtoMarcar && !!longoMarcar,
       `${curtoMarcar} × ${longoMarcar}`);
    ok('a fita usa o rótulo CURTO', dentro.fita.botoes.includes(curtoMarcar),
       dentro.fita.botoes.join(' | '));
    ok('e a completa usa a frase INTEIRA', dentro.completa.botoes.includes(longoMarcar),
       dentro.completa.botoes.join(' | '));

    /* E o que a fita ABRE MÃO aparece na prévia da completa: medidor de som e
       caixa de anotação. A frase dizia isso; agora dá para ver. */
    ok('a completa mostra o medidor e a caixa de anotação',
       dentro.completa.temMedidor && dentro.completa.temNota);
    ok('as duas mostram a janelinha gravando, e não parada',
       /gravando/.test(dentro.completa.classe) && /gravando/.test(dentro.fita.classe),
       `${dentro.completa.classe} × ${dentro.fita.classe}`);
    ok('e a fita é a fita — a prévia carrega a classe `min`', /\bmin\b/.test(dentro.fita.classe),
       dentro.fita.classe);
  }
}

console.log('\n[2] escolher o tamanho marca, guarda e volta guardado');
{
  await pg.locator('#pipTamStrip').check();
  await pg.waitForTimeout(300);
  const guardado = await pg.evaluate(() => {
    const k = Object.keys(localStorage).find((k) => /janelinhaModo/.test(k));
    return k ? localStorage.getItem(k) : '(nada)';
  });
  ok('escolher a fita guarda a escolha', guardado === 'min', guardado);
  await pg.reload();
  await pg.waitForTimeout(800);
  await pg.evaluate(() => { const v = document.getElementById('viaRec'); if (v) v.classList.remove('hide'); });
  await pg.waitForTimeout(400);
  const volta = await pg.evaluate(() => ({
    fita: document.getElementById('pipTamStrip').checked,
    completa: document.getElementById('pipTamFull').checked,
  }));
  ok('e ela volta marcada depois de recarregar', volta.fita && !volta.completa, JSON.stringify(volta));
}

console.log('\n[3] a transcrição tem TRÊS escolhas, e são exclusivas');
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

console.log('\n[4] e "só as telas" não busca o modelo de voz');
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

console.log('\n[5] e a escolha é lembrada — a próxima visita não paga o modelo');
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
     que separa "a memória funciona" de "a régua parou de olhar". */
  await pg.locator('#recTr').check();
  await pg.waitForTimeout(300);
  const antes2 = modelo.length;
  await pg.reload();
  await pg.waitForTimeout(3000);
  const nova2 = modelo.length - antes2;
  ok('e com "transcrever aqui" guardado, ela pede', nova2 > 0, `+${nova2} pedidos`);
}

ok('sem erro de JavaScript', erros.length === 0, erros.join(' | ').slice(0, 200));

await br.close(); srv.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nPrévia e escolhas: o que se escolhe está à vista.');
process.exit(falhas ? 1 : 0);

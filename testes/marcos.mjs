/* A AFERIÇÃO DA RÉGUA — os marcos existem, e dizem a verdade.
 *
 * `testes/regua.mjs` mede; este arquivo prova que o que ela lê tem sentido. Sem
 * ele, a instrumentação seria a única parte do produto sem régua — e uma medida
 * errada é pior que medida nenhuma, porque decide.
 *
 * Ele roda SEM REDE. A biblioteca do Whisper é falsificada, como em
 * `parar.mjs` e `modelo.mjs`, e a falsificação faz de propósito o que a máquina
 * real faz por acidente: OS DOIS PRIMEIROS DEGRAUS FALHAM. É esse o caso que
 * interessa — a escada existe porque máquinas reais descem por ela, e uma
 * medição que só soubesse contar o degrau vencedor esconderia justamente o
 * desperdício que se quer enxergar (uma máquina real gastou 353 MB antes de
 * uma sessão subir).
 *
 * O que este arquivo cobra:
 *
 *   1. os oito marcos que o plano pediu existem e estão em ordem;
 *   2. a escada registra os degraus PERDIDOS, com megabytes e tudo;
 *   3. cada degrau separa o tempo de rede do tempo de montar a sessão;
 *   4. cache quente e cache frio saem diferentes na medida;
 *   5. a razão "áudio enviado ÷ áudio original" existe e é plausível;
 *   6. nada disso sai da máquina;
 *   7. nenhum erro de JS.
 *
 *   node testes/marcos.mjs
 */
import { chromium } from './_navegador.mjs';
import http from 'http'; import fs from 'fs';
import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';

const html = fs.readFileSync(RAIZ_WS + '/public/app.html', 'utf8');
const srv = http.createServer((q, r) => {
  if (q.url.startsWith('/_vercel/')) {
    r.writeHead(200, { 'Content-Type': 'text/javascript' }); return r.end('');
  }
  r.writeHead(200, { 'Content-Type': 'text/html' }); r.end(html);
});
await new Promise(r => srv.listen(8973, r));

let falhas = 0;
const ok = (n, c, e) => {
  console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : ''));
  if (!c) falhas++;
};

/* A ESCADA FALSIFICADA.
 *
 * Duas quedas e uma subida. As quedas usam a mensagem de erro de sessão de
 * verdade — é a que o produto reconhece — e a subida vem com progresso de
 * download e uma pausa DEPOIS do último byte, que é o que separa "esperei a
 * rede" de "esperei o runtime montar". Sem essa pausa, `ms_sessao` sairia zero
 * e o teste passaria sem testar. */
const BIBLIOTECA_FALSA = `
globalThis.__degrau = globalThis.__degrau || 0;
export const env = {
  allowLocalModels: true, allowRemoteModels: true,
  backends: { onnx: { wasm: { numThreads: 1, wasmPaths: undefined, proxy: false } } }
};
const dorme = ms => new Promise(r => setTimeout(r, ms));
export async function pipeline(tarefa, modelo, opcoes){
  const n = globalThis.__degrau++;
  if (n < 2) {
    await dorme(30);
    throw new Error('Failed to load model because protobuf parsing failed. (degrau ' + n + ')');
  }
  /* Download em três pedaços, com o total conhecido desde o primeiro: é o
     caminho comum, e o que exercita o piso da porcentagem. */
  const total = 12 * 1048576;
  for (const parte of [0.3, 0.7, 1]) {
    await dorme(60);
    if (opcoes && opcoes.progress_callback)
      opcoes.progress_callback({ file: 'onnx/model_q8.onnx', status: 'progress',
                                 loaded: Math.round(total * parte), total });
  }
  /* A montagem da sessão, depois do último byte. */
  await dorme(250);
  const p = async () => { await dorme(40); return { text: 'fala de prova', chunks: [] }; };
  p.dispose = async () => {};
  return p;
}
`;

const br = await chromium.launch({ executablePath: CHROME_WS });

/** Uma corrida inteira: abre, carrega, transcreve, devolve `__medidas()`. */
async function corrida({ ctx, semearCache }) {
  const pg = await ctx.newPage();
  const erros = []; pg.on('pageerror', e => erros.push(e.message));
  const enviados = [];
  await pg.route('**/rpc/walkstamp_evento', r => {
    enviados.push(r.request().postData() || '');
    r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, body: 'null' });
  });
  await pg.route('**/@huggingface/transformers**', r => r.fulfill({
    status: 200, headers: { 'content-type': 'text/javascript' }, body: BIBLIOTECA_FALSA }));
  await pg.goto('http://localhost:8973/app.html?lang=pt');

  /* O CACHE QUENTE, SEMEADO À MÃO. A biblioteca falsa não escreve na Cache
     Storage — ela nem baixa nada de verdade —, então o único jeito honesto de
     provar que o produto DISTINGUE quente de frio é pôr lá dentro o que um
     download de verdade poria: uma entrada num cache com "transformers" no
     nome, cuja URL contém o modelo escolhido. É o que `modeloEmCache` procura. */
  if (semearCache) {
    await pg.evaluate(async () => {
      const id = document.getElementById('model').value;
      const c = await caches.open('transformers-cache');
      await c.put(new Request('https://exemplo.invalido/' + id + '/onnx/model_q8.onnx'),
                  new Response('x'));
    });
  }

  /* A varredura não é o assunto: três quadros bastam, e mexer nos controles já
     cancela o agendamento automático dela. */
  await pg.selectOption('#mode', 'count').catch(() => {});
  await pg.fill('#count', '3').catch(() => {});
  await pg.locator('#recTr').uncheck().catch(() => {});
  await pg.setInputFiles('#file', '/tmp/amostra.webm');
  await pg.waitForFunction(() => !document.getElementById('auto').disabled,
                           null, { timeout: 120000 });
  await pg.locator('#auto').click();
  await pg.waitForFunction(
    () => !document.getElementById('auto').disabled &&
          !document.getElementById('tr').readOnly,
    null, { timeout: 180000 });
  const m = await pg.evaluate(() => window.__medidas());
  /* Os marcos do navegador, e não só o nosso vetor: `performance.mark()` é
     metade do valor — é ele que aparece na linha do tempo da ferramenta de
     desenvolvimento de quem for investigar. */
  const doNavegador = await pg.evaluate(() =>
    performance.getEntriesByType('mark').map(e => e.name).filter(n => n.startsWith('ws:')));
  /* `performance.memory` e do Chrome e mais ninguem; quem pergunta e a corrida,
     porque e ela que tem a pagina aberta. */
  const temMemoria = await pg.evaluate(() => {
    try { return !!(performance.memory && performance.memory.usedJSHeapSize); }
    catch (e) { return false; }
  }).catch(() => false);
  await pg.close();
  return { m, erros, enviados, doNavegador, temMemoria };
}

const ctx = await br.newContext({ viewport: { width: 1250, height: 980 } });
const frio = await corrida({ ctx, semearCache: false });
const M = frio.m, nums = M.numeros;
const nomes = M.marcos.map(x => x.nome);
const primeiro = n => M.marcos.find(x => x.nome === n);

console.log('[1] os oito marcos que o plano pediu');
ok('leitura do arquivo', !!primeiro('arquivo.lido'),
   nomes.join(', '));
ok('decodificação do áudio', !!primeiro('audio.decodificado'));
ok('cache: frio ou quente, dito no começo', !!primeiro('modelo.inicio'));
ok('sessão do ONNX: cada degrau tem o seu tempo',
   M.marcos.some(x => x.nome === 'modelo.degrau' && x.ms_sessao > 0));
ok('primeiro texto', !!primeiro('texto.primeiro'));
ok('inferência total', typeof nums.paredeDaInferencia === 'number' && nums.paredeDaInferencia > 0,
   String(nums.paredeDaInferencia));
ok('a escada de fallback, degrau a degrau', nums.degrausTentados >= 3, String(nums.degrausTentados));
ok('áudio enviado ÷ áudio original', typeof nums.enviadoSobreOriginal === 'number',
   String(nums.enviadoSobreOriginal));
ok('e eles estão em ordem no tempo',
   M.marcos.every((x, i) => i === 0 || x.ms >= M.marcos[i - 1].ms));
ok('e aparecem na linha do tempo do navegador, com prefixo próprio',
   frio.doNavegador.includes('ws:arquivo.lido') && frio.doNavegador.includes('ws:modelo.pronto'),
   frio.doNavegador.join(', '));

console.log('[2] a escada registra o que PERDEU, e não só o que venceu');
const degraus = M.marcos.filter(x => x.nome === 'modelo.degrau');
ok('os dois degraus que caíram estão lá', degraus.filter(d => !d.ok).length >= 2,
   JSON.stringify(degraus.map(d => [d.rotulo, d.ok])));
ok('e o que venceu também', degraus.some(d => d.ok));
ok('o resumo conta os dois', nums.degrausTentados === degraus.length &&
   nums.degrausDesperdicados === degraus.filter(d => !d.ok).length,
   nums.degrausTentados + '/' + nums.degrausDesperdicados);
ok('o degrau vencedor tem nome', !!nums.degrauQueVenceu, String(nums.degrauQueVenceu));
/* A cortesia adianta o modelo enquanto a pessoa escolhe o arquivo, e trocar o
   modelo na tela monta outro: mais de uma construcao por aba e o caso normal. A
   regua conta quantas houve — sem isso, duas escadas somadas passariam por uma
   escada comprida. */
ok('e a régua conta quantas vezes o modelo foi montado',
   nums.construcoes >= 1 && nums.desistencias === 0,
   nums.construcoes + ' construção(ões), ' + nums.desistencias + ' desistência(s)');
ok('os megabytes somados são os do CAMINHO, não os do arquivo que venceu',
   nums.mbBaixados >= 11 && nums.mbBaixados <= 13, String(nums.mbBaixados));

console.log('[3] rede e sessão são tempos diferentes');
const venc = degraus.filter(d => d.ok).pop();
ok('o degrau vencedor baixou e montou', venc.ms_download > 0 && venc.ms_sessao > 0,
   JSON.stringify(venc));
ok('e o total não é menor que as partes', venc.ms_total >= venc.ms_sessao,
   venc.ms_total + ' vs ' + venc.ms_sessao);
ok('a montagem da sessão foi vista como o que é (≥200 ms de propósito)',
   venc.ms_sessao >= 200, String(venc.ms_sessao));
ok('os degraus que caíram não inventaram download',
   degraus.filter(d => !d.ok).every(d => d.ms_download === 0 && d.bytes === 0),
   JSON.stringify(degraus.filter(d => !d.ok)));
ok('e a soma da escada bate com o começo e o fim',
   nums.msDaEscada > 0 && nums.msDaEscada >= nums.msBaixando,
   nums.msDaEscada + ' vs ' + nums.msBaixando);

console.log('[4] o áudio que o modelo recebeu, contra o que o vídeo tinha');
ok('os segundos de áudio foram medidos', nums.segundosDeAudio > 0, String(nums.segundosDeAudio));
ok('a razão é plausível', nums.enviadoSobreOriginal > 0 && nums.enviadoSobreOriginal <= 1.05,
   String(nums.enviadoSobreOriginal));
ok('a decodificação disse a taxa de saída, o custo e se reamostrou',
   primeiro('audio.decodificado').taxaDecodificada > 0 &&
   primeiro('audio.decodificado').ms_decodificacao >= 0 &&
   typeof primeiro('audio.decodificado').reamostrou === 'boolean',
   JSON.stringify(primeiro('audio.decodificado')));

console.log('[5] cache quente é uma medida diferente de cache frio');
ok('a primeira corrida foi fria', nums.cacheQuente === false, String(nums.cacheQuente));
const quente = await corrida({ ctx, semearCache: true });
ok('a segunda, com o modelo guardado, foi quente',
   quente.m.numeros.cacheQuente === true, String(quente.m.numeros.cacheQuente));
ok('e isso aparece no marco de começo, e não só no resumo',
   quente.m.marcos.find(x => x.nome === 'modelo.inicio').cacheQuente === true);

console.log('[6] nada disto sai da máquina');
const corpos = frio.enviados.concat(quente.enviados).join(' ');
ok('nenhum marco viajou na medição',
   !/modelo\.degrau|ms_sessao|mbBaixados|arquivo\.lido/.test(corpos),
   corpos.slice(0, 200));
/* E mais: desta máquina não sai marco NENHUM. O produto passou a calar a
   medição quando a página vem de `localhost` — porque a esteira estava entrando
   na base de produção como gente. Só `testes/medicao.mjs` abre a porta de
   serviço, e é ele quem cobra o conteúdo do que é enviado. */
ok('e nem os três de sempre: de localhost a medição fica muda',
   corpos === '', corpos.slice(0, 200));

console.log('[6b] o pico de memoria, e onde ele acontece');
{
  /* A escada ja protege a maquina que fica sem memoria. Proteger nao e
     entender: a pergunta que decide o que otimizar depois e se o pico e a
     leitura do arquivo, o buffer de audio decodificado ou a sessao do modelo —
     cada resposta manda mexer num lugar diferente.

     `performance.memory` e do Chrome e mais ninguem, entao a medida diz `null`
     onde a informacao nao existe. Este teste roda no Chromium, onde ela existe;
     o que ele guarda e que o numero seja PLAUSIVEL e que o `onde` seja um dos
     marcos de verdade — um pico sem lugar nao serve para decidir nada. */
  const temApi = frio.temMemoria;
  if (!temApi) {
    ok('(este navegador nao conta memoria — a medida diz null, e esta certo)',
       M.numeros.picoDeMemoriaMB === null, String(M.numeros.picoDeMemoriaMB));
  } else {
    ok('o pico foi medido', M.numeros.picoDeMemoriaMB > 0,
       M.numeros.picoDeMemoriaMB + ' MB');
    ok('e ele nao passa do teto do heap',
       M.numeros.picoDeMemoriaMB <= M.numeros.tetoDoHeapMB,
       M.numeros.picoDeMemoriaMB + ' / ' + M.numeros.tetoDoHeapMB);
    ok('a sobra e o teto menos o pico',
       M.numeros.sobrouNoPicoMB === M.numeros.tetoDoHeapMB - M.numeros.picoDeMemoriaMB,
       String(M.numeros.sobrouNoPicoMB));
    /* O `onde` tem que ser um marco de verdade, e nao um rotulo solto: e ele
       que diz em qual pedaco mexer. */
    const lugares = new Set(M.marcos.map((x) => x.nome).concat(['inferencia']));
    ok('e o pico tem lugar, e o lugar existe',
       !!M.numeros.picoOnde && lugares.has(M.numeros.picoOnde),
       String(M.numeros.picoOnde));
  }
}

console.log('[6c] o motor tem um nome so para onde ele esta');
{
  /* O estado do motor morava em SETE variaveis que podiam se contradizer, e
     cada protecao contra concorrencia foi escrita separado. Agora ha um nome
     so, DERIVADO das mesmas variaveis — guardar um oitavo campo seria criar
     mais uma coisa para ficar para tras num caminho de erro.

     O que esta afirmacao guarda: que o caminho gravado seja de estados que
     existem, que ele passe pelos que TEM que acontecer numa transcricao, e que
     nunca haja duas transicoes seguidas para o mesmo lugar — repeticao ali
     significa que alguem passou a marcar em vez de derivar. */
  const NOMES = ['ocioso', 'montando', 'pronto', 'inferindo', 'soltando', 'caido'];
  const trans = M.marcos.filter((x) => x.nome === 'asr.estado');
  ok('o caminho do motor foi gravado', trans.length >= 2, trans.length + ' transições');
  ok('e so com estados que existem',
     trans.every((x) => NOMES.includes(x.para) && (x.de === null || NOMES.includes(x.de))),
     JSON.stringify(trans.map((x) => x.de + '->' + x.para)));
  ok('nenhuma transicao para o mesmo lugar',
     trans.every((x) => x.de !== x.para),
     JSON.stringify(trans.map((x) => x.de + '->' + x.para)));
  const passou = new Set(trans.map((x) => x.para));
  ok('uma transcricao passa por montando, pronto e inferindo',
     passou.has('montando') && passou.has('inferindo'),
     [...passou].join(', '));
  /* E o `de` de cada transicao e o `para` da anterior: um caminho com buraco
     significa que alguem mudou o motor sem passar pelo nome. */
  ok('o caminho nao tem buraco',
     trans.every((x, i) => i === 0 || x.de === trans[i - 1].para),
     JSON.stringify(trans.map((x) => x.de + '->' + x.para)));
}

console.log('[7] sem erro de JS');
ok('a corrida fria', frio.erros.length === 0, frio.erros.join(' | '));
ok('a corrida quente', quente.erros.length === 0, quente.erros.join(' | '));

/* ---- A TRAVA DA PORTA DE SERVIÇO ----
 *
 * Três arquivos precisam ver a medição ACONTECER — eles a usam como canal de
 * observação do produto — e por isso abrem `__medirDaqui`. O risco é óbvio: um
 * quarto arquivo abre a porta, esquece de interceptar a rota, e a esteira volta
 * a escrever na base de produção sem ninguém notar. Foi exatamente esse
 * descuido (sem porta nenhuma, na verdade) que pôs 43 marcos de teste no funil.
 *
 * A regra é estática e curta: quem abre a porta tampa o ralo. */
console.log('[8] quem abre a porta de serviço tampa o ralo');
{
  const dir = new URL('.', import.meta.url).pathname;
  const abrem = fs.readdirSync(dir).filter(f => f.endsWith('.mjs'))
    .filter(f => /__medirDaqui\s*=\s*true/.test(fs.readFileSync(dir + f, 'utf8')));
  const semRota = abrem.filter(f =>
    !/route\(\s*['"`]\*\*\/rpc\/walkstamp_evento/.test(fs.readFileSync(dir + f, 'utf8')));
  ok('todo arquivo que abre a porta intercepta a rota da medição',
     semRota.length === 0, semRota.join(', '));
  ok('e não são muitos: só quem observa a medição precisa dela',
     abrem.length <= 3, abrem.length + ': ' + abrem.join(', '));
}


console.log('[9] a escada pula o que nao adianta');
{
  /* O CASO QUE A ESCADA TRATAVA PIOR. Numa maquina sem memoria, ela subia ate o
     degrau de 200 MB — baixava tudo e morria com o arquivo maior na mao. Insistir
     ali nao e persistencia: e gastar a ultima chance da pessoa.

     A biblioteca falsificada aqui joga um erro de memoria no primeiro degrau e
     depois aceitaria qualquer coisa. O que se cobra e que ela NAO seja chamada
     para os degraus caros — e que os pulados apareçam no registro, porque um
     degrau que some faz a escada parecer mais curta do que foi. */
  const SEM_MEMORIA = `
globalThis.__pediu = [];
export const env = { allowLocalModels: true, allowRemoteModels: true,
  backends: { onnx: { wasm: { numThreads: 1, wasmPaths: undefined, proxy: false } } } };
export async function pipeline(tarefa, modelo, opcoes){
  globalThis.__pediu.push(JSON.stringify(opcoes && opcoes.dtype));
  await new Promise(r => setTimeout(r, 20));
  throw new Error('Array buffer allocation failed: out of memory');
}
`;
  const ctx2 = await br.newContext({ viewport: { width: 1250, height: 980 } });
  const pg2 = await ctx2.newPage();
  const erros2 = []; pg2.on('pageerror', (e) => erros2.push(e.message));
  await pg2.route('**/rpc/walkstamp_evento', (r) =>
    r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, body: 'null' }));
  await pg2.route('**/@huggingface/transformers**', (r) => r.fulfill({
    status: 200, headers: { 'content-type': 'text/javascript' }, body: SEM_MEMORIA }));
  await pg2.goto('http://localhost:8973/app.html?lang=pt');
  await pg2.selectOption('#mode', 'count').catch(() => {});
  await pg2.fill('#count', '3').catch(() => {});
  await pg2.locator('#recTr').uncheck().catch(() => {});
  await pg2.setInputFiles('#file', '/tmp/amostra.webm');
  await pg2.waitForFunction(() => !document.getElementById('auto').disabled,
                            null, { timeout: 120000 });
  await pg2.locator('#auto').click();
  await pg2.waitForFunction(
    () => !document.getElementById('auto').disabled &&
          !document.getElementById('tr').readOnly, null, { timeout: 180000 });

  const m2 = await pg2.evaluate(() => window.__medidas());
  const pulos = m2.marcos.filter((x) => x.nome === 'modelo.pulou');
  ok('a escada pulou pelo menos um degrau', pulos.length > 0,
     JSON.stringify(pulos.map((x) => [x.rotulo, x.causa])));
  ok('e o motivo registrado é a memória',
     pulos.every((x) => x.causa === 'memoria'),
     JSON.stringify(pulos.map((x) => x.causa)));
  ok('nenhum degrau caro chegou a ser pedido',
     m2.numeros.mbPoupados > 0 && !m2.marcos.some(
       (x) => x.nome === 'modelo.degrau' && /fp32/.test(x.rotulo || '') && x.ok === false
              && /processador|wasm/.test(x.rotulo || '')),
     'poupou ' + m2.numeros.mbPoupados + ' MB');
  ok('e o resumo conta os pulos', m2.numeros.degrausPulados === pulos.length,
     m2.numeros.degrausPulados + ' vs ' + pulos.length);
  ok('a desistência foi registrada', m2.marcos.some((x) => x.nome === 'modelo.desistiu'));
  ok('sem erro de JS na corrida sem memória', erros2.length === 0, erros2.join(' | '));
  await ctx2.close();
}

await ctx.close(); await br.close(); srv.close();
console.log(falhas ? '\n' + falhas + ' falha(s)' : '\ntudo certo');
process.exit(falhas ? 1 : 0);

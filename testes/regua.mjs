/* A RÉGUA DE DESEMPENHO — medir antes de otimizar.
 *
 * O QUE ELA RESOLVE. O arquivo do produto tinha 39 `performance.now()` e ZERO
 * `performance.mark()`. Cada um deles calculava uma diferença, escrevia numa
 * frase e jogava fora: o número existia no instante e sumia. Com isso, toda
 * decisão de desempenho — trocar a janela, trocar o modelo, mexer na
 * compactação de silêncio — era palpite com cara de decisão, porque não havia
 * como comparar duas execuções.
 *
 * Este arquivo não mede nada por conta própria: ele DIRIGE o produto e recolhe
 * o que o próprio produto marcou, em `window.__medidas()`. É de propósito. Uma
 * régua que cronometrasse por fora mediria também o Playwright, o servidorzinho
 * e o disco desta máquina.
 *
 *   node testes/regua.mjs                        # 1 min, cache frio, 1 linha
 *   node testes/regua.mjs --amostras=1min,10min,40min
 *   node testes/regua.mjs --linhas=1,4 --cache=frio,quente
 *   node testes/regua.mjs --placa --modelo=onnx-community/whisper-small
 *   node testes/regua.mjs --saida=/tmp/regua.json --repetir=3
 *
 * ANTES: `python3 testes/amostras.py --medida` gera as amostras versionadas de
 * 1, 10 e 40 minutos e o manifesto com o sha256 de cada uma. A identidade delas
 * viaja dentro do JSON de saída — dois números só se comparam se o insumo for
 * o mesmo arquivo, e não "um de dez minutos também".
 *
 * ELA PRECISA DE REDE. O modelo vem do CDN e o peso vem do repositório de
 * modelos; numa máquina sem saída para `cdn.jsdelivr.net` e `huggingface.co` a
 * escada de degraus falha inteira. Isso NÃO é um defeito da régua e ela diz
 * assim: o JSON sai com `modelo.desistiu` e a lista de degraus tentados, que é
 * uma medição legítima — a de uma máquina que não consegue montar o modelo.
 *
 * O QUE ELA NÃO PROVA: que a instrumentação está certa. Isso é `testes/marcos.mjs`,
 * que roda sem rede nenhuma com uma biblioteca falsificada e cobra os marcos um
 * a um. Régua e aferição da régua são coisas diferentes e moram em arquivos
 * diferentes.
 */
import { chromium } from './_navegador.mjs';
import http from 'http'; import fs from 'fs';
import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';

const arg = (nome, padrao) => {
  const a = process.argv.find(x => x.startsWith('--' + nome + '='));
  return a ? a.slice(nome.length + 3) : padrao;
};
const tem = nome => process.argv.includes('--' + nome);

const AMOSTRAS = arg('amostras', '1min').split(',').filter(Boolean);
const LINHAS   = arg('linhas', '1').split(',').map(Number).filter(Boolean);
const CACHES   = arg('cache', 'frio').split(',').filter(Boolean);
const MODELO   = arg('modelo', '');
const SAIDA    = arg('saida', '/tmp/regua.json');
const REPETIR  = Number(arg('repetir', '1')) || 1;
const PLACA    = tem('placa');
const TETO_MS  = Number(arg('teto', '1800000')) || 1800000;

const MANIFESTO = '/tmp/medida-amostras.json';
if (!fs.existsSync(MANIFESTO)) {
  console.error('Falta o manifesto das amostras. Rode antes:\n' +
                '  python3 testes/amostras.py --medida');
  process.exit(2);
}
const manifesto = JSON.parse(fs.readFileSync(MANIFESTO, 'utf8'));
const acharAmostra = nome => manifesto.itens.find(i => i.nome === nome);
for (const n of AMOSTRAS) {
  const it = acharAmostra(n);
  if (!it) { console.error('amostra desconhecida: ' + n); process.exit(2); }
  if (!fs.existsSync(it.caminho)) {
    console.error('a amostra ' + n + ' sumiu de ' + it.caminho +
                  ' — rode `python3 testes/amostras.py --medida` de novo');
    process.exit(2);
  }
}

const html = fs.readFileSync(RAIZ_WS + '/public/app.html', 'utf8');

/* DOIS SERVIDORES, e não um com cabeçalho variável.
 *
 * O número de linhas do wasm não é uma opção do produto: ele sai de
 * `quantasLinhas(hardwareConcurrency, crossOriginIsolated)`, e sem isolamento
 * entre origens o navegador não entrega `SharedArrayBuffer` — o runtime cai
 * para uma linha, faça o que fizer. Medir "4 linhas" pedindo gentilmente não
 * mede nada: é preciso servir a página com COOP e COEP.
 *
 * O `credentialless` e não o `require-corp`: com `require-corp` o CDN precisaria
 * mandar `Cross-Origin-Resource-Policy` em cada arquivo do modelo, e não manda.
 * Este é o mesmo par de cabeçalhos que a hospedagem do produto usa. */
function servir(porta, isolado){
  const srv = http.createServer((q, r) => {
    const cab = { 'Content-Type': 'text/html' };
    if (isolado) {
      cab['Cross-Origin-Opener-Policy'] = 'same-origin';
      cab['Cross-Origin-Embedder-Policy'] = 'credentialless';
    }
    if (q.url.startsWith('/_vercel/')) {
      r.writeHead(200, Object.assign({}, cab, { 'Content-Type': 'text/javascript' }));
      return r.end('');
    }
    r.writeHead(200, cab); r.end(html);
  });
  return new Promise(ok => srv.listen(porta, () => ok(srv)));
}

const srvSimples  = await servir(8971, false);
const srvIsolado  = await servir(8972, true);

const br = await chromium.launch({ executablePath: CHROME_WS });

/** Uma medição: abre, carrega a amostra, transcreve, devolve `__medidas()`. */
async function medir({ amostra, linhas, cache, ctxReuso }) {
  const isolado = linhas > 1;
  const porta = isolado ? 8972 : 8971;
  /* CACHE FRIO É CONTEXTO NOVO. A Cache Storage do transformers.js vive no
     contexto do navegador; um contexto recém-criado nunca viu o modelo, que é
     a definição operacional de frio. Quente é o MESMO contexto rodando de
     novo — e por isso a ordem importa: o quente só existe depois de um frio. */
  const ctx = ctxReuso || await br.newContext({ viewport: { width: 1250, height: 980 } });
  const pg = await ctx.newPage();
  const erros = []; pg.on('pageerror', e => erros.push(e.message));

  /* Os núcleos que o produto vai ver. `hardwareConcurrency` é somente-leitura,
     e sem forçá-lo a régua mediria a máquina de quem a roda em vez de medir a
     configuração pedida. Isto fica ANOTADO na saída: `nucleosForcados`. */
  if (linhas > 1) {
    await pg.addInitScript(n => {
      try { Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => n }); }
      catch (e) {}
    }, linhas + 1);
  }
  /* A medição do produto não sai desta máquina de qualquer jeito; mesmo assim
     a régua corta a rota, para que uma corrida de quarenta minutos não vire
     quarenta linhas no painel de eventos. */
  await pg.route('**/rpc/walkstamp_evento', r =>
    r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, body: 'null' }));

  const t0 = Date.now();
  await pg.goto('http://localhost:' + porta + '/app.html?lang=pt');
  if (MODELO) await pg.selectOption('#model', MODELO).catch(() => {});
  /* A placa é uma caixa da pessoa, e não um degrau escondido: quando ela está
     desmarcada a escada nem tenta WebGPU antes do resgate final. */
  if (PLACA) await pg.locator('#gpu').check().catch(() => {});
  else       await pg.locator('#gpu').uncheck().catch(() => {});

  const it = acharAmostra(amostra);
  await pg.setInputFiles('#file', it.caminho);
  await pg.waitForFunction(() => !document.getElementById('auto').disabled,
                           null, { timeout: 180000 });
  await pg.locator('#auto').click();
  let acabou = true;
  try {
    await pg.waitForFunction(
      () => !document.getElementById('auto').disabled &&
            !document.getElementById('tr').readOnly,
      null, { timeout: TETO_MS });
  } catch (e) { acabou = false; }

  const medidas = await pg.evaluate(() => window.__medidas ? window.__medidas() : null);
  const texto = await pg.evaluate(() => (document.getElementById('tr').value || '').length);
  await pg.close();
  if (!ctxReuso) { /* devolvido ao chamador, que decide se reaproveita */ }

  return {
    ctx,
    linha: {
      amostra: { nome: it.nome, minutos: it.minutos, segundos: it.segundos,
                 bytes: it.bytes, sha256: it.sha256,
                 receita: manifesto.versao, fala: manifesto.fala },
      pedido: { linhas, cache, placa: PLACA, modelo: MODELO || '(o padrão da tela)',
                isolamento: isolado, nucleosForcados: linhas > 1 ? linhas + 1 : null },
      obtido: medidas ? {
        motor: medidas.numeros.motor,
        linhasDoWasm: medidas.numeros.linhasDoWasm,
        isolado: medidas.numeros.isolado,
        cacheQuente: medidas.numeros.cacheQuente,
      } : null,
      acabou, caracteresDeTexto: texto,
      msDeParede: Date.now() - t0,
      erros,
      medidas,
    },
  };
}

const linhas = [];
for (const amostra of AMOSTRAS) {
  for (const n of LINHAS) {
    let ctx = null;
    for (const cache of CACHES) {
      for (let r = 0; r < REPETIR; r++) {
        /* Frio manda contexto novo; quente reaproveita o que o frio deixou
           quente. Pedir só `--cache=quente` é legítimo e a régua avisa: sem um
           frio antes, o primeiro "quente" é frio disfarçado. */
        const reuso = cache === 'quente' ? ctx : null;
        if (cache === 'quente' && !reuso)
          console.log('  aviso: --cache=quente sem um frio antes; esta linha nasce fria');
        const res = await medir({ amostra, linhas: n, cache, ctxReuso: reuso });
        if (cache === 'frio') { if (ctx) await ctx.close(); ctx = res.ctx; }
        res.linha.repeticao = r + 1;
        linhas.push(res.linha);
        const m = res.linha.medidas && res.linha.medidas.numeros || {};
        console.log('  %s · %d linha(s) · %s%s → motor %s · escada %s ms (%s MB) · ' +
                    'inferência %s s · %sx tempo real · %s construção(ões)',
          amostra, n, cache, REPETIR > 1 ? ' #' + (r + 1) : '',
          m.motor || '(nenhum)', m.msDaEscada != null ? m.msDaEscada : '?',
          m.mbBaixados != null ? m.mbBaixados : '?',
          m.paredeDaInferencia != null ? m.paredeDaInferencia.toFixed(1) : '?',
          m.vezesTempoReal != null ? m.vezesTempoReal.toFixed(2) : '?',
          m.construcoes != null ? m.construcoes : '?');
      }
    }
    if (ctx) await ctx.close();
  }
}

await br.close();
srvSimples.close(); srvIsolado.close();

const saida = {
  versao: 1,
  /* A identidade de QUEM mediu entra junto: um JSON de desempenho sem a
     máquina ao lado é um número sem unidade. */
  maquina: { plataforma: process.platform, nucleos: (await import('os')).cpus().length,
             node: process.version },
  amostras: manifesto,
  linhas,
};
fs.writeFileSync(SAIDA, JSON.stringify(saida, null, 2));
console.log('\n  ' + linhas.length + ' medição(ões) em ' + SAIDA);

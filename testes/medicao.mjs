/* Medição, lista de aviso e a manchete nova.
   O que este teste protege, em ordem de gravidade se quebrar:
     1. o build offline continuar mudo;
     2. Do Not Track ser respeitado;
     3. nenhum dado do vídeo escapar junto com os marcos;
     4. a lista de aviso continuar FORA — ela saiu por decisão, e uma régua
        apagada junto com o recurso deixa o caminho livre para ele voltar. */
import { chromium } from './_navegador.mjs';
import http from 'http'; import fs from 'fs'; import path from 'path';
import { criarProxy, exigirNext } from './proxy.mjs';
import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';
await exigirNext();

const ROOT = `${RAIZ_WS}/public`;
const T = {'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml',
  '.ico':'image/x-icon','.png':'image/png','.jpg':'image/jpeg','.mp4':'video/mp4','.webm':'video/webm','.vtt':'text/vtt'};
/* O site virou Next.js: as páginas não existem mais como arquivo em public/.
   O servidorzinho estático daqui virou um encaminhador para o Next — mesma
   porta, mesmas URLs no teste, e quem responde é o produto de verdade. */
const srv = criarProxy();
await new Promise(r => srv.listen(8877, r));

const br = await chromium.launch({ executablePath: CHROME_WS });
let falhas = 0;
const ok = (n, c, e) => { console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : '')); if (!c) falhas++; };

/** Página com o Supabase e o Vercel interceptados; devolve o que foi enviado. */
async function pagina(url, opts = {}) {
  const ctx = await br.newContext();
  const pg = await ctx.newPage();
  const eventos = [], listas = [], vercel = [];
  const erros = []; pg.on('pageerror', e => erros.push(e.message));

  /* A PORTA DE SERVIÇO DA MEDIÇÃO. O produto passou a calar a medição quando a
     página vem de `localhost` ou de rede local — sem isso a esteira desta
     máquina entrava na base de produção como gente, e entrou: numa noite, 43
     marcos, dois deles em inglês, num funil que ninguém conseguia separar
     depois. Este arquivo é o único que precisa ver o envio ACONTECER, porque é
     ele que cobra o que vai dentro; por isso é o único que abre a porta.
     `opts.mudo` existe para o caso simétrico — provar que sem a porta aberta
     não sai nada. */
  if (!opts.mudo) await pg.addInitScript(() => { window.__medirDaqui = true; });
  if (opts.dnt) await pg.addInitScript(() => {
    Object.defineProperty(navigator, 'doNotTrack', { get: () => '1' });
  });
  if (opts.gpc) await pg.addInitScript(() => {
    Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => true });
  });

  await pg.route('**/rpc/walkstamp_evento', r => {
    eventos.push(JSON.parse(r.request().postData() || '{}'));
    r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, body: 'null' });
  });
  await pg.route('**/rpc/walkstamp_interesse', r => {
    listas.push(JSON.parse(r.request().postData() || '{}'));
    r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*',
      'content-type': 'application/json' }, body: JSON.stringify(opts.resposta ?? 'ok') });
  });
  await pg.route('**/_vercel/insights/**', r => { vercel.push(r.request().url()); r.fulfill({ status: 200, body: '' }); });
  // o modelo de transcrição nunca é baixado nestes testes
  await pg.route('**/@huggingface/transformers**', r => r.fulfill({ status: 200,
    headers: { 'content-type': 'text/javascript', 'access-control-allow-origin': '*' },
    body: 'export const env={backends:{onnx:{wasm:{}}}};export async function pipeline(){return async()=>({chunks:[]})}' }));

  await pg.goto(url);
  // o cenário de uso passou a ser obrigatório: sem ele o Gravar cobra a escolha
  await pg.selectOption('#modelo', 'ia').catch(() => {});
  await pg.waitForTimeout(500);
  return { pg, ctx, eventos, listas, vercel, erros };
}

console.log('\n[M1] a ferramenta não manda marco nenhum — nem com a porta aberta');
{
  /* Até o Build 68 este bloco cobrava os três marcos anônimos (abriu, carregou
     vídeo, baixou saída) e o que ia dentro deles. No 69 a medição da
     ferramenta saiu inteira, junto com o servidor. O que se cobra agora é o
     silêncio — e com a porta de serviço ABERTA, que é o caso em que a versão
     antiga mandava: uma volta da medição apareceria aqui primeiro. */
  const { pg, ctx, eventos, vercel, erros } = await pagina('http://localhost:8877/app.html?lang=pt');
  const pedidos = [];
  pg.on('request', r => pedidos.push(r.url()));
  ok('o snippet do Vercel continua carregando', vercel.length > 0, vercel[0]);
  await pg.setInputFiles('#file', '/tmp/amostra.webm');
  await pg.waitForFunction(() => !document.getElementById('auto').disabled, null, { timeout: 20000 });
  await pg.selectOption('#mode', 'count'); await pg.fill('#count', '2');
  await pg.locator('#extract').click();
  await pg.waitForFunction(() => document.querySelectorAll('#thumbs figure').length >= 2,
                           null, { timeout: 40000 });
  await pg.locator('#json').click();
  await pg.waitForTimeout(800);
  ok('abrir, carregar e baixar não mandam marco nenhum', eventos.length === 0,
     eventos.length + ' enviados: ' + JSON.stringify(eventos).slice(0, 120));
  const nossos = pedidos.filter(u => /supabase|\/api\/|rpc\//.test(u));
  ok('e nenhum pedido a servidor nosso', nossos.length === 0, nossos.join(' | ').slice(0, 160));
  ok('sem erro de JS', erros.length === 0, erros.join(' | ').slice(0, 160));
  await ctx.close();
}

console.log('\n[M3] o arquivo offline é mudo');
{
  const off = fs.readFileSync(`${RAIZ_WS}/offline/walkstamp-offline.html`, 'utf8');
  ok('sem endereço do Supabase no arquivo', !/supabase/i.test(off));
  ok('sem snippet do Vercel no arquivo', !/_vercel\/insights/.test(off));

  const ctx = await br.newContext();
  const pg = await ctx.newPage();
  const externos = [];
  pg.on('request', r => { if (!r.url().startsWith('file:')) externos.push(r.url()); });
  const erros = []; pg.on('pageerror', e => erros.push(e.message));
  await pg.goto(`file://${RAIZ_WS}/offline/walkstamp-offline.html`);
  /* TRÊS SEGUNDOS, E NÃO NOVECENTOS MILISSEGUNDOS.
     A antecipação do modelo dispara num `setTimeout` de 1200 ms — quer dizer
     que esta régua media a janela ANTES do único pedido que ela existe para
     pegar, e passava verde enquanto o pacote "mudo" chamava o jsDelivr 1,7 s
     depois de abrir. Três segundos cobrem a antecipação com folga; medido, o
     pedido saía em 1,7 s. */
  await pg.waitForTimeout(3000);
  ok('abrindo o arquivo, nenhum pedido sai da máquina', externos.length === 0, externos.join(' | ').slice(0,160));
  ok('e ele funciona: a interface montou', await pg.locator('#drop').isVisible());
  ok('sem erro de JS', erros.length === 0, erros.join(' | ').slice(0, 160));
  await ctx.close();
}

console.log('\n[M4] a lista de aviso SAIU, e não volta sem alguém decidir');
{
  /* A RÉGUA VIROU DO AVESSO — 23/08, DEC-16 decidida.
   *
   * Ela cobrava que o formulário existisse. Ele já não existia em corpo de
   * página nenhum desde a rodada de preços: sobravam 76 linhas de JavaScript
   * morto servidas em toda página, um painel com uma aba que ninguém podia mais
   * alimentar, e este bloco reprovando com a frase "o formulário existe" — como
   * se o produto tivesse quebrado.
   *
   * A decisão foi: fica só o plano. Quem quer o produto vai ao checkout.
   *
   * Então esta régua passa a cobrar a AUSÊNCIA, que é o mesmo movimento que o
   * `paginas.mjs` já fez com o bloco de apoio: apagar a régua junto com o
   * recurso deixaria o caminho livre para ele voltar por descuido, e aí a
   * página de preços teria de novo duas portas competindo pela mesma pessoa.
   *
   * O que ela NÃO cobra: a tabela `walkstamp.interesse` e a aba do painel, que
   * continuam de pé guardando os leads que já entraram. Tirar a captura não é
   * apagar quem já se cadastrou. */
  const script = fs.readFileSync(`${RAIZ_WS}/public/support.js`, 'utf8');
  ok('o support.js não carrega mais o código da lista',
     !/listaForm|listaEmail|listaBtn/.test(script),
     (script.match(/lista[A-Za-z]+/g) || []).slice(0, 4).join(' '));
  ok('nem chama a função de interesse do banco',
     !/walkstamp_interesse/.test(script));

  /* E nenhuma página do site pede e-mail para uma lista de espera. A `/precos`
     hospedava o formulário e saiu no Build 71; a home é onde ele voltaria. */
  const { pg, ctx, erros } = await pagina('http://localhost:8877/?lang=pt');
  ok('a home não tem formulário de lista',
     (await pg.locator('#listaForm').count()) === 0,
     String(await pg.locator('#listaForm').count()));
  ok('e nenhum campo de e-mail de espera sobrou',
     (await pg.locator('#listaEmail').count()) === 0);
  ok('sem erro de JS', erros.length === 0, erros.join(' | ').slice(0, 160));
  await ctx.close();
}

console.log('\n[M6] a manchete nova, nos três idiomas');
{
  /* A MANCHETE MUDOU DE CATEGORIA, e esta lista mudou junto.
   *
   * "Você percorre a tela. Ele carimba cada passo." tem personalidade e não é
   * pesquisável: quem faz QA não lê ali "caso de teste", "evidência" nem
   * "planilha", e o lead abria dois produtos com o mesmo peso. A manchete passou
   * a dizer o trabalho — executar os casos e organizar a prova —, e "gravação
   * vira documento" virou o mecanismo, que é o que ele sempre foi.
   *
   * O que continua cobrado aqui: os 3.600 quadros (o número concreto que faz a
   * comparação ser memorizável) e os dois casos de uso, que desceram na
   * hierarquia mas não sumiram. E a voz antiga sobrevive como subtítulo mais
   * abaixo — o que esta lista NÃO cobra é ela na manchete. */
  const esperado = {
    '/':   ['Execute os casos', 'organiza a prova', 'roteiro de casos', '3.600', 'Evidência de teste', 'Contexto para IA'],
    '/en': ['Run the cases', 'organises the proof', 'case script', '3,600', 'Test evidence', 'Context for AI'],
    '/es': ['Ejecuta los casos', 'organiza la prueba', 'guion de casos', '3.600', 'Evidencia de prueba', 'Contexto para IA'],
  };
  for (const [rota, termos] of Object.entries(esperado)) {
    const ctx = await br.newContext(); const pg = await ctx.newPage();
    await pg.route('**/_vercel/insights/**', r => r.fulfill({ status: 200, body: '' }));
    await pg.goto('http://localhost:8877' + rota + '?lang=' + (rota === '/' ? 'pt' : rota.slice(1)));
    const txt = await pg.locator('body').innerText();
    /* innerText devolve as etiquetas já em caixa alta (text-transform no CSS),
       então a comparação ignora caixa. */
    const baixo = txt.toLowerCase();
    for (const termo of termos) ok(`${rota}: "${termo}"`, baixo.includes(termo.toLowerCase()));
    ok(`${rota}: a frase que expira saiu da manchete`,
       !/não assistem vídeo|do not watch video|no ven vídeo/.test(await pg.locator('h1, .lead').first().innerText()));
    await ctx.close();
  }
}

console.log('\n[M7] a política de privacidade conta o que passou a existir');
{
  for (const [rota, termos] of Object.entries({
    '/privacidade.html':    ['O que é medido', 'Do Not Track', 'Supabase', 'lista de aviso'],
    '/en/privacidade.html': ['What is measured', 'Do Not Track', 'Supabase', 'notification list'],
    '/es/privacidade.html': ['Qué se mide', 'Do Not Track', 'Supabase', 'lista de aviso'],
  })) {
    const ctx = await br.newContext(); const pg = await ctx.newPage();
    await pg.route('**/_vercel/insights/**', r => r.fulfill({ status: 200, body: '' }));
    await pg.goto('http://localhost:8877' + rota);
    const txt = await pg.locator('body').innerText();
    for (const t of termos) ok(`${rota}: "${t}"`, txt.includes(t));
    ok(`${rota}: não afirma mais que não há análise de audiência`,
       !/análise de audiência|audience analytics|analítica de audiencia/.test(txt));
    await ctx.close();
  }
}

await br.close(); srv.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nMedição: tudo passou.');
process.exit(falhas ? 1 : 0);

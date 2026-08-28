/* A MATRIZ DE EGRESSÃO, CONFERIDA CONTRA O PRODUTO.
 *
 * A DEC-1 foi decidida no caminho A: "nada do seu conteúdo sai sem um gesto
 * seu", com as exceções nomeadas no mesmo bloco. A frase sozinha não vale nada
 * — um absoluto que o F12 do navegador desmente em dez segundos vale menos que
 * uma exceção declarada. O que faz A ser defensável é a matriz, e o que faz a
 * matriz valer é esta régua.
 *
 * ANTES DELA a promessa estava escrita em NOVE chaves do dicionário e numa
 * dúzia de páginas, cada uma com a sua redação — "não sai do seu computador",
 * "fica no seu navegador", "não é enviada" — e a tabela de conexões da página
 * de segurança era escrita à mão, em cinco idiomas, sem nada que a ligasse ao
 * código. Doze frases para uma verdade só.
 *
 * O QUE ELA PROVA, e as duas primeiras são as que importam:
 *
 *   [1] NADA ESCONDIDO — todo endereço que existe no app construído está
 *       declarado na matriz. Um destino novo sem linha aqui reprova.
 *   [2] NADA MORTO — todo endereço declarado na matriz existe mesmo no app.
 *       Entrada morta numa matriz de privacidade é tão ruim quanto destino
 *       escondido: as duas fazem o leitor confiar no papel em vez do produto.
 *   [3] O QUE SAI SOZINHO é exatamente o que a matriz diz que sai sozinho —
 *       medido no navegador, com o app servido e deixado parado.
 *   [4] O QUE EXIGE GESTO não sai sem gesto. É a frase, testada.
 *   [5] a frase e a matriz estão NO MESMO BLOCO, nos cinco idiomas.
 *
 * O QUE ELA NÃO PROVA: que o conteúdo que sai num gesto é só o declarado —
 * isso é o corpo de cada requisição, e quem mede isso é o `semrede.mjs`, que
 * corta tudo e lê os corpos antes de abortar.
 *
 *   node testes/egressao.mjs
 */
import fs from 'fs';
import http from 'http';
import { chromium } from './_navegador.mjs';
import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';

let falhas = 0;
const ok = (n, c, e) => { console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : '')); if (!c) falhas++; };

const MATRIZ = JSON.parse(fs.readFileSync(`${RAIZ_WS}/src/egressao.json`, 'utf8')).destinos;
const app = fs.readFileSync(`${RAIZ_WS}/public/app.html`, 'utf8');
const lib = fs.readFileSync(`${RAIZ_WS}/vendor/jspdf.umd.min.js`, 'utf8');
const soNosso = app.split(lib).join('');

/* Espaços de nome de XML: o .docx, o .pptx e o SCORM os escrevem dentro dos
   arquivos que o produto GERA. São identificadores, não destinos. */
const NAMESPACE = /w3\.org|schemas\.openxmlformats\.org|schemas\.microsoft\.com|purl\.org|xml\.org|adlnet\.org\/xsd|imsglobal\.org\/xsd|imsproject\.org\/xsd/;

const DECLARADOS = MATRIZ.filter((d) => d.onde.includes('web'));

console.log('[1] nada escondido: todo endereço do app está na matriz');
{
  /* Só endereços ABSOLUTOS. Os relativos (`/api/menu`, `/_vercel/insights`)
     vão para a nossa própria origem, e é a linha da hospedagem que responde
     por ela — eles são conferidos por presença no bloco [2]. */
  const urls = [...new Set([...soNosso.matchAll(/https?:\/\/[^\s'"`)<>]+/g)].map((m) => m[0]))]
    .filter((u) => !NAMESPACE.test(u));
  const orfaos = urls.filter((u) => !DECLARADOS.some((d) => d.hosts.some((h) => u.includes(h))));
  ok('todo endereço do app tem uma linha na matriz', orfaos.length === 0,
     [...new Set(orfaos.map((u) => u.replace(/^https?:\/\//, '').split('/')[0]))].slice(0, 5).join(' '));
  console.log(`     ${urls.length} endereços distintos, ${DECLARADOS.length} linhas na matriz`);
}

console.log('\n[2] nada morto: todo endereço da matriz existe mesmo no app');
for (const d of DECLARADOS) {
  const faltando = d.hosts.filter((h) => !soNosso.includes(h));
  ok(`${d.id}: os ${d.hosts.length} endereço(s) declarados estão no app`,
     faltando.length === 0, faltando.join(' '));
}

console.log('\n[3] e o pacote offline não tem nenhum deles — é o caminho B da mesma decisão');
{
  const off = fs.readFileSync(`${RAIZ_WS}/offline/walkstamp-offline.html`, 'utf8');
  const soOff = off.split(lib).join('');
  /* TERCEIRO, e não "qualquer endereço": o pacote offline continua trazendo o
     endereço do NOSSO site — os links do rodapé e o da conta — e um link não é
     egressão até alguém clicar nele, que é o gesto mais explícito que existe.
     O `/api/menu` também sobra como texto, e não dispara: o `fetch` dele é
     barrado por `location.protocol === 'file:'` antes de tentar, para não sujar
     o console de quem abriu um arquivo local e não pediu conta nenhuma.
     Quem prova que nada é CHAMADO ali é o `offlineb.mjs`, que mede. */
  const deFora = DECLARADOS.filter((d) => !d.nossoDominio);
  const vazaram = deFora.flatMap((d) => d.hosts.filter((h) => soOff.includes(h)));
  ok('nenhum endereço de fora sobrou no arquivo único', vazaram.length === 0,
     [...new Set(vazaram)].slice(0, 4).join(' '));
  ok('  e a matriz sabe qual endereço é nosso e qual não é',
     deFora.length > 0 && deFora.length < DECLARADOS.length,
     `${deFora.length} de fora, ${DECLARADOS.length - deFora.length} nossos`);
}

console.log('\n[4] o que sai SOZINHO é exatamente o que a matriz diz');
const srv = http.createServer((q, r) => {
  if (q.url.startsWith('/app')) {
    r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return r.end(app);
  }
  r.writeHead(204); r.end();
});
await new Promise((r) => srv.listen(8849, r));
const br = await chromium.launch({ executablePath: CHROME_WS });
const pg = await (await br.newContext()).newPage();
const pedidos = [];
pg.on('request', (q) => {
  const u = q.url();
  if (/^(data|blob):/.test(u)) return;
  if (u === 'http://localhost:8849/app.html') return;      // a própria página
  if (u.includes('/favicon.ico')) return;                   // o ícone da aba
  pedidos.push(u);
});
await pg.goto('http://localhost:8849/app.html');
/* Nove segundos e nenhum gesto. A antecipação do modelo espera 1200 ms; se ela
   voltasse a disparar sozinha, é aqui que apareceria. */
await pg.waitForTimeout(9000);
{
  const sozinhos = MATRIZ.filter((d) => d.quando === 'sozinho' && d.onde.includes('web'));
  const gestos   = MATRIZ.filter((d) => d.quando === 'gesto'   && d.onde.includes('web'));
  const casou = (u, d) => d.hosts.some((h) => u.includes(h));

  const naoDeclarado = pedidos.filter((u) => !MATRIZ.some((d) => casou(u, d)));
  ok('nenhum pedido automático fora da matriz', naoDeclarado.length === 0,
     [...new Set(naoDeclarado)].slice(0, 3).join(' '));

  /* Cada linha "sozinho" tem que ter SAÍDO. Uma matriz que declara um destino
     automático que já não existe assusta à toa — e some com a confiança na
     linha ao lado, que é verdadeira. */
  for (const d of sozinhos) {
    /* A HOSPEDAGEM É O PRÓPRIO CARREGAMENTO, e não um pedido a mais. A primeira
       versão deste laço a exigia na lista de pedidos — a mesma lista de onde a
       requisição da página é retirada, porque ela é a página. A régua cobrava
       de si mesma uma coisa que ela tinha acabado de descontar. */
    if (d.ehAPagina) {
      ok(`  ${d.id}: é o próprio carregamento da página, e a página carregou`,
         (await pg.title()).length > 0);
      continue;
    }
    const saiu = pedidos.some((u) => casou(u, d));
    ok(`  ${d.id}: declarado "sozinho", e saiu mesmo`, saiu,
       saiu ? '' : 'declarado automático e nada foi pedido');
  }
  console.log('\n[5] e o que exige gesto não saiu — é a frase, testada');
  for (const d of gestos) {
    const vazou = pedidos.filter((u) => casou(u, d));
    ok(`  ${d.id}: declarado "com gesto", e não saiu sozinho`, vazou.length === 0,
       [...new Set(vazou)].slice(0, 2).join(' '));
  }
  console.log(`     ${pedidos.length} pedido(s) em 9 s parado: ` +
              [...new Set(pedidos.map((u) => u.replace(/^https?:\/\//, '').split('/')[0]))].join(' · '));
}
await br.close(); srv.close();

console.log('\n[6] a frase e a matriz estão no mesmo bloco, nos cinco idiomas');
{
  const I18N = JSON.parse(fs.readFileSync(`${RAIZ_WS}/src/i18n-site.json`, 'utf8'));
  const vistos = new Set();
  for (const L of ['pt', 'en', 'es', 'de', 'fr']) {
    const corpo = fs.readFileSync(`${RAIZ_WS}/src/site/bodies/seguranca.${L}.html`, 'utf8');
    ok(`${L}: a página traz a frase`, corpo.includes('{{promessaA}}'));
    ok(`  ${L}: e a matriz junto dela`, corpo.includes('{{matrizEgressao}}'));
    /* No MESMO bloco: entre a frase e a tabela não pode haver outro <h2>. Uma
       promessa com as exceções três seções abaixo é um absoluto, na prática. */
    const i = corpo.indexOf('{{promessaA}}');
    const j = corpo.indexOf('{{matrizEgressao}}');
    ok(`  ${L}: sem outro título entre as duas`,
       i >= 0 && j > i && !corpo.slice(i, j).includes('<h2>'));
    vistos.add(I18N[L].promessaA);
  }
  ok('e a frase é escrita uma vez por idioma — cinco textos distintos',
     vistos.size === 5, `${vistos.size} de 5`);
  /* A frase existe UMA VEZ. Se alguém a reescrever à mão numa página, é a
     décima terceira redação da mesma verdade voltando. */
  let repetida = 0;
  for (const f of fs.readdirSync(`${RAIZ_WS}/src/site/bodies`)) {
    const c = fs.readFileSync(`${RAIZ_WS}/src/site/bodies/${f}`, 'utf8');
    for (const L of ['pt', 'en', 'es', 'de', 'fr']) {
      if (c.includes(I18N[L].promessaA)) { console.log('     escrita à mão em ' + f); repetida++; }
    }
  }
  ok('nenhuma página reescreve a frase à mão', repetida === 0, String(repetida));
}

console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'a matriz bate com o que o produto faz'));
process.exit(falhas ? 1 : 0);

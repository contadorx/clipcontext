/* A PÁGINA DE PREÇOS — a régua da página que decide a compra.
 *
 * Ela nasceu porque a página mudou de trabalho. Antes vendia quantidade: uma
 * lista de noventa e quatro itens com vistos, aberta, no meio do caminho. Agora
 * vende resultado, e cada linha de cartão virou promessa comercial — quer
 * dizer, uma coisa que alguém compra por acreditar.
 *
 * O que este arquivo cobra é o que não aparece quebrado na tela. Um CTA a mais
 * num cartão, um "em breve" ao lado de um botão de compra, um mínimo de cinco
 * sobrevivendo em alemão, uma requisição para fora enquanto a pessoa digita o
 * custo da própria hora: nada disso derruba página. Tudo isso custa venda.
 *
 *   node testes/precos.mjs        (com o Next de pé em :8802)
 */
import { chromium } from 'playwright';
import fs from 'fs';
import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';

const SITE = 'http://localhost:8802';
const rotas = JSON.parse(fs.readFileSync(`${RAIZ_WS}/src/rotas.json`, 'utf8'));
const features = JSON.parse(fs.readFileSync(`${RAIZ_WS}/src/features.json`, 'utf8'));
const stripe = fs.readFileSync(`${RAIZ_WS}/lib/stripe.ts`, 'utf8');
const { idiomas, slugs, caminhoConta } = rotas;
const pre = (L) => (L === 'pt' ? '' : '/' + L);
const enderecoPrecos = (L) => SITE + pre(L) + '/' + slugs.precos[L];

/* O mínimo publicado NÃO é escrito aqui: sai do mesmo `lib/stripe.ts` que o
   checkout usa. Escrito aqui, este arquivo viraria a terceira regra pública
   sobre quem pode comprar o Team — e a que ninguém lembraria de atualizar. */
const MINIMO = Number(/assentos:\s*(\d+)/.exec(stripe.slice(stripe.indexOf('time:')))[1]);
const QUANTAS = features.grupos.reduce((n, g) => n + g.itens.length, 0);

let falhas = 0;
const ok = (n, c, e) => {
  console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : ''));
  if (!c) falhas++;
};

const br = await chromium.launch({ executablePath: CHROME_WS });
const ctx = await br.newContext({ viewport: { width: 1200, height: 1000 } });
const pg = await ctx.newPage();

/* ---- [1] um CTA primário por cartão, e só um ------------------------------
   Dois botões num cartão de preço é a pessoa parada escolhendo entre eles em
   vez de comprando. */
console.log('[1] um CTA primário por cartão, e só um');
for (const L of idiomas) {
  await pg.goto(enderecoPrecos(L), { waitUntil: 'domcontentloaded' });
  const cartoes = pg.locator('.plans.tres .plan');
  ok(`${L}: três cartões`, (await cartoes.count()) === 3);
  const ruins = [];
  for (const p of ['free', 'personal', 'team']) {
    const n = await pg.locator(`.plan[data-plano="${p}"] a.btn`).count();
    if (n !== 1) ruins.push(`${p}=${n}`);
  }
  ok(`  um botão em cada`, ruins.length === 0, ruins.join(' '));
  /* E NENHUM `mailto:`. Ele era a saída secundária do cartão Personal quando a
     venda ainda não existia — "fale comigo" ao lado de "assine". Um cartão com
     duas saídas é a pessoa parada escolhendo entre elas em vez de comprando, e
     um `mailto:` só funciona em metade das máquinas corporativas.
     Esta é a metade que o `a.btn` acima não pega: um `mailto` não é `.btn`. */
  ok(`  e nenhum mailto sobrou nos cartões`,
     (await pg.locator('.plans.tres a[href^="mailto:"]').count()) === 0);
}

/* ---- [2] o CTA do Free não passa por conta nem por cartão ------------------ */
console.log('\n[2] o CTA do Free abre a ferramenta, e não um cadastro');
for (const L of idiomas) {
  await pg.goto(enderecoPrecos(L), { waitUntil: 'domcontentloaded' });
  const href = await pg.locator('.plan[data-plano="free"] a.btn').getAttribute('href');
  ok(`${L}: leva à ferramenta`, /^\/app(\?|$)/.test(href || ''), href);
  ok(`  e não à conta`, !(href || '').startsWith(caminhoConta[L]), href);
}

/* ---- [3] os CTAs pagos levam ao lugar onde se compra ---------------------- */
console.log('\n[3] Personal e Team levam à compra');
for (const L of idiomas) {
  await pg.goto(enderecoPrecos(L), { waitUntil: 'domcontentloaded' });
  for (const p of ['personal', 'team']) {
    const a = pg.locator(`.plan[data-plano="${p}"] a.btn`);
    const href = await a.getAttribute('href');
    ok(`${L}/${p}: vai para a conta, que é onde o checkout começa`,
       (href || '').startsWith(caminhoConta[L]), href);
    ok(`  e o cartão está identificado`, (await a.getAttribute('data-cta')) === p);
  }
}

/* ---- [4] a comparação curta tem exatamente cinco linhas ------------------- */
console.log('\n[4] a comparação curta tem cinco linhas, e só cinco');
for (const L of idiomas) {
  await pg.goto(enderecoPrecos(L), { waitUntil: 'domcontentloaded' });
  ok(`${L}: cinco linhas`, (await pg.locator('table.cmpCurta tbody tr').count()) === 5);
  ok(`  e três colunas de plano em cada`,
     (await pg.locator('table.cmpCurta tbody tr:first-child td').count()) === 3);
}

/* ---- [5] a tabela grande sai do features.json, e o número é contado ------- */
console.log('\n[5] a lista completa sai do catálogo, e o número bate');
for (const L of idiomas) {
  await pg.goto(enderecoPrecos(L), { waitUntil: 'domcontentloaded' });
  const itens = await pg.locator('details.listaCompleta .fts li').count();
  ok(`${L}: ${QUANTAS} linhas no catálogo, ${itens} na página`, itens === QUANTAS);
  /* O número no texto é CONTADO. Um número redondo escrito à mão envelhece na
     primeira vez que alguém mexe na lista e esquece do parágrafo. */
  const texto = await pg.locator('.tpRegra').innerText();
  ok(`  e o número no texto acima é ${QUANTAS}`,
     new RegExp(`\\b${QUANTAS}\\b`).test(texto), texto.slice(0, 80));
}

/* ---- [6] nenhuma contradição textual -------------------------------------- */
console.log('\n[6] a página não se contradiz');
{
  /* Os mínimos que NÃO são o publicado, nas cinco línguas. Se um deles
     aparecer, a página anuncia duas regras diferentes sobre a mesma compra. */
  const OUTROS = {
    pt: ['2 pessoas', '4 pessoas', '5 pessoas', '10 pessoas'],
    en: ['2 people', '4 people', '5 people', '10 people'],
    es: ['2 personas', '4 personas', '5 personas', '10 personas'],
    de: ['2 Personen', '4 Personen', '5 Personen', '10 Personen'],
    fr: ['2 personnes', '4 personnes', '5 personnes', '10 personnes'],
  };
  const MIN = { pt: `${MINIMO} pessoas`, en: `${MINIMO} people`, es: `${MINIMO} personas`,
                de: `${MINIMO} Personen`, fr: `${MINIMO} personnes` };
  for (const L of idiomas) {
    await pg.goto(enderecoPrecos(L), { waitUntil: 'domcontentloaded' });
    const txt = (await pg.locator('main, body').first().innerText()).replace(/\s+/g, ' ');
    ok(`${L}: o mínimo publicado é ${MINIMO}`, txt.includes(MIN[L]), MIN[L]);
    const intrusos = OUTROS[L].filter((o) => o !== MIN[L] && txt.includes(o));
    ok(`  e nenhum outro mínimo aparece`, intrusos.length === 0, intrusos.join(', '));

    /* Um selo de "em breve" DENTRO de um cartão de plano é o item que a pessoa
       acha que está comprando e não está. Nos cartões não pode haver nenhum —
       eles são o que já se compra; o que ainda não existe mora na lista. */
    ok(`  nenhum "em breve" dentro dos cartões`,
       (await pg.locator('.plans.tres .soon, .plans.tres .beta, .plans.tres .descoberta').count()) === 0);

    /* Lista de espera ao lado de botão de compra: a página pede e-mail para
       avisar de um produto enquanto vende outro na mesma tela. */
    ok(`  nenhuma captura de e-mail junto dos planos`,
       (await pg.locator('form input[type="email"]').count()) === 0);
  }
}

/* ---- [7] a página não chama a rede ---------------------------------------- */
console.log('\n[7] nada sai para fora ao carregar');
{
  const fora = [];
  const espia = (r) => {
    const u = r.url();
    if (!u.startsWith(SITE) && !u.startsWith('data:') && !u.startsWith('blob:')) fora.push(u);
  };
  pg.on('request', espia);
  for (const L of idiomas) {
    await pg.goto(enderecoPrecos(L), { waitUntil: 'networkidle' });
  }
  pg.off('request', espia);
  ok('nenhuma requisição para outro domínio', fora.length === 0,
     [...new Set(fora)].slice(0, 3).join(' '));
}

/* ---- [8] a calculadora não envia nada ------------------------------------- */
console.log('\n[8] a calculadora conta no navegador e não conta para ninguém');
{
  await pg.goto(SITE + '/precos', { waitUntil: 'networkidle' });
  const roi = pg.locator('#roi');
  ok('o bloco aparece quando o script roda', await roi.isVisible());

  const durante = [];
  const espia = (r) => durante.push(r.url());
  pg.on('request', espia);
  /* Digitar os quatro campos é o momento em que uma página com analytics
     mandaria os números embora — são o custo da hora e o tamanho da operação
     de quem está lendo. */
  for (const [id, v] of [['roiCasos', '80'], ['roiMin', '15'],
                         ['roiRodadas', '4'], ['roiHora', '120']]) {
    await pg.locator('#' + id).fill(v);
  }
  await pg.waitForTimeout(700);
  pg.off('request', espia);
  ok('nenhuma requisição enquanto se digita', durante.length === 0,
     [...new Set(durante)].slice(0, 3).join(' '));

  const horas = await pg.locator('#roiHoras').textContent();
  ok('e a conta muda na tela', horas !== '—' && Number(horas) > 0, horas);
  /* 80 casos × 15 min × 4 rodadas ÷ 60 = 80 horas. Uma calculadora que não
     confere é pior do que nenhuma: ela tem casas decimais. */
  ok('  e a conta está certa', Math.abs(Number(horas) - 80) < 0.05, horas);
  const nota = (await pg.locator('.roiNota').first().innerText()).toLowerCase();
  ok('  e o resultado está rotulado como estimativa', nota.includes('estimativa'), nota.slice(0, 60));
}

/* ---- [8b] a premissa da calculadora ---------------------------------------
   O campo de minutos é a única PREMISSA NOSSA no meio de quatro números do
   usuário: os outros três ele sabe de cabeça, este ele aceita porque já veio
   preenchido. Ele nasceu em 12 — um chute com cara de medição, na frente de
   quem vai comprar. Em 27/08 virou 45, que é o que leva montar uma evidência
   à mão em uso real, e a página passou a DIZER de onde vem o número.
   A régua fixa as duas coisas nos cinco idiomas, porque um default é
   exatamente o tipo de coisa que volta a ser chute sem ninguém notar. */
console.log('\n[8b] a premissa que já vem preenchida diz de onde veio');
{
  const rotas = { pt: '/precos', en: '/en/precos', es: '/es/precos',
                  de: '/de/preise', fr: '/fr/tarifs' };
  const marca = { pt: 'uso real', en: 'real use', es: 'uso real',
                  de: 'echten Einsatz', fr: 'usage réel' };
  for (const [lang, rota] of Object.entries(rotas)) {
    await pg.goto(SITE + rota, { waitUntil: 'networkidle' });
    const v = await pg.locator('#roiMin').inputValue();
    ok(`${lang}: os minutos por caso começam em 45`, v === '45', v);
    const notas = (await pg.locator('.roiNota').allInnerTexts()).join(' ');
    ok(`  ${lang}: e a página diz que o 45 foi medido`,
       notas.includes('45') && notas.includes(marca[lang]),
       notas.replace(/\s+/g, ' ').slice(0, 90));
  }
}

/* ---- [9] acessibilidade --------------------------------------------------- */
console.log('\n[9] dá para usar a página pelo teclado');
{
  await pg.goto(SITE + '/precos', { waitUntil: 'domcontentloaded' });

  /* O <details> tem de ser alcançável e abrível sem mouse. */
  const sumario = pg.locator('details.listaCompleta > summary');
  await sumario.focus();
  ok('o resumo da lista recebe foco', await sumario.evaluate((e) => e === document.activeElement));
  /* `getComputedStyle(e, ':focus-visible')` devolve string vazia: o segundo
     argumento é para PSEUDO-ELEMENTO, não para pseudo-classe. A primeira versão
     desta linha passava sempre, porque `!/none/.test('')` é verdadeiro — uma
     trava que não podia reprovar. Aqui o elemento está de fato com o foco, e o
     que se lê é o contorno resolvido. */
  const contorno = await sumario.evaluate((e) => {
    const s = getComputedStyle(e);
    return `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`;
  });
  const largura = parseFloat(contorno.split(' ')[1]);
  ok('  e o foco é visível', !/^none/.test(contorno) && largura >= 1, contorno);
  const antes = await pg.locator('details.listaCompleta').evaluate((e) => e.open);
  await pg.keyboard.press('Enter');
  ok('  e o Enter abre e fecha', (await pg.locator('details.listaCompleta').evaluate((e) => e.open)) !== antes);

  /* Os campos da calculadora, na ordem em que se lê. */
  await pg.locator('#roiCasos').focus();
  const ordem = [];
  for (let i = 0; i < 3; i++) {
    await pg.keyboard.press('Tab');
    ordem.push(await pg.evaluate(() => document.activeElement && document.activeElement.id));
  }
  ok('a tabulação segue a ordem dos campos',
     ordem.join(',') === 'roiMin,roiRodadas,roiHora', ordem.join(','));

  /* Os sinais da comparação: o "sim" e o "não" não podem ser a mesma cor, ou a
     tabela inteira parece dizer que sim. */
  const cSim = await pg.locator('table.cmpCurta td.sim').first().evaluate((e) => getComputedStyle(e).color);
  const cNao = await pg.locator('table.cmpCurta td.nao').first().evaluate((e) => getComputedStyle(e).color);
  ok('o ✓ e o ✕ têm cores diferentes', cSim !== cNao, `${cSim} / ${cNao}`);
  /* E o sinal não é a única informação: quem não distingue as cores lê o
     rótulo. */
  const rot = await pg.locator('table.cmpCurta td.nao').first().getAttribute('aria-label');
  ok('  e o "não" tem rótulo em texto', !!rot && rot.length > 2, rot);
}

/* ---- [10] a 380 px não há rolagem lateral --------------------------------- */
console.log('\n[10] no telefone a página não anda para o lado');
{
  const estreito = await ctx.newPage();
  for (const L of idiomas) {
    await estreito.setViewportSize({ width: 380, height: 800 });
    await estreito.goto(enderecoPrecos(L), { waitUntil: 'domcontentloaded' });
    const sobra = await estreito.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(`${L}: sem rolagem lateral a 380 px`, sobra <= 1, `${sobra}px de sobra`);
  }
  /* E a lista de noventa e quatro linhas chega fechada no telefone: aberta,
     ela é uma parede de rolagem entre a decisão e o FAQ. */
  ok('e a lista completa chega fechada',
     (await estreito.locator('details.listaCompleta').evaluate((e) => e.open)) === false);
  await estreito.close();
}

/* ---- [11] a forma dos três cartões ----------------------------------------
 *
 * VEIO DO `cenarios.mjs [7]`, e veio corrigido. Aquele bloco nasceu antes desta
 * régua existir e ficou afirmando a página ANTIGA: cobrava que o `h3` de cada
 * cartão fosse "Free", "Personal" e "Team", e que os três preços aparecessem
 * lado a lado em real, dólar e euro.
 *
 * Os dois viraram falsos por decisão, e não por defeito. O `h3` passou a ser o
 * RESULTADO ("Crie a evidência") com o nome do plano abaixo, porque quem chega
 * não está comprando "Personal": está comprando parar de refazer quarenta vezes
 * a mesma coisa. E cada idioma passou a mostrar UMA moeda, a dele — três moedas
 * na mesma tela obrigam a pessoa a achar a própria linha antes de saber o preço.
 *
 * Manter duas réguas sobre a mesma página é o defeito que mais custou a este
 * projeto. Então o que era único lá mora aqui agora, e lá ficou o ponteiro. */
console.log('\n[11] a forma dos três cartões');
{
  /* A moeda de cada idioma sai do `build.py`, que é quem a decide. Escrita
     aqui, seria a segunda tabela de moeda do projeto. */
  const bp = fs.readFileSync(`${RAIZ_WS}/build.py`, 'utf8');
  const bloco = /MOEDA_DO_IDIOMA = \{([^}]*)\}/.exec(bp)[1];
  const MOEDA = Object.fromEntries([...bloco.matchAll(/"(\w+)":\s*"(\w+)"/g)].map((m) => [m[1], m[2]]));
  const SIMBOLO = { BRL: 'R$', USD: 'US$', EUR: '€' };
  const OUTROS = { BRL: ['US$', '€'], USD: ['R$', '€'], EUR: ['R$', 'US$'] };
  ok('o build.py declara a moeda dos cinco idiomas',
     idiomas.every((L) => MOEDA[L]), JSON.stringify(MOEDA));

  for (const L of idiomas) {
    await pg.goto(enderecoPrecos(L), { waitUntil: 'domcontentloaded' });

    /* O NOME DO PLANO existe, e está no subtítulo — não no título. */
    const nomes = await pg.locator('.plan .planoNome').allTextContents();
    ok(`${L}: os três planos se identificam pelo nome`,
       nomes.length === 3 && /Free/.test(nomes[0]) && /Personal/.test(nomes[1]) && /Team/.test(nomes[2]),
       nomes.join(' | ').slice(0, 70));
    const titulos = await pg.locator('.plan h3').allTextContents();
    ok(`  e o título de cada um é o RESULTADO, não o nome`,
       titulos.every((x) => !/^(Free|Personal|Team)$/.test(x.trim())), titulos.join(','));

    /* UMA MOEDA POR PÁGINA, a do idioma. */
    const precos = (await pg.locator('.plan .price').allTextContents()).join(' ');
    const minha = SIMBOLO[MOEDA[L]];
    ok(`  ${L}: os preços saem em ${MOEDA[L]}`, precos.includes(minha), precos.slice(0, 60));
    const intrusas = OUTROS[MOEDA[L]].filter((s) => precos.includes(s));
    ok(`  e nenhuma outra moeda aparece nos cartões`, intrusas.length === 0, intrusas.join(' '));

    /* MESMA ALTURA, listas curtas e equilibradas. Um cartão mais alto que os
       outros lê-se como o cartão "certo", e a decisão vira desenho e não valor. */
    const alturas = await pg.locator('.plan')
      .evaluateAll((e) => e.map((x) => Math.round(x.getBoundingClientRect().height)));
    ok(`  os três têm a mesma altura`, new Set(alturas).size === 1, alturas.join(' / '));
    const itens = await pg.locator('.plan ul').evaluateAll((u) => u.map((x) => x.children.length));
    ok(`  a lista de cada um é curta`, itens.every((n) => n <= 6), itens.join('/'));
    ok(`  e nenhuma é muito mais longa que a outra`,
       Math.max(...itens) - Math.min(...itens) <= 1, itens.join('/'));
  }
}

/* ---- a degustação de 14 dias é DITA, nos cinco idiomas --------------------
 *
 * Ela existe no banco desde sempre — `plano_de`, migração 20260815142538:68:
 * quem entra na conta pela primeira vez ganha 14 dias com tudo do Team, sem
 * cartão e sem checkout. E "14 dias" tinha ZERO ocorrências em `/`, `/precos`,
 * `/evidencia-de-teste`, `/seguranca` e `/comparativo`: a melhor oferta do
 * produto só aparecia DEPOIS do login, quer dizer, para quem já tinha decidido.
 *
 * O número sai do BANCO e não é escrito aqui, pelo mesmo motivo do `MINIMO`
 * logo acima: escrito aqui, esta seria a terceira regra pública sobre a
 * degustação, e a que ninguém lembraria de atualizar. Se um dia forem 30 dias,
 * a migração muda e a página tem de mudar junto — e é essa a afirmação. */
console.log('\n[' + 'degustação] os 14 dias aparecem antes do login');
{
  const migracoes = fs.readdirSync(`${RAIZ_WS}/supabase/migrations`)
    .filter((f) => /funcoes|plano_de/.test(f))
    .map((f) => fs.readFileSync(`${RAIZ_WS}/supabase/migrations/${f}`, 'utf8')).join('\n');
  const m = /'time'::text,\s*\d+,\s*(\d+)/.exec(migracoes);
  ok('o banco diz de quantos dias é a degustação', !!m, m && m[1]);
  const DIAS = m ? m[1] : '14';

  for (const L of idiomas) {
    await pg.goto(enderecoPrecos(L), { waitUntil: 'domcontentloaded' });
    const txt = await pg.locator('body').innerText();
    ok(`${L}: a página diz "${DIAS}"`, txt.includes(DIAS), '');
    /* No subtítulo dos DOIS cartões pagos: é ao lado do preço que a objeção
       nasce, e é ali que ela precisa de resposta. */
    for (const plano of ['personal', 'team']) {
      const sub = await pg.locator(`.plan[data-plano="${plano}"] .planoNome`).innerText()
        .catch(() => '');
      ok(`  ${L}/${plano}: o subtítulo traz a degustação`, sub.includes(DIAS), sub.slice(0, 48));
    }
    /* E uma pergunta no FAQ de compra, que é onde ela cabe por extenso — e
       onde ela responde à objeção real, que não é "quanto custa" e sim
       "e se não servir?". */
    const faq = await pg.locator('.faqCompra').innerText().catch(() => '');
    ok(`  ${L}: o FAQ de compra responde "dá para testar antes?"`,
       faq.includes(DIAS), faq.slice(0, 60));
    /* SEM CARTÃO é metade da oferta: uma degustação que pede cartão é um
       pedágio na porta, e o produto promete não ter. */
    ok(`  ${L}: e diz que não pede cartão`,
       /sem cart|no card|sin tarjeta|ohne Karte|sans carte/i.test(faq + txt));
  }
}

await br.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nPágina de preços: tudo passou.');
process.exit(falhas ? 1 : 0);

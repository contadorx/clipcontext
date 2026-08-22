/* O QUE A PÁGINA NEGA TEM DE CONTINUAR SENDO VERDADE.
 *
 * Cada página de caso termina com uma seção honesta — "o que ele não faz". Ela
 * é, provavelmente, a melhor parte do site: quem faz avaliação de fornecedor lê
 * aquilo e acredita no resto. E ela apodrece sozinha, porque nada no build liga
 * um parágrafo de negação à funcionalidade que ele nega.
 *
 * Três negações estavam mentindo quando este arquivo nasceu:
 *
 *   - `casoUx` dizia "ainda não guarda o clipe de vídeo do momento marcado …
 *     é o que está em construção" — trinta linhas depois de a MESMA página
 *     dizer "só os 15 segundos em volta do que você marcou são guardados", e
 *     com o clipe existindo no produto desde então (`#recClipe`, `#lenteClipe`,
 *     `#clipeBaixar`) e no catálogo como pronto e gratuito;
 *   - `casoIn` dizia "o que ainda não existe é a ferramenta te guiar por ele
 *     perguntando 'esta tela ainda está assim?'" — que é, palavra por palavra,
 *     o que a revisão assistida faz (`revAbrir`, `revPintar`), também no
 *     catálogo como pronta;
 *   - e `casoUx` mandava a agência de três pessoas para o Team, enquanto o
 *     Team começa em cinco assentos no `lib/stripe.ts`. Duas regras públicas
 *     diferentes sobre quem pode comprar o quê.
 *
 * Nenhuma das três quebrava nada. O site subia, a suíte passava, e a página
 * seguia recusando a venda por conta própria.
 *
 * A trava: cada parágrafo de negação carrega `data-nao="nome"`, e nome nenhum
 * pode coincidir com um `id` do catálogo que esteja anunciado como pronto. Uma
 * funcionalidade que sai de "em breve" e chega ao produto reprova aqui até que
 * alguém volte na página e reescreva a frase — que é exatamente o passo que
 * ninguém dava.
 *
 *   node testes/promessa.mjs
 */
import fs from 'fs';
import { RAIZ_WS } from './_caminhos.mjs';

let falhas = 0;
const ok = (n, c, e) => {
  console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : ''));
  if (!c) falhas++;
};

const CASOS = ['casoEv', 'casoIn', 'casoUx', 'casoAta', 'casoIa'];
const LINGUAS = ['pt', 'en', 'es', 'de', 'fr'];
const corpo = (c, lg) =>
  fs.readFileSync(`${RAIZ_WS}/src/site/bodies/${c}.${lg}.html`, 'utf8');
const negacoes = (txt) =>
  [...txt.matchAll(/data-nao="([^"]+)"/g)].map((m) => m[1]);

/* ---- [1] o registro é o mesmo nas cinco línguas ---------------------------
   Se ele não for, o teste seguinte vira sorteio: bastaria a tradução alemã
   perder a marcação para a negação alemã voltar a mentir sem ninguém ver. */
for (const c of CASOS) {
  const base = negacoes(corpo(c, 'pt'));
  ok(`${c}: a seção "o que ele não faz" está registrada`, base.length >= 3,
     `${base.length} parágrafos`);
  for (const lg of LINGUAS.slice(1)) {
    const outra = negacoes(corpo(c, lg));
    ok(`${c}.${lg}: nega as mesmas coisas, na mesma ordem`,
       outra.join('|') === base.join('|'),
       outra.join('|') === base.join('|') ? '' : `${outra.join(',')} ≠ ${base.join(',')}`);
  }
}

/* ---- [2] nada do que o catálogo vende como pronto pode ser negado --------- */
const cat = JSON.parse(fs.readFileSync(`${RAIZ_WS}/src/features.json`, 'utf8'));
const itens = cat.grupos.flatMap((g) => g.itens);
const porId = new Map(itens.filter((i) => i.id).map((i) => [i.id, i]));
/* `estado` ausente quer dizer `producao` — é a mesma regra do `lib/site.ts`, e
   ela mora nos dois lados de propósito: uma régua que importasse a definição do
   código que ela mede pararia de reprovar no dia em que o código mudasse a
   definição, que é justamente o dia em que ela precisa reprovar. */
const estadoDe = (i) => i.estado || 'producao';

const todas = new Set(CASOS.flatMap((c) => negacoes(corpo(c, 'pt'))));
for (const nome of [...todas].sort()) {
  const item = porId.get(nome);
  ok(`"${nome}" não é vendido como pronto no catálogo`,
     !item || estadoDe(item) !== 'producao',
     item ? `o catálogo anuncia "${item.pt}" no plano ${item.planos}` : '');
}

/* As duas que mentiam: o `id` no catálogo é o que dá dente ao teste acima.
   Sem ele a marcação `data-nao="clipe"` voltaria a passar calada. */
for (const id of ['clipe', 'revisaoAssistida']) {
  const item = porId.get(id);
  ok(`o catálogo ainda identifica "${id}"`, !!item);
  if (item) ok(`  e o anuncia como pronto`, estadoDe(item) === 'producao',
               estadoDe(item));
}

/* ---- [3] o mínimo do Team é um número só --------------------------------- */
const stripe = fs.readFileSync(`${RAIZ_WS}/lib/stripe.ts`, 'utf8');
const bloco = stripe.slice(stripe.indexOf('time:'));
const min = Number(/assentos:\s*(\d+)/.exec(bloco)[1]);
ok(`o Team começa em ${min} assentos no lib/stripe.ts`, min > 0);

/* Os dois gêneros onde a língua os tem: a primeira versão desta lista só
   trazia "duas" e deixava "de dois em diante" passar. */
const PALAVRA = {
  pt: { 2: ['dois', 'duas'], 3: ['três'], 4: ['quatro'], 5: ['cinco'] },
  en: { 2: ['two'], 3: ['three'], 4: ['four'], 5: ['five'] },
  es: { 2: ['dos'], 3: ['tres'], 4: ['cuatro'], 5: ['cinco'] },
  de: { 2: ['zwei'], 3: ['drei'], 4: ['vier'], 5: ['fünf'] },
  fr: { 2: ['deux'], 3: ['trois'], 4: ['quatre'], 5: ['cinq'] },
};
for (const lg of LINGUAS) {
  /* A frase dos planos é a última `p.small muted` da página do caso de UX. */
  const linhas = corpo('casoUx', lg).split('\n')
    .filter((l) => /class="small muted"/.test(l));
  const frase = linhas[linhas.length - 1] || '';
  const certo = PALAVRA[lg][min];
  ok(`casoUx.${lg}: a frase dos planos diz "${certo.join('/')}"`,
     certo.some((p) => new RegExp(p, 'i').test(frase)), frase.slice(0, 90));
  const errados = Object.entries(PALAVRA[lg])
    .filter(([n]) => Number(n) !== min)
    .flatMap(([, ps]) => ps)
    .filter((p) => new RegExp(`\\b${p}\\b`, 'i').test(frase));
  ok(`casoUx.${lg}: e não manda ninguém para o Team antes disso`,
     errados.length === 0, errados.join(', '));
}

/* ---- [4] o cartão que administra assentos não pode dizer "sem login" ------
   O rodapé do cartão Team terminava, nos cinco idiomas, em "sem login e sem
   exigir cadastro para a sua TI aprovar" — três linhas abaixo de "painel de
   assentos: convidar, bloquear e escolher o prazo". Quem avalia fornecedor lê a
   primeira frase, descobre a conta por magic link, e para de acreditar na
   página. A verdade é mais estreita e vende melhor: quem grava não faz login
   (a licença viaja no link e é conferida no computador dele), e conta existe só
   para quem coordena. */
const SEM_LOGIN = {
  pt: /sem login|sem cadastro/i,
  en: /no login|no sign-?up/i,
  es: /sin inicio de sesión|sin registro/i,
  de: /ohne login|ohne registrierung/i,
  fr: /sans identifiant|sans inscription/i,
};
for (const lg of LINGUAS) {
  const html = fs.readFileSync(`${RAIZ_WS}/src/site/bodies/precos.${lg}.html`, 'utf8');
  const i = html.indexOf('data-plano="team"');
  ok(`precos.${lg}: o cartão Team existe`, i > 0);
  const cartao = html.slice(i, html.indexOf('</div>', html.indexOf('</ul>', i)));
  const achou = SEM_LOGIN[lg].exec(cartao);
  ok(`precos.${lg}: o cartão que administra assentos não promete "sem login"`,
     !achou, achou ? achou[0] : '');
}

/* ---- [5] a comparação curta tem a mesma forma nos cinco idiomas ---------
   Ela existe para responder em cinco linhas o que a tabela de noventa e três
   não responde. Se uma tradução perder uma linha, ou marcar como incluído no
   Free algo que o Free não tem, a página passa a vender coisas diferentes em
   línguas diferentes — e ninguém que fala uma delas percebe. A forma (quais
   células são o travessão) é a parte verificável sem reler prosa. */
const forma = (lg) => {
  const html = fs.readFileSync(`${RAIZ_WS}/src/site/bodies/precos.${lg}.html`, 'utf8');
  const i = html.indexOf('class="legal cmpPlanos"');
  if (i < 0) return null;
  const tab = html.slice(i, html.indexOf('</table>', i));
  return [...tab.matchAll(/<tr><th scope="row">.*?<\/tr>/g)]
    .map((m) => [...m[0].matchAll(/<td( class="nao")?/g)]
      .map((c) => (c[1] ? '—' : 'x')).join(''));
};
const base5 = forma('pt');
ok('a comparação curta existe na página de preços', !!base5 && base5.length >= 5,
   base5 ? `${base5.length} linhas` : 'não achei a tabela');
if (base5) {
  ok('  e toda linha tem os três planos', base5.every((l) => l.length === 3),
     base5.filter((l) => l.length !== 3).join(' '));
  for (const lg of LINGUAS.slice(1)) {
    const outra = forma(lg);
    ok(`precos.${lg}: a mesma comparação, com as mesmas exclusões`,
       !!outra && outra.join('|') === base5.join('|'),
       !outra ? 'não achei a tabela'
              : outra.join('|') === base5.join('|') ? ''
              : `${outra.join(',')} ≠ ${base5.join(',')}`);
  }
}

/* ---- [6] o vocabulário de estado só tem quatro palavras -------------------
   Um campo livre vira, em seis meses, `beta`, `Beta`, `em beta`, `parcial` e
   `quase` — e aí nenhum teste consegue mais perguntar nada sobre ele. E cada
   estado que aparece no catálogo tem que ter palavra nos cinco idiomas: um
   selo sem tradução sai em português numa página alemã, que é como este projeto
   já entregou o tour errado duas vezes. */
const ESTADOS = ['producao', 'beta', 'construcao', 'descoberta'];
const CHAVE = { beta: 'tpBeta', construcao: 'tpBreve', descoberta: 'tpDescoberta' };
{
  const fora = itens.map(estadoDe).filter((e) => !ESTADOS.includes(e));
  ok('nenhum estado fora do vocabulário', fora.length === 0, [...new Set(fora)].join(', '));

  const usados = [...new Set(itens.map(estadoDe))].filter((e) => e !== 'producao');
  ok('o catálogo usa mais de um estado', usados.length > 0, usados.join(', '));

  const dic = JSON.parse(fs.readFileSync(`${RAIZ_WS}/src/i18n-site.json`, 'utf8'));
  for (const e of usados) {
    const sem = LINGUAS.filter((lg) => !String(dic[lg]?.[CHAVE[e]] || '').trim());
    ok(`o estado "${e}" tem palavra nos cinco idiomas`, sem.length === 0, sem.join(', '));
  }
  /* E a legenda que explica os selos está na página, nos cinco. "Beta" numa
     tabela de preço sem explicação é a palavra que faz a avaliação de
     fornecedor parar e perguntar. */
  for (const lg of LINGUAS) {
    const html = fs.readFileSync(`${RAIZ_WS}/src/site/bodies/precos.${lg}.html`, 'utf8');
    ok(`precos.${lg}: a legenda dos selos está na página`, /\{\{tpLegenda\}\}/.test(html));
  }
}

/* ---- [6b] uma palavra por selo, na página inteira ------------------------
   O `planos.mjs` já cobrava isso — mas só nas balas que têm `data-f`, porque é
   por elas que ele acha o item no catálogo. O parágrafo de prosa que EXPLICA o
   selo ficava de fora, e o alemão explicava o selo com a palavra errada:
   mandava procurar "bald" enquanto o selo dizia "demnächst". Quem lê é mandado
   procurar uma coisa que não está escrita em lugar nenhum.

   Aqui a varredura é da página inteira, prosa incluída. */
for (const lg of LINGUAS) {
  const dic = JSON.parse(fs.readFileSync(`${RAIZ_WS}/src/i18n-site.json`, 'utf8'));
  const html = fs.readFileSync(`${RAIZ_WS}/src/site/bodies/precos.${lg}.html`, 'utf8');
  for (const [classe, chave] of [['soon', 'tpBreve'], ['beta', 'tpBeta'],
                                 ['descoberta', 'tpDescoberta']]) {
    const palavra = String(dic[lg]?.[chave] || '');
    const achadas = [...html.matchAll(new RegExp(`<span class="${classe}">([^<]*)<`, 'g'))]
      .map((m) => m[1]);
    const outras = [...new Set(achadas.filter((x) => x !== palavra))];
    ok(`precos.${lg}: todo selo "${classe}" escrito à mão diz "${palavra}"`,
       outras.length === 0, outras.join(', '));
  }
}

/* ---- [7] `breve` morreu: é `estado`, e é um campo só --------------------- */
{
  const sobrou = itens.filter((i) => 'breve' in i);
  ok('nenhuma funcionalidade guarda o antigo `breve`', sobrou.length === 0,
     sobrou.map((i) => i.id || i.pt.slice(0, 30)).join(', '));
  const fontes = ['lib/site.ts', 'testes/planos.mjs', 'testes/promessa.mjs'];
  /* O padrão é montado em pedaços de propósito: escrito por extenso, ele
     aparece no texto DESTE arquivo e a checagem se acusa sozinha. Foi o que
     aconteceu na primeira versão — a régua reprovou apontando para si mesma. */
  const antigo = new RegExp('\\.' + 'bre' + 've\\b');
  const teimoso = fontes.filter((f) =>
    antigo.test(fs.readFileSync(`${RAIZ_WS}/${f}`, 'utf8')));
  ok('e ninguém lê mais esse campo', teimoso.length === 0, teimoso.join(', '));
}

console.log(falhas ? `\n${falhas} FALHA(S)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);

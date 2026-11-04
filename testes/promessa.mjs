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
 *     Team começava em cinco assentos. (Os planos saíram no Build 71.)
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

/* [3] e [3b] saíram no Build 71: cobravam o mínimo de assentos do Team e o
   prazo da chave de licença, e o produto ficou sem plano e sem licença. */

/* ---- [3c] a promessa que o produto contradiz ---------------------------
 *
 * Nenhuma delas quebra nada. Todas custam venda ou confiança, e todas foram
 * medidas contra o código, não contra a memória de quem escreveu a página.
 */
{
  /* O roteiro de casos (o antigo item 1) e a calculadora de preço (o item 3)
     saíram com a conta e com a página de preços, no Build 71. */
  /* 2. O "NUM CLIQUE" DA TARJA DEPENDE DE CDN PÚBLICO.
     O produto tem a mensagem `ocrSemCdn` — "se a rede da empresa bloqueia CDN
     público, este recurso não vai funcionar aqui". A página vendia o clique e
     não dizia isso, e rede corporativa que bloqueia CDN é o cliente-alvo. */
  const prod = fs.readFileSync(`${RAIZ_WS}/src/template.html`, 'utf8');
  ok('o produto realmente avisa quando não alcança a biblioteca de OCR',
     /ocrSemCdn:/.test(prod));
  for (const lg of LINGUAS) {
    const txt = corpo('casoEv', lg);
    const diz = /CDN/i.test(txt);
    ok(`casoEv.${lg}: a promessa da tarja diz que depende de CDN`, diz,
       diz ? '' : '(promete o clique sem dizer do que ele depende)');
  }

}

/* [4] e [5] saíram no Build 71, com os cartões de plano e a comparação curta
   da página de preços. */

/* ---- [6] o vocabulário de estado só tem quatro palavras -------------------
   Um campo livre vira, em seis meses, `beta`, `Beta`, `em beta`, `parcial` e
   `quase` — e aí nenhum teste consegue mais perguntar nada sobre ele. E cada
   estado que aparece no catálogo tem que ter palavra nos cinco idiomas: um
   selo sem tradução sai em português numa página alemã, que é como este projeto
   já entregou o tour errado duas vezes. */
const ESTADOS = ['producao', 'beta', 'construcao', 'descoberta'];
{
  const fora = itens.map(estadoDe).filter((e) => !ESTADOS.includes(e));
  ok('nenhum estado fora do vocabulário', fora.length === 0, [...new Set(fora)].join(', '));

  /* As palavras de cada selo nos cinco idiomas e a legenda deles moravam na
     página de preços, que era a única que desenhava selo. Saíram com ela no
     Build 71; fica o vocabulário, que é do catálogo. */
  const usados = [...new Set(itens.map(estadoDe))].filter((e) => e !== 'producao');
  console.log(`     estados em uso hoje: ${usados.length ? usados.join(', ') : 'nenhum — o catálogo está inteiro em produção'}`);
}

/* ---- [7] `breve` morreu: é `estado`, e é um campo só --------------------- */
{
  const sobrou = itens.filter((i) => 'breve' in i);
  ok('nenhuma funcionalidade guarda o antigo `breve`', sobrou.length === 0,
     sobrou.map((i) => i.id || i.pt.slice(0, 30)).join(', '));
  const fontes = ['lib/site.ts', 'testes/promessa.mjs'];
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

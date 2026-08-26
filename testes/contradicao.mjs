/* A contradição dos termos, nas cinco línguas — e a trava para ela não voltar.
 *
 * O que havia, em três frases que ninguém tinha lido juntas:
 *
 *   §7  "o código é nosso, não é distribuído sob licença livre, copiar e
 *        redistribuir não está autorizado"
 *   §10 "COMO O CÓDIGO É ABERTO, você pode manter uma cópia própria funcionando"
 *   segurança  "a versão offline pode ser baixada, escaneada, versionada e
 *        DISTRIBUÍDA pela sua equipe"
 *
 * A do §10 era resto do tempo do ClipContext, sob MIT. A da página de segurança
 * é uma promessa comercial de verdade — está escrita para quem faz avaliação de
 * fornecedor, e provavelmente já foi lida por alguém antes de aprovar a
 * ferramenta. Então ela sobrevive, e o §7 passa a conceder a permissão que ela
 * promete.
 *
 * Este arquivo existe porque contradição em texto legal não quebra nada: o site
 * sobe, os testes passam, e ela fica lá até alguém precisar dela num momento
 * ruim. A única forma de ela não voltar é uma máquina reler as três frases a
 * cada build.
 */
import { chromium } from 'playwright';
import fs from 'fs';

import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';
const BASE = 'http://localhost:8802';

/* Os endereços saem do `rotas.json`, e NÃO de uma lista escrita aqui.
 *
 * Na primeira versão deste arquivo eu escrevi `/termos-de-uso`, `/en/terms`,
 * `/es/terminos` de cabeça. Nenhum dos cinco existe — o slug é `termos` nas
 * cinco línguas, e o da segurança muda em todas. As páginas davam 404, e o
 * bloco [1] passava feliz, porque procurar a AUSÊNCIA de uma frase numa página
 * que não existe sempre dá certo.
 *
 * É a mesma armadilha que apagou o hreflang do alemão e do francês: lista
 * escrita à mão ao lado de uma lista de verdade. */
const ROTAS = JSON.parse(fs.readFileSync(`${RAIZ_WS}/src/rotas.json`, 'utf8'));
const endereco = (pagina, L) =>
  (L === 'pt' ? '' : '/' + L) + '/' + ROTAS.slugs[pagina][L];
const PAGINAS = ROTAS.idiomas.map(L => [L, endereco('termos', L), endereco('seguranca', L)]);

/* As frases proibidas: qualquer uma delas de volta significa que o §10 voltou a
 * dizer que o código é aberto. São escritas em pedaço curto de propósito — uma
 * reescrita da frase inteira ainda cairia aqui. */
const PROIBIDO = [
  /c[óo]digo é aberto/i,
  /code is open/i,
  /c[óo]digo es abierto/i,
  /Code offen ist/i,
  /code étant ouvert/i,
  /open[- ]source/i,
];

/* E as palavras que a permissão nova tem de conter, por idioma. Não basta o §7
 * existir: ele tem de falar de DISTRIBUIR DENTRO DA ORGANIZAÇÃO, que é
 * exatamente o que a página de segurança promete. */
const PERMISSAO = {
  pt: [/vers[ãa]o offline/i, /distribu[íi]da dentro da sua organiza[çc][ãa]o/i],
  en: [/offline version/i, /distributed inside your organisation/i],
  es: [/versi[óo]n offline/i, /distribuirse dentro de tu organizaci[óo]n/i],
  de: [/Offline-Version/i, /innerhalb Ihrer Organisation verteilt/i],
  fr: [/version hors ligne/i, /distribu[ée]e au sein de votre organisation/i],
};

/* O limite da permissão. Uma permissão sem limite escrito é uma licença livre
 * por omissão — que é justamente o que o §7 diz que não é. */
const LIMITE = {
  pt: /publicar o arquivo fora da sua|revend[êe]-lo/i,
  en: /publishing the file outside your|reselling it/i,
  es: /publicar el archivo fuera de tu|revenderlo/i,
  de: /außerhalb Ihrer Organisation zu veröffentlichen|weiterzuverkaufen/i,
  fr: /publier le fichier en dehors de votre|le revendre/i,
};

let falhas = 0;
const ok = (n, c, e) => {
  console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : ''));
  if (!c) falhas++;
};

const br = await chromium.launch({
  executablePath: CHROME_WS,
});
const pg = await (await br.newContext()).newPage();

console.log('[0] as dez páginas existem mesmo');
/* Antes de qualquer coisa. Um teste que procura a ausência de uma frase numa
 * página 404 passa sempre — e foi exatamente o que aconteceu na primeira
 * versão deste arquivo. */
for (const [L, termos, seg] of PAGINAS) {
  for (const [nome, u] of [['termos', termos], ['segurança', seg]]) {
    const r = await pg.goto(BASE + u);
    ok(`${L}: a página de ${nome} responde 200`, r.status() === 200,
       `${u} → ${r.status()}`);
  }
}

console.log('\n[1] o §10 não diz mais que o código é aberto');
for (const [L, termos] of PAGINAS) {
  await pg.goto(BASE + termos);
  const txt = await pg.locator('main, body').first().innerText();
  const achou = PROIBIDO.filter(r => r.test(txt)).map(String);
  ok(`${L}: nenhuma frase de "código aberto"`, achou.length === 0, achou.join(' '));
}

console.log('\n[2] o §7 concede o que a página de segurança promete');
for (const [L, termos] of PAGINAS) {
  await pg.goto(BASE + termos);
  const txt = await pg.locator('main, body').first().innerText();
  for (const r of PERMISSAO[L]) {
    ok(`${L}: os termos falam de "${String(r).slice(1, 42)}"`, r.test(txt));
  }
  ok(`${L}: e a permissão tem limite escrito`, LIMITE[L].test(txt));
}

console.log('\n[3] a página de segurança continua prometendo — ela é o motivo de tudo isto');
for (const [L, , seg] of PAGINAS) {
  await pg.goto(BASE + seg);
  const txt = await pg.locator('main, body').first().innerText();
  const promete = {
    pt: /distribu[íi]da pela sua equipe/i,
    en: /distributed by your own team/i,
    es: /distribuir por (tu|su) propio equipo/i,
    de: /von Ihrem Team.*(verteilt|weitergegeben)|verteilt werden/i,
    fr: /distribu[ée]e par votre [ée]quipe/i,
  }[L];
  ok(`${L}: a promessa da versão offline continua na página de segurança`,
     promete.test(txt));
}

console.log('\n[4] a data de revisão andou — sem isso a mudança não vale para quem já leu');
for (const [L, termos] of PAGINAS) {
  await pg.goto(BASE + termos);
  const t = (await pg.locator('.updated').first().textContent() || '').trim();
  ok(`${L}: a data é a nova`, /17/.test(t) && /2026/.test(t), t.slice(0, 60));
}

console.log('\n[5] a ressalva da MIT continua — uma licença concedida não se retira');
for (const [L, termos] of PAGINAS) {
  await pg.goto(BASE + termos);
  const txt = await pg.locator('main, body').first().innerText();
  ok(`${L}: o ClipContext e a MIT continuam citados`,
     /ClipContext/.test(txt) && /MIT/.test(txt));
}

console.log('\n[6] a política não diz que não usa cookie e usa um');
{
  /* A SEGUNDA CONTRADIÇÃO, e ela morava no MESMO documento.
     Numa lista chamada "Dados que não coletamos":
         <li>Cookies, de qualquer tipo</li>
     E noventa linhas abaixo, na seção da conta paga:
         "A sessão da conta usa um cookie, e ele é necessário."
     Nos cinco idiomas. As duas frases são verdadeiras separadas e mentem
     juntas — e quem faz avaliação de fornecedor lê as duas, porque é o mesmo
     documento e ele lê inteiro.
     A saída não foi apagar a segunda: o cookie de sessão existe e tem de estar
     declarado. Foi qualificar a primeira, que é onde estava o exagero.

     A régua mede o TEXTO RENDERIZADO, e não o arquivo: é o que a pessoa lê. */
  const priv = ROTAS.idiomas.map((L) => [L, endereco('privacidade', L)]);
  for (const [L, rota] of priv) {
    await pg.goto(BASE + rota);
    const txt = await pg.locator('main, body').first().innerText();

    /* 1. A página continua declarando o cookie de sessão. Apagar a declaração
          "resolveria" a contradição do jeito errado. */
    const temCookie = /cookie/i.test(txt);
    ok(`${L}: o cookie de sessão continua declarado`, temCookie,
       temCookie ? '' : '(a palavra cookie sumiu da política)');

    /* 2. E não existe mais a negação absoluta. Cada idioma escreve a lista do
          jeito dele, então o que se procura é a forma ABSOLUTA — "cookies, de
          qualquer tipo" — e não a palavra cookie. */
    const ABSOLUTO = [
      /cookies,?\s*de qualquer tipo/i,
      /cookies,?\s*of any kind/i,
      /cookies,?\s*de cualquier tipo/i,
      /cookies,?\s*gleich welcher art/i,
      /cookies,?\s*de quelque type que ce soit/i,
    ];
    const achou = ABSOLUTO.filter((r) => r.test(txt));
    ok(`${L}: e não nega cookie de qualquer tipo`, achou.length === 0,
       achou.map(String).join(' '));

    /* 3. A qualificação tem de dizer DE QUE tipo não há — senão o conserto
          vira só a remoção de uma frase incômoda. */
    const qualifica =
      /rastre|track|suivi|Tracking|publicidad|publicit|Werbe|medi[çc]|measurement|Mess/i.test(txt);
    ok(`${L}: a lista diz de que tipo de cookie não há`, qualifica,
       qualifica ? '' : '(a lista ficou vaga)');
  }
}

await br.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nContradição dos termos: fechada nas cinco línguas.');
process.exit(falhas ? 1 : 0);

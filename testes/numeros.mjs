/* O NÚMERO FALADO VOLTA A SER NÚMERO — nos cinco idiomas.
 *
 * O vocabulário do domínio corrige o código de transação quando a transcrição
 * escreve `ME21N` por extenso. Ele é do plano GRATUITO por regra: o que faz a
 * evidência de uma pessoa ser aceita não se cobra.
 *
 * Até 24/08 ele funcionava em DOIS dos cinco idiomas, e ninguém sabia. Medido,
 * o termo "235" falado virava:
 *
 *     pt  duzentos e trinta e cinco     → 235          certo
 *     es  doscientos treinta y cinco    → 235          certo
 *     en  two hundred thirty five       → 2hundred35
 *     de  (a palavra colada)            → nada
 *     fr  deux cent trente-cinq         → 2135
 *
 * ESTA RÉGUA RODA O CÓDIGO DO PRODUTO, e não uma cópia dele: ela recorta
 * `NUMS`, `NUM_FALA`, `tabelaNumeros` e `siglaDaJanela` do `src/template.html` e
 * os executa. Reescrever a lógica aqui provaria que a minha cópia funciona, que
 * é a pergunta errada.
 *
 * E ela é EXAUSTIVA: mil números em cinco idiomas, cada um escrito por extenso
 * e lido de volta. Um teste de amostra pegaria o 235 e deixaria passar o 71
 * francês, que é onde a língua tem a pegadinha.
 *
 * O QUE ELA NÃO PROVA: que o reconhecimento de fala ESCREVA assim. Estas são as
 * grafias corretas. O Whisper escreve do jeito dele — foi isso que derrubou a
 * primeira versão do recurso em português, com o `k` dito "cá" que o modelo
 * grafa com C. Para `de` e `fr` não houve teste com voz de verdade.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

import { RAIZ_WS } from './_caminhos.mjs';

let falhas = 0;
const ok = (n, c, e) => {
  console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : ''));
  if (!c) falhas++;
};

const fonte = fs.readFileSync(path.join(RAIZ_WS, 'src/template.html'), 'utf8');

/** Recorta um bloco do produto pelo começo, até a linha que o fecha. */
function recortar(inicio, fim) {
  const i = fonte.indexOf(inicio);
  if (i < 0) return null;
  const j = fonte.indexOf(fim, i);
  return j < 0 ? null : fonte.slice(i, j + fim.length);
}

const bNums = recortar('  const NUMS = {', '\n  };\n');
const bFala = recortar('  const NUM_FALA = {', '\n  };\n');
const bTab = recortar('  const numTabela = {};', '\n  }\n');
const bSigla = recortar('  function siglaDaJanela(js, L){', '\n  }\n');

console.log('[1] os quatro blocos do produto foram achados');
ok('NUMS', !!bNums);
ok('NUM_FALA', !!bFala);
ok('tabelaNumeros', !!bTab);
ok('siglaDaJanela', !!bSigla);
if (!bNums || !bFala || !bTab || !bSigla) {
  console.log('\nsem os blocos não há o que medir.');
  process.exit(1);
}

/* O `semAcento`, o `LETRAS`, o `APELIDOS` e o `NOME_LETRA` também são do
   produto, e entram inteiros. Um `NOME_LETRA` de mentira aqui faria o bloco [4]
   provar a minha tabela de nomes de letra em vez da dele. */
const bSemAcento = recortar('  const semAcento = ', ';\n');
/* O `chavesExtras` é a segunda metade da normalização, e ele mora FORA do
   `semAcento` de propósito: a troca `ü` → `ue` é alemã, e aplicá-la aos outros
   idiomas quebraria o francês (`aiguë`). Sem recortá-lo aqui, o `NOME_LETRA` do
   produto não monta — foi o que aconteceu na primeira execução. */
const bTranslit = recortar('  const TRANSLIT_DE = {', '\n  }\n');
const bLetras = recortar('  const LETRAS = {', '\n  };\n');
const bApelidos = recortar('  const APELIDOS = {', '\n  };\n');
const bNomeLetra = recortar('  const NOME_LETRA = {};', '\n  }\n');
ok('semAcento', !!bSemAcento);
ok('chavesExtras', !!bTranslit);
ok('LETRAS', !!bLetras);
ok('APELIDOS', !!bApelidos);
ok('NOME_LETRA', !!bNomeLetra);

const caixa = { console };
vm.createContext(caixa);
vm.runInContext(
  `${bSemAcento}\n${bTranslit}\n${bLetras}\n${bApelidos}\n${bNomeLetra}\n` +
  `${bNums}\n${bFala}\n${bTab}\n${bSigla}\n` +
  'globalThis.__p = { NUMS, NUM_FALA, tabelaNumeros, siglaDaJanela, LETRAS, NOME_LETRA,' +
  '                     APELIDOS, semAcento, chavesExtras };',
  caixa);
const P = caixa.__p;

/* As palavras de um texto, quebradas como o produto quebra. */
const palavras = (t) => (t.match(/[0-9]+|[A-Za-zÀ-ÿ]+/g) || []).map((x) => ({ t: x }));

const IDIOMAS = ['pt', 'en', 'es', 'de', 'fr'];

console.log('\n[2] mil números, cinco idiomas, escritos e lidos de volta');
for (const L of IDIOMAS) {
  const T = P.NUMS[L];
  const erradas = [];
  let formas = 0;
  for (let n = 0; n <= 999; n++) {
    for (const forma of P.NUM_FALA[L](n, T)) {
      formas++;
      const { sigla, temDigito } = P.siglaDaJanela(palavras(String(forma)), L);
      if (sigla !== String(n) || !temDigito) {
        if (erradas.length < 4) erradas.push(`${n} "${forma}" → ${sigla}`);
      }
    }
  }
  ok(`${L}: as ${formas} formas de 0 a 999 voltam ao número`, erradas.length === 0,
     erradas.join(' | '));
}

console.log('\n[3] os casos que quebravam, um por idioma');
{
  /* Escritos à mão de propósito: o bloco acima gera as formas a partir da mesma
     tabela que as lê, então ele provaria a si mesmo se a tabela estivesse
     errada. Estes vieram da língua, e não do código. */
  const CASOS = [
    ['pt', 'duzentos e trinta e cinco', 235],
    ['pt', 'vinte e um', 21],
    ['en', 'two hundred thirty five', 235],
    ['en', 'two hundred and thirty five', 235],
    ['es', 'doscientos treinta y cinco', 235],
    ['es', 'veintiuno', 21],
    ['de', 'einundzwanzig', 21],
    ['de', 'zweihundertfünfunddreißig', 235],
    ['fr', 'deux cent trente-cinq', 235],
    ['fr', 'soixante-dix', 70],
    ['fr', 'soixante et onze', 71],
    ['fr', 'quatre-vingts', 80],
    ['fr', 'quatre-vingt-onze', 91],
    ['fr', 'quatre-vingt-dix-neuf', 99],
  ];
  for (const [L, frase, esperado] of CASOS) {
    const { sigla } = P.siglaDaJanela(palavras(frase), L);
    ok(`${L}: "${frase}" = ${esperado}`, sigla === String(esperado), sigla);
  }
}

console.log('\n[4] a sigla inteira, que é para o que isto serve');
{
  /* `ME21N` falado. É o caso que deu origem ao recurso, e o que ele tem de
     diferente é a mistura: nome de letra, número por extenso, nome de letra. */
  const SIGLAS = [
    ['pt', 'eme vinte e um ene', 'm21n'],
    ['en', 'em twenty one en', 'm21n'],
    ['es', 'eme veintiuno ene', 'm21n'],
    ['de', 'emm einundzwanzig enn', 'm21n'],
    ['fr', 'emme vingt et un enne', 'm21n'],
  ];
  for (const [L, frase, esperado] of SIGLAS) {
    const { sigla, temDigito } = P.siglaDaJanela(palavras(frase), L);
    ok(`${L}: "${frase}" vira ${esperado}`, sigla === esperado && temDigito, sigla);
  }
}

console.log('\n[5] os nomes de letra existem nos cinco idiomas');
{
  /* A outra metade da DEC-17. Sem `LETRAS.de`, `emm` não vira `m` e a sigla
     alemã sai com a palavra inteira dentro. Números sem letras resolvem metade
     do problema, e metade não serve para achar `ME21N`. */
  for (const L of IDIOMAS) {
    const tem = P.LETRAS[L] && Object.keys(P.LETRAS[L]).length;
    ok(`${L}: as 26 letras`, tem === 26, String(tem || 0));
    const nomes = P.NOME_LETRA[L] || {};
    ok(`${L}: e o mapa de volta foi montado`, Object.keys(nomes).length >= 26,
       String(Object.keys(nomes).length));
  }
}

console.log('\n[6] nenhuma chave da tabela tem espaço onde não pode ter');
{
  /* O defeito do inglês era exatamente este: nove chaves guardadas com espaço
     dentro, num mapa consultado com UMA palavra. Elas nunca casavam, e o
     recurso ficava quebrado a partir de cem sem ninguém perceber.
     Agora a tabela é consultada por sequência, então espaço é legítimo — o que
     não pode é a chave ter mais palavras do que o casador procura. */
  for (const L of IDIOMAS) {
    const { mapa, maxPalavras } = P.tabelaNumeros(L);
    const chaves = Object.keys(mapa);
    const grandes = chaves.filter((k) => k.split(' ').length > maxPalavras);
    ok(`${L}: nenhuma chave é maior que a janela (${maxPalavras})`,
       grandes.length === 0, grandes.slice(0, 3).join(' | '));
    ok(`${L}: a tabela tem os mil números`, new Set(Object.values(mapa)).size === 1000,
       String(new Set(Object.values(mapa)).size));
  }
}

console.log('\n[7] nenhum apelido é letra morta');
{
  /* UM APELIDO QUE REPETE A GRAFIA CORRETA NÃO ACRESCENTA CHAVE NENHUMA.
     O `NOME_LETRA` é montado com `semAcento` por cima do `LETRAS` e depois do
     `APELIDOS` — então `pt h:['aga']` escrevia exatamente a chave que
     `semAcento('agá')` já tinha escrito. Seis entradas assim existiam, e uma
     delas (`pt w:'dabliu'`) estava repetida dentro da própria lista.
     Isso não quebra nada, e é justamente o problema: faz a lista de `de` e de
     `fr` — que são as curtas de verdade — parecer maior do que é. A lacuna de
     escuta desses dois idiomas está escrita em três lugares, e uma contagem
     inflada é a forma mais barata de ela parecer menor. */
  for (const L of IDIOMAS) {
    const ap = P.APELIDOS[L] || {};
    const mortos = [], repetidos = [];
    for (const letra in ap) {
      const canon = P.semAcento(P.LETRAS[L][letra] || '').toLowerCase();
      const vistos = new Set();
      for (const w of ap[letra]) {
        const norm = P.semAcento(w).toLowerCase();
        if (norm === canon) mortos.push(`${letra}:"${w}"`);
        if (vistos.has(norm)) repetidos.push(`${letra}:"${w}"`);
        vistos.add(norm);
      }
    }
    ok(`${L}: nenhum apelido repete a grafia do LETRAS`, mortos.length === 0,
       mortos.join(' '));
    ok(`${L}: e nenhum se repete dentro da própria lista`, repetidos.length === 0,
       repetidos.join(' '));
  }
}

console.log('\n[8] o alemão escrito sem teclado alemão');
{
  /* NÃO É LACUNA DE ESCUTA — É ORTOGRAFIA, e era um defeito.
     `semAcento` decompõe em NFD e joga fora acento combinante: resolve `ü` → `u`
     e não resolve `ß`, que não decompõe em nada. Só que a forma que um alemão
     escreve sem a tecla não é `u`, é `ue`. Medido com o código do produto antes
     do conserto: `dreissig` não virava 30, e `zweihundertfuenfunddreissig`
     falhava inteiro. Quem transcreve alemão sem trema perdia o recurso todo.
     A troca não entra no `semAcento` — lá ela quebraria o `aiguë` francês. Ela
     gera uma chave A MAIS, e as duas grafias acham o mesmo número. */
  const CASOS = [
    ['dreißig', 30], ['dreissig', 30],
    ['fünf', 5], ['fuenf', 5],
    ['zwölf', 12], ['zwoelf', 12],
    ['zweihundertfünfunddreißig', 235], ['zweihundertfuenfunddreissig', 235],
    ['einundzwanzig', 21],
  ];
  for (const [frase, esperado] of CASOS) {
    const { sigla, temDigito } = P.siglaDaJanela(palavras(frase), 'de');
    ok(`de: "${frase}" = ${esperado}`, sigla === String(esperado) && temDigito, sigla);
  }
  /* E a sigla inteira nas duas grafias, que é para o que isto serve. */
  for (const frase of ['emm einundzwanzig enn', 'emm fuenfundzwanzig enn']) {
    const { sigla, temDigito } = P.siglaDaJanela(palavras(frase), 'de');
    ok(`de: "${frase}" vira sigla`, /^m\d+n$/.test(sigla) && temDigito, sigla);
  }
  /* A TROCA NÃO PODE VAZAR PARA OS OUTROS IDIOMAS. Em francês `aiguë` normaliza
     para `aigue`, e trocar `ü` por `ue` ali produziria `aiguee`. */
  for (const L of ['pt', 'en', 'es', 'fr']) {
    ok(`${L}: não recebe a transliteração alemã`,
       P.chavesExtras('für', L).length === 0, JSON.stringify(P.chavesExtras('für', L)));
  }
}

console.log(falhas ? `\n${falhas} FALHA(S)`
                   : '\nNúmeros falados: os cinco idiomas leem o que a língua diz.');
process.exit(falhas ? 1 : 0);

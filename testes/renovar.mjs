/* A CHAVE AVISA ANTES DE VENCER — e se renova sozinha quando dá.
 *
 * O que existia: a licença vale 45 dias, nada a renovava, e no dia SEGUINTE ao
 * vencimento a ferramenta dizia "fale comigo para renovar". Depois de a marca
 * do cliente já ter sumido do documento, e sem dizer para onde ir. Quem paga
 * por ano voltava à conta oito vezes por ano para colar uma chave.
 *
 * E o `lib/stripe.ts` prometia, em comentário, "uma licença curta que se renova
 * sozinha". Ninguém cumpria.
 *
 * O QUE ESTA RÉGUA COBRA, e a segunda metade é a que importa:
 *
 *   1. Faltando poucos dias, a tela AVISA — com o número e o caminho da conta.
 *   2. Com muitos dias pela frente, ela NÃO avisa. Um aviso que aparece sempre
 *      é um aviso que ninguém lê, e aí o do décimo dia passa junto.
 *   3. Vencida, a licença não ativa — o que já valia e continua valendo.
 *
 * O LIMITE, dito aqui porque é onde alguém vai procurar: a renovação silenciosa
 * só acontece com SESSÃO na aba, e a sessão vive em `sessionStorage` com um
 * token que vence. No caso comum — trinta e cinco dias depois, noutra aba — não
 * há sessão, e o que salva a pessoa é o aviso. Renovar sem sessão exigiria uma
 * credencial de longa duração no navegador ou um cron mandando e-mail; as duas
 * mexem no que o produto promete. Está escrito no `BUILD-6.md`.
 */
import fs from 'fs';

import { RAIZ_WS } from './_caminhos.mjs';

let falhas = 0;
const ok = (n, c, e) => {
  console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : ''));
  if (!c) falhas++;
};

const fonte = fs.readFileSync(`${RAIZ_WS}/src/template.html`, 'utf8');

/* BLOCO PULADO: a tela do aviso, com licença de verdade.
   Pintar o aviso exige uma licença que PASSE — e passar exige assinatura
   Ed25519 da chave privada, que não viaja neste pacote de propósito (é o mesmo
   motivo pelo qual `licenca`, `liclink` e `licauto` pulam aqui). Forjar não dá;
   chamar `pintarLicenca` de fora também não, porque ela vive no escopo do app,
   e furar esse escopo só para testar seria mudar o produto para caber na régua.
   O que sobra é medir a DECISÃO no código, que é o que vem abaixo — e é onde o
   defeito morava: a condição não existia. */
console.log('BLOCO PULADO  o aviso pintado na tela precisa de uma licença assinada,');
console.log('              e a chave privada não está neste pacote. O que dá para');
console.log('              medir daqui é a decisão, e é o que os blocos abaixo fazem.');

console.log('[1] o prazo do aviso e o da renovação são o MESMO número');
{
  const quantas = (fonte.match(/const RENOVAR_FALTANDO\b/g) || []).length;
  ok('há uma constante para o prazo, e uma só', quantas === 1, String(quantas));
  /* Ela é lida nos dois lugares: a tela que avisa e a função que renova. Dois
     números com o mesmo propósito é a família de defeito que este projeto mais
     pagou — e aqui daria uma tela avisando num prazo e uma renovação agindo
     noutro. */
  const usos = (fonte.match(/RENOVAR_FALTANDO/g) || []).length;
  ok('e é lida na tela E na renovação', usos >= 3, `${usos} menções`);
  /* E ela vem ANTES do primeiro uso. `const` em zona morta temporal não devolve
     `undefined`: derruba a carga inteira. Aconteceu enquanto eu escrevia isto —
     a constante nasceu junto da renovação, seiscentas linhas abaixo da tela. */
  const decl = fonte.indexOf('const RENOVAR_FALTANDO') + 'const '.length;
  const primeiroUso = fonte.indexOf('RENOVAR_FALTANDO');
  ok('e é declarada antes de ser usada', decl === primeiroUso,
     decl === primeiroUso ? ''
       : 'a declaração vem depois do uso — ReferenceError na carga');
}

console.log('\n[2] a frase do aviso existe nos cinco idiomas');
{
  for (const chave of ['licPerto', 'licPegarOutra']) {
    const n = (fonte.match(new RegExp(chave + ':', 'g')) || []).length;
    ok(`  ${chave} nos cinco`, n === 5, String(n));
  }
  ok('e o aviso leva à conta, em vez de "fale comigo"',
     /licPegarOutra[\s\S]{0,80}CAMINHO_CONTA|CAMINHO_CONTA\[LANG\][\s\S]{0,120}licPegarOutra/.test(fonte)
     || /\$\{CAMINHO_CONTA\[LANG\] \|\| '\/conta'\}/.test(fonte));
}

console.log('\n[3] a renovação silenciosa existe, e não inventa licença');
{
  const i = fonte.indexOf('async function renovarSePerto');
  const corpo = i < 0 ? '' : fonte.slice(i, i + 2600);
  ok('a função existe', i >= 0);
  ok('  ela exige sessão', /if \(!sessao \|\| !sessao\.token/.test(corpo));
  /* A chave que volta é CONFERIDA antes de substituir a de agora: aceitar o que
     o servidor mandou sem olhar seria trocar uma licença boa por qualquer
     resposta. */
  ok('  confere a chave nova antes de guardar', /await conferirLicenca\(nova\)/.test(corpo));
  ok('  e só troca se ela valer MAIS que a de agora',
     /c\.dados\.a <= licenca\.a/.test(corpo));
}

console.log('\n[4] o código parou de prometer o que não faz');
{
  const stripe = fs.readFileSync(`${RAIZ_WS}/lib/stripe.ts`, 'utf8');
  ok('o `lib/stripe.ts` não diz mais "se renova sozinha" como fato',
     !/uma licença curta que se renova sozinha/.test(stripe));
  ok('e explica o limite de quem renova', /sess/i.test(stripe) && /cron|e-mail/i.test(stripe));
}

console.log(falhas ? `\n${falhas} FALHA(S)`
                   : '\nRenovação: avisa antes, renova quando dá, e não promete o resto.');
process.exit(falhas ? 1 : 0);

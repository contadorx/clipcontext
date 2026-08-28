/* AS VERSÕES DE TERCEIROS QUE O PRODUTO CARREGA DA REDE.
 *
 * O motor de voz do Walkstamp não viaja no pacote: ele é importado de um CDN
 * em tempo de uso. Até 25/08 a fila de endereços era esta:
 *
 *     @huggingface/transformers@3       ← major FLUTUANTE, e é o padrão
 *     @huggingface/transformers@4.2.0   ← fixa
 *     @huggingface/transformers         ← latest, sem versão nenhuma
 *
 * Duas das três podiam mudar por baixo do produto sem um commit. A primeira é
 * a que roda em quase toda máquina; a terceira é acionada quando todas as
 * outras falharam — a pior hora possível para estrear uma biblioteca que
 * ninguém testou. E ela nem era um salva-vidas: `latest` resolvia para a
 * MESMA 4.2.0 da segunda linha. Três tentativas, dois arquivos.
 *
 * Esta régua afirma quatro coisas sobre o que o produto carrega, e faz UMA
 * pergunta ao npm:
 *
 *   1. toda entrada tem versão EXATA — nada de `@3`, nada de sem-versão;
 *   2. a lista do produto é a mesma do `src/versoes.json` (o manifesto é a
 *      fonte, e não uma anotação ao lado da verdade);
 *   3. as três entradas são três versões DIFERENTES;
 *   4. cada versão fixada EXISTE mesmo no npm — uma versão com erro de
 *      digitação faz todos os degraus da escada falharem identicamente, com a
 *      rede aparecendo perfeita no diagnóstico. É um defeito que se disfarça
 *      de máquina do usuário;
 *   5. e o aviso: existe versão publicada mais nova do que a última que
 *      alguém OLHOU (`conferido_ate`)?
 *
 * A quinta é a única que fala com a rede, e ela é comparada com
 * `conferido_ate` e não com a versão fixada — de propósito. Comparada com a
 * fixada, a esteira ficaria vermelha no dia em que a Hugging Face publicasse
 * qualquer coisa, por um motivo que não é defeito do produto, e uma régua que
 * fica vermelha sozinha é uma régua que se aprende a ignorar. Comparada com
 * `conferido_ate`, a reprovação diz uma coisa acionável: *existe versão nova
 * que ninguém olhou*. Limpá-la é olhar, decidir e escrever a decisão.
 *
 * SEM REDE ELA PULA O BLOCO, e não reprova: o pacote entregue tem que rodar a
 * régua numa máquina sem saída para a internet.
 *
 *   node testes/versoes.mjs
 */
import fs from 'fs';
import { RAIZ_WS } from './_caminhos.mjs';

let falhas = 0;
const ok = (n, c, e) => { console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : '')); if (!c) falhas++; };

const MAN = JSON.parse(fs.readFileSync(`${RAIZ_WS}/src/versoes.json`, 'utf8'));
const T = MAN.transformers;
const FIXADAS = T.fila.map((x) => x.v);

/* Comparar "3.10.0" com "3.9.0" como texto dá a resposta errada, e é o erro
   que faz um aviso de versão nova nunca disparar. Número a número. */
const maior = (a, b) => {
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  }
  return false;
};

console.log('[1] o que o PRODUTO carrega');
{
  /* Lido do app CONSTRUÍDO, e não do template: entre os dois há um token e um
     `build.py`, e é o construído que chega ao navegador de quem usa. */
  const app = fs.readFileSync(`${RAIZ_WS}/public/app.html`, 'utf8');
  const m = app.match(/const TJS_BASES = (\[[^\]]*\]);/);
  ok('a fila de bibliotecas existe no app', !!m);
  if (m) {
    const urls = JSON.parse(m[1]);
    console.log('     ' + urls.map((u) => u.split('@').pop()).join('  ·  '));
    const versoes = urls.map((u) => {
      const p = u.match(/@(\d+\.\d+\.\d+)$/);
      return p ? p[1] : null;
    });
    const todasExatas = versoes.every(Boolean);
    ok('toda entrada tem versão exata — nenhuma flutuando', todasExatas,
       todasExatas ? '' : urls.filter((u, i) => !versoes[i]).join('  '));
    const bate = todasExatas && versoes.length === FIXADAS.length &&
                 versoes.every((v, i) => v === FIXADAS[i]);
    ok('e a fila do app é a do manifesto, na mesma ordem', bate,
       bate ? '' : `app=${versoes.join(',')}  manifesto=${FIXADAS.join(',')}`);
    /* A terceira entrada era `latest`, que hoje resolve para a mesma 4.2.0 da
       segunda: um salva-vidas que era uma cópia. Três tentativas idênticas não
       são três tentativas. */
    const distintas = new Set(versoes.filter(Boolean)).size === versoes.length;
    ok('as três tentativas são três versões diferentes', distintas,
       distintas ? '' : versoes.join(','));
  }

  /* O OFFLINE INVERTEU, E É DE PROPÓSITO — 28/08.
     Esta afirmação exigia que o pacote offline carregasse a MESMA fila de
     bibliotecas do app: se uma versão ficasse para trás, seria na cópia que
     ninguém reconstrói. Era a pergunta certa enquanto o offline ainda buscava
     biblioteca na rede.
     A DEC-1 foi decidida em B para o artefato offline — zero egressão literal —,
     e o Build 36 tirou os endereços de dentro dele. A fila lá é VAZIA agora, e
     exigir que ela seja igual à do app seria exigir que o pacote volte a
     telefonar. A pergunta virou a oposta, e continua sendo uma pergunta: a fila
     do offline tem que estar vazia, e a do app tem que continuar cheia — senão
     alguém cortou a transcrição do produto inteiro achando que cortava só o
     pacote. */
  const off = fs.readFileSync(`${RAIZ_WS}/offline/walkstamp-offline.html`, 'utf8');
  const mo = off.match(/const TJS_BASES = (\[[^\]]*\]);/);
  ok('a fila de bibliotecas existe no pacote offline', !!mo, mo ? mo[1] : '(não achei)');
  ok('  e ela está VAZIA — o pacote não busca biblioteca em lugar nenhum',
     !!mo && JSON.parse(mo[1]).length === 0, mo ? mo[1].slice(0, 60) : '');
  ok('  enquanto a do app continua cheia — o corte é do pacote, não do produto',
     !!m && JSON.parse(m[1]).length > 0, m ? String(JSON.parse(m[1]).length) : '');
}

console.log('\n[2] o que o npm diz — a única pergunta que sai para a rede');
{
  let dados = null;
  try {
    const r = await fetch('https://registry.npmjs.org/' + T.pacote,
                          { signal: AbortSignal.timeout(25000) });
    if (r.ok) dados = await r.json();
  } catch (e) { dados = null; }

  if (!dados) {
    console.log('  BLOCO PULADO  sem resposta do npm — a régua não reprova o produto por falta de rede');
  } else {
    const todas = Object.keys(dados.versions || {}).filter((v) => !v.includes('-'));
    const faltando = FIXADAS.filter((v) => !todas.includes(v));
    ok('toda versão fixada existe mesmo no npm', faltando.length === 0,
       faltando.length ? 'não existe(m): ' + faltando.join(', ') : '');

    /* A maior publicada, e não a etiqueta `latest`: uma correção publicada numa
       linha antiga não muda `latest`, e é exatamente o tipo de coisa que se
       quer ver. */
    const maiorPub = todas.reduce((a, b) => (maior(b, a) ? b : a), '0.0.0');
    const conf = T.conferido_ate;
    const temNova = maior(maiorPub, conf);
    console.log(`     maior publicada: ${maiorPub}   |   conferida até: ${conf}` +
                `   |   latest: ${(dados['dist-tags'] || {}).latest}`);
    ok('não há versão publicada que ninguém tenha olhado', !temNova,
       temNova ? `${maiorPub} é mais nova que a conferida (${conf}). ` +
                 `Olhe, decida, e escreva a decisão em src/versoes.json → transformers.conferido_ate` : '');
  }
}

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nAs versões de terceiros: tudo passou.');
process.exit(falhas ? 1 : 0);

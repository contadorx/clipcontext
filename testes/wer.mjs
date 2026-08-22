/* A AFERIÇÃO DO INSTRUMENTO DE WER.
 *
 * Um medidor de erro que erra é a pior peça possível de uma esteira: ele
 * autoriza mudanças ruins com um número tranquilizador do lado. Por isso o
 * instrumento tem régua própria, e ela é de casos com resposta conhecida na
 * mão — não de "parece razoável".
 *
 *   node testes/wer.mjs
 */
import { wer, veredito, normalizar, palavras } from './_wer.mjs';

let falhas = 0;
const ok = (n, c, e) => {
  console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : ''));
  if (!c) falhas++;
};
const perto = (a, b) => Math.abs(a - b) < 1e-9;

console.log('[1] a normalização tira o que não é palavra, e guarda o que é');
ok('pontuação e caixa saem',
   normalizar('Abri a transação ME21N, e informei o fornecedor.') ===
   'abri a transação me21n e informei o fornecedor');
ok('espaço repetido colapsa', normalizar('a   b\n\nc') === 'a b c');
/* O acento FICA: em português ele separa palavras, e tirá-lo esconderia
   justamente o tipo de erro que se quer contar. */
ok('o acento fica', normalizar('está') === 'está');
ok('e "e" continua diferente de "é"', wer('e', 'é').erros === 1);
ok('texto vazio dá zero palavras', palavras('  ').length === 0);

console.log('\n[2] os três tipos de erro, contados separados');
{
  const igual = wer('um dois três quatro', 'um dois três quatro');
  ok('igual a si mesmo dá zero', igual.wer === 0 && igual.erros === 0);

  const sub = wer('um dois três quatro', 'um DOIS_TROCADO três quatro');
  ok('uma substituição em quatro é 0,25',
     perto(sub.wer, 0.25) && sub.subs === 1 && sub.ins === 0 && sub.del === 0,
     JSON.stringify(sub));

  const del = wer('um dois três quatro', 'um três quatro');
  ok('uma remoção em quatro é 0,25',
     perto(del.wer, 0.25) && del.del === 1 && del.subs === 0 && del.ins === 0,
     JSON.stringify(del));

  const ins = wer('um dois três quatro', 'um dois EXTRA três quatro');
  ok('uma inserção em quatro é 0,25',
     perto(ins.wer, 0.25) && ins.ins === 1 && ins.subs === 0 && ins.del === 0,
     JSON.stringify(ins));

  /* O denominador é a REFERÊNCIA, e não a hipótese: uma transcrição que inventa
     texto não pode diluir o próprio erro aumentando o divisor. */
  const inventou = wer('um dois', 'um dois a b c d e f');
  ok('inventar texto não dilui o erro', inventou.wer > 1, String(inventou.wer));
}

console.log('\n[3] o caso que decide a compactação de silêncio');
{
  /* Dois erros do MESMO tamanho na conta, e consequências opostas: trocar
     palavras espalhadas é o modelo ouvindo diferente; perder um bloco é trecho
     que sumiu — que é exatamente o risco de comprimir silêncio. */
  const base = 'o pedido foi aprovado pelo gerente e enviado ao fornecedor na terça';
  const espalhado = 'a pedido foi aprovada pelo gerente e enviada ao fornecedor na terça';
  /* Os dois com o MESMO numero de erros de proposito — tres. E disso que o
     caso vive: na conta eles empatam, e na consequencia nao. */
  const bloco = 'o pedido foi aprovado pelo gerente e enviado ao';

  const a = veredito(base, espalhado);
  const b = veredito(base, bloco);
  ok('os dois têm exatamente o mesmo erro no total', a.erros === b.erros,
     a.erros + ' vs ' + b.erros);
  ok('e o mesmo WER', perto(a.wer, b.wer), a.wer + ' vs ' + b.wer);
  ok('mas só um deles é texto que sumiu',
     a.fracaoRemovida === 0 && b.fracaoRemovida === 1,
     a.fracaoRemovida + ' vs ' + b.fracaoRemovida);
}

console.log('\n[4] o veredito, com o teto na frente');
{
  const dentro = veredito('a b c d e f g h i j', 'a b c d e f g h i X');
  ok('uma palavra em dez fica acima do teto de 2%', !dentro.passou,
     dentro.wer + ' > ' + dentro.teto);
  const cem = 'palavra '.repeat(100).trim();
  const quase = cem.split(' ').map((p, i) => (i === 7 ? 'outra' : p)).join(' ');
  const v = veredito(cem, quase);
  ok('e uma em cem passa', v.passou, v.wer + ' <= ' + v.teto);
  ok('o teto é dito junto do resultado', v.teto === 0.02);
}

console.log('\n[5] o texto longo não estoura');
{
  /* Uma transcrição de quarenta minutos passa de dez mil palavras. A matriz
     completa seria cem milhões de células para um número só — por isso a conta
     guarda duas linhas, e este caso é o que prova que ela aguenta. */
  const n = 12000;
  const a = Array.from({ length: n }, (_, i) => 'p' + (i % 97)).join(' ');
  const b = a.split(' ').map((p, i) => (i % 500 === 0 ? 'x' : p)).join(' ');
  const t0 = Date.now();
  const r = wer(a, b);
  const ms = Date.now() - t0;
  ok('doze mil palavras saem com o número certo', r.subs === Math.ceil(n / 500),
     r.subs + ' substituições');
  ok('e em tempo de régua, não de café', ms < 20000, ms + ' ms');
}

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nWER: o instrumento mede o que diz medir.');
process.exit(falhas ? 1 : 0);

/* A TAXA DE ERRO DE PALAVRA — o instrumento, sozinho.
 *
 * Ele vive aqui e não dentro do produto de propósito: o produto não precisa
 * saber medir a si mesmo, e uma conta destas dentro do `template.html` seria
 * peso que todo mundo baixa para servir a quem está comparando duas versões.
 *
 * ---- O QUE ELE COMPARA, E O QUE ISSO NÃO É ----
 *
 * WER contra uma transcrição HUMANA responde "o modelo entende esta fala?".
 * Para isso é preciso áudio real com transcrição conferida à mão, e isso não se
 * fabrica: as amostras desta régua têm um tom contínuo no lugar da fala.
 *
 * WER entre DUAS EXECUÇÕES da mesma fala responde outra coisa, e é a que
 * autoriza ou proíbe uma mudança: "o que eu acabei de mexer alterou o texto?".
 * É essa que o plano pede antes de tocar na compactação de silêncio — a
 * pergunta não é se o Whisper é bom, é se comprimir o silêncio piora o que ele
 * já produzia. Uma linha de base do comportamento de hoje serve para isso, e
 * ela existe sem transcrição humana nenhuma.
 *
 * Quem tiver áudio real com transcrição conferida ganha as duas leituras com o
 * mesmo instrumento — é a mesma conta, muda só o que entra do lado esquerdo.
 */

/* Pontuação fora, caixa fora, espaço colapsado. Acento FICA: em português ele
   distingue palavras ("e"/"é", "esta"/"está"), e tirá-lo esconderia justamente
   o tipo de erro que se quer contar. */
export function normalizar(texto) {
  return String(texto || '')
    .toLowerCase()
    .replace(/[.,;:!?"'`´“”‘’()\[\]{}…—–]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function palavras(texto) {
  const n = normalizar(texto);
  return n ? n.split(' ') : [];
}

/** Distância de edição por PALAVRA, com a conta de cada tipo de erro separada.
 *
 *  Separar substituição, inserção e remoção não é preciosismo: elas vêm de
 *  causas diferentes. Substituição é o modelo ouvindo outra palavra; remoção em
 *  bloco é trecho que sumiu — que é exatamente o risco de comprimir silêncio. */
export function wer(referencia, hipotese) {
  const r = palavras(referencia);
  const h = palavras(hipotese);
  /* Duas linhas de programação dinâmica em vez da matriz inteira: uma
     transcrição de quarenta minutos passa de dez mil palavras, e a matriz
     completa seria 100 milhões de células para um número só. */
  const N = r.length, M = h.length;
  if (!N) return { n: 0, subs: 0, ins: M, del: 0, erros: M, wer: M ? 1 : 0 };

  /* Cada célula guarda o custo e de onde veio, para a contagem por tipo sair
     no fim sem uma segunda passada. */
  const vazio = () => ({ c: 0, s: 0, i: 0, d: 0 });
  let ant = Array.from({ length: M + 1 }, (_, j) => ({ c: j, s: 0, i: j, d: 0 }));
  for (let a = 1; a <= N; a++) {
    const cur = [{ c: a, s: 0, i: 0, d: a }];
    for (let b = 1; b <= M; b++) {
      const igual = r[a - 1] === h[b - 1];
      const dSub = ant[b - 1], dDel = ant[b], dIns = cur[b - 1];
      const cSub = dSub.c + (igual ? 0 : 1);
      const cDel = dDel.c + 1;
      const cIns = dIns.c + 1;
      let escolha;
      if (cSub <= cDel && cSub <= cIns) {
        escolha = { c: cSub, s: dSub.s + (igual ? 0 : 1), i: dSub.i, d: dSub.d };
      } else if (cDel <= cIns) {
        escolha = { c: cDel, s: dDel.s, i: dDel.i, d: dDel.d + 1 };
      } else {
        escolha = { c: cIns, s: dIns.s, i: dIns.i + 1, d: dIns.d };
      }
      cur.push(escolha);
    }
    ant = cur;
  }
  const f = ant[M];
  void vazio;
  return { n: N, subs: f.s, ins: f.i, del: f.d, erros: f.c, wer: f.c / N };
}

/** O par de números que decide se uma mudança pode entrar.
 *
 *  `wer` sozinho esconde a diferença entre "trocou trinta palavras espalhadas"
 *  e "perdeu um parágrafo inteiro" — e as duas têm o mesmo tamanho na conta. A
 *  segunda é a que importa quando o assunto é compactar silêncio, então a
 *  remoção sai destacada. */
export function veredito(referencia, hipotese, teto = 0.02) {
  const w = wer(referencia, hipotese);
  return Object.assign(w, {
    /* Quanto do erro é texto que SUMIU, e não texto trocado. */
    fracaoRemovida: w.erros ? w.del / w.erros : 0,
    passou: w.wer <= teto,
    teto,
  });
}

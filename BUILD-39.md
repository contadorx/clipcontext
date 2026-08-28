# Build 39 — O pulo para o conteúdo existe nas três telas, e leva o foco junto

## A entrada da fila estava velha, e o buraco tinha mudado de lugar

O item dizia *"`<main>` e link de pular conteúdo em 85 páginas"*. Medido antes de
escrever qualquer código:

| | `<main>` | link de pular |
|---|---|---|
| o site (`doc.html`, molde de 14 slugs × 5 idiomas + home + blog) | ✓ | ✓ |
| **a ferramenta** (`app.html`) | **0** | **0** |
| **a conta** (`app/conta/**`) | **0** | **0** |

As 85 páginas já tinham sido pagas em algum build e ninguém atualizou a fila. O
buraco real eram as duas telas que **não** são páginas estáticas.

E a ferramenta tinha `<header>`, **cinco** `<nav>` e dois `<footer>` — todos os
marcos, menos o único que importa. Sem `<main>`, o comando "pular para o conteúdo
principal" do leitor de tela não leva ao lugar errado: **ele não é oferecido**.

## O custo, medido

Na ferramenta, antes:

- **102** elementos focáveis visíveis
- **14 Tabs** até o primeiro controle de verdade (o seletor de cenário)
- e sempre a mesma mobília: logotipo → Como funciona → Comparativo → Preços →
  Blog → Minha conta → PT → EN → ES → DE → FR → 1 Entrada → 2 Conferir → 3 Baixar

Quatorze teclas, em toda visita, para quem navega por teclado.

## O defeito que só apareceu porque testei pelo teclado

Pus o link e o `<main>` na ferramenta, apertei Tab e Enter — e o foco ficou no
`body`. O hash mudava, a página rolava, e **o foco não ia junto**.

É o bug clássico do link de pular: um `<main>` sem `tabindex="-1"` não pode
receber foco programático, e o navegador não tem para onde levá-lo. Quem enxerga
vê a página andar e não percebe. Quem usa leitor de tela continua lendo do topo, e
o Tab seguinte recomeça no cabeçalho.

**E o site tinha o mesmo defeito, desde sempre.** O link existia, o `<main>`
existia, e o pulo nunca levou o foco. Meia solução, por anos, sem sintoma
visível para quem escreveu.

Corrigido nos três — `tabindex="-1"` no `main`, com `outline:none` no foco, porque
um contorno em volta da página inteira lê como erro: o pulo é dito pela rolagem e
pelo leitor, não por uma moldura de 900 px.

## O que mudou, exatamente

- **ferramenta**: `<a class="pular" href="#conteudo" data-i18n="pular">` logo
  após o `<body>`, e a área de trabalho passou de `<div class="wrap corpo">` para
  `<main class="wrap corpo" id="conteudo" tabindex="-1">`. Todos os seletores
  dela são por classe (`body.comBarra .wrap.corpo`), então a troca de tag não
  mexe em layout nenhum.
- **conta**: o mesmo link no `Painel.tsx`, e `painelCorpo` virou `<main>`.
- **site**: só o `tabindex="-1"` — o resto já existia.
- **o texto é o mesmo nas três**, nos cinco idiomas. Quem aprendeu a pular numa
  tela não pode ter que reaprender na outra. Na ferramenta ele é pintado pelo
  `applyLang()`, porque ali o idioma troca sem recarregar.

`display:none` teria tirado o link da ordem de tabulação, que é o contrário do
que ele existe para fazer: ele sai da tela por **posição** e volta quando é
focado.

## A régua

`testes/marcos-a11y.mjs`, e ela testa **pelo teclado**, não pelo HTML:

- os três dicionários dizem a mesma frase, em cada idioma;
- as três telas têm o `main` **e** o `tabindex="-1"`;
- o **primeiro** Tab cai no link, e focado ele fica **visível** (`x=0`) — sem
  essa segunda afirmação, um link com `display:none` passaria na primeira;
- o Enter leva o **foco** para dentro do conteúdo — não só a rolagem;
- o conteúdo é mesmo o conteúdo, e não uma casca vazia ao lado dele;
- e o link repinta ao trocar de idioma sem recarregar, com cinco textos
  distintos.

**Provada por reprovação:** tirando o `tabindex="-1"` da ferramenta, ela acusa
duas vezes — no HTML e no teclado, `e o Enter leva o FOCO para dentro do
conteúdo → (body)`.

Duas correções na própria régua antes de ela valer: o extrator de textos do app
cortava em `pt:{` sem espaço e caía sempre no bloco do português — cinco idiomas
devolvendo a mesma frase, reprovando o produto por um defeito da régua. E o
detalhe da linha era impresso sempre, então aparecia *"tem main, mas sem
tabindex"* ao lado de um `ok` — o mesmo rótulo que contradiz a própria linha que
o `prazos.mjs` já tinha perdido.

## Esteira

`bash testes/liberar.sh` — **87 de 168 réguas, verde**.

## O que sobra do gratuito, na ordem revista

1. ~~a linha de estado da transcrição na ficha~~ — Build 38
2. ~~`<main>` e link de pular~~ — **este build**
3. **estado honesto de recurso por navegador** antes de ativar webcam, clipe,
   WebGPU e OCR — hoje a pessoa descobre que não dá depois de clicar
4. **a matriz de egressão no celular** — 3101 px de tabela rolando de lado numa
   tela de 380. Não quebra a página (medido: `scrollWidth` = 380), mas quatro
   colunas de texto jurídico roladas lateralmente no telefone é ruim
5. **a acessibilidade da ferramenta** — este build pôs o primeiro degrau (sem
   marcos não há o que medir), mas a medição em si continua por fazer. Merece
   build próprio

Continua de pé, fora do gratuito: o **Edge** (opção A, ou A+C) e o `fuser` do
`rodar.sh`.

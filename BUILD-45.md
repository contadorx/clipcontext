# Build 45 — O aguarde do PDF, e o botão que ficava preso

## O relato

> *"falta um aguarde quando baixar um arquivo grande como por exemplo pdf"*

Certo, e o buraco tem nome. Transcrição, varredura, OCR, gravação, reabertura e
Drive chamam `trabalhando()` — e por causa disso mostram **"Processando. Não
feche esta aba"**, avisam no **título da aba** quando terminam, e acendem o botão
de parar.

**O PDF não chamava.** Ele escrevia *"Montando o PDF…"* numa linha de status
pequena e mais nada. Num documento de quarenta telas, com imagem e hash por
página, isso são dezenas de segundos olhando para um botão desabilitado sem saber
se fechar a aba estraga alguma coisa — e estraga.

## E um defeito ao lado, que só apareceu porque fui olhar

**O caminho do PDF não tinha `try/finally` nenhum.** Um erro no meio da montagem
deixava o `#go` desabilitado **para sempre**: a pessoa ficava sem poder nem tentar
de novo, e sem mensagem, porque a linha de status tinha ficado no *"Montando o
PDF…"*. As outras cinco saídas já fechavam com `finally`; o PDF era a exceção.

Agora ele solta o botão aconteça o que acontecer.

## Seis saídas, seis pares

O aguarde entrou como `trabalhando(true, 'saida')` / `trabalhando(false,
'saida')` no PDF, no DOCX, no PPTX, no ZIP, no SCORM e nas saídas de texto
(HTML/MD/CSV). O nome do trabalho é `'saida'` e não um por formato: um nome por
formato multiplicaria o mesmo aviso em seis.

Conferido um a um: **seis começos, seis liberações**.

## O que eu quase entreguei pela metade

A primeira tentativa foi uma substituição em massa — e ela pôs `trabalhando(true)`
em **seis lugares**, dos quais **dois não tinham par**. Um `trabalhando(true)` sem
liberação deixa o *"não feche esta aba"* aceso para sempre, o que é **pior que
não ter aviso nenhum**: ele afirma que ainda há trabalho onde já não há.

Peguei conferindo cada começo contra a liberação dele, e não por sorte. Um dos
dois eu consertei (as saídas de texto ganharam o `finally` que não tinham). O
outro eu **desfiz**, e está escrito no código por quê:

> O **pacote de tarefas** não ganhou o aguarde neste build, e é decisão. O
> `finally` dele fecha um bloco **interno** — a restauração dos quadros — e o zip
> é montado depois, fora dele. Soltar o aviso ali o apagaria antes de o arquivo
> existir; deixá-lo sem par o prenderia para sempre. Meia fiação é pior que
> nenhuma: um aguarde que mente sobre estar acabado, ou um que nunca acaba.

## O `resumo.mjs`, fechado

A esteira completa do Build 44 reprovou `resumo.mjs` — **duas vezes**, sempre sob
contenção, nunca sozinho — com um sintoma que parecia defeito de produto: *"a
linha promete tirar 2 telas e o botão tira 0"*.

Era a premissa da régua. Ela esperava "pelo menos 3 quadros" e **900 ms fixos**, e
então forjava assinaturas iguais para fabricar repetidas — **numa lista que ainda
estava crescendo**.

O primeiro conserto (quatro leituras iguais a 120 ms) matou a falha original e
descobriu outra três passos adiante: a extração "parava" em 3 quadros e um quarto
chegava depois, fazendo o desfazer reprovar com *"4 vs 3"*. Sob contenção o
intervalo entre dois quadros passa de meio segundo com facilidade.

Agora são **seis leituras iguais a 200 ms** — 1,2 s de imobilidade — e, o que
importa mais, **a premissa é cobrada antes do resultado**: se a extração voltar a
crescer durante o bloco, a régua diz isso, em vez de reprovar um número três
passos adiante. Foram duas rodadas da esteira para entender esse sintoma; a
afirmação nova existe para que a terceira não seja necessária.

## Esteira

`bash testes/rodar.sh` — **170 ok · 0 PULADO · 0 FALHOU**. Verde inteiro.

## Na fila

- **o aguarde do pacote de tarefas**, com o motivo acima;
- e os que já estavam: o **Edge** (opção A ou A+C), o `encolherFita()` com
  roteiro, o `fuser` do `rodar.sh`, e o tamanho do leitor do OCR.

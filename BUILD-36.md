# Build 36 — O pacote offline passou a cumprir o que a página de segurança vende

## Primeiro: a esteira completa fechou

`bash testes/rodar.sh` — **165 ok · 0 PULADO · 0 FALHOU**. Era a vez dela pela
cadência (a cada cinco builds), e os quatro anteriores mexeram em banco, conta,
CSS, `build.py`, i18n e cinco documentos legais. Verde inteiro, nenhuma pulada.

## O que estava errado

A página de segurança diz, e diz há tempos, com todas as letras:

> Nada nele fala com servidor nenhum. […] Na versão offline você perde a
> transcrição automática, a leitura de texto da imagem e o botão do Google Drive.

Ou seja: **o caminho B da DEC-1 já estava vendido**. O que faltava era o arquivo
obedecer. As duas escolhas continuavam na tela, e clicar numa delas ia buscar
206 MB no jsDelivr — de dentro do arquivo que promete não buscar nada. Oferecer
o que não se pode entregar é pior que não oferecer: a pessoa escolhe, espera, e
recebe um erro que não sabe ler.

**Uma correção do que eu mesmo relatei:** quando apresentei a DEC-1, repeti do
inventário que o offline chamava `cdn.jsdelivr.net` 1,7 s depois de abrir, sem
gesto nenhum. **Isso já não era verdade** — a trava de antecipação por
`location.protocol === 'file:'` tinha corrigido isso antes. Medido agora, antes
de qualquer mudança: aberto de `file:` e parado por 6 segundos, o pacote fazia
**zero** pedidos. O problema real era o outro, e é o que este build resolve.

## Duas metades, e uma sem a outra não serve

**A tela.** Quando o protocolo é `file:`, somem a escolha de *transcrever
enquanto gravo* (baixa o modelo de voz) e o botão de *ler o texto da imagem*
(baixa o Tesseract). Ficam de pé — e é o ponto — as duas que funcionam sem rede:
*trazer uma transcrição pronta* e *não transcrever*. Se a que sumiu era a
marcada, a escolha cai para a transcrição pronta: um rádio marcado e invisível é
a pior das duas metades. E um aviso explica o que sumiu e o que continua
funcionando, **nos cinco idiomas** — sem ele, a ausência lê como defeito.

**O arquivo.** Esconder o clique não bastava: o endereço continuaria escrito
dentro do HTML, e a mesma página de segurança **convida a pessoa a conferir
procurando no arquivo baixado**. Um avaliador de fornecedor que abre o arquivo e
encontra `cdn.jsdelivr.net` não vai ler o `if` que o protege — vai ler o
endereço. Então o `build.py` corta os endereços do texto:

| o que sai do pacote | quantos |
|---|---|
| `@huggingface/transformers` (a fila de bibliotecas vira `[]`) | 3 |
| `onnxruntime-web` | 3 |
| `tesseract.js`, `tesseract.js-core`, `tessdata` | 7 |
| `huggingface.co` (as duas sondagens do diagnóstico) | 2 |
| `googleapis.com` (Drive) | 5 |
| `accounts.google.com`, `apis.google.com`, `docs.google.com` | 3 |
| `linkedin.com/sharing` (o compartilhar já caía no mailto em `file:`) | 1 |

Medido no arquivo gerado: **zero ocorrências de todos eles**.

A fila de bibliotecas vira `[]` e **não** três strings vazias — uma base vazia
resolve para o próprio diretório do arquivo, e o carregador sairia tentando
importar de `file:` três vezes antes de desistir. Lista vazia cai direto no
caminho de "nenhum endereço respondeu", que existe desde que a fila de reserva
foi escrita.

## A trava, e ela é do build

`TETO_CDN_OFFLINE` era `{"cdn.jsdelivr.net": 13, "huggingface.co": 2}` — um teto
que só impedia o número crescer, com um comentário dizendo textualmente: *"quando
a decisão do offline for tomada, baixe os tetos junto"*. A decisão foi tomada.
**Os dois viraram 0**, e o teto virou proibição, da mesma classe de `supabase.co`.

Cada corte também é uma trava: se o template mudar e um bloco deixar de casar, o
**build para**. Provado por reprovação: removendo um dos cortes de propósito, o
`build.py` recusa antes de escrever o arquivo —
`o build offline passou a citar 'cdn.jsdelivr.net' 1× (o teto declarado é 0)`.
O arquivo bom não chega a ser sobrescrito.

## A régua

`testes/offlineb.mjs` prova, no arquivo gerado e no navegador:

- nenhuma ocorrência dos seis hosts nomeados — é a conferência que a página de
  segurança manda a pessoa fazer, feita aqui;
- aberto de `file:`, **nenhum pedido para fora e nenhum erro de JavaScript**;
- as duas escolhas de rede sumiram, as duas sem rede ficaram, e nenhuma escolha
  marcada está escondida;
- o aviso está lá nos cinco idiomas, **e os cinco textos são diferentes entre si**;
- e a versão da **web continua com tudo** — sem esta última, a régua aprovaria
  alguém matar a transcrição do produto inteiro achando que cortava só o pacote.

Duas correções na própria régua, antes de ela valer:

- **a troca de idioma não trocava nada.** Eu mexia no `#lang`, que é o idioma da
  *fala*; quem troca a interface é o `#idiomas`. Os cinco idiomas devolviam a
  mesma tela em inglês e as cinco afirmações passavam, porque só olhavam o
  tamanho do texto. Agora os cinco textos têm que ser **diferentes entre si**.
- **a lista de exceções da varredura crescia a cada rodada** — github, yworks,
  adobe, phpied, myersdaily, fpdf, cs.cmu. Todos vinham do jsPDF embutido, que
  traz no próprio texto o crédito de quem o escreveu. Uma lista de exceções que
  cresce a cada execução não está protegendo nada, está sendo contornada. A
  varredura larga passou a olhar o arquivo **menos a biblioteca de terceiro**, e
  quem prova que nada é chamado é o bloco que **mede**.

E uma régua vizinha inverteu de propósito: `versoes.mjs` exigia que o pacote
offline carregasse a **mesma** fila de bibliotecas do app. Era a pergunta certa
enquanto o offline ainda buscava na rede; hoje exigir isso seria exigir que ele
volte a telefonar. Agora ela cobra o contrário — fila vazia no pacote, fila cheia
no app — e continua sendo uma pergunta, não uma licença.

## De quebra

O `build.py` avisava, desde o Build 35, `chaves sem valor em privacidade.*:
['prazoConta','prazoEvento','prazoLista']` — em cinco idiomas, a cada build.
Quinze linhas de aviso falso escondem o aviso verdadeiro que aparecer no meio,
que é a razão de o conferente existir. Corrigido.

## Esteira

- `bash testes/rodar.sh` — **165 ok · 0 PULADO · 0 FALHOU**.
- `bash testes/liberar.sh` — **77 de 166 réguas, verde**. Uma rodada intermediária
  com `versoes.mjs` reprovando, que era a régua pedindo o comportamento antigo.

## O que eu faria em seguida, nesta ordem

1. **A metade que falta da DEC-1**: a frase única do caminho A, escrita uma vez
   só, com a matriz de exceções nomeada no mesmo bloco — e a régua que a prova
   contra o que o produto **realmente chama**, e não contra o que o texto diz.
   É o último item aberto da decisão.
2. **O `fuser` do `rodar.sh`** ainda imprime o PID em stdout, colado na primeira
   linha (`6285rodando 3 de cada vez`). É o mesmo defeito que o `liberar.sh`
   perdeu no Build 32; não mexi durante a execução porque o bash lê o script
   conforme executa.
3. **As três Edge Functions ausentes do repositório** (`walkstamp-licenca`,
   `walkstamp-time`, `walkstamp-meus`) — continua dependendo de você dizer onde
   o código vive.

# Build 30 — A sobra da fita para de sobrar: ela passa a levar o passo

**Data:** 27/08/2026
**Relato:** *"a janelinha pode ser menor, ela tem espaço do lado direito, e
poderia crescer na verdade para ter o passo."*

---

## Você tinha razão duas vezes ao mesmo tempo

Medi a fita nos cinco idiomas, com o conteúdo real:

| | precisa | numa janela de 450 |
|---|---:|---|
| português | 390 px | **60 px de vazio** |
| inglês | 395 px | 55 px de vazio |
| espanhol | 420 px | 30 px de vazio |
| francês | 433 px | 17 px de vazio |
| **alemão** | **465 px** | **os botões espremidos** |

Um número só para cinco idiomas **ou** deixa vazio numa língua **ou** comprime os
botões na outra — e ela estava fazendo as duas coisas ao mesmo tempo.

**E a saída não é escolher melhor o número.** É a sobra parar de sobrar.

---

## O que ocupa a sobra agora

```
com roteiro colado   o PASSO ATUAL     — o que quem segue uma lista volta o olho para ler
sem roteiro          a contagem de quadros — o único sinal de que a captura está guardando algo
```

Os dois são **elásticos**: encolhem onde os botões crescem e crescem onde eles
encolhem. Em alemão sem roteiro sobra quase nada e a contagem simplesmente não
aparece — o que **não pode** é ela empurrar um botão para fora.

### E com roteiro a fita ganha uma SEGUNDA LINHA, não largura

A primeira tentativa foi crescer para o lado: 720 px, com o passo dividindo a
linha com os cinco botões. O relato desfez isso em uma frase — *"eu digo em duas
linhas e não em uma linha somente"* — e ele está certo:

| | largura da janela | texto do passo |
|---|---:|---:|
| uma linha, 720 px | 720 | 208–284 px (varia com o idioma) |
| **duas linhas, 480 px** | **480** | **365 px, igual em todos** |

```
● 12:34  3/12  Aprovar o pedido de compra e conferir o valo…
[Marcar] [+ Tela] [Erro] [Parar] [⤢]
```

Largura e altura não custam a mesma coisa aqui: a fita encosta numa borda da
tela, e **480×82 toma menos do trabalho da pessoa do que 720×44**. E o passo,
com a linha inteira, fica igual em português e em alemão — que é o que uma
janela larga nunca ia conseguir.

**Duas armadilhas de flexbox no caminho, as duas medidas e não deduzidas:**

1. O passo nascia com base automática, então o navegador media o texto inteiro,
   via que não cabia ao lado do relógio e **quebrava a linha antes de encolher**
   — a fita saía com **três** fileiras. Base zero resolve: ele nasce sem largura
   e cresce no que sobra.
2. Dentro do bloco do passo, o texto é um filho de flex e nasce com largura
   mínima igual ao próprio conteúdo. A reticência só existe depois que ele pode
   ser **menor** que o texto dele.

**O relógio ganhou `order:-1`.** Na fita a âncora é ele: largura fixa, não se
move, e é a partir dele que o olho acha o resto.

**E o rótulo do passo, na fita, é curto:** `3/12` em vez de `PASSO 3 DE 12` — é o
mesmo acordo dos botões, com a frase inteira no `title`.

```
fita sem roteiro   450×44 → 480×44   (o alemão precisa de 465 só para os botões)
fita com roteiro   450×44 → 480×82
```

**Respondendo ao "pode ser menor":** menor que 480 não dá sem espremer o alemão.
O que dá — e foi feito — é a diferença entre 480 e o que cada língua precisa
virar informação em vez de vazio.

## A régua

Ela mede **no alemão**, que é a língua mais comprida: se o passo couber legível
ali, cabe nas outras quatro. Piso de **300 px** para o texto do passo, e — a
afirmação que faltava — **contagem de fileiras**.

Essa última nasceu de um defeito que passou: instalei a base automática (a
primeira tentativa, com três fileiras) e a largura do texto **aumentou** para
426 px. A régua aprovava três fileiras achando que media duas. Fileira é onde os
elementos começam, e conta-se pelo **centro** de cada um — numa fileira de botões
de 32 px o relógio tem 20 e é centralizado, então o topo dele fica 6 px abaixo.

**Provada reprovando:**

| defeito instalado | o que a régua disse |
|---|---|
| o passo com base automática | `em DUAS fileiras → 3 fileiras` |
| a quebra de linha removida | `1 fileiras` e `7px` de texto |
| a fita escondendo o passo | `0px` |

**E a trava do `build.py` pegou uma crase dentro do `PIP_CSS`** no meio do
caminho. Foi o defeito que derrubou o app inteiro no Build 20 e viajou num zip;
desta vez ele não passou do console.

---

## Regressão

```
163 ok · 0 PULADO · 0 FALHOU        (163 réguas)
Verde inteiro: as 163 rodaram, e nenhuma foi pulada.
```

---

## O que vem depois

1. **A devolução na planilha do roteiro** — um caso marcado como erro deveria
   voltar com situação *Falhou*. É o elo que falta entre a marca do Build 29 e o
   processo de quem compra.
2. **Pular para o próximo erro na revisão** — o contador diz que há três; achar
   as três ainda é rolar a grade.
3. **A nota fiscal e o ajuste de assentos**, atrás da DEC-14.

E os seus dois portões continuam onde estavam: `npm run stripe:conferir` com
chave de teste, antes da primeira venda, e `CONVITE_SAL` na Vercel.

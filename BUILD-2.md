# Build 2 — Não perder trabalho

**Data:** 23/08/2026
**Escopo aceito por você antes de eu mexer** — a regra nova da fila.
**Fila completa:** `FILA.md`. **Catálogo dos itens:** `ALTERACOES.md`, bloco C.

Quem perde 40 minutos de anotação não reclama: some. É a categoria mais cara em
confiança, e nenhum item dela dependia de decisão.

---

## O que mudou para quem usa

### Nada que a pessoa escreveu é jogado fora sem perguntar

Quatro botões trocavam a lista inteira de quadros sem confirmar e sem desfazer:
varrer de novo, gravar de novo, abrir outro projeto, carregar outro vídeo.
Nenhum deles *parece* destrutivo — "Extrair frames" parece um refinamento.

**E na maior parte das vezes é.** Por isso a pergunta é condicional: ela só
aparece quando há trabalho que a varredura não refaz — anotação, tarja,
impressão digital, clipe. Confirmar sempre seria o mesmo defeito com outra cara:
um diálogo que aparece toda vez vira um clique automático, e aí o diálogo que
importa passa junto.

E a pergunta **conta o que se perde**, item por item:

> Isto descarta 3 anotação(ões), 1 tarja(s)/recorte(s) e recomeça do zero. O que
> você escreveu não volta.

"Tem certeza?" não é informação. Quem já baixou o `.json` recuperável não é
perguntado — o trabalho está no disco, e a pergunta seria falsa.

### Reabrir o próprio `.zip` parou de escrever a hora do relógio na anotação

O índice do `.zip` é um TSV de cinco colunas. A escrita usava `.filter(Boolean)`,
que **apaga a coluna vazia** — e a leitura pegava a *última* coluna como
anotação. Resultado:

| o pacote tinha | a última coluna era | a anotação virava |
|---|---|---|
| anotação e hora | a anotação | correta |
| hora, sem anotação | a hora do relógio | `2026-08-23 14:05:11` |
| nem hora nem anotação | o tempo decorrido | `00:14` |

E a anotação é o **título do passo** no documento. Quem anotou um quadro só
recebia o carimbo do relógio nos outros todos.

Agora a escrita tem largura fixa e a leitura lê a coluna 5. **Os pacotes antigos
continuam abrindo, e sem herdar o defeito:** o número de colunas diz o formato,
e as duas colunas que podiam ser confundidas com anotação têm forma conhecida —
`AAAA-MM-DD HH:MM:SS` e `MM:SS`. O que não casa com nenhuma das duas é anotação
de verdade.

De quebra, a anotação passa a ir numa linha só: `\n` e `\t` dentro dela partiam
a linha do TSV e a segunda metade do texto sumia na reabertura.

### O aviso de saída cobria o momento errado

Ele só existia enquanto algo estava **rodando**. Mas o momento de maior risco é
o desprotegido: a meia hora depois, com a grade na tela, anotando. Nada está
ocupado, e um Ctrl+W leva tudo.

A condição passou a ser "há trabalho em curso **ou** há trabalho feito que não
foi guardado". E ele continua calado quando não há o que perder — avisar demais
treina a pessoa a clicar "sair" sem ler.

### O teto da anotação era quatro números diferentes

| onde | era | é |
|---|---:|---:|
| a caixa da gravação | 600 | 600 |
| o campo da miniatura | **180** | 600 |
| a lente | **180** | 600 |
| a revisão | **180** | 600 |

Uma anotação de 400 caracteres escrita durante a gravação era **cortada para
180 só por a pessoa passar por ela** na grade ou na lente, sem tocar em nada. O
texto que se perdia era o único que não dá para reconstruir depois.

O argumento do 180 continua verdadeiro — a anotação vira título do passo, e
título não é parágrafo. Mas isso é um **conselho**, e conselho se dá com o
contador que já existe logo abaixo do campo, não com uma tesoura silenciosa.

E, como agora cabem 600 caracteres, o corte no PDF em grade ganhou marca: a
anotação que não cabe em três linhas termina com `[…]`, como o layout irmão já
fazia. Chegar cortada ao chamado sem sinal nenhum deixa quem lê sem saber se foi
a pessoa que parou de escrever ou se foi o layout.

### Trocar o idioma da interface parou de reescrever o idioma da fala

Era uma linha sem condição. Trocar a interface para inglês reescrevia, em
silêncio, o idioma da **transcrição** — e uma transcrição de quarenta minutos
saía em inglês fonético, com o custo da inferência pago de novo.

O padrão continua acompanhando a interface, porque na maioria dos casos ele
acerta. O que mudou é que a escolha explícita ganha.

### O capítulo volta no `.json`

Um estudo com cinco tarefas separadas voltava como uma lista corrida de sessenta
passos, e refazer o agrupamento é refazer a leitura do material inteiro. Escrito
só quando existe: um documento sem capítulo continua byte a byte o que era.

### Reabrir passou a dizer o que não entendeu

- **Versão desconhecida.** Todo `.json` traz `formato: 1` desde sempre, e ele
  **nunca era lido**: um arquivo gravado por uma versão futura abria calado, com
  o que esta build entendesse e sem uma palavra sobre o resto.
- **Quadro sem imagem.** Sumia em silêncio e a contagem mentia junto — voltavam
  cinco telas de um documento de seis, e a ferramenta dizia que estava tudo
  certo. Agora são contados e ditos.

Os dois avisos sobrevivem à linha de sucesso, ao lado do aviso da tarja que já
morava lá.

### O CSV saía sem guarda de fórmula

Uma célula que começa com `=`, `+`, `-` ou `@` é **executada** ao abrir a
planilha. Numa evidência de teste isso é duas coisas ao mesmo tempo: a anotação
`=1+1 não bateu` chega ao auditor como o número `2` — quer dizer, a prova mente
— e uma anotação hostil vira execução na máquina de quem abre.

---

## A esteira, que era o outro pedido

### De 70 minutos para 12

`rodar.sh` rodava um teste por vez, com três dos quatro núcleos desta máquina
parados. Agora roda em paralelo, com o teto vindo da máquina (`nproc - 1`) e não
escrito à mão — cada teste sobe um Chromium, e mais processos que núcleos fazem
os testes estourarem o `timeout` por lentidão e não por defeito, que é o pior
vermelho possível porque parece defeito.

| | antes | agora |
|---|---:|---:|
| regressão inteira | ~70 min | **12 min** (21 na máquina carregada) |
| pista de liberação | — | ~1–3 min |

Duas medições: 1255 s com a máquina ocupada e 733 s com ela livre. O número que
vale é a faixa, não o melhor caso.

`PARALELO=1` volta ao serial, para depurar uma corrida.

**A saída continua legível.** Cada teste escreve num arquivo próprio e o
relatório é montado na ordem da lista no fim; misturar a saída de três processos
numa tela só é como não ter saída. E um ticker de uma linha por teste mostra o
avanço — vinte minutos de silêncio não são melhores que setenta de ruído.

### A pista de liberação estava fina demais para o produto

O mapa mandava seis réguas quando `src/template.html` mudava. Este build provou
a falha: mexer nos quatro caminhos destrutivos e na largura do índice do `.zip`
**não acionou** `reabrir`, `juntar`, `indice`, `grade` nem `anotacao` — que são
exatamente as que afirmam sobre isso. A pista passou verde e a regressão inteira
achou cinco falhas.

Quem toca o produto agora roda o grupo do produto: 43 réguas, sem servidor. É o
preço honesto de mexer no arquivo que faz tudo.

---

## Como as réguas cobraram este build

**Cinco falharam, e as cinco estavam certas.** Nenhuma delas era defeito do
produto — as cinco eram o contrato mudando.

- `clipe`, `juntar`, `anotacao`, `grade` descartam trabalho **de propósito**: é o
  que elas vieram afirmar. O Playwright recusa diálogos por padrão, então o
  descarte deixou de acontecer. As quatro passaram a aceitar o diálogo, com o
  motivo escrito.
- `lente2` exigia `o limite continua 180`. Era o contrato antigo.

E aí veio a parte que importa: **aceitar o diálogo nos quatro apagaria o recurso
e o teste dele no mesmo gesto** — se o guarda sumisse do produto, os quatro
continuariam verdes, porque aceitar um diálogo que não aparece não custa nada.

Por isso entrou `testes/descarte.mjs`, que cobra as duas metades: com trabalho na
tela o botão pergunta e **diz quanto se perde**; sem trabalho na tela ele **não**
pergunta; recusar mantém tudo, inclusive o texto; aceitar descarta de verdade.

E `lente2` foi reescrita para cobrar a **igualdade** entre os campos, e não o
número — mudar um dos quatro e esquecer os outros reprova ali. Ela achou na hora
um quarto campo que eu não tinha visto: o da miniatura, o mais usado de todos,
que continuava em 180.

---

## Como a regressão terminou

```
140 ok · 2 FALHOU · 12 min
```

As duas são as mesmas de antes deste build: `cenarios` e `timepag`, as réguas
que a rodada de preços deixou para trás. Nenhuma falha nova.

`medicao` continua verde pulando dez afirmações — os blocos da lista de aviso,
que é a **DEC-16**, ainda sua.

## Um erro meu, registrado

Editei o `testes/rodar.sh` **enquanto ele rodava**. O bash lê o script
incrementalmente do disco: a execução corrompeu no fim, com 141 dos 142 testes
já feitos, e a rodada teve de ser refeita. Custou vinte minutos.

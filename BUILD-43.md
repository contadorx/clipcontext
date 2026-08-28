# Build 43 — No telefone a tabela empilha, em vez de rolar nove telas

## O problema, medido a 380px

| página | tabela mais larga |
|---|---|
| `/de/privacidade` | **3452 px** |
| `/seguranca` (a matriz de egressão) | 3101 px |
| `/privacidade` | 2911 px |
| `/comparativo` | 1791 px |

Nove telas para o lado, na página que quem avalia fornecedor lê.

**E o transbordo não era o pior.** O `.tabRola` já resolvia isso — a página não
rolava, só a caixa. O que ele não resolvia era a **leitura**: a primeira coluna
rola para fora, e na quarta a pessoa já não sabe em que linha está.

## Empilhar não contradiz a decisão que já existia

O comentário do `.tabRola` argumenta, com razão, que a tabela **não pode
encolher**: quatro colunas de prazo não cabem em 380px sem virar ilegível, e o
alemão tem palavra composta que não quebra.

Esse argumento é contra **espremer**. Empilhar é outra coisa: ninguém é
espremido, cada célula ganha a linha inteira e leva o nome da coluna junto.

## Como o nome da coluna chega

Do `<th>` da própria tabela, copiado para um `data-rot` em cada `<td>` da coluna
pelo `lib/site.ts` — no mesmo lugar que já embrulha as tabelas. Escrito à mão
seriam 85 páginas onde a próxima tabela nasce sem rótulo, e cinco idiomas onde
ele nasce em português. Medido no alemão: 59 células rotuladas, a primeira
dizendo `"Dritter"`.

Resultado, no mesmo telefone de 380px:

| | antes | depois |
|---|---|---|
| `/de/privacidade` | 3452 px | **380** |
| `/comparativo` | 1791 px | **380** |
| `/privacidade` | 2911 px | **380** |

Acima de 640px ela **volta a ser tabela**, com a caixa que rola para os casos
largos: no computador a comparação entre colunas é a razão de a tabela existir.

## Duas coisas que a medição corrigiu no caminho

**Os `<th>` não estão todos num `<thead>`.** Metade destas tabelas escreve o
cabeçalho numa `<tr>` solta. Esconder só o `thead` deixava esses de pé e
**empurrou a página para 488px** — regressão que eu mesmo criei ao tirar o
`overflow-x`. A linha de cabeçalho passou a ganhar uma classe na geração
(`cabTab`), o que também evita depender de `:has()` no navegador de quem lê.

**O destaque da segunda coluna saiu no telefone.** Ele existe na tabela de
comparação para dizer *"esta é a nossa"* entre seis concorrentes — pergunta que
só faz sentido com as colunas lado a lado. Empilhado, virava um fundo colorido
na segunda linha de cada cartão, sem significar nada.

## A régua

`estreito.mjs` é dona das telas estreitas, e a afirmação dela era **o contrário**:
`m.rolam >= 1` — *"se nenhuma rola, a caixa não está fazendo nada"*. Estava certa
enquanto rolar era o desenho. Agora rolar a 380px é sintoma: se rolou, alguma
coisa não empilhou.

Ela cobra os dois lados: a 380px as células viram blocos com o nome da coluna e o
cabeçalho sai da tela **sem deixar de existir** (por posição, não `display:none`,
para o leitor de tela ainda ter a estrutura); a 1100px tudo volta a ser tabela.

**E uma correção na própria régua, que é a quarta desta classe nesta sequência:**
a primeira versão conferia a **presença do atributo** `data-rot`. Ela passou
inteira com o `content` do `::before` trocado por vazio — ou seja, com a tabela
empilhada e **sem nome de coluna nenhum**, que é exatamente o estado que o bloco
existe para impedir. Atributo é intenção; `content` é o que a pessoa lê. Agora
ela lê o `getComputedStyle(td, '::before').content`, e reprova.

**Provada por reprovação nos dois sentidos:** empilhando também na tela larga
(`a 1100px ela volta a ser tabela → block`) e empilhando sem o nome da coluna
(`o nome é DESENHADO, não só declarado no atributo → ""`).

## Esteira

`bash testes/liberar.sh` — **25 de 169 réguas, verde**.

## O gratuito, quase fechado

1. ~~linha de estado da transcrição~~ — Build 38
2. ~~`<main>` e link de pular~~ — Build 39
3. ~~clipe e OCR~~ — Build 40
4. ~~a webcam~~ — Build 41
5. ~~a matriz de egressão no celular~~ — **este build**
6. **a acessibilidade da ferramenta** — o último. O Build 39 pôs o primeiro
   degrau (sem marcos não havia o que medir); a medição em si continua por fazer

Fora do gratuito: o **Edge** (A, ou A+C), o `encolherFita()` com roteiro, o
`fuser` do `rodar.sh`, e o tamanho do leitor do OCR.

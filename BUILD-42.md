# Build 42 — A largura da janelinha entrou na validação, por idioma

## O relato estava certo, e agora tem número

> *"a janelinha está maior no português que no nosso build original"*

Está. O teto do modo fita subiu **três vezes**, e nada cobrava o número:

| build | teto da fita |
|---|---|
| 26 | 380 px |
| 27 | 415 px |
| 30 | **480 px** |

E em português a fita mede hoje **397 px** — maior que os 380 originais. Ela
carrega mais do que carregava: o botão de ERRO entrou no Build 29 e o alternador
de tamanho no 26.

Medida por idioma, com os rótulos que o produto realmente pinta:

| idioma | largura | folga até o teto |
|---|---|---|
| pt | 397 px | 83 |
| en | 402 px | 78 |
| es | 427 px | 53 |
| fr | 440 px | 40 |
| **de** | **472 px** | **8** |

**O alemão é quem decide o teto**, e sobram oito pixels. O próximo botão custa
isso, e agora está escrito.

## Por que a régua não pegava

Ela media com **rótulos inventados**. O bloco existente injeta `'Markieren'`,
`'+ Bildschirm'` e `'Mikrofon schließen'` à mão — e `'Mikrofon schließen'` o
produto **nunca pintou**: ele pinta `'Mein Mikrofon schließen'`. Uma fita medida
com um texto que o produto não usa é uma fita medida em outro produto.

Agora os rótulos saem do **dicionário do próprio app**, nos cinco idiomas, e cada
largura fica **escrita**. Não é para congelar o desenho — é para que crescer
apareça no diff, com nome e idioma, em vez de aparecer no relato de quem usa.

**Provada por reprovação:** alongando um rótulo em português, ela acusa
`medido 499px, escrito 397px` e `499 > 480 — neste idioma a fita não encolhe`.

## Uma hipótese minha que a medição derrubou

Eu achei que a causa fosse `pausa` e `calar` pintarem a **frase inteira** na fita
— *"Fechar meu microfone"*, *"Mein Mikrofon wieder öffnen"* — enquanto os outros
quatro botões usam rótulo curto. Dei rótulo curto aos dois e **a largura não
mudou um pixel**.

O detalhamento por filho mostrou por quê: naquele estado os dois **nem aparecem**
na fita. A largura vem dos quatro botões de ação, do relógio e do alternador de
tamanho — `marcar:80 · maisTela:73 · erro:44 · stop:67 · tam:30` em português.

Os rótulos curtos ficaram, porque a inconsistência era real e apareceria no dia
em que a pausa estivesse ativa. Mas **não foram eles que engordaram a fita**, e
dizer o contrário seria vender um conserto que não consertou.

## O detalhe que contradiz a própria linha, terceira vez

A régua nova imprimia `397 > 480 — neste idioma a fita não encolhe` **ao lado de
um `ok`**, porque o detalhe era computado sempre. É a terceira vez nesta sequência
de builds — `prazos.mjs`, `marcos-a11y.mjs` e agora esta —, e das três é a única
em que o texto era **alarmante**.

Corrigido aqui, e corrigido também numa vizinha que já tinha o mesmo defeito
antes de mim: `(não achei)` saía ao lado das linhas que passavam. Quem lê a saída
aprende a não confiar no detalhe, e aí ele deixa de servir no dia em que estiver
certo.

## O que fica sabido, e não foi consertado

`encolherFita()` só roda **sem roteiro** — com roteiro ela retorna cedo, porque a
fita tem duas linhas e a conta de uma linha não serve. Ou seja: com roteiro, a
janela fica nos 480 em todos os idiomas, inclusive no português que precisaria de
397. Não entrou neste build porque a conta de duas linhas é outro trabalho, e
prometer sem fazer é pior. Está na fila.

## Esteira

`bash testes/liberar.sh` — **76 de 169 réguas, verde**.

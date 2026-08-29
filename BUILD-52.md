# Build 52 — 33 portas eram disputadas por mais de uma régua

*Eu ia fazer um item pequeno da minha lista: pôr a garantia de porta nas catorze
réguas que faltavam. A medição achou o que a garantia estava tapando.*

## O defeito

O `rodar.sh` roda várias réguas ao mesmo tempo com `xargs -P`, que é uma
**fila**: qualquer duas podem cair juntas. Medido em 29/08:

**33 portas eram usadas por mais de uma régua.** Três arquivos na 8918, três na
8921, três na 8931, três na 8934, três na 8937, três na 8951, três na 8953.

Duas réguas na mesma porta não dão erro barulhento. A segunda encontra a porta
ocupada e, daí em diante, **ou fala com o servidor da primeira** — de outro
teste, com outro conteúdo — **ou derruba o dela no meio**. Verde falso nos dois
casos. O cabeçalho do próprio `rodar.sh` já carregava a cicatriz de uma execução
medida contra uma build velha; o que faltava era descobrir por que aquilo
acontecia sozinho.

## O conserto, e a trava

**41 arquivos renumerados, zero colisões.** O `inventario.mjs` ganhou o bloco
**[7]**, que recalcula isso a cada rodada — a exceção é uma e é declarada: a
**8802**, o Next que o `rodar.sh` sobe uma vez para todas as réguas de site.

As **dezesseis** que sobem o próprio Next passaram a chamar
`garantirPortaLivre`: matar quem estava lá não é o mesmo que a porta ter ficado
livre, e o porquê inteiro está no `_porta.mjs`.

## Dois erros meus, e os dois viraram régua

**1. A edição em massa pulou dois arquivos.** `email.mjs` e `faxina.mjs` sobem o
Next com outra forma — `const n = spawn(...)` dentro de uma função, e um
`comNext()` que sobe duas vezes. Os dois ganharam o `import` e **nenhuma
chamada**: ficaram com cara de prontos e sem a trava.

Por isso o bloco **[8]** cobra a **chamada**, e não o `import`. Contar o import
seria escrever a régua repetindo o erro que ela existe para pegar.

**2. A renumeração não alcançou uma porta escondida.** O `ficha.mjs` tinha a
porta escrita à mão em nove lugares, e num deles **codificada** —
`localhost%3A8961`, dentro de um regex. A troca não a alcançou porque o `%3A`
cola no número e não há fronteira de palavra.

A régua falhou alto, e isso foi **sorte**: a afirmação casava `walkstamp` **ou**
a porta, então podia ter continuado verde pelo outro lado, afirmando sobre uma
porta que não existia mais. Agora a porta tem nome e os nove endereços saem
dele.

## Um terceiro, fora do repositório

As duas primeiras tentativas de rodar a esteira morreram sem criar nem o arquivo
de log. A causa: `pkill -9 -f next-server` — a string `next-server` aparece na
linha de comando do próprio shell que executa o `pkill`, então ele **se matava**
antes de chegar ao `rodar.sh`. `next[-]server` resolve.

Três vezes neste build a coisa medida se pareceu com a coisa que mede.

## O defeito que eu cometi DENTRO do conserto

A primeira desconflitação passou na minha conferência e **reprovou na esteira
completa**: o `seo.mjs` morreu com `EADDRINUSE` na 8842. A causa:

```js
const P = 8806, B = 8842;
```

**Lista de declaradores.** Meu leitor de portas casava `const <NOME> = 8xxx` e
era cego para o segundo — então a `B = 8842` não existia para ele, e eu atribuí
a 8842 ao `webcam.mjs`, **criando uma colisão nova**. O mesmo defeito que este
build inteiro existe para fechar, cometido por mim, dentro do fechamento.

Com o leitor corrigido — lista partida na vírgula, o nome não importa, o
endereço escrito à mão conta, e comentário não é código — apareceram **mais 10
colisões**, quase todas obra da minha própria renumeração. Mais 14 trocas: **156
portas, zero colisões**.

A régua ganhou o mesmo leitor. Se ela tivesse ficado com o meu, teria dado verde
sobre a colisão que eu acabara de criar — que é a definição do defeito que ela
existe para pegar.

**E é por isso que o zip não saiu quando foi pedido.** Ele teria ido com a
colisão dentro e a régua cega para ela.

## Provado por falha

- duas réguas na mesma porta → `FALHA as 140 portas próprias são de uma régua
  cada → 8847: pessoas.mjs e plano.mjs`;
- uma régua que sobe o Next sem a garantia → `FALHA nenhuma sobe o Next sem
  garantir a porta antes → blog.mjs`;
- e a colisão no SEGUNDO declarador, que é a que me escapou → `FALHA as 155
  portas próprias são de uma régua cada → 8869: seo.mjs e webcam.mjs`.

## Esteira

Completa — `bash testes/rodar.sh`: **171 ok · 0 PULADO · 0 FALHOU.** Depois de
mexer em 55 arquivos de régua, nada menos que isso seria honesto — e a primeira
rodada provou o ponto, reprovando o meu próprio conserto.

## O que sobrou da minha lista

- **`encolherFita()` com roteiro** — a janelinha fica em 480 em toda língua.
- **59 réguas fora do alcance do corredor específico** — o teto no
  `inventario.mjs` só desce; baixá-lo é ligar cada uma a uma linha do mapa.

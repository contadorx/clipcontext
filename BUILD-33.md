# Build 33 — A premissa da calculadora passou a ser medida

## O que mudou

A calculadora de ROI da página de preços tem quatro campos. Três são do usuário
— quantos casos por rodada, quantas rodadas por mês, quanto custa a hora dele.
O quarto, **minutos de trabalho manual por caso**, é a única **premissa nossa**:
ele já vem preenchido, e por vir preenchido é aceito.

Ele vinha preenchido com **12**. Esse 12 não saiu de medição nenhuma. Era um
chute com cara de número, no lugar exato onde o argumento de tempo da página
vira dinheiro na tela de quem vai comprar.

Agora vem preenchido com **45** — o tempo medido em uso real para montar uma
evidência à mão (DEC-2, caminho A: *"A estou usando no real, 45 minutos"*).

E a página passou a **dizer de onde vem o número**, nos cinco idiomas:

> O campo de minutos começa em **45** porque é o que leva, medido em uso real,
> montar uma evidência à mão — não é uma estimativa nossa. Troque pelo seu
> número: é o seu que vale.

Um default sem procedência é pior que um campo vazio: o vazio pede uma resposta,
o preenchido dá uma. O que muda aqui não é o 45 no lugar do 12 — é o número
deixar de fingir que foi medido e passar a ter sido.

O resto da calculadora continua como estava, e continua verdade: os quatro
números não saem do navegador, e a conta não se compara com o nosso preço de
propósito.

## A régua

`precos.mjs` ganhou o bloco `[8b]`. Ele exige, **nos cinco idiomas**, que o
campo comece em 45 e que a página traga o 45 junto com a marca de proveniência
(`uso real` / `real use` / `echten Einsatz` / `usage réel`).

**Provada por reprovação:** com 44 em português, ela reprova —
`FALHA  pt: os minutos por caso começam em 45  → 44`. Um default é exatamente o
tipo de coisa que volta a ser chute sem ninguém notar; agora tem quem note.

## O buraco que apareceu no mapa da esteira

A primeira rodada desta build saiu **verde sem `precos.mjs` rodar** — eu tinha
acabado de mexer nos cinco `precos.*.html`.

O mapa `arquivo tocado -> réguas` cobria `src/site/bodies/` com **uma linha só**,
que nomeia sete réguas — e `precos.mjs` não é uma delas. A página com mais
afirmação por metro quadrado do site não tinha a régua dela no mapa. É o mesmo
defeito que o comentário do próprio arquivo já descreve para o `template.html`,
no lugar seguinte.

O mapa acumula todas as linhas que casam, então entraram sete linhas específicas
**somando** com a genérica, e não no lugar dela:

| tocar | chama |
|---|---|
| `precos.*` | `precos.mjs`, `venda.mjs` |
| `termos.*`, `privacidade.*` | `legal.mjs` |
| `seguranca.*` | `legal.mjs`, `matriz.mjs` |
| `comparativo.*` | `comparar.mjs` |
| `caso*.*` | `vitrine.mjs`, `cenarios.mjs` |
| `ajuda.*` | `ajuda.mjs`, `buscaajuda.mjs` |
| `verificar.*` | `verificador.mjs` |

O prefixo `site:` foi conferido régua por régua — só `precos.mjs`, `legal.mjs`,
`vitrine.mjs`, `ajuda.mjs` e `buscaajuda.mjs` precisam do Next de pé; as outras
rodam sem servidor e não pagam os dois minutos do `next build`.

Efeito medido: o mesmo diff saiu de **24** para **26** réguas, e as duas que
entraram são justamente as que afirmam sobre o que eu mudei.

## Esteira

`bash testes/liberar.sh` — **26 de 163 réguas, verde**. Três rodadas: a primeira
verde e cega (o buraco do mapa), a segunda com `precos.mjs` reprovando de
propósito para provar a régua, a terceira verde de verdade.

## Decisão registrada

**DEC-2** — caminho **A**, com a premissa de 45 minutos vinda de uso real.

## O que eu faria em seguida, nesta ordem

1. **A privacidade ainda fala da lista de aviso** — pt e es, inclusive nas
   tabelas de bases legais. Texto morto em documento legal, e agora a régua
   `legal.mjs` já está no mapa da página. É o mais barato que sobrou.
2. **O offline não cumpre o B da DEC-1** — onze referências a `cdn.jsdelivr.net`.
   Embutir ou degradar-com-aviso.
3. **A frase única da DEC-1** e a régua que a prova contra o que o produto
   realmente chama.

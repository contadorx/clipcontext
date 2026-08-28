# Build 44 — A acessibilidade da ferramenta foi medida, e agora tem régua

Este fecha o gratuito. Era o último item, e o único cuja descrição na fila era
uma confissão: *"a acessibilidade da ferramenta nunca foi medida"*. O site tem
régua de a11y há tempos; o `app.html` não tinha nenhuma.

## O que a medição achou

**231 controles** na superfície inteira, e **quatro sem nome acessível**:

| controle | o que é | por que ficou sem nome |
|---|---|---|
| `recAutoMin` | os minutos do "parar sozinho" | está DENTRO de um `<label>` que já pertence à caixa de seleção ao lado — um `<label>` só nomeia um controle |
| `compPara` | o e-mail de quem recebe | só tinha `placeholder` |
| `compQuem` | o nome de quem envia | só tinha `placeholder` |
| `cmpMistura` | o deslizante do antes-e-depois | nada |

Os dois do compartilhar merecem uma linha: **`placeholder` não é nome
acessível**. Ele some no instante em que a pessoa digita, e é justamente aí que
ela pode precisar saber em que campo está.

E o resto veio limpo, o que também é resultado: **39 de 39** focáveis com foco
visível, **nenhum** texto abaixo do mínimo de contraste da WCAG, um `h1`, sem
salto de nível de título, sem `id` repetido, sem `label for` órfão, nenhuma
imagem sem `alt`, idioma declarado.

A ferramenta estava bem — e ninguém sabia, que é uma forma pior de estar bem.

## Os quatro nomes

Entraram por `data-i18n-aria`, que é o mecanismo que já existia, **nos cinco
idiomas**. Um `aria-label` escrito à mão em português seria um leitor de tela
falando português numa tela em alemão; o `data-i18n-aria` é repintado pelo
`applyLang()`, por onde toda troca de idioma passa.

## A régua, e duas vezes em que ela não servia

`testes/nomes-a11y.mjs` cobra nome acessível, estrutura, foco e contraste.

**A primeira versão revelava tudo** — `.hide` fora, `<details>` abertos — e
acusava **23** controles sem nome. **Dezenove eram falso positivo:** o texto
deles é pintado por JavaScript quando a seção entra em cena, e revelar a seção
não pinta nada. Uma régua que acusa dezenove defeitos inexistentes ensina a
ignorá-la, e aí ela não serve para os quatro verdadeiros. Agora ela mede só o
que está **visível** — visível já foi pintado.

**E aí ela deixou de proteger o conserto.** Medi: apagando o `aria-label` do
deslizante, ela passava — porque três dos quatro vivem em telas que ela não
consegue dirigir (só existem depois de haver quadros). Entrou o bloco `[2b]`,
que nomeia os quatro, um a um, e confere os cinco idiomas de cada.

Por que quatro nomes escritos e não uma regra geral sobre a fonte: porque a
regra geral dá falso positivo. Parte dos controles recebe o texto por **variável
local** — o `lenteRev` faz `const b = $('lenteRev')` e escreve em `b.textContent`
—, e uma varredura por `$('id').textContent` acusa um defeito que não existe.
Quatro nomes fechados, com motivo e data, não são uma lista paralela: eles não
duplicam uma verdade que existe noutro lugar, registram o que foi medido.

**Uma prova por reprovação que quase me enganou:** quebrei um `:focus-visible` e
a régua **passou**. Ela estava certa — o navegador ainda desenhava o anel padrão,
então o foco continuava visível. Só apagando o foco de verdade
(`outline:none !important` em tudo) ela reprovou, com cinco elementos nomeados.
Uma injeção fraca demais teria me feito "consertar" uma régua que estava boa.

**Provada por reprovação:** sem o `aria-label` do deslizante,
`cmpMistura tem nome acessível declarado` reprova; com o foco apagado,
`os 34 focáveis percorridos mostram o foco` reprova.

## E a esteira completa achou outra coisa, que não era deste build

`resumo.mjs` reprovou — **duas vezes**, sempre sob contenção, nunca sozinho — com
um sintoma que parecia defeito de produto:

```
ok     há repetidas para a limpeza tirar  → Tira 2 telas (2 repetidas)
FALHA  e ela tirou mesmo                  → 3 depois, 3 antes
```

Uma linha prometendo tirar duas e um botão tirando zero. Meu diff eram quatro
`aria-label`, então não era meu — mas segunda falha é falha, e "flake" não é
causa.

**Era a premissa da régua.** Ela esperava "pelo menos 3 quadros" e mais **900 ms
fixos**, e então forjava assinaturas iguais para fabricar repetidas — numa lista
que ainda estava crescendo. Com a máquina livre a extração já tinha acabado; com
as três pistas do `rodar.sh` disputando CPU, um quarto quadro chegava depois da
forja, e o conjunto que o `#dedup` olhava não era o conjunto forjado.

Passou a esperar a lista **parar de crescer** — quatro leituras iguais, 120 ms
entre elas — e, se o tempo acabar, a dizer que a premissa caiu em vez de seguir
medindo o acaso. É o mesmo conserto que o `etapas.mjs` recebeu pelo mesmo motivo.

## Esteira

`bash testes/rodar.sh` — a completa, porque é o fim de uma sequência de sete
builds no gratuito. **170 ok · 0 PULADO · 0 FALHOU** na rodada final, depois de
o `resumo.mjs` ser consertado (ver abaixo).

## O gratuito está fechado

| | |
|---|---|
| 38 | a ficha diz o que já foi escolhido por ela |
| 39 | `<main>` e link de pular, nas três telas, levando o foco junto |
| 40 | o clipe diz "não dá" antes; o OCR diz "vai baixar" antes |
| 41 | a webcam separa os três "nãos" |
| 43 | a matriz empilha no telefone, em vez de rolar nove telas |
| **44** | **a acessibilidade da ferramenta, medida e com régua** |

E o que o `features.json` já dizia continua valendo: **71 dos 94 itens são do
gratuito, e nenhum está marcado "em construção"**.

## O que sobra, fora do gratuito

1. **O Edge** — opção **A** (trazer as três funções para o repositório e criar a
   régua de sincronia) ou **A+C**. A `walkstamp-stripe` continua com o
   repositório dizendo 410 e a produção rodando a versão antiga, esperando o seu
   passo no painel da Stripe.
2. **`encolherFita()` com roteiro** — com roteiro a janela fica nos 480 em todos
   os idiomas, inclusive no português que precisaria de 397.
3. **O `fuser` do `rodar.sh`**, que ainda imprime o PID colado na primeira linha.
4. **O tamanho do leitor do OCR**, que entra na frase quando alguém puder medir
   de uma máquina com rede aberta.

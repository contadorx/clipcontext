# Build 14 — O teclado na ferramenta, e duas medições minhas que estavam erradas

**Data:** 24/08/2026
**Fila completa:** `FILA.md`. **Item:** Build 10 da fila — a acessibilidade da
ferramenta, "que nunca foi medida".

---

## O item era lacuna de medição, e não do produto

Medida, a ferramenta está em bem melhor estado do que a fila sugeria:

| | |
|---|---:|
| controles visíveis | **100** |
| sem nome acessível | **1** |
| paradas de tabulação | **62** |
| sem marca de foco | **0** |
| imagens sem `alt` | **0** |
| texto abaixo do contraste mínimo | **0** |

Um defeito em cem controles. O `a11y.mjs` que já existia cobre 17 afirmações,
todas sobre teclado nas miniaturas — então "nunca foi medida" era verdade sobre
a **medição**, e a fila leu isso como se fosse verdade sobre o produto.

---

## Duas medições minhas estavam erradas antes de estarem certas

Isto é a parte que vale ficar escrita, porque as duas acusaram defeitos que não
existem — e eu quase relatei os dois.

### O contraste, que acusou 17 problemas imaginários

A primeira versão lia a cor com um regex de números e tratava o fundo como
opaco. Só que `getComputedStyle` devolve **dois formatos**:

```
rgb(21, 23, 28)                          → canais 0-255
color(srgb 0.968627 0.972549 0.98 / .88) → canais 0-1, com alfa
```

Lendo os dois igual, `0,96` vira `0,96 de 255` — quase preto. O resultado era
texto escuro sobre fundo claro com razão **1.16**, que é impossível. Ela
acusou 17 problemas.

Com o canal certo e as camadas semitransparentes **compostas** até chegar a uma
opaca: **zero**.

### O foco, que acusou 24 elementos sem marca

A primeira versão chamava `elemento.focus()` por script. O produto usa
`:focus-visible` — sete regras — e **`:focus-visible` não dispara em botão
quando o foco vem de script**: o navegador só o considera visível quando o foco
veio do teclado. Ela acusou 24 dos 87.

Com `Tab` de verdade, percorrendo as 62 paradas reais: **zero**.

> Nas duas, **o número era do método e não do produto**. É o mesmo erro que eu
> cometi no Build 10 medindo memória com `heapUsed`, que não conta `Buffer`. A
> régua nova tabula com o teclado e compõe as camadas de cor, e as duas
> armadilhas estão escritas dentro dela.

---

## O defeito de verdade estava nos diálogos

Os três diálogos da ferramenta declaram `aria-modal="true"`. O do recado
(`#fbModal`), medido:

```
fbModal: em 25 tabulações, o foco saiu do diálogo 21 vezes
fbModal depois de Escape: continua ABERTO
```

**Duas coisas erradas, e a primeira é a pior.** `aria-modal="true"` diz ao
leitor de tela que o que está atrás não existe — é por isso que ele para de
anunciar o resto da página. Com o foco escapando, ele estava dizendo o falso: a
pessoa tabulava para controles que o leitor tinha acabado de declarar
inexistentes. **Dizer o falso a um leitor de tela é pior do que não dizer nada.**

E o Escape não fechava. Os outros dois diálogos fechavam; este não — um modal
que só fecha no clique prende quem não usa mouse.

### O conserto usa o que o produto já tinha

`inert` — que a ferramenta já usa para travar cartão. Ele tira o ramo da ordem
de foco **e da árvore de acessibilidade**, que é exatamente o que se quer, sem
laço de teclas para manter.

A trava sobe até o corpo tornando inertes os **irmãos de cada nível**: os
diálogos não são filhos diretos do `body`, e marcar só os irmãos do topo
deixaria vivo tudo que divide o pai com eles.

Três detalhes que só aparecem ao medir:

- **O ouvinte do Escape é do documento, não do diálogo.** Pendurado no próprio
  diálogo, ele só funciona com o foco lá dentro — e o foco lá dentro é
  justamente o que não se pode dar por garantido. Se ele escapou, a tecla que
  devolveria o controle não chega. (Foi assim na minha primeira tentativa: a
  trava melhorou de 21 para 3, e o Escape continuou sem funcionar.)
- **O que fica inerte por causa de um diálogo não desbota.** O `[inert]` do
  produto tem `opacity:.45` porque ele existe para o cartão *travado*, onde
  desbotar é a mensagem. Um diálogo já tem véu próprio; os dois juntos lavariam
  o fundo duas vezes.
- **O foco volta para quem abriu.** Sem isso o teclado recomeça no topo da
  página e quem fechou o diálogo perde o lugar onde estava.

### E o controle sem nome

`textarea#tr` — a caixa da transcrição, o campo central da ferramenta — tinha
**só placeholder**. Placeholder não é nome acessível: ele some no instante em
que a pessoa digita, e alguns leitores nem o anunciam.

O conserto usa o mecanismo que já existia no produto para isso —
`data-i18n-aria`, que publica rótulo acessível **sem** balãozinho visível — com
a chave nova nos cinco idiomas.

---

## A régua

`testes/foco.mjs`, com cinco blocos. Ela mede o que dá para medir e **verifica
o que não dá**: só o diálogo do recado é exercitado ponta a ponta (os outros dois
precisam de quadros e de clipe), então o bloco `[5]` cobra que os três estejam
presos ao mesmo mecanismo — um `aria-modal` sem trava é exatamente a promessa
que este build veio corrigir, e ela voltaria calada.

E ela tem travas contra régua vazia, porque duas afirmações aqui passariam com a
página em branco: cobra ter visto **50+ controles** e **30+ paradas de
tabulação**.

Com os defeitos repostos, ela acusa **seis falhas**.

---

## E o `rolar.mjs`, que eu tinha consertado errado no Build 13

Ele reprovou de novo — e a reprovação **mudou o diagnóstico**.

No Build 13 eu troquei o `waitForTimeout(20000)` dele por espera de condição,
tratando-o como mais um da família "medido por relógio". Com 45 segundos de
paciência ele reprovou igual. Então não era o relógio do teste.

Os números das duas execuções dizem o que é:

```
passa:  poucaMudanca: 44   guardados: 2
falha:  poucaMudanca: 81   guardados: 1
```

Depois de congelar, **toda** comparação diz "mudou pouco" e nenhum quadro é
guardado. O produto está certo: a tela congelada ficou parecida demais com o
último quadro salvo, e guardar quase-duplicata é exatamente o que a recusa
existe para evitar.

**A premissa do cenário estava só escrita.** O comentário do próprio teste
afirma que a tela congela *"numa imagem DIFERENTE da que estava quando o último
quadro foi guardado"* — mas o matiz cicla em 360 e o contador avança de um em
um: congelar podia cair perto do que já havia sido guardado. Nada garantia a
frase.

Agora o congelamento salta 180 no matiz, do outro lado do círculo. O que a régua
mede continua sendo o mesmo — que o quadro sai **mesmo** estando a mudança
inteira dentro da máscara de movimento. Três execuções seguidas, `1 → 2` nas
três.

> É a terceira vez nesta sequência que o defeito é uma **premissa afirmada em
> comentário e não garantida em código** — depois do `etapas.mjs` no Build 9 e do
> `resumo.mjs` no Build 12. O padrão vale mais que os três consertos: quando um
> teste explica por que funciona, vale conferir se ele faz o que explica.

---

## O que fica

- **Leitor de tela de verdade** (NVDA, VoiceOver) e **zoom 200%** continuam
  dependendo de máquina física, e continuam fora — como a parte 3 da fila já
  dizia. O que esta régua cobre é o que uma máquina consegue afirmar sozinha.
- Do Build 10 da fila, sobram dois: **estado honesto de recurso por navegador**
  (o produto deteta webcam, clipe, OCR e WebGPU, e avisa zero vezes antes — ele
  descobre na hora do clique) e a **busca na Ajuda**, que tem 45 seções e
  nenhuma.
- Represados por sua instrução: Stripe (DEC-14), Drive (DEC-15), vocabulário de
  cenários (Build 12 da fila).

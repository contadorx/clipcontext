# Build 13 — O telefone e os marcos: 19 páginas que rolavam para o lado

**Data:** 24/08/2026
**Fila completa:** `FILA.md`. **Item:** Build 10 da fila, recorte escolhido por você.

---

## O item-título já estava pronto

A fila abre o Build 10 com *"o reflow: `Entrada → Conferir → Baixar`"* e reserva
8–12 dias para ele. **Ele já está no ar** — é o que o `etapas.mjs` cobra, e foi
ele que eu consertei no Build 9 quando a régua ficou intermitente. O que sobrava
eram cinco sub-itens, e você escolheu os dois que eu já tinha medido com número.

---

## 1. Dezenove de setenta rolavam para o lado num telefone

Medido a **380px** — a largura de um telefone comum — em todas as combinações de
página e idioma que o site publica:

```
medidas 70 combinações a 380px
com rolagem horizontal: 19
  17×  table.legal
```

As piores, e não é coincidência que sejam essas:

| página | transbordo |
|---|---:|
| `/de/privacidade` | **+464px** |
| `/de/informationssicherheit` | +277px |
| `/privacidade` | +173px |
| `/es/privacidade` | +172px |

Quase **uma segunda tela inteira para o lado**, em alemão, na política de
privacidade. São exatamente as páginas que quem avalia fornecedor abre — e ele
abre no telefone, antes de levar ao jurídico.

### O conserto não encolhe conteúdo, e mora num lugar só

Uma tabela de prazos de retenção com quatro colunas **não cabe** em 380px sem
virar ilegível, e alemão tem palavra composta que não quebra. Então a tabela rola
**dentro da caixa dela**, com a página parada — que é o que todo mundo já espera
de tabela larga.

E o embrulho é posto pelo `lib/site.ts`, não à mão: envolver as 85 páginas
significaria 85 arquivos onde a **próxima** tabela nasce sem o embrulho. Aqui,
toda tabela que entrar já nasce embrulhada.

A caixa tem `tabindex="0"` e `role="region"` com nome — uma caixa que rola e não
é alcançável pelo teclado esconde a coluna da direita de quem não usa mouse.

### E sobraram quatro, que eram outra coisa

De 19 para 4. As quatro restantes eram todas alemãs, e o culpado não era mais a
tabela: era **uma palavra no título**.

```
/de/privacidade              h1 "Datenschutzerklärung"   +49px
/de/termos                   h1 "Nutzungsbedingungen"     +57px
/de/informationssicherheit   h1 "Informationssicherheit"  +58px
/de/besprechungsprotokoll    h1 "Besprechungsprotokoll…"  +64px
```

Uma palavra só, sobrando mais que a tabela inteira depois de consertada.
`hyphens:auto` resolve pela via educada: parte na sílaba, com hífen, usando o
dicionário do idioma que o `lang` do `<html>` já declara — em alemão isso é o
normal da língua, não um remendo. O `overflow-wrap` fica embaixo como garantia.

**Vale nos cinco idiomas de propósito.** A próxima palavra comprida pode ser de
qualquer um deles, e uma regra que só cobre o alemão só adia o problema.

**19 → 0.**

---

## 2. Nenhuma página tinha `main`, e nenhuma tinha link de pular

O site tinha `header`, `nav` e `footer`. **Nenhum `main`.** O leitor de tela
anunciava três regiões e nenhuma delas era o texto.

E quem navega por teclado atravessava o cabeçalho e os oito links do menu antes
de chegar ao conteúdo — **em cada página**. Não é desconforto: é o mesmo trabalho
repetido a cada clique.

Os dois entraram nos **dois templates** (`doc.html` e `home.html`), que é o que
cobre as 85 páginas sem lista paralela. O link de pular é o primeiro elemento
tabulável, traduzido nos cinco idiomas, e sai da tela **por posição** — não com
`display:none`, que o tiraria da ordem de tabulação e seria o oposto do que ele
existe para fazer.

---

## A régua

`testes/estreito.mjs` mede as 70 combinações a 380px a cada execução, e a
medição é a mesma que produziu os números acima. Ela distingue as duas formas de
transbordo, porque as duas apareceram neste build:

- a **caixa** que passa da janela (a tabela, antes);
- o **texto** que não cabe na própria caixa e a caixa mede certo (o título
  alemão, que a primeira versão da medição não via).

E ela ignora o que está dentro de uma caixa que rola — ali rolar é o
comportamento desejado, e foi para isso que a caixa existe.

**Três travas contra régua vazia**, porque este projeto já pagou por isso: ela
cobra ter medido pelo menos 60 combinações (se as rotas sumirem do `rotas.json`,
o laço roda zero vezes e "nenhuma rola" fica verde sem ter olhado nada); cobra
que a caixa **realmente role** em pelo menos uma tabela (senão o embrulho é
decorativo); e cobra que o link de pular seja o **primeiro** do teclado, não só
que exista.

Desligada a regra, ela reprova em 27 páginas e em todos os links de pular.

> **O que ela NÃO é: uma auditoria de acessibilidade.** São dois itens medíveis
> por máquina. Leitor de tela de verdade (NVDA, VoiceOver) e zoom 200% continuam
> dependendo de máquina física, e continuam fora — como já estava escrito na
> parte 3 da fila.

---

## Dois vermelhos na primeira execução, e um deles foi a régua acertando

```
149 ok · 4 PULADO · 0 FALHOU
```

**153 réguas, contra 152** — entrou a `estreito.mjs`.

**`paginas.mjs` reprovou, e estava certa.** A afirmação que ela cobra —
*"nenhuma página começa com prosa solta antes do cabeçalho"* — nasceu no Build 5,
quando um comentário meu apagou o cabeçalho de todas as páginas e meia página de
prosa em português apareceu acima do menu nos cinco idiomas. O link de pular é,
por desenho, o primeiro elemento do corpo, **antes** do cabeçalho — e ela pegou.

O perdão é pelo **seletor** (`a.pular`), e não pelo texto. Um perdão por palavra
deixaria qualquer prosa passar bastando começar com "Pular para o conteúdo" —
verificado: com um parágrafo solto colado logo abaixo do link, ela volta a
reprovar.

**`rolar.mjs` reprovou, e não era meu.** Verificado contra o código anterior: ele
reprova lá também, e passou na execução seguinte sem nenhuma mudança. É o quarto
da mesma família dos Builds 9 e 12 — extração de quadros medida por relógio.

Ali eram `waitForTimeout(20000)` depois de congelar a tela, esperando que a
captura reparasse na parada. Quantos segundos isso leva depende do passo de
amostragem e da carga: o mesmo teste dá `1 → 1` numa execução e `1 → 2` na
seguinte, **com o mesmo código**. Virou espera de condição com teto folgado — e a
afirmação continua lendo o valor de verdade, então o teto não pode esconder uma
falha real: quando o quadro não chega, ele expira e ela reprova igual.

---

## O que fica do Build 10 da fila

Os três sub-itens que você deixou de fora, com o que eu medi de cada um:

- **A acessibilidade da ferramenta.** O `a11y.mjs` cobre 17 afirmações, todas
  sobre teclado nas miniaturas. Foco visível, rótulo em todo controle, ordem de
  tabulação e contraste **nunca foram medidos**. É o mais caro dos três e o que
  mais provavelmente acha defeito novo.
- **Estado honesto de recurso por navegador.** Medido: o produto **deteta**
  webcam, clipe, OCR e WebGPU (3, 8, 7 e 5 pontos no código), e **avisa zero
  vezes antes** de a pessoa tentar ativar. Ele descobre na hora do clique.
- **Busca na Ajuda.** A página tem **45 seções** e nenhuma busca.
- Represados por sua instrução: Stripe (DEC-14), Drive (DEC-15), vocabulário de
  cenários (Build 12 da fila).

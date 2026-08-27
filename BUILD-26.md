# Build 26 — Escolher vendo o que se escolhe

**Data:** 27/08/2026
**Pedido:** *"queria um radio button para a seleção da janela pequena ou completa
com a seleção abrindo uma representação gráfica dela… segundo, colocar a opção
não transcrever somente frames na seleção de transcrever enquanto gravo ou
transcrição do meet."*

---

## 1. O tamanho da janelinha, com a janelinha à vista

Era um `<select>` com duas frases. Frase não responde **quanta tela isto vai me
tomar** — que é a pergunta inteira de quem escolhe entre uma fita e uma janela.

Agora são duas opções, e cada uma mostra a **janelinha de verdade**: o mesmo
`corpoDaJanelinha()` e o mesmo `PIP_CSS` que o navegador vai abrir, num `iframe`
do tamanho real reduzido por `transform: scale`. A moldura tem o tamanho
**reduzido**, para que a comparação seja sobre espaço — a fita parece pequena
porque ela é pequena.

```
completa 250×430  na moldura 115×198
fita     380×44   na moldura 175×20
```

### A prévia não é um desenho, e é aí que está o trabalho

Um desenho à mão seria uma **segunda lista**. No dia em que um botão nascesse,
mudasse de lugar ou sumisse da janela, o desenho continuaria mostrando a janela
antiga — e quem escolhesse pela prévia escolheria errado. Por isso duas peças
viraram uma só:

| antes | agora |
|---|---|
| o corpo escrito dentro de `abrirControle` | `corpoDaJanelinha()` — um lugar, dois leitores |
| a medida dentro do pedido ao navegador | `TAM_PIP(min)` — a janela e a moldura leem a mesma |

E `rotularPip` ganhou um quarto parâmetro: cada prévia pede os rótulos do **seu**
tamanho. A fita mostra `Marcar`, a completa mostra `Marcar este passo`, e as duas
estão na tela ao mesmo tempo. Sem isso, uma das duas estaria mentindo sempre.

---

## 2. A transcrição: três estados com dois nomes

Eram dois `checkbox` que já se desligavam um ao outro por código — as duas juntas
descrevem alguém que baixa 206 MB para não usar. Quer dizer: **três estados, com
dois deles escritos na tela.** O terceiro existia e não tinha nome. Quem só
queria as telas tinha que desmarcar uma caixa marcada e adivinhar que aquilo
bastava — e *"desmarquei tudo"* é indistinguível de *"esqueci de marcar"*.

Agora são três opções nomeadas, em `radio`:

```
( ) Transcrever enquanto gravo                        recomendado
( ) Usar transcrição do Google Meet, Zoom ou Teams    recomendado
( ) Não transcrever — só as telas
```

A exclusão passou a ser **do navegador**: o `onchange` que desmarcava o outro
saiu, porque código que repete uma garantia é o lugar onde ela um dia discorda de
si mesma. Saiu junto o `dataset.mao` do `recTr` — ele era escrito e **ninguém o
lia**.

---

## O achado: a terceira opção não estava economizando nada

A régua nova conta os pedidos ao repositório do modelo. Ela mostrou `+0` ao
escolher "só as telas" — e, quando tentei instalar o defeito que a derrubasse,
apareceu a razão de verdade:

> **O download começa 1,2 s depois de a página abrir**, com "transcrever aqui"
> marcado por padrão. A escolha não era guardada em lugar nenhum.

Quem **nunca** quer transcrever pagava os ~206 MB em toda visita, e a única saída
era escolher a terceira opção dentro do primeiro segundo e dois décimos, **toda
vez**. O comentário do produto dizia que "desmarcar a caixa continua sendo a
saída de quem não quer o modelo" — era verdade por 1,2 segundo.

A escolha passa a ser guardada. A segunda visita abre nela e o adiantamento nem
começa, porque ele consulta o `recTr`, que agora chega marcado ou desmarcado
conforme a última decisão. **O que a memória não faz** — cancelar um download já
em vôo — está escrito no código e ficou **fora** do texto da opção: prometer sem
fazer seria pior que não fazer.

---

## A régua 162, e os controles que dão sentido aos números

`testes/previa.mjs` cobre os dois pedidos. Toda afirmação de contagem tem um
controle ao lado, porque **um zero sozinho pode ser a régua não estar olhando**:

```
+0 pedidos ao escolher "só as telas"
+5 ao voltar para "transcrever enquanto gravo"     ← o controle
+0 na visita nova, com "só as telas" guardado
+5 na visita nova, com "transcrever aqui" guardado ← o controle
```

**Provada reprovando:**

| defeito instalado | o que a régua disse |
|---|---|
| a prévia da fita com os rótulos longos | `a fita usa o rótulo CURTO → Marcar este passo` |
| a terceira opção voltando a ser `checkbox` | 3 falhas — grupo, exclusão e o controle do modelo |
| a memória desligada | a visita nova volta a pedir o modelo |

---

## O preço da mudança, dito

**27 chamadas de `#recTr.uncheck()`** em 18 réguas viraram `#semTr.check()`. O
Playwright recusa `uncheck` num `radio` — e o que aquelas réguas queriam era
exatamente o estado que agora tem nome. Elas ficaram mais legíveis: "escolhe só
as telas" em vez de "desmarca a transcrição".

---

## Arquivos

| arquivo | o que mudou |
|---|---|
| `src/template.html` | `corpoDaJanelinha()`, `TAM_PIP()`, `rotularPip(…, minOpc)`, `pintarPreviaPip()`, as duas opções de tamanho, as três da transcrição, a memória da escolha, CSS novo e os textos nos cinco idiomas |
| `testes/previa.mjs` | **nova** — a régua 162 |
| `testes/janelinha.mjs` | passou a ler as fontes novas (`TAM_PIP`, `corpoDaJanelinha`) |
| 18 réguas | `#recTr.uncheck()` → `#semTr.check()` |

---

## Regressão

```
162 ok · 0 PULADO · 0 FALHOU        (162 réguas)
Verde inteiro: as 162 rodaram, e nenhuma foi pulada.
```

---

## O que vem depois

1. **O texto do "recomendado" na segunda opção.** Duas das três opções carregam
   o mesmo selo, e um selo em dois lugares não recomenda nada. Vale decidir qual
   é o caminho recomendado — provavelmente depende de a pessoa ter ou não o
   arquivo, e isso a tela não sabe.
2. **Cancelar o download em vôo** quando a pessoa escolhe "só as telas" no meio
   dele. Hoje a memória resolve da segunda visita em diante; o primeiro minuto
   da primeira visita continua baixando.
3. **A nota fiscal e o ajuste de assentos**, atrás da DEC-14.

E os seus dois portões continuam onde estavam: `npm run stripe:conferir` com
chave de teste, antes da primeira venda, e `CONVITE_SAL` na Vercel.

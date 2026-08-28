# Build 40 — O "não dá" e o "vai custar" chegam antes da ação

## O que estava errado, medido um por um

Quatro recursos dependem de algo que o navegador pode não ter:

| recurso | conferia antes de oferecer? | quando a pessoa descobria |
|---|---|---|
| **WebGPU** | ✅ sim — a opção *some* sem `navigator.gpu` | nunca aparece, e é o certo |
| **clipe do momento** | ❌ não | **com a gravação já em curso** |
| **OCR** | ❌ não | depois do clique, na mensagem "procurando…" |
| **webcam** | ❌ não | **com a gravação já em curso** |

O WebGPU já fazia a coisa certa, e é a prova de que o padrão funciona.

**O clipe era o pior, e vale a sequência exata.** `clipeAbrir()` é chamado
*depois* de o relógio zerar: a pessoa marcava a caixa, escolhia o cenário,
clicava em Gravar, escolhia a tela no diálogo do navegador, esperava a contagem
de três segundos, a gravação **começava** — e só então o *"este navegador não
grava clipe"* entrava na lista de avisos da gravação em curso. Ela está gravando.
Parar para entender custa a tomada.

E o texto do "não dá" **já existia nos cinco idiomas**. Ele nunca foi dito na
hora em que ainda dava para fazer alguma coisa a respeito.

## Dois consertos, e eles não são o mesmo

**O clipe SONDA antes.** `clipeSuportado()` e `clipeTipoBom()` já existiam,
são síncronas, não pedem permissão nenhuma e custam microssegundos. O que faltava
era chamá-las na pintura. Agora, sem `MediaRecorder`:

- o botão diz **"Clipe do momento: este navegador não grava"**;
- a caixa fica **desabilitada e desmarcada** — desmarcar não é zelo: marcada e
  desabilitada, ela continuaria dizendo ao resumo dos Ajustes que o clipe está
  ligado, e o resumo é o que se lê sem abrir a gaveta;
- a nota explica o motivo;
- e a opção **continua existindo, visível**. O clipe é anunciado na página de
  recursos, e uma opção que some sem explicação vira *"sumiu o recurso que eu vim
  usar"*. Esconder é para quando o navegador nem tem o conceito — é o caso do
  WebGPU, onde não há o que explicar.

**O OCR ANUNCIA antes.** Aqui a pergunta *"o leitor carrega?"* **é** o download:
não existe sondagem barata, e sondar seria pagar o custo que a sondagem
existiria para anunciar. Então o conserto é o do Build 38 — dizer antes, no lugar
onde se clica. Uma linha abaixo do botão, nos cinco idiomas:

> Ler o texto da tela baixa um leitor na primeira vez — depois ele fica guardado
> no navegador e as próximas são imediatas. **A imagem não sai daqui: o leitor é
> que vem.**

E ela **some depois que o leitor já veio**: um aviso que sobrevive ao motivo dele
é ruído, e ruído ao lado de um botão ensina a não ler o que está ao lado dos
botões.

## Uma frase sem número, de propósito

A linha do OCR não diz quantos megabytes. O tamanho do leitor não está declarado
em lugar nenhum do projeto, e a rede desta máquina não alcança o CDN para medir —
tentei, e o proxy devolve 74 bytes de página de erro. Escrever *"~10 MB"* seria
um chute vestido de medição, que é exatamente o defeito que o Build 33 tirou da
calculadora de preços. Quando alguém medir, o número entra. Até lá a frase diz o
que é certo: que baixa, que é uma vez só, e que depois fica guardado.

## A webcam ficou de fora, e é decisão

Ela continua conferindo tarde. Não entrou porque **"o navegador não sabe fazer"
e "você não deixou" são coisas diferentes**, e tratá-las igual troca um defeito
por outro: esconder a opção de quem negou a permissão por engano deixa a pessoa
sem entender por que ela sumiu. E há uma armadilha medida em campo por outros:
`enumerateDevices()` pode disparar o próprio pedido de permissão em alguns
navegadores — a sondagem viraria o incômodo que ela existe para evitar. Isso
precisa de medição real em mais de um navegador, e tem build próprio.

## A régua

`testes/recursos.mjs` **amputa o `MediaRecorder`** do navegador para medir o
caminho do "não dá" — sem isso ela só provaria o caminho feliz, que é o que já
funcionava. E amputa o `navigator.gpu` para provar que o WebGPU continua sumindo.

Ela cobra os dois consertos de jeitos diferentes, porque eles são diferentes: do
clipe, que o estado apareça **antes**; do OCR, que o aviso esteja lá, no idioma
certo, **abaixo do botão que ele explica**, e que **suma** quando o leitor
existir.

**Provada por reprovação, nos dois:** desligando a sondagem do clipe, ela acusa
`o botão já diz que este navegador não grava → Clipe do momento: desligado`;
fazendo o aviso do OCR nunca sumir, ela acusa `e depois de o leitor existir, ele
some`.

## Esteira

`bash testes/liberar.sh` — **76 de 169 réguas, verde**.

## O que sobra do gratuito

1. ~~linha de estado da transcrição~~ — Build 38
2. ~~`<main>` e link de pular~~ — Build 39
3. ~~estado honesto: clipe e OCR~~ — **este build**
4. **a webcam** — o que ficou do item 3, com a distinção entre "não sabe" e "não
   deixou". Build próprio, com medição em mais de um navegador
5. **a matriz de egressão no celular** — 3101 px rolando de lado numa tela de
   380. Não quebra a página, mas quatro colunas de texto jurídico roladas
   lateralmente no telefone é ruim
6. **a acessibilidade da ferramenta** — o Build 39 pôs o primeiro degrau; a
   medição continua por fazer

Fora do gratuito, continuam de pé: o **Edge** (opção A, ou A+C), o `fuser` do
`rodar.sh`, e o **tamanho do leitor do OCR**, que entra na frase quando alguém
puder medir.

# Build 8 — A janelinha: o que se lê de relance, e o texto que não liberava

**Data:** 24/08/2026
**Fila completa:** `FILA.md`. **Origem:** seis pedidos seus sobre a telinha de
controle, vindos do uso.

---

## Os seis pedidos, e o que aconteceu com cada um

| | pedido | o que foi feito |
|---|---|---|
| 1 | maior espaçamento | respiro 6px → **9px**, margem 11px → **14px** |
| 2 | o texto depois de salvo não libera para um novo texto | **era um defeito, e não estava onde parecia** — abaixo |
| 3 | "marcar esse passo" com fonte maior | 13.5px → **15.5px**, e em negrito |
| 4 | "mais uma tela deste passo" → "Tela adicional a este passo", colorida | renomeado nos **cinco idiomas**, e agora é azul claro |
| 5 | ícone antes de Pausar, Fechar meu microfone e Parar | três desenhos, e eles mudam com o estado |
| 6 | fonte maior no "passo" e no "passo atual" | 11px → **12.5px** e 14.5px → **16.5px** |

---

## O item 2 não era ajuste. Era defeito, e ele resistia a quem olhasse o código

O relato foi **"o texto depois de salvo não libera para um novo texto"**.

Li a lógica primeiro, e ela estava certa: o campo continua ligado depois de
salvar, o botão volta a acender ao primeiro toque, e marcar outro passo limpa a
caixa. Escrevi um robô que digitava, salvava e digitava de novo — **passou**.

Ele passou porque clicava no campo antes de digitar. **Uma pessoa não faz
isso.** Ela acabou de clicar em Salvar e continua escrevendo.

Refeito assim, o defeito apareceu inteiro:

```
3. SALVOU:       foco = BODY
4. digitou:      campo continua "primeiro texto 111"   botão "✓ Salvo", desligado
```

**Salvar desliga o botão de salvar** — é assim que ele responde "guardei". Só que
desligar um botão que está com o foco devolve o foco ao corpo da página, onde as
teclas não vão para campo nenhum. A pessoa digitava e não saía nada.

### E havia uma segunda camada, que é a que explica a solidez do defeito

Devolver o foco no `onclick` **não consertou**. O motivo:

> Clicar em Salvar tira o foco do campo **antes de o clique chegar**. Sair do
> campo já guarda (é a trava que impede perder texto ao clicar fora), o repintar
> desliga o botão, e **um botão desligado não dispara clique**. A função
> pendurada no `onclick` nunca rodava. Todo o salvamento acontecia pelo caminho
> do "saiu do campo", e o foco ficava no corpo porque o botão se desligou com
> ele na mão.

O conserto é o botão **recusar o foco**: ele não é um lugar onde se escreve. O
campo não perde o dele, o clique chega inteiro, e quem salva continua com o
cursor no texto, no fim dele — pronto para escrever mais.

Não seleciona nada de propósito: uma seleção faria a primeira tecla apagar a
anotação recém-guardada, que é trocar um defeito por outro pior.

**Na janelinha isso era pior do que na aba**, e é por isso que você sentiu ali:
durante a gravação não há para onde clicar de volta sem sair da tela que está
sendo capturada.

Vale para os dois campos — o da janelinha e o do cartão.

---

## O respiro custou pixels, e a janela cresceu

A janelinha fica **por cima da tela que está sendo gravada**: cada pixel dela é
um pixel a menos do trabalho que você está documentando, e ainda aparece nos
quadros. Então o tamanho nunca foi gosto — é o custo dela.

Mais respiro e letras maiores **não cabiam nos 392px**. Medido:

```
antes   373px de conteúdo em 392  →  cabia, com 19 de folga
depois  416px de conteúdo em 392  →  o PARAR terminava 10px FORA da janela
```

A janela subiu para **430** (e para **560** quando há roteiro colado). A largura
não subiu: continua em 250, e nunca subiu desde o primeiro dia.

---

## A régua que media a janelinha não sabia reprovar

E é a parte deste build que mais vale saber.

`janelinha.mjs` afirmava *"o conteúdo cabe na altura pedida"* comparando
`document.body.scrollHeight` com a altura da janela. **Esse número não sobe
acima da janela** quando o corpo tem `height:100vh` — ele devolve a altura da
janela, sempre. A afirmação comparava 392 com 392 e dizia ok **com o conteúdo em
416**. Era uma tautologia com cara de medida.

E havia um segundo furo, independente: **o botão do microfone nunca era medido.**
Ele nasce escondido, e a régua o media escondido — quer dizer, media a janelinha
de quem grava **sem** microfone. Quem narra o que está fazendo, que é o caso que
este produto vende, tem esse botão na tela: mais 29px e mais um respiro. Foi
exatamente essa linha que empurrou o PARAR para fora.

Agora a altura é **somada** — filhos visíveis, respiros entre eles, margens — com
o microfone aceso, e as **duas** janelas são medidas (a com roteiro nunca tinha
sido). Posta de volta em 392, a régua nova reprova em quatro pontos:

```
FALHA  o conteúdo cabe na altura pedida     → 416 de 392
FALHA  e nada fica para fora                → BUTTON#stop
FALHA  o conteúdo cabe na altura com roteiro → 545 de 486
FALHA  e o PARAR termina dentro da janela   → 532 de 486
```

**Uma lista paralela a menos.** O `anotacao.mjs` copiava a altura declarada para
dentro do teste (`const ALT = 392`) e refazia a mesma medida errada. O número
copiado envelheceu no dia em que o produto pediu outro tamanho. A geometria saiu
de lá e ficou só em `janelinha.mjs`; no `anotacao.mjs` ficou o que é dele — a
caixa de anotação.

---

## Os botões, e por que a cor deles não é decoração

Esta janela é olhada **de relance**, no meio de outra coisa. Três retângulos com
texto dentro só se distinguem depois de ler os três.

**A tela adicional entrou na família.** O contorno cinza a colocava junto do
pausar e do calar — e esses são de outra natureza: aqueles mexem na gravação,
estes dois **guardam** o que você veio guardar. Agora ela é o mesmo azul, em
versão mais clara.

Mais clara, e não mais forte, por um motivo: um azul cheio e pálido chamaria
**mais** atenção que o cheio saturado, e a escolha entre os dois aconteceria no
pior momento possível. Ela pertence à família e continua sendo a segunda.

**Os três desenhos são vetores embutidos, e não caracteres.** Um caractere de
pausa ou de microfone depende da fonte da máquina; onde ela não tem o glifo sai
um quadradinho vazio — e um quadradinho vazio antes de PARAR é pior do que nada.

Eles tomam a cor do próprio texto do botão: pausado fica vermelho e o desenho
acompanha, sem uma segunda lista de cores para alguém esquecer de atualizar. E
o de pausar **vira a seta de retomar** quando o rótulo vira "Retomar" — um botão
que diz retomar com duas barras de pausa desenhadas mente sobre o que vai
acontecer.

A palavra fica junto do desenho. Um ícone sozinho é adivinhação, e o botão
irreversível desta janela não pode depender de adivinhação.

---

## Um erro meu, e a régua que ele quase escondeu

**Escrevi duas crases dentro do `PIP_CSS`** — no comentário que existe
justamente para avisar que crase ali fecha a string e derruba o script inteiro.
O arquivo diz que isso já custou dois ciclos de depuração. Peguei antes de
construir.

**E uma afirmação minha passava com o defeito instalado.** A primeira versão do
teste do campo do cartão rodava com a janelinha aberta — e com ela aberta o
campo do cartão não é o que está em uso. A afirmação media um caminho que
naquele momento não era percorrido, e ficava verde com o defeito no lugar.
Agora ela fecha a janelinha antes, que é a situação de quem gravou sem
janelinha ou fechou a dela sem querer.

De quebra: com o defeito, dois cliques do teste **morriam de TimeoutError** em
vez de reprovar — o botão desligado no meio do próprio clique. Vermelho, mas
ilegível. Ganharam prazo curto: agora a recusa vira uma frase.

Com o defeito reposto, `anotacao.mjs` acusa **seis falhas legíveis**:

```
FALHA  depois de salvar, o cursor continua no campo        → BODY
FALHA  e o que se digita depois de salvar ENTRA no campo   → (texto antigo)
FALHA  e o botão de salvar volta a acender                 → {"ligado":false,"texto":"✓ Salvo"}
FALHA  e o texto continuado chega ao quadro
FALHA  no cartão também o cursor volta ao campo            → BODY
FALHA  e o cartão também aceita texto depois de salvo
```

---

## O que fica

- **Os apelidos de alemão e francês**, quando houver escuta de fala real nesses
  idiomas. É a lacuna que você aceitou deixar escrita no Build 7.
- **O bloqueio imediato de assento**: hoje vale na próxima emissão, e isso está
  dito na tela. Torná-lo imediato custa a operação offline — decisão sua.
- Represados por sua instrução: Stripe (DEC-14), Drive (DEC-15) e o vocabulário
  de cenários (Build 12).

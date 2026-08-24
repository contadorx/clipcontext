# Build 15 — O recurso diz o que ele é antes de ser tentado

**Data:** 24/08/2026
**Fila completa:** `FILA.md`. **Item:** Build 10 da fila — "estado honesto de
recurso por navegador antes de ativar webcam/clipe/WebGPU/OCR".

---

## O defeito, medido nos quatro cenários

Com `MediaRecorder` ausente do navegador, a caixa **"Guardar um clipe dos
momentos marcados"** ficava assim:

```
visível: true    desligado: false    motivo: (nenhum)
```

Visível, ligada, sem nada. A pessoa marca a caixa, grava a reunião inteira, e
**só ao fim** recebe *"este navegador não grava clipe"* — depois de a gravação
ter acontecido sem o que ela pediu. O mesmo com a webcam quando o navegador não
expõe `getUserMedia`.

A detecção **já existia** nos dois casos. O que faltava era o momento: ela era
chamada dentro da tentativa de gravar (`clipeSuportado()` em uma linha só, no
meio do `recComeçar`), não na hora de oferecer.

---

## Desligado e dito, em vez de ausente ou ligado

O `usar a placa de vídeo` já fazia certo — mas **escondendo** o controle. Para
estes dois, esconder seria pior:

> Quem veio procurar o clipe e não acha nada conclui **"isto não existe no
> produto"**, e não "o meu navegador não faz".

É a mesma razão que já estava escrita no CSS do botão de mover, sobre outro
controle. Então o controle fica, apagado, com o motivo do lado:

| | |
|---|---|
| **desligado e dito** | informação |
| **ausente** | mistério |
| **ligado** | promessa falsa |

O motivo vai no `title` **e** no nome acessível do rótulo — quem passa o mouse
lê, e quem usa leitor de tela ouve junto com o nome do controle:

```
"Guardar um clipe dos momentos marcados — Este navegador não grava
 clipe — o resto da captura funciona normalmente."
```

**A segunda metade da frase não é enfeite.** Um "não dá" que não diz que o resto
continua funcionando manda a pessoa embora achando que a ferramenta inteira não
serve. As duas frases entraram nos cinco idiomas, e a régua cobra que as dez
digam isso.

E a caixa é **desmarcada** ao ser desligada: marcada e desligada é uma promessa
presa na tela.

---

## O que continua sendo descoberto no uso, e está certo assim

**A permissão negada.** Não há como saber se alguém vai negar a câmera sem
**pedir** a câmera — e pedir a câmera no carregamento da página, só para saber,
é exatamente o que nenhum produto deveria fazer.

O que dá para saber antes é se o navegador **tem a porta**. Se ela abre é outra
pergunta, e o `recCamNao` já responde a essa, na hora. A régua cobra que este
caso continue sendo oferecido — desligar por precaução seria tirar da pessoa uma
escolha que talvez funcione.

**O WebGPU continua sumindo**, e a régua cobra que continue: ele é ajuste de
motor, não recurso que a pessoa veio buscar. A diferença entre sumir e ficar
apagado é deliberada, e agora está medida — para continuar deliberada em vez de
virar inconsistência.

---

## Metade da régua é o defeito oposto

`testes/apoio.mjs` tem seis blocos, e o primeiro é o que impede o conserto de
virar um problema maior:

```
[1] com tudo disponível, nada é desligado
```

Sem ele, **desligar tudo sempre passaria** — e um produto que apaga recursos que
funcionam é pior do que um que promete recursos que não funcionam. Ela também
cobra que um recurso ausente não arraste o vizinho: sem `MediaRecorder`, a
webcam tem de continuar viva.

Medido nos dois sentidos:

- sem a declaração de apoio: **7 falhas**;
- desligando tudo sempre: **4 falhas**, e a primeira é *"a caixa do clipe está
  viva"*.

---

## O que fica

- **O OCR** ficou de fora, e por um motivo: ele depende de alcançar um CDN
  público, e isso não se sabe sem tentar buscar. Declarar "pode não funcionar"
  antes seria assustar a maioria por causa da minoria em rede fechada; o produto
  já diz o certo na hora (`ocrSemCdn`), e o Build 12 pôs o aviso na página que
  vende o recurso.
- **A busca na Ajuda** é o último item do Build 10 da fila: 45 seções, nenhuma
  busca. É o mais fácil dos que sobraram.
- Represados por sua instrução: Stripe (DEC-14), Drive (DEC-15), vocabulário de
  cenários (Build 12 da fila).

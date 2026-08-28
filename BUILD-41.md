# Build 41 — A webcam diz qual dos três "nãos" é o dela

Este é o que ficou de fora do Build 40, e ficou de propósito: **"o navegador não
sabe fazer" e "você não deixou" são coisas diferentes**, e tratá-las igual troca
um defeito por outro.

## Uma correção do que eu tinha escrito na fila

Eu disse que `enumerateDevices()` *"pode disparar o próprio pedido de permissão
em alguns navegadores"*. **Não dispara.** O que ele faz sem permissão é devolver
os dispositivos com o `label` **vazio** — dá para *contar*, não dá para *nomear*.
A cautela estava certa no espírito (não se sabe se há câmera sem permissão) e
errada no mecanismo, e a diferença importa: com a contagem disponível, o caso
"não há câmera nenhuma" passa a ser detectável antes do clique.

## Os três "nãos", e o quarto que é não afirmar nada

| estado | o que a tela faz |
|---|---|
| `semApi` — sem `getUserMedia` | fica visível, **desligada**, com o motivo |
| `negada` — bloqueada para este site | fica visível, desligada, e diz **como liberar** |
| `semCamera` — nenhum dispositivo de vídeo | fica visível, desligada, e diz que não achou |
| `indeterminado` — o navegador não responde a `permissions.query` | **fica normal, e nada é afirmado** |

O quarto é o que segura o desenho. Quando o navegador não responde a
`permissions.query` para a câmera — o Firefox é assim —, o controle fica normal e
o "não dá" continua chegando no uso, como sempre chegou. **Uma régua que adivinha
é pior que uma que cala**, e a régua tem uma afirmação só para que ninguém
"melhore" isto adivinhando.

O que entra de novo é a leitura da decisão **já tomada**: o comentário do
`pintarApoio()` dizia que a câmera recusada *"continua sendo descoberta no uso, e
está certo assim, porque não há como saber se alguém vai negar sem pedir"*. Isso
é verdade para quem **ainda não decidiu** — e falso para quem **já negou**: aí a
resposta está guardada, e `permissions.query` a lê sem pedir nada. É essa metade
que entra agora.

E se a pessoa liberar a câmera na barra do navegador, **a tela se corrige
sozinha**: o `PermissionStatus.onchange` repinta, sem recarregar e sem ela ter
que descobrir que precisa recarregar.

## Eu construí um segundo pintor, e a medição pegou

`pintarApoio()` **já existia** e já era dono de "o navegador suporta?" para o
clipe e a webcam — e já punha o `title` e o `aria-label` no rótulo, o que o meu
não fazia. Eu quase entreguei um pintor ao lado dele.

O sintoma foi exato: com a webcam negada, o meu pintava e o dele repintava por
cima, e o resultado era nenhum dos dois. **Dois donos do mesmo estado é a lista
paralela de sempre, e desta vez fui eu que a escrevi.**

Consolidado: `pintarApoio()` é o dono único e virou assíncrono; o
`pintarBotaoClipe()` voltou a pintar **só o rótulo do botão**. De quebra a
consolidação separou duas coisas que eu tinha juntado: `recClipeAviso` diz *por
que não dá*, `recClipeNota` descreve *o que o clipe é*. Eu estava escrevendo o
motivo por cima da descrição — e aí, para quem lê, o recurso perdia a explicação
no momento em que ganhava um impedimento.

## E a esteira completa me reprovou, com razão

Eu tinha **escondido** a webcam no caso `semApi`, por analogia com a placa de
vídeo. O `rodar.sh` reprovou com `apoio.mjs`, que já guardava a decisão contrária
e o motivo dela:

> Clipe e webcam são recursos que a pessoa **veio buscar**. Quem procura e não
> acha nada conclui *"isto não existe no produto"*, e não *"o meu navegador não
> faz"*. O WebGPU some porque ninguém procura por ele — é ajuste de motor, e a
> diferença é deliberada.

O raciocínio dela é melhor que o meu. A opção voltou a ficar na tela nos três
casos, e **tirei a afirmação duplicada da minha régua**: aquele caso já tem dono,
e repeti-la seria a segunda lista de novo — a primeira coisa que ela faria é
discordar da outra.

## A régua

`testes/recursos.mjs` ganhou o bloco `[3b]`, que amputa o navegador em quatro
configurações: sem `mediaDevices`, com `permissions.query` devolvendo `denied`,
com `enumerateDevices` sem nenhum `videoinput`, e com `permissions.query`
lançando exceção.

**Provada por reprovação no ponto que mais importa:** fazendo o código tratar
"não sei" como "não dá", ela acusa duas vezes —
`a opção NÃO é bloqueada por suposição` e `nenhum aviso é inventado`.

## Esteira

- `bash testes/rodar.sh` — a completa, que é o que pegou o erro do esconder.
- Primeira rodada: **168 ok · 0 PULADO · 1 FALHOU** (`apoio.mjs`, o esconder).
- Segunda rodada, depois da correção: **169 ok · 0 PULADO · 0 FALHOU** — verde inteiro.

## O que sobra do gratuito

1. ~~linha de estado da transcrição~~ — Build 38
2. ~~`<main>` e link de pular~~ — Build 39
3. ~~clipe e OCR~~ — Build 40
4. ~~a webcam~~ — **este build**
5. **a matriz de egressão no celular** — 3101 px rolando de lado numa tela de
   380. Não quebra a página (medido), mas quatro colunas de texto jurídico
   roladas lateralmente no telefone é ruim
6. **a acessibilidade da ferramenta** — o Build 39 pôs o primeiro degrau; a
   medição continua por fazer, e merece build próprio

Fora do gratuito: o **Edge** (opção A, ou A+C), o `fuser` do `rodar.sh`, e o
**tamanho do leitor do OCR**, que entra na frase quando alguém puder medir de uma
máquina com rede aberta.

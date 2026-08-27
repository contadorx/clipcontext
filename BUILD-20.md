# Build 20 — Marcar sem sair do sistema testado

**Data:** 27/08/2026
**Origem:** *"é possível fazer teclas de atalho, já que idealmente a pessoa não
está com a janelinha aberta para o teste... normalmente o tester tem uma janela
somente"*.

---

## A pergunta tinha uma parede, e ela é de navegador

Uma página web **só recebe tecla quando tem foco**. Com o tester dentro do SAP,
a aba do Walkstamp está atrás e não recebe `keydown` nenhum — nem `F9`, nem
`Ctrl+Shift+M`. Não é limitação de implementação: uma página que lesse teclas
sem foco seria um keylogger, e o navegador fecha essa porta de propósito.
Medido: `navigator.keyboard.lock` existe, mas só age em tela cheia **e com
foco**.

Os canais que de fato alcançam uma aba sem foco, todos medidos neste Chromium:

| canal | chega sem foco? | preço |
|---|---|---|
| tecla comum | **não — proibido** | — |
| teclas de mídia (`MediaSession`) | sim | disputadas com Spotify/YouTube |
| pedal USB / Stream Deck (`WebHID`) | sim | hardware + permissão |
| pedal MIDI (`WebMIDI`) | sim | idem |
| gamepad | não — exige a aba visível | — |

As teclas de mídia ficaram de fora: elas **perdem a marcação em silêncio**
quando outro aplicativo tem a sessão, e num produto de evidência um recurso que
às vezes não registra o passo é pior que recurso nenhum.

Você escolheu dois caminhos que não dependem de canal global nenhum.

---

## Parte A — a janelinha em dois tamanhos

O seletor mora **ao lado do botão de reabrir**, e não nos ajustes: é ali que a
pessoa está quando descobre que a janelinha ocupa tela demais, e o conserto tem
que estar onde o incômodo aparece. A escolha é lembrada e vale na hora —
trocando durante a gravação, a janelinha fecha e reabre no tamanho novo sem
interromper a captura.

**A fita levou três formas até virar uma fita**, e as duas primeiras morreram
de medição:

| tentativa | o que era | por que caiu |
|---|---|---|
| 168px | pilha curta | a régua somou 196px: o PARAR ficava dez pixels para fora |
| 200px | pilha curta que coube | testada em uso: *"ainda era uma janela"* |
| **390×56** | uma linha, como controle de mídia | é a que ficou |

```
12:34   ◉ Marcar    ⊞ + Tela    ■ Parar
```

**Fina, e não estreita.** Ela precisa de 375px no alemão
(*"Markieren · + Bildschirm · Stopp"*), e largura numa faixa por cima do
trabalho custa menos que altura: ela encosta numa borda e deixa o meio da tela
livre. Some o medidor, o roteiro, a anotação, o pausar e o calar — fica o que
se usa quarenta vezes por sessão, mais o relógio e o parar.

**Só ícone não bastou.** A primeira fita foi testada e o relato foi *"ficou bom,
mas não dá para saber o que é o que"*. Um obturador, duas telas e um quadrado,
lado a lado e sem palavra, são três desenhos para adivinhar — e adivinhar
durante uma gravação custa o passo. Então são **dois rótulos por botão**: a
palavra curta aparece, e a frase inteira fica no `title` e no `aria-label`. O
nome acessível é o inteiro: quem usa leitor de tela não ganharia nada com
"+ Tela".

---

## Parte B — marcar depois

A lacuna real: **`f.junto` só nascia na captura**, pelo botão "mais uma tela
deste passo". Quem não conseguiu marcar durante o teste ficava com o
agrupamento que o detector adivinhou, sem apelação.

Agora a tecla **P**, na lente, alterna entre *"abre um passo"* e *"junta ao
anterior"*, com a imagem grande na frente. É a mesma razão que já moveu a
anotação para a revisão: agrupar uma tela que não se está vendo é a pior hora
possível para decidir.

O rótulo diz o **estado**, e não a ação — rótulo de ação num botão de duas
posições é o que faz a pessoa apertar só para descobrir o que ele estava
fazendo. E o primeiro quadro mantido **diz por que** não pode juntar-se a
ninguém, em vez de só não responder.

E a afirmação que impede isto de ser um botão de faz-de-conta: o agrupamento
**chega ao documento**.

```
antes : Passo 1 | Passo 2 | Passo 3 | Passo 4
depois: Passo 1 · 1/2 | Passo 1 · 2/2 | Passo 2 | Passo 3
o documento saiu com 3 passos, e não 4
```

---

## O defeito que chegou num zip entregue

Um comentário meu dentro do `PIP_CSS` — que é um **template literal** — levou
crases em volta de nomes de propriedade CSS. As crases fecharam a string, o
script inteiro parou de analisar com `Unexpected identifier 'width'`, e **o app
abria morto**: não carregava vídeo, não gerava nada.

O aviso já estava escrito trinta linhas acima, no mesmo bloco. Eu o li depois de
quebrar.

**Por que nenhuma régua pegou:** a `janelinha.mjs` lê o `PIP_CSS` como TEXTO e o
injeta como CSS numa página de teste — ela nunca interpreta o JavaScript do
produto, então um erro de sintaxe atravessa ela intacto. E as réguas que abrem o
app de verdade não rodaram antes da entrega.

A trava nova fica no **`build.py`**, e não numa régua, porque ali ela impede o
arquivo quebrado de existir — uma régua diria que o app está quebrado depois de
ele já ter sido empacotado e mandado. Duas conferências: nenhuma crase dentro do
`PIP_CSS` (não precisa de nada instalado) e `node --check` no script quando há
node na máquina. Provada barrando os dois casos.

---

## Três defeitos meus, todos pegos por medição e nenhum por leitura

1. **Colisão de especificidade.** `body.min button` perdia para `button#marcar`
   — ID vence classe, e ordem no arquivo não desempata. A fita saía com 170px e
   os rótulos por escrito.
2. **`flex:none` respeitava o `width:100%`** da regra base, desenhada para uma
   pilha. Cada botão saía com **232px numa fita de 250** — três botões de 232
   lado a lado. Faltava `width:auto`.
3. **A minha régua contaminou os blocos seguintes.** O bloco da fita deixava o
   corpo em modo fita e a janela em 56px; o bloco seguinte media a fita achando
   que media a completa, e acusava *"a maior letra dos botões: 0px"* — porque na
   fita o rótulo tem `font-size:0` de propósito. Quatro falhas inventadas, todas
   em afirmações corretas. **Bloco que muda estado compartilhado devolve o
   estado.**

E um buraco na régua, que é o pior dos quatro: zerei o `font-size` dos botões —
instalando de volta a queixa inteira — e ela **passou**. Uma régua que aprova o
defeito que motivou o conserto não guarda o conserto. Agora cobra a palavra
visível, o ícone ao lado, o nome acessível inteiro e a palavra curta nos cinco
idiomas, medindo no alemão.

---

## Por que a esteira não fechava

Três rodadas morreram em silêncio — 86, 89 e 71 de 159, todas verdes até o ponto
da morte, nenhuma com linha de resumo. Culpei disputa de CPU, depois as minhas
próprias reconstruções. Nenhuma das duas explicava a terceira, em que não
encostei na máquina.

A causa: eu disparava a esteira com `nohup`/`setsid`, e **neste ambiente quem
sobrevive entre turnos é o mecanismo de segundo plano do próprio harness**. Os
erros de `Directory nonexistent` num dos logs eram sintoma e não causa — quando
o `rodar.sh` morre, o `trap` apaga a pasta de logs e os testes órfãos reclamam
por escrito.

---

## Arquivos

| arquivo | o que mudou |
|---|---|
| `src/template.html` | os dois tamanhos da janelinha, a fita, `rotularPip`, `pipModo`; `passoModo`/`virarPasso` e a tecla P na lente; quinze frases novas × cinco idiomas |
| `build.py` | a trava que recusa um app cujo script não analisa |
| `testes/janelinha.mjs` | mede as duas janelas; cobra que a fita continue fita, com palavra e ícone, no alemão |
| `testes/marcar.mjs` | **nova** — marcar depois, até o documento |
| `testes/rodar.sh`, `testes/liberar.sh`, `testes/LEIA-ME.md` | registrada nas três listas |

---

## Regressão

```
155 ok · 4 PULADO · 0 FALHOU        (159 réguas)
Pulados: timepag.mjs licenca.mjs liclink.mjs licauto.mjs
```

Os quatro de sempre: `timepag` cobra uma página aposentada, e os três de licença
precisam do `emitir-licenca.py`, que guarda as chaves privadas e não viaja no
zip. **A cobertura é a dos 155.**

---

## O que fica em aberto

**Só o seu desktop responde:** o Chrome impõe um mínimo próprio para a
janelinha, e daqui não dá para medir qual é — este contêiner não tem gerenciador
de janelas. Se ele recusar os 56px, a fita fica no topo de uma janela maior e
continua funcionando.

**E a sequência até a venda continua onde estava:** Build 21 é a licença provada
sem a chave de produção — o portão que a Stripe abre, e o único que nenhuma
regressão atravessou.

# Build 38 — A ficha de gravar passou a dizer o que já foi escolhido por ela

## A pergunta que abriu isto, e a resposta medida

> *"as opções de transcrição… somente serve na ficha de tela, não é isso?"*

**Não.** Os três rádios ficam abaixo dos dois cartões, em largura cheia, e valem
para os **três caminhos de entrada**: gravar a tela, enviar um arquivo, abrir do
Drive.

E não é acaso — eles **já estiveram dentro do cartão de gravar** e saíram de
propósito. O comentário no código guarda o relato de campo que causou a mudança:

> *"no gravado tem a opção de transcrever enquanto gravo, falta o equivalente no
> outro lado"* — e o equivalente não era uma segunda caixa. Era esta, no lugar
> certo. **Uma caixa só, e não duas espelhadas: duas caixas para a mesma pergunta
> é a segunda lista ao lado da lista de verdade, e um dia elas discordam sobre se
> o modelo deve baixar.**

Mover os rádios de volta para a ficha desfaria essa correção, e quem chega com
arquivo ficaria sem a escolha.

## Mas havia um defeito real, e ele era de ORDEM

Medido na tela construída:

| | y |
|---|---|
| botão **Gravar a tela** | 603 |
| fim visual do conteúdo da ficha (com os Ajustes fechados) | ~700 |
| **os três rádios de transcrição** | 946 |

A escolha mais cara da tela — o padrão marcado baixa **~206 MB** — está **343 px
abaixo do botão que a consome**, na ordem de leitura *depois* da ação. Quem clica
em Gravar assim que vê o botão nunca leu a escolha que já estava tomada por ele.

E a ficha da esquerda tem espaço morto: ela é esticada até a altura do cartão da
direita, que é mais denso (zona de arrastar, vídeo de exemplo, Drive). Com os
Ajustes fechados sobravam ~230 px de nada.

*(Uma correção do meu próprio diagnóstico: na primeira captura a gaveta "Ajustes"
aparecia aberta, o que fazia a ficha parecer mais cheia do que é. Ela abre porque
o `_navegador.mjs` força todo `details.sub` a abrir antes da página carregar. Na
vida real ela nasce fechada, e o vazio é maior.)*

## O que subiu foi o ESTADO, nunca o controle

Uma linha dentro da ficha, entre o botão e os Ajustes:

> **Vai transcrever enquanto grava** · ~206 MB de modelo, uma vez só — *trocar*

Ela muda com a escolha (*"Você vai trazer a transcrição pronta"*, *"Sem
transcrição — só as telas"*), e o custo do modelo **só aparece na opção que o
baixa** — anunciar megabytes ao lado de "só as telas" seria assustar por um
download que essa escolha existe para evitar.

É o mesmo desenho que a própria ficha já usava e que já funcionava: o `<summary>`
dos Ajustes mostra *"para sozinho em 45 min"* sem precisar abrir. **Um estado
visível não é um segundo controle.** As duas linhas agora se leem no mesmo ritmo.

O **"trocar"** é um `<button>`, e não uma âncora: âncora empurra a página e
escreve no histórico, e voltar depois disso leva a pessoa para fora da
ferramenta. Ele leva o **foco para o rádio que está marcado** — não para o
primeiro. Chegar com o foco no primeiro faria a barra de espaço trocar a escolha
antes de a pessoa ler as outras duas.

E respeita a decisão do Build 27 — *"ação primeiro, decisões depois"* —, que é o
motivo de eu **não** ter subido os rádios para antes dos cartões, que seria a
outra saída óbvia.

## Uma verdade, um lugar que a pinta

A linha é pintada dentro do `notaTr()`, que já era a única função que lê qual
rádio está marcado. Uma função nova lendo o mesmo rádio seria a segunda lista de
sempre — e o dia em que ela discordasse desta é o dia em que a ficha diria "não
transcreve" enquanto 206 MB desciam.

**No pacote offline a linha fica**, e a primeira versão a escondia. Lá a escolha
de transcrever não é oferecida e `usarPronta` é a marcada — então a linha diz
*"você vai trazer a transcrição pronta"*, que é verdade e é exatamente o que quem
abriu o arquivo precisa saber antes de gravar. Esconder tiraria informação certa
por causa de uma regra que era sobre a outra opção.

## A régua

Entrou no `escolhas.mjs`, que já é dono deste assunto — arquivo novo seria uma
segunda régua sobre a mesma tela. O bloco `[3b]` prova que a linha existe, que
fica **abaixo do botão e acima dos rádios**, que as três escolhas produzem três
textos diferentes, que o custo aparece só em uma delas, e que o "trocar" leva o
foco para a marcada.

E a afirmação que segura o desenho:

> **a ficha continua SEM nenhum controle de transcrição dentro** — `0`

Se um dia alguém "melhorar" isto pondo um rádio ali, é essa linha que reprova.

**Provada por reprovação:** congelando a linha num texto fixo, ela acusa
`e as três dizem coisas DIFERENTES → 2 de 3`.

## Esteira

`bash testes/liberar.sh` — **74 de 167 réguas, verde**.

## O estado do produto gratuito, medido

Do `features.json`: **71 dos 94 itens são do gratuito** (`fpt`), 16 são do pago e
7 do Team. **Nenhum item do gratuito está marcado "em construção"** — os três
únicos com estado declarado são pagos.

Em funcionalidade o gratuito não deve nada. O que falta é uso, e nesta ordem:

1. ~~a linha de estado da transcrição na ficha~~ — **feito neste build**
2. **estado honesto de recurso por navegador** antes de ativar webcam, clipe,
   WebGPU e OCR — hoje a pessoa descobre que não dá depois de clicar
3. **a matriz de egressão no celular**: 3101 px de tabela rolando de lado numa
   tela de 380. Não quebra a página — medido, `scrollWidth` do documento = 380 —
   mas quatro colunas de texto jurídico roladas lateralmente no telefone é ruim.
   Uma versão empilhada abaixo de 640 px resolve
4. **`<main>` e link de pular conteúdo** em 85 páginas
5. **a acessibilidade da ferramenta nunca foi medida** — o site tem régua de
   a11y, o `app.html` não tem nenhuma. É o maior buraco do gratuito, e merece
   build próprio

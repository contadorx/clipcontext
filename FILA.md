# A fila — builds, decisões e sequência

**Aberta em:** 23/08/2026
**Substitui, como ordem de execução:** `ALTERACOES.md` (119 itens), o backlog
consolidado de 22/08 (108 itens) e a seção "ordem" do `SEQUENCIA-DE-BUILDS.md`.
Aqueles três continuam valendo como **catálogo** — é lá que mora a descrição de
cada item. Aqui mora a **ordem**, e só ela.

**Medida contra:** a árvore de 22/08 que está publicada na Vercel, e o banco de
produção `kjlnyyblhanficgpends`, consultado ao vivo em 23/08.

---

## As regras que produziram esta ordem

Você deu três, e elas mandam mais que a gravidade dos documentos:

1. **Impedimento primeiro.** O que impede *trabalhar* vem antes do que impede
   *vender*. Uma régua que não roda fora de uma máquina custa mais que uma
   frase errada, porque a frase errada é achável e a régua quebrada esconde as
   próximas.
2. **Depois o fácil.** Entre dois itens do mesmo peso, ganha o de menor esforço
   e menor risco de mexer. Uma tarde com dez itens fechados vale mais que uma
   semana com um.
3. **Pagamento no fim, ou sob demanda. Drive no fim.** Nenhum build de 1 a 9
   depende de tocar na Stripe ou no Google. Onde a Stripe aparece antes
   (Build 6), é **leitura** do que ela já manda — não é reconectar nada.

E uma quarta, que você acrescentou no meio do Build 1: **o escopo do build é
aceito antes de eu mexer.** Antes de cada build eu escrevo o que vai acontecer
nele — os itens, o que muda na tela, o que pode quebrar — e espero seu aceite,
do mesmo jeito que faço com as decisões. O caminho pode mudar, e mudar antes é
barato.

Isso não anula a regra do parágrafo anterior sobre as **decisões**: cada uma
tem um caminho padrão, para que uma decisão pendente não segure um build já
aceito. O que passa a exigir aceite é o **escopo**, não cada decisão.

## Como um build é liberado

A regressão inteira leva ~70 minutos. Pagá-la a cada build cobra uma hora e dez
por uma mudança de duas linhas — e o custo real não é o relógio: é que a espera
ensina a pular a régua.

| | quando | quanto |
|---|---|---:|
| `bash testes/liberar.sh` | **cada build** | ~1–3 min |
| `bash testes/rodar.sh` | **a cada cinco builds**, e antes de publicar | ~50–70 min |

**A cadência mudou em 27/08, por instrução do Leandro:** a pista específica em
todo build, a esteira inteira a cada cinco. O motivo é o custo medido — dos
Builds 23 ao 31, a esteira completa rodou onze vezes e reprovou seis, e todas as
seis foram apanhadas pelo diff (a pista específica cobre as réguas que o build
toca). O que a esteira inteira pega, e a específica não, é o efeito colateral em
régua que o mapa do diff não liga — foi o caso do `fluxo.mjs` no Build 27 e do
`miudos.mjs` no Build 29. Cinco builds é a distância que ele aceitou carregar
desse risco.

A pista de liberação roda em três partes: o chão (`build.py` e o TypeScript),
os doze contratos estáticos — sem navegador e sem servidor, catorze segundos —,
e **as réguas que cobrem os arquivos que este build tocou**, derivadas do `git
diff` por uma tabela escrita à mão. Ela sobe o Next só quando alguma régua do
diff precisa dele.

E ela diz, no rodapé, **quantas réguas ficaram de fora**. Um recorte silencioso
lê-se como "cobri tudo"; este diz o número.

---

## Onde estamos hoje — medido, não lembrado

| | |
|---|---|
| Repositório interno | estava em `7c90a97` (19/08); **sincronizado hoje** com a árvore de 22/08 |
| Migrações no banco | 44 aplicadas · repositório tinha as 44 · **duas novas aplicadas hoje** |
| `build.py` | roda, sai 0, gera `app.html` (1,3 MB) e o offline (1,66 MB) |
| `next build` | roda, sai 0 |
| Regressão | roda **nesta máquina agora** — ver "o que foi destravado" |

### O que foi destravado hoje, e que não estava na lista

A suíte não rodava fora da máquina de origem por **três motivos**, e nenhum
deles é código do produto:

- `testes/amostras.py` precisa de Pillow e de um `ffmpeg` com o demuxer
  `image2`. O `ffmpeg` que vem com o Playwright **não tem** `image2` — só
  `image2pipe` — e falha com "No such file or directory", que lê como arquivo
  faltando e não como demuxer faltando. Sete testes caíam com
  `ENOENT /tmp/amostra.webm` e o diagnóstico honesto era indistinguível de "o
  produto quebrou".
- `testes/_medir.mjs`, `_pdf.mjs` e `_pip.mjs` ainda carregam
  `RAIZ='/root/walkstamp'` escrito à mão. Os outros 140 já derivam de
  `_caminhos.mjs`; estes três ficaram para trás.
- Sem isso, `rodar.sh` termina imprimindo os que falharam e **sai zero**. Uma
  esteira que sempre acaba em verde ensina a não olhar.

Os dois primeiros estão resolvidos neste build. O terceiro também.

---

## DEC-16 — Apontar na tela durante a gravação *(decidida 06/09, entregue no Build 56)*

**O pedido, do campo e de muita gente:** "queria abrir determinada tela e já
fazer a marcação — setas, um retângulo — para não esquecer". Marcar depois já
existia, na lente. Marcar **agora** não, e o "depois" custa caro: quarenta telas
adiante ninguém lembra qual campo da tela 12 estava errado.

**O que foi medido antes de decidir:**

- a marcação já era **vetor**, e não pixel: `f.marcas` normalizado de 0 a 1,
  queimado só na exportação (`queimarTarjas`). Anotar ao vivo custa um `push`
  num array, e não um canvas de 1920 redesenhado no meio da captura;
- a prévia já era um SVG `viewBox="0 0 1000 1000"` com
  `preserveAspectRatio="none"` — desenha igual numa figura de 300px e numa de
  1920, então a janelinha pode ser pequena sem que a marca saia do lugar;
- a janelinha **já sabia crescer e voltar a encolher**: `trocarTamanhoPip()`
  fecha e reabre, e a gravação sobrevive porque não passa por ali.

**As três decisões que o build tomou:**

1. **A captura PARA enquanto se aponta.** O editor é uma janela por cima da tela
   compartilhada, e o padrão desta ferramenta é gravar o monitor inteiro: sem a
   pausa, os quadros seguintes sairiam com a nossa ferramenta desenhada em cima
   do sistema do cliente. A pausa é a que já existe — o relógio segue correndo,
   porque a hora de parede tem que continuar verdadeira. Quem já estava pausado
   continua pausado ao fechar.
2. **Só seta, retângulo e caneta.** Tarja e recorte MUDAM a figura, e mudar
   figura no meio de uma gravação numa janela pequena é o gesto que não se pode
   errar. Eles ficam na revisão, com a imagem grande e o engano reversível.
3. **A marcação vai para o espelho em disco.** A imagem já sobrevivia a uma
   queda do navegador; a seta feita ao vivo passou a sobreviver também. A imagem
   no espelho continua **limpa** — a marca vai como lista, porque um espelho já
   queimado é uma cópia que ninguém desfaz.

**E uma correção minha, do que eu tinha dito antes de medir:** eu disse que a
edição ao vivo entraria no catálogo pago "como as outras marcações". Está
errado, e o próprio código desmente: seta, retângulo e caneta são **grátis** na
lente desde sempre. O que é pago é *acabamento* — a tarja de classificação, o
campo de emissor, a contagem de erros na identificação. Marcar uma tela é
**prova**, e prova não se cobra. O recurso nasceu grátis.

---

## ACHADO FECHADO — o Chrome descartava o tamanho pedido, e a medida estava fora de alcance *(06/09)*

**Duas voltas com o mesmo relato** — *"ficou do mesmo tamanho a janelinha"* —,
e nas duas o pedido estava correto no artefato. A causa não era a nossa conta.

**`preferInitialWindowPlacement` era a chave que faltava.** O Chrome guarda a
posição e o tamanho da janela de picture-in-picture **por site** e, na abertura
seguinte, **restaura** o que a pessoa deixou, descartando `width` e `height` sem
avisar. Daqui isso é indistinguível de um teto: a janela volta igual, sem erro
nenhum, e pedir maior não muda nada — foi por isso que subir de 72% para 94% (o
Build 58) e depois mandar um `resizeTo` (o 59) não mudaram uma vírgula na tela
de quem usa. Com a opção, a abertura usa o tamanho pedido em vez do lembrado.
Um navegador que não a conheça ignora a propriedade a mais.

**E a segunda metade do relato era minha:** *"não achei o erro"*. Eu tinha posto
a medida em `motivosFrame`, que só é gravado quando a gravação **para**. Uma
medida que só existe depois do fato não serve para conferir o fato. Agora ela
sai no **diagnóstico**, que abre a qualquer hora, dizendo as duas coisas:
`janela PiP : editor pediu 1203x821, veio … tela=…`. Sem editor aberto ela diz
isso também — um relatório com uma linha em branco no lugar de um número é o
mesmo que não ter a linha.

**A lição, e ela é sobre a régua:** as três tentativas passaram por uma esteira
verde. Nenhuma régua reprovou porque nenhuma podia — o `documentPictureInPicture`
não existe no navegador de teste, e o remendo que o substitui obedece a tudo o
que se pede. O que o remendo pode afirmar é **o que foi pedido**, e é isso que
ele afirma agora: que a opção vai junto. O resto — se o navegador de verdade
obedece — só a tela real responde, e por isso o número foi para o diagnóstico.

---

## ACHADO FECHADO — pedir o tamanho na abertura não bastava *(06/09)*

**O relato:** *"ficou do mesmo tamanho a janelinha"*, depois do Build 58 ter
subido o pedido de 72% para 94% da tela.

**Medido no artefato: o pedido estava certo.** `TAM_PIP_ED` calculava 94%,
`requestWindow` recebia o número novo, e a janela voltava igual. Quem não
obedeceu foi o navegador — o Chrome guarda o tamanho da janela de
picture-in-picture **por site** e reabre no que a pessoa deixou, ignorando o que
se pediu. Do lado de cá isso é **indistinguível de um teto**: a janela volta do
mesmo jeito e sem erro nenhum.

**O outro lado da mesma janela funciona.** `resizeTo` é o que o `encolherFita`
já usa para apertar a fita até o conteúdo medido; aqui ele serve para o
contrário. Agora o produto manda o tamanho **depois** de aberta — e fica sendo a
nossa preferência que manda, e não a do navegador. Isso é de propósito: a nossa
é guardada do mesmo jeito, no tamanho em que a pessoa fechou; a diferença é que
a nossa está escrita.

**E o que voltou fica anotado no diagnóstico** (`pediu 1203x821, veio …`). Sem
número, *"abriu pequeno"* é uma conversa sem medida — que foi exatamente como
este defeito chegou, duas vezes.

Uma armadilha no caminho, e quem a pegou foi o bloco de erro de página da régua,
não a leitura: `const tam` vivia dentro do `try` da abertura, e o `resizeTo` do
lado de fora recebia `tam is not defined`.

---

## DEC-16 (continuação) — o editor abre grande, e lembra o tamanho *(Build 58)*

**O relato:** *"minha ação foi abrir ela inteira e me perdi"*. Ele nascia com 72%
da tela.

**O argumento dos 72% já tinha caído antes disso, e eu não percebi.** Ele era:
*"a janela precisa ficar por cima de algo — se cobrir tudo, a pessoa perde a
referência do que estava documentando"*. Isso valia enquanto o editor disputava
tela com a captura. Desde que a captura **para** enquanto se aponta, não há nada
acontecendo atrás para manter à vista — e num ERP em tela cheia, numa janela de
72%, o campo que se quer circular tem quatro pixels.

Agora abre com **94%** da tela disponível, e **o tamanho que a pessoa der fica**:
`documentPictureInPicture` não redimensiona depois de aberto, mas o `innerWidth`
ao fechar diz no que ela virou. Com piso (520×380) e teto (a tela atual) — sem
piso, um arrasto sem querer deixa o editor inútil para sempre e sem pista do
porquê; sem teto, um tamanho guardado num monitor de 4K abre fora da tela no
notebook.

**E a política de privacidade passou a declarar as preferências de tela.** Ela
enumera o que fica no navegador, item por item, e o tamanho da lente e o modo da
janelinha já estavam guardados sem constar ali — o editor seria o terceiro. Um
parágrafo nas cinco línguas fechou a lacuna, que era anterior a este build.

---

## ACHADO FECHADO — a evidência saía com o nosso editor por cima do cliente *(06/09)*

**Chegou por uma tela real**, no primeiro uso do Build 56: o passo seguinte saiu
com a janela de edição do Walkstamp desenhada por cima do sistema que estava
sendo documentado. Numa evidência de auditoria, isso não prova nada.

**A pausa funcionava. A ORDEM é que estava errada.** `fecharEdicaoAoVivo`
despausava e só depois fechava a janela — e `alternarPausa` faz uma captura
**forçada** no instante em que despausa (ela existe desde sempre, e por um bom
motivo: "depois de uma espera a tela mudou, e é esse estado que a pessoa
esperava documentar"). Essa foto saía com o editor na frente de tudo.

E **fechar não é sumir da tela**: entre o `close()` e o compositor do sistema
apagar a janela do monitor há alguns quadros, e a captura lê do monitor. Por
isso a correção é a ordem **mais** uma espera de 320ms — a janela sai, depois a
captura volta.

**Por que a régua do Build 56 não pegou:** ela contava quadros. Via "voltou a
guardar tela" e dava verde. O que ela não perguntava era **o que estava na
frente** quando o quadro entrou. Agora ela amostra as duas coisas juntas a cada
8ms e reprova qualquer quadro que tenha entrado com o editor vivo — e foi
conferida revertendo a ordem de propósito: reprova, dizendo *1 de 2 quadros*.

---

## ACHADO FECHADO — o botão de salvar do editor esticava por cima da barra *(06/09)*

Relatado como *"o botão de salvar e voltar ficou quebrado"*, com a tela junto.
O botão padrão da folha de estilo da janelinha é `width:100%` — ela foi escrita
para a janela **completa**, que empilha —, e o `edSalvar` nasceu herdando isso:
esticava por cima da barra inteira e saía pela direita.

É o **mesmo tropeço** que o `#anotar` deu na fita duas semanas atrás, e a lição
não tinha virado régua: nenhuma media larguras dentro do editor. Agora mede, e a
afirmação é sobre a **barra**, não sobre o salvar — um botão novo amanhã cai na
mesma linha sem ninguém lembrar de acrescentá-lo.

---

## DEC-16 (continuação) — escrever, e não só apontar *(entregue no Build 57)*

O pedido original dizia *"colocando marcações setas **e escrevendo** para não se
esquecerem"*, e o Build 56 entregou só a metade que desenha: a seta diz ONDE, e
não diz por quê. O editor ganhou o campo de texto.

**Os ids são os mesmos da fita de propósito.** `anotCampos()` procura o campo
por `getElementById('nota')` na janela do picture-in-picture — com os mesmos ids,
a caixa nova já é encontrada por pintar, guardar e espelhar sem uma linha a mais.
O texto mora no QUADRO; os campos são janelas para ele.

E **a marcação passou a queimar ao PARAR a gravação**. Durante, não queima de
propósito (é redesenhar 1920px enquanto a máquina captura). Mas a miniatura da
grade mostra `telaDe(f)` — sem queimar, quem apontou dez telas ao vivo voltava
para quarenta miniaturas idênticas. O recurso existe para não esquecer, e a
grade esquecia.

---

## ACHADO FECHADO — trocar o tamanho da janelinha estourava durante a gravação *(06/09)*

Desenterrado pela régua nova do Build 56, e **antigo**. `reabrirPip()` — o
caminho do botão de tamanho da janelinha, e do atalho `J` — chamava `agora()`,
que é um apelido criado **dentro** da função que grava e que daqui nunca
existiu. Quem apertasse o botão de tamanho no meio de uma gravação recebia um
`agora is not defined`, e a janelinha voltava dizendo *"preparando"* com o
relógio parado em 0:00.

O erro morria em silêncio porque acontecia **depois** de a janela já estar
montada: tudo parecia funcionar, só o estado não chegava. Nenhuma régua cobria o
gesto — `janelinha.mjs` mede o desenho da janelinha, não o que acontece quando
se troca de tamanho com a gravação correndo.

Consertado (`liveAgora()`, a mesma função no escopo de fora) e coberto pelo
bloco [9] de `testes/edicaoaovivo.mjs`, que agora exige o relógio **andando**
depois da troca — um `count()` de botão não teria pego isto.

---

## ACHADO FECHADO — a régua forjava numa lista que ainda crescia *(28/08)*

Encontrado pela esteira COMPLETA no Build 44 e **reproduzido duas vezes**,
sempre sob contenção, nunca sozinho. O sintoma parecia defeito de produto:

```
ok     há repetidas para a limpeza tirar  → Tira 2 telas (2 repetidas)
FALHA  e ela tirou mesmo                  → 3 depois, 3 antes
```

Uma linha prometendo tirar duas e um botão tirando zero.

**Era a premissa da régua.** O `resumo.mjs` esperava "pelo menos 3 quadros" e
mais **900 ms fixos**, e então o `forjarRepetidos()` escrevia assinaturas iguais
para fabricar repetidas — numa lista que **ainda estava crescendo**. Com a
máquina livre a extração já tinha acabado; com as três pistas do `rodar.sh`
disputando CPU, um quarto quadro chegava DEPOIS da forja, e o conjunto que o
`#dedup` olhava não era o conjunto forjado.

Uma espera por relógio é uma aposta na velocidade da máquina. Passou a esperar a
lista **parar de crescer** — quatro leituras iguais, 120 ms entre elas —, e se o
tempo acabar ela **diz que a premissa caiu** em vez de seguir medindo o acaso. É
o mesmo conserto que o `etapas.mjs` recebeu pelo mesmo motivo, e é por isso que
nenhum dos dois reproduzia sozinho.

---

## ACHADO — o corredor específico não alcança 62 das 171 réguas *(28/08)*

Medido no Build 48, e ninguém tinha olhado: das 171 réguas, **62 não aparecem
em linha nenhuma do mapa do `liberar.sh` nem na lista de contratos.** Não
importa o que o build toque — elas só rodam no `rodar.sh` completo.

Não é defeito do mapa: ele é escrito à mão de propósito, e boa parte das réguas
de produto entra pela linha do `src/template.html`. É um **limite**, e o que
faltava era ele estar escrito. "Esteira específica verde" quer dizer *verde no
que o mapa alcança* — e sem este número ninguém sabia quanto era.

Duas dessas 62 saíram neste build, e foram as que doeram:

- **`portal.mjs`** — a régua da área do cliente (assentos, convite, faturas,
  modelos) — não estava no mapa. Mexer no `app/conta/acoes.ts` saía verde sem
  ela rodar. Ligada ao `^app/conta/`.
- **as cartas** — `lib/carta.ts`, `lib/email.ts` e os dois módulos de e-mail
  agora chamam `email.mjs`, `convite.mjs` e `portal.mjs`.

O `inventario.mjs` ganhou o bloco [6] com o **teto de 62, que só desce**: uma
régua nova que ninguém ligar ao mapa reprova no dia em que nasce, em vez de
virar mais um nome nesta lista. Baixar o teto é o trabalho de quem for
mapeando o resto.

---

## ACHADO FECHADO — o conferidor de migrações aprovava por vazio *(28/08)*

`sh supabase/conferir.sh` dizia **"46 conferem, 0 faltam, 0 diferem"** e saía
verde — com **54 migrações no disco**. As oito de fora não estavam erradas:
estavam **invisíveis**, livres para mudar sem nada reclamar. Um portão que
aprova por vazio é pior que portão nenhum, porque ninguém desconfia do verde.

As oito entraram no `MANIFESTO.md5` (as sete antigas estão aplicadas no banco —
conferido na lista de migrações do Supabase) e o `conferir.sh` passou a comparar
**nos dois sentidos**: agora um arquivo no disco fora do manifesto reprova.
Provado por falha: tirando uma linha do manifesto, ele sai com 1.

---

## ACHADO FECHADO — a régua falava com um servidor que não era o dela *(28/08)*

Uma esteira interrompida deixou um `next start` velho segurando a **8807**. O
`roteiro.mjs` subiu o dele, o segundo morreu com `EADDRINUSE` **em silêncio**, e
o teste seguiu falando com o servidor ANTIGO — de outro build. Reprovou por um
defeito que não existia no código, e eu passei uma hora caçando um erro que não
tinha cometido.

**Reprovar errado é ruim; aprovar errado é pior.** Um servidor velho que
casualmente passe em tudo dá verde sobre código que ninguém rodou.

Medido: dos **16** arquivos de régua que sobem o Next, **dois** (`roteiro.mjs` e
`venda.mjs`) não liberavam a porta antes, e **nenhum** dos dezesseis percebia o
`EADDRINUSE`.

E a primeira tentativa de conserto **não bastou, e isso está medido**: ler o log
do `next` atrás de "EADDRINUSE" parece suficiente e não é — quem responde o
primeiro `fetch` é o servidor velho, na hora, e o laço de espera sai satisfeito
antes de o novo sequer ter reclamado. Com a leitura do log ligada, o teste
passou inteiro contra o servidor errado.

O que funciona é não perguntar a ninguém: **tentar ocupar a porta.** Se der, ela
estava livre. Está em `testes/_porta.mjs`, com o ramo de desistência provado por
falha (kill desligado + porta ocupada → `FALHA` e saída 1).

**O que sobra:** os outros catorze liberam a porta com `fuser -k`, o que fecha o
caso comum, mas nenhum PROVA que ela ficou livre. Adotar o `garantirPortaLivre`
neles é uma linha em cada um, e é trabalho de um build futuro.

---

## ACHADO FECHADO — o assento não limitava nada *(29/08)*

Abrir o cadastro de domínio obrigou a olhar o que ele destrava, e ali estava um
buraco que ninguém tinha medido: **a entrada por domínio não olhava assentos.**
O `plano_de` concedia o plano do cliente a QUALQUER e-mail daquele domínio, sem
contar quantos já estavam dentro. Quem comprasse 3 assentos podia dar o plano a
500 pessoas — e o número que o cartão Team vende era decoração.

Enquanto o cadastro passava por nós, era um risco que a gente via chegar.
Self-service, viraria o desenho do produto. Por isso as duas coisas andaram
juntas no Build 51: entregar a primeira sem a segunda seria transformar um
descuido em funcionalidade.

Atinge só a PRIMEIRA entrada de cada pessoa por domínio. Quem já tem assento
nominal sai pelo ramo `conta` e nem chega lá — inclusive quem entrou por domínio
antes, porque a `registrar_emissao` grava o `cliente_id` na primeira emissão.
Ninguém que já está dentro perde a renovação.

---

## ACHADO FECHADO — a régua exigia que o produto ficasse inacabado *(29/08)*

A `promessa.mjs` afirmava **"o catálogo usa mais de um estado"**. Fazia sentido
enquanto havia item com selo, e virou uma exigência de que houvesse um: quando o
`dominioAutomatico` saiu do `beta` e o catálogo ficou inteiro em produção, a
régua **reprovou o produto por estar pronto**.

Ela guardava algo real — se nenhum item usa selo, a maquinaria do selo vira
código morto e ninguém percebe quando quebra. Então a pergunta mudou: as três
palavras (`beta`, `construcao`, `descoberta`) têm que existir nos cinco idiomas,
**usadas ou não**. No dia em que um item voltar a precisar de selo — e vai —, a
palavra já está lá, e não sai em português numa página alemã.

---

## ACHADO FECHADO — 33 portas eram disputadas por mais de uma régua *(29/08)*

O `rodar.sh` roda várias ao mesmo tempo com `xargs -P`, que é uma **fila**:
qualquer duas podem cair juntas. Medido: **33 portas eram usadas por mais de uma
régua** — três arquivos na 8918, três na 8921, três na 8931, três na 8934, três
na 8937, três na 8951, três na 8953.

Duas réguas na mesma porta não dão erro barulhento. A segunda encontra a porta
ocupada e, daí em diante, ou fala com o servidor da PRIMEIRA — de outro teste,
com outro conteúdo — ou derruba o dela no meio. **Verde falso nos dois casos.**
O cabeçalho do próprio `rodar.sh` já carregava a cicatriz de uma execução medida
contra uma build velha.

41 arquivos renumerados, zero colisões, e o `inventario.mjs` ganhou o bloco [7]
que recalcula isso a cada rodada. A única exceção é declarada: a **8802**, que é
o Next que o `rodar.sh` sobe uma vez para todas as réguas de site.

**E as dezesseis que sobem o próprio Next** passaram a chamar
`garantirPortaLivre` — matar quem estava lá não é o mesmo que a porta ter ficado
livre. O bloco [8] cobra a CHAMADA, e não o `import`: a edição em massa que
acrescentou a garantia **pulou duas** (`email.mjs` e `faxina.mjs`, que sobem o
Next com outra forma), e elas ficaram com cara de prontas e sem a trava. Contar
o `import` seria repetir o erro.

**Sobra pequeno e vale dizer:** o `ficha.mjs` guardava a porta escrita à mão em
nove lugares, e num deles **codificada** — `localhost%3A8961`, dentro de um
regex, onde a troca não alcançou porque o `%3A` cola no número. A régua falhou
alto, que foi sorte: a afirmação casava `walkstamp` OU a porta, e podia ter
continuado verde pelo outro lado. Agora a porta tem nome e todo endereço sai
dele.

---

## ITEM VENCIDO — o `encolherFita()` com roteiro não era defeito *(29/08)*

Ele esteve na minha lista de pendências como *"a janelinha fica em 480 em toda
língua quando há roteiro"*. Medido: **é a decisão, e ela já estava escrita no
código** — o que faltava era ela ter virado número.

Com roteiro o passo ganha a linha inteira, e essa linha é **uma só**, cortada
com reticências. Cada pixel de largura é literalmente mais texto do passo antes
do "…". Encolher a fita para os 397px que os botões pedem em português cortaria
justamente o que a segunda linha existe para mostrar.

**Quanto custa, medido:** 480px mostram **49 caracteres** do passo; 397px
mostram **39**. Dez caracteres.

A `janelinha.mjs` passou a travar as duas metades do argumento — que a linha é
única e com reticências, e quanto texto os 480 compram. Se alguém quiser
"otimizar" a largura, o número diz o preço. E se ele virar zero, a decisão pode
ser revista com dado em vez de opinião.

---

# Parte 1 — As decisões

Uma por vez. Cada uma tem os caminhos, o que se ganha e o que se perde em cada
um, a minha indicação e — o que importa mais — **o que eu faço se você não
responder**.

---

### DEC-1 — Qual é a promessa oficial de residência de dados — **DECIDIDA 27/08: A no hospedado, B no offline**

> **O que foi decidido.** No produto hospedado vale o caminho A: *"nada do seu
> conteúdo sai sem um gesto seu"*, com a matriz de exceções nomeada no mesmo
> bloco. No artefato offline vale o caminho B, literal — e hoje ele **não
> cumpre**: referencia `cdn.jsdelivr.net` em onze lugares. Ou as bibliotecas
> entram no arquivo, ou as funções que dependem delas degradam sem rede e a
> página de download diz isso.
>
> **Por que A e não B no hospedado, nas palavras de quem decidiu:** *"na conta
> paga vou querer injetar informações para as features"*. Ou seja, a matriz de
> exceções não é só a lista de hoje — ela precisa nascer com espaço para o
> conteúdo que a conta paga vai mandar de propósito. O que **não** entra na
> matriz, e continua absoluto nas duas pontas: **vídeo e áudio não saem**.
>
> Vira trabalho: (a) escrever a frase uma vez só e fazer copy, termos e
> privacidade citarem ela; (b) uma régua que prove a matriz contra o que o
> produto realmente chama; (c) o item do offline cumprir B.


Tudo depende desta. Copy, teste, integração e termos se contradizem hoje porque
ninguém escreveu a frase verdadeira uma vez só.

**Caminho A — "nada do seu conteúdo sai sem um gesto seu", com a matriz de
exceções nomeada no mesmo bloco.**
As exceções seriam: Google Docs, anexo `.json` do roteiro, convite, conta,
cobrança, suporte, telemetria, download do modelo de voz, jsPDF e OCR.

- **Pró:** é verdade hoje, ou fica verdade só com correção de texto. Preserva
  todas as funções que já existem e já vendem. Numa avaliação de fornecedor,
  uma exceção nomeada vale mais que um absoluto que o F12 do navegador desmente
  em dez segundos.
- **Contra:** a frase fica mais longa. Perde-se o slogan curto. Exige disclosure
  progressivo para não virar parágrafo jurídico no meio da home.

**Caminho B — "zero egressão literal": nem dependência, nem telemetria, nem
destino voluntário.**

- **Pró:** slogan imbatível. Resposta única e curta no questionário de
  fornecedor.
- **Contra:** exige embutir Transformers, ONNX Runtime, Tesseract e jsPDF no
  artefato — de 1,7 MB para centenas de MB —, matar Google Docs e o anexo do
  roteiro, e **ainda assim** o modelo de voz precisa descer uma vez. É um
  produto diferente, não uma correção do atual.

> **DEC-1 FECHADA NO BUILD 37.** As duas metades entregues.
>
> **A do hospedado (caminho A), Build 37.** A frase existe uma vez por idioma —
> *"Nada do seu conteúdo sai sem um gesto seu"* — e a matriz de exceções é
> MONTADA do `src/egressao.json`, no mesmo bloco da frase. Antes disso a promessa
> estava em nove chaves do dicionário e numa dúzia de páginas, cada uma com a sua
> redação, e a tabela de conexões da página de segurança era escrita à mão em
> cinco idiomas, sem nada que a ligasse ao código.
> A régua `egressao.mjs` confere a matriz contra o produto: nada escondido (todo
> endereço do app tem linha), nada morto (toda linha existe no app), o que sai
> sozinho é exatamente o declarado — medido com o app servido e parado nove
> segundos —, e o que exige gesto não sai sem gesto. Provada por reprovação: um
> `fetch` para um destino não declarado a derruba.
>
> > **CUMPRIDO NO BUILD 36, a metade do offline.** O artefato de arquivo único
> deixou de ter endereço de rede dentro: nem jsDelivr, nem Hugging Face, nem
> Google, nem LinkedIn — medido, zero ocorrências, e o `build.py` PARA se um
> voltar. As duas escolhas que precisavam de rede (transcrever enquanto grava,
> ler o texto da imagem) sumiram da tela quando o protocolo é `file:`, com o
> aviso explicando nos cinco idiomas; as duas que funcionam sem rede ficaram.
> É o que a página de segurança já vendia desde antes.
>
> **Falta a metade do hospedado:** a frase única do caminho A, escrita uma vez
> só, com a matriz de exceções nomeada no mesmo bloco, e a régua que a prova
> contra o que o produto realmente chama.

> **Minha indicação: A para o produto hospedado; B só para o artefato offline.**
> O offline já é vendido como B — e hoje **não é**: medido, ele chama
> `cdn.jsdelivr.net` 1,7 s depois de abrir, sem gesto nenhum. Lá a escolha não é
> entre A e B; é entre cumprir B e parar de dizer B.
>
> **Se você não responder:** sigo A. É a única que não me obriga a remover
> função que já está vendida.

---

### DEC-2 — A calculadora de ROI da página de preços — **DECIDIDA 27/08: caminho A, 45 minutos**

> **O que foi decidido:** *"A estou usando no real, 45 minutos"*. A premissa
> deixou de ser chute: o campo "minutos de trabalho manual por caso" começa em
> **45**, que é o tempo medido em uso real para montar uma evidência à mão, e a
> página **diz de onde vem o número** nos cinco idiomas. Nasceu em 12 — um chute
> com cara de medição na frente de quem vai comprar.
>
> A régua `precos.mjs` ganhou o bloco `[8b]`: fixa o 45 e a frase de proveniência
> nos cinco idiomas. Provada por reprovação — com 44 em pt, ela reprova.
>
> Continua verdade o que a página já dizia: os quatro números são do usuário,
> não saem do navegador, e a conta não se compara com o nosso preço de propósito.


Ela é o argumento de tempo inteiro, em forma de widget — 30 das 75 ocorrências
de "tempo" na página.

**Caminho A — trocar a pergunta.** De "quantos minutos por caso" para "quanto
custa uma evidência recusada": quantos casos voltam por prova insuficiente ×
horas para refazer.
**Caminho B — manter, e só matar a comparação com o preço.**
**Caminho C — remover.**

- **Pró A:** o instrumento passa a medir o que o produto entrega — prova aceita
  —, e não minutos. **Contra A:** 1 dia, e o número fica menos imediato.
- **Pró B:** 2 h. **Contra B:** continua ensinando o leitor a avaliar o produto
  por minutos. Hoje, quem digita "2 minutos por caso" recebe da própria régua a
  informação de que o Personal não se paga.
- **Pró C:** risco zero. **Contra C:** a página fica sem instrumento nenhum.

> **Minha indicação: A.** É o item que decide o posicionamento inteiro, e B é
> paliativo que deixa o defeito de pé.
>
> **Se você não responder:** faço **B** no Build 8 — porque é reversível e
> impede o pior caso (a régua argumentando contra a compra) — e deixo A escrito
> e pronto para você aprovar.

---

### DEC-19 — O que a conta paga guarda no servidor — **DECIDIDA 27/08: caminho A, e entregue no Build 34**

> **Erro meu no número.** Apresentei esta decisão ao Leandro chamando-a de
> "DEC-3". A DEC-3 desta fila é o h1 da home, e continua aberta. A decisão que
> ele tomou é esta, e ela nasce aqui com número próprio para o registro parar de
> apontar para a coisa errada.
>
> **O que foi decidido:** *"Vamos de a"* — o servidor guarda o que a feature
> precisa, e a conta mostra o quê. É a consequência direta da DEC-1 em A, pela
> razão que ele deu lá: *"na conta paga vou querer injetar informações para as
> features"*.
>
> **Entregue no Build 34**, com o botão de apagar junto — que era a condição da
> minha indicação: uma tela que só lista é a promessa de antes com mais palavras.
>   - `walkstamp.prazos()` — os prazos de retenção passaram a existir uma vez só;
>     o expurgo lê de lá e a tela mostra de lá.
>   - `walkstamp.meus_dados(email)` — contagem, não conteúdo, do que existe.
>   - `walkstamp.apagar_meus_dados(email, confirmacao)` — apaga, exigindo que a
>     pessoa digite o próprio e-mail.
>   - `/conta/<idioma>/dados` nos cinco idiomas, com as DUAS tabelas: o que sai e
>     o que fica, com o motivo do que fica ao lado.
>   - `meusdados.mjs`, provada por reprovação no ponto que importa: com o e-mail
>     vindo do formulário em vez da sessão, ela reprova.
>
> **Fica devendo:** a política de privacidade ainda não menciona esta tela nem o
> direito de apagar, e ainda fala da lista de aviso em pt e es. É o próximo item.

---

### DEC-3 — O h1 da home

Hoje ele fala com quem executa, no imperativo. "Auditoria" aparece 2× na home e
nenhuma vez perto de um botão.

**Caminho A — trocar o h1** para falar com quem cobra a evidência.
**Caminho B — manter o h1 e trocar só o subtítulo.**

- **Pró A:** alinha a porta de entrada ao comprador. **Contra A:** é a mudança
  mais cara e mais arriscada da lista inteira. E o dado de sete dias diz que 91%
  do uso real é pt e que **71 documentos saíram** — com o h1 atual. Trocar sem
  placar é apostar.
- **Pró B:** metade do ganho por um oitavo do risco. **Contra B:** o h1 continua
  mirando o executor.

> **Minha indicação: B agora, A depois do Build 5.** O Build 5 é o que instala a
> ponte de intenção do clique de compra — é ele que dá o placar para comparar.
>
> **Se você não responder:** faço B. Não mexo no h1 sem você.

---

### DEC-4 — A degustação de 14 dias

Existe no banco, funciona, e **"14 dias" tem zero ocorrências** em `/`,
`/precos`, `/evidencia-de-teste`, `/seguranca` e `/comparativo`. A única menção
pública está em `/time`, que é órfã.

**Caminho A — anunciar** nos cartões e no FAQ de compra.
**Caminho B — manter só depois do login.**

- **Pró A:** é a melhor oferta do produto, sem cartão de crédito, e derruba a
  objeção de preço antes que ela vire objeção. **Contra A:** mais cadastro de
  baixa intenção e mais suporte.
- **Pró B:** funil mais limpo. **Contra B:** a objeção de preço não tem resposta
  na página onde ela nasce.

> **RESPONDIDA em 23/08 — caminho A.** "Anuncia os 14 dias."
> Feito no Build 3, nos cinco idiomas: no subtítulo dos dois cartões pagos
> ("Personal · 14 dias grátis antes, sem cartão") e como **primeira** pergunta
> do FAQ de compra. A régua nova tira o número do banco, e não de uma constante
> escrita no teste.

---

### DEC-5 — O vocabulário guardado entre visitas

Está no catálogo como pronta, e não existe: `vocLista` mora em `sessionStorage`
e morre com a aba. É o terceiro caso de promessa sem porta.

**Caminho A — implementar** (coluna `vocabulario jsonb` em `walkstamp.config` +
o campo no perfil, ~4 h).
**Caminho B — manter o selo "em construção".**
**Caminho C — tirar do catálogo.**

- **Pró A:** fecha o caso, e é a funcionalidade que os usuários de rodada longa
  mais pedem. **Contra A:** guardar vocabulário manda **termos do cliente**
  (nome de sistema, de produto, de projeto) ao servidor. Isso encosta na DEC-1.
- **Pró B:** honesto e grátis. **Contra B:** uma linha do catálogo continua
  vendendo o que não existe, porque a gêmea sem `id` escapa do `planos.mjs`.
- **Pró C:** limpa. **Contra C:** perde uma funcionalidade que dá para entregar
  em meio dia.

> **Minha indicação: A, com o guardar sendo opt-in explícito**, com o aviso no
> mesmo tom dos quatro parágrafos do aviso do Google Docs. Se a DEC-1 for pelo
> caminho B, então C — não há meio-termo.
>
> **Se você não responder:** faço a metade honesta agora (o `estado:
> "construcao"` na linha órfã, 5 minutos, entra no Build 1) e deixo A para o
> Build 6.

---

### DEC-6 — O convite de assento por e-mail

O assento é criado e **nenhum e-mail sai**. Alguém tem que avisar por fora.

**Caminho A — mandar e-mail de verdade** (~3 h; `lib/email.ts` já existe e já
serve dois outros caminhos).
**Caminho B — trocar a oferta por "gerar link/chave de convite".**

- **Pró A:** é exatamente o que está vendido no cartão Team. **Contra A:**
  entregabilidade, e abuso — que agora tem trava: a `walkstamp_convite_pode`
  passou a existir no banco hoje (5/hora por origem, 2/dia por destino).
- **Pró B:** 1 h, e funciona em rede fechada. **Contra B:** o administrador
  passa a ter trabalho manual que o cartão diz que ele não terá.

> **Minha indicação: A.** A infraestrutura existe, a trava existe, e o texto do
> convite é meia hora.
>
> **Se você não responder:** faço A no Build 6.

---

### DEC-7 — A página `/time`

Órfã: nenhuma página do site leva a ela. Está indexável. Publica dois números
que o código não pratica (diz 90 dias; o código emite 45).

**Caminho A — linkar de `/precos`.**
**Caminho B — redirecionar `/time` → `/precos`.**
**Caminho C — tirar do sitemap e deixar viva.**

- **Pró A:** aproveita o conteúdo. **Contra A:** passa a haver **duas** páginas
  vendendo Team — que é a definição do defeito que mais custou a este projeto.
- **Pró B:** uma lista só. **Contra B:** perde-se o texto da degustação, que
  precisa ser transportado antes (é a DEC-4).
- **Pró C:** zero trabalho. **Contra C:** a melhor oferta do produto continua
  numa página que ninguém acha.

> **Minha indicação: B**, executado *depois* da DEC-4 ter levado a degustação
> para `/precos`.
>
> **Se você não responder:** no Build 1 eu corrijo os números errados de `/time`
> (isso é frase falsa no ar, e sai independente da decisão) e deixo a rota como
> está até o Build 5.

---

### DEC-8 — O que o pacote offline é

**Caminho A — embutir tudo** (Transformers, ONNX, Tesseract, jsPDF) e cumprir
"nada nele fala com servidor nenhum".
**Caminho B — declarar** que o offline não tem transcrição, OCR nem Drive, e
fazer a trava de rede valer em **todas** as ações, não só na carga.

- **Pró A:** cumpre a frase publicada. **Contra A:** centenas de MB, e o modelo
  de voz continua precisando descer uma vez — ou seja, A **não fecha** a
  promessa, só a encarece.
- **Pró B:** vira verdade em ~1 dia. **Contra B:** enfraquece a oferta offline
  no papel. E os `steps.*` já dizem certo — é o `/precos` que promete demais.

> **Minha indicação: B, com folga.** A é um produto diferente.
>
> **Se você não responder:** no Build 1 eu já subo a régua da trava (900 ms →
> 3 s) e acrescento `jsdelivr` e `huggingface` à lista de proibidos do build —
> o que faz o build **reprovar** enquanto a promessa for falsa. A decisão de
> mudar o texto ou embutir a biblioteca continua sua.

---

### DEC-9 — Fatura e nota fiscal

`/precos` diz "faturas para baixar, e a nota fiscal quando sai". Nenhuma das
duas tem gravador: a `hosted_invoice_url` chega da Stripe e é descartada, e
`nf_url` só foi escrito por uma migração de cenário de teste.

**Caminho A — implementar o gravador da fatura** (coluna `url text` +
duas linhas no insert, ~3 h) e **tirar a frase da NFS-e**, trocando por
"a nota fiscal é emitida por fora e aparece aqui quando sai".
**Caminho B — tirar as duas frases** e mandar para o portal da Stripe.

- **Pró A:** atinge todo assinante, no pior momento — quando o financeiro pede a
  fatura. E o valor **já chega**: é coluna e duas linhas, não integração.
  **Contra A:** encosta na Stripe. (Só na leitura do webhook que já roda — não
  é reconectar nada, e não precisa da chave que você quer deixar para o fim.)
- **Pró B:** 10 minutos. **Contra B:** o cliente sai da conta para achar a
  fatura, em outra rota, com outro login.

> **Minha indicação: A para a fatura, B para a NFS-e.** Prometer emissão
> automática de NFS-e é falso; prometer que ela aparece quando sai é verdade.
>
> **Se você não responder:** faço a metade de texto agora (Build 1, é frase
> falsa) e a metade de código no Build 6.

---

### DEC-10 — Prova social

Zero depoimentos, zero nomes de cliente, zero logos, zero números de uso, zero
estudos de caso — no site inteiro.

**Caminho A — buscar dois ou três depoimentos.**
**Caminho B — tornar a verificabilidade a prova.** A frase já existe em
`seguranca.pt:150`; falta promovê-la.

- **Pró A:** é o que funciona. **Contra A:** depende de cliente que autorize o
  nome, e não há prazo para isso.
- **Pró B:** é honesto, é hoje, e é coerente com o resto do posicionamento.
  **Contra B:** não substitui prova social de verdade para um comprador que
  compara fornecedores.

> **Minha indicação: B agora, A quando existir cliente que autorize.**
> Depoimento inventado está fora de discussão.
>
> **Se você não responder:** faço B no Build 8.

---

### DEC-11 — Reembolso e garantia — **DECIDIDA 27/08: caminho B, sem reembolso**

> **O que foi decidido:** *"o reembolso na B não existe"*. A cláusula 14 dos
> termos, nos cinco idiomas, passou a dizer: cobrança anual pela Stripe, preço
> o da página no momento da contratação, renovação automática, **14 dias com
> tudo sem cartão** antes de qualquer cobrança, cancelamento na própria conta,
> acesso até o fim do período pago e **sem devolução proporcional** — ressalvado
> o que a legislação consumerista garante a pessoa física, inclusive o art. 49
> do CDC, porque a cláusula 15 elege a lei brasileira. A régua `legal.mjs`
> exige as quatro frases nos cinco idiomas e proíbe as duas antigas.


Zero ocorrências no site. O que existe responde ao *cancelamento*, não ao
*arrependimento*.

**Caminho A — 30 dias sem pergunta.**
**Caminho B — declarar que não há reembolso**, e que o cancelamento vale até o
fim do período pago.

- **Pró A:** derruba a última objeção. **Contra A:** custo real, e num produto
  anual o arrependimento chega meses depois.
- **Pró B:** honesto e barato. **Contra B:** perde-se um argumento de fechamento.

> **Minha indicação: B.** Anual **mais** degustação de 14 dias já cobre o
> arrependimento — o que falta é dizer isso numa linha.
>
> **Se você não responder:** faço B no Build 8.

---

### DEC-12 — Content-Security-Policy

Zero ocorrências de `Content-Security-Policy` no repositório.

**Caminho A — CSP em Report-Only por uma semana, ler os relatórios, então travar.**
**Caminho B — só os cabeçalhos baratos agora** (X-Frame-Options, HSTS,
Permissions-Policy) e adiar a CSP.

- **Pró A:** transforma "nada sai daqui" numa regra que o navegador executa —
  numa avaliação de fornecedor, "o que impede?" passa a ter resposta que não é
  "nós". **Contra A:** 2 dias, e uma CSP apertada demais desliga a transcrição,
  que é o produto.
- **Pró B:** 1 h, risco zero. **Contra B:** não responde à pergunta do
  questionário.

> **Minha indicação: B no Build 1, A no Build 9.** Nesta ordem, e não em outra.
>
> **Se você não responder:** faço B. Não ligo CSP sem você.

---

### DEC-13 — Entrar na conta

Só link mágico, sem alternativa. A compra atravessa um aplicativo externo no
meio do funil, e clientes de e-mail corporativo que **pré-visualizam** gastam o
token antes de a pessoa clicar.

**Caminho A — código de 6 dígitos** como alternativa (o Supabase já oferece OTP
numérico).
**Caminho B — manter só o link.**

- **Pró A:** tira um clique e uma troca de aplicativo do meio do funil, e
  resolve a falha do pré-visualizador — que é falha de **compra**, não de
  conveniência. **Contra A:** 2 dias, e mexe no caminho mais sensível do produto.
- **Pró B:** zero risco hoje. **Contra B:** o defeito do token gasto continua, e
  ele é silencioso.

> **Minha indicação: A, no Build 5.**
>
> **Se você não responder:** não faço. É o único item desta lista onde o padrão
> é "não mexer" — é o caminho por onde todo mundo entra.

---

### DEC-16 — A lista de aviso do plano pago ainda existe? — **RESOLVIDA 27/08**

> Não existe. O campo saiu do produto, e nada mais escreve na tabela
> `walkstamp.interesse` — medido: nenhuma rota da aplicação a chama. Sobraram 3
> endereços do tempo em que ela existiu, cobertos pelo prazo de
> {{prazoLista}} = 24 meses.
>
> **O que faltava era a política dizer isso**, e ela dizia o contrário: chamava
> o campo de "o único dado pessoal que existe aqui" — falso duas vezes, porque o
> campo já não existia e porque a conta paga já gravava roteiro, caso e anexo.
> Corrigido no Build 35, nos cinco idiomas, com `legal.mjs` proibindo a frase
> antiga e exigindo a nova.

---

### DEC-16 (registro original) — A lista de aviso do plano pago ainda existe?

*Nasceu durante o Build 1: eu fui aplicar a migração do idioma e descobri que o
formulário não existe em página nenhuma.*

O estado medido hoje, e ele é estranho nos três lados:

- **O formulário não existe.** `#listaForm` está em `src/site/support.js` e em
  **nenhum corpo de página**. São ~75 linhas de JavaScript morto servidas em
  toda página do site.
- **A régua ainda o exige.** `medicao.mjs [M4]` afirma "o formulário existe" e
  reprova — é uma das falhas da regressão hoje.
- **O painel ainda o mostra.** `interesse` continua sendo uma das cinco abas do
  back-office, e a tabela tem 3 linhas. É um funil que ninguém pode mais
  alimentar.

E o motivo de ele ter sumido é defensável: a lista era "avise-me quando o plano
pago sair", **e ele saiu**. A pergunta agora é outra.

**Caminho A — recolocar o formulário**, com a pergunta atualizada: não mais
"avise quando sair", e sim "quero falar sobre o Team" ou "me avise sobre a
versão offline".

- **Pró:** a `/precos` volta a ter uma porta para quem não está pronto para
  comprar hoje — e hoje ela não tem nenhuma, além do checkout. A aba do painel
  volta a fazer sentido. E o banco já está pronto: a migração de hoje fez
  `interesse` aceitar os cinco idiomas.
- **Contra:** é uma caixa de e-mail a mais para alguém responder, e sem
  responsável ela vira o pior tipo de formulário — o que recebe e não devolve.

**Caminho B — apagar o resto**: as ~75 linhas mortas do `support.js`, a aba
`interesse` do painel, e reescrever o `[M4]` do `medicao.mjs` no inverso — como
o `paginas.mjs` já faz com o Pix, cobrando que nenhuma página volte a pedir.

- **Pró:** honesto, e o script cai de 25 KB em toda página do site. Uma régua
  que cobra a ausência é melhor que uma régua apagada.
- **Contra:** perde-se a única captura de lead que não é o checkout.

> **RESPONDIDA em 23/08 — caminho B.** "Tira a captura, deixa somente o plano."
> Feito no Build 3: as 76 linhas mortas saíram do `support.js` (25,1 → 22,5 KB
> em toda página), e `medicao.mjs [M4]` virou do avesso — passou a cobrar que o
> formulário **não volte**.
>
> **O painel continua de pé**, com as três linhas que já entraram: tirar a
> captura não é apagar quem se cadastrou. Se quiser a aba fora também, é uma
> linha — mas não farei sem você pedir.

---

### DEC-18 — Na tabela de preços, o que o Free não tem sai em VERMELHO

*Nasceu durante o Build 4-A, dentro de uma regra morta que eu ia apagar.*

A comparação curta da `/precos` marca com **✕ vermelho** (`var(--err)`, 17px,
negrito) cada linha que um plano não tem. São **seis células** na tabela de
hoje, e elas descrevem o **nosso próprio** plano Free e o Personal — não um
concorrente.

**Não fui eu que achei isso: foi o autor da folha.** A regra que eu apaguei
neste build, `table.cmpPlanos`, existia justamente para consertar isso, e trazia
o argumento escrito:

> *"o travessão do 'não tem' em cinza em vez de vermelho. Vermelho ali leria
> como defeito, e o que a célula diz é 'isto é do plano de cima'."*

A regra nunca pegou: ela foi escrita com o nome `cmpPlanos` e o `build.py` emite
a tabela como `cmpCurta`. Ficou meses ali, certa e desligada — a mesma fóssil do
`passosRodada`. Apaguei o código morto e trouxe o argumento para cá, que é onde
decisão mora.

**Isto não é conserto, é decisão comercial, e por isso eu não a tomei.** A
`/steps` também usa ✕ vermelho, e lá está certo: ela compara com o **Steps
Recorder**, um concorrente. Na `/precos` o mesmo símbolo aponta para dentro de
casa.

**Caminho A — cinza, sem símbolo, como o autor queria.**

- **Pró:** a tabela passa a dizer "isto é do plano de cima", que é o que ela é.
  Vermelho numa linha de preço convida a pessoa a ler o Free como uma versão
  quebrada, e o Free é a porta de entrada inteira deste produto.
- **Contra:** o contraste cai, e quem lê rápido pode não notar a diferença entre
  os planos — que é exatamente o que a tabela veio mostrar. Vender exige que a
  falta seja visível.

**Caminho B — cinza, mas mantendo o símbolo `✕`.** Meio-termo: a falta continua
legível de longe, sem a cor de erro.

- **Pró:** mantém a varredura visual e tira a leitura de defeito.
- **Contra:** um ✕ cinza ainda é um ✕; parte da objeção do autor era o símbolo.

**Caminho C — deixar vermelho.**

- **Pró:** zero trabalho, e o contraste máximo entre planos.
- **Contra:** o único argumento escrito no repositório sobre esta decisão diz
  que está errado, e ninguém o contestou — ele só nunca chegou à tela.

> **RESPONDIDA em 24/08 — caminho B.** O ✕ ficou, a cor saiu: as seis células
> passaram de `var(--err)` para `var(--muted)`. A `/steps` continua vermelha, e
> lá está certo — ela compara com um concorrente. Feito no Build 6.

---

### DEC-17 — O vocabulário do domínio — **RESPONDIDA e feita em 24/08**

*Caminho A: os cinco idiomas, com a lacuna escrita.* Relatório em `BUILD-7.md`.

**A decisão estava incompleta, e a medição corrigiu:** não eram dois idiomas
faltando, eram **três**. O inglês também não lia número a partir de cem — nove
chaves da tabela guardavam espaço dentro, num mapa consultado com uma palavra
só, e nenhuma delas podia casar. Um idioma que a página vende.

Cada língua ganhou como ela DIZ um número, e a tabela passou a ser gerada de 0 a
999. **8.329 formas provadas**, nos cinco idiomas, rodando o código do produto e
não uma cópia dele. As letras entraram junto — número resolvido sem letra não
acha `ME21N`.

> **A lacuna, que você aceitou deixar escrita:** para `de` e `fr` não houve teste
> com voz real. As grafias são as corretas; o que falta é saber como o Whisper
> as escreve errado, que é para isso que existe o `APELIDOS`. Quando alguém falar
> num microfone nesses idiomas, a lista cresce. Está dito no código, na régua e
> no relatório.

---

### DEC-14 — A Stripe (por sua instrução: último, ou sob demanda)

Nada de 1 a 9 exige tocar na conexão. O que fica represado, e que você deve
saber:

- **`npm run stripe:conferir` nunca rodou.** Sem confirmação de que o preço do
  Team é `per unit`. Se estiver em `tiered` ou `volume`, **comprar 12 assentos
  cobra por 1**. É o item de maior valor represado — e são 15 minutos com uma
  chave de teste.
- Cancelamento, acesso até o fim do período, renovação e ajuste proporcional de
  assentos: sem prova em sandbox.

> **RESPONDIDA em 23/08 — fica para o fim.** "Stripe no fim."
> Não entra em build nenhum até você pedir. O que continua represado, e continua
> sendo o que eu antecipararia se você mudasse de ideia: **se o preço do Team
> estiver em `tiered` ou `volume`, comprar 12 assentos cobra por 1.**

---

### DEC-15 — O Google Drive (por sua instrução: último)

Reconexão fica para o fim. Enquanto isso, o Drive continua listado como origem
de vídeo e **não** funciona no pacote offline — o que a DEC-8 já cobre no texto.

> **Se você não responder:** nada. Não entra em build nenhum.

---

# Parte 2 — A fila de builds

Cada build sai com **zip completo, régua verde e um ganho perceptível**. Nenhum
depende do seguinte para ser entregue.

| # | Build | Dias | O que muda para quem usa |
|---|---|---:|---|
| **1** | O chão | **1,5** | nenhuma frase falsa no ar, o convite volta a funcionar, e a régua roda em qualquer máquina |
| **2** | Não perder trabalho | **feito** | ninguém mais perde meia hora de anotação por um clique |
| **3** | A esteira honesta | **feito** | vermelho volta a querer dizer vermelho — e verde, verde |
| 4 | Listas paralelas | 2,5–3 | o que o catálogo diz e o que a tela mostra param de divergir |
| 5 | O caminho até a compra | 3–4 | quem clica "assinar" chega ao checkout com o plano escolhido |
| 6 | O que já está vendido | 4–5 | fatura, convite, licença que renova e vocabulário guardado |
| 7 | Termos e jurídico | 2–3 | o dossiê de fornecedor deixa de travar |
| 8 | Copy e posicionamento | 3–4 | a página fala com quem assina |
| 9 | Segurança de servidor | 3–4 | zip bomb, consulta de chamado, CSP |
| 10 | UX — as três etapas | 8–12 | o redesenho, com acessibilidade validada |
| 11 | Motor e medição | 6–9 | menos download, menos árvore de fallback, e números medidos |
| 12 | Dívida | 16–24 | as próximas mudanças ficam baratas |
| — | **Stripe** | 0,5 | **sob demanda** (DEC-14) |
| — | **Drive** | ? | **por último** (DEC-15) |

**Se for para parar em algum lugar, pare depois do Build 5.** São ~13 dias, e no
fim disso não há frase falsa no ar, ninguém perde trabalho, a régua é confiável,
o catálogo é único e a compra tem caminho. Tudo o que vem depois é melhoria, não
conserto.

---

## Build 1 — O chão *(este build)*

**Por que primeiro:** é 100% impedimento ou 100% barato. Nenhum item aqui custa
mais de 2 h, nenhum depende de decisão sua, e três deles destravam todo o resto.

**Banco de produção** — aplicado hoje, direto no Supabase:

| | |
|---|---|
| `interesse_aceita_os_cinco_idiomas` | a lista de aviso recusava alemão e francês dizendo "esse endereço não parece um e-mail" |
| `convite_envio_sai_do_markdown_e_vira_migracao` | a função que o `/api/convite` chama **não existia no banco** — o convite falhava fechado desde sempre |

**Impedimento de esteira:**

- `_medir.mjs`, `_pdf.mjs` e `_pip.mjs` deixam de carregar `/root/walkstamp`
- `amostras.py` passa a funcionar com `ffmpeg` sem o demuxer `image2`
- `rodar.sh` sai **diferente de zero** quando algo falha, e passa a chamar
  `terceiros.mjs` e `precos.mjs`, que existiam e não eram chamados

**Vazamento e segurança, os baratos:**

- `sw.js` para de guardar `/conta` e `/api/` no `CacheStorage` — hoje o e-mail
  do cliente e a linha da fatura sobrevivem ao logout numa máquina compartilhada
- `/api/convite` para de aceitar **qualquer** `*.vercel.app` como origem
- o `middleware` passa a casar `/conta` nos cinco idiomas, não só em português
- `build.py` confere a trava do offline **antes** de escrever o arquivo, e não
  depois de já ter sobrescrito a versão boa
- cabeçalhos de resposta baratos (DEC-12 caminho B)

**Frases falsas no ar** (todas nos cinco idiomas):

- "mínimo de cinco" → "a partir de 3 pessoas" — e o `min={5}` do checkout vira
  `min={3}`, que é o que o servidor já aceita
- `/time`: "vale 90 dias" → 45 dias
- ajuda: "de 77 MB a cerca de 400 MB" → "de 77 MB (processador) a 1,6 GB (com placa)"
- `/seguranca`: "a biblioteca de PDF é servida do nosso próprio domínio" — ela
  vem do jsDelivr; é o **offline** que a embute
- comparativo: "Gratuito" → "Gratuito; planos pagos a partir de R$ 149/ano"

**A régua:**

- o `undefined` que o resumo do Jira cola no chamado, e uma régua nova que
  proíbe `undefined`, `null` e `[object Object]` em todo texto que o produto
  entrega
- `medicao.mjs`: 900 ms → 3 s, e `jsdelivr`/`huggingface` na trava do offline
- `seo.mjs`: "ZERO consultas ao banco" aceitava até duas
- `estado: "construcao"` na linha órfã do vocabulário

**A pista de liberação** (`testes/liberar.sh`) — pedida no meio desta rodada, e
entregue nela. 1 min 8 s no lugar de 70.

**Fica de fora deste build, de propósito:** tudo que precisa de decisão sua,
tudo que mexe em hierarquia de página, e tudo que toca Stripe ou Drive.

**O que este build fez nascer:** a **DEC-16**. Fui aplicar a migração do idioma
da lista de aviso e descobri que o formulário não existe em página nenhuma — e
que a régua ainda o exigia, o painel ainda mostra a aba, e ~75 linhas de
JavaScript morto viajam em toda página. As duas saídas são legítimas e a
escolha é comercial, então eu não escolhi: o bloco da régua passou a **pular,
alto, com o nome da decisão**, em vez de reprovar por algo que ninguém decidiu.

---

## Build 2 — Não perder trabalho *(3–4 d)*

Quem perde 40 minutos de anotação não reclama: some. É a categoria mais cara em
confiança, e nenhum item dela depende de decisão.

- Extrair frames de novo apaga todas as anotações, sem confirmar e sem desfazer
- Reabrir o próprio `.zip` escreve a **hora do relógio** na anotação de todo
  quadro sem anotação — e a anotação é o título do passo no documento
- O aviso de saída só existe enquanto algo está *rodando*, nunca quando há
  trabalho *feito*
- O capítulo/tarefa não é gravado no `.json` e não volta
- Anotação de 600 caracteres é cortada para 180 só por ser tocada na revisão
- Trocar o idioma da interface reescreve, em silêncio, o idioma da transcrição
- Trocar de cenário apaga campos preenchidos
- `.json` de versão desconhecida abre calado; quadro sem imagem some com a
  contagem mentindo
- Anotação com quebra de linha quebra o índice do zip
- CSV sai sem guarda de fórmula

---

## Build 3 — A esteira honesta *(2–3 d)*

Feito o Build 1, a esteira roda e sai vermelha quando é para sair. Este build
faz o vermelho ser **verdadeiro**.

- As cinco réguas que a rodada de preços deixou para trás: `cenarios`,
  `timepag`, `medicao`, `tourvid`, `semmarca`
- Três testes de licença **pulam por arquivo ausente e imprimem "ok"** — passam
  a ter o terceiro estado (ok / FALHOU / PULADO) com contagem no rodapé
- O seletor `#licTag` morreu no produto e ainda é alvo de quatro testes
- `compartilhar.mjs` fica verde com o nome do documento dentro do e-mail
- Quatro testes só reprovam por *crash*, nunca por resultado errado
- A pista rápida é intermitente: espera por relógio vira espera por condição
- Testes que cobrem três idiomas num site que fala cinco
- Contagens escritas à mão onde o número tem fonte
- `LEIA-ME.md` conta 135 arquivos; há 147 no disco e 136 no `rodar.sh`

---

## Build 4 — Listas paralelas — **feito**

O defeito que mais custou a este projeto. Relatório em `BUILD-4.md`.

- ✅ A tira de formatos: era escrita à mão em seis cópias com 13 selos ao lado
  de um catálogo de 15. Agora `lib/site.ts` a gera de `src/features.json` — 15
  selos nos cinco idiomas, 4 na frente e 11 na gaveta na home
- ✅ Mapa de locale de data com 3 idiomas numa ferramenta de 5
- ✅ `TEAM_MINIMO`: o `build.py` repetia o `3` embaixo de um comentário dizendo
  que ele mora em `lib/stripe.ts`. Passa a **ler** de lá, e para o build se
  não achar
- ✅ `NUM` derivado de `PRECO` — a segunda tabela de preço saiu
- ✅ Quatro tabelas `LOCALE` idênticas; a quinta variante ganhou nome
  (`LOCALE_STRIPE`) e o motivo escrito de continuar diferente
- ✅ `CAMINHO` sai do `rotas.json`
- ✅ `hreflang` fóssil de três idiomas: o `<head>` inteiro de `home.html` e
  `doc.html` era fóssil — nunca foi servido. Apagado
- ✅ `AUDITORIA-PENDENTE.md` passa a ser **gerado**, e os 21 comentários que o
  duplicavam saíram
- ✅ **Três achados novos, da régua nova** (`tabelas.mjs`, que varre o produto
  atrás de tabela de idioma incompleta): `OCR_LANG` lia a tela do cliente alemão
  com o modelo **inglês**; `HESITA` limpava transcrição alemã com as regras do
  **português**; e o vocabulário do domínio não fala de/fr — este virou a
  **DEC-17**
- ✅ **CSS** — virou o **Build 4-A**, sozinho, como você decidiu. Fora da
  numeração de propósito: ele nasceu de dentro do Build 4, e numerá-lo como 5
  empurraria os outros dez e quebraria as referências das decisões. Os dois
  números do item estavam errados: eram **quatro** classes usadas sem regra
  (não cinco) e **seis** regras mortas (não cinco). Relatório em `BUILD-4A.md`
- ⤳ **Vocabulário de cenários** (`tutorial`/`instrucao`, `usabilidade`/`ux`):
  mexe em dado guardado, foi para o Build 12

---

## ~~Aberto pelo Build 5~~ — pago em 24/08

O fluxo de entrada perdeu a régua quando a `/time` foi aposentada: seis
afirmações sobre e-mail, link mágico e chave ficaram sem cobertura.

**`testes/entrada2.mjs` devolveu as seis**, contra o servidor de verdade — com
um Supabase falso do lado do servidor, que era o que faltava. E o mecanismo já
existia: `WALKSTAMP_SUPA_TESTE` aponta o cliente de sessão para um endereço
local, e o `portal.mjs` já usava isso. A dívida era de trabalho, não de desenho.

De quebra, ela cobra a intenção de compra atravessando o meio do caminho — o
`compra.mjs` media as pontas.

---

## Princípio — acabamento novo vai para recurso pago

*Dado por você em 23/08, respondendo ao Build 4-A.*

**"Acabamento tem que ficar em feature paga somente."** Vale para o **produto**:
polimento novo dentro da ferramenta entra em recurso do Personal ou do Team, e
não em recurso gratuito. O que já existe no Free continua funcionando; o que não
cresce é o acabamento dele.

**Não vale para o site.** Página de venda bem-acabada é o que vende o plano
pago — deixar as páginas de caso de uso feias para "não dar acabamento de graça"
cobraria o preço do lado errado, e dez páginas do mesmo site com dois
acabamentos diferentes leem-se como descuido, não como estratégia. Foi essa a
leitura que você confirmou quando eu perguntei.

Aplico dos próximos builds em diante, e é isto que eu vou consultar quando um
item da fila propuser polimento em recurso gratuito.

---

## Build 5 — O caminho até a compra — **feito**

Relatório em `BUILD-5.md`. Quatro dos sete itens da fila estavam errados; os
números certos estão lá.

- ✅ **A intenção de compra sobrevive ao caminho.** Ela morria em três pontos —
  o cartão a levava num atributo de análise, o link do e-mail carregava só o
  idioma, e a conta não a lia. As três pontes existem, e a chegada diz o que a
  pessoa veio fazer
- ✅ **`planoCodigo`**: a vitrine chama de `team`, a Stripe de `time`, e a
  tradução virou um campo conferido contra `lib/stripe.ts` no build
- ✅ **Quatro voltas apontavam para produção**, inclusive o link do e-mail: numa
  prévia, quem testava a compra testava a de outro site
- ✅ **A base de conhecimento** nasce aberta — eram 93% do texto fora do Ctrl+F
- ✅ **`/precos` ↔ `/seguranca` ↔ `/verificar`**: os becos ganharam saída
- ✅ **`/time` aposentada** *(DEC-7, caminho B)*. A mecânica da licença foi para
  a `/seguranca`; os cinco endereços velhos devolvem 308 para a de preços
- ⤳ **DEC-13** (código de 6 dígitos): fora deste build, por decisão sua
- ⚠️ **O fluxo de entrada perdeu a régua** — item aberto acima

---

## Build 6 — O que já está vendido — **feito**

Relatório em `BUILD-6.md`. Dois dos seis itens já estavam feitos ou meio feitos.

- ✅ **O modelo "só para mim" é de quem salvou.** Eram duas metades: um membro
  não conseguia salvar o próprio, e o que fosse salvo aparecia para os colegas.
  A função que alimenta a ferramenta trazia um comentário descrevendo o filtro
  que não existia
- ✅ **A chave avisa antes de vencer**, com o link da conta, e se renova sozinha
  quando há sessão. O limite está escrito no relatório e no `lib/stripe.ts` —
  renovar sem sessão exigiria credencial de longa duração ou cron
- ✅ **O endereço da fatura da Stripe** deixou de ser descartado: a função
  recebia `p_url` e nunca o usava. Coluna própria, separada da nota fiscal
- ✅ **DEC-18**: o ✕ do que o Free não tem deixou de ser vermelho
- ✅ Já estavam feitos: o convite por e-mail *(DEC-6)* e a metade "dizer" do
  bloqueio de assento
- ⤳ **O vocabulário guardado** *(DEC-5 / DEC-17)*: build próprio
- ⤳ **Bloqueio imediato de assento**: hoje vale na próxima emissão, e isso está
  dito na tela. Torná-lo imediato custa a operação offline — decisão sua

---

## Build 7 — Termos e jurídico *(2–3 d)*

O item que trava a aprovação no dossiê de fornecedor.

- Os Termos dizem que **não há nada à venda** e que o único dado pessoal é o
  e-mail da lista de aviso — e um teste **exige** essa frase
- As cinco políticas de privacidade no mesmo papel controlador/operador
- Segurança da informação, incidentes e pedidos de autoridade nas quatro
  traduções
- O DPA linkado das cinco páginas de segurança e das cinco de privacidade — os
  PDFs em de/en/es/fr **já estão no disco**
- O DPA afirma que sua lista é a mesma da política, e a diferença é deliberada
- Reembolso declarado *(DEC-11)*

---

## Build 8 — Copy e posicionamento *(3–4 d)*

- A calculadora de ROI *(DEC-2)*
- O subtítulo da home *(DEC-3 caminho B)*
- "Três coisas que economizam a tarde" em 25 arquivos, e em dois deles o corpo
  não fala de tempo
- Firefox e Safari gravam a tela **sem** o áudio do sistema, e a home dá a razão
  errada — é a única limitação que produz artefato silenciosamente errado
- OCR e tarja automática exigem CDN público e um clique; `casoEv` promete automático
- "Não usamos cookies" — a própria política declara um cookie de sessão quatro
  seções depois
- Prova social *(DEC-10)*
- "o que a auditoria pede" numa célula marcada como "sim"
- A ajuda diz que o roteiro é "numa conta de time" — é do Personal
- YouTube por link, teto de 300 quadros, offline sem transcrição, ISO/SOC-2
- Sem ISO 27001 e sem SOC 2: dito de forma impecável, e no lugar errado

---

## Build 9 — Segurança de servidor *(3–4 d)*

**MEDIDO EM 29/08 E 02/09 — cinco dos sete estavam vencidos ou foram fechados.**

- ~~**Zip bomb** no leitor de `.xlsx`~~ — **vencido.** Tem teto desde então:
  `maxOutputLength` por entrada, 24 MB por entrada, 64 MB no total e 512
  entradas.
- ~~Consulta de chamado sem login, número de 4 dígitos, sem limite~~ —
  **meio vencido, e o resto fechado no Build 54.** Hoje exige número **e**
  e-mail. O que sobrava era pior do que a fila dizia: o limitador estava keyed
  na **vítima**, então quem soubesse o seu endereço te trancava fora do seu
  próprio chamado. Agora ele **só gasta quando erra**.
- ~~O limite de abertura de chamado é global~~ — **fechado no Build 54.** O
  limite saiu do banco (que não sabe quem chamou) e foi para `/api/chamado`,
  que tem IP. O navegador perdeu a porta.
- ~~`CRON_SECRET` reaproveitado como sal do convite~~ — **vencido**, o
  `CONVITE_SAL` ganhou sal próprio em 24/08.
- ~~O `app/api/faxina/route.ts` nunca foi auditado~~ — **auditado em 02/09, e
  está saudável.** Exige `CRON_SECRET`, recusa com 503 quando ele falta, tem
  modo seco. E, mais importante que a tranca: ela **está rodando** — 16
  execuções reais no banco, a última hoje às 04:17 UTC, com a fila do balde
  vazia. Os prazos que a política promete estão sendo cumpridos.

**O QUE CONTINUA ABERTO, e é o que sobrou deste bloco:**

- **CSP travando** *(DEC-12 caminho A, segunda metade)*. Ela está em
  `Report-Only` desde 24/08, com a régua `csp.mjs` medindo violações. Travar tem
  um risco medido e escrito no `next.config.mjs`: **o caminho da transcrição não
  é mensurável daqui** — o modelo vem de CDN, e a CDN não é alcançável da
  máquina onde a régua roda. Travar sem medir esse caminho é arriscar desligar
  a transcrição, que é o produto.
- O link do roteiro leva caso, sistema e chamado na query string — e agora
  também a pré-condição e o resultado esperado *(Build 50)*. Endereço vai para
  histórico, referrer e log de servidor.

---

## Build 10 — UX, as três etapas *(8–12 d)*

O reflow: `Entrada → Conferir → Baixar`. Vem depois de tudo que entrega valor
sem mexer na página, porque é aqui que **69 réguas de visibilidade** cobram.

Inclui, do que já estava listado: rolagem horizontal em 18 combinações de
página/idioma a 380 px (o culpado é sempre `table.legal`), `<main>` e link de
pular conteúdo em 85 páginas, estado honesto de recurso por navegador antes de
ativar webcam/clipe/WebGPU/OCR, busca na Ajuda, e a acessibilidade da
**ferramenta**, que nunca foi medida.

---

## Build 11 — Motor e medição *(6–9 d)*

- `performance.mark()` em cada fronteira, com amostras versionadas de 1, 10 e
  40 min, cold e warm cache, CPU 1/4 threads e GPU
- Classificar o erro do `buildPipe()` e saltar direto para o fallback pertinente
  — hoje algumas falhas custam 73–200 MB extras
- Fixar todas as versões, com manifesto testado de biblioteca ↔ runtime ↔ modelo
- Avisar antes de um fallback caro
- A pergunta aberta: inglês abre 48 vezes e converte zero. Funil quebrado ou
  robôs? Meia hora de consulta responde — **e agora responde de verdade**, porque
  o `check` de idioma parou de descartar `de` e `fr`

---

## Build 12 — A dívida *(16–24 d)*

Nada aqui o usuário vê. Tudo aqui decide o custo dos próximos anos: máquina de
estados do motor ASR, modularização da fonte, memória do `decodeTo16k()`,
qualidade da compactação de silêncio, e o campo `porta` no catálogo com a régua
que o cobra — a única mudança da lista inteira que **impede** um quarto caso de
promessa sem porta em vez de consertar o terceiro.

---

# Parte 3 — O que não entra em build nenhum

- **Stripe** — sob demanda *(DEC-14)*. O `stripe:conferir` é a única coisa que
  eu recomendo antecipar, e são 15 minutos.
- **Google Drive** — por último *(DEC-15)*.
- **Leitor de tela de verdade** (NVDA, VoiceOver) — depende de máquina física.
- ~~**Três Edge Functions que o produto chama e não existem no repositório**~~
  — **resolvido no Build 46**. As quatro estão em `supabase/functions/`, com
  `MANIFESTO.sha256` e a régua `testes/edge.mjs`. **O que sobrou do
  impedimento:** nenhuma régua compara o disco com o ar, de propósito (régua que
  só roda com rede é régua que não roda), então a comparação continua sendo um
  passo manual documentado no `LEIA-ME.md` daquele diretório — que é onde mora a
  divergência declarada do `walkstamp-stripe`, cujo passo 1 é seu, no painel da
  Stripe *(DEC-14)*.

---

# Nota sobre as listas de origem

A tabela "primeira semana" do `ALTERACOES.md` cita IDs que não batem com os
blocos do próprio arquivo (chama de `F1, F2` o que é `F5` e `F11`; de `A2` o que
é `A4`; de `G2` o que é `G4`). O conteúdo das linhas está certo — os rótulos,
não. Segui o **conteúdo**. Ao consultar aquele arquivo, use as seções, não a
tabela final.

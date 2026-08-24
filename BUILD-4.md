# Build 4 — Listas paralelas

**Data:** 23/08/2026
**Fila completa:** `FILA.md`. **Decisão nova deste build:** `DEC-17`.

O defeito que mais custou a este projeto tem uma forma só: a mesma verdade
escrita em dois lugares. Nenhuma das duas cópias está errada no dia em que
nasce. Uma delas envelhece, e o silêncio entre as duas é o produto.

Este build não procurou todas. Procurou as que **já divergiram** — e, no meio do
caminho, escreveu a régua que acha a próxima sozinha.

---

## O que estava divergindo, e o que passou a derivar

### A tira de formatos: 13 selos ao lado de um catálogo de 15

A faixa de formatos da home e da `/precos` era HTML escrito à mão em **seis
cópias** — cinco corpos de página mais a home —, com **13 selos**. O catálogo
`src/features.json` tinha **15 saídas**.

Duas capacidades prontas eram vendidas como inexistentes, nos cinco idiomas:
o **pacote multi-idioma** e o **prompt para IA**. As duas têm botão no produto.
As duas estavam fora da vitrine porque alguém, um dia, escreveu treze.

Agora a tira é **gerada** por `lib/site.ts` a partir do catálogo. Na home, os
quatro de destaque na frente e os outros onze numa gaveta; na `/precos`, os
quinze. O corte é por **contagem**, e não por lista escrita no teste: qual
formato entra na frente é decisão de produto e pode mudar; que sejam poucos é
que é a regra.

O gerador **para o build** se qualquer saída do catálogo não tiver selo. Uma
saída nova sem selo não pode sair silenciosamente da vitrine — que é exatamente
como as duas sumiram.

### O mínimo do Team morava em dois lugares, e um deles dizia que morava no outro

`lib/stripe.ts` diz, em maiúsculas: *"O MÍNIMO DO TEAM MORA AQUI, E SÓ AQUI."*
Sete linhas abaixo, no `build.py`, estava escrito `TEAM_MINIMO = 3`, embaixo de
um comentário explicando que o número mora em `lib/stripe.ts`.

Duas cópias, uma delas **se declarando cópia**. É o defeito inteiro em duas
linhas. Era 5 antes desta rodada, e as duas desceram para 3 juntas só porque
quem mexeu lembrou das duas.

O `build.py` passa a **ler** o número de `lib/stripe.ts`. Não achando, o build
**para**: uma vitrine que anuncia "a partir de 3 pessoas" enquanto o checkout
cobra o mínimo de 5 é pior do que uma build vermelha. Conferido nos dois
sentidos — com 4 em `lib/stripe.ts`, o `build.py` lê 4.

### Quatro tabelas `LOCALE` iguais, e uma quinta que precisa ser diferente

As quatro viraram uma, em `lib/conta/textos.ts`. A quinta ganhou nome —
`LOCALE_STRIPE` — e o motivo escrito de continuar separada.

> **A fila estava errada sobre esta, e o erro era meu.** O item pedia
> "unificar", e unificar teria quebrado o idioma do checkout em quatro dos
> cinco mercados: a Stripe aceita `en`, e **não** `en-US`. Medido contra
> `Stripe.Checkout.SessionCreateParams.Locale`. O que estava lá já estava
> certo; o que faltava era o nome e o comentário.

### E as outras que passaram a derivar

- **`NUM`** sai de **`PRECO`** — a segunda tabela de preço do `build.py` saiu.
  Conferido: personal 149/29/27, team 349/69/65, mínimo do Team 1047/207/195.
- **`CAMINHO`** sai de `src/rotas.json`.
- **`LOCALE_DE`** (o formato de data dentro do documento) fala os cinco, e se
  confere contra `LANGS` a cada carga.
- **O `<head>` de `home.html` e `doc.html`** foi apagado inteiro. Ele tinha um
  `hreflang` de **três** idiomas — a fóssil literal do defeito — e **nunca foi
  servido**: quem monta a página é o Next, que extrai só o interior do `<body>`.
  Um `hreflang` errado que ninguém serve é pior do que um certo: ele é o
  rascunho que a próxima pessoa copia.

---

## A régua que acha a próxima sozinha — e os três defeitos que ela achou

Consertar seis listas paralelas à mão é consertar seis. `testes/tabelas.mjs`
varre o produto inteiro atrás da **forma** do defeito: um objeto
`{ pt: …, en: …, es: … }` dentro de uma ferramenta que fala cinco.

Ela achou três que ninguém tinha visto — nenhum deles estava na fila.

### 1 · Quem trabalha em alemão lia a própria tela com o modelo em inglês

`OCR_LANG` tinha três idiomas e um `|| 'eng'` embaixo. Não dá erro: dá
`Bestatigen` onde estava `Bestätigen` — e o texto errado entra no documento que
o cliente anexa a uma auditoria. Os modelos `deu` e `fra` estavam no mesmo
repositório que os outros três o tempo todo. A falta era da tabela.

### 2 · Transcrição em alemão limpa com as regras do português

`HESITA` — a lista de titubeios que sai da transcrição — tinha `pt`, `en`, `es`
e um `|| HESITA.pt`. O alemão e o francês recebiam as regras do português: o
titubeio de verdade (`äh`, `euh`) ficava na evidência, e o risco de apagar
palavra boa era o de outra língua. Os dois entraram, com a mesma régua de
conservadorismo dos três de cima — `also`, `ja`, `bon` e `hein` ficam **de
fora** de propósito, porque são palavras legítimas, e apagar palavra de uma
evidência é pior do que deixar um `äh…`.

### 3 · O vocabulário do domínio não fala alemão nem francês — e virou decisão

O recurso que corrige `ME21N` quando a transcrição escreve *eme vinte e um ene*
é **gratuito por regra**: o comentário no código diz que o que faz a evidência
de uma pessoa ser aceita não se cobra. As três tabelas que o sustentam falam
`pt`, `en` e `es`.

Até este build, alemão e francês caíam num `|| NUMS.pt`: a ferramenta procurava
*"duzentos e trinta e cinco"* dentro de um texto que nunca vai dizer isso.
**Ganho zero, e risco não-zero** de trocar uma palavra por acaso dentro de uma
evidência.

**A queda para o português saiu.** Sem tabela, os mapas ficam vazios, e sobra o
caminho que não depende de língua nenhuma — sigla escrita em letras e dígitos
(`M E 21 N`) continua sendo achada. É menos do que pt/en/es têm, e é a verdade
sobre o que existe hoje.

**Fazer os dois idiomas não é preencher tabela.** O 21 alemão é
`einundzwanzig` — uma palavra só, com a unidade na frente —, e o casador atual
soma palavras separadas. O 91 francês é `quatre-vingt-onze`. Os dois exigem
mexer em como o número é montado. Por isso virou a **DEC-17**, com três
caminhos e a minha indicação: **fazer, no Build 6**, junto com os outros
"vistos que não entregam".

**Enquanto isso, a exceção é impressa em toda execução da régua, com o motivo.**
Uma exceção que ninguém vê é o mesmo silêncio com outro nome. E a régua reprova
se a exceção sobreviver ao conserto — perdão órfão é lixo que esconde o próximo.

### E uma função morta, no meio do caminho

`numPorExtenso` — catorze linhas chamadas só por si mesmas. Era a **primeira**
versão do recurso, a que o comentário logo acima descreve como tendo falhado no
primeiro teste com fala de verdade. Carregava mais um `|| NUMS.pt`. Saiu.

---

## O `AUDITORIA-PENDENTE.md` passa a ser gerado — e o que eu errei fazendo isso

O comentário do `build.py` prometia há meses: *"é essa lista que vira o
`AUDITORIA-PENDENTE.md`"*. **Nada gerava.** O arquivo era escrito à mão, e as
duas cópias já tinham divergido: o comentário ficou com a frase velha ("hash",
"vocabulário", "status") e creditava `vocab.mjs` a uma promessa que a página já
não faz.

Agora cada bala carrega um campo `teste`, e o arquivo sai do `build.py` a cada
build. Os **21 comentários** que duplicavam esses dados foram apagados — o que
sobrou deles foi o campo, que é o que o arquivo lê. Onde não há régua, sai
`sem teste` com todas as letras, e o `semTestePorque` ao lado quando existe uma
régua parecida que **não** prova aquilo.

**Três promessas sem trava, de vinte.** A régua `auditoria.mjs` cobra que o
arquivo publicado seja **idêntico** ao que os dados geram, que todo teste
creditado exista no disco, e que as promessas sem trava **não passem de três**.
Uma bala nova sem régua fica vermelha no build em que nasce.

> **O erro que eu cometi, e que estou registrando porque é o mesmo do build.**
> A primeira versão do gerador **apagou onze linhas de auditoria**. A metade
> escrita à mão do arquivo — as afirmações soltas que moram dentro dos cinco
> `precos.<idioma>.html`, mais a lista de pendências — não vinha dos dados, e
> eu a substituí por um parágrafo dizendo que não a gerava. Estava certo sobre
> o que não gerava e errado sobre o resto: aquelas onze linhas não tinham outro
> lugar para morar.
>
> Consertado com arquivo próprio, `src/auditoria-solta.md`, que o `build.py`
> cola no fim. O arquivo publicado continua sendo gerado inteiro; quem edita,
> edita a fonte. **Trocar uma lista paralela por uma lista perdida não é
> conserto** — e foi o que eu quase entreguei.

---

## O defeito que eu criei neste build, e como ele apareceu

Este é o mais importante do relatório, e ele é meu.

Ao apagar o `<head>` fóssil, deixei no lugar um comentário explicando por que o
cabeçalho não é servido. O comentário **escrevia a tag de abertura do corpo**,
entre crases, para explicar onde o recorte começa. E o recorte era um
`indexOf` cru: ele casou com a menção dentro do meu comentário e começou a
fatiar dali.

O efeito, em **toda página do site e nos cinco idiomas**:

- meia tela de comentário em português virou **texto visível** acima do
  cabeçalho — 238 px, no telefone;
- os atributos do corpo de verdade (`data-supa-url`, `data-supa-key`) **nunca
  chegaram** ao React, porque a tag deles ficou do lado errado do corte;
- o botão da dobra saiu da primeira tela do telefone: **915 px numa tela de
  667**, nos cinco idiomas.

**Nada disso deu erro.** O build passou, o `tsc` passou, a pista de liberação
passou verde e a página abriu. Quem pegou foi `dobrafig [6]`, medindo que o
botão tinha saído da primeira tela — o sintoma a três passos da causa. Só fui
achar a causa depois de imprimir a árvore do corpo e ver a prosa lá.

**Três consertos, e não um:**

1. **O comentário** deixou de escrever a tag. A regra ficou escrita nele mesmo:
   sobre a tag, escreva o nome dela, não a tag.
2. **`lib/site.ts` apaga os comentários antes de procurar** — trocados por
   espaços do mesmo tamanho, para os índices continuarem valendo. Agora o
   arquivo não depende de ninguém lembrar da regra acima.
3. **`paginas.mjs [2e]`** cobra a causa em quatro páginas de dois moldes: o
   corpo começa no cabeçalho, e não em texto solto. **Provado nos dois
   sentidos** — com o `indexOf` cru e a menção de volta, ele reprova citando a
   prosa vazada; desfeito, verde.

O que isto diz sobre a esteira: ela pegou, e pegou pelo lugar errado. Um
relatório que dissesse "regressão verde, um flake de dobra" teria publicado
isso. É o motivo de o terceiro estado do Build 3 existir, e é o motivo de eu
não ter tratado a única vermelha como ruído.

---

## Duas réguas que reprovaram por não conhecerem os nomes novos

**`vitrine.mjs` guardava a prova de cada formato num dicionário indexado pelo
TEXTO do selo** — e o texto do selo é decisão de vitrine. Bastou o catálogo
ganhar os selos de verdade para três fichas caírem com *"ficha sem prova
declarada no teste"*. A régua não tinha achado defeito nenhum: ela só não
conhecia `Multi-idioma`, `VTT/SRT` e `Prompt`. Duas fichas do mesmo ZIP, ainda
por cima, colidiam na mesma chave e uma delas nunca era cobrada.

A prova passou a morar no catálogo, junto do selo que ela sustenta: cada saída
carrega `prova` — o que precisa existir no `app.html` para a ficha ser
verdadeira. Um selo novo sem prova é vermelho.

**`planos.mjs` cobrava "os treze continuam na página"** lendo o HTML da home.
Duas listas paralelas ao catálogo de quinze — a do arquivo e a do teste —, que
envelheceram juntas. Agora ele cobra a **ordem** (destaque antes da gaveta,
resto dentro dela), que **nenhum selo sobrou escrito à mão** no HTML, e tira a
contagem do catálogo.

---

## A esteira

### Dois `trap ... EXIT` no `rodar.sh`, e o segundo apagava o primeiro

Achado enquanto eu caçava o defeito acima. O arquivo tinha um `trap` para
derrubar o servidor do Next e outro para limpar as saídas. Em shell, o segundo
**substitui** o primeiro, em silêncio: o servidor ficava de pé depois de a
esteira terminar.

Isso não é cosmético. Foi assim que, no meio deste build, uma medição minha
saiu contra uma build **velha** — o servidor que respondeu na porta 8802 era o
de uma execução anterior — e que `npx next start` passou a responder
`EADDRINUSE` sem ninguém ter subido nada. É a mesma família das listas
paralelas: duas declarações da mesma coisa, uma delas vencendo sem avisar.

Virou um `trap` só. E, de quebra, **as saídas passam a sobreviver quando algo
reprova**: elas eram apagadas sempre, o que quer dizer que a única cópia do que
a régua vermelha imprimiu morria junto com o comando, e o que restava era rodar
o teste de novo, sozinho — onde ele costuma passar. Agora a esteira imprime o
caminho do log de cada uma que caiu.

### Cinco testes pulavam em letra minúscula, e a esteira contava como verdes

O Build 3 criou o terceiro estado — ok / PULADO / FALHOU — porque três testes de
licença saíam 0 imprimindo `pulado` e a esteira os somava aos verdes. Consertei
os três. **Havia mais cinco com o mesmo disfarce**, e eu não olhei: `audio`,
`espera`, `faixa`, `varredura` e `semmarca` escreviam `  pulado  `, minúsculo e
indentado, e o `rodar.sh` só reconhece `^PULADO` no começo da linha.

O caso do `espera.mjs` é o que dói: ele mede se o texto aparece na tela
**enquanto** a transcrição corre — a diferença entre uma ferramenta que parece
travada e uma que não parece. Ele precisa de uma amostra de vídeo longa que não
estava nesta máquina, e passou builds inteiros **contando como verde sem nunca
ter rodado**.

Os cinco passaram a gritar. E `inventario.mjs [4]` cobra a FORMA, que é o que a
esteira lê: nenhum teste anuncia um pulo em minúscula. **Provado nos dois
sentidos.**

E o primeiro conserto errou por um: eu marquei os cinco igual, e o `semmarca.mjs`
não pula o arquivo — pula **um bloco de quatro linhas** num arquivo de cinco
blocos. A esteira passou a tirar o arquivo inteiro da cobertura, que é a mentira
anterior virada do avesso. Ele ganhou marca própria, `BLOCO PULADO`: aparece no
rodapé como os outros, e não desconta um arquivo que passou em quatro dos cinco
blocos. A distinção está escrita no `rodar.sh` e no `testes/LEIA-ME.md`.

De quebra, gerei a amostra longa: `espera`, `audio` e `varredura` passaram a
rodar de verdade nesta esteira, e o `espera.mjs` saiu verde nas dez afirmações
dele — inclusive a que garante que o aviso de "sairia sem a fala" some quando a
transcrição acaba, que é a metade oposta do defeito do `#pdfStatus` abaixo.

### A vermelha do `modelos.mjs` era defeito do produto, e não da máquina

`modelos.mjs` reprovou em duas regressões seguidas, sempre na mesma linha, e
**passava sozinho**. A tentação de chamar isso de flake é exatamente o que a
esteira honesta do Build 3 veio impedir.

`#pdfStatus` é uma linha só, com cerca de vinte donos, e o último escreve por
cima. Enquanto a transcrição corre, `pintarSaidas()` escreve ali "o documento
sairia sem a fala" e marca a linha como sua com um `dataset.aviso = '1'`. Quando
a transcrição acaba, o ramo desse `aviso` **reescreve a linha inteira**, sem
perguntar o que há nela.

Numa máquina ocupada, a transcrição termina **depois** do clique em "usar a fala
como anotação" — e a resposta desse clique some. Quem clicou fica sem saber se
funcionou. Não é lentidão de teste: é a confirmação de uma ação apagada por uma
mensagem de outra ação que já tinha acabado.

O conserto guarda o **texto** que o aviso deixou, em vez de uma marca cega. Na
volta, a linha só é substituída se o que está na tela ainda for o aviso; se
outro dono escreveu no meio, o recado dele fica — ele é mais novo, e é resposta
a um clique que alguém deu.

> **O que eu não consegui deixar determinístico.** A metade "o recado do outro
> dono sobrevive" só reprova sob carga, que foi como ela apareceu. A metade
> oposta — "o aviso some quando a transcrição acaba" — é determinística, e é o
> `espera.mjs` que a segura. Não inventei um terceiro teste sintético para
> fechar a conta: preferi dizer aqui qual das duas metades depende de máquina
> ocupada.

### O placar

```
140 ok · 4 PULADO · 0 FALHOU
Pulados: licenca.mjs liclink.mjs licauto.mjs legal.mjs
  Um teste pulado NÃO é um teste que passou. O motivo de cada um está acima.
Nada vermelho — mas a cobertura é a dos 140, não a dos 144.
```

**144 réguas, contra 142 no Build 3** — entraram `auditoria.mjs` e `tabelas.mjs`.
Os quatro pulados são os mesmos de sempre e continuam ditos com todas as letras:
três por falta do emissor de chaves, que não viaja no pacote de propósito, e um
pela tradução jurídica pendente de alemão e francês (o item C05, Build 7).

**E os 140 verdes são mais verdes que os 139 do Build 3**, porque três réguas que
antes se somavam aos aprovados sem rodar — `espera`, `audio` e `varredura` —
passaram a rodar de verdade nesta esteira.

O `LEIA-ME.md` dos testes, o `rodar.sh` e o disco continuam dizendo o mesmo
número — é o `inventario.mjs` que cobra isso, e ele reprovou duas vezes durante
este build, nas duas com razão.

---

## O que eu faria a seguir, na ordem

1. **O CSS** — cinco classes usadas e ausentes de `public/site.css`, cinco
   regras mortas, 35 corpos de página afetados. Você já aprovou que ele saia
   sozinho, com captura de tela antes e depois nas 18 combinações de página e
   idioma. É o impedimento mais barato que sobrou.
2. **Build 5 — o caminho até a compra.** O clique de "Assinar o Team" não leva
   a intenção consigo: a pessoa chega à conta e escolhe de novo. É o único
   item da fila que custa venda todo dia.
3. **A DEC-17**, dentro do Build 6, se você concordar com a minha indicação.

E as três que continuam represadas por sua instrução: a Stripe (DEC-14), o
Drive (DEC-15) e o vocabulário de cenários (Build 12, porque mexe em dado
guardado).

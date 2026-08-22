# APLICAR — o que há nesta pasta

A árvore deste zip **já está construída**: `public/app.html` e
`offline/walkstamp-offline.html` estão gerados. Para subir o site, não é preciso
rodar `build.py`.

Base: `285d4a5` (o `main` de produção) + os seis commits do `correcoes.bundle`
= a árvore do `walkstampbuild8_1.zip`. Sobre ela, dezoito commits novos.

## Os dezoito commits

**A0 — a saída recomendada chega à linhagem.** Em vez de sete formatos com o
mesmo peso, a ferramenta olha o cenário e propõe um; os outros ficam recolhidos
atrás de "ver todos os formatos".

**A1 — o cartão da grade.** O que faltava do build 8:

- a lente — tarja, recorte, comparação, troca de imagem, clipe, fala editável —
  só abria por um `⤢` invisível até o mouse passar por cima da miniatura. **Num
  aparelho de toque não existe `:hover`**: metade da ferramenta era
  inalcançável. Agora é um botão **`Editar`**, sempre visível, no pé do cartão;
- a seta de mover desabilitada era `opacity:0 !important` — nas pontas, "não há
  para onde" era silêncio. Agora fica apagada, não sumida;
- o cartão passa a mostrar **a primeira linha da fala**, pela mesma conta que o
  documento usa.

A anotação continua no cartão: anotar é o trabalho desta etapa, e um trabalho
que exige abrir um diálogo por quadro é um trabalho que ninguém faz quarenta
vezes.

**A2 — as três etapas, e `Gerar` sai de dentro da `Revisão`.** A numeração
mentia duas vezes: **"2 — A fala (opcional)"** é onde moram `#auto`, `#extract`
e os ajustes de extração — o único botão que faz a ferramenta funcionar estava
num passo rotulado como dispensável; e **"3 — Revisão"** escondia quatro blocos,
sendo o quarto `Gerar`, a coisa que a pessoa veio buscar, atrás de três blocos
de rolagem.

Agora: `Entrada → Conferir → Baixar`, com uma barra em cima que diz onde você
está (`aria-current="step"`), botões que levam à etapa e movem o foco para o
cabeçalho, e uma frase de próxima ação abaixo. **O estado é derivado**, não
guardado — recomeçar a sessão devolve a barra ao início sozinha.

Ganho não previsto: com `Baixar` num cartão próprio, ele fica **inerte**
enquanto não há o que baixar. Dentro da antiga "Revisão" isso era impossível.

E **a travessia**: cruzar uma fronteira trabalhando leva você até a etapa nova —
só para frente, nunca durante a captura, e sem tirar o cursor de quem escreve.

Junto veio o **vocabulário unificado**, adiado desde o build 3. Medir mudou o
escopo: só o português estava dividido (43 "frame" contra 44 "quadro", brigando
na mesma frase), e as 14 chaves que chamavam as fases da ferramenta de "passo"
viraram "etapa" com a concordância certa. `trecho` **fica** — é trecho de *fala*,
conceito diferente de quadro. Ids, variáveis e as chaves do JSON exportado não
mudaram: a língua da interface unifica, o formato de dados não.

O que **falta** do A2 está no `PLANO.md`, e não dá para fazer daqui: NVDA +
Chrome, VoiceOver + Safari e zoom 200%.

**B3 — o banco passa a caber no Git.** Eram zero `.sql` contra mais de vinte
RPCs. Agora são **42 migrações versionadas**, e um comando prova que elas
reconstroem a produção. Leia `supabase/LEIA-ME.md` — é lá que está a história
inteira, inclusive as quatro coisas que a comparação encontrou.

**B1 — três coisas prontas há cinco dias estavam à venda como "em breve".** A
página de preços tinha duas listas de fontes diferentes: a comparativa, montada
de `src/features.json` nos cinco idiomas, e os cartões de plano, escritos à mão.
Medido contra o código e o banco:

| o cartão dizia | a verdade |
|---|---|
| Modelo de documento próprio — *em breve* | **existe** desde 16/08 |
| Perfil entre visitas e máquinas — *em breve* | **existe** |
| Perfil de equipe empurrado — *em breve* | **existe** |
| Termos do sistema guardados — *em breve* | **não existe**, e está certo |

As três saíram do "em breve"; a quarta passou a declarar-se no catálogo com
`"breve": true`; cada bala ganhou uma alça `data-f` para o item do catálogo; e o
alemão parou de dizer "bald" no cartão e "demnächst" na lista. `testes/planos.mjs`
é o portão — estático, sem servidor — e reprova nas duas direções.

**A barra das etapas acompanha a rolagem.** Ela dizia onde você estava e sumia no
primeiro rolar. Agora fica colada na base do cabeçalho e mostra os quatro
estados — *atual*, *concluída*, *com atenção* e *bloqueada* —, cada um por
palavra no rótulo acessível. No celular vira `Etapa 2 de 3 · Conferir` mais uma
barra de três segmentos. Abaixo, sempre, **"Próxima ação: …"**.

**B2 — não era empate.** Havia dois webhooks da Stripe e o repositório não dizia
qual URL estava configurada. A Edge Function tratava **só faturas**: nunca
`checkout.session.completed` nem `customer.subscription.*`. Com a URL apontada
para lá, a pessoa paga, a fatura aparece, e **o plano nunca chega** — em
silêncio, porque a Stripe recebe 200. E ela estava no ar.

A autoridade é `POST /api/stripe/webhook`. A Edge Function passou a responder
**410 com o endereço certo no corpo**. E `walkstamp.stripe_evento` passou a
registrar o que a Stripe entregou, com contador de reentregas — anotação, e não
trava.

> **A ordem de aplicar importa:** mover a URL no painel da Stripe **primeiro**,
> reenviar por lá o que falhou, e só então publicar a recusa. Ao contrário, as
> faturas do intervalo se perdem.

**B4 — a página vendia o Personal e pedia e-mail para avisar quando ele sair.**
O cartão dizia "R$ 149 / ano · teste de 14 dias · na hora, sem cartão"; cinquenta
linhas abaixo, a seção da lista dizia "deixe um e-mail e eu aviso quando o plano
pago sair". Nos cinco idiomas. E há checkout de verdade, então quem manda é o
cartão.

A lista tinha um assunto verdadeiro esperando por ela: **Pro e API**, que a
própria página descreve como "nada disso existe ainda". Agora é disso que ela
fala, e diz em voz alta que o plano pago já está no ar.

A trava é estrutural — `data-plano` nos cartões, `data-espera` na seção — porque
casar frases em cinco idiomas envelhece na primeira reescrita de copy.

**B5 — o Personal vendia logotipo; agora vende a rodada.** A chamada era "para
quem entrega documento com o próprio nome"; a primeira bala era o logotipo; o
roteiro vinha em segundo, numa linha. Agora o cartão lidera pelas duas metades da
tese, e cada frase foi conferida contra o arquivo que a sustenta:

| o cartão promete | onde vive |
|---|---|
| suba a planilha (.xlsx, .csv, colada do Excel) | `roteiro_salvar()` |
| cada caso vira um link que abre a ferramenta preenchida | o `caso=` no `template.html` |
| volta em .xlsx com situação, quando, quem, arquivo e impressão | `app/conta/planilha/route.ts` |
| recibo por caso, sem imagem sair | `roteiro_caso.recibo` |

A marca continua no pago — como prova visível do plano, não como a justificativa.
`planos.mjs` amarra promessa a entrega: tirar uma coluna do export reprova.

**Com isto a trilha B fecha inteira.**

**C1 — o funil media a própria esteira, e o arquivo não tinha um só
`performance.mark`.** O plano pedia marcas em cada fronteira e trazia uma
pergunta aberta: *"inglês abre 48 vezes e converte zero"*. A instrumentação
entrou; a pergunta virou outra.

O arquivo tinha **39 `performance.now()` e zero `performance.mark()`**. Um
`now()` avulso calcula uma diferença, mostra numa frase e joga fora — o número
existe no instante e some, e sem ele não se compara duas execuções, nem duas
máquinas, nem a mesma máquina antes e depois de uma mudança.

As oito fronteiras estão marcadas, e três ganharam detalhe que não existia:
rede e sessão são tempos **separados** dentro do mesmo degrau (um degrau lento
era ambíguo, e rede ruim e máquina ruim pedem decisões opostas); os degraus que
**perderam** contam, porque `mbBaixados` soma o caminho inteiro — foi assim que
uma máquina real gastou 353 MB antes de uma sessão subir; e mais de uma
construção por aba é o caso normal, então a régua conta quantas houve em vez de
somar duas escadas numa só.

`node testes/regua.mjs` dirige o produto e recolhe o que o **produto** marcou —
uma régua que cronometrasse por fora mediria o Playwright e o disco. As amostras
de 1, 10 e 40 min saem de `python3 testes/amostras.py --medida`, com `sha256` e
versão de receita viajando dentro do JSON. Elas **não são fala de verdade**: sem
sintetizador de voz, o áudio é um tom e o tempo é um piso — o campo `fala` diz
isso em cada linha. `node testes/marcos.mjs` afere a régua sem rede, fazendo os
dois primeiros degraus falharem de propósito.

**E a pergunta aberta.** Os marcos não carregam IP, navegador nem sessão — de
propósito —, então "são robôs ou é funil quebrado?" não é respondível com este
instrumento. Pior: medindo para responder, apareceu que o instrumento estava
sujo. Entre **23h09 e 01h52** de uma noite em que ninguém abriu o produto, **43
marcos entraram na base de produção** — `pdf`, `docx` e `json` baixados, vídeos
"carregados" de gravação e de exemplo, dois marcos **em inglês**. Era a esteira
de testes: o endereço da medição é assado no `app.html`, e a regressão abre esse
mesmo arquivo em `localhost` dezenas de vezes por dia, sem guarda nenhuma.

`medir()` passou a calar em origem de desenvolvimento (`localhost`, `127.*`,
`::1`, `.local`, rede privada, `file:`), por regra de **origem** e não por lista
de domínios. Detalhe em `MEDICAO-E-O-INGLES.md` e em
`testes/REGUA-DE-DESEMPENHO.md`.

**O primeiro número da série:** `enviadoSobreOriginal` = **1,00**. O modelo
recebe hoje exatamente o áudio que o vídeo tem — a linha de base que precisava
existir antes de alguém mexer na compactação de silêncio.

**A Trilha D — a análise da venda entra no roadmap, na frente da C.** A análise
da página, da copy e da venda de 22/08 está inteira e sem edição em
`ANALISE-DA-VENDA.md`, e virou a Trilha D do `PLANO.md` (12–15 d). Ela entra
antes da C2 e da C3 pelo mesmo motivo que a C1 veio antes da C2: acelerar um
motor que ninguém contratou acelera a coisa errada. A ordem passa a ser
**A → D0 → D1 → C2 → C3**.

Três itens do P0 dela **já estão feitos** — a análise foi escrita contra a
página de antes do B1, B4 e B5, e o `PLANO.md` marca cada um para ninguém
refazer. O que sobrou tem um item afiado: a abertura de preços ainda diz que o
pago é *"a identidade do documento e a administração de uma equipe"*, texto
anterior ao B5 — a página argumenta contra o próprio cartão, comparando
R$ 149/ano com "PDF com logotipo".

**Duas réguas liam a tela errada.** Saíram da regressão completa — a primeira
que rodou com o Next de pé nesta máquina, então alcançou arquivos que as pistas
curtas nunca alcançaram.

`linkpage.mjs` era minha, do B5: cobrava a frase inteira do item de identidade
no cartão Personal, e o B5 reescreveu o cartão — o item continuou lá, com outras
palavras. Passou a cobrar pela **alça** (`data-f="modeloProprio"`), que existe
desde o B1 com o catálogo garantindo que ela aponta para um recurso de verdade.

`modelos.mjs` quase virou minha. O primeiro A/B parecia condenar; cinco amostras
de cada build, depois, passaram 5/5 nos dois. Imprimir o texto achou o
mecanismo: `#pdfStatus` é uma linha só com vários donos, e o fim da varredura
escreve "3 quadros prontos" nela — numa máquina ocupada, **depois** do clique,
apagando a mensagem que o teste veio conferir. Fotografar um campo de último
escritor virou esperar o texto aparecer.

**D0 — a página parou de argumentar contra o próprio cartão.** Cinco itens da
análise da venda, nos cinco idiomas, cada um com a trava que impede a volta.

O H1 era *"Você percorre a tela. Ele carimba cada passo."* — tem personalidade e
não é pesquisável: quem faz QA não lê ali "caso de teste", "evidência" nem
"planilha". Agora é **"Execute os casos. O Walkstamp organiza a prova."**, e a
primeira dobra ganhou um **segundo caminho** para quem chega com a planilha na
mão. Ele aponta para os preços e **não promete o trial** — enquanto ninguém
confirmar que os 14 dias estão de pé em produção, o hero não vende o que talvez
não entregue.

A abertura de preços dizia que o pago é *"a identidade do documento e a
administração de uma equipe"*, texto anterior ao B5: a página comparava
R$ 149/ano com "PDF com logotipo" no primeiro parágrafo. Virou **"Um caso avulso
é grátis. O trabalho repetido e coordenado vira plano."**

*"Não há conta, não há banco de dados, não há rastreamento"* foi verdade e
deixou de ser — existe conta nos planos pagos, existe banco, existe a medição. O
conserto não foi apagar o absoluto: foi dizer **sobre o quê** ele é absoluto.
*"Não existe servidor que receba o seu vídeo"* continua sendo a frase mais forte
da página, e é verdadeira.

O último "em breve" saiu do cartão para uma caixa de roteiro, fora da decisão de
compra. E as afirmações sobre Claude, ChatGPT e Gemini viraram formulação
durável: uma afirmação nominal de **limitação** envelhece virando mentira. A
lista de **compatibilidade** continua nomeando os três — ela envelhece por
falta, e faltar um nome não desmente nada.

**O funil jogava fora oito de onze eventos, e dois de cinco idiomas.** Esta é a
maior descoberta do pacote, e ela nunca deu erro em lugar nenhum.

O produto chama `medir()` com **onze** nomes de evento. A tabela aceitava
**três**. Quatro batiam no `check` do nome e a função os engolia — de propósito,
para uma medição recusada não virar erro na tela de ninguém. Quatro nem
chegavam: mandavam parâmetros que a função não tem (`p_de`, `p_para`, `p_pct`,
`p_via`, `p_telas`), e o PostgREST responde que a função não existe. E o
`baixou_saida` em `pptx`, `html`, `md`, `csv`, `gdocs`, `jira` ou `vocabulario`
batia no `check` do formato e levava a linha inteira.

E **`idioma` aceitava `pt`, `en` e `es`**. O site tem cinco. Todo evento em
alemão e francês foi descartado desde sempre — o zero daqueles dois idiomas não
era tráfego, era o banco.

A migração faz o banco aceitar o que o produto já mandava, com vocabulário
fechado em cada campo, e abre os quatro eventos de intenção paga. Os dois que
queriam contagem exata passaram a mandar **faixa**.

Dois defeitos apareceram no próprio portão do banco, e os dois são do B3:
`prova.sh` **engolia o veredito** (`psql | sed | sed` — o `$?` de um cano é o do
último comando, então uma afirmação reprovando terminava em *"Prova do banco:
passou."* e código 0), e os dois scripts escreviam em `/tmp` cravado, o que faz
a prova relatar *"O ESQUEMA MUDOU"* por permissão. Agora respeitam `TMPDIR`.

**Os quatro eventos de intenção paga.** A área da conta não media nada — e um
evento declarado e nunca disparado é pior que nenhum, porque o zero parece
resposta. `importou_roteiro` e `concluiu_caso` saem do roteiro; o segundo só
quando o caso é **concluído**, nunca quando é desfeito. `comecou_pagamento` sai
do checkout **antes** do `redirect`, que no Next funciona lançando — medir
depois seria uma linha que nunca executa. `comecou_teste` só conta quem **não**
é assinante, porque a mesma porta emite a chave do teste e a de quem já paga.

E a medição do servidor **respeita Do Not Track**: `navigator.doNotTrack` não
existe do lado de cá, mas o cabeçalho vem em toda requisição, inclusive na que
dispara a ação. Quem desligou o rastreamento desligou o rastreamento, e não "o
rastreamento feito por JavaScript".

**E o diário da Stripe dizia "ok" para o que ignorou.** `venda.mjs` cobrava que
um evento que não interessa não tocasse o banco. Antes do B2 era assim; o B2 pôs
o diário de auditoria — foi ele que revelou que um dos dois webhooks nunca
concedeu plano — e o diário registra todo evento, inclusive o que não interessa.
Um diário com buracos não responde "quem tratou o quê". Mas `ok` para um evento
que ninguém tratou é pior que silêncio: lê-se como "tratei". O webhook passou a
registrar **`ignorado`**, e o teste cobra precisão em vez de silêncio.

**D0 — a página parou de argumentar contra o próprio cartão.** Cinco dos sete
itens do D0 da Trilha D, nos cinco idiomas, cada um com a trava que impede a
volta.

**A home escolheu um comprador.** O H1 era *"Você percorre a tela. Ele carimba
cada passo."* — tem personalidade e não é pesquisável: quem faz QA não lê ali
"caso de teste", "evidência" nem "planilha", e o lead abria dois produtos com o
mesmo peso. Agora é **"Execute os casos. O Walkstamp organiza a prova."**, e o
lead abre pela planilha e fecha pelo roteiro devolvido com situação, data e
executor. A voz antiga sobrevive como subtítulo mais abaixo — ela é boa, só não
é categoria.

E a primeira dobra ganhou **dois caminhos**. O CTA único otimizava ativação
gratuita: quem chega com uma planilha na mão — que é quem paga — não tinha para
onde ir sem rolar a página inteira. O segundo aponta para os preços e **não
promete o trial**: enquanto ninguém confirmar que os 14 dias estão de pé em
produção, o hero não vende o que talvez não entregue.

**A abertura de preços contradizia o próprio cartão.** Ela dizia que o pago é
*"a identidade do documento e a administração de uma equipe"* — texto anterior
ao B5, que passou a vender o Personal pela rodada de casos. A página comparava
R$ 149/ano com "PDF com logotipo" no primeiro parágrafo, e quem lia ia embora
antes da bala que fala da planilha. Agora o H1 é **"Um caso avulso é grátis. O
trabalho repetido e coordenado vira plano."**

**Os absolutos de privacidade eram falsos.** *"Não há conta, não há banco de
dados, não há rastreamento"* foi verdade e deixou de ser: existe conta nos planos
pagos, existe banco, e existe a medição de três marcos. O conserto não foi apagar
o absoluto — foi dizer **sobre o quê** ele é absoluto. *"Não existe servidor que
receba o seu vídeo"* continua sendo a frase mais forte da página, e é verdadeira.

**O último "em breve" saiu do cartão** para uma caixa do roteiro abaixo dos
planos, fora da decisão de compra.

**As afirmações sobre Claude, ChatGPT e Gemini viraram formulação durável.** Uma
afirmação nominal de *limitação* envelhece virando mentira e leva junto a
credibilidade do resto. A lista de *compatibilidade* continua nomeando os três:
ela envelhece por falta, e faltar um nome não desmente nada. **Reversível** — se
você quiser a comparação nominal de volta, ela custa uma página datada com
protocolo, e a trava sai junto com a decisão.

Duas travas **mudaram de lado**, e vale saber por quê. `cenarios.mjs` cobrava que
o futuro estivesse marcado *dentro* do cartão — e marcar era a coisa honesta na
época; continua honesto dizer, mudou o lugar. `linkpage.mjs` cobrava que o cartão
pago vendesse os termos *gravados*; a preocupação original (não vender no pago o
que é de graça) continua de pé pelo avesso.

Faltam do D0 **a demonstração do fluxo pago** e **os eventos de intenção paga**.
A Trilha D caiu de 12–15 para 5,5–7 dias.

## Os arquivos

| arquivo | o que é |
|---|---|
| `tudo.bundle` | os dezoito commits, para aplicar por Git sobre `d5db0f7` — é um bundle de **intervalo** (`d5db0f7..HEAD`), então ele precisa que você já tenha esse commit; foi assim que ele saiu de 22 MB para 314 KB e o pacote coube no limite de envio |
| `A0-saida-recomendada.patch` | o A0 em diff legível |
| `A1-cartao-da-grade.patch` | o A1 em diff legível (fonte e régua) |
| `B3-banco-versionado.patch` | o B3 em diff legível |
| `A2-tres-etapas.patch` | o A2 em diff legível |
| `B1-uma-verdade-so.patch` | o B1 em diff legível |
| `barra-e-B2.patch` | a barra grudada e o B2, em diff legível |
| `B4-um-estado-por-plano.patch` | o B4 em diff legível |
| `B5-personal-em-torno-do-roteiro.patch` | o B5 em diff legível |
| `C1-medir-antes-de-otimizar.patch` | o C1 em diff legível |
| `D-roadmap-da-venda.patch` | a análise da venda e a Trilha D do `PLANO.md` |
| `reguas-que-liam-a-tela-errada.patch` | `linkpage.mjs` e `modelos.mjs` |
| `D0-a-pagina-vende-um-trabalho.patch` | o D0 em diff legível |
| `stripe-ignorado.patch` | o diário da Stripe e o roteiro do leitor de tela |
| `D0-a-pagina-vende-um-trabalho.patch` | a home, os preços, a privacidade e os concorrentes |
| `funil-jogava-fora-oito-de-onze.patch` | a migração da medição e o `funil.mjs` |
| `eventos-de-intencao-paga.patch` | os quatro marcos do lado pago, na área da conta |
| `correcoes.bundle`, `correcoes-so-fonte.patch` | os seis commits originais do zip |
| `ARQUIVOS.txt`, `MENSAGENS.txt` | o inventário original |

Aplicar por Git:

    git fetch /caminho/para/tudo.bundle
    git merge FETCH_HEAD

## As réguas

**A ferramenta.** `testes/cartao.mjs` (A1), `testes/etapas.mjs` (A2),
`testes/marcos.mjs` (C1) e `testes/funil.mjs` (D0) são novos e entram no grupo
`app` do `rapido.sh` e no `rodar.sh`.

**A regressão completa rodou com o Next de pé** — a primeira vez nesta linhagem.
Isso alcançou os dez arquivos que precisam de servidor e que as pistas curtas
nunca tocam (`medicao`, `ficha`, `liclink`, `timepag`, `verificador`,
`cabecalho`, `chamadoconta`, `faxina`, `portal`, `seo`), e **todos passaram**.
Ela apontou quatro falhas, e é honesto dizer que duas eram minhas e estavam
escondidas justamente por essa lacuna:

| arquivo | o que era | estado |
|---|---|---|
| `linkpage.mjs` | minha, do B5: cobrava a frase inteira do item de identidade, e o B5 reescreveu o cartão | corrigida — cobra pela **alça** `data-f`, não pela prosa |
| `venda.mjs` | minha, do B2: cobrava "banco intocado", e o B2 pôs o diário de auditoria | corrigida — o webhook diz `ignorado`, e o teste cobra precisão |
| `modelos.mjs` | não era minha: `#pdfStatus` é uma linha com vários donos, e o fim da varredura apaga a mensagem | corrigida — espera o texto em vez de fotografar |
| `semmarca.mjs` | **não é minha, e continua aberta**: `DEMO-NATURA.md` veio no commit base `d5db0f7` e nenhum destes commits o tocou | **sua** — ver abaixo |

Depois das correções, os arquivos afetados foram rodados um a um e estão verdes:
`funil`, `marcos`, `etapas`, `cartao`, `planos`, `chaves`, `cenarios`,
`linkpage`, `medicao`, `venda`, `contradicao`, `legal`, `isca`, `vitrine`,
`cinco`, `paginas`, `seo`, `idiomas`, `traducao`, `negocio`, `blog`, `dobra`,
`ficha`, `sessao`, `chamadoconta`, `conclusao`, `parar`, `smoke`, `saidas`.
`tsc --noEmit` e `next build` limpos.

`chaves.mjs`: 956 chaves, ordem igual nos cinco idiomas, a guarda do vocabulário
— e agora também a dos **absolutos de privacidade** e a de **nome de modelo de
terceiro** fora da lista de compatibilidade.

`testes/parar.mjs` precisa de `python3 testes/amostras.py --longo` uma vez, e a
régua de desempenho precisa de `python3 testes/amostras.py --medida`. Nenhuma
das duas amostras viaja no pacote: são grandes demais.

**O banco.** Precisa de um Postgres 15+ local:

    PGHOST=/var/run/postgresql sh supabase/testes/prova.sh
    sh supabase/conferir.sh

O primeiro reconstrói o esquema do zero — **44 migrações** agora — e roda as
afirmações de comportamento; o segundo confere as 38 migrações recuperadas
contra o md5 do que a base diz que aplicou. E o `prova.sh` finalmente **reprova
de verdade**: até esta rodada ele imprimia o erro e saía com código 0.

## O que ainda precisa de você

- **`supabase db push`** — **seis migrações novas** esperando, e uma delas é
  urgente: a `20260822050000` é a que faz o funil parar de jogar fora oito dos
  onze eventos e dois dos cinco idiomas. Enquanto ela não subir, alemão e
  francês continuam invisíveis e os quatro eventos de intenção paga que o código
  já dispara são descartados no banco. Das outras cinco (do B3), quatro são
  no-op de esquema e só a `…203200` mexe em dado — apaga os dois chamados de
  teste que estavam entrando na média pública de tempo de resposta. Detalhe em
  `supabase/LEIA-ME.md`;
- **decidir três coisas do D0**, que são suas e não minhas:
  **(a)** o trial de 14 dias está de pé em produção? Se estiver, o CTA
  secundário do hero pode virar "Testar o roteiro por 14 dias" — hoje ele diz
  "Ver como funciona o roteiro de casos", que não promete nada que talvez não
  entregue; **(b)** a comparação nominal com Claude, ChatGPT e Gemini fica fora
  (como está) ou volta com uma página datada, com protocolo e revalidação?;
  **(c)** moeda: BRL, USD e EUR juntos, ou detectar a localidade? — a primária
  já segue o idioma, então isto é menor do que a análise supunha;
- **sitemap** — precisa do `build.py` depois de aplicar;
- **figura do blog** — precisa de deploy; até lá, exportar abaixo de 1 MB;
- **a branch remota velha** `claude/ux-build-continuation-2hs0b2`, parada em
  `f505ea8`: apagá-la faz o contador de commits parar de mentir;
- **a URL da Stripe** — mover para `https://<host>/api/stripe/webhook` **antes**
  de publicar a Edge Function que recusa (ver B2 acima);
- **`stripe listen --forward-to`** com a Stripe CLI, uma vez: é o caminho de
  rede, que não dá para conferir daqui;
- **proteção de senha vazada** no Supabase Auth está desligada. É um botão do
  painel; o produto entra por link mágico, então o impacto é pequeno;
- **a validação com leitor de tela** — o que falta do A2, e o único item da
  trilha A. O roteiro está em `testes/VALIDACAO-COM-LEITOR-DE-TELA.md`: oito
  itens, 20 a 30 minutos, NVDA+Chrome e VoiceOver+Safari;
- **`DEMO-NATURA.md`** — o `semmarca.mjs` reprova por causa dele; a decisão de
  mover, apagar ou manter é sua (ver acima);
- **medir o funil de novo** — a partir desta versão publicada os números são de
  gente, e não do público somado à esteira. Uma semana de dados limpos responde
  "o inglês converte?" melhor que qualquer releitura dos 447 eventos anteriores;
- **`terceiros.mjs` reprova** — `privacidade.en` está sem a tabela de
  suboperadores traduzida (`<table id="suboperadores">`). É conteúdo do site,
  não foi tocado por nenhum destes commits, e precisa de tradução;
- **a demonstração do fluxo pago** — é o único item que falta do D0, e ele
  precisa de você: um vídeo de 60 a 90 segundos de planilha → casos →
  evidência → planilha devolvida, mais a planilha de entrada e o pacote de saída
  para baixar. O tour de hoje mostra gravação → documento, que é o Free.

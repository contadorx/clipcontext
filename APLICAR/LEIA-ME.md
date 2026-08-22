# APLICAR — o que há nesta pasta

A árvore deste zip **já está construída**: `public/app.html` e
`offline/walkstamp-offline.html` estão gerados. Para subir o site, não é preciso
rodar `build.py`.

Base: `285d4a5` (o `main` de produção) + os seis commits do `correcoes.bundle`
= a árvore do `walkstampbuild8_1.zip`. Sobre ela, quinze commits novos.

## Os quinze commits

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

**E o diário da Stripe dizia "ok" para o que ignorou.** `venda.mjs` cobrava que
um evento que não interessa não tocasse o banco. Antes do B2 era assim; o B2 pôs
o diário de auditoria — foi ele que revelou que um dos dois webhooks nunca
concedeu plano — e o diário registra todo evento, inclusive o que não interessa.
Um diário com buracos não responde "quem tratou o quê". Mas `ok` para um evento
que ninguém tratou é pior que silêncio: lê-se como "tratei". O webhook passou a
registrar **`ignorado`**, e o teste cobra precisão em vez de silêncio.

## Os arquivos

| arquivo | o que é |
|---|---|
| `tudo.bundle` | os quinze commits, para aplicar por Git sobre `d5db0f7` — é um bundle de **intervalo** (`d5db0f7..HEAD`), então ele precisa que você já tenha esse commit; foi assim que ele saiu de 22 MB para 314 KB e o pacote coube no limite de envio |
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
| `stripe-ignorado-e-validacao.patch` | o diário da Stripe e o roteiro do leitor de tela |
| `correcoes.bundle`, `correcoes-so-fonte.patch` | os seis commits originais do zip |
| `ARQUIVOS.txt`, `MENSAGENS.txt` | o inventário original |

Aplicar por Git:

    git fetch /caminho/para/tudo.bundle
    git merge FETCH_HEAD

## As réguas

**A ferramenta.** `testes/cartao.mjs` (A1), `testes/etapas.mjs` (A2) e
`testes/marcos.mjs` (C1) são novas e entram no grupo `app` do `rapido.sh` — e
agora também no `rodar.sh`, onde as duas primeiras faltavam.

**A régua de desempenho** não entra na regressão, e é de propósito: ela mede, e
medir se faz ao mudar a mecânica, não a cada ajuste de tela.

    python3 testes/amostras.py --medida        # 1, 10 e 40 min, com sha256
    node testes/regua.mjs --amostras=1min,10min --cache=frio,quente

**Ela precisa de rede** (`cdn.jsdelivr.net` e `huggingface.co`). Sem rede a
escada falha inteira, e isso não é defeito dela: o JSON sai com `modelo.desistiu`
e a lista de degraus tentados, que é a medição legítima de uma máquina que não
monta o modelo. Quem afere a régua sem rede nenhuma é o `marcos.mjs`.

**A regressão completa rodou pela primeira vez nesta máquina** — com o Next de
pé, o que alcançou os dez arquivos que precisam de servidor e que nunca tinham
rodado (`medicao`, `ficha`, `liclink`, `timepag`, `verificador`, `cabecalho`,
`chamadoconta`, `faxina`, `portal`, `seo`). **Todos passaram**, inclusive o
bloco novo `[M1b] a régua não conta como gente`.

Ela apontou quatro falhas, e as quatro foram investigadas:

| teste | de quem | estado |
|---|---|---|
| `linkpage.mjs` | minha, do B5 | corrigido — cobra pela alça `data-f`, não pela prosa |
| `modelos.mjs` | de ninguém: corrida na própria régua | corrigido — espera o texto em vez de fotografá-lo |
| `venda.mjs` | minha, do B2 | corrigido no produto — o diário diz `ignorado`, não `ok` |
| `semmarca.mjs` | **da árvore base** | **decisão sua**, abaixo |

Depois das correções, os três rerodaram verdes. Uma armadilha que custou meia
hora e vale registrar: um `next-server` órfão de uma execução anterior segurava
a porta 8803, o `venda.mjs` não conseguia subir o dele e falava com o servidor
**velho** — o teste reprovava uma correção que estava certa. Se ele reprovar sem
explicação, `pkill -f next-server` antes de acreditar.

**`semmarca.mjs` é sua.** Ele proíbe a palavra `Natura` em qualquer arquivo da
árvore — o comentário dele explica: *"exemplos de SQL com o domínio de e-mail e
o CNPJ de verdade da companhia, num repositório que constrói o site publicado.
Isso não se desfaz depois de publicado."* Quem viola é `DEMO-NATURA.md`, que
entrou no commit base `d5db0f7` e que **nenhum destes commits tocou**. Não mexi:
mover ou apagar um documento de negócio com o nome de um cliente real é decisão
sua. A correção é de uma linha — o guarda pula uma pasta `demo/` de propósito, e
ela não existe: `git mv DEMO-NATURA.md demo/`. Se ele também não deve viajar no
zip, `demo/*` entra no `testes/naovai.txt` no mesmo movimento.

`chaves.mjs`: 946 chaves, ordem igual nos cinco idiomas — e agora também a
guarda do vocabulário, que reprova se "frame" ou "passo 2" voltarem ao
português.

`testes/parar.mjs` precisa de `python3 testes/amostras.py --longo` uma vez,
senão dá ENOENT em `/tmp/fala-longa.webm`. Não é defeito: a amostra é grande
demais para viajar no pacote.

**O banco.** Precisa de um Postgres 15+ local:

    PGHOST=/var/run/postgresql sh supabase/testes/prova.sh
    sh supabase/conferir.sh

O primeiro reconstrói o esquema do zero e roda 40 afirmações de comportamento;
o segundo confere as 38 migrações recuperadas contra o md5 do que a base diz que
aplicou.

## O que ainda precisa de você

- **`supabase db push`** — as quatro migrações novas do B3 não foram aplicadas.
  Três são no-op de esquema; só a `…203200` mexe em dado (apaga os dois chamados
  de teste da produção). Detalhe em `supabase/LEIA-ME.md`;
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
  não foi tocado por nenhum destes quatro commits, e precisa de tradução.

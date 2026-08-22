# APLICAR — o que há nesta pasta

A árvore deste zip **já está construída**: `public/app.html` e
`offline/walkstamp-offline.html` estão gerados. Para subir o site, não é preciso
rodar `build.py`.

Base: `285d4a5` (o `main` de produção) + os seis commits do `correcoes.bundle`
= a árvore do `walkstampbuild8_1.zip`. Sobre ela, cinco commits novos.

## Os cinco commits

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

## Os arquivos

| arquivo | o que é |
|---|---|
| `A0-A1-B3-A2.bundle` | os cinco commits, para aplicar por Git sobre `d5db0f7` |
| `A0-saida-recomendada.patch` | o A0 em diff legível |
| `A1-cartao-da-grade.patch` | o A1 em diff legível (fonte e régua) |
| `B3-banco-versionado.patch` | o B3 em diff legível |
| `A2-tres-etapas.patch` | o A2 em diff legível |
| `correcoes.bundle`, `correcoes-so-fonte.patch` | os seis commits originais do zip |
| `ARQUIVOS.txt`, `MENSAGENS.txt` | o inventário original |

Aplicar por Git:

    git fetch /caminho/para/A0-A1-B3-A2.bundle
    git merge FETCH_HEAD

## As réguas

**A ferramenta.** `testes/cartao.mjs` (A1) e `testes/etapas.mjs` (A2) são novas
e entram no grupo `app` do `rapido.sh`.

Varredura completa desta árvore: **99 dos 110** testes que rodam sem servidor
passam. Os 11 restantes são **10 que precisam do Next ou de um servidor de
apoio** (`ficha`, `liclink`, `medicao`, `timepag`, `verificador`, `cabecalho`,
`chamadoconta`, `faxina`, `portal`, `seo`) e o `terceiros.mjs`, abaixo. Nenhuma
regressão.

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
- **proteção de senha vazada** no Supabase Auth está desligada. É um botão do
  painel; o produto entra por link mágico, então o impacto é pequeno;
- **`terceiros.mjs` reprova** — `privacidade.en` está sem a tabela de
  suboperadores traduzida (`<table id="suboperadores">`). É conteúdo do site,
  não foi tocado por nenhum destes quatro commits, e precisa de tradução.

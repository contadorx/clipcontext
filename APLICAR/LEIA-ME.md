# APLICAR — o que há nesta pasta

A árvore deste zip **já está construída**: `public/app.html` e
`offline/walkstamp-offline.html` estão gerados. Para subir o site, não é preciso
rodar `build.py`.

Base: `285d4a5` (o `main` de produção) + os seis commits do `correcoes.bundle`
= a árvore do `walkstampbuild8_1.zip`. Sobre ela, três commits novos.

## Os três commits

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

**B3 — o banco passa a caber no Git.** Eram zero `.sql` contra mais de vinte
RPCs. Agora são **42 migrações versionadas**, e um comando prova que elas
reconstroem a produção. Leia `supabase/LEIA-ME.md` — é lá que está a história
inteira, inclusive as quatro coisas que a comparação encontrou.

## Os arquivos

| arquivo | o que é |
|---|---|
| `A0-A1-B3.bundle` | os três commits, para aplicar por Git sobre `d5db0f7` |
| `A0-saida-recomendada.patch` | o A0 em diff legível |
| `A1-cartao-da-grade.patch` | o A1 em diff legível (fonte e régua) |
| `B3-banco-versionado.patch` | o B3 em diff legível |
| `correcoes.bundle`, `correcoes-so-fonte.patch` | os seis commits originais do zip |
| `ARQUIVOS.txt`, `MENSAGENS.txt` | o inventário original |

Aplicar por Git:

    git fetch /caminho/para/A0-A1-B3.bundle
    git merge FETCH_HEAD

## As réguas

**A ferramenta.** `testes/cartao.mjs` é nova e entra no grupo `app` do
`rapido.sh`. Verde nesta árvore: os 35 do grupo `app` — incluindo `perna.mjs` e
`celular.mjs` —, mais `capitulos`, `clipe`, `comparar`, `destaque`, `memoria`,
`miudos`, `onda1`, `onda2`, `pptx`, `rodada`, `tarjaauto`, `trocar`, `webcam` e
`grade`. `chaves.mjs`: 934 chaves, ordem igual nos cinco idiomas.

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
  painel; o produto entra por link mágico, então o impacto é pequeno.

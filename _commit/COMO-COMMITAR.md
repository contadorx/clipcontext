# Como pôr estes builds no git

Os commits já existem — eles só não puderam ser enviados daqui: esta sessão tem
acesso **somente leitura** ao `contadorx/clipcontext`, e tanto o `git push`
quanto a API do GitHub respondem 403. Então eles viajam neste zip, de dois
jeitos. Escolha um.

| commit | build |
|---|---|
| `6c06c9d` | Build 4 — parar sem perder |
| `2ef1502` | Build 7 — a entrada |

Branch `claude/ux-build-continuation-2hs0b2`, saindo de `f505ea8` (o `main`).

---

## Caminho A — trazer os dois commits inteiros (recomendado)

Preserva mensagens, autoria e a ordem. Você não recommita nada: só puxa.

```bash
cd <sua cópia do clipcontext>
git fetch /caminho/para/_commit/builds-4-e-7.bundle \
    claude/ux-build-continuation-2hs0b2:claude/ux-build-continuation-2hs0b2
git push -u origin claude/ux-build-continuation-2hs0b2
```

Se o `git fetch` reclamar que falta o `f505ea8`, é porque a sua cópia está
atrás: `git fetch origin main` primeiro.

Conferir antes de enviar:

```bash
git log --oneline main..claude/ux-build-continuation-2hs0b2   # tem que dar 2 linhas
git diff --stat main..claude/ux-build-continuation-2hs0b2     # e 12 arquivos
```

---

## Caminho B — commitar a árvore à mão

Use se preferir não mexer com bundle. O zip traz a árvore inteira do projeto,
já com os dois builds aplicados. O que se perde aqui é a separação: vira **um**
commit, e não dois.

```bash
cd <sua cópia do clipcontext>
git checkout -b claude/ux-build-continuation-2hs0b2 origin/main
# copie por cima o conteúdo do zip (tudo menos a pasta _commit/)
git add -A
git commit          # as duas mensagens estão em _commit/MENSAGENS-DOS-COMMITS.txt
git push -u origin claude/ux-build-continuation-2hs0b2
```

`ARQUIVOS-MUDADOS.txt` lista o que tem de aparecer no `git status`. Se aparecer
mais do que isso, alguma sobra do ambiente entrou junto — confira antes de
commitar.

---

## O que NÃO está no zip, e por quê

`node_modules`, `.next`, `.git`, `.env*`, `emitir-licenca.py` e `PLANO-TIME.md`,
que é o que o `testes/naovai.txt` manda ficar de fora. Os dois últimos guardam
chaves privadas e nunca viajam no pacote. Confira você também, não confie:

```bash
unzip -l walkstamp-builds-4-e-7.zip | grep -cE 'emitir-licenca|PLANO-TIME|node_modules|/\.next/|\.env'
```

Tem que dar zero.

## Antes de rodar a régua na sua máquina

Os vídeos de amostra não viajam no zip, por peso. Gere-os uma vez:

```bash
bash testes/preparar.sh          # confere o que falta e gera as amostras
bash testes/rapido.sh app        # a esteira curta da ferramenta
```

`parar.mjs` precisa de `/tmp/fala-longa.webm` — cinco minutos de vídeo, que o
`preparar.sh` gera junto com os outros. Sem ffmpeg no caminho ele avisa, e o
teste cai com `ENOENT`.

**Três testes do grupo `app` não passam sem o site de pé** (`barraapp`,
`paridade` e `roteiro`): eles falam com o Next em `localhost`, e o
`rapido.sh app` sobe a esteira com `SITE=0`. Isso é anterior a estes builds —
para rodá-los, use `bash testes/rodar.sh`, que levanta o Next antes.

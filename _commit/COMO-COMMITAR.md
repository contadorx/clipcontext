# Como pôr este build no git

O commit já existe — ele só não pôde ser enviado daqui: esta sessão tem acesso
**somente leitura** ao `contadorx/clipcontext`, e o `git push` e a API do GitHub
respondem 403. Então ele viaja neste zip, de dois jeitos. Escolha um.

Commit: `6c06c9d` · branch `claude/ux-build-continuation-2hs0b2` · base `f505ea8`
(que é o `main` de onde ele saiu).

---

## Caminho A — trazer o commit inteiro (recomendado)

Preserva a mensagem, a autoria e o pai certo. Você não recommita nada: só puxa.

Na sua cópia do repositório, com o `main` em `f505ea8` (ou mais novo, desde que
ele contenha esse commit):

```bash
cd <sua cópia do clipcontext>
git fetch /caminho/para/_commit/build4.bundle \
    claude/ux-build-continuation-2hs0b2:claude/ux-build-continuation-2hs0b2
git push -u origin claude/ux-build-continuation-2hs0b2
```

Se o `git fetch` reclamar que falta o `f505ea8`, é porque a sua cópia está atrás:
`git fetch origin main` primeiro.

Conferir antes de enviar:

```bash
git log --oneline main..claude/ux-build-continuation-2hs0b2   # tem que dar 1 linha
git diff --stat main..claude/ux-build-continuation-2hs0b2     # e 11 arquivos
```

---

## Caminho B — commitar a árvore à mão

Use se preferir não mexer com bundle. O zip traz a árvore inteira do projeto,
já com o build aplicado; o que falta é o commit.

```bash
cd <sua cópia do clipcontext>
git checkout -b claude/ux-build-continuation-2hs0b2 origin/main
# copie por cima o conteúdo do zip (tudo menos a pasta _commit/)
git add -A
git commit -F /caminho/para/_commit/MENSAGEM-DO-COMMIT.txt
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
unzip -l walkstamp-build4.zip | grep -cE 'emitir-licenca|PLANO-TIME|node_modules|/\.next/|\.env'
```

Tem que dar zero.

## Antes de rodar a régua na sua máquina

Os vídeos de amostra não viajam no zip, por peso. Gere-os uma vez:

```bash
bash testes/preparar.sh          # confere o que falta e gera as amostras
bash testes/rapido.sh app        # a esteira curta da ferramenta
```

`parar.mjs`, a régua deste build, precisa de `/tmp/fala-longa.webm` — cinco
minutos de vídeo, que o `preparar.sh` gera junto com os outros. Sem ffmpeg no
caminho ele avisa, e o teste cai com `ENOENT`.

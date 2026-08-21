# Como aplicar estas correções

Elas saem de `285d4a5`, que é o `main` que está em produção agora. São dois
commits:

| commit | o quê |
|---|---|
| `f0857ba` | a caixa do roteiro, o índice que omitia passos, a esteira que mentia |
| `8a5dc38` | tira do repositório `_commit/` e o `public/sitemap.xml` antigo |

**O segundo tem efeito em produção e é o mais urgente.** Ver o fim deste
arquivo.

---

## Caminho A — o bundle (recomendado)

Traz os dois commits com mensagem e autoria, e sai direto do `main` atual.

```bash
cd <sua cópia do clipcontext>
git fetch origin main
git fetch /caminho/para/APLICAR/correcoes.bundle \
    claude/ux-build-continuation-2hs0b2:correcoes
git log --oneline main..correcoes     # tem que dar 2 linhas
git checkout main && git merge correcoes
git push origin main
```

## Caminho B — o patch só da fonte

Use se preferir aplicar à mão. Ele toca só `src/` e `testes/` — os arquivos
gerados (`public/app.html`, `offline/`) saem do `build.py`, e as duas remoções
você faz com dois comandos.

```bash
cd <sua cópia do clipcontext>
git checkout -b correcoes main
git am /caminho/para/APLICAR/correcoes-so-fonte.patch
git rm -r _commit
python3 build.py      # regenera os artefatos E apaga o public/sitemap.xml
git add -A && git commit -m "correcoes"
git push origin main
```

---

## Por que o `public/sitemap.xml` precisa sair

Não é limpeza. O `build.py` apaga esse arquivo de propósito, e o comentário
dele diz por quê: `/sitemap.xml` deixou de ser um arquivo e virou um **índice
servido pelo Next**, apontando para dois mapas — o das páginas, que é fixo, e
o do **blog**, que é lido do banco a cada rastreio.

Um arquivo estático chamado `sitemap.xml` dentro de `public/` sombreia essa
rota, porque no Next o estático ganha. Com ele no repositório, o próximo deploy
serve o mapa velho e congelado, e **todo post publicado pelo painel fica fora
do sitemap** — em silêncio, sem erro nenhum, até alguém reparar.

Ele voltou porque aplicar a árvore à mão não carrega deleções: copiar por cima
acrescenta e substitui, nunca apaga. Rodar `python3 build.py` depois de aplicar
resolve sozinho — é a linha que faltou da última vez.

## E a pasta `_commit/`

Eram os andaimes que eu mandei junto do zip (guia, mensagens, dois bundles) e
o `git add -A` varreu para dentro do repositório. Andaime, não produto. Neste
pacote eles vêm numa pasta `APLICAR/` **fora** da árvore do projeto, para o
acidente não se repetir.

## Antes de rodar a régua

```bash
bash testes/preparar.sh      # gera as amostras de vídeo
bash testes/rapido.sh app    # agora termina inteira verde: 31 arquivos
```

`barraapp`, `paridade` e `roteiro` saíram do grupo `app` e foram para o `site`,
que sobe o Next antes — era por isso que a pista curta acabava em vermelho toda
vez sem haver defeito nenhum.

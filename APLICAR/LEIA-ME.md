# Como aplicar

Saem de `285d4a5`, o `main` que está em produção. Quatro commits:

| commit | o quê | urgência |
|---|---|---|
| `f0857ba` | caixa do roteiro, índice que omitia passos, esteira que mentia | normal |
| `8a5dc38` | tira `_commit/` e o `public/sitemap.xml` antigo | **alta** — SEO do blog |
| `1a53f66` | figura do blog não subia (teto do Next em 1 MB) | **alta** — bloqueia publicar |
| `d7b3260` | Build 8, metade 1: resumo da conferência e o desfazer | normal |

## Caminho A — o bundle

```bash
cd <sua cópia do clipcontext>
git fetch origin main
git fetch /caminho/para/APLICAR/correcoes.bundle \
    claude/ux-build-continuation-2hs0b2:correcoes
git log --oneline main..correcoes     # tem que dar 4 linhas
git checkout main && git merge correcoes
git push origin main
```

## Caminho B — o patch da fonte

```bash
git checkout -b correcoes main
git am /caminho/para/APLICAR/correcoes-so-fonte.patch
git rm -r _commit
python3 build.py      # regenera os artefatos E apaga o public/sitemap.xml
git add -A && git commit -m "correcoes"
git push origin main
```

## Dois que precisam de mais que o merge

**A figura do blog precisa de DEPLOY.** O `next.config.mjs` só é lido quando o
servidor sobe. Até lá, o contorno é exportar a figura abaixo de 1 MB. Depois do
deploy, uma figura de ~2 MB tem que subir.

**O sitemap precisa do `build.py`.** Aplicar árvore por cima nunca apaga nada, e
foi por isso que o `public/sitemap.xml` voltou. Enquanto ele existir, o estático
sombreia a rota `/sitemap.xml` no Next e todo post do blog fica fora do mapa.

## A régua

```bash
bash testes/preparar.sh      # gera as amostras de vídeo
bash testes/rapido.sh app    # 32 arquivos, termina inteira verde
```

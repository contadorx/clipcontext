# Como aplicar

Saem de `285d4a5`, o `main` em produção. Seis commits:

| commit | o quê | urgência |
|---|---|---|
| `f0857ba` | caixa do roteiro, índice que omitia passos, esteira que mentia | normal |
| `8a5dc38` | tira `_commit/` e o `public/sitemap.xml` antigo | **alta** — SEO do blog |
| `1a53f66` | figura do blog não subia (teto do Next em 1 MB) | **alta** — bloqueia publicar |
| `d7b3260` | Build 8: resumo da conferência e o desfazer que faltava | normal |
| `d75c452` | Build 8: a perna curta — fala e identificação viram painéis | normal |
| `082a091` | contagem do LEIA-ME | normal |

## Caminho A — o bundle

```bash
cd <sua cópia do clipcontext>
git fetch origin main
git fetch /caminho/para/APLICAR/correcoes.bundle \
    claude/ux-build-continuation-2hs0b2:correcoes
git log --oneline main..correcoes     # tem que dar 6 linhas
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
sombreia a rota `/sitemap.xml` e todo post do blog fica fora do mapa.

## Uma mudança na régua que vale conhecer

Cinquenta arquivos passaram a importar o Chromium de `testes/_navegador.mjs`, e
não de `playwright`. Ele é o mesmo navegador com uma linha a mais: abre os
painéis recolhidos do passo 3, porque o Playwright recusa dirigir um elemento
dentro de um `<details>` fechado.

**Teste novo que dirige `#tr`, `#evBox` ou algo dentro daqueles painéis:
importe de `./_navegador.mjs`. Teste sobre a tela como ela abre: importe de
`playwright`.** Está escrito também no `testes/LEIA-ME.md`.

## A régua

```bash
bash testes/preparar.sh      # gera as amostras de vídeo
bash testes/rapido.sh app    # 34 arquivos, termina inteira verde
```

Fora da pista curta, três falham só por falta de ambiente neste container e não
por defeito: `capitulos` (sem `pdftotext`), `verificador` e os que falam com o
Next (`rapido.sh site` e `rodar.sh` sobem o servidor antes).

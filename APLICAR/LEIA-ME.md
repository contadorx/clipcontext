# Como aplicar estas correções

Saem de `285d4a5`, o `main` que está em produção. São três commits:

| commit | o quê | urgência |
|---|---|---|
| `f0857ba` | caixa do roteiro, índice que omitia passos, esteira que mentia | normal |
| `8a5dc38` | tira `_commit/` e o `public/sitemap.xml` antigo | **alta** — SEO do blog |
| `1a53f66` | a figura do blog não subia: teto do Next em 1 MB | **alta** — bloqueia publicar |

Os dois últimos são de produção e não esperam.

---

## Caminho A — o bundle (recomendado)

```bash
cd <sua cópia do clipcontext>
git fetch origin main
git fetch /caminho/para/APLICAR/correcoes.bundle \
    claude/ux-build-continuation-2hs0b2:correcoes
git log --oneline main..correcoes     # tem que dar 3 linhas
git checkout main && git merge correcoes
git push origin main
```

## Caminho B — o patch da fonte

Toca `src/`, `testes/`, `lib/`, `app/` e o `next.config.mjs`. Os artefatos
(`public/app.html`, `offline/`) saem do `build.py`.

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

## O da figura precisa de DEPLOY, não só de merge

`next.config.mjs` só é lido quando o servidor sobe. Enquanto o deploy não sair,
a figura acima de 1 MB continua devolvendo "a server error occurred".

**Enquanto isso, o contorno é exportar a figura abaixo de 1 MB.** Um post bem
servido raramente precisa de mais que 300 KB, então na prática quase nada muda
— o teto de 8 MB existe para o dia em que alguém arrastar um PNG cru de captura
4K.

Depois do deploy, dá para conferir sem adivinhar: uma figura de ~2 MB tem que
subir. Se ainda falhar, o teto não pegou — confira se a chave ficou dentro de
`experimental`, que é onde o Next 16 lê.

## O do sitemap precisa de `build.py`

`public/sitemap.xml` voltou ao repositório na aplicação manual anterior. O
`build.py` apaga esse arquivo de propósito: `/sitemap.xml` é um **índice
servido pelo Next**, que aponta para o mapa das páginas e para o do **blog**,
lido do banco a cada rastreio. Um estático com esse nome sombreia a rota — no
Next o estático ganha — e todo post publicado pelo painel fica fora do sitemap,
em silêncio.

Aplicar árvore por cima nunca apaga nada; por isso ele voltou. Rodar
`python3 build.py` depois de aplicar resolve sozinho.

## Antes de rodar a régua

```bash
bash testes/preparar.sh      # gera as amostras de vídeo
bash testes/rapido.sh app    # termina inteira verde: 32 arquivos
```

`figura.mjs` é a régua nova do upload — ela não sobe servidor: lê o
`next.config.mjs` e o `lib/supabase/figura.ts` do disco e compara os dois tetos.
Era exatamente isso que faltava para o defeito não ter acontecido.

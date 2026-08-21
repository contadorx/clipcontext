# O que fazer com este zip

O zip é a **árvore inteira, pronta**: a do `walkstampbuild8_1.zip` mais o A0
aplicado e construído. `public/app.html` e `offline/walkstamp-offline.html` já
saíram do `build.py`; não precisa rodar nada para ver funcionando.

## Se você só quer subir

Copie por cima da sua cópia e suba. Os gerados já estão certos.

## Se você prefere o patch (revisável, 22 arquivos)

Está em `APLICAR/A0-saida-recomendada.patch`:

```bash
git apply --check APLICAR/A0-saida-recomendada.patch   # confere sem escrever
git apply         APLICAR/A0-saida-recomendada.patch
```

O `--check` só passa se a sua árvore for a do `walkstampbuild8_1.zip`. Se
reclamar, me diga o que ele disse.

## O que este build acrescenta

Antes do catálogo de formatos aparece **Recomendado para o seu caso** — o
formato que o cenário pede, o segundo como alternativa, e uma linha dizendo o
porquê. Os outros onze ficam atrás de **Ver todos os formatos**, a um clique,
com o estado lembrado.

O botão recomendado **clica o botão que já existe**: qualquer trava, aviso ou
confirmação do original continua valendo, e nenhuma lógica de geração foi
duplicada.

## Duas coisas que continuam com você

- **sitemap** — precisa do `build.py` depois de aplicar os seis commits do
  `correcoes.bundle` (não deste zip);
- **figura do blog** — precisa de deploy; até lá, exportar abaixo de 1 MB.

## Uma amostra que faltava na régua

`parar.mjs` acusava `ENOENT /tmp/fala-longa.webm`. Não era defeito: é a amostra
do vídeo longo, que o `amostras.py` só gera com `--longo`. Depois de gerada, a
régua passa — o build 4 está verde.

```bash
python3 testes/amostras.py --longo
```

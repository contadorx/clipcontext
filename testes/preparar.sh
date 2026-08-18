#!/bin/bash
# Aponta a regressão para ONDE o projeto realmente está.
#
# Os testes nasceram em /tmp com o caminho do projeto escrito por extenso. Isso
# funcionava numa máquina só e sumia junto com ela: o zip entregue não levava
# teste nenhum, e quem abrisse o pacote em outro lugar herdava o produto sem a
# rede que prova que ele funciona.
#
# Agora eles moram no projeto e este script os reapruma no primeiro uso.
# Rodar duas vezes não faz mal: a segunda não encontra nada para trocar.
set -e
AQUI="$(cd "$(dirname "$0")" && pwd)"
RAIZ="$(dirname "$AQUI")"
ANTIGO="/root/cc/walkstamp"
n=0
if [ "$RAIZ" = "$ANTIGO" ]; then
  echo "já está no lugar de origem: nada a reapontar"
else
  for f in "$AQUI"/*.mjs "$AQUI"/*.sh; do
    [ -f "$f" ] || continue
    [ "$f" = "$AQUI/preparar.sh" ] && continue
    if grep -q "$ANTIGO" "$f"; then sed -i "s|$ANTIGO|$RAIZ|g" "$f"; n=$((n+1)); fi
  done
fi
echo "reapontados $n arquivos para $RAIZ"

# Os vídeos de amostra que sete testes carregam de /tmp. Sem eles a esteira
# acusa ENOENT — e ENOENT na saída da esteira é indistinguível de defeito do
# produto para quem acabou de abrir o zip.
python3 "$AQUI/amostras.py" || echo "  (amostras não geradas — falta ffmpeg ou Pillow?)"
echo
echo "agora:  bash $AQUI/rapido.sh app     # a esteira curta da ferramenta"
echo "        bash $AQUI/rodar.sh          # a regressão inteira (~40 min)"

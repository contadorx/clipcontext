#!/bin/bash
# Monta o vídeo da rodada paga a partir do bruto.
#
# Acelera SÓ a extração — a barra de progresso entre `scanIni` e `scanFim`.
# É o mesmo corte do tour, pelo mesmo motivo: o que se pula é literalmente uma
# barra andando, e acelerar o resto seria mentir sobre a velocidade da
# ferramenta. Os cliques, a tabela da rodada, o recibo e a confirmação ficam em
# 1x, porque é neles que está o assunto.
set -e
L="$1"
RAIZ="${RAIZ:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
BRUTO="/tmp/roteiro-bruto-$L.webm"
MARCAS="/tmp/roteiro-marcas-$L.json"
DEST="$RAIZ/public/demo"
[ -f "$BRUTO" ] || { echo "falta $BRUTO"; exit 1; }
mkdir -p "$DEST"

INI=$(python3 -c "import json;print(json.load(open('$MARCAS'))['scanIni'])")
FIM=$(python3 -c "import json;print(json.load(open('$MARCAS'))['scanFim'])")
VEL=4.0

W=/tmp/mr-$L
rm -rf $W && mkdir -p $W
ffmpeg -y -v error -i "$BRUTO" -t "$INI" \
  -c:v libvpx-vp9 -crf 30 -b:v 0 -cpu-used 4 -an $W/a.webm
ffmpeg -y -v error -ss "$INI" -to "$FIM" -i "$BRUTO" \
  -vf "setpts=PTS/$VEL" -r 25 -c:v libvpx-vp9 -crf 30 -b:v 0 -cpu-used 4 -an $W/b.webm
ffmpeg -y -v error -ss "$FIM" -i "$BRUTO" \
  -c:v libvpx-vp9 -crf 30 -b:v 0 -cpu-used 4 -an $W/c.webm

printf "file '$W/a.webm'\nfile '$W/b.webm'\nfile '$W/c.webm'\n" > $W/lista.txt
ffmpeg -y -v error -f concat -safe 0 -i $W/lista.txt -c copy $W/junto.webm

ffmpeg -y -v error -i $W/junto.webm \
  -c:v libvpx-vp9 -b:v 0 -crf 41 -row-mt 1 -deadline good -cpu-used 3 -pix_fmt yuv420p \
  -an "$DEST/rodada.$L.webm"
ffmpeg -y -v error -i $W/junto.webm \
  -c:v libx264 -profile:v baseline -level 3.1 -crf 31 -preset slow -pix_fmt yuv420p \
  -movflags +faststart -an "$DEST/rodada.$L.mp4"
# O cartaz: a tabela da rodada já pintada, e não a tela pela metade do carregamento.
ffmpeg -y -v error -ss 6.5 -i $W/junto.webm -frames:v 1 -q:v 3 "$DEST/rodada.$L.jpg"

D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$DEST/rodada.$L.webm")
printf '%s  %ss  webm %s  mp4 %s  jpg %s\n' "$L" "${D%.*}" \
  "$(du -h "$DEST/rodada.$L.webm" | cut -f1)" \
  "$(du -h "$DEST/rodada.$L.mp4" | cut -f1)" \
  "$(du -h "$DEST/rodada.$L.jpg" | cut -f1)"
rm -rf $W

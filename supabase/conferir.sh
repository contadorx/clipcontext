#!/bin/sh
# Confere cada migração contra o md5 do que a BASE diz que aplicou.
# `$(cat)` come as quebras finais dos dois lados, então o arquivo pode terminar
# com newline (como todo arquivo de texto deve) sem a conferência reclamar.
cd "$(dirname "$0")" || exit 1
ok=0; falta=0; mau=0
while read -r md5 arq; do
  [ -z "$arq" ] && continue
  if [ ! -f "migrations/$arq" ]; then printf '  FALTA  %s\n' "$arq"; falta=$((falta+1)); continue; fi
  got=$(printf '%s' "$(cat "migrations/$arq")" | md5sum | cut -d' ' -f1)
  if [ "$got" = "$md5" ]; then ok=$((ok+1))
  else printf '  DIFERE %s\n     esperado %s\n     obtido   %s\n' "$arq" "$md5" "$got"; mau=$((mau+1)); fi
done < MANIFESTO.md5
# E O QUE O MANIFESTO NEM OLHA — 28/08.
#
# Medido: 46 linhas no manifesto para 54 migrações no disco. As oito de fora
# não eram "erradas", eram INVISÍVEIS: o conferidor dizia "46 conferem, 0
# faltam, 0 diferem" e ia embora verde, enquanto oito arquivos podiam mudar à
# vontade. Um portão que aprova por vazio é pior do que portão nenhum, porque
# ninguém desconfia do verde.
#
# Agora o disco é comparado com o manifesto nos DOIS sentidos.
fora=0
for f in migrations/*.sql; do
  a=$(basename "$f")
  if ! cut -d' ' -f3- MANIFESTO.md5 | grep -qxF "$a"; then
    printf '  FORA   %s  (no disco, e o manifesto não olha)\n' "$a"; fora=$((fora+1))
  fi
done

printf '\n%d conferem, %d faltam, %d diferem, %d fora do manifesto\n' "$ok" "$falta" "$mau" "$fora"
[ "$falta" -eq 0 ] && [ "$mau" -eq 0 ] && [ "$fora" -eq 0 ]

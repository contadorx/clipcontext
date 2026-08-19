#!/bin/bash
# A pista rápida. `rodar.sh` roda os 74 e leva ~20 min; isto roda só o que o
# que você mexeu pode ter quebrado, e leva 1 a 3.
#
#   rapido.sh app        -> a ferramenta (build + os testes de tela)
#   rapido.sh site       -> o site (build + next build + os testes de página)
#   rapido.sh a.mjs b.mjs -> exatamente esses
#
# Com 2 CPUs, dois de cada vez é o teto: mais que isso e os testes começam a
# estourar o tempo por disputa de máquina, não por defeito.
cd /root/walkstamp || exit 1
GRUPO="$1"; shift

case "$GRUPO" in
  app)  TESTES="smoke.mjs saidas.mjs passos.mjs dobra.mjs travado.mjs gravando.mjs
                janelinha.mjs comentario.mjs marcados.mjs revisao.mjs marca.mjs
                formato.mjs promptcx.mjs appidioma.mjs compartilhar.mjs celular.mjs barraapp.mjs paridade.mjs teto.mjs ritmo.mjs rolar.mjs cenario1.mjs organiza.mjs acabamento.mjs lente2.mjs memoria.mjs pesagem.mjs espelho.mjs modelo.mjs espera.mjs" ; SITE=0 ;;
  site) TESTES="cinco.mjs ajuda.mjs vitrine.mjs venda.mjs paginas.mjs idiomas.mjs figuras.mjs dobrafig.mjs
                linkpage.mjs legal.mjs contradicao.mjs negocio.mjs isca.mjs blog.mjs convite.mjs email.mjs tourvid.mjs semmarca.mjs" ; SITE=1 ;;
  *)    TESTES="$GRUPO $*" ; SITE=1 ;;
esac

echo "montando…"
python3 build.py > /tmp/build.log 2>&1 || { echo "build.py falhou:"; tail -5 /tmp/build.log; exit 1; }
if [ "$SITE" = 1 ]; then
  npx next build > /tmp/nextbuild.log 2>&1 || { echo "next build falhou:"; tail -12 /tmp/nextbuild.log; exit 1; }
  fuser -k 8802/tcp 2>/dev/null; sleep 1
  npx next start -p 8802 > /tmp/next.log 2>&1 &
  NEXT=$!
  trap 'kill $NEXT 2>/dev/null' EXIT
  for i in $(seq 1 30); do curl -sf -o /dev/null http://localhost:8802/precos && break; sleep 1; done
fi

cd "$(cd "$(dirname "$0")" && pwd)"
printf '%s\n' $TESTES | xargs -P 2 -I{} sh -c '
  s=$(timeout 400 node "{}" 2>&1)
  if [ $? -eq 0 ]; then printf "%-18s ok\n" "{}"
  else printf "%-18s FALHOU\n" "{}"; echo "$s" | grep -E "FALHA|Error" | head -4 | sed "s/^/     /"; fi' 2>&1

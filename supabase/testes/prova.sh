#!/bin/sh
# ============================================================================
# A PROVA DO BANCO, inteira, num comando.
#
#   1. reconstrói o esquema do zero, só com o que está no Git;
#   2. compara a impressão digital do resultado com `esperado.txt`;
#   3. roda a prova de comportamento das funções.
#
# Ela responde a pergunta do B3 — "se a base sumir hoje, o repositório a
# levanta de novo?" — com um código de saída, e não com um parágrafo.
#
#   uso:  PGHOST=/tmp/pgsock PGPORT=5433 sh supabase/testes/prova.sh
#
# Precisa de um Postgres 15+ acessível como superusuário. Ele NÃO fala com a
# produção: o banco é local, descartável, e é criado e destruído aqui.
# ============================================================================
set -e
AQUI=$(cd "$(dirname "$0")" && pwd)
BANCO=${BANCO:-walkstamp_prova}
: "${PGHOST:=/tmp/pgsock}" "${PGPORT:=5433}" "${PGUSER:=postgres}"
export PGHOST PGPORT PGUSER BANCO

if ! psql -Atc 'select 1' postgres >/dev/null 2>&1; then
  echo "sem Postgres em $PGHOST:$PGPORT — a prova do banco NAO rodou"; exit 1
fi

echo "[1] reconstruindo do zero"
sh "$AQUI/reconstruir.sh" "$BANCO" | sed 's/^/     /'

echo "[2] conferindo a impressao digital do esquema"
# `/tmp` escrito a mao nao serve: esta prova roda como o usuario do Postgres, e
# um `/tmp/impressao.diff` que sobrou de outra execucao, de outro dono, faz a
# prova falhar por permissao e relatar "O ESQUEMA MUDOU" — que e um diagnostico
# falso, e o pior tipo: ele manda mexer no esquema.
: "${TMPDIR:=/tmp}"
psql -F'  ' -A -t -f "$AQUI/impressao.sql" "$BANCO" > "$TMPDIR/impressao-obtida.txt"
if diff -u "$AQUI/esperado.txt" "$TMPDIR/impressao-obtida.txt" > "$TMPDIR/impressao.diff"; then
  sed 's/^/     ok   /' "$AQUI/esperado.txt"
else
  echo "     O ESQUEMA MUDOU. esperado a esquerda, obtido a direita:"
  sed 's/^/     /' "$TMPDIR/impressao.diff"
  echo
  echo "     Se a mudanca for de proposito, regenere a expectativa:"
  echo "       psql -F'  ' -A -t -f $AQUI/impressao.sql $BANCO > $AQUI/esperado.txt"
  exit 1
fi

echo "[3] provando o comportamento das funcoes"
# O CANO ENGOLIA O VEREDITO.
#
# Isto era `psql ... | sed | sed`, e em `sh` o `$?` de um cano e o do ULTIMO
# comando — o `sed`, que sempre da zero. Com `set -e` ligado e tudo. O efeito
# medido: uma afirmacao de comportamento reprovando, o ERROR aparecendo na
# tela, e o script terminando com "Prova do banco: passou." e codigo 0.
#
# Um portao que imprime o erro e devolve sucesso e pior que portao nenhum: a
# esteira fica verde e quem le aprende a nao ler. E o mesmo defeito do
# `build.py | head`, no lugar onde ele custa mais.
if psql -q -v ON_ERROR_STOP=1 -f "$AQUI/10-fumaca.sql" "$BANCO" > "$TMPDIR/fumaca.log" 2>&1; then
  sed 's/^psql:[^ ]* NOTICE:  //' "$TMPDIR/fumaca.log" | sed 's/^/     /'
else
  sed 's/^psql:[^ ]* NOTICE:  //' "$TMPDIR/fumaca.log" | sed 's/^/     /'
  echo
  echo "Prova do banco: REPROVOU no comportamento das funcoes."
  exit 1
fi

echo
echo "Prova do banco: passou."

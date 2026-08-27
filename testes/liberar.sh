#!/bin/bash
# A PISTA DE LIBERAÇÃO — o que basta para um build sair.
#
# A regressão inteira leva ~70 minutos. Rodá-la a cada build cobra uma hora e
# dez de espera por uma mudança de duas linhas, e o custo real disso não é o
# relógio: é que a espera ensina a pular a régua.
#
# Esta pista responde outra pergunta. Não "o produto inteiro está de pé?", e sim
# **"o que este build mexeu continua verdadeiro?"**. Ela roda em três partes:
#
#   0. O CHÃO — `build.py` e o TypeScript. Se um dos dois cai, nada mais importa.
#   1. OS CONTRATOS — doze réguas estáticas, sem navegador e sem servidor, em
#      catorze segundos. São as que pegam lista paralela, promessa órfã, chave
#      de idioma faltando, marca de terceiro e inventário de teste. É o tipo de
#      defeito que mais custou a este projeto, e o mais barato de conferir.
#   2. O QUE O DIFF PEDE — as réguas que cobrem os arquivos que ESTE build
#      tocou, e só elas. A tabela está logo abaixo, escrita à mão de propósito:
#      uma associação errada aqui é visível; um `grep` esperto seria invisível.
#
# O QUE ELA NÃO É. Ela não substitui `rodar.sh`. Ela libera um build; a
# regressão inteira responde por uma entrega. Rode a longa antes de publicar, e
# esta durante o trabalho.
#
#   bash testes/liberar.sh                # contra o último commit
#   bash testes/liberar.sh origin/main    # contra outra base
#   bash testes/liberar.sh --tudo         # ignora o diff e roda o mapa inteiro
set -u
AQUI="$(cd "$(dirname "$0")" && pwd)"
RAIZ="$(dirname "$AQUI")"
cd "$RAIZ" || exit 1

BASE="${1:-HEAD}"
TUDO=0
[ "$BASE" = "--tudo" ] && { TUDO=1; BASE=HEAD; }

# ---- 2. o mapa: arquivo tocado -> réguas que o cobram ----------------------
# `padrão => réguas`. O padrão é ERE, casado contra o caminho relativo.
# O separador é `=>` e não `|`: `|` é a alternância do próprio ERE, e um padrão
# como `(doc|home)` era partido ao meio pelo `IFS` — o `grep` reclamava de
# parêntese sem par e a linha inteira não casava com nada. Silencioso, do pior
# jeito: a régua simplesmente não rodava.
# Uma régua com o prefixo `site:` precisa do Next de pé — e é a presença de UMA
# delas que decide se vale pagar os dois minutos do `next build`.
# NADA AQUI DENTRO É EXPANDIDO PELO SHELL — 27/08.
# Este mapa era uma string entre aspas duplas, e as crases dos comentários eram
# substituição de comando: o bash executava `src/template.html`, `reabrir`,
# `juntar`, `indice`, `grade`, `anotacao`, `app` e `rapido.sh` toda vez que a
# esteira subia. Não quebrou nada porque nenhum deles existe como comando — e
# esse é exatamente o problema: bastava um comentário citar um comando que
# existe para a porta de liberação rodá-lo. O heredoc com o delimitador entre
# aspas simples não expande crase, $ nem nada.
read -r -d '' MAPA <<'MAPA_FIM'
# `src/template.html` É O PRODUTO. Seis réguas não o cobrem — este mapa nasceu
# com elas e o Build 2 provou a falha: mexer nos quatro caminhos destrutivos e na
# largura do índice do .zip não acionou `reabrir`, `juntar`, `indice`, `grade`
# nem `anotacao`, que são exatamente as que afirmam sobre isso. Quem toca o
# produto roda o grupo do produto — é o `app` do `rapido.sh`, sem servidor, e é
# o preço honesto de mexer no arquivo que faz tudo.
^src/template[.]html$ => semrede.mjs escolhas.mjs erro.mjs smoke.mjs saidas.mjs passos.mjs dobra.mjs travado.mjs gravando.mjs janelinha.mjs comentario.mjs marcados.mjs revisao.mjs marca.mjs formato.mjs promptcx.mjs appidioma.mjs compartilhar.mjs celular.mjs teto.mjs cenario1.mjs organiza.mjs acabamento.mjs lente2.mjs traducao.mjs passomulti.mjs pessoas.mjs matriz.mjs conclusao.mjs parar.mjs entrada.mjs indice.mjs figura.mjs resumo.mjs perna.mjs cartao.mjs etapas.mjs marcos.mjs semundefined.mjs reabrir.mjs juntar.mjs juntos.mjs grade.mjs anotacao.mjs trocar.mjs varredura.mjs descarte.mjs clipe.mjs numeros.mjs vocab.mjs foco.mjs apoio.mjs nitidez.mjs versoes.mjs marcar.mjs janelinha.mjs emissor.mjs
^src/features[.]json$ => planos.mjs promessa.mjs site:precos.mjs
^src/i18n-conta[.]json$ => chaves.mjs site:compra.mjs site:cancelar.mjs site:meusdados.mjs
^src/i18n-site[.]json$ => chaves.mjs site:cinco.mjs site:contradicao.mjs site:buscaajuda.mjs
# A PÁGINA TOCADA CHAMA A RÉGUA DELA — 27/08.
# A linha genérica abaixo era a única cobertura de `src/site/bodies/`, e ela não
# nomeia `precos.mjs` — a régua da página que tem mais afirmação por metro
# quadrado do site. Mexer na calculadora de ROI nos cinco idiomas saía verde
# sem a régua da calculadora rodar. O mapa acumula todas as linhas que casam,
# então estas somam com a genérica em vez de substituí-la.
^src/site/bodies/precos[.] => site:precos.mjs venda.mjs
^src/site/bodies/(termos|privacidade)[.] => site:legal.mjs
^src/site/bodies/seguranca[.] => site:legal.mjs matriz.mjs
^src/site/bodies/comparativo[.] => comparar.mjs
^src/site/bodies/caso[A-Za-z]*[.] => site:vitrine.mjs cenarios.mjs
^src/site/bodies/ajuda[.] => site:ajuda.mjs site:buscaajuda.mjs
^src/site/bodies/verificar[.] => verificador.mjs
^src/site/bodies/ => folha.mjs site:paginas.mjs site:legal.mjs site:ajuda.mjs site:vitrine.mjs site:compra.mjs site:buscaajuda.mjs
^src/site/(doc|home)[.]html$ => site:paginas.mjs site:cinco.mjs
^src/site/support[.]js$ => site:ficha.mjs site:paginas.mjs site:buscaajuda.mjs
^src/versoes[.]json$ => versoes.mjs
^build[.]py$ => versoes.mjs figuras.mjs cartao.mjs promessa.mjs planos.mjs auditoria.mjs site:precos.mjs site:compra.mjs
^src/rotas[.]json$ => middleware.mjs site:idiomas.mjs site:paginas.mjs
^middleware[.]ts$ => middleware.mjs
^next[.]config[.]mjs$ => site:paginas.mjs site:seo.mjs
^app/conta/ => site:compra.mjs site:negocio.mjs entrada2.mjs site:cancelar.mjs site:meusdados.mjs
^app/ => site:paginas.mjs site:seo.mjs site:negocio.mjs
^public/site[.]css$ => site:estreito.mjs site:paginas.mjs site:dobra.mjs site:buscaajuda.mjs
^src/site/(doc|home)[.]html$ => site:estreito.mjs site:paginas.mjs site:cabecalho.mjs
^next[.]config[.]mjs$ => site:csp.mjs site:cabecalho.mjs site:paginas.mjs
^lib/planilha[.]ts$ => bomba.mjs site:roteiro.mjs
^lib/stripe[.]ts$ => site:precos.mjs promessa.mjs site:compra.mjs renovar.mjs site:cancelar.mjs
^app/api/convite/ => site:convite.mjs site:email.mjs
^lib/ => site:paginas.mjs site:buscaajuda.mjs
^public/sw[.]js$ => site:seo.mjs
^public/site[.]css$ => folha.mjs site:paginas.mjs site:dobrafig.mjs
^offline/ => site:medicao.mjs
^supabase/migrations/ => modelopessoal.mjs conferir-migracoes
^testes/ => inventario.mjs
MAPA_FIM

# ---- 1. os contratos: sempre, e são catorze segundos ------------------------
CONTRATOS="auditoria.mjs folha.mjs modelopessoal.mjs renovar.mjs numeros.mjs chaves.mjs faxina.mjs figura.mjs funil.mjs inventario.mjs middleware.mjs
           planos.mjs promessa.mjs semmarca.mjs stripehook.mjs terceiros.mjs wer.mjs"

# ----------------------------------------------------------------------------
falhou=""
rodados=""
pulados=""

echo "[0] o chão"
printf '  %-24s ' 'build.py'
if python3 build.py > /tmp/liberar-build.log 2>&1; then echo ok
else echo FALHOU; tail -6 /tmp/liberar-build.log | sed 's/^/     /'; falhou="$falhou build.py"; fi

printf '  %-24s ' 'tsc --noEmit'
if npx tsc --noEmit > /tmp/liberar-tsc.log 2>&1; then echo ok
else echo FALHOU; tail -8 /tmp/liberar-tsc.log | sed 's/^/     /'; falhou="$falhou tsc"; fi

[ -n "$falhou" ] && { echo; echo "o chão caiu:$falhou — o resto não vale nada agora."; exit 1; }

# ---- quais arquivos este build tocou ---------------------------------------
if [ "$TUDO" = 1 ]; then
  echo
  echo "[·] --tudo: o diff foi ignorado, o mapa inteiro vai rodar"
  TOCADOS=""
else
  TOCADOS="$(git diff --name-only "$BASE" 2>/dev/null; git diff --name-only --cached 2>/dev/null; git ls-files --others --exclude-standard 2>/dev/null)"
  TOCADOS="$(printf '%s\n' "$TOCADOS" | sort -u | grep -v '^$')"
  echo
  echo "[·] $(printf '%s\n' "$TOCADOS" | grep -c . ) arquivo(s) tocados desde $BASE"
fi

# ---- monta a lista derivada do mapa ----------------------------------------
DERIVADAS=""
PRECISA_SITE=0
while read -r linha; do
  [ -z "${linha:-}" ] && continue
  # Comentário dentro do mapa é comentário, e não padrão. Sem esta linha ele
  # virava um ERE que o `grep` tentava casar — silencioso enquanto não casasse
  # nada, e um erro de sintaxe no dia em que alguém escrevesse um parêntese.
  case "$linha" in \#*) continue ;; esac
  case "$linha" in *"=>"*) ;; *) continue ;; esac
  padrao="${linha%%=>*}"; padrao="${padrao% }"
  reguas="${linha#*=>}"
  if [ "$TUDO" = 1 ]; then casou=1
  else casou=0; printf '%s\n' "$TOCADOS" | grep -qE "$padrao" && casou=1; fi
  [ "$casou" = 0 ] && continue
  for r in $reguas; do
    case "$r" in site:*) PRECISA_SITE=1; r="${r#site:}" ;; esac
    case " $DERIVADAS " in *" $r "*) ;; *) DERIVADAS="$DERIVADAS $r" ;; esac
  done
done <<EOF
$(printf '%s\n' "$MAPA" | grep -v '^$')
EOF

echo
echo "[1] os contratos — sem navegador, sem servidor"
for t in $CONTRATOS; do
  printf '  %-24s ' "$t"
  if saida=$(timeout 180 node "$AQUI/$t" 2>&1); then
    if printf '%s\n' "$saida" | grep -q "^PULADO"; then
      echo PULADO; printf '%s\n' "$saida" | grep "^PULADO" | head -1 | sed 's/^PULADO  */       por que: /'
      pulados="$pulados $t"
    else echo ok; rodados="$rodados $t"; fi
  else echo FALHOU; echo "$saida" | grep -E 'FALHA|Error' | head -4 | sed 's/^/     /'; falhou="$falhou $t"; fi
done

# a régua das migrações não é um .mjs
case " $DERIVADAS " in *" conferir-migracoes "*)
  printf '  %-24s ' 'migrações × MANIFESTO'
  if saida=$(sh supabase/conferir.sh 2>&1); then echo ok
  else echo FALHOU; echo "$saida" | tail -5 | sed 's/^/     /'; falhou="$falhou conferir.sh"; fi
  DERIVADAS="$(printf '%s' "$DERIVADAS" | sed 's/ conferir-migracoes//')"
;; esac

# tira do derivado o que os contratos já rodaram
RESTO=""
for r in $DERIVADAS; do
  case " $CONTRATOS " in *" $r "*) continue ;; esac
  RESTO="$RESTO $r"
done

if [ -z "$(printf '%s' "$RESTO" | tr -d ' ')" ]; then
  echo
  echo "[2] o diff não pede régua nenhuma além dos contratos."
else
  if [ "$PRECISA_SITE" = 1 ]; then
    echo
    echo "[2] subindo o Next em :8802 — alguma régua deste diff fala com o site"
    if npx next build > /tmp/liberar-next.log 2>&1; then
      fuser -k 8802/tcp >/dev/null 2>&1; sleep 1
      npx next start -p 8802 > /tmp/liberar-next-run.log 2>&1 &
      NEXT=$!
      trap 'kill $NEXT 2>/dev/null' EXIT
      for i in $(seq 1 30); do curl -sf -o /dev/null http://localhost:8802/precos && break; sleep 1; done
    else
      echo "  next build FALHOU:"; tail -12 /tmp/liberar-next.log | sed 's/^/     /'
      falhou="$falhou next-build"
    fi
  else
    echo
    echo "[2] as réguas que este diff pede"
  fi
  for t in $RESTO; do
    [ -f "$AQUI/$t" ] || { echo "  ??  $t não existe no disco"; continue; }
    printf '  %-24s ' "$t"
    if saida=$(timeout 400 node "$AQUI/$t" 2>&1); then
      if printf '%s\n' "$saida" | grep -q "^PULADO"; then
        echo PULADO; printf '%s\n' "$saida" | grep "^PULADO" | head -1 | sed 's/^PULADO  */       por que: /'
        pulados="$pulados $t"
      else echo ok; rodados="$rodados $t"; fi
    else echo FALHOU; echo "$saida" | grep -E 'FALHA|Error' | head -4 | sed 's/^/     /'; falhou="$falhou $t"; fi
  done
fi

# ---- o que NÃO rodou, dito com todas as letras -----------------------------
# Um recorte silencioso lê-se como "cobri tudo". Esta pista cobre o diff, e o
# número do que ficou de fora é a diferença entre liberar um build e entregar.
# Os mesmos três instrumentos que o `inventario.mjs` declara — senão dois
# lugares do projeto respondem números diferentes para a mesma pergunta, que é
# o defeito que o `inventario.mjs` existe para impedir.
total=$(ls "$AQUI"/*.mjs | grep -vE '/(_|shot|dbg)' \
        | grep -vE '/(proxy|regua|gerar-dpa|capturar)[.]mjs$' | wc -l)
n_rodados=$(printf '%s\n' $rodados | sort -u | grep -c .)
n_pul=$(printf '%s\n' $pulados | grep -c .)
echo
echo "rodaram $n_rodados de $total réguas. As outras $((total - n_rodados)) ficaram de fora"
echo "de propósito: este diff não as toca. Antes de PUBLICAR, rode 'bash testes/rodar.sh'."
# Um pulado não entra em `rodados`: ele não rodou. Dizê-lo aqui é o que impede
# a pista de contar como cobertura o que não foi exercitado.
[ "$n_pul" -gt 0 ] && echo "E $n_pul PULARAM (não contam como cobertura):$pulados"

if [ -n "$falhou" ]; then
  echo
  echo "Falharam:$falhou"
  exit 1
fi
echo
echo "Pista de liberação: verde. O build pode sair."

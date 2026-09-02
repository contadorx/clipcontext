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
# `src/template.html` É O PRODUTO, e o grupo dele é PERGUNTADO AO DISCO.
#
# Esta linha listava SESSENTA E UM nomes à mão, e a lista estava errada dos dois
# lados — medido em 29/08: sete dos listados nem leem o produto, e CINQUENTA E
# QUATRO réguas que leem ficaram de fora. Era a lista paralela de sempre, com a
# agravante de morar no corredor que decide se um build sai.
#
# `grupo:produto` se expande em quem lê `app.html` ou o pacote offline, menos os
# instrumentos. São 124 das 175, e sim: mexer no arquivo que faz tudo custa ~15
# minutos em vez de ~8. É o preço honesto de mexer no arquivo que faz tudo, e
# agora ele é o preço CERTO — antes eram 8 minutos sobre a lista errada.
#
# Quem quiser o corredor curto tem `bash testes/liberar.sh --tudo` para o
# oposto, e o `rapido.sh app` para um pedaço.
^src/template[.]html$ => grupo:produto
^src/features[.]json$ => planos.mjs promessa.mjs site:precos.mjs
^src/i18n-conta[.]json$ => chaves.mjs site:compra.mjs site:cancelar.mjs site:meusdados.mjs marcos-a11y.mjs
^src/i18n-site[.]json$ => chaves.mjs site:cinco.mjs site:contradicao.mjs site:buscaajuda.mjs
# A PÁGINA TOCADA CHAMA A RÉGUA DELA — 27/08.
# A linha genérica abaixo era a única cobertura de `src/site/bodies/`, e ela não
# nomeia `precos.mjs` — a régua da página que tem mais afirmação por metro
# quadrado do site. Mexer na calculadora de ROI nos cinco idiomas saía verde
# sem a régua da calculadora rodar. O mapa acumula todas as linhas que casam,
# então estas somam com a genérica em vez de substituí-la.
^src/site/bodies/precos[.] => site:precos.mjs venda.mjs
^src/site/bodies/(termos|privacidade)[.] => site:legal.mjs prazos.mjs
^src/site/bodies/seguranca[.] => site:legal.mjs matriz.mjs egressao.mjs
^src/site/bodies/comparativo[.] => comparar.mjs
^src/site/bodies/caso[A-Za-z]*[.] => site:vitrine.mjs cenarios.mjs
^src/site/bodies/ajuda[.] => site:ajuda.mjs site:buscaajuda.mjs
^src/site/bodies/verificar[.] => verificador.mjs
^src/site/bodies/ => folha.mjs site:paginas.mjs site:legal.mjs site:ajuda.mjs site:vitrine.mjs site:compra.mjs site:buscaajuda.mjs
^src/site/(doc|home)[.]html$ => site:paginas.mjs site:cinco.mjs
^src/site/support[.]js$ => site:ficha.mjs site:paginas.mjs site:buscaajuda.mjs
^src/versoes[.]json$ => versoes.mjs
^build[.]py$ => versoes.mjs figuras.mjs cartao.mjs promessa.mjs planos.mjs auditoria.mjs site:precos.mjs site:compra.mjs prazos.mjs
^src/egressao[.]json$ => egressao.mjs terceiros.mjs site:paginas.mjs
^src/rotas[.]json$ => middleware.mjs site:idiomas.mjs site:paginas.mjs
^middleware[.]ts$ => middleware.mjs
^next[.]config[.]mjs$ => site:paginas.mjs site:seo.mjs
# O PAINEL TOCADO CHAMA A RÉGUA DO PAINEL — 28/08.
# O `portal.mjs` — que É a régua da área do cliente: assentos, convite,
# faturas, padrões, modelos e histórico — não aparecia em linha nenhuma deste
# mapa. Mexer no `app/conta/acoes.ts` saía verde sem ela rodar, que é o mesmo
# defeito que a nota da `precos.mjs` acima descreve.
^app/conta/ => site:compra.mjs site:negocio.mjs entrada2.mjs site:cancelar.mjs site:meusdados.mjs marcos-a11y.mjs site:portal.mjs site:licauto.mjs
# Os três e-mails do produto saem do mesmo molde desde 28/08. Tocar o molde
# sem rodar a régua das cartas seria mudar o que chega na caixa de um cliente
# sem nada olhar — e em e-mail o defeito é invisível de dentro.
^lib/(carta[.]ts|email[.]ts|conta/(convite-assento|aviso-chamado)[.]ts)$ => site:email.mjs site:convite.mjs site:portal.mjs
^app/ => site:paginas.mjs site:seo.mjs site:negocio.mjs
^public/site[.]css$ => site:estreito.mjs site:paginas.mjs site:dobra.mjs site:buscaajuda.mjs
^src/site/(doc|home)[.]html$ => site:estreito.mjs site:paginas.mjs site:cabecalho.mjs marcos-a11y.mjs
^next[.]config[.]mjs$ => site:csp.mjs site:cabecalho.mjs site:paginas.mjs site:csprelato.mjs
# A política e o endereço de relatório são uma coisa só: a política pode existir
# e não apontar para lugar nenhum — foi exatamente o defeito de origem.
^app/api/csp/ => site:csprelato.mjs
# O IMPORTADOR, O VOCABULÁRIO DELE E A PONTE PARA A FERRAMENTA — 28/08.
# As colunas de condição atravessam quatro arquivos: quem adivinha o mapa, quem
# normaliza a reexecução, quem monta o link do caso e a régua que prova as três
# coisas. Mexer num sem rodar a `roteiro.mjs` foi como o índice posicional da
# planilha de volta sobreviveu até quatro colunas novas o empurrarem de lugar.
^lib/planilha[.]ts$ => bomba.mjs site:roteiro.mjs
^lib/(reexecucao[.]ts|conta/roteiro[.]ts)$ => site:roteiro.mjs bomba.mjs
^app/conta/(planilha/|roteiro-acoes[.]ts)|^app/conta/\[lang\]/roteiro/ => site:roteiro.mjs site:roteirojanela.mjs
^lib/stripe[.]ts$ => site:precos.mjs promessa.mjs site:compra.mjs renovar.mjs site:cancelar.mjs
^app/api/convite/ => site:convite.mjs site:email.mjs
# O chamado ganhou rota própria em 29/08, e ela tem as mesmas travas do
# convite: origem antes de segredo, limite por quem chama. Quem toca a rota,
# a fonte que a chama ou a migração que fechou o caminho velho, roda a régua.
^app/api/chamado/|^lib/daCasa[.]ts$|^src/site/support[.]js$ => site:chamadorota.mjs site:ficha.mjs site:convite.mjs
^lib/ => site:paginas.mjs site:buscaajuda.mjs
^public/sw[.]js$ => site:seo.mjs
^public/site[.]css$ => folha.mjs site:paginas.mjs site:dobrafig.mjs
^offline/ => site:medicao.mjs offlineb.mjs egressao.mjs
^supabase/functions/ => edge.mjs
# A migração do vocabulário trouxe dado NOVO para o servidor, e dado novo é
# assunto de duas telas que já existiam: a sessão dentro da ferramenta e a
# página que diz o que guardamos de alguém. Esquecer a segunda é o jeito
# silencioso de a política de privacidade virar mentira.
^supabase/migrations/ => modelopessoal.mjs conferir-migracoes prazos.mjs site:meusdados.mjs sessao.mjs
# AS OITO QUE SOBRARAM — 29/08.
# Depois de o grupo do produto virar pergunta ao disco, restaram oito réguas que
# nenhum padrão alcançava. Elas não leem `app.html`: falam com o SITE e com o
# painel, e cada uma tem um dono claro quando se pergunta sobre o que ela afirma.
# O que sobra de verdade agora é zero — e o teto do `inventario.mjs` guarda isso.
^app/conta/\[lang\]/chamados|^lib/conta/aviso-chamado[.]ts$ => site:chamadoconta.mjs
^app/(blog|conta/\[lang\]/negocio)/|^lib/blog[.]ts$ => site:blog.mjs
^src/i18n-site[.]json$ => site:tabelas.mjs
^public/site[.]css$|^src/site/doc[.]html$ => site:paridade.mjs
^src/rotas[.]json$ => site:isca.mjs
^public/sw[.]js$|^app/manifest|^src/site/ => site:linkpage.mjs
^public/demo/|^lib/site[.]ts$ => site:tourvid.mjs
^vendor/ => onda4.mjs
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
  N_TOCADOS=$(printf '%s\n' "$TOCADOS" | grep -c .)
  echo "[·] $N_TOCADOS arquivo(s) tocados desde $BASE"
  # ---- DIFF VAZIO NÃO É BUILD VERDE — 29/08 ----
  # Comitar antes de rodar esta esteira faz o diff contra `HEAD` encolher para
  # quase nada, e ela responde "verde" sobre um punhado de réguas em vez de
  # sobre o build. Aconteceu comigo: comitei para não deixar trabalho solto, a
  # pista disse "3 arquivos tocados", e eu quase levei aquele verde.
  # O conserto é dizer, e não adivinhar: quem já comitou passa a base.
  if [ "$N_TOCADOS" -eq 0 ]; then
    echo
    echo "não há nada a comparar com $BASE — provavelmente o build já foi comitado."
    echo "rode contra o commit anterior:  bash testes/liberar.sh HEAD~1"
    echo "ou o corredor inteiro:          bash testes/liberar.sh --tudo"
    exit 1
  fi
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
    # O GRUPO DO PRODUTO É DERIVADO, e não escrito. Quem lê `app.html` ou o
    # pacote offline afirma sobre o produto; os instrumentos ficam de fora
    # porque não afirmam nada. E o servidor sobe junto: parte deles precisa
    # dele, e subir um Next que ninguém usa custa segundos — não subir o que
    # alguém usa custa um vermelho que não é defeito.
    if [ "$r" = "grupo:produto" ]; then
      PRECISA_SITE=1
      antes_do_grupo=$(printf '%s' "$DERIVADAS" | wc -w)
      for g in $(grep -l -E "app\.html|walkstamp-offline\.html" "$AQUI"/*.mjs \
                 | xargs -n1 basename | grep -vE '^(_|shot|proxy|regua|gerar-dpa|capturar)'); do
        case " $DERIVADAS " in *" $g "*) ;; *) DERIVADAS="$DERIVADAS $g" ;; esac
      done
      # UM GRUPO VAZIO É MAPA QUEBRADO, E NÃO DIFF PEQUENO. Se o `grep` acima
      # deixar de casar — um caminho que mudou, uma aspa a mais —, o corredor
      # rodaria os contratos e diria "verde" sobre o arquivo que faz tudo. É a
      # mesma aprovação por vazio que o conferidor de migrações fazia, e ela não
      # pode voltar por uma linha de shell.
      if [ "$(printf '%s' "$DERIVADAS" | wc -w)" -le "$antes_do_grupo" ]; then
        echo "o grupo do produto expandiu para NADA — o mapa está quebrado."
        echo "  confira o grep de 'app.html' em $AQUI/*.mjs dentro do liberar.sh."
        exit 1
      fi
      continue
    fi
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

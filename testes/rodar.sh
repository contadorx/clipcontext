#!/bin/bash
# Regressão do Walkstamp. Os `shot*` e `dbg*` são de inspeção visual e de
# diagnóstico — não entram, porque não afirmam nada.
#
# O site virou Next.js. Sete testes deixaram de ler `public/` e passaram a falar
# com um Next de verdade na 8802 — por isso ele sobe aqui, uma vez, antes de tudo.
# A raiz vem de onde ESTE arquivo está, e não escrita por extenso: a suíte
# inteira deixou de depender de uma máquina só.
cd "$(dirname "$(cd "$(dirname "$0")" && pwd)")" || exit 1
echo "montando a ferramenta e o site…"
python3 build.py > /tmp/build.log 2>&1 || { echo "build.py falhou:"; cat /tmp/build.log; exit 1; }
npx next build > /tmp/nextbuild.log 2>&1 || { echo "next build falhou:"; tail -20 /tmp/nextbuild.log; exit 1; }
fuser -k 8802/tcp 2>/dev/null; sleep 1
npx next start -p 8802 > /tmp/next.log 2>&1 &
NEXT=$!
for i in $(seq 1 30); do
  curl -sf -o /dev/null http://localhost:8802/precos && break
  sleep 1
done
trap 'kill $NEXT 2>/dev/null' EXIT

cd "$(cd "$(dirname "$0")" && pwd)"
TESTES="smoke.mjs saidas.mjs passos.mjs evidencia.mjs modelos.mjs cenarios.mjs
         juntos.mjs reabrir.mjs trocar.mjs scorm.mjs pptx.mjs miudos.mjs miudos2.mjs
         ignorar.mjs tarjaauto.mjs revisao.mjs multiidioma.mjs
         clipe.mjs canais.mjs capitulos.mjs comparar.mjs
         juntar.mjs webcam.mjs portal.mjs chamadoconta.mjs cabecalho.mjs seo.mjs stripehook.mjs ux.mjs ficha.mjs sessao.mjs
         onda1.mjs onda2.mjs onda4.mjs
         destaque.mjs tapado.mjs marcados.mjs traducao.mjs vocab.mjs jira.mjs
         idiomas.mjs paginas.mjs linkpage.mjs timepag.mjs licenca.mjs liclink.mjs
         licauto.mjs medicao.mjs legal.mjs a11y.mjs dobra.mjs pdfev.mjs
         semframes.mjs semsom.mjs repetido.mjs pausa.mjs curta.mjs retrato.mjs
         hostil.mjs preview.mjs rodada.mjs linhas.mjs verificador.mjs
         venda.mjs vitrine.mjs fluxo.mjs roteiro.mjs faxina.mjs formato.mjs comentario.mjs
         travado.mjs promptcx.mjs cabec.mjs ajuda.mjs cinco.mjs appidioma.mjs gravando.mjs janelinha.mjs marca.mjs figuras.mjs dobrafig.mjs
         compartilhar.mjs contradicao.mjs negocio.mjs celular.mjs barraapp.mjs paridade.mjs teto.mjs ritmo.mjs rolar.mjs isca.mjs blog.mjs cenario1.mjs organiza.mjs acabamento.mjs convite.mjs email.mjs tourvid.mjs semmarca.mjs lente2.mjs
         memoria.mjs pesagem.mjs espelho.mjs grade.mjs varredura.mjs audio.mjs plano.mjs faixa.mjs reuniao.mjs diagchamado.mjs modelo.mjs espera.mjs passomulti.mjs pessoas.mjs matriz.mjs espera2.mjs anotacao.mjs roteirojanela.mjs quedaplaca.mjs conclusao.mjs parar.mjs entrada.mjs indice.mjs figura.mjs resumo.mjs perna.mjs saidarec.mjs chaves.mjs planos.mjs promessa.mjs voltadocaso.mjs cartao.mjs etapas.mjs marcos.mjs funil.mjs wer.mjs
         terceiros.mjs precos.mjs semundefined.mjs middleware.mjs inventario.mjs descarte.mjs"
# EM PARALELO, E COM O NÚMERO SAINDO DA MÁQUINA.
#
# Ela rodava um de cada vez: setenta minutos, com três dos quatro núcleos desta
# máquina parados a maior parte do tempo. O custo não é o relógio — é que uma
# espera de setenta minutos por build ensina a pular a régua, e uma régua que se
# aprende a pular já não é régua.
#
# O TETO VEM DA MÁQUINA, e não escrito à mão. Cada teste sobe um Chromium; com
# mais processos que núcleos, eles disputam CPU e começam a estourar o `timeout`
# por lentidão, não por defeito — que é o pior vermelho possível, porque parece
# defeito. `nproc - 1` deixa um núcleo para o Next, que está de pé ao lado.
# `PARALELO=1` volta ao comportamento serial, para depurar uma corrida.
NUCLEOS=$(nproc 2>/dev/null || echo 2)
PARALELO="${PARALELO:-$(( NUCLEOS > 1 ? NUCLEOS - 1 : 1 ))}"
echo "rodando $PARALELO de cada vez ($NUCLEOS núcleos)"
echo

# A SAÍDA CONTINUA LEGÍVEL. Cada teste escreve num arquivo próprio e o relatório
# é montado na ordem da lista no fim — misturar a saída de três processos numa
# tela só é como não ter saída.
SAIDAS="$(mktemp -d)"
trap 'rm -rf "$SAIDAS"' EXIT
export SAIDAS

# O TICKER, porque vinte minutos de silêncio não são melhores que setenta de
# ruído. Cada teste que termina imprime UMA linha, na ordem em que acabou, com
# o placar parcial. O relatório ordenado vem depois; isto aqui só existe para
# quem está olhando saber que a máquina está viva e quanto falta.
TOTAL=$(printf '%s\n' $TESTES | grep -c .)
export TOTAL
printf '%s\n' $TESTES | xargs -P "$PARALELO" -I{} sh -c '
  t="{}"
  if [ ! -f "$t" ]; then printf "ausente\n" > "$SAIDAS/$t.estado"; exit 0; fi
  s=$(timeout 400 node "$t" 2>&1); c=$?
  printf "%s\n" "$s" > "$SAIDAS/$t.log"
  if [ "$c" = 0 ]; then printf "ok\n" > "$SAIDAS/$t.estado"
  else printf "FALHOU\n" > "$SAIDAS/$t.estado"; fi
  feitos=$(ls "$SAIDAS" | grep -c "[.]estado$")
  estado=$(cat "$SAIDAS/$t.estado")
  # O placar parcial só aparece na linha de quem FALHOU. Repeti-lo em toda
  # linha verde seria um aviso que se aprende a rolar para baixo — o mesmo
  # defeito que esta suíte já registrou duas vezes.
  extra=""
  if [ "$estado" != ok ]; then
    maus=$(grep -l FALHOU "$SAIDAS"/*.estado 2>/dev/null | grep -c .)
    extra="   ($maus vermelha[s] até aqui)"
  fi
  printf "  %3s/%s  %-22s %s%s\n" "$feitos" "$TOTAL" "$t" "$estado" "$extra"
' 2>&1

echo
echo "---- o relatório, na ordem da lista ----"
echo

falhou=""
for t in $TESTES; do
  estado=$(cat "$SAIDAS/$t.estado" 2>/dev/null || echo FALHOU)
  case "$estado" in
    ausente) echo "??  $t não existe"; continue ;;
    ok)      printf '%-20s ok\n' "$t" ;;
    *)       printf '%-20s FALHOU\n' "$t"
             grep -E 'FALHA|Error|error:' "$SAIDAS/$t.log" 2>/dev/null | head -6 | sed 's/^/      /'
             falhou="$falhou $t" ;;
  esac
  # O rodapé de quem tem terceiro estado (ok / FALHOU / PULADO) é a única linha
  # que precisa sobreviver a um teste VERDE — senão o pulado passa despercebido,
  # que é o defeito que ter o terceiro estado existe para impedir.
  grep -E 'PULADA|PULADO' "$SAIDAS/$t.log" 2>/dev/null | tail -1 | sed 's/^/      /'
done
echo
if [ -z "$falhou" ]; then
  echo "Regressão inteira: verde."
  exit 0
fi
# A ESTEIRA SAI DIFERENTE DE ZERO. Ela imprimia os que falharam e saía 0 — o que
# deixa verde um pipeline que só olha o código de saída, com dez réguas
# vermelhas na tela. Um vermelho que não reprova é um vermelho que se aprende a
# rolar para baixo.
echo "Falharam:$falhou"
exit 1

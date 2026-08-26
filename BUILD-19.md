# Build 19 — A fidelidade da evidência é decidida na captura

**Data:** 26/08/2026
**Origem:** a mesma queixa de campo do Build 16, repetida três vezes:
*"a imagem continua ruim"*.

---

## Primeiro: eu diagnostiquei errado, e a medição me corrigiu

No relatório anterior eu afirmei que **PNG é menor que JPEG e sem perda**, e
propus escolher o formato do arquivo pelo tamanho. Estava errado.

Aquela medição foi feita **a partir do canvas limpo — fora da cadeia real.** Na
cadeia real o quadro passa por WebP com perda ANTES de virar arquivo, e um PNG
feito depois disso não recupera nada: guarda o ruído do codificador anterior,
com fidelidade perfeita e preço de sem-perda.

Medido na cadeia inteira, a 1920×1080:

| tela | memória | por quadro | fidelidade | → PNG | → JPEG |
|---|---|---|---|---|---|
| painel de sistema | q0,85 | 42,5 KB | 45,99 dB | **250,8 KB** | 96,1 KB |
| painel de sistema | **q1 sem perda** | 184,3 KB | **exato** | 130,4 KB | 94,2 KB |
| tela fotográfica | q0,85 | 741 KB | 38,46 dB | 4.055 KB | 711 KB |
| tela fotográfica | q1 sem perda | 2.191 KB | exato | 2.978 KB | 716 KB |

Leia a primeira linha: 250,8 KB para preservar exatamente o que o JPEG
entregava em 96,1 KB — os dois igualmente aproximados. O PNG ali não estava
salvando a evidência; estava embalando o estrago com esmero.

**A lição é geral e ficou escrita no código:** medir um elo isolado responde
sobre o elo, e não sobre a corrente.

Também confirmei, pixel a pixel e não pelo nome do parâmetro, que
`toBlob(..., 'image/webp', 1)` no Chrome é **sem perda de verdade**.

---

## O conserto: a decisão sobe para a captura

Cada quadro tenta o WebP **sem perda** primeiro. Se passar do teto, cai para o
q0,85 de antes. O arquivo então **obedece à memória**: exato sai PNG,
aproximado sai JPEG.

Escolher o formato do arquivo pelo menor tamanho — o que eu tinha proposto —
escreveria JPEG por cima de um quadro exato, jogando fora no último metro a
fidelidade que a captura acabou de pagar quatro vezes mais caro para ter.

**O teto é POR PIXEL, e não em bytes absolutos.** Um teto que coubesse num
painel de 1080p recusaria o mesmo painel em 4K — que é exatamente onde a
fidelidade mais vale. Por pixel, os dois casos ficam a mais de dez vezes de
distância e a régua vale em toda tela:

```
painel de sistema   0,089 B/px          tela fotográfica   1,08 B/px
                         teto: 0,30 B/px
```

Medido ao vivo, com captura de tela de verdade:

| tela | por quadro | decisão | arquivo no pacote |
|---|---|---|---|
| painel de sistema | 0,093 B/px | **sem perda — exato** | `.png` 125 KB |
| tela fotográfica | 0,366 B/px | com perda | `.jpg` 730 KB |

---

## O custo caiu num eixo que eu não esperava

| | Build 16 | Build 19 |
|---|---|---|
| FPS durante a gravação | 55,6 | **58,7** |
| fio principal bloqueado | 794 ms em 25 s · 3,2% | **33 ms em 25 s · 0,1%** |
| por quadro | 42,1 KB | 141,8 KB |
| projeção em 300 quadros | 12,3 MB | 41,5 MB |

**O bloqueio do fio principal caiu 24 vezes.** Codificar sem perda é mais
barato do que codificar com perda: não há busca de taxa-distorção. O preço da
evidência exata é memória, e não fluidez.

---

## Mais três, no mesmo assunto

**O `getDisplayMedia` passou a pedir a resolução.** Não havia largura nem
altura: o Build 16 fez o quadro ter a medida do stream, mas o stream era o que
o navegador resolvesse entregar. O alvo sai da tela de quem grava
(`screen.width × devicePixelRatio`), com `resizeMode:'none'`.

Como `ideal`, e nunca `exact` nem `min`: `ideal` é um pedido, e um pedido não
atendido simplesmente não é atendido. `exact` seria uma exigência, e uma
exigência não atendida derruba a captura inteira com `OverconstrainedError` —
trocar imagem fraca por gravação nenhuma não é conserto.

**O diagnóstico publica os três números.** A tela da máquina, o que o navegador
entregou, o tamanho do quadro, e quantos saíram sem perda. Esta pergunta custou
três rodadas de investigação, e a resposta inteira cabia em três números que o
produto sabia e não dizia.

**Oito listas paralelas morreram.** `.jpg` estava escrito à mão em oito lugares
— PDF ×2, ZIP ×2, Word ×2, PowerPoint ×2. Enquanto havia um formato só, as
oito cópias não podiam divergir; com dois, seriam oito chances de o documento
anunciar `.jpg` e carregar um PNG dentro. Agora há uma função só. No caminho
apareceu uma declaração `png` duplicada no PowerPoint, removida.

---

## Duas réguas minhas estavam erradas, e as duas ficam escritas

**1 · Afirmei um palpite.** Escrevi que *"um vídeo já comprimido não vira
quadro sem perda"*, supondo que o ruído do codec de vídeo poria toda tela acima
do teto. Não põe: as cenas da amostra são áreas de cor chapada e continuam
quase chapadas depois do WebM — 0,019 a 0,293 B/px, todas dentro do teto. A
regra discrimina por **conteúdo** e não por procedência, que é melhor do que eu
tinha suposto. A afirmação saiu.

**2 · Quatro afirmações liam o TEXTO da fonte.** Instalei o defeito inteiro —
desliguei o caminho sem-perda com um `if (false)` — e **todas passaram**,
porque as linhas continuavam escritas ali dentro, mortas. Texto prova que
alguém escreveu; só comportamento prova que roda. Entrou a afirmação que
faltava, e com o defeito instalado ela reprova:

```
     0 de 3 sem perda   0.020 · 0.019 · 0.020 B/px
  FALHA  e o caminho sem-perda é de fato TOMADO, e não só escrito  → 0 de 3 quadros
```

**A régua foi provada reprovando em quatro defeitos:**

| defeito instalado | o que ela disse |
|---|---|
| teto afrouxado para 9,00 B/px | `com um teto declarado entre 0 e 1 byte por pixel → 9` |
| caminho sem-perda desligado | `o caminho sem-perda é de fato TOMADO → 0 de 3 quadros` |
| arquivo escolhido por tamanho | `o arquivo obedece à memória, em vez de escolher pelo tamanho` |
| constraint como exigência | `pede como ideal, nunca como exigência` |

E uma régua antiga foi re-derivada pela terceira vez, desta vez para morrer:
`pesagem.mjs` afirmava um teto em bytes por quadro. Ele existia para pegar o
retorno ao base64 no heap. **Deixou de servir:** um quadro sem perda legítimo
pesa ~142 KB, e o mesmo quadro como base64 de JPEG pesaria ~128 KB — menos. O
teto passou a reprovar o certo e aprovar o errado. Saiu, e ficou a linha que
sempre foi a de verdade (base64 mora no heap, Blob não) mais a invariante nova
por pixel.

---

## Arquivos

| arquivo | o que mudou |
|---|---|
| `src/template.html` | `TETO_SEM_PERDA`; `novaImagem` tenta sem-perda primeiro; `paraArquivo` obedece à memória; `FORMATOS_DOC`/`extDe`/`nomeNoPacote`/`prepararArquivos`; `getDisplayMedia` pede resolução; três números no diagnóstico |
| `testes/nitidez.mjs` | três blocos novos — fidelidade, constraint, diagnóstico |
| `testes/pesagem.mjs` | o teto em bytes morreu; entrou a invariante por pixel |

Nada de site, nada de banco, nenhuma migração.

---

## O que isto muda para quem usa

O documento **fica maior**: um painel de sistema sai em PNG exato (125 KB por
quadro contra 96 KB de JPEG aproximado), e a sessão na memória vai de 12,3 MB
para 41,5 MB em 300 quadros. É a escolha deliberada — exato acima de pequeno —
e o teto por pixel é o que impede isso de virar 657 MB numa gravação de
conteúdo fotográfico.

**E continua valendo:** publicar os Builds 16–19 é o que leva a evidência de
26,18 dB (o material relatado, feito na `v2026.08.24-3`) para exata. A maior
parte desse salto é o Build 16, que está pronto e verde desde 24/08.

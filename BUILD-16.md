# Build 16 — O quadro tem a medida da tela

**Data:** 24/08/2026
**Origem:** queixa de campo, uma frase: *"um usuário viu que as imagens estão
ruins"*. Não estava na fila. Passou na frente porque é impedimento: um produto
de evidência cuja evidência não se lê não tem o que vender.

---

## O defeito, escrito em número redondo quatro vezes

```js
snap(900, q)      // captura ao vivo
snap(900, q)      // captura pela janelinha
snap(900, q)      // extração automática
snap(900, q)      // captura manual na revisão
```

Toda tela virava 900 pixels de largura, viesse ela de onde viesse. E isso
errava nos **dois sentidos** — o segundo é o que ninguém tinha visto:

**Para baixo.** Uma tela de 1920 reduzida a 900 é uma redução de 2,1×, e o que
encolhe junto é a **altura da letra**. A fonte de 12 px de um sistema chega ao
documento com 5,6 px. Não é "a imagem ficou fraquinha": é o valor do campo que
a auditoria precisa ler deixando de existir no arquivo.

**Para cima.** Uma gravação de 640×360 — celular, janela pequena, vídeo
recebido de terceiro — era **esticada** até 900. O produto inventava 40% de
pixels que ninguém filmou. Medido nas amostras da régua, o retrato de 480×854
virava 900×1601:

| fonte | antes | depois | peso antes | peso depois |
|---|---|---|---|---|
| 1280×720 | 900×506 | **1280×720** | 8,3 KB | 12,7 KB |
| 640×360 | 900×506 | **640×360** | 9,0 KB | 6,2 KB |
| 480×854 (em pé) | 900×1601 | **480×854** | 19,0 KB | 11,2 KB |

Leia a última linha duas vezes: o arquivo **borrado era 70% mais pesado** que o
nítido. A constante não estava economizando nada ali — estava pagando caro para
piorar.

---

## A decisão, e o que ela custa

Você escolheu **nativo**, sem teto artificial. A medição que sustenta isso, na
tela sintética de 1920×1080 da régua de desempenho:

```
   quadros guardados                     35
   FPS durante a gravação                55.6   p50 16.7 ms, p95 20.6 ms
   bloqueio do fio principal             794 ms em 25 s (3.2%)
   custo de um quadro                    42.1 KB
      … no heap JavaScript (base64)      0.0 KB
      … fora do heap (Blob)              42.1 KB
   projeção no teto padrão (300)         12.3 MB
```

Três coisas que essa medição diz e que valem mais do que a opinião de que
"nativo é pesado":

1. **12,3 MB** para uma sessão inteira de 300 quadros a 1920. O pior caso, 4K
   com 300 quadros, projeta ~35 MB.
2. Os quadros são **Blob fora do heap** — 0,0 KB no heap JavaScript. Eles não
   disputam com o coletor de lixo a memória que aperta primeiro.
3. **55,6 FPS e 3,2% de fio principal bloqueado.** Capturar em nativo não
   custou fluidez de gravação.

O seletor de qualidade continua sendo a **compressão**, e agora ela age sobre
os pixels que existem em vez de sobre os que sobraram. Medido: 30,0 KB na
qualidade mais baixa contra 53,0 KB na mais alta, **na mesma largura**.

---

## A justificativa que a mudança inverteu

A mesma constante morava num quinto lugar — a tela **colada** (`Ctrl+V` ou
"Anexar uma tela") — com uma frase escrita ao lado:

> *"Redesenhada na mesma largura das outras: um print de 4K ao lado de quadros
> de 900 px sairia com outra escala no documento."*

A frase estava errada quando foi escrita, e depois desta mudança ficou
invertida. O PDF, o Word e o PPTX posicionam a imagem pela **proporção**
(`w/h`), nunca pela largura absoluta — foi conferido nos três geradores. Um
print de 4K e um quadro de 1920 ocupam **o mesmo espaço na página**; um está
nítido e o outro não. Com a captura em nativo, encolher só a tela colada
passou a ser a única coisa capaz de criar a diferença de escala que o
comentário dizia estar evitando.

Isto é o padrão que já apareceu em três builds seguidos com outro nome:
**premissa afirmada em comentário e não garantida em código**. Aqui ela era
pior — era premissa afirmada em comentário e *contrariada* pelo código ao lado.

---

## A régua nova: `testes/nitidez.mjs`

Ela afirma uma coisa só, e essa coisa **não tem número dentro**: o quadro tem a
medida da fonte. Escrita assim, reprova tanto quem repuser um teto quanto quem
repuser um piso, e não precisa ser reescrita quando a fonte mudar de tamanho —
que é exatamente o defeito que ela existe para impedir.

Três fontes de tamanhos deliberadamente diferentes, uma **mais estreita** que
os 900 antigos e uma **em pé**, mais a tela colada, mais o seletor de
qualidade, mais a fonte do produto.

**Ela foi provada reprovando.** Com a constante reinstalada, 7 afirmações caem
e a saída nomeia o culpado:

```
  FALHA  1280×720: o quadro sai com a medida da fonte  → [[900,506],[900,506],[900,506]]
  FALHA  480×854: o quadro sai com a medida da fonte  → [[900,1601],[900,1601],[900,1601]]
```

---

## Uma régua antiga re-derivada, e não afrouxada

`pesagem.mjs` afirmava *"um quadro custa menos de 60 KB"*. O número não era um
alvo: era a linha que separa "Blob de WebP" de "base64 de JPEG no heap" — a
regressão que a régua existe para pegar.

Com a captura em nativo os **dois lados sobem juntos**, porque são a mesma
imagem em formas diferentes. Manter os 60 antigos reprovaria uma tela densa sem
que nada estivesse errado — que é a maneira de um teste ensinar a ser ignorado.
A linha foi re-derivada, com a conta escrita ao lado dela no arquivo:

| | Blob (WebP) | base64 de JPEG |
|---|---|---|
| tela da régua, 1920 | 42 KB | ~112 KB |
| tela densa, 1920 | 64 KB | ~170 KB |

**90 KB** separa os dois regimes nas duas medições.

---

## Arquivos

| arquivo | o que mudou |
|---|---|
| `src/template.html` | `larguraNativa()`; `snap(w,q)` com `w=0` significando nativo; os quatro caminhos de captura; `inserirTela` sem o teto de 900 |
| `testes/nitidez.mjs` | **nova** — o quadro tem a medida da fonte |
| `testes/pesagem.mjs` | teto por quadro re-derivado: 60 → 90 KB, com a derivação escrita |
| `testes/rodar.sh`, `testes/liberar.sh`, `testes/LEIA-ME.md` | a régua nova registrada nas três listas |

Nada de servidor, nada de banco, nada de site. Nenhuma migração.

---

## Regressão

A regressão inteira, com a régua nova dentro:

```
152 ok · 4 PULADO · 0 FALHOU
Pulados: timepag.mjs licenca.mjs liclink.mjs licauto.mjs
```

Os quatro pulos são os de sempre e estão explicados no `LEIA-ME.md`:
`timepag.mjs` cobra uma página aposentada, e os três de licença precisam do
`emitir-licenca.py`, que guarda as chaves privadas e por isso não viaja no zip.
Um teste pulado não é um teste que passou — a cobertura é a dos 152.

A régua eram 155; agora são 156.

---

## O que eu faria em seguida

1. **Busca na Ajuda** — o último item aberto do Build 10 da fila. São 45
   painéis `<details>` e nenhuma busca: quem não sabe o nome do recurso não o
   encontra. É o mais fácil do que sobrou e o que ainda é impedimento de uso.
2. **Build 11 — motor e medição.** Nada ali é impedimento, mas a pergunta do
   funil de inglês (48 visitas, zero conversões) custa meia hora e agora tem
   como ser respondida.
3. **Build 12 — a dívida.** Nada que o usuário veja.

Continuam parados por sua instrução: **Stripe** (DEC-14) e **Drive** (DEC-15).

**Operacional, e ainda pendente do Build 10:** `CONVITE_SAL` é obrigatória na
Vercel. Sem ela o endpoint de convite responde 503 e o aplicativo cai para
`mailto:`.

# Build 18 — As versões de terceiros deixam de flutuar

**Data:** 25/08/2026
**Fila:** Build 11 — "fixar todas as versões, com manifesto testado".

---

## Antes de mais nada: a fila estava velha em três dos cinco itens

Medi o Build 11 inteiro contra o código antes de propor escopo. O resultado:

| item da fila | estado medido |
|---|---|
| `performance.mark()` em cada fronteira | **já feito** — 8 marcos (`modelo.inicio`, `modelo.degrau`, `modelo.pulou`, `modelo.pronto`, `modelo.desistiu`, `audio.decodificado`, `arquivo.lido`, `asr.estado`) e amostras versionadas por `MEDIDA_VER`. Falta a *campanha* na matriz de 1/10/40 min — tempo de máquina, não código |
| classificar o erro do `buildPipe()` e saltar ao fallback | **já feito** — `classificarQueda()` alimenta `pularDegrau()`, e a escada está ordenada por custo de download |
| avisar antes de um fallback caro | **já feito** — `tentandoCaro` nos cinco idiomas, dito *antes* e não durante |
| **fixar todas as versões** | **aberto — e pior do que a fila dizia** |
| a pergunta do funil de inglês | respondida abaixo |

É a terceira vez que a fila se prova velha ao ser medida. Ela é lista de
intenção, e o código é a lista de verdade.

---

## O defeito: o motor do produto podia trocar sozinho

O motor de voz não viaja no pacote — é importado de um CDN em tempo de uso:

```js
const TJS_BASES = [
  '…/@huggingface/transformers@3',       // major FLUTUANTE, e é o padrão
  '…/@huggingface/transformers@4.2.0',   // fixa
  '…/@huggingface/transformers'          // latest, sem versão nenhuma
];
```

**Duas das três podiam mudar por baixo do produto sem um commit.**

A primeira é a que roda em quase toda máquina: `@3` entrega hoje a **3.8.1**,
e a Hugging Face já publicou **34 versões 3.x** — qualquer 3.9 passaria a ser o
motor deste produto sem ninguém tocar em nada.

A terceira não tinha versão nenhuma. Ela é acionada **quando todas as outras já
falharam** — a pior hora possível para estrear uma biblioteca que ninguém
testou.

E o segundo achado, que a fila não previa: **ela nem era um salva-vidas.**
`latest` resolve hoje para a **mesma 4.2.0** da segunda linha. Três tentativas,
dois arquivos.

---

## O conserto: um manifesto, e três versões diferentes

```
antes:  @3     ·  @4.2.0  ·  (sem versão)
depois: 3.8.1  ·   4.2.0  ·  3.8.0
```

A lista saiu de dentro do template e virou **`src/versoes.json`**. O `build.py`
a escreve no produto pelo token `__TJSBASES__`; a régua confere contra ela.
Antes essa verdade morava em três lugares e nenhum era a fonte.

A ordem foi preservada, e a justificativa foi junto para o manifesto: numa
máquina Windows/Chrome 151 real a 4.2.0 falhava em toda configuração com
`MatMulNBits Missing required scale`, e a 3.x montou de primeira. **A ordem é
medição, não preferência pelo novo.**

**Fixar não mudou o que roda hoje** — `@3` já entregava 3.8.1. Mudou quem
decide: a atualização virou escolha com aviso em vez de acidente.

---

## O aviso, e a trava contra ele virar ruído

A régua consulta o npm e reprova quando existe versão mais nova — **mais nova
que `conferido_ate`, e não que a versão fixada.**

A diferença é tudo. Comparada com a fixada, a esteira ficaria vermelha no dia
em que a Hugging Face publicasse qualquer coisa, por um motivo que não é
defeito do produto — e uma régua que fica vermelha sozinha é uma régua que se
aprende a ignorar (o mesmo raciocínio que re-derivou o teto do `pesagem.mjs` no
Build 16, em vez de afrouxá-lo).

Comparada com `conferido_ate`, a reprovação diz uma coisa acionável: *existe
versão publicada que ninguém olhou*. Limpá-la é olhar, decidir e escrever a
decisão. Subir o número **sem** trocar a fila é uma decisão legítima e
registrada: quer dizer *"vi a 4.3 e fico na 3.8.1"*.

---

## A régua nova: `testes/versoes.mjs`

Quatro afirmações sobre o que o produto carrega e uma pergunta ao npm:

1. toda entrada tem versão exata — nada de `@3`, nada de sem-versão;
2. a lista do app é a do manifesto, na mesma ordem;
3. as três tentativas são três versões **diferentes**;
4. cada versão fixada **existe** no npm — uma versão com erro de digitação faz
   todos os degraus da escada falharem identicamente, com a rede aparecendo
   perfeita no diagnóstico: um defeito que se disfarça de máquina do usuário;
5. e o aviso do `conferido_ate`.

O pacote **offline** é conferido junto: ele carrega exatamente a mesma lista.
Se alguma versão ficasse para trás, seria justamente na cópia que ninguém
reconstrói.

**Sem rede a régua PULA o bloco do npm**, e não reprova: o pacote entregue tem
que rodar numa máquina sem saída para a internet.

**Provada reprovando, nos cinco defeitos:**

| defeito instalado | o que ela disse |
|---|---|
| versão flutuante (`@3`) | `toda entrada tem versão exata → …transformers@3` |
| manifesto ≠ produto | `app=3.8.1,… manifesto=3.7.6,…` |
| terceira igual à segunda | `as três tentativas são três versões diferentes → 3.8.1,4.2.0,4.2.0` |
| versão inexistente | `não existe(m): 3.8.99` |
| conferência atrasada | `4.2.0 é mais nova que a conferida (4.1.0)` |

---

## A pergunta do funil de inglês — e a premissa estava errada

A fila dizia: *"inglês abre 48 vezes e converte zero. Funil quebrado ou robôs?"*

| idioma | abriu | carregou vídeo | baixou saída |
|---|---|---|---|
| pt | 486 | 195 · 40% | 114 · **23%** |
| en | 64 | 7 · 11% | 2 · 3% |
| es | 10 | 0 | 0 |
| fr | 3 | 0 | 0 |
| **de** | **0** | — | — |

Não é zero: são 2. Mas o número por dia desmonta a pergunta:

| dias (en) | abriu | vídeo | baixou |
|---|---|---|---|
| 14–23/08 (dez dias) | 57 | 3 | 0 |
| **24/08** | 7 | 4 | **2** |

Num único dia o inglês converteu **2 de 7 aberturas — 29%, melhor que os 23%
do português**. Os outros dez dias somam 57 aberturas e três vídeos.

**O funil não está quebrado.** Quando um usuário de inglês de fato usa a
ferramenta, ele converte pelo menos tão bem quanto o de português. As 64
aberturas são, na maior parte, tráfego que não é público.

**O achado que ninguém tinha visto: o alemão tem zero aberturas.** O site está
no ar em alemão desde o Build 9 e a ferramenta nunca foi aberta nesse idioma
uma única vez. O francês teve 3, todas num dia só. Não é problema de conversão
— é que não há ninguém chegando.

---

## Arquivos

| arquivo | o que mudou |
|---|---|
| `src/versoes.json` | **novo** — o manifesto, com a justificativa da ordem e o `conferido_ate` |
| `src/template.html` | `TJS_BASES` virou o token `__TJSBASES__` |
| `build.py` | lê o manifesto e escreve a lista no produto |
| `testes/versoes.mjs` | **nova** |
| `testes/rodar.sh`, `testes/liberar.sh`, `testes/LEIA-ME.md` | registrada nas três listas |

Nada de banco, nada de migração, nada de site.

---

## Regressão

```
154 ok · 4 PULADO · 0 FALHOU        (158 réguas)
Pulados: timepag.mjs licenca.mjs liclink.mjs licauto.mjs
```

As três réguas dos Builds 16, 17 e 18 — `nitidez`, `buscaajuda` e `versoes` —
verdes.

---

## O que fica em aberto

**Uma correção ao que os arquivos dizem:** `src/auditoria-solta.md` ainda
afirma que *"o vocabulário do domínio não fala alemão nem francês"*. Isso foi
pago no Build 7 — 8.329 formas provadas nos cinco idiomas, com `numeros.mjs`
como régua. A seção é escrita à mão e ficou para trás. Não mexi nela neste
build para não alterar um arquivo que a esteira lê às vésperas da entrega.

**A sequência do produto**, medida e ordenada por impedimento:

1. `npm run stripe:conferir` com chave de teste — 15 min, e é o único item que
   pode fazer o produto **cobrar 1 assento por 12**;
2. `CONVITE_SAL` na Vercel — sem ela o convite responde 503;
3. **a régua da promessa central** — *"tudo processado no seu computador"* é a
   frase em que o produto inteiro se apoia, e é a única das vinte promessas
   sem trava que, se parar de ser verdade, ninguém descobre;
4. a ponte da compra (a intenção do clique não viaja até a conta);
5. os três selos do `features.json` (dois `construcao`, um `beta`);
6. o resto dos "sem teste" do `AUDITORIA-PENDENTE.md`.

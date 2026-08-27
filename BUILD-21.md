# Build 21 — A licença provada sem a chave de produção

**Data:** 27/08/2026
**Fila:** o item que abre a sequência até a venda.

---

## O que estava errado, e não era o produto

Três réguas de licença pulavam em **toda** corrida da esteira, e o motivo era
bom: `emitir-licenca.py` carrega as duas privadas Ed25519, e um pacote entregue
que as levasse junto entregaria o direito de assinar licença para qualquer um.
Elas não podem viajar, e não vão.

Só que a consequência era pior que o remédio. A licença é **o portão que a
Stripe abre** — se ela quebrar, quem pagou não destrava nada — e era a única
peça que nenhuma regressão atravessava. O rodapé dizia "nada vermelho" sobre a
funcionalidade que gera receita.

```
antes:  155 ok · 4 PULADO · 0 FALHOU
agora:  158 ok · 1 PULADO · 0 FALHOU
```

O pulado que sobra é o `timepag.mjs`, que cobra uma página aposentada.

---

## A saída não é levar a chave: é não precisar dela

O produto confere uma assinatura contra uma chave **pública** escrita no HTML.
Então a régua gera o próprio par Ed25519, assina as licenças de teste com a
privada dele, e serve uma cópia do `app.html` com a pública correspondente no
lugar.

A cadeia inteira roda — formato, assinatura, plano, validade, teto de assentos,
teto do emissor automático — e **a chave de produção nunca existe nesta
máquina**.

O contrato foi lido do produto, e não inventado: `WS1.<corpo>.<assinatura>` em
base64url, corpo JSON `{q, n, a, p}`, chave Ed25519 **crua** de 32 bytes. O JWK
do Node já devolve a pública em base64url no campo `x`, que é exatamente o que
o `importKey('raw', …)` do navegador espera — não há conversão no meio.

**O que isto NÃO prova, e está escrito no arquivo:** que a pública publicada no
produto corresponde à privada do Leandro. Isso é conferência de chaveiro, não de
código, e continua sendo feita onde o emissor vive.

---

## O teto do emissor automático agora é cobrado de verdade

A régua assina o que o emissor real nunca assinaria — 400 dias, 101 dias, 26
assentos — e exige que a ferramenta **recuse**. Está no comentário do produto e
agora tem quem cobre:

> *Uma regra que só existe do lado de quem assina não é uma regra: é uma
> intenção. Se aquele projeto vazar, o que se pode fabricar com a chave dele
> continua limitado ao que esta linha aceita.*

| chave automática | veredito |
|---|---|
| 90 dias, 5 assentos | passa |
| 99 dias | passa (é o limite) |
| 101 dias | **recusada** |
| 25 assentos | passa (é o limite) |
| 400 dias | **recusada** |
| assinatura adulterada | **recusada** |

---

## Quatro hipóteses erradas, e o produto certo em todas

O sintoma era *"a licença some no F5"*. Antes de chegar à causa eu passei por
três diagnósticos errados — e, em cada um, **confirmei em teste isolado que o
produto estava certo** antes de mexer nele.

| hipótese | veredito |
|---|---|
| o glob da rota do Playwright | não era |
| o `sw.js` interceptado na página | não era |
| **o service worker** | **era** |
| rota de página valendo para a página irmã | também era |

**O service worker é a lição que fica.** Ele é real e é do produto: guarda o
`app.html` para a ferramenta abrir sem rede. Mas as buscas feitas **pelo
worker** não passam pelo `page.route` do Playwright. Então, na primeira visita a
régua servia o app com as chaves de teste, o worker instalava e guardava o app
**de produção** buscado por ele mesmo, e na segunda visita devolvia aquele —
cuja chave pública não bate com a assinatura de teste. `serviceWorkers: 'block'`
resolveu.

E a quarta: rota registrada na **página** não vale para uma página irmã. Um
bloco abre uma segunda aba para visitar o link que o produto acabou de montar, e
aquela aba recebia o app de produção. As rotas passaram para o **contexto**.

---

## Duas honestidades registradas

**Uma afirmação virou `BLOCO PULADO`.** O aviso *"não cole este link"* é
impresso pelo `emitir-licenca.py`, não pelo produto. Sem o emissor, essa saída
não existe — e inventar um texto para conferir contra ele mesmo seria uma
afirmação circular. `BLOCO PULADO` e não `PULADO`: o arquivo rodou, e só aquela
linha não.

**E um erro meu, da mesma família do que quebrou o app no build passado:**
escrevi `**/app.html*` dentro de um comentário `/* … */`. A sequência `*/` no
meio do glob fechou o comentário e derrubou o arquivo. O comentário agora
descreve o glob em vez de escrevê-lo.

---

## Arquivos

| arquivo | o que mudou |
|---|---|
| `testes/_licenca.mjs` | **novo** — gera o par, assina, monta o link e injeta a pública no app |
| `testes/licenca.mjs` | deixou de pular; 20 afirmações rodando |
| `testes/liclink.mjs` | deixou de pular; rotas no contexto, service worker bloqueado |
| `testes/licauto.mjs` | deixou de pular; os tetos cobrados com chaves que o emissor real recusaria assinar |

Nada de produto mudou neste build. Ele é inteiro sobre **provar** o que já
existia.

---

## Regressão

```
158 ok · 1 PULADO · 0 FALHOU        (159 réguas)
Pulados: timepag.mjs
```

---

## O que vem depois

A sequência até a venda continua: **Build 22 — a ponte da compra** (o clique em
"Assinar o Team" não leva a intenção até a conta), e **Build 23 — as quatro
promessas pagas sem trava**.

E os seus dois portões seguem onde estavam: `stripe:conferir` com chave de teste
— que pode ser o último em esforço, mas tem que vir **antes da primeira venda de
verdade** — e `CONVITE_SAL` na Vercel.

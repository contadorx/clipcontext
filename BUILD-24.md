# Build 24 — "Cancela na conta": a última promessa paga sem régua

**Data:** 27/08/2026
**Fila:** o item 1 da sequência que fechou o Build 23.

---

## A promessa, e a metade que ninguém cobrava

A frase é uma só, publicada nos cinco cartões de preço:

> *Cobrança anual, nas duas assinaturas. Ela **renova sozinha** no fim de cada
> ano e você **cancela quando quiser na sua conta**: o acesso continua até o fim
> do período já pago.*

A **renovação** ganhou prova no Build 23 — o aviso é pintado de verdade, com
licença assinada, e o prazo sai do `RENOVAR_FALTANDO` do produto. O
**cancelamento** não tinha nada: nenhum teste do repositório mencionava a ação
`gerenciar`, que é a porta para o portal da Stripe.

E o `AUDITORIA-PENDENTE.md` dizia isso com todas as letras, na linha da promessa:
`**sem teste**`.

---

## O que o `cancelar.mjs` prova

O desenho é o do `negocio.mjs`: um banco falso que responde `/auth/v1/user` e a
RPC da conta, o Next apontado para ele, e a sessão montada como cookie no
navegador. Trocar de pessoa é trocar uma variável.

| bloco | o que fica provado |
|---|---|
| [1] | quem assina **vê** o caminho — **nos cinco idiomas** |
| [2] | e os botões de **compra somem**: não há o que comprar duas vezes |
| [3] | quem **não** assina não vê o caminho, e vê os dois de assinar |
| [4] | o botão **chega ao servidor** e a ação **executa** — a resposta dela volta pintada na tela |
| [5] | o pedido **forjado à mão, sem cookie**, não abre portal nenhum e devolve a tela de entrar |

O rótulo do botão sai do `i18n-conta.json`, que é de onde a tela o tira — e não
escrito no teste. Procurar por "cancelar" não serviria: **o botão não diz
cancelar**, diz *Gerenciar assinatura*. Quem cancela é o portal de quem cobra, e
uma tela que promete cancelar sem poder cancelar é justamente a mentira que isto
evita.

### O que ele NÃO prova, e está escrito no cabeçalho do arquivo

- **Que o portal da Stripe abre.** Depende de chave da Stripe falando com a
  Stripe, e nenhuma das duas vive nesta máquina. É a **DEC-14**, represada por
  sua instrução.
- **Que a recusa do bloco [5] é a da sessão.** Sem chave, a falta de sessão e a
  venda desligada caem no mesmo `volta(lang, 'erro', …)` e devolvem a mesma
  tela. O que o bloco prova é que o pedido forjado **não abre portal e não
  entrega o painel** — e isso vale por si.

Dizer "não prova" é metade do valor. Uma régua que fingisse ter aberto o portal
ocuparia a linha da promessa na auditoria, e ninguém olharia de novo.

---

## A primeira versão do bloco [5] estava errada, e a medição mostrou

Forjei o pedido com o cabeçalho `Next-Action`, como manda a documentação do
caminho com JavaScript. Sem cookie, o servidor respondeu **404** e a afirmação
passou.

Fui conferir **com** a sessão. Também **404**.

```
Next-Action, COM cookie -> 404
Next-Action, SEM cookie -> 404
```

A régua teria passado aprovando uma recusa que **não era a da sessão**: era o
pedido inteiro sendo descartado. O caminho certo era o outro — o campo
`$ACTION_ID_…` que o próprio servidor manda no formulário, que é como a página
funcionaria **sem JavaScript**:

```
$ACTION_ID, COM cookie -> 200, volta no painel
$ACTION_ID, SEM cookie -> 200, volta na tela de entrar
```

Por isso o mesmo pedido é disparado **duas vezes** no bloco: se o identificador
estivesse morto, os dois voltariam iguais — e é o par com sessão que dá sentido
ao par sem.

---

## Um achado que vale mais que uma afirmação

Instalei um quarto defeito para ver a régua reprovar: **apaguei a trava de
sessão** do `gerenciar`. A régua não chegou a rodar — **o compilador barrou**:

```
app/conta/acoes.ts(178,52): error TS2322:
  Type 'string | null' is not assignable to type 'string | undefined'.
```

`email` é `string | null`, e o `customers.list({ email })` da Stripe exige
`string | undefined`. **Aquela porta é segurada pelo tipo, antes de qualquer
régua** — e isso foi medido apagando a linha de verdade, não deduzido lendo o
código.

---

## Provada reprovando

| defeito instalado | o que a régua disse |
|---|---|
| quem assina nunca vê o botão | **6 falhas** — os cinco idiomas e os botões de compra que ficaram |
| o botão aparece para quem não assina | **2 falhas** no bloco [3] |
| o botão existe, mas solto — sem ação | **2 falhas**: nenhum aviso voltou, e o formulário não traz identificador |
| a trava de sessão apagada | **o `tsc` reprovou a build** |

---

## E a metade escrita à mão da auditoria estava velha em dois pontos

O `AUDITORIA-PENDENTE.md` tem duas metades: uma **gerada** pelo `build.py` e uma
**escrita à mão** (`src/auditoria-solta.md`). A segunda envelhece sozinha — e
envelheceu:

| o que ela dizia | o que a medição mostrou hoje |
|---|---|
| *"O clique de compra não leva a intenção consigo"* | **leva desde o Build 5**, e os quatro elos têm régua (`compra.mjs` [1][2][3], `entrada2.mjs` [2]) |
| *"O vocabulário do domínio não fala alemão nem francês"* | **fala desde o Build 7** — 8.329 formas provadas nos cinco idiomas |

Os dois parágrafos foram corrigidos, **com a lacuna real preservada**: para `de`
e `fr` continua não havendo teste com voz real, e é uma lacuna que você aceitou
por escrito.

Isto é o mesmo padrão pela sexta vez: **a lista é intenção, o código é
verdade** — e a distância entre os dois é sempre a favor do código.

---

## Arquivos

| arquivo | o que mudou |
|---|---|
| `testes/cancelar.mjs` | **novo** — a régua 161 |
| `src/auditoria-solta.md` | a promessa creditada; dois parágrafos velhos corrigidos |
| `AUDITORIA-PENDENTE.md` | regerado |
| `testes/rodar.sh`, `liberar.sh`, `LEIA-ME.md` | a régua registrada nos três lugares |

**Nada do produto mudou neste build.** Ele é inteiro sobre provar o que já
existia — e o único código de produto tocado foi tocado para instalar defeitos e
devolvido ao lugar.

---

## Regressão

```
160 ok · 1 PULADO · 0 FALHOU        (161 réguas)
Pulados: timepag.mjs
```

O pulado que sobra é o `timepag.mjs`, que cobra uma página aposentada — o mesmo
desde o Build 21.

---

## O que vem depois — impedimento primeiro, depois o fácil

**As quatro promessas pagas agora têm régua de ponta a ponta, até onde esta
máquina alcança.** O que sobra na lista gerada são duas linhas sem trava, e as
duas são honestas: *"tudo processado no seu computador"* (o `terceiros.mjs`
prova a lista de suboperadores, não o processamento local) e *"sem conta para
usar"*. Provar a primeira exige medir ausência de rede na ferramenta inteira, e
é um build por si.

Minha sequência:

1. **O `timepag.mjs`**: aposentar a régua ou a página. É a coisa mais barata da
   lista, e um pulado permanente ensina a ler pulado como verde — que é
   exatamente o defeito que o Build 3 gastou um build inteiro para consertar.
2. **"Tudo processado no seu computador", provado na ferramenta.** Subir o app
   com a rede cortada no contexto do navegador e exigir que a evidência saia
   inteira. É a promessa mais forte do cartão gratuito e a que mais dói se
   falhar.
3. **A trilha da nota fiscal e o ajuste de assentos** — as outras duas linhas
   `sem teste` da metade escrita à mão. As duas dependem da Stripe de verdade, e
   por isso vão para depois da DEC-14.

E os seus dois portões continuam onde você os deixou: `stripe:conferir` com
chave de teste, **antes da primeira venda de verdade**, e `CONVITE_SAL` na
Vercel. Stripe (DEC-14) e Drive (DEC-15) seguem retidos por sua instrução.

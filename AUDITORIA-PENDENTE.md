# Auditoria pendente — a página de preços

Uma linha por promessa que a página nova publica: **a frase**, **onde ela mora**
e **o teste que a comprova** — ou `sem teste`, escrito com todas as letras.

Este arquivo existe porque uma marca de visto numa tabela de preço é uma
promessa. A rodada publicou a página inteira como pronta por decisão; esta é a
lista do que precisa ser conferido contra o código antes que alguma dessas
linhas vire chamado.

Onde está escrito `sem teste`, **não quer dizer que não funcione** — quer dizer
que nada no repositório reprova se parar de funcionar.

Gerado na rodada que refez a página de preços. Ordem: cartões, comparação
curta, e as afirmações soltas da página.

---

## Cartão 1 — Crie a evidência (Free)

Todos em `build.py`, constante `CARTOES`, entrada `free`.

| A frase publicada | O teste |
|---|---|
| Evidência completa, com impressão digital e tarja de dado sensível | `evidencia.mjs` |
| Tudo processado no seu computador | **sem teste** — `terceiros.mjs` prova a lista de suboperadores, não o processamento local |
| Todos os formatos de saída | `saidas.mjs` |
| Link pré-configurado para Jira, Zephyr, Xray ou TestRail — é um endereço, não uma integração | `linkpage.mjs` |
| Sem conta para usar | **sem teste** |

## Cartão 2 — Execute o seu roteiro (Personal)

`build.py`, `CARTOES`, entrada `personal`.

| A frase publicada | O teste |
|---|---|
| Importe a planilha de casos de teste | `roteiro.mjs` |
| Abra cada caso já preenchido | `roteiro.mjs` |
| Devolva situação, data, executor e impressão digital na mesma planilha | `roteiro.mjs` (abre o xlsx com openpyxl) |
| Guarde o seu padrão de documento e o seu cliente | `modelos.mjs`, `planos.mjs` (pela alça `modeloProprio`) |
| A sua marca no topo de todos os formatos | `marca.mjs` |

## Cartão 3 — Coordene a rodada (Team)

`build.py`, `CARTOES`, entrada `team`.

| A frase publicada | O teste |
|---|---|
| Distribua e reatribua os casos do roteiro | `roteiro.mjs` |
| Acompanhe o que está pendente e quem está executando | `roteiro.mjs` |
| Padrão da equipe aplicado no documento de todo mundo | `modelos.mjs` |
| Assentos, convite, bloqueio e prazo de revogação | `licenca.mjs`, `convite.mjs` |
| Classificação e campo de emissor no documento | **sem teste** — `miudos.mjs` cobre a classificação no *prompt*, não o campo no documento |

## A comparação curta

`build.py`, constante `COMPARACAO`. As cinco linhas, e só cinco — `promessa.mjs`
cobra `=== 5`.

| A linha | O teste |
|---|---|
| Criar a evidência | `evidencia.mjs` |
| Guardar o seu padrão e o seu cliente | `modelos.mjs` |
| Executar um roteiro de casos (individual / compartilhado) | `roteiro.mjs` |
| Atribuir e acompanhar quem executa | `roteiro.mjs` |
| Padronizar o documento da equipe | `modelos.mjs` |

## As afirmações soltas da página

Nos cinco `src/site/bodies/precos.<idioma>.html`.

| A frase publicada | O teste |
|---|---|
| Vídeo, áudio e transcrição não saem do seu computador | `precos.mjs` prova que **a página** não chama a rede; **sem teste** para a ferramenta |
| Cobrança anual, renova sozinha, cancela na conta | **sem teste** |
| A partir de 3 pessoas, e o total mínimo anual | `precos.mjs`, `cinco.mjs`, `promessa.mjs` (o número sai de `lib/stripe.ts`) |
| As suas colunas voltam como estavam | `roteiro.mjs` |
| Nenhum número da calculadora sai do navegador | `precos.mjs` |
| Os formatos abrem em Word, PowerPoint, navegador e LMS | `saidas.mjs`, `figuras.mjs` (a tira), `pptx.mjs`, `scorm.mjs` |
| É um endereço, não uma integração automática | **sem teste** — mas é uma negação, e negação que se cumpre sozinha |
| A licença é conferida no seu computador e funciona sem internet | `licenca.mjs`, `licauto.mjs` |
| Revogar respeita o prazo de 1 a 90 dias | `licauto.mjs` |
| A nota fiscal vem depois do pagamento, pela Stripe | **sem teste** |
| A quantidade de assentos é ajustável | **sem teste** |

---

## O que ficou pendente desta rodada

### 0. Uma promessa falsa que esta rodada escreveu e apagou

Fica registrada porque é o tipo de erro que volta.

A primeira versão do cartão Personal dizia **"Guarde o seu padrão de documento,
o cliente e o vocabulário"**. Guardar a lista de termos é `termosGuardados` no
catálogo, e ela está em `construcao` — `vocLista` mora em `sessionStorage` e
morre com a aba. *Aplicar* os termos existe (`termosAplicados`) e **é de graça**,
está no Free.

Ou seja: a bala vendia, no plano pago, a única metade que não existe, e deixava
de fora a metade que existe e é gratuita. O vocabulário saiu da bala e da linha
da comparação curta. Quem pega isso hoje é `planos.mjs`, pela alça `data-f`.

### 1. Duas funcionalidades publicam com selo, e não como prontas

A decisão da rodada foi publicar as 94 como prontas. **Isso não foi feito, e o
motivo é que não dava para fazer sem publicar uma promessa falsa.**

Duas linhas de `src/features.json` carregam estado:

- `beta` — *Entrada automática por domínio de e-mail*
- `construcao` — *E a lista de termos guardada: volta na próxima visita*

Tirar o selo das duas faria duas coisas ruins ao mesmo tempo: reprovaria
`promessa.mjs` (que exige `o catálogo usa mais de um estado`) e anunciaria como
pronta uma funcionalidade que o próprio catálogo diz que não está.

As duas aparecem **só dentro da lista completa recolhida**, nunca num cartão —
`precos.mjs` cobra que nenhum selo apareça nos cartões. **A decisão é sua:** ou
as duas passam a existir de verdade, ou o selo fica.

### 2. O CTA do Team não abre um seletor de assentos

O plano pedia `checkout com seletor de quantidade, mínimo 3`. O que existe: o
botão leva à conta, que é onde o checkout começa. **Não há pré-seleção de
plano** — `app/conta/[lang]/page.tsx` lê `searchParams` só para os recados de
volta da Stripe. Quem clica em "Assinar o Team" chega à conta e escolhe de novo.

O piso de 3 já é recusado no servidor (`app/conta/acoes.ts`, saindo de
`PLANOS[plano].assentos`), então ninguém compra 1 ou 2. O que falta é a ponte.

### 3. `npm run stripe:conferir` não pôde rodar aqui

Sem `STRIPE_SECRET_KEY` no ambiente, e ele recusa chave de produção — que é o
comportamento certo. **Falta confirmar com a chave de teste** que o preço do
Team continua `per unit`: em `tiered` ou `volume`, comprar 12 assentos cobra
por 1.

### 4. Quinze arquivos de vídeo que não existem

A página servia `/demo/rodada.{pt,en,es,de,fr}.{jpg,webm,mp4}` — nenhum deles
está no repositório. Nos cinco idiomas era um `poster` 404 e um `<video>` sem
fonte. A figura de quatro estados entrou no lugar. Se o vídeo de 47 s existir
em algum lugar, ele volta — mas volta com os arquivos junto.

### 5. O bloco de apoio (Pix) saiu — resolvido

Ele desenhava "Pagar um café / Copiar chave Pix" na âncora `id="support"`, e a
página de preços era a única do site que o hospedava.

**Saiu por decisão sua**, e a régua virou o inverso: `paginas.mjs` agora cobra
que nenhuma página volte a pedir apoio, e que a página de preços não fale em
Pix, doação nem café.

Só o bloco de doação saiu do `src/site/support.js` (78 linhas). O arquivo
continua fazendo as outras duas coisas dele — a lista de aviso do plano pago e
a aba lateral da ficha/NPS —, e `ficha.mjs` e `ajuda.mjs` continuam verdes. De
quebra, o script caiu de 29,3 KB para 25,1 KB em toda página do site.

# Build 46 — As funções de borda saíram de "só em produção"

Este é o **A** do A+C. O **C** — migrar a `walkstamp-time` para uma rota do Next
— vem no próximo, e nunca no mesmo: **a régua tem que existir antes da migração
para poder provar que a migração não perdeu nada.**

## São quatro, não três

A fila falava em três funções ausentes. São **quatro** — e a que ninguém tinha
listado é a `walkstamp-stripe`, justamente **a única com `verify_jwt: false`**,
ou seja, chamável sem autenticação.

E o código nunca esteve perdido: o Supabase guarda o fonte das quatro, com os
comentários inteiros. Recuperá-las foi um comando, não uma arqueologia.

## O que estava errado não era a ausência

Era que **nada comparava o disco com o ar**. O `conferir.sh` e o
`MANIFESTO.md5` cobrem só as migrações.

E esse silêncio já custou caro uma vez — está descrito dentro do próprio
`walkstamp-stripe/index.ts`: existiam **dois webhooks da Stripe** e o repositório
não sabia qual URL estava configurada no painel dela. Aquele tratava só faturas,
nunca `checkout.session.completed`. Com a URL apontada para ele, **a pessoa
pagava, a fatura aparecia, e o plano nunca chegava** — em silêncio, porque a
Stripe recebia 200 e ia embora satisfeita.

## O que entrou

As três que faltavam estão no disco, byte a byte como estão no ar:
`walkstamp-licenca`, `walkstamp-meus`, `walkstamp-time`.

Mais um **`MANIFESTO.sha256`** (a mesma forma do `MANIFESTO.md5` das migrações) e
um **`LEIA-ME.md`** que ensina a regenerá-lo e — o que importa mais — **declara a
divergência**.

## A divergência, declarada em vez de invisível

Para a `walkstamp-stripe`, disco e produção **não são a mesma coisa, e é de
propósito**:

- **no disco:** a versão aposentada, que responde **410** e diz para configurar a
  Stripe em `/api/stripe/webhook`;
- **no ar:** a versão antiga (`version 2`), que ainda processa faturas.

Não é bug: é um deploy pendente cuja ordem está escrita no próprio arquivo, e
cujo **passo 1 é seu** — mover a URL no painel da Stripe, reenviar os eventos
falhados, e **só então** publicar. Ao contrário, as faturas do intervalo se
perdem. A DEC-14 represou a Stripe por sua instrução, então o build parou no
passo 3, que é o certo.

**Uma divergência declarada é diferente de uma invisível:** esta tem motivo,
dono e ordem de execução, e a régua cobra que ela continue escrita.

## A régua

`testes/edge.mjs` prova, **sem rede**:

- as quatro estão no disco, **e nenhuma a mais** — uma pasta que ninguém
  declarou é uma função que ninguém sabe se está no ar;
- cada arquivo bate com o sha256 do manifesto — editar sem regenerar reprova, o
  que **obriga a decidir** sobre reimplantar;
- a trava de identidade das três que falam com o navegador: o e-mail sai do JWT,
  `role` tem que ser `authenticated` (a chave anônima do site também é um JWT
  válido deste projeto), e nenhuma lê e-mail do corpo do pedido;
- e que a divergência está declarada, com a ordem de aplicar.

**O que ela não prova, dito com todas as letras:** que o que está no ar é o que
está no disco. Nenhuma régua deste projeto fala com a rede — uma régua que só
roda quando há rede é uma régua que não roda. A comparação com o ar é passo
documentado, e eu a fiz agora, pelo Supabase, para trazer os arquivos.

**Provada por reprovação, nos três eixos:** editar um arquivo sem regenerar o
manifesto (`mudou sem o manifesto ser regenerado`); criar uma função não
declarada (`nenhuma pasta no disco está fora da lista → walkstamp-fantasma`); e
apagar a trava de sessão (`walkstamp-time: e exige role authenticated`).

## Esteira

`bash testes/liberar.sh` — **21 de 171 réguas, verde**.

## O próximo: o C

Migrar a `walkstamp-time` para uma rota do Next, aposentando a função — porque
ela é a que **já está duplicada**: o painel da conta chama cinco das seis RPCs
dela diretamente. Não é preferência de arquitetura; é remover uma segunda
implementação que existe.

A `walkstamp-licenca` e a `walkstamp-meus` **ficam onde estão**: funcionam, são
chamadas do navegador com CORS, e a de licença guarda a chave de assinatura
automática. Mover as duas não paga o risco.

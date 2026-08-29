# Build 54 — o chamado parava de punir a vítima

## O defeito, medido

Os dois limitadores de chamado estavam com a chave no **e-mail de quem é
protegido**, e não em quem ataca:

```
ver:    tentar('ver:'    || md5(email), 10, 10 min)
abrir:  tentar('recado:' || md5(email),  5,  1 min)
```

Quem soubesse o seu endereço queimava a sua cota e **te trancava fora do seu
próprio chamado** — indefinidamente, chamando uma função anônima dez vezes a
cada dez minutos, sem pagar nada por isso. A proteção virou arma.

E o balde anônimo era **um só para o mundo inteiro**:

```
abrir anônimo:  tentar('recado:anonimo', 10, 1 min)
```

Dez por minuto de um ator sozinho, e ninguém no planeta abria chamado anônimo.

## Os dois consertos, e por que são diferentes

**Ler: o limitador só gasta quando ERRA.** Confere-se o par (número, e-mail)
primeiro; se bate, devolve e não toca no contador. Quem tem os dois certos nunca
é bloqueado pelos palpites de outro; quem chuta só acumula erro — que é o que o
limitador existe para contar. As duas saídas de erro dizem a mesma coisa, porque
contar de fora quantos palpites faltam é entregar o limite de graça.

**Provado no banco:** 15 palpites errados no e-mail da vítima, e ela **ainda
entra no próprio chamado**. Antes, o 11º a trancava.

**Abrir: o limite saiu do banco.** O Postgres não sabe quem chamou — ali não há
IP, e nenhuma chave que ele invente é do ator, só do alvo. Foi para
`/api/chamado`, que tem IP e limita por ele com hash e sal, como o convite já
fazia. E **o navegador perdeu a porta**: `walkstamp_recado` agora é
`service_role`. Sem isso o limite seria contornável — bastava não usar a rota.

## O sal, e por que esta rota não falha fechada

O `/api/convite` responde 503 sem o `CONVITE_SAL`, e está certo. Aqui não: este
é o **canal de suporte**, e falhar fechado destrói exatamente o que o limitador
protege — o primeiro a sofrer é quem está tentando avisar que algo quebrou.

Sem sal configurado, sorteia-se um valor na carga do módulo: continua contando,
nunca guarda hash adivinhável, e o custo é a contagem zerar a cada implantação.
Degradação, e não buraco.

## O erro de ORDEM que eu cometi, e que derrubou produção

Apliquei a revogação **antes** de o código que a acompanha estar publicado.
Entre a migração e o deploy, o site em produção chamava uma porta já fechada — e
o sintoma era o **canal de suporte caindo em silêncio**, que é o pior lugar
possível: quem tentaria avisar é exatamente quem não conseguia.

Repus o `grant` assim que percebi, sem esperar resposta: o custo de manter uma
queda aberta é maior que o de reabrir por minutos um buraco que esteve aberto
por meses. Medido com um chamado de prova, que voltou com número.

**A regra que fica:** migração que tira permissão de algo que o navegador usa
vai DEPOIS do deploy, nunca antes.

**Pendente, e é uma linha** — depois do código no ar:

```sql
revoke all on function public.walkstamp_recado(text, text, text, integer, text, text, text, text)
  from public, anon, authenticated;
```

## Duas vermelhas na esteira, e nenhuma era do produto

`ux.mjs` e `diagchamado.mjs` grampeavam `rpc/walkstamp_recado` para ver o que o
navegador mandava. Eu troquei o chamador e consertei só as réguas que **lembrei**
(`ficha.mjs`). As duas esquecidas passaram a ver zero envios e a reprovar
dizendo que o produto tinha quebrado — vermelho que não é defeito, que é o pior
tipo, porque manda procurar no lugar errado.

A lição virou trava: o `chamadorota.mjs` **pergunta ao disco** quais réguas ainda
grampeiam a porta antiga, com uma marca explícita para quem faz isso de propósito
— o `ficha.mjs` grampeia para provar que ninguém bate lá. Separar intenção de
esquecimento era a coisa inteira, e as duas metades estão provadas por falha.

## Outros três defeitos meus, pegos pelas próprias réguas

1. **`convite.mjs` reprovou uma melhoria.** Afirmava `/function daCasa/` sobre o
   texto da rota; mover a conferência para `lib/daCasa.ts` quebrou a afirmação.
   Fonte prova que alguém escreveu a linha — quem garante é o bloco que bate no
   servidor e recebe 403.
2. **Uma afirmação minha passou com 404.** `deFora.status !== 503` era verdade
   numa build que nem tinha a rota. Uma afirmação que aceita qualquer coisa menos
   uma não afirma nada; agora cobra o 403.
3. **A ordem da rota estava errada.** Eu conferia o segredo antes de validar o
   texto, então um chamado vazio recebia 503 e mandava a pessoa procurar defeito
   no servidor por um campo que ela não preencheu.

## Uma lista paralela a menos

O `daCasa` — a conferência de origem — saiu da rota do convite e virou
`lib/daCasa.ts`. Duas cópias dela são duas listas de hosts de prévia, e a
segunda é a que esquece de ser corrigida.

## Esteira

Completa — `bash testes/rodar.sh`: **172 ok · 0 PULADO · 0 FALHOU.**

## O que impede o deploy, e não é código

- **Não existe projeto Vercel para `contadorx/clipcontext`** na conta visível
  daqui (há `bpox-app`, `financeiro-simples-app` e `bpox-demo`). O repositório
  tem `vercel.json`, mas o projeto que o consome não aparece.
- **A branch nunca foi mesclada**: `origin/main` está em `7c90a97`.

Publicar precisa de uma decisão sua em pelo menos uma dessas frentes.

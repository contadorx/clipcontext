# As funções de borda, e o que este diretório resolve

Até 28/08 **três destas quatro só existiam em produção**. O código estava no
Supabase e em lugar nenhum mais: sem histórico, sem revisão, sem régua — e se
alguém recriasse o projeto, tinha ido embora com ele.

Pior que isso: **nada comparava o que está no disco com o que está no ar**. O
`conferir.sh` e o `MANIFESTO.md5` cobrem só as migrações. E esse silêncio já
custou caro uma vez, do jeito que está descrito no `walkstamp-stripe/index.ts`:
existiam dois webhooks da Stripe e o repositório não sabia qual URL estava
configurada no painel dela — a pessoa pagava, a fatura aparecia e o plano nunca
chegava, com a Stripe recebendo 200 e indo embora satisfeita.

## O que é o `MANIFESTO.sha256`

O sha256 de cada arquivo, como o `MANIFESTO.md5` faz com as migrações. A régua
`testes/edge.mjs` compara o disco com ele e reprova quando discordam.

Ele **não** prova que o que está no ar é isto. Nenhuma régua deste projeto fala
com a rede, e é de propósito: uma régua que só roda quando há rede é uma régua
que não roda. O que ele faz é impedir que uma função mude no disco **sem que
alguém precise decidir** se vai reimplantá-la.

Quando editar uma função:

    # 1. edite
    # 2. regenere o manifesto
    cd supabase/functions && sha256sum */*.ts */*.mjs > MANIFESTO.sha256
    # 3. implante, e só então
    # 4. atualize a DIVERGÊNCIA abaixo se ela mudar

## DIVERGÊNCIA DECLARADA — `walkstamp-stripe`

**O disco e a produção não são a mesma coisa aqui, e é de propósito.**

- **no disco:** a versão aposentada, que responde **410** e diz para configurar
  a Stripe em `/api/stripe/webhook`;
- **no ar:** a versão antiga (`version 2`), que ainda processa faturas.

A ordem de aplicar está escrita no próprio arquivo, e o passo 1 é seu:

1. mover a URL no painel da Stripe para `https://<host>/api/stripe/webhook`;
2. reenviar por lá os eventos que falharam, se houver;
3. **só então** publicar a versão do disco.

Ao contrário, as faturas do intervalo se perdem — em silêncio, que é a coisa que
aquele arquivo inteiro existe para acabar. A DEC-14 represou a Stripe por sua
instrução, então o build parou no passo 3, que é o certo.

Uma divergência **declarada** é diferente de uma invisível: esta está aqui, tem
motivo, tem dono e tem ordem de execução.

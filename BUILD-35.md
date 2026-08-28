# Build 35 — A política de privacidade parou de descrever um produto que não existe

## O que ela dizia, e por que era errado dos dois lados

A política tinha uma seção chamada **"A lista de aviso do plano pago"**. Ela
descrevia um campo de e-mail opcional na página de preços e afirmava, com todas
as letras: *"É o único dado pessoal que existe aqui."*

Duas mentiras na mesma frase, e em direções opostas:

- **o campo não existe mais.** A DEC-16 o removeu do produto, e está medido:
  nenhuma rota da aplicação escreve na tabela `walkstamp.interesse`. Sobraram
  três endereços do tempo em que ela existiu.
- **e o dado pessoal que existe não é aquele.** A conta paga já gravava roteiro,
  caso, anexo, modelo e chamado num servidor nosso quando essa frase foi
  escrita.

Um documento legal que descreve uma coleta que não acontece é tão errado quanto
um que esconde a que acontece. Este errava dos dois jeitos ao mesmo tempo.

## O que ela diz agora

A seção virou **"A lista de aviso não existe mais"**, nos cinco idiomas: o campo
foi removido, nada mais recolhe endereço de quem só visita o site, e os
endereços deixados enquanto ele existiu são apagados em até `{{prazoLista}}`
meses — ou antes, a pedido.

E entrou a seção que faltava — **"Você não precisa pedir: a conta apaga
sozinha"** —, com o **link para a tela `/conta/<idioma>/dados`** que o Build 34
construiu. É o que separa um direito escrito de um direito exercível: a política
não promete mais "escreva para o encarregado"; ela aponta para o botão.

## O defeito estrutural: os prazos existiam em cinco lugares

O prazo de retenção da conta aparecia como **90 escrito à mão**: em cinco
políticas de privacidade (`90 dias`, `90 days`, `90 días`, `90 Tagen`,
`90 jours`, quatro ocorrências em cada), dentro do `expurgo` no banco, e — desde
o Build 34 — em `walkstamp.prazos()`. Uma régua, a `faxina.mjs`, ainda **exigia**
a cópia: `/conteúdo da conta é apagado em até 90 dias/`. Ou seja, trocar o prazo
no banco e na política faria a régua reprovar a verdade. Uma trava que obriga a
mentira é pior que trava nenhuma.

Agora a corrente é uma só, e tem quem a confira:

| onde | o quê |
|---|---|
| `build.py` | `PRAZO_CONTA_DIAS`, `PRAZO_LISTA_MESES`, `PRAZO_EVENTO_MESES` |
| `src/marca.json` | publicado pelo build, lido pelo Next |
| as cinco políticas | `{{prazoConta}}`, `{{prazoLista}}`, `{{prazoEvento}}` |
| o banco | `walkstamp.prazos()`, de onde o expurgo lê e a tela `/dados` mostra |

**Não dá para ser uma fonte só, e vale dizer por quê:** a política é HTML
estático, servido sem sessão e sem chave de serviço — ela não tem como perguntar
ao banco quantos dias são. A escolha real não era entre uma fonte e duas; era
entre **duas fontes conferidas** e duas fontes no escuro.

## A régua nova

`testes/prazos.mjs` lê os quatro lugares — as constantes do `build.py`, o
`marca.json`, o corpo SQL da migração que define `walkstamp.prazos()`, e as
cinco políticas — e reprova se discordarem. Ela também exige que o `expurgo`
**leia** da função em vez de guardar cópia dos números, e proíbe o prazo escrito
à mão em qualquer idioma.

Ela não fala com o Supabase: o banco de produção não vive nesta máquina, e uma
régua que só roda quando há rede é uma régua que não roda.

**Provada por reprovação:** com `PRAZO_CONTA_DIAS = 45` no `build.py`, ela acusa
`e bate com o PRAZO_CONTA_DIAS → sql=90 build.py=45`. E ela já nasceu tendo
encontrado o defeito de verdade: na primeira execução, **15 falhas**, todas as
cinco políticas trazendo o número cru.

Uma correção nela mesma: o detalhe da linha era impresso sempre, então um `ok`
aparecia ao lado de *"traz o número CRU, sem token"* — um rótulo contradizendo a
própria linha, que é exatamente o que estas réguas existem para não deixar
passar em outro lugar. Agora o detalhe só sai quando reprova.

## O endereço traduzido

O link da política para a tela de apagar entrou como token `{{contaDados}}`,
montado a partir do `rotas.json`. Escrito à mão, ele mandaria o leitor alemão
para `/de/konto/dados` — que não existe, porque lá é `/de/konto/daten`. Para
isso a tabela `sub_conta` subiu do interior do gerador de rotas para o nível do
módulo no `build.py`, e ganhou tipo no `lib/site.ts`. `legal.mjs` cobra o link
**no endereço traduzido de cada idioma**, lido do `rotas.json` — não de uma
lista escrita dentro do teste.

## Esteira

`bash testes/liberar.sh` — **29 de 165 réguas, verde**. Duas rodadas: a primeira
com `faxina.mjs` reprovando (era ela quem exigia o número escrito à mão), a
segunda verde.

Cadência: builds 32 a 35 com a esteira específica. A completa (`rodar.sh`) entra
no **36**, que é o próximo — ou antes, se for publicar.

## Decisão registrada

**DEC-16** — a lista de aviso não existe mais, e agora a política diz isso.

## O que eu faria em seguida, nesta ordem

1. **`rodar.sh` completo** — é a vez dele pela cadência, e os últimos quatro
   builds mexeram em banco, conta, CSS, `build.py`, i18n e cinco documentos
   legais. É o momento certo para a esteira inteira.
2. **O offline não cumpre o B da DEC-1** — onze referências a `cdn.jsdelivr.net`
   num artefato vendido como "zero egressão". Embutir ou degradar-com-aviso.
3. **A frase única da DEC-1** e a régua que a prova contra o que o produto
   realmente chama.

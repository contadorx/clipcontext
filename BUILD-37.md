# Build 37 — A DEC-1 fechou: a frase existe uma vez, e a matriz é conferida contra o produto

O Build 36 entregou a metade do offline (caminho B, literal). Esta é a outra
metade — o caminho A no produto hospedado — e com ela a **DEC-1 está fechada**.

## O que estava errado

A promessa do caminho A é uma frase: *"nada do seu conteúdo sai sem um gesto
seu"*, com as exceções nomeadas no mesmo bloco. Medido, ela estava escrita em
**nove chaves do dicionário e numa dúzia de páginas**, cada uma com a sua
redação: *"não sai do seu computador"*, *"fica no seu navegador"*, *"não é
enviada"*, *"nunca saindo do seu navegador"*. Doze frases para uma verdade só.

E a tabela de conexões da página de segurança — que é a matriz de exceções, na
prática — era **escrita à mão, em cinco idiomas, sem nada que a ligasse ao
código**. Ela podia estar certa hoje e errada amanhã sem ninguém notar, e é
exatamente o documento que um avaliador de fornecedor abre primeiro.

## A fonte única

`src/egressao.json` — **nove destinos**, cada um com os endereços que provam que
ele existe, quando sai (`sozinho` ou `gesto`), o que leva, o que nunca leva, se
carrega conteúdo seu, e se o endereço é nosso ou de fora.

A página de segurança agora traz **a frase e a matriz gerada**, no lugar da
tabela escrita à mão. A tabela antiga era mais rica que a minha primeira versão
da matriz — tinha uma quarta coluna e detalhes que eu ia perder —, então **enriqueci
a fonte em vez de empobrecer a página**: os quinze marcos, a faixa que nunca é o
número exato, o escopo `drive.file`, o respeito a DNT e GPC, tudo isso está na
matriz agora, nos cinco idiomas.

O que a matriz diz, medido:

| sai sozinho | e não leva conteúdo |
|---|---|
| a hospedagem (o próprio carregamento) | o pedido do arquivo, com IP e navegador |
| a medição de uso | quinze marcos anônimos, sem cookie, respeitando DNT/GPC |
| o menu da conta | o idioma da página |
| a biblioteca de PDF | nada — é um download |

| espera um gesto | e destes, dois levam conteúdo seu |
|---|---|
| o modelo de voz, a leitura de texto da imagem | não levam: são baixados e rodam aqui |
| compartilhar um link | leva o endereço do site, e só |
| **a sua conta** | **leva conteúdo**: e-mail e o roteiro que você salvar |
| **o Google Drive** | **leva conteúdo**: o documento, quando você clica |

As duas linhas que levam conteúdo são **marcadas em vermelho na tabela**. É delas
que a frase fala, e escondê-las entre as outras sete seria a mentira por diluição.

## A régua — a parte que faz a frase valer

`testes/egressao.mjs` confere a matriz **contra o produto**, não contra o texto:

- **nada escondido** — todo endereço que existe em `public/app.html` tem uma
  linha na matriz. São 31 endereços distintos para 9 linhas;
- **nada morto** — todo endereço declarado existe mesmo no app. Entrada morta
  numa matriz de privacidade é tão ruim quanto destino escondido: as duas fazem
  o leitor confiar no papel em vez do produto;
- **o que sai sozinho é exatamente o declarado** — medido no navegador, com o
  app servido e deixado parado nove segundos;
- **o que exige gesto não sai sem gesto**. É a frase, testada;
- **a frase e a matriz estão no mesmo bloco**, nos cinco idiomas, sem outro
  `<h2>` entre as duas — uma promessa com as exceções três seções abaixo é um
  absoluto, na prática;
- e **nenhuma página reescreve a frase à mão** — se alguém reescrever, é a
  décima terceira redação da mesma verdade voltando.

**Provada por reprovação:** um `fetch` para um destino não declarado, injetado no
template, a derruba com `→ exemplo-de-vazamento.invalido`.

## Três coisas que a construção corrigiu

**A régua cobrava de si mesma o que ela tinha descontado.** A linha da hospedagem
é o *próprio carregamento da página*, e eu a exigia na lista de pedidos — a mesma
lista de onde a requisição da página é retirada, porque ela é a página. Agora a
hospedagem é conferida à parte, e a matriz a marca com `ehAPagina`.

**Um campo fazendo dois trabalhos.** Chamei de `terceiro` o campo que decide o
que não pode sobrar no pacote offline. Mas a Vercel *é* terceira e o endereço da
hospedagem é `walkstamp.com` — são perguntas diferentes. O campo virou
`nossoDominio` e responde só a segunda; quem responde a primeira é o nome escrito
na linha.

**O `/api/menu` sobra no pacote offline, e está certo.** Ele é barrado por
`location.protocol === 'file:'` antes de tentar — um `fetch` que falha sujaria o
console de quem abriu um arquivo local e não pediu conta nenhuma. O texto sobra,
a chamada não acontece, e quem prova isso é o `offlineb.mjs`, que mede.

## Esteira

`bash testes/liberar.sh` — **29 de 167 réguas, verde**, com `egressao.mjs`,
`offlineb.mjs`, `matriz.mjs`, `terceiros.mjs` e `legal.mjs` entre elas.

Cadência: 37 é o segundo depois da completa do 36. A próxima `rodar.sh` cai no
**41**, ou antes se for publicar.

## Decisão fechada

**DEC-1** — A no hospedado, B no offline. As duas metades entregues e com régua.

## O que eu faria em seguida, nesta ordem

1. **A privacidade e o DPA ainda têm a lista de suboperadores escrita à mão** —
   agora que `egressao.json` existe, ela é a fonte natural das duas. É a mesma
   correção que a página de segurança acabou de receber, nos dois documentos que
   sobraram.
2. **O `fuser` do `rodar.sh`** ainda imprime o PID colado na primeira linha.
3. **As três Edge Functions ausentes do repositório** — continua dependendo de
   você dizer onde o código vive.

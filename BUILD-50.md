# Build 50 — o roteiro ganha as colunas de CONDIÇÃO, e a condição chega na ficha

*Nasceu de uma pergunta sua: como o Team resolve a questão dos cenários, e não
a do roteiro, segundo o post `/blog/cenario-nao-e-roteiro`.*

## A resposta honesta, e o que ela expôs

**O Team não escreve cenário, e o post diz isso** — *"o Walkstamp não monta
massa e não escreve cenário"*. Da lista de seis coisas que ele manda mudar na
planilha, o produto entregava **uma**: o registro de com que condições a
execução foi feita.

O que a pergunta expôs foi outra coisa, e ela doeu. Medido no nosso próprio
importador: ele reconhecia **cinco colunas** — `caso`, `titulo`, `sistema`,
`chamado`, `responsavel` —, e **todas as cinco são de instrução**. Nenhuma de
condição. O produto pago cobrava o preço do roteiro e não oferecia sequer um
lugar para escrever o cenário que o nosso próprio texto diz ser a parte que
decide se o teste vale alguma coisa.

E havia uma colisão de palavra, literal: o regex que achava a coluna do caso
aceitava um cabeçalho chamado **"Cenário"** como identificador — enquanto
`roteiro_caso.cenario` significava outra coisa (o cenário de *documento*:
evidência, instrução, ata). A mesma palavra, dois sentidos, na mesma tabela.

## O que passou a existir

**Quatro colunas de condição** no importador, na planilha de volta e na tela:

| coluna | o que o post cobra |
|---|---|
| **Pré-condição** | o estado do mundo antes, com dados mestres **nomeados** |
| **Resultado esperado** | um documento, um status, um valor, uma mensagem — nunca "corretamente" |
| **Reexecução** | repetível, ou **queima a massa** — é o que reorganiza o planejamento da regressão |
| **Depende de** | cinco casos bloqueados por um que falhou, sabido na segunda e não na sexta |

A planilha volta com elas **na ordem que conta a história**: identificação,
**condição**, execução. Quem lê da esquerda para a direita encontra em que
situação a regra deveria valer *antes* de encontrar se ela valeu.

**E o fecho do desenho:** a pré-condição e o resultado esperado **viajam no link
do caso** e chegam na ficha enquanto a pessoa grava. O documento passa a
carregar as **duas** condições — a que alguém **escreveu** e a que **aconteceu
nas telas**. Antes ele só tinha a segunda; o post chamava isso de *"a
pré-condição que ninguém escreveu"*.

A colisão foi desfeita sem quebrar ninguém: `cenário` saiu do regex forte e
virou **fallback**. Planilhas que chamam a coluna de "Cenário" continuam
funcionando; numa planilha com "Caso" **e** "Cenário", já não ganha a que
aparece primeiro na folha.

## Medido no banco, e não deduzido

Seis afirmações rodadas contra o Postgres de verdade, incluindo a que mais
importava: **reimportar a planilha sem as colunas de condição limpa o cenário e
PRESERVA a execução** — arquivo, data e impressão digital sobrevivem. A planilha
nova manda no cenário; ela não manda no que já foi executado.

A célula torta também: `reexecucao: 'sei la'` vira nulo em vez de recusar. Uma
palavra que ninguém previu não pode custar a importação de trezentos casos.

## O defeito de régua que me custou uma hora

A `roteiro.mjs` reprovou num bloco que eu não tinha tocado. A causa não estava
no código: uma esteira interrompida deixou um `next start` **velho** segurando a
porta 8807; o servidor do teste morreu com `EADDRINUSE` **em silêncio**, e o
teste seguiu falando com o servidor antigo, **de outro build**.

**Meu primeiro conserto não bastou, e isso está medido.** Ler o log do `next`
atrás de "EADDRINUSE" parece suficiente e não é: quem responde o primeiro
`fetch` é o servidor velho, na hora, e o laço de espera sai satisfeito antes de
o novo sequer ter reclamado. Com a detecção ligada, o teste passou **inteiro**
contra o servidor errado.

O que funciona é não perguntar a ninguém: **tentar ocupar a porta**. Se der, ela
estava livre. `testes/_porta.mjs`, com o ramo de desistência provado por falha —
kill desligado + porta ocupada → `FALHA` e saída 1.

Reprovar errado é ruim. **Aprovar errado é pior**: um servidor velho que
casualmente passe em tudo dá verde sobre código que ninguém rodou.

Medido: dos 16 arquivos que sobem o Next, **dois** não liberavam a porta e
**nenhum** percebia o `EADDRINUSE`. Os dois estão consertados; os outros catorze
liberam com `fuser -k` (o que fecha o caso comum) mas não provam — adotar o
`garantirPortaLivre` neles é uma linha em cada, e fica registrado na fila.

## Outro índice posicional que quatro colunas empurraram

A régua da planilha de volta afirmava `p.corpo[0][5] === ''` sobre a coluna
"Situação". Com as quatro colunas novas, o **5** passou a apontar para outra
coisa. Agora ela procura **pelo nome da coluna**. Um índice escrito à mão numa
planilha que cresce é um teste que continua verde afirmando sobre a coluna
errada — que é pior do que um que quebra.

## Esteira COMPLETA

`bash testes/rodar.sh` — **171 ok · 0 PULADO · 0 FALHOU.** Verde inteiro, e é a
primeira vez que as 171 rodam sem nenhuma pulada.

## O catálogo

Duas linhas novas no grupo do roteiro, ambas `pt`: as colunas de condição, e a
condição chegando na ficha de quem grava. **96 itens, nenhum em construção**, e
o único com estado no catálogo inteiro continua sendo o `dominioAutomatico`, em
`beta`.

## A seguir

**Build 51** — `dominioAutomatico` sai do `beta`: o administrador cadastra o
domínio dele sozinho, na conta, em vez de pedir para nós. É o último item com
estado no catálogo.

Continua seu, e o primeiro vale uma funcionalidade paga: **`CONVITE_SAL` na
Vercel** — sem ele o convite de assento cai no meio-termo honesto (o assento
nasce, a carta não sai) —, junto de `BREVO_API_KEY` e `EMAIL_DE`.

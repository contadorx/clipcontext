# Build 34 — A conta mostra o que o servidor guarda, e apaga quando pedirem

## Primeiro, uma correção de numeração

Apresentei esta decisão como **DEC-3**. A DEC-3 da fila é o h1 da home, e
continua aberta. A decisão tomada — *"Vamos de a"* — está registrada como
**DEC-19**, com número próprio, para o registro parar de apontar para outra
coisa. O que foi decidido e construído é o que segue; só o rótulo estava errado.

## O que mudou

A DEC-1 foi decidida em A — *"nada do seu conteúdo sai sem um gesto seu"*, com a
matriz de exceções nomeada — e a razão dada foi: *"na conta paga vou querer
injetar informações para as features"*. Essa razão obriga uma segunda decisão, e
ela foi tomada junto: o servidor guarda o que a feature precisa, **e a conta
mostra o quê**.

O que torna A defensável não é a tela que lista. É o apagar funcionar. Por isso
os dois saíram na mesma entrega.

### No banco

- **`walkstamp.prazos()`** — os três prazos de retenção passaram a existir
  **uma vez só**. Eles estavam escritos dentro do `expurgo` como três `declare`,
  e a política de privacidade repetia os mesmos números em prosa, em cinco
  idiomas: duas listas paralelas com a mesma verdade. Agora o expurgo lê de lá e
  a tela da conta lê de lá.
- **`walkstamp.meus_dados(email)`** — quanto de cada coisa existe para aquela
  pessoa, mais o que **não** sai quando ela apaga. Contagem, não conteúdo: a tela
  não precisa reler os roteiros para dizer que há sete.
- **`walkstamp.apagar_meus_dados(email, confirmacao)`** — apaga roteiros, casos,
  anexos, modelos pessoais e chamados. Os anexos entram na fila do
  `anexo_orfao` **antes** das linhas sumirem, que é o caminho que o
  `roteiro_apagar` já usa: depois do `delete` não haveria de onde tirar o
  caminho do arquivo no balde.

As três portas públicas nascem fechadas para `anon` e `authenticated`, com o
mesmo bloco de `revoke` + conferência que as funções do roteiro já usam — o
`revoke from public` sozinho não fecha, porque o Supabase deixa um
`alter default privileges` armado.

**Migração aplicada direto no Supabase** (projeto `walkstamp`), e conferida
depois de aplicar: `prazos` devolve 90/24/18, `meus_dados` de um e-mail
desconhecido devolve zeros, `apagar_meus_dados` com confirmação errada devolve
`confirmacao_nao_bate`, e o `expurgo` a seco continua funcionando depois da
reescrita.

### Na conta

`/conta/<idioma>/dados`, nos cinco idiomas, com **duas tabelas na mesma altura**:

| o que o botão apaga | o que fica, e por quê |
|---|---|
| roteiros, casos, anexos, modelos seus, chamados | faturas — guardar documento fiscal é obrigação legal, e a fatura descreve a venda, não o seu trabalho |
| | registros de emissão — é a contagem para o limite do plano, não guarda o que estava nos documentos |
| | a conta e a assinatura, enquanto você assinar — apagar quem assina no meio da assinatura quebra a cobrança |

Uma tela que só lista o que apaga é a promessa de antes com mais palavras; uma
que só lista o que fica é uma confissão. O que a torna honesta é dizer as duas
coisas com o mesmo peso, com o motivo escrito ao lado do que fica.

O item **não tem `exige`**: quem está no plano gratuito também entra: é
justamente quem mais precisa da resposta antes de decidir se assina.

## Dois defeitos que a construção revelou

**O botão de apagar era inerte sem JavaScript.** A primeira versão era um
componente de cliente com `useState` e o botão `disabled` enquanto a confirmação
estivesse vazia. Parecia comodidade; era trava. Sem hidratação — JavaScript
desligado, ou uma CSP que barre o script de arranque — o botão nasce `disabled`
no HTML do servidor e **nunca deixa de ser**. A pessoa que veio exercer o direito
de apagar os próprios dados abriria a gaveta, digitaria o e-mail, clicaria num
botão morto e sairia achando que exerceu. O componente deixou de ser de cliente:
quem segura o campo vazio agora é o `required` do navegador e o banco, que
compara a confirmação com o e-mail da sessão. Duas travas, nenhuma em JavaScript.

**O `tsconfig.tsbuildinfo` estava rastreado no git.** O cache incremental do
TypeScript, commitado. Nesta build ele fez o `tsc --noEmit` da esteira reprovar
uma rota que existe — e o mesmo mecanismo, virado do outro lado, **aprova código
que ele não reconferiu**. Uma porta de liberação que erra para o lado do
"passou" é pior que porta nenhuma. Entrou no `.gitignore` e saiu do índice.

## A régua

`testes/meusdados.mjs` — banco falso, `next start`, sessão por cookie, no mesmo
desenho do `cancelar.mjs`. Ela prova:

- as duas tabelas aparecem nos cinco idiomas, com o motivo do que fica junto;
- as contagens são as do banco — a tela não inventa número;
- **os prazos vêm do banco**: com 45 e 6 no banco, a tela diz 45 e 6, e o 90
  antigo não sobrou escrito em lugar nenhum;
- a gaveta nasce fechada, e o campo não é alcançável sem abrir;
- o botão chega ao servidor e a ação executa — a confirmação errada volta
  pintada na tela;
- **o e-mail que chega ao banco é o da sessão**, mesmo com o formulário
  adulterado no navegador para dizer outro;
- sem sessão, o pedido forjado não apaga nada — e o par *com* sessão prova que o
  identificador está vivo, senão a régua aprovaria uma recusa que não é a da
  sessão.

**Provada por reprovação no ponto que importa:** trocando `p_email: email` por
`p_email: form.get('email')`, ela reprova com
`e o e-mail que chegou é o da sessão → vitima@cliente.example`.

Três defeitos da própria régua foram corrigidos antes de ela valer:
`networkidle` voltava **antes** do POST da ação (cinco afirmações reprovando por
causa de uma espera, não do produto); `emails.every(...)` numa lista vazia é
verdadeiro, então a afirmação passava justamente quando o banco não tinha sido
chamado; e o pedido forjado ia como `urlencoded` num formulário que o Next
declara `multipart` — a mesma classe de erro que derrubou a primeira versão do
`cancelar.mjs`, com outra roupa. A gaveta também perdeu a classe `sub`: o
`_navegador.mjs` abre todo `details.sub` antes de a página carregar, e a gaveta
que precisa nascer fechada nasceria aberta para quem a mede.

## Esteira

`bash testes/liberar.sh` — **33 de 164 réguas, verde**, incluindo
`meusdados.mjs`, `cancelar.mjs`, `compra.mjs`, `negocio.mjs`, `precos.mjs` e a
conferência das migrações contra o MANIFESTO.

Cadência: builds 32, 33 e 34 com a esteira específica. A completa (`rodar.sh`)
entra no **36**, ou antes se for publicar.

## O que ficou de fora, e por quê

**A política de privacidade não foi tocada.** Ela ainda não menciona esta tela
nem o direito de apagar, e ainda fala da lista de aviso em pt e es. Não dobrei o
build para caber: é documento legal em cinco idiomas, merece a régua própria, e
agora tem mais a dizer do que teria ontem — porque o botão existe. A tela nova
não contradiz a política; ela entrega mais do que a política promete, e prometer
menos do que se faz não é mentira. Mas é o próximo item.

## O que eu faria em seguida, nesta ordem

1. **A política de privacidade** — citar a tela `/dados`, o direito de apagar e
   os prazos vindos do `prazos()`, e matar a lista de aviso em pt e es.
2. **O offline não cumpre o B da DEC-1** — onze referências a `cdn.jsdelivr.net`.
   Embutir ou degradar-com-aviso.
3. **A frase única da DEC-1** e a régua que a prova contra o que o produto
   realmente chama.

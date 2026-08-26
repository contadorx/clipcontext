# Build 6 — O que já está vendido

**Data:** 24/08/2026
**Fila completa:** `FILA.md`. **Decisão respondida:** DEC-18.

Um visto numa tabela de preço é uma promessa. Estas eram as que não entregavam —
e, como nos cinco builds anteriores, **a fila errava**: dois dos seis itens já
estavam feitos ou meio feitos.

| item da fila | o que eu medi |
|---|---|
| "Convidar por e-mail" — nenhum e-mail sai *(DEC-6)* | **Já feito.** `app/api/convite/route.ts` chama `mandarEmail`; o disparo sai pela Brevo. Linha morta |
| "Bloqueio imediato de assento" | **Metade feita.** O `timeAviso` já dizia, com todas as letras, que bloquear impede a PRÓXIMA emissão |
| "Faturas para baixar" *(DEC-9)* | Verdade — e o lugar exato era pior do que a fila supunha |
| "Licença que se renova sozinha" | Verdade, e o limite do conserto virou decisão de desenho |
| "Modelo pessoal vaza entre colegas" | Verdade, **e maior**: eram duas metades, em direções opostas |
| O vocabulário guardado *(DEC-5)* | Confirmado, e continua para o build próprio *(DEC-17)* |

---

## 1 · O "só para mim" passa a ser de quem salvou

O item que você mandou fazer primeiro, e sozinho. Ele era **duas** coisas:

**Um membro não conseguia salvar o próprio modelo.** O botão existe na
ferramenta e manda `escopo: 'personal'`; a função exigia `papel = 'admin'`. Quem
não administra clicava e via "não deu", sem motivo na tela.

**E o que fosse salvo não era pessoal.** A tabela é chaveada por `cliente_id` e
não tinha coluna de dono. Pior: a `perfil_do_usuario` — a função que alimenta a
**ferramenta** — trazia este comentário, no ar há meses:

> *"O escopo `personal` de OUTRA pessoa não aparece aqui — ele é dela."*

com um `select` logo abaixo filtrando só por `cliente_id`. **O comentário
descrevia um filtro que não existia.**

**E eu quase repeti o defeito consertando.** Arrumei `perfil_do_usuario` e fui
seguir — mas `time_painel`, que alimenta a **conta**, tinha o mesmo `select` sem
filtro. Duas funções leem a tabela; corrigir uma é a mesma verdade em dois
lugares, consertada em um.

O que passou a valer: coluna `dono_email` com o invariante **no banco** (um
`check` que torna impossível gravar um pessoal sem dono); as duas leituras
filtrando; qualquer membro salva o seu; padrão do time continua sendo de quem
administra; **nem quem administra apaga o pessoal de alguém**; um `p_escopo`
nulo deixou de converter um "só para mim" em padrão da equipe; e o botão
"Apagar" sumiu de cima do que a pessoa não pode apagar.

**Doze afirmações** provadas em migrações que montam o cenário, testam e se
apagam — incluindo a negativa: o banco recusa um pessoal sem dono por SQL cru.

> **O número que muda a leitura:** a tabela tinha **uma linha**, de escopo
> `time`. Nenhum modelo pessoal chegou a existir. O vazamento estava armado e
> **nunca disparou** — e é por isso que a migração não precisou adivinhar de
> quem era o quê. Um mês depois, precisaria.

---

## 2 · A chave avisa antes de vencer — e o que eu não consegui entregar

O `lib/stripe.ts` prometia, em comentário: *"uma licença curta que se renova
sozinha enquanto a assinatura estiver viva"*. **Nada renovava.** Não há cron nem
função agendada. A chave vale 45 dias e, no dia **seguinte** ao vencimento, a
ferramenta dizia *"fale comigo para renovar"* — depois de a marca do cliente já
ter sumido do documento, e sem dizer para onde ir.

Você escolheu renovar pela própria ferramenta. Implementei — e então descobri o
limite, antes de entregar:

> **A sessão da ferramenta vive em `sessionStorage`, e o token dela vence.** No
> caso comum — trinta e cinco dias depois, noutra aba — **não há sessão**, e a
> renovação silenciosa que eu tinha acabado de escrever **nunca dispararia**.

Não dá para entregar isso como "resolvido". O que fiz:

1. **A renovação silenciosa existe** e roda quando há sessão — grátis quando dá.
2. **O aviso vem ANTES**, com o número de dias e o **link da conta**, nos dez
   dias finais. É o que salva a pessoa no caso comum.
3. **O comentário do `lib/stripe.ts` parou de prometer o que o produto não faz**,
   e passou a registrar por quê: renovar sem sessão exigiria uma credencial de
   longa duração no navegador — que piora o modelo de ameaça — ou um cron
   mandando e-mail, que cria infraestrutura para manter.

> **E eu preciso corrigir uma coisa que te disse.** Ao te oferecer o caminho,
> escrevi que ele faria *"o bloqueio de assento passar a valer no próximo uso em
> vez de em 45 dias"*. **Isso estava errado.** A chave que já está no navegador
> continua valendo até a data dela, renovando ou não — bloquear impede a próxima
> emissão, e só. Encurtar isso exigiria uma consulta a servidor de licença, que
> quebra a promessa de funcionar offline. O `timeAviso` já dizia a verdade; fui
> eu que a contradisse na hora de te propor.

---

## 3 · O endereço da fatura deixa de ser jogado fora

A página promete "faturas para baixar". O webhook faz a parte dele: manda
`p_url: hosted_invoice_url` a cada evento.

**E a função recebia esse parâmetro e nunca o usava** — nem no `insert`, nem no
`on conflict`. Estava na assinatura, e só. A tabela não tinha coluna. O endereço
chegava ao banco a cada cobrança e morria ali, desde a primeira venda.

Um parâmetro que ninguém lê é pior que um que não existe: quem escreveu o
webhook tinha razão em achar que estava mandando aquilo para algum lugar.

Coluna `fatura_url` — **separada da `nf_url`**, porque são documentos
diferentes: uma é o recibo da Stripe, a outra é a nota fiscal que sai depois do
pagamento. Juntá-las faria a tela oferecer "nota fiscal" apontando para um
recibo em inglês. A tabela da conta passou a ter as duas colunas.

**Quatro afirmações provadas**, incluindo a que mais importa: o reenvio do mesmo
evento **sem** endereço não apaga o que já veio — a Stripe reenvia quando não
recebe 2xx, e um `coalesce` na direção errada trocaria o link por nulo.

---

## 4 · DEC-18 — o ✕ do que o Free não tem deixa de ser vermelho

Seis células saíam em `var(--err)`, o mesmo vermelho de "falhou", descrevendo o
**nosso** plano Free. O símbolo ficou; a cor virou cinza. A `/steps` continua
vermelha, e lá está certo — ela compara com um concorrente.

Quem achou isso não fui eu: foi o autor da folha, num bloco morto que existia
para consertar exatamente isto e nunca pegou.

---

## A esteira, e as três réguas que me pegaram

```
143 ok · 5 PULADO · 0 FALHOU
Pulados: timepag.mjs licenca.mjs liclink.mjs licauto.mjs legal.mjs
  Um teste pulado NÃO é um teste que passou. O motivo de cada um está acima.
Nada vermelho — mas a cobertura é a dos 143, não a dos 148.
```

**148 réguas, contra 146 no Build 5** — entraram `modelopessoal.mjs` e
`renovar.mjs`.

**`modelo.mjs` reprovou, e era relógio onde deveria haver condição.** Ele espera
o modelo de voz sair da memória e media isso com 400 ms fixos depois de o botão
reabilitar. Sozinho passava; sob carga, soltar o modelo levou mais que isso e a
régua leu 1 onde já ia dar 0. É a mesma família de `rolar`, `espera2` e
`descarte`, que o Build 3 consertou — esta escapou porque **só reprova sob
carga**. Passou a esperar a condição.

**`funil.mjs` recusou a minha medição nova.** Eu escrevi `p_origem: 'renovacao'`
e não olhei o vocabulário que o banco aceita — a medição seria **descartada**, e
o build de 22/08 registra que este mesmo funil já jogou fora oito de onze
eventos exatamente assim.

E o conserto revelou um defeito **na própria régua**: ela lia os seis
vocabulários de uma migração só. Funcionava enquanto as seis restrições
andassem juntas; na primeira que mexeu só numa, ela continuou lendo a lista
velha e reprovou um valor que o banco já aceitava. Passou a achar a **última
migração de cada restrição** — a mesma lógica que a `modelopessoal.mjs` usa.

**Duas réguas novas**, `modelopessoal.mjs` e `renovar.mjs`, as duas provadas nos
dois sentidos. E a segunda tem um **bloco pulado escrito**: pintar o aviso na
tela exige uma licença assinada, e a chave privada não viaja neste pacote.

> **Um erro meu que a régua nova pegou no mesmo dia em que nasceu.** Escrevi a
> constante do prazo junto da renovação, seiscentas linhas **abaixo** do primeiro
> uso. `const` em zona morta temporal não devolve `undefined`: derruba a carga
> inteira com um `ReferenceError`. A `renovar.mjs` cobra que a declaração venha
> antes do uso, e reprova quando eu a devolvo para o lugar errado.

---

## O que fica para depois

- **A DEC-17** — vocabulário do domínio em alemão e francês. Build próprio, como
  o CSS teve: muda como o número é montado, e eu não consigo verificar contra
  fala real aqui.
- **A régua do fluxo de entrada**, aberta no Build 5.
- **O bloqueio imediato de assento**, se você quiser: hoje ele vale na próxima
  emissão, e isso está dito na tela. Torná-lo imediato custa a operação offline.

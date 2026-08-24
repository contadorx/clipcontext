# Build 5 — O caminho até a compra

**Data:** 23–24/08/2026
**Fila completa:** `FILA.md`. **Decisões respondidas:** DEC-7, DEC-13.
**Item aberto que este build criou:** o fluxo de entrada perdeu a régua — está
escrito na `FILA.md` e o `timepag.mjs` **pula, alto**, dizendo o que se perdeu.

---

## A fila errou quatro dos sete itens

Como nos dois builds anteriores. Medido antes de mexer:

| o que a fila dizia | o que estava lá |
|---|---|
| o clique não leva a intenção | Verdade, e **pior**: ela morria em **três** pontos, não um |
| os 14 dias entram nos cartões e no FAQ *(DEC-4)* | **Já feito no Build 3.** Linha morta |
| a base esconde **86%** do Ctrl+F | **93%** — 45 acordeões, **nenhum** aberto |
| CTAs absolutos quebram em prévia | **Zero** CTAs absolutos à mão. O problema era outro, e maior |
| `/precos` não linka `/seguranca` nem `/verificar` | Confirmado — e `/seguranca` era beco sem saída |
| `/time` órfã *(DEC-7)* | Confirmado |

---

## A intenção de compra morria em três lugares

Quem clica **"Assinar o Team"** quer uma coisa específica. Entre esse clique e a
tela onde o pagamento começa havia três pontes, e nenhuma existia:

1. **O cartão** mandava `<a href="{{conta}}" data-cta="team">` — o plano estava
   num atributo de **análise**, não na URL.
2. **O link do e-mail** carregava só o idioma: `?lang=pt`.
3. **A conta** lia `erro|feito|comprou|cancelou` do endereço, e mais nada.

O resultado: três telas para dizer duas vezes a mesma coisa. A pessoa escolhia o
plano, ia ao e-mail, voltava, e escolhia de novo — no meio de uma compra.

As três pontes foram construídas, e a chegada **diz o que a pessoa veio fazer**:
o botão que ela pediu é o cheio, o outro recua para fantasma, e uma linha em
cinco idiomas confirma a escolha. O outro botão **não** some: quem clicou errado
na página de preços não pode ficar preso na escolha que fez lá.

### O nome do plano é um, e agora está declarado

A vitrine chama de `team`; a Stripe chama de `time`. Os dois nomes são
legítimos — um é palavra de venda, o outro é chave de cobrança —, e a tradução
entre eles ia virar um `if` escondido no meio de um gerador de HTML.

Ela virou um campo, `planoCodigo`, conferido contra `lib/stripe.ts` **no build**.
Um plano que a Stripe não conhece **derruba o build**, com a frase inteira, em
vez de virar um `?plano=team` que a conta recebe e ignora em silêncio.
Provado: trocando `time` por `team`, o build para.

### Cada ponte foi quebrada de propósito, uma a uma

E a régua reprovou as três pelo nome — o cartão sem o parâmetro, o formulário
sem o campo, a rota de confirmação descartando a volta. Depois, restauradas,
verde.

---

## Quatro voltas apontavam para produção, sempre

`marca.site` é `https://walkstamp.com` escrito à mão, e era a base de **quatro
endereços de execução**: o link do e-mail, o `success_url` e o `cancel_url` da
Stripe, e o `return_url` do portal.

Numa prévia da Vercel ou em `localhost`, **o link do e-mail levava a pessoa para
o site de verdade**. Quem testasse a compra numa prévia estaria testando a compra
de outro site — e, pior, num ambiente onde o teste parece funcionar.

Passou a existir uma `base()` que olha o ambiente. O `canonical` e o OG
continuam absolutos e fixos **de propósito**: ali o endereço público é o certo, e
é outra pergunta. A régua cobra as duas coisas separadas.

---

## A base de conhecimento estava 93% escondida do Ctrl+F

45 acordeões, **nenhum** aberto, e os **dois** links da página para `/precos`
dentro deles. Quem chega procurando uma resposta não acha; o buscador indexa
mal; e a página que mais responde objeção de compra escondia a saída para a
compra.

Nascem abertos. **Fechar continua possível** — é para isso que o elemento fica,
e a régua cobra as duas coisas: que abram por padrão e que ainda fechem.

## E as duas páginas de confiança deixaram de ser becos

`/precos` não linkava `/seguranca` nem `/verificar` — as duas páginas que
respondem *"posso confiar nisto?"* ficavam a um clique de lugar nenhum, enquanto
a decisão de comprar acontece ali. E `/seguranca` saía **só** para a política de
privacidade: quem terminava de ler não tinha para onde ir.

As duas ganharam saída, nos cinco idiomas.

---

## A `/time` foi aposentada — e o endereço não

Órfã e indexável: **nenhuma** página do site levava a ela, e ela vendia o mesmo
plano que a `/precos`.

**O que eu medi antes de mexer, porque a premissa da decisão dependia disso:**
das 43 frases dela, **uma** existia em outro lugar com as mesmas palavras. Mas os
*assuntos* estavam cobertos — a `/seguranca` já tem "a versão offline", "a conta
paga e a única exceção" e "o que sai da sua máquina"; a `/privacidade` tem prazos
e revogação. O que **não** tinha outro lugar era a mecânica da licença: como a
chave é conferida, e por que ela vale pouco tempo.

Essas duas seções foram para a `/seguranca`, nos cinco idiomas — que é onde essa
pergunta nasce numa avaliação de fornecedor, logo depois de "o que sai da minha
máquina".

**O endereço continua respondendo.** Uma página que sai do ar não some do mundo:
ela está em canonical indexado, em sitemap enviado e em links que outras pessoas
publicaram. Os cinco endereços velhos devolvem **308** para a página de preços no
idioma certo, e a régua cobra isso e a saída do sitemap.

A lista mora em `rotas.json`, gerada de uma tabela `APOSENTADAS` no `build.py`,
e o `next.config.mjs` monta os redirecionamentos a partir dela — escrever a lista
nos dois lugares seria o defeito de sempre.

---

## O que este build me custou em cobertura, dito com todas as letras

A `/time` não era só marketing: ela tinha um fluxo de **e-mail → link mágico →
chave**, com oito blocos de teste em `timepag.mjs`.

Seis deles cobriam coisas que ninguém cobre hoje:

    [3] e-mail malformado não sai do lugar
    [4] pedir o link
    [5] o limite de envio é dito, e não engolido
    [6] a volta do link mágico entrega o link do plano
    [7] degustação já usada tem resposta escrita, e não silêncio
    [8] link do e-mail vencido

**O fluxo não morreu — a maneira de testá-lo daqui morreu.** Ele mora em
`entrar()` e na rota de confirmação. Os blocos antigos falsificavam o Supabase
interceptando chamadas do **navegador**; na conta essas chamadas acontecem no
**servidor**, dentro de uma ação, e a interceptação do lado do navegador não
alcança. Reescrever contra a arquitetura nova é trabalho de verdade, e não cabia
aqui.

**Então o arquivo pula, alto, em vez de ser apagado.** Apagar deixaria a esteira
com um número menor e a mesma cobertura — o tipo de verde que este projeto passou
três builds aprendendo a não aceitar. O item está na `FILA.md`, e o arquivo
antigo com os oito blocos está na história do git para quem for reescrever.

---

## Três vermelhas na regressão, e as três eram minhas

O `rodar.sh` que guarda os logs (Build 4) pagou de novo: os três motivos estavam
escritos, sem eu precisar rodar nada de novo.

**`portal.mjs [1]`** afirmava o contrato da `/time` — que o painel tinha saído
dela, que ela ainda emitia a chave. Contrato correto enquanto a página existia.
Virou um ponteiro dizendo para onde foi cada afirmação, como o Build 3 fez com o
`cenarios` e o `timepag`: duas réguas sobre a mesma página é o mesmo defeito que
duas páginas sobre o mesmo plano.

**`ajuda.mjs`** contava `<details>` literal e enxergou **1** onde há 45 — o `open`
que eu tinha acabado de adicionar cegou a contagem. E o conserto revelou a
segunda camada: com `<details\b` deu **46**, porque **um comentário meu
mencionava a tag**. É a segunda vez em dois builds: no anterior, um comentário
que escrevia a tag de abertura do corpo fez o recorte da página começar no lugar
errado. Os dois lados foram consertados — o comentário deixou de escrever a tag,
e a régua passou a apagar comentários antes de contar.

---

## A esteira

```
141 ok · 5 PULADO · 0 FALHOU
Pulados: timepag.mjs licenca.mjs liclink.mjs licauto.mjs legal.mjs
  Um teste pulado NÃO é um teste que passou. O motivo de cada um está acima.
Nada vermelho — mas a cobertura é a dos 141, não a dos 146.
```

**146 réguas, contra 145 no Build 4-A** — entrou a `compra.mjs`, que anda o
caminho da home ao checkout nos cinco idiomas. O quinto pulado é o `timepag.mjs`,
e ele é novo: é o custo deste build, contado em vez de escondido.

---

## O que eu faria a seguir

1. **Build 6 — o que já está vendido.** É o build das promessas da página de
   preços, e as duas decisões abertas entram nele: a **DEC-18** (o ✕ vermelho no
   que o Free não tem) é uma linha de CSS, e a **DEC-17** (vocabulário em alemão
   e francês) é o item mais pesado dele.
2. **A régua do fluxo de entrada**, que este build deixou em aberto. Ela é
   pré-requisito para mexer com confiança em qualquer coisa de autenticação —
   inclusive a DEC-13, que ficou de fora daqui por decisão sua.

Represados por sua instrução, sem mudança: Stripe (DEC-14), Drive (DEC-15) e o
vocabulário de cenários (Build 12).

# Build 48 — o convite de assento manda o e-mail que o cartão Team vendia

## O defeito

O cartão Team diz, nos cinco idiomas: **"Assentos: convidar por e-mail, sem
ninguém digitar chave"**. Medido em 28/08: o assento era criado no banco e
**nenhum e-mail saía**. Quem administra tinha que avisar por fora — no WhatsApp,
no chat da empresa — que é exatamente o trabalho manual que o cartão diz que ele
não terá.

Era a pior categoria da lista: **vendida como pronta**, sem selo de "em
construção", e sem régua nenhuma cobrindo a falta. O painel dizia "Salvo." e ia
embora. Ninguém percebia porque nada olhava.

## O que passou a acontecer

Convidar agora tem **duas metades**, e é a única ação de time que não passa pelo
`comoAdmin`: as outras quatro terminam no banco, esta continua depois.

- **e-mail saiu** → *"Convite enviado para fulano@empresa.com."*
- **e-mail não saiu** → recado **neutro**, nem verde nem vermelho: *"O assento de
  fulano@ foi criado, mas o convite por e-mail não saiu. Avise a pessoa: ela
  entra na conta com este mesmo endereço, e a licença chega sozinha."*

O meio-termo existe porque as duas leituras erradas custam caro, cada uma para
um lado: "deu certo" faz o administrador ir embora achando que a pessoa foi
avisada — e quem fica sem saber que tem assento é o convidado, que não tem como
reclamar do que não recebeu; "deu erro" o faz repetir uma criação que já
aconteceu.

**A carta não carrega acesso.** Sem chave, sem token, sem link de sessão: um
convite com acesso dentro vira acesso encaminhável. Ela carrega o endereço da
conta, e a entrada é a de sempre — link mágico, pedido pelo próprio convidado.

## O limite, e por que ele não é o do outro convite

O `/api/convite` (o "indique a ferramenta a um colega") é aberto ao mundo: 5 por
hora por origem. **Reaproveitar esse número aqui quebraria a funcionalidade que
este build existe para entregar** — um time de 25 assentos levaria cinco horas
para ser montado.

`walkstamp_convite_assento_pode`, migração nova, **aplicada no Supabase e
conferida** (fechada a `anon` e a `authenticated`, aberta só ao `service_role`):

- **60/hora por administrador** — folga para montar um time numa sentada, e
  ainda um teto para um laço em fuga;
- **2/dia por destino** — o mesmo número do outro convite, porque a regra que
  ele protege é a mesma: reconvidar não gasta assento (o insert é `on conflict
  do update`), então sem isso o convite viraria jeito de incomodar alguém.

## Três cartas, um molde

O produto manda três e-mails e tinha **dois HTMLs diferentes** — o do convite,
com moldura, marca em texto e fundo; e o do chamado respondido, sem nada disso.
O de assento ia ser o terceiro. Agora os três saem do `lib/carta.ts`.

Em e-mail esse defeito é invisível de dentro: ninguém abre as três no Outlook
para comparar, e a que ficou torta só aparece errada na caixa de quem recebe —
que não reclama, só não clica.

## As réguas, e o que a prova por falha me mostrou

`email.mjs` ganhou os blocos **[5]** e **[6]**; `portal.mjs` ganhou a afirmação
de que, sem disparador configurado, a tela **não diz "convidado"**.

Desliguei o envio para provar por falha — e **quatro afirmações continuaram
verdes**. A tela dizia "enviado" (era o defeito, não a prova), e as outras liam
`CARTAS[CARTAS.length - 1]`, que era **a carta do bloco [3]**, de outro assunto.
Uma afirmação que passa lendo o artefato de outro é pior do que afirmação
nenhuma: ela dá o verde e cala.

Reescrito: a carta é a **deste** bloco (`CARTAS.length === antes + 1`) ou é nula,
e nula reprova tudo que depende dela. Com o envio desligado: **5 FALHA(S)**.

## Dois portões que aprovavam por vazio

1. **`sh supabase/conferir.sh`** dizia *"46 conferem, 0 faltam, 0 diferem"* —
   com **54 migrações no disco**. As oito de fora não estavam erradas: estavam
   invisíveis, livres para mudar sem nada reclamar. Entraram no `MANIFESTO.md5`,
   e o conferidor passou a comparar **nos dois sentidos**. Provado por falha:
   tirando uma linha, ele sai com 1.

2. **O `portal.mjs` não estava no mapa do `liberar.sh`** — a régua da área do
   cliente, e mexer no `app/conta/acoes.ts` saía verde sem ela rodar. Ligada
   agora, junto com as cartas.

E daí saiu o número que ninguém tinha medido: **62 das 171 réguas não são
alcançáveis pelo corredor específico** — só rodam no `rodar.sh` completo. Não é
defeito do mapa, é um **limite**, e o que faltava era ele estar escrito.
"Esteira específica verde" quer dizer *verde no que o mapa alcança*. O
`inventario.mjs` ganhou o bloco [6] com **teto de 62, que só desce**: régua nova
sem linha no mapa reprova no dia em que nasce.

## Esteira

`bash testes/liberar.sh` — **33 de 171**, verde. `build.py` · `tsc --noEmit` ·
17 contratos · migrações × MANIFESTO · `portal` · `email` · `convite` · `compra`
· `cancelar` · `meusdados` · `negocio` · `entrada2` · `paginas` · `seo` ·
`buscaajuda` · `medicao` · `offlineb` · `egressao` · `prazos` · `marcos-a11y`.

## O que fica pendendo de você — e agora custa uma funcionalidade paga

**`CONVITE_SAL` na Vercel.** Sem ele o hash do limite não existe, e o convite de
assento cai no meio-termo honesto: o assento nasce, a carta não sai. Era um item
de higiene na sua lista; passou a ser o que separa o cartão Team de cumprir o
que promete. É um campo.

Junto dele: `BREVO_API_KEY` e `EMAIL_DE` precisam estar configurados no mesmo
ambiente — se já estão para o convite do site, servem para este.

## A seguir

**Build 49** — DEC-5, caminho A: o vocabulário guardado entre visitas, com
opt-in explícito. Fecha as duas linhas em `construcao` do catálogo.

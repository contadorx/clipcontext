# Build 32 — Os termos passaram a vender

## O que mudou

**A cláusula 14 dos termos, nos cinco idiomas.** Ela dizia *"hoje não há nada à
venda; os planos descritos na página de preços são intenção, não oferta"*. Isso
deixou de ser verdade no dia em que a conta, a degustação de 14 dias, o checkout
da Stripe e o cancelamento na conta entraram no produto — e um termo que nega a
venda que o site faz é pior que um termo omisso.

A cláusula agora se chama **"Planos pagos, renovação e cancelamento"** e diz:

- os planos **estão à venda**;
- a cobrança é **anual e feita pela Stripe**, pelo preço publicado na página de
  preços no momento da contratação;
- a assinatura **renova sozinha** no fim de cada período;
- antes de qualquer cobrança, quem entra pela primeira vez tem **14 dias com
  tudo, sem cartão e sem checkout**; acabados os 14 dias nada é cobrado e a
  conta volta ao plano gratuito;
- **cancelar se faz na própria conta**, a qualquer momento e sem falar com
  ninguém;
- o cancelamento vale para a renovação seguinte: o acesso vai até o fim do
  período já pago e **não há devolução proporcional** (DEC-11, caminho B — *"o
  reembolso na B não existe"*), com a ressalva de que os direitos que a
  legislação consumerista garante a pessoa física continuam de pé, **inclusive o
  art. 49 do CDC** — a cláusula 15 elege a lei brasileira, então essa ressalva
  não é cortesia, é o que sobra da cláusula depois da lei.

**A cláusula 13 foi junto.** Ela resumia a privacidade dizendo que *"o único dado
pessoal que existe é o e-mail que você opcionalmente deixa na lista de aviso"* —
uma lista que a DEC-16 tirou do produto. Agora diz que os dados pessoais que
existem são **o e-mail da conta** e, para quem assina, **o que a Stripe precisa
para cobrar**. A frase sobre vídeo continua igual, porque continua verdade.

## O que passou a ser cobrado

`testes/legal.mjs` fixava o texto antigo: exigia *"lista de aviso"* e *"não há
nada à venda"* nas páginas. Era uma régua correta que virou régua errada — e foi
ela que reprovou a primeira rodada desta esteira, que é exatamente o serviço que
se espera dela.

Ela agora exige, **nos cinco idiomas**, as quatro frases que sustentam a venda —
está à venda · 14 dias com tudo · cancelar na conta · sem devolução proporcional
— mais o `art. 49`, e **proíbe** as duas frases antigas. Alemão e francês
entraram: os termos falam cinco idiomas e esta lista olhava para três, a mesma
falha que a parte de privacidade tinha corrigido em 23/08.

## Um defeito na própria porta de liberação

Rodando a esteira, o shell reclamou de sete comandos inexistentes —
`reabrir`, `juntar`, `indice`, `grade`, `anotacao`, `app`, `rapido.sh`.

O mapa `arquivo tocado -> réguas` do `liberar.sh` era uma **string entre aspas
duplas**, e os comentários dentro dela citavam nomes de régua entre crases. Entre
aspas duplas, crase é **substituição de comando**: a porta de liberação executava
aqueles sete nomes — e `src/template.html` — toda vez que subia. Não quebrou nada
porque nenhum deles existe como comando neste computador. É essa a parte ruim:
bastava um comentário citar um comando que **existe** para a esteira rodá-lo, sem
ninguém pedir. É o mesmo defeito de classe do backtick dentro do `PIP_CSS`, agora
no lugar onde ele teria mais alcance.

O mapa virou heredoc com delimitador entre aspas simples (`<<'MAPA_FIM'`). Nada
lá dentro expande — nem crase, nem `$`, nem nada.

Junto: `fuser -k 8802/tcp` imprimia o PID em **stdout**, e o número aparecia
colado na linha da primeira régua do site (`5132  paginas.mjs   ok`), como se
fosse resultado dela. Foi para `/dev/null`.

## Esteira

`bash testes/liberar.sh` — **24 de 163 réguas, verde**. As outras 139 ficaram de
fora de propósito: este diff não as toca. Primeira rodada: `legal.mjs` FALHOU com
quatro frases; segunda: verde. Cadência combinada em 27/08 — `liberar.sh` a cada
build, `rodar.sh` a cada cinco e antes de publicar.

## Decisões registradas

- **DEC-1** — promessa de residência de dados: **A no hospedado, B no offline**.
  Motivo de quem decidiu: *"na conta paga vou querer injetar informações para as
  features"*. A matriz de exceções precisa nascer com espaço para o conteúdo que
  a conta paga vai mandar de propósito; vídeo e áudio continuam absolutos nas
  duas pontas. Fica devendo: a frase escrita uma vez só, a régua que a prova, e o
  offline cumprir B.
- **DEC-11** — reembolso: **caminho B**, sem devolução proporcional. Entregue
  nesta build.

## O que eu faria em seguida, nesta ordem

1. **A privacidade ainda fala da lista de aviso** — em pt, es (e as tabelas de
   bases legais). É o mesmo texto morto que os termos acabaram de perder, e é
   documento legal. É o impedimento mais barato que sobrou.
2. **O offline não cumpre o B que acabou de ser decidido** — onze referências a
   `cdn.jsdelivr.net`. Decidir entre embutir e degradar-com-aviso.
3. **A frase única da DEC-1** e a régua que a prova contra o que o produto
   realmente chama.

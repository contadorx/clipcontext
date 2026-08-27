# Auditoria pendente — a página de preços

> **GERADO POR `build.py`. Não edite à mão.**
> Uma linha por promessa que os cartões e a comparação publicam: a frase,
> e o teste que a comprova — ou `sem teste`, com todas as letras.
> Onde está `sem teste`, **não quer dizer que não funcione**: quer dizer
> que nada no repositório reprova se parar de funcionar.

## Cartão — Crie a evidência (Free)

| A frase publicada | O teste |
|---|---|
| Evidência completa, com impressão digital e tarja de dado sensível | `evidencia.mjs` |
| Tudo processado no seu computador | `semrede.mjs` |
| Todos os formatos de saída | `saidas.mjs` |
| Link pré-configurado para colar no Jira, no Zephyr, no Xray ou no TestRail — é um endereço, não uma integração | `linkpage.mjs` |
| Sem conta para usar | `semrede.mjs` |

## Cartão — Execute o seu roteiro (Personal)

| A frase publicada | O teste |
|---|---|
| Importe a planilha de casos de teste | `roteiro.mjs` |
| Abra cada caso já preenchido | `roteiro.mjs` |
| Devolva situação, data, executor e impressão digital na mesma planilha | `roteiro.mjs` |
| Guarde o seu padrão de documento e o seu cliente | `modelos.mjs`, `planos.mjs` |
| A sua marca no topo de todos os formatos | `marca.mjs` |

## Cartão — Coordene a rodada (Team)

| A frase publicada | O teste |
|---|---|
| Distribua e reatribua os casos do roteiro | `roteiro.mjs` |
| Acompanhe o que está pendente e quem está executando | `roteiro.mjs` |
| Padrão da equipe aplicado no documento de todo mundo | `modelos.mjs` |
| Assentos, convite, bloqueio e prazo de revogação | `licenca.mjs`, `convite.mjs` |
| Classificação e campo de emissor no documento | `emissor.mjs` |

## A comparação curta

| A linha | O teste |
|---|---|
| Criar a evidência | `evidencia.mjs` |
| Guardar o seu padrão e o seu cliente | `modelos.mjs` |
| Executar um roteiro de casos | `roteiro.mjs` |
| Atribuir e acompanhar quem executa | `roteiro.mjs` |
| Padronizar o documento da equipe | `modelos.mjs` |

---

**0 promessa(s) sem trava** de 20.

---

## As afirmações soltas da página — escritas à mão, e por quê

Estas moram dentro dos cinco `src/site/bodies/precos.<idioma>.html`, e não na
lista de dados do `build.py`. O gerador **não as gera**, e diz que não gera:
prometer gerar o que não se gera é o defeito que ele veio consertar.

O arquivo desta seção é `src/auditoria-solta.md`, e o `build.py` o cola aqui a
cada build. Editar o `AUDITORIA-PENDENTE.md` não adianta — ele é reescrito.

| A frase publicada | O teste |
|---|---|
| Vídeo, áudio e transcrição não saem do seu computador | `semrede.mjs` — a evidência sai inteira com todo pedido externo abortado, e cada corpo que o app tentou mandar é lido, pesado e impresso; `precos.mjs` continua cobrindo a página |
| Cobrança anual, renova sozinha, cancela na conta | `renovar.mjs` (a renovação, com o aviso pintado), `cancelar.mjs` (o caminho do cancelamento, nos cinco idiomas) — **nenhum dos dois abre o portal da Stripe**, e os dois dizem isso no cabeçalho |
| A partir de 3 pessoas, e o total mínimo anual | `precos.mjs`, `cinco.mjs`, `promessa.mjs` — o número sai de `lib/stripe.ts`, e desde o Build 4 o `build.py` o lê de lá em vez de repetir |
| As suas colunas voltam como estavam | `roteiro.mjs` |
| Nenhum número da calculadora sai do navegador | `precos.mjs` |
| Os formatos abrem em Word, PowerPoint, navegador e LMS | `saidas.mjs`, `figuras.mjs` (a tira), `pptx.mjs`, `scorm.mjs` |
| É um endereço, não uma integração automática | **sem teste** — mas é uma negação, e negação que se cumpre sozinha |
| A licença é conferida no seu computador e funciona sem internet | `licenca.mjs`, `licauto.mjs` |
| Revogar respeita o prazo de 1 a 90 dias | `licauto.mjs` |
| A nota fiscal vem depois do pagamento, pela Stripe | **sem teste** |
| A quantidade de assentos é ajustável | **sem teste** |

## O que continua pendente, e onde ele está agora

**Duas funcionalidades publicam com selo, e não como prontas.** Três linhas de
`src/features.json` carregam `estado`: duas em `construcao` (a lista de termos
guardada, que hoje mora em `sessionStorage` e morre com a aba) e uma em `beta`
(entrada automática por domínio de e-mail). Elas aparecem **só dentro da lista
completa recolhida**, nunca num cartão — `precos.mjs` cobra que nenhum selo
apareça nos cartões. A decisão continua sua: ou as três passam a existir de
verdade, ou o selo fica.

~~**O clique de compra não leva a intenção consigo.**~~ **Resolvido, e este
parágrafo estava velho.** Medido em 27/08: o `?plano=` sai do cartão nos cinco
idiomas, a conta lê e valida o valor (uma URL é coisa que qualquer um escreve),
a intenção atravessa o link do e-mail num campo escondido do formulário, e o
painel destaca o plano escolhido. Os quatro elos têm régua: `compra.mjs` [1] [2]
[3] e `entrada2.mjs` [2]. O piso de 3 assentos continua recusado no servidor,
saindo de `PLANOS[plano].assentos`.

**`npm run stripe:conferir` nunca rodou.** Sem `STRIPE_SECRET_KEY` no ambiente,
e ele recusa chave de produção, que é o comportamento certo. Falta confirmar com
a chave de teste que o preço do Team continua `per unit`: em `tiered` ou
`volume`, comprar 12 assentos cobra por 1. É a **DEC-14**, represada por sua
instrução.

~~**O vocabulário do domínio não fala alemão nem francês.**~~ **Fala, desde o
Build 7, e este parágrafo estava velho desde então.** A tabela é gerada de 0 a
999 nos cinco idiomas — 8.329 formas provadas rodando o código do produto, e não
uma cópia dele. A medição corrigiu a própria DEC-17 no caminho: não eram dois
idiomas faltando, eram três (o inglês também não lia número a partir de cem).

**O que continua aberto ali é uma lacuna menor, e você a aceitou por escrito:**
para `de` e `fr` não houve teste com voz real. As grafias estão certas; o que
falta é saber como o Whisper as escreve erradas — que é para isso que existe o
`APELIDOS`. Quando alguém falar num microfone nesses idiomas, a lista cresce.

> Resolvidos e tirados desta lista: o vídeo `/demo/rodada.*` que dava 404 nos
> cinco idiomas (a figura de quatro estados entrou no lugar), o bloco de apoio
> em Pix, a lista de aviso do plano pago (Build 3, DEC-16), e a bala do cartão
> Personal que vendia o vocabulário guardado — a metade que não existe — sem
> mencionar a que existe e é gratuita. O motivo desta última está escrito no
> `build.py`, em cima da bala, porque é o tipo de erro que volta.


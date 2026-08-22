# Reavaliação das funcionalidades pagas

**Data da revalidação:** 22 de agosto de 2026  
**Escopo:** estado versionado neste repositório. Produção, Stripe, caixas de
e-mail, atendimento humano e emissor fiscal não foram acessados; por isso, o que
depende deles não recebe o estado “resolvido” apenas por estar documentado.

## Resposta curta

**Não, o conjunto ainda não está resolvido.** Houve avanço técnico importante,
sobretudo no banco versionado, na cobertura do roteiro e na idempotência da
fatura. Ainda há duas divergências comerciais visíveis, um segundo webhook
executável no repositório e bloqueadores que só podem ser encerrados com prova em
homologação/produção.

| resultado | quantidade |
|---|---:|
| Resolvido no repositório | 1 P0 |
| Parcialmente resolvido | 2 P0 |
| Não resolvido | 1 P0 |

Isso não significa que apenas quatro tarefas restam: os quatro P0 são problemas
agregadores. A seção de bloqueadores separa as provas que ainda faltam.

## Conferência objetiva do catálogo

A contagem original continua correta:

- **93** funcionalidades em 12 grupos;
- **71** com `planos: "fpt"`, portanto disponíveis em Free, Personal e Team;
- **15** com `planos: "pt"` e **7** com `planos: "t"`, totalizando **22**
  exclusivamente pagas;
- **zero** propriedades `breve` nos 93 itens.

O arquivo diz explicitamente que só cataloga o que existe e que algo futuro deve
ter `"breve": true`. A página gerada também tem um teste que compara as 93 linhas
e os selos de plano com esse arquivo. Isso prova consistência entre **catálogo e
tabela gerada**, mas não prova disponibilidade em produção nem corrige o resumo
manual dos planos, acima da tabela.

## Reavaliação dos quatro P0

### P0.1 — A oferta lidera com identidade, não com orquestração

**Estado: não resolvido.**

O resumo do Personal ainda o apresenta como o plano de quem entrega documento
com nome próprio/do cliente. Na lista, “Identificar o documento” vem antes de
“Roteiro de casos”. O texto introdutório da própria página reduz o pago a marca
do cliente e administração de equipe. O roteiro está presente, mas não lidera a
promessa.

**Para encerrar:** mudar a frase do Personal, a ordem dos benefícios e a chamada
principal para uma promessa do tipo “importe, execute, comprove e devolva os casos
preenchidos”. Marca deve permanecer como prova visual secundária.

### P0.2 — Preços, catálogo e existência discordam

**Estado: parcialmente resolvido, ainda impeditivo.**

O catálogo e a tabela gerada agora têm uma fonte única e um teste de paridade.
Entretanto, o cartão manual do Personal ainda marca modelo, perfil e termos
persistentes como “em breve”, e o Team faz o mesmo com o perfil/padrão da equipe.
Esses itens aparecem sem `breve` no catálogo, cuja regra afirma que eles existem.
A página ainda explica que o selo significa que a função não existe.

O código e as migrações contêm implementações para perfil, modelos, vocabulário
persistente e configuração do time. Isso torna a divergência mais plausivelmente
um erro de comunicação do que uma ausência total de código, mas **não autoriza
remover “em breve” sem um teste contra o ambiente vendido**.

**Para encerrar:** manter uma matriz por funcionalidade com quatro colunas
obrigatórias (`catálogo`, `código`, `homologação`, `produção`). Só depois de
um caso feliz e um negativo em produção a linha pode ficar sem `breve`. O resumo
manual deve ser gerado da mesma matriz ou possuir teste que impeça a contradição.

### P0.3 — Banco pago não reproduzível

**Estado: resolvido no repositório; implantação ainda precisa de confirmação.**

O repositório passou a trazer 42 migrações, `config.toml`, seed, impressão
esperada e uma prova que reconstrói o banco e executa 40 afirmações. A paridade
registrada cobre tabelas, funções, índices, permissões, restrições, RLS e
sequências.

Há, porém, dois limites operacionais documentados no próprio projeto:

1. três migrações corretivas ainda estavam pendentes de `supabase db push` na
   produção usada para a comparação;
2. a tabela/função de limite do convite ainda é descrita como SQL a colar pelo
   painel, fora da sequência reproduzível.

Portanto, o defeito original (“as RPCs pagas não têm migrações”) foi resolvido
para o núcleo pago versionado, mas o critério operacional mais forte é: migrar o
SQL do convite, executar a reconstrução em CI e guardar a saída de um `db push`
seguido da comparação com produção.

### P0.4 — Dois webhooks Stripe sem autoridade única

**Estado: parcialmente resolvido, ainda impeditivo.**

A documentação agora nomeia `/api/stripe/webhook` como endpoint oficial e manda
registrar apenas um. A persistência de fatura é idempotente por `stripe_id`, e a
prova do banco cobre reentrega e cancelamento.

Contudo, `supabase/functions/walkstamp-stripe/index.ts` continua sendo um webhook
completo e implantável. Um aviso na documentação reduz o risco, mas não elimina a
segunda autoridade nem impede configuração duplicada. Além disso, o webhook
legado só trata faturas, enquanto a rota oficial também trata checkout e ciclo da
assinatura; ativar o legado cria comportamento parcial e difícil de diagnosticar.

**Para encerrar:** remover/arquivar o Edge Function executável (ou fazê-lo
responder `410 Gone`), declarar a rota Next como autoridade em um ADR e fazer a
checagem da Stripe exigir **exatamente um** endpoint, não “pelo menos um”.

## Bloqueadores de venda pública

| bloqueador original | estado verificável | conclusão e prova que falta |
|---|---|---|
| Banco reconstruível por migrações | **Parcial** | Artefatos e prova existem; falta incorporar o SQL do convite, rodar a prova em CI e confirmar o `db push` de produção. |
| Webhook único e idempotente | **Parcial** | Idempotência de fatura está testada; o segundo handler ainda existe e a configuração real da Stripe não foi observada. |
| Homologação separada | **Não demonstrado** | Há instruções para modos test/live da Stripe e banco local, mas não um app, projeto Supabase e credenciais de staging separados e reproduzíveis. |
| Assinatura e cancelamento completos | **Parcial** | Banco testa `active` e `canceled`, e a conta abre o portal Stripe; falta E2E real de compra, renovação, falha, cancelamento, reembolso e reativação. |
| Testes negativos multiempresa | **Parcial** | Há recusas para membro, pessoa de outro cliente e dono incorreto do roteiro; falta uma matriz que exercite cada RPC/rota paga entre duas empresas. |
| Recuperação de conta e administrador | **Parcial** | Login por link mágico evita recuperação de senha e o admin não pode se bloquear; falta sucessão/recuperação quando o único admin perde o e-mail. |
| LGPD | **Parcial** | Política, minimização e expurgo têm código; caixas de privacidade, cron, atendimento ao titular e evidência de execução dependem de operação externa. |
| Observabilidade sem conteúdo | **Não demonstrado** | Há cuidado pontual com respostas e logs, mas não SLO, alerta, correlação, painel de falhas ou teste que proíba vídeo, texto e evidência em logs. |
| Processo de nota fiscal | **Não resolvido** | O projeto reconhece que Stripe não emite NFS-e e aceita URL manual; falta emissor, responsável, prazo, reconciliação e contingência. |
| Capacidade real de suporte | **Não demonstrado** | Chamados e NPS existem tecnicamente; faltam escala, cobertura, responsável, meta de resposta e ensaio de volume. |

## Potencial comercial, agora

As notas continuam sendo uma avaliação qualitativa, não uma medição de
mercado. Com o estado atual do repositório:

| dimensão | nota | leitura |
|---|---:|---|
| Potencial do portfólio pago | **8/10** | O roteiro conecta importação, execução, prova e coordenação; é uma proposta vendável. |
| Clareza da oferta | **5/10** | Roteiro aparece, mas identidade ainda lidera e o “em breve” contradiz a tabela. |
| Prontidão técnica aparente | **7/10** | Banco versionado e testes elevaram a nota; ambiente e E2E externos impedem nota maior. |
| Prontidão comercial/operacional | **4/10** | Nota fiscal, suporte, observabilidade e provas reais continuam abertos. |
| Aderência do preço ao valor comunicado | **5/10** | O preço pode ser defensável pela orquestração, mas a mensagem ainda vende principalmente identidade. |

## Linha de monetização recomendada

A linha permanece válida e agora tem mais suporte no código:

1. **Repetição:** modelos, perfil e vocabulário persistentes.
2. **Orquestração:** importar, mapear, executar, anexar prova e devolver casos.
3. **Governança:** roteiro compartilhado, atribuição, assentos e padrão do time.

Marca do cliente é um benefício demonstrável, mas não deve ser o produto.
Cloud/API continua corretamente apresentado como futuro e não deve entrar na
venda antes de os três degraus acima estarem provados.

## Critérios objetivos de abertura

Não foi encontrado outro documento versionado com critérios de abertura para
Personal, Team e Cloud/API. Para que a decisão seja auditável, valem estes gates:

### Personal — abrir somente quando todos estiverem verdes

- zero contradições entre cartão de preço, `features.json` e produção;
- E2E em homologação: trial → compra → ativação → renovação/falha →
  cancelamento → expurgo, com reenvio de evento;
- roteiro individual validado com XLSX, CSV e colagem, incluindo reimportação,
  anexo, recibo e exportação;
- modelo, perfil e vocabulário testados em dois navegadores/máquinas;
- emissão de NFS-e e suporte ensaiados com responsável e prazo definidos;
- reconstrução do banco e testes negativos executados em CI.

### Team — além de todos os gates do Personal

- duas empresas artificiais nos testes, cobrindo leitura e escrita cruzadas em
  todas as RPCs e rotas de time;
- convite, limite de assentos, bloqueio, atribuição e troca do administrador em E2E;
- padrão do time com versão, precedência explícita, rollback e trilha de mudança;
- compra e ajuste de quantidade do Team reconciliados com a Stripe;
- três equipes reais concluindo ao menos um roteiro, com entrevista de valor e
  incidente acompanhado.

### Cloud/API — somente depois de Personal e Team estáveis

- base legal, contrato de operador/suboperadores, região, retenção e deleção
  verificável para áudio, vídeo e transcrição;
- threat model, limites, autenticação, isolamento por cliente e teste de abuso;
- fila idempotente, cancelamento, retentativa, observabilidade sem conteúdo e
  orçamento por trabalho;
- SLO e capacidade medidos com lote real, além de política de suporte e preço
  baseados no custo observado.

## Ordem recomendada revisada

1. Resolver a divergência de mensagem e `breve` sem presumir o estado de produção.
2. Eliminar o webhook legado e provar exatamente um endpoint Stripe.
3. Levar o SQL do convite para migração e tornar a reconstrução um check de CI.
4. Montar homologação separada e executar o ciclo completo do Personal.
5. Abrir Personal centrado no roteiro individual, com NFS-e e suporte ensaiados.
6. Completar isolamento, sucessão de admin e versionamento do padrão do time.
7. Provar Team com três equipes reais.
8. Só então avaliar conversão, transcrição em nuvem, lote e API.

## Comandos usados nesta revalidação

```sh
# contagem independente do catálogo
node - <<'NODE'
const j = require('./src/features.json');
const itens = j.grupos.flatMap(g => g.itens);
console.log(itens.length);
console.log(Object.fromEntries(['fpt', 'pt', 't'].map(p =>
  [p, itens.filter(i => i.planos === p).length])));
console.log(itens.filter(i => Object.hasOwn(i, 'breve')).length);
NODE

# paridade entre catálogo, tabela de preços e aplicativo gerado
node testes/vitrine.mjs

# build e TypeScript
npm run build

# reconstrução comportamental do banco (requer Postgres local)
sh supabase/testes/prova.sh
```

Nesta máquina, `vitrine.mjs` e o build terminaram com sucesso. A prova do banco
não rodou porque não havia Postgres em `/tmp/pgsock:5433`; portanto, sua existência
e seu conteúdo foram auditados, mas o resultado descrito no README não foi
reproduzido nesta revalidação.

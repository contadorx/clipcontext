# Avaliação completa das possibilidades de features pagas do Walkstamp

**Data:** 21 de agosto de 2026
**Escopo:** página de preços, catálogo de 93 funcionalidades, aplicação local,
área de conta, licenciamento, Stripe, roteiro de casos, equipes e testes.

> A página pública foi solicitada diretamente, mas respondeu HTTP 403 neste
> ambiente. A avaliação da oferta usa sua fonte canônica
> (`src/site/bodies/precos.pt.html`), que é a origem da página publicada, além
> do código executável e dos testes do repositório.

## 1. Veredito executivo

O Walkstamp **tem matéria-prima real para cobrar**, e mais código pago pronto do
que a página de preços deixa perceber. O melhor produto pago não é “um PDF com
logotipo”. É um **sistema leve de execução e comprovação de testes**, que liga
planilha de casos, execução guiada, evidência local, recibo verificável e
coordenação de equipe sem enviar o vídeo.

Minha avaliação dura é:

- **potencial do portfólio pago: 8/10**;
- **clareza atual da oferta: 5/10**;
- **prontidão técnica aparente: 6/10**;
- **prontidão comercial/operacional: 4/10**;
- **aderência do preço ao valor comunicado: 5/10**.

O problema principal não é falta de features. É a falta de uma decisão nítida
sobre **qual trabalho caro o cliente paga para eliminar**. A página abre dizendo
que o pago compra “identidade” e “administração”, mas o código já oferece algo
mais valioso: eliminar o trabalho de organizar, distribuir, executar, recolher e
auditar dezenas de casos de teste.

### Recomendação central

Manter o motor de evidência completo no Free é coerente e diferenciador. Cobrar
por três coisas, nesta ordem:

1. **repetição:** salvar e reaplicar padrões, termos e modelos;
2. **orquestração:** importar casos, executar, devolver status e recibos;
3. **governança:** equipe, atribuição, assentos, padrão obrigatório e histórico.

Identidade visual deve continuar no pago, mas como **prova visível do plano**,
não como sua principal justificativa econômica.

---

## 2. O que a oferta atual promete

### Free — R$ 0

O Free entrega o produto funcional inteiro: entrada de vídeo, gravação,
detecção de mudanças, transcrição local, edição, proteção de dados e quase todos
os formatos de saída. O catálogo confirma 71 de 93 itens disponíveis nos três
planos.

Essa generosidade não inviabiliza a receita. Ela cria uma linha de corte boa:
ninguém paga para a evidência “funcionar”; paga para não reconstruir o contexto
na próxima sessão e para coordenar mais gente.

### Personal — R$ 149/ano

A página destaca:

- marca do cliente;
- roteiro de casos;
- modelo próprio;
- perfil persistente;
- glossário persistente;
- tudo do Free.

Por R$ 12,42/mês, o preço é baixo para uso profissional e simples de aprovar
sem compras corporativas. Pode funcionar muito bem como porta de entrada, mas
apenas se a pessoa perceber um ganho recorrente. “Logotipo” sozinho é fraco;
“uma planilha com 40 casos volta preenchida” é forte.

### Team — R$ 349/pessoa/ano, mínimo de cinco

O contrato inicial é R$ 1.745/ano. O Team acrescenta:

- convite por link;
- padrão empurrado para todos;
- gestão de assentos e prazo;
- faturas e chamados;
- recursos compartilhados de roteiro e atribuição.

O preço absoluto continua baixo em B2B, mas o salto do Personal para a entrada
do Team é grande. A página precisa demonstrar, de forma mensurável, que a
coordenação economiza mais que R$ 145/mês para o time inteiro.

### Pro e API — intenção, ainda sem produto

Conversão HEVC/MKV/ProRes, transcrição no servidor, lote e API são citados como
futuro. São oportunidades reais, mas formam **outro negócio operacional**:
passam a ter custo variável, fila, armazenamento temporário, segurança de
upload, observabilidade e SLA. Não devem ser misturados ao lançamento dos
planos locais.

---

## 3. Achados ordenados do mais grave para o menos grave

| Prioridade | Achado | Impacto | Dificuldade |
|---|---|---|---|
| P0 | A página vende identidade, mas o valor econômico real é a orquestração de casos | conversão e posicionamento | média |
| P0 | Oferta pública, catálogo e código discordam sobre o que já existe | confiança e venda | baixa |
| P0 | O repositório não contém migrações reproduzíveis das RPCs pagas | deploy, suporte e continuidade | alta |
| P0 | Há dois caminhos de webhook Stripe, sem uma autoridade explicitamente única | cobrança e concessão de acesso | média |
| P1 | A página mistura “começar teste agora” com “avise quando sair” | conclusão do funil | baixa |
| P1 | Team não demonstra valor suficiente para justificar o mínimo de cinco | venda B2B | média |
| P1 | Trial de 14 dias não tem plano de ativação explícito | aprendizado e conversão | média |
| P1 | Catálogo de 93 linhas prova amplitude, não decisão de compra | leitura e conversão | baixa |
| P1 | “Sem login” e “entra por link” podem esconder dependência real de conta/e-mail | expectativa e segurança | baixa |
| P1 | Pro/API violam a economia e o modelo de risco do núcleo local | margem e reputação | alta |
| P2 | Personal está possivelmente subprecificado para o valor de roteiro | receita | baixa |
| P2 | Faturas e chamados são higiene, não benefícios de Team | percepção de valor | baixa |
| P2 | Falta empacotamento por persona/caso de uso | aquisição | média |
| P2 | Ausência de prova social e cálculo de ROI | confiança | média |
| P3 | Nomes Free/Personal/Team são claros, mas “Personal” soa individual demais para consultoria | posicionamento | baixa |

### P0.1 — O produto pago está sendo vendido pelo benefício mais fraco

“Colocar logotipo” é facilmente comparado com editar um Word. “Importar 40
casos, abrir cada execução preenchida, recolher status, executor, data, hash e
arquivo” substitui um processo inteiro. O segundo tem dor, frequência, dono e
orçamento; o primeiro é acabamento.

**Correção:** o hero do Personal deve vender “execute uma planilha inteira sem
montar cada evidência à mão”. Marca própria aparece depois como consequência.

### P0.2 — A fonte comercial está desatualizada em relação ao catálogo

A página marca modelo próprio, perfil persistente, glossário persistente e
padrão de equipe como “em breve”. Porém `src/features.json` declara todos como
existentes e o código contém telas e ações de modelos/configuração. O próprio
catálogo estabelece a regra de que uma linha sem `breve` é uma promessa já
entregue; hoje há zero itens `breve` entre 93.

Essa divergência tem dois resultados ruins: ou o produto deixa de vender algo
que já funciona, ou promete como pronto algo que ainda não passou pelo caminho
de produção. Ambos são problemas de release, não de copy.

**Correção:** criar uma matriz de disponibilidade validada por teste de ponta a
ponta e fazer cards, tabela e feature flags nascerem da mesma fonte.

### P0.3 — A camada de dados paga não é reproduzível pelo repositório

O código chama várias RPCs `walkstamp_*` para conta, time, roteiro, faturas,
convites e modelos. No diretório `supabase/`, contudo, só aparecem os arquivos
da Edge Function Stripe; não há migrações SQL versionadas para reconstruir as
tabelas, políticas e funções usadas.

Isso cria dependência de um banco “artesanal” que não pode ser recriado, revisto
ou promovido de homologação para produção. Para cobrar, esquema, RLS, grants,
retenção e rollback precisam estar no Git.

**Correção:** antes de venda aberta, versionar migrações idempotentes, seed de
homologação e um teste que sobe um Supabase limpo e percorre trial → compra →
licença → cancelamento → expiração.

### P0.4 — Duas implementações de webhook aumentam o risco de estado divergente

Há uma rota Next em `app/api/stripe/webhook/route.ts` e uma Edge Function em
`supabase/functions/walkstamp-stripe/`. Mesmo que uma seja transição ou reserva,
o repositório não torna inequívoco qual URL deve estar configurada na Stripe.

**Correção:** eleger uma única autoridade, remover/desativar a outra e testar o
endpoint real com Stripe CLI. Idempotência por `event.id`, reconciliação diária
e replay precisam ser observáveis.

### P1.1 — O funil termina em dois estados incompatíveis

O Personal oferece “Começar os 14 dias”; o Team oferece “Falar”; logo abaixo a
página pede e-mail para avisar “quando o plano pago sair”. O visitante não sabe
se está comprando, testando beta ou entrando em lista de espera.

**Correção:** escolher um estado por plano:

- disponível: **Testar agora**;
- beta assistido: **Pedir acesso**;
- futuro: **Entrar na lista**.

Não mostrar os três estados na mesma página sem rotular cada plano.

### P1.2 — Team precisa demonstrar governança, não apenas assentos

“Convidar, bloquear e escolher prazo” administra licença; não administra
trabalho. O diferencial vendável está mais abaixo no catálogo: roteiro comum,
atribuição por pessoa, visibilidade de quem fez o quê e padrão imposto.

**Correção:** mostrar um fluxo visual:

> coordenador importa 40 casos → atribui → cinco pessoas executam → painel
> acompanha 31/40 → planilha e recibos voltam completos.

### P1.3 — Trial sem ativação desperdiça os 14 dias

O código concede trial sem cartão, o que reduz atrito. Mas “14 dias com tudo” só
converte se a pessoa chegar ao valor pago. Abrir uma conta e gerar um PDF Free
não prova o Personal.

**Correção:** checklist de ativação no trial:

1. salvar um perfil/modelo;
2. importar ao menos cinco casos;
3. executar um caso pelo link;
4. baixar a planilha preenchida;
5. aplicar marca em um documento.

O trial deve começar na primeira ação paga relevante, ou ter extensão automática
se a pessoa ainda não conseguiu importar casos.

### P1.4 — A tabela completa é documentação, não página de decisão

Noventa e três linhas abertas em grupos ajudam auditoria e SEO, mas colocam
recursos críticos e detalhes pequenos no mesmo peso. Isso aumenta a percepção
de complexidade e esconde o motivo de upgrade.

**Correção:** antes da tabela, mostrar apenas cinco diferenças:

| Resultado | Free | Personal | Team |
|---|---:|---:|---:|
| Criar evidência completa | sim | sim | sim |
| Reutilizar seu padrão | — | sim | sim |
| Executar planilha de casos | — | individual | compartilhada |
| Atribuir e acompanhar pessoas | — | — | sim |
| Padronizar toda a equipe | — | — | sim |

Manter “Ver todas as 93 funcionalidades” como expansão secundária.

---

## 4. Avaliação feature por feature paga

### 4.1 Roteiro de casos — prioridade máxima

**Valor:** muito alto
**Aderência ao produto:** máxima
**Defensabilidade:** alta
**Prontidão observada:** média/alta
**Recomendação:** lançar primeiro

É o melhor núcleo pago porque usa o ativo exclusivo do Walkstamp — transformar
execução gravada em evidência — e o conecta ao artefato que equipes de QA já
possuem: a planilha.

O código cobre importação, mapeamento de colunas, links preenchidos, conclusão,
anexo opcional, exportação e atribuição. O risco está na camada de banco não
versionada e na necessidade de testar autorização entre usuário, time e admin.

**Métrica norte:** casos concluídos por roteiro por semana.
**Ativação:** primeiro roteiro com cinco casos e um concluído.
**Retenção:** segundo roteiro importado em até 30 dias.

### 4.2 Modelos, perfil e termos persistentes — prioridade alta

**Valor:** alto para recorrência
**Aderência:** alta
**Defensabilidade:** média
**Prontidão:** aparentemente alta, comercialmente inconsistente
**Recomendação:** lançar junto do Personal

Persistência é uma linha de corte justa: aplicar configuração continua gratuito;
não redigitar em cada máquina é conveniência profissional. É simples de
explicar e aumenta retenção.

Evitar chamar tudo de “perfil”. Vender como três resultados:

- **Seu padrão de documento** — cenário, campos, layout e capa;
- **Seu cliente** — nome e logotipo;
- **Seu vocabulário** — termos que melhoram a transcrição.

### 4.3 Marca do cliente — prioridade alta como prova, média como aquisição

**Valor:** médio
**Aderência:** alta
**Defensabilidade:** baixa
**Prontidão:** alta
**Recomendação:** manter, sem liderar a oferta

É tangível, demonstrável e útil para consultorias, fábricas de software e
freelancers. Também torna o plano visível no arquivo entregue, o que ajuda
aquisição orgânica. Mas não sustenta sozinho uma assinatura.

Adicionar prévia “antes/depois” e explicitar onde a marca aparece. Testes já
cobrem PDF, DOCX e HTML; PPTX e demais saídas devem declarar claramente se não
recebem a identidade.

### 4.4 Roteiro compartilhado e atribuição — prioridade máxima para Team

**Valor:** muito alto
**Aderência:** máxima
**Defensabilidade:** alta
**Prontidão:** média
**Recomendação:** benefício principal do Team

É o recurso que transforma uso individual em sistema de registro. Deve ser o
centro da página Team, acompanhado de painel de progresso, filtros e trilha de
atividade mínima.

Antes de vender, provar isolamento entre organizações, troca de time, remoção de
assento, caso reatribuído e acesso após expiração.

### 4.5 Padrão empurrado para a equipe — prioridade alta

**Valor:** alto em auditoria e consultoria
**Aderência:** alta
**Defensabilidade:** média/alta
**Prontidão:** aparentemente existente
**Recomendação:** segundo pilar do Team

Não vender como “configuração”. Vender como **todos entregam o mesmo documento,
sem treinamento e sem checklist paralelo**.

Faltam políticas explícitas: o membro pode sobrescrever? O padrão é aplicado a
documentos já abertos? Há versão e rollback? Para governança, “empurrar” sem
histórico pode gerar inconsistência silenciosa.

### 4.6 Assentos, convite e domínio — necessários, mas não são o produto

**Valor:** higiene B2B
**Aderência:** necessária
**Defensabilidade:** baixa
**Prontidão:** média
**Recomendação:** entregar, mas não destacar acima do resultado

Convite sem senha reduz fricção. Entrada automática por domínio pode acelerar
adoção, mas exige cuidado especial: domínio verificado, tratamento de aliases,
provedores públicos bloqueados e processo de recuperação de propriedade.

Prazo de licença de 1 a 90 dias é útil para terceiros, temporários e auditorias,
mas precisa ser explicado como controle de acesso, não como licença técnica.

### 4.7 Faturas, chamados e renovação automática — obrigação operacional

**Valor percebido:** baixo
**Aderência:** necessária
**Defensabilidade:** nenhuma
**Prontidão:** média
**Recomendação:** remover dos bullets principais

São requisitos para cobrar com confiança. Não justificam Team; Personal também
precisa de faturas e suporte. Diferenciar suporte por SLA apenas quando houver
capacidade operacional real.

### 4.8 Conversão de formatos Pro — boa expansão, depois do núcleo

**Valor:** alto para quem é bloqueado por formato
**Aderência:** média
**Defensabilidade:** baixa/média
**Prontidão:** inexistente segundo a página
**Recomendação:** validar demanda antes de construir

HEVC/MKV/ProRes resolvem uma falha de entrada, não aumentam o valor da evidência.
Podem ser vendidos por créditos ou minutos, pois criam custo variável. Primeiro
medir quantos usuários abandonam por codec e oferecer conversão local quando
WebCodecs/FFmpeg WASM for suficiente.

### 4.9 Transcrição no servidor — oportunidade com risco estratégico

**Valor:** potencialmente muito alto
**Aderência:** média
**Defensabilidade:** média
**Prontidão:** inexistente
**Recomendação:** produto separado e opt-in

Resolve computadores lentos e pode ser o maior ganho de velocidade, mas toca a
promessa mais sensível do Walkstamp. Nunca deve acontecer como fallback
automático. O usuário escolhe, vê preço, região, retenção e exclusão antes do
upload.

Modelo recomendado:

- local continua padrão e gratuito;
- “Transcrição rápida na nuvem” é escolha explícita;
- cobrança por minuto ou pacote, não incluída ilimitadamente no anual;
- áudio separado do vídeo quando possível;
- exclusão automática curta e verificável;
- contrato/DPA para Team/Enterprise.

### 4.10 Lote e API — maior teto, maior desvio de foco

**Valor:** alto em integrações
**Aderência:** média
**Defensabilidade:** alta se orientada a evidência
**Prontidão:** inexistente
**Recomendação:** discovery com 5 clientes, não roadmap aberto

Uma API genérica de frames + transcrição compete com fornecedores maduros e
vira commodity. Uma API específica de **evidência estruturada**, com mudança de
tela, timestamp, hash, campos do caso e saídas Walkstamp, preserva diferenciação.

Só construir depois de obter cinco compromissos claros contendo volume, formato,
latência, retenção, região e disposição a pagar.

---

## 5. Arquitetura de planos recomendada

### Free — “Crie a evidência”

Manter:

- captura/gravação;
- transcrição local;
- revisão e proteção de dados;
- todos os formatos essenciais;
- reabertura local;
- integridade/hash;
- uso sem cadastro e sem limite artificial.

### Personal — “Repita seu processo”

Incluir:

- tudo do Free;
- padrões, modelos, glossário e identidade persistentes;
- roteiro individual de casos;
- exportação da planilha preenchida;
- recibos e anexos opcionais;
- histórico pessoal mínimo.

**Preço sugerido para teste:** manter R$ 149/ano no lançamento fundador, mostrar
também R$ 19/mês ou R$ 190–249/ano como preço de tabela futuro. Não aumentar sem
medir conversão, uso do roteiro e retenção.

### Team — “Coordene e padronize a execução”

Incluir:

- tudo do Personal;
- roteiro compartilhado;
- atribuição e acompanhamento;
- padrão obrigatório/versionado;
- assentos, convite e domínio verificado;
- trilha de atividade;
- gestão central de modelos;
- suporte comercial compatível com a capacidade real.

**Preço:** R$ 349/pessoa/ano é plausível. Testar mínimo de três, não cinco, para
reduzir o salto inicial; ou manter cinco e incluir onboarding assistido. O custo
de aquisição e suporte decidirá.

### Cloud/Pro — “Acelere e automatize”

Separar da assinatura local:

- créditos por minuto de transcrição/conversão;
- lote;
- retenção configurável;
- API por consumo;
- SLA apenas em contrato superior.

Essa separação protege a margem: planos anuais não subsidiam processamento
ilimitado.

---

## 6. Página de preços recomendada

### Nova ordem

1. **Headline orientada ao trabalho:** “A evidência é grátis. Você paga para
   repetir, coordenar e padronizar.”
2. **Três cards com um resultado por plano**, não listas extensas.
3. **Demonstração do roteiro** em quatro imagens/passos.
4. **Comparação de cinco diferenças decisivas**.
5. **Calculadora simples de ROI**.
6. **Privacidade e limites do que é armazenado**.
7. **FAQ comercial**.
8. **Tabela completa recolhida**.

### Microcopy sugerida

**Personal**

> Importe sua planilha, execute cada caso pelo link e receba status, data,
> executor e evidência de volta — com o seu padrão e a marca do cliente.

**Team**

> Distribua os casos, acompanhe o que falta e faça todo mundo entregar a mesma
> evidência, sem mandar o vídeo para o Walkstamp.

### ROI que a página pode demonstrar

Exemplo conservador:

- 40 casos por ciclo;
- 3 minutos poupados por evidência;
- 2 horas poupadas por ciclo;
- uma hora profissional acima de R$ 73 já paga um ano Personal no primeiro
  ciclo.

Não publicar o cálculo como verdade antes de medir. Usá-lo como hipótese para
entrevistas e telemetria consentida.

---

## 7. Prontidão técnica e riscos

### O que está bem encaminhado

- trial sem cartão reduz atrito;
- checkout impede assinatura duplicada pela aplicação;
- webhook verifica assinatura e falha fechado sem segredo;
- licença local preserva funcionamento offline;
- recursos pagos têm portas explícitas no painel;
- roteiro separa escopo pessoal e de time;
- anexar a sessão é opt-in;
- há testes específicos de licença, webhook, convite e modelos;
- a promessa de privacidade influencia o desenho, não só o marketing.

### Bloqueadores antes de venda pública

1. **Banco versionado:** migrações, RLS, grants, storage e retenção no Git.
2. **Webhook único:** idempotência, replay e reconciliação.
3. **Ambiente de homologação:** Stripe test + Supabase separado + e-mail real.
4. **Ciclo de assinatura completo:** compra, falha de pagamento, renovação,
   upgrade/downgrade, cancelamento, chargeback e expiração.
5. **Isolamento multi-tenant:** testes negativos em todas as RPCs de time e
   roteiro.
6. **Recuperação:** troca de e-mail, perda de acesso ao domínio e admin que sai.
7. **LGPD:** base legal, operador/suboperadores, exportação, exclusão e DPA.
8. **Observabilidade:** eventos comerciais sem coletar vídeo, áudio ou
   transcrição.
9. **Nota fiscal:** processo e prazo explícitos, já que não sai da Stripe.
10. **Suporte:** canal, prazo e limite compatíveis com preço anual baixo.

### Testes que faltam ou precisam ficar portáveis

- remover caminhos absolutos `/root/walkstamp` dos testes;
- executar licença com emissor em CI seguro, sem expor chave privada;
- teste real via Stripe CLI;
- concorrência de dois eventos Stripe fora de ordem;
- isolamento entre duas empresas e dois roteiros;
- convite expirado, reutilizado e encaminhado;
- domínio público ou não verificado recusado;
- revogação chegando ao navegador offline após a validade curta;
- anexos apagados também no storage;
- restore de backup do banco pago.

---

## 8. Métricas para decidir o roadmap pago

### Funil

- visita a preços → entrada na conta;
- conta → início efetivo do trial;
- trial → primeiro modelo salvo;
- trial → primeiro roteiro importado;
- roteiro importado → primeiro caso concluído;
- trial → assinatura;
- assinatura → renovação.

### Valor

- casos concluídos por usuário/semana;
- roteiros ativos por organização;
- percentual de documentos que usam modelo salvo;
- tempo entre importar e concluir roteiro;
- assentos ativos/assentos pagos;
- configurações de equipe efetivamente aplicadas;
- segundos/minutos poupados, medidos por amostra voluntária.

### Saúde

- falhas de checkout e webhook;
- tempo entre pagamento e licença válida;
- tentativas de acesso cruzado bloqueadas;
- chamados por 100 contas pagas;
- churn por motivo;
- custo de suporte e infraestrutura por plano;
- minutos de nuvem por receita, caso Pro exista.

Não registrar nome de arquivo, frames, áudio, transcrição ou conteúdo do caso.

---

## 9. Pesquisa recomendada antes de construir mais

Entrevistar separadamente:

1. QA/testadores que hoje montam evidência no Word;
2. consultorias que entregam documentação com marca do cliente;
3. coordenadores com 3–15 executores;
4. times auditados que usam Jira/Zephyr/TestRail;
5. usuários bloqueados por transcrição lenta ou formato incompatível.

Perguntas de evidência, não de opinião:

- mostre a última planilha de casos;
- como distribuiu e cobrou execução?
- onde a evidência ficou anexada?
- quanto tempo levou por caso?
- qual erro fez refazer o trabalho?
- quem aprova uma compra de R$ 149 ou R$ 1.745?
- o que precisaria constar para a auditoria aceitar?
- em que condição aceitaria enviar apenas o áudio para transcrição?

Não perguntar “você usaria?”. Pedir o processo atual, frequência, custo e última
ocorrência.

---

## 10. Plano de execução recomendado

### Semana 1 — tornar a verdade única

- auditar os 22 itens pagos do catálogo contra produção;
- corrigir todos os “em breve” e CTAs;
- escolher o webhook oficial;
- inventariar e versionar o banco;
- definir evento de ativação do trial.

### Semanas 2–3 — vender o Personal certo

- reposicionar o card em torno do roteiro individual;
- criar demonstração curta planilha → caso → retorno;
- concluir testes de modelo, marca, glossário e roteiro;
- instrumentar funil sem conteúdo;
- convidar 10 usuários para trial assistido.

### Semanas 4–6 — provar Team

- testar isolamento multi-tenant;
- completar atribuição, painel de progresso e padrão versionado;
- validar domínio e recuperação de admin;
- fechar três pilotos com equipes reais;
- só então decidir mínimo de assentos.

### Depois — decidir Cloud/Pro

- medir abandono por lentidão e codec;
- cotar custo por minuto e região;
- obter cinco casos de API com volume real;
- criar política de retenção e DPA;
- lançar opt-in pago por consumo, não fallback invisível.

---

## 11. Critérios de go/no-go

### Personal pode abrir venda quando

- todos os itens anunciados como existentes passam em produção;
- banco nasce de migrações versionadas;
- compra e cancelamento foram testados ponta a ponta;
- 5 de 10 usuários assistidos importam um roteiro sem ajuda;
- pelo menos 3 concluem um caso e baixam o retorno;
- não existe dúvida entre trial, beta e lista de espera.

### Team pode abrir venda quando

- duas organizações não acessam dados uma da outra em testes negativos;
- admin convida, bloqueia, reatribui e recupera acesso;
- padrão tem versão/rollback ou sua limitação está explícita;
- painel mostra progresso acionável;
- três equipes piloto repetem uso em um segundo ciclo;
- suporte e nota fiscal têm processo definido.

### Cloud/API só pode abrir quando

- custo e margem por minuto estão medidos;
- upload é explícito e separado do fluxo local;
- retenção, região, exclusão e incidentes estão documentados;
- há limites, autenticação, rate limit e observabilidade;
- clientes reais aceitaram preço e contrato.

---

## 12. Conclusão dura

O Walkstamp não precisa inventar muitas features pagas novas. Precisa **terminar
e vender corretamente as que já formam um sistema**.

A melhor sequência é:

1. verdade única entre página, catálogo e produção;
2. Personal centrado em roteiro individual + padrões persistentes;
3. Team centrado em roteiro compartilhado + atribuição + padronização;
4. cobrança e banco reproduzíveis e auditáveis;
5. somente depois, nuvem, lote e API.

Se o produto liderar com “logotipo”, será percebido como gerador de documento
com personalização. Se liderar com “sua planilha volta executada, comprovada e
padronizada”, pode ocupar uma categoria muito mais valiosa: **a camada leve de
execução e evidência entre o caso de teste e a ferramenta corporativa onde ele
será arquivado**.

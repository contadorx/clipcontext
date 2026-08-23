# Reanálise da venda — versão 2

> **De onde veio.** Este documento foi escrito por você e colado aqui em
> 22/08/2026, e está **na íntegra e sem edição** a partir do título abaixo.
> Ele foi escrito olhando o site como ele estava **antes** das trilhas B e D
> desta semana, e por isso parte dos P0 que ele levanta já não existe. O que
> ficou de pé, o que já foi feito e o que virou tarefa está separado no
> `PLANO.md`, na **Trilha E** — e não aqui dentro, para este arquivo
> continuar sendo o que ele é: o texto original, para conferência.
>
> A leitura crítica dele está em `ANALISE-DA-VENDA.md` (a primeira versão) e
> em `A-PAREDE-DA-AVALIACAO.md` (a parede da avaliação de fornecedor).

---

# Reanálise do site e nova proposta de venda do Walkstamp

**Versão 2 — 22 de agosto de 2026**

## Escopo e método

Esta análise refaz a proposta comercial a partir do site inteiro, e não apenas
da tabela de preços. Foram confrontados:

- home e sua promessa principal;
- cinco páginas de caso de uso;
- página de preços nos cinco idiomas;
- catálogo de 93 funcionalidades;
- aplicação, área da conta, licenças, equipes, roteiro e Stripe;
- testes automatizados ligados às features pagas.

A URL pública foi solicitada novamente, mas respondeu HTTP 401/403 neste
ambiente. Por isso a leitura do site usa as fontes canônicas que geram as páginas
publicadas: `src/site/home.html`, `src/i18n-site.json` e
`src/site/bodies/*.pt.html`.

---

## 1. Veredito novo

O site apresenta um produto tecnicamente amplo, mas tenta vender **cinco produtos
com uma única oferta paga**:

1. evidência de teste;
2. instrução de trabalho;
3. ata de reunião;
4. relatório de teste de usabilidade;
5. contexto de vídeo para IA.

Esses casos compartilham o mesmo motor, mas não compartilham comprador, urgência,
orçamento, frequência nem critério de sucesso. A home pode continuar ampla para
aquisição. A venda paga não pode.

### A tese comercial recomendada

> **Walkstamp transforma uma execução de sistema em evidência pronta, liga essa
> evidência ao caso de teste e devolve o controle da rodada para quem coordena.**

O mercado inicial deve ser **QA/UAT, implantação de sistemas e consultorias que
precisam entregar evidência**. Instrução de trabalho é a expansão natural porque
é produzida pela mesma pessoa, no mesmo projeto e com as mesmas telas.

Ata, pesquisa UX e contexto para IA permanecem no Free como aquisição e prova de
amplitude, mas não devem definir o primeiro plano pago.

### Nota revisada

| Dimensão | Nota anterior | Nova nota | Motivo |
|---|---:|---:|---|
| Produto gratuito | 8/10 | **9/10** | resolve a tarefa inteira e sustenta a confiança |
| Potencial pago | 8/10 | **8/10** | roteiro e governança têm valor real |
| Clareza da categoria | 5/10 | **4/10** | cinco casos competem pela mesma frase |
| Clareza da página de preços | 5/10 | **3/10** | estado e disponibilidade se contradizem |
| Prontidão técnica | 6/10 | **6/10** | existe código relevante, faltam provas de produção |
| Prontidão para venda aberta | 4/10 | **3/10** | banco, cobrança e disponibilidade não são reproduzíveis |

**Conclusão dura:** a feature mais valiosa não é logotipo; é **a planilha de casos
voltar executada, comprovada e atribuída**.

---

## 2. O que o site vende hoje

### Home

A home promete converter gravações em documentos com os momentos em que a tela
mudou, hora, fala e privacidade local. Mostra muitos formatos e cinco cenários.
É uma boa explicação do motor, mas não escolhe um problema comercial dominante.

O visitante entende “o que faz”, porém não necessariamente:

- para quem é indispensável;
- qual trabalho substitui;
- quem compra;
- por que pagar se a ferramenta completa é grátis;
- por que assinar anualmente em vez de usar uma vez.

### Casos de uso

#### Evidência de teste

É a página comercial mais forte. Há dor concreta, repetição, auditoria, custo de
recusa e um artefato obrigatório. O comprador pode ser líder de QA, consultoria,
PMO, implantação, auditoria ou fábrica de software.

**Deve ser a porta principal da venda paga.**

#### Instrução de trabalho

É a segunda melhor oportunidade. A mesma pessoa que produz evidência durante o
UAT costuma entregar o procedimento no go-live. Modelos, marca do cliente,
vocabulário e atualização recorrente justificam Personal.

**Deve ser a expansão do mesmo mercado, não um posicionamento separado.**

#### Teste de usabilidade

A dor é real, mas o comprador e o workflow são outros. O site afirma que agência
de uma ou duas pessoas cabe no Personal e três ou mais no Team, enquanto a
página de preços diz que Team começa em cinco. Além disso, a página diz que o
clipe marcado ainda está em construção, mas o catálogo o declara existente.

**Manter como aquisição; não usar para definir planos até corrigir a verdade.**

#### Ata de reunião

Há mercado enorme, porém competição intensa e expectativa de resumo automático,
diariação de falantes, bot de reunião e integrações. O Walkstamp deliberadamente
não oferece esses itens. Seu diferencial — tela pareada com fala e privacidade —
é válido, mas de nicho.

**Usar como caso gratuito e conteúdo; não como wedge pago.**

#### Contexto para IA

É uma demonstração clara do motor e pode gerar tráfego, mas o uso é heterogêneo
e a disposição a pagar é incerta. A pessoa pode usar uma vez para um vídeo e não
ter motivo para persistência ou equipe.

**Usar para aquisição e descoberta de futura API, sem liderar a assinatura.**

---

## 3. Inconsistências que impedem vender com confiança

| Prioridade | Inconsistência | Evidência no site | Consequência | Dificuldade |
|---|---|---|---|---|
| P0 | O plano parece disponível e indisponível ao mesmo tempo | “Começar os 14 dias” e “aviso quando sair” | ninguém sabe se pode comprar | baixa |
| P0 | Cards dizem “em breve”, catálogo diz que existe | modelos, perfil, termos e padrão de equipe | promessa comercial não confiável | baixa/média |
| P0 | Site vende identidade; código pago entrega orquestração | headline versus roteiro/atribuição | valor e preço parecem menores | média |
| P0 | Dados pagos dependem de RPCs sem migrações no Git | conta, time, roteiro e faturas | deploy não reproduzível | alta |
| P0 | Dois webhooks aparentes | Next e Edge Function | risco de concessão divergente | média |
| P1 | Team começa em cinco na tabela e em três na página UX | duas regras públicas | objeção comercial imediata | baixa |
| P1 | Revisão assistida é existente e inexistente | catálogo versus instrução de trabalho | quebra de confiança | baixa/média |
| P1 | Clipe de 15 s é existente e “em construção” | catálogo versus página UX | quebra de confiança | baixa/média |
| P1 | “Sem login” conflita com conta, magic link e administração | copy do Team versus fluxo real | expectativa errada de TI | baixa |
| P1 | Free e pago são comparados por 93 linhas | tabela extensa | diferença decisiva fica invisível | baixa |
| P2 | Faturas e chamados aparecem como benefício | card Team | ocupa espaço sem gerar desejo | baixa |
| P2 | Pro/API aparece antes de a oferta atual estar estável | rodapé da página | dispersa demanda e roadmap | baixa |

### Regra necessária

Nenhuma feature pode ser chamada de pronta porque há código. “Pronta” deve
significar:

1. disponível na produção;
2. acessível no plano correto;
3. testada de ponta a ponta;
4. documentada;
5. suportável;
6. medida.

Criar estados únicos no catálogo: `produção`, `beta`, `em construção` e
`descoberta`. Cards, tabela, páginas de caso e feature flags devem nascer dessa
mesma fonte.

---

## 4. Segmento inicial e perfil de cliente ideal

### ICP primário

**Consultoria ou equipe de QA/UAT com 3 a 30 executores**, que:

- recebe casos em Excel, Jira, Zephyr ou TestRail;
- executa testes em sistemas corporativos;
- precisa anexar evidência por caso;
- monta Word/PDF manualmente;
- trabalha com dados que não devem ser enviados a uma nova nuvem;
- repete rodadas, regressões ou projetos;
- precisa mostrar padrão ao cliente ou auditor.

### Usuário

Testador, analista funcional, consultor de implantação ou key user.

### Comprador

Coordenador de QA, gerente de projeto, sócio de consultoria, líder de implantação
ou responsável por qualidade.

### Momento de compra

- início de UAT;
- lote grande de evidências recusado;
- auditoria próxima;
- novo cliente exigindo padrão;
- equipe crescendo além do controle por planilha e chat;
- go-live com evidência e instruções contratuais.

### Concorrente real

O concorrente principal não é outra IA. É:

> Print Screen → Word → renomear arquivo → voltar à planilha → marcar status →
> anexar no sistema → cobrar a pessoa seguinte.

A venda deve quantificar esse processo, não comparar quantidade de formatos.

---

## 5. Nova arquitetura de oferta

### Free — Criar

**Promessa:** “Transforme uma gravação em evidência completa, sem enviar o vídeo.”

Inclui todo o necessário para a qualidade:

- gravação ou vídeo;
- detecção de mudança;
- transcrição local;
- revisão, tarja, recorte e destaque;
- hash e horário;
- PDF, DOCX, PPTX, HTML, Markdown, SCORM, CSV, JSON e ZIP;
- reabertura local;
- link pré-configurado para ferramentas de teste.

**Por que manter amplo:** elimina risco, prova qualidade, preserva confiança e
faz a aquisição sem custo variável.

### Personal — Repetir

**Nova promessa:** “Execute sua planilha sem montar cada evidência do zero.”

Inclui:

- tudo do Free;
- importar roteiro individual;
- abrir cada caso já preenchido;
- marcar execução e devolver status/data/executor/hash;
- guardar modelo de documento;
- guardar cliente, logotipo e campos;
- guardar vocabulário;
- recibos e anexos opcionais;
- histórico pessoal mínimo.

**Mensagem secundária:** útil também para consultor que entrega instruções com o
padrão do cliente.

### Team — Coordenar

**Nova promessa:** “Distribua a rodada, acompanhe o que falta e padronize a
entrega de todos.”

Inclui:

- tudo do Personal;
- roteiro compartilhado;
- atribuição e reatribuição;
- status por pessoa e por ciclo;
- padrão de documento versionado;
- gestão de assentos;
- convite e domínio verificado;
- trilha mínima de atividade;
- exportação consolidada;
- onboarding assistido no plano mínimo.

### Cloud/Automation — Acelerar

Não lançar junto. Validar separadamente:

- transcrição rápida na nuvem;
- conversão de codecs;
- lote;
- API de evidência estruturada.

Cobrar por consumo. Upload deve ser opt-in explícito, nunca fallback automático.
Essa oferta muda custo, risco e contrato de privacidade.

---

## 6. Preço recomendado

### Free

Manter R$ 0, sem limite artificial. O custo local permite isso e sustenta o
principal diferencial.

### Personal

**Lançamento:** R$ 149/ano como preço fundador.

Testar depois:

- R$ 19/mês;
- R$ 199–249/ano;
- preço fundador preservado para primeiros clientes.

Não aumentar apenas pela lista de features. Aumentar quando houver evidência de
roteiros recorrentes, tempo poupado e renovação.

### Team

R$ 349/pessoa/ano é plausível, mas o mínimo de cinco cria entrada de R$ 1.745.
Há duas opções coerentes:

1. mínimo de três, reduzindo fricção para equipes pequenas; ou
2. mínimo de cinco com onboarding, configuração de padrão e importação inicial.

**Recomendação:** testar três assentos nos primeiros pilotos. Não publicar “a
partir de cinco” enquanto outra página disser “de três em diante”.

### Cloud

- créditos/minutos pré-pagos;
- sem “ilimitado”;
- preço calculado após medir infraestrutura, suporte, retenção e margem;
- Team pode receber franquia pequena, nunca custo aberto.

---

## 7. Página de preços refeita — estrutura e texto

### 7.1 Hero

**Título**

> A evidência é grátis. Você paga para repetir, coordenar e padronizar.

**Subtítulo**

> Grave ou abra um vídeo, gere a evidência completa no seu computador e use sem
> limite. Quando houver uma planilha inteira ou uma equipe executando, o
> Walkstamp organiza a rodada e devolve tudo preenchido.

**Prova curta**

> O vídeo, o áudio e a transcrição continuam no seu navegador em todos os
> planos. Só um anexo escolhido por você pode ser guardado na conta.

### 7.2 Cards

#### Free — Crie a evidência

**R$ 0 para sempre**

- grave ou use vídeos de qualquer tamanho;
- transcreva localmente;
- revise e proteja dados sensíveis;
- gere todos os formatos essenciais;
- reabra e corrija depois.

CTA: **Criar uma evidência grátis**

Nota: sem cadastro, cartão ou limite de uso.

#### Personal — Execute seu roteiro

**R$ 149 por ano**

- importe Excel/CSV;
- abra cada caso preenchido;
- devolva status, data, executor e hash;
- salve seu padrão, cliente e vocabulário;
- aplique marca em documentos.

CTA se pronto: **Testar Personal por 14 dias**
CTA se beta: **Pedir acesso ao Personal**

Nunca mostrar CTA de trial e lista de espera simultaneamente.

#### Team — Coordene a rodada

**R$ 349 por pessoa/ano**

- distribua e reatribua casos;
- acompanhe concluídos e pendentes;
- compartilhe o roteiro;
- imponha o mesmo padrão de documento;
- administre acesso e assentos.

CTA: **Agendar um piloto do Team**

Nota: informar um único mínimo de assentos.

### 7.3 Demonstração central

Mostrar quatro passos visuais:

1. planilha com 40 casos entra;
2. cada pessoa recebe casos preenchidos;
3. execução gera evidência local;
4. painel e planilha voltam com status e comprovantes.

Essa demonstração vende mais que a tabela de 93 itens.

### 7.4 Comparação curta

| Resultado | Free | Personal | Team |
|---|---:|---:|---:|
| Criar evidência aceita | sim | sim | sim |
| Guardar padrão e vocabulário | — | sim | sim |
| Executar uma planilha | — | individual | compartilhada |
| Atribuir e acompanhar | — | — | sim |
| Padronizar toda a equipe | — | — | sim |

Depois: botão **Ver as 93 funcionalidades**.

### 7.5 ROI

Usar calculadora com campos editáveis:

- casos por rodada;
- minutos manuais por caso;
- rodadas por mês;
- custo/hora.

Exemplo, sempre identificado como exemplo:

- 40 casos;
- 3 minutos poupados por caso;
- 2 horas poupadas por rodada;
- uma única rodada pode pagar o Personal.

Não afirmar economia sem medir usuários reais.

### 7.6 Prova e confiança

Adicionar antes do FAQ:

- exemplo real de planilha antes/depois;
- exemplo real de PDF/Word;
- vídeo de 60–90 segundos do roteiro;
- explicação objetiva do armazenamento;
- compatibilidade com Jira/Zephyr/TestRail sem sugerir integração automática;
- depoimento apenas quando houver cliente autorizado;
- status claro: disponível, beta ou futuro.

---

## 8. Jornada de venda recomendada

### Aquisição

Páginas de caso continuam trazendo tráfego. Cada página deve terminar com CTA
condizente:

- evidência e instrução: trial Personal;
- usabilidade: Free, com Personal para persistência;
- ata e IA: Free;
- equipe/roteiro: piloto Team.

Hoje quase todas enviam genericamente para “Ver planos”, mesmo quando tudo que a
página descreveu é grátis. O CTA deve ligar o caso à feature paga específica.

### Ativação Free

Evento: primeiro documento baixado.

Após download, oferecer uma única continuidade contextual:

> Tem vários casos? Importe sua planilha e teste o Personal.

Não interromper o primeiro uso com venda.

### Ativação Personal

O trial só prova valor se a pessoa:

1. importar pelo menos cinco casos;
2. executar um caso pelo link;
3. baixar a planilha atualizada;
4. salvar um padrão ou vocabulário.

Começar os 14 dias na primeira ação paga relevante, não no primeiro magic link,
é uma hipótese melhor a testar.

### Ativação Team

Piloto assistido:

1. importar roteiro real;
2. configurar padrão;
3. convidar três executores;
4. atribuir casos;
5. concluir uma rodada;
6. exportar resultado.

O objetivo não é “criou assentos”; é “segunda pessoa concluiu um caso”.

### Conversão e retenção

- aviso no dia 7 baseado no que falta ativar;
- aviso no dia 12 com resultado já produzido;
- conversão após valor, sem cartão obrigatório no início;
- retenção medida por segundo roteiro/ciclo, não por login;
- cancelamento com exportação dos dados e perda explicada.

---

## 9. Features pagas: decisão final

| Feature | Plano | Valor | Prontidão comercial | Decisão |
|---|---|---:|---:|---|
| Marca do cliente | Personal | médio | alta | manter como prova visual |
| Modelo persistente | Personal | alto | incerta | validar produção e lançar |
| Vocabulário persistente | Personal | alto | incerta | validar produção e lançar |
| Roteiro individual | Personal | muito alto | média | benefício principal |
| Retorno da planilha | Personal | muito alto | média | benefício principal |
| Recibo/anexo opcional | Personal | alto | média | manter com política clara |
| Roteiro compartilhado | Team | muito alto | média | benefício principal |
| Atribuição | Team | muito alto | média | benefício principal |
| Padrão de equipe | Team | alto | incerta | exigir versão/rollback |
| Assentos/convite | Team | necessário | média | higiene, não headline |
| Entrada por domínio | Team | médio | incerta | só com domínio verificado |
| Faturas/chamados | todos pagos | necessário | média | tirar dos bullets de valor |
| Transcrição na nuvem | Cloud | alto | inexistente | discovery e opt-in |
| Conversão de codec | Cloud | médio/alto | inexistente | medir abandono antes |
| Lote | Cloud/API | alto | inexistente | validar volume real |
| API genérica | API | incerto | inexistente | não construir |
| API de evidência | API | alto potencial | inexistente | validar cinco clientes |

---

## 10. Bloqueadores técnicos e operacionais

### P0 antes de cobrar abertamente

1. versionar schema, migrações, RLS, grants, storage e retenção;
2. escolher um único webhook Stripe;
3. garantir idempotência por evento e reconciliação;
4. testar compra, renovação, falha, cancelamento, chargeback e expiração;
5. provar isolamento entre organizações;
6. provar revogação e expiração da licença offline;
7. alinhar feature flags, catálogo e copy;
8. definir nota fiscal e suporte;
9. criar homologação separada;
10. remover caminhos absolutos dos testes.

### Segurança e privacidade

- domínio de e-mail precisa ser comprovado antes de liberar entrada automática;
- anexos devem ser opt-in, apagáveis e cobertos por teste de exclusão no storage;
- métricas não podem guardar nome de arquivo, frame, fala, transcrição ou caso;
- transcrição em nuvem exige consentimento, região, retenção, DPA e preço claros;
- nenhuma nuvem pode virar fallback silencioso do processamento local.

---

## 11. Métricas que decidem se a proposta funciona

### Aquisição

- visita por página de caso;
- página de caso → ferramenta;
- página de caso → preços;
- preços → trial/piloto.

### Ativação

- Free: primeiro documento baixado;
- Personal: primeiro caso concluído dentro de roteiro;
- Team: segunda pessoa concluindo um caso atribuído.

### Valor

- casos concluídos por roteiro;
- minutos poupados por caso, por amostra consentida;
- roteiros concluídos por mês;
- percentual que exporta planilha preenchida;
- documentos usando padrão salvo;
- assentos ativos sobre pagos.

### Receita

- trial → pago;
- tempo até valor;
- Personal → Team;
- renovação anual;
- churn por motivo;
- receita e suporte por organização.

### Guardrails

- falha entre pagamento e licença;
- acesso cruzado bloqueado;
- exclusão de anexo bem-sucedida;
- chamados por 100 contas;
- custo de nuvem sobre receita, quando existir.

---

## 12. Plano de execução

### Semana 1 — corrigir a verdade

- definir estado de cada feature;
- corrigir contradições entre cards, catálogo e casos;
- escolher mínimo de assentos;
- remover lista de espera se o trial estiver aberto, ou fechar trial se for beta;
- decidir webhook oficial;
- inventariar RPCs e migrações ausentes.

### Semana 2 — refazer a página

- aplicar hero e cards propostos;
- inserir demonstração do roteiro;
- criar comparação curta;
- recolher tabela completa;
- alinhar CTA de cada página de caso;
- retirar faturas/chamados da proposta de valor.

### Semanas 3–4 — provar Personal

- dez trials assistidos do ICP;
- medir importação, primeiro caso e retorno da planilha;
- corrigir onboarding;
- coletar tempo manual anterior;
- validar disposição a pagar e mensal/anual.

### Semanas 5–8 — provar Team

- três pilotos reais;
- isolamento multiempresa;
- padrão versionado;
- painel de progresso;
- recuperação de administrador;
- teste de três versus cinco assentos.

### Depois — decidir Cloud/API

- medir abandono por velocidade e codec;
- entrevistar cinco compradores com volume;
- calcular custo/margem;
- desenhar privacidade e contrato;
- somente então construir.

---

## 13. Critérios de go/no-go

### Personal pode ser vendido quando

- página e produto concordam sobre o que existe;
- trial tem um único CTA e estado;
- compra/cancelamento funcionam ponta a ponta;
- banco pode ser recriado por migrações;
- 5 de 10 usuários importam roteiro sem intervenção;
- 3 de 10 concluem caso e exportam retorno;
- ao menos 3 declaram valor maior que o preço anual.

### Team pode ser vendido quando

- duas organizações não acessam dados uma da outra;
- segundo executor conclui caso no piloto;
- admin consegue convidar, bloquear, reatribuir e recuperar acesso;
- padrão tem versão ou limitação explícita;
- três equipes repetem uma segunda rodada;
- mínimo de assentos tem evidência, não palpite.

### Cloud/API pode ser construída quando

- cinco clientes informam volume real;
- preço cobre infraestrutura e suporte com margem;
- upload é escolha explícita;
- retenção, exclusão, região e incidente estão definidos;
- API é de evidência estruturada, não commodity genérica.

---

## 14. Proposta final em uma página

### Categoria

**Execução e evidência de testes sem upload de vídeo.**

### Promessa

> Grave a execução uma vez. O Walkstamp separa os passos, pareia tela e fala e
> gera a evidência. No plano pago, sua planilha distribui os casos e volta com
> status, executor e comprovantes.

### Para quem

QA/UAT, implantação e consultorias com obrigação de evidência.

### Diferencial

Qualidade e privacidade não são paywall. O pago elimina repetição individual e
coordena a equipe.

### Oferta

- Free cria;
- Personal repete;
- Team coordena;
- Cloud acelera, futuramente e por consumo.

### CTA principal

**Teste uma planilha real por 14 dias.**

### Resultado vendido

Não “93 features”. Não “logotipo”. Não “mais formatos”.

> **Uma rodada de testes distribuída, executada, comprovada e devolvida sem
> montar quarenta evidências à mão.**
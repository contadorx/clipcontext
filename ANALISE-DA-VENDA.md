# Análise da página, da copy e da venda do Walkstamp

**Data:** 22 de agosto de 2026
**Página solicitada:** `https://walkstamp.com/`
**Escopo efetivamente auditado:** fontes que geram a home e a página de preços
em português (`src/site/home.html`, `src/i18n-site.json` e
`src/site/bodies/precos.pt.html`), mais o catálogo e os fluxos de conta do
repositório.

> **Como este documento entrou no projeto.** Ele chegou pronto, do Leandro, em
> 22/08/2026, e está aqui **na íntegra e sem edição** — é a fonte da Trilha D do
> `PLANO.md`. O que a Trilha D acrescenta é o cruzamento com o que já foi feito
> nas trilhas A e B, a ordem de execução e o custo em dias. Onde os dois
> discordarem sobre o estado atual do produto, vale o `PLANO.md`: parte desta
> análise descreve a página **antes** dos builds B1, B4 e B5.

> **Limitação da conferência ao vivo.** O acesso web do ambiente respondeu 401 e
> o acesso direto por `curl` foi bloqueado pelo proxy com 403. A análise abaixo
> trata a versão atual do repositório como fonte da página publicada. Antes de
> executar as mudanças, deve-se comparar o HTML implantado com o build atual.

## Veredito executivo

A página é **forte como explicação de produto gratuito e demonstração de
engenharia**, mas ainda é **fraca como página de venda**.

Ela prova bem quatro coisas:

1. uma gravação vira documento;
2. telas repetidas são eliminadas;
3. o resultado leva imagem, fala e horário;
4. o processamento do conteúdo acontece localmente.

Mas deixa sem resposta, ou responde tarde, as perguntas que fazem alguém pagar:

- **Para quem exatamente é o produto principal?** QA, consultoria, treinamento,
  reuniões, UX e uso com IA disputam a mesma abertura.
- **Que trabalho profissional ele substitui?** A home fala em documento, mas não
  assume cedo a execução e comprovação de casos de teste.
- **Qual resultado econômico produz?** Não há tempo economizado, taxa de aceitação,
  volume de casos ou exemplo antes/depois validado.
- **Por que pagar se o gratuito entrega toda a qualidade?** A página de preços
  responde que o pago é identidade e administração; isso reduz o valor do roteiro.
- **Por que confiar?** Há explicação técnica, mas não há prova social, cliente,
  caso real, número de uso ou depoimento verificável.
- **Qual é o próximo passo comercial?** A home empurra para o Free; Personal aparece
  apenas na página de preços e Team termina em conversa, sem demonstração do
  fluxo compartilhado.

### Notas atuais

| dimensão | nota | diagnóstico |
|---|---:|---|
| Clareza do mecanismo | **8/10** | Entende-se que vídeo vira telas selecionadas e documento. |
| Clareza do público | **4/10** | Cinco casos e duas grandes narrativas competem pela prioridade. |
| Força da dor | **7/10** | O trabalho manual é reconhecível, mas a dor não é quantificada. |
| Diferenciação | **8/10** | Processamento local, seleção por mudança e carimbo são distintos. |
| Desejo pelo resultado | **6/10** | A figura e o tour ajudam; falta um caso completo com antes/depois. |
| Confiança comercial | **3/10** | Transparência técnica sem prova social nem evidência de adoção. |
| Clareza Free → Personal → Team | **4/10** | A linha de corte existe, mas comunica pouco valor econômico pago. |
| Força do CTA pago | **3/10** | A home vende abertura gratuita, não trial nem roteiro. |
| Redução de risco | **7/10 Free / 4/10 pago** | Free é sem cadastro; pago tem trial, mas o estado da oferta parece futuro. |
| Potencial após reposicionamento | **8/10** | O roteiro de casos fornece uma categoria comercial mais valiosa. |

## O que deve ser preservado

Não convém reescrever tudo como uma landing page genérica. Estes ativos são
bons e devem sobreviver:

### 1. O resultado visual na primeira dobra

A home coloca a página gerada ao lado da proposta e o tour logo abaixo. Isso é
melhor do que uma ilustração abstrata: mostra o artefato comprado. Mantenha a
imagem, mas acrescente uma legenda orientada a resultado: “Caso CT-042 executado,
12 passos comprovados e planilha devolvida com status”.

### 2. A demonstração do mecanismo

“Só o que mudou sobrevive” é uma boa explicação do diferencial. A comparação
entre 3.600 quadros e cerca de 60 telas é concreta e memorizável, desde que seja
apresentada como exemplo medido, não promessa universal.

### 3. Privacidade como prova, não como adjetivo

Explicar que o processamento funciona offline e sugerir uma verificação pela aba
de rede é mais crível do que apenas dizer “somos seguros”. Preserve isso numa
seção de confiança, depois da proposta principal.

### 4. Produto utilizável sem cadastro

O CTA de experimentar imediatamente é um ativo enorme. O erro não é oferecer o
Free; é fazer dele o único caminho visível e não criar uma ponte contextual para
o roteiro pago depois que a pessoa comprova o mecanismo.

### 5. Casos de uso e páginas específicas

As cinco páginas são boas para SEO e campanhas segmentadas. Na home, contudo,
devem ser tratadas como extensões do produto, não como cinco prioridades iguais.

## Problema central de posicionamento

Hoje a home tenta vender simultaneamente:

- evidência de teste;
- contexto para IA;
- instrução de trabalho;
- ata de reunião;
- pesquisa de usabilidade;
- privacidade local;
- muitos formatos de exportação.

Todos são usos verdadeiros. Juntos, eles fazem o visitante concluir que se trata
de um conversor de gravação versátil, e não de um sistema para executar e provar
trabalho repetitivo de teste.

### Posicionamento recomendado

**Categoria principal:** execução e comprovação de casos de teste.
**Mecanismo:** transforma a gravação em evidência organizada, sem upload.
**Resultado:** importa o roteiro, abre cada caso preenchido, gera a prova e devolve
a planilha com status, executor, data e anexos.
**Público inicial:** profissionais de QA, consultores de implantação, key users e
equipes que executam UAT/homologação.
**Usos secundários:** instrução, ata, UX e contexto para IA.

### Frase de posicionamento

> **Walkstamp transforma a execução de casos de teste em evidência pronta para
> entregar — da planilha ao documento, sem enviar o vídeo para um servidor.**

Essa frase explica comprador, trabalho, resultado e diferenciação. “Gravação
→ documento” passa a ser o mecanismo que comprova a promessa, não a categoria.

## Análise da primeira dobra

### O que existe

- eyebrow: “Gravação → documento”;
- título: “Você percorre a tela. Ele carimba cada passo.”;
- parágrafo com mudança de tela, hora, fala, evidência, IA e privacidade;
- CTA único: “Abrir a ferramenta — é grátis”;
- observação técnica sobre cadastro, instalação, tamanho e servidor.

### O que funciona

- O título tem personalidade.
- O CTA tem baixo atrito.
- A imagem do resultado responde rapidamente “o que sai?”.
- Privacidade aparece cedo e é relevante para dados de teste.

### O que atrapalha a venda

1. **O título é elegante, mas não pesquisável nem autoexplicativo.** “Percorre” e
   “carimba” exigem interpretação. Uma pessoa de QA não vê “casos de teste”,
   “evidência” ou “planilha” no H1.
2. **O lead abre dois produtos.** “Provar que o teste foi feito” e “entregar a uma
   IA” recebem o mesmo peso, embora tenham compradores, urgências e disposições a
   pagar diferentes.
3. **O CTA otimiza ativação gratuita, não receita.** Não há caminho “ver roteiro
   de casos”, “testar Personal” ou “ver exemplo completo”.
4. **A microcopy fala da arquitetura antes do valor.** “Sem cadastro” ajuda;
   “sem limite de tamanho” e “servidor nenhum” podem ir para uma linha menor ou
   selo. A primeira dobra precisa primeiro vender a transformação do trabalho.

### Copy recomendada para a primeira dobra

**Eyebrow**
`Evidência de teste sem Print Screen e Word`

**H1**
`Execute os casos. O Walkstamp organiza a prova.`

**Lead**
`Importe sua planilha, abra cada caso já preenchido e grave a execução. O
Walkstamp transforma as mudanças da tela em passos com horário e anotação, gera
o documento e devolve o roteiro com status, data e responsável.`

**Linha de diferenciação**
`O vídeo, o áudio e a transcrição são processados no seu navegador — sem upload.`

**CTA primário**
`Testar com um vídeo — grátis`

**CTA secundário**
`Ver como funciona o roteiro de casos`

**Microcopy**
`Sem cadastro para testar · Personal por 14 dias sem cartão`

Se o roteiro pago ainda não estiver validado em produção, troque o CTA secundário
por `Ver um caso completo`, nunca por uma promessa indisponível.

## Arquitetura da home recomendada

A home atual é longa, explicativa e repete mecanismo em várias seções. A ordem
deve seguir a decisão de compra:

### 1. Hero: resultado profissional

- H1 centrado em executar e comprovar casos;
- imagem do documento **e** pequeno recorte da planilha devolvida;
- CTA de teste gratuito + CTA para conhecer o roteiro;
- três selos: sem upload, sem instalação, PDF/DOCX/planilha.

### 2. Antes e depois

Use duas colunas:

| antes | com Walkstamp |
|---|---|
| abrir caso e copiar campos | link abre o caso preenchido |
| Print Screen e Word a cada passo | mudanças viram passos automaticamente |
| renomear e anexar arquivos | recibo e impressão ficam ligados ao caso |
| atualizar status na planilha | roteiro volta com data, executor e resultado |

Essa seção vende o fluxo, não features isoladas.

### 3. Demonstração do fluxo completo

O tour atual demonstra gravação → documento. Crie uma segunda demonstração
curta para planilha → casos → evidência → planilha preenchida. Essa é a demo do
produto pago e deve aparecer antes da lista de formatos.

### 4. Prova social ou prova operacional

Não inventar logotipos, depoimentos ou números. Enquanto não houver clientes:

- publique um caso demonstrativo reproduzível;
- ofereça a planilha de entrada, o vídeo e o pacote de saída para download;
- mostre quantidade de casos, telas e tempo de processamento;
- identifique claramente como “demonstração Walkstamp”.

Quando houver três pilotos, substitua ou complemente por depoimentos com nome,
cargo, empresa, contexto, resultado e permissão de uso.

### 5. Como funciona em três passos

Troque o processo genérico por:

1. `Importe o roteiro ou abra um caso avulso.`
2. `Execute enquanto o Walkstamp guarda apenas as mudanças.`
3. `Baixe a evidência e devolva o roteiro atualizado.`

A transcrição é um recurso dentro do passo 2, não um dos três pilares da venda.

### 6. Por que é diferente

Organize os diferenciais por consequência:

- **Menos trabalho:** elimina telas repetidas e reaproveita a fala.
- **Prova localizável:** passo, horário, caso e impressão digital.
- **Privacidade:** conteúdo processado localmente.
- **Entrega compatível:** PDF, Word, planilha, Jira/Zephyr/TestRail.

Treze chips de formatos cedo demais criam impressão de conversor. Mostre quatro
formatos prioritários e coloque os demais em “ver todas as saídas”.

### 7. Planos orientados ao trabalho

Inclua um resumo enxuto dos planos na home, antes do FAQ:

- **Free — caso avulso:** transforme gravações em evidência, sem cadastro.
- **Personal — roteiro individual:** importe, execute e devolva muitos casos;
  guarde perfil, termos, modelos e marca.
- **Team — execução coordenada:** compartilhe o roteiro, atribua casos e mantenha
  o padrão da equipe.

### 8. Objeções e FAQ

Mantenha privacidade, formatos e tamanho, mas acrescente perguntas comerciais:

- O que fica guardado na conta?
- Consigo importar minha planilha atual?
- Como Jira, Zephyr e TestRail entram no fluxo?
- O que acontece quando cancelo?
- Preciso enviar meu vídeo para usar Personal ou Team?
- Como funciona a cobrança por pessoa?

### 9. CTA final coerente

Use o mesmo par de CTAs do hero. O atual “Grave dois minutos” é bom para Free;
adicione a ponte: `Tem uma planilha de casos? Teste o roteiro por 14 dias.`

## Análise da copy

### 1. Excesso de explicação antes de hierarquia

A copy é boa frase a frase, mas quase tudo recebe tratamento de argumento
principal. Privacidade, IA, evidência, formatos e cenários competem em vez de se
encadearem. Defina uma pirâmide:

1. **promessa:** casos executados e comprovados;
2. **mecanismo:** gravação vira passos sem repetição;
3. **diferenciais:** local, horário, fala e integridade;
4. **compatibilidade:** formatos e integrações;
5. **extensões:** IA, reunião, instrução e UX.

### 2. Absolutos que podem reduzir confiança

Frases como “não existe servidor”, “não há conta”, “não há banco de dados” e
“não há rastreamento” precisam distinguir:

- processamento do vídeo;
- site institucional;
- planos pagos e conta;
- telemetria anônima;
- anexo opcional de sessão.

A página de preços reconhece conta e anexo opcional. Portanto, use:

> `Seu vídeo, áudio e transcrição são processados localmente. Nos planos pagos,
> a conta guarda apenas dados operacionais e aquilo que você escolher anexar.`

### 3. Afirmações sobre concorrentes e modelos

A copy afirma que Claude e ChatGPT recusam vídeo e descreve como Gemini amostra
o arquivo. Capacidades de modelos mudam rapidamente. Sem data, link e teste
reproduzível, a afirmação envelhece e pode desacreditar o restante.

Troque por uma formulação durável:

> `Vídeo bruto é pesado, difícil de citar e nem sempre é aceito pelo sistema de
> destino. O documento reduz repetição e preserva a relação entre tela, fala e
> instante.`

Se mantiver a comparação nominal, crie uma página datada com protocolo, arquivo,
configuração, resultado e data da última revalidação.

### 4. Voz do produto versus voz do comprador

“Carimba”, “só o que mudou sobrevive” e “duas coisas que ninguém gosta de fazer”
têm personalidade. Preserve-as como subtítulos. No H1 e nos CTAs, prefira os
termos que o comprador usa: caso de teste, evidência, roteiro, planilha, UAT,
homologação, executor e resultado.

### 5. Copy orientada a feature, não a consequência

Exemplo atual: `Logotipo e nome do cliente no PDF, no Word e no HTML.`
Melhor: `Entregue a evidência pronta para o cliente, com a identificação dele.`

Exemplo atual: `Perfil que volta ao entrar, em qualquer máquina.`
Melhor: `Comece o próximo caso sem redigitar sistema, executor e vocabulário.`

Exemplo atual: `Padrão do time empurrado para todo mundo.`
Melhor: `Toda a equipe entrega o mesmo formato, mesmo quando o executor muda.`

## Análise da página de preços

### Contradição principal

A abertura afirma que o pago é identidade e administração. Isso torna o
Personal de R$ 149/ano comparável a “PDF com logotipo” e esconde o roteiro, que é
o benefício com maior valor econômico.

### Problemas adicionais

1. **Personal começa pela marca.** O roteiro aparece em segundo lugar.
2. **O cartão promete trial e, abaixo, a página pede para ser avisado quando o
   pago sair.** Isso comunica produto simultaneamente disponível e indisponível.
3. **Itens importantes estão “em breve” no cartão e existentes na tabela.** A
   contradição impede decisão segura.
4. **Team custa no mínimo R$ 1.745/ano**, mas a copy principal promete documento
   igual e painel de assentos. Coordenação, roteiro compartilhado e atribuição
   deveriam justificar o valor.
5. **BRL, USD e EUR juntos** criam ruído para quem está comprando no Brasil.
   Detecte localidade ou use seletor de moeda.
6. **A lista de 93 funcionalidades é prova de amplitude, não ferramenta de
   decisão.** Primeiro compare os três trabalhos; deixe a matriz detalhada depois.
7. **A honestidade domina a persuasão.** Transparência é boa, mas frases longas
   sobre custo zero e futuro desviam a pessoa da escolha.

### Abertura recomendada para preços

**H1**
`Um caso avulso é grátis. O trabalho repetido e coordenado vira plano.`

**Lead**
`Use o Free para transformar qualquer gravação em evidência. Escolha Personal
quando tiver um roteiro para executar e reutilizar. Escolha Team quando várias
pessoas precisarem dividir casos e entregar no mesmo padrão.`

### Cartão Personal recomendado

**Personal — roteiro individual**
`R$ 149 por ano`
`Para quem executa muitos casos e precisa devolver tudo organizado.`

- Importe XLSX, CSV ou cole do Excel.
- Abra cada caso com os campos preenchidos.
- Ligue evidência, recibo e anexo ao caso.
- Exporte o roteiro com status, data e executor.
- Reutilize perfil, termos, modelo e marca do cliente.

**CTA:** `Testar o roteiro por 14 dias`
**Microcopy:** `Sem cartão · cancele quando quiser`

### Cartão Team recomendado

**Team — execução coordenada**
`R$ 349 por pessoa/ano · mínimo de 5 pessoas`
`Para dividir a rodada, acompanhar a execução e padronizar a entrega.`

- Compartilhe um roteiro com a equipe.
- Atribua casos e veja quem concluiu cada um.
- Convide, bloqueie e reutilize assentos.
- Distribua o padrão de documento do time.
- Centralize faturas, chamados e administração.

**CTA antes de pilotos validados:** `Agendar uma rodada acompanhada`
**CTA depois da prontidão operacional:** `Começar piloto do Team`

### Regra para “em breve”

Não misture funcionalidade futura no conjunto principal do plano. Crie uma caixa
separada: `No roadmap, não incluído na decisão de compra`. Se algo aparece no
cartão como benefício do preço, precisa estar utilizável no ambiente vendido.

## Confiança e prova

A página tenta construir confiança quase exclusivamente com transparência
técnica. Para uma compra B2B, são necessárias quatro provas:

### 1. Prova do produto

- vídeo de 60–90 segundos do fluxo pago completo;
- planilha de entrada e saída para baixar;
- PDF/Word final real;
- exemplo de recibo e atribuição.

### 2. Prova do resultado

Medir nos pilotos:

- minutos por caso antes/depois;
- casos executados por rodada;
- quantidade de intervenções manuais evitadas;
- evidências recusadas ou devolvidas;
- tempo para consolidar a planilha;
- frequência de reutilização semanal.

Só publicar números com amostra, contexto e método.

### 3. Prova social

O formato ideal de depoimento é:

> `Antes, [trabalho concreto]. Em uma rodada de [n] casos, usamos o Walkstamp para
> [fluxo]. O resultado foi [medida ou consequência].`
> **Nome, cargo, empresa e autorização.**

### 4. Prova de risco controlado

- teste sem cartão;
- explicação objetiva do que fica na conta;
- exportação e exclusão;
- cancelamento e efeito sobre dados;
- contato de suporte;
- nota fiscal;
- segurança e privacidade em linguagem de comprador e de TI.

## Funil de venda recomendado

### Aquisição

Direcione campanhas e SEO a dores específicas, não à home genérica:

- evidência de teste de software;
- evidência UAT/homologação;
- documentar casos de teste de planilha;
- alternativa ao Steps Recorder;
- transformar gravação em procedimento.

Cada página precisa terminar no exemplo e CTA correspondentes.

### Ativação Free

Defina o evento de valor como `primeiro documento gerado`, não abertura da
ferramenta. Depois do download, pergunte sem bloquear:

> `Você tem uma planilha com outros casos? Importe e execute a rodada sem
> redigitar os campos.`

Essa é a ponte natural para Personal.

### Conversão Personal

O trial deve começar quando a pessoa importa o primeiro roteiro ou tenta salvar
perfil/modelo — momentos em que o valor pago é evidente. O onboarding deve usar
uma planilha exemplo para evitar uma tela vazia.

### Conversão Team

Ofereça Team depois de um sinal de coordenação:

- tentativa de atribuir um caso;
- compartilhamento do roteiro;
- segundo executor;
- pedido para padronizar documento;
- volume acima de um limite observado, não arbitrário.

No estágio atual, venda assistida é melhor que checkout autônomo: acompanhe uma
rodada real, descubra objeções e transforme-as em produto e copy.

### Retenção

O valor recorrente deve ser lembrado por:

- roteiros recentes e próxima rodada;
- perfil, vocabulário e modelos reaplicados;
- progresso do time;
- histórico operacional sem armazenar conteúdo desnecessário.

Não use e-mail genérico de marketing. Use avisos transacionais relacionados a
um roteiro, convite, atribuição, assinatura ou expurgo.

## Instrumentação necessária

Sem medir o funil, uma nova copy pode parecer melhor e vender menos. Registre
eventos sem conteúdo do cliente:

| etapa | evento sugerido | dado permitido |
|---|---|---|
| visita | `landing_view` | rota, campanha, idioma, dispositivo |
| interesse | `hero_cta_click` | CTA e rota |
| ativação | `document_generated` | formato, cenário, faixas de duração/quadros |
| intenção paga | `route_import_started` | tipo XLSX/CSV/colar, sem nome/conteúdo |
| valor pago | `case_completed` | plano e escopo individual/time |
| conversão | `trial_started` / `checkout_started` | plano e origem |
| retenção | `active_week` | conta pseudonimizada e ação agregada |

Nunca registrar nome de caso, transcrição, frame, arquivo, sistema, chamado ou
e-mail nos eventos analíticos.

### Métricas de decisão

- visita → abertura da ferramenta;
- abertura → primeiro documento;
- primeiro documento → tentativa de roteiro;
- tentativa de roteiro → trial;
- trial → primeiro caso concluído;
- primeiro caso → cinco casos concluídos;
- trial → pagamento;
- Personal → sinal de coordenação Team;
- retenção em 7, 30 e 90 dias.

## Plano priorizado de alterações

### P0 — antes de comprar tráfego ou abrir venda

1. Escolher evidência/roteiro de casos como narrativa principal da home.
2. Corrigir toda contradição entre trial disponível, lista de espera e `em breve`.
3. Reescrever preços em torno de caso avulso, roteiro individual e execução
   coordenada.
4. Validar em produção cada benefício antes de colocá-lo no cartão.
5. Corrigir absolutos de privacidade para distinguir processamento local de dados
   operacionais da conta.
6. Demonstrar o fluxo pago completo, não apenas gravação → documento.
7. Definir evento de ativação e medir o funil sem capturar conteúdo.

### P1 — para elevar conversão

1. Inserir seção antes/depois logo após o hero.
2. Criar exemplo reproduzível com planilha, vídeo e saídas.
3. Colocar resumo dos planos na home.
4. Reduzir formatos exibidos cedo e deslocar a lista completa.
5. Adicionar FAQ comercial e explicação de cancelamento/NFS-e.
6. Criar onboarding do roteiro com planilha exemplo.
7. Levar contexto do primeiro documento para a oferta de Personal.

### P2 — depois de três pilotos

1. Publicar casos reais e depoimentos autorizados.
2. Substituir promessas genéricas por resultados medidos.
3. Testar verticalização para QA interno, consultoria de implantação e UAT.
4. Testar preço e mínimo de assentos do Team com disposição real a pagar.
5. Criar calculadora simples de volume/tempo apenas se os dados de piloto
   sustentarem a conta.

## Experimentos recomendados

Não testar cor de botão antes de resolver posicionamento.

### Experimento 1 — categoria no H1

- **Controle:** “Você percorre a tela. Ele carimba cada passo.”
- **Variante:** “Execute os casos. O Walkstamp organiza a prova.”
- **Primária:** primeiro documento gerado por visita.
- **Secundária:** tentativa de importar roteiro.
- **Guarda:** rejeição/abandono antes de escolher vídeo.

### Experimento 2 — CTA duplo

- **Controle:** apenas abrir ferramenta.
- **Variante:** testar com vídeo + conhecer roteiro.
- **Primária:** soma de ativações qualificadas, separada por CTA.
- **Guarda:** não reduzir geração de documento Free para inflar clique comercial.

### Experimento 3 — fluxo antes de formatos

- **Controle:** tour, problema e formatos.
- **Variante:** hero, antes/depois e demo do roteiro; formatos depois.
- **Primária:** importação de roteiro por visitante de QA.
- **Secundária:** scroll até preços e início de trial.

### Experimento 4 — Personal por resultado

- **Controle:** identidade primeiro.
- **Variante:** roteiro completo primeiro, persistência depois, marca por último.
- **Primária:** trial → primeiro caso concluído.
- **Secundária:** trial → pagamento.

## Checklist de aceite da nova página

- [ ] O H1 diz caso de teste/evidência ou um equivalente inequívoco.
- [ ] Há um único público principal na primeira dobra.
- [ ] A imagem mostra o resultado e identifica o caso/roteiro.
- [ ] Free e pago têm CTAs distintos e coerentes.
- [ ] Personal é vendido por orquestração, não por logotipo.
- [ ] Team é vendido por atribuição, visibilidade e padrão.
- [ ] Nenhum benefício aparece ao mesmo tempo como existente e “em breve”.
- [ ] Não há lista de espera para um plano apresentado como disponível.
- [ ] Privacidade distingue arquivo local, telemetria, conta e anexo opcional.
- [ ] Afirmações sobre concorrentes/modelos têm fonte e data ou foram removidas.
- [ ] Existe uma demonstração completa do produto pago.
- [ ] Prova social é real; na ausência dela, a demonstração é reproduzível.
- [ ] Os eventos do funil não carregam conteúdo do cliente.
- [ ] Mobile mantém H1, proposta e CTA primário na primeira tela.
- [ ] Build, traduções, acessibilidade e links são testados.

## Conclusão

O Walkstamp não precisa parecer “mais inovador”; a engenharia já fornece
diferenciação suficiente. Precisa parecer **mais necessário para um comprador
específico**.

A mudança decisiva é sair de:

> gravação vira documento, com vários usos, formatos e privacidade

para:

> importe os casos, execute, comprove e devolva a rodada organizada; a gravação
> vira a evidência sem sair da sua máquina

O primeiro enunciado explica uma ferramenta interessante. O segundo vende a
conclusão de um trabalho pelo qual empresas já têm responsável, prazo e risco.

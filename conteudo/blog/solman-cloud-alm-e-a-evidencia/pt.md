O SAP Solution Manager **sai de suporte no fim de 2027**, e a própria SAP recomenda que a transição para o SAP Cloud ALM comece agora e esteja concluída antes de 2028. Está escrito na [nota de conhecimento 3585220](https://userapps.support.sap.com/sap/support/knowledge/en/3585220).

Ou seja: quem tem teste rodando dentro do SolMan hoje tem cerca de um ano e meio para decidir o que fazer.

A discussão que eu vejo em todo lugar é "o Cloud ALM já substitui o SolMan?". É uma pergunta razoável e mal formulada, porque trata os dois como se fossem a mesma categoria de coisa. E existe uma terceira pergunta, que quase ninguém está fazendo, e que é a que vai doer em 2028.

Começo pelas duas primeiras.

## O que o SolMan fazia em teste

Vale recapitular, porque muita gente que trabalha com SAP nunca usou o [Test Suite](https://support.sap.com/en/alm/solution-manager/expert-portal/test-suite.html) — usou o SolMan só para documentação de processo ou gestão de mudança.

O Test Suite juntava quatro coisas numa caixa só:

- **Plano e pacote de teste**, com escopo tirado da própria documentação da solução: quais processos, quais transações, quem executa cada pacote.
- **Test Steps Designer**, para escrever o roteiro manual passo a passo dentro da ferramenta.
- **CBTA**, o motor de automação embutido, que gravava e reproduzia a execução.
- **Análise de impacto de mudança (BPCA)**, apoiada nos TBOMs: depois de um transporte, ele apontava quais processos e testes eram afetados — respondendo à pergunta cara de qualquer regressão, que é *o que precisa ser testado de novo*.

O ponto importante para esta conversa: **era um pacote integrado**. Orquestração e execução moravam no mesmo lugar.

## O que o Cloud ALM faz melhor

Bastante coisa, e não é retórica de fornecedor.

Ele nasce ligado à cadeia **processo → requisito → caso de teste → defeito**, com rastreabilidade de ponta a ponta e sem a montagem manual que o SolMan pedia. A [documentação de Test Management](https://support.sap.com/en/alm/sap-cloud-alm/implementation/sap-cloud-alm-implementation-expert-portal/testmanagement.html) descreve o fluxo completo: preparar casos, montar planos, distribuir por testador e período, executar marcando cada ação como passou ou falhou, e registrar defeito no mesmo lugar. Dá até para [subir os casos em massa por planilha](https://community.sap.com/t5/technology-blog-posts-by-sap/mastering-test-preparation-in-sap-cloud-alm-a-step-by-step-guide-to-bulk/ba-p/14289479), que é o tipo de detalhe que decide se um projeto grande adota ou não.

E é web, é rápido, e não exige um ABAP inteiro sendo mantido embaixo. Para quem sofreu com o SolMan, isso não é detalhe — é metade do argumento.

Então sim: **como orquestrador de teste, o Cloud ALM é melhor.** Essa parte da resposta é simples.

## Onde ele não é um superconjunto

A parte que não é simples: o Cloud ALM não é o SolMan com interface nova. É outra arquitetura, e ela **delega** o que o SolMan integrava.

- **O CBTA não vai junto.** O motor de automação embutido era do SolMan e morre com ele. No Cloud ALM, a automação vem de fora — do Tricentis que a SAP distribui, do SAP Test Automation Tool, ou do que você já tiver. [Uma análise de mercado sobre as lacunas](https://blog.perfectwin.ai/sap-cloud-alm-test-management-strengths-gaps-automation-criteria) resume bem a mudança: o Cloud ALM orquestra e reporta, mas delega a execução automatizada a ferramentas externas.
- **A edição de Tricentis que vem no pacote cobre aplicação web**, tipo Fiori. Cenário com SAP GUI e ponta a ponta complexo costuma exigir licença completa. Confirme o escopo com a sua conta antes de colocar isso no plano — este ponto vem de análise de terceiro, não de documentação da SAP.
- **Preparação de massa de dados não é função dele.** Continua sendo problema seu, resolvido fora.
- **A análise de impacto por TBOM, no estilo BPCA, é uma capacidade do SolMan.** Antes de assumir que existe equivalente pronto do outro lado, confira o estado atual — é o tipo de recurso que decide o tamanho da regressão e que ninguém quer descobrir que não tem em cima da hora.

Nada disso é acusação. É a diferença entre um produto integrado e um produto orquestrador. **O Cloud ALM é um regente muito melhor; ele só não toca os instrumentos.**

Se quiser a comparação pela ótica da própria SAP, [este material do time de produto](https://community.sap.com/t5/technology-blog-posts-by-sap/test-management-sap-cloud-alm-or-sap-solution-manager/ba-p/13525698) discute quando usar cada um.

## A terceira pergunta: quem produz a prova?

Agora a parte que quase ninguém está discutindo, e que independe de qual dos dois você escolher.

Nos dois mundos, o teste manual funciona assim: alguém executa o cenário no sistema, volta para a ferramenta e diz **o que aconteceu**. Marca passou ou falhou, escreve um comentário e — se o processo do projeto pedir — anexa um arquivo. É exatamente o fluxo que a SAP descreve no material sobre [gestão de testes manuais no Cloud ALM](https://community.sap.com/t5/technology-blog-posts-by-sap/managing-manual-tests-with-sap-cloud-alm/ba-p/13573163).

Repare no verbo. A ferramenta **registra o resultado**. Ela não registra a execução.

O arquivo anexado continua sendo produzido à mão, do mesmo jeito de sempre: a pessoa tira print do que pareceu importante, cola num documento, escreve uma legenda embaixo e sobe. E esse arquivo carrega os mesmos quatro buracos de sempre:

- **não tem hora de relógio** de cada passo, só a data em que alguém salvou;
- **não diz o ambiente** — e uma tela de QAS é visualmente idêntica a uma de produção;
- **não guarda a sequência**, principalmente o erro que apareceu no meio e foi contornado, porque ninguém fotografa o problema que já resolveu;
- **não tem integridade verificável**: não há como demonstrar que aquela imagem é a que foi capturada.

Escrevi sobre esses quatro pontos em [O que o print perde](/blog/o-que-o-print-perde), e eles são o motivo pelo qual migrar de ferramenta não mexe em nenhum deles. Você troca o lugar onde o status é registrado, e continua com o mesmo pacote de prints como prova.

**O status diz que passou. A evidência diz como passou.** As duas coisas são necessárias e só uma delas está no roadmap de qualquer um dos dois produtos.

## E o histórico, fica onde?

Essa é a pergunta prática de 2027, e ela vale uma reunião inteira no seu projeto.

Se a sua empresa roda SAP há dez anos, existe um acervo de resultados de teste dentro do SolMan: ciclos de regressão, homologações, evidência de mudança que passou por auditoria. Parte disso tem prazo de guarda contratual ou regulatório.

Quando o SolMan sair de suporte, esse acervo não migra sozinho — e o formato dele é de dentro do SolMan. Vale decidir agora, com calma, três coisas: **o que precisa ser preservado, por quanto tempo, e em que formato uma pessoa de fora conseguirá abrir daqui a cinco anos.**

A resposta boa quase sempre é a mesma: um documento autocontido, legível sem a ferramenta que o gerou. PDF com a hora, o ambiente e a sequência dentro. Não porque é bonito — porque é o único formato que sobrevive à próxima migração, que virá.

## Onde este raciocínio não se aplica

- **Se o seu teste é automatizado**, o runner já produz log com hora, resultado e captura na falha. Ali a evidência nasce boa, e o problema é retenção e leitura, não produção.
- **Se você usa o SolMan só para documentação de processo ou gestão de mudança**, o Test Suite nunca foi seu problema e esta discussão não muda seu plano.
- **Se o seu setor tem exigência formal de formato** — assinatura, retenção específica, trilha auditável certificada — nenhuma ferramenta te dá conformidade sozinha. Ela produz insumo; a conformidade é do processo.

## O que eu faria, na prática

- **Separe as duas decisões.** "Qual ferramenta orquestra o teste" e "como a evidência é produzida" são perguntas diferentes, com respostas independentes. Misturar as duas é como o assunto costuma travar.
- **Escolha o orquestrador pelo que você realmente usa.** Se o seu uso do Test Suite é plano, execução manual e defeito, o Cloud ALM cobre com folga. Se você depende de CBTA e de análise de impacto, o plano precisa incluir com o que substituir cada um — e isso é projeto, não configuração.
- **Trate a evidência como artefato independente da ferramenta.** Ela precisa ser legível sem o sistema que a gerou, hoje e daqui a cinco anos.
- **Decida o destino do acervo antes de 2027**, e não no último trimestre. É o tipo de coisa que, feita com pressa, vira decisão de apagar.

## Onde o Walkstamp entra

O Walkstamp cuida da parte que nenhum dos dois cuida: **produzir a prova enquanto o teste acontece.**

A pessoa grava a tela e executa o cenário normalmente, narrando o que faz. A ferramenta separa os momentos em que a tela muda — inclusive a mensagem de erro que apareceu no meio —, monta um documento com a hora de relógio de cada passo, o ambiente declarado (DEV, QAS, PRD ou sandbox) e a fala pareada com cada trecho, e calcula uma impressão digital de cada imagem, que qualquer pessoa confere depois na [página de verificação](/verificar). Sai em PDF, Word, HTML ou Markdown — e tem link pronto para anexar em Zephyr, Jira e TestRail, que é onde o resultado costuma morar.

Ele não substitui o Cloud ALM nem o SolMan, e não tenta: não planeja teste, não gerencia defeito, não faz automação. Ele produz o anexo — e o anexo é a única parte que a migração não vai melhorar sozinha.

E o vídeo não sai da sua máquina: o processamento acontece inteiro no navegador, sem servidor no caminho, o que costuma resolver a conversa com a segurança da informação antes de ela começar. Está tudo explicado em [Segurança](/seguranca), inclusive o que a ferramenta não faz. É grátis, não pede cadastro, e dá para [abrir agora](/) com qualquer gravação que você tenha aí.
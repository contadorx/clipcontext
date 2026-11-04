Abra a planilha de casos de teste do seu projeto e olhe uma linha qualquer. É bem provável que ela diga alguma coisa como *"criar pedido de venda"*, com quatro passos embaixo e um resultado esperado que termina em *"o pedido deve ser criado corretamente"*.

Agora acompanhe a pessoa que vai executar isso.

Ela vai passar as primeiras três horas do dia procurando um material que tenha preço válido, um cliente com limite de crédito liberado, estoque no centro certo e um período aberto. Quando finalmente conseguir, vai executar o teste em oito minutos. E vai marcar como aprovado.

**As três horas não estavam no plano. E são elas que decidem se o teste vale alguma coisa.**

## Roteiro é instrução. Cenário é condição.

Um roteiro diz o que apertar. Um cenário diz **em que situação a regra deveria valer**.

"Criar pedido de venda" é uma instrução. O cenário é outro:

> *Cliente com bloqueio de crédito parcial, material sujeito a substituição tributária, entrega para outro estado, quantidade acima do lote mínimo, período aberto. O pedido deve ser criado com bloqueio de remessa e sem cálculo de ICMS-ST próprio.*

Repare no que apareceu: **um estado inicial, uma combinação específica, e um resultado que dá para conferir.** É isso que faz um teste ser um teste — e não uma visita guiada pela transação.

Quando o caso é escrito como roteiro, a condição não some: ela é transferida, em silêncio, para a pessoa que executa. É por isso que ela passa três horas montando massa. Ela não está perdendo tempo; **ela está escrevendo o cenário que faltava, sem receber crédito por isso, e sem deixar registro.**

## As cinco partes de um cenário que se sustenta

- **Pré-condição** — o estado do mundo antes: quais dados mestres, com quais características, em que situação.
- **Entrada** — o que será informado, com valores concretos e não com "informar os campos obrigatórios".
- **Ação** — onde e como se executa.
- **A regra que está sendo testada** — a razão de o cenário existir. Sem isso, ninguém sabe o que fazer quando o resultado é ambíguo.
- **Resultado esperado verificável** — um documento, um status, um valor, uma mensagem específica. Nunca "corretamente".

Se faltar a primeira, você tem uma tarefa de garimpo. Se faltar a última, você tem uma opinião.

## Por que a massa é o problema mais caro

A massa de dados é a parte do cenário que ninguém escreve, e ela tem quatro comportamentos que atrapalham de formas diferentes.

**Ela queima.** Muitos cenários rodam uma vez só: o pedido vira remessa, o lote é consumido, o status avança e não volta. Reexecutar exige montar tudo de novo — então, na regressão, quase ninguém reexecuta. Confere-se o que dá, e o resto é confiança.

**Ela envelhece.** O cenário passa hoje e falha daqui a duas semanas porque o contrato venceu, o preço expirou, o período fechou. O defeito reportado não é do sistema: é do calendário. E consome um ciclo de análise até alguém perceber.

**Ela é compartilhada.** Duas pessoas usando o mesmo cliente no mesmo ambiente produzem resultados diferentes. A conclusão preguiçosa é "o ambiente está instável". A conclusão correta é que a pré-condição não estava sob controle de ninguém.

**Ela não está descrita.** E esta é a que fecha o argumento: **se a massa não está registrada, o cenário não é reexecutável.** Não por outra pessoa, não em outro ambiente, não daqui a seis meses. Um cenário que só uma pessoa consegue rodar não é ativo de projeto — é conhecimento na cabeça de alguém que uma hora sai de férias.

## As dependências que ninguém mapeou

Tem um efeito de segunda ordem que costuma explodir no meio do ciclo: **cenários que dependem uns dos outros.**

O cenário 12 precisa do documento que o 7 gera. O 20 precisa do estoque que o 15 movimenta. Quando o 7 falha, cinco cenários ficam bloqueados — e isso não aparece em nenhum lugar até o dia em que o painel mostra 40% de execução e ninguém entende por quê.

Vale gastar uma hora, no começo, marcando na planilha quais casos são **independentes** e quais **dependem de outro**. É a informação que permite replanejar o ciclo em vez de descobrir o bloqueio na sexta-feira.

## A cobertura que parece grande

Projetos com muitos cenários costumam ter uma sensação de segurança que o conteúdo não sustenta. Setecentos e oitenta casos parecem muito — até você perguntar quantos deles testam **exceção**.

Caminho feliz é fácil de escrever e fácil de passar. O que quebra em produção quase sempre é o outro: cliente com cadastro incompleto, item com regra especial, devolução parcial, operação interestadual, usuário com perfil restrito.

Uma verificação rápida e reveladora: pegue vinte casos ao acaso e conte quantos têm, na pré-condição, alguma coisa fora do padrão. Se a resposta for dois ou três, a sua cobertura é de largura, não de profundidade.

## Onde este raciocínio não se aplica

- **Teste de fumaça** — o "abre, entra, salva" depois de um transporte — é para ser raso mesmo. Não escreva cenário para isso.
- **Teste automatizado** costuma criar a própria massa no setup e destruir no teardown. Ali o problema deixa de ser descrever a pré-condição e passa a ser mantê-la em código.
- **Projeto pequeno, com um sistema só e pouca regra fiscal**, aguenta bem uma planilha simples. Não invente cerimônia onde não há complexidade.
- **E cenário perfeito no papel não substitui gente que conhece o processo.** O melhor cenário do mundo escrito por quem nunca operou aquilo vai testar o que o desenho previa, e não o que a operação faz.

## O que eu mudaria na sua planilha nesta semana

- **Uma coluna de pré-condição**, obrigatória, com dados mestres nomeados. Não "cliente qualquer": *cliente com bloqueio parcial de crédito*.
- **Resultado esperado com objeto**: número de documento, status, valor, mensagem. Se não dá para conferir sem discutir, ainda não é resultado esperado.
- **Uma marcação de reexecução**: este cenário é **repetível** ou **queima a massa**? Só isso já reorganiza o planejamento da regressão.
- **Uma coluna de dependência**: depende de qual caso?
- **Um conjunto de massa de referência**, criado e documentado uma vez, com nomes reservados para teste — e a regra de que ninguém mais mexe nele.
- **E o registro de qual massa foi usada em cada execução.** É a diferença entre "o cenário 47 passou" e "o cenário 47 passou com o material X, o cliente Y, no dia Z, no ambiente QAS".

## Onde o Walkstamp entra

O Walkstamp não monta massa e não escreve cenário — isso é trabalho de quem conhece o processo. Ele resolve a última linha da lista acima: **registrar, sem trabalho extra, com que condições a execução foi feita.**

A pessoa grava a tela enquanto executa e narra o que está fazendo. A ferramenta separa os momentos em que a tela muda e monta um documento com a hora de relógio de cada passo, o ambiente declarado e a fala pareada com cada trecho. Os dados mestres usados aparecem nas telas, na ordem em que foram informados — e é isso que torna o cenário reexecutável por outra pessoa, meses depois.

Na prática, o documento de execução vira a pré-condição que ninguém escreveu. Não porque alguém parou para documentar, mas porque ficou registrado enquanto acontecia.

Sai em PDF, Word, HTML ou Markdown, e o vídeo não sai da sua máquina — o processamento acontece inteiro no navegador. Está tudo em [Segurança](/seguranca). É grátis e sem cadastro: dá para [abrir agora](/).

Escrevi antes sobre [o defeito que ninguém consegue reproduzir](/blog/defeito-que-ninguem-reproduz), que é o mesmo problema um degrau adiante: quando não se sabe com que condições o teste rodou, não se consegue repetir nem o sucesso nem a falha.

Fica uma pergunta para a sua próxima reunião de ciclo: **se a pessoa que executou o cenário 47 sair de férias amanhã, alguém consegue rodar o 47 de novo?** A resposta honesta costuma dizer mais sobre a maturidade do teste do que qualquer painel de cobertura.
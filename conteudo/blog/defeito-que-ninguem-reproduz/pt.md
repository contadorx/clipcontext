O chamado chega assim: *"erro ao salvar o pedido"*, com um print da mensagem vermelha na tela.

O desenvolvedor abre, tenta, salva. Funciona. Devolve o chamado pedindo mais informações. O key user responde que aconteceu, que ele viu, e que não sabe explicar melhor. Terceiro dia, o chamado ainda está aberto, e as duas pessoas já estão irritadas.

Ninguém errou. O relato foi honesto e o teste do desenvolvedor foi honesto. O problema é estrutural: **o relato descreve o resultado, e a reprodução exige a entrada.** São informações diferentes, e só uma delas costuma sobreviver.

## O que falta, item por item

Um defeito em ERP raramente depende só da transação. Ele depende de um conjunto de condições que ninguém anota porque, na hora, pareciam óbvias:

- **Quem executou** — e principalmente com qual perfil de autorização. Metade dos "funciona aqui" morre nessa linha: o desenvolvedor testa com um perfil largo e o usuário tem outro.
- **Qual ambiente**, e com qual transporte aplicado. Duas máquinas com nomes parecidos e uma diferença de fila de transporte já explicam o comportamento diferente.
- **Quais dados mestres** — material, cliente, fornecedor, centro, organização de vendas. O erro quase nunca é "no pedido"; é "naquele material, com aquele cliente, naquela organização".
- **Qual variante ou layout** estava selecionado. Campo obrigatório que aparece para um e não para outro costuma ser configuração de tela, não bug.
- **A sequência exata**, incluindo o que a pessoa fez antes. Muito defeito só acontece quando se chega pelo caminho B, ou depois de voltar de outra tela.
- **A hora** — e isso importa mais do que parece quando há job noturno, integração agendada ou bloqueio por outro usuário.
- **O que apareceu antes da mensagem final.** Costuma haver um aviso amarelo dois passos antes, que ninguém leu e ninguém guardou.

O print não carrega nenhum desses sete. Ele mostra o fim da história.

## O custo, que ninguém contabiliza

O ciclo de devolução tem preço, e ele é pago três vezes.

A primeira: **o tempo dos dois lados.** Cada ida e volta consome atenção de um desenvolvedor e de um usuário de negócio que tinha outra coisa para fazer.

A segunda: **o prazo do ciclo.** Chamado que fica três dias em ping-pong é um cenário que não fecha, e cenário que não fecha empurra a data.

A terceira é a mais cara e a mais silenciosa: **defeito fechado como "não reproduzível" que aparece em produção.** Ali o custo muda de ordem de grandeza, e a discussão que vem depois — se foi testado ou não — é resolvida no grito, porque ninguém tem registro.

## Por que "descreve melhor" não resolve

A reação natural de todo coordenador é pedir um relato mais detalhado. Um formulário maior, um campo obrigatório a mais, um treinamento sobre como abrir chamado.

Isso ajuda um pouco e falha pelo mesmo motivo de sempre: **pede-se disciplina no pior momento.** A pessoa acabou de perder dez minutos com um erro, está atrasada no roteiro dela, e agora precisa parar para reconstruir de memória sete condições que ela nem sabia que importavam.

Ela vai escrever "erro ao salvar". E está certa em escrever isso, porque é o que ela sabe.

## A inversão que funciona

O caminho que resolve não é pedir mais descrição. É **capturar a execução**, e deixar a descrição para o que a captura não pega.

Quando existe registro da execução — a sequência de telas, com hora e com o que a pessoa falava enquanto fazia — o desenvolvedor não precisa de relato. Ele vê. E as sete condições da lista aparecem sozinhas: o perfil está na tela inicial, o ambiente está no cabeçalho do sistema, os dados mestres estão nos campos preenchidos, a sequência é a própria gravação, e o aviso amarelo que ninguém leu está lá, dois passos antes do erro.

O relato deixa de ser a fonte da verdade e passa a ser o índice: *"o erro está no minuto 3"*.

## Onde isto não serve

- **Dump de ABAP já traz tudo.** Se o erro gerou um dump, ele contém usuário, hora, programa, linha e a pilha de chamadas. Ali a captura de tela é redundante — vá direto ao dump.
- **Teste automatizado não precisa disso.** O runner grava entrada, saída, hora e captura na falha, melhor do que qualquer humano faria.
- **Problema de desempenho pede outra instrumentação.** Lentidão se investiga com medição, não com vídeo — embora a gravação ajude a mostrar o que a pessoa estava fazendo quando ficou lento.
- **Erro com dado sensível na tela** exige tarjar antes de circular, e isso vale para print, vídeo ou documento. Registrar não dispensa cuidado.

## O que dá para mudar nesta semana

- **Peça a gravação junto do chamado**, não no lugar dele. Duas linhas de relato e o registro da execução resolvem mais que um formulário de dez campos.
- **Ensine uma frase só ao time**: narrar em voz alta o que está fazendo enquanto executa. Custa zero segundo e transforma a gravação em explicação.
- **Padronize a abertura**: deixar visível, no começo, o ambiente e o usuário. Resolve duas das sete condições sem nenhum esforço adicional.
- **Crie a regra do retorno**: defeito devolvido por falta de informação volta com a **entrada**, não com mais adjetivos. "Não reproduzível" sem entrada não é conclusão, é pendência.
- **Guarde a evidência junto do caso**, não numa pasta paralela. Evidência que mora longe do caso é evidência que ninguém encontra três meses depois.

## Onde o Walkstamp entra

O Walkstamp transforma a gravação da execução em documento — e é isso que fecha o ciclo do chamado.

A pessoa grava a tela e refaz o cenário narrando. A ferramenta separa os momentos em que a tela muda, inclusive as mensagens de aviso e de erro que apareceram no caminho, e monta um documento com a hora de relógio de cada passo, o ambiente declarado (DEV, QAS, PRD ou sandbox) e a fala pareada com cada trecho. Sai em PDF, Word, HTML ou Markdown, num arquivo que cabe em anexo de chamado — com [link pronto para Zephyr, Jira e TestRail](/), que é onde o defeito costuma morar.

Ele não reproduz o defeito por você, não analisa a causa e não substitui o dump quando existe um. Faz uma coisa: entrega ao desenvolvedor a entrada que faltava, no formato que ele consegue ler em trinta segundos.

E o vídeo não sai da sua máquina — o processamento acontece inteiro no navegador, sem servidor no caminho, o que costuma resolver a conversa com a segurança da informação antes de ela começar. Está tudo em [Segurança](/seguranca). É grátis e sem cadastro: dá para [abrir agora](/) com uma gravação qualquer.

Escrevi antes sobre [as quatro coisas que um print perde](/blog/o-que-o-print-perde) e sobre [a evidência que sobrevive a uma auditoria](/blog/evidencia-que-o-auditor-aceita). Este texto é o mesmo raciocínio no lugar mais barato de testar: **o chamado que volta.**

Se você coordena homologação, tem um número fácil de levantar e desconfortável de olhar: **quantos dos seus defeitos foram devolvidos por falta de informação no último ciclo?** É a métrica mais honesta sobre a qualidade do seu registro — e ela não depende de opinião de ninguém.
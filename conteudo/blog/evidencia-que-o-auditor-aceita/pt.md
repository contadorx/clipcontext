Existe uma pergunta que encerra qualquer discussão em projeto: **"me mostra a evidência do caso 47"**.

Não é uma pergunta técnica. É uma pergunta de memória organizacional, e quase todo projeto responde a ela pior do que imagina. O caso está lá, com status aprovado e o nome de quem executou. A evidência é um arquivo com quatro prints e uma frase embaixo de cada um. Nenhum print tem hora. Nenhum diz em que ambiente foi. E o passo em que o erro apareceu e foi contornado não está lá — porque, na hora de montar o documento, ele não pareceu importante.

Isso não é falha de time. É o resultado previsível de um desenho em que a evidência é produzida depois da execução, por alguém com pressa de fechar o ciclo.

## As seis perguntas que uma evidência precisa responder

Antes de discutir ferramenta, vale ter claro o que se está tentando produzir. Uma evidência útil responde seis coisas, sem depender da memória de ninguém:

- **O quê** — qual caso, qual requisito, qual versão do roteiro
- **Onde** — qual ambiente, qual sistema, qual cliente ou mandante
- **Quem** — quem executou, e quem revisou
- **Quando** — a hora de relógio de cada passo, não a data do arquivo
- **Como** — a sequência inteira, incluindo o que falhou e o que foi contornado
- **O que apareceu** — a tela como ela estava, não a descrição do que estava nela

O print colado num documento normalmente responde duas: o quê e o que apareceu. As outras quatro ficam por conta de quem se lembrar.

## O problema não é o time. É o momento.

Repare que nenhuma das seis perguntas é difícil de responder **durante** a execução. Quem está executando sabe o ambiente, sabe a hora, viu o erro aparecer e sabe o que fez para contornar.

Todas ficam difíceis **depois**. E é exatamente depois que o documento costuma ser montado: no fim do ciclo, quando o prazo já apertou, por alguém que precisa reconstruir de memória o que fez três dias atrás.

Uma coisa que aprendi trabalhando com Seis Sigma e nunca desaprendi: **um controle que depende de esforço voluntário no fim do processo é um controle que já falhou no papel.** Não porque as pessoas sejam descuidadas — porque o processo pediu disciplina justamente no dia em que ninguém tem sobrando.

Prova reconstruída depois não é prova. É a lembrança de alguém, com imagens junto.

## A conta que ninguém faz

O custo aparece em dois lugares, e nenhum dos dois entra no orçamento do projeto.

O primeiro é a montagem. Some o tempo que o testador gasta recortando print, colando, escrevendo legenda e salvando arquivo — e multiplique pelo número de casos, e de novo pelo número de ciclos de regressão. Numa bateria de 40 casos com três ciclos, mesmo cinco minutos por caso viram dez horas de trabalho que não testaram nada.

O segundo é o retrabalho. É a evidência que alguém pede três meses depois e ninguém acha; a divergência encontrada numa consulta de banco que virou discussão de memória porque ninguém salvou o retorno; o caso que precisa ser reexecutado inteiro porque a prova não sobreviveu.

O segundo custo é maior que o primeiro e é invisível, porque ele aparece num trimestre diferente daquele em que foi criado.

## Onde este raciocínio não se aplica

Vale dizer com todas as letras, porque nem todo teste tem esse problema:

- **Teste automatizado já tem evidência melhor.** O runner gera log, retorno e captura em falha, tudo com carimbo de tempo. Ali o problema é outro: retenção e leitura, não produção.
- **Processo com dado sensível exige tarjamento antes de circular.** Gravar a tela de um sistema com dado pessoal e distribuir o documento é trocar um problema por outro maior.
- **Auditoria regulada costuma ter formato próprio.** Setor farmacêutico, financeiro e público têm exigências específicas de assinatura, retenção e trilha. Ferramenta nenhuma dá conformidade — quem dá é o processo.

O raciocínio deste artigo vale para o miolo: teste manual, teste de aceitação, homologação com usuário, validação pós-integração e instrução de trabalho. É onde está a maior parte do volume e quase toda a dor.

## Como inverter a ordem, na prática

![Atenção ao Teste](/img/blog/evidencia-que-o-auditor-aceita/1787069528888.jpg)

Não é projeto. São cinco decisões pequenas:

- **Grave a execução em vez de fotografá-la.** A tela em movimento contém a sequência inteira, inclusive o que deu errado — que é a parte que o print sempre perde.
- **Narre enquanto executa.** Dizer em voz alta "agora vou lançar sem o centro de custo para ver a mensagem" transforma a gravação em documento explicado, e custa zero segundo a mais.
- **Deixe o ambiente visível na tela** no começo da execução. Resolve a pergunta "onde" sem nenhum trabalho extra.
- **Guarde o artefato junto do caso**, não numa pasta paralela. Evidência que mora longe do caso é evidência que ninguém encontra.
- **Descarte o vídeo depois de gerar o documento.** O documento é o que responde as seis perguntas; a gravação bruta só ocupa espaço e ninguém volta a assistir.

Repare que nenhuma dessas cinco pede disciplina depois. Todas acontecem durante — e é essa a única diferença que importa.

## Onde o Walkstamp entra

O Walkstamp existe para o passo do meio: transformar a gravação em documento sem trabalho manual.

Você grava a tela, ou usa uma gravação que já tem. A ferramenta identifica os momentos em que a tela **muda** — o clique que abriu a janela, a mensagem de erro, o registro salvo — e monta um documento com esses instantes, a hora de cada um e a transcrição da fala pareada com cada trecho. Sai em PDF, Word, HTML ou Markdown. Uma gravação de dois gigabytes vira um arquivo de alguns megabytes que responde as seis perguntas, e a gravação pode ser apagada.

O detalhe que costuma decidir o assunto em empresa: **nada disso sai do seu computador.** Não há servidor recebendo o vídeo — o processamento inteiro acontece no navegador. Dá para conferir com o F12 aberto, na aba de rede, enquanto processa um arquivo grande: a coluna de envio fica em zero. Está tudo explicado em [Segurança](/seguranca), inclusive as certificações que a ferramenta **não** tem e por quê.

É grátis, não pede cadastro e você pode [abrir agora](/) com uma gravação qualquer que tenha aí.

E se você fizer isso e alguma coisa quebrar, me conte. Nesta fase, defeito relatado vale mais que elogio.
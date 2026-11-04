Semana passada eu perguntei a um key user, no meio do primeiro ciclo de testes de uma implantação de S/4HANA, como o time dele guardava a evidência do que estava sendo testado. A resposta foi tranquila:

*"Usamos IA para deixar todos os documentos de cenário prontos. São cerca de 800. É só tirar o print da tela e colocar na etapa correspondente. Não se perde muito tempo não."*

Ele está certo. E é por isso que esse assunto é mais difícil do que parece.

Quando alguém diz que montar evidência dá trabalho, a conversa é fácil: é só mostrar um jeito mais rápido. Quando a pessoa diz que **não dá trabalho**, não tem argumento de tempo que funcione. E não deveria funcionar mesmo — o processo dele é bom.

Só que rapidez e prova são coisas diferentes. E o print é rápido justamente porque não carrega quase nada junto.

## Um print responde duas perguntas

Numa evidência de teste, seis coisas precisam ficar respondidas sem depender da memória de ninguém: o que foi executado, onde, por quem, quando, como, e o que apareceu na tela. Escrevi sobre isso em [A evidência que o auditor aceita](/blog/evidencia-que-o-auditor-aceita).

Um print colado no passo certo responde duas: **o quê** (porque está no passo certo) e **o que apareceu** (porque é a imagem).

As outras quatro ficam por conta de quem lembrar. E o problema não é a memória das pessoas — é que ninguém é chamado para lembrar no dia seguinte. É meses depois.

## Falta 1: a hora de relógio

Um print não tem hora dentro dele. O arquivo tem data de criação, que é a data em que alguém salvou — e some assim que a imagem é colada num documento, copiada para outro, ou reenviada por e-mail.

Isso parece detalhe até o dia em que duas coisas precisam ser comparadas. O lançamento foi feito antes ou depois da correção do parâmetro? A tela de erro é do primeiro ciclo ou do segundo? Sem hora, a resposta vira reconstrução.

E tem um caso em que a hora é a prova inteira: quando o que se quer demonstrar é **quanto tempo** uma coisa levou. Um processo que precisava rodar em cinco minutos e rodou em quarenta não tem como ser demonstrado com dois prints sem relógio.

## Falta 2: o ambiente

Essa é a primeira pergunta que um auditor faz, e a que mais derruba pacote de evidência: **isso é de qual ambiente?**

Uma tela de QAS e uma tela de produção são visualmente idênticas na maioria dos sistemas. A diferença está numa faixa de cor, no nome do servidor, ou em lugar nenhum. E as duas provam coisas diferentes: uma mostra que o cenário funciona, a outra mostra que ele funcionou de verdade, com dado real.

Um documento de evidência que não diz o ambiente não prova nenhuma das duas coisas. Ele vira uma imagem de um sistema qualquer.

## Falta 3: a sequência — principalmente o que deu errado

Essa é a maior perda, e é a mais silenciosa.

Quem executa um caso de teste tira print do que **pareceu importante**: a tela final, a mensagem de sucesso, o número do documento gerado. O que não vira print é o meio do caminho — a mensagem de erro que apareceu, o campo que travou, o jeito que a pessoa achou para contornar.

Só que é exatamente aí que mora a informação valiosa. Um caso que passou "de primeira" e um caso que passou "depois de três tentativas e um contorno" têm o mesmo status no relatório e são realidades completamente diferentes para quem vai operar aquilo em produção.

O print não perde essa informação por acidente. Ele perde por natureza: ninguém fotografa o erro que já resolveu.

## Falta 4: a integridade

Essa quase nunca é discutida, e é a que mais importa quando a evidência vira assunto sério.

Uma imagem colada num documento pode ser recortada, editada, trocada por outra. Não estou dizendo que alguém vai falsificar de má-fé — na prática o que acontece é banal: a pessoa refaz o print porque o primeiro ficou cortado, e cola o novo sem avisar ninguém. Fica tudo certo. Só que o documento não tem como demonstrar que está certo.

Uma evidência forte carrega uma impressão digital de cada imagem, calculada no momento em que ela foi capturada. Quem receber o documento consegue conferir depois se a imagem é aquela mesma. Isso não impede ninguém de trocar a imagem — impede de trocar **sem que apareça**, que é o que importa.

## Por que isso não dói agora

Aqui está o motivo de esse assunto ser tão difícil de vender e tão fácil de entender depois.

**As quatro perdas são diferidas.** Nenhuma delas incomoda no dia em que o print é colado. Todas incomodam meses depois, num trimestre diferente, quase sempre com outra pessoa envolvida — o auditor, o cliente, o gerente novo, o time que assumiu a sustentação.

Ou seja: quem paga o custo não é quem cria o custo. É por isso que a pessoa que executa acha tranquilo, e está sendo honesta. E é por isso que a decisão sobre como registrar evidência raramente melhora sozinha: quem sente a falta não estava na sala quando o método foi escolhido.

## Onde o print basta

Não é sempre que isso importa, e fingir que é seria desonesto.

- **Comunicação interna do dia a dia.** Mandar uma tela no chat para o colega entender o problema. Ninguém vai auditar aquilo.
- **Registro de defeito.** O que o desenvolvedor precisa é da tela e da mensagem; o resto está no chamado.
- **Teste automatizado.** O runner já grava tudo com hora, resultado e captura na falha. Ali o print manual seria um retrocesso.
- **Processo que ninguém vai revisitar.** Existe muita coisa assim, e tudo bem.

O raciocínio deste texto vale onde a evidência **volta**: homologação, aceite de cliente, auditoria interna, certificação, disputa contratual, sustentação de um sistema que outra pessoa vai manter.

## O que dá para fazer sem trocar de ferramenta

Se o seu processo com print funciona e você não quer mexer nele, dá para tapar três dos quatro buracos com hábito, e custa quase nada:

- **Deixe um relógio visível na tela** enquanto executa. Resolve a hora, e aparece dentro da imagem, não fora dela.
- **Deixe o ambiente visível** também: o nome do sistema, a faixa de cor, o cabeçalho. Um print no começo da execução mostrando onde você está já ajuda muito.
- **Nomeie o arquivo com caso e passo**, sempre no mesmo formato. Evidência que se acha é evidência que existe.
- **Tire print do erro também**, não só do sucesso. Esse é o hábito mais difícil e o mais valioso.

O quarto buraco — integridade — não dá para resolver com disciplina. Ou a ferramenta calcula, ou não existe.

## Onde o Walkstamp entra

O Walkstamp resolve os quatro de uma vez, e por um caminho diferente: em vez de você fotografar o que pareceu importante, ele **grava a execução** e depois separa os momentos em que a tela mudou.

Cada momento sai com a hora de relógio, com o ambiente que você declarou (DEV, QAS, PRD ou sandbox), na ordem em que aconteceu — inclusive o erro que apareceu no meio, porque ele é uma mudança de tela como qualquer outra — e com a impressão digital de cada imagem, que qualquer pessoa pode conferir depois na [página de verificação](/verificar). Sai em PDF, Word, HTML ou Markdown.

E o vídeo não sai da sua máquina. Não existe servidor recebendo nada: o processamento inteiro acontece no navegador, e dá para conferir isso com o F12 aberto na aba de rede enquanto um arquivo grande é processado. Está tudo escrito em [Segurança](/seguranca), inclusive o que a ferramenta não faz.

É grátis, não pede cadastro, e você pode [abrir agora](/) com qualquer gravação que tenha aí.

Se você já tem um jeito que funciona, não precisa trocar. Só vale conferir se ele responde as quatro perguntas — porque quem vai fazer essas perguntas não vai estar por perto para explicar o que quis dizer.
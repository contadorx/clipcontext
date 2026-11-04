*Escrito em 20 de agosto de 2026. O ponto central deste texto vale enquanto as regras de validação de IBS e CBS estiverem adiadas — e não há data publicada para o fim do adiamento.*

O time de faturamento comemorou: a nota saiu, autorizada, sem o bloco novo preenchido direito. Ninguém travou nada, o pedido embarcou, a semana seguiu.

O motivo do alívio é o Ato Técnico Conjunto CGIBS/RFB nº 1, de 31 de julho de 2026, que adiou as regras de validação dos campos de IBS e CBS nos documentos fiscais eletrônicos. Na prática: os documentos não são rejeitados na ausência desses campos. Vale para NF-e, NFC-e, CT-e, CT-e OS, GTV-e, BP-e, NF3e e NFCom.

Repare no que foi adiado, porque quase todo texto sobre isso erra: **caiu a rejeição, não os campos.** A obrigação de informar continua valendo e o cronograma segue de pé. O documento é autorizado incompleto, e quem não preencheu está descumprindo obrigação — não aproveitando uma dispensa.

Mas o efeito colateral é maior que a discussão sobre obrigação, e é sobre teste.

Para os tributos antigos, o fisco ainda filtra. Nota com ICMS errado trava, e essa trava vinha funcionando há duas décadas como um conferidor externo e gratuito: se passou, alguma coerência mínima existia. Para IBS e CBS não existe filtro nenhum. O que ia entrar em agosto foi adiado antes de valer.

Quem está testando o IVA dual está testando sem rede. E a maioria não percebeu, porque a nota continua sendo autorizada.

## Preenchido não é o mesmo que correto

Um número circulou bastante nas últimas semanas: em 4 de agosto de 2026, cerca de 88% dos documentos exigidos já vinham com os campos de IBS e CBS preenchidos.

É um bom número, e ele mede uma coisa só: **taxa de preenchimento.** Não diz nada sobre taxa de acerto.

E aqui está o problema: ninguém publica taxa de acerto, porque ninguém tem como medir. O ambiente autorizador não confere o valor — ele recebe. Um campo preenchido com a alíquota errada, com base de cálculo indevida, com CST equivocado ou com a exceção não aplicada entra na mesma estatística de um campo perfeito.

Pior: o dado preenchido segue viagem. Ele alimenta obrigação acessória, cruzamento e histórico. O erro que ninguém barrou na porta não fica parado esperando alguém encontrar; ele vira base de comparação.

Existe uma diferença enorme entre "88% das empresas se adaptaram" e "88% dos documentos estão certos", e a primeira frase está sendo lida como a segunda em muita reunião de status. É o tipo de número que tranquiliza a diretoria e não protege ninguém.

## A tela do ERP não prova cálculo tributário

Aqui é onde eu preciso dar razão a uma objeção que ouvi de um profissional de qualidade fiscal, e ela está correta:

*"Print da tela de pedido ou de fatura não prova conformidade tributária. O que o auditor cobra é o XML autorizado, a memória de cálculo e o log da mensageria batendo com a regra. O trabalho duro é de mensageria, não de tela."*

Está certo, e vale dizer com todas as letras: **nenhuma captura de tela demonstra que uma alíquota foi calculada corretamente.** Quem promete isso está vendendo.

A prova do cálculo é o arquivo: o XML autorizado, com os valores, confrontado com a regra que deveria ter sido aplicada àquela operação. Ferramenta de tela não entra nessa conversa, e ferramenta nenhuma dá conformidade.

Só que existe uma segunda coisa sendo provada num ciclo de teste, e ela costuma ser confundida com a primeira.

## O que a execução prova, e o cálculo não

O XML prova o que o sistema calculou. Ele não prova **o que foi pedido ao sistema.**

E é justamente aí que os erros estão nascendo. Os problemas que aparecem hoje raramente vêm do motor de imposto: vêm de cadastro desatualizado, de parametrização de exceção, de regime específico não aplicado, de um material com classificação errada. Ou seja, nascem na entrada — no que o operador escolheu, digitou e confirmou antes de o cálculo acontecer.

Três meses depois, quando alguém pega um XML com valor estranho, a pergunta que trava a discussão não é "quanto o sistema calculou". É:

- esse cenário foi executado com qual material, qual cliente, qual condição?
- em que ambiente isso rodou?
- a tela mostrou algum aviso, e a pessoa seguiu mesmo assim?
- foi o cenário de exceção que estava no roteiro, ou alguém testou o caminho fácil e marcou como aprovado?

Nenhuma dessas está no XML. Todas estão na execução — e a execução, hoje, não é registrada em lugar nenhum. Ela vira memória de quem estava lá, e quem estava lá já saiu do projeto.

**São duas provas de coisas diferentes: o arquivo prova o cálculo; o registro da execução prova que alguém executou o cenário previsto e olhou.** Faltando qualquer uma, a evidência está incompleta.

## Onde isto não serve

- **Se o teste é automatizado**, o runner já grava entrada, saída, hora e falha. Ali a evidência nasce completa e registrar tela seria retrabalho.
- **Se o que você precisa validar é o cálculo em si** — alíquota, base, CST, exceção —, o caminho é confrontar XML e memória de cálculo com a regra. Tela não ajuda, e insistir nela é perder tempo.
- **Se o cenário é de integração** — retorno da mensageria, apuração assistida, contingência —, o objeto do teste é a resposta do outro lado, não a jornada na interface.
- **Validação massiva de schema** também não é assunto de execução manual.

Este texto trata do miolo: teste de aceite executado por gente de negócio, cenário de exceção, homologação com key user. É onde está a maior parte do volume desta reforma e quase toda a discussão que vira briga depois.

## O critério de aceite que muda esta semana

Se o passo final do seu roteiro de teste é "nota autorizada", ele parou de significar alguma coisa em 31 de julho. Três mudanças que dá para fazer no roteiro sem projeto nenhum:

- **Troque o critério final.** De "documento autorizado" para "valor conferido contra a regra". A autorização passou a ser pré-requisito de transmissão, não evidência de acerto.
- **Peça o pacote completo por cenário aprovado:** o XML autorizado, a memória de cálculo confrontada com a regra aplicável, e o registro da execução que mostra com que dados aquilo foi feito. As três partes, ou a prova está pela metade.
- **Marque a dívida.** Todo cenário aprovado desde agosto usando "passou na Sefaz" como critério é candidato a reexecução. Como não há data publicada para o fim do adiamento, essa fila pode crescer por meses — e vai ser cobrada de uma vez, no pior momento, que é quando a rejeição religar.

O terceiro item é o mais desconfortável e o mais barato de fazer agora: é uma coluna a mais na planilha de casos, com a data em que o cenário foi aprovado e o critério usado.

## Onde o Walkstamp entra

O Walkstamp cuida da terceira parte do pacote — o registro da execução — e não tenta fazer as outras duas.

Quem executa grava a tela e roda o cenário normalmente, narrando. A ferramenta separa os momentos em que a tela muda, inclusive as mensagens de aviso e erro que aparecem no caminho, e monta um documento com a hora de relógio de cada passo, o ambiente declarado (DEV, QAS, PRD ou sandbox) e a fala pareada com cada trecho. Sai em PDF, Word, HTML ou Markdown, com link pronto para anexar em Zephyr, Jira e TestRail — ao lado do XML, que continua sendo a prova do cálculo.

Duas coisas que ele **não** faz, e que ninguém deveria prometer: não confere alíquota, não valida cálculo e não dá conformidade a nada. E não substitui o confronto do XML com a regra, que continua sendo trabalho de quem entende de tributo.

O vídeo não sai da sua máquina — o processamento acontece inteiro no navegador, sem servidor no caminho, o que costuma encerrar a conversa com a segurança da informação antes de ela começar. Está tudo em [Segurança](/seguranca), inclusive o que a ferramenta não faz. É grátis e não pede cadastro: dá para [abrir agora](/) com uma gravação qualquer.

E se você testa faturamento nesta janela, a pergunta que eu deixaria na mesa da próxima reunião de projeto é simples: **quantos dos cenários aprovados no último mês foram aprovados porque a nota passou?**
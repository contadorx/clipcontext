No meio de um ciclo de homologação, um key user levanta a mão e diz a frase que resume o problema inteiro:

*"Passou, mas tem uma coisa estranha aqui."*

A coordenadora pergunta o que é. Ele hesita, olha a tela de novo, e responde: *"não sei explicar direito, mas esse valor não costuma vir assim."*

Ela agradece, ele marca o caso como aprovado — porque o resultado bateu com o esperado —, e os dois seguem. Aquela frase não tinha onde ser registrada.

Três meses depois, em produção, o valor que não costumava vir assim vira um chamado.

## Duas perguntas diferentes

O roteiro de teste pergunta uma coisa só: **passou?** Executou os passos, o resultado bateu com o esperado, marca aprovado.

O key user consegue responder outra, que ninguém pediu: **está certo?**

Ele não compara o resultado com o roteiro. Ele compara com a operação que ele conhece — e é por isso que percebe o que o roteiro não previa: um campo que sempre vem preenchido e dessa vez veio vazio, um valor plausível mas alto demais, uma ordem de etapas que na prática é outra, um cliente que na vida real nunca faria aquilo.

**Essa é a coisa mais valiosa que acontece num teste de aceitação.** Nenhum roteiro produz isso, porque roteiro só encontra o que quem escreveu já imaginava.

E é justamente essa informação que o projeto não tem onde guardar.

## Por que o key user é o melhor detector de erro

Ele traz o que nenhuma outra pessoa do projeto tem: **a memória da operação real.**

O consultor conhece o sistema. O testador conhece a técnica de teste. O analista conhece o desenho. Só o key user sabe que aquele cliente compra sempre no fim do mês, que aquele material tem uma exceção que ninguém documentou, e que a regra escrita no desenho não é a que a área pratica desde 2019.

Numa homologação, o valor dele não está em executar passos. **Está em estranhar.**

## E por que ele é o pior documentador — sem culpa nenhuma

Aqui vem a parte que os projetos costumam tratar como falha de disciplina, e não é.

**Não é o trabalho dele.** Ele tem uma função, metas e uma fila que não pararam porque o projeto começou. O teste é hora extra do trabalho dele.

**Ele está entre duas reuniões.** A janela dele é curta e picada. Documentar depois significa: no fim do dia, quando ele ainda tem a operação para fechar.

**O vocabulário do formulário não é o dele.** "Resultado esperado", "pré-condição", "severidade". Ele sabe o que aconteceu; não sabe traduzir para a planilha.

**E o que ele viu não cabe no campo.** "Passou" ou "falhou" não tem lugar para "passou, mas está estranho". Então ele marca passou, que é a verdade formal, e a observação evapora.

Pedir que ele "descreva melhor" é pedir disciplina no pior momento — o mesmo erro de [quando o defeito volta com "não consegui reproduzir"](/blog/defeito-que-ninguem-reproduz).

## A segunda perda, que é pior que a primeira

Quando a observação do key user não tem destino, acontece uma coisa silenciosa: **ele aprende que aquilo não cabe.**

Na primeira vez ele fala. Na segunda, fala mais curto. Na terceira, marca aprovado e não comenta — porque virar assunto custa tempo dele, e ninguém deu retorno da vez anterior.

O projeto interpreta isso como maturidade do ciclo: menos ruído, mais casos aprovados, curva bonita. É o oposto. **O detector foi desligado, e o painel ficou mais verde exatamente quando ficou menos confiável.**

## Onde este raciocínio não se aplica

- **Key user não substitui teste profissional.** Regressão em massa, teste de integração, carga e segurança exigem gente de teste, técnica e ferramenta. Homologação é uma camada, não a única.
- **Nem todo key user conhece o processo.** Tem quem conheça a transação e não o negócio, e aí a "estranheza" não vem — o que não é defeito de caráter, é sinal de que a pessoa escolhida talvez não seja a certa para aquele cenário.
- **Nem toda estranheza é defeito.** Boa parte é mudança de processo que a pessoa ainda não digeriu, e o trabalho ali é explicar, não corrigir. Mas isso só dá para separar depois de registrar.
- **Se o seu ciclo já tem analista dedicado acompanhando cada sessão**, você já resolveu o problema deste artigo por outro caminho — e mais caro.

## O que eu mudaria no seu próximo ciclo

- **Separe as duas perguntas no formulário.** Um campo "passou" e outro "está como você esperava?". Dois cliques, e o segundo é onde mora o ouro.
- **Peça observação, não descrição.** "O que te chamou atenção?" é uma pergunta que o key user sabe responder. "Descreva o comportamento anômalo" não é.
- **Peça narração em voz alta durante a execução.** É a forma mais barata de capturar o que ele está pensando enquanto vê — e é justamente onde o "isso aqui normalmente vem preenchido" aparece.
- **Crie um destino para a dúvida.** Uma lista de "estranhezas" separada dos defeitos, revisada por quem entende do processo. Sem destino, a observação morre e o detector desliga.
- **Feche cada sessão com quinze minutos.** Não para preencher planilha: para perguntar "teve alguma coisa que te incomodou e você não soube onde colocar?".
- **E dê retorno.** Toda estranheza registrada precisa voltar com um veredito, mesmo que seja "isso é esperado, mudou por causa da nova regra". É o retorno que mantém a pessoa falando.

## Onde o Walkstamp entra

O Walkstamp resolve uma parte específica disso: **transformar o que o key user fala enquanto executa em registro, sem pedir que ele pare para documentar.**

Ele grava a tela e executa o cenário narrando. A ferramenta separa os momentos em que a tela muda e monta um documento com a hora de relógio de cada passo, o ambiente e **a fala pareada com cada trecho**. O "esse valor não costuma vir assim" fica ali, ao lado da tela em que foi dito, com hora — em vez de evaporar no corredor.

Sai em PDF, Word, HTML ou Markdown, com link pronto para anexar em Zephyr, Jira e TestRail.

O que ele não faz: não avalia se a estranheza é defeito, não escreve o roteiro e não substitui a conversa de quinze minutos no fim da sessão. Ele garante que a observação exista em algum lugar quando essa conversa acontecer.

E o vídeo não sai da máquina de quem executa — o processamento acontece inteiro no navegador, o que costuma resolver a conversa com segurança da informação antes de ela começar. Está tudo em [Segurança](/seguranca). É grátis e sem cadastro: dá para [abrir agora](/).

Fica a pergunta para a sua próxima reunião de ciclo: **no último mês, quantas observações de key user foram registradas em algum lugar — e quantas voltaram com resposta?** Se a segunda for zero, o silêncio que você vai ter no próximo ciclo já está contratado.
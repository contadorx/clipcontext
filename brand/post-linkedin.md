# LinkedIn: artigo + post curto + comentário

Você tem razão que o texto anterior estava longo para o feed — 2.800 caracteres num formato que corta em
200. Aqui a mesma ideia está dividida no que cada formato faz bem:

| peça | tamanho | serve para |
|---|---|---|
| **Post** | ~1.150 caracteres | alcance. Precisa se sustentar sozinho, mesmo para quem não clica em nada |
| **Artigo** | ~7.500 caracteres | profundidade e permanência. Fica indexado, e você reaproveita por anos |
| **Comentário** | 2 linhas | os dois links, fora do corpo do post |

**A ressalva honesta:** artigo no LinkedIn alcança bem menos que post nativo — o algoritmo prefere o que
mantém a pessoa no feed. Por isso o post abaixo **não** é uma chamada para o artigo. Ele entrega o
argumento inteiro e termina na frase de efeito. Quem quiser a conta aberta vai ao comentário. Se o post
depender do clique, você troca alcance por profundidade e perde os dois.

---
---

# 1. O POST

*(publicar primeiro; o comentário logo em seguida)*

> Uma hora de reunião gravada custa cerca de **1 milhão de tokens** no modelo que "assiste" vídeo.
>
> Não é força de expressão. Ele amostra um quadro por segundo, a ~300 tokens por segundo de vídeo. Uma
> hora são 3.600 imagens: enche a janela de contexto inteira e não sobra espaço para a conversa. E você
> repaga isso a cada pergunta.
>
> Mas esse nem é o problema mais caro.
>
> O mais caro é que, para o modelo assistir, o arquivo precisa sair da sua máquina. E aí começa a
> sequência que todo arquiteto conhece: para onde vai, quanto tempo fica, quem é o subprocessador, isso
> treina modelo, tem DPA assinado.
>
> São perguntas corretas. E cada uma custa semanas.
>
> Depois de alguns anos desenhando integrações em ambiente onde elas precisam de resposta antes de
> qualquer piloto, a conclusão que fui obrigado a tirar é chata e útil:
>
> **a arquitetura mais barata de aprovar é a que não gera a pergunta.**
>
> Dado que não sai do dispositivo não precisa de DPA. Nem de cláusula de transferência internacional. Nem
> de política de retenção, porque não há retenção. Não é um controle a mais — é a eliminação de uma
> categoria inteira de controle.
>
> E hoje o navegador transcreve uma reunião de uma hora sem que o áudio saia da máquina. A capacidade
> existe. O que falta é o hábito de perguntar *"isso precisa mesmo de servidor?"* antes de *"qual
> provedor eu contrato?"*.
>
> *Opinião e projeto pessoais, sem relação com meu empregador.*
>
> #LGPD #ProteçãoDeDados #InteligênciaArtificial #Arquitetura

---

# 2. O COMENTÁRIO

*(seu próprio, logo depois de publicar)*

> Abri a conta inteira num artigo — incluindo onde o processamento local **não** serve, que é a parte que
> ninguém escreve: [link do artigo]
>
> E a ferramenta que saiu disso, gratuita e de código aberto: clipcontext.app

---
---

# 3. O ARTIGO

**Título:** A conta que ninguém faz antes de mandar vídeo para uma IA

**Subtítulo:** Uma hora de reunião custa 1 milhão de tokens e um contrato de tratamento de dados. Dá para
não pagar nenhum dos dois.

---

Faça a conta antes de desenhar a integração.

O modelo que hoje aceita vídeo nativamente amostra o arquivo a **um quadro por segundo**, e cobra por volta
de **300 tokens por segundo** de vídeo em resolução padrão. Uma reunião de uma hora vira 3.600 imagens e
mais de um milhão de tokens — mais do que cabe numa janela de um milhão. Em resolução baixa são 100 tokens
por segundo, 360 mil na hora: cabe, e sobra pouco. Em qualquer um dos dois casos, você repaga esse contexto
a cada pergunta nova.

E olhe o que está nesses 3.600 quadros. Numa apresentação, o slide fica na tela por dois ou três minutos.
São 150 fotografias idênticas do mesmo slide, cada uma cobrada por inteiro. A informação nova — a troca de
tela — são talvez 60 momentos na hora inteira. Você está pagando 3.600 para receber 60.

Isso é caro. Mas ainda é o problema barato.

## O problema caro é o arquivo sair da máquina

Para o modelo assistir, o vídeo precisa subir. E é aí que qualquer projeto dentro de uma empresa séria
encontra a sequência que todo arquiteto de soluções conhece de cor:

- para onde vai o arquivo?
- quanto tempo fica lá?
- quem são os subprocessadores?
- o conteúdo é usado para treinar modelo?
- existe contrato de tratamento assinado?
- é transferência internacional? sob qual salvaguarda?
- qual o prazo de retenção, e como se pede a exclusão?

Nenhuma dessas perguntas é burocracia inventada. Todas têm resposta certa e resposta errada, e o time que
pergunta está fazendo o trabalho dele. O problema é o custo: **cada uma dessas perguntas custa semanas** —
de levantamento, de revisão jurídica, de fila com o fornecedor, de aprovação.

E o custo não é pago uma vez. É pago de novo a cada fornecedor novo, a cada renovação, a cada auditoria.

## A conclusão que sou obrigado a tirar

Passo os dias desenhando integrações em ambiente onde essas perguntas precisam de resposta **antes** de
qualquer piloto. E a conclusão é chata, pouco heroica e muito útil:

> A arquitetura mais barata de aprovar é a que não gera a pergunta.

Dado que não sai do dispositivo não precisa de contrato de tratamento. Não precisa de cláusula de
transferência internacional, porque não há transferência. Não precisa de política de retenção, porque não
há retenção. Não precisa de resposta sobre treinamento de modelo, porque não há o que treinar.

Repare que isso **não é um controle a mais**. Controle a mais aumenta o custo. Isto elimina uma categoria
inteira de controle — que é uma coisa bem diferente, e bem mais rara.

É o mesmo raciocínio que sustenta minimização de dados na LGPD e no GDPR, só que aplicado antes: em vez de
coletar menos, **não coletar**. O dado que não existe não vaza, não precisa ser inventariado, não aparece no
relatório de impacto e não custa nada de armazenamento.

## Por que isso virou possível agora, e não em 2022

Durante anos "processar no cliente" foi resposta de arquiteto teimoso. O navegador não dava conta, e a
conversa acabava ali. Três coisas mudaram:

**WebGPU.** O navegador ganhou acesso à placa de vídeo por uma API moderna. Inferência que exigia servidor
com GPU passou a rodar na máquina de quem usa.

**WebAssembly com múltiplas linhas de execução.** Com os cabeçalhos de isolamento de origem cruzada, o
navegador libera `SharedArrayBuffer` e o WASM passa a usar mais de um núcleo. É a diferença entre a
transcrição rodar em tempo real e rodar em três vezes o tempo real.

**Modelos que encolheram.** Um modelo de reconhecimento de fala quantizado cabe em 77 MB. Não é o melhor
modelo do mundo — é bom o suficiente para uma ata, e cabe num download.

Somando os três: dá para transcrever uma reunião de uma hora **sem que um segundo de áudio saia da
máquina**. Isso não era verdade três anos atrás. Hoje é, e a maioria dos desenhos ainda não incorporou.

## Onde o processamento local não serve

Um argumento que só tem um lado é propaganda. Então: há casos em que insistir no cliente é teimosia, e vale
reconhecer quais.

**Quando o formato exige um decodificador que o navegador não tem.** HEVC, MKV, ProRes. O navegador
simplesmente não abre. Converter exige ffmpeg num servidor, e não há jeito elegante de contornar.

**Quando a precisão precisa ser máxima.** O modelo grande não cabe na memória do navegador. Se a
transcrição vai virar documento com valor jurídico, a diferença de qualidade importa mais que a arquitetura.

**Quando o volume é industrial.** Processar 400 vídeos por noite não é trabalho para o notebook de ninguém.
Lote é servidor, e está tudo bem.

**Quando o resultado precisa ser compartilhado e versionado.** Se o time inteiro tem que ver o mesmo
documento, alguém vai ter que guardá-lo em algum lugar — e aí o lugar volta a existir.

A régua que eu uso é simples: **o servidor precisa se justificar.** Não é o padrão do qual se foge; é a
exceção que se contrata quando o cliente não dá conta. Invertida assim, a pergunta some sozinha na maioria
dos casos.

## O pêndulo, e por que ele volta

Acho que o processamento local volta a crescer, e não por virtude. Ninguém adota arquitetura por ser bonita.

Volta por atrito. Enquanto o caminho "sobe para a nuvem de alguém" custar seis meses de revisão e o caminho
"roda no dispositivo" custar zero, o segundo vence pelo cansaço — mesmo entregando um pouco menos. É a
mesma força que fez o cache de borda existir, e depois a inferência na borda.

A diferença é que agora a coisa que a gente quer rodar perto do usuário é justamente a que mais assusta o
jurídico.

## O que eu construí com isso

Terminei escrevendo a ferramenta que eu queria ter.

O ClipContext é uma página que pega um vídeo e devolve um PDF com os quadros em que a tela **muda** —
encontrados por comparação de imagem, não de dez em dez segundos — cada um pareado com o que estava sendo
dito naquele trecho, com o instante marcado. É o formato que uma IA lê bem: imagem e fala juntas, na ordem.

Aquela hora de reunião sai em cerca de 60 imagens e 60 mil tokens, em vez de 3.600 e um milhão. As outras
3.540 eram repetição do mesmo slide.

E ele roda inteiro no navegador. Sem servidor, sem cadastro, sem upload. Não é um recurso de privacidade
colado depois: é a razão de ele não ter custo, e o motivo de eu poder deixá-lo gratuito. Código aberto sob
licença MIT, em clipcontext.app.

Não é a ferramenta que interessa neste texto. É a régua: **antes de escolher o provedor, pergunte se
precisa de provedor.**

---

*Opinião e projeto pessoais, sem relação com meu empregador.*

**As contas, para quem quiser conferir:** o amostragem de 1 quadro por segundo e os ~300 tokens por segundo
estão na documentação de vídeo da API do Gemini. Claude e ChatGPT continuam sem aceitar arquivo de vídeo. Os
60 quadros e 60 mil tokens são estimativa minha: 60 imagens de ~800 tokens mais ~12 mil de transcrição.

---
---

# Notas de produção

**A ordem importa.** Publique o post, depois o comentário com os links. Comentário do autor nos primeiros
minutos é normal e não penaliza; link no corpo do post reduz alcance de forma consistente.

**O post termina na ideia, não num pedido.** A última frase é *"antes de qual provedor eu contrato"* — é
onde a pessoa comenta. Terminar em "leia o artigo" transforma um post que se sustenta sozinho num anúncio.

**O artigo tem a seção "onde não serve" e o post não tem.** No feed não há espaço para nuance sem perder o
fio; no artigo, a nuance é o que separa análise de propaganda. Se alguém vier ao comentário dizer "mas e
quando o formato não abre?", a resposta já está escrita — e você responde com um link para a sua própria
seção, que é a melhor posição possível num debate.

**Nenhum número foi arredondado para cima.** Nesse público, alguém confere.

## Se quiser encurtar ainda mais o post

Corte o bloco das perguntas (de "para onde vai o arquivo" até "cada uma custa semanas") e emende direto na
conclusão. Vai para ~800 caracteres. Fica mais afiado e menos específico — troca autoridade por ritmo.

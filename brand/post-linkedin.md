# Post para o LinkedIn

Ângulo: a conta de contexto como porta de entrada para o argumento de privacidade.
Sem citar o empregador. Ferramenta só no fim, link no primeiro comentário.

Todos os números aqui são checáveis — as fontes estão no fim deste arquivo, caso alguém peça nos
comentários (e em post técnico, alguém pede).

---

## O post

> Uma hora de reunião gravada custa cerca de **1 milhão de tokens** no modelo que "assiste" vídeo.
>
> Não é força de expressão. O modelo que hoje aceita vídeo nativamente amostra um quadro por segundo,
> a ~300 tokens por segundo de vídeo. Uma hora são 3.600 imagens e mais de um milhão de tokens: enche a
> janela de contexto inteira e não sobra espaço para a conversa. E você repaga isso a cada pergunta.
>
> Mas esse nem é o problema mais caro.
>
> O mais caro é que, para o modelo assistir, o arquivo precisa sair da sua máquina.
>
> Quem trabalha em empresa com política séria de proteção de dados conhece a sequência: a área quer usar
> IA na gravação de uma reunião, o time de dados pergunta para onde o arquivo vai, quanto tempo fica lá,
> quem é o subprocessador, se aquilo treina modelo, e se existe DPA assinado. São perguntas corretas —
> e cada uma custa semanas.
>
> Trabalho há anos desenhando integrações em ambiente onde essas perguntas precisam de resposta antes de
> qualquer piloto. A conclusão que fui obrigado a tirar é chata e útil:
>
> **a arquitetura mais barata de aprovar é a que não gera a pergunta.**
>
> Dado que não sai do dispositivo não precisa de DPA. Não precisa de cláusula de transferência
> internacional. Não precisa de política de retenção, porque não há retenção. Não é um controle a mais —
> é a eliminação de uma categoria inteira de controle.
>
> E hoje isso é viável de um jeito que não era três anos atrás. O navegador ganhou WebGPU, WebAssembly
> com múltiplas linhas de execução e modelos de fala que cabem em 80 MB. Dá para transcrever uma reunião
> de uma hora sem que o áudio saia da máquina. A capacidade existe. O que falta é o hábito de perguntar
> *"isso precisa mesmo de servidor?"* antes de *"qual provedor eu contrato?"*.
>
> Acho que é para lá que o pêndulo está indo — e não por virtude. Por atrito: processamento local é o
> caminho que menos custa aprovar.
>
> Foi por isso que construí o ClipContext. Uma página que transforma vídeo em PDF com os frames em que a
> tela muda e a transcrição sincronizada, pronto para colar numa IA. Roda inteiro no navegador: sem
> servidor, sem cadastro, código aberto. Uma hora de vídeo sai em ~60 imagens e ~60 mil tokens, em vez de
> 3.600 e um milhão — porque as outras 3.540 eram repetição do mesmo slide.
>
> Link no primeiro comentário. É gratuito e vai continuar sendo: sem servidor, meu custo de te atender é
> praticamente zero.
>
> *Opinião e projeto pessoais, sem relação com meu empregador.*
>
> #LGPD #ProteçãoDeDados #InteligênciaArtificial #Arquitetura #Privacidade

---

## O primeiro comentário

> clipcontext.app — roda no navegador, código aberto sob licença MIT.
>
> Para quem quiser conferir a conta: a documentação do Gemini publica 1 quadro por segundo e ~300 tokens
> por segundo de vídeo em resolução padrão (100 em resolução baixa). Claude e ChatGPT continuam sem
> aceitar arquivo de vídeo.

---

## Por que está escrito assim

**A primeira linha é um número, não uma opinião.** O LinkedIn corta o texto em ~200 caracteres; o que
aparece antes do "ver mais" decide se alguém abre. "Uma hora de reunião custa 1 milhão de tokens" é
específico o suficiente para o leitor querer saber se é verdade.

**A privacidade entra pela porta do custo.** Post que abre com "privacidade importa" é lido como
conteúdo institucional e passa batido. Abrindo pela conta técnica, você chega ao mesmo lugar com o
leitor já engajado — e a virada ("mas esse nem é o problema mais caro") é o que segura até o fim.

**O link vai no comentário.** Link no corpo reduz alcance de forma consistente no LinkedIn. E a linha
"link no primeiro comentário" converte melhor do que parece, porque quem chega até ali já decidiu.

**A linha de isenção no fim é curta e sem drama.** Ela protege sem transformar o post num aviso legal.

**Nenhum número foi arredondado para cima.** Se alguém checar — e nesse público alguém checa —, tudo
bate. A credibilidade do post inteiro depende disso.

## Fontes dos números

- 1 quadro por segundo, ~300 tokens/segundo (100 em baixa), 1 h em janela de 1 M:
  https://ai.google.dev/gemini-api/docs/video-understanding
- Claude e ChatGPT não aceitam arquivo de vídeo:
  https://onefileapp.com/blog/ai-file-upload-limits-compared
- ~60 imagens e ~60 mil tokens: estimativa própria, com a conta aberta em `ONDE-ESTAMOS.md` §2
  (60 frames × ~800 tokens de imagem + ~12 mil de transcrição).
- Modelo de 80 MB: o `whisper-base` quantizado que o ClipContext usa por padrão pesa 77 MB.

## Se quiser variações

- **Mais curto** (para quem posta com frequência): cortar do "E hoje isso é viável" ao "qual provedor eu
  contrato?" e emendar direto no pêndulo. Perde a parte técnica e ganha ritmo.
- **Sem a ferramenta**: cortar os dois últimos parágrafos antes da isenção. Vira post de opinião pura —
  constrói reputação, não tráfego.
- **Em inglês**: a mesma estrutura funciona, mas trocaria "DPA" por "DPA/SCCs" e citaria GDPR junto com
  LGPD.

# Material de divulgação — ClipContext

Textos prontos para o lançamento. Ajuste o que soar diferente da sua voz: o conteúdo importa mais
que a forma, mas a forma é sua.

---

## Posicionamento em uma frase

> O ClipContext transforma um vídeo no formato que a IA consegue ler: os frames que importam e a
> transcrição sincronizada, num PDF único — sem upload, direto no navegador.

**O que evitar dizer:** "extrator de frames" ou "conversor de vídeo para PDF". Existem dezenas de
ferramentas gratuitas nessas categorias e você vira mais uma. O produto não é a extração, é o preparo
do contexto.

---

## Post de anúncio (blog / LinkedIn)

**Título:** Fiz uma ferramenta porque cansei de explicar vídeo para a IA na mão

Precisei analisar uma gravação de 300 MB com o Claude e esbarrei no óbvio: modelos de linguagem não
assistem vídeo. Ou o arquivo é grande demais, ou simplesmente não é lido.

A saída manual é tirar prints e colar a transcrição. Funciona mal. Você acaba mandando dez telas quase
idênticas, esquece justamente o momento que interessava, e o modelo não tem como saber o que estava
sendo dito quando aquela imagem apareceu.

Então montei o ClipContext. Ele varre o vídeo, guarda só os momentos em que a imagem realmente muda,
pega a transcrição e monta um PDF onde cada frame vem junto do que é falado naquele trecho, com o
instante marcado. No fim, entrega também o prompt que explica ao modelo como ler aquele documento.

Duas decisões que valem explicar:

**Nada sai do seu computador.** Não existe servidor. O vídeo é lido pelo navegador, processado ali, e
o PDF é gerado ali. Não é promessa de política de privacidade — é ausência de infraestrutura. Efeito
colateral: não há limite de tamanho de arquivo, porque não há upload.

**Frames por mudança de cena, não por intervalo fixo.** Capturar de dez em dez segundos numa
apresentação gera quarenta imagens do mesmo slide. Detectar a troca gera uma por tela. A diferença na
qualidade da resposta da IA é grande.

É gratuito e o código é aberto. Se for útil para você, é só abrir e usar.

🔗 clipcontext.app

---

## Versão curta (X / Twitter)

> Modelos de linguagem não assistem vídeo.
>
> Fiz o ClipContext: ele pega seu vídeo, guarda só os frames onde a imagem muda, pareia cada um com a
> fala daquele trecho, e monta um PDF pronto para anexar no Claude ou no ChatGPT.
>
> Roda no navegador. Nada sai da sua máquina. Grátis e aberto.

## Versão curta (Instagram / Threads)

> Cansei de tirar print de vídeo pra explicar as coisas pra IA.
>
> Fiz uma ferramenta que faz isso sozinha: acha os momentos em que a tela muda, junta com o que está
> sendo falado em cada um, e monta um PDF pronto pra jogar na conversa.
>
> Abre no navegador, não instala nada, e o vídeo não sai do seu computador. É grátis.
>
> Link na bio 🔗

---

## Descrição para diretórios de ferramentas

**Curta (até 100 caracteres)**
> Transforme vídeo em PDF com frames e transcrição, pronto para a IA ler. No navegador, sem upload.

**Média (até 300 caracteres)**
> Modelos de linguagem não assistem vídeo. O ClipContext extrai os frames em que a imagem muda,
> sincroniza cada um com a fala daquele trecho e monta um PDF pronto para anexar no ChatGPT, Claude ou
> Gemini. Roda inteiro no navegador: nada é enviado para servidor, sem limite de tamanho.

**Categorias sugeridas:** ferramentas de IA, produtividade, vídeo, privacidade, código aberto

**Onde publicar:** Product Hunt, Hacker News (Show HN), r/ChatGPT, r/ClaudeAI, r/LocalLLaMA
(o argumento de rodar local pega bem lá), comunidades brasileiras de IA no Discord e no LinkedIn.

---

## Show HN

**Título:** Show HN: ClipContext – Turn a video into frames + synced transcript for LLMs, in-browser

**Primeiro comentário:**
> I kept hitting the same wall: LLMs don't watch video. Manual screenshots are worse than they sound —
> you end up with ten near-identical frames and none of the moment that mattered, plus no link between
> what's on screen and what was being said.
>
> ClipContext scans the video, keeps only frames where the image actually changes, pairs each one with
> the speech from that interval, and outputs a single PDF. It also generates the prompt that tells the
> model how the document is structured.
>
> Everything runs in the browser — no server, so no upload limit and nothing leaves your machine.
> Transcription is Whisper via WebGPU, or you can drop in an existing .vtt/.srt.
>
> One thing that surprised me while building it: comparing frames in grayscale silently fails. Pure
> red and mid green have almost identical luminance, so a scene cut between them goes undetected. The
> signature has to keep the three color channels separate.
>
> MIT licensed. Happy to answer questions.

---

## Palavras-chave a perseguir

O tráfego mais qualificado vem de quem já está com o problema na mão. Esses termos têm intenção clara:

| Termo | Por quê |
|---|---|
| como fazer o ChatGPT analisar um vídeo | intenção direta, alto volume |
| Claude analisar vídeo | público já usa IA paga |
| resumir vídeo com IA | mais amplo, competitivo |
| transcrever vídeo sem enviar para servidor | intenção de privacidade, pouca concorrência |
| extrair frames de vídeo online | alto volume, muito concorrido |
| how to make ChatGPT watch a video | mercado maior, em inglês |
| video to PDF for AI | termo do nicho, quase sem concorrência |

**Estratégia:** os termos genéricos de extração de frames já têm dezenas de sites gratuitos brigando.
O caminho é dominar os termos de nicho, que são específicos e ainda estão vazios — e para isso a
landing page precisa falar a língua de quem busca. Um artigo respondendo "como fazer a IA analisar um
vídeo" com o passo a passo completo, honesto sobre as limitações, vale mais que dez posts genéricos.

---

## O que não prometer

Manter a credibilidade importa mais que converter rápido. Não diga:

- que a IA vai "assistir" ao vídeo — ela lê amostras, e isso deve ficar explícito
- que a transcrição é perfeita — o Whisper erra, principalmente em português com áudio ruim
- que funciona com qualquer formato — HEVC e alguns MKV não abrem no navegador
- que substitui assistir ao vídeo em decisões sérias

Todas essas limitações já estão declaradas no site e nos termos. Manter o discurso alinhado com o
produto é o que evita a primeira avaliação negativa.

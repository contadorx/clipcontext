# Onde estamos e quanto vale a proposta

Análise escrita em 14/08/2026. Fatos de mercado checados na data; preços e limites de fornecedor mudam,
confira antes de decidir com base neles.

---

## O veredito, em um parágrafo

O produto está **bem construído e mal distribuído**. A engenharia está num nível que a maioria dos
concorrentes pagos não tem — varredura por mudança de cena com bisseção, dois canais de áudio
separados, quatro formatos de saída, tudo sem servidor. Mas a proposta que está escrita na landing
(*"o ChatGPT e o Claude não assistem vídeo"*) é uma verdade com **data de validade**, e o produto não
tem **nenhuma medição**: 0 estrelas no GitHub, nenhuma analytics na página, nenhuma lista de espera.
Hoje não dá para responder "quão atrativa é a proposta" com dados — só com raciocínio. O maior risco
não é o Gemini nem o ScreenApp. É continuar melhorando um produto sem saber se alguém abriu.

---

## 1. A premissa: os modelos já assistem vídeo?

Era a pergunta que decidia tudo, porque a landing se apoia nela. Checado agora:

| | aceita arquivo de vídeo? | como |
|---|---|---|
| **Claude** | **não** | vídeo não está entre os formatos aceitos |
| **ChatGPT** | **na prática, não** | há upload em alguns contextos, mas é inconsistente por plano/plataforma, faz análise superficial de clipe curto e não produz transcrição confiável |
| **Gemini** | **sim** | 5 min no grátis; 1 h no Advanced, até 2 GB. Via API: 1 h em resolução padrão, 3 h em baixa |

**A frase da landing continua verdadeira para dois dos três — e é falsa para o terceiro.**

Isso é menos confortável do que parece. O Gemini não é um detalhe: é o modelo com a maior janela e a
maior distribuição gratuita, e o NotebookLM já engole YouTube direto. A frase *"os modelos não assistem
vídeo"* provavelmente vira falsa para todos dentro de um ou dois ciclos de modelo. **Uma proposta que
depende de uma limitação dos outros é uma proposta que expira.**

## 2. O reenquadramento que sobrevive ao Gemini

O Gemini assistir vídeo não mata o ClipContext — **muda o argumento de "ele não consegue" para "ele
consegue mal e caro"**. E esse argumento é melhor, porque não expira.

O Gemini amostra vídeo a **1 quadro por segundo, às cegas**, e cobra ~300 tokens por segundo de vídeo
(100 em baixa resolução). Faça a conta para uma aula de uma hora:

| | quadros | tokens | cabe? |
|---|---|---|---|
| Gemini, resolução padrão | 3.600 | ~1.080.000 | **não** — estoura a janela de 1 M |
| Gemini, resolução baixa | 3.600 | ~360.000 | cabe, e sobra pouco |
| **PDF do ClipContext** | ~60 (só as trocas de tela) | **~60.000** | cabe em qualquer modelo |

*(60 frames × ~800 tokens por imagem + ~12.000 tokens de transcrição. Estimativa — a aritmética está
aqui para você contestar.)*

São **6× a 18× menos contexto para a mesma aula**, e você repaga esse contexto a cada pergunta nova.
Mais importante que o custo: dos 3.600 quadros do Gemini, uns 3.540 são repetição do slide anterior.
Os 60 do ClipContext são **exatamente as transições**, encontradas com precisão de meio segundo pela
bisseção. Não é a mesma informação comprimida — é informação melhor, menor.

**O ClipContext não é um contorno para uma limitação. É um compressor.** Essa é a frase que eu colocaria
na landing no lugar da atual, porque continua verdadeira no dia em que todo modelo assistir vídeo.

## 3. Quem mais faz exatamente isso

A categoria não está vazia. Buscando por "video to PDF" aparecem, na primeira página:

| | o que entrega | preço | onde processa |
|---|---|---|---|
| **ScreenApp** | frames + transcrição com locutores + timestamps clicáveis, em PDF | 1 conversão grátis, depois **US$ 19/mês** | servidor (SOC 2, apaga em 24 h) |
| **Vizle (govizle)** | frames + fala em PDF ou PPT | freemium, limite de slides | servidor, até 512 MB |
| **Musely, HintoAI, iMZi** | variações de YouTube → PDF | freemium | servidor |

Duas leituras opostas, e as duas são verdadeiras:

**A ruim:** você não é o primeiro, eles têm SEO na frente, e todos aceitam **link do YouTube** — que é
exatamente onde está o volume de busca. Ninguém pesquisa "vídeo em contexto para IA". Pesquisam
"youtube transcript" (saturado) e "video to pdf" (ocupado por eles). Você decidiu não fazer YouTube por
razões técnicas boas, e o preço dessa decisão é ficar fora da consulta que traz gente.

**A boa, e maior:** o ScreenApp cobra **US$ 19/mês pela mesma saída que você dá de graça, com pior
privacidade**. Isso é a evidência mais valiosa desta análise inteira — **existe disposição a pagar por
esse artefato**. A pergunta deixou de ser "alguém quer isso?" e passou a ser "por que ninguém sabe que
existe uma versão gratuita e privada?".

## 4. Onde estamos de verdade

Aqui está a parte desconfortável, e é a que mais importa:

- **0 estrelas, 0 forks, 0 watchers** no repositório, com 21 commits.
- **Nenhuma analytics na página.** Nenhum script, nenhum contador, nada. Não sabemos quantas pessoas
  abriram, quantas chegaram a gerar um PDF, nem em que passo desistem.
- **Nenhuma captura de interesse.** A página de preços diz, textualmente, que seria incoerente montar
  um formulário de e-mail numa ferramenta que não coleta nada.

Sobre esse último ponto eu discordo, com respeito ao princípio. A promessa do ClipContext é **"seu vídeo
não sai da sua máquina"** — não é "nunca teremos o seu e-mail". Um campo opcional, com uma frase honesta
("só para avisar do lançamento; nada a ver com seus vídeos, que continuam sem sair daí"), não fere a
promessa. **Fere a promessa não ter como falar com as poucas pessoas que gostaram.** Coerência levada
até esse ponto vira autossabotagem.

O mesmo vale para medição: existe analytics sem cookie e sem identificador persistente (a da própria
Vercel, ou Plausible). Dá para instalar, **declarar na página de privacidade em uma linha**, e passar a
saber se o problema é ninguém chegar ou ninguém converter. São problemas opostos e você não sabe qual
tem.

## 5. A força da proposta, ranqueada com honestidade

| diferencial | força hoje | daqui a 2 anos |
|---|---|---|
| **Nada sai da máquina** | **alta** — nenhum concorrente pode copiar sem jogar fora o próprio modelo de negócio | **alta**, e crescendo com a preocupação de conformidade |
| **Compressão: 60 frames certos em vez de 3.600** | média — real, mas ninguém sabe que tem esse problema | **alta**, quando o custo de contexto virar dor consciente |
| **Grátis e sem cadastro** | **alta** para adoção | alta para adoção, **zero** para receita |
| "Os modelos não assistem vídeo" | média | **expira** |
| Frame pareado com fala, prompt junto | média — é qualidade, e qualidade não se vê antes de usar | média |
| Quatro saídas, build offline, MIT | baixa como atração, alta como retenção | baixa/média |

E as fraquezas, sem maquiagem:

- **A primeira transcrição baixa 77 a 206 MB de modelo** e roda no processador do usuário. É o maior
  ponto de abandono do funil, e você não está medindo ele.
- **Não existe história em celular.** Whisper no navegador do telefone não acontece.
- **Sem entrada de YouTube**, que é onde está a busca.
- **Exige que a pessoa já saiba que tem esse problema.** Ninguém acorda querendo "contexto para IA".
  Acorda querendo "resumir essa reunião de 2 horas".

## 6. Para quem essa proposta é irresistível

Ela não é atrativa em geral. É **muito** atrativa para três grupos específicos, e indiferente para o resto:

1. **Quem tem gravação que não pode subir.** Reunião com cliente, consulta, aula com aluno
   identificável, gravação de sistema interno. Para essa pessoa, ScreenApp e Vizle **não são opções** —
   não é preferência, é impedimento. Aqui o ClipContext não tem concorrente.
2. **Quem tem vídeo grande.** Vizle para em 512 MB. Você não tem limite porque nada é enviado. Uma
   gravação de 3 GB de um treinamento de 4 horas é um caso em que só você resolve.
3. **Quem paga contexto.** Quem usa API e vai anexar isso num agente sente os 18× no boleto.

O grupo 1 é o mais valioso e é onde eu apontaria tudo — inclusive porque é o único que tem **orçamento
corporativo** e para quem "nada sai da máquina" é linha de conformidade, não gentileza.

## 7. A contradição do negócio, e por onde eu sairia dela

Está tudo em `ARQUITETURA-PAGO.md` e a arquitetura é sólida. Meu desacordo é estratégico, não técnico:
**o plano Pro com servidor entrega o único diferencial estrutural que você tem** (não ter servidor) para
ir competir com o ScreenApp no terreno dele, onde ele tem dois anos e SEO de vantagem. Converter HEVC é
uma dor real, mas é uma dor de *commodity*.

Em ordem de aposta, do que eu faria primeiro:

1. **Licença corporativa do build offline.** O arquivo único autocontido já existe. Empresa com rede
   fechada e gravação confidencial compra isso por assento ou por implantação, e o custo marginal
   continua zero. Preserva a promessa inteira em vez de furá-la, e fala com o grupo 1.
2. **MCP local.** `npx clipcontext-mcp` — o agente do usuário chama a ferramenta na máquina dele.
   O mercado de 2026 quer isso, ninguém entrega vídeo→contexto por MCP local, e continua sem servidor.
   Monetizar código MIT é difícil; o caminho é serviço e suporte em cima, não trava.
3. **Servidor pago (o plano atual).** Faria por último, e só depois de ter as pessoas do item 1
   pedindo. Se entrar, entra com o texto do item 5.1 do `ARQUITETURA-PAGO.md` na frente e em destaque.

## 8. O que eu faria nas próximas duas semanas

Nada disso é código novo, e é por isso que está aqui.

| | o quê | por quê | estado |
|---|---|---|---|
| 1 | Analytics sem cookie + a política de privacidade atualizada | é impossível decidir qualquer coisa acima sem saber se o problema é tráfego ou conversão | **feito** em 14/08 — ver `MEDICAO.md` |
| 2 | Três eventos: *abriu*, *carregou vídeo*, *baixou saída* | dá a taxa de conclusão, que é o número que diz se o produto funciona | **feito**, com origem e formato junto |
| 3 | Um campo de e-mail opcional, com a frase honesta | é a única forma de falar com quem gostou | **feito**, nos três idiomas |
| 4 | Trocar a manchete de "os modelos não assistem vídeo" para o argumento do compressor | a atual expira e a nova não | **feito**, nos três idiomas |
| 5 | Falar com 10 pessoas do grupo 1 | vale mais que qualquer coisa nesta análise, inclusive esta análise | é com você |

O item 5 é o único que responde de verdade a "quão atrativa é a proposta". Os quatro primeiros existiam
só para tornar o item 5 possível — e agora existem.

Dois passos de painel que sobraram, porque não são código: **habilitar Web Analytics no painel da
Vercel**, e conferir o CORS em produção com a linha de console que está no fim do `MEDICAO.md`.

---

## Fontes

- Limites de upload comparados (Claude, ChatGPT, Gemini), 2026 — https://onefileapp.com/blog/ai-file-upload-limits-compared
- Gemini API, compreensão de vídeo (1 fps, ~300 tokens/s, limites de duração) — https://ai.google.dev/gemini-api/docs/video-understanding
- Estado do upload de vídeo no ChatGPT em 2026 — https://blog.videototextai.com/posts/2026-05-16-chatgpt-upload-video-feature-2026-how-it-works-limits-fixes-and-the-reliable-no-upload-workflow
- ScreenApp, vídeo → PDF (preço e processamento em servidor) — https://screenapp.io/features/convert-video-to-pdf
- Vizle, vídeo → PDF (limite de 512 MB) — https://govizle.com/video-to-pdf/
- Retenção e treino de dados no Gemini (grátis vs. pago) — https://meetily.ai/llm-privacy/gemini

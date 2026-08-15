# Onde publicar

Escrito em 14/08/2026. Regras de comunidade mudam — confira a do lugar antes de postar, principalmente
onde o custo de errar é banimento.

---

## A coisa mais importante deste documento

**Você tem dois públicos, e eles não se sobrepõem.**

| | quem é | qual história funciona | o que você ganha |
|---|---|---|---|
| **Construtores** | dev, gente de IA local, entusiasta de privacidade | a engenharia: varredura por bisseção, Whisper no navegador, ZIP e OOXML na mão | estrela, defeito reportado, credibilidade, pico de tráfego |
| **Compradores** | quem tem gravação que **não pode subir**: advogado, contador, professor, consultor, DPO | a dor: "a área quer usar IA na reunião e o jurídico barra" | as 10 conversas que respondem se a proposta é atrativa |

O erro mais comum — e mais caro — é publicar só para o primeiro grupo, ver os números subirem e concluir
que o produto foi validado. Construtor elogia arquitetura e não volta. **Ele não é o grupo 1 da análise.**

Publique nos dois. Mas saiba qual pergunta cada um responde.

---

## Ordem, antes de canal

Três coisas antes de qualquer publicação, porque duas delas são de uma bala só:

1. **Deploy.** Nada do que fizemos esta semana está no ar.
2. **Web Analytics habilitado** e o CORS conferido. Publicar antes disso é jogar fora o dado do único dia
   em que haverá tráfego — e o dia do pico é o único que ensina alguma coisa.
3. **Um vídeo de 30 segundos** do fluxo funcionando. Metade dos canais abaixo converte pelo GIF, não pelo
   texto. O `brand/gerar/tour.mjs` já produz isso.

Só então o primeiro post. E comece pelo canal **mais barato de errar**, não pelo maior.

---

## Os canais, em ordem de retorno

### 1. Show HN — o melhor encaixe que você tem, e só dá para usar uma vez

O ClipContext atende os critérios do Show HN quase ponto a ponto: é coisa que a pessoa **roda na hora**,
**sem cadastro e sem e-mail**, tem trabalho não trivial por trás, e você pode discutir cada decisão. As
regras dizem literalmente *"make it easy for users to try your thing out, ideally without barriers such as
signups or emails"* — é a descrição do produto.

- **Título:** começa com `Show HN:`. Sem hipérbole, sem "revolucionário". Algo como
  *"Show HN: Vídeo → PDF com frames de mudança de cena e transcrição, tudo no navegador"* (em inglês).
- **Primeiro comentário seu**, logo depois: por que existe, como funciona a varredura, o que **não** faz.
  Esse comentário costuma valer mais que o título.
- **Fique disponível por 6 a 8 horas.** Não responder é o que mata um Show HN bom.
- **Não peça upvote a ninguém.** É a única coisa que gera punição de verdade.
- O que **não** entra: post de blog, landing, newsletter. Submeta a ferramenta, não o artigo.

**Custo de errar: alto.** Show HN morno não se repete com o mesmo projeto. Por isso é o item 1 em retorno e
o último em ordem cronológica: faça depois de o produto estar medido e de você já ter apanhado num canal
menor.

### 2. r/LocalLLaMA — o público mais alinhado do Reddit

~300 mil pessoas que rodam modelo na própria máquina por convicção. Whisper no navegador com WebGPU é
exatamente o assunto delas.

- **Autopromoção é tolerada e policiada.** A regra prática: enquadre como lição, não como anúncio. Poste
  *"o que aprendi rodando Whisper no navegador com WebGPU"* e a ferramenta aparece como contexto.
- **Participe uma ou duas semanas antes.** Conta nova que chega lançando é removida.
- Sem link no título. Responda os comentários de verdade.
- Bom material daqui: a queda do q4 na GPU que só aparece na primeira inferência, o degrau para o
  processador, as linhas do WASM. Isso é ouro nessa comunidade e você já escreveu em `DESEMPENHO.md`.

**Vizinhos que valem:** r/selfhosted (mesma lógica), r/privacy e r/PrivacyGuides (mais rígidos com
promoção — leia as regras), r/opensource.

### 3. TabNews — o canal brasileiro de menor atrito

Comunidade de tecnologia em português. As regras permitem divulgar projeto seu **desde que haja valor
técnico concreto**: detalhes, decisões, o que deu errado. Post puramente comercial é proibido; se for
pitch mesmo, o próprio site pede o prefixo `Pitch:` no título.

É o melhor lugar para **apanhar barato antes do Show HN**. Público menor, mais gentil, e em português.
Leve o mesmo conteúdo do artigo do LinkedIn com mais código.

### 4. LinkedIn — o único que fala com quem paga

Você já tem o post e o artigo. O que falta é o que vem **depois** do post:

- **Mensagem direta para 10 pessoas** do grupo 1 na sua rede. Não "dá uma olhada no meu projeto", e sim
  *"você grava reunião com cliente? como resolve a transcrição hoje?"*. A resposta vale mais que 500
  curtidas.
- **Comentar em post dos outros** sobre LGPD e IA, com substância, sem link. É o que faz o seu próximo
  post alcançar.

### 5. Comunidades de privacidade no Brasil — o público comprador, sem ruído

Aqui está o grupo 1 concentrado, e quase ninguém do seu ramo está falando com ele sobre ferramenta:

- **APDADOS** — Associação Nacional dos Profissionais de Privacidade de Dados.
- **AllPrivacy** — comunidade gratuita de profissionais de privacidade e LGPD.
- **DPOday** — o maior evento de privacidade do país. Palestra ou mesmo presença vale mais que dez posts.

O argumento aqui **não é a ferramenta**. É o princípio: *dado que não sai do dispositivo elimina uma
categoria inteira de controle*. Esse público entende isso instantaneamente e é o único que consegue
transformar em orçamento.

### 6. GitHub — barato, permanente, e você está deixando na mesa

O repositório tem 0 estrelas e 21 commits. Antes de mandar gente para lá:

- **Topics**: `whisper`, `webgpu`, `privacy`, `local-first`, `transformers-js`, `video`, `ocr`, `pdf`.
  É assim que se é encontrado na busca do GitHub.
- **README com o GIF logo no topo.** Hoje ele explica; precisa mostrar.
- **Pull request para listas "awesome"**: local-first, privacy tools, whisper, browser AI. Uma linha por
  lista, aceita ou não, e vale por anos.

### 7. dev.to e Medium — reaproveitamento quase sem custo

Republique o artigo do LinkedIn com `canonical` apontando para o original. Meia hora de trabalho, tráfego
modesto e permanente. Não invente conteúdo novo para eles.

### 8. Hugging Face — um Space estático

Dá para publicar a página como Space com SDK estático. Chega a um público de IA que não lê Reddit, e a
associação com transformers.js é natural. Baixo esforço, retorno incerto — faça depois dos anteriores.

---

## O que eu **não** faria agora

**Product Hunt.** Os números honestos: 50 a 120 horas de preparo, pico de um dia só, e os links levam
`rel="ugc"` — ou seja, **zero valor de SEO**. Funciona para quem já tem audiência para aquecer antes do
lançamento. Você ainda não tem. Guarde para quando o plano pago existir e houver o que converter.

**Diretórios de lançamento em massa.** Aqueles "poste em 100 sites". Tráfego de bot e nenhuma conversa.

**Grupos de WhatsApp de divulgação mútua.** Todo mundo publica, ninguém lê.

**Anúncio pago.** Antes de saber a taxa de conclusão, pagar por visita é pagar para descobrir que o funil
vaza no meio.

---

## O canal que eu não tinha visto: páginas de comparação de privacidade

Descobri isto por acidente, pesquisando para a análise: o **Meetily** mantém uma série de páginas do tipo
`meetily.ai/llm-privacy/gemini` — uma por modelo, dissecando a política de dados de cada um (treina com
seu conteúdo? no plano gratuito ou no pago? quanto tempo retém? tem revisão humana?).

Eu cheguei nelas buscando *"Gemini free tier data used to improve Google products"*. Ou seja: **elas
capturam exatamente a pessoa que está com a dúvida certa, no momento certo, sem falar de produto.**

Isso é o melhor canal desta lista inteira para o seu grupo 1, e é o único que trabalha enquanto você
dorme:

- Uma página por pergunta que o comprador realmente digita: *"o ChatGPT treina com meus arquivos?"*,
  *"posso subir gravação de reunião com cliente para a nuvem?"*, *"transcrição de reunião e LGPD"*,
  *"o Gemini assiste vídeo?"*.
- Escritas para **responder**, não para vender. O produto aparece no fim, como consequência.
- Em **português**, que é onde há muito menos concorrência do que em inglês — e onde está o público que
  entende "LGPD" sem tradução.

Você já tem a matéria-prima: o `ONDE-ESTAMOS.md` tem a tabela de quem aceita vídeo, e a nova política de
privacidade tem as bases legais escritas em português claro. Faltam as páginas.

**Custo:** algumas horas por página, e elas ficam. Comparado ao Product Hunt (50 a 120 horas por um pico
de um dia), não há disputa.

---

## Um conteúdo, sete cortes

Não escreva sete vezes. Você já tem o material; cada canal quer um corte diferente:

| corte | de onde sai | vai para |
|---|---|---|
| A conta dos 3.600 quadros | artigo, seção 1 | LinkedIn, TabNews |
| O degrau do q4 que só quebra na inferência | `DESEMPENHO.md` | r/LocalLLaMA, HN |
| Varredura grossa + bisseção, 5,2× menos seeks | `DESEMPENHO.md` | HN, dev.to |
| "Onde o processamento local não serve" | artigo, seção 6 | qualquer lugar onde acusarem viés |
| A ordem dos elementos em `w:rPr` que o Word recusa | `PARA-O-SALAVOX.md` | dev.to, TabNews — post pequeno e muito útil |
| Paleta que reprovava no WCAG havia meses | `PARA-O-SALAVOX.md` | comunidades de design/front |
| "Dado que não sai do dispositivo não precisa de DPA" | artigo, seção 3 | APDADOS, AllPrivacy, LinkedIn |

O quinto item merece atenção: *"escrevi .docx na mão e o Word recusava o arquivo por causa da ordem de dois
elementos"* é o tipo de post que resolve o problema de alguém no Google por cinco anos. Custa uma hora e
não fala do seu produto — e é justamente por isso que funciona.

---

## Um calendário defensável

| semana | o quê |
|---|---|
| 0 | Deploy, analytics ligada, GIF pronto, README com o GIF, topics no GitHub |
| 1 | LinkedIn (post + artigo + comentário). DMs para 10 pessoas do grupo 1 |
| 2 | TabNews com o corte técnico. Começar a participar do r/LocalLLaMA sem postar nada |
| 3 | r/LocalLLaMA enquadrado como lição. dev.to com o post do `w:rPr` |
| 4 | **Show HN** — com o produto já apanhado, medido e corrigido |
| depois | APDADOS/AllPrivacy, Hugging Face, PRs para listas awesome |

A semana 4 é o clímax de propósito. Show HN com um produto que já sobreviveu a três públicos menores é
uma coisa; Show HN com um produto que ninguém nunca usou é outra bem diferente.

---

## Fontes

- Regras do Show HN — https://news.ycombinator.com/showhn.html
- Regras práticas de autopromoção no r/LocalLLaMA — https://www.launchwake.com/channels/r-localllama
- FAQ do TabNews (divulgação de projeto, prefixo `Pitch:`) — https://www.tabnews.com.br/faq
- Product Hunt em 2026, avaliação honesta — https://www.puthusu.com/blog/is-product-hunt-worth-it
- APDADOS — https://apdados.org/
- AllPrivacy — https://dponet.com.br/blog/allprivacy-comunidade-privacidade-dados-lgpd-dponet/
- DPOday 2026 — https://dponet.com.br/blog/dpoday-2026-evento-privacidade-protecao-de-dados/

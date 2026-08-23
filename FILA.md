# A fila — builds, decisões e sequência

**Aberta em:** 23/08/2026
**Substitui, como ordem de execução:** `ALTERACOES.md` (119 itens), o backlog
consolidado de 22/08 (108 itens) e a seção "ordem" do `SEQUENCIA-DE-BUILDS.md`.
Aqueles três continuam valendo como **catálogo** — é lá que mora a descrição de
cada item. Aqui mora a **ordem**, e só ela.

**Medida contra:** a árvore de 22/08 que está publicada na Vercel, e o banco de
produção `kjlnyyblhanficgpends`, consultado ao vivo em 23/08.

---

## As regras que produziram esta ordem

Você deu três, e elas mandam mais que a gravidade dos documentos:

1. **Impedimento primeiro.** O que impede *trabalhar* vem antes do que impede
   *vender*. Uma régua que não roda fora de uma máquina custa mais que uma
   frase errada, porque a frase errada é achável e a régua quebrada esconde as
   próximas.
2. **Depois o fácil.** Entre dois itens do mesmo peso, ganha o de menor esforço
   e menor risco de mexer. Uma tarde com dez itens fechados vale mais que uma
   semana com um.
3. **Pagamento no fim, ou sob demanda. Drive no fim.** Nenhum build de 1 a 9
   depende de tocar na Stripe ou no Google. Onde a Stripe aparece antes
   (Build 6), é **leitura** do que ela já manda — não é reconectar nada.

E uma quarta, que é minha e eu justifico: **decisão sua não bloqueia build.**
Toda decisão da seção seguinte tem um caminho padrão que eu sigo se você não
responder. Onde o padrão é "não fazer", eu não faço e digo. Onde o padrão é
reversível, eu faço e digo. Nenhum build fica parado esperando.

---

## Onde estamos hoje — medido, não lembrado

| | |
|---|---|
| Repositório interno | estava em `7c90a97` (19/08); **sincronizado hoje** com a árvore de 22/08 |
| Migrações no banco | 44 aplicadas · repositório tinha as 44 · **duas novas aplicadas hoje** |
| `build.py` | roda, sai 0, gera `app.html` (1,3 MB) e o offline (1,66 MB) |
| `next build` | roda, sai 0 |
| Regressão | roda **nesta máquina agora** — ver "o que foi destravado" |

### O que foi destravado hoje, e que não estava na lista

A suíte não rodava fora da máquina de origem por **três motivos**, e nenhum
deles é código do produto:

- `testes/amostras.py` precisa de Pillow e de um `ffmpeg` com o demuxer
  `image2`. O `ffmpeg` que vem com o Playwright **não tem** `image2` — só
  `image2pipe` — e falha com "No such file or directory", que lê como arquivo
  faltando e não como demuxer faltando. Sete testes caíam com
  `ENOENT /tmp/amostra.webm` e o diagnóstico honesto era indistinguível de "o
  produto quebrou".
- `testes/_medir.mjs`, `_pdf.mjs` e `_pip.mjs` ainda carregam
  `RAIZ='/root/walkstamp'` escrito à mão. Os outros 140 já derivam de
  `_caminhos.mjs`; estes três ficaram para trás.
- Sem isso, `rodar.sh` termina imprimindo os que falharam e **sai zero**. Uma
  esteira que sempre acaba em verde ensina a não olhar.

Os dois primeiros estão resolvidos neste build. O terceiro também.

---

# Parte 1 — As decisões

Uma por vez. Cada uma tem os caminhos, o que se ganha e o que se perde em cada
um, a minha indicação e — o que importa mais — **o que eu faço se você não
responder**.

---

### DEC-1 — Qual é a promessa oficial de residência de dados

Tudo depende desta. Copy, teste, integração e termos se contradizem hoje porque
ninguém escreveu a frase verdadeira uma vez só.

**Caminho A — "nada do seu conteúdo sai sem um gesto seu", com a matriz de
exceções nomeada no mesmo bloco.**
As exceções seriam: Google Docs, anexo `.json` do roteiro, convite, conta,
cobrança, suporte, telemetria, download do modelo de voz, jsPDF e OCR.

- **Pró:** é verdade hoje, ou fica verdade só com correção de texto. Preserva
  todas as funções que já existem e já vendem. Numa avaliação de fornecedor,
  uma exceção nomeada vale mais que um absoluto que o F12 do navegador desmente
  em dez segundos.
- **Contra:** a frase fica mais longa. Perde-se o slogan curto. Exige disclosure
  progressivo para não virar parágrafo jurídico no meio da home.

**Caminho B — "zero egressão literal": nem dependência, nem telemetria, nem
destino voluntário.**

- **Pró:** slogan imbatível. Resposta única e curta no questionário de
  fornecedor.
- **Contra:** exige embutir Transformers, ONNX Runtime, Tesseract e jsPDF no
  artefato — de 1,7 MB para centenas de MB —, matar Google Docs e o anexo do
  roteiro, e **ainda assim** o modelo de voz precisa descer uma vez. É um
  produto diferente, não uma correção do atual.

> **Minha indicação: A para o produto hospedado; B só para o artefato offline.**
> O offline já é vendido como B — e hoje **não é**: medido, ele chama
> `cdn.jsdelivr.net` 1,7 s depois de abrir, sem gesto nenhum. Lá a escolha não é
> entre A e B; é entre cumprir B e parar de dizer B.
>
> **Se você não responder:** sigo A. É a única que não me obriga a remover
> função que já está vendida.

---

### DEC-2 — A calculadora de ROI da página de preços

Ela é o argumento de tempo inteiro, em forma de widget — 30 das 75 ocorrências
de "tempo" na página.

**Caminho A — trocar a pergunta.** De "quantos minutos por caso" para "quanto
custa uma evidência recusada": quantos casos voltam por prova insuficiente ×
horas para refazer.
**Caminho B — manter, e só matar a comparação com o preço.**
**Caminho C — remover.**

- **Pró A:** o instrumento passa a medir o que o produto entrega — prova aceita
  —, e não minutos. **Contra A:** 1 dia, e o número fica menos imediato.
- **Pró B:** 2 h. **Contra B:** continua ensinando o leitor a avaliar o produto
  por minutos. Hoje, quem digita "2 minutos por caso" recebe da própria régua a
  informação de que o Personal não se paga.
- **Pró C:** risco zero. **Contra C:** a página fica sem instrumento nenhum.

> **Minha indicação: A.** É o item que decide o posicionamento inteiro, e B é
> paliativo que deixa o defeito de pé.
>
> **Se você não responder:** faço **B** no Build 8 — porque é reversível e
> impede o pior caso (a régua argumentando contra a compra) — e deixo A escrito
> e pronto para você aprovar.

---

### DEC-3 — O h1 da home

Hoje ele fala com quem executa, no imperativo. "Auditoria" aparece 2× na home e
nenhuma vez perto de um botão.

**Caminho A — trocar o h1** para falar com quem cobra a evidência.
**Caminho B — manter o h1 e trocar só o subtítulo.**

- **Pró A:** alinha a porta de entrada ao comprador. **Contra A:** é a mudança
  mais cara e mais arriscada da lista inteira. E o dado de sete dias diz que 91%
  do uso real é pt e que **71 documentos saíram** — com o h1 atual. Trocar sem
  placar é apostar.
- **Pró B:** metade do ganho por um oitavo do risco. **Contra B:** o h1 continua
  mirando o executor.

> **Minha indicação: B agora, A depois do Build 5.** O Build 5 é o que instala a
> ponte de intenção do clique de compra — é ele que dá o placar para comparar.
>
> **Se você não responder:** faço B. Não mexo no h1 sem você.

---

### DEC-4 — A degustação de 14 dias

Existe no banco, funciona, e **"14 dias" tem zero ocorrências** em `/`,
`/precos`, `/evidencia-de-teste`, `/seguranca` e `/comparativo`. A única menção
pública está em `/time`, que é órfã.

**Caminho A — anunciar** nos cartões e no FAQ de compra.
**Caminho B — manter só depois do login.**

- **Pró A:** é a melhor oferta do produto, sem cartão de crédito, e derruba a
  objeção de preço antes que ela vire objeção. **Contra A:** mais cadastro de
  baixa intenção e mais suporte.
- **Pró B:** funil mais limpo. **Contra B:** a objeção de preço não tem resposta
  na página onde ela nasce.

> **Minha indicação: A.** Uma linha no cartão e uma pergunta no FAQ.
>
> **Se você não responder:** faço A no Build 5. É texto, é reversível em cinco
> minutos, e o custo de não fazer é invisível — que é o pior tipo.

---

### DEC-5 — O vocabulário guardado entre visitas

Está no catálogo como pronta, e não existe: `vocLista` mora em `sessionStorage`
e morre com a aba. É o terceiro caso de promessa sem porta.

**Caminho A — implementar** (coluna `vocabulario jsonb` em `walkstamp.config` +
o campo no perfil, ~4 h).
**Caminho B — manter o selo "em construção".**
**Caminho C — tirar do catálogo.**

- **Pró A:** fecha o caso, e é a funcionalidade que os usuários de rodada longa
  mais pedem. **Contra A:** guardar vocabulário manda **termos do cliente**
  (nome de sistema, de produto, de projeto) ao servidor. Isso encosta na DEC-1.
- **Pró B:** honesto e grátis. **Contra B:** uma linha do catálogo continua
  vendendo o que não existe, porque a gêmea sem `id` escapa do `planos.mjs`.
- **Pró C:** limpa. **Contra C:** perde uma funcionalidade que dá para entregar
  em meio dia.

> **Minha indicação: A, com o guardar sendo opt-in explícito**, com o aviso no
> mesmo tom dos quatro parágrafos do aviso do Google Docs. Se a DEC-1 for pelo
> caminho B, então C — não há meio-termo.
>
> **Se você não responder:** faço a metade honesta agora (o `estado:
> "construcao"` na linha órfã, 5 minutos, entra no Build 1) e deixo A para o
> Build 6.

---

### DEC-6 — O convite de assento por e-mail

O assento é criado e **nenhum e-mail sai**. Alguém tem que avisar por fora.

**Caminho A — mandar e-mail de verdade** (~3 h; `lib/email.ts` já existe e já
serve dois outros caminhos).
**Caminho B — trocar a oferta por "gerar link/chave de convite".**

- **Pró A:** é exatamente o que está vendido no cartão Team. **Contra A:**
  entregabilidade, e abuso — que agora tem trava: a `walkstamp_convite_pode`
  passou a existir no banco hoje (5/hora por origem, 2/dia por destino).
- **Pró B:** 1 h, e funciona em rede fechada. **Contra B:** o administrador
  passa a ter trabalho manual que o cartão diz que ele não terá.

> **Minha indicação: A.** A infraestrutura existe, a trava existe, e o texto do
> convite é meia hora.
>
> **Se você não responder:** faço A no Build 6.

---

### DEC-7 — A página `/time`

Órfã: nenhuma página do site leva a ela. Está indexável. Publica dois números
que o código não pratica (diz 90 dias; o código emite 45).

**Caminho A — linkar de `/precos`.**
**Caminho B — redirecionar `/time` → `/precos`.**
**Caminho C — tirar do sitemap e deixar viva.**

- **Pró A:** aproveita o conteúdo. **Contra A:** passa a haver **duas** páginas
  vendendo Team — que é a definição do defeito que mais custou a este projeto.
- **Pró B:** uma lista só. **Contra B:** perde-se o texto da degustação, que
  precisa ser transportado antes (é a DEC-4).
- **Pró C:** zero trabalho. **Contra C:** a melhor oferta do produto continua
  numa página que ninguém acha.

> **Minha indicação: B**, executado *depois* da DEC-4 ter levado a degustação
> para `/precos`.
>
> **Se você não responder:** no Build 1 eu corrijo os números errados de `/time`
> (isso é frase falsa no ar, e sai independente da decisão) e deixo a rota como
> está até o Build 5.

---

### DEC-8 — O que o pacote offline é

**Caminho A — embutir tudo** (Transformers, ONNX, Tesseract, jsPDF) e cumprir
"nada nele fala com servidor nenhum".
**Caminho B — declarar** que o offline não tem transcrição, OCR nem Drive, e
fazer a trava de rede valer em **todas** as ações, não só na carga.

- **Pró A:** cumpre a frase publicada. **Contra A:** centenas de MB, e o modelo
  de voz continua precisando descer uma vez — ou seja, A **não fecha** a
  promessa, só a encarece.
- **Pró B:** vira verdade em ~1 dia. **Contra B:** enfraquece a oferta offline
  no papel. E os `steps.*` já dizem certo — é o `/precos` que promete demais.

> **Minha indicação: B, com folga.** A é um produto diferente.
>
> **Se você não responder:** no Build 1 eu já subo a régua da trava (900 ms →
> 3 s) e acrescento `jsdelivr` e `huggingface` à lista de proibidos do build —
> o que faz o build **reprovar** enquanto a promessa for falsa. A decisão de
> mudar o texto ou embutir a biblioteca continua sua.

---

### DEC-9 — Fatura e nota fiscal

`/precos` diz "faturas para baixar, e a nota fiscal quando sai". Nenhuma das
duas tem gravador: a `hosted_invoice_url` chega da Stripe e é descartada, e
`nf_url` só foi escrito por uma migração de cenário de teste.

**Caminho A — implementar o gravador da fatura** (coluna `url text` +
duas linhas no insert, ~3 h) e **tirar a frase da NFS-e**, trocando por
"a nota fiscal é emitida por fora e aparece aqui quando sai".
**Caminho B — tirar as duas frases** e mandar para o portal da Stripe.

- **Pró A:** atinge todo assinante, no pior momento — quando o financeiro pede a
  fatura. E o valor **já chega**: é coluna e duas linhas, não integração.
  **Contra A:** encosta na Stripe. (Só na leitura do webhook que já roda — não
  é reconectar nada, e não precisa da chave que você quer deixar para o fim.)
- **Pró B:** 10 minutos. **Contra B:** o cliente sai da conta para achar a
  fatura, em outra rota, com outro login.

> **Minha indicação: A para a fatura, B para a NFS-e.** Prometer emissão
> automática de NFS-e é falso; prometer que ela aparece quando sai é verdade.
>
> **Se você não responder:** faço a metade de texto agora (Build 1, é frase
> falsa) e a metade de código no Build 6.

---

### DEC-10 — Prova social

Zero depoimentos, zero nomes de cliente, zero logos, zero números de uso, zero
estudos de caso — no site inteiro.

**Caminho A — buscar dois ou três depoimentos.**
**Caminho B — tornar a verificabilidade a prova.** A frase já existe em
`seguranca.pt:150`; falta promovê-la.

- **Pró A:** é o que funciona. **Contra A:** depende de cliente que autorize o
  nome, e não há prazo para isso.
- **Pró B:** é honesto, é hoje, e é coerente com o resto do posicionamento.
  **Contra B:** não substitui prova social de verdade para um comprador que
  compara fornecedores.

> **Minha indicação: B agora, A quando existir cliente que autorize.**
> Depoimento inventado está fora de discussão.
>
> **Se você não responder:** faço B no Build 8.

---

### DEC-11 — Reembolso e garantia

Zero ocorrências no site. O que existe responde ao *cancelamento*, não ao
*arrependimento*.

**Caminho A — 30 dias sem pergunta.**
**Caminho B — declarar que não há reembolso**, e que o cancelamento vale até o
fim do período pago.

- **Pró A:** derruba a última objeção. **Contra A:** custo real, e num produto
  anual o arrependimento chega meses depois.
- **Pró B:** honesto e barato. **Contra B:** perde-se um argumento de fechamento.

> **Minha indicação: B.** Anual **mais** degustação de 14 dias já cobre o
> arrependimento — o que falta é dizer isso numa linha.
>
> **Se você não responder:** faço B no Build 8.

---

### DEC-12 — Content-Security-Policy

Zero ocorrências de `Content-Security-Policy` no repositório.

**Caminho A — CSP em Report-Only por uma semana, ler os relatórios, então travar.**
**Caminho B — só os cabeçalhos baratos agora** (X-Frame-Options, HSTS,
Permissions-Policy) e adiar a CSP.

- **Pró A:** transforma "nada sai daqui" numa regra que o navegador executa —
  numa avaliação de fornecedor, "o que impede?" passa a ter resposta que não é
  "nós". **Contra A:** 2 dias, e uma CSP apertada demais desliga a transcrição,
  que é o produto.
- **Pró B:** 1 h, risco zero. **Contra B:** não responde à pergunta do
  questionário.

> **Minha indicação: B no Build 1, A no Build 9.** Nesta ordem, e não em outra.
>
> **Se você não responder:** faço B. Não ligo CSP sem você.

---

### DEC-13 — Entrar na conta

Só link mágico, sem alternativa. A compra atravessa um aplicativo externo no
meio do funil, e clientes de e-mail corporativo que **pré-visualizam** gastam o
token antes de a pessoa clicar.

**Caminho A — código de 6 dígitos** como alternativa (o Supabase já oferece OTP
numérico).
**Caminho B — manter só o link.**

- **Pró A:** tira um clique e uma troca de aplicativo do meio do funil, e
  resolve a falha do pré-visualizador — que é falha de **compra**, não de
  conveniência. **Contra A:** 2 dias, e mexe no caminho mais sensível do produto.
- **Pró B:** zero risco hoje. **Contra B:** o defeito do token gasto continua, e
  ele é silencioso.

> **Minha indicação: A, no Build 5.**
>
> **Se você não responder:** não faço. É o único item desta lista onde o padrão
> é "não mexer" — é o caminho por onde todo mundo entra.

---

### DEC-14 — A Stripe (por sua instrução: último, ou sob demanda)

Nada de 1 a 9 exige tocar na conexão. O que fica represado, e que você deve
saber:

- **`npm run stripe:conferir` nunca rodou.** Sem confirmação de que o preço do
  Team é `per unit`. Se estiver em `tiered` ou `volume`, **comprar 12 assentos
  cobra por 1**. É o item de maior valor represado — e são 15 minutos com uma
  chave de teste.
- Cancelamento, acesso até o fim do período, renovação e ajuste proporcional de
  assentos: sem prova em sandbox.

> **Minha indicação: uma janela de meio dia, sob demanda, quando você quiser.**
> Só o `stripe:conferir` já paga a janela. Não entra em nenhum build até você
> pedir.

---

### DEC-15 — O Google Drive (por sua instrução: último)

Reconexão fica para o fim. Enquanto isso, o Drive continua listado como origem
de vídeo e **não** funciona no pacote offline — o que a DEC-8 já cobre no texto.

> **Se você não responder:** nada. Não entra em build nenhum.

---

# Parte 2 — A fila de builds

Cada build sai com **zip completo, régua verde e um ganho perceptível**. Nenhum
depende do seguinte para ser entregue.

| # | Build | Dias | O que muda para quem usa |
|---|---|---:|---|
| **1** | O chão | **1,5** | nenhuma frase falsa no ar, o convite volta a funcionar, e a régua roda em qualquer máquina |
| 2 | Não perder trabalho | 3–4 | ninguém mais perde meia hora de anotação por um clique |
| 3 | A esteira honesta | 2–3 | vermelho volta a querer dizer vermelho |
| 4 | Listas paralelas | 2,5–3 | o que o catálogo diz e o que a tela mostra param de divergir |
| 5 | O caminho até a compra | 3–4 | quem clica "assinar" chega ao checkout com o plano escolhido |
| 6 | O que já está vendido | 4–5 | fatura, convite, licença que renova e vocabulário guardado |
| 7 | Termos e jurídico | 2–3 | o dossiê de fornecedor deixa de travar |
| 8 | Copy e posicionamento | 3–4 | a página fala com quem assina |
| 9 | Segurança de servidor | 3–4 | zip bomb, consulta de chamado, CSP |
| 10 | UX — as três etapas | 8–12 | o redesenho, com acessibilidade validada |
| 11 | Motor e medição | 6–9 | menos download, menos árvore de fallback, e números medidos |
| 12 | Dívida | 16–24 | as próximas mudanças ficam baratas |
| — | **Stripe** | 0,5 | **sob demanda** (DEC-14) |
| — | **Drive** | ? | **por último** (DEC-15) |

**Se for para parar em algum lugar, pare depois do Build 5.** São ~13 dias, e no
fim disso não há frase falsa no ar, ninguém perde trabalho, a régua é confiável,
o catálogo é único e a compra tem caminho. Tudo o que vem depois é melhoria, não
conserto.

---

## Build 1 — O chão *(este build)*

**Por que primeiro:** é 100% impedimento ou 100% barato. Nenhum item aqui custa
mais de 2 h, nenhum depende de decisão sua, e três deles destravam todo o resto.

**Banco de produção** — aplicado hoje, direto no Supabase:

| | |
|---|---|
| `interesse_aceita_os_cinco_idiomas` | a lista de aviso recusava alemão e francês dizendo "esse endereço não parece um e-mail" |
| `convite_envio_sai_do_markdown_e_vira_migracao` | a função que o `/api/convite` chama **não existia no banco** — o convite falhava fechado desde sempre |

**Impedimento de esteira:**

- `_medir.mjs`, `_pdf.mjs` e `_pip.mjs` deixam de carregar `/root/walkstamp`
- `amostras.py` passa a funcionar com `ffmpeg` sem o demuxer `image2`
- `rodar.sh` sai **diferente de zero** quando algo falha, e passa a chamar
  `terceiros.mjs` e `precos.mjs`, que existiam e não eram chamados

**Vazamento e segurança, os baratos:**

- `sw.js` para de guardar `/conta` e `/api/` no `CacheStorage` — hoje o e-mail
  do cliente e a linha da fatura sobrevivem ao logout numa máquina compartilhada
- `/api/convite` para de aceitar **qualquer** `*.vercel.app` como origem
- o `middleware` passa a casar `/conta` nos cinco idiomas, não só em português
- `build.py` confere a trava do offline **antes** de escrever o arquivo, e não
  depois de já ter sobrescrito a versão boa
- cabeçalhos de resposta baratos (DEC-12 caminho B)

**Frases falsas no ar** (todas nos cinco idiomas):

- "mínimo de cinco" → "a partir de 3 pessoas" — e o `min={5}` do checkout vira
  `min={3}`, que é o que o servidor já aceita
- `/time`: "vale 90 dias" → 45 dias
- ajuda: "de 77 MB a cerca de 400 MB" → "de 77 MB (processador) a 1,6 GB (com placa)"
- `/seguranca`: "a biblioteca de PDF é servida do nosso próprio domínio" — ela
  vem do jsDelivr; é o **offline** que a embute
- comparativo: "Gratuito" → "Gratuito; planos pagos a partir de R$ 149/ano"

**A régua:**

- o `undefined` que o resumo do Jira cola no chamado, e uma régua nova que
  proíbe `undefined`, `null` e `[object Object]` em todo texto que o produto
  entrega
- `medicao.mjs`: 900 ms → 3 s, e `jsdelivr`/`huggingface` na trava do offline
- `seo.mjs`: "ZERO consultas ao banco" aceitava até duas
- `estado: "construcao"` na linha órfã do vocabulário

**Fica de fora deste build, de propósito:** tudo que precisa de decisão sua,
tudo que mexe em hierarquia de página, e tudo que toca Stripe ou Drive.

---

## Build 2 — Não perder trabalho *(3–4 d)*

Quem perde 40 minutos de anotação não reclama: some. É a categoria mais cara em
confiança, e nenhum item dela depende de decisão.

- Extrair frames de novo apaga todas as anotações, sem confirmar e sem desfazer
- Reabrir o próprio `.zip` escreve a **hora do relógio** na anotação de todo
  quadro sem anotação — e a anotação é o título do passo no documento
- O aviso de saída só existe enquanto algo está *rodando*, nunca quando há
  trabalho *feito*
- O capítulo/tarefa não é gravado no `.json` e não volta
- Anotação de 600 caracteres é cortada para 180 só por ser tocada na revisão
- Trocar o idioma da interface reescreve, em silêncio, o idioma da transcrição
- Trocar de cenário apaga campos preenchidos
- `.json` de versão desconhecida abre calado; quadro sem imagem some com a
  contagem mentindo
- Anotação com quebra de linha quebra o índice do zip
- CSV sai sem guarda de fórmula

---

## Build 3 — A esteira honesta *(2–3 d)*

Feito o Build 1, a esteira roda e sai vermelha quando é para sair. Este build
faz o vermelho ser **verdadeiro**.

- As cinco réguas que a rodada de preços deixou para trás: `cenarios`,
  `timepag`, `medicao`, `tourvid`, `semmarca`
- Três testes de licença **pulam por arquivo ausente e imprimem "ok"** — passam
  a ter o terceiro estado (ok / FALHOU / PULADO) com contagem no rodapé
- O seletor `#licTag` morreu no produto e ainda é alvo de quatro testes
- `compartilhar.mjs` fica verde com o nome do documento dentro do e-mail
- Quatro testes só reprovam por *crash*, nunca por resultado errado
- A pista rápida é intermitente: espera por relógio vira espera por condição
- Testes que cobrem três idiomas num site que fala cinco
- Contagens escritas à mão onde o número tem fonte
- `LEIA-ME.md` conta 135 arquivos; há 147 no disco e 136 no `rodar.sh`

---

## Build 4 — Listas paralelas *(2,5–3 d)*

O defeito que mais custou a este projeto. Só as que **já divergem**.

- A tira de formatos existe em seis cópias à mão: 13 selos, 15 itens no
  catálogo, 12 botões na tela — três capacidades prontas vendidas como inexistentes
- `LISTA_TXT` com 3 idiomas ao lado de `FICHA_TXT` com 5, no mesmo arquivo
- Mapa de locale de data com 3 idiomas numa ferramenta de 5: a validade sai em
  português dentro do documento que o cliente alemão anexa a uma auditoria
- Vocabulário de cenários divergente entre a ferramenta e o site
- Duas tabelas de preço no `build.py`, e `TEAM_MINIMO` duplicado
- Quatro tabelas `LOCALE` idênticas e uma quinta variante que vai para a Stripe
- `CAMINHO` e `HTML_LANG` escritos à mão
- `hreflang` fóssil de três idiomas
- `AUDITORIA-PENDENTE.md` passa a ser **gerado**
- CSS: cinco classes usadas e ausentes, cinco regras mortas

---

## Build 5 — O caminho até a compra *(3–4 d)*

Cinco cliques da home ao checkout, um deles fora do site. Três coisas quebram no
meio.

- O clique de compra **não leva a intenção consigo**: quem clica "Assinar o
  Personal" chega à conta e escolhe de novo. O parâmetro tem de sobreviver ao
  link mágico
- A degustação de 14 dias entra nos cartões e no FAQ *(DEC-4)*
- `/time` é resolvida *(DEC-7)*
- A base de conhecimento esconde 86% do próprio conteúdo do Ctrl+F — e os dois
  links dela para `/precos` estão dentro de acordeões fechados
- `/precos` não linka `/seguranca` nem `/verificar`, e `/seguranca` é um beco
  sem saída
- Código de 6 dígitos como alternativa ao link mágico *(DEC-13, só com seu ok)*
- CTAs absolutos que quebram em prévia e em localhost

---

## Build 6 — O que já está vendido *(4–5 d)*

Um visto numa tabela de preço é uma promessa. Estas são as que não entregam.

- "Licença que se renova sozinha, sem colar chave nenhuma" — **nada renova**, e
  quando vence o recado diz "fale comigo para renovar"
- "Faturas para baixar" — a `hosted_invoice_url` chega da Stripe e é descartada
  *(DEC-9)*
- "Assentos: convidar por e-mail" — nenhum e-mail sai *(DEC-6)*
- "Modelo pessoal": o botão aparece para qualquer membro, o banco exige admin, e
  o modelo pessoal vaza entre colegas
- O vocabulário guardado *(DEC-5)*
- Bloqueio imediato de assento: revogar de verdade, ou dizer que vale na próxima
  expiração

---

## Build 7 — Termos e jurídico *(2–3 d)*

O item que trava a aprovação no dossiê de fornecedor.

- Os Termos dizem que **não há nada à venda** e que o único dado pessoal é o
  e-mail da lista de aviso — e um teste **exige** essa frase
- As cinco políticas de privacidade no mesmo papel controlador/operador
- Segurança da informação, incidentes e pedidos de autoridade nas quatro
  traduções
- O DPA linkado das cinco páginas de segurança e das cinco de privacidade — os
  PDFs em de/en/es/fr **já estão no disco**
- O DPA afirma que sua lista é a mesma da política, e a diferença é deliberada
- Reembolso declarado *(DEC-11)*

---

## Build 8 — Copy e posicionamento *(3–4 d)*

- A calculadora de ROI *(DEC-2)*
- O subtítulo da home *(DEC-3 caminho B)*
- "Três coisas que economizam a tarde" em 25 arquivos, e em dois deles o corpo
  não fala de tempo
- Firefox e Safari gravam a tela **sem** o áudio do sistema, e a home dá a razão
  errada — é a única limitação que produz artefato silenciosamente errado
- OCR e tarja automática exigem CDN público e um clique; `casoEv` promete automático
- "Não usamos cookies" — a própria política declara um cookie de sessão quatro
  seções depois
- Prova social *(DEC-10)*
- "o que a auditoria pede" numa célula marcada como "sim"
- A ajuda diz que o roteiro é "numa conta de time" — é do Personal
- YouTube por link, teto de 300 quadros, offline sem transcrição, ISO/SOC-2
- Sem ISO 27001 e sem SOC 2: dito de forma impecável, e no lugar errado

---

## Build 9 — Segurança de servidor *(3–4 d)*

- **Zip bomb** no leitor de `.xlsx`: `inflateRawSync` sem teto de saída, e o laço
  infla **todas** as entradas ao mesmo tempo. Alcançável com qualquer e-mail,
  pelos 14 dias de degustação
- Consulta de chamado **sem login**, com número sequencial de 4 dígitos e sem
  limite de tentativa. *(Confirmado hoje em produção: `walkstamp_chamado_ver`
  é executável por `anon`.)* Devolve texto, resposta e datas
- O limite de abertura de chamado é **global** — um ator sozinho tranca a caixa
  de todo mundo
- CSP *(DEC-12 caminho A)*
- `CRON_SECRET` reaproveitado como sal do hash do convite: girar o segredo zera
  todas as contagens de limite
- O link do roteiro leva caso, sistema e chamado na query string
- O `app/api/faxina/route.ts` — o endereço que **apaga dado de cliente** —
  nunca foi auditado

---

## Build 10 — UX, as três etapas *(8–12 d)*

O reflow: `Entrada → Conferir → Baixar`. Vem depois de tudo que entrega valor
sem mexer na página, porque é aqui que **69 réguas de visibilidade** cobram.

Inclui, do que já estava listado: rolagem horizontal em 18 combinações de
página/idioma a 380 px (o culpado é sempre `table.legal`), `<main>` e link de
pular conteúdo em 85 páginas, estado honesto de recurso por navegador antes de
ativar webcam/clipe/WebGPU/OCR, busca na Ajuda, e a acessibilidade da
**ferramenta**, que nunca foi medida.

---

## Build 11 — Motor e medição *(6–9 d)*

- `performance.mark()` em cada fronteira, com amostras versionadas de 1, 10 e
  40 min, cold e warm cache, CPU 1/4 threads e GPU
- Classificar o erro do `buildPipe()` e saltar direto para o fallback pertinente
  — hoje algumas falhas custam 73–200 MB extras
- Fixar todas as versões, com manifesto testado de biblioteca ↔ runtime ↔ modelo
- Avisar antes de um fallback caro
- A pergunta aberta: inglês abre 48 vezes e converte zero. Funil quebrado ou
  robôs? Meia hora de consulta responde — **e agora responde de verdade**, porque
  o `check` de idioma parou de descartar `de` e `fr`

---

## Build 12 — A dívida *(16–24 d)*

Nada aqui o usuário vê. Tudo aqui decide o custo dos próximos anos: máquina de
estados do motor ASR, modularização da fonte, memória do `decodeTo16k()`,
qualidade da compactação de silêncio, e o campo `porta` no catálogo com a régua
que o cobra — a única mudança da lista inteira que **impede** um quarto caso de
promessa sem porta em vez de consertar o terceiro.

---

# Parte 3 — O que não entra em build nenhum

- **Stripe** — sob demanda *(DEC-14)*. O `stripe:conferir` é a única coisa que
  eu recomendo antecipar, e são 15 minutos.
- **Google Drive** — por último *(DEC-15)*.
- **Leitor de tela de verdade** (NVDA, VoiceOver) — depende de máquina física.
- **Três Edge Functions que o produto chama e não existem no repositório**:
  `walkstamp-licenca`, `walkstamp-time`, `walkstamp-meus`. Onde a cadeia passa
  por elas, há um elo que não é auditável a partir do pacote. **Isto é um
  impedimento de verdade** e não tem build porque não tenho o código — me diga
  onde ele mora e ele entra no Build 6.

---

# Nota sobre as listas de origem

A tabela "primeira semana" do `ALTERACOES.md` cita IDs que não batem com os
blocos do próprio arquivo (chama de `F1, F2` o que é `F5` e `F11`; de `A2` o que
é `A4`; de `G2` o que é `G4`). O conteúdo das linhas está certo — os rótulos,
não. Segui o **conteúdo**. Ao consultar aquele arquivo, use as seções, não a
tabela final.

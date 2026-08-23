# Build 1 — O chão

**Data:** 23/08/2026
**Base:** a árvore de 22/08 publicada na Vercel, sincronizada com o repositório
interno nesta rodada.
**Fila completa:** `FILA.md`. **Catálogo dos itens:** `ALTERACOES.md`.

Nenhum item deste build dependeu de decisão sua. Nenhum tocou a Stripe nem o
Google Drive.

---

## O que foi medido antes de mexer

A regressão inteira, nesta máquina, contra a árvore publicada:

```
129 ok · 7 FALHOU · e o rodar.sh saiu 0
```

Os sete: `cenarios`, `capitulos`, `timepag`, `medicao`, `roteiro`, `tourvid`,
`semmarca`. Dois deles — `roteiro` e `capitulos` — não estavam na lista de
cinco do `ALTERACOES.md`: `roteiro` caía por falta de `openpyxl` no ambiente,
e `capitulos` é uma afirmação sobre o nome das tarefas no PDF que ainda não foi
investigada (fica para o Build 3).

**"E o `rodar.sh` saiu 0" é o achado mais caro da medição.** Sete réguas
vermelhas na tela, e um pipeline que só olhasse o código de saída teria
publicado.

---

## Banco de produção — aplicado ao vivo

Projeto `kjlnyyblhanficgpends` (`walkstamp`, sa-east-1). Duas migrações novas,
aplicadas e conferidas:

### `20260823125353_interesse_aceita_os_cinco_idiomas`

`walkstamp.interesse.idioma` aceitava `pt`, `en`, `es`. O site tem cinco.

Quem pedia aviso do plano pago a partir de `/de/` ou `/fr/` recebia **"esse
endereço não parece um e-mail"** — porque a violação do `check` volta pelo mesmo
caminho do formato inválido. Zero leads em dois mercados, sem erro em lugar
nenhum. A tabela `evento` já tinha sido corrigida em 22/08; `interesse` ficou
para trás.

Conferido depois: `CHECK (idioma IS NULL OR idioma IN ('pt','en','es','de','fr'))`.

### `20260823125413_convite_envio_sai_do_markdown_e_vira_migracao`

`app/api/convite/route.ts` chama `walkstamp_convite_pode` antes de mandar
qualquer convite. **A função não existia neste banco.** Nem a tabela
`convite_envio`. O SQL morava em `CONVITE-POR-EMAIL.md`, com a instrução "cole
no SQL Editor e rode" — e nunca foi rodado.

Falha fechada, que é o comportamento certo, mas **o convite por e-mail nunca
funcionou em produção**. E, fora das migrações, a tabela escapava das duas
travas automáticas do projeto: RLS em toda tabela e `search_path` fixo em toda
função.

Conferido depois: a função existe, a tabela existe, RLS ligada, e
`has_function_privilege('anon', …)` = **false**.

### O que eu olhei e estava certo

- **O cenário de prova em produção (B3).** `teste-portal.example` — o domínio
  que concede Team automático — **não está no banco**. A migração de limpeza
  logo em seguida rodou. Produção tem 1 domínio (`modelo.example`), 3 clientes,
  2 faturas, 1 conta. O risco do B3 é de reconstrução, não de hoje.
- **As 44 migrações do repositório batem com as 44 do banco** em conteúdo. As
  quatro últimas têm carimbo de versão diferente entre os dois lados — anotado
  na fila, não corrigido aqui: renumerar migração já aplicada é pior que a
  divergência.

### O que o linter do Supabase diz, e o que disso é real

Quase tudo é postura declarada (RLS ligada sem policy = nega tudo, e é assim de
propósito). **Uma é real e vira Build 9:** `walkstamp_chamado_ver(numero, email)`
é executável por `anon`. Combinada com número sequencial de 4 dígitos e sem
limite de tentativa, é o item B5 — confirmado agora em produção, não só por
leitura de código.

---

## Impedimento de esteira — a régua roda em qualquer máquina

Três coisas impediam a suíte de rodar fora da máquina de origem. Nenhuma era
código do produto, e as três custavam o mesmo: um diagnóstico honesto que se lê
como "o produto quebrou".

- **`testes/amostras.py`** falhava com `Error opening input: No such file or
  directory` quando o único `ffmpeg` do PATH era o do Playwright. Aquela build
  não tem o demuxer `image2`, nem decodificador de PNG, nem `libopus` — e a
  mensagem do `ffmpeg` é indistinguível de arquivo faltando. Agora a pergunta é
  feita **antes**, uma vez, e a resposta diz o que falta e como resolver.
- **`_medir.mjs`, `_pdf.mjs` e `_pip.mjs`** ainda carregavam
  `RAIZ='/root/walkstamp'` e o caminho fixo do Chromium. Os outros 140 já
  derivavam de `_caminhos.mjs`; estes três ficaram para trás. Agora não sobra
  nenhum.
- **`rodar.sh` saía 0 com a esteira vermelha.** Agora sai 1, com a lista.
  `rapido.sh` tinha o mesmo defeito por outro caminho — o `xargs` devolvia o
  status do `printf` — e também foi fechado.

E as **duas réguas que existiam e a esteira nunca chamava**: `terceiros.mjs` e
`precos.mjs`. Sete linhas do `AUDITORIA-PENDENTE.md` que diziam "coberto por
`precos.mjs`" eram, na prática, "sem teste".

---

## Vazamento e segurança

### O service worker guardava a conta

`caches.put()` não olha `Cache-Control`. O produto manda `no-store` em `/conta`
e `/api/`, e o service worker apagava esse pedido, guardando as respostas no
`CacheStorage`. Numa máquina compartilhada, o e-mail do cliente e a linha da
fatura sobreviviam ao logout e voltavam para a próxima pessoa quando a rede
caísse.

Uma linha no `fetch` resolve. E a versão do cache subiu para `walkstamp-v3.2` —
sem isso, o conserto não conserta a máquina de ninguém, porque o cache velho
continua lá.

### O convite aceitava qualquer `*.vercel.app`

Não era curinga do nosso projeto: era de um provedor inteiro. Qualquer pessoa
cria um projeto na Vercel de graça, e a página dela passava na conferência de
origem — com o nosso remetente.

O curinga existia por um motivo real (o botão é testado em prévia), e o que ele
queria dizer é "a prévia **deste** deployment". É isso que `VERCEL_URL` diz, e a
Vercel a escreve sozinha em cada prévia. Quem precisar de um host a mais o
declara em `PREVIA_HOSTS`.

### O middleware de sessão falava só português

O matcher casava `/conta`. A conta existe em `/en/account`, `/es/cuenta`,
`/de/konto` e `/fr/compte` — e o middleware roda **antes** das reescritas, então
ele vê o endereço que o navegador pediu. A sessão não era renovada em quatro dos
cinco idiomas.

O `config` do Next tem de ser estático, então a lista é escrita à mão — e
`testes/middleware.mjs` (novo) existe para que ela não possa divergir de
`src/rotas.json` em silêncio.

### O pacote offline telefonava sozinho

`adiantarModelo()` disparava num `setTimeout` de 1200 ms **em qualquer build**.
O arquivo vendido para rede fechada buscava o modelo no jsDelivr 1,7 s depois de
aberto, sem clique nenhum. Agora o `file:` não antecipa. Na web nada muda — lá a
antecipação paga uma espera real na primeira transcrição.

E a régua media a janela errada: `medicao.mjs` esperava 900 ms, ou seja, olhava
**antes** do pedido que ela existe para pegar. Passou para 3 s.

### A trava do offline contaminava o disco antes de reprovar

`build.py` escrevia o arquivo e **depois** conferia. O build saía 1 e o arquivo
de 1,7 MB com `supabase.co` dentro já estava no disco, tendo sobrescrito a
versão boa. Agora confere antes.

E entrou um **teto declarado** de referências a CDN no pacote offline:
`cdn.jsdelivr.net` 13, `huggingface.co` 2. Não é proibição — elas estão lá hoje,
na cadeia de reserva da transcrição e do OCR, e proibi-las agora derrubaria o
build sem consertar nada. O que a trava impede é o número **crescer em
silêncio**, que foi como ele chegou a 13. Enquanto não for zero, a frase "nada
nele fala com servidor nenhum" é falsa — é a DEC-8 da fila.

### Três cabeçalhos baratos

`X-Frame-Options: DENY`, HSTS e `Permissions-Policy` (geolocalização, pagamento,
USB e sensores desligados; câmera, microfone e captura de tela em `self`, porque
são o produto). A CSP **não** entrou: ela precisa de uma semana em `Report-Only`
antes de travar, e isso é um trabalho com começo e fim — é a DEC-12.

---

## Frases falsas que saíram do ar

Todas nos cinco idiomas.

| A frase | O que o código faz |
|---|---|
| "O Team é por assento, com **mínimo de cinco**" | `lib/stripe.ts` aceita 3 desde a rodada de preços |
| O seletor de assentos com `min={5} defaultValue={5}` | o servidor já aceitava 3 — era a tela que recusava |
| `/time`: "cada chave vale **90 dias**" | o código emite **45** |
| `/time`: "não existe botão de revogar" | existe, no portal do time, de 1 a 90 dias |
| ajuda: "de 77 MB a cerca de **400 MB**" | a tabela do código vai de 77 MB a **1,6 GB** |
| `/seguranca`: "a biblioteca de PDF é servida do nosso próprio domínio, e não de CDN" | o `build.py` injeta o jsPDF **do jsDelivr**; é o offline que o embute |
| `/seguranca`: jsDelivr "só ao usar transcrição ou OCR" | ele desce no **carregamento** da página |
| `/seguranca`: telemetria "em **três** momentos" | são **quinze** marcos — onze na ferramenta, quatro na conta |
| comparativo: nosso preço de tabela = "**Gratuito**" | numa tabela cuja tese é comparar preços de tabela; o Team é R$ 1.047 |

E o `estado: "construcao"` entrou na linha órfã do vocabulário — a que dizia "e
a lista fica **GRAVADA**" sem `id` e sem estado, ao lado da gêmea que diz a
mesma coisa **com** o selo. Ela passava porque `planos.mjs` casa por `id`, e 86
dos 94 itens não têm um.

---

## A régua

### O `undefined` que ia para o chamado do cliente

`resumoJira()` chamava `t('wFrames')` — verba que não existe em idioma nenhum,
morta quando a ficha técnica virou uma só. `t()` devolve `undefined`, e o texto
que a pessoa cola no chamado saía com a palavra dentro.

`jira.mjs` **imprimia** o defeito e saía 0. Ele estava na tela em toda execução
da regressão, e ninguém o via, porque não era uma afirmação — era um
`console.log`.

Corrigido, e generalizado: **`testes/semundefined.mjs`** (novo) reprova
`undefined`, `null`, `NaN` e `[object Object]` em quatro artefatos — o resumo do
Jira, o Markdown baixado, o nome do arquivo e a linha de status — nos cinco
idiomas.

**Provado nos dois sentidos:** com o defeito reintroduzido no artefato, ela
reprova com o trecho exato (`* *undefined:* 3`); com o conserto, passa.

### As outras

- **`testes/inventario.mjs`** (novo): o disco, o `rodar.sh` e o `LEIA-ME.md`
  passam a contar o mesmo número, e a régua reprova com o **nome** do arquivo
  órfão. Ela reprovava na hora em que nasceu — 141 no disco, 135 no LEIA-ME —
  que é o ponto. Três instrumentos que não afirmam nada (`proxy`, `regua`,
  `gerar-dpa`) estão declarados por nome, e não perdoados por regra esperta.
- **`seo.mjs`**: "ZERO consultas ao banco" era cobrado com `gastos < 3`. Virou
  `=== 1`. A regressão que isso deixava passar só apareceria na fatura.
- **`tourvid.mjs`**: exigia os quinze `rodada.*.webm`, que **nunca existiram** —
  a página de preços já pôs uma figura no lugar. Agora ela cobra a *derivação*
  (o `rotas.json` diz o que está no disco), e volta a cobrar os vídeos sozinha
  se eles forem gravados um dia.
- **`DEMO-NATURA.md` saiu.** `DEMO-CLIENTE.md` já era o gêmeo neutro, palavra
  por palavra, e nada referenciava o outro. Era sobra, não conteúdo — e era uma
  das falhas da regressão.

---

## O que eu deixei em aberto de propósito

- **`capitulos.mjs`** — "o PDF traz o nome das tarefas". Falha na árvore limpa e
  não estava na lista de cinco. Não investiguei o bastante para escrever o
  conserto; vai para o Build 3.
- **`cenarios.mjs` e `timepag.mjs`** — as réguas que a rodada de preços deixou
  para trás. Reescrever a afirmação sem entender o que a página nova promete
  troca régua quebrada por régua vazia. Build 3.
- **Os carimbos de versão das quatro últimas migrações**, diferentes entre
  repositório e banco. Renumerar migração já aplicada é pior que a divergência.
- **`npm run stripe:conferir`** — continua sem rodar. É a DEC-14, e é a única
  coisa da lista de Stripe que eu recomendo antecipar: se o preço do Team
  estiver em `tiered` ou `volume`, **comprar 12 assentos cobra por 1**.

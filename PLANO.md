# O que falta — Walkstamp

**Atualizado em:** 21/08/2026 — depois do A0, do A1 e do B3
**Origem:** a auditoria de código, a proposta de redesenho de UX e a avaliação das
features pagas, medidas contra o código.

> **Tudo abaixo foi medido** contra a árvore do `walkstampbuild8_1.zip`, que é o `main`
> de produção (`285d4a5`) mais os seis commits do `APLICAR/correcoes.bundle`.

---

## Onde estamos

| Build | Estado |
|---|---|
| 1 — a régua roda, e a placa não trava | **feito** |
| 2 — o documento tem fim | **feito** |
| 3 — a saída certa primeiro | **feito**: transportado no A0 |
| 4 — parar sem perder | **feito**, e melhor do que eu tinha feito |
| 7 — a entrada | **feito**, já no `main` |
| 8 — a conferência | **feito**: o menu `Editar` da grade fechou o build |
| 5, 6, 9, 10 | por fazer |

A perna da etapa de conferir caiu de **2828 px para 1649 px — 42% menor** — recolhendo a
fala e a identificação, que são estado do material e não tarefa.

### A correção do relato: o build 3 nunca chegou

Medido na árvore do zip:

```
recPrim       0        saidasTodas   0
```

A saída recomendada e a gaveta "ver todos os formatos" **não existem na linhagem de
produção**. Elas foram feitas, testadas e comitadas numa cópia que nunca foi aplicada —
`2229ff8`, com `saidarec.mjs` e as 39 adaptações de teste que a gaveta cobrou: 45
arquivos, 1030 linhas. Não é um build a fazer; é um **transporte**.

### E o build 4 deles é melhor que o meu

Medido: `role="status"` 8×, `trMotorCx` (o motor recolhido, que o plano pedia) 5×,
"após este trecho" 3×, e existe `testes/parar.mjs`. O meu — `trLinha`/`trPct`/`trEta`,
inacabado e sem régua verde — deve ser **descartado**, não portado.

Falta um detalhe pequeno no deles: a consequência medida. `sem cerca de` dá **0**. O
plano pedia "a fala está em 62%; o documento ficará sem aproximadamente 16 minutos
finais" — hoje a tela diz que parou, mas não diz o quanto ficou de fora.

---

## A fila do que falta

A ordem respeita o que você pediu: **terminar o UX do app primeiro**. Depois vem o que
trava a venda, e por último o motor e a dívida. Uma exceção argumentada está no fim
desta seção.

### Trilha A — terminar o UX (1–2 d: só a validação com leitor de tela)

**A0. Transportar o build 3 e fechar o 4 — FEITO**

`2229ff8` aplicado sobre a linhagem: a saída recomendada por cenário, com o catálogo
recolhido. `recPrim` e `saidasTodas` davam zero na árvore do zip; agora dão 11 no
`app.html`.

**A1. O menu `Editar` da grade — FEITO**

O que faltava do build 8, e não era o que a proposta descrevia. Medido, o cartão não
tinha tarja nem recorte à vista — eles já moravam na lente. O defeito era outro:

- a lente só abria por um `⤢` com `opacity:0` até o mouse passar por cima. **Num aparelho
  de toque não existe `:hover`** — metade da ferramenta era inalcançável. Agora é um botão
  `Editar`, sempre visível, com o `title` listando o que há atrás da porta;
- a seta de mover desabilitada era `opacity:0 !important`: nas pontas, "não há para onde"
  era silêncio. Agora fica apagada, não sumida;
- o cartão passou a mostrar **a primeira linha da fala**, pela mesma conta que o documento
  usa — cartão e PDF não contam duas histórias sobre o mesmo quadro.

A anotação **continua no cartão**, contra a proposta: anotar é o trabalho desta etapa, e
um trabalho que exige abrir um diálogo por quadro é um trabalho que ninguém faz quarenta
vezes.

Régua: `testes/cartao.mjs`, no grupo `app`.

**A2. As três etapas — FEITO, menos a validação com leitor de tela**

`Entrada → Conferir → Baixar`, e não como rótulo: `Gerar` saiu de dentro de
"Revisão" e virou a etapa 3, num cartão próprio.

A numeração mentia duas vezes. **"2 — A fala (opcional)"** é onde moram `#auto`,
`#extract` e os ajustes de extração: o único botão que faz a ferramenta
funcionar estava dentro de um passo rotulado como dispensável. E **"3 — Revisão"**
escondia quatro blocos, sendo o quarto `Gerar` — a coisa que a pessoa veio
buscar, atrás de três blocos de rolagem.

Agora o cartão da fala perde o número (é a segunda metade da entrada), e são três
etapas com uma barra que diz onde você está (`aria-current="step"`), botões que
levam à etapa, uma frase de próxima ação em `role="status"`, e **a travessia**:
cruzar uma fronteira trabalhando leva a pessoa até a etapa nova — só para
frente, nunca durante a captura, e sem tirar o cursor de quem está escrevendo.

**A barra acompanha a rolagem** e mostra os quatro estados — *atual*,
*concluída*, *com atenção* e *bloqueada* —, cada um por palavra no rótulo
acessível e não só por cor. "Com atenção" sai da mesma conta do botão de faxina,
e por isso os dois nunca discordam. No celular vira `Etapa 2 de 3 · Conferir`
mais uma barra de três segmentos. Abaixo, sempre, uma frase só: **"Próxima
ação: …"**.

E nada pousa debaixo dela: `scroll-padding-top` conserta a classe inteira do
problema — `scrollIntoView`, âncora, o `irPara()` dos subpassos e a travessia.
As duas alturas (cabeçalho e barra) são **medidas** por `ResizeObserver`, porque
cravar o número erraria no alemão a 900 px, onde o menu quebra em duas linhas.

**O estado é derivado**, não guardado: não há quadro → entrada; há quadros e nada
saiu → conferir; saiu documento → baixar. `etapas.mjs` cobra isso recomeçando a
sessão e vendo a barra voltar sozinha.

Ganho não previsto: com `Baixar` num cartão próprio, `passos()` consegue
deixá-lo **inerte** enquanto não há o que baixar. Dentro da antiga "Revisão"
isso era impossível.

**O vocabulário unificado**, que estava adiado desde o build 3, também está
feito — e medir mudou o escopo:

| | antes | agora |
|---|---|---|
| `frame` vs `quadro` em pt | 43 vs 44 | **uma palavra: quadro** |
| `passo 1/2/3` (fase da ferramenta) | 14 chaves em pt, 14 em es | **etapa**, com a concordância certa |
| `trecho` | 32 | **fica** — é trecho de *fala*, conceito diferente |
| en, es, de, fr | já consistentes | intocados |

Só o português estava dividido: em inglês "frame" *é* a palavra nativa, e
espanhol, alemão e francês já usavam a deles. `chaves.mjs` ganhou a guarda que
reprova se qualquer uma voltar.

**O que falta**, e não dá para fazer daqui: **NVDA + Chrome, VoiceOver + Safari
e zoom 200%**. Não há leitor de tela nesta máquina, e uma régua que dissesse
"acessível" sem isso estaria mentindo com autoridade. O que deu para medir está
medido — `aria-current`, o foco indo para o cabeçalho, o rótulo acessível com
número e a palavra "feita", a frase de status que não se repete, e as duas
guardas da travessia.

### Trilha B — o que trava a venda: **FEITA**

**B1. Verdade única entre página, catálogo e código — FEITO**

A página de preços tinha duas listas vindas de lugares diferentes: a **lista
comparativa**, montada de `src/features.json` nos cinco idiomas por
`tabelaDePlanos()`, e os **cartões de plano**, escritos à mão em cinco arquivos.
Elas discordavam.

Medido item por item, contra o código e o banco:

| o cartão dizia | a verdade |
|---|---|
| Modelo de documento próprio — *em breve* | **existe** desde 16/08 (`modelo_doc`, `time_modelo()`, salvar e listar na ferramenta) |
| Perfil entre visitas e máquinas — *em breve* | **existe** (`config`, `perfil_do_usuario()`, `aplicarPerfil()`) |
| Perfil de equipe empurrado — *em breve* | **existe** (`time_config()`, e a ferramenta consome) |
| Termos do sistema guardados — *em breve* | **não existe**: `vocLista` mora em `sessionStorage` e morre com a aba |

Ou seja: **três coisas prontas há cinco dias estavam sendo anunciadas como
futuras**. A migração `20260816062235` diz isso com todas as letras — "a metade
que faltava de duas features que estavam meio prontas" — e a página nunca soube.

O que mudou:

- as três saíram do "em breve" nos cinco idiomas;
- a que falta entrou no catálogo como `"breve": true`, que é onde a regra do
  próprio arquivo sempre disse que ela deveria morar;
- cada bala do cartão ganhou `data-f`, a alça que a amarra ao item do catálogo —
  o selo passa a ter uma fonte só;
- o alemão dizia **"bald"** no cartão e **"demnächst"** na lista comparativa:
  duas palavras para o mesmo selo, na mesma página. Unificado.

**A "terceira fonte" não existia.** O plano falava em unificar também as *feature
flags* do código; medido, a ferramenta não trava nada por nome de plano — ela
trava por haver sessão com cliente. O campo `planos` do catálogo é documentação,
e não interruptor. Um problema a menos, por não existir.

**A trava:** `testes/planos.mjs`, estático — lê JSON e HTML, sem navegador e sem
servidor, porque um portão de release que precisa de `next start` é um portão que
se aprende a pular. Ele reprova (provado nas duas direções) se um cartão marcar
como futuro o que o catálogo diz que existe, se um idioma prometer o que outro
não promete, ou se a palavra do selo divergir. Entrou no `rodar.sh` ao lado do
`chaves.mjs`, e no `rapido.sh site`.

**B2. Webhook único — FEITO**

Havia dois, e o repositório não dizia qual URL estava no painel da Stripe. **Não
era empate.** Medido:

| | rota do Next | Edge Function |
|---|---|---|
| faturas | 6 tipos | os mesmos 6 |
| **`checkout.session.completed`** | **sim** | **não** |
| **`customer.subscription.*`** | **sim** | **não** |
| assentos pela `quantity` | sim | não |
| conferência da assinatura | `constructEvent` da biblioteca | à mão |

A Edge Function tratava **só faturas**. Com a URL apontada para lá, a pessoa
paga, a fatura aparece, e o plano **nunca chega** — em silêncio, porque a Stripe
recebe 200 e vai embora satisfeita.

E ela estava no ar: `walkstamp-stripe`, versão 2, `ACTIVE`, `verify_jwt:false`.

A autoridade é a rota do Next, por três medidas: só ela chama
`walkstamp_assinatura_da_stripe`, e portanto só ela transforma pagamento em
acesso; ela usa a biblioteca oficial; e a produção tem cliente com
`stripe_assinatura` preenchido, campo que só esse caminho escreve.

A Edge Function passou a responder **410 com o endereço certo no corpo** — e não
a ser apagada: um 404 é indistinguível de deploy quebrado, e o 410 diz que o
endereço existiu e mudou. Ela continua reentregando, que é o que se quer.

**A ordem de aplicar importa:** mover a URL no painel da Stripe primeiro,
reenviar por lá o que falhou, e só então publicar a recusa. Ao contrário, as
faturas do intervalo se perdem.

**Idempotência e replay observáveis.** A idempotência já existia, e no lugar
certo — `fatura_stripe_uk` único em `stripe_id` com `on conflict do update`, e a
assinatura sobrescrita inteira a cada evento. O que faltava era **saber que a
entrega aconteceu**: hoje, quando uma compra não vira plano, não há como
distinguir "a Stripe não mandou" de "recebemos e falhamos".

`walkstamp.stripe_evento` responde isso. Ela é **anotação, não trava**: uma
trava que pulasse o `event.id` repetido descartaria justamente a reentrega com
que a Stripe conserta uma falha. `repetido` conta as reentregas — é o número que
denuncia um laço.

Régua: `stripehook.mjs` reescrito (a Edge recusa, a rota do Next é a única que
concede plano, e anota **depois** do trabalho), mais o bloco [8b] da
`supabase/testes/10-fumaca.sql`. **O que continua por conferir:** o caminho de
rede, com `stripe listen --forward-to` e a Stripe CLI — não dá para fazer daqui.

**B3. Banco versionado — FEITO**

Eram zero `.sql` contra mais de vinte RPCs. Agora são **42 migrações versionadas** em
`supabase/migrations/`, e `supabase/testes/prova.sh` reconstrói o esquema do zero e
compara com a produção: **as oito categorias batem** — colunas, funções, índices,
restrições, RLS, sequências, permissões e baldes.

As 38 primeiras saíram **verbatim** de `supabase_migrations.schema_migrations`, cada uma
conferida por md5 contra o que a base diz que aplicou. As quatro últimas são o que a
comparação encontrou de fora do Git:

- **três objetos que ninguém versionou** — `negocio_nps()`, `negocio_painel_base()` e o
  `negocio_painel()` reescrito, feitos à mão no editor do painel. Se a base tivesse sido
  perdida, o painel voltaria sem o NPS e ninguém saberia dizer o que faltou;
- **sete tabelas sem RLS** — `cliente`, `config`, `emissao`, `fatura`, `modelo_doc`,
  `recado`, `usuario`. Não é porta aberta (`anon` não tem USAGE no esquema `walkstamp`),
  é a segunda tranca;
- **dois chamados de mentira na produção**, sobra de uma migração de prova. Um deles está
  marcado como respondido e entra no tempo médio que a **página pública** mostra;
- **treze funções sem `search_path` fixo**, que é o que o linter do Supabase apontava.

Vai junto `seed.sql`, `config.toml` e uma prova de comportamento com 40 afirmações — a
licença, os assentos, o chamado, o roteiro, a cobrança, o blog, o painel, o expurgo e a
parede que separa o navegador das tabelas. Ver `supabase/LEIA-ME.md`.

As quatro novas ainda **não foram aplicadas**: falta um `supabase db push`, e só a da
limpeza mexe em dado.

**B4. Um estado por plano no funil — FEITO**

Cada cartão já tinha uma ação primária. O que estava jogado no meio era outra
coisa, e pior: a página **vendia o Personal** — preço, selo de 14 dias, "na hora,
sem cartão" — e cinquenta linhas abaixo pedia o e-mail da pessoa para avisar
**"quando o plano pago sair"**. Nos cinco idiomas.

Não é erro de texto. É a página não saber que o que ela promete já foi entregue —
o mesmo defeito do B1, no sentido contrário: lá ela escondia o que existia, aqui
ela promete o que já vende. E há checkout de verdade
(`stripe().checkout.sessions.create`), então quem manda é o cartão.

A lista tinha um assunto verdadeiro esperando por ela: **Pro e API**, que a
própria página descreve dois parágrafos acima como "nada disso existe ainda".
Agora ela espera isso, e diz em voz alta que o plano pago já está no ar.

Os quatro estados ficam assim:

| plano | estado | ação |
|---|---|---|
| Free | *testar agora* | Abrir a ferramenta |
| Personal | *testar agora* | Começar os 14 dias |
| Team | *pedir acesso* | Falar sobre o Team |
| Pro e API — não existe | *entrar na lista* | Quero ser avisado |

**A trava** entrou no `planos.mjs`, e é estrutural em vez de casar frases: os
cartões ganharam `data-plano`, a seção ganhou `data-espera`, e o teste afirma que
o que a lista espera **não pode ser algo que a página vende** — mais uma ação
primária por cartão. Provado nas duas direções: apontar a lista para `personal`
reprova, e um segundo botão num cartão reprova.

**B5. Reposicionar o Personal em torno do roteiro — FEITO**

O cartão liderava pela identidade visual. A chamada era *"Para quem entrega
documento com o próprio nome — ou com o do cliente"*, a primeira bala era o
logotipo, e o roteiro vinha em segundo, numa linha: *"suba a planilha, execute um
a um, e ela volta preenchida"*.

"Colocar logotipo" se compara com editar um Word. O que substitui um processo
está medido no código, e agora está escrito no cartão:

| o cartão promete | onde isso vive |
|---|---|
| suba a planilha (.xlsx, .csv, colada do Excel) | `roteiro_salvar()`, `Importar.tsx` |
| cada caso vira um link que abre a ferramenta preenchida | o `caso=` no `template.html` |
| volta em .xlsx com situação, quando, quem, arquivo e impressão | `app/conta/planilha/route.ts` — as 11 colunas |
| recibo por caso, sem imagem sair | `roteiro_caso.recibo`, do build de 16/08 |

A marca **continua no pago**, na quarta bala, junto com o modelo e o perfil — como
prova visível do plano, e não como a justificativa dele.

Uma restrição real do `cenarios.mjs` moldou o resultado: cartões de no máximo
seis balas, e no máximo uma de diferença entre eles. Os três seguem **6/6/5** —
a identidade e o perfil dividem uma linha para o roteiro caber com as duas metades
da tese.

**A trava** entrou no `planos.mjs` e amarra promessa a entrega: as cinco colunas
que o cartão nomeia têm que existir no `cab` da rota da planilha, o export tem que
sair em `.xlsx`, e a primeira bala do Personal tem que falar da planilha nos cinco
idiomas. Provado nas duas direções — tirar `rotColImp` do export reprova, e o
logotipo voltar a liderar reprova.

### Trilha D — posicionamento e venda (3–4 d restantes) — **prioridade sobre a C**

A fonte é a **análise da página, da copy e da venda** de 22/08, que está inteira
em `ANALISE-DA-VENDA.md`. O veredito dela cabe numa frase: a página é forte como
explicação de produto gratuito e fraca como página de venda — ela prova o
mecanismo e não responde para quem é, que trabalho substitui e por que pagar.

Ela entra **na frente da C2 e da C3**, e o motivo é o mesmo da C1: otimizar o
motor de um produto que ninguém está comprando otimiza a coisa errada. A C1 já
deu a régua; a D decide o que vale medir.

#### O que a análise pede e a trilha B já entregou

A análise foi escrita contra a página de **antes** dos builds B1, B4 e B5. Três
itens do P0 dela já estão feitos, e vale não refazer:

| pedido da análise | estado |
|---|---|
| P0.2 — acabar com a contradição entre trial disponível e lista de espera | **feito no B4.** A lista de aviso agora é do Pro e da API, e diz "o plano pago já está no ar" |
| P0.2 — "em breve" no cartão para coisa que já existe | **feito no B1.** Três recursos publicados eram anunciados como futuros desde 16/08 |
| P0.4 — validar cada benefício antes de pôr no cartão | **feito no B1.** O `planos.mjs` amarra catálogo, página e código, nos cinco idiomas |
| P1 (parte) — Personal vendido por orquestração, não por logotipo | **feito no B5.** O cartão foi reescrito em torno do roteiro; a marca caiu para a quarta bala |

**O que sobrou do P0 é o que segue.**

#### D0 — antes de comprar tráfego: **seis dos sete feitos**

Feitos — **1, 2, 3, 4, 5 e 7**. Os cinco primeiros nos cinco idiomas, cada um
com a trava que impede a volta:

1. **A home escolheu um comprador — FEITO.** O H1 era
   *"Você percorre a tela. Ele carimba cada passo."* — tem personalidade e não é
   pesquisável: quem faz QA não lê ali "caso de teste", "evidência" nem
   "planilha". E o lead abre dois produtos com o mesmo peso (provar o teste /
   entregar a uma IA), que têm compradores e disposições a pagar diferentes.
   Agora o olho diz *"Evidência de teste sem Print Screen e Word"*, o H1 diz
   **"Execute os casos. O Walkstamp organiza a prova."**, e o lead abre pela
   planilha e fecha pelo roteiro devolvido com situação, data e executor. A
   categoria passou a ser *execução e comprovação de casos de teste*; "gravação
   → documento" virou o mecanismo, que é o que sempre foi.

   E a primeira dobra ganhou **dois caminhos**: o botão de sempre, de menor
   atrito, e um segundo — *"Ver como funciona o roteiro de casos"* — para quem
   chega com a planilha na mão e antes tinha de rolar a página inteira. Ele
   aponta para os preços e **não promete o trial**: enquanto você não confirmar
   que os 14 dias estão de pé em produção, o hero não vende o que não pode
   entregar. Trava: `medicao.mjs` [M6] passou a cobrar a manchete nova nos três
   idiomas que ele varre.
2. **A abertura de preços parou de contradizer o cartão — FEITO.** Ela dizia que
   o pago é *"a identidade do documento e a administração de uma equipe"* —
   escrita antes do B5, que passou a vender o Personal pelo roteiro. Do jeito
   que estava, a própria página comparava R$ 149/ano com "PDF com logotipo".
   Agora o H1 é **"Um caso avulso é grátis. O trabalho repetido e coordenado
   vira plano."** e o lead nomeia os três trabalhos. A promessa do gratuito
   continua inteira, uma linha abaixo. Trava: `planos.mjs` [8] — a abertura tem
   de nomear Free, Personal e Team, e não pode voltar a vender identidade e
   administração. Provada nas duas direções.
3. **Os absolutos de privacidade — FEITO.** *"Não há conta, não há banco de
   dados, não há rastreamento"* foi verdade e deixou de ser: existe conta nos
   planos pagos, existe banco, e existe a medição de três marcos. A frase ficou
   no ar depois que as três coisas passaram a existir — e uma promessa dessas,
   lida por quem avalia fornecedor, custa mais do que alguma vez rendeu.

   O conserto não foi apagar o absoluto, foi **dizer sobre o quê** ele é
   absoluto: *"não existe servidor que receba o seu vídeo"* continua sendo a
   frase mais forte da página, e é verdadeira. Cinco chaves reescritas nos cinco
   idiomas. Trava: `chaves.mjs` passou a reprovar o absoluto solto — banco e
   rastreamento não têm forma legítima, e a conta entra pela forma enumerada.
4. **O último "em breve" saiu do cartão — FEITO.** Sobrava um
   (`termosGuardados`), dentro das balas do Personal. Um item marcado assim no
   meio do plano obriga quem decide a separar, linha a linha, o que já se compra
   do que foi prometido — trabalho passado para quem está com o cartão na mão.

   Ele foi para uma **caixa do roteiro** abaixo dos cartões, dita com todas as
   letras e fora da conta. Travas: `planos.mjs` [9] proíbe selo dentro de
   qualquer cartão, e `cenarios.mjs` teve a asserção **invertida** — ela cobrava
   que o futuro estivesse marcado dentro do cartão, e agora cobra que não
   esteja, e que a caixa exista.
5. **As afirmações sobre Claude, ChatGPT e Gemini — FEITO, e reversível.**
   Capacidade de modelo muda em semanas; uma afirmação nominal de limitação
   envelhece virando mentira, e leva junto a credibilidade do resto da página.

   O argumento nunca dependeu dos nomes: vídeo cru é pesado, difícil de citar e
   nem sempre aceito pelo destino. A frase passou a dizer isso, com os 3.600
   quadros que a tornam memorizável. **A lista de compatibilidade continua
   nomeando os três** — ela é de outra classe: envelhece por falta, não por
   mentira. Trava: `chaves.mjs` proíbe o nome fora dessa lista. Se você quiser a
   comparação nominal de volta, ela custa uma página datada com protocolo e
   revalidação — e a trava sai junto com a decisão.
**Os sete estão feitos:**

6. **A demonstração do fluxo pago — FEITA na E4a.** O tour mostra gravação →
   documento, que é o Free. Faltava planilha → casos → evidência → planilha
   devolvida, que é o que se compra. Existe agora: `rodada.<lang>` em
   `public/demo/`, 47 segundos, nos cinco idiomas, na página de preços — e
   gerada pelo estúdio, percorrendo o produto, e não montada à mão.
7. **O funil jogava fora oito de onze eventos — FEITO no banco; falta ligar os
   quatro novos na conta.** A C1 tinha tirado a esteira de dentro da medida.
   Medindo de novo apareceu coisa pior: o produto chama `medir()` com **onze**
   nomes e a tabela aceitava **três**. Os outros oito morriam calados — uns
   batendo no `check` do nome (a função captura `check_violation` de propósito,
   para uma medição recusada não virar erro na tela), outros mandando
   parâmetros que a função não tem (`p_de`, `p_para`, `p_pct`, `p_via`,
   `p_telas`), e o `baixou_saida` em `pptx`, `html`, `md`, `csv`, `gdocs`,
   `jira` ou `vocabulario` batendo no `check` do formato e levando a linha
   inteira junto.

   E **`idioma` aceitava três dos cinco idiomas do site**: alemão e francês
   foram descartados desde sempre. O "de e fr têm zero eventos" não era
   tráfego — era o banco jogando fora.

   A migração `20260822050000` faz o banco aceitar o que o produto já mandava,
   com vocabulário fechado em cada campo, e abre os quatro de intenção paga
   (`importou_roteiro`, `concluiu_caso`, `comecou_teste`, `comecou_pagamento`).
   Os dois eventos que queriam contagem exata passaram a mandar **faixa**.

   Travas: `testes/funil.mjs`, estático e sem banco — ele lê o vocabulário da
   migração e as chamadas do `template.html` e reprova quando os dois deixam de
   bater, inclusive o conjunto declarado de cada expressão dinâmica; e
   `10-fumaca.sql` [10], que prova o comportamento.

   **E os quatro estão ligados.** A área da conta não media nada — um evento
   declarado no banco e nunca disparado é pior que nenhum, porque o zero parece
   resposta. `importou_roteiro` e `concluiu_caso` saem do roteiro (o segundo só
   quando o caso é concluído, nunca quando é desfeito: contar conserto como
   valor entregue inflaria o único número que diz se o roteiro está sendo
   usado); `comecou_pagamento` sai do checkout, **antes** do `redirect`, que no
   Next funciona lançando — medir depois seria uma linha que nunca executa; e
   `comecou_teste` só conta quem **não** é assinante, porque a mesma porta emite
   a chave do teste e a de quem já paga.

   E a medição do servidor **respeita Do Not Track**. `navigator.doNotTrack` não
   existe do lado de cá, e a saída preguiçosa seria dizer que DNT é coisa de
   navegador — mas o cabeçalho vem em toda requisição, inclusive na que dispara
   a ação. Quem desligou o rastreamento desligou o rastreamento, e não "o
   rastreamento feito por JavaScript".

   Com isto o item 7 fecha — e o item 6 fechou na E4a, o que fecha o D0
   inteiro.

#### D1 — para levantar conversão: **seis dos sete feitos** (1,5–2 d restantes)

**Feitos:**

- **antes e depois, logo abaixo do hero.** A home explicava o mecanismo e nunca
  dizia de qual trabalho ela toma o lugar. Quatro linhas, na ordem em que o dia
  acontece, cada uma apontando para uma peça que já existe. É tabela de verdade
  com `scope="col"`, porque o valor está na linha;
- **resumo dos planos na home, antes do FAQ.** A home empurrava só para o Free —
  o Personal só aparecia na página de preços, então quem chega com uma planilha
  na mão tinha de adivinhar que existe um plano para isso. Os três descritos
  pelo **trabalho** que fazem;
- **quatro formatos na frente, o resto a um clique.** Treze fichas na primeira
  rolagem faziam a página parecer um conversor de arquivo — a categoria errada.
  Nenhum sumiu: os treze continuam na página, e a régua conta os dois lados.

Travas: `planos.mjs` [10] e [11] — as doze frases do antes/depois e as onze do
resumo nos cinco idiomas, a contagem de fichas dos dois lados, e o Personal do
resumo obrigado a falar da planilha e não da marca (senão o B5 se desfaria pela
porta dos fundos, numa seção que nenhuma régua olhava).

- **o FAQ comercial.** As sete perguntas antigas respondem *"isto funciona?"*.
  Quem está decidindo pagar tem outras seis, e elas não estavam em lugar nenhum
  do site — a pessoa tinha de escrever perguntando, e a maioria não escreve.
  Cada resposta foi conferida no código antes de ser escrita, e **uma mudou por
  causa disso**: a análise supunha Jira, Zephyr e TestRail no fluxo, e só o Jira
  existe — como resumo para colar, não como integração. A resposta diz isso com
  todas as letras, e a régua obriga a continuar dizendo.

- **a ponte do primeiro documento para a rodada.** O painel de conclusão é o
  único instante em que a pessoa já **provou** que a ferramenta serve — ela tem
  o documento na mão e o trabalho acabou. É a única hora em que uma pergunta
  comercial não atravessa nada. Uma linha e um link, sem peso de botão: uma
  oferta com cara de ação transformaria o *"pronto"* num *"agora pague"*.

  Ela **não muda com o plano**, de propósito: o endereço resolve o estado
  sozinho. Ler o plano no navegador para escolher a frase daria a frase errada
  em toda a janela entre o pagamento e o `/api/menu` responder.

- **o onboarding do roteiro.** A tela vazia era o primeiro obstáculo de quem
  acabou de assinar: arrumar uma planilha no meio do expediente é o tipo de
  tarefa que fica para depois e nunca acontece — e aí o primeiro caso concluído,
  que é a métrica do plano, nunca sai. O exemplo entra pelo **mesmo caminho** da
  planilha de verdade: preenche o campo de colar e manda o mesmo formulário.
  Nada é fabricado no servidor, e nada é gravado antes de salvar.

**Falta um:** o exemplo reproduzível com planilha, vídeo e saídas para baixar
(1,5–2 d) — e ele precisa de material seu.

#### D3 — a parede da avaliação de fornecedor (2,5–3 d restantes) — **na frente da D2**

Veio de uma observação sua: *"a questão sempre foi a política de privacidade das
empresas, e isso permitir não esbarrar nessa parede"*. A análise inteira está em
`A-PAREDE-DA-AVALIACAO.md`; o resumo é que a página vende **uma postura** ("nada
sai do seu computador") quando o que o comprador precisa comprar é **um atalho**
("você não precisa abrir um processo de avaliação para usar isto"). É a mesma
verdade; a segunda tira seis semanas do caminho.

E há um buraco caro, hoje catalogado como falha de teste: **os dois artefatos
feitos para o revisor de segurança — a tabela de suboperadores e o DPA — existem
só em português**, enquanto o produto vende em cinco idiomas. É o ponto mais
avançado do funil que existe, e é onde outra pessoa (segurança, jurídico, DPO)
entra no fluxo lendo.

1. ~~traduzir a tabela de suboperadores para os quatro idiomas~~ — **FEITA**.
   Sete linhas por idioma: quem é, o que faz, que dado recebe, em que país e sob
   qual salvaguarda. O `terceiros.mjs` passou a verde pela primeira vez desde
   que a tabela existe — ele varre o **código** atrás de terceiros e exige que
   todos apareçam na tabela dos cinco idiomas, então a régua acompanha o
   produto e não a redação;
2. o DPA nos cinco idiomas (1–1,5 d);
3. a página *"avaliação de fornecedor em uma tela"* (1 d), escrita para quem
   preenche questionário — incluindo a resposta à pergunta de certificação, que
   é boa e incomum: não há o que certificar no caminho do dado porque o dado não
   percorre caminho nenhum;
4. reposicionar "sem cadastro" na home (0,5 d): de conveniência para *"não há
   fornecedor recebendo nada"*;
5. os trinta segundos com a rede desligada — depende de você gravar.

#### D2 — depois de três pilotos (não estimável ainda)

Prova social real com nome, cargo e autorização; números só com amostra, contexto
e método; teste de verticalização e de preço do Team. **Nada disto antes de
haver piloto** — a análise é explícita em não inventar logotipo, depoimento nem
número, e essa é a regra que mantém a página crível.

#### O que precisa de decisão sua, e não minha

- **O trial de 14 dias está de pé em produção?** Se não estiver, o CTA
  secundário do hero é "Ver um caso completo", e não "Testar o roteiro".
- **A comparação nominal com Claude, ChatGPT e Gemini fica ou sai?** Ficar custa
  uma página datada e revalidação periódica.
- **Moeda:** BRL, USD e EUR juntos, ou detectar a localidade?

### Trilha E — a reanálise da venda, versão 2 (2–3 d restantes)

A fonte é a **Reanálise do site e nova proposta de venda**, de 22/08, que está
inteira em `ANALISE-DA-VENDA-2.md`. Ela é a segunda passada — a primeira virou a
Trilha D — e a diferença de método importa: a v1 leu a página de preços, a v2 leu
o site inteiro contra o código, incluindo o catálogo de funcionalidades e os
testes das features pagas. Por isso ela acha uma classe de defeito que a v1 não
podia achar: **o site nega coisas que o produto faz.**

A tese comercial dela, que eu aceito:

> Walkstamp transforma uma execução de sistema em evidência pronta, liga essa
> evidência ao caso de teste e devolve o controle da rodada para quem coordena.

E o arco de planos que sai daí — **Free cria, Personal repete, Team coordena,
Cloud acelera** — é o mesmo que a D1 já escreveu nos cartões (`plFreeD`,
`plPersD`, `plTimeD`), nos cinco idiomas. Nesse ponto as duas análises
convergiram sem combinar, o que é um sinal razoável de que o arco está certo.

#### O que a v2 pede e as trilhas B e D já entregaram

A v2 foi escrita contra o site de **antes** dos builds B1–B5 e D0–D1. Seis dos
seus P0/P1 já não existem, e vale não refazer:

| O que a v2 aponta | Onde já foi resolvido |
|---|---|
| P0 — o plano parece disponível e indisponível ao mesmo tempo | **B4**: uma verdade só sobre o trial |
| P0 — cartões dizem "em breve", catálogo diz que existe | **B1**: `breve` virou a fonte única, e o cartão lê dela |
| P0 — o site vende identidade, o código pago entrega orquestração | **B5**: a manchete passou a ser o roteiro, não o logotipo |
| P0 — RPCs pagas sem migração no Git | **B3** + as seis migrações aplicadas em produção em 22/08 |
| P0 — dois webhooks Stripe aparentes | **B2**: um só, no Next, com idempotência por evento |

Dois que eu quase dei por feito sem conferir — e os dois estavam de pé: o P1 do **"sem login"**. A minha
primeira leitura desta tabela dizia que a D1 tinha resolvido, porque "sem
cadastro" tinha ficado só no cartão Free. Não tinha: o cartão **Team** da página
de preços terminava, nos cinco idiomas, em *"sem login e sem exigir cadastro
para a sua TI aprovar"* — três linhas abaixo de *"painel de assentos: convidar,
bloquear e escolher o prazo"*. Uma contradição dentro de um cartão só, e a que
custa mais caro: quem avalia lê "sem cadastro", descobre a conta por magic link,
e para de acreditar na página. Corrigido junto com a E1, e agora a frase diz a
verdade, que é melhor do que a mentira era: **quem grava não faz login** — a
licença viaja no link e é conferida no computador de quem executa (`LIC_PUB`,
verificação offline por construção) — e **conta existe só para quem coordena**,
que é onde moram os assentos e as faturas.

E o P2 do **Pro/API**. Eu tinha escrito aqui que ele "morreu sozinho, `grep` não
acha" — só que eu procurei por "Pro/API" e "API pública", e ele está escrito como
*"Quer ser avisado do Pro e da API?"*. Está lá inteiro: uma `<section>` com
título, formulário de lista de espera e banco, entre os planos e o FAQ. O texto
em si é honesto (*"nada disso existe ainda"*), então isto **não** é defeito de
verdade como os outros três — é ocupação de espaço nobre por algo que não se
compra, e a lista já tem gente inscrita. Fica na E3, e a decisão de tirar é sua,
não minha.

#### E1. As três negações que estavam mentindo: **FEITA**

Esta é a descoberta da v2, e ela é melhor do que a v2 sabia. As páginas de caso
terminam com uma seção honesta — *"o que ele não faz — e é melhor saber antes"*.
Ela é provavelmente a melhor parte do site: quem faz avaliação de fornecedor lê
aquilo e passa a acreditar no resto. **E ela apodrece sozinha**, porque nada no
build ligava um parágrafo de negação à funcionalidade que ele nega. Uma feature
saía de "em breve", chegava ao produto, entrava no catálogo — e a página seguia
dizendo que ela não existe.

Três estavam nesse estado, nos cinco idiomas:

1. **O clipe de 15 s.** `casoUx` dizia *"ainda não guarda o clipe de vídeo do
   momento marcado … é o que está em construção"* — trinta linhas depois de a
   **mesma página** dizer *"só os 15 segundos em volta do que você marcou são
   guardados"*, e com o clipe existindo no produto (`#recClipe`, `#lenteClipe`,
   `#clipeBaixar`, e ele sai no `.zip`) e no catálogo como pronto e gratuito.
   Numa página de pesquisa de usabilidade, esse é o parágrafo que decide a
   compra, e ele estava negando exatamente a peça que a página diz ser a mais
   pedida.
2. **A revisão assistida.** `casoIn` dizia *"o que ainda não existe é a
   ferramenta te guiar por ele perguntando 'esta tela ainda está assim?'"* — que
   é, palavra por palavra, o que `revAbrir`/`revPintar` fazem desde que o painel
   entrou. A mesma página, no parágrafo 11, já mandava *"deixe a revisão
   assistida conduzir"*. Ela se contradizia sozinha em duas telas de distância.
3. **O mínimo do Team.** `casoUx` mandava a agência de três pessoas para o Team;
   o Team começa em **cinco** assentos no `lib/stripe.ts`. Duas regras públicas
   diferentes sobre quem pode comprar o quê — e a que estava na página do caso
   era a que o cliente lia primeiro.

As três foram corrigidas nos cinco idiomas. As duas primeiras não viraram
silêncio: o slot continua sendo uma negação, e o que entrou no lugar é verdade
verificada no código — *"não guarda a sessão inteira em vídeo"* (o clipe existe,
é opt-in, e o descarte do resto é o que torna sessão de cliente viável) e *"não
controla versão nem guarda a trilha de aprovação"* (o cabeçalho tem o campo
versão, mas quem aprova e o que está valendo continua no sistema de gestão de
mudanças da empresa — o próprio produto já dizia isso em `pNoteRel`).

**A trava** é o `testes/promessa.mjs`, e ela é a parte que dura. Cada parágrafo
de negação carrega `data-nao="nome"`; o catálogo identifica as funcionalidades
por `id`; e o teste reprova quando um nome negado coincide com um `id` anunciado
como pronto. Ele também exige que o registro seja idêntico nos cinco idiomas — se
não fosse, bastaria a tradução alemã perder a marcação para a negação alemã
voltar a mentir sozinha — e confere o mínimo do Team contra o `lib/stripe.ts`, em
número por extenso, nas cinco línguas. Provado nas duas direções: devolver
`data-nao="clipe"` reprova em cinco pontos e imprime a linha do catálogo que o
contradiz.

O efeito de segunda ordem é o que interessa: **daqui para frente, uma feature que
sai de "em breve" não consegue chegar ao `main` sem que alguém volte na página de
caso e reescreva a frase.** Era exatamente o passo que ninguém dava.

#### E2. O vocabulário de estado da funcionalidade: **FEITO**

A v2 pede que "pronta" pare de significar "existe código" e passe a significar
seis coisas: está em produção, está no plano certo, tem teste de ponta a ponta,
está documentada, é suportável e é medida. E propõe estados únicos no catálogo:
`produção`, `beta`, `em construção`, `descoberta`.

O catálogo tinha **dois** estados — `breve: true` ou nada — e "nada" queria
dizer duas coisas diferentes que ninguém separava: o que está pronto, e o que
**funciona mas tem uma ressalva que quem compra precisa saber**.

`estado` agora é um campo só, com quatro valores, e a ausência dele quer dizer
`producao`. **`breve` foi absorvido, não duplicado** — duas listas para a mesma
verdade é como este projeto já perdeu o `hreflang` de dois idiomas e deixou o
tour em inglês numa página alemã, duas vezes.

**A classificação saiu de leitura de código, e não de palpite.** A seção 9 da v2
marca quatro funcionalidades pagas como de "prontidão incerta". Conferindo cada
uma:

| Funcionalidade | A v2 dizia | O que o código mostra | Estado |
|---|---|---|---|
| Padrão do time | incerta | `aplicarPerfil()` empurra empresa, rótulo, ambiente, papel, layout e hash — e perde para a mão de quem está com o caso aberto | `producao` |
| Modelo persistente | incerta | `time_modelo` grava, `pintarModelosDoCliente()` reaplica, vem da conta | `producao` |
| Vocabulário persistente | incerta | é o único item que não existe | `construcao` |
| Entrada por domínio | só com domínio verificado | tabela e concessão existem; **sem tela e sem prova de posse** | `beta` |

Duas das quatro estavam prontas e a análise julgou de fora do código. A quarta é
a que dá razão a ela, e vale escrever por extenso porque é a que interessa: o
catálogo vendia **"Entrada automática por domínio de e-mail"** como pronta. A
tabela existe e a licença concede por domínio — mas **não há tela para a empresa
cadastrar o domínio, nem prova nenhuma de que ela é dona dele**. As linhas entram
à mão. Vendida como pronta, ela promete um self-service que não existe; e foi por
esse mesmo caminho que `modelo.example` acabou concedendo Team na produção.

Agora ela sai da tabela com o selo `beta`, e a página traz uma **legenda** que
diz o que cada selo quer dizer — nos cinco idiomas. "Beta" numa tabela de preço,
sem explicação, é a palavra que faz a avaliação de fornecedor parar e perguntar.

**A trava** cresceu no `promessa.mjs`: nenhum estado fora do vocabulário de
quatro (campo livre vira `beta`, `Beta`, `em beta`, `parcial` e `quase` em seis
meses, e aí nenhum teste consegue mais perguntar nada); todo estado em uso tem
palavra nos cinco idiomas; a legenda está nas cinco páginas; e `breve` não
sobrevive em lugar nenhum — nem no dado, nem em quem o lia.

E ela achou um defeito na hora em que entrou: o alemão **explicava o selo com a
palavra errada**. O parágrafo dizia "o que está marcado *bald* ainda não existe"
enquanto o selo dizia *demnächst* — o leitor era mandado procurar uma palavra que
não está escrita em lugar nenhum da página. O `planos.mjs` já cobrava uma palavra
por selo, mas só nas balas com `data-f`, que é por onde ele acha o item no
catálogo; a prosa que EXPLICA o selo ficava fora. Agora a varredura é da página
inteira.

**O que continua sendo seu:** classificar as outras 92. Eu só mexi no que
consegui verificar; supor estado de funcionalidade lendo o nome dela seria
repetir, do meu lado, o erro que a E1 acabou de consertar.

#### E3. A página de preços, reordenada: **FEITA**

Quatro mudanças de ordem e de texto, nenhuma delas de verdade — a página já não
mentia depois da E1; ela estava mal arrumada.

**A prova de privacidade subiu.** O parágrafo *"continua sem servidor, inclusive
no pago — não recebemos o seu vídeo nem o seu áudio em plano nenhum"* estava
**depois da tabela de noventa e três linhas**. É a primeira coisa que quem faz
avaliação de fornecedor procura, e a única que decide se o resto da página vale
ser lido — e estava depois do ponto a que essa pessoa chega. Agora vem antes dos
cartões, nos cinco idiomas.

**Cada CTA diz o resultado, e não o gesto.** "Abrir a ferramenta" → *"Criar uma
evidência agora"*; "Começar os 14 dias" → *"Testar o Personal por 14 dias"*;
"Falar sobre o Team" → *"Receber o link do Team"*. Este último é onde a v2 pede
*"Agendar um piloto do Team"* e eu não segui: a página do Team entrega **um
link**, não uma reunião marcada. "Agendar" seria a mesma classe de defeito que a
E1 acabou de consertar.

**Faturas e chamados saíram das balas de valor do Team** e viraram uma frase no
rodapé do cartão, junto com o resto da higiene — que é o que a v2 pede na seção
9. E aí o `cenarios.mjs` reprovou por desequilíbrio (6/5/**4**), o que levou à
descoberta que vale mais do que a arrumação toda:

> **O cartão Team não mencionava atribuir casos e acompanhar quem concluiu.**
> Vendia entrada por link, perfil de equipe e painel de assentos — a higiene — e
> não vendia aquilo para que o plano existe. A coisa que o vídeo da E4a mostra
> em quarenta e sete segundos, e que a v2 chama de "benefício principal", não
> estava escrita no cartão que cobra por ela.

Ela entrou como primeira bala, nos cinco idiomas: *"divida a rodada e acompanhe:
atribua cada caso a uma pessoa e veja quem concluiu o quê — com data, arquivo e
impressão digital, e a planilha volta com tudo isso dentro."*

**A lista de espera do Pro/API desceu** para depois da última seção. Ela ocupava
o lugar nobre entre os planos e o fim da página com algo que não se compra — a
própria seção diz que "nada disso existe ainda". Não saiu, porque o texto é
honesto e a lista já tem gente inscrita: desceu. Quem chegou para decidir entre
três planos decide primeiro.

**O que ficou de fora, e é seu:** a comparação curta da 7.4 já existe (feita na
E4b), mas a **prova da seção 7.6** depende de material seu — o exemplo real de
planilha antes/depois e o PDF/Word de saída para baixar. Sem eles, a página
mostra o vídeo e não deixa ninguém conferir.

#### E4a. A demonstração central da seção 7.3, e o defeito que ela achou: **FEITA**

A v2 pede, na 7.3, quatro passos visuais mostrando a rodada — *"essa demonstração
vende mais que a tabela de 93 itens"*. Ela existe agora, e é um **vídeo de 47
segundos** na página de preços, nos cinco idiomas, gerado como os outros dois:
`estudio/gravar-roteiro.mjs` sobe um Next de verdade com um Supabase de mentira
do outro lado e percorre o produto — a planilha de quarenta casos, o link do
caso abrindo a ferramenta já preenchida, a execução gerando a evidência, o
recibo, a confirmação, e a linha voltando fechada com data, executor e impressão
digital. Se a tela mudar de forma incompatível, ele quebra na hora de gravar.

**E gravar isso achou um defeito que estava custando a rodada inteira.**

O botão "marcar este caso como feito" nasce dentro do `baixarBlob()`, por onde
passam DOCX, PPTX, ZIP, SCORM, HTML e Markdown. **O PDF não passa por lá** — ele
sai pelo `doc.save()`, a porta do próprio jsPDF. E o PDF é a saída *recomendada*
para o cenário de evidência, ou seja: o botão grande que o produto pede para
clicar. Quem chegava pelo link de um caso, extraía e clicava nele gerava o
documento e **não recebia a volta**. A rodada paga não fechava pelo seu próprio
caminho principal, e sem erro nenhum: o PDF baixava, o painel dizia "pronto", e o
botão simplesmente não existia. A pessoa concluía que precisava avisar o
coordenador na mão — que é exatamente o trabalho que o plano vende ter eliminado.

O mesmo lugar já tinha sido remendado uma vez pelo mesmo motivo. O comentário ao
lado do `doc.save()` conta que sem uma linha ali o PDF era *"a única saída do
produto que não contava que tinha saído"*: consertaram a medição e não a volta.

**A trava** é o `testes/voltadocaso.mjs`, e ele cobra as **duas** portas — PDF
pelo `doc.save()`, DOCX pelo `baixarBlob()` — exigindo que a volta apareça só
depois de existir documento, aponte para o caso certo, e leve o nome do arquivo
e a impressão das telas. Provado nas duas direções: com o conserto revertido,
o bloco do PDF reprova em quatro pontos e o do DOCX passa — que é exatamente a
assimetria que abriu o buraco.

De quebra, o estúdio deixou de ter caminho absoluto (`/root/cc/walkstamp` em
três arquivos), que era o P0 nº 10 da seção 10 da v2 — e o mapa de endereços da
tela do roteiro passou a sair do `rotas.json` em vez de ser escrito à mão: a
lista à mão estava errada em duas línguas (`faelle`/`cas` em vez de
`testfaelle`/`cas-de-test`), e alemão e francês não gravaram por causa disso.

#### E4b. A calculadora de ROI, e a comparação da 7.4: **a comparação FEITA**

A comparação curta da seção 7.4 está de pé, nos cinco idiomas: seis linhas de
resultado — criar a evidência, executar uma planilha, devolvê-la preenchida,
guardar o padrão, atribuir e acompanhar, impor o padrão — acima da tabela de
noventa e três. O `promessa.mjs` cobra que a forma seja idêntica nas cinco
línguas: se uma tradução perder uma linha, ou marcar como incluído no Free algo
que o Free não tem, a página passa a vender coisas diferentes em línguas
diferentes e ninguém que fala uma delas percebe.

Falta a **calculadora de ROI** (7.5)

— e ela depende de um número que é seu: quantos minutos custa,
de verdade, montar uma evidência à mão na sua operação. Enquanto esse número não
existir, a calculadora **não deve subir**. Uma calculadora de ROI com número
inventado é a mesma classe de defeito que a E1 acabou de corrigir, só que virada
para o outro lado — e é pior, porque tem casas decimais.

#### O que eu não vou fazer da v2, e por quê

- **Homologação separada** (P0 nº 9 da seção 10) é certo, mas é ambiente, não
  código, e custa mais do que a trilha inteira. Fica registrado como decisão sua.
- **Chargeback e reconciliação** (P0 nº 3 e 4) exigem o Stripe em modo real com
  webhook público — não dá para provar daqui, e provar pela metade é pior do que
  não provar.
- **"Remover caminhos absolutos dos testes"** (P0 nº 10) já foi: `_caminhos.mjs`
  existe e `RAIZ_WS`/`CHROME_WS` são o que a suíte usa.

---
### Trilha C — motor e dívida (8–12 d)

#### C1. Build 5 — medir antes de otimizar: **FEITA**

O arquivo tinha **39 `performance.now()` e zero `performance.mark()`**. A diferença
não é de estilo: um `now()` avulso calcula uma diferença, mostra numa frase e joga
fora — o número existe no instante e some. Sem ele não se compara duas execuções,
nem duas máquinas, nem a mesma máquina antes e depois de uma mudança. Toda decisão
de motor era palpite com cara de decisão.

As **oito fronteiras** que o plano pedia estão marcadas, e três delas ganharam
detalhe que não existia:

- **rede e sessão são tempos separados dentro do mesmo degrau** (`ms_download` /
  `ms_sessao`). Um degrau lento era ambíguo: rede ruim e máquina ruim rendem o
  mesmo cronômetro e pedem decisões opostas;
- **os degraus que perderam contam.** `mbBaixados` soma o caminho inteiro, e não o
  arquivo que venceu — foi assim que uma máquina real gastou 353 MB antes de uma
  sessão subir;
- **mais de uma construção por aba é o caso normal** (a cortesia adianta o modelo
  enquanto a pessoa escolhe o arquivo). A régua conta quantas houve; o relógio da
  escada é o da última.

Nada disso sai da máquina: é `window.__medidas()`, para quem estiver medindo.

**As amostras versionadas** (`python3 testes/amostras.py --medida`) são de 1, 10 e
40 minutos, com `sha256` e versão de receita num manifesto que viaja dentro do JSON
de saída — dois números só se comparam se o insumo for o mesmo arquivo. Elas **não
são fala de verdade**: não há sintetizador de voz na máquina, o áudio é um tom, e o
tempo medido é um **piso**. O campo `fala` do JSON diz isso em cada linha.

**A régua** é `node testes/regua.mjs` (`--amostras`, `--linhas`, `--cache`,
`--placa`, `--repetir`, `--saida`); as quatro linhas do wasm exigem servir a página
com COOP e COEP, senão o runtime cai para uma sozinho. **A aferição da régua** é
`node testes/marcos.mjs`, que roda sem rede com a biblioteca falsificada e faz os
dois primeiros degraus falharem de propósito. Tudo em `testes/REGUA-DE-DESEMPENHO.md`.

**O primeiro número da série:** `enviadoSobreOriginal` = **1,00**. O modelo recebe
hoje exatamente o áudio que o vídeo tem. É a linha de base que precisava existir
antes de alguém mexer na compactação de silêncio — o C3 depende dela.

**E a pergunta aberta virou outra pergunta.** O inglês abre 51 vezes e converte
zero, mas os eventos não carregam IP, navegador nem sessão — de propósito —, então
"são robôs ou é funil quebrado?" **não é respondível com este instrumento**. Pior:
medindo para responder, apareceu que o instrumento estava sujo. Entre 23h09 e 01h52
de uma noite em que ninguém abriu o produto, **43 marcos entraram na base de
produção** — dois deles em inglês. Era a esteira de testes: o endereço da medição é
assado no `app.html`, e a regressão abre esse mesmo arquivo em `localhost` dezenas
de vezes por dia, sem guarda nenhuma. O funil que a gente lia era o público somado
à régua, em proporção que não dá para separar depois.

`medir()` passou a calar em origem de desenvolvimento (`localhost`, `127.*`, `::1`,
`.local`, rede privada, `file:`), por regra de origem e não por lista de domínios.
Só `testes/medicao.mjs` abre a porta de serviço, porque é ele que cobra o conteúdo
do envio — e ele ganhou o bloco **[M1b] a régua não conta como gente**. Está tudo
em `MEDICAO-E-O-INGLES.md`, com o que fazer: **medir de novo**, agora que a régua
saiu de dentro da medida.

#### C2. Build 6 — menos árvore, menos download: **feita a parte que decide**

A escada descia **inteira**, degrau por degrau, qualquer que fosse o motivo da
queda. Isso custa tempo e banda — e, num caso, custa a última chance: numa
máquina sem memória, insistir e subir para o degrau de 200 MB é garantir que ela
morra com o arquivo maior na mão, depois de ter baixado tudo.

Agora cada queda é **classificada por sintoma**, e cada sintoma diz o que não
adianta tentar:

| sintoma | o que a escada deixa de fazer |
|---|---|
| **memória** | para de subir: tudo que baixa mais que o anterior sai da fila |
| **rede** | pula os degraus do mesmo repositório — só o que troca de repositório muda algo |
| **404 / falta** | idem, e com mais razão: o arquivo não passa a existir na segunda tentativa |
| **runtime quebrado** | encerra a escada deste ambiente: não é o modelo, é o motor |
| **sessão** | segue como antes (já tratado desde antes, pelo `marcarSemQ4`) |

O que não casa com nenhum padrão volta `null` e a escada desce como sempre
desceu — **não saber a causa não pode ser motivo para tentar menos**. E o degrau
pulado entra no registro como pulado, com o motivo: um degrau que some faz a
escada parecer mais curta do que foi.

Medido na régua, com uma máquina sem memória simulada: **11 degraus pulados e
1.438 MB poupados** numa única montagem. `marcos.mjs` [9] prova, e o número sai
de `mbPoupados`, que é o que este build existe para produzir.

**As versões: metade feita, e a outra metade precisa de você.** `TJS_BASES`
começa num `@3` **flutuante** — um lançamento 3.x do CDN troca a biblioteca do
produto sem ninguém tocar em nada. Pior: até agora não havia registro de qual
versão rodou em cada medição, então dois números de desempenho podiam ser de
bibliotecas diferentes sem que isso aparecesse. Agora a versão que subiu entra
no marco `modelo.pronto`. **Fixar** exige conferir no CDN quais versões existem,
e isso não dá para fazer daqui: o proxy deste contêiner bloqueia o jsdelivr.

**O aviso antes do fallback caro já existia** (`tentandoCaro`, com os megabytes
na frente) e continua — agora com a diferença de que, na maioria dos casos que o
faziam aparecer, a escada nem chega lá.

#### C3. Build 10 — a dívida: **o pico de memória está medido**

O primeiro dos quatro, e o que os outros dependiam. A escada já protege a
máquina que fica sem memória (build 6), mas **proteger não é entender**: a
pergunta que decide o que otimizar é se o pico é a leitura do arquivo, o buffer
de áudio decodificado ou a sessão do modelo — e cada resposta manda mexer num
lugar diferente.

A amostragem acontece **dentro do `marco()`**: as fronteiras que a régua já marca
são exatamente os instantes em que o pico pode ter mudado, então não há um
relógio a mais correndo por conta disso. Mais uma amostra por trecho de
inferência, que é a janela em que o modelo tem mais tensores vivos.

`performance.memory` é do Chrome e mais ninguém. A medida diz **`null`** onde a
informação não existe — um zero ali seria pior, porque se soma e se compara com
os zeros de verdade.

**A primeira leitura já aponta para onde ir**, e vale ler com a ressalva:
numa amostra de 10 s, com a biblioteca falsificada (ou seja, **sem sessão de
modelo alocada**), o pico ficou em `audio.decodificado`. O buffer de áudio cresce
**linear com a duração** — 16 kHz em float32 dá ~64 KB/s, e 40 minutos ≈ 154 MB —
enquanto a sessão do modelo é fixa. Se isso se confirmar numa corrida com modelo
de verdade, **a compactação de silêncio ataca o pico**, e não só o tempo: seria a
primeira evidência de que a ordem da C3 está certa. `enviadoSobreOriginal` = 1,00
continua sendo a linha de base contra a qual medir.

**E o WER está medível — o que era o portão da compactação de silêncio.**

Duas perguntas diferentes usam o mesmo instrumento, e confundi-las é o erro
comum. WER contra transcrição **humana** responde *"o modelo entende esta
fala?"* e precisa de áudio real com texto conferido à mão — as amostras desta
régua têm um tom no lugar da fala, então essa leitura não sai daqui. WER contra
a **linha de base** responde a que decide: *"o que eu acabei de mexer alterou o
texto?"*. A dúvida antes de comprimir silêncio não é se o Whisper é bom; é se
comprimir piora o que ele já produzia — e isso se mede sem transcrição humana
nenhuma.

```
node testes/regua.mjs --base=/tmp/base.json     # grava a linha de base
node testes/regua.mjs --wer=/tmp/base.json      # compara depois de mexer
```

Duas decisões do instrumento: a chave da comparação leva o **`sha256` da
amostra** (comparar com uma amostra diferente daria um WER alto que não quer
dizer nada), e **a remoção sai destacada** dos outros erros — trocar trinta
palavras espalhadas e perder um parágrafo têm o mesmo tamanho na conta e
consequências opostas, e é a segunda que importa aqui. `wer.mjs` afere o
instrumento com casos de resposta conhecida.

**A máquina de estados do motor: feita, e ela fechou uma porta que ainda
estava aberta.**

O estado do motor morava em **sete variáveis** que podiam se contradizer —
`pipe`, `montando`, `usandoPipe`, `adiantando`, `trocaPedida`, `ultimoErroModelo`
e o meio-termo de soltar. Cada proteção contra concorrência foi escrita
separado (a fila do `trocarPipe`, o laço de drenagem do `soltarPipe`), e cada uma
resolve o seu caso sem que exista um lugar que diga **onde a coisa está**.

Agora há um nome só — `ocioso`, `montando`, `pronto`, `inferindo`, `soltando`,
`caido` —, e ele é **derivado**, não guardado: um campo `estado` escrito à mão
seria a oitava variável a se contradizer com as outras sete, e a primeira a ficar
para trás num caminho de erro. Mesma decisão da barra de etapas.

**A porta que estava aberta:** `soltando` era o único estado sem nome. Entre
`pipe = null` e o `dispose()` terminar há uma janela em que o motor não está
pronto, não está montando e não está inferindo — e uma montagem que começasse ali
alocaria o modelo novo com o velho ainda residente. É o vazamento da décima
primeira rodada pela porta que tinha sobrado: a fila do `trocarPipe` cobria
montagem contra montagem, e essa janela ficava de fora. `garantirPipe` passou a
esperar quem está soltando.

**Falta um:** modularizar a fonte.

---

## Fora da fila, com você

- **sitemap** — precisa do `build.py` depois de aplicar;
- **figura do blog** — precisa de deploy; até lá, exportar abaixo de 1 MB;
- **a branch remota velha** `claude/ux-build-continuation-2hs0b2`, parada em `f505ea8`:
  apagá-la faz o contador de commits parar de mentir, e ela não tem nada que já não
  esteja no `main`.

---

## O total

| Trilha | Dias | O que você tem no fim |
|---|---:|---|
| A — terminar o UX | **1–2** | o redesenho inteiro, com acessibilidade validada |
| B — destravar a venda | **feita** | uma verdade só, cobrança auditável, banco reconstruível |
| D — posicionamento e venda | **5,5–7** | treze dos quinze itens feitos; da D3, a tabela de suboperadores já está nos cinco idiomas |
| C — motor e dívida | **8–12** | C1 e C2 feitas; da C3 falta só modularizar a fonte |
| E — a reanálise, versão 2 | **0,5** | E1, E2 e E4 feitas: o site parou de negar o que o produto faz, a rodada paga tem vídeo — e voltou a fechar pelo PDF — e cada funcionalidade tem um estado |
| **Total** | **16–23,5** | |

A ordem era **A → D0 → D1 → C2 → C3**; a D e a C1/C2 estão feitas, a C3 está em curso, e a
E entrou depois — a E1 na frente de tudo, porque uma página que nega o que o produto
faz custa a venda antes de qualquer otimização. A D vem antes da C pelo mesmo motivo que a
C1 veio antes da C2: acelerar um motor que ninguém contratou acelera a coisa
errada.

---

## O que não fazer

Aumentar threads além de quatro sem medir captura concorrente · trocar o modelo padrão
antes de comparar tempo e qualidade em áudio representativo · VAD neural só para ter VAD ·
virtualizar a grade para resolver lentidão de transcrição · **transcrição na nuvem como
fallback automático** — ela toca a promessa mais sensível do produto e só pode existir
como escolha explícita, com preço, região e retenção à vista · API genérica de frames +
transcrição, que vira commodity: a defensável é a de **evidência estruturada** · remover
os fallbacks (eles ficam seletivos, não desaparecem) · converter o artefato final em
bundle: modularizar a **fonte** preserva o HTML único.

# Melhorias de produtividade — o que mudou

Branch: `melhorias-produtividade` · base: `edc4124`
Build: `next build` passa · `tsc --noEmit` limpo.

## Antes de subir

Rode **uma vez** no SQL Editor do Supabase:

```
fx_visoes_salvas.sql
fx_lancamento_rateios.sql
```

São os dois únicos passos manuais. Se você não rodar, o app continua funcionando: a barra de
visões some silenciosamente (`listarVisoes` devolve lista vazia quando a tabela não
existe) e todo o resto — URL, linha rápida, desfazer, ⌘K — segue igual. O mesmo vale
para o rateio: sem a tabela, salvar avisa e o lançamento segue com um centro só.

## Testes

`npm run test:regras` — 30 asserções sobre rateio e atalhos de data, as duas peças
onde erro silencioso sai caro (rateio desequilibra o relatório por centro; data
errada joga lançamento no mês errado). Não precisa de framework.

## Arquivos novos

| Arquivo | O que é |
|---|---|
| `fx_visoes_salvas.sql` | Tabela `visoes_salvas` + RLS. Visão pessoal ou compartilhada com a equipe da empresa. |
| `lib/visoes.ts` | Serialização filtros ⇄ querystring e CRUD das visões. Degrada em silêncio se a tabela não existir. |
| `lib/data-atalho.ts` | Parser dos atalhos de data (`hoje`, `+30`, `15`, `15/09`, `fim`, `ontem`…). Devolve ISO. |
| `components/ui/toast.tsx` | Provider de toast com **Desfazer** e ⌘Z global. |
| `components/ui/command-palette.tsx` | ⌘K: busca lançamentos e pessoas no banco + comandos de navegação. |
| `components/ui/barra-visoes.tsx` | Chips das visões salvas, salvar nova, copiar link. |
| `components/lancamentos/linha-rapida.tsx` | Linha de lançamento dentro da tabela + colar do Excel. |
| `components/ui/use-visoes.ts` | Hook: URL + visões salvas para qualquer tela. |
| `components/ui/config-colunas.tsx` | Colunas por usuário (escolher, reordenar), por tela. |
| `fx_lancamento_rateios.sql` | Tabela `lancamento_rateios` + RLS. Divide um lançamento entre centros de custo. |
| `lib/rateio.ts` | Regra de leitura do rateio e helpers puros (expandir, recortar por centro, validar, dividir). |
| `scripts/testar-regras.js` | `npm run test:regras` — asserções de rateio e datas. |

## Arquivos alterados

### `components/lancamentos/lancamentos-client.tsx` (o grosso da mudança)

1. **Filtros na URL.** Estado inicial lido de `?tipo&de&ate&q&contas&sit&conc&ord&dir`
   e regravado com `router.replace` (debounce de 250 ms, sem empilhar histórico).
   Recarregar, voltar pelo navegador ou mandar o link devolve o mesmo recorte.
   *Antes: nenhum `useSearchParams` no projeto inteiro.*
2. **Visões salvas.** Barra de chips acima dos filtros; salvar o recorte atual com
   nome, opcionalmente compartilhado; ponto no chip quando o filtro foi alterado
   depois de aplicar a visão; apagar tem **Desfazer** (recria igual).
3. **Deep link do lançamento.** Abrir um lançamento coloca `?lanc=<id>` na URL.
   O modal ganhou botão de copiar link e setas ↑↓ (**Alt+↑ / Alt+↓**) para andar
   pela lista sem fechar.
4. **Linha de lançamento rápido** dentro da tabela: `L` foca, `Enter` grava e
   devolve o foco. Datas aceitam atalho. Cola bloco do Excel
   (`descrição⇥valor⇥vencimento⇥documento`) e insere tudo em lote.
5. **Desfazer no lugar de `confirm()`.** Excluir, efetivar/agendar e trocar
   categoria/conta/centro em massa agora executam direto e oferecem Desfazer
   (⌘Z também). Exclusão guarda a linha inteira antes de apagar e reinsere.
   `alert()` de erro virou toast.
6. **Totais da seleção.** A barra mostra saldo dos selecionados, entradas/saídas
   e quantos estão vencidos — confere o lote antes de efetivar.
7. **Cor semântica.** Saída deixou de ser magenta: vermelho só para vencido,
   âmbar para vence hoje, azul para agendada, teal para entrada/efetivada.
   Novo status **Vencido** e **Vence hoje**, que antes não existiam na lista.
8. **⌘K → "Novo lançamento"** de qualquer tela (evento `fs-novo-lancamento`).

### `components/lancamentos/lancamento-modal.tsx`
Props novas e opcionais `onNavegar` e `linkDireto` (nada quebra em quem já usa o
modal). Cabeçalho ganhou copiar-link e navegação anterior/próximo. Título de saída
não é mais magenta.

### `components/painel/stat-cards.tsx`
Virou client component. Os KPIs ficam **presos abaixo da topbar** e, ao rolar
mais de 96 px, colapsam numa faixa fina com saldo, a pagar, a receber e vencido.
Vermelho só aparece quando existe valor vencido.

### `components/conciliacao/conciliacao-client.tsx`
O lote de alta confiança **já existia** para pares exatos e combinações 1×N / M×1.
A lacuna era a 1×1 aproximada (valor quase igual), que exigia revisão item a item
só para dizer onde entra a diferença. Agora dá para escolher a categoria do ajuste
**uma vez** e conciliar o lote: cada match gera seu lançamento de ajuste
(juros/multa ou desconto) e o "Desfazer" da transação continua funcionando porque
o ajuste entra como `criado_aqui`.

### `app/globals.css`, `app/layout.tsx`, `components/user-menu.tsx`
`--app-zoom: 0.9` era fixo para todo mundo — quem precisa de texto maior só tinha
o zoom do navegador. Agora é preferência por pessoa (**Compacta / Confortável /
Ampla**) no menu do usuário, gravada em cookie e aplicada já no primeiro paint via
`data-densidade` no `<html>` (sem piscar). O padrão continua sendo o 0.9 de hoje.

### `app/(app)/layout.tsx`
Monta `ToastProvider` em volta do app e o `CommandPalette`.

## Atalhos disponíveis agora

| Tecla | O que faz |
|---|---|
| `⌘K` / `Ctrl+K` | Command palette (busca + comandos), de qualquer tela |
| `N` | Novo lançamento (modal completo) |
| `L` | Foca a linha de lançamento rápido |
| `/` | Busca da tela (ou o palette, onde não houver busca) |
| `↑` `↓` `Enter` | Navega e abre linhas da lista |
| `Alt+↑` `Alt+↓` | Lançamento anterior / próximo com o modal aberto |
| `⌘Z` / `Ctrl+Z` | Desfaz a última ação |

## Rateio entre centros de custo (segunda rodada)

Uma conta de luz que atende duas lojas precisava virar dois lançamentos — o que
suja a conciliação (o extrato tem uma linha só) e o contas a pagar (é um boleto
só). Agora o lançamento continua **um**, e a divisão vive em `lancamento_rateios`.

- `fx_lancamento_rateios.sql` — tabela + RLS por empresa. Nada retroativo.
- `lib/rateio.ts` — regra única de leitura: **sem** linhas de rateio vale o
  `centro_custo_id` de sempre; **com** linhas, valem as partes. Helpers puros,
  testados.
- **Modal**: "Ratear entre centros" abre as linhas (centro + valor), com
  "dividir igualmente", sugestão do que falta e validação de fechamento. Em
  carnê, cada parcela recebe o mesmo rateio.
- **Relatórios** (`lib/centro-custo.ts`, `lib/relatorio.ts` × 2, `lib/aging.ts`):
  filtrar por um centro agora traz o lançamento rateado **com a parte que cabe
  àquele centro**, não com o valor cheio.
- **Sobra não some**: se o rateio ficar parcial (ou o valor for editado depois),
  a diferença aparece como "Sem centro de custo" em vez de desaparecer do
  relatório.
- **Lista**: ícone de divisão marca os lançamentos rateados.

## Colunas e visões em outras telas (terceira rodada)

**Colunas por usuário.** `components/ui/config-colunas.tsx` — botão "Colunas" na
tabela de Movimentações: escolher quais aparecem e reordenar. Duas colunas novas
nasceram ocultas (Competência e Documento) para quem precisar. Três são fixas
(Vencimento, Descrição, Valor). Guardado no `localStorage` por tela: é
preferência pessoal, muda toda hora e não vale uma ida ao banco a cada ajuste.

Detalhe técnico: a grade agora vai em `style={{ gridTemplateColumns }}` e não em
classe Tailwind — classe montada em runtime não existe no CSS gerado no build.
A linha de lançamento rápido segue a mesma ordem; se você esconder Categoria ou
Conta, os campos aparecem na linha de ajuda abaixo para o atalho nunca travar.

**Visões salvas em mais telas.** O que era específico de Movimentações virou
infraestrutura:

- `lib/visoes.ts` agora é genérico (`Filtros = Record<string, string | string[]>`);
- `components/ui/use-visoes.ts` — hook que dá URL + visões salvas para qualquer
  tela em ~15 linhas: a tela declara o padrão, o recorte atual e como aplicá-lo;
- `components/ui/barra-visoes.tsx` saiu de `lancamentos/` e serve a todas.

Plugado em **Liquidações** (tela `liquidacoes`) e **Caixa de Entrada**
(`caixa-entrada`), além de Movimentações. O hook preserva parâmetros que não são
filtro da tela — é o que mantém o `?lanc=id` vivo quando você mexe num filtro
com o lançamento aberto.

**Conciliação ficou de fora de propósito**: ali o estado que importa é a conta
selecionada e o arquivo importado, não um recorte de filtros. Visão salva não
ganharia nada, e o arquivo tem 3.7 mil linhas — mexer teria custo sem retorno.

## O que ficou de fora, e por quê

- **Arrastar a NF dentro do lançamento**: a API `/api/documentos/extrair` já existe,
  mas plugar no modal exige mexer no fluxo de upload/expurgo de documentos —
  vale um passo próprio, com teste de ponta a ponta.
- **Duplicar / repetir mensalmente**: já existe via Recorrências; duplicar avulso
  ficou fora para não competir com esse fluxo.

## Casca no formato viável (quarta rodada)

Recorte proposto e aceito: **shell + Movimentações**, num commit isolado para
poder voltar atrás com um `git revert`.

- **Shell bar** (`components/topbar.tsx`): faixa fixa de 52 px com marca,
  contexto (empresa e período) e ações globais. O campo de busca não busca ali —
  dispara o `⌘K`, que já faz busca de verdade no banco.
- **Side navigation** (`components/sidebar.tsx`): a barra escura virou superfície
  clara com itens agrupados (Escritório / Empresa / rodapé) e seleção marcada por
  barra + fundo da marca. **A navegação continua na tela** — o modelo de launchpad
  puro, em que você volta à home para trocar de área, seria regressão para quem
  abre o sistema duas vezes por semana.
- **Botão de recolher o menu** foi para a shell bar. Ele é renderizado pelo
  `AppShell` (client) e posicionado por cima: a Topbar é componente de servidor e
  não pode receber um handler depois de renderizada — `cloneElement` não resolve.
- **Object status** na lista: o status virou texto colorido com marcador, no lugar
  da pílula com fundo. Em 100 linhas, 100 retângulos coloridos viram ruído.
- **Footer bar**: as ações em lote ficam presas no rodapé, sempre no mesmo lugar,
  em vez de empurrar a tabela para baixo quando você seleciona.
- **Filter bar**: rótulo acima do campo, campos com borda inferior marcada, e as
  abas de tipo viraram *segmented button*.
- **Cabeçalho de página** em Movimentações fica preso abaixo da shell bar.

Fora daqui de propósito: nome e marca SAP/Fiori, fonte "72", ícones SAP, paleta
azul e Fiori elements (que exigiriam OData V4 + annotations, e cujo caminho
natural prende produção à SAP BTP por licença).

Falta para completar o formato em todo o app: Object Page do lançamento, tiles do
Início e a cauda longa de telas de cadastro e configuração — estimativa de
38–59 dias no total, dos quais este commit cobre a parte de casca.

## Página do lançamento (quinta rodada)

O modal virou **página com URL própria**: `/movimentacoes/<id>`.

- `app/(app)/movimentacoes/[id]/page.tsx` — carrega o lançamento no servidor
  (a RLS já barra o que não é da carteira; aqui só há o 404 amigável).
- `components/lancamentos/lancamento-objeto.tsx` — cabeçalho com os campos que
  importam de relance (valor, situação, vencimento, categoria, conta, centro),
  que colapsam ao rolar, e navegação por âncora entre as seções.
- `lancamento-modal.tsx` ganhou a prop `comoPagina`: **o mesmo formulário**, sem
  overlay e sem cabeçalho próprio. Nada foi duplicado — quem edita e quem cria
  usam exatamente o mesmo código, e a moldura é que muda.
- Seções: Dados (o formulário), Rateio (leitura, com o percentual de cada
  centro), Anexos (documentos de verdade ligados ao lançamento), Conciliação e
  Trilha.
- **A trilha é honesta**: o app não registra histórico campo a campo, então ela
  mostra o que o lançamento guarda hoje (competência, agendamento, pagamento,
  recorrência, exportação) e diz isso na própria tela, em vez de inventar um
  histórico que não existe.

Na lista: **a linha inteira virou clicável** e leva para a página. O diálogo
ficou só para criação rápida, onde ele é melhor mesmo (`N`, "adicionar e
continuar"). Links antigos com `?lanc=<id>` são redirecionados para a página.

## Início em tiles (sexta rodada)

Nova rota `/inicio`: a home da empresa, em tiles com número de verdade.

- `app/(app)/inicio/page.tsx` — componente de servidor que reaproveita o que já
  existia (`getPainelData`, `getAging`) e soma três contagens: documentos novos,
  transações não conciliadas e títulos a liquidar em 7 dias.
- `components/inicio/tile.tsx` — tile de tamanho fixo, com número, rodapé e
  destino. O tom (positivo, crítico, negativo) vem do dado, não do gosto: só
  fica vermelho quando existe valor vencido.
- Cada tile leva para a lista **já filtrada**, usando os filtros que vivem na
  URL — "sem conciliar" abre `/movimentacoes?conc=nao`.
- Entrou no menu lateral, no ⌘K, e a marca na shell bar passou a levar para lá
  (menos no perfil Contabilidade, que não tem acesso à rota).

A navegação lateral continua: o Início é atalho para o que precisa de atenção
hoje, não substituto do menu.

## Cauda longa e anexos (sétima rodada)

**Padronização visual das 34 páginas.** A escala do título (`text-2xl
font-extrabold`) virou `text-lg font-bold` em todas de uma vez — cada tela
desenhava o seu cabeçalho com um tamanho diferente. O raio dos cards
(`rounded-xl2`) saiu de 14 px para 10 px no `tailwind.config.ts`: uma linha
harmoniza todos os cartões do app com a casca nova.

**`components/ui/page-header.tsx`** — cabeçalho padrão, preso abaixo da shell
bar, com título, subtítulo e ações. Aplicado em Painel, Conciliação, Caixa de
Entrada e Clientes e Fornecedores; as demais telas seguem com o cabeçalho
simples, já na escala certa.

**Anexos do lançamento** — agora dá para ligar a este lançamento um documento
que já está na Caixa de Entrada, e desanexar, com Desfazer nos dois sentidos.

Uma escolha consciente: **não há upload direto aqui**. O arquivo entra pelo
portal do cliente, que tem política de bucket, caminho e expurgo próprios;
subir arquivo por esta tela exigiria política de storage para usuário
autenticado, que eu não consigo verificar sem o Supabase real. A tela diz isso
em vez de fingir que o botão existe.

## Convergência visual (oitava rodada)

O problema era o novo convivendo com o antigo. Em vez de refazer tela por tela,
a passada foi nos **padrões repetidos** — o app era consistente, então trocar o
padrão troca tudo de uma vez. **99 arquivos, 429 substituições:**

| Padrão | Antes | Depois |
|---|---|---|
| Campos | `rounded-lg … px-3 py-2 text-sm` | `rounded-md … px-2.5 py-1.5 text-[12.5px]` + anel de foco |
| Botão primário | `rounded-lg bg-brand px-4 py-2` | `rounded-md bg-brand px-3 py-1.5` |
| Botão secundário | `rounded-lg border … px-4 py-2 text-sm` | `rounded-md border … px-3 py-1.5 text-[12.5px]` |
| Cards | `rounded-xl2 border border-line bg-white shadow-card` | `rounded-xl2 bg-white shadow-card` |

Os cards perderam a borda: no formato novo a elevação vem da sombra, e borda
mais sombra era o que mais denunciava a cara antiga.

**Cor com significado, agora em todo o app** (o commit 1 tinha feito só em
Movimentações):

- 51 valores monetários deixaram de ser magenta — magenta é cor de marca, não
  de dado. Saída passou a ser tinta neutra.
- 36 mensagens de erro passaram de magenta para o vermelho de perigo.
- 7 botões destrutivos passaram de magenta para vermelho.

A escolha do método importa: **nenhuma substituição mexeu em estrutura**. Só
troquei valores de classe equivalentes (padding por padding, raio por raio), o
que mantém o comportamento de layout — sem `h-8` em botão que não é flex, por
exemplo, que quebraria o alinhamento vertical do texto.

## Revisão e ajustes (nona rodada)

Revisão das oito rodadas anteriores. Cinco problemas reais encontrados e
corrigidos — três deles introduzidos por mim:

1. **Esc perdia o que estava digitado.** Na página do lançamento, o formulário
   herdava o atalho do diálogo: Esc chamava `onFechar`, que navega para a lista.
   Fechar é ação de diálogo, não de página — em modo página, Esc não faz nada.
2. **O mesmo lançamento abria de dois jeitos.** Movimentações levava para a
   página; Liquidações ainda abria o diálogo. Agora as duas vão para a página, e
   o diálogo morto (e os estados dele) saiu de Liquidações.
3. **O magenta ainda pintava dado** em Painel ("A pagar"), Carteira e
   Relatórios. Era exatamente a incoerência de "novo convivendo com antigo":
   saída virou tinta neutra, "em atraso" virou vermelho de perigo.
4. **Código morto da refatoração**: `pathname`, o estado `editLanc` e imports
   sem uso em Movimentações e na página do lançamento.
5. **Contraste ruim (anterior a este trabalho)**: a conversa do assistente
   usava `bg-rail` (fundo escuro) com `text-ink-muted` (cinza) — texto quase
   ilegível. Virou superfície clara com tinta normal.

Além disso, os últimos resquícios visuais: títulos `text-2xl extrabold` que
viviam dentro de componentes client (a passada anterior só alcançou os
`page.tsx`) e dois campos de confirmação destrutiva que ainda focavam em
magenta — agora focam em vermelho.

**Varredura final:** 0 cards com borda+sombra, 0 botões no padrão antigo,
0 campos antigos, 0 títulos fora de escala, 0 usos de magenta como cor de dado.

## Cartão único e telas de topo (décima rodada)

Painel e Carteira ainda tinham UX própria — cada cartão desenhava seu cabeçalho.

- **`components/ui/card.tsx`** — cartão padrão: título, subtítulo, ação no canto
  e rodapé separado por linha. Aplicado em Fluxo de caixa, Contas e saldos,
  A receber / A pagar e Resultado mensal.
- **Carteira** ganhou o `PageHeader`, com "Gerenciar" na posição em que a ação
  principal aparece em todas as outras telas.
- **Títulos de bloco** na mesma escala em 37 arquivos.
- **Gráficos também seguem a regra de cor**: a barra de saída/despesa era
  magenta (cor de marca) em quatro gráficos — virou cinza-ardósia. Resultado
  negativo virou o vermelho de perigo, que é o que de fato significa problema.

A regra de cor agora vale nos três lugares onde ela aparece: texto, elementos
de interface e gráficos.

## Carteira (décima primeira rodada)

A rodada anterior só trocou o cabeçalho da página — o conteúdo, que é onde a
Carteira vive, continuava antigo. Agora:

- **Status da empresa** virou object status (marcador + texto colorido), como no
  resto do app. Some o ponto grande duplicado antes do nome.
- **"Atenção" deixou de ser magenta e virou vermelho de perigo** — magenta é cor
  de marca; usá-lo para estado fazia parecer decoração.
- **KPIs no mesmo padrão do Painel**: destaque com anel da marca, sem borda.
- **Barra de filtros** com rótulo acima do controle e segmented button contínuo,
  igual às outras telas.
- **Rótulos das métricas** deixaram a caixa alta e o espaçamento próprios, e
  ficaram iguais aos header facets da página do lançamento.
- **Cor por significado nos números**: "a pagar" é tinta; caixa, resultado e
  previsão negativos são vermelho; atenção e conciliação atrasada, idem.
- **Gerenciar carteira**: arquivar e excluir eram magenta — ações destrutivas
  agora são vermelhas, inclusive o aviso "não dá para desfazer".

Sobrou **1** ocorrência de `accent` no arquivo, e é `accent-brand` (a cor do
checkbox nativo) — não é a paleta magenta.

## Conciliação, Relatórios, Importar e o resto (décima segunda rodada)

Três telas com layout próprio ainda não tinham entrado no padrão, e o magenta
ainda vivia espalhado como cor de dado. Esta rodada fecha as duas frentes.

### Magenta eliminado, e a correção do exagero

- **237 substituições em 68 arquivos**: `text-accent`, `bg-accent`,
  `border-accent` e `ring-accent` sumiram de `components/` e `app/`. Sobrou só
  `accent-brand`, que é a cor do checkbox nativo — utilitário do Tailwind, não
  paleta.
- **A varredura errou em seis pontos e foram corrigidos**: `bg-accent` virou
  `bg-danger` em lugares onde o magenta significava *saída*, não *problema*. Um
  lançamento de saída não é um erro. Voltaram para tinta neutra: o botão de
  salvar do modal de lançamento, o seletor de tipo "Saída", o filtro de tipo em
  Movimentações, o filtro de tipo em Liquidações, o chip "a pagar" em Documentos
  e o pontinho de despesa em Relatórios.
- **Portal do cliente**: a legenda "Saídas" e a barra do gráfico tinham ficado
  em cores diferentes uma da outra. As duas agora são cinza-ardósia. O texto de
  rodapé dos relatórios, que dizia "vermelho = despesa", foi corrigido para
  "cinza = despesa" — a legenda descrevia uma cor que não existe mais.

### Cabeçalho único em todas as telas

O `PageHeader` ganhou uma migalha de volta (`voltar`), que era o único motivo
pelo qual as telas de detalhe desenhavam o próprio cabeçalho.

- **21 telas de Configurações e Admin** convertidas de uma vez: link de volta,
  título e subtítulo no mesmo bloco preso abaixo da shell bar.
- **Relatórios**: título, "Baixar CSV" e a barra de controles agora ficam presos
  ao rolar — antes o filtro sumia e era preciso voltar ao topo para trocar o mês.
- **Liquidações**: as abas "A pagar / A receber" subiram para dentro do
  cabeçalho, que é onde ficam em todas as outras telas com abas.
- **Movimentações, Serviços, Carteira, Fluxo, Importar, Transferências, Ajuda,
  Configurações e o painel do negócio** entraram no mesmo componente.
- **Tipografia de título**: os últimos `text-xl` viraram `text-lg` com
  `tracking-tight`.
- **Raio dos diálogos**: sete modais usavam `rounded-2xl` enquanto o resto do app
  usa `rounded-xl2`. Agora é um só (as bolhas do chat de suporte continuam
  arredondadas, de propósito).

Sobraram três formas de `<h1>` fora do `PageHeader`, todas de propósito: os
avisos de "página restrita", a saudação do Início (que é um launchpad, não uma
lista) e os cabeçalhos de object page (lançamento e empresa), que no padrão
Fiori são um bloco diferente mesmo.

### O que foi verificado

`tsc --noEmit` limpo, `next build` compilando e as 31 asserções de
`npm run test:regras` passando. **Nada foi aberto no navegador com dados reais** —
não há credenciais do Supabase neste ambiente. As duas migrações
(`fx_visoes_salvas.sql` e `fx_lancamento_rateios.sql`) continuam pendentes.

## O que o protótipo prometia e o código não tinha (décima terceira rodada)

Comparando o mockup "Fiori viável" com o app de verdade, sobravam peças que só
existiam no protótipo — e, por baixo delas, a falta de um vocabulário comum: o
mesmo estado era desenhado de quatro jeitos, a mesma mensagem de seis, o mesmo
vazio de cinco.

### Cinco primitivas que faltavam

| Componente | Substitui |
|---|---|
| `ui/object-status.tsx` | 4 dialetos de chip de status, em 4 escalas |
| `ui/message-strip.tsx` | 6 padrões de aviso (texto solto, pílula rosa, faixa com borda, faixa sem ícone, bloco cinza, toast) |
| `ui/empty-state.tsx` | 5 moldes de estado vazio |
| `ui/skeleton.tsx` | a palavra "Carregando…" em 19 lugares |
| `ui/footer-bar.tsx` | barra de ações fixa que só existia em Movimentações |

O `ObjectStatus` carrega a regra de cor no tipo: `positivo`, `negativo`,
`critico`, `info`, `neutro`. Não dá para pintar uma saída de vermelho sem
declarar que ela é um problema — que foi exatamente o erro cometido e corrigido
na rodada passada.

### Filter bar de verdade

A barra tinha os campos e os chips de visão salva. Faltavam as peças que fazem
diferença para quem usa o sistema todo dia:

- **Adaptar filtros** — cada pessoa escolhe quais campos aparecem. Quem cobra
  quer Cliente e Vencimento; quem concilia quer Conta e Documento. Sem isso a
  barra cresce até virar um formulário que ninguém lê.
- **Ocultar filtros** — depois de montar o recorte, a barra só ocupa altura.
- **Contagem de filtros ativos** quando recolhida — senão vira armadilha
  ("por que só aparecem 3 lançamentos?").

Fica salvo por tela, no navegador.

### Cabeçalho de coluna que não some

Nenhuma tabela do app tinha cabeçalho fixo: rolar cem linhas fazia sumir o
"selecionar todos" e os controles de ordenação. Agora o cabeçalho gruda logo
abaixo do cabeçalho da página em Movimentações e Liquidações.

Detalhe que custou pensar: um contêiner com `overflow-x` também vira contêiner
de rolagem vertical, e aí o `sticky` gruda nele — que não rola — em vez de
grudar na página. Por isso a rolagem lateral só existe abaixo de 1280px, onde a
tabela de fato não cabe. E a altura do cabeçalho da página, que muda de tela
para tela, é publicada numa variável CSS por `ui/mede-cabecalho.tsx` em vez de
ser um número cravado que daria certo em uma tela e errado nas outras.

### Teclado

`↑` `↓` `Enter` já funcionavam. Faltava **Espaço para selecionar** — sem ele o
teclado percorre a lista mas não consegue montar um lote, que é para o que a
lista serve. E os atalhos passaram a ficar escritos embaixo da tabela: atalho
que ninguém descobre não existe.

### Página do lançamento

- **Anterior / próximo** (`Alt+↑` / `Alt+↓`), com os vizinhos calculados na
  mesma ordenação da lista. Conferir dez lançamentos deixa de custar dez idas e
  voltas.
- **Duplicar**, que cria a cópia limpa do que é daquela ocorrência: não vem
  paga, não vem conciliada, não herda o vínculo com a recorrência. Herdar
  qualquer um desses seria criar um lançamento que mente sobre o próprio passado.

### Não perder o que foi digitado

Esc e o clique fora fechavam os formulários sem avisar. Agora seis diálogos
(lançamento, venda, contrato, cliente/fornecedor, conta bancária, serviço)
pedem confirmação — e só quando há de fato algo a perder. A detecção é um
`onChange` no contêiner, que pega os eventos de todos os campos de dentro:
comparar quarenta estados com um retrato inicial daria o mesmo resultado com
quarenta vezes mais código, e quebraria toda vez que alguém acrescentasse um
campo.

### Liquidações

As ações em lote saíram do meio da tela e foram para o rodapé. Antes, marcar um
título empurrava a tabela inteira para baixo — e a linha seguinte saía de
debaixo do cursor.

### Véu dos diálogos

Havia quatro cores (`bg-rail/50`, `bg-ink/30`, `bg-ink/40`, `bg-black/40`).
Abrir dois diálogos seguidos mudava o tom do fundo. Agora é um só.

### O que continua faltando de propósito

- **Object page para as outras entidades** (cliente, conta, contrato, venda):
  seguem em diálogo. São formulários curtos, onde o diálogo é o padrão certo —
  o lançamento virou página porque tem rateio, anexos, conciliação e trilha.
- **Upload direto em Anexos**: depende de política de bucket no Supabase, que
  não dá para verificar sem credenciais.
- **Barra de filtros e colunas configuráveis** em Clientes/Fornecedores e nas
  centrais de boletos e notas: os dois hooks estão prontos, falta mapear os
  filtros de cada tela.

### O que foi verificado

`tsc --noEmit` limpo, `next build` compilando, 31 asserções passando.
**Nada foi aberto no navegador com dados reais** — segue sem credenciais do
Supabase neste ambiente. As migrações `fx_visoes_salvas.sql` e
`fx_lancamento_rateios.sql` continuam pendentes.

## Convergência com as migrações rodando (décima quarta rodada)

As tabelas `visoes_salvas` e `lancamento_rateios` passaram a existir de verdade
no banco. Isso muda uma coisa importante: visão salva deixou de ser promessa e
virou peça que dá para levar para outras telas.

### Visões salvas em mais três listas

Clientes/Fornecedores, Central de boletos e Central de notas ganharam
`FilterBar` + chips de visão salva. Clientes/Fornecedores ganhou também colunas
configuráveis — a tabela era fixa em cinco colunas e agora tem sete, todas
visíveis por padrão (esconder tag e cidade por padrão tiraria informação de
quem não sabe que o botão "Colunas" existe).

Três coisas foram corrigidas no caminho:

- **Fornecedor era vermelho.** O chip de tipo pintava fornecedor com o vermelho
  de perigo. Fornecedor é um tipo de cadastro, não um problema — virou azul de
  informação. É o mesmo erro que a varredura do magenta cometeu com "saída".
- **O filtro de data das notas dizia "Vence de"** — copiado dos boletos. NFS-e
  não tem vencimento; a consulta filtra por data de criação. Agora o rótulo diz
  o que o filtro faz.
- **Os botõezinhos "limpar" de cada campo** viraram um "Limpar filtros" só, que
  também conta o filtro de status (que fica fora da barra, nos chips com
  contagem).

### Varreduras terminadas

- **Mensagens**: os padrões 1 (texto solto colorido) e 2 (pílula rosa) foram
  para o `MessageStrip`. São 33 arquivos usando o componente hoje, contra os
  seis padrões de antes.
- **Estados vazios**: 16 arquivos trocaram o parágrafo solto por `EmptyState`.
  Ganhou uma variante `compacto` — num painel lateral de 200px de altura, o
  círculo de 48px e o `py-16` do estado vazio cheio ocupariam a caixa inteira.
- **Status**: os mapas de conciliação viraram `tom`, fechando o último dialeto
  de pílula com cor crua.
- **Cartões**: 12 blocos que desenhavam o próprio cabeçalho viraram `Card`.

### Cabeçalho de coluna fixo: onde dá e onde não dá

Extratos, Fluxo e Transferências ganharam cabeçalho fixo. Duas tabelas ficaram
de fora, e vale registrar por quê:

- **Contas do admin** tem nove colunas com conteúdo que não quebra (e-mail,
  botão "Impersonar"): o mínimo real passa de 1080px, e a área útil em 1280px é
  1026px. Tirar a rolagem horizontal ali faria a tabela vazar do cartão sem
  barra nenhuma. Ficou com rolagem, sem cabeçalho fixo.
- **Cupons** está dentro de um contêiner `overflow-hidden` (usado para
  arredondar os cantos), que também é contêiner de rolagem — o `sticky` grudaria
  nele, que não rola. Preferi tirar a classe a deixar código morto que dá a
  impressão de que a tela tem cabeçalho fixo.

Detalhe técnico: `position: sticky` num `<tr>` não funciona em parte dos
navegadores. Nos `<th>` funciona em todos — daí a variante `[&>th]:`.

### Divergência de hidratação corrigida

As telas com filtro na URL liam `window.location.search` para nascer filtradas.
O servidor não enxerga isso: ele renderizava os filtros vazios, o cliente
renderizava os da URL e o React acusava divergência ao abrir um link com
`?q=…`. Agora usam `useSearchParams()`, que funciona dos dois lados.

### Sobre as mensagens de "rode a migração"

`lib/visoes.ts` e `lib/rateio.ts` ainda tratam o erro 42P01 avisando para rodar
o SQL. Com as tabelas criadas isso não dispara mais — mas continua no código de
propósito: um ambiente novo (outra conta Supabase, um clone para teste) volta a
precisar do aviso, e a alternativa seria um erro cru de "relation does not
exist" na cara do usuário.

### O que foi verificado

`tsc --noEmit` limpo, `next build` compilando, 31 asserções passando, e uma
revisão adversarial do diff que achou sete regressões — todas corrigidas antes
deste commit. **Nada foi aberto no navegador com dados reais.**

## Acessibilidade, celular e volume de dados (décima quinta rodada)

Um levantamento das lacunas restantes apontou três buracos que nenhuma rodada
anterior tinha tocado — e que não são de estilo.

### O app não funcionava no teclado nem no leitor de tela

- **`focus-visible` não aparecia uma vez no repositório.** Havia 196 usos de
  `outline-none`: em 124 o único sinal de foco era a borda de 1px trocando de
  cor, e em 4 não havia sinal nenhum. Uma regra global em `app/globals.css`
  resolve os 124 sem tocar em 124 arquivos. Usa `:focus-visible`, então clicar
  com o mouse continua sem anel — e não força raio próprio, senão os chips
  redondos virariam retângulo justamente quando estão em foco.
- **Nenhum dos 32 diálogos prendia o foco.** Tab dentro de um diálogo saía
  visitando os links da tela de trás, que está coberta pelo véu: quem navega por
  teclado ficava preso num lugar que não conseguia ver. E ao fechar, o foco ia
  para o começo da página.
  A solução não foi mexer em 25 arquivos: os diálogos só declaram *o que são*
  (`role="dialog" aria-modal="true"`) e um `components/ui/guarda-dialogo.tsx`,
  montado uma vez no AppShell, cuida do comportamento observando o DOM —
  armadilha de Tab, foco inicial e foco devolvido ao gatilho.
- **37 botões só com ícone** não tinham rótulo: para leitor de tela, todos
  anunciavam string vazia.

### A sidebar comia metade do celular

`app-shell.tsx` e `sidebar.tsx` não tinham **um único** breakpoint. Com a coluna
fixa de 214px, sobravam ~336px de conteúdo numa tela de 375px. Abaixo de `md` a
navegação virou gaveta, com véu, Esc, fechar ao navegar e um botão que alterna.

Detalhe: a gaveta ignora o "recolhido" do desktop e abre sempre com 214px. Quem
deixou a coluna estreita no computador não quer, no celular, uma faixa de 56px
só com ícones — são duas intenções diferentes.

### Duas telas baixavam a tabela inteira

- **Movimentações & contas** baixava *todo o histórico pago da empresa desde
  sempre*, com descrição e status, a cada abertura. Agora são duas consultas: o
  saldo precisa mesmo do histórico, mas só de quatro colunas; descrição e
  conciliado vêm só do mês visível. E há um piso de data — a menor data de
  início entre as contas, porque lançamento anterior a isso já era descartado no
  cálculo de qualquer jeito.
- **Conciliação** cruzava duas listas ilimitadas uma contra a outra para pontuar
  aderência: o custo é o produto, e uma conta com anos de pendência travava o
  navegador. Agora há teto de 1.200 por lado — e **a tela diz quando o teto foi
  atingido**, em vez de fingir que aquilo é tudo. O percentual de conciliação
  passou a vir de uma contagem própria: usar o tamanho da lista truncada como
  denominador faria a barra de progresso subir justamente nas contas mais
  atrasadas.

### Um só formatador

Havia **58 cópias de `brl()` em 53 arquivos** e 22 de `dataBR()`. Não eram todas
iguais: três telas definiam `brl` sem o símbolo, porque o cabeçalho da coluna já
dizia "R$" — viraram `num2`, com nome próprio, porque a diferença é de
significado e um parâmetro booleano seria esquecido em algum lugar.

O `dataBR` central corta a string em vez de criar um `Date`: `new Date("2026-08-13")`
é lido como UTC meia-noite e, em fuso negativo, volta 12/08. De quebra, isso
consertou dois lugares que mostravam `13T14:30:00+00:00/08/2026` na tela.

### A barra de match da conciliação

Ficava logo abaixo do quadro — ou seja, fora da tela justamente quando havia
muitas linhas para escolher. Agora gruda no rodapé da janela. `sticky` e não
`fixed` como a FooterBar: essa barra tem várias linhas (resumo dos dois lados,
diferença, categoria de ajuste), e fixa cobriria metade da tela.

### A revisão achou oito regressões

Todas corrigidas antes deste commit. As três que mais teriam doído:

1. **O rótulo automático roubou o nome de cinco botões que tinham texto
   visível.** O botão "Apagar dados" — o mais destrutivo do app — passou a se
   anunciar como "Fechar" para leitor de tela e comando de voz. O mapa
   ícone→rótulo não sabe o que o botão faz; onde havia texto, o `aria-label` é
   pior do que nada.
2. **O extrato parou de acompanhar os saldos.** Com a divisão em duas consultas,
   marcar um lançamento como pago em outra tela atualizava o saldo da conta mas
   não a tabela — a mesma tela mostrando dois saldos diferentes.
3. **O anel de foco achatava os chips redondos**, porque a regra global trazia
   um `border-radius` que não precisava existir.

### O que foi verificado

`tsc --noEmit` limpo, `next build` compilando, 31 asserções passando (o script
de testes precisou aprender a compilar `lib/formato.ts`, agora que
`lib/data-atalho.ts` reexporta dele). **Nada foi aberto no navegador com dados
reais** — em especial a gaveta do celular e o anel de foco, que são justamente
o tipo de coisa que só o navegador conta.

## Fechando a convergência (décima sexta rodada)

Última rodada. Fecha o que estava pendente e implementa o único recurso que
vinha sendo adiado.

### Anexar arquivo direto no lançamento

Era o item adiado desde a primeira rodada, sempre com a mesma justificativa:
"depende de política de bucket que não dá para verificar". A justificativa
estava errada — o bucket `documentos-entrada` já existia e já era usado pelo
portal do cliente. Faltava só o gêmeo autenticado.

- `app/api/documentos/enviar/route.ts` — dois passos: `assinar` devolve uma URL
  de upload assinada, `registrar` grava a linha depois que os bytes chegaram. O
  arquivo não passa pelo servidor do app: um PDF de 15 MB atravessando a função
  serverless custaria memória e tempo limite, e o servidor não olha o conteúdo.
  Os dois passos também evitam documento fantasma — se o upload falhar no meio,
  não fica linha apontando para arquivo que não existe.
- `components/ui/soltar-arquivo.tsx` — arrastar e soltar, na seção Anexos do
  lançamento e no topo da Caixa de Entrada.

Anexado a partir de um lançamento, o documento já nasce ligado e classificado —
não cai na caixa de entrada como "novo para classificar".

### Diálogos: os 32

A varredura anterior tinha pego 18. Os 14 restantes (mais o ⌘K) entraram, então
o guarda de foco vale em todos. Conferido um a um: o atributo está na caixa e
não no véu, e nenhuma caixa fica no DOM com o diálogo fechado — se ficasse, o
foco seria preso numa caixa invisível e o app inteiro travaria no teclado.

### Formatador: zero cópias locais

`brl`, `num2`, `brlCurto`, `dataBR`, `brlRedondo` (portal, sem centavos) e
`dataDeTimestamp` vivem só em `lib/formato.ts`. `lib/mock.ts` e
`lib/data-atalho.ts` viraram reexports.

De quebra, um bug real: `proximo_vencimento` é data pura e estava passando por
`new Date()`, o que devolve o dia anterior em fuso negativo. Agora usa `dataBR`.

### Conciliação com o cartão padrão

Os três painéis (Extrato, Lançamentos em aberto, Conciliados recentes) usam o
`Card`, que ganhou `corpoSemPadding` para listas cujas linhas já têm o próprio
espaçamento — e, junto, a régua no cabeçalho, que sem isso deixaria o título
colado no primeiro item.

### A revisão achou sete regressões

A mais séria: eu inventei um `status: "lancado"` que não existe no vocabulário
da coluna (`novo` / `baixado` / `expurgado`). Com CHECK, todo anexo falharia
**depois** de o arquivo já ter subido — arquivo órfão no bucket. Sem CHECK, o
documento nasceria invisível: as duas abas da caixa de entrada filtram por
igualdade, e desanexar não mexe no status, então ele sumiria para sempre.

As outras: `router.refresh()` não atualiza uma lista que vive em estado local
(o usuário veria o toast e a lista parada); o upload da Caixa de Entrada ia
sempre para a empresa do contexto, ignorando o filtro de empresa da tela —
documento na empresa errada é caro de desfazer, e agora o texto nomeia o
destino; a escrita usava o cliente com RLS onde todo o resto do app usa o admin;
extrato CSV enviado pelo app não era marcado como extrato e sumia da
conciliação; seis mensagens perderam a margem que as separava do que vinha
acima; e o componente novo de upload nasceu mostrando erro fora do padrão que a
própria rodada tinha acabado de impor.

### O que fica fora, e por quê

- **Colunas configuráveis em Liquidações e Caixa de Entrada** e **SortToggle em
  ~20 tabelas.** As linhas dessas listas têm painel expansível e botões por
  linha; converter para `colunas.visiveis.map` é exatamente o tipo de varredura
  mecânica que produziu regressão em quatro rodadas seguidas. Vale fazer, mas
  uma tela de cada vez e com a tela aberta na frente.
- **Paginação real** nas listas sem `.range()`: exige levar filtro e ordenação
  para o servidor, o que muda a natureza das telas.
- **Object page para cliente e conta bancária**: são formulários curtos, onde o
  diálogo é o padrão certo. O lançamento virou página porque tem rateio,
  anexos, conciliação e trilha.
- **Trilha de auditoria campo a campo**: precisa de tabela e gatilho no banco.

### Verificação

`tsc --noEmit`, `next build` e as 31 asserções passam. Ao longo das 16 rodadas,
as revisões adversariais de diff acharam 6, 7, 8 e 7 regressões — nenhuma delas
apareceria no compilador. **Nada foi aberto no navegador**: é o que falta, e é
onde o upload, a gaveta do celular e o anel de foco precisam ser vistos.

## Object pages e Esc em todo lugar (décima sétima rodada)

Você notou que várias funções ainda abrem em modal. Medi os formulários: nem
todo modal está errado, mas quatro estavam.

| Entidade | Linhas de formulário |
|---|---|
| Conta bancária | 303 |
| Cliente/fornecedor | 279 |
| Lançar documento | 277 |
| Contrato | 208 |
| Categoria / conta do painel / centro de custo | 76 / 56 / 43 — diálogo está certo |

Os quatro grandes têm seções internas. Diálogo é a moldura certa para cinco
campos; para estes cobrava três preços: não dava para mandar o link do cadastro,
o botão voltar do navegador fechava a tela inteira em vez do formulário, e o
conteúdo rolava dentro de uma caixa dentro de uma página que também rola.

### Duas viraram página

`/clientes-fornecedores/[id]` e `/configuracoes/contas-bancarias/[id]`. O
formulário **não** foi duplicado: o corpo virou uma variável que as duas
molduras renderizam. Duas cópias é como elas começam a divergir — um campo novo
entra numa e esquece a outra.

A página carrega só aquele registro; a lista inteira não é necessária ali. E o
lápis da lista virou link, então abre em nova aba, dá para copiar o endereço e
o voltar do navegador funciona.

**Contrato e Lançar documento ficaram para a próxima**, com o molde pronto: são
os mesmos cinco passos (prop `soId`, extrair o corpo para variável, ramo de
página, rota, trocar o botão da linha por link).

### Esc fecha os 34 diálogos

Só 16 tratavam Escape. Em vez de mexer em 18 arquivos, o guarda global passou a
tratar — acionando **o botão de fechar** do diálogo do topo, e não um `onFechar`
genérico. A diferença importa: o botão é quem sabe se há alteração não salva a
confirmar. Seis botões de cancelar que não tinham rótulo ganharam `data-fechar`.

### Últimos estados vazios

18 arquivos convertidos. Dois falsos positivos revertidos: a busca por "nada "
casou dentro de "selecio**nada n**o topo", e "ainda não existir" numa frase de
ajuda virou estado vazio. É a mesma armadilha de sempre — varredura por
substring não sabe o que a frase significa.

### Verificação

`tsc --noEmit`, `next build` (as duas rotas novas aparecem no manifesto) e as 31
asserções. **Nada aberto no navegador.**

## Conciliação: campos no padrão (décima oitava rodada)

Fechando a frente "telas de rotina". A conciliação não recebeu o `FilterBar`
inteiro, e isso é de propósito: o componente foi escrito para a barra de filtros
de uma tela de lista — com variantes salvas, "Adaptar filtros" e "Ocultar
filtros" — e o filtro daqui vive dentro de um painel que ocupa metade de um
grid de duas colunas. Forçá-lo ali quebraria o layout e traria três controles
que não fazem sentido no contexto.

O que estava errado eram as **convenções**, não o componente:

- Os rótulos ficavam à esquerda do campo, numa coluna de 40px fixos — "R$ de"
  não cabia. Agora ficam acima, como em todas as outras telas.
- O botão de limpar tinha um quarto estilo próprio (borda que fica vermelha no
  hover). Virou o mesmo do resto do app.
- O seletor de conta era um `<select>` com padding próprio; agora usa a mesma
  altura e a mesma borda inferior dos outros campos.

### Onde a convergência está, contra a estimativa original

| Frente | Estimado | Estado |
|---|---|---|
| Tokens e shell | 3–5 d | completo |
| Componentes base | 5–8 d | ~55% — **botão, campo e tabela não foram extraídos** |
| List Report | 4–6 d | completo |
| Object Page | 5–8 d | completo, e ainda saíram duas a mais |
| Launchpad e Overview | 4–6 d | completo |
| Telas de rotina | 5–8 d | completo |
| Cauda longa | 8–12 d | completo |
| QA e responsivo | 4–6 d | ~40% — nada aberto no navegador |

O buraco que faltava nomear: entreguei sete primitivas que não estavam na lista
(Card, EmptyState, Skeleton, FilterBar, FooterBar, Modal, MessageStrip) e deixei
de fora as três que estavam. Hoje há **124 botões** e **149 campos** com a
classe escrita à mão, e 19 arquivos com um `const campo = "…"` local. Não quebra
nada — as strings estão iguais. Quebra no dia em que alguém mudar o raio do
botão primário e tiver que achar 124 lugares.

## Contrato vira página (décima nona rodada)

Terceira das quatro. `/contratos/[id]`, mesmo molde das outras duas: prop
`soId`, corpo do formulário numa variável compartilhada pelas duas molduras,
ramo de página, rota, e o lápis da linha virou link.

O cabeçalho traz o que se quer saber de relance sem abrir o formulário —
cliente, ciclo de faturamento, total dos itens, início da vigência e se está
ativo.

Uma diferença em relação às outras duas: o contrato carrega só o próprio
registro, mas as listas de apoio (serviços, clientes, categorias, contas) vêm
inteiras. São o conteúdo dos seletores do formulário; sem elas, os campos
apareceriam com "categoria removida" no lugar do nome.

Falta **Lançar documento** — mesmo molde, é a última das quatro.

## Componentes base, e a primeira verificação visual (vigésima rodada)

Os três que faltavam da estimativa original — botão, campo e tabela — e uma
bancada para poder **olhar** para eles.

### `components/ui/botao.tsx`

Cinco variantes, que são as que de fato existem no app e não uma taxonomia
inventada: `primario`, `secundario`, `discreto`, `perigo` e `neutro` (para a
tela onde teal significaria "receita", como o botão de nova saída).

O que estava disperso: três paddings disputando o mesmo papel (`px-3 py-1.5`,
`px-3 py-2`, `px-2.5 py-1.5`) e dois raios no mesmo tipo de botão. Nada quebrava;
só fazia a mesma ação parecer outra coisa dependendo da tela.

`BotaoLink` mantém a aparência num `<Link>` — abrir em nova aba é comportamento
de link, e um `<button>` com `router.push` tira isso de quem usa. `BotaoIcone`
exige `rotulo`: era o buraco dos 37 botões que anunciavam string vazia.

### `components/ui/campo.tsx`

Duas alturas, porque o app tem dois contextos: `md` em formulário, `sm` em barra
de filtros. O erro fica abaixo do campo e ligado por `aria-describedby` — sem
isso o leitor de tela anuncia o campo sem dizer o que está errado nele.

### `components/ui/tabela.tsx`

Guarda as duas armadilhas de `sticky` que custaram caro para descobrir, para
ninguém ter que redescobrir: contêiner com `overflow-x` também é contêiner de
rolagem vertical, e o offset do cabeçalho vem de `--fs-cab`, não de um número
cravado.

### A bancada: `/estilo`

Uma página que renderiza todo componente base em todo estado e **não depende de
banco nem de sessão**. É a única parte do app que dá para inspecionar
visualmente sem credenciais — e foi o que permitiu, pela primeira vez em vinte
rodadas, subir o servidor, abrir no Chromium e olhar.

Em produção a rota não existe.

### O que a primeira olhada pegou

Três defeitos nos componentes que eu tinha acabado de escrever, e que `tsc` e
`next build` aprovaram sem reclamar:

1. **O campo com erro continuava cinza.** `border-line` e `border-danger`
   ficavam as duas na string de classe, e quem ganha nesse caso é a ordem no CSS
   gerado — não a ordem em que foram escritas. A cor da borda saiu da base e
   passou a entrar por último.
2. **O botão de ícone destrutivo era um quadrado vermelho sólido.** Numa lista,
   é um por linha: vinte linhas viravam uma parede vermelha. O vermelho passou
   para o hover, quando a pessoa já mirou o botão.
3. **A coluna de valor tinha o número à direita e o cabeçalho à esquerda.**
   `ColunaDef` ganhou `alinha`.

É exatamente o tipo de defeito que o teste com massa de dados **não** pega: o
botão clica, o campo salva, tudo passa verde. O que quebra é visual, e visual
não tem asserção.

### Ainda não adotados

Os três componentes existem e estão verificados, mas as 124 chamadas de botão e
149 de campo continuam com a classe à mão. A troca é o próximo passo — e é
melhor que aconteça tela a tela, com a bancada aberta ao lado para comparar.

## Adoção dos componentes base — telas 2 e 3 (vigésima primeira rodada)

`components/empresa/nova-empresa.tsx` e `components/cadastros/portal-usuarios.tsx`.

Duas coisas que a adoção corrigiu de passagem, e que não eram o objetivo:

- **O botão "Remover" do acesso ao portal era um `title="Remover"`.** Numa lista
  com cinco usuários, o leitor de tela anunciava cinco botões idênticos. Virou
  `aria-label="Remover o acesso de fulano@empresa.com"`.
- **O "CNPJ / CPF (opcional)" tinha o "(opcional)" no rótulo.** Virou texto de
  ajuda abaixo do campo, que é onde a informação de apoio mora — o rótulo é o
  nome do campo, não o lugar de explicar.

O botão de cancelar do diálogo ganhou `data-fechar`, então o Esc passa a fechá-lo
pelo caminho que confirma alterações não salvas.

Restam ~122 chamadas de botão com a classe à mão.

## Adoção ampla do `Botao` (vigésima segunda rodada)

**95 botões em 59 arquivos.** A varredura foi deliberadamente conservadora: só
converte quando a classe diz sem ambiguidade qual é a variante — fundo da marca,
fundo vermelho com texto branco, ou borda com tinta suave. Qualquer coisa fora
desses três moldes ficou como estava, porque botão tem contexto e adivinhar é
como a varredura estraga.

Sobraram ~45 botões com a classe à mão. São justamente os ambíguos: fundo âmbar,
gradiente, botão que é aba, botão que é chip de filtro.

### O que a revisão do próprio diff pegou

A limpeza da `className` sobrante comeu prefixos e deixou fragmentos:
`flex-1` virou `-1` em dois botões e `border-b-line` virou `-line` em três.
Classe inválida não quebra build nem tipo — o botão só perde a largura e fica
torto no meio de um par.

Dois outros restos foram removidos por conflito, não por estética:
`className="border-b border-line"` num botão cuja variante **já** traz a borda, e
`className="text-[12.5px]"` brigando com o `text-sm` do tamanho. Nesse segundo
caso quem vence é a ordem no CSS gerado, não a ordem escrita — o mesmo defeito
que a bancada tinha acabado de expor no `Campo`.

### Conferências feitas depois da troca

- Nenhum botão perdeu o `onClick` (os 13 sem handler são os do catálogo).
- Nenhum `type="submit"` foi convertido — o `Botao` fixa `type="button"`, e um
  submit virando button quebraria o envio do formulário em silêncio.

## Varredura do `Campo` (vigésima terceira rodada)

**116 controles em 47 arquivos** passaram a montar a classe por `classeControle()`
em vez de escrevê-la à mão. Sobraram 45, que são os de forma própria (busca com
ícone dentro, campo de valor com largura fixa, textarea de altura própria).

A varredura troca **só a classe**, não a marcação. Rótulo, `id` e `aria` ficaram
onde estavam: mexer na estrutura de 116 campos de uma vez é o que quebraria de
verdade, e o ganho de acessibilidade do `<Campo>` só existe se o `id` estiver
ligado ao `htmlFor` — coisa que precisa ser olhada caso a caso.

### A primeira tentativa foi revertida inteira

Subtrair as classes conhecidas por regex parecia óbvio e estava errado:
`\bborder\b` casa **dentro** de `border-b-ink-soft` e deixa `-b-ink-soft` para
trás. Saíram 126 campos com fragmentos inválidos — `-line`, `-b-2`, `focus:`.
Classe inválida não quebra build nem tipo; o campo só perde a borda.

Refeito filtrando por **token exato** (a classe inteira, separada por espaço),
que não tem como comer prefixo. É o mesmo defeito que a varredura do botão
cometeu em cinco lugares uma rodada antes — a diferença é que ali eram cinco e
dava para consertar, aqui eram 126 e o certo era jogar fora e refazer.

### Dois conflitos corrigidos de passagem

- **Dois campos escreviam o estado de erro à mão** (`focus:border-danger`).
  Agora passam `true` no parâmetro de erro, que é onde essa decisão mora.
- **Oito campos traziam `text-xs` no extra**, brigando com o tamanho do próprio
  componente. Quando duas classes definem a mesma propriedade, quem vence é a
  ordem no CSS gerado, não a ordem escrita — terceira vez que isso aparece nesta
  sessão.

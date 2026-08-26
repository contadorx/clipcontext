# Build 17 — A Ajuda deixou de ser uma parede

**Data:** 24/08/2026
**Fila:** Build 10 — "busca na Ajuda". **Era o último item aberto do Build 10.**

---

## O que estava lá antes

A base de conhecimento tem **45 painéis em nove temas**, nos cinco idiomas, e
não tinha navegação nenhuma. Nem índice. Quem chegava caía no topo de três mil
palavras e rolava.

Uma metade do problema já tinha sido paga em 23/08, quando os acordeões
passaram a **nascer abertos**: antes disso, 93% do texto ficava fora do alcance
do Ctrl+F. Só que Ctrl+F resolve *"onde está esta palavra"* e não resolve
*"em que tema eu estou"* nem *"o que mais existe ao lado"*. Achar a palavra no
meio de uma parede continua sendo achar uma palavra no meio de uma parede.

---

## O que entrou: duas metades, com durabilidades diferentes

**O índice — HTML puro, e derivado.** Nove links no topo, um por tema, com o
`<h2>` como destino.

Ele é montado no servidor **a partir dos próprios títulos** (`indiceDaAjuda`
em `lib/site.ts`). Escrito à mão seriam **cinco listas, uma por idioma, ao lado
das cinco listas de verdade** — o defeito que este projeto já pagou quatro
vezes com outro nome. Derivado, um tema novo aparece no índice por existir, e
um tema renomeado se renomeia sozinho.

**O filtro — acréscimo, e declarado como tal.** Um campo que reduz os 45
painéis enquanto se digita, com contagem (`12 de 45 respostas`).

O campo **nasce com `hidden` no HTML** e só é revelado pelo `support.js`. Sem
JavaScript ele não aparece: *um campo de busca que não busca é pior do que
campo nenhum*. Os links do índice, por serem âncoras, funcionam sempre — é
essa metade que carrega a promessa.

---

## Três decisões que valem mais que o código

**1 · Acento não pode ser obrigatório.** Quem procura no teclado do trabalho
digita `transcricao` esperando achar `transcrição`, e quem escreve alemão numa
máquina sem trema digita `ue` esperando achar `ü`.

Resolvido **indexando cada painel duas vezes** — sem acento e transliterado — e
normalizando a consulta uma vez só. É a mesma regra que a ferramenta já usa
para o dicionário de vocabulário em alemão. Medido na régua, na página em
alemão: `geändert` acha 6, `geaendert` acha os mesmos 6.

**2 · As frases do contador viajam em `data-`, e não numa tabela de idiomas
dentro do `support.js`.** O arquivo já tem uma dessas tabelas (a da ficha
lateral), e ela é exatamente a segunda lista ao lado do `i18n-site.json`.
Servidas pelo HTML, as frases saem do mesmo dicionário que o resto da página e
não há o que sincronizar. **Não acrescentei a sexta cópia.**

**3 · O filtro não pinta o trecho encontrado.** Realçar exige mexer no HTML de
dentro do painel, e o texto ali tem link, `<b>` e `<code>` — uma passada de
`innerHTML` sobre isso é como se perdem atributos num idioma que ninguém relê.
O Ctrl+F do navegador continua fazendo o realce, e agora sobre uma lista já
reduzida.

E dois acabamentos que só aparecem quando faltam: o painel encontrado **vem
aberto** (quem procurou quer a resposta, não mais um clique), e **Esc limpa** —
devolvendo inclusive o que a pessoa tinha recolhido *de propósito* antes de
procurar. O estado anterior é guardado uma vez, na primeira busca.

---

## Acessibilidade e telefone

- Os `<h2>` ganharam `tabindex="-1"` para o salto de âncora levar **o foco**
  junto, e não só a rolagem. Sem isso, quem navega por teclado clica no índice
  e continua tabulando a partir do topo da página.
- O contador é `role="status" aria-live="polite"`: quem usa leitor de tela
  ouve `12 de 45` sem ter de ir procurar o número.
- A grade dos temas usa `minmax(min(100%, 22ch), 1fr)` e não `22ch` seco. Os
  rótulos em alemão são os mais longos do site (*"Erneut öffnen, korrigieren
  und prüfen"*), e uma coluna mínima em `ch` fixo estoura num telefone de
  380px — que é a rolagem horizontal que o `estreito.mjs` cobra desde o
  Build 13. **Medido a 380px no alemão: documento 380, janela 380.**

---

## A régua nova: `testes/buscaajuda.mjs`

Cobra as duas metades separadamente, porque elas falham por motivos diferentes:

| bloco | o que afirma |
|---|---|
| **[1]** cinco idiomas | o índice tem um item por tema **com o texto do tema**, todo link cai num título que existe, o foco salta junto, e os 45 painéis continuam lá |
| **[2]** sem JavaScript | os nove links estão lá, o campo **não** aparece, nada está escondido (o Ctrl+F continua alcançando tudo) e o contador não inventa número |
| **[3]** com JavaScript | filtra, esconde tema vazio, conta certo, acha sem acento, duas palavras **estreitam**, sem resultado a página diz isso, o achado vem aberto, Esc devolve tudo como estava |
| **[4]** alemão a 380px | trema digitado como `ue` acha o mesmo, e o índice não empurra a página para o lado |

Os endereços das cinco páginas saem do **`rotas.json`**, e não de uma tabela
dentro da régua: escritos ali, a primeira renomeação de slug daria 404 — e um
404 nesta régua se parece com *"a página não tem índice"*, que é o diagnóstico
errado a dois passos da causa. A palavra alemã com trema também é
**descoberta** no texto, não escrita à mão: escrita, a régua reprovaria no dia
em que alguém melhorasse uma frase da Ajuda.

**Provada reprovando**, com dois defeitos instalados de naturezas diferentes:

```
índice escrito à mão      → 5 FALHAS, uma por idioma
normalização de acento    → FALHA  sem acento acha o mesmo que com acento → 0 contra 2
```

O segundo defeito **não** derrubou o bloco do alemão — o que é o
comportamento certo: as duas normalizações são independentes, e uma régua em
que quebrar uma coisa reprova tudo não diz o que quebrou.

---

## Arquivos

| arquivo | o que mudou |
|---|---|
| `lib/site.ts` | **`indiceDaAjuda`** — índice derivado dos `<h2>`, com `id` e `tabindex`; aplicado só à página `ajuda` |
| `src/site/support.js` | o filtro ao vivo (~90 linhas), inerte em toda página que não seja a Ajuda |
| `src/i18n-site.json` | cinco frases novas × cinco idiomas |
| `public/site.css` | o bloco do índice, a grade que não estoura a 380px, o campo |
| `testes/buscaajuda.mjs` | **nova** |
| `testes/rodar.sh`, `testes/liberar.sh`, `testes/LEIA-ME.md` | registrada nas três listas, e em **cinco** entradas do mapa de diferença |

Nenhum corpo de página foi editado — as cinco páginas de Ajuda continuam
byte a byte como estavam. Nada de banco, nada de migração.

---

## Regressão

A regressão inteira, com a régua nova dentro:

```
153 ok · 4 PULADO · 0 FALHOU        (157 réguas)
Pulados: timepag.mjs licenca.mjs liclink.mjs licauto.mjs
```

Os quatro pulos são os de sempre: `timepag.mjs` cobra uma página aposentada, e
os três de licença precisam do `emitir-licenca.py`, que guarda as chaves
privadas e não viaja no zip.

**Um erro meu de operação, registrado porque volta:** a linha de resumo desta
corrida se perdeu. Eu editei o `testes/rodar.sh` para registrar a régua do
Build 18 **enquanto ele ainda estava rodando** — e o bash lê um script por
DESLOCAMENTO DE BYTE, não de uma vez. Acrescentar um nome no meio do arquivo
deslocou tudo o que vinha depois, e o interpretador retomou a leitura no lugar
errado: `unexpected EOF while looking for matching '"'`. As 157 réguas tinham
terminado; o que morreu foi o rodapé que as soma.

O resultado acima foi contado do log, linha a linha. E a regra que fica: não se
edita a esteira enquanto a esteira corre.

---

## O que fica da fila

**O Build 10 fechou.** Os cinco itens dele estão pagos: rolagem horizontal a
380px (Build 13), `<main>` e link de pular conteúdo (Build 13), estado honesto
de recurso por navegador (Build 15), acessibilidade da ferramenta (Build 14) e
a busca na Ajuda (este).

## O que eu faria em seguida

1. **Build 11 — motor e medição.** O primeiro item barato e com resposta
   comercial: a pergunta do funil de inglês (48 visitas, zero conversões).
   Meia hora de consulta, e agora ela responde de verdade, porque o `check` de
   idioma parou de descartar `de` e `fr`.
2. **Ainda no Build 11:** classificar o erro do `buildPipe()` e saltar direto
   para o fallback pertinente — hoje algumas falhas custam 73–200 MB de
   download extra a quem já estava esperando.
3. **Build 12 — a dívida.** Nada que o usuário veja.

Continuam parados por sua instrução: **Stripe** (DEC-14) e **Drive** (DEC-15).

**Operacional, e ainda pendente:** `CONVITE_SAL` é obrigatória na Vercel. Sem
ela o endpoint de convite responde 503 e o aplicativo cai para `mailto:`.

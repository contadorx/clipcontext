# Build 4-A — A folha de estilo

**Data:** 23/08/2026
**Fila completa:** `FILA.md`. **Decisão nova deste build:** `DEC-18`.
**Princípio novo, dado por você:** *acabamento novo vai para recurso pago* — está
registrado em `FILA.md`, com o alcance que você confirmou.

Fora da numeração de propósito. Ele nasceu de dentro do Build 4 e você pediu que
saísse sozinho, com captura de tela antes e depois. Numerá-lo como 5 empurraria
os outros dez builds e quebraria as referências das decisões.

---

## Os dois números da fila estavam errados

O item dizia *"cinco classes usadas e ausentes, cinco regras mortas"*. Medido:
**quatro** classes usadas sem regra e **seis** regras mortas. E a forma do
defeito era outra, melhor do que a que eu tinha escrito.

### A mesma coisa escrita duas vezes, uma de cada lado da folha

| | |
|---|---|
| `.passos` | cinquenta listas de passos, em dez páginas, escrevendo uma classe **sem regra nenhuma** |
| `ol.passosRodada` | a regra escrita **para elas** — recuo, largura de leitura, marcador na cor de destaque — com um nome que **nenhum arquivo cita** |

As duas ao mesmo tempo, na mesma folha, a seis linhas de distância. E o par se
repete mais abaixo: `table.cmpPlanos` estilizava a tabela de comparação que o
`build.py` emite como `cmpCurta`.

Conferido na história: no `main` de 19/08 o `class="passos"` **já estava lá** e a
regra não existia. Ela entrou depois, com o nome errado, e nunca pegou. As
cinquenta listas passaram esse tempo todo com o `<ol>` cru do navegador — recuo
largo demais e marcador na cor do texto.

**Nenhuma das duas metades dá erro.** Classe sem regra cai no padrão do
navegador; regra sem classe não pinta nada. O CSS não reclama de nenhuma das
duas, e é por isso que envelhecem juntas por meses.

### A `.row` escrevia a mesma decisão setenta vezes, e ela não funcionava

`.row` computava **`display:block`** — medido na página servida, não deduzido do
CSS. E os setenta usos carregavam `gap` e `flex-wrap` no `style` inline, em
trinta e cinco arquivos.

**As duas propriedades só valem em container flex.** Quer dizer: setenta
elementos repetiam à mão uma decisão de estilo que não fazia efeito nenhum. Os
botões se separavam pelo espaço de palavra do texto — uns quatro pixels — no
lugar dos dez pedidos.

A regra certa já existia, **dentro da ferramenta**: `.row{display:flex;gap:10px;
align-items:center;flex-wrap:wrap}`. As duas folhas são separadas de propósito —
o app é um arquivo só e não pode baixar o `site.css` —, e o site simplesmente
nunca ganhou a sua cópia. Ganhou agora, e os setenta `style` inline perderam a
razão de existir.

### A `.lockHint` não estava quebrada — estava repetida

Os vinte e um usos carregavam o estilo **inteiro** no inline. Nada aparecia
errado na tela; o que existia era a mesma decisão escrita vinte e uma vezes, e
mudar a cor da barra lateral exigia vinte e uma edições.

Virou uma regra. **A prova de que nada mudou é a captura:** as páginas com
`.lockHint` saíram idênticas byte a byte no antes e no depois.

### O que sobrou no inline, e por que sobrou

Só o que **varia** de um uso para o outro:

```
  25×  .row       margin:0 0 8px
  25×  .row       margin-top:30px
  15×  .lockHint  margin:0 0 26px
  10×  .row       gap:9px;margin-top:12px
   5×  .lockHint  margin:0 0 30px
   5×  .row       gap:9px;margin:12px 0 0
   5×  .row       gap:9px;margin-top:6px
   1×  .lockHint  margin:22px 0
```

As margens são diferentes de propósito. Os `gap:9px` também: são um pixel
diferentes do padrão, e normalizá-los mudaria pixel na tela — eu não faço isso
sem você ver. Fica anotado como coisa pequena, e não como conserto pendente.

**Líquido: 2.484 bytes de `style` inline a menos**, em 51 arquivos.

---

## O que mudou na tela, medido nas 320 capturas

Capturei **cada página em cada idioma, nos dois tamanhos** — 80 combinações no
desktop (1200px) e 80 no telefone (390px), antes e depois. O diff é pixel a
pixel, e não olhômetro.

```
desktop    30 páginas idênticas · 50 mudaram
telefone   30 páginas idênticas · 50 mudaram
```

As 50 são exatamente as dez páginas que têm lista de passos, nos cinco idiomas:
`casoAta`, `casoEv`, `casoIa`, `casoIn`, `casoUx`, `link`, `seguranca`, `steps`,
`time`, `verificar`. As 30 idênticas incluem `/`, `/precos`, `/ajuda`,
`/comparativo`, `/privacidade` e `/termos`.

**A `/ajuda` sair idêntica é a prova do `.lockHint`**: ela é a página que o usa,
e o antes e o depois batem byte a byte.

A variação de altura fica entre **−22px e +32px** por página. Ela vem da largura
de leitura (`max-width:64ch`): a linha quebra mais cedo, então algumas listas
ficam mais altas e o recuo menor devolve espaço em outras. Nenhuma página mudou
de largura, e nenhuma passou a rolar na horizontal.

Conferido também com o navegador aberto, e não só na imagem: `.row` agora
computa `display:flex` com vão real de 10px entre os botões; `ol.passos` recebe
`padding-left:22px` e `max-width:651px`; a `.lockHint` continua com a borda na
cor de destaque, 12px de recuo e a margem que ela sempre teve.

---

## A régua que impede as duas metades

`testes/folha.mjs` confere a folha contra quem a usa, **nos dois sentidos**:

1. toda classe escrita no HTML do site tem regra em algum lugar;
2. toda regra da folha tem alguém que a escreva.

**Provado nos dois sentidos**, com o defeito reintroduzido de propósito: uma
classe nova sem regra reprova o bloco 1 pelo nome; uma regra nova sem uso
reprova o bloco 2 pelo nome.

Ela **não olha para `src/template.html`**: a ferramenta tem folha própria,
embutida, porque é um arquivo só. Cobrar uma contra a outra reprovaria o
desenho, e não um defeito.

> **A régua me reprovou duas vezes enquanto eu a escrevia, e nas duas com
> razão.** A primeira versão não varria o `build.py` e condenou uma regra viva; a
> segunda não varria `app/` e condenou trinta e duas regras do painel da conta e
> do blog. Uma varredura que não olha para todo mundo que pinta acusa inocente —
> e uma régua que acusa inocente é rolada para baixo na terceira vez.

A única exceção é a `.heroTxt`, escrita com o motivo e impressa em toda
execução: ela nomeia a primeira coluna do `.heroDuo`, que é um grid, e existe
para quem lê o HTML saber o que é aquela metade — não para pintar nada.

---

## O que eu achei e NÃO consertei

**Na `/precos`, o que o plano Free não tem sai em ✕ vermelho.** Seis células,
`var(--err)`, 17px, negrito.

E não fui eu que achei: foi o autor da folha. A regra morta que eu ia apagar
existia justamente para consertar isso, e trazia o argumento escrito —
*"vermelho ali leria como defeito, e o que a célula diz é 'isto é do plano de
cima'"*. Ela nunca pegou, porque foi escrita com o nome errado.

Isso é **decisão comercial, e não conserto**. A `/steps` também usa ✕ vermelho e
lá está certo: ela compara com um concorrente. Na `/precos` o mesmo símbolo
aponta para dentro de casa. Apaguei o código morto e levei o argumento para a
**DEC-18**, com três caminhos e a minha indicação — cinza, mantendo o símbolo.

---

## A esteira

```
141 ok · 4 PULADO · 0 FALHOU
Pulados: licenca.mjs liclink.mjs licauto.mjs legal.mjs
  Um teste pulado NÃO é um teste que passou. O motivo de cada um está acima.
Nada vermelho — mas a cobertura é a dos 141, não a dos 145.
```

**145 réguas, contra 144 no Build 4** — entrou a `folha.mjs`. Os quatro pulados
são os mesmos de sempre, e continuam ditos com todas as letras.

E a esteira ganhou um **instrumento**, que este build provou valer a pena ter:
`testes/capturar.mjs` fotografa cada página em cada idioma e compara pixel a
pixel. Ele não afirma nada — é ferramenta, e está declarado como tal no
`inventario.mjs`, ao lado do `proxy`, da `regua` e do `gerar-dpa`. O modo de
usar está no `testes/LEIA-ME.md`.

---

## O que eu faria a seguir

1. **Build 5 — o caminho até a compra.** Quem clica "Assinar o Team" chega à
   conta e escolhe de novo: o clique não leva a intenção consigo. É o único item
   da fila que custa venda todo dia.
2. **A DEC-18**, que é uma linha de CSS e entra junto com o Build 6 — o build
   das promessas da página de preços.
3. **A DEC-17** (vocabulário em alemão e francês), no mesmo Build 6.

Represados por sua instrução, sem mudança: Stripe (DEC-14), Drive (DEC-15) e o
vocabulário de cenários (Build 12).

# 1.1 — arquivo único ou passo de build

Análise da decisão que destrava a C3. Medido no repositório em 22/08/2026, não
suposto.

---

## A pergunta como está posta já tem resposta

**O passo de build já existe.** O `build.py` gera **dois** arquivos a partir do
`src/template.html`: o `public/app.html` e o `offline/walkstamp-offline.html`
(22.418 e 22.815 linhas — eles são diferentes). No caminho ele troca `__MARCA__`,
`__CONTATO__`, `__EMPRESA__`, `__CNPJ__`, injeta as figuras SVG, e no build
offline embute o jsPDF inteiro no lugar do marcador `__JSPDF__`. O cabeçalho do
próprio arquivo diz: *"Edite sempre src/template.html. Os arquivos gerados são
descartáveis."*

Então a decisão **não é** "aceitar um passo de build". É:

> **o passo de build que já existe passa também a juntar fontes?**

É uma pergunta bem menor do que a original, e é a diferença entre uma mudança de
arquitetura e uma mudança de arrumação.

---

## O que não está em jogo

**A promessa do produto.** "Baixe um arquivo, funciona sem rede, sem servidor" é
sobre o **entregável** — e o entregável continua sendo um arquivo só nos dois
caminhos. Aliás já são dois entregáveis diferentes, gerados. Modularizar a
**fonte** não encosta nisso.

Vale separar porque as duas coisas andam coladas na cabeça de quem escreveu o
arquivo, e são independentes: dá para ter fonte em cinquenta módulos e entrega
em um arquivo, que é exatamente o que o `build.py` já faria.

---

## Do que o arquivo é feito

| Parte | Linhas | % | Acoplamento |
|---|---:|---:|---|
| CSS | 1.127 | 5% | nenhum |
| HTML | 2.006 | 8% | baixo |
| **Dicionário `I18N`** | **3.105** | **14%** | **nenhum — é dado puro** |
| JS de verdade | 16.168 | 72% | **é aqui que mora o problema** |

Dentro dos 16 mil de JS: **669 declarações** no nível de cima do fechamento —
358 funções, 204 `const` e **107 `let`/`var`**.

E 186 cabeçalhos de seção comentados (`/* ===== medição ===== */`,
`/* ===== revisão assistida ===== */`). Ou seja: **o arquivo já é modular em
espírito**, ~87 linhas por seção. O que falta é a fronteira ser real em vez de
ser um comentário.

---

## Onde mora o custo real: as 107 variáveis mutáveis

`LANG`, `ocupado`, `pausado`, `pipe`, `camStream`, `clipeOn`, `asrRodando`,
`gravou`… Num fechamento único, `let pausado` é grátis: qualquer uma das 358
funções lê e escreve.

Em módulos ES, **um `import` é uma ligação só-leitura**. Cada uma dessas 107 vira
ou um `export` com função setter, ou uma entrada num objeto de estado
compartilhado. São 107 conversões, cada uma um lugar onde o comportamento pode
mudar **em silêncio** — não com erro, com timing diferente.

É daí que saem os 8 a 12 dias, e é daí que sai o risco. Não é o trabalho de
recortar: é o de provar que nada mudou.

---

## O que o arquivo único está custando hoje — medido

**1. A sua própria régua precisa de `eval` para fazer o trabalho dela.**

O `testes/chaves.mjs` — que garante que os cinco idiomas do produto têm as mesmas
chaves, na mesma ordem, com os mesmos marcadores — faz isto:

```js
const s = fs.readFileSync(`${RAIZ_WS}/src/template.html`,'utf8');
const i = s.indexOf('const I18N = {');
let d=0, j=s.indexOf('{', i), fim=j;
for (; j<s.length; j++){ if(s[j]==='{')d++; else if(s[j]==='}'){d--; if(!d){fim=j; break}} }
const I = eval('(' + s.slice(s.indexOf('{', i), fim+1) + ')');
```

Ele **fatia HTML, conta chaves e roda `eval`** para conferir um dicionário. E o
contador de chaves **não pula strings**: há **1.311 ocorrências de `{`** dentro
do bloco (os marcadores `{0}`, `{1}`). Funciona hoje porque todas estão
balanceadas. Uma tradução com uma chave solta — um `{` num texto em alemão, um
`}` numa nota em francês — e o contador para no lugar errado: a régua ou quebra
no `eval`, ou **trunca o dicionário e aprova a metade que sobrou**.

Não é hipótese elegante: é o mesmo formato de defeito que esta semana inteira
esteve corrigindo — a régua que passa dizendo que está tudo bem.

**2. A casa já tem os dois padrões, e o produto está no pior.**

O **site** já tem i18n em arquivo externo: `src/i18n-site.json`, 157 chaves × 5
idiomas, 88 KB, lido pelo `build.py` e pelo `lib/site.ts`. O **produto** tem
3.105 linhas de dicionário dentro do HTML. Mesma casa, duas soluções para o mesmo
problema — e a de fora é a boa.

**3. Nada lint, nada tipifica esses 16 mil linhas.**

O `tsconfig.json` cobre o Next (`app/`, `lib/`). Não há eslint, biome nem
prettier no repositório, e nenhum deles alcançaria JS dentro de `<script>` num
`.html` sem configuração específica. Os `npm scripts` são cinco, nenhum de
qualidade estática. Toda a verificação do produto é comportamental — as 146
réguas — o que é **bom** e é caro: um erro de digitação num nome de variável só
aparece quando uma régua passa por aquela linha.

---

## Recomendação

**Não decida os 8 a 12 dias agora. Faça a fatia de 1 dia e deixe ela responder.**

### O corte: o dicionário sai para `src/i18n-app.json`

- **14% do arquivo** (3.105 linhas) saem de uma vez;
- **acoplamento zero** — eu conferi: é `const I18N = { … };` de ponta a ponta,
  dado puro, nenhuma função nem referência a `document` dentro;
- **o padrão já existe na casa** — é literalmente o que o site faz;
- o `build.py` inlineia na geração, como já faz com o jsPDF. **O entregável não
  muda em um byte**;
- o `chaves.mjs` para de fatiar HTML e passa a ler JSON, e o defeito latente do
  contador de chaves morre junto;
- **é reversível**: se não gostar, volta com uma linha de build.

### E, principalmente: isso responde a pergunta que você está fazendo

Depois dele o arquivo tem ~19 mil linhas em vez de 22 mil.

- **Se a dor sumiu** — se o incômodo era rolar por 3 mil linhas de tradução para
  chegar no código —, os 8 a 12 dias não eram necessários, e você economizou dez
  dias respondendo com um.
- **Se a dor continuou**, você aprendeu algo que hoje não sabe: o problema não é
  o tamanho, é o JS. E aí a conversa passa a ser sobre as 107 variáveis, que é o
  assunto de verdade — com um número na mão em vez de uma impressão.

---

## Se a dor continuar: por onde eu cortaria

**Corte por estado, não por assunto.** A tentação é separar por tema — "captura",
"transcrição", "saídas". O que decide a fronteira é quem compartilha as 107
mutáveis: um módulo que precisa importar quarenta delas não é um módulo, é o
mesmo arquivo com um `import` no meio.

**E o `build.py` continua sendo o montador.** Não coloque bundler
(webpack/rollup/esbuild) nisto. Um produto cuja promessa é "sem servidor, sem
dependência" não deveria passar a depender de uma cadeia de 300 pacotes para ser
montado — e o `build.py` já concatena. Concatenar módulos é a mesma operação.

---

## O que eu não recomendo

- **Não migrar para TypeScript junto.** Duas mudanças grandes ao mesmo tempo e,
  quando algo quebrar, você não sabe qual delas foi.
- **Não fazer isso antes** da validação com leitor de tela (30 min) e da semana
  de funil limpo. Os dois são baratos, e os dois te dizem mais sobre o produto
  do que dez dias de recorte.
- **Não modularizar "para poder testar melhor".** Você já tem 146 réguas
  comportamentais rodando contra o produto de verdade — que é a forma cara e
  correta. Teste unitário de função extraída é mais barato e prova menos.

---

## Resumo em quatro linhas

1. O passo de build **já existe** — a pergunta real é bem menor do que parece.
2. A promessa do arquivo único **não está em jogo**: ela é sobre a saída.
3. O custo real são **107 variáveis mutáveis compartilhadas**, não as 22 mil linhas.
4. **Tire o dicionário primeiro** (1 dia, 14%, reversível). Ele resolve um defeito
   latente na sua régua e responde, com evidência, se os outros 8 a 12 dias valem.

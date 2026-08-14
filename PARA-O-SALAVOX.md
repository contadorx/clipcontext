# O que o ClipContext tem para devolver ao SalaVox

Escrito em 13/08/2026, depois de ler o SalaVox inteiro para melhorar o ClipContext. Ele me ensinou
sete coisas — estão em `DESEMPENHO.md`, todas implementadas. Este documento é a direção contrária:
**o que daqui vale para lá.**

Filtrei por utilidade real. Não entra o que é do domínio do ClipContext e não existe no SalaVox
(varredura de frames, PDF pareado). Entra o que resolve um problema que o SalaVox **tem hoje**, e
duas coisas que ele já sabe que quer.

---

## 1. Dois defeitos concretos, achados lendo o código

Estes não são sugestões de estilo. São coisas que vão morder.

### 1.1 O comentário que mente sobre a constante

`src/app.js:1725` diz que o limiar de voz é **12% do nível dos trechos mais altos**. O código, em
`limiarDoCanal`, usa **0,06 — 6%**. A troca está explicada no comentário da própria função (o teste de
arquivo importado passou raspando com 12%, porque o trecho baixo tinha 18 dB a menos que o alto), mas
o comentário de bloco lá em cima ficou para trás.

Isso é pior que um comentário ausente. Quem for calibrar a peneira daqui a seis meses vai ler o bloco,
acreditar em 12%, e não entender por que os números não fecham. **Corrigir o texto, ou apagá-lo.**

### 1.2 O `.ico` que não muda quando a marca muda

Acabei de pagar por isso aqui. O SalaVox tem `public/favicon.svg`, e nenhuma versão nas referências de
ícone. Navegador guarda favicon de forma agressiva — em Chrome, num banco próprio, praticamente para
sempre. **No dia em que a identidade visual mudar, quem já visitou continua vendo a antiga**, e a
suspeita natural é que o deploy falhou.

A correção é uma constante no build e `?v=N` nas referências:

```python
ICON_V = "2"   # suba quando a marca mudar
```

```html
<link rel="icon" href="/favicon.ico?v=2" sizes="any">
<link rel="apple-touch-icon" href="/apple-touch-icon.png?v=2">
```

Enquanto estiver aí: **o `apple-touch-icon` não pode ter transparência.** O iOS não respeita alfa e
compõe sobre preto, então cantos arredondados transparentes viram cantos pretos na tela inicial. Tem
que ser opaco e sangrando até a borda — o iOS aplica o próprio arredondamento.

---

## 2. Gerar os vídeos por script, não gravar à mão

**Este é o item que eu mais recomendo, e é o que custa mais caro descobrir tarde.**

O SalaVox tem `public/img/*.webp` — capturas de tela da interface, em dois idiomas. São pixels. No dia
em que a paleta, o layout ou um rótulo mudarem, elas ficam erradas, e refazer é trabalho manual
multiplicado por idioma.

Acabei de passar por isso no ClipContext: uma troca de paleta invalidou dois vídeos e um GIF, e eles
também estavam **desatualizados** — mostravam funcionalidades que não existiam mais e não mostravam as
novas. Recolorir teria produzido um material certinho de um produto que não existe.

A saída foi transformar tudo em script (`brand/gerar/`):

- **Um roteiro em Playwright percorre o app de verdade** e grava com `recordVideo`. Como o Playwright
  não grava o ponteiro do sistema, injetei um cursor sintético — um `div` com `transition` que se move
  até o centro do elemento antes de cada clique e pulsa no clique. É o que torna o vídeo legível.
- **O roteiro anota os próprios tempos** (`{scanIni: 8.7, scanFim: 19.6}`) e a montagem usa esses
  números para acelerar o trecho chato — no meu caso a barra de progresso, 3,2× — em vez de eu chutar
  onde cortar.
- **O áudio da narração é reaproveitado.** A voz não muda quando a cor muda: só a imagem é redesenhada
  e remuxada com a trilha original.

Para o SalaVox isso vale ainda mais que para mim, porque as imagens estão em dois idiomas e na landing,
que é a peça de conversão.

**A armadilha que só apareceu medindo**, e que vale de aviso: o vídeo de demonstração do ClipContext é a
vitrine da detecção de cena. Ao redesenhá-lo, duas telas ficaram estruturalmente parecidas demais e a
diferença caiu abaixo do limiar — a ferramenta passou a achar 4 telas em vez de 5, e o exemplo
**subestimava o próprio recurso que deveria demonstrar**. Não dá para ver isso olhando. Só medindo, com
a mesma assinatura que o produto usa. O equivalente no SalaVox seria uma imagem de demonstração que
mostra uma ata pior do que ele sabe produzir.

---

## 3. Um validador de contraste, rodado antes de mexer em cor

O ClipContext ganhou `brand/paletas.py`: as paletas candidatas e um verificador WCAG de oito pares
(texto sobre fundo, secundário, acento como link, texto do botão, aviso, erro — em claro e escuro).

O que ele pegou: **a paleta antiga reprovava**, com o acento como link em 3,97:1 contra o mínimo de
4,5:1. Estava no ar havia meses e ninguém tinha percebido, porque contraste não se avalia no olho —
`#C2603A` sobre branco *parece* legível.

São cinquenta linhas de Python e roda em milissegundos. Vale como porta antes de qualquer mudança de
cor, do mesmo jeito que os valores golden de `quantasLinhas` valem antes de mexer nas linhas.

---

## 4. Sobre o download do modelo: uma ideia que talvez fuja da conta de banda

O SalaVox já mapeou isto em `DESEMPENHO.md` — espelhar o modelo no próprio domínio resolve rede de
escritório que bloqueia CDN, e o que trava é o custo de banda na hospedagem.

Uma alternativa que não paga banda: **oferecer o modelo como arquivo que a pessoa baixa uma vez e
carrega do disco.** `transformers.js` aceita modelo local (`env.allowLocalModels` e `localModelPath`),
e a mesma `ferramentas/baixar-modelo.mjs` que já existe produziria o pacote. Em rede corporativa que
bloqueia CDN, hoje o produto simplesmente não funciona; com isso, funciona com um passo manual.

Não é bonito. Mas é a diferença entre "não dá" e "dá com trabalho", e não custa um centavo de
hospedagem — que é a mesma restrição que me guiou aqui.

---

## 5. Duas coisas que eu **não** recomendaria copiar de mim

Por simetria, e porque lista só com elogio não ajuda ninguém.

**O escritor de ZIP e o gerador de `.docx` à mão.** Faz sentido no ClipContext porque o build offline
precisa ser um arquivo único e autocontido — cada dependência o engorda. O SalaVox tem servidor, tem
`node_modules` e tem API: para ele, uma biblioteca de `.docx` é a escolha certa, e escrever OOXML na
mão só compraria a armadilha da ordem dos elementos em `w:rPr` (o schema é uma *sequence*: com
`w:color` depois de `w:sz`, o LibreOffice abre e **o Word recusa o arquivo inteiro**).

**Guardar tudo no navegador por princípio.** É a promessa do ClipContext e o motivo de ele não ter
custo. O SalaVox tem contas, cobrança e painel — a restrição não é a mesma, e imitá-la seria abrir mão
de coisas que ele já decidiu que quer.

---

## Resumo, em ordem de retorno

| | o quê | esforço |
|---|---|---|
| 1 | Corrigir o comentário dos 12% em `app.js:1725` | minutos |
| 2 | `?v=N` nos ícones e `apple-touch-icon` opaco | minutos |
| 3 | Validador de contraste antes de mexer em cor | uma hora |
| 4 | Gerar as imagens da landing por script | uma tarde, e paga na primeira mudança de marca |
| 5 | Modelo em arquivo local, para rede que bloqueia CDN | maior, e resolve um "não funciona" |

Os dois primeiros são defeitos. Os três últimos são seguros contra o tipo de retrabalho que só aparece
quando já é tarde.

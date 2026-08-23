# A regressão

145 arquivos que afirmam coisas sobre o produto. Cada um roda sozinho com
`node <arquivo>.mjs` e sai com código 1 se alguma afirmação cair.

## Primeiro uso, depois de abrir o zip

```bash
bash testes/preparar.sh      # confere o que falta e gera as amostras
```

Ele **não reescreve mais os testes**: eles perguntam onde estão a
`testes/_caminhos.mjs`, que deduz a raiz de `import.meta.url` e descobre o
Chromium no disco. Sobrou para o script o que é de verdade preparação.

Ele gera os **vídeos de amostra** que os testes carregam de `/tmp`
(`amostra`, `cinco`, `retrato`, `so-relogio`, `fala-longa`) com
`testes/amostras.py`. Eles não viajam no zip por peso, e sem eles a esteira
acusava `ENOENT` — que na saída é indistinguível de defeito do produto.

`fala-longa` são cinco minutos, e existem por um motivo só: a janela do Whisper
é de trinta segundos, e `parar.mjs` cobra o botão que para a transcrição ENTRE
um trecho e o seguinte. Num vídeo de dez segundos há uma janela só — e num
vídeo de uma janela a única coisa que dá para provar sobre parar entre janelas
é que o teste não provou nada.

Mais um é opcional e pesado, e por isso não é gerado sozinho:

```bash
python3 testes/amostras.py --longo    # 1 hora de vídeo, ~1 min, 41 MB
```

Ele alimenta **três** réguas — `varredura.mjs`, `audio.mjs` e `espera.mjs` —,
que medem em material de verdade. Sem ele, as três **pulam dizendo isso** em vez
de falhar.

> **Gere este arquivo antes de confiar num "verde".** O `espera.mjs` é quem
> afirma que o texto aparece na tela ENQUANTO a transcrição corre — a diferença
> entre uma ferramenta que parece travada e uma que não parece. Até 23/08 ele
> pulava em letra minúscula e a esteira o somava aos verdes: passou builds
> inteiros contando como aprovado sem nunca ter rodado.

## Os três estados, e a diferença entre pular um arquivo e pular um bloco

A esteira conta `ok`, `PULADO` e `FALHOU`, e um pulado **não entra na
cobertura**. Quem decide isso é a forma da linha:

- **`PULADO` no começo da linha** quer dizer *este arquivo não rodou* — falta o
  material ou a ferramenta. O `rodar.sh` tira o arquivo inteiro da conta e
  imprime o motivo no rodapé.
- **`BLOCO PULADO`** quer dizer *um bloco não rodou, o resto do arquivo rodou*.
  Aparece no rodapé do mesmo jeito, e o arquivo continua contando como verde,
  porque ele é.

Escrever `  pulado  ` em minúscula não é nenhum dos dois: a esteira não vê, o
processo sai 0, e o arquivo é somado aos aprovados. `inventario.mjs [4]` reprova
quem fizer isso.

## O antes e o depois de um build visual

`capturar.mjs` é **instrumento, e não régua** — ele não afirma nada sozinho.
Existe porque um build de CSS não se prova com teste de texto: `display:block`
virando `display:flex` passa em toda régua desta pasta e ainda assim pode
estragar dez páginas.

```bash
node testes/capturar.mjs /tmp/antes            # com o site de pé em :8802
LARG=390 node testes/capturar.mjs /tmp/antes-tel
#  ... mexe, npm run build, sobe de novo ...
node testes/capturar.mjs /tmp/depois
node testes/capturar.mjs --diff /tmp/antes /tmp/depois
```

Ele fotografa **cada página em cada idioma** — as duas listas saem do
`rotas.json`, e não de uma lista escrita aqui — e o `--diff` compara pixel a
pixel.

O número que importa é **quantas ficaram idênticas**. Numa mudança que devia ser
invisível, qualquer página diferente é defeito; numa mudança deliberada,
qualquer página que mudou **sem estar na lista** é defeito. Os dois lados
precisam do mesmo dado. Foi assim que o Build 4-A provou que a `.lockHint` não
mexeu num pixel e que só as dez páginas com lista de passos mudaram.

## O navegador da régua, e por que ele não é o do Playwright

Cinquenta arquivos importam o Chromium de `_navegador.mjs`, e não de
`playwright`. A diferença é uma linha: ele abre os `<details class="sub">`
antes de a página carregar.

Existe porque dois painéis do passo 3 — a fala e a identificação — nascem
RECOLHIDOS, e para o Playwright um elemento dentro de um `<details>` fechado
não é invisível por opinião: ele não tem caixa, e `fill()` recusa com "element
is not visible". Sem o atalho seriam cinquenta edições, uma por arquivo, cada
uma num ponto diferente — e cinquenta chances de errar uma.

Ele abre painéis e mais nada: não mexe em estado, não preenche campo, não muda
o produto. E o estado recolhido continua cobrado por `perna.mjs`, que importa o
Playwright DIRETO justamente para enxergá-lo — inclusive uma afirmação de que o
atalho não toca em mais nada. Um atalho que apagasse a própria régua seria o
atalho se autoaprovando.

**Se você escrever um teste novo que dirige `#tr`, `#evBox` ou qualquer coisa
dentro daqueles painéis, importe de `./_navegador.mjs`.** Se o teste for sobre a
tela como ela abre, importe de `playwright`.

## O que NÃO roda a partir do zip

Três testes de licença (`licenca`, `liclink`, `licauto`) e um bloco do
`semmarca` precisam de `emitir-licenca.py` e de `PLANO-TIME.md`, que guardam as
chaves privadas e **não podem** viajar no pacote. Eles pulam, dizendo por quê.
Rode-os na máquina onde o emissor vive.

## As duas esteiras

```bash
bash testes/rapido.sh app      # a ferramenta, só comportamento       (~3m30)
bash testes/rapido.sh medir    # as réguas: memória, peso, espelho, espera (~12 min)
bash testes/rapido.sh site     # o site: build + next build + páginas
bash testes/rapido.sh a.mjs b.mjs
bash testes/liberar.sh         # a pista de liberação: libera um build   (~1-3 min)
bash testes/rodar.sh           # a regressão inteira: libera uma entrega (~70 min)
```

`rodar.sh` sobe um Next de verdade na 8802 antes de começar, porque sete testes
falam com ele em vez de ler `public/`.

## Antes de entregar um zip

O pacote é montado **de dentro** da pasta do projeto, nunca da pasta acima —
montado de fora, os padrões de `naovai.txt` não casam com o prefixo e as chaves
privadas vão junto. Já aconteceu.

```bash
cd <raiz do projeto>
zip -qr /tmp/walkstamp.zip . -x@testes/naovai.txt
```

Depois **confira**, não confie: `emitir-licenca.py`, as duas chaves privadas,
`node_modules`, `.next`, `.env` e `PLANO-TIME` têm que contar zero.

## Por que eles moram aqui

Moravam em `/tmp`. O zip entregue não levava teste nenhum: quem abrisse o pacote
recebia o produto sem a rede que prova que ele funciona, e qualquer sessão nova
começava sem saber o que já estava garantido. Um teste que não viaja junto com o
código é um teste que existe uma vez só.

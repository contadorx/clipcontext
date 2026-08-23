# A régua de desempenho

## O que estava errado

O arquivo do produto tinha **39 `performance.now()` e zero `performance.mark()`**.

A diferença não é de estilo. Um `now()` avulso calcula uma diferença, mostra numa
frase e joga fora: o número existe no instante e some. Com isso não dá para
comparar duas execuções, nem duas máquinas, nem a mesma máquina antes e depois
de uma mudança — e sem isso, trocar a janela, trocar o modelo ou mexer na
compactação de silêncio é palpite com cara de decisão.

`performance.mark()` custa o mesmo e resolve os dois casos: aparece na linha do
tempo do navegador de graça, e fica guardado num formato que uma régua lê.

**Nada disto sai da máquina.** Não é telemetria: é um bloco de números que
`window.__medidas()` devolve para quem estiver medindo. A medição que sai daqui
continua sendo a de sempre — três eventos, sem identificador. `testes/marcos.mjs`
cobra isso explicitamente.

## As oito fronteiras

O plano pedia oito, e as oito estão marcadas:

| fronteira | marco | o que vem junto |
|---|---|---|
| leitura do arquivo | `arquivo.lido` | `ms_leitura`, `bytes` |
| decodificação do áudio | `audio.decodificado` | `ms_decodificacao`, `taxaDecodificada`, `reamostrou` |
| cache / download | `modelo.inicio` + cada `modelo.degrau` | `cacheQuente`, `ms_download`, `bytes` |
| sessão do ONNX | cada `modelo.degrau` | `ms_sessao` — o tempo **depois** do último byte |
| primeiro texto | `texto.primeiro` | `ms_desdeOInicio` |
| inferência total | resumo | `paredeDaInferencia`, `vezesTempoReal` |
| fallback | `modelo.degrau` × n, `modelo.pronto`, `modelo.desistiu` | `rotulo`, `ok`, `ms_total`, `bytes` |
| áudio enviado ÷ original | resumo | `enviadoSobreOriginal` |

Três decisões que o formato tomou, e por quê:

**Rede e sessão são tempos separados dentro do mesmo degrau.** Um degrau lento é
ambíguo: rede ruim e máquina ruim rendem o mesmo cronômetro, e a decisão que sai
de cada uma é oposta — uma pede arquivo menor, a outra pede outra sessão. Num
cache quente `ms_download` é zero e o degrau inteiro é sessão.

**Os degraus que perderam contam.** `mbBaixados` soma o caminho todo, e não o
arquivo que venceu. Foi assim que uma máquina real gastou **353 MB** antes de uma
sessão subir; um número que só olhasse o vencedor esconderia exatamente o
desperdício que se quer enxergar.

**Mais de uma construção por aba é o caso normal.** A cortesia adianta o modelo
enquanto a pessoa ainda escolhe o arquivo, e trocar o modelo na tela monta outro.
`construcoes` diz quantas houve; o relógio da escada é o da última — a que
produziu o modelo em uso. Somar duas escadas responderia uma pergunta que
ninguém fez.

## As amostras

```
python3 testes/amostras.py --medida
```

Gera `/tmp/medida-1min.webm`, `-10min` e `-40min` e o manifesto
`/tmp/medida-amostras.json` com o `sha256` de cada uma e a versão da receita
(`MEDIDA_VER`). A identidade viaja dentro do JSON de saída: dois números só se
comparam se o insumo for o **mesmo arquivo**, e não "um de dez minutos também".

**O que estas amostras não são: fala de verdade.** Não há sintetizador de voz
nesta máquina, e o áudio é um tom contínuo. Um tom rende menos texto que fala, e
o decodificador do Whisper para mais cedo — o tempo medido aqui é um **piso**, e
não a espera de um cliente. Ele serve para comparar duas execuções da mesma
coisa, que é o que a otimização precisa. Para prever a espera real é preciso um
vídeo real; o campo `fala` do JSON diz qual dos dois casos aquele número é.

## Medir

```
node testes/regua.mjs                              # 1 min, cache frio, 1 linha
node testes/regua.mjs --amostras=1min,10min,40min
node testes/regua.mjs --linhas=1,4 --cache=frio,quente
node testes/regua.mjs --placa --modelo=onnx-community/whisper-small
node testes/regua.mjs --saida=/tmp/regua.json --repetir=3
```

A régua não cronometra nada por fora: ela dirige o produto e recolhe o que o
próprio produto marcou. Uma régua que cronometrasse por fora mediria também o
Playwright, o servidorzinho e o disco desta máquina.

**Linhas.** O número de linhas do wasm não é uma opção: sai de
`quantasLinhas(hardwareConcurrency, crossOriginIsolated)`, e sem isolamento entre
origens o navegador não entrega `SharedArrayBuffer` — o runtime cai para uma
linha, faça o que fizer. Por isso `--linhas=4` serve a página com **COOP e COEP**
(`credentialless`, que é o par que a hospedagem usa) e força
`hardwareConcurrency`. O que foi forçado fica anotado em `pedido`; o que
realmente aconteceu fica em `obtido`.

**Cache frio e quente.** Frio é contexto de navegador novo — ele nunca viu o
modelo, que é a definição operacional. Quente é o **mesmo** contexto rodando de
novo. A ordem importa: pedir só `--cache=quente` dá um frio disfarçado, e a régua
avisa quando isso acontece.

**Placa.** `--placa` marca a caixa da pessoa. Numa máquina sem WebGPU a escada
cai para o processador e `obtido.motor` diz isso — o que foi pedido e o que
aconteceu são campos diferentes de propósito.

## Ela precisa de rede

O modelo vem do CDN e o peso vem do repositório de modelos. Numa máquina sem
saída para `cdn.jsdelivr.net` e `huggingface.co` a escada falha inteira — o que
**não** é defeito da régua, e ela diz assim: o JSON sai com `modelo.desistiu` e a
lista de degraus tentados. É uma medição legítima: a de uma máquina que não
consegue montar o modelo.

Foi o que aconteceu no contêiner em que esta régua foi escrita, e a corrida
serviu para provar o encanamento — servidor, isolamento, amostra, JSON — e para
mostrar uma coisa que ninguém tinha visto escrita: **duas escadas inteiras numa
carga só**, dez degraus, antes mesmo de o arquivo ser lido. É a cortesia
adiantando o modelo. Numa máquina com rede isso é um acerto; numa sem, é o dobro
do tempo até a mensagem de erro.

## O texto: antes e depois de mexer no motor

```
node testes/regua.mjs --base=/tmp/base.json     # grava a linha de base
# … mexe no motor …
node testes/regua.mjs --wer=/tmp/base.json      # compara com ela
```

**Duas perguntas diferentes usam o mesmo instrumento**, e vale não confundi-las.

WER contra uma transcrição **humana** responde *"o modelo entende esta fala?"*.
Para isso é preciso áudio real com texto conferido à mão, e isso não se fabrica:
as amostras desta régua têm um tom no lugar da fala. Quem tiver esse material
ganha a leitura com o mesmo comando.

WER contra a **linha de base** responde a pergunta que decide: *"o que eu acabei
de mexer alterou o texto?"*. É essa que o plano pede antes de tocar na
compactação de silêncio — a dúvida não é se o Whisper é bom, é se comprimir o
silêncio piora o que ele já produzia. E essa leitura sai sem transcrição humana
nenhuma.

**A chave da comparação leva o `sha256` da amostra.** Comparar o texto de hoje
com o de uma amostra diferente daria um WER alto que não quer dizer nada — e é
o tipo de engano que sobrevive semanas, porque o número "parece ruim mesmo".

**Remoção sai destacada dos outros erros.** Trocar trinta palavras espalhadas e
perder um parágrafo inteiro têm o mesmo tamanho na conta, e consequências
opostas. Quando o assunto é comprimir silêncio, é a segunda que importa — por
isso o veredito traz `fracaoRemovida` junto do WER.

`node testes/wer.mjs` afere o instrumento com casos de resposta conhecida: uma
substituição em quatro palavras é 0,25; inventar texto não dilui o erro, porque
o denominador é a referência; e doze mil palavras saem em segundos, porque a
conta guarda duas linhas em vez da matriz inteira.

## A aferição da régua

```
node testes/marcos.mjs
```

Roda **sem rede**: a biblioteca do Whisper é falsificada, e a falsificação faz de
propósito o que a máquina real faz por acidente — os dois primeiros degraus
falham, o terceiro baixa 12 MB em três pedaços e monta a sessão 250 ms depois do
último byte. Sem essa pausa, `ms_sessao` sairia zero e o teste passaria sem
testar.

Régua e aferição da régua são arquivos diferentes de propósito: uma medida errada
é pior que medida nenhuma, porque decide.

## O que a régua já corrigiu em si mesma

**O carimbo do tempo era sobrescrito pelo conteúdo.** `marco()` montava o objeto
com `Object.assign({nome, ms}, extra)`, e o marco da escada carrega um `ms`
próprio — a **duração** do degrau. Ela sobrescrevia o **instante**, e a linha do
tempo passava a andar para trás. O teste da ordem reprovou; o `extra` passou a
entrar antes, e a duração ganhou nome próprio (`ms_total`).

**`taxaOriginal` media o navegador, não o arquivo.** `dec.sampleRate` diz a taxa
em que o áudio **saiu** do decodificador — 16 kHz quando o navegador atende o
pedido do construtor, 48 kHz quando o ignora. As duas coisas só coincidem no
navegador que ignora. Virou `taxaDecodificada`.

## O primeiro número da série

Na primeira corrida completa (amostra de 10 s, biblioteca falsificada):
`enviadoSobreOriginal` = **1,00**. O modelo recebe hoje exatamente o áudio que o
vídeo tem — nada é descartado. É a linha de base que precisava existir **antes**
de alguém mexer na compactação de silêncio, porque é contra ela que qualquer
ganho vai ser medido.

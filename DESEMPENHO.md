# Desempenho — o que vale mexer, e o que não

Escrito em 13/08/2026, depois de comparar o ClipContext com o SalaVox, um projeto irmão que resolveu
os mesmos problemas de Whisper no navegador e mediu bastante coisa.

O critério aqui é estreito de propósito: **o ClipContext é gratuito e não tem servidor.** Então só entra
o que custa zero de infraestrutura. Nada de fila, nada de GPU alugada, nada de API por uso — isso já
está tratado em `ARQUITETURA-PAGO.md` e é outra conversa.

---

## Onde o tempo está de verdade

O ClipContext tem **dois** custos independentes, e eles não competem: a varredura de frames e a
transcrição. Quem cola uma legenda pronta paga só o primeiro. Quem transcreve paga os dois.

### 1. A varredura — medida aqui, nesta máquina

| operação | mediana |
|---|---|
| um salto no vídeo + assinatura 32x18 | **79 ms** (p90: 114 ms) |
| capturar um frame de 900 px em JPEG | 6,5 ms |

A varredura por cena usa `janela/700` como passo, com teto de 700 saltos. Para **uma hora de vídeo**
isso dá **55 segundos só saltando**, e menos de meio segundo gravando os frames.

**O custo é o salto, e nada mais.** Otimizar a assinatura, o canvas ou a captura não muda nada — juntos
eles são 8% do total. Isso é medição, não estimativa.

### 2. A transcrição

Não consegui medir aqui: o modelo vem de CDN e este ambiente não alcança a rede. Os números desta parte
são do SalaVox, que rodou o mesmo `transformers.js` com os mesmos modelos, e ordens de grandeza
conhecidas do Whisper. **Estão marcados como estimativa em todo lugar onde aparecem.**

O que sei com certeza, porque está no nosso código: o laço de transcrição manda **todas** as janelas de
30 s ao modelo, com ou sem fala dentro. E o runtime está preso em **uma linha**.

---

## O que vale fazer, em ordem

### 1. Um degrau embaixo do modelo de 4 bits — **é um defeito, não uma melhoria**

**Verificado neste repositório**, com um modelo simulado que abre normalmente e estoura na primeira
inferência:

```
Não consegui transcrever aqui: Can't create a session. ERROR_CODE: 1,
ERROR_MESSAGE: qdq_actions.cc:137 TransposeDQWeightsForMatMulNBits Missing required scale…
```

A transcrição morre inteira. O usuário fica com uma linha de C++ e nenhum texto.

O `try/catch` de hoje cobre só a montagem do pipeline. Mas o arquivo de 4 bits
(`decoder_model_merged: 'q4'`, que só o caminho da placa de vídeo pede) **só é aberto de verdade na
primeira inferência** — depois do `catch`. O SalaVox levou exatamente esse erro de uma reunião real,
duas vezes, e a pessoa ficou sem ata.

**Correção:** envolver também a chamada `pipe(seg, opts)`, e ao reconhecer a assinatura do erro
(`session|Missing required scale|MatMulNBits|DequantizeLinear|ERROR_CODE`) remontar o pipeline em
`dtype:'q8'` e refazer *aquele mesmo pedido*, uma vez só.

**Esforço:** baixo. **Ganho de velocidade:** zero. **Ganho real:** a transcrição deixa de morrer numa
classe inteira de máquinas.

---

### 2. Ligar as linhas do WASM — **o maior ganho gratuito da lista**

Hoje: `w.numThreads = 1`, escrito à mão. Num computador de oito núcleos, sete ficam parados.

Mais de uma linha exige `SharedArrayBuffer`, que exige isolamento entre origens, que se pede por dois
cabeçalhos de resposta — configuração de hospedagem, não código.

**O risco conhecido é que o isolamento quebre o carregamento de CDN de terceiro**, e o modelo, o
`jsPDF` e o Tesseract todos vêm de CDN. **Testei isso aqui**, servindo o app com os cabeçalhos e
carregando um script de outra origem *sem* `Cross-Origin-Resource-Policy` — o pior caso:

| | isolado | SharedArrayBuffer | script de outra origem |
|---|---|---|---|
| sem cabeçalhos | não | não | carrega |
| com `credentialless` | **sim** | **sim** | **carrega** |

`credentialless` e não `require-corp`: com `require-corp` todo recurso externo precisaria mandar CORP
próprio, e as CDNs não mandam — seria trocar velocidade por produto quebrado. Onde `credentialless`
não existe (Safari, hoje) o cabeçalho é ignorado, a página não isola e volta a uma linha. **Não há como
quebrar, só como não melhorar.**

No `vercel.json`:

```json
{ "key": "Cross-Origin-Opener-Policy",   "value": "same-origin" },
{ "key": "Cross-Origin-Embedder-Policy", "value": "credentialless" },
{ "key": "Cross-Origin-Resource-Policy", "value": "cross-origin" }
```

E no código, `min(4, núcleos − 1)` em vez de `1`. O teto de quatro não é timidez: o ganho achata depois
disso, e no ClipContext a transcrição divide a máquina com a captura ao vivo, quando ela está rodando.

**Ganho estimado: 2× a 4× no caminho do processador** — que é onde quase todo mundo está, porque a
placa de vídeo é a exceção. **Esforço:** baixo.

---

### 3. Peneira de silêncio na transcrição de arquivo — **grande, e já temos metade**

O laço de `$('auto')` manda todas as janelas de 30 s ao modelo. Uma janela com 4 segundos de fala custa
o mesmo que uma cheia: **o Whisper sempre processa 30 segundos.**

Numa aula gravada, numa apresentação de slides ou numa gravação de tela, boa parte do tempo é silêncio.
Pular janelas sem voz corta as passagens pelo modelo quase na proporção.

**A ironia é que a captura ao vivo já faz isso** — `temSinal()`, que olha blocos de um segundo. Falta
levar para o caminho de arquivo, e vale melhorar o critério enquanto isso: o SalaVox usa limiar
**relativo ao próprio canal**, `max(0,006, percentil99,9 × 0,06)`, contando quadros de 20 ms e exigindo
dez deles. Limiar fixo erra nos dois sentidos — grava baixa demais some, gravação alta demais deixa
passar ruído.

Uma armadilha que eles pagaram para aprender: o limiar era 12% e um teste passou raspando, porque o
trecho baixo do arquivo tinha exatamente 18 dB a menos que o alto. Baixaram para 6%. *Verificação que
passa por um fio é aviso, não aprovação.*

**Ganho estimado: proporcional ao silêncio** — 2× num vídeo com metade de silêncio, mais em aula com
pausas. **Esforço:** baixo-médio.

---

### 4. Dizer o tamanho do modelo, e considerar o processador como padrão

Hoje a lista diz "Modelo base — rápido" e "small — preciso", sem tamanho. E o código tenta a placa de
vídeo primeiro, que baixa o **codificador sem compressão**. Os números que o SalaVox conferiu arquivo
por arquivo nos repositórios:

| modelo | processador (q8) | placa de vídeo (fp32 + q4) |
|---|---|---|
| base | **77 MB** | 206 MB |
| small | **249 MB** | 586 MB |

O caminho padrão do `small` baixa **586 MB sem avisar**. Para uma ferramenta gratuita que a pessoa
experimenta uma vez, isso é o abandono mais provável do funil inteiro.

Duas mudanças independentes:

- **Mostrar o tamanho na própria opção**, e mudar o número quando a escolha de motor mudar.
- **Considerar o processador como padrão**, com a placa virando uma caixa a marcar. Além de baixar 2,4×
  menos, há relato da própria biblioteca de que em Whisper o WASM costuma terminar **antes** da WebGPU.
  Isso eu não medi e não deduzo — mas com o item 2 no lugar, o processador fica ainda mais competitivo.

**Esforço:** baixo. **Ganho:** o maior de todos em termos de gente que consegue usar a ferramenta.

---

### 5. `navigator.storage.persist()` — uma linha

Sem isso, o navegador trata o modelo baixado como cache descartável e o apaga quando o disco aperta. A
próxima vez baixa tudo de novo. Uma linha, dentro de `try`, e o pedido pode ser negado sem piorar nada.

```js
try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); }
catch (e) {}
```

---

### 6. Contar em qual motor rodou e quão rápido — **ganho direto zero, e ainda assim vale**

Hoje, quem está lento não sabe se é a máquina, o modelo ou a escolha. A diferença entre placa e
processador é de 5× a 20×, e o aviso de queda é discreto.

Mostrar, junto do resultado: em qual motor, em quantas linhas, e quantas vezes o tempo real. Abaixo de
1×, dizer o que fazer. Isso é o que impede otimizar no escuro — **e é o único jeito de saber se os itens
2 e 4 funcionaram na máquina de quem usa.** Deveria vir antes deles, não depois.

Detalhe que o SalaVox descobriu doendo: citar as linhas no texto é o que denuncia quando a hospedagem
para de mandar os cabeçalhos. Sem isso, uma configuração perdida ficaria invisível e voltaria como "está
lento".

---

### 7. Menos saltos na varredura — **o único item que é só nosso**

Este o SalaVox não tem, porque ele não extrai frames.

Hoje a varredura é uniforme: 700 saltos de passo fixo, 55 segundos numa hora de vídeo. Mas num vídeo de
slides existem talvez vinte trocas de tela — **a varredura gasta 680 saltos confirmando que nada mudou.**

Uma passada grossa seguida de bisseção nos intervalos onde a assinatura mudou encontra as mesmas trocas
com muito menos saltos: ~120 sondas grossas mais ~6 por transição real. Com vinte transições, algo como
240 saltos em vez de 700.

**Ganho estimado: 2× a 3× na varredura**, e de brinde a transição passa a ser localizada com precisão
melhor que o passo fixo. **Esforço:** médio, e a verificação precisa ser dura — o teste de cinco cortes
exatos que já existe é exatamente o instrumento certo.

---

## O que não vale fazer

- **Batching de janelas.** Rende só na placa de vídeo, e briga com a peneira de silêncio, que é o que
  impede o modelo de inventar texto sobre nada. Só faria sentido depois de compactar a fala.
- **Compactar a fala** (costurar os trechos removendo os vãos). É o maior ganho possível — 2× a 3× — e é
  também o mais perigoso: os instantes voltam na linha do tempo compactada e precisam ser remapeados
  para a real. Errar esse mapa desloca o pareamento imagem-fala do PDF inteiro, que é o produto. O
  SalaVox fez, com seis sabotagens em cima do remapeamento. Para o ClipContext eu deixaria por último.
- **Quantizar o codificador para fp16.** Há relato de perda de precisão do codificador Whisper em fp16
  no WebGPU. Pode acelerar e piorar o texto de um jeito difícil de notar — o pior tipo de piora.
- **Transcrever um canal só na captura ao vivo.** Daria até 2×, e destruiria exatamente o que o recurso
  vende: as fontes já chegam separadas. Fica registrado para não ser redescoberto como boa ideia.
- **Otimizar a assinatura ou a captura de frame.** Medido: 8% do custo da varredura. Não há o que ganhar.
- **`condition_on_previous_text`.** Melhora a coerência entre janelas e amplifica laço de alucinação.
  Desligado de propósito.

---

## Um defeito conhecido que nenhum item acima resolve

As janelas de 30 s são cortadas **sem sobreposição**, então uma palavra que cai na emenda pode ser
partida. Consertar custa velocidade — sobreposição é trabalho repetido. A troca está feita a favor da
velocidade, e sem que ninguém tenha decidido, que é o pior jeito de fazer uma troca.

---

---

## 13/08/2026 — os sete, feitos

Todos entraram. O que dá para afirmar com medição, e o que fica como estimativa:

**Item 7, varredura — medido aqui, e é o maior ganho concreto.** Num vídeo de 6 minutos com seis telas:
**136 saltos contra 701** do passo fixo, **5,2× menos**, e a varredura caiu para 3,4 s. De brinde, a
precisão melhorou: as seis transições foram localizadas em 00:00, 01:00, 02:00, 03:00, 04:00 e 05:00 —
o segundo exato, e não o múltiplo do passo. O vídeo de cinco cortes exatos continua devolvendo
00:00 · 00:12 · 00:24 · 00:36 · 00:48, e o cancelamento continua aproveitando o que já foi extraído.

**Item 1, degrau embaixo do 4 bits — o defeito confirmado, e fechado.** Há agora dois pontos de queda,
porque o arquivo de 4 bits pode falhar em dois lugares diferentes: ao montar o pipeline e na primeira
inferência. Os dois têm teste com o erro real do ONNX, e nos dois a transcrição sai assim mesmo, no
processador. Quando a queda acontece durante a transcrição, a caixa da placa é desmarcada — não faz
sentido tentar de novo na mesma sessão.

**Item 3, peneira de silêncio — medido.** Num áudio de 90 s com fala só nos dez primeiros, duas das três
janelas são puladas, e a tela diz quantas. O limiar é relativo ao próprio áudio
(`max(0,006, percentil99,9 × 0,06)`), contando quadros de 20 ms.

**Item 2, linhas do WASM — o risco foi testado e não se confirmou.** Com os três cabeçalhos no
`vercel.json`, a página fica isolada, `SharedArrayBuffer` existe, e script de outra origem *sem* CORP
continua carregando. Sem os cabeçalhos, volta a uma linha e nada quebra. **O ganho de tempo real não foi
medido**: esta máquina tem dois núcleos, e `min(4, 2−1)` dá 1 — a única configuração onde a mudança não
faz efeito nenhum. O número que vale medir é o «× o tempo real» na máquina de quem usa.

**Itens 4, 5 e 6 — feitos.** O tamanho aparece na tela e muda quando a placa é marcada (77 / 206 MB no
rápido, 249 / 586 no preciso); o processador virou o padrão e a placa é uma caixa a marcar;
`storage.persist()` está dentro de `buildPipe`; e o resultado agora conta motor, linhas e quantas vezes
o tempo real, com aviso quando fica abaixo de 1×.

Uma decisão de projeto que vale registrar: **as linhas são citadas no texto de propósito.** Se a
hospedagem parar de mandar os cabeçalhos, o número cai para 1 sem nenhum erro na tela — e sem essa
frase, a configuração perdida ficaria invisível e voltaria como "está lento".

O que continua na fila, e por quê: **compactar a fala** (o maior ganho possível, e o mais perigoso, por
causa do remapeamento de instantes) e **sobreposição nas emendas de 30 s** (custa velocidade, e a troca
atual está feita a favor da velocidade sem ninguém ter decidido).

---

## 15/08/2026 — por que o modelo não montava numa máquina com tudo verde

Um relatório de diagnóstico real, de uma máquina Windows com Chrome 151, mostrava **tudo
funcionando**: WebGPU disponível, `crossOriginIsolated=true`, biblioteca carregada, `config.json`
do modelo em HTTP 200, os 78,6 MB do peso baixando em GET puro, e os três endereços de wasm
respondendo 206. E os três degraus de montagem falhando com a mesma linha:

```
Can't create a session. ERROR_CODE: 1, ERROR_MESSAGE: qdq_actions.cc:137
TransposeDQWeightsForMatMulNBits Missing required scale:
model.decoder.embed_tokens.weight_merged_0_scale
```

Duas pistas dizem onde o defeito está, e nenhuma delas é a rede:

**`qdq_actions.cc` é otimizador de grafo**, não leitor de arquivo. O erro acontece *depois* de ler
o modelo, quando o runtime reescreve o grafo. Não é download corrompido nem 404.

**O degrau `fp32` falhou com um erro de `MatMulNBits`**, que é uma operação de 4 bits. Um degrau
sem compressão não deveria nem passar perto dessa operação. Quando três configurações diferentes
falham identicamente, o que elas têm em comum não são as configurações — é o runtime.

E o runtime era o problema. O `findWasmBase()` sondava três endereços de `onnxruntime-web` e usava
**o primeiro que respondesse** — que era um build `1.26.0-dev`. Só que cada versão do
`transformers.js` é publicada contra uma versão específica do `onnxruntime-web`, e o pacote já
aponta para ela. Trocar esse endereço por fora é montar um motor com a caixa de câmbio de outro
carro: tudo carrega, nada anda.

### O que mudou

**O endereço de fábrica virou o padrão.** A sondagem continua, mas como plano B — ela existe para o
caso do endereço padrão sair do ar, não para substituí-lo por rotina.

**A fila de degraus ganhou duas saídas novas**, e agora é, no caminho do processador:

1. `q8` com o runtime de fábrica
2. `q8` **sem otimização de grafo** (`graphOptimizationLevel: 'disabled'`) — pula exatamente a
   transformação que quebra, ao custo de alguma velocidade
3. `fp32` com o runtime de fábrica
4. `q8` com o runtime sondado — o comportamento antigo, agora por último
5. **resgate pela placa de vídeo**, se a máquina tiver WebGPU e a pessoa não a tiver marcado: o
   caminho da placa não passa pelo otimizador do wasm. Custa 206 MB em vez de 77, e é por isso que
   ele é o último degrau e não o primeiro — só entra quando a alternativa é ficar sem transcrição

Cada degrau ainda repete com uma linha só antes de desistir, pelo motivo de sempre (COEP barrando o
Worker do CDN).

**A caixa "usar a placa de vídeo" some onde não há WebGPU.** Ela continua desmarcada por padrão:
encarecer o primeiro download de todo mundo de 77 para 206 MB, para acelerar alguns, seria pagar no
lugar errado.

### Um defeito de CSS achado no caminho

Esconder essa caixa não funcionava. `.hide{display:none}` estava **acima** de
`.chk{display:inline-flex}` na folha, e com a mesma especificidade quem vence é a última — então
`label.chk.hide` continuava visível. `.hide` passou a ser `!important`, que é o que um utilitário
precisa ser. O defeito não dava erro, não aparecia em revisão e só se via na tela.

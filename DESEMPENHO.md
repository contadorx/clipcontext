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

---

## 15/08/2026, segunda rodada — a hipótese do runtime caiu

Publicada a correção acima, o mesmo relatório voltou com **seis** degraus, todos com a mesma
linha — incluindo os três que existiam justamente para escapar dela:

| degrau | resultado |
|---|---|
| `wasm · q8` (runtime de fábrica) | `MatMulNBits Missing required scale` |
| `wasm · q8` com uma linha só | idem |
| `wasm · q8 · sem otimização de grafo` | idem |
| `wasm · fp32` | idem |
| `wasm · q8 · runtime reserva` | idem |
| **`webgpu · fp32`** | idem |

Isso encerra três hipóteses de uma vez. **Não é a versão do runtime**, porque o degrau de fábrica e
o sondado falham igual. **Não é o otimizador de grafo**, porque desligá-lo não muda nada. E **não é
o wasm**, porque a placa de vídeo — que nem passa por esse caminho — falha com a mensagem do wasm.

Quando seis configurações diferentes produzem um erro idêntico, o que elas têm em comum não são as
configurações: são **os bytes que estão sendo abertos**. E há duas explicações para os bytes serem
os mesmos em todos os degraus:

1. o `dtype` não está trocando de arquivo — a biblioteca abre o mesmo decodificador sempre;
2. o arquivo está **guardado no navegador** e nenhum degrau chega a pedir outro.

A segunda tem um agravante que combina com uma queixa antiga desta caixa de entrada — *"mesmo após
baixar, na próxima transcrição ele continua baixando"*. Cache Storage não revalida o que já tem: um
arquivo truncado, ou de uma variante que não abre, fica lá indefinidamente.

Uma pista de laboratório reforça o ponto: `wasm de fábrica: [object Object]`. O `wasmPaths` do
transformers.js 4.x é um **objeto** (um mapa de arquivo → endereço), não uma string. Quer dizer que
a versão anterior, que o substituía por uma string de CDN, estava de fato quebrando a resolução —
só que consertar isso não bastou, porque não era a causa raiz.

### O que esta rodada faz — e por que ela é de instrumentação

Eu vinha respondendo por teoria uma pergunta que o código pode responder por medição: **qual
arquivo cada degrau abre.** O `progress_callback` já recebe o nome de cada arquivo pedido; ele
passou a ser registrado por degrau e impresso.

- **O diagnóstico lista o que está guardado no navegador**, endereço por endereço e com o tamanho.
  Um `decoder_model_merged_q4.onnx` guardado enquanto o degrau diz `fp32` fecha o caso na hora.
- **Cada degrau imprime os arquivos que pediu**, ou `(nenhum — veio tudo do cache)`, que é a
  resposta mais reveladora possível.
- **Dois degraus novos**, os dois atacando a causa que sobrou: um que **apaga o guardado e baixa de
  novo**, e um que troca de **repositório do modelo** (`Xenova/whisper-base` em vez de
  `onnx-community/whisper-base` — exportações antigas, sem `MatMulNBits`).
- **Um botão "apagar o modelo guardado"**, ao lado do diagnóstico, para não depender de limpar
  dados de navegação inteiros.

Os rótulos dos degraus deixaram de ser alinhados por coluna fixa: com nomes mais longos, o
`padEnd(34)` colava "sem otimização" em "falhou" no relatório copiado.

---

## 15/08/2026, terceira rodada — a instrumentação apontou o erro que era meu

A medição encerrou as duas hipóteses da rodada anterior, e de quebra mostrou que **um dos degraus
mentia**.

O que os `arquivos pedidos:` provaram:

- **Não é cache corrompido.** O degrau `cache limpo` apagou tudo, baixou de novo e falhou igual.
- **Não é o `dtype` sendo ignorado.** O degrau `fp32` pediu `encoder_model.onnx` e
  `decoder_model_merged.onnx` — os arquivos sem compressão, exatamente como devia.
- **Não é o repositório.** O degrau `Xenova/whisper-base` baixou os 73 MB do outro repositório e
  falhou com a mesma linha, byte a byte.

Dois repositórios, quatro `dtype`, com e sem otimização de grafo, wasm e WebGPU: **oito degraus,
uma mensagem só.** Um erro idêntico em oito configurações diferentes não descreve oito execuções —
descreve uma. O que executava era sempre o mesmo.

### O degrau "runtime reserva" nunca trocou runtime nenhum

Esse é o erro, e ele é meu. O `onnxruntime-web` **instancia o `.wasm` uma vez por módulo** e guarda
a instância. Depois da primeira sessão, mexer em `wasmPaths` não troca nada — o binário já está na
memória. E `import()` do mesmo endereço devolve o módulo do cache, não um módulo novo.

Ou seja: os oito degraus rodaram no mesmo `onnxruntime`, carregado no degrau 1. A hipótese "versão
do runtime" não foi testada e descartada — ela **nunca chegou a ser testada**. Eu li o degrau 5
falhando e concluí a coisa errada.

### O que muda: trocar de ambiente, não de configuração

A unidade de tentativa deixou de ser a configuração e passou a ser o **ambiente** — a combinação de
biblioteca e runtime. Cada ambiente carrega um **módulo novo**, com um `onnxruntime` novo, através
de um parâmetro diferente na URL do `import()`:

```js
await import(url + '?ws=' + (++contadorModulo));
```

Sem esse parâmetro o navegador devolve o módulo já carregado, e a troca vira teatro.

Os ambientes, em ordem:

| # | biblioteca | runtime |
|---|---|---|
| 1 | `@huggingface/transformers@4.2.0` | o que a biblioteca traz |
| 2 | `@huggingface/transformers@4.2.0` | o sondado no CDN (agora aplicado **antes** da 1ª sessão) |
| 3 | `@huggingface/transformers@3` | o que a biblioteca traz |
| 4 | `@huggingface/transformers` (último) | o que a biblioteca traz |

No ambiente 1 vale a fila inteira de degraus; nos seguintes, só `q8`, `fp32` e o repositório de
reserva — se o ambiente for a causa, o primeiro degrau já resolve, e repetir seis variações em cada
um só gastaria a paciência de quem espera.

E o diagnóstico passou a imprimir **`versões`**, lido de `env.versions`: qual `onnxruntime` cada
módulo carregou. Discutir versão por dedução, que é o que eu vinha fazendo há três rodadas, deixa
de ser necessário.

### A lição de método

As três rodadas anteriores foram hipótese → correção → publicar → falhar. Esta foi medição →
hipótese. A diferença de custo é o tempo do Leandro, e ela deveria ter vindo primeiro: o
`progress_callback` já entregava o nome de cada arquivo desde sempre — eu é que não estava olhando.

---

## 15/08/2026, quarta rodada — montou; e o que custou

A escada de ambientes funcionou: a gravação seguinte transcreveu **11 falas ao vivo, a 1,9× o
tempo real**, no processador com 4 linhas. Depois de quatro rodadas, o modelo abre nessa máquina.

O relatório trouxe junto o preço: **353 MB baixados** antes de uma sessão subir, e um cartão que
parecia travado no fim. Três correções.

### O custo: 353 MB

A fila tentava `fp32` (~200 MB) **antes** das alternativas de 8 bits (~73 MB cada). A ordem passou
a ser por custo de download, e não por elegância:

| ordem | degrau | baixa |
|---|---|---|
| 1 | `q8` | ~73 MB (uma vez) |
| 2 | `q8` sem otimização de grafo | nada — mesmo arquivo |
| 3 | `q8` no repositório de reserva | ~73 MB |
| 4 | `q8` com o cache apagado | ~73 MB |
| 5 | `fp32` | ~200 MB |
| 6 | placa de vídeo | ~206 MB |

E antes de qualquer degrau caro a tela **avisa**: *"as opções leves não subiram, tentando uma que
baixa ~200 MB — é a partir daqui que fica grande"*. Ver a barra reiniciar num número maior sem
explicação é o que faz alguém achar que travou.

### A combinação que funciona fica lembrada

A escada era refeita a cada visita. Agora a combinação vencedora — biblioteca, runtime, arquivo —
fica em `localStorage` e vem na frente de tudo na próxima vez. Se ela deixar de funcionar
(biblioteca atualizada, cache limpo), é esquecida e a escada normal corre em seguida.

É **configuração**, não conteúdo: nomes de versão e de arquivo. Está descrito na política de
privacidade e na página de segurança, ao lado do idioma, e o botão *apagar o modelo guardado*
apaga a anotação junto.

### O cartão que parecia travado

Este é o defeito de verdade, e é de interface. A barra de progresso e a linha *"Baixando o modelo
de voz: 100% — 353 de 353 MB"* pertencem à transcrição ao vivo — que termina junto com a gravação.
Ninguém as limpava. O resultado: uma gravação que **deu certo** terminava com uma barra parada na
tela e o botão *Transcrever* desabilitado (corretamente — não há áudio guardado para transcrever de
novo). Lido de fora, isso é "deu erro e não me deixou abrir o diagnóstico".

Agora o fim da gravação limpa a barra e troca a linha por *"Transcrição feita ao vivo: N trechos. O
texto está aqui embaixo e pode ser corrigido."* — em todas as saídas, inclusive na que não gerou
frame nenhum. O teste de gravação passou a verificar as quatro coisas: barra escondida, nenhuma
linha de download sobrando, diagnóstico clicável, apagar-modelo clicável.

### Um teste que estava errado, e a decisão que ele testava

O caso "modelo indisponível" esperava que a gravação seguisse mesmo assim. O produto faz o
contrário, de propósito: **para antes de pedir a tela** e oferece dois botões — diagnóstico e
"gravar só os frames". Uma reunião não se repete; descobrir no fim que não houve transcrição é o
pior momento possível para descobrir. O teste passou a verificar o comportamento certo.

---

## 15/08/2026, quinta rodada — a resposta: a biblioteca era a 3.x

O diagnóstico fechou a questão em duas linhas:

```
1. combinação lembrada  -> OK  [linhas=4]
   ambiente: @huggingface/transformers@3 · runtime de fábrica
```

Montou de primeira, com **zero download** (tudo do cache), pela combinação guardada. E a combinação
guardada é a **3.x**. A hipótese "versão da biblioteca", que eu tinha dado por descartada na
terceira rodada por causa de um degrau que não trocava nada, era a certa desde o começo — só nunca
tinha sido executada de verdade.

Consequência direta: a **3.x virou a primeira da fila**, para todo mundo. Não faz sentido cada
navegador novo subir a escada inteira — e pagar os 353 MB — para chegar onde já sabemos que dá
certo. A 4.2.0 continua logo atrás, para o dia em que a 3.x sair do ar ou parar de servir.

O cache do navegador guarda a marca do preço dessa descoberta: `decoder_model_merged.onnx` com
**198,9 MB** ao lado dos `_quantized` de 51 MB, e as duas cópias do repositório `Xenova`.

### `versões : ?`

O diagnóstico não achava a versão porque procurava só em `env.versions`. A 3.x expõe
`env.version`, e o onnxruntime guarda a sua em `backends.onnx`. Passou a procurar nos três.

### A repetição do Whisper — o "tempos errados"

A captura da rodada anterior mostrava isto no painel ao vivo:

```
00:15  Microfone: Vamos para a linguagem que está gravando.
00:17  Microfone: Vamos para a linguagem que está gravando.
00:18  Microfone: Vamos para a linguagem que está gravando.
00:19  Microfone: Vamos para a linguagem que está gravando.
```

É artefato conhecido do Whisper: numa janela quase muda, ou quando a frase atravessa o corte de 30
segundos, ele devolve a mesma sentença de novo. Numa evidência de teste isso é pior que não ter
transcrição — são horas de relógio afirmando que a pessoa disse a mesma coisa quatro vezes.

O filtro é conservador de propósito: descarta só quando é o **mesmo canal**, a **mesma frase**
(ignorando pontuação e caixa) e dentro de **30 segundos**. Microfone e computador dizendo a mesma
coisa continuam sendo duas falas — juntá-las apagaria informação. E repetição de verdade dentro de
um mesmo trecho ("não, não é da jade dela, não é da jade dela") vem numa linha só e passa inteira.
Vale para a transcrição ao vivo e para a de arquivo.

### "Sem frames" deixou de ser indistinguível de defeito

Zero frames com a gravação rodando não tinha explicação na tela. Agora tem: a captura só guarda a
tela **quando ela muda**, e uma tela parada — ou uma janela que o navegador entrega como quadro
preto — produz zero legitimamente. A mensagem diz isso e diz o que fazer. Um limite explicado é um
limite; um limite mudo é um defeito.

### Ainda na quinta rodada: a minutagem que não batia

Duas âncoras de tempo diferentes governavam a mesma gravação.

Os **frames** eram carimbados por `liveAgora()` — relógio de parede desde o instante zero da
captura. As **janelas de transcrição** eram carimbadas por `consumidos / 16000` — quantas amostras
de áudio já tinham saído da fila. As duas só coincidem enquanto **nenhuma amostra se perde**, e
perder amostra é o normal: o worklet engasga quando a máquina está dividida entre a captura da tela
e o Whisper rodando a 1,9× o tempo real, e o grafo de áudio começa a acumular num instante que não
é exatamente o zero da gravação.

O erro é cumulativo e silencioso. Nada aparece na tela; o que aparece é um passo às 00:13 pareado
com a fala de outro momento — numa evidência de teste, uma hora de relógio afirmando algo que não
aconteceu ali.

Agora cada bloco de áudio carrega o instante de parede em que foi capturado, e a janela herda o
instante do seu primeiro bloco. **Uma âncora só, a mesma dos frames**, por construção e não por
coincidência. O teste novo (`alinhado.mjs`) grava 12 s, pausa 15 s — a pausa descarta o áudio da
espera de propósito — e grava mais 35 s: a última fala tem que cair perto do fim do relógio, e os
frames têm que mostrar o buraco da pausa. Mostram.

### E o "sem frames" com a tela mudando

Aqui eu não tenho a resposta, e chutar de novo custaria mais uma rodada. O que a gravação passou a
fazer é contar **por que** cada quadro foi recusado — sem imagem do vídeo, falha ao ler a tela,
mudança abaixo do limiar — e imprimir os números junto da mensagem de fim, com a **maior mudança
vista** contra o **limiar em vigor**.

É a diferença entre uma hipótese e um fato. Se a maior mudança for 3% contra um limiar de 8%, o
limiar está alto para aquela tela. Se ela for 40% e mesmo assim ninguém entrou, o defeito é meu e o
relatório diz isso na cara.

---

## 15/08/2026, sexta rodada — o "sem frames", e um erro meu de leitura

O diagnóstico veio limpo: `transformers=3.8.1`, `ort.web=1.22.0-dev`, modelo montado pela
combinação lembrada, **zero download**. O lado do modelo está resolvido.

Mas ele veio sem os números dos frames — e a culpa é minha. Eu pus os contadores na **mensagem de
fim da gravação** e pedi "me manda a linha entre parênteses". A pessoa apertou o botão que se chama
**Diagnóstico**, que é o que qualquer um aperta quando algo dá errado, e mandou aquilo. O
instrumento estava no lugar errado.

Os contadores passaram para o Diagnóstico, e ficam guardados depois que a gravação termina:

```
última gravação de tela:
  frames guardados : 1   de um limite de 60
  duração          : 6.1 s   laço a cada 700 ms
  vídeo            : 320×180
  recusas: sem imagem do vídeo=0  falha ao ler a tela=0  falha ao gravar a imagem=0
           mudança abaixo do limiar=9  limite atingido=0
  mudança: maior vista=0.0   limiar em vigor=5.5   (escala 0–255)
```

(As unidades também estavam erradas na primeira versão: `diff()` devolve média de 0 a 255, e eu
imprimia como porcentagem.)

### Uma causa encontrada de caminho

A assinatura de 32×18 serve ao **detector de mudança**. Ela estava barrando também as capturas
**forçadas** — a de abertura, a de fechamento, o botão "marcar" e a retomada da pausa —, que são
justamente as quatro em que não há nada a detectar porque a decisão de guardar já foi tomada.

Se `signature()` falha nessa máquina (a leitura de pixel pode falhar por mais de um motivo), o
resultado é uma gravação inteira com vídeo o tempo todo e **zero frames**. Agora a falha da
assinatura é contada e a captura forçada passa assim mesmo. O teste novo (`semframes.mjs`) quebra a
leitura de pixel de propósito e exige que a gravação ainda termine com frame.

E o `snap()` — que grava a imagem de verdade — ganhou o mesmo tratamento: se ele estourar dentro do
`setInterval`, derrubaria o laço inteiro em silêncio. Agora é contado, com a mensagem do erro, e o
laço continua.

Não afirmo que era isso na máquina do Leandro. Afirmo que era **um** jeito de acontecer, que agora
não acontece mais, e que se ainda acontecer o relatório dirá qual dos cinco motivos foi.

---

## 15/08/2026, sétima rodada — o botão estava embaixo da dobra

*"Agora o aplicativo não habilitou o diagnóstico."*

O botão nunca esteve desabilitado. Ele estava **inalcançável**, e o motivo é estrutural:

O Diagnóstico morava dentro do cartão 2. O cartão 2 **colapsa** quando não há vídeo no passo 1 —
`.card.fechado .dobra{grid-template-rows:0fr}` com `overflow:hidden` no filho. Tudo que está lá
dentro é recortado a zero de altura. Ou seja: **a ferramenta de quem está com problema desaparecia
exatamente no estado em que há problema.** Na captura que o Leandro mandou, o cartão 2 dizia
"Escolha um vídeo no passo 1 para continuar" — e o botão estava logo abaixo daquela linha, com zero
pixel de altura.

O Diagnóstico e o "apagar o modelo guardado" saíram de dentro da dobra e passaram a viver logo
abaixo do aviso de cartão travado, sempre visíveis. A resposta do "apagar" também mudou de lugar:
ela ia para o `#astatus`, que fica dentro da dobra e sumia junto — agora vai para um `#diagStatus`
ao lado dos botões.

### Como isso passou pelos testes

Esta é a parte que me interessa mais. **Dois testes bateram no defeito e eu silenciei os dois.**

O Playwright recusou `locator('#diag').click()` com *"a `<div>` intercepts pointer events"* — que é
literalmente o relatório do defeito, com o elemento culpado nomeado. Eu troquei por
`.evaluate(el => el.click())`, que dispara o clique por dentro do DOM e ignora se o elemento está
alcançável. O teste voltou a passar. O defeito continuou.

Os dois contornos foram removidos, e existe agora um teste (`tapado.mjs`) que faz a pergunta
diretamente: com o cartão travado, `elementFromPoint` no centro do botão devolve o botão? E o
clique de verdade — sem `force`, sem `evaluate` — funciona? Ele cobre os três estados: cartão
travado, durante a gravação e depois de parar.

A regra que fica: **quando o Playwright diz que um elemento não é clicável, ele não está sendo
chato — ele está sendo o usuário.** Contornar o clique é apagar o relatório.

### E os contadores agora sobrevivem ao F5

O relatório dessa rodada veio com `última gravação de tela: (nenhuma gravação nesta aba ainda)` —
diagnóstico rodado em aba nova. Quem grava, vê que deu errado e recarrega a página perdia
justamente o que veio buscar. Os contadores foram para o `sessionStorage`: morrem com a aba, como
todo o resto, e estão descritos na política.

---

## 15/08/2026, oitava rodada — o detector media a coisa errada

O relatório que faltava, enfim:

```
frames guardados : 5   de um limite de 60
duração          : 18.7 s   laço a cada 700 ms
vídeo            : 1920×794
recusas: ... mudança abaixo do limiar=23
mudança: maior vista=6.6   limiar em vigor=5.5
```

Vinte e oito tentativas, cinco guardadas, vinte e três recusadas por "não mudou o suficiente". E a
**maior** mudança de toda a gravação foi 6,6 numa escala de 0 a 255 — raspando o limiar de 5,5.
Alguém percorrendo telas de verdade numa janela de 1920 px, e o detector enxergando quase nada.

### Por que

O detector reduzia cada quadro a uma assinatura de 32×18 e comparava pela **média** da diferença
absoluta. Média funciona em vídeo, onde a cena inteira troca. Em captura de tela ela falha de um
jeito específico:

Numa janela de 1920×794, navegar de uma transação para outra troca a área de conteúdo e deixa
**intactos** o menu do topo, a barra lateral, o rodapé e o fundo. Uma troca que salta aos olhos
ocupa 3% dos pixels. Espalhada pela média de 576 células, vira 2,7 — abaixo de qualquer limiar
utilizável. Baixar o limiar não resolve: a 1 ou 2, o cursor piscando e o relógio da barra de
tarefas viram "mudança de tela" e o documento enche de quadros iguais.

O erro não era o limiar. Era a **grandeza medida**.

### O que passou a medir

O sinal agora tem duas partes, e vale a maior:

- a **média** de sempre — boa para vídeo, onde a cena inteira muda;
- a **fração de células que mudaram de verdade** (algum canal movendo mais de 24 em 255), trazida
  para a mesma escala de 0 a 255.

Usar o **máximo**, e não a soma, garante que o detector só pode ficar mais sensível: nenhuma
captura que acontecia antes deixa de acontecer.

A escala casa com os limiares que já existiam, por um acaso feliz: 5,5 passa a significar "2,2% das
células mudaram" e 26 passa a significar "10,2%". Uma célula solta — o cursor, o relógio — vale 0,4
e não move ninguém.

O teste (`telalarga.mjs`) reproduz a geometria da máquina real: 1920×794, cromo parado, painel de
3% trocando a cada 3 s. Ele exige as duas coisas ao mesmo tempo — que a **média sozinha fique
abaixo do limiar** (senão o cenário é fácil demais e o teste não prova nada) e que a captura
aconteça assim mesmo:

```
mudança: maior vista=10.2   limiar em vigor=5.5
  das duas partes: média=2.7   área=10.2  (4.0% das células)
```

Sete passos para seis navegações, onde antes seriam zero.

E o diagnóstico passou a imprimir as duas partes separadas. Um número composto sem as parcelas é um
número que não se pode interpretar — foi o que me custou uma rodada nesta mesma investigação.

---

## 15/08/2026, nona rodada — "Página sem resposta" e a barra que faltava

Duas queixas na mesma frase, e a segunda é a que decide se a primeira importa:

> *"Agora ele está travando… e a barra da transcrição está somente no baixando o modelo até 100% e
> não mais aparece a da transcrição com percentual e tempo esperado, essa barra é um calcanhar de
> Aquiles pois é a diferença entre aguardar e fechar a página."*

Ele tem razão nas duas, e a leitura é exata: numa espera cega, **fechar a aba é a decisão
racional** — e fechar a aba perde a gravação inteira, porque não há nada guardado em lugar nenhum.
A barra não é enfeite; é o que compra a paciência que o produto precisa.

### A trava

A inferência rodava no **fio principal**. Cada janela de 20 segundos de áudio custa segundos de
processador (a máquina dele mediu entre 1,9× e 5,7× o tempo real), e enquanto ela corre nada é
pintado e nenhum clique é atendido. Passado o limite do navegador, aparece a caixa oferecendo
"sair da página" — no meio de uma gravação que está dando certo.

A correção é uma linha, e ela já existia no runtime: **`env.wasm.proxy = true`**. Com ela o
onnxruntime cria um worker próprio e o fio principal fica livre.

Não virou padrão cego, virou **degrau**. O worker é criado a partir de um blob e, sob isolamento
entre origens, alguns navegadores barram — então ele é o primeiro ambiente da escada, e o segundo é
exatamente o comportamento de antes: mais desconfortável, mas funcionando. A escada que foi
construída para achar a biblioteca certa serviu, sem mudança, para escolher onde a inferência roda.

Entre uma janela e outra o laço agora **devolve o fio ao navegador** por dois quadros. Não elimina
o bloqueio (uma janela sozinha já pode passar do limite), mas garante que a barra ande *entre* as
janelas em vez de saltar de 0 a 100 no fim.

E como a fila de ambientes ganhou um degrau novo e melhor, quem já tinha combinação guardada
ficaria preso na antiga para sempre. A anotação passou a ter **versão**: subir o número descarta o
que foi guardado e faz a escada correr uma vez mais.

### A barra

A cauda — o trecho depois de apertar Parar, quando falta transcrever o que ficou na fila — era a
**única espera longa do produto sem barra nenhuma**. Dizia "Terminando de transcrever o que
faltou…" e mais nada. Cinco segundos e cinco minutos tinham exatamente a mesma aparência.

Agora ela tem porcentagem, contagem de trechos e previsão. Três decisões:

- **A previsão sai do ritmo medido nesta máquina** (`relogio`), não de uma estimativa fixa: a mesma
  gravação leva 4 s numa máquina e 40 s em outra.
- **A barra mora no cartão 1**, junto do botão Parar que a pessoa acabou de apertar — e não no
  cartão 2, que naquele momento ainda pode estar dobrado. Barra escondida é o mesmo que barra
  nenhuma.
- **A porcentagem também vai para a linha de status da gravação**, que é onde os olhos já estão.

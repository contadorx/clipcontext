# Build 9 — O prazo é a revogação, o alemão sem trema, e um pulo que mentia

**Data:** 24/08/2026
**Fila completa:** `FILA.md`. **Itens:** bloqueio de assento, apelidos de/fr, e o
Build 7 da fila (jurídico).

---

## 1. Bloqueio de assento — o item era menor do que a fila dizia, e o defeito era outro

A fila pedia "bloqueio imediato de assento", com a nota de que torná-lo imediato
custaria a operação offline. Medido, o quadro é diferente:

- A licença é um bloco assinado em Ed25519, **conferido dentro do navegador**.
  Não há servidor de licença no caminho do uso.
- **Os seus Termos prometem isso, nos cinco idiomas**: *"o arquivo único que você
  baixou continua funcionando na sua máquina, **sem consultar servidor nenhum**,
  mesmo que este site desapareça"* (`termos.pt.html:71`).
- **O controle de revogação já existe e já está na tela**: o prazo, de 1 a 90
  dias, no portal do time — e o `timeAviso` explica em cinco idiomas o que cada
  escolha custa.
- E o que a licença destrava dentro da ferramenta é **uma coisa**: a marca do
  cliente no documento. Um membro bloqueado não fica com o produto por 45 dias;
  fica com a marca.

Você escolheu encurtar o padrão. **O prazo do time caiu de 45 para 21 dias.**
Cortar alguém passa a valer em no máximo três semanas, em vez de mês e meio. O
plano individual **continua em 45**: encurtá-lo não revoga nada (é um assento
só, e quem cancela é a Stripe) e cobraria do cliente solo 26 renovações por ano
em vez de 8.

### Por que não 14, que seria mais rápido

Porque **14 é o prazo da degustação** — e aí estava um defeito que ninguém tinha
visto: a ferramenta identifica degustação por **dias restantes**. Com a chave de
time valendo 45 dias, os últimos catorze diziam

> **"Degustação: 14 dias restantes."**

para um cliente **pagante**. Encurtar o prazo faria essa frase valer por uma
fatia maior da vida da chave.

Consertado: **um time nunca é degustação.** É a única distinção que os dados da
chave permitem fazer com segurança — a chave carrega a data de vencimento, não a
de emissão, então não há como saber se catorze dias são o começo de uma
degustação ou o fim de um contrato. Fica escrito o que não foi resolvido: uma
chave **personal** curta continua indistinguível de uma degustação, e resolver
aquilo exige a data de emissão dentro da licença — quer dizer, o emissor, que
não mora neste repositório.

### O terceiro lugar onde o prazo estava escrito

O formulário da conta caía em `?? 90` quando o banco não tinha valor gravado. O
webhook da Stripe grava o que o `lib/stripe.ts` diz. **Salvar sem tocar no campo
trocava um prazo de três semanas por um de três meses** — exatamente o contrário
do que o número serve para fazer. Agora ele lê o `PLANOS`.

E o quarto: as **cinco páginas de segurança** publicavam "cada chave vale 45
dias". Ficariam falsas no instante em que eu mudei o número. Corrigidas, e agora
há uma régua (`promessa.mjs [3b]`) que lê o `lib/stripe.ts` e cobra as cinco
páginas — do mesmo jeito que o mínimo de assentos já era cobrado. Posto de volta
em 45 numa página só, ela reprova.

---

## 2. Apelidos de alemão e francês — e um defeito que não era falta de voz

**Não dá para medir aqui.** O proxy deste ambiente bloqueia `huggingface.co` e
`cdn.jsdelivr.net` (403), então o transcritor do próprio produto não roda. A
lacuna que o Build 7 deixou escrita continua aberta, e continua escrita.

Mas procurando por ela apareceu **um defeito de verdade**, e ele não tinha nada a
ver com escuta:

| falado/escrito | antes | agora |
|---|---|---|
| `dreißig` | 30 ✔ | 30 ✔ |
| `dreissig` | **não virava nada** | 30 ✔ |
| `fuenf` | **não virava nada** | 5 ✔ |
| `zwoelf` | **não virava nada** | 12 ✔ |
| `zweihundertfuenfunddreissig` | **falhava inteiro** | 235 ✔ |

`semAcento` decompõe em NFD e joga fora acento combinante. Isso resolve `ü` → `u`
e **não resolve `ß`**, que não decompõe em nada. E a forma que um alemão escreve
sem a tecla não é `u`, é `ue`. **Quem transcreve alemão sem trema perdia o
recurso inteiro** — e isso é ortografia alemã documentada, do mesmo tipo do hífen
francês que a tabela já tratava.

A troca **não** entrou no `semAcento`: ali ela quebraria o francês (`aiguë`
viraria `aiguee`). Ela gera uma chave a mais, e as duas grafias acham o mesmo
número. Há uma régua que cobra que ela **não vaze** para os outros quatro
idiomas.

> **O comentário do código estava errado, e é isso que apontava para o defeito.**
> Ele dizia que as entradas de `de` e `fr` vinham do "`ß` escrito como `ss`" e das
> compostas francesas com e sem hífen. Nenhuma delas tratava disso. O hífen já
> era resolvido na tabela de números, e o `ß` **não era resolvido em lugar
> nenhum**. A justificativa apontava para um buraco que ninguém tinha aberto.

### As grafias de dicionário, aditivas

Como você escolheu: entraram as grafias que o **Duden** e a **Académie**
registram para o nome de cada letra, sem tirar nada. `de` passou de 6 letras com
apelido para 21; `fr`, de 6 para 14. Está escrito, com o nome certo, que **isto
não é medição** — é o palpite mais defensável que existe sem microfone, porque um
modelo treinado em texto escrito tende a produzir a grafia que o texto usa.

### Seis apelidos que nunca fizeram nada

`pt h:'aga'` é o que `semAcento('agá')` já devolvia. `pt y:'ipsilon'` idem. `pt
e:'e'` idem. `pt w` tinha **`'dabliu'` duas vezes na mesma lista**. `es k:'ka'` e
`es y:'i griega'` são a própria grafia do `LETRAS`. Nenhum acrescentava chave
nenhuma — eles só faziam as listas de `de` e `fr`, que são as curtas de verdade,
**parecerem maiores do que são**. Uma contagem inflada é a forma mais barata de
uma lacuna parecer menor. Saíram, e o `numeros.mjs [7]` passou a reprovar.

### E os dois idiomas não conseguiam nem escolher a língua da fala

O seletor de idioma da transcrição tinha **pt, en, es e automático**. O sintoma
não era a opção ausente: era `$('lang').value = LANG` não achar a opção `de` e
deixar o campo **vazio**, que neste seletor quer dizer auto-detecção. **Alemão e
francês eram os dois únicos idiomas que nunca conseguiam fixar a transcrição** —
os mesmos dois mercados que fazem avaliação de fornecedor — e a tela não mostrava
erro nenhum. O produto simplesmente adivinhava.

---

## 3. O Build 7 da fila — a decisão que você não precisava tomar

A pergunta era publicar prazo de retenção e base legal em `de` e `fr` sem revisão
jurídica. **Ela não existe mais**, e a razão é que o pulo mentia.

O `legal.mjs` pulava dizendo que as tabelas de `de` e `fr` tinham 13 linhas
contra 15 do `pt`, faltando a da **conta paga** e a da **fatura**.

Medido: **as cinco tabelas têm as mesmas sete linhas**, e as duas em questão
estão lá em alemão (*"Inhalt des bezahlten Kontos"*, *"Rechnung"*) e em francês
(*"Contenu du compte payant"*, *"La facture"*). A tradução já tinha sido feita.

O que faltava era a **régua**: as duas expressões regulares só conheciam
português, inglês e espanhol. **Nem se o alemão estivesse perfeito ele passaria.**
O pulo escondia a cobertura de dois idiomas atrás de um motivo que tinha deixado
de existir — e um pulo que sobrevive ao conserto é lixo que esconde o próximo
defeito.

**`legal.mjs` sai dos PULADOS.** São quatro agora, e não cinco.

---

## A esteira, e um vermelho que apareceu no caminho

```
146 ok · 4 PULADO · 0 FALHOU
Pulados: timepag.mjs licenca.mjs liclink.mjs licauto.mjs
```

**Um a mais no verde e um a menos no pulo** — é o `legal.mjs` saindo.

### O `etapas.mjs` ficou vermelho numa das execuções, e não foi por causa desta mudança

Na primeira regressão completa ele reprovou em dois pontos, ambos com a mesma
raiz: a frase da próxima ação dizia *"remover 1 tela repetida"* num bloco que
pergunta outra coisa. Sozinho ele passava. Ele estava verde no Build 7 e no
Build 8, e nada neste build toca extração, assinatura de imagem ou plano de
faxina.

O que eu achei ao abrir: o bloco esperava `waitForTimeout(600)` depois de as
miniaturas aparecerem. **As miniaturas aparecem antes de as assinaturas de
imagem estarem calculadas**, e é delas que sai o "há repetido?". Sob carga a
aposta de 600 ms perde. Trocado por espera de condição — que as quatro
assinaturas existam. É a mesma família do `modelo`, do `rolar` e do `espera2`.

> **E o que eu NÃO consertei, porque seria mentira dizer que consertei.** Medindo
> o estado real, as quatro telas extraídas da amostra saem com a **mesma
> assinatura** (`29,37,75,43,50`). Quais pixels o decodificador entrega em cada
> instante pedido varia com a carga da máquina — e é isso que decide se o
> produto vê um repetido ou nenhum. A espera de condição tira a aposta de
> relógio do caminho; ela **não** garante que a intermitência acabou. O bloco
> `[3]` e o `[3b]` assumem que as quatro telas são distintas, e essa premissa
> não está escrita nem garantida em lugar nenhum — ela depende da amostra.
>
> Tentei estabelecer a premissa fabricando assinaturas distintas, e **isso
> quebrou o teste**: o `[3b]` fabrica o repetido dele copiando `f.sig`, e o
> comparador não é igualdade de texto — é distância entre cinco números. Uma
> assinatura inventada nunca casa, então nem o repetido de propósito era
> detectado. Desfiz. Fica anotado como o próximo passo desse arquivo.

A segunda regressão completa, com a espera de condição no lugar, saiu limpa.

---

## O que fica

- **A escuta de alemão e francês.** Continua sendo a lacuna, e continua escrita
  em três lugares. O que mudou é que agora ela é *só* isso: o defeito
  ortográfico que estava misturado com ela saiu do caminho.
- **A degustação no plano individual**: uma chave personal curta continua
  indistinguível de uma degustação. Exige a data de emissão dentro da licença.
- **`licenca.mjs`, `liclink.mjs` e `licauto.mjs`** continuam pulando: o
  `emitir-licenca.py` guarda as chaves privadas e não viaja no pacote. A promessa
  de bloqueio não tem régua verde de ponta a ponta na esteira, e isso é do
  desenho da entrega, não um esquecimento.
- **A premissa do `etapas.mjs`**: os blocos `[3]` e `[3b]` dependem de a amostra
  render quatro telas distintas, e ela não garante isso. Estabelecer a premissa
  exige fabricar assinaturas no formato real do comparador — cinco números com
  distância entre eles, e não texto.
- Represados por sua instrução: Stripe (DEC-14), Drive (DEC-15), vocabulário de
  cenários (Build 12).

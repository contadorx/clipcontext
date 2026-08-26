# Build 12 — Copy e posicionamento: seis frases que custavam venda ou confiança

**Data:** 24/08/2026
**Fila completa:** `FILA.md`. **Item:** Build 8 da fila.
**Decisões respondidas:** DEC-2 caminho B, DEC-3 nenhum, DEC-10 caminho B.

---

## O levantamento veio antes, e mudou o build

Onze itens na fila. Medidos contra o código, **quatro estavam velhos** — e um
deles estava velho de um jeito que virou outro defeito.

---

## 1. A política dizia que não usa cookie, e usa um — no mesmo documento

Numa lista chamada **"Dados que não coletamos"**:

> `<li>Cookies, de qualquer tipo</li>`

E noventa linhas abaixo, na seção da conta paga:

> *"A sessão da conta usa um **cookie**, e ele é necessário: é o que mantém você
> logado."*

**Nos cinco idiomas.** As duas frases são verdadeiras separadas e mentem juntas —
e quem faz avaliação de fornecedor lê as duas, porque é o mesmo documento e ele
lê inteiro.

A saída **não** foi apagar a segunda: o cookie de sessão existe e tem de estar
declarado. Foi qualificar a primeira, que é onde estava o exagero — *"Cookies de
rastreamento, de publicidade ou de medição — **nenhum**"* —, apontando para a
seção onde o de sessão está descrito.

A régua (`contradicao.mjs [6]`) cobra os três lados: que o cookie de sessão
**continue declarado** (apagar a declaração "resolveria" a contradição do jeito
errado), que a negação absoluta não volte, e que a lista diga **de que tipo** não
há — senão o conserto vira só a remoção de uma frase incômoda.

---

## 2. A ajuda mandava o comprador do Personal para o plano de cima

> *"Numa conta de time dá para subir uma planilha de casos de teste…"*

Mas `podeRoteiro()` (`app/conta/roteiro-acoes.ts:55`) devolve verdadeiro para
**qualquer plano pago**:

```ts
return Boolean(c.plano) && c.motivo !== 'suspensa';
```

Quem ia comprar o Personal lia que precisava do Time. Nos cinco idiomas, agora:
*"Em **qualquer plano pago** — Personal ou Time —"*.

A régua lê a **função**, e não a página: se a porta um dia fechar de verdade para
o Personal, é a função que muda primeiro, e aí a frase é que passa a estar certa.

---

## 3. O "num clique" da tarja escondia uma dependência de CDN

A página vendia: *"cobre todas as ocorrências **num clique**"*.

O produto tem a mensagem `ocrSemCdn`: *"Se a rede da empresa bloqueia CDN
público, este recurso não vai funcionar aqui."*

**E rede corporativa que bloqueia CDN é exatamente o cliente-alvo.** A promessa
passou a dizer do que o clique depende, e que a tarja à mão continua valendo.

---

## 4. "o que a auditoria pede", numa célula verde

`steps.pt.html:40`, na tabela de comparação:

> `<td class="sim">Por passo, com hora de relógio de verdade — o que a auditoria pede</td>`

É afirmação sobre o que auditores **exigem**, sem lastro, apresentada como ✓.
Trocada pelo que é verificável e continua sendo a diferença real contra a coluna
do concorrente: *"— e não só o tempo decorrido"*.

---

## 5. Um título que prometia tempo e entregava recursos

**"Três coisas que economizam a tarde"** em **cinco** páginas de caso × cinco
idiomas. Os corpos listam capacidades: *"Sai em PowerPoint também"*, *"Cada
momento tem um tipo"*, *"Corrigir um nome mal transcrito"*.

Podia-se reescrever 25 corpos para falarem de tempo — seria inventar. Cada página
ganhou o título do que a sua lista realmente traz: *"Três coisas para o relatório
de sessão"*, *"…para manter a instrução em dia"*, *"…antes de mandar para a IA"*,
*"…para a rodada de evidência"*, *"…para a ata da reunião"*.

> A quinta página apareceu no meio: eu tinha contado quatro. O `grep` de
> verificação achou a `casoAta` depois da primeira leva.

---

## 6. DEC-2 caminho B — a calculadora deixa de argumentar contra a compra

A régua de ROI mostrava, na quarta linha da saída:

> **O Personal custa** — R$ 149

ao lado do custo anual calculado. Com números modestos — e o comentário da
própria fila registra o caso — quem digitava "2 minutos por caso" recebia **da
nossa própria régua** a informação de que o Personal não se paga.

A linha saiu; a calculadora ficou. E a legenda passou a dizer por que não há
comparação: *"o que compensa numa equipe de quarenta casos por rodada não é a
mesma conta de quem faz cinco, e essa conta é sua"*. Saiu junto o `data-plano`,
que já era atributo morto e cujo nome sugeria a comparação que acabou de sair.

---

## 7. DEC-10 caminho B — a prova que temos, dita onde se decide

Zero depoimentos, zero logos, zero números de uso no site inteiro. A frase que
substitui existia — na `/seguranca`, que é onde já se está convencido.

Ela foi para o **"Antes de decidir" da página de preços**, e sem rodeio:

> *"Não temos depoimento de cliente para mostrar, e não vamos inventar um: a
> prova que oferecemos é melhor de qualquer forma — a verificação de que nada
> sai leva trinta segundos, no navegador que você já tem aberto, e não depende de
> acreditar em nós."*

---

## Quatro itens da fila que estavam velhos

**Firefox e Safari gravando sem áudio do sistema** — a fila dizia que era *"a
única limitação que produz artefato silenciosamente errado"*. **Não é
silenciosa.** O produto mede `telaStream.getAudioTracks().length` e tem três
mensagens distintas: `recJanela` (janela compartilhada — e essa é repetida no
fim, *"porque quem só lê a transcrição depois não tem como saber que faltou"*),
`recAudioNo` e `recSysNo`. A ajuda também está certa. E a home, que a fila
acusava de "dar a razão errada", **não menciona** Firefox nem Safari.

**"Sem ISO 27001 e sem SOC 2: dito de forma impecável, e no lugar errado"** — a
`/seguranca` já tem `<h2>O que nós não temos</h2>` com a declaração forte e uma
tabela de seis normas explicando cada uma. O item estava velho. **Mas ele revelou
outro:** só em português sobrava um parágrafo em letra miúda, noutra seção,
repetindo pior o que a seção dedicada já dizia — e os outros quatro idiomas não
tinham. Listas paralelas. O parágrafo saiu.

**"Offline sem transcrição"** — a `/seguranca` já diz: *"Na versão offline você
perde a transcrição automática (o modelo de voz é baixado sob demanda)"*. E o
`build.py` tem o teto de CDN que impede a frase de ficar falsa.

**"Teto de 300 quadros"** — não existe teto de 300. É o **padrão** do campo
`#maxf`, que a pessoa muda, e o produto avisa a 85% e no limite. Documentar um
"teto de 300" seria criar uma limitação que não existe.

---

## O que fica

- **DEC-3, o título da home** — você preferiu não mexer agora. O subtítulo e o h1
  continuam como estão.
- **DEC-10 caminho A**, depoimentos de verdade, quando houver cliente que
  autorize o nome. Não é trabalho que eu consiga fazer sozinho.
- **DEC-2 caminho A** — trocar a pergunta da calculadora de "minutos por caso"
  para "quanto custa uma evidência recusada" continua sendo, na minha leitura, o
  que resolve o posicionamento. O B que você escolheu impede o pior caso e é
  reversível; o A muda o que o instrumento mede.
- Represados por sua instrução: Stripe (DEC-14), Drive (DEC-15), vocabulário de
  cenários (Build 12 da fila).

# Build 3 — A esteira honesta

**Data:** 23/08/2026
**Fila completa:** `FILA.md`. **Catálogo dos itens:** `ALTERACOES.md`, bloco D.

Feito o Build 1, a esteira sai vermelha quando é para sair. Este build faz o
vermelho ser **verdadeiro** — e o verde também.

Entram junto as **três decisões que você respondeu**: a captura sai, os 14 dias
são anunciados, a Stripe fica para o fim.

---

## As três decisões

### A captura da lista de aviso saiu (DEC-16, caminho B)

O formulário já não existia em corpo de página nenhum desde a rodada de preços.
O que sobrava eram **76 linhas de JavaScript morto** servidas em toda página do
site, armadas para o dia em que alguém recolocasse o formulário.

> **Correção do número que eu te dei.** Falei em 25 KB e você repetiu; o número
> estava errado, e o erro era meu. **25,1 KB era o tamanho total** do
> `support.js` depois que o bloco de doação saiu, não a economia. O ganho real
> é de **2,6 KB**: o arquivo foi de 25,1 KB para **22,5 KB**, em toda página do
> site. Não muda a decisão — muda o que ela vale, e você merecia o número certo.

**O painel continua de pé.** Tirar a captura não é apagar quem já se cadastrou:
a aba `interesse` e as três linhas na tabela ficam, como arquivo. Se você quiser
o painel fora também, é uma linha — mas eu não faria isso sem você pedir.

E a régua virou do avesso. `medicao.mjs [M4]` cobrava que o formulário
existisse; agora cobra que ele **não volte**, do mesmo jeito que `paginas.mjs`
já faz com o bloco de apoio. Apagar a régua junto com o recurso deixaria o
caminho livre para ele voltar por descuido, e aí a página de preços teria de
novo duas portas competindo pela mesma pessoa.

### Os 14 dias são anunciados (DEC-4, caminho A)

A degustação existe no banco desde sempre — `plano_de`, migração
`20260815142538:68`: quem entra na conta pela primeira vez ganha **14 dias com
tudo do Team, sem cartão e sem checkout**. E "14 dias" tinha **zero
ocorrências** em `/`, `/precos`, `/evidencia-de-teste`, `/seguranca` e
`/comparativo`: a melhor oferta do produto só aparecia depois do login, quer
dizer, para quem já tinha decidido.

Ela entra em dois lugares, nos cinco idiomas:

- **No subtítulo dos dois cartões pagos** — "Personal · 14 dias grátis antes,
  sem cartão". Ao lado do preço, porque é ali que a objeção nasce. Numa bala,
  seria a sexta linha de uma lista que ninguém lê inteira.
- **Como primeira pergunta do FAQ de compra** — "Dá para testar antes de
  pagar?". A objeção real não é "quanto custa", é "e se não servir?".

A régua nova tira o número **do banco**, e não de uma constante escrita no
teste: se um dia forem 30 dias, a migração muda e a página tem de mudar junto.

### A Stripe fica para o fim (DEC-14)

Nada deste build a toca. O item represado continua represado, e continua sendo o
que eu antecipararia se você mudasse de ideia: **se o preço do Team estiver em
`tiered` ou `volume`, comprar 12 assentos cobra por 1.**

---

## A esteira

### Três testes de licença pulavam e a esteira contava como verdes

`licenca`, `liclink` e `licauto` saem quando `emitir-licenca.py` não está
presente — e ele **nunca está**, porque guarda as chaves privadas e o
`naovai.txt` o exclui do pacote de propósito. Eles imprimiam `pulado`, saíam 0,
e a esteira registrava **ok**.

Quer dizer: a única régua que prova o destravamento pago de ponta a ponta nunca
rodou onde a esteira roda, e o rodapé dizia "regressão verde".

Agora existe **o terceiro estado**, e é assim que a regressão deste build
terminou — 12 minutos:

```
138 ok · 4 PULADO · 0 FALHOU
Pulados: licenca.mjs liclink.mjs licauto.mjs legal.mjs
  Um teste pulado NÃO é um teste que passou. O motivo de cada um está acima.
Nada vermelho — mas a cobertura é a dos 138, não a dos 142.
```

**Zero vermelhas pela primeira vez.** As duas que estavam abertas desde o
começo — `cenarios` e `timepag` — fecharam aqui. E os quatro pulados agora são
visíveis: três por falta do emissor de chaves, um por tradução jurídica
pendente. Antes, os três primeiros contavam como verdes.

Sair 0 continua certo — uma ausência esperada não é defeito, e uma esteira
vermelha por ela vira uma esteira que se aprende a ignorar. O que não pode é a
ausência se disfarçar de aprovação. A `liberar.sh` conta igual, e diz que um
pulado **não entra na cobertura**.

### `#licTag` morreu no produto e ainda era alvo de quatro testes

`grep licTag public/app.html` dá **zero**. O sucessor, `#licBtn`, também saiu —
o que restou é uma referência guardada por `if (bl)` que nunca é verdadeira.

Onde o estado ativo aparece hoje, sem depender de conta: `#licMsg`, com a frase
`licValida` — *"Licença válida para {cliente} — {n} pessoa(s), até {data}"*. Ela
diz **mais** do que "Plano Time" dizia: para quem, quantos assentos e até quando.

> **O que eu não consegui verificar.** Três desses quatro testes pulam nesta
> máquina, então a troca de seletor está conferida **contra o código**, não
> executada. Na máquina onde o emissor vive, rode os três antes de confiar.

### `compartilhar.mjs` ficava verde com o nome do documento dentro do e-mail

A régua ancorava em `compCorpo') + '\n\n' + url` e **parava ali**. Um
`+ nomeArquivo()` acrescentado depois passava verde — e `nomeArquivo()` carrega
a chave do chamado e o nome do caso de teste, que iriam no assunto de um e-mail.
O `mailto:` é o único caminho de convite do pacote offline: exatamente onde a
promessa de nada sair pesa mais.

Agora ela lê a expressão inteira e cobra as duas metades — o que tem de estar
lá, e o que não pode. **Provado nos dois sentidos:** com `nomeArquivo()`
reintroduzido no artefato, ela reprova dizendo o nome do intruso.

### A intermitente do `marcos.mjs` era defeito do produto

Registrei no Build 1 como flake de medição. Não era.

`emMB` arredonda, e a sobra saía de `emMB(limite - pico)` enquanto o teto e o
pico saíam de `emMB(limite)` e `emMB(pico)`. `round(a) − round(b)` e
`round(a − b)` diferem em 1 sempre que as duas partes fracionárias caem em lados
opostos do meio — e os três números aparecem **juntos na mesma linha**. Um de
cada três olhares via 4085 onde o teto menos o pico dava 4084: a medição
contradizendo a si mesma.

A régua cobrava `sobra === teto − pico`, que é a coisa certa a cobrar. Quem
estava errado era o produto. Três execuções seguidas depois do conserto: verde.

### Duas réguas afirmavam páginas que ninguém mais quer

`cenarios.mjs [7]` e `timepag.mjs [2]` ficaram vermelhas por três rodadas
afirmando o contrato **antigo** da página de preços: que o `h3` de cada cartão
fosse "Free/Personal/Team", que os três preços saíssem lado a lado em real,
dólar e euro, que o cartão Personal tivesse um `mailto:` e que o do Team levasse
para `/time`.

Os quatro viraram falsos **por decisão**, e não por defeito.

Manter duas réguas sobre a mesma página é o defeito que mais custou a este
projeto: a que ninguém lembra de atualizar fica vermelha, e o vermelho vira
paisagem. Então o que era único nelas foi para `precos.mjs [11]`, **corrigido** —
nome do plano, uma moeda por idioma, altura igual, listas curtas e equilibradas
—, mais a negação do `mailto` no `[1]`, porque um `mailto` não é um `a.btn` e
escapava das duas. Nos dois arquivos ficou o ponteiro dizendo para onde foi.

### Testes que cobriam três idiomas num site que fala cinco

`legal.mjs` não olhava para alemão nem para francês — os dois mercados que fazem
avaliação de fornecedor. Agora olha.

---

## O que a régua nova achou, e que era meu erro

**O Build 1 corrigiu "três marcos" na `/seguranca` e não viu a `/privacidade`.**
Mesma frase, outro arquivo — e a política é justamente o documento onde um
número errado sobre medição custa mais. Eram **quinze ocorrências**, nos cinco
idiomas, em até cinco lugares cada.

Corrigido, e com uma régua que tira o número do **`check` da tabela
`walkstamp.evento`** — a fonte de verdade — e o compara com o que a política
escreve por extenso, nos cinco idiomas.

E ela cobrou de novo na hora: meu primeiro `replace` era sensível a maiúsculas e
deixou passar `Três marcos`, `Three usage milestones`, `Tres hitos`,
`Drei Nutzungsmeilensteine` e `Trois jalons`. Cinco a mais, achadas pela régua
que eu tinha acabado de escrever.

---

## Duas coisas que eu mesmo escrevi errado neste build

**A régua nova era intermitente pelo defeito que este build veio consertar.**
`descarte.mjs` esperava `#prevCard` aparecer e mais 500 ms. Sozinha ela passava;
na regressão, com três Chromiums disputando quatro núcleos, a varredura ficou
mais lenta que o meio segundo e o teste leu 1 quadro onde pedira 3 — vermelho
por carga de máquina, e não por defeito. É a família do `rolar`/`espera2`, que
está na lista deste build, escrita por mim no arquivo novo, no mesmo dia.
Corrigido para esperar a **condição**: a lista tem de chegar ao número pedido.

**O `cinco.mjs` reprovou a sétima pergunta do FAQ.** Ele cobrava `=== 6` — a
família do `itens === 6`. A sétima pergunta é a da degustação, que você acabou
de aprovar, e o `6` não tinha nenhum motivo para continuar sendo 6. Virou piso
(`>= 6`, para o FAQ não esvaziar) **mais paridade**: os cinco idiomas têm de ter
o mesmo número de perguntas. A paridade é a afirmação que o `=== 6` dava de
graça e perderia inteira na primeira pergunta legítima — um mercado com uma
pergunta a menos é um mercado sem a resposta que os outros têm.

---

## O que ficou PULADO, dito com todas as letras

As tabelas de prazo de retenção em **alemão e francês** têm 13 linhas; a
portuguesa tem 15. Faltam a da **conta paga** e a da **fatura** — que é a única
que não é apagada em 90 dias, por guarda fiscal. É o item C05.

Traduzir uma linha de tabela é mecânico. O que não é mecânico é publicar prazo
de retenção e base legal em dois mercados de avaliação de fornecedor **sem
revisão jurídica**. Isso é o Build 7, e a decisão é sua.

Enquanto isso, `legal.mjs` **pula com o motivo escrito** — nem vermelho por um
item conhecido, nem verde por uma cobertura que não existe.

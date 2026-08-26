# Build 7 — O vocabulário do domínio, e a dívida do Build 5

**Data:** 24/08/2026
**Fila completa:** `FILA.md`. **Decisão respondida:** DEC-17.

---

## O item não era o que a fila dizia. Era pior, e era o inglês.

A DEC-17 dizia: *"o vocabulário do domínio não fala alemão nem francês"*.

O recurso corrige o código de transação quando a transcrição escreve `ME21N` por
extenso — e é do plano **gratuito por regra**: o que faz a evidência de uma
pessoa ser aceita não se cobra.

Medi o termo `235` falado, em cada idioma, contra o leitor que estava no ar:

| | o que a pessoa fala | o que o produto lia |
|---|---|---|
| **pt** | duzentos e trinta e cinco | `235` ✔ |
| **es** | doscientos treinta y cinco | `235` ✔ |
| **en** | two hundred thirty five | **`2hundred35`** |
| **de** | (a dezena colada) | **não reconhecia nada** |
| **fr** | deux cent trente-cinq | **`2135`** |

**O inglês também não falava** — e ninguém sabia, porque o defeito só aparece a
partir de cem. Um idioma que a página vende.

### Três causas diferentes, e nenhuma delas era "faltou preencher tabela"

**Inglês.** A tabela guardava nove chaves com **espaço dentro** — `'two hundred'`,
`'three hundred'`… — e o texto é quebrado em palavras antes da consulta.
**Nenhuma das nove podia casar, nunca.** E `hundred` sozinho não estava no mapa.

**Alemão.** A dezena composta é **uma palavra só**, com a unidade na frente. O
mapa tinha as partes separadas; o token inteiro não existia.

**Francês.** `soixante-dix` é 60+10 e `quatre-vingt-onze` é 4×20+11. A soma
improvisada só sabia somar quando a dezena era redonda.

### A saída não foi remendar os três

Cada língua ganhou **como ela DIZ um número**, e a tabela passou a ser **gerada**
de 0 a 999 a partir disso. O casamento virou busca da maior sequência de
palavras — e não aritmética adivinhada. Alemão colado e francês composto caem no
mesmo mecanismo do português.

E as **letras** também: `LETRAS` e `APELIDOS` falavam três idiomas. Sem elas, o
número resolvido não serve para nada — metade de `ME21N` continuaria por extenso.

**Um conserto que veio de graça:** a versão anterior pulava toda palavra igual ao
conector, para engolir o "e" de "vinte e um". Em português isso apagava **o E de
`ME21N`**, porque a letra E e o conector são a mesma palavra. Agora o conector
está dentro da chave (`"vinte e um"` é uma chave só) e não há o que pular.

### A prova é exaustiva, e roda o código do produto

`testes/numeros.mjs` recorta `NUMS`, `NUM_FALA`, `tabelaNumeros`, `siglaDaJanela`,
`LETRAS`, `APELIDOS` e `NOME_LETRA` do `src/template.html` e os **executa**.
Reescrever a lógica no teste provaria que a minha cópia funciona, que é a
pergunta errada.

**8.329 formas** — mil números em cinco idiomas, com as variantes que cada língua
aceita — escritas por extenso e lidas de volta. Mais os casos escritos à mão, que
vieram da língua e não do código: `soixante et onze`, `quatre-vingt-onze`,
`einundzwanzig`, `two hundred and thirty five`, `veintiuno`.

> **O que ela NÃO prova, e está escrito no código e aqui.** Que o reconhecimento
> de fala **escreva assim**. Estas são as grafias corretas. O Whisper escreve do
> jeito dele — foi exatamente isso que derrubou a primeira versão do recurso em
> português, com o `k` dito "cá" que o modelo grafa com C, e que está no
> `APELIDOS` até hoje. Para `de` e `fr` **não houve teste com voz de verdade**;
> os poucos apelidos que entraram vieram da ortografia, não de medição. Quando
> alguém falar num microfone nesses idiomas, a lista cresce. Era esta a lacuna
> que você aceitou deixar escrita, e ela está escrita em três lugares.

---

## A dívida do Build 5, paga

Quando a `/time` foi aposentada, o `timepag.mjs` foi junto — e com ele **seis
afirmações** sobre o caminho de entrada que ficaram sem régua nenhuma. Ficou
escrito, alto, em vez de apagado.

`testes/entrada2.mjs` devolveu as seis, **contra o servidor de verdade**:

| o que se perdeu | onde está agora |
|---|---|
| e-mail malformado não sai do lugar | `entrada2 [1]` — e são **duas** travas |
| pedir o link | `entrada2 [2]` |
| o limite de envio é dito, e não engolido | `entrada2 [4]` |
| a volta do link mágico | `entrada2 [5]` |
| link do e-mail vencido | `entrada2 [5]` |
| o idioma atravessa | `entrada2 [6]` |

**O que faltava não era mecanismo.** `WALKSTAMP_SUPA_TESTE` já apontava o cliente
de sessão para um endereço local, e o `portal.mjs` já usava isso. Faltava
escrever — a dívida era de trabalho, não de desenho.

De quebra, ela cobra a **intenção de compra atravessando o meio do caminho**: o
`compra.mjs` media as pontas, e agora se sabe que o `?plano=` sai no
`redirect_to` do pedido do link e volta pela rota de confirmação.

E o `[4]` ganhou uma afirmação que não estava na lista: quando o envio é
recusado, a pessoa **não** pode ver "olhe o seu e-mail". Dizer que o link saiu
quando ele não saiu é a pior resposta possível — ela vai esperar um e-mail que
não vem.

---

## Quatro erros meus, e as réguas que os pegaram

**O meu recorte engoliu três blocos do produto.** Ao trocar o gerador de números,
o corte levou junto `semAcento`, `APELIDOS` e `NOME_LETRA`, que estavam no meio.
O `build.py` passou; quem gritou foi a régua nova, na primeira execução.
Recuperados do commit anterior.

**Dois bytes NUL entraram no `src/template.html`.** O caractere que eu digitei
como espaço não era um espaço. O `git` passou a tratar o produto como binário —
e o conserto revelou que o campo onde eles estavam já não era usado por ninguém,
então ele saiu inteiro.

**A régua do Build 4 me cobrou o perdão órfão.** A `tabelas.mjs` tinha `LETRAS`,
`NUMS` e `APELIDOS` numa lista de exceções escritas, com o motivo. Consertadas as
três, ela **reprovou** — porque um perdão que sobrevive ao conserto é lixo que
esconde o próximo defeito. A lista ficou vazia, e o vazio é a notícia.

**Duas afirmações minhas passavam com o defeito instalado.** No `entrada2`, o
recado de erro era cobrado como `txt.length > 40` **na página inteira** — verdade
em qualquer página do site, inclusive numa que não diga nada. E a primeira versão
do bloco `[1]` procurava o recado do servidor num caso em que **o navegador
barra antes** e o servidor nunca é chamado: a trava certa estava funcionando, e a
afirmação é que descrevia a camada errada. Agora ele cobra as duas — o navegador
barrando, e o servidor recusando quando o navegador é contornado.

---

## A esteira

```
145 ok · 5 PULADO · 0 FALHOU
Pulados: timepag.mjs licenca.mjs liclink.mjs licauto.mjs legal.mjs
  Um teste pulado NÃO é um teste que passou. O motivo de cada um está acima.
Nada vermelho — mas a cobertura é a dos 145, não a dos 150.
```

**150 réguas, contra 148 no Build 6** — entraram `numeros.mjs` e `entrada2.mjs`.

O `timepag.mjs` continua pulando porque a **página** não existe, mas o texto dele
mudou: ele agora aponta, item por item, para onde cada uma das seis afirmações
foi parar. Ele some da esteira no dia em que alguém precisar do número.

---

## O que fica

- **Os apelidos de alemão e francês**, quando houver escuta de fala real nesses
  idiomas. É a lacuna que você aceitou deixar escrita.
- **O bloqueio imediato de assento**: hoje vale na próxima emissão, e isso está
  dito na tela. Torná-lo imediato custa a operação offline — decisão sua.
- Represados por sua instrução: Stripe (DEC-14), Drive (DEC-15) e o vocabulário
  de cenários (Build 12).

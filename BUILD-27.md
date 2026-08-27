# Build 27 — A ação primeiro; as decisões depois

**Data:** 27/08/2026
**Relato:** *"gravar a tela e as várias decisões se impõem somente depois… avalie
opções para esse ux pois achei que está ruim."*

---

## O diagnóstico, medido antes de mexer

| | |
|---|---|
| cartão "Comece por aqui" | **821 px** |
| dos quais, a escolha do tamanho da janelinha | **442 px — 54%** |
| botão `Gravar a tela` | **45 px** |
| cartão vizinho ("Usar um arquivo") | ~450 px |

A decisão acessória era **dez vezes** a ação principal, e esticava o cartão para
quase o dobro do vizinho.

**E o erro era de sequência, não de tamanho.** A janelinha de controle não existe
até a pessoa gravar. Escolher o tamanho dela antes é escolher entre duas coisas
que ninguém viu — e a prévia gráfica do Build 26 foi o conserto errado: ela
curava a adivinhação **ocupando o cartão**. Some a adivinhação, fica o volume.

---

## As três mudanças

### 1. O tamanho da janelinha mora dentro da janelinha

Saiu do cartão. A janelinha abre no tamanho lembrado e traz um botão que troca
na hora — **onde o incômodo aparece, e com a coisa real na tela**.

- **Na janela completa** ele sai do fluxo, no canto de cima: uma janela que já
  estava no limite de altura não pode pagar uma linha inteira por um botão de
  tamanho.
- **Na fita** ele fecha a linha, em fluxo. A fita foi de **380 → 415 px** de
  largura: o alemão já usava 375 dos 380, e a fita é **fina, não estreita** —
  largura numa faixa por cima do trabalho custa menos que altura.
- Atalho **`j`**, de janelinha. As outras quatro letras já estavam tomadas pelo
  que fazem.

Foram apagados junto: o `fieldset`, as duas prévias, o CSS delas, a função que
as pintava e **cinco chaves de i18n órfãs** (× 5 idiomas).

### 2. Os ajustes recolheram numa gaveta que diz o que tem dentro

`Parar sozinho`, `Clipe do momento` e a câmera são **ajustes**: quase ninguém
mexe, e já vêm no valor que serve. Agora ficam num `details` **fechado**, com o
estado no resumo:

```
Ajustes da gravação                    para sozinho em 45 min
```

**Fechar não pode ser esconder** — e o resumo é composto dos controles de
verdade. Se fosse um texto guardado à parte, diria "45 min" com 90 escrito no
campo, que é pior do que uma gaveta muda.

### 3. A transcrição responde com UMA nota, e não com três

As três notas apareciam ao mesmo tempo: 286 px de explicação para uma pergunta
de uma linha. A nota da opção escolhida é **resposta**; as outras duas são
argumento de venda de um caminho que a pessoa não pegou. **Esconder não é
apagar**: o texto volta no instante em que a escolha muda.

---

## O resultado, medido

```
cartão   821 → 483 px      (e agora ele ACOMPANHA a altura do vizinho, em vez de esticá-la)
transcrição  286 → 186 px
página  2974 → 2535 px
```

---

## A régua achou uma quebra silenciosa minha

Ao remover o bloco da prévia, cortei do comentário dela até `abrirControle` — e
no meio estavam `rotularPipTam` e `trocarTamanhoPip`, escritas minutos antes. **O
build passava**: elas só são chamadas quando a janelinha abre de verdade, e
`node --check` não tem como saber que uma função referenciada não existe.

Quem pegou foi a afirmação nova do `janelinha.mjs` sobre o nome do botão. Sem
ela, o botão teria viajado no zip sem fazer nada.

---

## As réguas

**`previa.mjs` virou `escolhas.mjs`, e mudou de assunto.** Ela cobrava a prévia;
agora cobra o contrário:

| bloco | o que fica provado |
|---|---|
| [1] | o cartão **não pede mais** o tamanho, não tem prévia nenhuma, e **cabe em 620 px** |
| [2] | a gaveta nasce fechada, e o resumo **acompanha os controles** (muda o campo, muda o resumo) |
| [3] | só a nota da opção escolhida aparece — e a de antes **volta** quando a escolha volta |
| [4] | as três opções são exclusivas e nomeadas |
| [5] | "só as telas" não busca o modelo · **+5 ao voltar**, que é o controle |
| [6] | a escolha é lembrada · **+5 com "transcrever" guardado**, que é o controle |

O teto de 620 px no bloco [1] não é estético: sem um número, a próxima decisão
que alguém achar importante volta a crescer ali dentro. Foi assim que 442 px
nasceram ao lado de um botão de 45.

**O botão de trocar o tamanho é medido pelo `janelinha.mjs`**, que é quem monta
aquela janela: visível nos dois modos, em fluxo e **último** na fita, fora do
fluxo e no canto na completa, **sem tapar o relógio**, com alvo de 30×32 px.

E o modelo de medida daquele arquivo foi corrigido: ele somava a altura de
**todos** os filhos visíveis, inclusive os fora de fluxo — dava 447 px de
conteúdo numa janela de 430 com tudo cabendo.

**Provada reprovando:** a gaveta nascendo aberta, as três notas de volta, e o
resumo virando texto fixo.

---

## Regressão

```

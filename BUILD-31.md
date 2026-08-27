# Build 31 — A fita tem a largura do idioma, medida e não tabelada

**Data:** 27/08/2026
**Relato:** *"não dá para a janela ser variável conforme a língua? ela fica muito
grande no português, com um espaço que pode ser aproveitado."*

---

## Dá — e a tentação errada seria uma tabela

Uma largura por idioma escrita à mão é lista paralela: no dia em que um rótulo
mudar, a tabela continua com o número velho e a fita volta a sobrar ou a
espremer. **O número tem que sair do que está desenhado.**

A janela é pedida na largura do idioma mais comprido (480 px, que é o do alemão)
e, com a fita montada **e rotulada**, o conteúdo é medido e ela encolhe:

```
pt   480 → 397     (83 px de economia)
en   480 → 402
es   480 → 427
fr   480 → 440
de   480 → 472
```

A medida acontece no estado `gravando`, e não na abertura: é ali que os botões
recebem os rótulos, e **uma fita de botões vazios cabe em qualquer lugar**. Uma
vez por janela — `resizeTo` a cada segundo seria uma janela piscando por cima do
trabalho da pessoa.

**O contador entra com zero na conta.** Ele é o elástico: existe para ocupar a
sobra, e numa janela medida não sobra nada. E é por isso que ele continua no
desenho: se o navegador recusar o `resizeTo`, a fita fica nos 480 e ele volta a
ocupar a sobra, como antes. Uma peça, dois desfechos, os dois bons.

**Com roteiro não se encolhe:** ali a largura inteira é do passo.

---

## A conta errou duas vezes antes de acertar

E a régua pegou as duas, medindo a janela na largura que a conta mandava:

| tentativa | erro | sintoma |
|---|---|---|
| `b.scrollWidth` | ignora o preenchimento do lado direito | fita 7 px curta |
| caixa do corpo em `max-content` | ainda 4 px curta | o último botão para fora |
| **soma dos filhos** | — | passa |

A terceira não tem truque: preenchimento dos dois lados, largura de cada filho
visível, respiro entre eles.

**O que a régua prova, dito com precisão:** ela refaz a mesma conta e testa o
resultado **como janela** — se nada vaza naquela largura, a conta serve. Que o
produto usa essa conta é afirmado sobre a fonte. O `resizeTo` em si é uma ordem
que só uma janela de picture-in-picture de verdade pode aceitar ou recusar, e
isso não se mede aqui.

---

## Regressão

```
163 ok · 0 PULADO · 0 FALHOU        (163 réguas)
Verde inteiro: as 163 rodaram, e nenhuma foi pulada.
```

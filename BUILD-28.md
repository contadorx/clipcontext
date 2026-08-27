# Build 28 — O modelo espera a pessoa, e o selo passa a ter dono

**Data:** 27/08/2026
**Fila:** os dois itens que sobraram do Build 27.

---

## 1. O adiantamento do modelo deixou de ser um relógio

Ele começava **1200 ms depois de a página montar**, com "transcrever" marcado
por padrão. O produto já tinha três recusas, e todas boas:

| recusa | motivo |
|---|---|
| `saveData` ligado | a pessoa **disse** ao navegador que quer economizar dados |
| rede 2g ou lenta | o download não terminaria a tempo de ajudar |
| conexão medida | dado pago |

As três cuidam de quem **avisou**. Nenhuma cuidava de quem não avisou nada
**porque acabou de chegar** — e essa é a maioria de quem abre uma página pela
primeira vez.

Agora ele espera um **sinal de gente**: `pointerdown`, `keydown`, `wheel` ou
`touchmove`, com `isTrusted`. Quem abriu para ver o que o produto é, e fechou,
**não deve 206 MB a ninguém**; quem vai gravar mexe na página em segundos e ganha
o adiantamento igual — o mesmo 1200 ms, agora atrás do gesto.

> **`scroll` estava na lista e saiu, medido.** Ele é disparado por **mudança de
> layout** também — abrir uma gaveta que encolhe a página gera um scroll que
> ninguém rolou — e o navegador o marca como confiável do mesmo jeito. Um sinal
> que a própria página pode fabricar não é sinal de gente. Quem rola pelo teclado
> já entra pelo `keydown`.

Isto é a **quarta recusa**, na mesma família das outras três. E fecha, pelo lado
certo, o que o Build 26 deixou aberto: quem escolhe *"só as telas"* não paga mais
o download na primeira visita, porque na primeira visita ele **nem começa** antes
de alguém mexer. Não foi preciso cancelar bytes em vôo — foi preciso não
começar a mandá-los.

---

## 2. O selo "recomendado" tem um dono só

Ele estava em **duas das três** opções ao mesmo tempo. Um selo em dois lugares
não recomenda nada: vira enfeite.

Qual das duas é a recomendada **não é gosto** — depende de a pessoa ter, ou não,
um arquivo de transcrição pronto. E a tela sabe disso melhor do que parecia:

```
cenário "ata"          → a recomendação é USAR A TRANSCRIÇÃO PRONTA
qualquer outro cenário → a recomendação é TRANSCREVER AQUI
"só as telas"          → nunca leva selo
```

Quem escolheu `ata` está documentando uma **reunião**, e reunião do Meet, do
Teams ou do Zoom já sai transcrita de lá — de graça, e melhor (com o nome de
quem falou). Nos outros cenários não existe transcrição pronta para trazer.

*"Só as telas"* nunca leva selo: ela é o caminho de quem **não tem fala** para
documentar, e recomendá-la a quem tem seria vender a menos.

**É uma linha para reverter** se você discordar da regra — ela vive num `const
daReuniao` só.

---

## As afirmações, com o controle de cada uma

```
[4] numa evidência, o selo é do "transcrever aqui"      [true,false]
    numa ata de reunião, ele muda de dono               [false,true]
    e em nenhum cenário aparecem dois     evidencia:1 tutorial:1 ata:1 usabilidade:1 ia:1

[8] parada, a página não busca o modelo                 0 pedidos
    e ao primeiro gesto de verdade, desce               +5     ← o controle
```

Um zero sozinho pode ser a régua não estar olhando. O `+5` ao lado é o que o
transforma em afirmação.

E o controle do bloco da memória **ganhou um clique**: sem ele, ele passaria a
medir a trava nova em vez da memória — e passaria pelo motivo errado, que é a
pior forma de passar.

**Provada reprovando:** o selo fixo nos dois (`evidencia:2 … ia:2`), e o
adiantamento voltando a ser relógio (`parada, a página não busca o modelo → 5
pedidos`).

---

## Regressão

```

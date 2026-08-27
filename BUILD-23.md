# Build 23 — As promessas pagas, cobradas no arquivo que o auditor abre

**Data:** 27/08/2026
**Fila:** a sequência até a venda. O Build 22 não existe mais — ver abaixo.

---

## O resumo em três linhas

1. Achei um **defeito de produto**: o campo de **emissor** — bala do cartão
   Team — chegava ao Word, ao PDF, ao PowerPoint, ao Markdown e ao índice do
   zip, e **não chegava ao HTML**.
2. O **aviso de renovação** deixou de ser medido só como condição no código e
   passa a ser **pintado na tela** de verdade, com licença assinada.
3. O item "**ponte da compra**" da fila estava **construído e travado** antes de
   eu escrever linha nenhuma. É o quinto item da fila que morre medido.

---

## O defeito: um cliente de Team exportava HTML sem o que ele paga

Escrevi uma régua que **abre o documento gerado** em vez de ler a fonte. Ela
reprovou na primeira corrida:

```
html: traz o emissor  → não achei "Auditoria Interna S.A."
docx: traz o emissor  ok
pdf : traz o emissor  ok
```

E nada reprovava antes porque as réguas que existiam afirmam sobre o **texto da
fonte**: `matriz.mjs` cobre de *onde* o emissor vem (de `licenca.q`, e não de um
e-mail digitado), `miudos.mjs` cobre a classificação no prompt. Nenhuma das duas
abre o arquivo.

> **A lição, que já custou caro quatro vezes neste projeto:** afirmação sobre o
> texto da fonte prova que alguém *escreveu* a linha. Só abrir o artefato prova
> que ela *roda*. A vez mais cara foi uma régua que aprovou o produto com o
> caminho inteiro desligado por um `if (false)`.

### A causa era o desenho, não o esquecimento

A decisão *"há emissor? então mostre"* estava repetida em **cinco geradores**,
cada um na sua própria língua — um `if` no zip, outro no Markdown, outro no
PowerPoint, outro no Word, outro no PDF. **Cinco cópias de uma decisão é o
desenho que produz o sexto esquecimento.**

O dado passou a ser um só:

```js
const linhaEmissor = (m) => (m && m.emissor) ? [[t('docEmissor'), m.emissor]] : [];
```

O **desenho** continua de cada formato — uma linha de tabela no Word e um item
de lista em itálico no Markdown não são a mesma coisa e não devem fingir que
são. O que era listas paralelas era o *dado*, e é ele que ficou único.

No HTML a linha entrou na **mesma tabela de identificação** das outras, e não
como um parágrafo solto ao lado.

### E a medição me corrigiu de novo

Escrevi a régua supondo que a **classificação** fosse gratuita. Ela é de Team: o
`#clsRow` nasce escondido e só aparece com licença. O motivo está no produto e é
bom — *uma tarja de "Confidencial" que qualquer um escreve não classifica nada*.
A régua foi corrigida para cobrar a ausência do **controle**, e não a do texto.

### Provada reprovando

| defeito instalado | o que a régua disse |
|---|---|
| o HTML esquece o emissor (o defeito real) | `html: traz o emissor → não achei` |
| o emissor vaza para o documento gratuito | `não traz emissor nenhum → o nome do cliente vazou` |
| a classificação some do documento | `traz a classificação → não achei "CONFIDENCIAL"` |

---

## O aviso de renovação: de condição verdadeira a frase que a pessoa lê

O `renovar.mjs` abria com um `BLOCO PULADO` cujo motivo era honesto:

> *pintar o aviso exige uma licença que PASSE, e a chave privada não viaja neste
> pacote de propósito.*

Era verdade — até o Build 21 derrubar essa parede. Agora a régua **gera o
próprio par Ed25519**, assina uma licença que vence em N dias e serve o app com
a pública correspondente. A chave de produção continua fora desta máquina.

E o N sai do **próprio produto**:

```js
const prazo = Number((fonte.match(/const RENOVAR_FALTANDO = (\d+);/) || [])[1]);
```

Se alguém mudar o prazo, quem manda é o produto — e não um `10` escrito no
teste. Era outra lista paralela esperando para nascer.

**A diferença entre as duas medições:** medir a decisão prova que a *condição*
existe. Pintar prova que a pessoa **vê a frase**, com o número de dias dentro e
com o caminho para a conta. *Uma condição certa que escreve num elemento
escondido é um aviso que não avisa.*

Provada reprovando em três defeitos: o aviso que nunca aparece (2 falhas), o que
aparece sempre (`longe do fim, a tela não avisa nada`), e o que avisa sem dizer
onde renovar (2 falhas).

---

## O quinto item da fila que morreu medido

Antes de construir a "ponte da compra" (o que seria o Build 22), fui olhar. Ela
está **construída e travada**:

| elo | onde | quem cobra |
|---|---|---|
| o CTA leva `?plano=` nos cinco idiomas | página de preços | `compra.mjs [1]` |
| a conta lê e valida o valor da URL | `conta/[lang]/page.tsx` | `compra.mjs [2]` |
| a intenção atravessa o link do e-mail | campo escondido no formulário | `entrada2.mjs [2]` |
| o plano escolhido é destacado no painel | `secoes.tsx` | `compra.mjs [3]` |

Cinco itens da fila já se provaram velhos quando medidos. **A fila é intenção; o
código é verdade** — e a distância entre os dois é sempre a favor do código.

---

## Arquivos

| arquivo | o que mudou |
|---|---|
| `src/template.html` | `linhaEmissor` nasce; os cinco geradores passam a usá-la; o **HTML ganha a linha que faltava** |
| `testes/emissor.mjs` | **novo** — abre HTML, DOCX e PDF gerados e cobra emissor e classificação nos dois lados da licença |
| `testes/renovar.mjs` | o `BLOCO PULADO` virou o bloco `[0]`, com o aviso pintado de verdade |
| `testes/rodar.sh`, `liberar.sh`, `LEIA-ME.md` | a régua 160 registrada nos três lugares, e o `inventario.mjs` confere que batem |

---

## Regressão

```
159 ok · 1 PULADO · 0 FALHOU        (160 réguas)
Pulados: timepag.mjs
```

O pulado que sobra é o `timepag.mjs`, que cobra uma página aposentada. É o
mesmo desde o Build 21.

---

## Dois achados de fim de build

**A promessa saiu da lista sem trava.** `AUDITORIA-PENDENTE.md` é gerado, e a
linha *"Classificação e campo de emissor no documento"* dizia **sem teste**.
Agora ela credita `emissor.mjs`, e o teto desceu com ela:

```
antes:  3 promessas sem trava de 20   (teto 3)
agora:  2 promessas sem trava de 20   (teto 2)
```

O `auditoria.mjs` **exige** essa descida — ele reprova um teto folgado com
`o teto acompanhou a melhora (baixe TETO_SEM_TRAVA para 2)`. Um teto que não
desce é um teto que não trava nada.

**E uma quarta lista paralela, dentro do próprio corredor de liberação.** O
rodapé do `liberar.sh` dizia *"rodaram 23 de **161** réguas"* enquanto o
`inventario.mjs` dizia **160**. O `liberar.sh` calcula o próprio total com uma
lista de exclusões escrita à mão — e ela tinha três dos quatro instrumentos: o
`capturar.mjs` faltava.

Ninguém reprovava porque o inventário conferia **disco × rodar.sh × LEIA-ME**, e
a quarta lista não estava na conta. É o defeito que aquele arquivo existe para
impedir, sobrevivendo dentro dele. O bloco `[5]` fecha o buraco, e foi provado
reinstalando o defeito:

```
FALHA  e elas são exatamente os instrumentos deste arquivo
       → fora da conta do rodapé: capturar.mjs
```

---

## O que eu faria a seguir — impedimento primeiro, depois o fácil

1. **A metade que falta da promessa anual.** O cartão diz *"cobrança anual,
   renova sozinha, **cancela na conta**"*. A renovação agora é pintada e
   cobrada; o **cancelamento** não tem régua nenhuma — nenhum teste menciona a
   ação `gerenciar`, que é a que leva ao portal da Stripe. É a última das
   quatro promessas pagas sem prova de ponta a ponta, e é barata: o botão só
   aparece para `conta.assinante`, e o que se cobra é isso mais o destino.
2. **`src/auditoria-solta.md` está velho desde o Build 7** — ele ainda afirma
   que o vocabulário do domínio não fala alemão nem francês, e fala. Uma
   afirmação errada num arquivo de auditoria custa mais que a correção.
3. **O `timepag.mjs`**: aposentar a régua ou aposentar a página. Um pulado
   permanente ensina a ler pulado como verde.

E os seus dois portões continuam onde você os deixou, por sua instrução:
`stripe:conferir` com chave de teste — **antes da primeira venda de verdade**,
porque um preço `tiered` cobraria 1 assento por 12 — e `CONVITE_SAL` na Vercel.
Stripe (DEC-14) e Drive (DEC-15) seguem retidos por você.

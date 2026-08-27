# Build 29 — O botão de ERRO: da hora em que ele aparece até o documento

**Data:** 27/08/2026
**Pedido de campo:** *"uma necessidade de marcar o erro… avalie se é possível já
indicar o erro na tela quando ocorre… acho que não, mas o factível é ter um botão
de ERRO para marcar a tela e depois ela na revisão estar destacada."*

---

## A primeira pergunta, respondida com todas as letras

**Desenhar em cima do sistema testado, na hora, não dá.** Não é falta de
trabalho: uma página web recebe os *pixels* da tela compartilhada e **nunca** o
direito de pintar nela. Enquanto a pessoa está dentro do sistema, a única
superfície nossa na frente dela é a janelinha.

Há um meio-termo — mostrar o quadro recém-capturado na janelinha e deixar
arrastar um retângulo — e ele é pior do que parece: numa janela de 250 px, uma
tela de 1920 entra reduzida quase 8×, e um retângulo arrastado nessa escala erra
uns 15 px reais de cada lado. Serve para *"foi mais ou menos aqui"*, não para
cercar um campo. E cobra atenção no pior momento.

**Você estava certo, e o seu desenho é melhor do que parecia.**

---

## 1. O botão

Na **página** e na **janelinha**, com atalho **`e`**. Vermelho e cheio nos dois:
entre botões cinzentos, o que se aperta com pressa tem que ser achado sem
procurar — e este é o único da janelinha que se aperta **olhando para outra
tela**.

Ele captura **junto** do passo em curso, como o *"mais uma tela"*, e não abrindo
passo novo: o erro é observado **na tela** de um passo que já está acontecendo, e
abrir passo deslocaria a contagem do roteiro — e quem confere evidência confere
pelo número.

## 2. Ele não é um campo novo

Carimba `tipo: 'defeito'`, que **já existia** no produto — nasceu na pesquisa de
usabilidade, com etiqueta na grade, campo no JSON e palavra nos cinco idiomas. Um
campo novo seria uma segunda verdade sobre a mesma coisa, e este projeto já pagou
por isso mais vezes do que gostaria de contar.

## 3. O selo chega aos documentos que o auditor abre

Antes o tipo saía em **HTML, Markdown e CSV**. Não saía no **PDF**, no **Word**
nem no **PowerPoint** — a mesma família do defeito do emissor. Agora sai nos
seis, pela mesma receita: **a decisão em um lugar** (`seloDoTipo`), o desenho de
cada formato.

E o mapa `friccao/desistiu/elogiou/defeito → palavra`, que estava escrito em
**dois** lugares e ia para um terceiro, virou `nomeDoTipo`.

## 4. Na revisão ela chega destacada

- etiqueta na miniatura (já existia);
- **contador vermelho no placar**, que só aparece quando há erro;
- e o **resultado do documento passa a sugerir "Falhou"**. Um documento com três
  telas marcadas como defeito e *"— não informado"* no resultado é a ferramenta
  se contradizendo na primeira página. **Sugere, não decide:** quem assina uma
  evidência responde por ela, inclusive para dizer que o caso passou apesar do
  erro.

## 5. Grátis e pago

| | |
|---|---|
| **grátis** | marcar o erro, e o selo saindo em todos os formatos |
| **pago** | a **conta**: *"Telas com erro: 3 de 12"* na identificação |

Marcar é o coração de uma evidência de teste e é o que faz a ferramenta valer no
primeiro uso. A conta **não acrescenta prova** — a prova são as telas —, ela
poupa quem lê de contar. Isso é acabamento, e acabamento mora em recurso pago:
o mesmo princípio da tarja de classificação e do campo de emissor.

---

## A régua achou dois buracos de desenho meus, no mesmo lugar

O seletor de tipo da lente **só existia na usabilidade**. Sem ele:

1. o carimbo do botão entrava e **não saía** — carimbo sem borracha ninguém usa;
2. quem revisa no fim do dia — que é **quando se acha o erro que passou batido ao
   vivo** — não tinha como marcar nada.

Agora o controle aparece em todo cenário, e o que muda é a **lista**: na
usabilidade as quatro palavras da pesquisa; nos outros, *"sem tipo"* e
*"defeito"*. Uma pergunta com opções que não servem ao caso é pior que pergunta
nenhuma.

**E o portão do resumo estava errado:** eu usei `temCliente`, que quer dizer *"a
pessoa configurou o nome do cliente"* — e assinar não obriga ninguém a preencher
marca nenhuma. O resumo não saía nem com licença. O portão é o **plano**.

---

## A janelinha cresceu, e o número saiu da régua

Com o botão novo, a fita pediu **421 px** de largura (o alemão manda: *"Fehler"*
ao lado de *"Markieren + Bildschirm Stopp"*) e a janela completa **443 px** de
altura.

```
fita     415 → 450 de largura
completa 430 → 450 de altura      (com roteiro: 560 → 580)
```

O motivo entrou escrito ao lado dos outros cinco degraus daquele arquivo. Cada
pixel dali é um pixel a menos do trabalho que a pessoa está documentando — e
este não é respiro, é um controle que não existia.

---

## Provada reprovando

| defeito instalado | o que a régua disse |
|---|---|
| o selo não chegando ao PDF e ao Word | `docx: traz a marca do erro → não achei "defeito"` |
| o resumo vazando para o gratuito | `a CONTA não sai → o resumo vazou para o documento gratuito` |

E uma régua velha reprovou por guardar o desenho antigo: `miudos.mjs` afirmava
*"o tipo do momento **só** na sessão de pesquisa"*. Ela passou a cobrar a
**lista** de cada cenário, nos dois lados.

---

## Regressão

```
163 ok · 0 PULADO · 0 FALHOU        (163 réguas)
Verde inteiro: as 163 rodaram, e nenhuma foi pulada.
```

---

## O que vem depois

1. **A devolução na planilha do roteiro.** Com um caso marcado como erro, a
   situação que volta para a planilha deveria sair como *Falhou* — hoje a
   sugestão para no documento. É a promessa *"devolva situação, data e executor
   na mesma planilha"*, e é o elo que falta entre a marca e o processo de quem
   compra.
2. **Pular para o próximo erro na revisão.** O contador diz que há três; achar as
   três ainda é rolar a grade. Um botão ao lado do contador resolve.
3. **A nota fiscal e o ajuste de assentos**, atrás da DEC-14.

E os seus dois portões continuam onde estavam: `npm run stripe:conferir` com
chave de teste, antes da primeira venda, e `CONVITE_SAL` na Vercel.

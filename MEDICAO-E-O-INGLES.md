# "Inglês abre 48 vezes e converte zero"

A pergunta estava no plano, na build 5, ao lado da instrumentação — e é o
exemplo mais claro de por que *medir antes de otimizar* vem primeiro. A resposta
não é sobre o inglês.

## Os números, em 22/08/2026

| idioma | abriu | carregou vídeo | baixou saída | primeiro | último |
|---|---|---|---|---|---|
| pt | 447 | 191 | 107 | 01/08 | 22/08 |
| en | 51 | 3 | 0 | 14/08 | 22/08 |
| es | 7 | 0 | 0 | 14/08 | 20/08 |
| de | — | — | — | nenhum evento | |
| fr | — | — | — | nenhum evento | |

O inglês por dia: `8, 8, 6, 9, 13, 3, 1, 1, 2` — um pico entre 14 e 18 de
agosto e um desabamento para ~1 por dia. As três aberturas de vídeo em inglês
são uma de cada origem (arquivo, gravação, exemplo), em 15 e 16 de agosto:
compatível com **uma pessoa** experimentando os três caminhos.

## O que os eventos não podem responder

Os marcos não carregam IP, navegador, nem identificador de sessão. É uma decisão
de projeto, está escrita na política de privacidade e não vai mudar. Mas ela tem
uma consequência que ninguém tinha escrito: **"são robôs ou é funil quebrado?"
não é respondível com estes eventos.** `abriu_ferramenta` dispara em toda carga
de página que execute JavaScript — inclusive a de um rastreador.

Isso já é um achado: a pergunta do plano não tem resposta com o instrumento
atual, e insistir nela produziria uma história plausível em vez de um número.

## E o instrumento estava sujo

Medindo para responder, apareceu o que interessa de verdade.

Entre **23h09 e 01h52** de uma noite em que ninguém abriu o produto, **43 marcos
entraram na base de produção**: aberturas, `carregou_video` com origem
`gravacao` e `exemplo`, e `baixou_saida` nos formatos `pdf`, `docx` e `json`.
Dois deles em **inglês**.

Era a esteira de testes.

O endereço da medição é assado dentro do `app.html`, e o `app.html` é o mesmo
arquivo que a regressão abre em `localhost` dezenas de vezes por dia. Não havia
guarda nenhuma: cada abertura de teste contava como uma pessoa, cada download de
teste contava como conversão. E como os marcos não têm identificador — de
propósito —, **não dá para separar depois**.

Ou seja: o funil que a gente lia não é o funil do público. É o público somado à
régua, em proporção desconhecida.

## O que mudou

`medir()` passou a calar quando a página vem de uma origem de desenvolvimento —
`localhost`, `127.*`, `::1`, `.local`, faixas de rede privada, `file:`. A regra é
por **origem**, e não por lista de domínios permitidos: uma lista faria um
domínio novo nascer mudo sem ninguém perceber, enquanto `localhost` e rede local
nunca são lugar de gente usando o produto.

Um único arquivo abre a porta de serviço (`window.__medirDaqui`):
`testes/medicao.mjs`, que precisa ver o envio **acontecer** para poder cobrar o
que ele leva dentro. Ele ganhou um bloco novo — **[M1b] a régua não conta como
gente** — que prova o caso simétrico: sem a porta, de `localhost` não sai nada.
`testes/marcos.mjs` cobra o mesmo pelo outro lado.

## O que fazer com a pergunta original

Não dá para responder com os dados de agosto, e a resposta honesta é essa. O que
dá para fazer é **medir de novo agora que a régua saiu de dentro da medida**: a
partir desta versão publicada, os números são de gente. Uma semana de dados
limpos responde "o inglês converte?" muito melhor do que qualquer releitura dos
447 eventos contaminados.

Duas coisas valem observar enquanto isso:

1. O inglês **desabou** de 13/dia para 1/dia depois de 18/08, e isso é grande
   demais para ser explicado por conversão — parece origem de tráfego, e não
   comportamento de quem chega.
2. `es` teve 7 aberturas e **nenhum** vídeo; `de` e `fr` não têm um único
   evento. Antes de tratar o inglês como problema de produto, vale conferir se
   as cinco línguas estão sendo **encontradas** — o que é pergunta de sitemap e
   de link, não de funil.

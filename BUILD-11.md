# Build 11 — A CSP entra, e a semana de relatórios virou uma régua

**Data:** 24/08/2026
**Fila completa:** `FILA.md`. **Decisão:** DEC-12 caminho A, primeira metade.

---

## O que a DEC-12 pedia, e o que foi entregue

A decisão dizia, com todas as letras:

> **Caminho A — CSP em Report-Only por uma semana, ler os relatórios, então
> travar.** (…) **Contra A:** 2 dias, e uma CSP apertada demais desliga a
> transcrição, que é o produto.
>
> *Minha indicação: B no Build 1, A no Build 9. Nesta ordem, e não em outra.*

O caminho B saiu no Build 1. Este é o A — e **só a primeira metade**, que é o que
a decisão manda: a regra entra **avisando**, não barrando.

**A semana de ler relatórios não aconteceu, e não precisa acontecer.** Ela virou
`testes/csp.mjs`: um navegador de verdade abre as dez páginas, a ferramenta e a
conta com a regra ligada, escuta os eventos de violação e conta. O que uma semana
de produção daria em relatórios esparsos — e só das páginas que alguém visitou —
a régua dá em trinta segundos, em todas, e de forma repetível.

---

## A regra, e o motivo de cada origem

Nenhuma entrou por precaução:

| origem | por quê |
|---|---|
| `cdn.jsdelivr.net` | a biblioteca de transcrição, o runtime WebAssembly e o gerador de PDF — a única dependência de execução buscada de fora |
| `huggingface.co` e o `cdn-lfs` | os pesos do modelo de fala |
| `*.supabase.co` | a conta: sessão, licença, chamado e a medição anônima |
| `accounts/apis/docs.google.com` | o Drive, hoje desligado. **Fora daqui, ligá-lo quebraria em produção com um erro que ninguém liga à CSP** |

Duas escolhas que merecem estar ditas:

**`'wasm-unsafe-eval'` é obrigatório.** A transcrição *é* WebAssembly. Sem ele o
produto não transcreve, e transcrever é o que a pessoa veio fazer.

**`'unsafe-inline'` no estilo, e a razão é contável:** são **385** atributos
`style=` nos corpos do site e **147** na ferramenta. Trocá-los por classe é
trabalho de verdade e não cabe no mesmo build que liga a regra. Fica escrito como
dívida, não como decisão.

**O script NÃO ganhou `'unsafe-inline'`** — é ali que uma CSP separa "documento
de conformidade" de "regra que impede alguma coisa". E é exatamente essa linha
que produziu o resultado abaixo.

---

## O que a medição respondeu — e é a resposta que a semana ia dar

Trinta e duas violações nas dez páginas, duas na ferramenta, duas na conta.
**Todas da mesma natureza:** `script-src-elem ← inline`. Nenhuma de rede, nenhuma
de imagem, nenhuma de estilo.

Com `'report-sample'` ligado, o navegador diz *qual* trecho. São seis, e a
diferença entre eles é a única coisa que importa:

| trecho | de quem | saída |
|---|---|---|
| `window.va=window.va\|\|…` | a medição da Vercel | **hash** |
| `/* Os dois comportamentos desta página…` | nosso, na página | **hash** |
| `(function(){ const $ = id => document…` | nosso, na ferramenta | **hash** |
| `/* Só registra a escolha…` | nosso, o idioma lembrado | **hash** |
| `(self.__next_f=…).push([0])` | o arranque do Next | **hash** |
| `self.__next_f.push([1,"1:\"$Sreact…` | **a carga do Next** | **só NONCE** |

**É a última linha que decide tudo.** O conteúdo dela muda a cada página — não há
hash que sirva. Travar a CSP exige **nonce**, e nonce em Next torna a página
dinâmica. Num site quase todo estático isso é um custo de verdade, não um
detalhe.

> **Essa é a resposta que valia a semana.** Não era "quanto a regra aperta" — era
> "o framework consegue conviver com ela sem virar dinâmico?". O próximo build
> começa sabendo, em vez de descobrir no meio.

Um detalhe que economiza trabalho a quem for travar: os `<script
type="application/ld+json">` **não** violam. O navegador não os executa, então a
CSP não os barra.

---

## A régua não fica vermelha pelo que já se sabe

Isso é deliberado. Um teste que reprova por um estado conhecido é um teste que se
aprende a ignorar — e este projeto já pagou por isso. Então `csp.mjs` guarda a
lista dos seis, e reprova quando aparece **coisa nova**: no dia em que alguém
colar um `<script>` solto numa página, ela fica vermelha **antes** de a CSP
travar em produção.

E a lista é cobrada nos dois sentidos. O bloco `[4b]` recusa **perdão órfão**: se
um dos seis deixar de aparecer, ele tem de sair da lista. É a mesma regra que o
`tabelas.mjs` aplica ao catálogo — um perdão que sobrevive ao conserto é lixo que
esconde o próximo defeito.

**A régua achou um que eu não tinha inventariado.** Escrevi a lista com cinco, a
partir do que vi na `/precos`; ela reprovou na home com um sexto — o script que
lembra o idioma escolhido, que só existe lá. Foi ela funcionando na primeira
execução.

E o bloco `[5]` prova que ela sabe reprovar: injeta um `<script>` inline de
propósito e exige que ele seja anunciado — e exige também que ele **ainda rode**,
porque é isso que `Report-Only` quer dizer, e é a garantia de que ligar isto hoje
não quebra nada.

---

## O que fica

- **Travar a CSP**, e o caminho está medido: cinco hashes e uma decisão sobre o
  nonce do Next. A decisão não é técnica — é se vale tornar as páginas dinâmicas.
- **Os 532 atributos `style=`**, que hoje obrigam o `'unsafe-inline'` no estilo.
- **As duas coisas que a régua não alcança**, e é por elas que a regra não trava:
  o caminho da transcrição (a CDN não é alcançável da máquina onde ela roda) e o
  Google Drive, que é recurso desligado. As origens dos dois estão na regra
  porque estão no código, **não porque foram vistas passando**.
- Represados por sua instrução: Stripe (DEC-14), Drive (DEC-15), vocabulário de
  cenários (Build 12).

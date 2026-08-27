# Build 25 — O último pulado morre, e a última promessa sem trava também

**Data:** 27/08/2026
**Fila:** os itens 1 e 2 da sequência que fechou o Build 24.

---

## O que mudou, em uma linha cada

1. O `timepag.mjs` era uma **lápide**. Apagado — e a esteira passa a sair **sem
   nenhum pulado**.
2. O `semrede.mjs` prova *"tudo processado no seu computador"* **na ferramenta**,
   e não na página que a anuncia.
3. Com ele, **as 20 promessas publicadas têm régua**: o `AUDITORIA-PENDENTE.md`
   sai com `0 promessa(s) sem trava de 20`.

---

## 1. Uma lápide não é uma régua

O `timepag.mjs` não testava nada. Ele imprimia `PULADO` e um bilhete dizendo
onde as afirmações da página `/time` tinham ido parar — e esse mesmo bilhete
já está, inteiro, no cabeçalho do `entrada2.mjs`, que herdou seis dos oito
blocos. O sétimo (o `308` do endereço aposentado, nos cinco idiomas) é o
`compra.mjs [6]`, que também o explica no lugar.

Duas cópias do mesmo bilhete, uma delas ocupando uma linha da esteira e
custando um `PULADO` em toda corrida. **Um pulado permanente ensina a ler
pulado como verde** — que é exatamente o defeito que o Build 3 gastou um build
inteiro consertando.

E o rodapé ganhou a frase que faltava. Com pulados ele sempre disse que a
cobertura é menor que o total; **sem pulados ele não dizia nada** — e "nada" no
fim de uma esteira lê-se como *acabou*, não como *as 160 rodaram*:

```
Verde inteiro: as 160 rodaram, e nenhuma foi pulada.
```

---

## 2. "Tudo processado no seu computador", medido na ferramenta

O que existia: `precos.mjs` prova que **a página** de preços não chama a rede, e
`terceiros.mjs` prova que a lista publicada de suboperadores é a verdadeira.
**Nenhum dos dois abre o app.** A promessa mais forte do cartão gratuito — a que
mais dói se falhar — não tinha régua na ferramenta.

### A promessa não é "o app não usa rede"

Usa, e **tem de usar**: o modelo de transcrição desce de um repositório público,
o OCR desce de um CDN, a licença é conferida contra a conta. A promessa é sobre
a **direção** do que atravessa o fio:

| | |
|---|---|
| **desce** | modelo, OCR, biblioteca de PDF, resposta de licença |
| **sobe** | nada que seja vídeo, áudio, quadro ou transcrição |

### O que a régua faz

- **Corta todo pedido** que não seja para esta máquina, e exige que a evidência
  saia **inteira** nos três formatos — com o caso digitado dentro e as três
  imagens dentro de cada arquivo. Se alguma etapa dependesse de um servidor, ela
  morreria aqui.
- **Lê o corpo de cada pedido externo antes de cortar.** Cortar sem ler provaria
  só que a rede foi cortada — e a pergunta não é essa. A pergunta é o que o app
  *tentou* mandar.
- **Imprime os destinos e os corpos**, para quem for auditar **ler** em vez de
  acreditar. Nesta máquina, a corrida inteira sai assim:

  ```
  cdn.jsdelivr.net  10 pedido(s), GET, maior corpo 0 B
  ```

  Dez buscas, nenhuma com corpo. Nada subiu.
- **Confere que havia o que vazar:** três quadros vivos na memória e o vídeo
  carregado com duração. *Uma sessão vazia não prova sigilo nenhum.*
- E cobra a outra promessa do cartão gratuito — **"sem conta para usar"**:
  nenhum cookie foi preciso, nenhuma credencial ficou guardada, e os três
  documentos saíram assim mesmo.

### Provada reprovando

| defeito instalado | o que a régua disse |
|---|---|
| um quadro vazando num `multipart` | `POST coletor-de-quadros.test/up 235992B` — **e imprimiu o WebP dentro do corpo** |
| a geração de HTML passando a depender de um servidor | `o download não veio — alguma etapa depende de um servidor` |
| um portão de sessão instalado no app | `nenhum cookie foi preciso → sessao=abc` |

### E ela achou um buraco nela mesma

Na corrida com o segundo defeito, as afirmações de conteúdo **passaram** — elas
liam `/tmp/sr.html` da corrida **anterior**. Um verde lido de um arquivo velho é
a pior espécie de verde. Os destinos agora morrem antes de cada corrida, e a
mesma corrida com o defeito passou a reprovar em três linhas em vez de uma.

---

## 3. Zero promessas sem trava

O `AUDITORIA-PENDENTE.md` é gerado, e a conta dele desceu em dois builds:

```
Build 22:  3 promessas sem trava de 20   (teto 3)
Build 23:  2                             (teto 2)   ← emissor.mjs
Build 25:  1                             (teto 1)   ← semrede.mjs
Build 25:  0                             (teto 0)   ← semrede.mjs [4]
```

O `auditoria.mjs` **exige** cada descida — ele reprova um teto folgado. Um teto
que não desce não trava nada.

**O que isso significa, dito com cuidado:** cada uma das 20 frases que os
cartões publicam tem hoje um arquivo que reprova se ela parar de ser verdade.
Não significa que o produto não tenha defeito; significa que **nenhuma promessa
de venda está sem cobrança**.

Na metade escrita à mão restam três linhas `sem teste`, e as três são honestas:
*"é um endereço, não uma integração"* (uma negação que se cumpre sozinha), a
**nota fiscal** e o **ajuste de assentos** — as duas últimas dependem da Stripe
de verdade e estão atrás da DEC-14.

---

## Arquivos

| arquivo | o que mudou |
|---|---|
| `testes/semrede.mjs` | **novo** — a régua que corta o mundo e lê o que o app tentou mandar |
| `testes/timepag.mjs` | **apagado** — era uma lápide, e o bilhete dela já vive no `entrada2.mjs` |
| `testes/rodar.sh` | o rodapé aprendeu a dizer o verde inteiro |
| `testes/auditoria.mjs` | teto `2 → 0`, em duas descidas |
| `build.py` | duas promessas creditadas: `Tudo processado no seu computador` e `Sem conta para usar` |
| `src/auditoria-solta.md`, `APLICAR/LEIA-ME.md` | recontados; o LEIA-ME de operação estava em `145 ok · 5 PULADO` de 150 |

**Nada do produto mudou neste build.** O `public/app.html` foi tocado só para
instalar defeitos, e devolvido pelo `git checkout` a cada um.

---

## Regressão

```
161 ok · 0 PULADO · 0 FALHOU        (161 réguas)
Verde inteiro: as 161 rodaram, e nenhuma foi pulada.
```

**Pela primeira vez desde que esta esteira existe, não há nenhum pulado.**

### E a primeira corrida saiu vermelha

`etapas.mjs [5]`: *"o cabeçalho ficou debaixo da barra"*. O produto **não tinha
mudado** — o diff do `public/app.html` entre as duas corridas é o carimbo de
versão e mais nada — e a régua passava isolada.

A causa era a espera dela: aceitava **duas** leituras de `scrollY` iguais a
250 ms de distância. Com três Chromium disputando quatro núcleos, a rolagem
suave para no meio do caminho por mais que isso — as duas leituras dão iguais, o
teste mede a tela **ainda andando** e culpa o produto.

O comentário antigo já previa exatamente esse defeito:

> *um teste que depende de quanto o computador estava ocupado é um teste que
> reprova sozinho de vez em quando*

escrito **em cima da linha que o continha**. Agora são quatro leituras iguais
seguidas, com `polling` menor — o que deixa a espera **mais** exigente sob
carga, e não menos: quanto mais ocupado o computador, mais tempo real cada
leitura representa. E quando a espera estoura, a falha diz isso, em vez de
reportar uma medida de tela em movimento.

Nenhuma outra régua tem o padrão: as demais afirmam sobre limiar de rolagem, e
não esperam ela assentar.

---

## O que vem depois

Com as 20 promessas cobertas e a esteira sem buracos, o que sobra do meu lado é
menor do que o que sobra do seu:

1. **A nota fiscal e o ajuste de assentos** — as duas últimas linhas `sem teste`
   da metade escrita à mão. As duas dependem da Stripe de verdade, e por isso
   estão atrás da **DEC-14**.
2. **O `src/auditoria-solta.md` como um todo.** Dois parágrafos dele estavam
   velhos no Build 24 e um terceiro foi corrigido aqui. Ele envelhece porque é
   escrito à mão, e a esteira só confere a metade **gerada**. Vale uma régua que
   cobre cada afirmação dele contra o que o repositório diz hoje — é o mesmo
   remédio que o `auditoria.mjs` deu para a outra metade.
3. **O tamanho mínimo real da janelinha no Chrome de mesa**, que não dá para
   medir daqui.

E os seus dois portões continuam onde você os deixou, por sua instrução:
`npm run stripe:conferir` com chave de teste — **antes da primeira venda de
verdade**, porque um preço `tiered` cobraria 1 assento por 12 — e `CONVITE_SAL`
na Vercel. Stripe (DEC-14) e Drive (DEC-15) seguem retidos.

# Build 10 — Segurança de servidor: a bomba, o balde de todo mundo e o sal emprestado

**Data:** 24/08/2026
**Fila completa:** `FILA.md`. **Item:** Build 9 da fila — segurança de servidor.
**Decisões respondidas:** CSP fica para um build próprio; o limite de chamado
passa a ser por e-mail com teto global atrás.

---

## 1. A bomba de zip no leitor de planilha

Um `.xlsx` é um zip, e **um zip mente sobre o próprio tamanho**. A tela já
cobrava 4 MB de entrada — e quatro megas de zeros descomprimem para gigabytes.

O que havia em `lib/planilha.ts`:

```ts
saida[nome] = metodo === 8 ? inflateRawSync(cru) : cru;
```

Sem teto, num laço que inflava **todas** as entradas do zip para dentro de um
objeto. Uma bomba escondida numa entrada que a planilha nem lê era descomprimida
do mesmo jeito.

Quem alcança: **qualquer e-mail**. Os 14 dias de degustação dão conta, e a conta
abre a porta. O processo que morre de falta de memória é o que segura a chave de
serviço.

### Medido, com a bomba de verdade

`testes/bomba.mjs` fabrica o zip e entrega ao código do produto. Contra o código
antigo:

```
[2]  zip de 1 MB declarando 1 GB   → recusado em 18.155 ms, rss +2.065 MB
[2b] zip de 1 MB MENTINDO o tamanho → recusado em 12.750 ms, rss +1.031 MB
[3]  bomba numa entrada não lida    →     lido em  8.560 ms, rss +1.030 MB
```

Depois: **0 ms, 28 ms e 1 ms**, com o RSS parado. São **oito falhas** contra o
código antigo — a régua não afirma "existe um teto no arquivo", ela mede o que
acontece quando o arquivo chega.

Quatro travas, e cada uma sozinha já barra a bomba: só se descomprime o que se
vai **ler**; teto por entrada imposto pelo próprio zlib (`maxOutputLength`, que
para no meio em vez de alocar e estourar depois); teto **somado**; e teto de
quantidade de entradas.

> **Um erro meu, do tipo que este projeto castiga.** A primeira versão da régua
> media memória com `heapUsed` — e `heapUsed` **não conta Buffer**. Inflar um
> gigabyte movia aquele número em zero, então a afirmação "não alocou o
> gigabyte" **passava com o defeito instalado**. Trocada por relógio e `rss`, que
> é o que se move de verdade. Os dezoito segundos de processador são a negação
> de serviço; a memória é só o sintoma mais visível.

---

## 2. O limite de abrir chamado era o balde de todo mundo

A trava era literalmente esta:

```sql
select count(*) from walkstamp.recado
 where criado_em > now() - interval '1 minute' >= 30
```

Ela conta os recados **de todo mundo**. Trinta por minuto vindos de um ator só
fechavam a caixa de entrada do produto inteiro — quem tinha um problema de
verdade recebia "muitos" e ia embora. **Um limite que qualquer um pode esgotar
para os outros não protege: ele transfere o estrago.**

Agora são três baldes, do mais estreito ao mais largo:

| balde | teto | por quê |
|---|---|---|
| por e-mail | 5/min | é o caminho de quem quer resposta |
| anônimo | 10/min no total | quem não deixa e-mail não tem como ser separado de outro que também não deixou — fica em faixa própria e **não consome a de quem se identificou** |
| global | 300/min | rede contra enxurrada, não limite de uso |

> **O que isto NÃO resolve, e está escrito na migração para ninguém achar que
> resolve:** o e-mail não é verificado na abertura. Quem trocar de endereço a
> cada envio ganha um balde novo a cada envio e cai só no teto global. Fechar
> aquilo exige identificar quem chama — e quem chama é o navegador, direto no
> PostgREST, sem servidor nosso no caminho para ver o IP. O ganho real é o que
> estava quebrado: **uma enxurrada deixa de derrubar a caixa de quem não tem
> nada a ver com ela.**

---

## 3. A consulta de chamado não tinha teto de tentativa

`chamado_ver` exige número **e** e-mail — isso já estava certo, e a fila
descrevia o item pior do que ele era. O que faltava era teto de tentativa: o
número é sequencial de quatro dígitos (`WS-0001`), então quem souber o e-mail de
alguém — e e-mail de trabalho não é segredo — varria `WS-0001` a `WS-9999` e lia
o que a pessoa escreveu.

**Dez tentativas por e-mail a cada dez minutos.** Quem consulta o próprio chamado
faz uma ou duas; nove mil e novecentas passam a levar um mês.

A tabela nova guarda o **MD5** do e-mail, e não o e-mail. Não é sigilo — o e-mail
de quem abriu chamado já está na `recado` ao lado. É para que ela não vire uma
lista **nova**: a de endereços que alguém *tentou* consultar, que inclui os de
quem nunca abriu chamado nenhum.

E o teto conta a tentativa **mesmo quando ela erra** — contar só os acertos seria
contar exatamente o que a varredura não faz.

### As migrações, aplicadas ao vivo

| migração | o que faz |
|---|---|
| `o_limite_do_chamado_para_de_ser_de_todo_mundo` | os três baldes, a tabela `tentativa` e o teto da consulta |
| `prova_do_teto_do_chamado` | **reprova em vez de narrar** |

A `prova_do_chamado` do dia 16 usa `raise notice`: ela conta o que aconteceu e
passa de qualquer jeito. Uma prova que não sabe reprovar é documentação com
roupa de teste. A nova levanta exceção, e a migração falha. Ela cobra cinco
coisas, e a quarta é a que dá nome ao item:

```
1 consulta: 10 passam, a 11a e barrada
2 consulta: o teto de um e-mail nao alcanca o outro
3 abertura: 5 passam, a 6a e barrada
4 abertura: quem estourou o teto nao fecha a porta do vizinho
5 anonimo: tem teto proprio, e nao consome o de quem se identifica
```

Ela limpa o que criou: zero linhas de prova sobraram, e os 6 chamados reais
continuam lá.

---

## 4. O sal do convite estava emprestado do segredo que apaga dado de cliente

```ts
const SAL = process.env.CONVITE_SAL || process.env.CRON_SECRET;
```

O `CRON_SECRET` é a chave do endereço que **apaga dado de cliente**. Rodar aquele
segredo é boa prática de segurança — e, com o encosto aqui, ela reescrevia todos
os hashes do convite em silêncio: as contagens do limite zeravam junto.

Quem faz aquela rotação está pensando em faxina, não em convite. **Um efeito
colateral que ninguém tem motivo para prever é a definição de armadilha**, e o
custo de evitá-la é uma variável que a lista de configuração já pede no passo 8.

Os dois documentos que descreviam o encosto foram corrigidos.

> ⚠️ **Uma ação sua, antes do próximo deploy:** o `CONVITE_SAL` passou a ser
> **obrigatório**. Se na Vercel só existir o `CRON_SECRET`, o convite por e-mail
> responde 503 e o aplicativo cai no `mailto:` — que é o caminho previsto, mas
> não é o que você quer. Confira que o `CONVITE_SAL` está lá.

---

## Dois itens da fila que não eram defeito

**O link do roteiro leva caso, sistema e chamado na barra de endereço.** É
recurso deliberado e **já declarado na política de privacidade**, nos cinco
idiomas, com o aviso certo: *"o que vai no endereço fica no histórico do seu
navegador e nos registros de quem servir a página. Nome de sistema e número de
chamado, tudo bem; dado pessoal, não."* Não há o que consertar — há o que manter.

**O `app/api/faxina/route.ts` "nunca foi auditado".** Auditado agora: ele exige o
`CRON_SECRET`, **responde 503 quando o segredo não está configurado** (em vez de
ficar aberto), 401 quando ele está errado, e tem `?seco=1` para contar sem
apagar. O comentário no topo já explicava cada uma dessas escolhas. O item era
uma dívida de leitura, não de código.

---

## A esteira, e dois vermelhos que não eram meus

```
147 ok · 4 PULADO · 0 FALHOU
Pulados: timepag.mjs licenca.mjs liclink.mjs licauto.mjs
```

**151 réguas, contra 150** — entrou a `bomba.mjs`.

Na primeira execução completa, `jira.mjs` e `resumo.mjs` ficaram vermelhos. Os
dois passam sozinhos, e **o produto não mudou neste build**: a única linha
diferente em `public/app.html` é o carimbo da versão. É a mesma família do
`etapas.mjs` do Build 9 — extração de quadros medida por relógio.

**`jira.mjs`.** Esperava `#prevCard` deixar de estar escondido e depois apostava
600 ms. O cartão aparece quando o **primeiro** quadro chega; os outros dois ainda
estão vindo. Sob carga a tabela do Jira saía com dois passos e a régua reprovava
por um motivo que não é o dela. Trocado por esperar os três quadros. Ironia útil:
o mesmo arquivo já pregava isso trinta linhas abaixo, para a mensagem de "resumo
copiado" — a lição estava aprendida para o texto e não para os quadros.

**`resumo.mjs`.** Este era mais interessante, e o sintoma (`4 vs 3`) não dizia
nada sobre a causa. O bloco descarta uma tela à mão, clica na limpeza e depois
em desfazer. **Se não houver repetidas para a limpeza tirar, o `#dedup` não faz
nada — e o desfazer alcança o GESTO ANTERIOR**, o "manter todas" do bloco de
cima, devolvendo justamente a tela que tinha sido descartada à mão. Quantas
repetidas existem depende de quantos quadros a extração entregou, e isso varia
com a carga. A premissa era acidente; virou afirmação, com espera de condição
nos dois cliques.

> **O que aprendi de errado antes, e agora está certo.** No Build 9 tentei
> estabelecer uma premessa parecida no `etapas.mjs` inventando assinaturas de
> texto, e quebrei o teste — o comparador não é igualdade de texto, é distância
> entre números. O `resumo.mjs` já sabia disso e fazia certo (`f.sig = [i*90,
> i*90, i*90]`). Era só ter lido o vizinho.

---

## O que fica

- **A CSP** *(DEC-12 caminho A)*, por sua decisão: build próprio. O
  `next.config.mjs` explica por que ela está fora — uma CSP apertada demais
  quebra a ferramenta, que carrega biblioteca e modelo de CDN e roda WASM.
  Já no ar: `Referrer-Policy`, `X-Frame-Options: DENY` e `frame-ancestors`.
- **O e-mail não verificado na abertura de chamado.** Trocar de endereço dá um
  balde novo. Fechar exige ver quem chama, e hoje ninguém nosso está no caminho.
- **O número de chamado é sequencial.** O teto de tentativa protege os que já
  existem; deixá-lo impossível de adivinhar exigiria mudar o número que a pessoa
  anota, e isso é decisão de produto, não de segurança.
- **A premissa do `etapas.mjs`** continua sendo a do Build 9, e agora sei como
  estabelecê-la: assinatura é lista de números, e o vizinho `resumo.mjs` já
  mostra o jeito.
- Represados por sua instrução: Stripe (DEC-14), Drive (DEC-15), vocabulário de
  cenários (Build 12).

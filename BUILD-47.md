# Build 47 — a função de borda do time perde cinco ações que ninguém chamava

## O que eu ia fazer, e por que não fiz isso

Quando você escolheu **A + C**, o "C" que eu descrevi era migrar o
`walkstamp-time` inteiro para rotas do Next, para acabar com a última Edge
Function de sessão. **A medição mudou a premissa em dois pontos, e os dois
apontam para outro lugar.**

**Primeiro: cinco das seis ações não têm um único chamador.** Varri
`src/`, `app/`, `lib/` inteiros:

| ação | chamadores |
|---|---|
| `modelo` | 1 — `src/template.html:15185` |
| `listar` | 0 |
| `bloquear` | 0 |
| `ajustar` | 0 |
| `convidar` | 0 |
| `config` | 0 |

Não é coincidência: o painel do time **saiu da `/time` e virou a `/conta`**, que
é Next e chama as mesmas RPCs direto (`app/conta/acoes.ts:231-311`). A Edge
Function ficou sendo uma segunda implementação do mesmo portal, com
`service_role` na mão, que ninguém exercitava. Migrar essas cinco seria migrar
código morto para um lugar novo.

**Segundo: a ação que sobrou não pode virar rota.** A sessão da ferramenta vem
do **fragmento** do link mágico (`daVoltaDoLink()`: *"por ser fragmento, não
chega a servidor nenhum"*). Não existe cookie para uma rota do Next ler — ela
teria que reimplementar a verificação de JWT que o `verify_jwt: true` do
Supabase já faz de graça e certo.

Então o C virou o que a medição pedia: **apagar as cinco mortas e deixar a
`modelo`**, com o motivo escrito dentro do arquivo, para quem abrir daqui a seis
meses não "restaurar" o que foi removido de propósito.

## O que mudou

- `supabase/functions/walkstamp-time/index.ts` — 5 ações removidas; sobrou o
  despacho de `modelo` e a trava de identidade intacta (e-mail do JWT,
  `role !== "authenticated"` recusa, nada de e-mail vindo do corpo).
- **Implantada no Supabase** (`kjlnyyblhanficgpends`), **`version 3`**, relida
  pela API logo depois — o conteúdo no ar é o do disco.
- `supabase/functions/MANIFESTO.sha256` — regenerado.
- `supabase/functions/LEIA-ME.md` — a seção nova conta a medição e diz o que
  está no ar.
- `testes/edge.mjs` — bloco **[5]** novo.
- `FILA.md` — o item "três Edge Functions que não existem no repositório" estava
  vencido desde o Build 46; marcado resolvido, com o que sobrou dele.

## A régua nova, e por que ela tem dois lados

O bloco [5] trava **a função** e **os chamadores**:

1. a função só despacha `modelo`, e não despacha nenhuma das cinco (o nome
   dentro do comentário que explica a remoção não reprova — senão a régua
   obrigaria a apagar a explicação);
2. **nenhum chamador do produto pede outra coisa a ela** — varre
   `src/template.html`, `app/` e `lib/`, acha cada `fetch` para
   `/functions/v1/walkstamp-time` e lê a `acao` do corpo.

O item 1 é leitura de fonte, e fonte só prova que alguém escreveu a linha. **O
item 2 é o que pega a regressão de verdade:** um cliente novo para `listar`
contra uma função que não serve mais `listar` daria um **400 mudo** em produção
— exatamente o silêncio que aquele diretório existe para acabar.

**Provado por falha, dos dois lados:**

- devolvi um `if (acao === "listar")` ao arquivo → `FALHA  e não despacha
  listar` (e o manifesto reprovou junto, como devia);
- criei um `lib/_falso-chamador.ts` pedindo `listar` → `FALHA  e nenhuma chamada
  pede ação aposentada → lib/_falso-chamador.ts:2 pede listar`.

Desfeitos os dois, verde de novo.

## O que esta régua NÃO prova

Que o que está no ar é o que está no disco. Continua valendo o que o Build 46
escreveu: nenhuma régua deste projeto fala com a rede, de propósito. Deste
container também não dá — `curl` para `*.supabase.co` volta `000`. A garantia
que tenho é a ida e a volta pela API do Supabase: implantei este arquivo e reli
a `version 3`.

## Esteira

`bash testes/liberar.sh` — **21 de 171 réguas**, verde:
`build.py` ok · `tsc --noEmit` ok · 17 contratos · `medicao` · `offlineb` ·
`egressao` · `edge`. As outras 150 ficaram de fora porque este diff não as toca.
A completa (`rodar.sh`) é no Build 50 ou antes de publicar.

## O que eu faria a seguir, na minha ordem

1. **`stripe:conferir` com a chave de teste** — 15 minutos, é seu, e é o que
   destrava a DEC-14 sem ligar nada em produção.
2. **`CONVITE_SAL` na Vercel** — impedimento seu, de um campo.
3. **Passo 1 da migração do webhook da Stripe**, no painel dela. Enquanto ele
   não acontece, a divergência declarada continua sendo a única do repositório.
4. **`rodar.sh` completo** antes de publicar.
5. **`encolherFita()` com roteiro** — a janelinha fica em 480 em toda língua;
   é acabamento, e cabe em um build.

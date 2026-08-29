# Build 51 — o domínio sai do `beta`, e o assento vira limite de verdade

## O último item com estado

O catálogo tinha **um** item marcado: `dominioAutomatico`, em `beta`. O selo
estava certo — a entrada automática por domínio **funcionava**, mas quem
cadastrava o domínio éramos nós, na mão, por chamado. Não era self-service.

Agora quem administra cadastra sozinho, na conta. **96 itens, nenhum com
estado.**

## Quem pode reivindicar um domínio *(sua decisão)*

**Só o domínio do próprio e-mail.** Quem entrou como `leandro@empresa.com`
reivindica `empresa.com`, e mais nada. Não é prova de posse como um registro de
DNS seria, mas é o único sinal que existe sem sair para a rede: a pessoa
controla um endereço ali, porque foi por ele que o link mágico chegou.

Somado a duas recusas que não são detalhe:

- **provedor público nunca** — reivindicar `gmail.com` daria o plano pago a todo
  mundo que tem Gmail. Casado por prefixo ancorado, e não por lista de domínios
  inteiros: `yahoo.co.jp` e `yahoo.com.br` são o mesmo provedor, e uma lista de
  nomes completos envelhece em silêncio deixando passar a variante esquecida;
- **domínio de outro cliente também não**, com recado e não com erro de banco.

**Soltar é diferente de trancar:** um domínio liberado volta a poder ser
reivindicado por quem tiver endereço nele.

Cada recusa tem frase própria nos cinco idiomas, porque cada uma pede uma ação
diferente de quem lê: trocar o endereço, falar com quem já reivindicou, ou
desistir. Um código na tela mandaria a pessoa adivinhar qual.

## O buraco que abrir o cadastro obrigou a ver

**A entrada por domínio não olhava assentos.** O `plano_de` concedia o plano do
cliente a QUALQUER e-mail daquele domínio, sem contar quantos já estavam dentro.
Quem comprasse 3 assentos podia dar o plano a 500 pessoas — e o número que o
cartão Team vende era decoração.

Enquanto o cadastro passava por nós, era um risco que a gente via chegar.
Self-service, viraria o desenho do produto. **As duas coisas foram juntas de
propósito: entregar a primeira sem a segunda seria transformar um descuido em
funcionalidade.**

Atinge só a **primeira** entrada de cada pessoa por domínio. Quem já tem assento
nominal sai pelo ramo `conta`, lá em cima, e nem chega na contagem — inclusive
quem entrou por domínio antes, porque a `registrar_emissao` grava o `cliente_id`
na primeira emissão. **Ninguém que já está dentro perde a renovação.**

## Medido no banco, oito afirmações

provedor público recusado · domínio alheio recusado · o próprio domínio entra (e
o `@` colado não atrapalha) · outro cliente não rouba o já reivindicado · com 1
de 2 assentos a entrada vale · com 2 de 2 vira `sem_assento` · quem já tem
assento nominal não é afetado · domínio solto pode ser pego por outro.

## Três defeitos de régua, e nenhum era do produto

**1. A `promessa.mjs` exigia que o catálogo ficasse inacabado.** Ela afirmava *"o
catálogo usa mais de um estado"* — e quando o último selo caiu, **reprovou o
produto por estar pronto**. Ela guardava algo real: sem nenhum item usando selo,
a maquinaria do selo vira código morto e ninguém percebe quando quebra. A
pergunta mudou — as três palavras têm que existir nos cinco idiomas, **usadas ou
não**.

**2. Comitar antes da esteira encolhe o diff.** Eu comitei para não deixar
trabalho solto; a pista disse *"3 arquivo(s) tocados desde HEAD"* e teria
respondido **verde sobre quase nada**. O `liberar.sh` passou a **recusar** o
diff vazio e a dizer o que fazer: `bash testes/liberar.sh HEAD~1`, ou `--tudo`.

**3. O detalhe que não dizia nada.** Três afirmações novas do `portal.mjs`
mostravam os primeiros 70 caracteres da página — "Walkstamp", o cabeçalho — ao
lado de uma afirmação sobre o recado de recusa. Agora mostram o recado.

## Provado por falha

- `cadastrarDominio` mandando `p_remover: true` → `FALHA e sem pedir remoção → true`;
- o motivo `sem_assento` sem frase no mapa → `FALHA "sem_assento" vira frase na tela do plano`.

## Esteira

`bash testes/liberar.sh HEAD~1` — **33 de 171**, verde. Inclui `portal`,
`licauto`, `sessao`, `promessa`, `planos`, `precos` e migrações × MANIFESTO.

## O que sobrou, e é seu

1. **`CONVITE_SAL` na Vercel**, com `BREVO_API_KEY` e `EMAIL_DE` — sem eles o
   convite de assento cai no meio-termo honesto: o assento nasce, a carta não sai.
2. **`stripe:conferir` com chave de teste** — 15 minutos, destrava a DEC-14 sem
   ligar nada em produção.
3. **Passo 1 do webhook da Stripe**, no painel dela — é a única divergência
   declarada que resta no repositório.

## O que sobrou, e é meu

- **`encolherFita()` com roteiro** — a janelinha fica em 480 em toda língua.
- **59 réguas fora do alcance do corredor específico** — o teto no
  `inventario.mjs` só desce; baixá-lo é ligar cada uma a uma linha do mapa.
- **Catorze réguas que sobem o Next** liberam a porta mas não provam que ela
  ficou livre. É uma linha em cada: `garantirPortaLivre`.

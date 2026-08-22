# O que há neste zip

A árvore do walkstamp **já construída**: `public/app.html` e
`offline/walkstamp-offline.html` estão gerados, e `src/precos.json`,
`src/figuras.json`, `src/rotas.json` e `src/marca.json` também. Para subir o
site não é preciso rodar `build.py`.

**Base:** `7c90a97` (o `main` do GitHub, de 19/08) + seis commits.

Não vêm junto, porque se regeneram ou são enormes: `.git/`, `node_modules/`
(`npm install`) e `.next/` (`npm run build`).

## Os seis commits

1. **Sincroniza a árvore com o código de 22/08.** O repositório do GitHub
   estava três dias atrás da árvore de trabalho, e as duas linhagens de git não
   se conversam. 267 arquivos.
2. **O mínimo do Team cai de cinco assentos para três.** O número mora em
   `lib/stripe.ts`, e junto vai o piso do checkout, que aceitava 1.
3. **A página de preços passa a vender resultado, e não quantidade de
   recurso.** Nos cinco idiomas.
4. **As réguas:** `testes/precos.mjs` novo, mais `cinco`, `figuras` e
   `promessa` atualizados.
5. **Dois portões seguem a estrutura nova**, e uma promessa falsa sai do ar.
6. **Tira o bloco de doação do site.**

## Para aplicar num clone que esteja em `7c90a97`

```bash
git fetch APLICAR/rodada-precos.bundle \
  claude/relaxed-sagan-mnycup:claude/relaxed-sagan-mnycup
git checkout claude/relaxed-sagan-mnycup
```

O bundle traz os seis commits com as mensagens inteiras. Se preferir a árvore
crua, ela está aqui do lado — mas aí a história se perde.

## Para rodar

```bash
npm install
npm run build            # python3 build.py && next build
npx next start -p 8802   # os testes de site falam com esta porta
node testes/precos.mjs
```

## O que fica pendente

`AUDITORIA-PENDENTE.md`, na raiz. Uma linha por promessa que a página publica,
com o teste que a comprova ou `sem teste` — e, no fim, os cinco itens que
precisam de decisão ou de uma chave que não existe neste ambiente.

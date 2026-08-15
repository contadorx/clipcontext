# Bancada de navegador

Três roteiros que abrem o app num Chromium de verdade e **digitam**. Existem
porque `tsc`, `next build` e `npm run test:regras` aprovaram, sem hesitar, dois
bugs que impediam a pessoa de escrever no formulário de lançamento:

1. um componente definido dentro do render remontava o diálogo a cada tecla, o
   foco ia para o botão Fechar e a barra de espaço fechava o formulário;
2. a carga assíncrona chegava depois e devolvia ao campo o valor antigo.

Nenhuma asserção pega isso. Só digitar pega.

## Como rodar

```bash
printf 'NEXT_PUBLIC_SUPABASE_URL=https://exemplo.supabase.co\nNEXT_PUBLIC_SUPABASE_ANON_KEY=exemplo\n' > .env.local
npx next dev -p 3112

# noutro terminal
npm i --no-save playwright-core
node scripts/bancada/foco.js
node scripts/bancada/carga-lenta.js
node scripts/bancada/preenchimento.js
node scripts/bancada/reabrir.js
```

`preenchimento.js`, `reabrir.js` saem com código 1 quando falham — dá para
pendurar num CI. `foco.js` e `carga-lenta.js` imprimem o que encontraram.

As credenciais podem ser falsas: as bancadas não dependem de banco. O
`carga-lenta.js` intercepta as chamadas ao Supabase e as segura por 2,5 s de
propósito — é assim que se reproduz, numa máquina rápida, o que a pessoa vive
numa conexão comum.

O caminho do Chromium sai de `CHROMIUM=/caminho/para/chrome`; sem a variável,
vale o padrão do sandbox onde os roteiros nasceram.

## No deploy

`.env.production` traz `NEXT_PUBLIC_BANCADA=1`, então basta publicar e abrir
**`/estilo/tela`**. Para desligar, troque para `0` e publique de novo — enquanto
estiver em `1`, quem souber o endereço entra sem login.

A massa não depende do Playwright: `components/bancada/dados-falsos.tsx` troca o
`fetch` do navegador e responde com `lib/bancada/massa.json`. É o mesmo arquivo
que `servir.js` usa nos roteiros, para não haver duas verdades.

Toda tela de bancada carrega uma faixa âmbar dizendo que nenhum número ali é
real. Ligada em produção, esta rota é a mais perigosa do app: parece o sistema,
tem o shell do sistema, e todo saldo dentro dela é inventado.

## As páginas que eles abrem

Existem em desenvolvimento sempre, e em produção só com a chave acima:

| Rota | O que é |
|---|---|
| `/estilo/tela` | índice das telas inteiras |
| `/estilo/tela/<nome>` | a tela real dentro do shell real |
| `/estilo` | todo componente base em todo estado |
| `/estilo/foco` | um diálogo **errado de propósito**, que remonta a cada tecla |
| `/estilo/lancamento` | o modal de lançamento real, com as listas vazias |
| `/estilo/lancamento-pagina` | a página do lançamento (`/movimentacoes/<id>`) |

`/estilo/foco` é a única que contém o antipatern de propósito. Se alguém
"consertar" a `Moldura` de lá, a bancada deixa de testar o que existe para
testar.

## O que cada roteiro prova

- **`foco.js`** — digitação lenta, digitação sem pausa e inserção no meio do
  texto, num diálogo que remonta a cada tecla. As três falhavam antes.
- **`carga-lenta.js`** — digitar antes de a carga terminar e conferir que o
  texto sobrevive quando ela chega.
- **`preenchimento.js`** — o outro lado: sem digitar, todo campo vem preenchido
  do banco, inclusive o `<select>` de categoria; digitando num campo, só aquele
  campo é preservado e o resto preenche normalmente.
- **`reabrir.js`** — o diálogo não desmonta ao fechar, então reabrir tem de
  trazer o formulário limpo. Guarda o caso caro: "Repetir mensalmente" herdado
  de um abandono anterior transforma um lançamento em doze parcelas.

Os quatro foram conferidos contra a versão quebrada do código: quebrando o
conserto de propósito, eles falham. Um teste que passa nos dois lados não está
testando nada.

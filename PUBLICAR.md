# Publicar

Uma página só, para não ter que lembrar de nada.

## O que já está pronto

`npx next build` passa limpo, os cinco idiomas geram 80 endereços, e o
`build.py` roda dentro do build da Vercel (está no `buildCommand` do
`vercel.json`) — ou seja, **você não precisa rodar nada antes**.

## Os dois comandos

```bash
npx vercel login          # uma vez, na conta que é dona de walkstamp.com
npx vercel --prod
```

## Variáveis de ambiente: nenhuma

Desde o Build 71 o site e a ferramenta não precisam de variável nenhuma: não há
banco, cobrança nem envio de e-mail do lado de cá. As que ficaram na Vercel
(`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PERSONAL`, `STRIPE_PRICE_TIME`,
`CRON_SECRET` e as do Brevo) podem ser apagadas em *Project Settings →
Environment Variables* depois do deploy — nenhum código as lê mais.

Na Stripe, desligue o endpoint de webhook que apontava para
`/api/stripe/webhook`: a rota saiu, e a Stripe ficaria tentando entregar.

## Depois de publicar, confira três coisas

1. `https://walkstamp.com/` — tem que trazer **PT EN ES DE FR** no cabeçalho e a
   faixa de formatos de saída. Hoje ela traz três siglas e nenhuma faixa: a home
   em português está servindo um build velho, enquanto `/en` já está no novo.
   É a razão de publicar agora.
2. `https://walkstamp.com/precos` e `/conta` — os dois têm que levar para a
   home (308). A página de preços e a conta saíram no Build 71.
3. `https://walkstamp.com/ajuda`, `/de/hilfe`, `/fr/aide` — a base de
   conhecimento, com nove temas.

Se a home em português continuar velha depois do deploy, é cache da CDN:
*Deployments → o deploy novo → Redeploy*, com a caixa **"Use existing build
cache" desmarcada**.

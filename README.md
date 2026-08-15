# FinanceiroX

Plataforma de gestão financeira multiempresa: conciliação bancária, contas a pagar e receber,
fluxo de caixa, pagamentos e cobrança por CNAB, NFS-e e portal do cliente.
Next.js 14 (App Router) + Supabase + Tailwind. Identidade teal/verde-água + magenta.

## Rodar local

1. `npm install`
2. `cp .env.local.example .env.local` e preencher
3. `npm run dev` → http://localhost:3000

## Dois domínios, um deploy

O site institucional e o produto vivem no mesmo projeto da Vercel. Quem decide qual
responde é o **hostname**, em `middleware.ts`:

| host                     | responde                                            |
| ------------------------ | --------------------------------------------------- |
| `financeirox.com.br`     | site público (`app/site/*`, sem o prefixo na URL)    |
| `www.financeirox.com.br` | idem                                                 |
| `app.financeirox.com.br` | o produto, com sessão                                |
| localhost / preview      | o produto — e `/site/...` abre o site para revisão    |

`DO_SITE`, no middleware, é a lista das páginas públicas. **Página nova em `app/site/`
precisa entrar nessa lista** (e em `app/sitemap.ts`); sem isso ela só responde no host
do app. O que não está na lista é tratado como tela do produto e redirecionado para
`app.financeirox.com.br` — o pior caso é um redirecionamento que funciona, não um 404.

Em localhost e no preview da Vercel, o site é revisado em `/site`, `/site/termos` etc.
No host do app essas URLs redirecionam para o domínio público, para não existir a mesma
página em dois endereços.

## Vercel — o que conferir antes de publicar

- **Root Directory**: a pasta deste projeto (`financeiro-simples-app`).
- **Framework**: Next.js (detectado).
- **Domains**: adicionar os dois hosts. Não marcar "redirect to primary domain" entre
  eles — o apex redirecionando para o `app.` (ou o contrário) briga com o middleware e
  produz laço de redirecionamento.
- **Cron**: os jobs de `vercel.json` disparam no domínio de produção do projeto. `/api/*`
  está fora do matcher do middleware, então eles respondem em qualquer um dos dois hosts.
- **Webhook do Asaas**: apontar para `https://app.financeirox.com.br/api/asaas/webhook`.
- **Variáveis**: ver `.env.local.example`. Três precisam de atenção especial:
  - `CRON_SECRET` — sem ela, **toda** rota de cron responde 401, inclusive à Vercel.
  - `ASAAS_WEBHOOK_TOKEN` — sem ela, o webhook devolve 401 e a baixa de pagamento se perde.
  - `NEXT_PUBLIC_SITE_URL` — apesar do nome, aponta para o **host do app**; é a base dos
    links que saem em e-mail. Na dúvida, deixe vazia e o host do app é usado.

## Deploy

O deploy é feito por upload de zip na Vercel (não por git push). Antes de gerar o zip:

```
npx tsc --noEmit && npx next build && npm run test:regras && npm run test:gravacoes
```

Nunca rodar `prettier` neste repositório: não há configuração e ele reformata arquivos
inteiros, sepultando o diff de verdade.

## Estrutura

- `app/site/*` → site público (home, termos, privacidade, segurança)
- `app/(app)/*` → shell autenticado (sidebar + topbar) e telas do produto
- `app/portal/*` → portal do cliente, com sessão própria
- `app/api/*` → rotas de servidor, crons e webhooks
- `lib/` → motor de preços, CNAB, boleto, NFS-e, conciliação, formatação
- `fx_*.sql` → migrations aplicadas no Supabase, na ordem em que foram criadas

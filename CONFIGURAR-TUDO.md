# Ligar o Walkstamp no ar

Desde o Build 71 o Walkstamp é **inteiramente grátis e sem servidor**:

- não há conta, cobrança, banco de dados nem envio de e-mail do lado de cá;
- a ferramenta roda no navegador de quem usa;
- o site e o blog são páginas montadas no deploy.

Até o Build 70 este arquivo tinha 331 linhas sobre variáveis da Vercel, Brevo e
Stripe. O que sobrou cabe aqui.

## 1. A Vercel

- **Variáveis de ambiente: nenhuma.** O deploy roda `python3 build.py && next
  build`, e os dois não leem variável nenhuma.
- **Apague as antigas,** em *Project Settings → Environment Variables*, depois do
  primeiro deploy do Build 71. Nenhum código as lê mais:
  - Supabase: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`;
  - Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
    `STRIPE_PRICE_PERSONAL`, `STRIPE_PRICE_TIME`;
  - Brevo: `BREVO_API_KEY`, `EMAIL_DE`, `EMAIL_DE_NOME`;
  - as nossas: `CONVITE_SAL`, `CRON_SECRET`, `WALKSTAMP_DONO`.
- **O cron da faxina saiu** do `vercel.json`. Se ele continuar aparecendo em
  *Settings → Cron Jobs*, é do deploy antigo e some com o novo.

## 2. Os e-mails, na HostGator

São **duas caixas**. As duas precisam **receber** e-mail de verdade: publicar um
endereço que não responde é pior que não publicar.

| caixa | para quê | onde aparece |
|---|---|---|
| `suporte@walkstamp.com` | recados, problemas e ideias | o "Enviar" da ferramenta e a aba "Dar retorno" do site abrem o e-mail da pessoa já endereçado a ela |
| `privacidade@walkstamp.com` | canal do titular (LGPD/GDPR) e do encarregado | política de privacidade, termos e DPA |

Os dois endereços estão no `build.py` (`SUPORTE` e `CONTATO`). Trocar um deles é
trocar a linha e fazer um deploy.

O Brevo deixou de ser usado: o convite e o recado abrem o programa de e-mail da
própria pessoa. Se houver plano pago no Brevo, ele pode ser cancelado.

## 3. O que desligar na Stripe

1. **Desligue o webhook** que apontava para `https://walkstamp.com/api/stripe/webhook`
   (*Developers → Webhooks*). A rota saiu, e a Stripe ficaria tentando entregar
   e mandando e-mail de falha.
2. **Assinatura em aberto:** se houver alguma, cancele-a no painel da Stripe,
   para ninguém ser cobrado por um plano que não existe mais.
3. **Produtos e preços:** arquive-os. Não é preciso apagar; arquivados, saem do
   checkout.
4. **As faturas e os pagamentos antigos ficam na Stripe,** e é lá que eles têm
   de ficar pelo prazo que a lei fiscal pede.

## 4. O Supabase

- **Até o Build 72** o projeto continua existindo, com os poucos registros da
  conta antiga.
- **No Build 72:**
  1. faz-se a cópia dos dados;
  2. o projeto é pausado por alguns dias;
  3. ele é apagado, só com a sua confirmação na hora, porque não tem volta.
- **Antes disso,** as 9 figuras do blog precisam estar no projeto, em
  `public/img/blog/` (ver `BLOG.md` e o FILA, DEC-23).

## 5. O Google Drive (opcional)

Continua como antes: os três valores (`G_CLIENT`, `G_KEY`, `G_APP`) estão no
`build.py`. Vazios, nenhum botão do Google aparece. O passo a passo está em
`GOOGLE-DRIVE.md`.

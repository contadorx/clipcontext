-- FinanceiroX — Recuperação de churn.
-- Marca quando a assinatura foi cancelada e quando o e-mail de "volte" já foi enviado,
-- para o cron disparar a recuperação uma única vez, alguns dias após o cancelamento.

alter table escritorios add column if not exists cancelado_em timestamptz;
alter table escritorios add column if not exists recuperacao_enviada_em timestamptz;

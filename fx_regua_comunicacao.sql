-- FinanceiroX — Régua de comunicação (ciclo de vida).
-- Registra cada toque já enviado por escritório, para não repetir.
-- Lida apenas pelo cron (service role); RLS sem policy bloqueia o resto.

create table if not exists comunicacao_envios (
  id uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references escritorios(id) on delete cascade,
  momento text not null,                 -- 'apos_cadastro' (conversão) | 'pos_pagamento' (retenção)
  quando int not null,                   -- dia do toque (1, 4, 8, ...)
  criado_em timestamptz default now(),
  unique (escritorio_id, momento, quando)
);

alter table comunicacao_envios enable row level security;

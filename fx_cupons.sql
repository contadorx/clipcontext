-- FinanceiroX — Cupons de desconto (percentual, por tempo limitado).
-- O cupom dá X% de desconto por N meses; depois um cron reverte a assinatura
-- ao preço cheio. Cupons são lidos/gerenciados só por rotas server (service role).

create table if not exists cupons (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  percentual int not null check (percentual between 1 and 100),
  duracao_meses int,                       -- null = enquanto assinante; N = volta ao cheio após N meses
  ativo boolean not null default true,
  max_usos int,                            -- null = ilimitado
  usos int not null default 0,
  criado_em timestamptz default now()
);

alter table cupons enable row level security;
-- Sem policy pública: acessada apenas via rotas server (service role, que ignora RLS).

-- Rastro do cupom aplicado por escritório, para reverter quando expirar.
alter table escritorios add column if not exists cupom_codigo text;
alter table escritorios add column if not exists cupom_percentual int;
alter table escritorios add column if not exists cupom_expira_em timestamptz;

-- Incremento atômico de uso (chamado pelo servidor ao aplicar um cupom).
create or replace function incrementar_uso_cupom(p_codigo text)
returns void
language sql
security definer
set search_path to 'public'
as $$
  update cupons set usos = usos + 1 where codigo = upper(p_codigo);
$$;

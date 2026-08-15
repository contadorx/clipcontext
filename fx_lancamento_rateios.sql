-- FinanceiroX — Rateio de um lançamento entre centros de custo.
--
-- Problema que resolve: hoje cada lançamento tem UM `centro_custo_id`. Uma conta
-- de luz que atende duas lojas precisa ser dividida na mão, virando dois
-- lançamentos — o que suja a conciliação (o extrato tem uma linha só) e o
-- contas a pagar (é um boleto só).
--
-- Regra de leitura, e ela é simples:
--   • lançamento SEM linhas aqui  -> vale o `lancamentos.centro_custo_id` (como sempre foi)
--   • lançamento COM linhas aqui  -> o `centro_custo_id` da tabela é ignorado e
--                                    valem as partes daqui
-- Nada retroativo: o que já existe continua funcionando sem nenhuma migração de dados.
--
-- Rodar uma vez no SQL Editor do Supabase.

create table if not exists lancamento_rateios (
  id uuid primary key default gen_random_uuid(),
  lancamento_id uuid not null references lancamentos(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,
  centro_custo_id uuid not null references centros_custo(id) on delete restrict,
  valor numeric(14,2) not null check (valor > 0),
  criado_em timestamptz not null default now()
);

create index if not exists lancamento_rateios_lanc_idx on lancamento_rateios (lancamento_id);
create index if not exists lancamento_rateios_empresa_idx on lancamento_rateios (empresa_id);

-- o mesmo centro não aparece duas vezes no mesmo lançamento
create unique index if not exists lancamento_rateios_uniq
  on lancamento_rateios (lancamento_id, centro_custo_id);

alter table lancamento_rateios enable row level security;

-- Empresas que o usuário logado alcança (mesma função usada pelas visões salvas).
create or replace function fs_empresas_do_usuario()
returns setof uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select e.id
  from empresas e
  join membros m on m.escritorio_id = e.escritorio_id and m.user_id = auth.uid()
$$;

drop policy if exists lancamento_rateios_ler on lancamento_rateios;
create policy lancamento_rateios_ler on lancamento_rateios
  for select using (empresa_id in (select fs_empresas_do_usuario()));

drop policy if exists lancamento_rateios_criar on lancamento_rateios;
create policy lancamento_rateios_criar on lancamento_rateios
  for insert with check (empresa_id in (select fs_empresas_do_usuario()));

drop policy if exists lancamento_rateios_editar on lancamento_rateios;
create policy lancamento_rateios_editar on lancamento_rateios
  for update using (empresa_id in (select fs_empresas_do_usuario()))
  with check (empresa_id in (select fs_empresas_do_usuario()));

drop policy if exists lancamento_rateios_apagar on lancamento_rateios;
create policy lancamento_rateios_apagar on lancamento_rateios
  for delete using (empresa_id in (select fs_empresas_do_usuario()));

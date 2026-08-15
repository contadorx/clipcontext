-- FinanceiroX — Visões salvas (filtros nomeados de Movimentações).
--
-- Problema que resolve: hoje os filtros de Movimentações vivem em useState e se
-- perdem a cada visita. Quem concilia ou cobra remonta o mesmo recorte todo dia.
-- Aqui o recorte vira um registro nomeado — pessoal ou compartilhado com a equipe.
--
-- Rodar uma vez no SQL Editor do Supabase.

create table if not exists visoes_salvas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  tela text not null default 'movimentacoes',   -- espaço para reaproveitar em outras telas
  nome text not null,
  filtros jsonb not null default '{}'::jsonb,   -- { tipo, de, ate, busca, contas[], situacoes[], conciliacao[], ord }
  compartilhada boolean not null default false, -- true = toda a equipe da empresa enxerga
  padrao boolean not null default false,        -- true = abre por padrão nesta tela
  criado_em timestamptz not null default now()
);

create index if not exists visoes_salvas_empresa_idx on visoes_salvas (empresa_id, tela);
create index if not exists visoes_salvas_user_idx on visoes_salvas (user_id);

-- Um nome por tela por dono (evita duplicar "Vencidos" sem querer).
create unique index if not exists visoes_salvas_nome_uniq
  on visoes_salvas (empresa_id, tela, user_id, lower(nome));

alter table visoes_salvas enable row level security;

-- Empresas que o usuário logado alcança (mesmo escritório).
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

drop policy if exists visoes_salvas_ler on visoes_salvas;
create policy visoes_salvas_ler on visoes_salvas
  for select
  using (
    empresa_id in (select fs_empresas_do_usuario())
    and (user_id = auth.uid() or compartilhada)
  );

drop policy if exists visoes_salvas_criar on visoes_salvas;
create policy visoes_salvas_criar on visoes_salvas
  for insert
  with check (
    user_id = auth.uid()
    and empresa_id in (select fs_empresas_do_usuario())
  );

drop policy if exists visoes_salvas_editar on visoes_salvas;
create policy visoes_salvas_editar on visoes_salvas
  for update
  using (user_id = auth.uid() and empresa_id in (select fs_empresas_do_usuario()))
  with check (user_id = auth.uid());

drop policy if exists visoes_salvas_apagar on visoes_salvas;
create policy visoes_salvas_apagar on visoes_salvas
  for delete
  using (user_id = auth.uid() and empresa_id in (select fs_empresas_do_usuario()));

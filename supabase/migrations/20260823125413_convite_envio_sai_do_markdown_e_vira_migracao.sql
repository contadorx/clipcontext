-- A TABELA E A FUNÇÃO DO CONVITE SÓ EXISTIAM NUM MARKDOWN
--
-- `app/api/convite/route.ts` chama `walkstamp_convite_pode` antes de mandar
-- qualquer convite. O SQL que a cria estava em `CONVITE-POR-EMAIL.md`, com a
-- instrução "cole no SQL Editor e rode" — e nunca foi rodado neste banco.
-- Conferido em 23/08: zero funções com `convite` no nome, zero tabela
-- `convite_envio`. Falha fechada, o que é o comportamento certo, mas o convite
-- simplesmente não sai.
--
-- E, morando fora das migrações, a tabela escapava das duas travas automáticas
-- do projeto (RLS em toda tabela e search_path fixo em toda função).
--
-- Nem o IP nem o endereço de destino são guardados: só um hash com sal do
-- ambiente. Dá para contar sem dar para saber de quem é, e a tabela vazada não
-- permite testar "este e-mail está aqui?" com dicionário.

create table if not exists public.convite_envio (
  id          bigserial primary key,
  ip_hash     text        not null,
  para_hash   text        not null,
  criado_em   timestamptz not null default now()
);

create index if not exists convite_envio_ip_idx   on public.convite_envio (ip_hash, criado_em desc);
create index if not exists convite_envio_para_idx on public.convite_envio (para_hash, criado_em desc);

-- Ninguém lê esta tabela pelo navegador. Nem para contar.
alter table public.convite_envio enable row level security;

comment on table public.convite_envio is
  'Contagem de convites por origem e por destino. Só hashes: nada identifica ninguém.';

-- Confere os dois limites E registra, na mesma transação.
--
-- Numa função só, de propósito: conferir num lugar e registrar em outro abre a
-- janela entre os dois — dois pedidos simultâneos passariam pela conferência
-- antes de qualquer um deles registrar, e o limite viraria decoração.
--
--   5 por hora por origem   — o teto de quem está usando de verdade
--   2 por dia por destino   — o que impede usar o convite para incomodar alguém
create or replace function public.walkstamp_convite_pode(p_ip text, p_para text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  n_ip   int;
  n_para int;
begin
  select count(*) into n_ip
    from public.convite_envio
   where ip_hash = p_ip and criado_em > now() - interval '1 hour';
  if n_ip >= 5 then return false; end if;

  select count(*) into n_para
    from public.convite_envio
   where para_hash = p_para and criado_em > now() - interval '1 day';
  if n_para >= 2 then return false; end if;

  insert into public.convite_envio (ip_hash, para_hash) values (p_ip, p_para);
  return true;
end;
$$;

-- Regra de servidor, e só de servidor. Se o navegador pudesse chamar, bastaria
-- chamar com hashes inventados para zerar o limite a cada pedido.
revoke all on function public.walkstamp_convite_pode(text, text) from public, anon, authenticated;
grant execute on function public.walkstamp_convite_pode(text, text) to service_role;

-- A faxina: o limite maior é de um dia; sete dias dão folga para investigar um
-- pico de abuso sem guardar nada que identifique alguém.
create or replace function public.walkstamp_convite_faxina()
returns int language plpgsql security definer set search_path to 'public'
as $$
declare n int;
begin
  delete from public.convite_envio where criado_em < now() - interval '7 days';
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.walkstamp_convite_faxina() from public, anon, authenticated;
grant execute on function public.walkstamp_convite_faxina() to service_role;

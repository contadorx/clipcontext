-- ============================================================================
-- Créditos de IA: as funções que o app chama e que NUNCA existiram no banco.
--
-- A fumaça de 14/08 encontrou: `reservar_credito_ia` e `estornar_credito_ia`
-- NÃO EXISTEM. Consequência em produção HOJE: a análise do mês e o assistente
-- devolvem erro na primeira chamada — o `.rpc()` volta com "function does not
-- exist" e a rota responde 500. O código dessas funções vivia num arquivo fora
-- do git que nunca foi aplicado; este arquivo as define do zero, a partir do
-- contrato que o código já usa:
--
--   reservar_credito_ia(p_escritorio, p_empresa, p_competencia, p_teto_dia)
--     → { ok, motivo, saldo, uso_id }   (atômica: teto diário + saldo + débito)
--   estornar_credito_ia(p_escritorio, p_uso_id)
--     → { ok }                          (devolve o crédito se a IA falhou)
--   add_creditos_ia(p_escritorio, p_n)
--     → void                            (incremento; só o webhook chama)
--
-- O saldo é `escritorios.creditos_ia` (o app já lê essa coluna na Carteira e
-- na análise). Rodar este arquivo INTEIRO no SQL Editor. Idempotente.
--
-- ⚠️ REVISÃO 2 (14/08, depois de aplicado): as duas funções levantam EXCEÇÃO em
-- vez de devolver `{ok:false}` nos casos que não são resposta de negócio
-- (sem permissão, uso inexistente). Motivo: o app confere `est.error` — como
-- `.rpc()` não lança, devolver `ok:false` fazia um estorno FALHO passar por
-- bem-sucedido, e o cliente perdia o crédito em silêncio. Exatamente a falha
-- que o comentário em `analise-mes/route.ts` existe para impedir, contornada
-- pela minha primeira versão. Quem já rodou a v1: **rode de novo** (é
-- `create or replace`, não perde dado).
--
-- `teto` e `saldo` continuam sendo `{ok:false}`: são respostas de negócio, com
-- tela própria (429 e 402). Exceção é para o que não deveria acontecer.
-- ============================================================================

-- o saldo (se a coluna já existe, não faz nada)
alter table public.escritorios
  add column if not exists creditos_ia integer not null default 0;

-- um uso por análise: é daqui que saem o teto diário e o estorno
create table if not exists public.creditos_ia_usos (
  id uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references public.escritorios(id) on delete cascade,
  empresa_id uuid,
  competencia text,
  usado_em timestamptz not null default now(),
  estornado_em timestamptz
);

create index if not exists creditos_ia_usos_teto_ix
  on public.creditos_ia_usos (escritorio_id, usado_em desc);

-- RLS ligada sem policy: como em creditos_ia_eventos, só a service role e as
-- funções security definer abaixo enxergam. Usuário não mexe em crédito direto.
alter table public.creditos_ia_usos enable row level security;

-- ── reservar: decide e debita numa transação só ─────────────────────────────
create or replace function public.reservar_credito_ia(
  p_escritorio uuid,
  p_empresa uuid,
  p_competencia text,
  p_teto_dia int
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_saldo int;
  v_hoje int;
  v_uso uuid;
begin
  -- security definer atravessa RLS; a checagem de pertencimento é daqui.
  -- Sem ela, qualquer autenticado debitaria crédito de qualquer escritório.
  if not exists (
    select 1 from membros
    where user_id = auth.uid() and escritorio_id = p_escritorio
  ) then
    -- exceção, e não `{ok:false}`: o app traduz todo `ok:false` como "você está
    -- sem créditos" (402). Dizer isso a quem não é membro do escritório é uma
    -- mensagem falsa que gera chamado de suporte sem saída. Isto aqui não é
    -- resposta de negócio, é anomalia — e anomalia tem de aparecer no log.
    raise exception 'sem permissão sobre este escritório' using errcode = '42501';
  end if;

  -- trava a linha do escritório: duas análises simultâneas não debitam juntas
  select creditos_ia into v_saldo
  from escritorios where id = p_escritorio
  for update;

  if v_saldo is null then
    raise exception 'escritório % não encontrado', p_escritorio using errcode = 'P0002';
  end if;

  select count(*) into v_hoje
  from creditos_ia_usos
  where escritorio_id = p_escritorio
    and usado_em >= date_trunc('day', now())
    and estornado_em is null;

  if v_hoje >= p_teto_dia then
    return jsonb_build_object('ok', false, 'motivo', 'teto');
  end if;

  if v_saldo <= 0 then
    return jsonb_build_object('ok', false, 'motivo', 'saldo', 'saldo', 0);
  end if;

  update escritorios set creditos_ia = creditos_ia - 1 where id = p_escritorio;

  insert into creditos_ia_usos (escritorio_id, empresa_id, competencia)
  values (p_escritorio, p_empresa, p_competencia)
  returning id into v_uso;

  return jsonb_build_object('ok', true, 'saldo', v_saldo - 1, 'uso_id', v_uso);
end;
$$;

-- ── estornar: devolve o crédito quando a IA falhou depois do débito ─────────
create or replace function public.estornar_credito_ia(
  p_escritorio uuid,
  p_uso_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ok int;
begin
  /*
    Aqui a exceção não é preciosismo: é a única forma de o app saber.

    O chamador (`analise-mes` e `assistente-financeiro`) confere `est.error` —
    e `.rpc()` NÃO lança por conta própria. Devolvendo `{ok:false}`, um estorno
    que não aconteceu chegava ao app como sucesso: o cliente pagou pela análise,
    não recebeu, e o crédito não voltou. Sem rastro. É a mesma armadilha do
    `const { data }` que já custou caro neste projeto, do lado do banco.
  */
  if not exists (
    select 1 from membros
    where user_id = auth.uid() and escritorio_id = p_escritorio
  ) then
    raise exception 'sem permissão sobre este escritório' using errcode = '42501';
  end if;

  -- só estorna uma vez: o WHERE em estornado_em é a trava de duplo estorno
  update creditos_ia_usos
     set estornado_em = now()
   where id = p_uso_id
     and escritorio_id = p_escritorio
     and estornado_em is null;
  get diagnostics v_ok = row_count;

  if v_ok = 0 then
    raise exception 'uso % não encontrado ou já estornado — crédito NÃO devolvido', p_uso_id
      using errcode = 'P0002';
  end if;

  update escritorios set creditos_ia = creditos_ia + 1 where id = p_escritorio;
  return jsonb_build_object('ok', true);
end;
$$;

-- ── add: incremento puro; só o webhook (service role) chama ─────────────────
create or replace function public.add_creditos_ia(
  p_escritorio uuid,
  p_n int
) returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update escritorios set creditos_ia = creditos_ia + p_n where id = p_escritorio;
$$;

-- ── grants: quem chama cada uma ─────────────────────────────────────────────
-- create function concede EXECUTE a PUBLIC por padrão; revogar primeiro.
revoke execute on function public.reservar_credito_ia(uuid, uuid, text, int) from public, anon;
revoke execute on function public.estornar_credito_ia(uuid, uuid) from public, anon;
revoke execute on function public.add_creditos_ia(uuid, int) from public, anon, authenticated;

grant execute on function public.reservar_credito_ia(uuid, uuid, text, int) to authenticated, service_role;
grant execute on function public.estornar_credito_ia(uuid, uuid) to authenticated, service_role;
grant execute on function public.add_creditos_ia(uuid, int) to service_role;

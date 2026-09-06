-- "REPORT-ONLY" SEM ENDEREÇO DE RELATÓRIO NÃO É MEIA MEDIDA — É MEDIDA NENHUMA
--
-- A CSP entrou em `Report-Only` em 24/08, com a intenção escrita no
-- `next.config.mjs`: "ela não barra nada: o navegador confere e AVISA". Medido
-- em 02/09: **não existe `report-uri` nem `report-to` na política.** O navegador
-- confere, monta o aviso e joga fora, porque não há para quem mandar.
--
-- Uma semana de produção que deveria ter virado dados virou trabalho de CPU nos
-- navegadores dos outros. E a segunda metade da DEC-12 — travar — dependia
-- justamente desses dados para não ser aposta: a régua `csp.mjs` não alcança o
-- caminho da transcrição, porque a CDN do modelo não é acessível da máquina
-- onde ela roda.
--
-- ---- POR QUE AGREGADO, E NÃO UMA LINHA POR AVISO ----
--
-- Um endereço de relatório é aberto por natureza: quem escreve nele é o
-- navegador de qualquer pessoa, sem sessão. Guardar um registro por aviso é um
-- canal de escrita ilimitada com o nosso nome — e um site que embuta o nosso
-- numa moldura pode gerar milhares por minuto.
--
-- Então a chave é (diretiva, o que foi barrado, de onde), e o que cresce é um
-- CONTADOR. Mil avisos iguais viram uma linha com `vezes = 1000`, que é também
-- a forma em que eles são úteis: o que se quer saber é O QUE falta na política,
-- não quantas vezes o mesmo navegador reclamou.

create table if not exists walkstamp.csp_violacao (
  id          bigserial primary key,
  diretiva    text not null,
  barrado     text not null,
  origem      text not null default '',
  amostra     text not null default '',
  vezes       int  not null default 1,
  primeira_em timestamptz not null default now(),
  ultima_em   timestamptz not null default now(),
  unique (diretiva, barrado, origem)
);

create index if not exists csp_violacao_ultima_idx on walkstamp.csp_violacao (ultima_em desc);

-- Ninguém lê isto pelo navegador. Nem para contar.
alter table walkstamp.csp_violacao enable row level security;

comment on table walkstamp.csp_violacao is
  'Avisos da CSP, agregados por (diretiva, barrado, origem). O contador cresce; '
  'a linha não se multiplica. É a lista do que falta na política antes de travá-la.';

-- ---------------------------------------------------------------------------
-- Registrar. Os tetos são impostos aqui, e não em quem chama: o corpo de um
-- aviso é escrito pelo navegador de um desconhecido, e um campo de dois
-- megabytes não pode virar uma linha de dois megabytes.
-- ---------------------------------------------------------------------------
create or replace function walkstamp.csp_registrar(
  p_diretiva text, p_barrado text, p_origem text, p_amostra text)
returns void language plpgsql security definer
set search_path to 'walkstamp','public' as $$
declare
  d text := left(btrim(coalesce(p_diretiva,'')), 60);
  b text := left(btrim(coalesce(p_barrado,'')), 400);
  o text := left(btrim(coalesce(p_origem,'')), 400);
  a text := left(btrim(coalesce(p_amostra,'')), 200);
begin
  if d = '' or b = '' then return; end if;

  insert into walkstamp.csp_violacao (diretiva, barrado, origem, amostra)
  values (d, b, o, a)
  on conflict (diretiva, barrado, origem) do update
    set vezes = walkstamp.csp_violacao.vezes + 1,
        ultima_em = now(),
        /* A amostra da PRIMEIRA vez é a que fica: ela é o trecho barrado, e o
           primeiro costuma ser o representativo. Sobrescrever a cada aviso faria
           o campo variar sem acrescentar nada. */
        amostra = coalesce(nullif(walkstamp.csp_violacao.amostra,''), excluded.amostra);
end $$;

create or replace function public.walkstamp_csp_registrar(
  p_diretiva text, p_barrado text, p_origem text, p_amostra text)
returns void language sql security definer set search_path to 'public','walkstamp'
as $$ select walkstamp.csp_registrar(p_diretiva, p_barrado, p_origem, p_amostra) $$;

-- ---------------------------------------------------------------------------
-- Ler: só o painel, e já ordenado pelo que mais aparece — que é a ordem em que
-- se decide o que a política ainda precisa deixar passar.
-- ---------------------------------------------------------------------------
create or replace function walkstamp.csp_lista(p_limite int default 100)
returns jsonb language sql security definer
set search_path to 'walkstamp','public' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'diretiva', v.diretiva, 'barrado', v.barrado, 'origem', v.origem,
           'amostra', v.amostra, 'vezes', v.vezes,
           'primeira_em', v.primeira_em, 'ultima_em', v.ultima_em)
         order by v.vezes desc, v.ultima_em desc), '[]'::jsonb)
  from (select * from walkstamp.csp_violacao
         order by vezes desc, ultima_em desc
         limit greatest(1, least(coalesce(p_limite,100), 500))) v;
$$;

create or replace function public.walkstamp_csp_lista(p_limite int default 100)
returns jsonb language sql security definer set search_path to 'public','walkstamp'
as $$ select walkstamp.csp_lista(p_limite) $$;

-- O navegador escreve pela NOSSA rota, que limita por IP. Nem a de escrever
-- nem a de ler ficam abertas: sem isto, o contador vira um campo de texto que
-- qualquer um enche.
revoke all on function public.walkstamp_csp_registrar(text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.walkstamp_csp_registrar(text, text, text, text) to service_role;
revoke all on function public.walkstamp_csp_lista(int) from public, anon, authenticated;
grant execute on function public.walkstamp_csp_lista(int) to service_role;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname like 'walkstamp_csp%'
              and (has_function_privilege('anon', p.oid, 'EXECUTE')
                or has_function_privilege('authenticated', p.oid, 'EXECUTE'))
  loop
    raise exception 'a função da CSP ficou aberta para o navegador: %', f.sig;
  end loop;
end $$;

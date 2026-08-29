-- OS LIMITADORES DE CHAMADO ESTAVAM KEYED NA VÍTIMA
--
-- Medido em 29/08, nas duas funções que o navegador alcança com a chave pública:
--
--   ver:    tentar('ver:'    || md5(email), 10, 10 min)
--   abrir:  tentar('recado:' || md5(email),  5,  1 min)
--
-- A chave do limitador é o e-mail de QUEM É PROTEGIDO, e não de quem chama.
-- Quem souber o seu endereço queima a sua cota e **te tranca fora do seu
-- próprio chamado** — indefinidamente, chamando uma função anônima dez vezes a
-- cada dez minutos, sem pagar nada por isso. A proteção virou arma.
--
-- E o balde anônimo era UM SÓ para o mundo inteiro:
--
--   abrir anônimo:  tentar('recado:anonimo', 10, 1 min)
--
-- Dez por minuto de um ator sozinho, e ninguém no planeta abre chamado anônimo.
--
-- ================= OS DOIS CONSERTOS, E POR QUE SÃO DIFERENTES =================
--
-- **LER: o limitador só gasta quando ERRA.** Confere-se o par (número, e-mail)
-- primeiro; se ele bate, devolve e não toca no contador. Quem tem os dois
-- certos nunca é bloqueado pelos palpites de outro, e quem chuta só acumula
-- erro — que é o que o limitador existe para contar. O teto continua o mesmo.
--
-- **ABRIR: o limite sai do banco e vai para a nossa rota.** O banco não sabe
-- quem chamou: a ferramenta fala direto com o Supabase usando a chave pública,
-- e ali não há IP. Nenhuma chave que o banco possa inventar é do ATOR — só do
-- alvo. Então o `walkstamp_recado` deixa de ser chamável pelo navegador e passa
-- a ser chamado por `/api/chamado`, que tem IP e limita por ele, com hash e sal,
-- do mesmo jeito que o convite já faz.
--
-- O que fica aqui é o disjuntor de 300/minuto, que é global de propósito: ele
-- não protege ninguém de ninguém, protege o banco de um dia ruim.

create or replace function walkstamp.chamado_ver(p_numero text, p_email text)
returns jsonb language plpgsql security definer
set search_path to 'walkstamp','public' as $$
declare
  r walkstamp.recado%rowtype;
  em text := lower(btrim(coalesce(p_email,'')));
begin
  /* A BUSCA VEM PRIMEIRO, e é essa a mudança inteira. Antes o limitador corria
     antes da consulta, então o dono do chamado pagava pelos erros dos outros. */
  select * into r from walkstamp.recado
   where upper(btrim(coalesce(p_numero,''))) = upper(numero)
     and email is not null
     and email = em;

  if found then
    /* Acertou o par: devolve, e o contador nem é tocado. */
    return jsonb_build_object(
      'numero', r.numero, 'tipo', r.tipo, 'status', r.status,
      'texto', r.texto, 'resposta', r.resposta,
      'criado_em', r.criado_em, 'respondido_em', r.respondido_em);
  end if;

  /* Errou. AGORA o limitador gasta — e a resposta é a mesma nos dois casos de
     erro (não achou / estourou), para não contar de fora quantos palpites
     faltam nem revelar que aquele par existe. */
  if not walkstamp.tentar('ver:' || md5(em), 10, interval '10 minutes') then
    return jsonb_build_object('erro','nao_achei');
  end if;
  return jsonb_build_object('erro','nao_achei');
end $$;

comment on function walkstamp.chamado_ver(text, text) is
  'Só gasta o limitador quando o par (número, e-mail) NÃO bate. Antes ele '
  'gastava antes de olhar, e quem soubesse o e-mail alheio trancava o dono.';

-- ---------------------------------------------------------------------------
-- Abrir: os dois limitadores por e-mail saem, porque quem limita agora é a
-- rota, por IP. O disjuntor global fica.
-- ---------------------------------------------------------------------------
create or replace function walkstamp.recado_novo(
  p_tipo text, p_texto text, p_email text, p_nota integer,
  p_idioma text, p_cenario text, p_origem text, p_diag text)
returns text language plpgsql security definer
set search_path to 'walkstamp','public' as $$
declare
  txt text := btrim(coalesce(p_texto, ''));
  em  text := lower(btrim(coalesce(p_email, '')));
  valido boolean;
  num text;
begin
  if length(txt) < 2 then return 'vazio'; end if;

  valido := em ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$';

  /* O DISJUNTOR, e ele é global de propósito: não protege ninguém de ninguém,
     protege o banco de um dia ruim. Os limitadores POR PESSOA saíram daqui —
     eles eram keyed no alvo, e quem limita por ator agora é a `/api/chamado`,
     que tem IP. */
  if (select count(*) from walkstamp.recado
       where criado_em > now() - interval '1 minute') >= 300 then
    return 'muitos';
  end if;

  num := 'WS-' || lpad(nextval('walkstamp.chamado_seq')::text, 4, '0');

  insert into walkstamp.recado (numero, tipo, texto, email, nota, idioma, cenario, origem, diagnostico)
  values (num,
          case when p_tipo in ('ideia','elogio','problema') then p_tipo else 'problema' end,
          left(txt, 4000),
          case when valido then em else null end,
          case when p_nota between 0 and 10 then p_nota else null end,
          left(coalesce(p_idioma,''), 8), left(coalesce(p_cenario,''), 40),
          case when p_origem = 'site' then 'site' else 'app' end,
          left(coalesce(p_diag,''), 12000));
  return num;
end $$;

-- ---------------------------------------------------------------------------
-- O limite por ator, para a rota chamar. Encapsulado: a rota manda o hash e
-- recebe sim ou não, sem escolher tetos — números soltos em quem chama são
-- números que divergem.
-- ---------------------------------------------------------------------------
create or replace function walkstamp.chamado_pode(p_ator text)
returns boolean language plpgsql security definer
set search_path to 'walkstamp','public' as $$
begin
  if coalesce(btrim(p_ator),'') = '' then return false; end if;
  /* Cinco por minuto e vinte por hora: o primeiro corta a rajada, o segundo
     corta a insistência. Quem abre chamado de verdade não encosta em nenhum. */
  if not walkstamp.tentar('chamado:m:' || p_ator, 5, interval '1 minute') then
    return false;
  end if;
  return walkstamp.tentar('chamado:h:' || p_ator, 20, interval '1 hour');
end $$;

create or replace function public.walkstamp_chamado_pode(p_ator text)
returns boolean language sql security definer set search_path to 'public','walkstamp'
as $$ select walkstamp.chamado_pode(p_ator) $$;

-- ---------------------------------------------------------------------------
-- E O NAVEGADOR PERDE A PORTA DE ABRIR. É esta linha que fecha o buraco: sem
-- ela, os limitadores da rota seriam contornáveis chamando o Supabase direto.
-- ---------------------------------------------------------------------------
revoke all on function public.walkstamp_recado(text, text, text, integer, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.walkstamp_recado(text, text, text, integer, text, text, text, text)
  to service_role;

revoke all on function public.walkstamp_chamado_pode(text) from public, anon, authenticated;
grant execute on function public.walkstamp_chamado_pode(text) to service_role;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public'
              and p.proname in ('walkstamp_recado','walkstamp_chamado_pode')
              and (has_function_privilege('anon', p.oid, 'EXECUTE')
                or has_function_privilege('authenticated', p.oid, 'EXECUTE'))
  loop
    raise exception 'continua aberta para o navegador: %', f.sig;
  end loop;
end $$;

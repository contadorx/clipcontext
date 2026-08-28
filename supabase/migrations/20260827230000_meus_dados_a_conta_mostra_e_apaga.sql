/* A conta passa a MOSTRAR o que o servidor guarda, e a APAGAR quando pedirem.
 *
 * A DEC-1 foi decidida no caminho A — "nada do seu conteúdo sai sem um gesto
 * seu", com a matriz de exceções nomeada — e a razão de quem decidiu foi que a
 * conta paga vai receber informação de propósito, para as features. A DEC-3
 * fechou junto, também em A: o servidor guarda o que a feature precisa, e a
 * conta mostra o quê.
 *
 * O que torna A defensável não é a tela que lista. É o apagar funcionar. Uma
 * tela que só lista é a mesma promessa de antes, com mais palavras.
 *
 * TRÊS COISAS AQUI.
 *
 * 1. `prazos()` — os prazos de retenção passam a existir UMA vez. Eles estavam
 *    escritos dentro do `expurgo` como três `declare`, e a política de
 *    privacidade repetia os mesmos números em prosa, em cinco idiomas. Duas
 *    listas paralelas com a mesma verdade: mudar uma e esquecer a outra é
 *    questão de tempo, e a que ninguém confere é a que vira mentira. Agora o
 *    expurgo lê daqui, e a tela da conta lê daqui.
 *
 * 2. `meus_dados(email)` — quanto de cada coisa existe no servidor para aquela
 *    pessoa, mais o que NÃO sai quando ela apaga, e por quê. Contagem, não
 *    conteúdo: a tela não precisa reler os roteiros para dizer que há sete.
 *
 * 3. `apagar_meus_dados(email, confirmacao)` — apaga o que é dela. Exige a
 *    palavra de confirmação para não ser um clique errado, e devolve o que
 *    apagou. Os anexos vão para `anexo_orfao` ANTES das linhas sumirem, que é
 *    o caminho que o `roteiro_apagar` já usa — depois do delete não haveria de
 *    onde tirar o caminho do arquivo no balde.
 *
 * O QUE O APAGAR NÃO TIRA, e a tela diz isso na cara:
 *   - a FATURA, porque guardar documento fiscal é obrigação legal, não escolha
 *     nossa, e ela não descreve o trabalho de ninguém — descreve a venda;
 *   - a linha do USUÁRIO e do CLIENTE, enquanto a assinatura estiver de pé:
 *     apagar quem assina no meio da assinatura quebra a cobrança. Quem quer
 *     sumir inteiro cancela, e aí o expurgo leva tudo no prazo da conta;
 *   - a CONFIG e o DOMÍNIO do time, que são da empresa e não da pessoa — quem
 *     apaga isso é o administrador, na tela do time;
 *   - os MARCOS DE USO, que não têm e-mail nem coluna que ligue a ninguém:
 *     não são dado dela, e por isso não há o que apagar.
 */

create or replace function walkstamp.prazos()
returns jsonb language sql immutable
set search_path to 'walkstamp','public' as $$
  select jsonb_build_object(
    'conta_dias',    90,
    'lista_meses',   24,
    'evento_meses',  18);
$$;

comment on function walkstamp.prazos() is
  'Prazos de retenção. Fonte única: o expurgo lê daqui e a conta mostra daqui.';

/* O expurgo passa a ler os prazos em vez de guardar cópias deles. O corpo é o
   mesmo de 20260816210907 — só os três `declare` mudaram de origem. */
create or replace function walkstamp.expurgo(p_seco boolean default true)
returns jsonb language plpgsql security definer
set search_path to 'walkstamp','public' as $$
declare
  p jsonb := walkstamp.prazos();
  DIAS_CONTA   int := (p->>'conta_dias')::int;
  MESES_LISTA  int := (p->>'lista_meses')::int;
  MESES_EVENTO int := (p->>'evento_meses')::int;
  alvos bigint[];
  r jsonb;
  n_roteiros int := 0; n_casos int := 0; n_usuarios int := 0; n_modelos int := 0;
  n_config int := 0; n_dominios int := 0; n_emissoes int := 0; n_recados int := 0;
  n_anexos int := 0; n_lista int := 0; n_eventos int := 0;
begin
  select coalesce(array_agg(id), '{}') into alvos
    from walkstamp.cliente
   where not ativo and encerrado_em is not null
     and encerrado_em < now() - make_interval(days => DIAS_CONTA)
     and expurgado_em is null;

  select count(*) into n_roteiros from walkstamp.roteiro r
    where r.cliente_id = any(alvos)
       or lower(r.dono) in (select lower(u.email) from walkstamp.usuario u where u.cliente_id = any(alvos));
  select count(*) into n_casos from walkstamp.roteiro_caso c
    join walkstamp.roteiro r on r.id = c.roteiro_id
   where r.cliente_id = any(alvos)
      or lower(r.dono) in (select lower(u.email) from walkstamp.usuario u where u.cliente_id = any(alvos));
  select count(*) into n_anexos from walkstamp.roteiro_caso c
    join walkstamp.roteiro r on r.id = c.roteiro_id
   where c.anexo_caminho is not null
     and (r.cliente_id = any(alvos)
       or lower(r.dono) in (select lower(u.email) from walkstamp.usuario u where u.cliente_id = any(alvos)));
  select count(*) into n_usuarios from walkstamp.usuario where cliente_id = any(alvos);
  select count(*) into n_modelos  from walkstamp.modelo_doc where cliente_id = any(alvos);
  select count(*) into n_config   from walkstamp.config where cliente_id = any(alvos);
  select count(*) into n_dominios from walkstamp.dominio where cliente_id = any(alvos);
  select count(*) into n_emissoes from walkstamp.emissao where cliente_id = any(alvos);
  select count(*) into n_recados  from walkstamp.recado
   where lower(email) in (select lower(u.email) from walkstamp.usuario u where u.cliente_id = any(alvos));
  select count(*) into n_lista from walkstamp.interesse
   where criado_em < now() - make_interval(months => MESES_LISTA);
  select count(*) into n_eventos from walkstamp.evento
   where criado_em < now() - make_interval(months => MESES_EVENTO);

  r := jsonb_build_object(
    'seco', p_seco, 'contas', coalesce(array_length(alvos,1), 0),
    'roteiros', n_roteiros, 'casos', n_casos, 'anexos', n_anexos,
    'usuarios', n_usuarios, 'modelos', n_modelos, 'config', n_config,
    'dominios', n_dominios, 'emissoes', n_emissoes, 'chamados', n_recados,
    'lista_de_aviso', n_lista, 'marcos_de_uso', n_eventos,
    'faturas_mantidas', (select count(*) from walkstamp.fatura where cliente_id = any(alvos)));

  if p_seco then
    return r || jsonb_build_object('faxina', '[]'::jsonb);
  end if;

  if coalesce(array_length(alvos,1), 0) > 0 then
    insert into walkstamp.anexo_orfao (caminho)
    select c.anexo_caminho from walkstamp.roteiro_caso c
      join walkstamp.roteiro rr on rr.id = c.roteiro_id
     where c.anexo_caminho is not null
       and (rr.cliente_id = any(alvos)
         or lower(rr.dono) in (select lower(u.email) from walkstamp.usuario u where u.cliente_id = any(alvos)));

    delete from walkstamp.recado
     where lower(email) in (select lower(u.email) from walkstamp.usuario u where u.cliente_id = any(alvos));
    delete from walkstamp.roteiro
     where cliente_id = any(alvos)
        or lower(dono) in (select lower(u.email) from walkstamp.usuario u where u.cliente_id = any(alvos));
    delete from walkstamp.emissao   where cliente_id = any(alvos);
    delete from walkstamp.modelo_doc where cliente_id = any(alvos);
    delete from walkstamp.config     where cliente_id = any(alvos);
    delete from walkstamp.dominio    where cliente_id = any(alvos);
    delete from walkstamp.usuario    where cliente_id = any(alvos);

    update walkstamp.cliente
       set nome = 'conta encerrada #' || id,
           documento = null,
           expurgado_em = now()
     where id = any(alvos);
  end if;

  delete from walkstamp.interesse where criado_em < now() - make_interval(months => MESES_LISTA);
  delete from walkstamp.evento    where criado_em < now() - make_interval(months => MESES_EVENTO);

  insert into walkstamp.expurgo_log (seco, relatorio) values (false, r);
  return r || jsonb_build_object('faxina', walkstamp.anexo_faxina_lista(100));
end $$;

/* ---------------------------------------------------------------------------
   O que existe aqui dentro para esta pessoa.
   Contagem, não conteúdo. `apagavel` é o que o botão leva; `fica` é o que ele
   não leva, com o porquê — a tela mostra os dois lados, ou o botão mente.
--------------------------------------------------------------------------- */
create or replace function walkstamp.meus_dados(p_email text)
returns jsonb language plpgsql security definer
set search_path to 'walkstamp','public' as $$
declare
  e text := lower(btrim(coalesce(p_email,'')));
  cid bigint;
  n_roteiros int; n_casos int; n_anexos int; n_modelos int; n_chamados int;
  n_faturas int; n_emissoes int;
begin
  if e = '' then return jsonb_build_object('erro','sem_email'); end if;

  select u.cliente_id into cid from walkstamp.usuario u where lower(u.email) = e limit 1;

  select count(*) into n_roteiros from walkstamp.roteiro r where lower(r.dono) = e;
  select count(*) into n_casos    from walkstamp.roteiro_caso c
    join walkstamp.roteiro r on r.id = c.roteiro_id where lower(r.dono) = e;
  select count(*) into n_anexos   from walkstamp.roteiro_caso c
    join walkstamp.roteiro r on r.id = c.roteiro_id
   where lower(r.dono) = e and c.anexo_caminho is not null;
  select count(*) into n_modelos  from walkstamp.modelo_doc m where lower(coalesce(m.dono_email,'')) = e;
  select count(*) into n_chamados from walkstamp.recado x where lower(coalesce(x.email,'')) = e;
  select count(*) into n_faturas  from walkstamp.fatura f where cid is not null and f.cliente_id = cid;
  select count(*) into n_emissoes from walkstamp.emissao x where lower(coalesce(x.email,'')) = e;

  return jsonb_build_object(
    'email', e,
    'prazos', walkstamp.prazos(),
    'apagavel', jsonb_build_object(
      'roteiros', n_roteiros, 'casos', n_casos, 'anexos', n_anexos,
      'modelos', n_modelos, 'chamados', n_chamados),
    'fica', jsonb_build_object(
      'faturas', n_faturas, 'emissoes', n_emissoes),
    'total_apagavel', n_roteiros + n_casos + n_modelos + n_chamados);
end $$;

/* ---------------------------------------------------------------------------
   Apagar. A confirmação não é enfeite: este botão não tem desfazer.
--------------------------------------------------------------------------- */
create or replace function walkstamp.apagar_meus_dados(p_email text, p_confirmacao text)
returns jsonb language plpgsql security definer
set search_path to 'walkstamp','public' as $$
declare
  e text := lower(btrim(coalesce(p_email,'')));
  c text := lower(btrim(coalesce(p_confirmacao,'')));
  antes jsonb;
  n_roteiros int; n_modelos int; n_chamados int;
begin
  if e = '' then return jsonb_build_object('erro','sem_email'); end if;
  /* A pessoa digita o próprio e-mail. É a confirmação que ela não erra por
     distração e não acerta por acidente. */
  if c <> e then return jsonb_build_object('erro','confirmacao_nao_bate'); end if;

  antes := walkstamp.meus_dados(e);

  /* O bilhete do balde vai primeiro: depois do delete não há mais caminho. */
  insert into walkstamp.anexo_orfao (caminho)
  select c2.anexo_caminho from walkstamp.roteiro_caso c2
    join walkstamp.roteiro r on r.id = c2.roteiro_id
   where lower(r.dono) = e and c2.anexo_caminho is not null;

  delete from walkstamp.roteiro where lower(dono) = e;
  get diagnostics n_roteiros = row_count;
  delete from walkstamp.modelo_doc where lower(coalesce(dono_email,'')) = e;
  get diagnostics n_modelos = row_count;
  delete from walkstamp.recado where lower(coalesce(email,'')) = e;
  get diagnostics n_chamados = row_count;

  return jsonb_build_object(
    'ok', true,
    'apagados', jsonb_build_object(
      'roteiros', n_roteiros, 'modelos', n_modelos, 'chamados', n_chamados,
      'casos', antes->'apagavel'->'casos', 'anexos', antes->'apagavel'->'anexos'),
    'depois', walkstamp.meus_dados(e),
    'faxina', walkstamp.anexo_faxina_lista(100));
end $$;

/* ---------------------------------------------------------------------------
   As portas públicas. O e-mail chega por parâmetro: se o navegador puder
   chamar, qualquer um digita o e-mail alheio e LÊ — ou APAGA — o que é dos
   outros. O `revoke from public` sozinho não fecha, porque o Supabase deixa um
   `alter default privileges` armado que dá execute nominal para anon e
   authenticated. Por isso o revoke nomeia os três, e o bloco no fim confere.
--------------------------------------------------------------------------- */
create or replace function public.walkstamp_meus_dados(p_email text)
returns jsonb language sql security definer set search_path to 'walkstamp','public'
as $$ select walkstamp.meus_dados(p_email) $$;

create or replace function public.walkstamp_apagar_meus_dados(p_email text, p_confirmacao text)
returns jsonb language sql security definer set search_path to 'walkstamp','public'
as $$ select walkstamp.apagar_meus_dados(p_email, p_confirmacao) $$;

create or replace function public.walkstamp_prazos()
returns jsonb language sql security definer set search_path to 'walkstamp','public'
as $$ select walkstamp.prazos() $$;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public'
              and p.proname in ('walkstamp_meus_dados','walkstamp_apagar_meus_dados','walkstamp_prazos')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;

do $$
declare abertas text;
begin
  select string_agg(p.proname, ', ' order by p.proname) into abertas
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('walkstamp_meus_dados','walkstamp_apagar_meus_dados','walkstamp_prazos')
     and ( has_function_privilege('anon',          p.oid, 'execute')
        or has_function_privilege('authenticated', p.oid, 'execute') );
  if abertas is not null then
    raise exception 'estas funcoes continuam abertas para o navegador: %', abertas;
  end if;
end $$;

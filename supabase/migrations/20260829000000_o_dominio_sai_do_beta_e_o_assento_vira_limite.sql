-- O DOMÍNIO SAI DO BETA — e, no caminho, o assento vira limite de verdade
--
-- A linha `dominioAutomatico` do catálogo estava marcada `beta` por um motivo
-- honesto: a entrada automática por domínio FUNCIONA, mas quem cadastrava o
-- domínio éramos nós, na mão, por chamado. Não era self-service, e o selo dizia
-- isso. Este arquivo tira o selo abrindo o cadastro para quem administra.
--
-- ================= O QUE A MEDIÇÃO MOSTROU NO CAMINHO =================
--
-- Abrir o cadastro obrigou a olhar o que ele destrava, e ali estava um buraco
-- que ninguém tinha medido: **a entrada por domínio não olhava assentos.** O
-- `plano_de` concedia o plano do cliente a QUALQUER e-mail daquele domínio, sem
-- contar quantos já estavam dentro. Quem comprasse 3 assentos podia dar o plano
-- a 500 pessoas — e o número no cartão Team era decoração.
--
-- Enquanto o cadastro passava por nós, isso era um risco que a gente via chegar.
-- Self-service, vira o desenho do produto. Então as duas coisas andam juntas
-- neste arquivo, e é de propósito: entregar a primeira sem a segunda seria
-- transformar um descuido em funcionalidade.
--
-- ================= QUEM PODE REIVINDICAR UM DOMÍNIO =================
--
-- **Só o domínio do próprio e-mail.** Quem entrou como `leandro@empresa.com`
-- reivindica `empresa.com`, e mais nada. Não é prova de posse como um registro
-- de DNS seria, mas é o único sinal que existe sem sair para a rede: a pessoa
-- controla um endereço naquele domínio, porque foi por ele que o link mágico
-- chegou.
--
-- Somado a duas recusas que não são detalhe:
--
--   1. PROVEDOR PÚBLICO NUNCA. Reivindicar `gmail.com` daria o plano pago a
--      todo mundo que tem Gmail. É o pior caso possível desta funcionalidade, e
--      ele é barato de fechar.
--   2. DOMÍNIO JÁ REIVINDICADO POR OUTRO CLIENTE também não — com recado, e não
--      com erro de banco. Um domínio liberado (`ativo = false`) pode ser
--      reivindicado por quem tiver endereço nele: soltar é diferente de trancar.

-- ---------------------------------------------------------------------------
-- Os provedores públicos. Casado por PREFIXO ancorado, e não por lista de
-- domínios inteiros: `yahoo.co.jp` e `yahoo.com.br` são o mesmo provedor, e uma
-- lista de nomes completos envelhece em silêncio deixando passar a variante que
-- ninguém lembrou.
--
-- Âncora no início de propósito: `mail.empresa.com` NÃO casa com `^mail\.`
-- porque a regra pede o domínio inteiro começando ali — o que casa é
-- `mail.com`. Errar para o lado de recusar um domínio legítimo custa um
-- chamado; errar para o outro custa o produto.
-- ---------------------------------------------------------------------------
create or replace function walkstamp.dominio_publico(p_dominio text)
returns boolean language sql immutable
set search_path to 'walkstamp','public' as $$
  select lower(btrim(coalesce(p_dominio,''))) ~
    ('^('
     || 'gmail|googlemail|'
     || 'hotmail|outlook|live|msn|passport|'
     || 'yahoo|ymail|rocketmail|'
     || 'icloud|me|mac|'
     || 'proton|protonmail|pm|'
     || 'aol|gmx|web|freenet|t-online|'
     || 'zoho|yandex|mail|inbox|fastmail|hushmail|tutanota|'
     || 'qq|163|126|sina|naver|daum|hanmail|'
     || 'uol|bol|terra|ig|globo|r7|oi|zipmail|'
     || 'orange|wanadoo|laposte|free|sfr|libero|virgilio|alice|tiscali|'
     || 'seznam|bluewin|sapo|telenet|ziggo|xs4all|'
     || 'example|test|localhost'
     || ')\.');
$$;

comment on function walkstamp.dominio_publico(text) is
  'Provedor de e-mail público, ou domínio de exemplo. Ninguém reivindica um '
  'destes: dar o plano a quem tem Gmail é dar o plano ao mundo.';

-- ---------------------------------------------------------------------------
-- Reivindicar e soltar. Devolve o painel, como as outras ações de time.
-- ---------------------------------------------------------------------------
create or replace function walkstamp.time_dominio(p_admin text, p_dominio text, p_remover boolean)
returns jsonb language plpgsql security definer
set search_path to 'walkstamp','public' as $$
declare
  a   text := lower(btrim(coalesce(p_admin,'')));
  d   text := lower(btrim(coalesce(p_dominio,'')));
  cid bigint;
  dono bigint;
  n   int;
begin
  select u.cliente_id into cid from walkstamp.usuario u
   where u.email = a and u.papel = 'admin' and u.cliente_id is not null;
  if cid is null then return jsonb_build_object('erro','nao_admin'); end if;

  /* `@empresa.com` e `empresa.com` são a mesma coisa para quem digita. */
  d := regexp_replace(d, '^@', '');
  /* E um endereço inteiro colado no campo também: pegar o que vem depois do
     arroba é mais gentil do que recusar. */
  if position('@' in d) > 0 then d := split_part(d, '@', 2); end if;

  if p_remover then
    /* SOLTAR, e não apagar: a linha fica, com histórico, e o domínio volta a
       poder ser reivindicado por quem tiver endereço nele. */
    update walkstamp.dominio set ativo = false
     where lower(dominio) = d and cliente_id = cid and ativo;
    get diagnostics n = row_count;
    if n = 0 then return jsonb_build_object('erro','nao_e_seu'); end if;
    return walkstamp.time_painel(a);
  end if;

  if d = '' or d !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' then
    return jsonb_build_object('erro','dominio_invalido');
  end if;
  /* A REGRA DE POSSE: o domínio tem que ser o do e-mail de quem pede. É o
     único sinal disponível sem sair para a rede — a pessoa controla um
     endereço ali, porque foi por ele que o link mágico chegou. */
  if d <> split_part(a, '@', 2) then
    return jsonb_build_object('erro','nao_e_seu_dominio');
  end if;
  if walkstamp.dominio_publico(d) then
    return jsonb_build_object('erro','dominio_publico');
  end if;

  select cliente_id into dono from walkstamp.dominio
   where lower(dominio) = d and ativo and cliente_id is not null;
  if dono is not null and dono <> cid then
    return jsonb_build_object('erro','ja_reivindicado');
  end if;

  insert into walkstamp.dominio (dominio, cliente_id, admin_email, ativo)
  values (d, cid, a, true)
  on conflict (dominio) do update
    set cliente_id = cid, admin_email = a, ativo = true;

  return walkstamp.time_painel(a);
end $$;

-- ---------------------------------------------------------------------------
-- O ASSENTO VIRA LIMITE. Só o corpo do ramo do domínio muda; o resto é o mesmo
-- da versão que estava no ar, linha por linha.
--
-- Repare em QUEM isto atinge: só a PRIMEIRA entrada de uma pessoa por domínio.
-- Quem já tem assento nominal sai pelo ramo `conta`, lá em cima, e nem chega
-- aqui — inclusive quem entrou por domínio antes, porque a `registrar_emissao`
-- grava o `cliente_id` na primeira emissão. Ninguém que já está dentro perde a
-- renovação por causa desta linha.
-- ---------------------------------------------------------------------------
create or replace function walkstamp.plano_de(p_email text)
returns table (plano text, assentos int, dias int, cliente text, motivo text)
language plpgsql security definer set search_path to 'walkstamp','public' as $$
declare
  e  text := lower(btrim(p_email));
  u  walkstamp.usuario%rowtype;
  c  walkstamp.cliente%rowtype;
  d  walkstamp.dominio%rowtype;
  tem_u boolean; tem_c boolean; tem_d boolean;
  usados int;
begin
  select * into u from walkstamp.usuario where email = e;
  tem_u := found;

  if tem_u and not u.ativo then
    return query select null::text, 0, 0, null::text, 'suspensa'; return;
  end if;

  -- Assento nominal: o usuário está ligado a um cliente.
  if tem_u and u.cliente_id is not null then
    select * into c from walkstamp.cliente where id = u.cliente_id;
    tem_c := found;
    if tem_c and not c.ativo then
      return query select null::text, 0, 0, null::text, 'suspensa'; return;
    end if;
    if tem_c then
      return query select c.plano, c.assentos, c.dias, c.nome, 'conta'; return;
    end if;
  end if;

  -- Regra de inscrição por domínio: quem tem e-mail da empresa entra sozinho.
  select * into d from walkstamp.dominio
   where lower(dominio) = split_part(e,'@',2) and ativo and cliente_id is not null;
  tem_d := found;
  if tem_d then
    select * into c from walkstamp.cliente where id = d.cliente_id and ativo;
    if found then
      /* ASSENTO É LIMITE, E NÃO DECORAÇÃO — 29/08. Sem esta contagem, um
         cliente de 3 assentos dava o plano a 500 pessoas pelo domínio, e o
         número que o cartão Team vende não limitava nada. */
      select count(*) into usados from walkstamp.usuario x
       where x.cliente_id = c.id and x.ativo;
      if usados >= c.assentos then
        return query select null::text, c.assentos, 0, c.nome, 'sem_assento'; return;
      end if;
      return query select c.plano, c.assentos, c.dias, c.nome, 'dominio'; return;
    end if;
  end if;

  -- Teste: uma vez por e-mail. Um teste que se renova sozinho é o plano pago
  -- de graça, e aí não há o que vender.
  if tem_u and u.emissoes > 0 then
    return query select null::text, 0, 0, null::text, 'teste_usado'; return;
  end if;

  return query select 'time'::text, 1, 14, null::text, 'teste';
end $$;

-- ---------------------------------------------------------------------------
-- A porta pública. O administrador chega pelo e-mail da SESSÃO, do lado do
-- Next; o navegador não chama isto.
-- ---------------------------------------------------------------------------
create or replace function public.walkstamp_time_dominio(p_admin text, p_dominio text, p_remover boolean)
returns jsonb language sql security definer set search_path to 'public','walkstamp'
as $$ select walkstamp.time_dominio(p_admin, p_dominio, p_remover) $$;

revoke all on function public.walkstamp_time_dominio(text, text, boolean) from public, anon, authenticated;
grant execute on function public.walkstamp_time_dominio(text, text, boolean) to service_role;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = 'walkstamp_time_dominio'
              and (has_function_privilege('anon', p.oid, 'EXECUTE')
                or has_function_privilege('authenticated', p.oid, 'EXECUTE'))
  loop
    raise exception 'a função do domínio ficou aberta para o navegador: %', f.sig;
  end loop;
end $$;

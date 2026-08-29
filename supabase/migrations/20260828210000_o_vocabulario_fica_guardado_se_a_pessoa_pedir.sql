-- O VOCABULÁRIO GUARDADO ENTRE VISITAS — DEC-5, caminho A
--
-- Duas linhas do catálogo vendiam isto com selo de "em construção": a lista de
-- termos do sistema da pessoa volta na próxima visita, em qualquer máquina.
-- Medido: `vocLista` morava em `sessionStorage` e morria com a aba.
--
-- ---- POR QUE ELE É OPT-IN, E NÃO LIGADO ----
--
-- A lista carrega TERMOS DO CLIENTE: nome de sistema, de produto, de projeto,
-- código de transação. Não é conteúdo de gravação, mas também não é nada — em
-- muitas empresas o nome do projeto é o que está sob acordo de confidencialidade.
-- Guardar isso no nosso servidor sem a pessoa pedir contraria a única coisa que
-- este produto vende: que o que é seu não sai da sua máquina.
--
-- Por isso são DUAS colunas e não uma. `voc_guardar` é a escolha, e ela existe
-- separada do texto: quem marca e apaga a lista continua tendo marcado, e a
-- próxima lista é guardada sem precisar marcar de novo. Uma coluna só faria a
-- escolha desaparecer junto com o conteúdo.
--
-- ---- E POR QUE ELE MORA NO `usuario` ----
--
-- É de QUEM DIGITOU, e não do cliente. A `config` é da empresa e o administrador
-- empurra para todo mundo; o vocabulário é o vocabulário de quem trabalha
-- naquele sistema. Colocá-lo na `config` faria o termo de uma pessoa aparecer na
-- ferramenta de outra sem ninguém ter pedido.
--
-- ---- O QUE ISTO OBRIGA A MEXER ALÉM DA COLUNA ----
--
-- Dado novo no servidor é dado novo em DUAS telas que já existem, e esquecer
-- disso é o jeito silencioso de a política de privacidade virar mentira:
--   - `meus_dados` passa a contar o vocabulário no que é apagável;
--   - `apagar_meus_dados` passa a limpá-lo.
-- A linha do `usuario` continua ficando enquanto a assinatura estiver de pé —
-- apagar quem assina quebra a cobrança —, mas o CONTEÚDO dela que é da pessoa
-- sai. São coisas diferentes, e a diferença é exatamente esta coluna.

alter table walkstamp.usuario
  add column if not exists vocabulario text,
  add column if not exists voc_guardar boolean not null default false;

comment on column walkstamp.usuario.vocabulario is
  'A lista de termos do sistema, como a pessoa digitou. Só existe se ela marcou '
  'guardar. Some no apagar_meus_dados, mesmo com a linha do usuário ficando.';
comment on column walkstamp.usuario.voc_guardar is
  'A escolha de guardar. Separada do texto de propósito: apagar a lista não '
  'desmarca a opção.';

-- ---------------------------------------------------------------------------
-- Guardar. Sem marca, não guarda — e ainda limpa o que já estava lá, porque
-- desmarcar tem que significar "tire isso do servidor", e não "pare de
-- atualizar o que ficou".
-- ---------------------------------------------------------------------------
create or replace function walkstamp.voc_guardar(p_email text, p_texto text, p_guardar boolean)
returns jsonb language plpgsql security definer
set search_path to 'walkstamp','public' as $$
declare
  e text := lower(btrim(coalesce(p_email,'')));
  g boolean := coalesce(p_guardar, false);
  -- Teto de tamanho: a ferramenta já corta em 200 termos, mas quem chama o
  -- servidor não é obrigado a ser a ferramenta.
  t text := nullif(btrim(left(coalesce(p_texto,''), 4000)), '');
  achou int;
begin
  if e = '' then return jsonb_build_object('erro','sem_email'); end if;

  update walkstamp.usuario
     set voc_guardar = g,
         vocabulario = case when g then t else null end
   where lower(email) = e;
  get diagnostics achou = row_count;
  -- Sem assento não há onde guardar, e isso não é erro de programa: é o plano
  -- gratuito, onde a lista continua vivendo só na aba.
  if achou = 0 then return jsonb_build_object('erro','sem_conta'); end if;

  return jsonb_build_object('guardar', g, 'vocabulario', case when g then t else null end);
end $$;

-- ---------------------------------------------------------------------------
-- O perfil passa a trazer a lista. Ele é o que a ferramenta pede uma vez, na
-- abertura da sessão — e o vocabulário tem que chegar junto, senão a pessoa vê
-- a caixa vazia por um instante e redigita.
--
-- ATENÇÃO À SAÍDA ANTECIPADA: as duas devoluções curtas (sem cliente, cliente
-- inativo) também levam o vocabulário. Ele é do usuário, não do cliente, e
-- deixá-lo de fora ali faria a lista sumir para quem tem conta e não tem time.
-- ---------------------------------------------------------------------------
create or replace function walkstamp.perfil_do_usuario(p_email text)
returns jsonb
language plpgsql security definer set search_path to 'walkstamp','public'
as $$
declare
  e text := lower(btrim(coalesce(p_email,'')));
  u walkstamp.usuario%rowtype;
  c walkstamp.cliente%rowtype;
  voc jsonb;
begin
  select * into u from walkstamp.usuario where email = e;
  voc := jsonb_build_object(
    'vocabulario', case when coalesce(u.voc_guardar,false) then u.vocabulario else null end,
    'vocGuardar',  coalesce(u.voc_guardar, false));

  if not found or u.cliente_id is null then
    return jsonb_build_object('cliente', null, 'config', null, 'modelos', '[]'::jsonb) || voc;
  end if;
  select * into c from walkstamp.cliente where id = u.cliente_id and ativo;
  if not found then
    return jsonb_build_object('cliente', null, 'config', null, 'modelos', '[]'::jsonb) || voc;
  end if;
  return jsonb_build_object(
    'cliente', c.nome, 'plano', c.plano, 'papel', u.papel,
    'vence_em', u.vence_em,
    'config', (select coalesce(to_jsonb(cf) - 'cliente_id' - 'atualizado_em', '{}'::jsonb)
                 from walkstamp.config cf where cf.cliente_id = c.id),
    /* O FILTRO DO DONO NÃO PODE SAIR DAQUI. Ele entrou em 20260824120000
       porque o comentário dizia que o `personal` de outra pessoa não aparecia
       e o WHERE não filtrava nada — o modelo pessoal de um vazava para o time
       inteiro. Esta migração reescreve a função para acrescentar o vocabulário,
       e reescrever uma função é herdar TUDO o que ela aprendeu: sem esta linha,
       o vazamento voltaria de carona numa mudança que não tem nada a ver com
       ele. Foi assim que a `modelopessoal.mjs` reprovou este arquivo. */
    'modelos', (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', m.id, 'nome', m.nome, 'escopo', m.escopo, 'dados', m.dados)
                  order by m.nome), '[]'::jsonb)
                  from walkstamp.modelo_doc m
                 where m.cliente_id = c.id
                   and (m.escopo = 'time' or m.dono_email = e))) || voc;
end $$;

-- ---------------------------------------------------------------------------
-- "O que o servidor guarda de mim" passa a contar o vocabulário, e o apagar
-- passa a levá-lo. Sem estes dois, a coluna acima seria dado de cliente que a
-- tela de privacidade não conhece — que é o defeito que o Build 34 existiu
-- para acabar.
-- ---------------------------------------------------------------------------
create or replace function walkstamp.meus_dados(p_email text)
returns jsonb language plpgsql security definer
set search_path to 'walkstamp','public' as $$
declare
  e text := lower(btrim(coalesce(p_email,'')));
  cid bigint;
  n_roteiros int; n_casos int; n_anexos int; n_modelos int; n_chamados int;
  n_faturas int; n_emissoes int; n_voc int;
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
  -- Uma lista é uma linha, e é assim que a tela conta: "vocabulário guardado:
  -- 1" quer dizer que existe. Contar termos aqui obrigaria a ler o conteúdo
  -- para responder uma pergunta que é de existência.
  select count(*) into n_voc from walkstamp.usuario u
   where lower(u.email) = e and u.vocabulario is not null;

  return jsonb_build_object(
    'email', e,
    'prazos', walkstamp.prazos(),
    'apagavel', jsonb_build_object(
      'roteiros', n_roteiros, 'casos', n_casos, 'anexos', n_anexos,
      'modelos', n_modelos, 'chamados', n_chamados, 'vocabulario', n_voc),
    'fica', jsonb_build_object(
      'faturas', n_faturas, 'emissoes', n_emissoes),
    'total_apagavel', n_roteiros + n_casos + n_modelos + n_chamados + n_voc);
end $$;

create or replace function walkstamp.apagar_meus_dados(p_email text, p_confirmacao text)
returns jsonb language plpgsql security definer
set search_path to 'walkstamp','public' as $$
declare
  e text := lower(btrim(coalesce(p_email,'')));
  c text := lower(btrim(coalesce(p_confirmacao,'')));
  antes jsonb;
  n_roteiros int; n_modelos int; n_chamados int; n_voc int;
begin
  if e = '' then return jsonb_build_object('erro','sem_email'); end if;
  if c <> e then return jsonb_build_object('erro','confirmacao_nao_bate'); end if;

  antes := walkstamp.meus_dados(e);

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

  /* A LINHA FICA, O CONTEÚDO SAI. A do `usuario` não é apagada enquanto a
     assinatura estiver de pé — apagar quem assina quebra a cobrança —, mas o
     vocabulário é conteúdo da pessoa e some junto com o resto. E a escolha
     volta a `false`: quem pediu para apagar tudo não deixou pedido de guardar
     o próximo. */
  update walkstamp.usuario
     set vocabulario = null, voc_guardar = false
   where lower(email) = e and (vocabulario is not null or voc_guardar);
  get diagnostics n_voc = row_count;

  return jsonb_build_object(
    'ok', true,
    'apagados', jsonb_build_object(
      'roteiros', n_roteiros, 'modelos', n_modelos, 'chamados', n_chamados,
      'vocabulario', n_voc,
      'casos', antes->'apagavel'->'casos', 'anexos', antes->'apagavel'->'anexos'),
    'depois', walkstamp.meus_dados(e),
    'faxina', walkstamp.anexo_faxina_lista(100));
end $$;

-- ---------------------------------------------------------------------------
-- A porta pública. O e-mail chega por parâmetro, então o navegador não pode
-- chamar: a `walkstamp-meus` confere o JWT e usa a chave de serviço.
-- ---------------------------------------------------------------------------
create or replace function public.walkstamp_voc_guardar(p_email text, p_texto text, p_guardar boolean)
returns jsonb language sql security definer set search_path to 'walkstamp','public'
as $$ select walkstamp.voc_guardar(p_email, p_texto, p_guardar) $$;

revoke all on function public.walkstamp_voc_guardar(text, text, boolean) from public, anon, authenticated;
grant execute on function public.walkstamp_voc_guardar(text, text, boolean) to service_role;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public'
              and p.proname in ('walkstamp_voc_guardar','walkstamp_meus_dados',
                                'walkstamp_apagar_meus_dados','walkstamp_perfil_do_usuario')
              and (has_function_privilege('anon', p.oid, 'EXECUTE')
                or has_function_privilege('authenticated', p.oid, 'EXECUTE'))
  loop
    raise exception 'função aberta para o navegador: %', f.sig;
  end loop;
end $$;

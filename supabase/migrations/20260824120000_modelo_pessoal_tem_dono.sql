-- O MODELO PESSOAL PASSA A TER DONO.
--
-- O que estava no ar, e as duas metades erram em direções opostas:
--
--   1. UM MEMBRO NÃO CONSEGUIA SALVAR o próprio modelo. O botão "Salvar como
--      meu modelo" existe na ferramenta, manda `escopo: 'personal'`, e a função
--      `time_modelo` exigia `papel = 'admin'`. Quem não administra clicava e
--      recebia `nao_admin` — a ferramenta mostrava "não deu" sem dizer por quê.
--
--   2. O QUE FOSSE SALVO NÃO ERA PESSOAL. A tabela é chaveada por `cliente_id`
--      e não tinha coluna de dono, então "só para mim" ficava visível para todo
--      colega do mesmo cliente. E a `perfil_do_usuario` — que é a função que
--      alimenta a FERRAMENTA — trazia um comentário dizendo, com todas as
--      letras: "O escopo `personal` de OUTRA pessoa não aparece aqui — ele é
--      dela." Logo abaixo, o `select` filtrava só por `cliente_id`.
--      O comentário descrevia um filtro que não existia.
--
-- Medido antes de mexer: a tabela tem UMA linha, de escopo `time`. Nenhum
-- modelo pessoal chegou a existir — o vazamento estava armado e nunca disparou.
-- É por isso que esta migração não precisa adivinhar de quem era o quê.

alter table walkstamp.modelo_doc add column if not exists dono_email text;

/* O INVARIANTE MORA NO BANCO, e não na boa vontade de quem chama.
   Pessoal tem dono; de time não tem. Escrito como `check`, é impossível gravar
   um "só para mim" sem dono — que é exatamente a linha que vazaria. */
alter table walkstamp.modelo_doc drop constraint if exists modelo_dono_coerente;
alter table walkstamp.modelo_doc add constraint modelo_dono_coerente
  check ( (escopo = 'personal' and coalesce(btrim(dono_email), '') <> '')
       or (escopo = 'time'     and dono_email is null) );

create index if not exists modelo_dono_idx on walkstamp.modelo_doc (cliente_id, dono_email);

-- ---------------------------------------------------------------------------
-- A LEITURA: cada um vê os do time e os SEUS.

create or replace function walkstamp.perfil_do_usuario(p_email text)
returns jsonb
language plpgsql security definer set search_path to 'walkstamp','public'
as $$
declare
  e text := lower(btrim(coalesce(p_email,'')));
  u walkstamp.usuario%rowtype;
  c walkstamp.cliente%rowtype;
begin
  select * into u from walkstamp.usuario where email = e;
  if not found or u.cliente_id is null then
    return jsonb_build_object('cliente', null, 'config', null, 'modelos', '[]'::jsonb);
  end if;
  select * into c from walkstamp.cliente where id = u.cliente_id and ativo;
  if not found then
    return jsonb_build_object('cliente', null, 'config', null, 'modelos', '[]'::jsonb);
  end if;
  return jsonb_build_object(
    'cliente', c.nome, 'plano', c.plano, 'papel', u.papel,
    'vence_em', u.vence_em,
    'config', (select coalesce(to_jsonb(cf) - 'cliente_id' - 'atualizado_em', '{}'::jsonb)
                 from walkstamp.config cf where cf.cliente_id = c.id),
    /* Os modelos do time, mais os que a própria pessoa marcou como "só para
       mim". O `personal` de OUTRA pessoa não aparece aqui — ele é dela.
       ESTE COMENTÁRIO JÁ EXISTIA, e o filtro não. Agora ele existe: é a linha
       do `dono_email` logo abaixo. */
    'modelos', (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', m.id, 'nome', m.nome, 'escopo', m.escopo, 'dados', m.dados)
                  order by m.nome), '[]'::jsonb)
                  from walkstamp.modelo_doc m
                 where m.cliente_id = c.id
                   and (m.escopo = 'time' or m.dono_email = e)));
end $$;

-- ---------------------------------------------------------------------------
-- A ESCRITA: o dono cuida do seu; quem administra cuida do que é do time.

create or replace function walkstamp.time_modelo(p_admin text, p_id bigint, p_nome text,
                                                p_escopo text, p_dados jsonb, p_apagar boolean)
returns jsonb language plpgsql security definer set search_path to 'walkstamp','public'
as $$
declare
  /* `p_admin` continua com esse nome porque a Edge Function `walkstamp-time` e
     o painel já mandam esse parâmetro, e trocar o nome sem trocar os dois
     chamadores derrubaria o salvar de todo mundo. O que ele carrega, desde
     sempre, é QUEM CHAMOU — o e-mail do JWT. A troca do nome está anotada na
     FILA como acerto de vocabulário.

     `v_escopo` com prefixo, e não `escopo`: uma variável com o nome de uma
     coluna vira ambiguidade dentro do `update`, e o plpgsql reage a isso com
     erro em tempo de execução — um erro que só aparece na primeira vez que
     alguém salva. */
  e        text := lower(btrim(p_admin));
  v_escopo text;
  cid      bigint;
  eh_admin boolean;
  linha    walkstamp.modelo_doc%rowtype;
begin
  select u.cliente_id, (u.papel = 'admin') into cid, eh_admin
    from walkstamp.usuario u where u.email = e and u.cliente_id is not null;
  if cid is null then return jsonb_build_object('erro','nao_admin'); end if;

  if coalesce(p_apagar, false) then
    select * into linha from walkstamp.modelo_doc where id = p_id and cliente_id = cid;
    if not found then return jsonb_build_object('erro','sem_modelo'); end if;
    /* Apagar o pessoal de OUTRA pessoa não é privilégio de administrador: é o
       mesmo vazamento com a mão trocada. Nem quem administra apaga o que é de
       alguém — o padrão do time, sim, porque esse é o trabalho dele. */
    if linha.escopo = 'personal' and linha.dono_email is distinct from e then
      return jsonb_build_object('erro','nao_e_seu');
    end if;
    if linha.escopo = 'time' and not eh_admin then
      return jsonb_build_object('erro','nao_admin');
    end if;
    delete from walkstamp.modelo_doc where id = linha.id;

  elsif p_id is not null then
    select * into linha from walkstamp.modelo_doc where id = p_id and cliente_id = cid;
    if not found then return jsonb_build_object('erro','sem_modelo'); end if;
    /* O ESCOPO DE QUEM JÁ EXISTE É O DELE. Sem esta linha, um `p_escopo` nulo
       — que é o que o painel manda ao renomear ou apagar — cairia no padrão
       `time` e transformaria um "só para mim" em padrão da equipe inteira, sem
       ninguém ter pedido. Trocar de escopo continua possível: basta mandar o
       escopo novo de propósito. */
    v_escopo := coalesce(p_escopo, linha.escopo);
    if v_escopo = 'time' and not eh_admin then
      return jsonb_build_object('erro','nao_admin');
    end if;
    if linha.escopo = 'personal' and linha.dono_email is distinct from e then
      return jsonb_build_object('erro','nao_e_seu');
    end if;
    if linha.escopo = 'time' and not eh_admin then
      return jsonb_build_object('erro','nao_admin');
    end if;
    update walkstamp.modelo_doc m
       set nome       = coalesce(p_nome, m.nome),
           escopo     = v_escopo,
           dados      = coalesce(p_dados, m.dados),
           dono_email = case when v_escopo = 'personal' then e else null end
     where m.id = linha.id;

  else
    v_escopo := coalesce(p_escopo, 'time');
    /* Padrão do TIME continua sendo decisão de quem administra: empurrar o
       documento de todo mundo não é coisa que se faça sem querer. O pessoal,
       qualquer um salva — e era isso que estava trancado. */
    if v_escopo = 'time' and not eh_admin then
      return jsonb_build_object('erro','nao_admin');
    end if;
    if btrim(coalesce(p_nome,'')) = '' then return jsonb_build_object('erro','sem_nome'); end if;
    insert into walkstamp.modelo_doc (cliente_id, nome, escopo, dados, dono_email)
    values (cid, p_nome, v_escopo, coalesce(p_dados,'{}'::jsonb),
            case when v_escopo = 'personal' then e else null end);
  end if;

  /* A volta é o PERFIL de quem chamou, e não o painel do time: quem salva da
     ferramenta pode não administrar nada, e `time_painel` recusaria — a pessoa
     salvaria com sucesso e receberia um erro. */
  return walkstamp.perfil_do_usuario(e);
end $$;

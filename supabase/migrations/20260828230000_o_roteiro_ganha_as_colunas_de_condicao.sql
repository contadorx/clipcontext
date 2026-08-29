-- O ROTEIRO GANHA AS COLUNAS DE CONDIÇÃO
--
-- O post "Cenário não é roteiro" (`/blog/cenario-nao-e-roteiro`) diz, com todas
-- as letras: **roteiro é instrução, cenário é condição.** E manda o leitor
-- acrescentar cinco coisas à planilha de casos — pré-condição com dados mestres
-- nomeados, resultado esperado verificável, marcação de reexecução, dependência
-- entre casos, e o registro de qual massa foi usada em cada execução.
--
-- Medido em 28/08, no nosso próprio importador: ele reconhecia CINCO colunas —
-- `caso`, `titulo`, `sistema`, `chamado`, `responsavel` — e todas as cinco são
-- de instrução. Nenhuma de condição. Ou seja: o produto pago cobrava o preço do
-- roteiro e não oferecia sequer um lugar para escrever o cenário que o nosso
-- próprio texto diz ser a parte que importa.
--
-- Isto abre esse lugar. Quatro colunas, e a quinta (o registro da massa usada)
-- continua sendo o que ela sempre foi: o documento de execução.
--
-- ---- POR QUE ELAS TAMBÉM VIAJAM NO LINK DO CASO ----
--
-- Guardar a pré-condição só na tela de controle resolveria metade. A outra
-- metade é ela chegar na ficha ENQUANTO a pessoa grava: aí o documento passa a
-- carregar as duas — a condição que alguém ESCREVEU e a que de fato aconteceu
-- nas telas — e as duas podem ser comparadas. Sem isso, o documento continua
-- sendo, nas palavras do post, "a pré-condição que ninguém escreveu".
--
-- ---- A REEXECUÇÃO É NORMALIZADA, E CÉLULA TORTA NÃO DERRUBA IMPORTAÇÃO ----
--
-- `repetivel` ou `queima`, e nada mais. A planilha vem em cinco idiomas e com o
-- que a pessoa digitou, então quem normaliza é o `lib/planilha.ts`; aqui fica a
-- trava. E o `roteiro_salvar` COERCE o desconhecido para nulo em vez de recusar:
-- uma célula torta não pode custar a importação de trezentos casos.

alter table walkstamp.roteiro_caso
  add column if not exists precondicao text,
  add column if not exists esperado    text,
  add column if not exists reexecucao  text,
  add column if not exists depende_de  text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'roteiro_caso_reexecucao_ck') then
    alter table walkstamp.roteiro_caso
      add constraint roteiro_caso_reexecucao_ck
      check (reexecucao is null or reexecucao in ('repetivel','queima'));
  end if;
end $$;

comment on column walkstamp.roteiro_caso.precondicao is
  'O estado do mundo antes: dados mestres nomeados, com as características que '
  'fazem o cenário existir. É a coluna que o post cobra em primeiro lugar.';
comment on column walkstamp.roteiro_caso.esperado is
  'Resultado esperado VERIFICÁVEL: documento, status, valor ou mensagem. '
  'Nunca "corretamente".';
comment on column walkstamp.roteiro_caso.reexecucao is
  'repetivel | queima. Se a massa queima, o caso não é reexecutável na '
  'regressão sem ser montado de novo — e é isso que reorganiza o planejamento.';
comment on column walkstamp.roteiro_caso.depende_de is
  'De qual caso este depende. Cinco casos bloqueados por um que falhou é a '
  'informação que só aparece na sexta-feira quando ninguém a registrou.';

-- ---------------------------------------------------------------------------
-- Ler: as quatro voltam junto com o resto do caso.
-- ---------------------------------------------------------------------------
create or replace function walkstamp.roteiro_ver(p_email text, p_id bigint)
returns jsonb language plpgsql stable security definer
set search_path to 'walkstamp','public' as $$
declare e text := lower(btrim(coalesce(p_email,''))); r walkstamp.roteiro%rowtype;
begin
  if e = '' then return jsonb_build_object('erro','sem_email'); end if;
  if not walkstamp.roteiro_pode(e, p_id) then return jsonb_build_object('erro','sem_acesso'); end if;
  select * into r from walkstamp.roteiro where id = p_id;
  return jsonb_build_object(
    'id', r.id, 'nome', r.nome, 'escopo', r.escopo, 'dono', r.dono,
    'criado_em', r.criado_em,
    'meu', lower(r.dono) = e,
    'casos', (select coalesce(jsonb_agg(jsonb_build_object(
                'id', c.id, 'ordem', c.ordem, 'caso', c.caso, 'titulo', c.titulo,
                'cenario', c.cenario, 'chamado', c.chamado, 'sistema', c.sistema,
                'precondicao', c.precondicao, 'esperado', c.esperado,
                'reexecucao', c.reexecucao, 'depende_de', c.depende_de,
                'responsavel', c.responsavel, 'feito_em', c.feito_em,
                'feito_por', c.feito_por, 'arquivo', c.arquivo,
                'impressao', c.impressao, 'observacao', c.observacao,
                'recibo', c.recibo,
                'anexo', case when c.anexo_caminho is null then null
                              else jsonb_build_object('nome', c.anexo_nome,
                                                      'bytes', c.anexo_bytes,
                                                      'em', c.anexo_em) end)
                order by c.ordem, c.id), '[]'::jsonb)
              from walkstamp.roteiro_caso c where c.roteiro_id = r.id));
end $$;

-- ---------------------------------------------------------------------------
-- Gravar. As quatro vêm da PLANILHA e não do `_antes`: a planilha nova é a
-- verdade do cenário, do mesmo jeito que já era do título. O `_antes` continua
-- guardando só o que a EXECUÇÃO produziu — arquivo, impressão, recibo, anexo —,
-- que é o que uma reimportação não pode apagar.
-- ---------------------------------------------------------------------------
create or replace function walkstamp.roteiro_salvar(
  p_email text, p_nome text, p_escopo text, p_casos jsonb, p_id bigint)
returns jsonb language plpgsql security definer
set search_path to 'walkstamp','public' as $$
declare
  e text := lower(btrim(coalesce(p_email,'')));
  esc text := case when coalesce(p_escopo,'') = 'time' then 'time' else 'personal' end;
  cid bigint; rid bigint; i int := 0; item jsonb; saida jsonb;
begin
  if e = '' then return jsonb_build_object('erro','sem_email'); end if;
  if btrim(coalesce(p_nome,'')) = '' then return jsonb_build_object('erro','sem_nome'); end if;
  if jsonb_typeof(coalesce(p_casos,'null'::jsonb)) <> 'array' or jsonb_array_length(p_casos) = 0 then
    return jsonb_build_object('erro','sem_casos');
  end if;

  select u.cliente_id into cid from walkstamp.usuario u where u.email = e and u.ativo;
  if esc = 'time' and cid is null then esc := 'personal'; end if;

  if p_id is not null then
    if not walkstamp.roteiro_pode(e, p_id) then return jsonb_build_object('erro','sem_acesso'); end if;
    rid := p_id;
    update walkstamp.roteiro set nome = p_nome, escopo = esc,
           cliente_id = case when esc = 'time' then cid else cliente_id end
     where id = rid;
  else
    insert into walkstamp.roteiro (cliente_id, dono, nome, escopo)
    values (case when esc = 'time' then cid else null end, e, p_nome, esc)
    returning id into rid;
  end if;

  create temp table _antes on commit drop as
    select caso, responsavel, feito_em, feito_por, arquivo, impressao, observacao,
           recibo, anexo_caminho, anexo_nome, anexo_bytes, anexo_em
      from walkstamp.roteiro_caso where roteiro_id = rid;
  delete from walkstamp.roteiro_caso where roteiro_id = rid;

  for item in select * from jsonb_array_elements(p_casos) loop
    i := i + 1;
    insert into walkstamp.roteiro_caso
      (roteiro_id, ordem, caso, titulo, cenario, chamado, sistema,
       precondicao, esperado, reexecucao, depende_de,
       responsavel, feito_em, feito_por, arquivo, impressao, observacao,
       recibo, anexo_caminho, anexo_nome, anexo_bytes, anexo_em)
    select rid, i,
      coalesce(nullif(btrim(item->>'caso'),''), 'caso ' || i),
      nullif(btrim(coalesce(item->>'titulo','')),''),
      nullif(btrim(coalesce(item->>'cenario','')),''),
      nullif(btrim(coalesce(item->>'chamado','')),''),
      nullif(btrim(coalesce(item->>'sistema','')),''),
      /* A pré-condição costuma ser um parágrafo, e o teto é generoso de
         propósito: cortar a condição no meio é pior do que guardá-la inteira. */
      nullif(btrim(left(coalesce(item->>'precondicao',''), 2000)),''),
      nullif(btrim(left(coalesce(item->>'esperado',''), 1000)),''),
      /* Célula torta vira nulo, e não recusa: uma palavra que ninguém previu
         não pode custar a importação de trezentos casos. */
      case when item->>'reexecucao' in ('repetivel','queima')
           then item->>'reexecucao' else null end,
      nullif(btrim(left(coalesce(item->>'depende_de',''), 120)),''),
      coalesce(nullif(btrim(coalesce(item->>'responsavel','')),''), a.responsavel),
      a.feito_em, a.feito_por, a.arquivo, a.impressao, a.observacao,
      a.recibo, a.anexo_caminho, a.anexo_nome, a.anexo_bytes, a.anexo_em
    from (select 1) z
    left join _antes a
      on lower(a.caso) = lower(coalesce(nullif(btrim(item->>'caso'),''), 'caso ' || i));
  end loop;

  insert into walkstamp.anexo_orfao (caminho)
  select a.anexo_caminho from _antes a
   where a.anexo_caminho is not null
     and not exists (select 1 from walkstamp.roteiro_caso c
                      where c.roteiro_id = rid and lower(c.caso) = lower(a.caso));
  drop table _antes;

  saida := walkstamp.roteiro_ver(e, rid);
  return saida || jsonb_build_object('faxina', walkstamp.anexo_faxina_lista());
end $$;

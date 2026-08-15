-- ============================================================================
-- FUMAÇA CONTRA O BANCO REAL — Desfazer e Portal (v2)
--
-- A v1 tinha sete consultas separadas — e o SQL Editor do Supabase só mostra o
-- resultado da ÚLTIMA. A rodada voltou com uma linha de resultado e seis
-- verificações engolidas. Esta versão são DOIS comandos, um por parte:
--
--   PARTE 1 — um único SELECT, somente leitura. Rode e leia a grade inteira.
--   PARTE 2 — um único DO que ensaia o Desfazer e termina num RAISE EXCEPTION
--             de propósito: a mensagem de "erro" É o relatório, e a exceção
--             garante o rollback de tudo (inclusive cascatas de FK que um
--             delete de ensaio dispararia). Nada persiste.
--
-- Limite honesto: o editor roda como `postgres`, que atravessa a RLS. A Parte
-- 2 prova constraints, colunas geradas e triggers; as policies são lidas do
-- catálogo na Parte 1 (seções 3 e 4).
-- ============================================================================


-- ── PARTE 1 · rode este SELECT inteiro e leia por seção ─────────────────────
with alvo_desfazer as (
  select unnest(array['servicos','clientes_fornecedores','plano_contas',
                      'centros_custo','categorias','contas_bancarias',
                      'lancamentos','documentos_ocultos']) as tabela
),
alvo_todas as (
  select tabela from alvo_desfazer
  union select unnest(array['modelos_plano_contas','portal_usuarios'])
)

-- 1 · colunas geradas: GENERATED/IDENTITY ALWAYS recusa o id do retrato
select '1 colunas geradas' as secao,
       c.table_name || '.' || c.column_name as item,
       case when c.identity_generation = 'ALWAYS' or c.is_generated = 'ALWAYS'
            then 'QUEBRA o Desfazer: valor explícito é recusado'
            else 'ok (BY DEFAULT aceita valor explícito)' end as resultado
from information_schema.columns c
join alvo_desfazer a on a.tabela = c.table_name
where c.table_schema = 'public'
  and (c.is_identity = 'YES' or c.is_generated <> 'NEVER')

union all
select '1 colunas geradas', '(nenhuma)', 'ok — nenhuma coluna gerada nas tabelas do Desfazer'
where not exists (
  select 1 from information_schema.columns c
  join alvo_desfazer a on a.tabela = c.table_name
  where c.table_schema = 'public'
    and (c.is_identity = 'YES' or c.is_generated <> 'NEVER'))

-- 2 · triggers nas tabelas do Desfazer
union all
select '2 triggers',
       t.event_object_table || ' · ' || t.trigger_name,
       t.action_timing || ' ' || string_agg(t.event_manipulation, ',')
from information_schema.triggers t
join alvo_todas a on a.tabela = t.event_object_table
where t.event_object_schema = 'public'
group by t.event_object_table, t.trigger_name, t.action_timing

union all
select '2 triggers', '(nenhum)', 'ok — nenhum trigger nas tabelas do Desfazer'
where not exists (
  select 1 from information_schema.triggers t
  join alvo_todas a on a.tabela = t.event_object_table
  where t.event_object_schema = 'public')

-- 3 · RLS: ligada sem policy de INSERT = exclui mas não restaura
union all
select '3 rls',
       t.tablename,
       case
         when t.rowsecurity and coalesce(p.n, 0) = 0
           then 'QUEBRA o Desfazer: RLS ligada sem policy de INSERT'
         when not t.rowsecurity then 'ATENÇÃO: RLS desligada'
         else 'ok — ' || p.n || ' policy(ies) de INSERT/ALL'
       end
from pg_tables t
join alvo_todas a on a.tabela = t.tablename
left join (select tablename, count(*) n from pg_policies
           where schemaname = 'public' and cmd in ('INSERT','ALL')
           group by tablename) p using (tablename)
where t.schemaname = 'public'

-- 4 · dump de TODAS as policies (copiar para fx_policies_dump.sql no repo)
union all
select '4 policies (versionar)',
       p.tablename || ' · ' || p.policyname || ' · ' || p.cmd || ' · ' || p.roles::text,
       'USING: ' || coalesce(p.qual, '—') || '  WITH CHECK: ' || coalesce(p.with_check, '—')
from pg_policies p
where p.schemaname = 'public'

-- 5 · funções: existem? anon executa o que não devia?
union all
select '5 funções',
       f.nome,
       case
         when p.oid is null then 'NÃO EXISTE no banco'
         when has_function_privilege('anon', p.oid, 'EXECUTE')
           then case when f.nome = 'portal_dados'
                     then 'FALHA: anon executa — fx_portal_login.sql não aplicado'
                     else 'anon executa — conferir se é intencional' end
         else 'existe, anon sem execute — ok'
       end
from (values ('portal_dados'),('portal_validar_sessao'),('portal_validar_magiclink'),
             ('remover_colaborador'),('fs_empresas_do_usuario'),('reservar_credito_ia'),
             ('estornar_credito_ia'),('incrementar_uso_cupom'),('admin_set_teste'),
             ('zerar_empresa')) f(nome)
left join pg_proc p
  on p.proname = f.nome
 and p.pronamespace = (select oid from pg_namespace where nspname = 'public')

-- 6 · tabelas de apoio existem? precos_config tem a linha?
union all
select '6 tabelas de apoio',
       t.nome,
       case
         when to_regclass('public.' || t.nome) is null then
           'NÃO EXISTE' || case when t.nome = 'impersonacoes'
                                then ' — o registro de impersonação grava no vazio'
                                else '' end
         when t.nome = 'precos_config' then
           -- referência dinâmica de propósito: se a tabela não existisse, uma
           -- referência direta quebraria o SELECT inteiro em tempo de parse
           case when strpos(query_to_xml('select count(*) as c from public.precos_config where id = 1',
                                         true, false, '')::text, '<c>1</c>') > 0
                then 'existe e tem a linha id=1 — a home lê o preço do banco'
                else 'existe mas SEM a linha id=1 — a home usa o CONFIG_PADRAO do código' end
         else 'existe — ok'
       end
from (values ('impersonacoes'),('portal_auditoria'),('portal_usuarios'),
             ('precos_config'),('creditos_ia_eventos')) t(nome)

-- 7 · cascatas: FK com ON DELETE CASCADE apontando para tabelas do Desfazer.
--     Um "OK" no ensaio da Parte 2 NÃO cobre isso: excluir a linha-mãe apaga
--     os filhos em cascata, e o Desfazer reinsere só a mãe — os filhos somem
--     de verdade. Cada linha aqui é um lugar onde o Desfazer devolve menos do
--     que apagou.
union all
select '7 cascatas (Desfazer devolve menos do que apagou)',
       fk.relname || ' → ' || alvo.relname,
       'FK ' || c.conname || ' é ON DELETE CASCADE'
from pg_constraint c
join pg_class alvo on alvo.oid = c.confrelid
join pg_class fk   on fk.oid = c.conrelid
join alvo_desfazer a on a.tabela = alvo.relname
where c.contype = 'f' and c.confdeltype = 'c'

union all
select '7 cascatas (Desfazer devolve menos do que apagou)', '(nenhuma)',
       'ok — nenhuma FK em cascata aponta para as tabelas do Desfazer'
where not exists (
  select 1 from pg_constraint c
  join pg_class alvo on alvo.oid = c.confrelid
  join alvo_desfazer a on a.tabela = alvo.relname
  where c.contype = 'f' and c.confdeltype = 'c')

order by 1, 2;


-- ============================================================================
-- PARTE 2 · Ensaio do Desfazer — rode SÓ este DO, sozinho.
--
-- Para cada tabela que reinsere retrato com id original: apaga uma linha real,
-- reinsere, confere. No fim, um RAISE EXCEPTION DE PROPÓSITO: a mensagem de
-- "erro" é o relatório, e a exceção desfaz TUDO — inclusive qualquer cascata
-- que o delete de ensaio tenha disparado. Se aparecer um erro cuja mensagem
-- começa com "FUMACA-DESFAZER", correu como planejado: leia o relatório nela.
-- ============================================================================
do $$
declare
  t text;
  amostra_id uuid;
  n int;
  rel text := E'\n';
begin
  foreach t in array array['servicos','clientes_fornecedores','plano_contas',
                           'centros_custo','categorias','contas_bancarias',
                           'lancamentos']
  loop
    begin
      execute format('select id from %I limit 1', t) into amostra_id;
      if amostra_id is null then
        rel := rel || rpad(t, 24) || 'SEM DADOS — tabela vazia' || E'\n';
        continue;
      end if;

      execute format('create temp table _bk_fumaca as select * from %I where id = $1', t) using amostra_id;
      execute format('delete from %I where id = $1', t) using amostra_id;
      execute format('insert into %I select * from _bk_fumaca', t);
      execute format('select count(*) from %I where id = $1', t) using amostra_id into n;
      rel := rel || rpad(t, 24)
                 || case when n = 1 then 'OK — apagou e restaurou com o id original'
                         else 'FALHA — a reinserção não devolveu a linha' end || E'\n';
      execute 'drop table _bk_fumaca';
    exception when others then
      rel := rel || rpad(t, 24) || 'FALHA — ' || sqlerrm || E'\n';
      begin execute 'drop table if exists _bk_fumaca'; exception when others then null; end;
    end;
  end loop;

  raise exception using
    errcode = 'P0001',
    message = 'FUMACA-DESFAZER — este erro é PROPOSITAL: ele é o relatório e garante o rollback de tudo.' || rel;
end $$;

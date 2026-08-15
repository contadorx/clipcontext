-- ============================================================================
-- CONFIRMAÇÃO FINAL — o que ficou de pé depois da rodada de fumaça.
--
-- Uma consulta só. Três perguntas que ainda não têm resposta:
--
--   A. `fx_creditos_ia_funcoes.sql` foi aplicado? (Enquanto não for, a análise
--      do mês e o assistente respondem erro em produção.)
--   B. O grant delas ficou certo (authenticated chama, anon não)?
--   C. A tabela de uso existe, para o teto diário funcionar?
--
-- O item de ORDEM (deploy antes do revoke do portal) não dá para conferir por
-- SQL: teste abrindo um magic link de verdade. Se o portal abrir, a ordem foi
-- respeitada. Se disser "link inválido", o deploy ainda não subiu — e a saída é
-- publicar o zip, não mexer no banco de novo.
-- ============================================================================
select f.nome as verificacao,
       case
         when p.oid is null then
           'NÃO EXISTE — rode fx_creditos_ia_funcoes.sql'
           || case when f.nome like '%credito%' then ' (a IA está quebrada até lá)' else '' end
         when f.nome = 'add_creditos_ia' then
           case when has_function_privilege('anon', p.oid, 'EXECUTE')
                     or has_function_privilege('authenticated', p.oid, 'EXECUTE')
                then 'FALHA: só o webhook (service_role) deveria creditar'
                when not has_function_privilege('service_role', p.oid, 'EXECUTE')
                then 'FALHA: service_role sem execute — o webhook não credita'
                else 'ok — só service_role credita' end
         else
           case when has_function_privilege('anon', p.oid, 'EXECUTE')
                then 'FALHA: anon executa'
                when not has_function_privilege('authenticated', p.oid, 'EXECUTE')
                then 'FALHA: authenticated sem execute — o app não consegue chamar'
                else 'ok — authenticated chama, anon não' end
       end as resultado
from (values ('reservar_credito_ia'),('estornar_credito_ia'),('add_creditos_ia')) f(nome)
left join pg_proc p
  on p.proname = f.nome
 and p.pronamespace = (select oid from pg_namespace where nspname = 'public')

union all
select 'tabela creditos_ia_usos',
       case when to_regclass('public.creditos_ia_usos') is null
            then 'NÃO EXISTE — sem ela o teto diário de IA não funciona'
            else 'existe — ok' end

union all
select 'coluna escritorios.creditos_ia',
       case when exists (
              select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'escritorios'
                and column_name = 'creditos_ia')
            then 'existe — é o saldo que a Carteira e a análise leem'
            else 'NÃO EXISTE — o saldo de IA não tem onde morar' end
order by 1;

-- ============================================================================
-- Grants das funções: fechar o que a fumaça de 14/08 mostrou aberto.
--
-- `create function` concede EXECUTE a PUBLIC por padrão — e PUBLIC inclui o
-- `anon`, cuja chave está no pacote do navegador. A fumaça encontrou o `anon`
-- podendo executar `portal_dados` (o vazamento que fx_portal_login.sql existia
-- para fechar e nunca foi aplicado), `zerar_empresa`, `remover_colaborador`,
-- `admin_set_teste` e `incrementar_uso_cupom`.
--
-- As funções checam pertencimento por `auth.uid()` — que para o anon é nulo —
-- então o dano direto é limitado. Mas segurança por "a função confere lá
-- dentro" é uma camada só; o grant é outra, e não custa nada. Este arquivo:
--
--   1. revoga PUBLIC/anon das funções de gestão (ficam para authenticated);
--   2. revoga TUDO de portal_dados exceto service_role (o servidor é o único
--      chamador legítimo — fx_portal_login.sql, agora aplicado de verdade);
--   3. NÃO toca em portal_validar_magiclink / portal_validar_sessao.
--
--      >>> ESTA JUSTIFICATIVA ESTAVA ERRADA. Ver fx_grants_portal_validar.sql,
--      >>> que fecha as duas. Mantida aqui porque a decisão errada também é
--      >>> história: o motivo escrito era "o visitante do portal roda como
--      >>> anon, revogar quebra o login". O visitante nunca chama essas RPCs —
--      >>> quem chamava era o nosso servidor, usando o cliente anônimo por
--      >>> acidente. Bastou trocar para a chave de serviço.
--   4. NÃO toca em fs_empresas_do_usuario: ela roda dentro das policies de
--      RLS; para o anon devolve vazio, que é o comportamento certo.
--
-- Assinaturas resolvidas dinamicamente (pg_proc) para não depender de acertar
-- os tipos de cada uma. Idempotente. Rodar inteiro no SQL Editor.
-- ============================================================================
do $$
declare
  f record;
begin
  -- gestão: só usuário logado
  for f in
    select p.oid::regprocedure as assinatura, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('zerar_empresa','remover_colaborador',
                        'admin_set_teste','incrementar_uso_cupom')
  loop
    execute format('revoke execute on function %s from public, anon', f.assinatura);
    execute format('grant execute on function %s to authenticated, service_role', f.assinatura);
    raise notice 'gestão: % — anon revogado, authenticated mantido', f.assinatura;
  end loop;

  -- portal_dados: só o servidor (service role)
  for f in
    select p.oid::regprocedure as assinatura
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'portal_dados'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.assinatura);
    execute format('grant execute on function %s to service_role', f.assinatura);
    raise notice 'portal_dados: % — só service_role executa', f.assinatura;
  end loop;
end $$;

-- Conferência imediata (mesma leitura da fumaça, seção 5):
select p.proname as funcao,
       case when has_function_privilege('anon', p.oid, 'EXECUTE')
            then 'anon AINDA executa' else 'anon sem execute — ok' end as resultado
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('portal_dados','zerar_empresa','remover_colaborador',
                    'admin_set_teste','incrementar_uso_cupom',
                    'portal_validar_magiclink','portal_validar_sessao')
order by 1;

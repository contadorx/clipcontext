-- ============================================================================
-- Fecha o `anon` nas duas últimas funções do portal.
--
-- ⚠️ ORDEM IMPORTA. Rode este arquivo **DEPOIS** de publicar o deploy que
-- contém a mudança em `lib/portal-sessao.ts` e `app/portal/entrar/route.ts`
-- (commit que troca a chave anônima pela de serviço nas duas chamadas).
-- Rodar antes derruba o login do portal para todos os clientes.
--
-- Por que agora e não junto com `fx_grants_funcoes.sql`: naquela rodada a
-- justificativa foi "o visitante do portal roda como anon, revogar quebra o
-- login". Estava ERRADO. O visitante nunca chama estas RPCs — quem chamava era
-- o nosso servidor, usando o cliente anônimo por acidente (estava à mão). Com
-- as duas chamadas migradas para a chave de serviço, o `anon` não tem mais
-- motivo nenhum para executá-las.
--
-- O que isso fecha: `portal_validar_sessao` devolve `empresa_id`, `email` e o
-- id do usuário do portal; `portal_validar_magiclink` devolve uma sessão de 14
-- dias. Com `execute` para o `anon` — cuja chave está no pacote do navegador —
-- dava para bater direto na REST, fora de qualquer rota nossa, chutando tokens
-- sem limite. A entropia do token era a única defesa; agora há duas.
--
-- Idempotente. Rodar inteiro no SQL Editor.
-- ============================================================================

-- ── ANTES DE REVOGAR: leia o corpo das duas funções ────────────────────────
-- A definição delas não está no repositório. Duas coisas precisam ser
-- verdadeiras, e só o banco pode dizer:
--
--   1. `prosecdef = true` (security definer). Se fosse invoker, a função
--      enxergaria pela RLS do chamador — e o service_role tem BYPASSRLS, o que
--      ALARGA o que ela vê. Alargar não tranca ninguém fora, mas é bom saber.
--   2. o corpo NÃO decide nada por `auth.role()`, `auth.jwt()` ou
--      `current_setting('request.jwt...')`. Se houver um `if auth.role() =
--      'anon'` lá dentro, trocar o chamador para service_role muda o caminho —
--      e é o único jeito de esta mudança quebrar o login.
--
-- `auth.uid()` continua nulo nos dois casos (nem anon nem service_role trazem
-- `sub` no token), então dependências de uid não mudam.
select p.proname,
       p.prosecdef as security_definer,
       pg_get_functiondef(p.oid) as corpo
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('portal_validar_sessao','portal_validar_magiclink');


-- ── Revogação ──────────────────────────────────────────────────────────────
do $$
declare
  f record;
  n int := 0;
begin
  for f in
    select p.oid::regprocedure as assinatura
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('portal_validar_sessao','portal_validar_magiclink')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.assinatura);
    execute format('grant execute on function %s to service_role', f.assinatura);
    raise notice 'portal: % — só service_role executa', f.assinatura;
    n := n + 1;
  end loop;

  if n = 0 then
    raise exception 'Nenhuma das duas funções do portal foi encontrada em public — nada foi revogado. Confira os nomes antes de dar por fechado.';
  end if;
end $$;

-- ── Conferência ────────────────────────────────────────────────────────────
-- LEFT JOIN a partir de uma lista fixa, de propósito: com inner join, uma
-- função que não existisse (nome diferente, outro schema) sumiria da grade em
-- vez de virar alerta — e "sumiu" é indistinguível de "está tudo certo" para
-- quem lê sete linhas esperando sete. Foi assim que `fx_portal_login.sql` foi
-- dado como aplicado sem nunca ter sido.
--
-- Confere os DOIS lados: anon fora, e service_role DENTRO. Revogar sem conferir
-- o segundo é como trancar a porta e não checar se a chave ficou do lado de
-- dentro — o app é quem fica de fora.
select f.nome as funcao,
       case
         when p.oid is null then 'NÃO EXISTE no banco — nada foi revogado aqui'
         when has_function_privilege('anon', p.oid, 'EXECUTE') then 'FALHA: anon ainda executa'
         when not has_function_privilege('service_role', p.oid, 'EXECUTE')
           then 'FALHA: service_role SEM execute — o app não consegue chamar'
         else 'ok — anon fora, service_role dentro'
       end as resultado
from (values ('portal_dados'),('portal_validar_magiclink'),('portal_validar_sessao'),
             ('zerar_empresa'),('remover_colaborador'),('admin_set_teste'),
             ('incrementar_uso_cupom')) f(nome)
left join pg_proc p
  on p.proname = f.nome
 and p.pronamespace = (select oid from pg_namespace where nspname = 'public')
order by 1;

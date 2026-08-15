-- FinanceiroX — Zerar os MOVIMENTOS de uma empresa (mantém a empresa e os cadastros).
-- Apaga: conciliação, transações de extrato, lançamentos, documentos recebidos,
--        remessas CNAB e análises de IA (derivadas dos lançamentos).
-- MANTÉM: contas bancárias, categorias, grupos, centros de custo, plano de contas,
--         orçamentos, clientes/fornecedores, regras de conciliação e acesso do portal.
-- Valida permissão (dono/admin) e devolve os caminhos dos documentos no Storage,
-- que o código remove em seguida (o delete não apaga arquivos do bucket).

create or replace function public.zerar_empresa(p_empresa uuid)
returns text[]
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_esc uuid;
  v_caller_papel text;
  v_paths text[];
begin
  select escritorio_id into v_esc from empresas where id = p_empresa;
  if v_esc is null then
    raise exception 'Empresa não encontrada';
  end if;

  -- Apenas dono ou admin do escritório da empresa pode zerar os dados.
  select papel into v_caller_papel
  from membros
  where user_id = auth.uid() and escritorio_id = v_esc;

  if v_caller_papel is null or v_caller_papel not in ('owner', 'admin') then
    raise exception 'Sem permissão para apagar os dados desta empresa';
  end if;

  -- Caminhos dos documentos no Storage, coletados antes de apagar.
  select coalesce(array_agg(arquivo_path) filter (where arquivo_path is not null), '{}')
  into v_paths
  from documentos_recebidos
  where empresa_id = p_empresa;

  -- Conciliação primeiro (liga conta e transação) para não travar as FKs abaixo.
  delete from conciliacao_links
  where conta_id in (select id from contas_bancarias where empresa_id = p_empresa)
     or transacao_id in (select id from transacoes_extrato where empresa_id = p_empresa);

  -- Movimentos e derivados.
  delete from cnab_remessas       where empresa_id = p_empresa;
  delete from analises_ia         where empresa_id = p_empresa;
  delete from documentos_recebidos where empresa_id = p_empresa;
  delete from transacoes_extrato  where empresa_id = p_empresa;
  delete from lancamentos         where empresa_id = p_empresa;

  return v_paths;
end;
$function$;

grant execute on function public.zerar_empresa(uuid) to authenticated;

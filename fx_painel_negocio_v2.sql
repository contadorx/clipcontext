-- FinanceiroX — Painel do negócio v2.
-- Única mudança em relação à versão anterior: cada item da lista de escritórios
-- passa a trazer "proximo_vencimento", para a coluna "Próx. venc." no cockpit.
-- Tudo o mais é idêntico. CREATE OR REPLACE — seguro rodar de novo.

create or replace function public.painel_negocio()
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v json;
begin
  if not public.is_super_admin() then
    return null;
  end if;

  select json_build_object(
    'mrr', coalesce((select sum(valor_mensal) from escritorios where assinatura_status = 'ativa' and is_teste = false), 0),
    'mrr_potencial', coalesce((select sum(valor_mensal) from escritorios where assinatura_status = 'selecionada' and is_teste = false), 0),
    'total', (select count(*) from escritorios where is_teste = false),
    'ativa', (select count(*) from escritorios where assinatura_status = 'ativa' and is_teste = false),
    'trial', (select count(*) from escritorios where assinatura_status = 'trial' and is_teste = false),
    'selecionada', (select count(*) from escritorios where assinatura_status = 'selecionada' and is_teste = false),
    'cancelada', (select count(*) from escritorios where assinatura_status = 'cancelada' and is_teste = false),
    'teste', (select count(*) from escritorios where is_teste = true),
    'novos_30d', (select count(*) from escritorios where criado_em >= now() - interval '30 days' and is_teste = false),
    'por_ciclo', json_build_object(
      'mensal', (select count(*) from escritorios where ciclo_cobranca = 'mensal' and is_teste = false),
      'semestral', (select count(*) from escritorios where ciclo_cobranca = 'semestral' and is_teste = false),
      'anual', (select count(*) from escritorios where ciclo_cobranca = 'anual' and is_teste = false)
    ),
    'serie', coalesce((
      select json_agg(json_build_object('mes', m, 'novos', n) order by m)
      from (
        select to_char(date_trunc('month', criado_em), 'YYYY-MM') as m, count(*) as n
        from escritorios
        where criado_em >= date_trunc('month', now()) - interval '5 months' and is_teste = false
        group by 1
      ) t
    ), '[]'::json),
    'lista', coalesce((
      select json_agg(json_build_object(
        'id', e.id,
        'nome', e.nome,
        'status', e.assinatura_status,
        'ciclo', e.ciclo_cobranca,
        'valor_mensal', e.valor_mensal,
        'criado_em', e.criado_em,
        'proximo_vencimento', e.proximo_vencimento,
        'is_teste', e.is_teste,
        'empresas', (select count(*) from empresas em where em.escritorio_id = e.id)
      ) order by e.is_teste asc, e.criado_em desc)
      from escritorios e
    ), '[]'::json)
  ) into v;

  return v;
end;
$function$;

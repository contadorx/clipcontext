-- O CONVITE DE ASSENTO GANHA LIMITE, E ELE NÃO É O DO OUTRO CONVITE
--
-- O `walkstamp_convite_pode` serve o `/api/convite` — o "indique a ferramenta a
-- um colega", que é aberto ao mundo: 5 por hora por origem, 2 por dia por
-- destino.
--
-- O convite de ASSENTO é outro caso. Quem chama está autenticado, paga, e o
-- número de assentos já limita quantas pessoas distintas entram — a
-- `time_convidar` recusa com `sem_assento`. Reaproveitar o 5/hora aqui quebraria
-- justamente a funcionalidade que o cartão Team vende: um time de 25 assentos
-- levaria CINCO HORAS para ser montado.
--
-- Sobra um abuso, e é real: reconvidar o mesmo endereço não gasta assento (o
-- insert é `on conflict do update`), então daria para mandar carta para a mesma
-- pessoa a tarde inteira. Por isso:
--
--   60 por hora por administrador  — folga para montar um time numa sentada, e
--                                    ainda assim um teto para um laço em fuga;
--    2 por dia por destino         — o MESMO número do outro convite, porque a
--                                    regra que ele protege é a mesma: não usar
--                                    o convite para incomodar alguém.
--
-- Mesma tabela e mesma forma: hashes com sal do ambiente, conferência e
-- registro na MESMA transação — conferir num lugar e registrar em outro abre a
-- janela entre os dois, e dois pedidos simultâneos passariam pelos dois testes
-- antes de qualquer um registrar.

create or replace function public.walkstamp_convite_assento_pode(p_quem text, p_para text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  n_quem int;
  n_para int;
begin
  select count(*) into n_quem
    from public.convite_envio
   where ip_hash = p_quem and criado_em > now() - interval '1 hour';
  if n_quem >= 60 then return false; end if;

  select count(*) into n_para
    from public.convite_envio
   where para_hash = p_para and criado_em > now() - interval '1 day';
  if n_para >= 2 then return false; end if;

  insert into public.convite_envio (ip_hash, para_hash) values (p_quem, p_para);
  return true;
end;
$$;

comment on function public.walkstamp_convite_assento_pode(text, text) is
  'Limite do convite de assento: 60/hora por administrador, 2/dia por destino. '
  'Diferente do walkstamp_convite_pode, que serve o convite aberto do site.';

-- Regra de servidor, e só de servidor. Se o navegador pudesse chamar, bastaria
-- chamar com hashes inventados para zerar o limite a cada pedido.
revoke all on function public.walkstamp_convite_assento_pode(text, text) from public, anon, authenticated;
grant execute on function public.walkstamp_convite_assento_pode(text, text) to service_role;

-- A trava do projeto: nenhuma função de servidor pode ficar aberta ao navegador.
do $$
declare aberta text;
begin
  select string_agg(p.proname, ', ') into aberta
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'walkstamp_convite_assento_pode'
     and (has_function_privilege('anon', p.oid, 'EXECUTE')
       or has_function_privilege('authenticated', p.oid, 'EXECUTE'));
  if aberta is not null then
    raise exception 'a função do convite de assento ficou aberta para o navegador: %', aberta;
  end if;
end $$;

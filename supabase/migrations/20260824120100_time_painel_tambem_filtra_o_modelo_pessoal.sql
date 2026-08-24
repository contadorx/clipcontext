-- A MESMA CORREÇÃO, NA OUTRA FUNÇÃO — e ela era metade do defeito.
--
-- A migração anterior filtrou `perfil_do_usuario`, que alimenta a FERRAMENTA, e
-- deixou `time_painel` como estava — e é ela que alimenta a CONTA. Quer dizer
-- que o vazamento continuava de pé no painel: quem administra abria a lista de
-- modelos e via o "só para mim" de cada colega.
--
-- Consertar uma das duas e achar que acabou é o defeito que este projeto mais
-- pagou, com outra roupa: a mesma verdade em dois lugares, corrigida em um.
--
-- E a lista passa a dizer `meu`, para a TELA saber o que o banco já sabe: sem
-- isso, o botão "Apagar" aparece em cima do modelo alheio e a pessoa descobre
-- que não pode clicando.

create or replace function walkstamp.time_painel(p_admin text)
returns jsonb
language plpgsql security definer set search_path to 'walkstamp','public'
as $$
declare
  a text := lower(btrim(p_admin));
  u walkstamp.usuario%rowtype;
  c walkstamp.cliente%rowtype;
begin
  select * into u from walkstamp.usuario where email = a and papel = 'admin';
  if not found or u.cliente_id is null then return null; end if;
  select * into c from walkstamp.cliente where id = u.cliente_id;
  if not found then return null; end if;

  return jsonb_build_object(
    'cliente_id', c.id, 'cliente', c.nome, 'documento', c.documento,
    'plano', c.plano, 'assentos', c.assentos, 'dias', c.dias, 'ativo', c.ativo,
    'admin', a,
    'dominios', (select coalesce(jsonb_agg(d.dominio order by d.dominio), '[]'::jsonb)
                   from walkstamp.dominio d where d.cliente_id = c.id and d.ativo),
    'usados', (select count(*) from walkstamp.usuario x where x.cliente_id = c.id and x.ativo),
    'pessoas', (select coalesce(jsonb_agg(jsonb_build_object(
                  'email', x.email, 'papel', x.papel, 'emissoes', x.emissoes,
                  'ultima_em', x.ultima_em, 'vence_em', x.vence_em, 'ativo', x.ativo,
                  'convidado_por', x.convidado_por,
                  'admin', x.email = a) order by x.email), '[]'::jsonb)
                  from walkstamp.usuario x where x.cliente_id = c.id),
    'faturas', (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', f.id, 'numero', f.numero, 'competencia', f.competencia,
                  'valor_centavos', f.valor_centavos, 'moeda', f.moeda,
                  'status', f.status, 'vence_em', f.vence_em, 'pago_em', f.pago_em,
                  'nf_url', f.nf_url, 'nf_numero', f.nf_numero)
                  order by f.competencia desc nulls last, f.id desc), '[]'::jsonb)
                  from walkstamp.fatura f where f.cliente_id = c.id),
    'emissoes', (select coalesce(jsonb_agg(jsonb_build_object(
                  'email', em.email, 'vence_em', em.vence_em, 'dias', em.dias,
                  'criado_em', em.criado_em) order by em.criado_em desc), '[]'::jsonb)
                  from (select * from walkstamp.emissao
                         where cliente_id = c.id order by criado_em desc limit 50) em),
    'config', (select coalesce(to_jsonb(cf) - 'cliente_id', '{}'::jsonb)
                 from walkstamp.config cf where cf.cliente_id = c.id),
    /* Os do time, mais os DESTA pessoa. E `meu` dito na resposta, para a tela
       não precisar adivinhar de quem é cada linha. */
    'modelos', (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', m.id, 'nome', m.nome, 'escopo', m.escopo, 'dados', m.dados,
                  'meu', m.escopo = 'personal' and m.dono_email = a)
                  order by m.nome), '[]'::jsonb)
                  from walkstamp.modelo_doc m
                 where m.cliente_id = c.id
                   and (m.escopo = 'time' or m.dono_email = a)));
end $$;

-- O ENDEREÇO DA FATURA DEIXA DE SER JOGADO FORA.
--
-- A página de preços promete "faturas para baixar". O webhook da Stripe faz a
-- parte dele: manda `p_url: f.hosted_invoice_url` a cada evento de fatura.
--
-- E a função recebia esse parâmetro e NUNCA O USAVA — nem no `insert`, nem no
-- `on conflict`. O `p_url` estava na assinatura, e só. A tabela não tinha coluna
-- para ele. Quer dizer: o endereço da fatura chegava ao banco a cada cobrança e
-- morria ali, silenciosamente, desde a primeira venda.
--
-- Um parâmetro que ninguém lê é pior que um parâmetro que não existe: quem
-- escreveu o webhook tinha razão em achar que estava mandando a informação para
-- algum lugar.
--
-- `fatura_url` e não `nf_url`: são documentos DIFERENTES. A `nf_url` é a nota
-- fiscal, que sai do Financeirox depois do pagamento e é o que a contabilidade
-- brasileira pede. Esta é a fatura da Stripe — o recibo do cartão. Guardar uma
-- no campo da outra faria a tela mostrar "nota fiscal" apontando para um recibo
-- em inglês, que é pior do que não mostrar nada.

alter table walkstamp.fatura add column if not exists fatura_url text;

comment on column walkstamp.fatura.fatura_url is
  'O endereço da fatura na Stripe (hosted_invoice_url). NÃO é a nota fiscal: '
  'essa é a nf_url, sai do Financeirox e é outro documento.';

create or replace function walkstamp.fatura_da_stripe(
  p_stripe_id text, p_stripe_cliente text, p_email text, p_numero text,
  p_valor integer, p_moeda text, p_status text, p_vence date, p_url text)
returns jsonb
language plpgsql security definer set search_path to 'walkstamp','public'
as $$
declare cid bigint;
begin
  -- 1) pelo customer da Stripe, que é o vínculo forte
  select id into cid from walkstamp.cliente where stripe_id = p_stripe_cliente and p_stripe_cliente <> '';
  -- 2) pelo e-mail do pagador, se ele já for usuário
  if cid is null and coalesce(p_email,'') <> '' then
    select u.cliente_id into cid from walkstamp.usuario u where u.email = lower(p_email);
    if cid is not null and coalesce(p_stripe_cliente,'') <> '' then
      update walkstamp.cliente set stripe_id = p_stripe_cliente
       where id = cid and (stripe_id is null or stripe_id = '');
    end if;
  end if;
  /* Sem cliente identificado a fatura NÃO é inventada: uma linha órfã na tela
     de alguém é pior que uma fatura faltando, que ao menos é perguntada. */
  if cid is null then return jsonb_build_object('erro','cliente_desconhecido'); end if;

  insert into walkstamp.fatura (cliente_id, numero, competencia, valor_centavos, moeda,
                                status, vence_em, pago_em, stripe_id, fatura_url)
  values (cid, p_numero, current_date, greatest(coalesce(p_valor,0),0),
          coalesce(p_moeda,'BRL'), p_status, p_vence,
          case when p_status = 'paga' then now() else null end, p_stripe_id,
          nullif(btrim(coalesce(p_url,'')), ''))
  on conflict (stripe_id) do update
    set status  = excluded.status,
        numero  = coalesce(excluded.numero, walkstamp.fatura.numero),
        valor_centavos = excluded.valor_centavos,
        vence_em = coalesce(excluded.vence_em, walkstamp.fatura.vence_em),
        /* O endereço só é substituído quando vem um novo. A Stripe reenvia o
           mesmo evento quando não recebe 2xx, e um reenvio sem `hosted_invoice_url`
           apagaria o link que a cobrança anterior já tinha trazido. */
        fatura_url = coalesce(excluded.fatura_url, walkstamp.fatura.fatura_url),
        pago_em = case when excluded.status = 'paga'
                       then coalesce(walkstamp.fatura.pago_em, now())
                       else walkstamp.fatura.pago_em end;
  return jsonb_build_object('ok', true, 'cliente_id', cid);
end $$;

-- A PROVA DOS TETOS, e ela REPROVA em vez de narrar.
--
-- A `prova_do_chamado` do dia 16 usa `raise notice` — ela conta o que aconteceu
-- e passa de qualquer jeito. Uma prova que não sabe reprovar é documentação com
-- roupa de teste. Esta levanta exceção, e a migração falha.
--
-- O que ela cobra, e a terceira é a que dá nome ao build: uma enxurrada de um
-- ator NÃO fecha a porta de quem não tem nada a ver com ela.
--
-- Ela gasta números da sequência de chamados. É de propósito e não tem volta:
-- `nextval` não obedece a transação, então os números saem furados. Barato
-- perto de descobrir em produção que o teto não vale.
do $$
declare
  num text; r jsonb; i integer; bloqueou boolean;
  a text := 'prova-teto-a@exemplo.invalido';
  b text := 'prova-teto-b@exemplo.invalido';
begin
  delete from walkstamp.tentativa where chave like 'ver:%' or chave like 'recado:%';

  -- ---- 1. consultar: dez tentativas, e a décima primeira não ----
  bloqueou := false;
  for i in 1..10 loop
    r := walkstamp.chamado_ver('WS-0001', a);
    if r->>'erro' = 'muitas_tentativas' then
      raise exception 'a consulta % de 10 ja foi barrada: teto apertado demais', i;
    end if;
  end loop;
  r := walkstamp.chamado_ver('WS-0001', a);
  if r->>'erro' is distinct from 'muitas_tentativas' then
    raise exception 'a 11a consulta passou: %', r;
  end if;
  raise notice '1 consulta: 10 passam, a 11a e barrada';

  -- ---- 2. e o teto da consulta é POR E-MAIL ----
  -- Sem isto, quem varre WS-0001..WS-9999 contra um endereço tranca a consulta
  -- de todo mundo — trocando uma porta aberta por uma porta emperrada.
  r := walkstamp.chamado_ver('WS-0001', b);
  if r->>'erro' = 'muitas_tentativas' then
    raise exception 'o teto da consulta vazou de um e-mail para o outro';
  end if;
  raise notice '2 consulta: o teto de um e-mail nao alcanca o outro';

  -- ---- 3. abrir: cinco por minuto, e o SEXTO nao ----
  for i in 1..5 loop
    num := walkstamp.recado_novo('problema', 'prova de teto ' || i, a, null, 'pt', null, 'app', null);
    if num = 'muitos' then
      raise exception 'a abertura % de 5 ja foi barrada', i;
    end if;
  end loop;
  num := walkstamp.recado_novo('problema', 'prova de teto 6', a, null, 'pt', null, 'app', null);
  if num is distinct from 'muitos' then
    raise exception 'a 6a abertura passou: %', num;
  end if;
  raise notice '3 abertura: 5 passam, a 6a e barrada';

  -- ---- 4. O ITEM DO BUILD: o balde de um nao esvazia o do outro ----
  num := walkstamp.recado_novo('problema', 'de outro endereco', b, null, 'pt', null, 'app', null);
  if num = 'muitos' then
    raise exception 'o ator que estourou o proprio teto fechou a porta do vizinho';
  end if;
  raise notice '4 abertura: quem estourou o teto nao fecha a porta do vizinho (%)', num;

  -- ---- 5. quem nao deixa e-mail tem faixa propria, e ela e estreita ----
  for i in 1..10 loop
    num := walkstamp.recado_novo('ideia', 'anonimo ' || i, '', null, 'pt', null, 'site', null);
  end loop;
  num := walkstamp.recado_novo('ideia', 'anonimo 11', '', null, 'pt', null, 'site', null);
  if num is distinct from 'muitos' then
    raise exception 'o balde anonimo nao tem teto: %', num;
  end if;
  -- e ele NAO consumiu o de quem se identificou
  delete from walkstamp.tentativa where chave = 'recado:' || md5(b);
  num := walkstamp.recado_novo('problema', 'identificado depois da enxurrada', b, null, 'pt', null, 'app', null);
  if num = 'muitos' then
    raise exception 'a enxurrada anonima fechou a porta de quem se identificou';
  end if;
  raise notice '5 anonimo: tem teto proprio, e nao consome o de quem se identifica';

  -- ---- limpeza ----
  delete from walkstamp.recado
   where email in (a, b)
      or (email is null and texto like 'anonimo %');
  delete from walkstamp.tentativa where chave like 'ver:%' or chave like 'recado:%';
  raise notice 'tetos do chamado: tudo provado';
end $$;

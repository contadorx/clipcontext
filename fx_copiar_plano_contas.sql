-- fx_copiar_plano_contas.sql
-- Copia o plano de contas (grupos + categorias) de uma empresa para outra do
-- mesmo escritório. Usado no onboarding "Configurar cliente" para começar um
-- cliente novo a partir de um parecido. A empresa destino precisa estar sem
-- lançamentos, orçamento, regras de conciliação, vendas ou contratos — ou seja,
-- não destrói um plano já em uso. Seguro rodar mais de uma vez (uma chamada por
-- transação, que é como o PostgREST executa).
--
-- As recorrências do destino NÃO são apagadas: elas são soltas da categoria
-- antiga e religadas por nome à categoria equivalente do plano novo. O que não
-- casar fica sem categoria, visível na tela de Recorrências.

create or replace function copiar_plano_contas(p_origem uuid, p_destino uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sem usuário autenticado.';
  end if;
  if p_origem = p_destino then
    raise exception 'Origem e destino são a mesma empresa.';
  end if;

  -- o usuário precisa ter acesso às duas empresas (mesmo escritório)
  if not exists (
    select 1 from empresas e
    join membros m on m.escritorio_id = e.escritorio_id and m.user_id = auth.uid()
    where e.id = p_origem
  ) then
    raise exception 'Sem permissão na empresa de origem.';
  end if;
  if not exists (
    select 1 from empresas e
    join membros m on m.escritorio_id = e.escritorio_id and m.user_id = auth.uid()
    where e.id = p_destino
  ) then
    raise exception 'Sem permissão na empresa de destino.';
  end if;

  /*
    Não sobrescrever um plano já em uso — e "em uso" é mais que lançamento.

    O guard olhava só `lancamentos`. Mas `categorias.id` também é apontado por
    `orcamentos`, `conciliacao_regras`, `vendas` e `contratos`, e nenhum deles
    exige lançamento para existir: dá para montar o orçamento anual e as regras
    de conciliação num cliente novo antes do primeiro lançamento. O `delete from
    categorias` batia na FK e abortava com mensagem do Postgres em inglês — ou,
    se a FK fosse `on delete cascade`, levava o orçamento junto em silêncio.
  */
  if exists (select 1 from lancamentos where empresa_id = p_destino) then
    raise exception 'A empresa de destino já tem lançamentos; não dá para substituir o plano.';
  end if;
  if exists (select 1 from orcamentos where empresa_id = p_destino) then
    raise exception 'A empresa de destino já tem orçamento montado; apague o orçamento antes de substituir o plano.';
  end if;
  if exists (select 1 from conciliacao_regras where empresa_id = p_destino) then
    raise exception 'A empresa de destino já tem regras de conciliação; apague as regras antes de substituir o plano.';
  end if;
  if exists (select 1 from vendas where empresa_id = p_destino) then
    raise exception 'A empresa de destino já tem vendas; não dá para substituir o plano.';
  end if;
  if exists (select 1 from contratos where empresa_id = p_destino) then
    raise exception 'A empresa de destino já tem contratos; não dá para substituir o plano.';
  end if;

  /*
    Solta as recorrências das categorias antigas — sem apagá-las.

    Aqui havia `delete from recorrencias`, e o texto ao lado do botão na tela
    dizia, literalmente, que copiar o plano "não copia contas, recorrências,
    portal nem NFS-e". Ele estava certo sobre não COPIAR e calado sobre APAGAR:
    um clique num botão de onboarding levava junto todo o cadastro de aluguel,
    mensalidades e assinaturas que a pessoa tinha acabado de fazer. Sem
    confirmação e sem volta.

    O `delete` existia por causa da FK para `categorias`. Soltar o vínculo
    resolve a FK e preserva a recorrência; e como as categorias novas vêm da
    empresa de origem, quase sempre existe uma com o mesmo nome — o religamento
    abaixo devolve a categoria certa. O que não casar fica SEM categoria e passa
    a lançar em "Sem categoria" — a tela de Recorrências mostra isso, mas não
    tem seletor de categoria, então o conserto é recadastrar aquela recorrência.
    Perder a categoria é chato; perder a recorrência é dinheiro que deixa de ser
    cobrado.
  */
  /*
    Guarda também o GRUPO da categoria antiga.

    `categorias.nome` só é único dentro do grupo: "Aluguel" pode existir em
    Operacional e em Financiamento. Religar só por nome e tipo casaria duas
    linhas, o Postgres escolheria uma arbitrariamente e sem erro, e a
    recorrência voltaria pendurada no grupo errado — distorcendo DFC e DRE em
    silêncio, que é o tipo de estrago que ninguém liga à ação que o causou.
  */
  drop table if exists _rec_cat;
  create temporary table _rec_cat on commit drop as
  select
    r.id as recorrencia_id,
    c.nome as categoria_nome,
    c.tipo as categoria_tipo,
    g.nome as grupo_nome,
    g.secao as grupo_secao
  from recorrencias r
  join categorias c on c.id = r.categoria_id
  join grupos_categoria g on g.id = c.grupo_id
  where r.empresa_id = p_destino;

  update recorrencias set categoria_id = null where empresa_id = p_destino;

  -- limpa o plano atual do destino
  delete from categorias where empresa_id = p_destino;
  delete from grupos_categoria where empresa_id = p_destino;

  -- copia os grupos
  insert into grupos_categoria (empresa_id, nome, secao, eh_receita, ordem)
  select p_destino, nome, secao, eh_receita, ordem
  from grupos_categoria
  where empresa_id = p_origem;

  -- copia as categorias, religando ao grupo correspondente por nome + seção
  insert into categorias (empresa_id, nome, grupo_id, tipo, codigo_contabil)
  select
    p_destino,
    c.nome,
    (select gd.id
       from grupos_categoria gd
       join grupos_categoria gsrc on gsrc.id = c.grupo_id
       where gd.empresa_id = p_destino
         and gd.nome = gsrc.nome
         and gd.secao = gsrc.secao
       limit 1),
    c.tipo,
    c.codigo_contabil
  from categorias c
  where c.empresa_id = p_origem;

  -- religa as recorrências à categoria de mesmo nome e tipo no plano novo
  update recorrencias r
  set categoria_id = c.id
  from _rec_cat rc
  join grupos_categoria g
    on g.empresa_id = p_destino
   and g.nome = rc.grupo_nome
   and g.secao = rc.grupo_secao
  join categorias c
    on c.empresa_id = p_destino
   and c.grupo_id = g.id
   and c.nome = rc.categoria_nome
   and c.tipo = rc.categoria_tipo
  where r.id = rc.recorrencia_id;
end;
$$;

grant execute on function copiar_plano_contas(uuid, uuid) to authenticated;

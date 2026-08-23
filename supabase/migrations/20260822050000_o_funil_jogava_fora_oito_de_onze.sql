-- O FUNIL JOGAVA FORA OITO DE ONZE EVENTOS, E DOIS DE CINCO IDIOMAS
--
-- Medindo para responder "o inglês abre e não converte", apareceu que a
-- pergunta estava mal-posta: o problema não era o inglês.
--
-- O produto chama `medir()` com ONZE nomes de evento. A tabela aceitava TRÊS
-- (`abriu_ferramenta`, `carregou_video`, `baixou_saida`). Os outros oito
-- morriam de três jeitos diferentes, todos silenciosos:
--
--   * `nova_sessao`, `novo_fluxo`, `ativou_licenca` e `faxina_recomendada`
--     chegavam à função e batiam no `check` do nome. A função captura
--     `check_violation` e volta calada — de propósito, para uma medição
--     recusada não virar erro na tela de ninguém. O efeito colateral é que
--     ninguém nunca soube;
--   * `transcricao_arquivo`, `trocou_modo`, `parou_fala` e `recado` nem
--     chegavam: eles mandavam parâmetros que a função não tem (`p_de`,
--     `p_para`, `p_pct`, `p_via`, `p_telas`), e o PostgREST responde que a
--     função não existe. Zero linhas, zero erro visível;
--   * e o `baixou_saida` só passava em cinco formatos. `pptx`, `html`, `md`,
--     `csv`, `gdocs`, `jira` e `vocabulario` batiam no `check` do formato e
--     levavam o evento inteiro junto — não é que o formato ficasse nulo, é que
--     a linha não entrava.
--
-- E o pior: `idioma` aceitava `pt`, `en` e `es`. O site tem CINCO idiomas.
-- Todo evento em alemão e em francês foi descartado desde sempre — o que
-- explica, sem nenhuma teoria sobre tráfego, por que `de` e `fr` têm zero
-- eventos enquanto as páginas existem e estão no sitemap.
--
-- ESTA MIGRAÇÃO NÃO INVENTA MEDIÇÃO NOVA. Ela faz o banco aceitar o que o
-- produto já mandava, com vocabulário fechado em cada campo — e acrescenta os
-- quatro eventos de intenção paga, que é o que faltava para saber se alguém
-- chega perto de comprar.
--
-- O que continua valendo, e é a razão de tudo ser vocabulário fechado: nenhum
-- evento carrega identificador, IP, navegador, nome de arquivo, caso, sistema
-- ou conteúdo. O que não estiver escrito aqui não entra.

-- ------------------------------------------------------------- as colunas
-- `faixa` no lugar de contagem exata. Dois eventos queriam mandar número — a
-- porcentagem transcrita antes da parada e quantas telas a faxina achou. A
-- faixa responde a mesma pergunta de produto e não desenha ninguém.
alter table walkstamp.evento add column if not exists faixa text;
-- `plano` só nos eventos de intenção paga, e é o RÓTULO do plano, não a conta.
alter table walkstamp.evento add column if not exists plano text;

-- ------------------------------------------------------ os vocabulários
alter table walkstamp.evento drop constraint if exists evento_nome_check;
alter table walkstamp.evento add constraint evento_nome_check check (nome in (
  -- o funil de sempre
  'abriu_ferramenta', 'carregou_video', 'baixou_saida',
  -- o que o produto já mandava e o banco recusava
  'transcricao_arquivo', 'ativou_licenca', 'trocou_modo', 'recado',
  'parou_fala', 'novo_fluxo', 'nova_sessao', 'faxina_recomendada',
  -- a intenção paga: onde o roteiro começa, onde ele termina, e a compra
  'importou_roteiro', 'concluiu_caso', 'comecou_teste', 'comecou_pagamento'
));

alter table walkstamp.evento drop constraint if exists evento_idioma_check;
alter table walkstamp.evento add constraint evento_idioma_check check (
  idioma is null or idioma in ('pt', 'en', 'es', 'de', 'fr'));

alter table walkstamp.evento drop constraint if exists evento_formato_check;
alter table walkstamp.evento add constraint evento_formato_check check (
  formato is null or formato in (
    -- as saídas de documento, todas as que a ferramenta oferece
    'pdf', 'docx', 'pptx', 'html', 'md', 'csv', 'json', 'zip', 'vtt', 'srt',
    'scorm', 'gdocs', 'jira', 'vocabulario',
    -- e de onde veio a transcrição colada, que é outra pergunta com o mesmo nome
    'blocos', 'linhas', 'sem_tempo'));

alter table walkstamp.evento drop constraint if exists evento_origem_check;
alter table walkstamp.evento add constraint evento_origem_check check (
  origem is null or origem in (
    'arquivo', 'drive', 'gravacao', 'exemplo',   -- de onde veio o vídeo
    'espera', 'link',                            -- sessão nova, licença por link
    'placa', 'modelo',                           -- o que a troca de motor trocou
    'ideia', 'elogio', 'problema',               -- que tipo de recado
    'conta', 'ferramenta'));                     -- onde a intenção paga começou

alter table walkstamp.evento drop constraint if exists evento_faixa_check;
alter table walkstamp.evento add constraint evento_faixa_check check (
  faixa is null or faixa in ('0-24', '25-49', '50-74', '75-100',
                             '1-3', '4-10', '11-30', '31+'));

alter table walkstamp.evento drop constraint if exists evento_plano_check;
alter table walkstamp.evento add constraint evento_plano_check check (
  plano is null or plano in ('free', 'personal', 'time'));

-- ------------------------------------------------------------- a função
-- UMA SÓ, E NÃO DUAS.
--
-- A primeira versão desta migração deixava a antiga de pé e criava uma
-- sobrecarga, para o `app.html` no cache do navegador de quem já usou continuar
-- medindo. O raciocínio estava certo e a solução, errada: com as duas
-- existindo, uma chamada de três argumentos não resolve para nenhuma —
-- "function walkstamp_evento(unknown, unknown, unknown) is not unique". A prova
-- de comportamento pegou na hora; em produção, o PostgREST responde a mesma
-- ambiguidade e a medição inteira para.
--
-- E a sobrecarga era desnecessária: os dois campos novos entram com `default
-- null`, então uma aba antiga mandando os quatro nomes de sempre continua
-- caindo nesta função sem mudar uma vírgula. `create or replace` sozinho não
-- daria conta — parâmetro novo muda a assinatura —, então a antiga sai
-- explicitamente.
drop function if exists public.walkstamp_evento(text,text,text,text);

create or replace function public.walkstamp_evento(
  p_nome text, p_formato text default null, p_idioma text default null,
  p_origem text default null, p_faixa text default null, p_plano text default null)
returns void language plpgsql security definer set search_path to '' as $$
begin
  insert into walkstamp.evento (nome, formato, idioma, origem, faixa, plano)
  values (p_nome, nullif(p_formato,''), nullif(p_idioma,''), nullif(p_origem,''),
          nullif(p_faixa,''), nullif(p_plano,''));
exception when check_violation then
  return;   -- evento fora do vocabulário é ignorado, não é erro na tela de ninguém
end $$;

grant execute on function
  public.walkstamp_evento(text,text,text,text,text,text) to anon, authenticated;

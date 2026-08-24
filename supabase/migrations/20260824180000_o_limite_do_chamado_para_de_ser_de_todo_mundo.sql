-- O LIMITE DE CHAMADO DEIXA DE SER UM BALDE ÚNICO, E A CONSULTA GANHA TETO.
--
-- Dois defeitos, o mesmo lugar.
--
-- 1. ABRIR. A trava era:
--
--      select count(*) from walkstamp.recado
--       where criado_em > now() - interval '1 minute' >= 30
--
--    Ela conta os recados DE TODO MUNDO. Trinta por minuto vindos de um ator só
--    fecham a caixa de entrada do produto inteiro — quem tem um problema de
--    verdade recebe "muitos" e vai embora. Um limite que qualquer um pode
--    esgotar para os outros não protege: ele transfere o estrago.
--
--    Agora são três baldes, do mais estreito ao mais largo:
--      - por e-mail: cinco por minuto. É o caminho de quem quer resposta;
--      - anônimo: dez por minuto no total, porque quem não deixa e-mail não tem
--        como ser separado de outro que também não deixou. Ele fica numa faixa
--        própria e NÃO consome a de quem se identificou;
--      - global: trezentos por minuto, e isso é rede contra enxurrada, não
--        limite de uso.
--
--    O QUE ISTO NÃO RESOLVE, e está dito para ninguém achar que resolve: o
--    e-mail não é verificado na abertura. Quem trocar de endereço a cada envio
--    ganha um balde novo a cada envio, e cai só no teto global. Fechar aquilo
--    exige identificar quem chama — e quem chama é o navegador, direto no
--    PostgREST, sem servidor nosso no caminho para ver o IP. O ganho real aqui
--    é outro, e é o que estava quebrado: uma enxurrada deixa de derrubar a
--    caixa de quem não tem nada a ver com ela.
--
-- 2. CONSULTAR. `chamado_ver` exige número E e-mail — isso está certo, e o
--    comentário original já dizia por quê. O que faltava era teto de tentativa:
--    o número é sequencial de quatro dígitos (`WS-0001`), então quem souber o
--    e-mail de alguém — e e-mail de trabalho não é segredo — varre WS-0001 a
--    WS-9999 e lê o que a pessoa escreveu, sem nada no caminho.
--
--    Dez tentativas por e-mail a cada dez minutos. Quem consulta o próprio
--    chamado faz uma ou duas; nove mil e novecentas passam a levar um mês.
--
--    A tabela guarda o MD5 do e-mail, e não o e-mail. Não é sigilo — o e-mail
--    de quem abriu chamado já está na `recado` ao lado. É para que a tabela não
--    vire uma lista NOVA: a de endereços que alguém tentou consultar, que
--    inclui os de quem nunca abriu chamado nenhum.

create table if not exists walkstamp.tentativa (
  chave  text primary key,
  n      integer not null default 0,
  desde  timestamptz not null default now()
);
create index if not exists tentativa_desde_ix on walkstamp.tentativa (desde);
alter table walkstamp.tentativa enable row level security;

-- Conta uma tentativa e diz se ela cabe. A janela é deslizante por reinício:
-- passou o tempo, o contador zera e recomeça.
create or replace function walkstamp.tentar(p_chave text, p_teto integer, p_janela interval)
returns boolean
language plpgsql security definer set search_path to 'walkstamp','public'
as $$
declare atual walkstamp.tentativa%rowtype;
begin
  -- Some o que já não conta para ninguém. O índice em `desde` mantém isto
  -- barato, e sem esta linha a tabela cresce com cada endereço já sondado.
  delete from walkstamp.tentativa where desde < now() - interval '1 day';

  insert into walkstamp.tentativa (chave, n, desde)
  values (p_chave, 1, now())
  on conflict (chave) do update
     set n = case when walkstamp.tentativa.desde < now() - p_janela
                  then 1 else walkstamp.tentativa.n + 1 end,
         desde = case when walkstamp.tentativa.desde < now() - p_janela
                      then now() else walkstamp.tentativa.desde end
  returning * into atual;

  return atual.n <= p_teto;
end $$;

-- ---------------------------------------------------------------- abrir ---

create or replace function walkstamp.recado_novo(
  p_tipo text, p_texto text, p_email text, p_nota integer,
  p_idioma text, p_cenario text, p_origem text, p_diag text)
returns text
language plpgsql security definer set search_path to 'walkstamp','public'
as $$
declare
  txt text := btrim(coalesce(p_texto, ''));
  em  text := lower(btrim(coalesce(p_email, '')));
  valido boolean;
  num text;
begin
  if length(txt) < 2 then return 'vazio'; end if;

  valido := em ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$';

  -- A rede contra enxurrada, e só ela é global.
  if (select count(*) from walkstamp.recado
       where criado_em > now() - interval '1 minute') >= 300 then
    return 'muitos';
  end if;

  -- O balde de quem se identificou é dele. O de quem não se identificou é
  -- compartilhado — e é por isso que ele é o mais estreito dos dois.
  if valido then
    if not walkstamp.tentar('recado:' || md5(em), 5, interval '1 minute') then
      return 'muitos';
    end if;
  else
    if not walkstamp.tentar('recado:anonimo', 10, interval '1 minute') then
      return 'muitos';
    end if;
  end if;

  num := 'WS-' || lpad(nextval('walkstamp.chamado_seq')::text, 4, '0');

  insert into walkstamp.recado (numero, tipo, texto, email, nota, idioma, cenario, origem, diagnostico)
  values (num,
          case when p_tipo in ('ideia','elogio','problema') then p_tipo else 'problema' end,
          left(txt, 4000),
          case when valido then em else null end,
          case when p_nota between 0 and 10 then p_nota else null end,
          left(coalesce(p_idioma,''), 8), left(coalesce(p_cenario,''), 40),
          case when p_origem = 'site' then 'site' else 'app' end,
          left(coalesce(p_diag,''), 12000));
  return num;
end $$;

-- -------------------------------------------------------------- consultar ---

create or replace function walkstamp.chamado_ver(p_numero text, p_email text)
returns jsonb
language plpgsql security definer set search_path to 'walkstamp','public'
as $$
declare
  r walkstamp.recado%rowtype;
  em text := lower(btrim(coalesce(p_email,'')));
begin
  -- O TETO VEM ANTES DA CONSULTA, e conta a tentativa mesmo quando ela erra —
  -- contar só os acertos seria contar exatamente o que a varredura não faz.
  if not walkstamp.tentar('ver:' || md5(em), 10, interval '10 minutes') then
    return jsonb_build_object('erro','muitas_tentativas');
  end if;

  select * into r from walkstamp.recado
   where upper(btrim(coalesce(p_numero,''))) = upper(numero)
     and email is not null
     and email = em;
  if not found then return jsonb_build_object('erro','nao_achei'); end if;
  return jsonb_build_object(
    'numero', r.numero, 'tipo', r.tipo, 'status', r.status,
    'texto', r.texto, 'resposta', r.resposta,
    'criado_em', r.criado_em, 'respondido_em', r.respondido_em);
end $$;

revoke all on function walkstamp.tentar(text,integer,interval) from public, anon, authenticated;

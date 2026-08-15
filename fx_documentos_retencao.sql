-- Retenção de documentos: 12 meses, XML para sempre, e o que sobra do expurgo.
--
-- Rodar no SQL Editor do Supabase. Pode ser antes ou depois do deploy: o app
-- tenta gravar com os campos novos e, se o banco responder que não conhece a
-- coluna, repete sem eles (ver `inserirDocumento` em lib/documento-campos.ts).
-- Até esta migração rodar, o upload funciona e o que falta é só o hash e os
-- dados da nota.
--
-- Isso é proposital e não é zelo excessivo: o PostgREST monta o INSERT a partir
-- das CHAVES do JSON, então uma chave sem coluna correspondente não é ignorada —
-- vira PGRST204 e HTTP 400. Sem o caminho degradado, subir o código antes desta
-- migração quebraria todo upload, no app e no portal. E pior: o arquivo já está
-- no Storage quando o registro falha, virando lixo pago que o expurgo nunca
-- alcança, porque ele varre a tabela e não o bucket.
--
-- Contexto da decisão: com a compressão de foto no navegador, uma nota passou a
-- ocupar ~200 KB em vez de ~2 MB. Os 100 GB gratuitos do Storage passam a caber
-- cerca de meio milhão de documentos, então o expurgo agressivo deixou de
-- comprar economia relevante e continuava custando o histórico do cliente.
--
-- Sobre o tamanho da mudança: o prazo nominal era 45 dias do envio, mas havia um
-- segundo gatilho — 15 dias depois de o contador baixar — e era ele que
-- mandava no caso comum. Documento baixado em dois dias saía em ~17. A vida útil
-- média não foi de 45 para 365 dias; foi de ~17 para 365, mais de vinte vezes.
-- É esse o número que dimensiona o Storage em regime.

alter table documentos_recebidos
  -- Impressão digital do arquivo **como ele foi armazenado** — ou seja, depois
  -- da compressão, quando houve. 64 caracteres hexadecimais.
  --
  -- Não serve para conferir contra o original que o cliente guardou: se ele
  -- mandou uma foto de 2 MB e o sistema guardou 193 KB, os hashes são diferentes
  -- por construção. Serve para duas coisas reais: achar o mesmo documento
  -- enviado duas vezes (o boleto que chega por e-mail e pelo portal) e provar
  -- que o arquivo não mudou enquanto estava guardado.
  add column if not exists sha256 text,

  -- O que foi lido do documento antes de ele ser apagado. Só o XML da NF-e é
  -- lido com certeza (é estruturado); para os demais tipos estas colunas ficam
  -- nulas até que alguém as preencha à mão ou por OCR.
  add column if not exists chave_acesso text,
  add column if not exists emitente_nome text,
  add column if not exists emitente_cnpj text,
  add column if not exists valor_total numeric(14,2),
  add column if not exists emitido_em date,
  add column if not exists extraido_em timestamptz,

  -- Quando o cliente foi avisado, no resumo mensal, de que este documento vai
  -- expirar. Evita avisar o mesmo arquivo dois meses seguidos.
  add column if not exists avisado_expiracao_em timestamptz;

-- Duplicata: o mesmo boleto chega por e-mail e pelo portal, ou o cliente manda
-- duas vezes com medo de não ter ido. Sem índice, achar isso é varredura.
create index if not exists documentos_recebidos_sha256_idx
  on documentos_recebidos (empresa_id, sha256)
  where sha256 is not null;

-- O expurgo varre por data e por status; hoje é sequencial.
create index if not exists documentos_recebidos_expurgo_idx
  on documentos_recebidos (status, enviado_em)
  where status <> 'expurgado';

-- Chave de acesso é única por nota no Brasil inteiro. Índice para a busca do
-- contador ("essa nota já entrou?") e para a conferência contra o XML.
create index if not exists documentos_recebidos_chave_idx
  on documentos_recebidos (chave_acesso)
  where chave_acesso is not null;

comment on column documentos_recebidos.sha256 is
  'SHA-256 do arquivo como enviado (após a compressão de imagem, quando houver). Prova de integridade que sobrevive ao expurgo.';
comment on column documentos_recebidos.chave_acesso is
  'Chave de 44 dígitos da NF-e/NFC-e, extraída do XML no envio.';
comment on column documentos_recebidos.avisado_expiracao_em is
  'Último aviso mensal de expiração enviado para este documento.';

-- Duplicata: aponta para o documento igual que já estava na caixa.
--
-- O índice (empresa_id, sha256) acima existia desde a primeira versão deste
-- arquivo e nada o consultava. Esta coluna é o que torna o índice útil: no
-- registro, o servidor pergunta se aquele hash já entrou nesta empresa e, se
-- entrou, guarda o id do original. Não bloqueia o envio — reenviar por
-- segurança é legítimo — só deixa de esconder que são o mesmo arquivo.
alter table documentos_recebidos
  add column if not exists duplicata_de uuid references documentos_recebidos(id) on delete set null;

comment on column documentos_recebidos.duplicata_de is
  'Documento anterior com o mesmo SHA-256 nesta empresa. Informativo: o envio não é bloqueado.';

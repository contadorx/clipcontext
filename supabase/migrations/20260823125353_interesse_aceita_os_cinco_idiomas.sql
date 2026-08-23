-- A LISTA DE AVISO RECUSAVA ALEMÃO E FRANCÊS, E DIZIA QUE O E-MAIL ESTAVA ERRADO
--
-- `walkstamp.evento` já foi corrigido (migração `o_funil_jogava_fora_oito_de_onze`):
-- lá o `check` de idioma passou a aceitar os cinco. `walkstamp.interesse` — que é
-- a lista de quem pede aviso do plano pago — ficou para trás, com `pt`, `en` e `es`.
--
-- O efeito é o pior tipo: quem escreve de /de/ ou /fr/ recebe "esse endereço não
-- parece um e-mail", porque a violação do check volta pelo mesmo caminho do
-- formato inválido. Zero leads em dois mercados, e nenhum erro em lugar nenhum.
--
-- A fonte da verdade é `src/rotas.json` (i18n): pt, en, es, de, fr.

alter table walkstamp.interesse drop constraint if exists interesse_idioma_check;
alter table walkstamp.interesse add constraint interesse_idioma_check check (
  idioma is null or idioma in ('pt', 'en', 'es', 'de', 'fr'));

comment on column walkstamp.interesse.idioma is
  'Os cinco idiomas de src/rotas.json. Acrescentar idioma no site pede migração aqui.';

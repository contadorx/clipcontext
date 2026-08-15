-- FinanceiroX — Aviso ao cliente quando o relatório do mês é publicado.
-- Liga/desliga por empresa, ligado por padrão. Quando ligado, ao publicar a
-- análise do mês o sistema envia um e-mail aos clientes do portal com o link.

alter table empresas add column if not exists avisar_relatorio boolean default true;

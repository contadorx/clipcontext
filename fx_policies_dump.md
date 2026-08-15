# Policies de RLS — retrato do banco em 14/08/2026

Dump da fumaça (`scripts/fumaca-banco.sql`, seção 4). **A fonte da verdade é o
banco**; este arquivo existe porque as policies nunca estiveram no git e toda
análise de segurança precisava adivinhar. Se uma policy mudar lá, atualize aqui.

## O modelo, em três funções

Quase tudo se decide por três helpers (security definer, no banco):

- `is_membro_empresa(empresa_id)` — o usuário é membro do escritório dono da empresa
- `is_membro(escritorio_id)` / `is_owner(escritorio_id)` — membro / dono do escritório
- `fs_empresas_do_usuario()` — as empresas do escritório do usuário (usada em
  `lancamento_rateios` e `visoes_salvas`)

Padrões: cadastro por empresa = `is_membro_empresa` em tudo; estrutura do
escritório (`membros`, `convites`, `escritorios`) = leitura para membro, escrita
para owner; conteúdo publicado (`faq`, `ajuda_videos`) = `publicado = true` para
authenticated.

## Por tabela (resumo)

| Tabela | Regra |
|---|---|
| analises_ia, categorias, centros_custo, clientes_fornecedores, cnab_remessas, conciliacao_links, conciliacao_regras, contas_bancarias, documentos_recebidos, grupos_categoria, lancamentos, orcamentos, portal_links, solicitacoes_layout_contabil, transacoes_extrato | `is_membro_empresa(empresa_id)` (CRUD completo) |
| boleto_lembretes (SELECT), boleto_lembretes_config, cnab_retornos, cobranca_titulos, contrato_faturamentos, contrato_itens, contratos, ia_sugestoes, nfse, nfse_config, orcamentos_cc, portal_magiclinks, portal_usuarios, recorrencias, resumo_socio_config, servicos, venda_itens, venda_parcelas, vendas | membro do escritório da empresa (join `empresas`×`membros` explícito — mesmo efeito de `is_membro_empresa`) |
| lancamento_rateios, visoes_salvas | `empresa_id in (select fs_empresas_do_usuario())`; visões também exigem `user_id = auth.uid()` (leitura libera `compartilhada`) |
| competencias_fechadas | leitura: membro; escrita: `papel in ('owner','gestor')` — **é a trava do fechamento de mês** |
| documentos_ocultos | `user_id = auth.uid()` (preferência pessoal) |
| empresas | sel: membro da empresa · ins/upd: membro do escritório · **del: só owner** |
| escritorios | sel: membro · ins: `owner_id = auth.uid()` · upd/del: owner |
| membros, convites | sel: membro · mutação: owner |
| membro_empresas | sel: membro · mutação: owner (escopo por analista) |
| admin_nfse_config | só `super_admin` (via `membros.super_admin`) |
| ajuda_videos, faq | SELECT de publicado, para authenticated |
| faq_feedback, suporte_solicitacoes | INSERT `true` para authenticated (telemetria/chamado) |
| feedbacks | ins: membro · sel: membro ou `is_super_admin()` |
| regras_escritorio | membro do escritório |
| portal_auditoria | SELECT para membro do escritório da empresa (escrita só service role) |
| creditos_ia_eventos, creditos_ia_usos | RLS ligada **sem policy** — só service role e funções definer |

## Notas da fumaça

- Todas as 10 tabelas do Desfazer têm policy de INSERT/ALL — a reinserção passa
  pela RLS. Confirmado no ensaio (Parte 2): `clientes_fornecedores`,
  `categorias` e `lancamentos` restauram com o id original.
- Trigger `trg_bloqueia_competencia_fechada` em `lancamentos`
  (BEFORE INSERT/UPDATE/DELETE): a exclusão E a restauração respeitam o
  fechamento de mês — coerente dos dois lados.
- Cascatas documentadas na auditoria: excluir lançamento leva `lancamento_rateios`
  e `conciliacao_links` juntos e o Desfazer devolve só o lançamento; excluir
  categoria leva `ia_sugestoes` (não contado pelo uso-cadastro). Os demais
  destinos de cascata são bloqueados antes pela contagem de uso.

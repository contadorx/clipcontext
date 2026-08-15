-- Créditos de IA: uma marca por pagamento, para não creditar duas vezes.
--
-- `add_creditos_ia` é um INCREMENTO, não um estado final. Isso não é detalhe:
--
--   1. O Asaas dispara PAYMENT_CONFIRMED **e** PAYMENT_RECEIVED para a mesma
--      cobrança (confirmada agora, liquidada depois). O webhook trata os dois
--      como "pagou". Sem esta tabela, todo pacote de IA já era creditado em
--      dobro — hoje, sem falha nenhuma, sem reenvio nenhum.
--   2. O webhook passou a devolver 500 quando a gravação falha, para o gateway
--      reenviar. Com um incremento do outro lado, cada reenvio soma de novo.
--
-- O índice único é a exclusão mútua: quem consegue inserir credita, os outros
-- saem. `reservado_em` marca a execução em andamento e `creditado_em` fecha o
-- assunto. `pagamento_ref` é o id da cobrança no Asaas.
--
-- Rodar antes ou depois do deploy: enquanto a tabela não existir, o webhook
-- detecta a ausência, credita como fazia antes e registra o aviso no log.
create table if not exists public.creditos_ia_eventos (
  id uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references public.escritorios(id) on delete cascade,
  pagamento_ref text not null,
  creditos int not null,
  evento text,
  criado_em timestamptz not null default now(),
  -- quem inseriu a linha ficou de creditar. Reserva recente = execução em
  -- andamento (o outro evento do mesmo pagamento sai sem creditar); reserva
  -- velha = processo morreu no meio e alguém pode retomar. Sem isso, o segundo
  -- evento via `creditado_em` nulo e concluía "ninguém creditou ainda" —
  -- exatamente o que acontece enquanto o primeiro ainda está rodando.
  reservado_em timestamptz not null default now(),
  -- carimbo de "o crédito entrou de verdade".
  --
  -- A marca e o crédito são duas idas ao banco, sem transação entre elas. Se a
  -- linha existisse e isso bastasse para dizer "já creditado", um processo
  -- morto no meio (timeout da function, instância reciclada) deixaria marca sem
  -- crédito — e todo reenvio do Asaas bateria na trava. Cliente paga, nunca
  -- recebe, e nada registra. Marca aberta = retomar; marca fechada = acabou.
  creditado_em timestamptz
);

-- o índice é a trava: o segundo evento do mesmo pagamento bate aqui (23505)
create unique index if not exists creditos_ia_eventos_pagamento_uk
  on public.creditos_ia_eventos (pagamento_ref);

create index if not exists creditos_ia_eventos_escritorio_ix
  on public.creditos_ia_eventos (escritorio_id, criado_em desc);

-- RLS ligado sem nenhuma policy: só a service role (o webhook) enxerga.
-- Nenhum usuário do app tem motivo para ler ou escrever aqui.
alter table public.creditos_ia_eventos enable row level security;

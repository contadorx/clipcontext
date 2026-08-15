import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Payment = {
  id?: string;
  subscription?: string;
  customer?: string;
  dueDate?: string;
  externalReference?: string;
  invoiceUrl?: string;
};

/**
 * A tabela de marcas de crédito ainda não existe (`fx_creditos_ia_eventos.sql`
 * não rodou). Nesse caso o webhook credita como fazia antes, em vez de recusar
 * o pagamento do cliente — mas registra, porque nessa janela o crédito em dobro
 * volta a acontecer.
 */
function marcaIndisponivel(erro: { code?: string }): boolean {
  /*
    Só por código. Casar o nome da tabela na mensagem parecia mais tolerante e
    era perigoso: `permission denied for table creditos_ia_eventos` (42501) e
    violações de FK também citam a tabela, e nesses casos o código concluiria
    "tabela ausente" e voltaria a creditar **sem trava** — crédito em dobro em
    silêncio, com um log apontando a causa errada.
  */
  return erro.code === "42P01" || erro.code === "PGRST205";
}

/**
 * Eventos que confirmam que o dinheiro entrou.
 *
 * São **dois** para a mesma cobrança: o Asaas manda `PAYMENT_CONFIRMED` quando
 * confirma e `PAYMENT_RECEIVED` quando liquida. Para as escritas em
 * `escritorios` isso é inofensivo (gravam estado final). Para o crédito de IA,
 * que é incremento, é crédito em dobro — por isso o bloco de IA tem trava
 * própria em `creditos_ia_eventos`.
 */
const PAGOU = new Set(["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"]);

/**
 * A partir de quanto tempo uma reserva de crédito conta como abandonada.
 *
 * Curto demais e duas execuções simultâneas creditam em dobro; longo demais e
 * um crédito interrompido demora a ser retomado. Quinze minutos é folgado para
 * qualquer execução desta rota e curto perto do intervalo de reenvio do Asaas.
 */
const RESERVA_VELHA_MS = 15 * 60 * 1000;
// Eventos que encerram a assinatura.
const ENCERROU = new Set(["SUBSCRIPTION_DELETED", "PAYMENT_REFUNDED", "PAYMENT_CHARGEBACK_REQUESTED"]);

export async function POST(req: Request) {
  // Valida o token configurado no painel do Asaas (header asaas-access-token).
  const token = req.headers.get("asaas-access-token");
  const esperado = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!esperado || token !== esperado) {
    return NextResponse.json({ erro: "Token inválido." }, { status: 401 });
  }

  let body: { event?: string; payment?: Payment } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "Corpo inválido." }, { status: 400 });
  }

  const evento = body.event || "";
  const pg = body.payment || {};

  // pacote de créditos de IA (cobrança avulsa) — trata ANTES da assinatura
  if (PAGOU.has(evento) && typeof pg.externalReference === "string" && pg.externalReference.startsWith("ia:")) {
    const [, escId, nStr] = pg.externalReference.split(":");
    const n = Number(nStr);
    if (escId && n > 0) {
      try {
        const admin = createAdminClient();
        /*
          `add_creditos_ia` é INCREMENTO, e por isso precisa de trava.

          Duas coisas somam crédito indevido aqui. A primeira acontece hoje, sem
          falha nenhuma: `PAGOU` tem `PAYMENT_CONFIRMED` e `PAYMENT_RECEIVED`, e
          o Asaas manda os dois para a mesma cobrança — cada pacote comprado era
          creditado duas vezes. A segunda é o 500 abaixo: devolver erro para o
          gateway reenviar só é seguro quando a escrita é idempotente, e um
          incremento não é.

          A marca é gravada ANTES do crédito e só é FECHADA (`creditado_em`)
          depois dele. Marca aberta significa "alguém começou e não terminou", e
          o reenvio do Asaas retoma dali; marca fechada é o que encerra o
          assunto. Chave: o id da cobrança no Asaas.
        */
        /*
          Sem `pg.id` a chave é montada com o que sobra, e ela NÃO é perfeita:
          duas compras do mesmo pacote, pelo mesmo escritório, no mesmo dia,
          colidem — a segunda seria tratada como repetição e o cliente ficaria
          sem o crédito. O Asaas sempre manda `id`; se este log aparecer, é isso
          que está em jogo.
        */
        const refPagamento = pg.id || `sem-id:${pg.externalReference}:${pg.dueDate ?? ""}`;
        if (!pg.id) {
          console.error("asaas: evento de crédito de IA sem id de cobrança", { escId, evento, refPagamento });
        }
        const agora = new Date().toISOString();
        /*
          Reserva antes, crédito depois, carimbo no fim.

          `pagamento_ref` é único, então quem consegue inserir é o dono do
          crédito daquele pagamento. Isso é exclusão mútua de verdade: o segundo
          evento (o Asaas manda CONFIRMED e RECEIVED para a mesma cobrança, às
          vezes no mesmo instante) bate no 23505 e não credita. A primeira
          versão desta trava lia `creditado_em` no 23505 e, achando `null`,
          creditava de novo — ou seja, dois eventos simultâneos ainda davam
          crédito em dobro, porque `null` também é o estado de "o outro ainda
          está no meio do caminho".

          `reservado_em` distingue os dois: reserva recente = alguém está
          trabalhando, deixa quieto; reserva velha = processo morreu no meio
          (timeout da function), e aí dá para retomar sem risco de somar duas
          vezes.
        */
        const marca = await admin
          .from("creditos_ia_eventos")
          .insert({ escritorio_id: escId, pagamento_ref: refPagamento, creditos: n, evento, reservado_em: agora });
        let podeCreditar = !marca.error;
        if (marca.error && marca.error.code === "23505") {
          const ja = await admin
            .from("creditos_ia_eventos")
            .select("creditado_em, reservado_em")
            .eq("pagamento_ref", refPagamento)
            .maybeSingle();
          if (ja.error) return NextResponse.json({ erro: ja.error.message }, { status: 500 });
          if (ja.data?.creditado_em) {
            return NextResponse.json({ ok: true, creditadoIA: false, motivo: "pagamento já creditado" });
          }
          const limite = new Date(Date.now() - RESERVA_VELHA_MS).toISOString();
          const reserva = (ja.data?.reservado_em as string | null) ?? null;
          if (reserva && reserva > limite) {
            // outra execução está creditando agora: sair sem 500 evita que o
            // Asaas reenvie e crie uma terceira corrida
            return NextResponse.json({ ok: true, creditadoIA: false, motivo: "crédito em andamento" });
          }
          /*
            Reserva velha: retoma. O `.lte("reservado_em", limite)` é o que
            garante que só UMA execução retoma — quem perder a corrida atualiza
            zero linhas e sai fora.
          */
          const retoma = await admin
            .from("creditos_ia_eventos")
            .update({ reservado_em: agora })
            .eq("pagamento_ref", refPagamento)
            .is("creditado_em", null)
            .lte("reservado_em", limite)
            .select("id");
          if (retoma.error) return NextResponse.json({ erro: retoma.error.message }, { status: 500 });
          if ((retoma.data ?? []).length === 0) {
            return NextResponse.json({ ok: true, creditadoIA: false, motivo: "crédito em andamento" });
          }
          console.error("asaas: reserva de crédito abandonada — retomando", { escId, n, refPagamento });
          podeCreditar = true;
        } else if (marca.error && marcaIndisponivel(marca.error)) {
          console.error("asaas: creditos_ia_eventos ausente — creditando sem trava de duplicidade", {
            escId,
            n,
            refPagamento,
          });
          podeCreditar = true;
        } else if (marca.error) {
          console.error("asaas: falha ao marcar crédito de IA", { escId, n, erro: marca.error.message });
          return NextResponse.json({ erro: marca.error.message }, { status: 500 });
        }
        if (!podeCreditar) return NextResponse.json({ ok: true, creditadoIA: false, motivo: "crédito em andamento" });
        /*
          `supabase-js` devolve `{ data, error }` e **não lança** em erro de
          PostgREST. Sem ler `.error`, o crédito podia não ser dado e a rota
          respondia `200 {creditadoIA:true}` — o Asaas considera entregue e
          nunca reenvia. Cliente paga o pacote de IA e não recebe crédito
          nenhum, sem nada no sistema registrando isso.
        */
        const { error } = await admin.rpc("add_creditos_ia", { p_escritorio: escId, p_n: n });
        if (error) {
          // solta a reserva para o reenvio do Asaas poder retomar sem esperar o
          // prazo de reserva velha
          const solta = await admin
            .from("creditos_ia_eventos")
            .update({ reservado_em: new Date(0).toISOString() })
            .eq("pagamento_ref", refPagamento)
            .is("creditado_em", null);
          if (solta.error) console.error("asaas: reserva presa após falha de crédito", { refPagamento, erro: solta.error.message });
          console.error("asaas: falha ao creditar IA", { escId, n, erro: error.message });
          return NextResponse.json({ erro: error.message }, { status: 500 });
        }
        /*
          Fecha a marca. É este carimbo — e não a existência da linha — que faz
          o próximo evento do mesmo pagamento ser ignorado de vez. Se ele não
          gravar, a reserva envelhece e uma retomada futura credita de novo; o
          log registra, porque é o único jeito de alguém saber.
        */
        const fecha = await admin
          .from("creditos_ia_eventos")
          .update({ creditado_em: new Date().toISOString() })
          .eq("pagamento_ref", refPagamento);
        if (fecha.error) {
          console.error("asaas: crédito dado sem fechar a marca — retomada futura pode creditar de novo", {
            escId,
            n,
            refPagamento,
            erro: fecha.error.message,
          });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro ao creditar IA.";
        return NextResponse.json({ erro: msg }, { status: 500 });
      }
    }
    return NextResponse.json({ ok: true, creditadoIA: true });
  }

  /*
    Cobrança avulsa de IA nunca entra no bloco de assinatura.

    Sem esta guarda, um `PAYMENT_REFUNDED` de um pacote de IA (que tem
    `customer` preenchido) escorre para baixo, cai em `ENCERROU` e marca o
    escritório como `assinatura_status: "cancelada"` — o estorno de um pacote de
    R$ 20 cancelava a assinatura inteira do cliente.
  */
  if (typeof pg.externalReference === "string" && pg.externalReference.startsWith("ia:")) {
    return NextResponse.json({ ok: true, ignorado: "cobrança avulsa de IA" });
  }

  // Sem vínculo de assinatura/cliente não há o que atualizar (ex.: cobrança avulsa).
  if (!pg.subscription && !pg.customer) {
    return NextResponse.json({ ok: true, ignorado: "sem assinatura/cliente" });
  }

  try {
    const admin = createAdminClient();

    // localiza o escritório pela assinatura (ou, na falta, pelo cliente)
    let escId: string | null = null;
    if (pg.subscription) {
      const { data } = await admin
        .from("escritorios")
        .select("id")
        .eq("asaas_subscription_id", pg.subscription)
        .maybeSingle();
      escId = data?.id ?? null;
    }
    if (!escId && pg.customer) {
      const { data } = await admin
        .from("escritorios")
        .select("id")
        .eq("asaas_customer_id", pg.customer)
        .maybeSingle();
      escId = data?.id ?? null;
    }
    if (!escId) return NextResponse.json({ ok: true, ignorado: "escritório não encontrado" });

    /*
      Falha de gravação devolve 500, e o Asaas reenvia.

      Todos estes `update` tinham o erro descartado e a rota respondia `200
      {ok:true}` de qualquer jeito — o gateway marca como entregue e não repete.
      O pior caso é o `PAGOU`: o cliente pagou, a assinatura continua vencida, a
      régua de cobrança continua disparando contra quem está em dia, e o acesso
      pode cair. Sem caminho de conserto na interface; só SQL.

      Reenviar é seguro porque todas as escritas **deste bloco** são
      idempotentes — gravam estado final (status, datas, contadores zerados),
      não incrementos. Devolver 500 é usar o mecanismo de retry que o gateway já
      tem, em vez de inventar uma fila.

      A única escrita incremental do webhook é o crédito de IA, que sai lá em
      cima, antes daqui, e tem trava própria em `creditos_ia_eventos`.
    */
    const falhou = (etapa: string, erro: { message: string } | null) => {
      if (!erro) return null;
      console.error(`asaas: ${etapa} falhou`, { escId, evento, erro: erro.message });
      return NextResponse.json({ erro: `${etapa}: ${erro.message}` }, { status: 500 });
    };

    if (PAGOU.has(evento)) {
      const { error } = await admin
        .from("escritorios")
        .update({
          assinatura_status: "ativa",
          ultimo_pagamento_em: new Date().toISOString(),
          // proximo_vencimento NÃO é atualizado aqui (seria o vencimento da fatura paga,
          // já no passado). Quem grava o vencimento futuro é o evento PAYMENT_CREATED.
          assinatura_atualizada_em: new Date().toISOString(),
          // pagou: zera a régua de cobrança
          cobranca_vencida_em: null,
          cobranca_fatura_url: null,
          cobranca_toques: 0,
          cobranca_ultimo_toque_em: null,
          // pagou: sai do fluxo de recuperação de churn
          cancelado_em: null,
          recuperacao_enviada_em: null,
        })
        .eq("id", escId);
      const r = falhou("registrar pagamento", error);
      if (r) return r;
    } else if (ENCERROU.has(evento)) {
      const { error } = await admin
        .from("escritorios")
        .update({
          assinatura_status: "cancelada",
          assinatura_atualizada_em: new Date().toISOString(),
          cancelado_em: new Date().toISOString(),
          cobranca_vencida_em: null,
          cobranca_fatura_url: null,
          cobranca_toques: 0,
          cobranca_ultimo_toque_em: null,
        })
        .eq("id", escId);
      const r = falhou("encerrar assinatura", error);
      if (r) return r;
    } else if (evento === "PAYMENT_OVERDUE") {
      // fatura venceu: arma a régua (1 ciclo de toques). Não derruba o acesso aqui.
      const { error } = await admin
        .from("escritorios")
        .update({
          cobranca_vencida_em: pg.dueDate ?? new Date().toISOString().slice(0, 10),
          cobranca_fatura_url: pg.invoiceUrl ?? null,
          cobranca_toques: 0,
          cobranca_ultimo_toque_em: null,
          assinatura_atualizada_em: new Date().toISOString(),
        })
        .eq("id", escId);
      const r = falhou("armar régua de cobrança", error);
      if (r) return r;
    } else if (evento === "PAYMENT_CREATED") {
      // o Asaas gerou a fatura do próximo ciclo: grava o vencimento futuro, que é a
      // referência da régua de cobrança (toques antes e depois do vencimento).
      // Só para cobranças de assinatura (avulsas, como pacotes de IA, não têm subscription).
      if (pg.subscription && pg.dueDate) {
        const { error } = await admin
          .from("escritorios")
          .update({ proximo_vencimento: pg.dueDate, assinatura_atualizada_em: new Date().toISOString() })
          .eq("id", escId);
        const r = falhou("gravar próximo vencimento", error);
        if (r) return r;
      }
    }
    // demais eventos: ignorados.

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro no webhook.";
    // Retorna 500 para o Asaas reenviar depois.
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}

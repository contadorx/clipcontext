import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { asaasFetch, cicloAsaas, hojeISO, type Ciclo } from "@/lib/asaas";
import { calcular } from "@/lib/precos";
import { carregarPrecoConfig } from "@/lib/precos-server";
import { validarCupom } from "@/lib/cupons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      ciclo?: Ciclo;
      cpfCnpj?: string;
      billingType?: string;
      qtd?: number;
      cupom?: string;
    };
    const ciclo: Ciclo = body.ciclo === "anual" || body.ciclo === "semestral" ? body.ciclo : "mensal";
    const cpfCnpj = (body.cpfCnpj || "").replace(/\D/g, "");
    const billingType = body.billingType || "UNDEFINED";

    if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) {
      return NextResponse.json({ erro: "Informe um CPF ou CNPJ válido." }, { status: 400 });
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

    const dono = await supabase
      .from("escritorios")
      .select("id, nome, asaas_customer_id, asaas_subscription_id")
      .eq("owner_id", user.id)
      .maybeSingle();
    if (dono.error) return NextResponse.json({ erro: dono.error.message }, { status: 500 });
    const esc = dono.data;
    /*
      "Escritório não encontrado" era a resposta para o administrador que
      clicasse em Assinar — a tela mostra o item para ele, mas só o dono assina.
      A mensagem descrevia um problema que não existia e não indicava saída.
    */
    if (!esc) {
      return NextResponse.json(
        { erro: "Só o dono da conta assina ou altera o plano. Peça a quem criou o escritório." },
        { status: 403 },
      );
    }

    /*
      A contagem é o PISO da assinatura, e o erro era descartado.

      Com `count` nulo, `nEmpresas` virava 0 e o piso sumia — a quantidade
      passava a ser a que o navegador mandou. Um escritório com 40 empresas
      podia fechar assinatura de 1. Trava de limite que falha aberta é o mesmo
      que não ter trava.
    */
    const cont = await supabase
      .from("empresas")
      .select("id", { count: "exact", head: true })
      .eq("escritorio_id", esc.id)
      .eq("status", "ativa");
    if (cont.error) {
      return NextResponse.json(
        { erro: `Não foi possível contar as empresas ativas (${cont.error.message}). Tente de novo.` },
        { status: 500 },
      );
    }
    const nEmpresas = cont.count ?? 0;

    // quantidade contratada: nunca abaixo do nº real de empresas
    const qtd = Math.max(nEmpresas, Math.floor(Number(body.qtd) || nEmpresas));

    const cfg = await carregarPrecoConfig();
    const calc = calcular(qtd, ciclo, cfg);
    let valorCiclo = Number(calc.totalCiclo.toFixed(2)); // cobrado a cada ciclo no Asaas
    let valorMensal = Number(calc.mensalEquivalente.toFixed(2)); // guardado p/ MRR

    // Cupom (opcional): aplica % de desconto e guarda para o cron reverter ao expirar.
    let cupomCodigo: string | null = null;
    let cupomPct: number | null = null;
    let cupomExpiraEm: string | null = null;
    const cupomInput = (body.cupom || "").trim();
    let adminCupom: ReturnType<typeof createAdminClient> | null = null;
    if (cupomInput) {
      try {
        adminCupom = createAdminClient();
      } catch {
        return NextResponse.json({ erro: "Configuração do servidor incompleta (cupom)." }, { status: 500 });
      }
      const v = await validarCupom(adminCupom, cupomInput);
      if (!v.ok) return NextResponse.json({ erro: v.erro }, { status: 400 });
      cupomCodigo = v.codigo;
      cupomPct = v.percentual;
      const fator = 1 - v.percentual / 100;
      valorCiclo = Number((valorCiclo * fator).toFixed(2));
      valorMensal = Number((valorMensal * fator).toFixed(2));
      if (v.duracaoMeses && v.duracaoMeses > 0) {
        const d = new Date();
        d.setMonth(d.getMonth() + v.duracaoMeses);
        cupomExpiraEm = d.toISOString();
      }
    }

    // 1) Cliente no Asaas (reaproveita se já existir)
    let customerId = esc.asaas_customer_id as string | null;
    if (!customerId) {
      const cliente = await asaasFetch<{ id: string }>("/customers", {
        method: "POST",
        body: JSON.stringify({
          name: esc.nome || "Cliente FinanceiroX",
          cpfCnpj,
          email: user.email || undefined,
          notificationDisabled: true, // só a régua do FinanceiroX avisa; o Asaas não notifica
        }),
      });
      customerId = cliente.id;
    }

    // 2) Assinatura recorrente — atualiza se já existe, senão cria
    let subId = esc.asaas_subscription_id as string | null;
    if (subId) {
      await asaasFetch(`/subscriptions/${subId}`, {
        method: "PUT",
        body: JSON.stringify({
          billingType,
          value: valorCiclo,
          cycle: cicloAsaas(ciclo),
          description: `FinanceiroX — ${qtd} empresa(s) · ${ciclo}`,
        }),
      });
    } else {
      const assinatura = await asaasFetch<{ id: string }>("/subscriptions", {
        method: "POST",
        body: JSON.stringify({
          customer: customerId,
          billingType,
          value: valorCiclo,
          nextDueDate: hojeISO(),
          cycle: cicloAsaas(ciclo),
          description: `FinanceiroX — ${qtd} empresa(s) · ${ciclo}`,
        }),
      });
      subId = assinatura.id;
    }

    // 3) Primeira fatura (para pagar agora)
    let invoiceUrl: string | null = null;
    try {
      const pgs = await asaasFetch<{ data: { invoiceUrl?: string }[] }>(
        `/subscriptions/${subId}/payments?limit=1`,
      );
      invoiceUrl = pgs?.data?.[0]?.invoiceUrl ?? null;
    } catch {
      /* a fatura pode levar instantes para aparecer; o usuário pode reabrir depois */
    }

    // 4) Salva no escritório
    const jaTinha = Boolean(esc.asaas_subscription_id);
    const { error: upErr } = await supabase
      .from("escritorios")
      .update({
        asaas_customer_id: customerId,
        asaas_subscription_id: subId,
        ciclo_cobranca: ciclo,
        valor_mensal: valorMensal,
        assinatura_qtd: qtd,
        billing_type: billingType,
        cupom_codigo: cupomCodigo,
        cupom_percentual: cupomPct,
        cupom_expira_em: cupomExpiraEm,
        // ao atualizar uma assinatura já ativa, mantém ativa; ao criar, fica pendente até o webhook
        ...(jaTinha ? {} : { assinatura_status: "selecionada" }),
        assinatura_atualizada_em: new Date().toISOString(),
      })
      .eq("id", esc.id);
    if (upErr) return NextResponse.json({ erro: upErr.message }, { status: 500 });

    /*
      Conta o uso do cupom (atômico) só após gravar com sucesso.

      Ignorar a falha aqui não pode derrubar a assinatura — ela já foi criada e
      o cliente já tem o desconto. Mas o contador é justamente o que faz o
      limite de usos existir: se ele não sobe, um cupom de 10 usos vale para
      sempre. Fica no log, com o código, porque é a única forma de saber.
    */
    if (cupomCodigo && adminCupom) {
      const inc = await adminCupom.rpc("incrementar_uso_cupom", { p_codigo: cupomCodigo });
      if (inc.error) {
        console.error("assinatura: uso de cupom não contabilizado", { cupom: cupomCodigo, erro: inc.error.message });
      }
    }

    return NextResponse.json({ ok: true, invoiceUrl, atualizou: jaTinha });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao criar assinatura.";
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { asaasFetch, hojeISO } from "@/lib/asaas";
import { pacotePorId } from "@/lib/pacotes-ia";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { pacote?: string; cpfCnpj?: string };
    const pac = pacotePorId(body.pacote || "");
    if (!pac) return NextResponse.json({ erro: "Pacote inválido." }, { status: 400 });

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

    const { data: esc } = await supabase
      .from("escritorios")
      .select("id, nome, asaas_customer_id")
      .eq("owner_id", user.id)
      .maybeSingle();
    if (!esc) return NextResponse.json({ erro: "Escritório não encontrado." }, { status: 404 });

    // cliente no Asaas (reaproveita ou cria)
    let customerId = esc.asaas_customer_id as string | null;
    if (!customerId) {
      const doc = (body.cpfCnpj || "").replace(/\D/g, "");
      if (doc.length !== 11 && doc.length !== 14) {
        return NextResponse.json(
          { erro: "Informe um CPF ou CNPJ para a primeira cobrança.", precisaDoc: true },
          { status: 400 },
        );
      }
      const cliente = await asaasFetch<{ id: string }>("/customers", {
        method: "POST",
        body: JSON.stringify({ name: esc.nome || "Cliente FinanceiroX", cpfCnpj: doc, email: user.email || undefined, notificationDisabled: true }),
      });
      customerId = cliente.id;
      await supabase.from("escritorios").update({ asaas_customer_id: customerId }).eq("id", esc.id);
    }

    // cobrança avulsa; o webhook usa o externalReference para creditar
    const cobranca = await asaasFetch<{ invoiceUrl?: string; id: string }>("/payments", {
      method: "POST",
      body: JSON.stringify({
        customer: customerId,
        billingType: "UNDEFINED",
        value: pac.preco,
        dueDate: hojeISO(),
        description: `FinanceiroX — pacote de ${pac.creditos} análises por IA`,
        externalReference: `ia:${esc.id}:${pac.creditos}`,
      }),
    });

    return NextResponse.json({ ok: true, invoiceUrl: cobranca.invoiceUrl ?? null });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao gerar a compra.";
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}

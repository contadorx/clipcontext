import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { asaasFetch } from "@/lib/asaas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Retorna o link da fatura em aberto (ou a mais recente) da assinatura do escritório.
export async function GET() {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

    const { data: esc } = await supabase
      .from("escritorios")
      .select("asaas_subscription_id")
      .eq("owner_id", user.id)
      .maybeSingle();

    const subId = esc?.asaas_subscription_id as string | null;
    if (!subId) return NextResponse.json({ erro: "Nenhuma assinatura encontrada." }, { status: 404 });

    // pendentes primeiro; se não houver, a mais recente
    const pend = await asaasFetch<{ data: { invoiceUrl?: string }[] }>(
      `/subscriptions/${subId}/payments?status=PENDING&limit=1`,
    );
    let invoiceUrl = pend?.data?.[0]?.invoiceUrl ?? null;
    if (!invoiceUrl) {
      const ult = await asaasFetch<{ data: { invoiceUrl?: string }[] }>(
        `/subscriptions/${subId}/payments?limit=1`,
      );
      invoiceUrl = ult?.data?.[0]?.invoiceUrl ?? null;
    }

    if (!invoiceUrl) return NextResponse.json({ erro: "Fatura ainda não disponível." }, { status: 404 });
    return NextResponse.json({ ok: true, invoiceUrl });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao buscar a fatura.";
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}

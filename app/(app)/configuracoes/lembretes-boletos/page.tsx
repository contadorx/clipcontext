
import { createClient } from "@/lib/supabase/server";
import { getEmpresaContext } from "@/lib/empresa";
import LembretesConfig from "@/components/cobranca/lembretes-config";
import PageHeader from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

export default async function LembretesBoletosPage() {
  const { atual } = await getEmpresaContext();
  const empresaId = atual?.id ?? "";
  const supabase = createClient();

  const [{ data: config }, { data: lembretesRaw }, { count: semEmail }] = await Promise.all([
    supabase
      .from("boleto_lembretes_config")
      .select("ativa, dias_antes, no_vencimento, dias_depois")
      .eq("empresa_id", empresaId)
      .maybeSingle(),
    supabase
      .from("boleto_lembretes")
      .select("id, tipo, email, enviado_em, titulo:cobranca_titulos(sacado_nome, valor, vencimento)")
      .eq("empresa_id", empresaId)
      .order("enviado_em", { ascending: false })
      .limit(20),
    supabase
      .from("clientes_fornecedores")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId)
      .eq("ativo", true)
      .is("email", null),
  ]);

  type L = { id: string; tipo: string; email: string; enviado_em: string; titulo: { sacado_nome: string | null; valor: number; vencimento: string } | { sacado_nome: string | null; valor: number; vencimento: string }[] | null };
  const lembretes = ((lembretesRaw ?? []) as unknown as L[]).map((l) => ({
    ...l,
    titulo: Array.isArray(l.titulo) ? (l.titulo[0] ?? null) : l.titulo,
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Lembretes de boletos"
        voltar={{ href: "/configuracoes", label: "Configurações" }}
        sub={
          <>
            Avisos automáticos por e-mail aos seus clientes sobre boletos a vencer e vencidos. Empresa:{" "}
          <span className="font-semibold text-ink">{atual?.nome}</span>
          </>
        }
      />
      <LembretesConfig empresaId={empresaId} config={config} lembretes={lembretes} clientesSemEmail={semEmail ?? 0} />
    </div>
  );
}

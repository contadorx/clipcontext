
import { createClient } from "@/lib/supabase/server";
import { getEmpresaContext } from "@/lib/empresa";
import ArquivosBancariosClient, { type RemessaRow } from "@/components/cnab/arquivos-bancarios-client";
import PageHeader from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

export default async function ArquivosBancariosPage() {
  const { atual } = await getEmpresaContext();
  const empresaId = atual?.id ?? "";
  const supabase = createClient();

  const { data } = await supabase
    .from("cnab_remessas")
    .select(
      "id, tipo, banco_codigo, sequencial, quantidade, valor_total, arquivo_nome, criado_em, cancelada_em, conta:contas_bancarias(nome)",
    )
    .eq("empresa_id", empresaId)
    .order("criado_em", { ascending: false })
    .limit(100);

  type Raw = Omit<RemessaRow, "conta"> & { conta: { nome: string } | { nome: string }[] | null };
  const remessas: RemessaRow[] = ((data ?? []) as unknown as Raw[]).map((r) => ({
    ...r,
    conta: Array.isArray(r.conta) ? (r.conta[0] ?? null) : r.conta,
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Arquivos bancários (CNAB)"
        voltar={{ href: "/configuracoes", label: "Configurações" }}
        sub={
          <>
            Todas as remessas — pagamento e cobrança — num lugar só, com download da 2ª via. Empresa:{" "}
          <span className="font-semibold text-ink">{atual?.nome}</span>
          </>
        }
      />
      <ArquivosBancariosClient remessas={remessas} />
    </div>
  );
}

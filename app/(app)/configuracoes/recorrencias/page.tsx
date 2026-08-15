
import { createClient } from "@/lib/supabase/server";
import { getEmpresaContext } from "@/lib/empresa";
import RecorrenciasClient, { type RecorrenciaRow } from "@/components/recorrencias/recorrencias-client";
import PageHeader from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

export default async function RecorrenciasPage() {
  const { atual } = await getEmpresaContext();
  const empresaId = atual?.id ?? "";
  const supabase = createClient();

  const { data } = await supabase
    .from("recorrencias")
    .select(
      "id, tipo, valor, descricao, dia_vencimento, ativa, proxima_competencia, categoria:categorias(nome), pessoa:clientes_fornecedores(nome)",
    )
    .eq("empresa_id", empresaId)
    .order("ativa", { ascending: false })
    .order("criado_em", { ascending: false });

  type Raw = Omit<RecorrenciaRow, "categoria_nome" | "pessoa_nome"> & {
    categoria: { nome: string } | { nome: string }[] | null;
    pessoa: { nome: string } | { nome: string }[] | null;
  };
  const recorrencias: RecorrenciaRow[] = ((data ?? []) as unknown as Raw[]).map((r) => ({
    id: r.id,
    tipo: r.tipo,
    valor: r.valor,
    descricao: r.descricao,
    dia_vencimento: r.dia_vencimento,
    ativa: r.ativa,
    proxima_competencia: r.proxima_competencia,
    categoria_nome: Array.isArray(r.categoria) ? (r.categoria[0]?.nome ?? null) : (r.categoria?.nome ?? null),
    pessoa_nome: Array.isArray(r.pessoa) ? (r.pessoa[0]?.nome ?? null) : (r.pessoa?.nome ?? null),
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Recorrências"
        voltar={{ href: "/configuracoes", label: "Configurações" }}
        sub={
          <>
            Lançamentos contínuos que o sistema gera todo mês automaticamente. Empresa:{" "}
          <span className="font-semibold text-ink">{atual?.nome}</span>
          </>
        }
      />
      <RecorrenciasClient empresaId={empresaId} recorrencias={recorrencias} />
    </div>
  );
}

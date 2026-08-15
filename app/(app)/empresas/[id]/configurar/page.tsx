import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaContext } from "@/lib/empresa";
import ConfigurarCliente, { type StatusConfig } from "@/components/empresa/configurar-cliente";

export const dynamic = "force-dynamic";

export default async function ConfigurarClientePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const empresaId = params.id;

  const { data: empresa } = await supabase
    .from("empresas")
    .select("id, nome")
    .eq("id", empresaId)
    .maybeSingle();

  if (!empresa) redirect("/carteira");

  const [cat, contas, recs, portal, nfse] = await Promise.all([
    supabase
      .from("categorias")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId),
    supabase
      .from("contas_bancarias")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId),
    supabase
      .from("recorrencias")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId),
    supabase
      .from("portal_links")
      .select("ativo")
      .eq("empresa_id", empresaId)
      .maybeSingle(),
    supabase
      .from("nfse_config")
      .select("empresa_id")
      .eq("empresa_id", empresaId)
      .maybeSingle(),
  ]);

  const status: StatusConfig = {
    plano: (cat.count ?? 0) > 0,
    conta: (contas.count ?? 0) > 0,
    recorrencias: (recs.count ?? 0) > 0,
    portal: Boolean(portal.data?.ativo),
    nfse: Boolean(nfse.data),
  };

  const { empresas } = await getEmpresaContext();
  const outras = empresas.filter((e) => e.id !== empresaId);

  return <ConfigurarCliente empresaId={empresa.id} nome={empresa.nome} status={status} outras={outras} />;
}

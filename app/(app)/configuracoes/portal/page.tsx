
import { createClient } from "@/lib/supabase/server";
import { getEmpresaContext } from "@/lib/empresa";
import PortalAdmin from "@/components/cadastros/portal-admin";
import PortalLiberacao from "@/components/cadastros/portal-liberacao";
import PortalUsuarios from "@/components/cadastros/portal-usuarios";
import PortalAuditoria from "@/components/cadastros/portal-auditoria";
import PageHeader from "@/components/ui/page-header";

export default async function PortalConfigPage() {
  const { atual } = await getEmpresaContext();
  const empresaId = atual?.id ?? "";

  const supabase = createClient();
  const [{ data: link }, { data: emp }, { data: usuarios }, { data: auditoria }] = await Promise.all([
    supabase.from("portal_links").select("token, ativo").eq("empresa_id", empresaId).maybeSingle(),
    supabase
      .from("empresas")
      .select("portal_libera_analise, portal_periodo, portal_libera_documentos, avisar_relatorio")
      .eq("id", empresaId)
      .maybeSingle(),
    supabase
      .from("portal_usuarios")
      .select("id, email, nome, ativo, ultimo_acesso")
      .eq("empresa_id", empresaId)
      .order("criado_em", { ascending: true }),
    supabase
      .from("portal_auditoria")
      .select("id, acao, detalhe, email, criado_em")
      .eq("empresa_id", empresaId)
      .order("criado_em", { ascending: false })
      .limit(50),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Portal do Cliente"
        voltar={{ href: "/configuracoes", label: "Configurações" }}
        sub="Compartilhe um resumo financeiro read-only com o seu cliente."
      />
      <PortalAdmin
        empresaId={empresaId}
        empresaNome={atual?.nome ?? ""}
        linkInicial={link ? { token: link.token, ativo: link.ativo } : null}
      />
      <PortalUsuarios empresaId={empresaId} empresaNome={atual?.nome ?? ""} inicial={usuarios ?? []} />
      <PortalAuditoria itens={auditoria ?? []} />
      <PortalLiberacao
        empresaId={empresaId}
        liberaAnalise={Boolean(emp?.portal_libera_analise)}
        liberaDocumentos={emp?.portal_libera_documentos !== false}
        avisarRelatorio={emp?.avisar_relatorio !== false}
        periodo={(emp?.portal_periodo as string) ?? "anual"}
      />
    </div>
  );
}

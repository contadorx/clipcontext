import { Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import AdminNotasClient, {
  type Assinante,
  type EmpresaOpt,
  type NotaAdmin,
  type ServicoOpt,
} from "@/components/admin/admin-notas-client";
import PageHeader from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

export default async function AdminNotasPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: membro } = user
    ? await supabase.from("membros").select("super_admin").eq("user_id", user.id).eq("super_admin", true).maybeSingle()
    : { data: null };

  if (!membro) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-sm rounded-xl2 bg-white p-8 text-center shadow-card">
          <Lock size={24} className="mx-auto text-ink-soft" />
          <h1 className="mt-2 text-lg font-bold text-ink">Painel restrito</h1>
          <p className="mt-1 text-sm text-ink-muted">Esta área é exclusiva da administração do FinanceiroX.</p>
        </div>
      </div>
    );
  }

  const admin = createAdminClient();
  const [{ data: cfg }, { data: negCfg }, { data: empresasRaw }, { data: assinantesRaw }, { data: notasRaw }] = await Promise.all([
    admin.from("admin_nfse_config").select("empresa_emissora_id, servico_id").eq("id", 1).maybeSingle(),
    admin.from("negocio_config").select("empresa_master_id").eq("id", 1).maybeSingle(),
    admin.from("empresas").select("id, nome").order("criado_em", { ascending: true }),
    admin
      .from("escritorios")
      .select("id, nome, assinatura_status, ciclo_cobranca, valor_mensal, assinatura_qtd, ultimo_pagamento_em, asaas_customer_id, is_teste")
      .not("ultimo_pagamento_em", "is", null)
      .neq("assinatura_status", "cancelada")
      .order("nome", { ascending: true }),
    admin
      .from("nfse")
      .select("id, referencia, valor_servico, status, ambiente, nfse_numero, pdf_url, motivo_erro, emitida_em, criado_em")
      .eq("origem", "assinatura")
      .order("criado_em", { ascending: false })
      .limit(100),
  ]);

  // serviços da empresa emissora (se já configurada)
  let servicos: ServicoOpt[] = [];
  if (cfg?.empresa_emissora_id) {
    const { data } = await admin
      .from("servicos")
      .select("id, nome, item_lc116")
      .eq("empresa_id", cfg.empresa_emissora_id)
      .eq("ativo", true);
    servicos = (data ?? []) as ServicoOpt[];
  }

  const assinantes = ((assinantesRaw ?? []) as (Assinante & { is_teste: boolean })[]).filter((a) => !a.is_teste);

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Faturamento do negócio"
        voltar={{ href: "/admin", label: "Painel do negócio" }}
        sub="Defina a empresa Master e emita as NFS-e dos planos pagos. Emitir a nota gera o contas a receber na Master."
      />
      <AdminNotasClient
        configInicial={cfg ?? null}
        masterIdIni={(negCfg?.empresa_master_id as string) ?? null}
        empresas={(empresasRaw ?? []) as EmpresaOpt[]}
        servicos={servicos}
        assinantes={assinantes}
        notas={(notasRaw ?? []) as NotaAdmin[]}
      />
    </div>
  );
}


import { createClient } from "@/lib/supabase/server";
import { getEmpresaContext } from "@/lib/empresa";
import FechamentoClient from "@/components/fechamento/fechamento-client";
import PageHeader from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

export default async function FechamentoPage() {
  const { atual } = await getEmpresaContext();
  const empresaId = atual?.id ?? "";
  const supabase = createClient();

  // papel do usuário neste escritório (owner/gestor podem fechar)
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let podeFechar = false;
  if (user && empresaId) {
    const { data: emp } = await supabase.from("empresas").select("escritorio_id").eq("id", empresaId).maybeSingle();
    if (emp?.escritorio_id) {
      const { data: membro } = await supabase
        .from("membros")
        .select("papel")
        .eq("user_id", user.id)
        .eq("escritorio_id", emp.escritorio_id)
        .maybeSingle();
      const papel = (membro?.papel as string) ?? "membro";
      podeFechar = papel === "owner" || papel === "gestor";
    }
  }

  // últimos 18 meses a partir do mês corrente
  const hoje = new Date();
  const comps: string[] = [];
  for (let i = 0; i < 18; i++) {
    const d = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - i, 1));
    comps.push(d.toISOString().slice(0, 10));
  }
  const inicio = comps[comps.length - 1];

  const [{ data: fechadas }, { data: lancs }] = await Promise.all([
    supabase.from("competencias_fechadas").select("competencia").eq("empresa_id", empresaId),
    supabase.from("lancamentos").select("data_competencia").eq("empresa_id", empresaId).gte("data_competencia", inicio),
  ]);

  const setFechadas = new Set((fechadas ?? []).map((f) => (f.competencia as string).slice(0, 7)));
  const contagem = new Map<string, number>();
  for (const l of lancs ?? []) {
    const k = (l.data_competencia as string).slice(0, 7);
    contagem.set(k, (contagem.get(k) ?? 0) + 1);
  }

  const meses = comps.map((c) => ({
    competencia: c,
    fechada: setFechadas.has(c.slice(0, 7)),
    lancamentos: contagem.get(c.slice(0, 7)) ?? 0,
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Fechamento de mês"
        voltar={{ href: "/configuracoes", label: "Configurações" }}
        sub={
          <>
            Proteja os lançamentos de competências já entregues. Empresa:{" "}
          <span className="font-semibold text-ink">{atual?.nome}</span>
          </>
        }
      />
      <FechamentoClient empresaId={empresaId} podeFechar={podeFechar} meses={meses} />
    </div>
  );
}

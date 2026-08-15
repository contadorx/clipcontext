import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { lancarFaturamentoEscritorio } from "@/lib/negocio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function gate() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: adminRow } = await supabase
    .from("membros")
    .select("super_admin")
    .eq("user_id", user?.id ?? "")
    .eq("super_admin", true)
    .maybeSingle();
  return !!adminRow;
}

export async function POST(req: Request) {
  try {
    if (!(await gate())) return NextResponse.json({ erro: "Acesso restrito." }, { status: 403 });
    const body = (await req.json().catch(() => ({}))) as {
      acao?: "definir_master" | "lancar";
      empresa_master_id?: string;
      competencia?: string;
    };
    const admin = createAdminClient();

    if (body.acao === "definir_master") {
      const { error } = await admin
        .from("negocio_config")
        .upsert({ id: 1, empresa_master_id: body.empresa_master_id || null, atualizado_em: new Date().toISOString() });
      if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (body.acao === "lancar") {
      const comp = body.competencia;
      if (!comp) return NextResponse.json({ erro: "Informe a competência." }, { status: 400 });

      const { data: cfg } = await admin.from("negocio_config").select("empresa_master_id").eq("id", 1).maybeSingle();
      const masterId = cfg?.empresa_master_id as string | null;
      if (!masterId) return NextResponse.json({ erro: "Defina a empresa Master primeiro." }, { status: 400 });

      // escritórios pagantes (exclui contas de teste)
      const { data: escs } = await admin
        .from("escritorios")
        .select("id, nome, valor_mensal, assinatura_status, is_teste")
        .eq("assinatura_status", "ativa")
        .eq("is_teste", false);

      let lancados = 0;
      let total = 0;
      let jaFeitos = 0;
      const erros: string[] = [];

      for (const e of escs ?? []) {
        const r = await lancarFaturamentoEscritorio(admin, e, comp);
        if (r.lancado) {
          lancados++;
          total += r.valor ?? 0;
        } else if (r.motivo === "já lançado") {
          jaFeitos++;
        } else if (r.motivo && r.motivo !== "sem valor mensal" && r.motivo !== "sem master") {
          erros.push(`${e.nome}: ${r.motivo}`);
        }
      }

      return NextResponse.json({ ok: true, lancados, total, ja_feitos: jaFeitos, erros });
    }

    return NextResponse.json({ erro: "Ação inválida." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ erro: e instanceof Error ? e.message : "Erro." }, { status: 500 });
  }
}

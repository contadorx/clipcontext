import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

export type CupomValido = { ok: true; codigo: string; percentual: number; duracaoMeses: number | null };
export type CupomInvalido = { ok: false; erro: string };

// Valida um código de cupom contra a base. Usa o admin client (service role),
// pois a tabela cupons não é exposta por RLS.
export async function validarCupom(admin: Admin, codigoRaw: string): Promise<CupomValido | CupomInvalido> {
  const codigo = (codigoRaw || "").trim().toUpperCase();
  if (!codigo) return { ok: false, erro: "Informe um código de cupom." };

  const { data: c } = await admin
    .from("cupons")
    .select("codigo, percentual, duracao_meses, ativo, max_usos, usos")
    .eq("codigo", codigo)
    .maybeSingle();

  if (!c) return { ok: false, erro: "Cupom não encontrado." };
  if (!c.ativo) return { ok: false, erro: "Este cupom não está mais ativo." };
  if (c.max_usos != null && (c.usos ?? 0) >= c.max_usos) {
    return { ok: false, erro: "Este cupom atingiu o limite de usos." };
  }
  return { ok: true, codigo: c.codigo as string, percentual: c.percentual as number, duracaoMeses: (c.duracao_meses as number | null) ?? null };
}

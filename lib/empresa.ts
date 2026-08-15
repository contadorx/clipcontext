import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type Empresa = { id: string; nome: string };

// Dedupe por request: empresas do usuário + a empresa atualmente selecionada.
export const getEmpresaContext = cache(async () => {
  const supabase = createClient();
  const { data } = await supabase
    .from("empresas")
    .select("id, nome")
    .eq("status", "ativa")
    .order("nome");

  const empresas: Empresa[] = data ?? [];
  const cookieId = cookies().get("fx_empresa")?.value;
  const atual =
    empresas.find((e) => e.id === cookieId) ?? empresas[0] ?? null;

  return { empresas, atual };
});

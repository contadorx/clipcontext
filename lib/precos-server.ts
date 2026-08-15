import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { configDeRow, CONFIG_PADRAO, type PrecoConfig } from "@/lib/precos";

export async function carregarPrecoConfig(): Promise<PrecoConfig> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("precos_config")
      .select("faixas, piso, ciclos")
      .eq("id", 1)
      .maybeSingle();
    return configDeRow(data as Parameters<typeof configDeRow>[0]);
  } catch {
    return CONFIG_PADRAO;
  }
}

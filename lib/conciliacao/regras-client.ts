// Carga combinada das regras (empresa + escritório) para client components.
// Faz as queries e resolve as globais para os IDs da empresa corrente.

import { createClient } from "@/lib/supabase/client";
import {
  combinarRegras,
  resolverRegrasEscritorio,
  type RegraClassificacao,
  type RegraEscritorio,
} from "@/lib/conciliacao/regras";

export type RegrasCarregadas = {
  locais: RegraClassificacao[];
  globais: RegraEscritorio[];
  combinadas: (RegraClassificacao & { origem: "empresa" | "escritorio" })[];
  escritorioId: string | null;
};

export async function carregarRegrasCombinadas(
  empresaId: string,
  categorias: { id: string; nome: string; tipo: string }[],
  pessoas: { id: string; nome: string }[],
): Promise<RegrasCarregadas> {
  const supabase = createClient();
  const [{ data: locaisRaw }, { data: emp }] = await Promise.all([
    supabase
      .from("conciliacao_regras")
      .select("id, padrao, tipo, categoria_id, cliente_fornecedor_id")
      .eq("empresa_id", empresaId)
      .order("atualizado_em", { ascending: false }),
    supabase.from("empresas").select("escritorio_id").eq("id", empresaId).maybeSingle(),
  ]);
  const locais = (locaisRaw ?? []) as RegraClassificacao[];
  const escritorioId = (emp?.escritorio_id as string | undefined) ?? null;

  let globais: RegraEscritorio[] = [];
  if (escritorioId) {
    const { data } = await supabase
      .from("regras_escritorio")
      .select("id, padrao, tipo, categoria_nome, pessoa_nome")
      .eq("escritorio_id", escritorioId)
      .order("atualizado_em", { ascending: false });
    globais = (data ?? []) as RegraEscritorio[];
  }

  return {
    locais,
    globais,
    combinadas: combinarRegras(locais, resolverRegrasEscritorio(globais, categorias, pessoas)),
    escritorioId,
  };
}

"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function selecionarEmpresa(id: string) {
  cookies().set("fx_empresa", id, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}

export async function selecionarPeriodo(preset: string) {
  cookies().set("fx_periodo", preset, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}

export async function alternarSidebar(colapsado: boolean) {
  cookies().set("fx_sidebar", colapsado ? "col" : "exp", {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}

/**
 * Só o dono e o administrador mexem na carteira.
 *
 * Server action é endereço público: não basta esconder o botão. `/carteira` não
 * é bloqueável por `menus_bloqueados` (é a tela para onde todo bloqueio manda),
 * então qualquer membro chegava em `/carteira/gerenciar` e podia arquivar,
 * excluir ou trocar o honorário de um cliente. A única coisa entre isso e o
 * banco era a RLS, cujas policies não estão no repositório.
 */
async function exigeGestaoDeCarteira(
  supabase: ReturnType<typeof createClient>,
  empresaId: string,
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Não autenticado.";

  /*
    O papel tem de ser o papel NAQUELE escritório.

    Ler `membros` só por `user_id` erra dos dois lados. Com `maybeSingle()`, um
    contador que tem escritório próprio e também aceitou convite de outro tem
    duas linhas, o PostgREST devolve PGRST116, e o dono legítimo fica sem
    conseguir arquivar, excluir nem editar honorário. Com uma linha só, o papel
    vem de qualquer escritório e nunca é comparado ao da empresa alvo: ser
    administrador no escritório A autorizaria mexer na carteira do escritório B,
    sobrando só a RLS — que é exatamente o que este bloco existe para não ser a
    única defesa.
  */
  const emp = await supabase.from("empresas").select("escritorio_id").eq("id", empresaId).maybeSingle();
  if (emp.error) return `Não foi possível conferir a empresa (${emp.error.message}).`;
  const escId = (emp.data?.escritorio_id as string) ?? "";
  if (!escId) return "Empresa não encontrada.";

  const m = await supabase
    .from("membros")
    .select("papel")
    .eq("user_id", user.id)
    .eq("escritorio_id", escId)
    .maybeSingle();
  // erro de leitura conta como "não sei", e "não sei" não libera
  if (m.error) return `Não foi possível conferir sua permissão (${m.error.message}).`;
  const papel = (m.data?.papel as string) ?? "";
  if (papel !== "owner" && papel !== "admin") return "Só o dono ou um administrador pode gerenciar a carteira.";
  return null;
}

// Gestão da carteira: arquivar (libera licença) ou reativar uma empresa.
export async function definirStatusEmpresa(id: string, arquivar: boolean): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  const barrado = await exigeGestaoDeCarteira(supabase, id);
  if (barrado) return { ok: false, error: barrado };

  /*
    O erro era descartado: arquivar/reativar que falha não dizia nada, e o
    `revalidatePath` desenhava a linha de volta no estado antigo — a pessoa
    concluía que o clique não pegou e tentava de novo.
  */
  const r = await supabase
    .from("empresas")
    .update({
      status: arquivar ? "arquivada" : "ativa",
      arquivada_em: arquivar ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .select("id");
  if (r.error) return { ok: false, error: r.error.message };
  /*
    Zero linhas casadas não é erro no supabase-js. Aqui isso é circular: quem
    arquivou a última empresa só tem `/carteira` liberada, e "Reativar" que
    responde `ok` sem gravar deixa a pessoa clicando para sempre num botão que
    é a única saída que ela tem.
  */
  if ((r.data ?? []).length === 0) {
    return { ok: false, error: "A empresa não foi encontrada para alterar. Recarregue a página." };
  }

  // se arquivou a empresa que estava selecionada, solta a seleção
  if (arquivar && cookies().get("fx_empresa")?.value === id) {
    cookies().delete("fx_empresa");
  }

  revalidatePath("/carteira");
  revalidatePath("/carteira/gerenciar");
  revalidatePath("/configuracoes/assinatura");
  return { ok: true };
}

// Gestão da carteira: exclusão DEFINITIVA de uma empresa (irreversível).
// O banco apaga as tabelas filhas por cascade; aqui limpamos os arquivos do Storage.
export async function excluirEmpresa(id: string): Promise<{ ok: boolean; error?: string; aviso?: string }> {
  const supabase = createClient();
  const barrado = await exigeGestaoDeCarteira(supabase, id);
  if (barrado) return { ok: false, error: barrado };

  const { data, error } = await supabase.rpc("excluir_empresa", { p_empresa: id });
  if (error) return { ok: false, error: error.message };

  /*
    O banco já apagou. O Storage não pode bloquear isso — mas engolir a falha
    deixa os PDFs do cliente excluído no bucket, cobrados, sem linha na tabela e
    sem tela que os alcance. Vira aviso, não erro.
  */
  let aviso: string | undefined;
  const paths = ((data as string[]) ?? []).filter(Boolean);
  if (paths.length > 0) {
    try {
      const admin = createAdminClient();
      const rm = await admin.storage.from("documentos-entrada").remove(paths);
      if (rm.error) {
        console.error("excluirEmpresa: arquivos não removidos do Storage", { id, n: paths.length, erro: rm.error.message });
        aviso = `A empresa foi excluída, mas ${paths.length} arquivo(s) continuam no armazenamento (${rm.error.message}).`;
      }
    } catch {
      console.error("excluirEmpresa: chave de serviço ausente — arquivos mantidos no Storage", { id, n: paths.length });
      aviso = `A empresa foi excluída, mas ${paths.length} arquivo(s) continuam no armazenamento.`;
    }
  }

  if (cookies().get("fx_empresa")?.value === id) {
    cookies().delete("fx_empresa");
  }

  revalidatePath("/carteira");
  revalidatePath("/carteira/gerenciar");
  revalidatePath("/configuracoes/assinatura");
  return { ok: true, aviso };
}

export async function zerarEmpresa(id: string): Promise<{ ok: boolean; error?: string; aviso?: string }> {
  const supabase = createClient();
  /*
    A ação mais destrutiva do arquivo estava fora da guarda.

    `definirStatusEmpresa`, `excluirEmpresa` e `salvarEmpresaGestao` ganharam a
    checagem de papel; esta, que apaga TODOS os lançamentos, extratos e
    documentos da empresa, ficou de fora — e o único filtro era a tela não
    renderizar a Zona de perigo para quem não é dono. Server action é endereço
    público: dá para chamá-la do console com o id que está no cookie.
  */
  const barrado = await exigeGestaoDeCarteira(supabase, id);
  if (barrado) return { ok: false, error: barrado };

  const { data, error } = await supabase.rpc("zerar_empresa", { p_empresa: id });
  if (error) return { ok: false, error: error.message };

  // mesma história da exclusão: o banco já foi, o Storage vira aviso
  let aviso: string | undefined;
  const paths = ((data as string[]) ?? []).filter(Boolean);
  if (paths.length > 0) {
    try {
      const admin = createAdminClient();
      const rm = await admin.storage.from("documentos-entrada").remove(paths);
      if (rm.error) {
        console.error("zerarEmpresa: arquivos não removidos do Storage", { id, n: paths.length, erro: rm.error.message });
        aviso = `Os dados foram apagados, mas ${paths.length} arquivo(s) continuam no armazenamento (${rm.error.message}).`;
      }
    } catch {
      console.error("zerarEmpresa: chave de serviço ausente — arquivos mantidos no Storage", { id, n: paths.length });
      aviso = `Os dados foram apagados, mas ${paths.length} arquivo(s) continuam no armazenamento.`;
    }
  }

  for (const p of ["/painel", "/movimentacoes", "/conciliacao", "/agendamento", "/documentos", "/relatorios", "/carteira"]) {
    revalidatePath(p);
  }
  return { ok: true, aviso };
}

export async function salvarEmpresaGestao(
  id: string,
  dados: { honorario: number | null; responsavel_id: string | null },
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  const barrado = await exigeGestaoDeCarteira(supabase, id);
  if (barrado) return { ok: false, error: barrado };

  // honorário é o número que alimenta o painel do negócio; salvar em silêncio e
  // não gravar deixa a conta do escritório errada sem ninguém saber
  const r = await supabase
    .from("empresas")
    .update({ honorario: dados.honorario, responsavel_id: dados.responsavel_id })
    .eq("id", id)
    .select("id");
  if (r.error) return { ok: false, error: r.error.message };
  if ((r.data ?? []).length === 0) {
    return { ok: false, error: "A empresa não foi encontrada para salvar. Recarregue a página." };
  }
  revalidatePath("/carteira/gerenciar");
  return { ok: true };
}

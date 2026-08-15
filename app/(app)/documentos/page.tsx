import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/page-header";
import { getEmpresaContext } from "@/lib/empresa";
import DocumentosClient, { type DocRow, type EmpresaOpt } from "@/components/documentos/documentos-client";

export const dynamic = "force-dynamic";

export default async function DocumentosPage({ searchParams }: { searchParams: { empresa?: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? "";

  // empresas que o usuário enxerga (RLS já restringe analistas às suas)
  const [{ data: empresas }, { data: docs }, { data: ocultos }, dups] = await Promise.all([
    supabase.from("empresas").select("id, nome, responsavel_id").order("nome"),
    supabase
      .from("documentos_recebidos")
      .select("id, arquivo_nome, tipo, tamanho, observacao, status, enviado_em, baixado_em, lancamento_id, empresa_id, natureza")
      .neq("status", "expurgado")
      .order("enviado_em", { ascending: false })
      /*
        Teto que antes era feito pela retenção.

        Com 45 dias, "tudo que não foi expurgado" era um mês e meio de
        documentos e a consulta sem limite passava despercebida. Com 12 meses são
        oito vezes mais — e o XML, que nunca é expurgado, nunca mais sai desta
        lista. Sem teto, a caixa de entrada de um escritório com anos de uso
        cresce para sempre e vai ficando lenta sem nada avisar. Numa caixa de
        entrada, o que importa são os mais recentes.
      */
      .limit(3000),
    supabase.from("documentos_ocultos").select("documento_id").eq("user_id", userId),
    /*
      `duplicata_de` vem em consulta separada, e não no `select` acima.

      Selecionar uma coluna que não existe é erro 400 no PostgREST, igual a
      inserir: se esta consulta entrasse junto, a Caixa de entrada quebraria
      inteira enquanto a migração de duplicata não tivesse rodado. Separada, ela
      falha sozinha e a tela só fica sem o selo "cópia".
    */
    supabase
      .from("documentos_recebidos")
      .select("id, duplicata_de")
      .neq("status", "expurgado")
      .not("duplicata_de", "is", null)
      // mesma ordem e mesmo teto da consulta principal: sem isso as duas trazem
      // janelas diferentes e o selo "cópia" pisca entre carregamentos, para os
      // mesmos documentos
      .order("enviado_em", { ascending: false })
      .limit(3000),
  ]);

  const emps = (empresas ?? []) as { id: string; nome: string; responsavel_id: string | null }[];
  const nomePorEmpresa = new Map(emps.map((e) => [e.id, e.nome]));
  const visiveis = new Set(emps.map((e) => e.id));
  const minhasEmpresasIds = emps.filter((e) => e.responsavel_id === userId).map((e) => e.id);
  const ocultosSet = new Set(((ocultos ?? []) as { documento_id: string }[]).map((o) => o.documento_id));

  // só documentos de empresas visíveis e não ocultados por mim
  // se a migração de duplicata ainda não rodou, `dups.error` vem preenchido e o
  // conjunto fica vazio: a tela perde o selo "cópia" e mais nada
  const dupMap = new Map(
    (((dups.error ? [] : dups.data) ?? []) as { id: string; duplicata_de: string | null }[]).map((d) => [
      d.id,
      d.duplicata_de,
    ]),
  );

  const lista = ((docs ?? []) as (DocRow & { empresa_id: string })[])
    .filter((d) => !ocultosSet.has(d.id) && visiveis.has(d.empresa_id))
    .map((d) => ({
      ...d,
      empresa_nome: nomePorEmpresa.get(d.empresa_id) ?? "—",
      duplicata_de: dupMap.get(d.id) ?? null,
    }));

  const empresasOpts: EmpresaOpt[] = emps.map((e) => ({ id: e.id, nome: e.nome }));
  const empresaInicial = searchParams.empresa && visiveis.has(searchParams.empresa) ? searchParams.empresa : "";
  // empresa do contexto: é sob ela que as visões salvas desta tela ficam guardadas
  const { atual } = await getEmpresaContext();

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Caixa de entrada"
        sub="Documentos enviados pelos clientes pelo portal, de toda a sua carteira."
      />
      <DocumentosClient
        inicial={lista}
        userId={userId}
        empresas={empresasOpts}
        minhasEmpresasIds={minhasEmpresasIds}
        empresaInicial={empresaInicial}
        empresaAtualId={atual?.id ?? ""}
      />
    </div>
  );
}

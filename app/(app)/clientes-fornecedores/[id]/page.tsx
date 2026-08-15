import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaContext } from "@/lib/empresa";
import ClientesFornecedoresCrud from "@/components/cadastros/clientes-fornecedores-crud";
import PageHeader from "@/components/ui/page-header";
import ObjectStatus from "@/components/ui/object-status";
import NavIrmaos from "@/components/ui/nav-irmaos";
import { vizinhos } from "@/lib/vizinhos";
import { mascaraCpfCnpj } from "@/lib/formato";

export const dynamic = "force-dynamic";

const CAMPOS =
  "id, nome, tipo, pessoa_tipo, email, telefone, cpf_cnpj, razao_social, nome_fantasia, inscricao_estadual, inscricao_municipal, codigo_contabil, cep, logradouro, endereco_numero, complemento, bairro, municipio, uf, codigo_ibge, fav_banco_codigo, fav_agencia, fav_conta, fav_conta_dv, fav_conta_tipo, fav_chave_pix, fav_tipo_chave_pix, tags, ativo, observacoes";

/**
 * Página do cliente/fornecedor.
 *
 * O cadastro tinha 279 linhas de formulário dentro de um diálogo, com seções
 * (identificação, endereço, dados bancários, Pix, tags). Diálogo é a moldura
 * certa para um formulário de cinco campos; para este, cobrava três preços:
 * não dava para mandar o link do cadastro para alguém, o botão voltar do
 * navegador fechava a tela inteira em vez do formulário, e o conteúdo rolava
 * dentro de uma caixa dentro de uma página que também rola.
 *
 * Carrega só este registro — a lista inteira não é necessária aqui.
 */
export default async function PessoaPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { atual } = await getEmpresaContext();

  const { data } = await supabase.from("clientes_fornecedores").select(CAMPOS).eq("id", params.id).maybeSingle();
  // A RLS já barra o que não é da carteira; aqui é só o 404 amigável.
  if (!data) notFound();

  const p = data as {
    id: string;
    nome: string;
    tipo: string;
    cpf_cnpj: string | null;
    municipio: string | null;
    uf: string | null;
    ativo: boolean | null;
  };

  /*
    Vizinhos na mesma ordem da lista (nome A→Z, id como desempate) — e no mesmo
    CONJUNTO, que é a parte que quase escapou.

    A lista esconde inativos por padrão. Navegar só por `empresa_id` fazia Alt+↓
    cair num cadastro que não estava na tela de onde a pessoa veio: ela conferiu
    dez, o sistema mostrou doze. Ordem igual e conjunto diferente dá o mesmo
    resultado de ordem diferente.

    O que este recorte NÃO acompanha: as abas de tipo (cliente/fornecedor), a
    tag e a busca. Fazer isso exigiria carregar o filtro da lista até aqui, e o
    filtro vive no cliente. Fica como limitação conhecida — navegar de dentro de
    uma aba pode sair dela.
  */
  const { anteriorId, proximoId } = await vizinhos(supabase, {
    tabela: "clientes_fornecedores",
    coluna: "nome",
    valor: p.nome,
    id: p.id,
    escopo: { empresa_id: atual?.id ?? "" },
    excluir: p.ativo === false ? undefined : { ativo: false },
  });

  const rotuloTipo = p.tipo === "cliente" ? "Cliente" : p.tipo === "fornecedor" ? "Fornecedor" : "Cliente e fornecedor";
  const local = [p.municipio, p.uf].filter(Boolean).join(" · ");

  return (
    <div className="space-y-4">
      <PageHeader
        titulo={p.nome}
        voltar={{ href: "/clientes-fornecedores", label: "Clientes e Fornecedores" }}
        sub={[rotuloTipo, mascaraCpfCnpj(p.cpf_cnpj ?? ""), local, atual?.nome].filter(Boolean).join(" · ")}
        /*
          `undefined` quando não há nada a mostrar: `acoes` truthy com filhos
          todos nulos ainda renderiza a caixa do PageHeader e come o `gap` da
          largura do título.
        */
        acoes={
          p.ativo === false || anteriorId || proximoId ? (
            <span className="flex items-center gap-2">
              {p.ativo === false && (
                <ObjectStatus pilula tom="neutro">
                  Inativo
                </ObjectStatus>
              )}
              <NavIrmaos base="/clientes-fornecedores" anteriorId={anteriorId} proximoId={proximoId} rotulo="Cadastro" />
            </span>
          ) : undefined
        }
      />
      <ClientesFornecedoresCrud empresaId={atual?.id ?? ""} initial={[data as never]} soId={params.id} />
    </div>
  );
}

import type { createClient } from "@/lib/supabase/client";

/**
 * Antes de excluir um cadastro, contar onde ele é usado.
 *
 * As telas de cadastro excluíam direto. O melhor caso era o banco recusar por
 * FK e a pessoa receber a mensagem do Postgres, em inglês, dentro de um
 * `alert()`; o pior era não haver FK e o registro sumir de baixo de vendas,
 * boletos e notas emitidas — uma venda apontando para um cliente que não existe
 * mais, uma exportação contábil com código órfão.
 *
 * A regra que vale aqui é a mesma que já custou caro neste app: **erro de
 * consulta conta como "não sei", e "não sei" fecha a porta**. A trava de
 * exclusão da conta bancária era o exemplo — `const { count }` com o erro
 * descartado, `(count ?? 0) > 0` falso, e a conta com movimento era apagada
 * porque a consulta de guarda tinha falhado.
 *
 * **O que esta trava não resolve.** `count` numa tabela que a RLS esconde
 * devolve `0` sem erro, indistinguível de "não está em uso" — então a garantia
 * final continua sendo a FK no banco ou uma RPC `security definer`, como já
 * acontece com `excluir_grupo_categoria`. Isto aqui melhora a mensagem e pega o
 * caso comum; não substitui o banco.
 */
export type Vinculo = {
  tabela: string;
  coluna: string;
  /** como falar disso na tela: "lançamento", "venda", "boleto" */
  rotulo: string;
  /** plural, quando não é só somar "s" */
  plural?: string;
  /** onde a pessoa resolve isso, quando não é óbvio */
  onde?: string;
  /**
   * Ignora linhas com `valor = 0`.
   *
   * Orçamento não tem tela de apagar linha: zerar uma célula grava `valor 0` e
   * a linha fica. Sem este filtro, quem preencheu o orçamento de uma categoria
   * e depois desistiu ficava com doze linhas zeradas segurando a categoria para
   * sempre, e a mensagem mandava "mover esses registros" para um lugar que não
   * existe.
   */
  ignorarZerados?: boolean;
};

export type UsoEncontrado = { rotulo: string; n: number; onde?: string };

export type ResultadoUso =
  | { ok: true; total: number; usos: UsoEncontrado[] }
  | { ok: false; erro: string };

/**
 * Tabela que o PostgREST não enxerga (não existe, não está exposta no schema,
 * ou o cache ainda não recarregou). O vínculo é pulado com registro no log —
 * bloquear toda exclusão do app porque uma tabela saiu do ar seria pior.
 */
function ehTabelaAusente(erro: { code?: string; message?: string }): boolean {
  return erro.code === "42P01" || erro.code === "PGRST205";
}

/** Vínculos de cada cadastro. Conservador de propósito: só o que o app usa. */
export const VINCULOS = {
  conta: [
    { tabela: "lancamentos", coluna: "conta_id", rotulo: "lançamento", plural: "lançamentos", onde: "Movimentações" },
    { tabela: "transacoes_extrato", coluna: "conta_id", rotulo: "linha de extrato", plural: "linhas de extrato", onde: "Conciliação" },
    { tabela: "cobranca_titulos", coluna: "conta_id", rotulo: "boleto", plural: "boletos", onde: "Vendas → Boletos" },
    { tabela: "cnab_remessas", coluna: "conta_id", rotulo: "remessa CNAB", plural: "remessas CNAB", onde: "Arquivos bancários" },
    { tabela: "vendas", coluna: "conta_id", rotulo: "venda", plural: "vendas", onde: "Vendas" },
    { tabela: "contratos", coluna: "conta_id", rotulo: "contrato", plural: "contratos", onde: "Vendas → Contratos" },
    { tabela: "recorrencias", coluna: "conta_id", rotulo: "recorrência", plural: "recorrências", onde: "Configurações → Recorrências" },
  ] as Vinculo[],
  pessoa: [
    { tabela: "lancamentos", coluna: "cliente_fornecedor_id", rotulo: "lançamento", plural: "lançamentos", onde: "Movimentações" },
    { tabela: "vendas", coluna: "cliente_fornecedor_id", rotulo: "venda", plural: "vendas", onde: "Vendas" },
    { tabela: "contratos", coluna: "cliente_fornecedor_id", rotulo: "contrato", plural: "contratos", onde: "Vendas → Contratos" },
    { tabela: "cobranca_titulos", coluna: "cliente_fornecedor_id", rotulo: "boleto", plural: "boletos", onde: "Vendas → Boletos" },
    /*
      A nota emitida é o vínculo que mais dói perder: `nfse` sobrevive ao
      zeramento da empresa, e o app deixa apagar a venda que a originou. Sem
      isto, bastava excluir a venda para os outros vínculos zerarem e o cliente
      poder ser apagado — deixando a nota apontando para um cadastro que não
      existe, e o cancelamento sem a quem se referir.
    */
    { tabela: "nfse", coluna: "cliente_fornecedor_id", rotulo: "nota fiscal", plural: "notas fiscais", onde: "Vendas → Notas" },
    { tabela: "recorrencias", coluna: "cliente_fornecedor_id", rotulo: "recorrência", plural: "recorrências", onde: "Configurações → Recorrências" },
  ] as Vinculo[],
  categoria: [
    { tabela: "lancamentos", coluna: "categoria_id", rotulo: "lançamento", plural: "lançamentos", onde: "Movimentações" },
    { tabela: "recorrencias", coluna: "categoria_id", rotulo: "recorrência", plural: "recorrências", onde: "Configurações → Recorrências" },
    { tabela: "orcamentos", coluna: "categoria_id", rotulo: "linha de orçamento", plural: "linhas de orçamento", onde: "Configurações → Orçamento", ignorarZerados: true },
    { tabela: "conciliacao_regras", coluna: "categoria_id", rotulo: "regra de conciliação", plural: "regras de conciliação", onde: "Conciliação → Regras" },
    { tabela: "vendas", coluna: "categoria_id", rotulo: "venda", plural: "vendas", onde: "Vendas" },
    { tabela: "contratos", coluna: "categoria_id", rotulo: "contrato", plural: "contratos", onde: "Vendas → Contratos" },
  ] as Vinculo[],
  centro: [
    { tabela: "lancamentos", coluna: "centro_custo_id", rotulo: "lançamento", plural: "lançamentos", onde: "Movimentações" },
    { tabela: "lancamento_rateios", coluna: "centro_custo_id", rotulo: "rateio", plural: "rateios", onde: "Movimentações" },
    { tabela: "recorrencias", coluna: "centro_custo_id", rotulo: "recorrência", plural: "recorrências", onde: "Configurações → Recorrências" },
    { tabela: "orcamentos_cc", coluna: "centro_custo_id", rotulo: "linha de orçamento", plural: "linhas de orçamento", onde: "Configurações → Orçamento", ignorarZerados: true },
  ] as Vinculo[],
  servico: [
    { tabela: "venda_itens", coluna: "servico_id", rotulo: "item de venda", plural: "itens de venda", onde: "Vendas" },
    { tabela: "contrato_itens", coluna: "servico_id", rotulo: "item de contrato", plural: "itens de contrato", onde: "Vendas → Contratos" },
  ] as Vinculo[],
};

export async function contarUso(
  supabase: ReturnType<typeof createClient>,
  id: string,
  vinculos: Vinculo[],
): Promise<ResultadoUso> {
  /*
    Em paralelo, e não em fila.

    São até sete idas ao banco; em sequência, numa rede ruim, o clique na
    lixeira passava vários segundos sem nada acontecer na tela — e o segundo
    clique disparava um lote concorrente que terminava em dois `confirm()`
    seguidos. Os vínculos são independentes, então não há motivo para esperar um
    para começar o outro.
  */
  const respostas = await Promise.all(
    vinculos.map(async (v) => {
      // `select(v.coluna)` e não `select("id")`: a coluna do vínculo existe por
      // definição, e há tabelas do app (orçamento) com chave composta e sem `id`
      let q = supabase.from(v.tabela).select(v.coluna, { count: "exact", head: true }).eq(v.coluna, id);
      if (v.ignorarZerados) q = q.neq("valor", 0);
      return { v, r: await q };
    }),
  );

  const usos: UsoEncontrado[] = [];
  for (const { v, r } of respostas) {
    if (r.error) {
      if (ehTabelaAusente(r.error)) {
        console.error(`uso-cadastro: tabela ${v.tabela} indisponível — vínculo não conferido`, r.error.message);
        continue;
      }
      return { ok: false, erro: r.error.message };
    }
    const n = r.count ?? 0;
    if (n > 0) usos.push({ rotulo: n === 1 ? v.rotulo : v.plural ?? `${v.rotulo}s`, n, onde: v.onde });
  }
  return { ok: true, total: usos.reduce((s, u) => s + u.n, 0), usos };
}

/** "3 lançamentos, 1 venda e 2 boletos" */
export function descreverUso(usos: UsoEncontrado[]): string {
  const partes = usos.map((u) => `${u.n} ${u.rotulo}`);
  if (partes.length <= 1) return partes[0] ?? "";
  return `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}`;
}

/**
 * "em Movimentações e em Conciliação → Regras"
 *
 * Mensagem que manda resolver algo precisa dizer onde. "Mova esses registros
 * antes" era instrução impossível para uma regra de conciliação — que não se
 * move para lugar nenhum e só é apagada numa tela que a mensagem não citava.
 */
export function ondeResolver(usos: UsoEncontrado[]): string {
  const lugares = Array.from(new Set(usos.map((u) => u.onde).filter((x): x is string => Boolean(x))));
  if (lugares.length === 0) return "";
  if (lugares.length === 1) return ` Resolva em ${lugares[0]}.`;
  return ` Resolva em ${lugares.slice(0, -1).join(", ")} e ${lugares[lugares.length - 1]}.`;
}

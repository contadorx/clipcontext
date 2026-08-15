import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * O anterior e o próximo da lista, para a página do objeto.
 *
 * Sem isto, conferir dez cadastros seguidos custa dez idas e voltas à lista —
 * que é exatamente o que a página do objeto veio resolver. Movimentações já
 * fazia; esta é a extração, para Clientes, Contratos e Contas bancárias não
 * escreverem a mesma consulta com um detalhe diferente cada uma.
 *
 * ## Por que não é `offset`
 *
 * A tentação é "descobrir a posição e pedir a de antes". Isso custa uma
 * varredura da lista inteira a cada abertura e, pior, muda de resposta quando
 * alguém insere um registro no meio enquanto a página está aberta. Aqui é
 * **keyset**: pergunta-se "qual o primeiro cujo campo é maior que este?", que o
 * índice responde direto e que não depende de contagem.
 *
 * ## O desempate pelo id não é decoração
 *
 * Ordenar só por `nome` com dois cadastros homônimos — "Padaria Estrela" duas
 * vezes, que acontece — deixa o par sem ordem definida entre si: o "próximo" de
 * um pode ser ele mesmo, e Alt+↓ trava numa página que nunca avança. O `id`
 * como segundo critério torna a ordem total.
 */
export async function vizinhos(
  supabase: SupabaseClient,
  opcoes: {
    tabela: string;
    /** Coluna que ordena a lista na tela (a mesma, senão a ordem discorda). */
    coluna: string;
    /** Valor da coluna no registro aberto. */
    valor: string | number;
    id: string;
    /** Recorte da lista: `{ empresa_id: "…" }` ou `{ escritorio_id: "…" }`. */
    escopo: Record<string, string>;
    /** `true` quando a tela lista do menor para o maior (nome A→Z). */
    crescente?: boolean;
    /**
     * Linhas a tirar do conjunto, para bater com o que a LISTA mostra —
     * `{ ativo: false }` quando a tela esconde inativos. Ordem igual com
     * conjunto diferente produz o mesmo estrago que ordem diferente: a seta
     * cai num registro que não estava lá.
     */
    excluir?: Record<string, string | number | boolean>;
  },
): Promise<{ anteriorId: string | null; proximoId: string | null }> {
  const { tabela, coluna, valor, id, escopo, crescente = true, excluir } = opcoes;

  /*
    `or` do PostgREST não aceita valor com vírgula sem aspas — e nome de cliente
    com vírgula ("Silva, Maria & Cia") é comum. Sem isto, a consulta vira um
    filtro sintaticamente quebrado e o PostgREST devolve erro; o efeito na tela
    seria a navegação entre irmãos sumir para exatamente os cadastros de nome
    mais complicado, sem nada explicando por quê.
  */
  if (valor === null || valor === undefined) {
    /*
      Coluna anulável com valor nulo: `nome.gt.null` o PostgREST lê como teste
      de nulidade e não casa nada — os dois botões sumiriam sem explicação. Sem
      referência não há vizinho, e dizer isso é melhor que fingir.
    */
    return { anteriorId: null, proximoId: null };
  }

  /*
    A barra invertida vem PRIMEIRO. O PostgREST desescapa `\"` e `\\` dentro da
    string aspada; escapando só a aspa, `Silva \ Cia` chega como `Silva  Cia` e
    devolve o vizinho errado em silêncio, e um nome terminado em `\` escapa a
    aspa de fechamento — a consulta não fecha, vira 400, e os botões somem.
  */
  const v =
    typeof valor === "string"
      ? `"${valor.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
      : valor;

  function consulta(direcao: "maior" | "menor") {
    const op = direcao === "maior" ? "gt" : "lt";
    const asc = direcao === "maior";
    let q = supabase
      .from(tabela)
      .select("id")
      .or(`${coluna}.${op}.${v},and(${coluna}.eq.${v},id.${op}.${id})`)
      .order(coluna, { ascending: asc })
      .order("id", { ascending: asc })
      .limit(1);
    for (const [k, val] of Object.entries(escopo)) q = q.eq(k, val);
    for (const [k, val] of Object.entries(excluir ?? {})) q = q.not(k, "is", val);
    return q.maybeSingle();
  }

  /*
    Numa lista crescente, o "próximo" é o maior; numa decrescente, o menor.
    Trocar isto inverte as setas — e o erro não aparece em tela, só na sensação
    de que Alt+↓ volta.
  */
  const [aRes, pRes] = await Promise.all([
    consulta(crescente ? "menor" : "maior"),
    consulta(crescente ? "maior" : "menor"),
  ]);

  /*
    Erro vira `null`, e `null` desabilita o botão — a navegação some, mas nada
    na página mente. O oposto (ignorar o erro e mostrar o botão) levaria a um
    clique que não vai a lugar nenhum.
  */
  if (aRes.error) console.error(`vizinhos: anterior de ${tabela} falhou`, aRes.error.message);
  if (pRes.error) console.error(`vizinhos: próximo de ${tabela} falhou`, pRes.error.message);

  return {
    anteriorId: (aRes.data as { id: string } | null)?.id ?? null,
    proximoId: (pRes.data as { id: string } | null)?.id ?? null,
  };
}

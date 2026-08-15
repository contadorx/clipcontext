"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, X, ArrowUp, ArrowDown, FolderTree, UploadCloud } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { contarUso, descreverUso, ondeResolver, VINCULOS } from "@/lib/uso-cadastro";
import MessageStrip from "@/components/ui/message-strip";
import Modal, { useSujo } from "@/components/ui/modal";
import Botao from "@/components/ui/botao";
import { CampoTexto, CampoSelect } from "@/components/ui/campo";

type Grupo = {
  id: string;
  nome: string;
  secao: string;
  eh_receita: boolean;
  ordem: number;
};
type Categoria = {
  id: string;
  nome: string;
  grupo_id: string;
  tipo: string; // receber | pagar
};

const SECOES = [
  { v: "operacionais", l: "Operacionais" },
  { v: "financeiro", l: "Financeiro" },
  { v: "caixa", l: "Caixa" },
];
const secaoRank: Record<string, number> = { operacionais: 0, financeiro: 1, caixa: 2 };
function secaoLabel(v: string): string {
  return SECOES.find((s) => s.v === v)?.l ?? v;
}

export default function CategoriasManager({
  empresaId,
  grupos: gruposIni,
  categorias: catsIni,
}: {
  empresaId: string;
  grupos: Grupo[];
  categorias: Categoria[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [grupos, setGrupos] = useState<Grupo[]>(gruposIni);
  const [cats, setCats] = useState<Categoria[]>(catsIni);

  const [catAberto, setCatAberto] = useState(false);
  // guarda contra perder o que foi digitado ao fechar sem salvar
  const form = useSujo(catAberto);
  const [catEditId, setCatEditId] = useState<string | null>(null);
  const [catNome, setCatNome] = useState("");
  const [catGrupo, setCatGrupo] = useState("");
  const [catTipo, setCatTipo] = useState("receber");
  const [catErro, setCatErro] = useState<string | null>(null);
  /*
    Erro da LISTA, separado do erro do formulário.

    O erro do diálogo só é desenhado dentro dele; excluir é acionado da lista,
    com o diálogo fechado. Sem um lugar próprio, a exclusão barrada escrevia
    numa mensagem invisível — clicar, confirmar e nada acontecer, sem
    explicação.
  */
  const [erroLista, setErroLista] = useState<string | null>(null);
  /*
    Qual linha está sendo conferida antes de excluir.

    A contagem de uso é uma ida ao banco por vínculo. Sem indicação, o clique na
    lixeira passava segundos sem nada acontecer, e o segundo clique disparava um
    lote concorrente que terminava em dois `confirm()` seguidos.
  */
  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const gruposOrdenados = [...grupos].sort(
    (a, b) =>
      (secaoRank[a.secao] ?? 9) - (secaoRank[b.secao] ?? 9) ||
      a.ordem - b.ordem ||
      a.nome.localeCompare(b.nome),
  );

  async function recarregar() {
    const supabase = createClient();
    const [g, c] = await Promise.all([
      supabase
        .from("grupos_categoria")
        .select("id, nome, secao, eh_receita, ordem")
        .eq("empresa_id", empresaId)
        .order("ordem"),
      supabase
        .from("categorias")
        .select("id, nome, grupo_id, tipo")
        .eq("empresa_id", empresaId)
        .order("nome"),
    ]);
    setGrupos((g.data as Grupo[]) ?? []);
    setCats((c.data as Categoria[]) ?? []);
    router.refresh();
  }

  function novoSubgrupo(grupo?: Grupo) {
    setCatEditId(null);
    setCatNome("");
    setCatGrupo(grupo?.id ?? grupos[0]?.id ?? "");
    setCatTipo(grupo?.eh_receita ? "receber" : "pagar");
    setCatErro(null);
    setCatAberto(true);
  }
  function editarSubgrupo(c: Categoria) {
    setCatEditId(c.id);
    setCatNome(c.nome);
    setCatGrupo(c.grupo_id);
    setCatTipo(c.tipo);
    setCatErro(null);
    setCatAberto(true);
  }
  async function salvarSubgrupo() {
    // trava de duplo envio dentro da função. Aqui o único caminho é o botão,
    // que já tem `disabled` — isto existe para o dia em que alguém acrescentar
    // um Enter ou um atalho, como nas telas vizinhas
    if (salvando) return;
    setCatErro(null);
    if (!catNome.trim()) return setCatErro("Informe o nome.");
    if (!catGrupo) return setCatErro("Escolha um grupo.");
    const payload = { nome: catNome.trim(), grupo_id: catGrupo, tipo: catTipo };
    setSalvando(true);
    const supabase = createClient();
    /*
      `.select("id")` no update: zero linhas casadas devolve
      `{ data: null, error: null }` — "salvo" na tela e nada no banco.
    */
    const resp = catEditId
      ? await supabase.from("categorias").update(payload).eq("id", catEditId).select("id")
      : await supabase.from("categorias").insert({ empresa_id: empresaId, ...payload });
    setSalvando(false);
    if (resp.error) return setCatErro(resp.error.message);
    if (catEditId && (resp.data ?? []).length === 0) {
      return setCatErro("O subgrupo não foi encontrado para salvar. Recarregue a página — ele pode ter sido excluído em outra aba.");
    }
    setCatAberto(false);
    await recarregar();
  }
  async function excluirGrupo(g: Grupo) {
    const filhos = cats.filter((c) => c.grupo_id === g.id);
    const aviso =
      filhos.length > 0
        ? `Excluir o grupo "${g.nome}" e seus ${filhos.length} subgrupo(s)?\n\nSó funciona se nenhum subgrupo estiver em uso em lançamentos.`
        : `Excluir o grupo "${g.nome}"?`;
    // `confirm()` fica: excluir grupo leva os subgrupos junto, por RPC, e não
    // há retrato único para reinserir — a contagem no aviso é o que protege
    if (!confirm(aviso)) return;
    const supabase = createClient();
    const { error } = await supabase.rpc("excluir_grupo_categoria", { p_grupo: g.id });
    if (error) {
      setErroLista(
        /violat|foreign key|lançament|lancament/i.test(error.message)
          ? "Não foi possível excluir: há subgrupo em uso em lançamentos. Mova os lançamentos para outro subgrupo (ou mova os subgrupos para outro grupo) e tente de novo."
          : "Não foi possível excluir o grupo. " + error.message,
      );
      return;
    }
    setErroLista(null);
    setGrupos((gs) => gs.filter((x) => x.id !== g.id));
    setCats((cs) => cs.filter((c) => c.grupo_id !== g.id));
  }

  async function excluirSubgrupo(c: Categoria) {
    if (excluindoId) return;
    setExcluindoId(c.id);
    try {
      const supabase = createClient();
      /*
        Antes: `alert("Pode haver lançamentos usando este subgrupo")` para
        QUALQUER erro. Engolia a mensagem real e mentia quando a falha era de
        rede — a pessoa saía procurando lançamentos que não existiam.
      */
      const uso = await contarUso(supabase, c.id, VINCULOS.categoria);
      if (!uso.ok) {
        setErroLista(`Não foi possível conferir se "${c.nome}" está em uso (${uso.erro}). Nada foi excluído — tente de novo.`);
        return;
      }
      if (uso.total > 0) {
        setErroLista(
          `O subgrupo "${c.nome}" está em ${descreverUso(uso.usos)} e não pode ser excluído.${ondeResolver(uso.usos)}`,
        );
        return;
      }
      /*
        Sem `confirm()`: exclusão imediata com Desfazer.

        O cadastro só chega aqui depois de a contagem confirmar que ele não está
        em uso — ou seja, a pergunta do navegador cobrava um clique para
        proteger de um estrago que a trava acima já impediu. O padrão do resto do
        app (Movimentações, Conciliação) é agir e oferecer volta; `confirm()`
        fica só onde não há volta.

        O retrato completo da linha vai junto: é ele que o Desfazer reinsere.
      */
      const back = await supabase.from("categorias").select("*").eq("id", c.id).maybeSingle();
      const r = await supabase.from("categorias").delete().eq("id", c.id);
      if (r.error) {
        setErroLista(`Não foi possível excluir o subgrupo (${r.error.message}).`);
        return;
      }
      setErroLista(null);
      await recarregar();
      const linha = back.error ? null : back.data;
      toast(linha ? `Subgrupo excluído: ${c.nome}.` : `Subgrupo excluído: ${c.nome}. Não foi possível preparar o Desfazer.`, {
        desfazer: linha
          ? async () => {
              const volta = await createClient().from("categorias").insert(linha as Record<string, unknown>);
              if (volta.error) {
                toast(`Não foi possível restaurar (${volta.error.message}).`, { tom: "erro" });
                return;
              }
              await recarregar();
            }
          : undefined,
      });
    } finally {
      setExcluindoId(null);
    }
  }

  return (
    <div className="space-y-4">
      {erroLista && (
        <MessageStrip tipo="erro" fechavel onFechar={() => setErroLista(null)}>
          {erroLista}
        </MessageStrip>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-soft">
          Crie e organize seus <b>subgrupos</b> dentro dos grupos — é onde você lança e onde o
          relatório abre. Dá para excluir um grupo inteiro (se nenhum subgrupo estiver em uso em lançamentos).
        </p>
        <div className="flex items-center gap-2">
          <Link
            href="/importar?tipo=categorias"
            className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink transition hover:bg-surface"
          >
            <UploadCloud size={15} /> Importar
          </Link>
          {/*
            Sem grupo, criar subgrupo é impossível — e o botão ficava clicável.

            O diálogo abria com o select de grupo vazio e salvar respondia
            "Escolha um grupo." num campo onde só havia "Selecione…". A tela
            oferecia uma tarefa que ela mesma tornava impossível de concluir.
          */}
          <button
            type="button"
            onClick={() => novoSubgrupo()}
            disabled={grupos.length === 0}
            title={grupos.length === 0 ? "Crie os grupos desta empresa antes de criar subgrupos" : undefined}
            className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={15} /> Novo subgrupo
          </button>
        </div>
      </div>

      {grupos.length === 0 ? (
        <div className="rounded-xl2 border border-dashed border-line bg-white px-6 py-14 text-center">
          <p className="text-sm font-semibold text-ink">Esta empresa ainda não tem os grupos de categoria</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
            Os grupos são a moldura fixa do plano (Operacional, Financeiro, Investimento, Financiamento) e os
            subgrupos moram dentro deles. Sem grupo não há onde criar subgrupo.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Link
              href="/configuracoes/modelos-plano-contas"
              className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-dark"
            >
              Aplicar um modelo de plano de contas
            </Link>
            <Link
              href="/importar?tipo=categorias"
              className="rounded-md border border-line px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-surface"
            >
              Importar de uma planilha
            </Link>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl2 bg-white shadow-card">
          {gruposOrdenados.map((g) => {
            const filhos = cats
              .filter((c) => c.grupo_id === g.id)
              .sort((a, b) => a.nome.localeCompare(b.nome));
            return (
              <div key={g.id} className="border-b border-line last:border-0">
                <div className="flex items-center justify-between bg-surface/70 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <FolderTree size={14} className="text-ink-soft" />
                    <span className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">{g.nome}</span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-semibold text-ink-soft">
                      {secaoLabel(g.secao)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => novoSubgrupo(g)}
                      title="Adicionar subgrupo neste grupo"
                      className="flex h-7 w-7 items-center justify-center rounded-md text-ink-soft transition hover:bg-white hover:text-brand"
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => excluirGrupo(g)}
                      title="Excluir este grupo"
                      className="flex h-7 w-7 items-center justify-center rounded-md text-ink-soft transition hover:bg-rose-50 hover:text-danger"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {filhos.length === 0 ? (
                  <p className="px-4 py-2.5 text-xs text-ink-soft">Sem subgrupos neste grupo.</p>
                ) : (
                  filhos.map((c) => {
                    const receita = c.tipo === "receber";
                    return (
                      <div
                        key={c.id}
                        className="flex items-center justify-between border-t border-line/60 px-4 py-2.5 text-sm first:border-t-0"
                      >
                        <span className="flex items-center gap-2 text-ink">
                          {receita ? (
                            <ArrowUp size={14} className="text-brand" />
                          ) : (
                            <ArrowDown size={14} className="text-danger" />
                          )}
                          {c.nome}
                        </span>
                        <span className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => editarSubgrupo(c)}
                            title="Editar"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition hover:bg-surface hover:text-ink"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => excluirSubgrupo(c)}
                            title="Excluir"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition hover:bg-rose-50 hover:text-danger"
                          >
                            <Trash2 size={14} />
                          </button>
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal
        rotulo={catEditId ? `Editar subgrupo ${catNome}`.trim() : "Novo subgrupo"}
        aberto={catAberto}
        onFechar={() => setCatAberto(false)}
        sujo={form.sujo}
        largura="max-w-sm"
      >
        <div className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-bold text-ink">{catEditId ? "Editar subgrupo" : "Novo subgrupo"}</h3>
            <button aria-label="Fechar"
              type="button"
              onClick={() => form.confirmar() && setCatAberto(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft hover:bg-surface"
            >
              <X size={18} />
            </button>
          </div>
          <div className="space-y-3" {...form.campos}>
            <CampoTexto
              id="categoria-nome"
              rotulo="Nome"
              value={catNome}
              onChange={(e) => setCatNome(e.target.value)}
              placeholder="Ex.: Energia elétrica"
            />
            <CampoSelect
              id="categoria-grupo"
              rotulo="Grupo"
              value={catGrupo}
              onChange={(e) => setCatGrupo(e.target.value)}
            >
              <option value="">Selecione…</option>
              {gruposOrdenados.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nome}
                </option>
              ))}
            </CampoSelect>
            <div>
              {/*
                "Tipo" são dois botões, não um campo: como `<label>` ele não
                tinha controle para apontar e clicar nele não fazia nada. Vira
                o nome do grupo de botões, que é o que ele de fato rotula.
              */}
              <span id="categoria-tipo-rotulo" className="mb-1 block text-xs font-semibold text-ink-muted">
                Tipo
              </span>
              <div className="flex gap-2" role="group" aria-labelledby="categoria-tipo-rotulo">
                <button
                  type="button"
                  onClick={() => setCatTipo("receber")}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2.5 text-sm font-semibold transition ${
                    catTipo === "receber"
                      ? "border-brand bg-brand-light text-brand-dark"
                      : "border-line text-ink-muted hover:bg-surface"
                  }`}
                >
                  <ArrowUp size={15} /> Receita
                </button>
                <button
                  type="button"
                  onClick={() => setCatTipo("pagar")}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2.5 text-sm font-semibold transition ${
                    catTipo === "pagar"
                      ? "border-danger bg-rose-50 text-danger"
                      : "border-line text-ink-muted hover:bg-surface"
                  }`}
                >
                  <ArrowDown size={15} /> Despesa
                </button>
              </div>
            </div>
            {catErro && (
              <MessageStrip tipo="erro">{catErro}</MessageStrip>
            )}
            <Botao variante="primario" largura
              onClick={salvarSubgrupo}
              disabled={salvando}
            >
              {salvando ? "Salvando…" : catEditId ? "Salvar" : "Adicionar"}
            </Botao>
          </div>
        </div>
      </Modal>
    </div>
  );
}

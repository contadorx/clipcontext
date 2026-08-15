"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, X, Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { contarUso, descreverUso, ondeResolver, VINCULOS } from "@/lib/uso-cadastro";
import MessageStrip from "@/components/ui/message-strip";
import Modal, { useSujo } from "@/components/ui/modal";
import { useAtalhosModal } from "@/lib/atalhos";
import EmptyState from "@/components/ui/empty-state";
import Botao, { BotaoIcone } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo";

type Centro = { id: string; nome: string };

export default function CentrosCustoCrud({
  empresaId,
  initial,
}: {
  empresaId: string;
  initial: Centro[];
}) {
  const [lista, setLista] = useState<Centro[]>(initial);
  const router = useRouter();
  const { toast } = useToast();
  const [aberto, setAberto] = useState(false);
  // guarda contra perder o que foi digitado ao fechar sem salvar
  const form = useSujo(aberto);
  const [editId, setEditId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);
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

  // só o ⌘/Ctrl+Enter: o Esc é do Modal, que já confirma o descarte
  useAtalhosModal(aberto, { onConfirmar: () => salvar() });

  function abrirNovo() {
    setEditId(null);
    setNome("");
    setErro(null);
    setAberto(true);
  }
  function abrirEdicao(c: Centro) {
    setEditId(c.id);
    setNome(c.nome);
    setErro(null);
    setAberto(true);
  }

  async function recarregar() {
    const supabase = createClient();
    const { data } = await supabase
      .from("centros_custo")
      .select("id, nome")
      .eq("empresa_id", empresaId)
      .order("nome");
    setLista((data as Centro[]) ?? []);
    router.refresh();
  }

  async function salvar() {
    /*
      A trava de duplo envio precisa estar DENTRO de `salvar`, não só no botão.

      Esta tela é a única com Enter puro no campo (`onKeyDown` mais abaixo) além
      do atalho do modal, e os dois chamavam `salvar()` direto enquanto só o
      botão checava `salvando`. Dois Enter rápidos criavam dois centros de custo
      idênticos.
    */
    if (salvando) return;
    setErro(null);
    if (!nome.trim()) {
      setErro("Informe o nome.");
      return;
    }
    setSalvando(true);
    const supabase = createClient();
    /*
      `.select("id")` no update: `update().eq()` que casa zero linhas devolve
      `{ data: null, error: null }` no supabase-js — "salvo" na tela e nada no
      banco quando a RLS barra a linha.
    */
    const resp = editId
      ? await supabase.from("centros_custo").update({ nome: nome.trim() }).eq("id", editId).select("id")
      : await supabase.from("centros_custo").insert({ empresa_id: empresaId, nome: nome.trim() });
    setSalvando(false);
    if (resp.error) {
      setErro(resp.error.message);
      return;
    }
    if (editId && (resp.data ?? []).length === 0) {
      setErro("O centro de custo não foi encontrado para salvar. Recarregue a página — ele pode ter sido excluído em outra aba.");
      return;
    }
    setAberto(false);
    await recarregar();
  }

  async function excluir(c: Centro) {
    if (excluindoId) return;
    setExcluindoId(c.id);
    try {
      const supabase = createClient();
      const uso = await contarUso(supabase, c.id, VINCULOS.centro);
      if (!uso.ok) {
        setErroLista(`Não foi possível conferir se "${c.nome}" está em uso (${uso.erro}). Nada foi excluído — tente de novo.`);
        return;
      }
      if (uso.total > 0) {
        setErroLista(
          `O centro de custo "${c.nome}" está em ${descreverUso(uso.usos)} e não pode ser excluído.${ondeResolver(uso.usos)}`,
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
      const back = await supabase.from("centros_custo").select("*").eq("id", c.id).maybeSingle();
      const r = await supabase.from("centros_custo").delete().eq("id", c.id);
      if (r.error) {
        setErroLista(r.error.message);
        return;
      }
      setErroLista(null);
      await recarregar();
      const linha = back.error ? null : back.data;
      toast(linha ? `Centro de custo excluído: ${c.nome}.` : `Centro de custo excluído: ${c.nome}. Não foi possível preparar o Desfazer.`, {
        desfazer: linha
          ? async () => {
              const volta = await createClient().from("centros_custo").insert(linha as Record<string, unknown>);
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
    <div className="rounded-xl2 bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <div>
          <h2 className="text-[13px] font-bold text-ink">Centros de custo</h2>
          <p className="text-xs text-ink-muted">Para ratear receitas e despesas por área, projeto ou unidade.</p>
        </div>
        <Botao variante="primario" tamanho="sm" onClick={abrirNovo}>
          <Plus size={13} /> Novo centro
        </Botao>
      </div>

      {erroLista && (
        <div className="px-5 pt-4">
          <MessageStrip tipo="erro" fechavel onFechar={() => setErroLista(null)}>
            {erroLista}
          </MessageStrip>
        </div>
      )}

      {lista.length === 0 ? (
        <EmptyState
          icone={Building2}
          titulo="Nenhum centro de custo ainda"
          descricao="Servem para ratear receitas e despesas por área, projeto ou unidade."
          acao={
            <Botao variante="primario" tamanho="sm" onClick={abrirNovo}>
              <Plus size={13} /> Criar o primeiro
            </Botao>
          }
        />
      ) : (
        <div className="px-5 py-2">
          {lista.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between border-b border-line py-2.5 text-sm last:border-0"
            >
              <span className="font-medium text-ink">{c.nome}</span>
              <span className="flex gap-1">
                <BotaoIcone rotulo={`Editar ${c.nome}`} onClick={() => abrirEdicao(c)}>
                  <Pencil size={15} />
                </BotaoIcone>
                <BotaoIcone rotulo={`Excluir ${c.nome}`} variante="perigo" onClick={() => excluir(c)}>
                  <Trash2 size={15} />
                </BotaoIcone>
              </span>
            </div>
          ))}
        </div>
      )}

      <Modal
        rotulo={editId ? `Editar centro de custo ${nome}`.trim() : "Novo centro de custo"}
        aberto={aberto}
        onFechar={() => setAberto(false)}
        sujo={form.sujo}
        largura="max-w-sm"
      >
        <div className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-bold text-ink">
              {editId ? "Editar centro" : "Novo centro de custo"}
            </h3>
            <BotaoIcone rotulo="Fechar" onClick={() => form.confirmar() && setAberto(false)}>
              <X size={18} />
            </BotaoIcone>
          </div>
          <div className="space-y-3" {...form.campos}>
            <CampoTexto
              id="centro-nome"
              rotulo="Nome"
              obrigatorio
              autoFocus
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && salvar()}
              placeholder="Ex.: Administrativo, Loja 1, Projeto X"
              erro={erro}
            />
            <Botao variante="primario" largura onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando…" : editId ? "Salvar" : "Adicionar"}
            </Botao>
          </div>
        </div>
      </Modal>
    </div>
  );
}

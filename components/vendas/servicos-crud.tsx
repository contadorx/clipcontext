"use client";

import { useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, X, Search, Briefcase, ChevronDown, ChevronUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { contarUso, descreverUso, ondeResolver, VINCULOS } from "@/lib/uso-cadastro";
import MessageStrip from "@/components/ui/message-strip";
import Modal, { useSujo } from "@/components/ui/modal";
import EmptyState from "@/components/ui/empty-state";
import ObjectStatus from "@/components/ui/object-status";
import { brl } from "@/lib/formato";
import Botao from "@/components/ui/botao";
import { CampoArea, CampoSelect, CampoTexto, classeControle } from "@/components/ui/campo";
import { useListaNavegavel } from "@/components/ui/use-lista-navegavel";

export type Servico = {
  id: string;
  nome: string;
  descricao: string | null;
  valor: number;
  unidade: string | null;
  ativo: boolean;
  item_lc116: string | null;
  codigo_tributacao_municipal: string | null;
  cnae: string | null;
  aliquota_iss: number;
  iss_retido: boolean;
  exigibilidade_iss: string;
};

const EXIGIBILIDADE: { v: string; l: string }[] = [
  { v: "exigivel", l: "Exigível" },
  { v: "nao_incidencia", l: "Não incidência" },
  { v: "isencao", l: "Isenção" },
  { v: "imunidade", l: "Imunidade" },
  { v: "suspensa", l: "Exigibilidade suspensa" },
];

const vazio: Omit<Servico, "id"> = {
  nome: "",
  descricao: "",
  valor: 0,
  unidade: "mês",
  ativo: true,
  item_lc116: "",
  codigo_tributacao_municipal: "",
  cnae: "",
  aliquota_iss: 0,
  iss_retido: false,
  exigibilidade_iss: "exigivel",
};

export default function ServicosCrud({ empresaId, initial }: { empresaId: string; initial: Servico[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [lista, setLista] = useState<Servico[]>(initial);
  const [busca, setBusca] = useState("");
  const buscaRef = useRef<HTMLInputElement>(null);
  const [aberto, setAberto] = useState(false);
  // guarda contra perder o que foi digitado ao fechar sem salvar
  const guarda = useSujo(aberto);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Servico, "id">>(vazio);
  const [fiscalAberto, setFiscalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  /*
    Mensagem da LISTA. `msg` só é desenhada dentro do diálogo, e excluir é
    acionado da lista com o diálogo fechado: a falha da exclusão ia para uma
    mensagem que nunca aparecia na tela. A pessoa clicava, confirmava, nada
    acontecia — e não havia nada a ler.
  */
  const [msgLista, setMsgLista] = useState<string | null>(null);
  /** linha sendo conferida antes de excluir — evita clique repetido */
  const [excluindoId, setExcluindoId] = useState<string | null>(null);

  const filtrada = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter(
      (s) => s.nome.toLowerCase().includes(q) || (s.descricao ?? "").toLowerCase().includes(q),
    );
  }, [lista, busca]);

  /*
    Serviço é a única das sete listas SEM página de objeto: o cadastro vive num
    diálogo. `abrir` aponta para ele, e isso mantém o padrão coerente — a linha
    abre "o objeto", qualquer que seja a porta que a tela tenha. O que não pode
    é o gesto abrir uma coisa e o botão outra.
  */
  const nav = useListaNavegavel({
    itens: filtrada,
    abrir: (s) => editar(s),
    aoNovo: () => novo(),
    buscaRef,
    desligado: aberto,
  });

  function novo() {
    setEditId(null);
    setForm(vazio);
    setFiscalAberto(false);
    setMsg(null);
    setAberto(true);
  }
  function editar(s: Servico) {
    setEditId(s.id);
    setForm({
      nome: s.nome,
      descricao: s.descricao ?? "",
      valor: s.valor,
      unidade: s.unidade ?? "",
      ativo: s.ativo,
      item_lc116: s.item_lc116 ?? "",
      codigo_tributacao_municipal: s.codigo_tributacao_municipal ?? "",
      cnae: s.cnae ?? "",
      aliquota_iss: s.aliquota_iss,
      iss_retido: s.iss_retido,
      exigibilidade_iss: s.exigibilidade_iss,
    });
    setFiscalAberto(!!(s.item_lc116 || s.codigo_tributacao_municipal || s.aliquota_iss));
    setMsg(null);
    setAberto(true);
  }

  async function salvar() {
    if (!form.nome.trim()) {
      setMsg({ tipo: "erro", texto: "Informe o nome do serviço." });
      return;
    }
    setSalvando(true);
    const supabase = createClient();
    const payload = {
      empresa_id: empresaId,
      nome: form.nome.trim(),
      descricao: form.descricao?.trim() || null,
      valor: Number(form.valor) || 0,
      unidade: form.unidade?.trim() || null,
      ativo: form.ativo,
      item_lc116: form.item_lc116?.trim() || null,
      codigo_tributacao_municipal: form.codigo_tributacao_municipal?.trim() || null,
      cnae: form.cnae?.trim() || null,
      aliquota_iss: Number(form.aliquota_iss) || 0,
      iss_retido: form.iss_retido,
      exigibilidade_iss: form.exigibilidade_iss,
    };
    if (editId) {
      const { data, error } = await supabase.from("servicos").update(payload).eq("id", editId).select().single();
      setSalvando(false);
      if (error) {
        setMsg({ tipo: "erro", texto: error.message });
        return;
      }
      setLista((l) => l.map((s) => (s.id === editId ? (data as Servico) : s)).sort((a, b) => a.nome.localeCompare(b.nome)));
    } else {
      const { data, error } = await supabase.from("servicos").insert(payload).select().single();
      setSalvando(false);
      if (error) {
        setMsg({ tipo: "erro", texto: error.message });
        return;
      }
      setLista((l) => [...l, data as Servico].sort((a, b) => a.nome.localeCompare(b.nome)));
    }
    setAberto(false);
    router.refresh();
  }

  async function excluir(s: Servico) {
    if (excluindoId) return;
    setExcluindoId(s.id);
    try {
      const supabase = createClient();
      const uso = await contarUso(supabase, s.id, VINCULOS.servico);
      if (!uso.ok) {
        setMsgLista(`Não foi possível conferir se "${s.nome}" está em uso (${uso.erro}). Nada foi excluído — tente de novo.`);
        return;
      }
      if (uso.total > 0) {
        setMsgLista(
          `O serviço "${s.nome}" está em ${descreverUso(uso.usos)} e não pode ser excluído.${ondeResolver(uso.usos)} Ou desmarque "Ativo" para tirá-lo das listas de escolha sem mexer no histórico.`,
        );
        return;
      }
      /*
        Sem `confirm()`: exclusão imediata com Desfazer.

        O cadastro só chega aqui depois de a contagem confirmar que ele não está
        em uso — a pergunta do navegador cobrava um clique para proteger de um
        estrago que a trava acima já impediu. `confirm()` fica só onde não há
        volta. O retrato da linha é o que o Desfazer reinsere.
      */
      const back = await supabase.from("servicos").select("*").eq("id", s.id).maybeSingle();
      const r = await supabase.from("servicos").delete().eq("id", s.id);
      if (r.error) {
        setMsgLista(r.error.message);
        return;
      }
      setMsgLista(null);
      setLista((l) => l.filter((x) => x.id !== s.id));
      router.refresh();
      const linha = back.error ? null : back.data;
      toast(linha ? `Serviço excluído: ${s.nome}.` : `Serviço excluído: ${s.nome}. Não foi possível preparar o Desfazer.`, {
        desfazer: linha
          ? async () => {
              const volta = await createClient().from("servicos").insert(linha as Record<string, unknown>).select().single();
              if (volta.error) {
                toast(`Não foi possível restaurar (${volta.error.message}).`, { tom: "erro" });
                return;
              }
              setLista((l) => [...l, volta.data as Servico].sort((x, y) => x.nome.localeCompare(y.nome)));
              router.refresh();
            }
          : undefined,
      });
    } finally {
      setExcluindoId(null);
    }
  }

  return (
    <div className="space-y-4">
      {msgLista && (
        <MessageStrip tipo="erro" fechavel onFechar={() => setMsgLista(null)}>
          {msgLista}
        </MessageStrip>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative max-w-xs flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft" />
          {/*
            `aria-label` em vez de rótulo visível: a lupa fica dentro do campo e
            o campo divide a linha com o botão "Novo serviço" — um rótulo acima
            desalinharia os dois. Sem ele o campo é anunciado sem nome.
          */}
          <input
            id="servico-busca"
            ref={buscaRef}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            aria-label="Buscar serviço"
            placeholder="Buscar serviço…"
            className={classeControle("sm", false, "pl-8 pr-2")}
          />
        </div>
        <Botao variante="primario"
          onClick={novo}
        >
          <Plus size={16} /> Novo serviço
        </Botao>
      </div>

      {lista.length === 0 ? (
        <EmptyState
          icone={Briefcase}
          titulo="Nenhum serviço cadastrado ainda"
          acao={
            <button type="button" onClick={novo} className="text-sm font-semibold text-brand hover:underline">
              Cadastrar o primeiro
            </button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl2 bg-white shadow-card">
          {filtrada.map((s) => {
            const { onClick, emFoco, ...resto } = nav.propsLinha(s);
            return (
            <div
              key={s.id}
              {...resto}
              onClick={onClick}
              className={`flex cursor-pointer items-center gap-3 border-b border-line/60 px-4 py-3 last:border-0 ${
                emFoco ? "ring-2 ring-inset ring-brand/40 hover:bg-surface/40" : "hover:bg-surface/40"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-ink">{s.nome}</span>
                  {!s.ativo && (
                    <ObjectStatus pilula tom="neutro" semMarcador className="shrink-0">
                      inativo
                    </ObjectStatus>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-ink-soft">
                  {s.descricao && <span className="truncate">{s.descricao}</span>}
                  {s.item_lc116 && <span>LC116 {s.item_lc116}</span>}
                  {s.aliquota_iss > 0 && <span>ISS {s.aliquota_iss}%</span>}
                </div>
              </div>
              <span className="num shrink-0 text-sm font-semibold text-ink">
                {brl(s.valor)}
                {s.unidade ? <span className="text-[11px] font-normal text-ink-soft">/{s.unidade}</span> : null}
              </span>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => editar(s)}
                  className="rounded-lg p-1.5 text-ink-soft transition hover:bg-surface hover:text-brand"
                  aria-label={`Editar ${s.nome}`}
                >
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => excluir(s)}
                  className="rounded-lg p-1.5 text-ink-soft transition hover:bg-surface hover:text-danger"
                  aria-label={`Excluir ${s.nome}`}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
            );
          })}
          {filtrada.length === 0 && (
            <EmptyState compacto titulo="Nenhum serviço bate com a busca" />
          )}
        </div>
      )}

      <Modal
        rotulo={editId ? `Editar serviço ${form.nome}`.trim() : "Novo serviço"}
        aberto={aberto}
        onFechar={() => setAberto(false)}
        sujo={guarda.sujo}
        rolagem
      >
        <div {...guarda.campos}>
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <h2 className="text-[13px] font-bold text-ink">{editId ? "Editar serviço" : "Novo serviço"}</h2>
            <button
              aria-label="Fechar"
              type="button"
              onClick={() => guarda.confirmar() && setAberto(false)}
              className="rounded-lg p-1 text-ink-soft hover:bg-surface"
            >
              <X size={18} />
            </button>
          </div>

          <div className="space-y-3 px-5 py-4">
            <CampoTexto
              id="servico-nome"
              rotulo="Nome"
              obrigatorio
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="ex.: Consultoria contábil mensal"
              autoFocus
            />
            <CampoArea
              id="servico-descricao"
              rotulo="Descrição (discriminação na NFS-e)"
              value={form.descricao ?? ""}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              rows={2}
              placeholder="Texto que descreve o serviço prestado na nota."
              inputClassName="resize-none"
            />
            <div className="grid grid-cols-2 gap-3">
              <CampoTexto
                id="servico-valor"
                rotulo="Valor padrão (R$)"
                type="number"
                inputMode="decimal"
                step="0.01"
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })}
                inputClassName="num"
              />
              <CampoTexto
                id="servico-unidade"
                rotulo="Unidade"
                list="unidades-servico"
                value={form.unidade ?? ""}
                onChange={(e) => setForm({ ...form, unidade: e.target.value })}
                placeholder="mês, hora, unidade…"
              />
              {/* o `datalist` não vira coluna do grid: `display:none` não gera caixa */}
              <datalist id="unidades-servico">
                <option value="mês" />
                <option value="hora" />
                <option value="unidade" />
                <option value="projeto" />
              </datalist>
            </div>

            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                className="h-4 w-4 rounded border-line text-brand focus:ring-brand"
              />
              Serviço ativo (disponível para vendas e contratos)
            </label>

            {/* dados fiscais */}
            <div className="rounded-lg border border-line">
              <button
                type="button"
                onClick={() => setFiscalAberto((v) => !v)}
                className="flex w-full items-center justify-between px-3 py-2.5 text-left"
              >
                <span className="text-xs font-bold text-ink">Dados fiscais (NFS-e)</span>
                {fiscalAberto ? <ChevronUp size={15} className="text-ink-soft" /> : <ChevronDown size={15} className="text-ink-soft" />}
              </button>
              {fiscalAberto && (
                <div className="space-y-3 border-t border-line px-3 py-3">
                  <div className="grid grid-cols-2 gap-3">
                    <CampoTexto
                      id="servico-item-lc116"
                      rotulo="Item LC 116"
                      value={form.item_lc116 ?? ""}
                      onChange={(e) => setForm({ ...form, item_lc116: e.target.value })}
                      placeholder="ex.: 17.19"
                    />
                    <CampoTexto
                      id="servico-codigo-tributacao-municipal"
                      rotulo="Cód. tributação municipal"
                      value={form.codigo_tributacao_municipal ?? ""}
                      onChange={(e) => setForm({ ...form, codigo_tributacao_municipal: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <CampoTexto
                      id="servico-cnae"
                      rotulo="CNAE"
                      value={form.cnae ?? ""}
                      onChange={(e) => setForm({ ...form, cnae: e.target.value })}
                    />
                    <CampoTexto
                      id="servico-aliquota-iss"
                      rotulo="Alíquota ISS (%)"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={form.aliquota_iss}
                      onChange={(e) => setForm({ ...form, aliquota_iss: Number(e.target.value) })}
                      inputClassName="num"
                    />
                  </div>
                  <CampoSelect
                    id="servico-exigibilidade-iss"
                    rotulo="Exigibilidade do ISS"
                    value={form.exigibilidade_iss}
                    onChange={(e) => setForm({ ...form, exigibilidade_iss: e.target.value })}
                  >
                    {EXIGIBILIDADE.map((o) => (
                      <option key={o.v} value={o.v}>
                        {o.l}
                      </option>
                    ))}
                  </CampoSelect>
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={form.iss_retido}
                      onChange={(e) => setForm({ ...form, iss_retido: e.target.checked })}
                      className="h-4 w-4 rounded border-line text-brand focus:ring-brand"
                    />
                    ISS retido pelo tomador
                  </label>
                </div>
              )}
            </div>

            {msg && (
              <p className={`text-xs font-semibold ${msg.tipo === "erro" ? "text-danger" : "text-brand"}`}>{msg.texto}</p>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
            <button
              type="button"
              onClick={() => guarda.confirmar() && setAberto(false)}
              className="rounded-md border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-muted transition hover:bg-surface"
            >
              Cancelar
            </button>
            <Botao variante="primario"
              onClick={salvar}
              disabled={salvando}
            >
              {salvando ? "Salvando…" : "Salvar"}
            </Botao>
          </div>
        </div>
      </Modal>
    </div>
  );
}

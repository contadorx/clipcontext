"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Plus, Trash2, Download, X, Layers, Tags, Eye, ChevronUp, Copy } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { Msg } from "@/components/ui/message-strip";
import Modal, { useSujo } from "@/components/ui/modal";
import ObjectStatus from "@/components/ui/object-status";
import Botao from "@/components/ui/botao";
import { CampoTexto, CampoSelect } from "@/components/ui/campo";

type Empresa = { id: string; nome: string };
type CatModelo = { nome: string; tipo: string };
type GrupoModelo = { nome: string; secao: string; eh_receita: boolean; ordem: number; categorias: CatModelo[] };
type Modelo = { id: string; nome: string; estrutura: GrupoModelo[]; criado_em: string };

// ── Modelos padrão (embutidos no app, disponíveis para todos os escritórios) ──
function grp(nome: string, secao: string, ehReceita: boolean, ordem: number, cats: string[]): GrupoModelo {
  return { nome, secao, eh_receita: ehReceita, ordem, categorias: cats.map((n) => ({ nome: n, tipo: ehReceita ? "receber" : "pagar" })) };
}
const PESSOAL = ["Salários e ordenados", "Pró-labore", "Encargos (INSS/FGTS)", "Benefícios (VT/VR/saúde)"];
const ADMIN = ["Aluguel e condomínio", "Água, luz e telefone", "Internet e software", "Material de escritório", "Honorários contábeis"];
const ENTRADAS_NAO_OP = ["Aportes de sócios", "Empréstimos obtidos"];
const SAIDAS_NAO_OP = ["Distribuição de lucros", "Pagamento de empréstimos", "Aquisição de imobilizado"];

const MODELOS_PADRAO: Modelo[] = [
  {
    id: "padrao:servicos",
    nome: "Padrão · Serviços",
    criado_em: "",
    estrutura: [
      grp("Receita de serviços", "operacionais", true, 1, ["Prestação de serviços", "Outras receitas operacionais"]),
      grp("Pessoal", "operacionais", false, 2, PESSOAL),
      grp("Despesas administrativas", "operacionais", false, 3, ADMIN),
      grp("Despesas comerciais", "operacionais", false, 4, ["Marketing e publicidade", "Comissões"]),
      grp("Impostos e taxas", "operacionais", false, 5, ["Simples Nacional", "ISS", "PIS/COFINS", "IRPJ/CSLL"]),
      grp("Receitas financeiras", "financeiro", true, 6, ["Rendimentos de aplicações", "Juros e descontos obtidos"]),
      grp("Despesas financeiras", "financeiro", false, 7, ["Tarifas bancárias", "Juros e multas pagos"]),
      grp("Entradas não operacionais", "caixa", true, 8, ENTRADAS_NAO_OP),
      grp("Saídas não operacionais", "caixa", false, 9, SAIDAS_NAO_OP),
    ],
  },
  {
    id: "padrao:comercio",
    nome: "Padrão · Comércio",
    criado_em: "",
    estrutura: [
      grp("Receita de vendas", "operacionais", true, 1, ["Venda de mercadorias", "Outras receitas operacionais"]),
      grp("Custo das mercadorias (CMV)", "operacionais", false, 2, ["Compra de mercadorias", "Frete sobre compras"]),
      grp("Pessoal", "operacionais", false, 3, PESSOAL),
      grp("Despesas administrativas", "operacionais", false, 4, ADMIN),
      grp("Despesas comerciais", "operacionais", false, 5, ["Marketing e publicidade", "Comissões", "Embalagens", "Frete sobre vendas"]),
      grp("Impostos e taxas", "operacionais", false, 6, ["Simples Nacional", "ICMS", "PIS/COFINS", "IRPJ/CSLL"]),
      grp("Receitas financeiras", "financeiro", true, 7, ["Rendimentos de aplicações", "Juros e descontos obtidos"]),
      grp("Despesas financeiras", "financeiro", false, 8, ["Tarifas bancárias", "Taxas de cartão/maquininha", "Juros e multas pagos"]),
      grp("Entradas não operacionais", "caixa", true, 9, ENTRADAS_NAO_OP),
      grp("Saídas não operacionais", "caixa", false, 10, SAIDAS_NAO_OP),
    ],
  },
  {
    id: "padrao:completo",
    nome: "Padrão · Completo (Serviço + Comércio)",
    criado_em: "",
    estrutura: [
      grp("Receita de serviços", "operacionais", true, 1, ["Prestação de serviços"]),
      grp("Receita de vendas", "operacionais", true, 2, ["Venda de mercadorias", "Outras receitas operacionais"]),
      grp("Custo das mercadorias (CMV)", "operacionais", false, 3, ["Compra de mercadorias", "Frete sobre compras"]),
      grp("Pessoal", "operacionais", false, 4, PESSOAL),
      grp("Despesas administrativas", "operacionais", false, 5, ADMIN),
      grp("Despesas comerciais", "operacionais", false, 6, ["Marketing e publicidade", "Comissões", "Embalagens", "Frete sobre vendas"]),
      grp("Impostos e taxas", "operacionais", false, 7, ["Simples Nacional", "ICMS", "ISS", "PIS/COFINS", "IRPJ/CSLL"]),
      grp("Receitas financeiras", "financeiro", true, 8, ["Rendimentos de aplicações", "Juros e descontos obtidos"]),
      grp("Despesas financeiras", "financeiro", false, 9, ["Tarifas bancárias", "Taxas de cartão/maquininha", "Juros e multas pagos"]),
      grp("Entradas não operacionais", "caixa", true, 10, ENTRADAS_NAO_OP),
      grp("Saídas não operacionais", "caixa", false, 11, SAIDAS_NAO_OP),
    ],
  },
];
const ehPadrao = (id: string) => id.startsWith("padrao:");

export default function ModelosPlanoContas({
  escritorioId,
  empresas,
  modelosIni,
}: {
  escritorioId: string;
  empresas: Empresa[];
  modelosIni: Modelo[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [modelos, setModelos] = useState<Modelo[]>(modelosIni);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // criar a partir de empresa
  const [criar, setCriar] = useState(false);
  const [nome, setNome] = useState("");
  const [origem, setOrigem] = useState(empresas[0]?.id ?? "");
  // guarda contra perder o nome do modelo já digitado ao clicar fora ou apertar Esc
  const formCriar = useSujo(criar);

  // aplicar
  const [aplicarId, setAplicarId] = useState<string | null>(null);
  const [destino, setDestino] = useState(empresas[0]?.id ?? "");

  // detalhe expandido
  const [abertoId, setAbertoId] = useState<string | null>(null);

  function contar(m: Modelo) {
    const g = m.estrutura?.length ?? 0;
    const c = (m.estrutura ?? []).reduce((s, x) => s + (x.categorias?.length ?? 0), 0);
    return { g, c };
  }

  async function salvarDeEmpresa() {
    if (!nome.trim()) return setMsg({ tipo: "erro", texto: "Dê um nome ao modelo." });
    if (!origem) return setMsg({ tipo: "erro", texto: "Escolha a empresa de origem." });
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    const [g, c] = await Promise.all([
      supabase
        .from("grupos_categoria")
        .select("id, nome, secao, eh_receita, ordem")
        .eq("empresa_id", origem)
        .order("ordem"),
      supabase.from("categorias").select("grupo_id, nome, tipo").eq("empresa_id", origem),
    ]);
    /*
      Modelo vazio é pior que modelo nenhum: ele fica na lista com nome de
      gente, e aplicá-lo não faz nada. Com o erro descartado, uma falha de
      leitura gravava exatamente isso e a tela dizia "Modelo criado a partir da
      empresa."
    */
    if (g.error || c.error) {
      setBusy(false);
      setMsg({
        tipo: "erro",
        texto: `Não foi possível ler o plano da empresa escolhida (${(g.error ?? c.error)?.message}). O modelo não foi criado.`,
      });
      return;
    }
    const grupos = (g.data as Array<{ id: string; nome: string; secao: string; eh_receita: boolean; ordem: number }>) ?? [];
    const cats = (c.data as Array<{ grupo_id: string; nome: string; tipo: string }>) ?? [];
    if (grupos.length === 0) {
      setBusy(false);
      setMsg({ tipo: "erro", texto: "A empresa escolhida não tem grupos de categoria — não há plano para virar modelo." });
      return;
    }
    const estrutura: GrupoModelo[] = grupos.map((gr) => ({
      nome: gr.nome,
      secao: gr.secao,
      eh_receita: gr.eh_receita,
      ordem: gr.ordem,
      categorias: cats.filter((ct) => ct.grupo_id === gr.id).map((ct) => ({ nome: ct.nome, tipo: ct.tipo })),
    }));
    const { data, error } = await supabase
      .from("modelos_plano_contas")
      .insert({ escritorio_id: escritorioId, nome: nome.trim(), estrutura })
      .select("id, nome, estrutura, criado_em")
      .single();
    setBusy(false);
    if (error) return setMsg({ tipo: "erro", texto: error.message });
    if (data) setModelos((m) => [...m, data as Modelo]);
    setCriar(false);
    setNome("");
    setMsg({ tipo: "ok", texto: "Modelo criado a partir da empresa." });
  }

  async function aplicar(m: Modelo) {
    if (!destino) return;
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    // estado atual do destino
    const [g, c] = await Promise.all([
      supabase.from("grupos_categoria").select("id, nome, secao").eq("empresa_id", destino),
      supabase.from("categorias").select("grupo_id, nome").eq("empresa_id", destino),
    ]);
    /*
      Esta leitura é a base do "já existe?" — não pode falhar aberta.

      Com o erro descartado, `gruposDest` e `catsDest` viravam listas vazias, o
      teste de existência passava a responder sempre "não existe", e o laço
      abaixo REINSERIA o modelo inteiro. A empresa do cliente ficava com o plano
      de contas em dobro, e a mensagem final dizia "o que já existia foi
      mantido". Sem saber o que há lá, o certo é não escrever nada.
    */
    if (g.error || c.error) {
      setBusy(false);
      setMsg({
        tipo: "erro",
        texto: `Não foi possível ler o plano atual da empresa de destino (${(g.error ?? c.error)?.message}). Nada foi aplicado — tente de novo.`,
      });
      return;
    }
    const gruposDest =
      (g.data as Array<{ id: string; nome: string; secao: string }>)?.slice() ?? [];
    const catsDest = (c.data as Array<{ grupo_id: string; nome: string }>) ?? [];

    let novosGrupos = 0;
    let novasCats = 0;
    try {
      for (const gm of m.estrutura ?? []) {
        let alvo = gruposDest.find(
          (x) => x.nome.toLowerCase() === gm.nome.toLowerCase() && x.secao === gm.secao,
        );
        if (!alvo) {
          const { data: ins, error } = await supabase
            .from("grupos_categoria")
            .insert({
              empresa_id: destino,
              nome: gm.nome,
              secao: gm.secao,
              eh_receita: gm.eh_receita,
              ordem: gm.ordem ?? 0,
            })
            .select("id, nome, secao")
            .single();
          if (error) throw error;
          alvo = ins as { id: string; nome: string; secao: string };
          gruposDest.push(alvo);
          novosGrupos++;
        }
        for (const cm of gm.categorias ?? []) {
          const existe = catsDest.some(
            (x) => x.grupo_id === alvo!.id && x.nome.toLowerCase() === cm.nome.toLowerCase(),
          );
          if (!existe) {
            const { error } = await supabase
              .from("categorias")
              .insert({ empresa_id: destino, grupo_id: alvo!.id, nome: cm.nome, tipo: cm.tipo });
            if (error) throw error;
            catsDest.push({ grupo_id: alvo!.id, nome: cm.nome });
            novasCats++;
          }
        }
      }
      const nomeDest = empresas.find((e) => e.id === destino)?.nome ?? "empresa";
      setMsg({
        tipo: "ok",
        texto: `Modelo aplicado em ${nomeDest}: ${novosGrupos} grupo(s) e ${novasCats} categoria(s) criados. O que já existia foi mantido.`,
      });
      setAplicarId(null);
      router.refresh();
    } catch (e: unknown) {
      setMsg({ tipo: "erro", texto: e instanceof Error ? e.message : "Falha ao aplicar o modelo." });
    } finally {
      setBusy(false);
    }
  }

  async function copiarPersonalizado(m: Modelo) {
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    const base = m.nome.replace(/\s*\(cópia\)\s*$/i, "");
    const { data, error } = await supabase
      .from("modelos_plano_contas")
      .insert({ escritorio_id: escritorioId, nome: `${base} (cópia)`, estrutura: m.estrutura })
      .select("id, nome, estrutura, criado_em")
      .single();
    setBusy(false);
    if (error) return setMsg({ tipo: "erro", texto: error.message });
    if (data) setModelos((arr) => [...arr, data as Modelo]);
    setMsg({ tipo: "ok", texto: `Cópia personalizada de “${base}” criada. Agora você pode aplicá-la ou excluí-la quando quiser.` });
  }

  async function excluir(m: Modelo) {
    /*
      Sem `confirm()`: o modelo é um molde, não um dado do cliente — as empresas
      que já receberam o plano não são afetadas. Excluir e oferecer Desfazer
      custa menos que uma pergunta, e o retrato da linha volta inteiro.
    */
    const supabase = createClient();
    const back = await supabase.from("modelos_plano_contas").select("*").eq("id", m.id).maybeSingle();
    const { error } = await supabase.from("modelos_plano_contas").delete().eq("id", m.id);
    if (error) return setMsg({ tipo: "erro", texto: error.message });
    setModelos((arr) => arr.filter((x) => x.id !== m.id));
    const linha = back.error ? null : back.data;
    toast(linha ? `Modelo excluído: ${m.nome}.` : `Modelo excluído: ${m.nome}. Não foi possível preparar o Desfazer.`, {
      desfazer: linha
        ? async () => {
            const volta = await createClient()
              .from("modelos_plano_contas")
              .insert(linha as Record<string, unknown>)
              .select("id, nome, estrutura, criado_em")
              .single();
            if (volta.error) {
              toast(`Não foi possível restaurar (${volta.error.message}).`, { tom: "erro" });
              return;
            }
            // a lista vem ordenada do servidor: sem reordenar, o item restaurado
            // reaparece no fim e parece outro registro
            setModelos((arr) => [...arr, volta.data as Modelo].sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR")));
          }
        : undefined,
    });
  }

  return (
    <div className="space-y-5">
      {msg && <Msg msg={msg} />}

      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-muted">
          Crie um padrão de grupos e categorias e aplique em qualquer empresa. Aplicar só adiciona o que falta — nunca
          apaga o que a empresa já tem.
        </p>
        <button
          type="button"
          onClick={() => {
            setCriar(true);
            setMsg(null);
          }}
          className="flex shrink-0 items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
        >
          <Plus size={15} /> Novo modelo
        </button>
      </div>

      {(() => {
        const lista = [...MODELOS_PADRAO, ...modelos];
        return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {lista.map((m) => {
            const { g, c } = contar(m);
            const padrao = ehPadrao(m.id);
            return (
              <div key={m.id} className="rounded-xl2 bg-white p-4 shadow-card">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-light text-brand">
                      <ClipboardList size={18} />
                    </span>
                    <div>
                      <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
                        {m.nome}
                        {padrao && (
                          <span className="rounded-full bg-brand-light px-2 py-0.5 text-[10px] font-semibold text-brand">Padrão</span>
                        )}
                      </h3>
                      <p className="flex items-center gap-3 text-[11px] text-ink-soft">
                        <span className="flex items-center gap-1">
                          <Layers size={11} /> {g} grupos
                        </span>
                        <span className="flex items-center gap-1">
                          <Tags size={11} /> {c} categorias
                        </span>
                      </p>
                    </div>
                  </div>
                  {!padrao && (
                  <button
                    type="button"
                    onClick={() => excluir(m)}
                    aria-label={`Excluir o modelo ${m.nome}`}
                    title={`Excluir o modelo ${m.nome}`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition hover:bg-rose-50 hover:text-danger"
                  >
                    <Trash2 size={15} />
                  </button>
                  )}
                </div>

                {abertoId === m.id && (
                  <div className="mt-4 space-y-2.5 rounded-lg border border-line bg-surface/40 p-3">
                    {(m.estrutura ?? [])
                      .slice()
                      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
                      .map((gm, i) => (
                        <div key={i}>
                          <p className="flex items-center gap-2 text-xs font-semibold text-ink">
                            {gm.nome}
                            <ObjectStatus pilula semMarcador tom={gm.eh_receita ? "positivo" : "neutro"}>
                              {gm.eh_receita ? "Receita" : "Despesa"}
                            </ObjectStatus>
                          </p>
                          {(gm.categorias?.length ?? 0) > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {gm.categorias.map((cm, j) => (
                                <span
                                  key={j}
                                  className="rounded-md bg-white px-1.5 py-0.5 text-[10px] text-ink-muted ring-1 ring-line"
                                >
                                  {cm.nome}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setAbertoId(abertoId === m.id ? null : m.id)}
                    className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand"
                  >
                    {abertoId === m.id ? <ChevronUp size={14} /> : <Eye size={14} />}
                    {abertoId === m.id ? "Ocultar" : "Ver o que tem"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAplicarId(aplicarId === m.id ? null : m.id);
                      setMsg(null);
                    }}
                    className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand"
                  >
                    <Download size={14} /> Aplicar em uma empresa
                  </button>
                  <button
                    type="button"
                    onClick={() => copiarPersonalizado(m)}
                    disabled={busy}
                    title="Cria uma cópia editável (personalizada) deste modelo"
                    className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand disabled:opacity-60"
                  >
                    <Copy size={14} /> Copiar p/ personalizado
                  </button>
                </div>

                {aplicarId === m.id && (
                  <div className="mt-3 rounded-lg border border-line bg-surface/40 p-3">
                    {/*
                      O id sai do id do modelo com os caracteres fora de
                      [A-Za-z0-9_-] trocados: os modelos padrão são
                      "padrao:servicos", e um id com ":" é uma armadilha para
                      qualquer seletor CSS que venha depois.
                    */}
                    <CampoSelect
                      id={`modelo-${m.id.replace(/[^\w-]/g, "-")}-destino`}
                      rotulo="Aplicar na empresa"
                      className="mb-2"
                      inputClassName="bg-white"
                      value={destino}
                      onChange={(e) => setDestino(e.target.value)}
                    >
                      {empresas.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.nome}
                        </option>
                      ))}
                    </CampoSelect>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setAplicarId(null)}
                        className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-muted transition hover:bg-white"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => aplicar(m)}
                        disabled={busy}
                        className="rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
                      >
                        {busy ? "Aplicando…" : "Aplicar"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        );
      })()}

      {/* modal criar a partir de empresa */}
      {criar && (
        <Modal
          rotulo="Novo modelo de plano de contas"
          onFechar={() => setCriar(false)}
          sujo={formCriar.sujo}
          largura="max-w-md"
        >
          <div className="p-4" {...formCriar.campos}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[13px] font-bold text-ink">Novo modelo a partir de uma empresa</h3>
              <button aria-label="Fechar" type="button" onClick={() => formCriar.confirmar() && setCriar(false)} className="text-ink-soft hover:text-ink">
                <X size={18} />
              </button>
            </div>
            <CampoTexto
              id="modelo-nome"
              rotulo="Nome do modelo"
              className="mb-3"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Comércio · padrão"
            />
            <CampoSelect
              id="modelo-origem"
              rotulo="Copiar o plano de contas de"
              className="mb-1"
              inputClassName="bg-white"
              value={origem}
              onChange={(e) => setOrigem(e.target.value)}
            >
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </CampoSelect>
            <p className="mb-4 text-[11px] text-ink-soft">
              Copiamos os grupos e categorias dessa empresa para o modelo (sem valores nem lançamentos).
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCriar(false)}
                className="rounded-md border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-muted transition hover:bg-surface"
              >
                Cancelar
              </button>
              <Botao variante="primario"
                onClick={salvarDeEmpresa}
                disabled={busy}
              >
                {busy ? "Criando…" : "Criar modelo"}
              </Botao>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

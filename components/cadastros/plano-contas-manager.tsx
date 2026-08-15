"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ListTree, Plus, Trash2, Pencil, X, Check, Download, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import MessageStrip from "@/components/ui/message-strip";
import EmptyState from "@/components/ui/empty-state";
import ObjectStatus from "@/components/ui/object-status";
import Modal, { useSujo } from "@/components/ui/modal";
import Botao, { BotaoIcone } from "@/components/ui/botao";
import Campo, { CampoArea, CampoSelect, CampoTexto } from "@/components/ui/campo";

export type PlanoConta = {
  id: string;
  codigo: string;
  nome: string;
  tipo: string | null;
  natureza: string | null;
  analitica: boolean;
};

const TIPOS = [
  { v: "ativo", l: "Ativo", nat: "devedora" },
  { v: "passivo", l: "Passivo", nat: "credora" },
  { v: "patrimonio", l: "Patrimônio líquido", nat: "credora" },
  { v: "receita", l: "Receita", nat: "credora" },
  { v: "despesa", l: "Despesa / Custo", nat: "devedora" },
  { v: "resultado", l: "Resultado", nat: "devedora" },
];

const TIPO_LABEL: Record<string, string> = Object.fromEntries(TIPOS.map((t) => [t.v, t.l]));
const natDeTipo = (t: string) => TIPOS.find((x) => x.v === t)?.nat ?? "devedora";

// Modelo inicial genérico e editável. Não é o plano oficial de nenhum sistema —
// é um esqueleto para o contador ajustar. Modelos por regime/sistema vêm depois.
const MODELO_BASICO: Omit<PlanoConta, "id">[] = [
  { codigo: "1", nome: "ATIVO", tipo: "ativo", natureza: "devedora", analitica: false },
  { codigo: "1.1.1.001", nome: "Caixa", tipo: "ativo", natureza: "devedora", analitica: true },
  { codigo: "1.1.1.002", nome: "Bancos conta movimento", tipo: "ativo", natureza: "devedora", analitica: true },
  { codigo: "1.1.2.001", nome: "Clientes a receber", tipo: "ativo", natureza: "devedora", analitica: true },
  { codigo: "2", nome: "PASSIVO", tipo: "passivo", natureza: "credora", analitica: false },
  { codigo: "2.1.1.001", nome: "Fornecedores a pagar", tipo: "passivo", natureza: "credora", analitica: true },
  { codigo: "2.1.2.001", nome: "Impostos a recolher", tipo: "passivo", natureza: "credora", analitica: true },
  { codigo: "3", nome: "RECEITAS", tipo: "receita", natureza: "credora", analitica: false },
  { codigo: "3.1.1.001", nome: "Receita de serviços", tipo: "receita", natureza: "credora", analitica: true },
  { codigo: "3.1.1.002", nome: "Receita de vendas", tipo: "receita", natureza: "credora", analitica: true },
  { codigo: "3.1.9.001", nome: "Receitas financeiras", tipo: "receita", natureza: "credora", analitica: true },
  { codigo: "4", nome: "CUSTOS E DESPESAS", tipo: "despesa", natureza: "devedora", analitica: false },
  { codigo: "4.1.1.001", nome: "Custos dos serviços prestados", tipo: "despesa", natureza: "devedora", analitica: true },
  { codigo: "4.2.1.001", nome: "Despesas com pessoal", tipo: "despesa", natureza: "devedora", analitica: true },
  { codigo: "4.2.2.001", nome: "Despesas administrativas", tipo: "despesa", natureza: "devedora", analitica: true },
  { codigo: "4.2.9.001", nome: "Despesas financeiras", tipo: "despesa", natureza: "devedora", analitica: true },
];

export default function PlanoContasManager({
  empresaId,
  inicial,
}: {
  empresaId: string;
  inicial: PlanoConta[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [lista, setLista] = useState<PlanoConta[]>(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // formulário (novo ou edição)
  const [editId, setEditId] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("despesa");
  const [analitica, setAnalitica] = useState(true);

  // importação CSV
  const [impAberto, setImpAberto] = useState(false);
  const [csv, setCsv] = useState("");
  const [impErro, setImpErro] = useState<string | null>(null);
  const [impBusy, setImpBusy] = useState(false);
  // guarda contra perder o CSV colado (ou o arquivo escolhido) ao clicar fora ou apertar Esc
  const formImp = useSujo(impAberto);

  const ordenada = [...lista].sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));

  function limpar() {
    setEditId(null);
    setCodigo("");
    setNome("");
    setTipo("despesa");
    setAnalitica(true);
  }

  async function salvar() {
    const cod = codigo.trim();
    const nm = nome.trim();
    if (!cod || !nm) {
      setErro("Informe código e nome da conta.");
      return;
    }
    setErro(null);
    setSalvando(true);
    const supabase = createClient();
    const dados = { empresa_id: empresaId, codigo: cod, nome: nm, tipo, natureza: natDeTipo(tipo), analitica };

    if (editId) {
    /*
      `.select("id")` no update, e não só `.eq()`.

      `update().eq("id", x)` que casa ZERO linhas não é erro no supabase-js:
      volta `{ data: null, error: null }`. Se a RLS barrar a linha, ou se ela
      tiver sumido em outra aba, a tela fechava o diálogo anunciando "salvo" e o
      banco não mudava nada. Pedindo a linha de volta, zero linhas vira uma
      resposta que dá para conferir.
    */
      const { data: alt, error } = await supabase.from("plano_contas").update(dados).eq("id", editId).select("id");
      setSalvando(false);
      if (error) { setErro(error.message); return; }
      if ((alt ?? []).length === 0) {
        setErro("A conta não foi encontrada para salvar. Recarregue a página — ela pode ter sido removida em outra aba.");
        return;
      }
      setLista((l) => l.map((x) => (x.id === editId ? { ...x, codigo: cod, nome: nm, tipo, natureza: natDeTipo(tipo), analitica } : x)));
    } else {
      const { data, error } = await supabase.from("plano_contas").insert(dados).select("id").single();
      setSalvando(false);
      if (error) { setErro(error.message.includes("duplicate") ? "Já existe uma conta com esse código." : error.message); return; }
      setLista((l) => [...l, { id: (data as { id: string }).id, codigo: cod, nome: nm, tipo, natureza: natDeTipo(tipo), analitica }]);
    }
    limpar();
    router.refresh();
  }

  function editar(c: PlanoConta) {
    setEditId(c.id);
    setCodigo(c.codigo);
    setNome(c.nome);
    setTipo(c.tipo ?? "despesa");
    setAnalitica(c.analitica);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function remover(c: PlanoConta) {
    const supabase = createClient();
    /*
      `codigo_contabil` é TEXTO, não chave estrangeira.

      Ou seja: o banco não impede nada, e remover uma conta usada deixa
      categorias, contas bancárias e contatos apontando para um código que não
      existe mais — a exportação contábil sai com código órfão e ninguém
      descobre até o contador recusar o arquivo. Como não há FK, a conferência
      tem de ser feita aqui.
    */
    const alvos: { tabela: string; coluna: string; rotulo: string }[] = [
      { tabela: "categorias", coluna: "codigo_contabil", rotulo: "categoria" },
      // contrapartida patrimonial das categorias provisionadas — mesmo tipo de
      // código, mesmo estrago se ficar órfão, e ficava de fora
      { tabela: "categorias", coluna: "codigo_provisao", rotulo: "categoria (provisão)" },
      { tabela: "contas_bancarias", coluna: "codigo_contabil", rotulo: "conta bancária" },
      { tabela: "clientes_fornecedores", coluna: "codigo_contabil", rotulo: "cadastro de cliente/fornecedor" },
    ];
    const respostas = await Promise.all(
      alvos.map(async (a) => ({
        a,
        r: await supabase
          .from(a.tabela)
          .select(a.coluna, { count: "exact", head: true })
          .eq("empresa_id", empresaId)
          .eq(a.coluna, c.codigo),
      })),
    );
    const usos: string[] = [];
    for (const { a, r } of respostas) {
      if (r.error) {
        setErro(`Não foi possível conferir se o código ${c.codigo} está em uso (${r.error.message}). Nada foi removido — tente de novo.`);
        return;
      }
      const n = r.count ?? 0;
      if (n > 0) usos.push(`${n} ${a.rotulo}${n > 1 ? "s" : ""}`);
    }
    /*
      As contas de contrapartida da empresa (juros, multa, descontos, clientes,
      fornecedores) também guardam código deste plano — `empresas.cont_*`, uma
      linha só. A exportação contábil usa esses códigos para montar a partida
      dobrada; removê-los aqui deixaria o arquivo com contrapartida inexistente.
    */
    const CONT = [
      "cont_juros_pago",
      "cont_juros_receb",
      "cont_multa",
      "cont_desc_obtido",
      "cont_desc_concedido",
      "cont_clientes",
      "cont_fornecedores",
    ] as const;
    const emp = await supabase.from("empresas").select(CONT.join(", ")).eq("id", empresaId).maybeSingle();
    if (emp.error) {
      setErro(`Não foi possível conferir as contas de contrapartida (${emp.error.message}). Nada foi removido — tente de novo.`);
      return;
    }
    const linha = (emp.data ?? {}) as Record<string, string | null>;
    const nasContrapartidas = CONT.filter((k) => (linha[k] ?? "") === c.codigo).length;
    if (nasContrapartidas > 0) {
      usos.push(`${nasContrapartidas} conta${nasContrapartidas > 1 ? "s" : ""} de contrapartida da empresa`);
    }
    if (usos.length > 0) {
      setErro(
        `O código ${c.codigo} está apontado por ${usos.join(", ")} em Configurações contábeis. Troque o código lá antes de remover esta conta, senão a exportação sai com código órfão.`,
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
    const back = await supabase.from("plano_contas").select("*").eq("id", c.id).maybeSingle();
    const r = await supabase.from("plano_contas").delete().eq("id", c.id);
    if (r.error) { setErro(r.error.message); return; }
    setErro(null);
    setLista((l) => l.filter((x) => x.id !== c.id));
    router.refresh();
    const backup = back.error ? null : back.data;
    toast(
      backup ? `Conta removida: ${c.codigo} — ${c.nome}.` : `Conta removida: ${c.codigo}. Não foi possível preparar o Desfazer.`,
      {
        desfazer: backup
          ? async () => {
              const volta = await createClient().from("plano_contas").insert(backup as Record<string, unknown>);
              if (volta.error) {
                toast(`Não foi possível restaurar (${volta.error.message}).`, { tom: "erro" });
                return;
              }
              setLista((l) => [...l, c]);
              router.refresh();
            }
          : undefined,
      },
    );
  }

  async function carregarModelo() {
    // `confirm()` fica: não é destrutivo, mas a pessoa precisa saber ANTES que
    // as contas do modelo são acrescentadas às que já existem
    if (lista.length > 0 && !confirm("O plano já tem contas. As do modelo serão acrescentadas (códigos repetidos são ignorados). Continuar?")) return;
    setSalvando(true);
    setErro(null);
    const supabase = createClient();
    const existentes = new Set(lista.map((c) => c.codigo));
    const novas = MODELO_BASICO.filter((m) => !existentes.has(m.codigo)).map((m) => ({ empresa_id: empresaId, ...m }));
    if (novas.length === 0) { setSalvando(false); return; }
    const { data, error } = await supabase.from("plano_contas").insert(novas).select("id, codigo, nome, tipo, natureza, analitica");
    setSalvando(false);
    if (error) { setErro(error.message); return; }
    setLista((l) => [...l, ...((data as PlanoConta[]) ?? [])]);
    router.refresh();
  }

  function parseLinhas(texto: string): Omit<PlanoConta, "id">[] {
    const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (linhas.length === 0) return [];
    const sep = (linhas[0].match(/;/g)?.length ?? 0) >= (linhas[0].match(/,/g)?.length ?? 0) ? ";" : ",";
    const naoAnalitica = new Set(["n", "nao", "não", "false", "0", "sintetica", "sintética", "s"]);
    const tiposOk = ["ativo", "passivo", "patrimonio", "receita", "despesa", "resultado"];
    const out: Omit<PlanoConta, "id">[] = [];
    linhas.forEach((linha, i) => {
      const cols = linha.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
      const codigo = cols[0] ?? "";
      const nome = cols[1] ?? "";
      if (i === 0 && (/c[oó]digo/i.test(codigo) || /nome/i.test(nome))) return; // cabeçalho
      if (!codigo || !nome) return;
      const tipoRaw = (cols[2] ?? "").toLowerCase();
      const tipoVal = tiposOk.includes(tipoRaw) ? tipoRaw : null;
      const anaRaw = (cols[3] ?? "").toLowerCase().trim();
      const analiticaVal = anaRaw === "" ? true : !naoAnalitica.has(anaRaw);
      out.push({ codigo, nome, tipo: tipoVal, natureza: tipoVal ? natDeTipo(tipoVal) : null, analitica: analiticaVal });
    });
    return out;
  }

  async function aoArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setCsv(await f.text());
  }

  async function importarCsv() {
    const parsed = parseLinhas(csv);
    if (parsed.length === 0) {
      setImpErro("Não encontrei contas válidas. Use uma conta por linha, no formato: código;nome (opcional: ;tipo;analítica).");
      return;
    }
    setImpBusy(true);
    setImpErro(null);
    const existentes = new Set(lista.map((c) => c.codigo));
    const vistos = new Set<string>();
    const novas = parsed
      .filter((p) => !existentes.has(p.codigo) && !vistos.has(p.codigo) && (vistos.add(p.codigo), true))
      .map((p) => ({ empresa_id: empresaId, ...p }));
    if (novas.length === 0) {
      setImpBusy(false);
      setImpErro("Todas as contas do arquivo já existem no plano.");
      return;
    }
    const supabase = createClient();
    const { data, error } = await supabase.from("plano_contas").insert(novas).select("id, codigo, nome, tipo, natureza, analitica");
    setImpBusy(false);
    if (error) { setImpErro(error.message); return; }
    setLista((l) => [...l, ...((data as PlanoConta[]) ?? [])]);
    setImpAberto(false);
    setCsv("");
    router.refresh();
  }

  return (
    <div className="space-y-4 rounded-xl2 bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <ListTree size={18} className="mt-0.5 shrink-0 text-brand" />
          <div>
            <h2 className="text-[13px] font-bold text-ink">Plano de contas contábil</h2>
            <p className="text-xs text-ink-soft">
              As contas usadas na exportação. Crie manualmente ou comece por um modelo e ajuste.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => { setImpAberto(true); setImpErro(null); }}
            className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink-muted transition hover:border-brand hover:text-brand"
          >
            <Upload size={13} /> Importar CSV
          </button>
          <button
            type="button"
            onClick={carregarModelo}
            disabled={salvando}
            className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink-muted transition hover:border-brand hover:text-brand disabled:opacity-60"
          >
            <Download size={13} /> Carregar modelo básico
          </button>
        </div>
      </div>

      {erro && <MessageStrip tipo="erro">{erro}</MessageStrip>}

      {/* formulário */}
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-line bg-surface/40 p-3">
        {/*
          A largura fixa vai na moldura, não no controle: o input do `Campo` já
          é `w-full` e, na folha gerada, `w-full` vem depois de `w-32`.
        */}
        <CampoTexto
          id="plano-codigo"
          rotulo="Código"
          className="w-32"
          inputClassName="num"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          placeholder="3.1.1.001"
        />
        <CampoTexto
          id="plano-nome"
          rotulo="Nome da conta"
          className="min-w-[180px] flex-1"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Receita de serviços"
        />
        <CampoSelect
          id="plano-tipo"
          rotulo="Tipo"
          inputClassName="bg-white"
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
        >
          {TIPOS.map((t) => (
            <option key={t.v} value={t.v}>{t.l}</option>
          ))}
        </CampoSelect>
        <label className="flex items-center gap-1.5 pb-2 text-xs font-medium text-ink-muted">
          <input type="checkbox" checked={analitica} onChange={(e) => setAnalitica(e.target.checked)} className="h-4 w-4 accent-brand" />
          Analítica
        </label>
        <Botao variante="primario"
          onClick={salvar}
          disabled={salvando}
        >
          {editId ? <Check size={15} /> : <Plus size={15} />} {editId ? "Salvar" : "Adicionar"}
        </Botao>
        {editId && (
          <button type="button" onClick={limpar} className="flex items-center gap-1 rounded-md border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-muted transition hover:bg-surface">
            <X size={14} /> Cancelar
          </button>
        )}
      </div>

      {/* lista */}
      {ordenada.length === 0 ? (
        <EmptyState compacto titulo="Nenhuma conta ainda" descricao="Use “Carregar modelo básico” para começar." />
      ) : (
        <div className="divide-y divide-line rounded-lg border border-line">
          {ordenada.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
              <span className="num w-28 shrink-0 font-semibold text-ink">{c.codigo}</span>
              <span className={`flex-1 truncate ${c.analitica ? "text-ink" : "font-semibold text-ink-muted"}`}>{c.nome}</span>
              {c.tipo && (
                <ObjectStatus pilula semMarcador tom="neutro" className="hidden shrink-0 sm:inline-flex">
                  {TIPO_LABEL[c.tipo] ?? c.tipo}
                </ObjectStatus>
              )}
              {!c.analitica && (
                <ObjectStatus pilula semMarcador tom="neutro" className="shrink-0">
                  sintética
                </ObjectStatus>
              )}
              {/* o rótulo diz QUAL conta: numa lista longa, vinte "Editar" iguais não distinguem nada */}
              <BotaoIcone rotulo={`Editar ${c.codigo} — ${c.nome}`} onClick={() => editar(c)}>
                <Pencil size={14} />
              </BotaoIcone>
              <BotaoIcone rotulo={`Remover ${c.codigo} — ${c.nome}`} variante="perigo" onClick={() => remover(c)}>
                <Trash2 size={14} />
              </BotaoIcone>
            </div>
          ))}
        </div>
      )}
      {impAberto && (
        <Modal
          rotulo="Importar plano de contas de CSV"
          onFechar={() => setImpAberto(false)}
          sujo={formImp.sujo}
          largura="max-w-lg"
        >
          <div className="p-5" {...formImp.campos}>
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-bold text-ink">
                <Upload size={16} className="text-brand" /> Importar plano de contas
              </h3>
              <button aria-label="Fechar" type="button" onClick={() => formImp.confirmar() && setImpAberto(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition hover:bg-surface">
                <X size={16} />
              </button>
            </div>
            <p className="mt-2 text-xs text-ink-soft">
              Uma conta por linha: <span className="num font-semibold text-ink">código;nome</span>. Opcional acrescentar
              <span className="num font-semibold text-ink"> ;tipo;analítica</span> (tipo: ativo, passivo, receita, despesa, patrimonio, resultado · analítica: S/N). Aceita
              vírgula ou ponto e vírgula. Códigos já existentes são ignorados.
            </p>
            {/*
              O seletor de arquivo não usa `CampoTexto`: o `file:` do Tailwind
              estiliza o botão interno do navegador e a caixa do controle comum
              não se aplica a ele. Só a moldura (rótulo + `htmlFor`) vem daqui.
            */}
            <Campo rotulo="Arquivo CSV" htmlFor="plano-csv-arquivo" className="mt-3">
              <input id="plano-csv-arquivo" type="file" accept=".csv,.txt" onChange={aoArquivo} className="block w-full text-xs text-ink-muted file:mr-3 file:rounded-lg file:border file:border-line file:bg-surface file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-ink-muted" />
            </Campo>
            <CampoArea
              id="plano-csv-texto"
              rotulo="Ou cole as linhas aqui"
              className="mt-3"
              inputClassName="num"
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              rows={8}
              placeholder={"3.1.1.001;Receita de serviços;receita;S\n4.2.1.001;Despesas com pessoal;despesa;S"}
            />
            {impErro && <MessageStrip tipo="erro">{impErro}</MessageStrip>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setImpAberto(false)} className="rounded-md border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-muted transition hover:bg-surface">
                Cancelar
              </button>
              <Botao variante="primario"
                onClick={importarCsv}
                disabled={impBusy || !csv.trim()}
              >
                <Upload size={15} /> {impBusy ? "Importando…" : "Importar"}
              </Botao>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { CornerDownLeft, Plus, ArrowDownCircle, ArrowUpCircle, ClipboardPaste } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { mascaraMoeda, parseMoeda } from "@/lib/formato";
import { parseDataAtalho, AJUDA_DATA } from "@/lib/data-atalho";
import { useToast } from "@/components/ui/toast";
import Botao from "@/components/ui/botao";

type Cat = { id: string; nome: string; tipo: string };
type Conta = { id: string; nome: string };
type Pessoa = { id: string; nome: string };

/**
 * Linha de lançamento dentro da própria tabela: Enter grava e devolve o foco
 * para o começo da linha. É o ritmo de quem lança 30 contas seguidas —
 * sem abrir e fechar modal 30 vezes.
 *
 * Também aceita colar do Excel: cole na descrição um bloco
 * `descrição \t valor \t vencimento \t documento` (uma linha por lançamento).
 */
export default function LinhaRapida({
  empresaId,
  contas,
  categorias,
  contaPadrao,
  tipoPadrao = "saida",
  gridCols,
  colunasVisiveis,
  onSalvo,
}: {
  empresaId: string;
  contas: Conta[];
  categorias: Cat[];
  contaPadrao?: string;
  tipoPadrao?: "entrada" | "saida";
  /** grade do pai, para a linha alinhar com as colunas da tabela */
  gridCols: string;
  /** ids das colunas visíveis, na ordem escolhida pelo usuário */
  colunasVisiveis: string[];
  onSalvo: () => void;
}) {
  const { toast } = useToast();
  const [tipo, setTipo] = useState<"entrada" | "saida">(tipoPadrao);
  const [venc, setVenc] = useState("");
  const [doc, setDoc] = useState("");
  const [desc, setDesc] = useState("");
  const [pessoa, setPessoa] = useState("");
  const [catId, setCatId] = useState("");
  const [contaId, setContaId] = useState(contaPadrao ?? "");
  const [valor, setValor] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const vencRef = useRef<HTMLInputElement | null>(null);
  const descRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (contaPadrao) setContaId(contaPadrao);
  }, [contaPadrao]);

  useEffect(() => {
    if (!empresaId) return;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("clientes_fornecedores")
        .select("id, nome")
        .eq("empresa_id", empresaId)
        .order("nome")
        .limit(500);
      setPessoas((data as Pessoa[]) ?? []);
    })();
  }, [empresaId]);

  // atalho: "L" foca a linha rápida (não conflita com N, que abre o modal completo)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "l" || e.key === "L") {
        e.preventDefault();
        vencRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const cats = categorias.filter((c) => c.tipo === (tipo === "entrada" ? "receber" : "pagar"));

  function limpar(mantendoContexto = true) {
    setDesc("");
    setDoc("");
    setPessoa("");
    setValor("");
    if (!mantendoContexto) {
      setVenc("");
      setCatId("");
    }
  }

  function idDaPessoa(nome: string): string | null {
    const n = nome.trim().toLowerCase();
    if (!n) return null;
    return pessoas.find((p) => p.nome.toLowerCase() === n)?.id ?? null;
  }

  async function gravar() {
    if (salvando) return;
    const v = parseMoeda(valor);
    if (!desc.trim() && v <= 0) return;
    if (v <= 0) {
      toast("Informe o valor do lançamento.", { tom: "aviso" });
      return;
    }
    if (!contaId) {
      toast("Escolha a conta.", { tom: "aviso" });
      return;
    }
    if (!catId) {
      toast("Escolha a categoria.", { tom: "aviso" });
      return;
    }
    const dataIso = parseDataAtalho(venc) ?? parseDataAtalho("hoje")!;

    setSalvando(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("lancamentos")
      .insert({
        empresa_id: empresaId,
        tipo,
        valor: v,
        descricao: desc.trim() || null,
        numero_documento: doc.trim() || null,
        categoria_id: catId,
        conta_id: contaId,
        cliente_fornecedor_id: idDaPessoa(pessoa),
        data_competencia: dataIso,
        data_vencimento: dataIso,
        data_pagamento: null,
        data_agendamento: null,
        transferencia: false,
      })
      .select("id")
      .single();
    setSalvando(false);

    if (error) {
      toast(error.message, { tom: "erro" });
      return;
    }
    const id = (data as { id: string }).id;
    limpar();
    onSalvo();
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("fs-mov-changed"));
    toast(`Lançado: ${desc.trim() || "sem descrição"}.`, {
      desfazer: async () => {
        // o toast some depois de clicar; se o delete falhar calado, a pessoa
        // acha que voltou atrás e o lançamento continua no resultado do mês
        const r = await createClient().from("lancamentos").delete().eq("id", id);
        if (r.error) {
          toast(`Não foi possível desfazer (${r.error.message}). O lançamento continua em Movimentações.`, { tom: "erro" });
          return;
        }
        onSalvo();
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("fs-mov-changed"));
      },
    });
    setTimeout(() => descRef.current?.focus(), 10);
  }

  /** Colar do Excel: descrição \t valor \t vencimento \t documento */
  async function colar(e: React.ClipboardEvent<HTMLInputElement>) {
    const txt = e.clipboardData.getData("text/plain");
    if (!txt || (!txt.includes("\t") && !txt.trim().includes("\n"))) return; // colagem simples segue o fluxo normal
    e.preventDefault();

    if (!contaId || !catId) {
      toast("Escolha conta e categoria antes de colar o bloco.", { tom: "aviso" });
      return;
    }
    const linhas = txt
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const rows = linhas
      .map((l) => {
        const c = l.split("\t").map((x) => x.trim());
        const v = parseMoeda(c[1] ?? "");
        if (!c[0] || v <= 0) return null;
        const dataIso = parseDataAtalho(c[2] ?? "") ?? parseDataAtalho("hoje")!;
        return {
          empresa_id: empresaId,
          tipo,
          valor: v,
          descricao: c[0],
          numero_documento: c[3] || null,
          categoria_id: catId,
          conta_id: contaId,
          cliente_fornecedor_id: null,
          data_competencia: dataIso,
          data_vencimento: dataIso,
          data_pagamento: null,
          data_agendamento: null,
          transferencia: false,
        };
      })
      .filter(Boolean) as Record<string, unknown>[];

    if (rows.length === 0) {
      toast("Não reconheci nenhuma linha. Use: descrição, valor, vencimento.", { tom: "aviso" });
      return;
    }

    setSalvando(true);
    const supabase = createClient();
    const { data, error } = await supabase.from("lancamentos").insert(rows).select("id");
    setSalvando(false);
    if (error) {
      toast(error.message, { tom: "erro" });
      return;
    }
    const ids = ((data as { id: string }[]) ?? []).map((r) => r.id);
    onSalvo();
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("fs-mov-changed"));
    toast(`${ids.length} lançamento(s) colado(s) do Excel.`, {
      desfazer: async () => {
        // pior que o caso de uma linha: aqui são dezenas de lançamentos de uma
        // colagem de Excel, e refazer à mão é achar cada um em Movimentações
        const r = await createClient().from("lancamentos").delete().in("id", ids);
        if (r.error) {
          toast(`Não foi possível desfazer a colagem (${r.error.message}). Os ${ids.length} lançamentos continuam em Movimentações.`, {
            tom: "erro",
          });
          return;
        }
        onSalvo();
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("fs-mov-changed"));
      },
    });
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      void gravar();
    }
    if (e.key === "Escape") {
      limpar(false);
      (e.target as HTMLElement).blur();
    }
  }

  const inp =
    "w-full rounded-lg border border-line bg-white px-2 py-1.5 text-xs outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";

  const mostra = (id: string) => colunasVisiveis.includes(id);
  // campos obrigatórios para lançar que o usuário escondeu da tabela: aparecem
  // na linha de ajuda abaixo, para o atalho nunca ficar impossível de usar
  const faltando = ["categoria", "conta"].filter((id) => !mostra(id));

  const celula = (id: string) => {
    switch (id) {
      case "tipo":
        return (
          <button
            key={id}
            type="button"
            onClick={() => {
              setTipo((t) => (t === "saida" ? "entrada" : "saida"));
              setCatId("");
            }}
            title="Alternar entrada / saída"
            className={`flex items-center gap-1 text-xs font-bold ${tipo === "entrada" ? "text-brand" : "text-ink-muted"}`}
          >
            {tipo === "entrada" ? <ArrowDownCircle size={14} /> : <ArrowUpCircle size={14} />}
            {tipo === "entrada" ? "Entrada" : "Saída"}
          </button>
        );
      case "situacao":
        return (
          <span key={id} className="text-[10px] font-semibold text-ink-soft">
            Previsto
          </span>
        );
      case "venc":
        return (
          <input
            key={id}
            ref={vencRef}
            value={venc}
            onChange={(e) => setVenc(e.target.value)}
            onBlur={() => {
              const iso = parseDataAtalho(venc);
              if (iso) setVenc(iso);
            }}
            onKeyDown={onKey}
            placeholder="hoje"
            title={AJUDA_DATA}
            className={`${inp} num`}
          />
        );
      case "competencia":
        return <span key={id} className="text-[10px] text-ink-soft">= vencimento</span>;
      case "documento":
        return (
          <input key={id} value={doc} onChange={(e) => setDoc(e.target.value)} onKeyDown={onKey} placeholder="doc" className={inp} />
        );
      case "descricao":
        return (
          <input
            key={id}
            ref={descRef}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            onKeyDown={onKey}
            onPaste={colar}
            placeholder="Descrição — ou cole um bloco do Excel"
            className={inp}
          />
        );
      case "pessoa":
        return (
          <input
            key={id}
            value={pessoa}
            onChange={(e) => setPessoa(e.target.value)}
            onKeyDown={onKey}
            list="fs-pessoas-rapida"
            placeholder="Cliente/forn."
            className={inp}
          />
        );
      case "categoria":
        return (
          <select key={id} value={catId} onChange={(e) => setCatId(e.target.value)} onKeyDown={onKey} className={inp}>
            <option value="">Categoria…</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        );
      case "conta":
        return (
          <select key={id} value={contaId} onChange={(e) => setContaId(e.target.value)} onKeyDown={onKey} className={inp}>
            <option value="">Conta…</option>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        );
      case "valor":
        return (
          <input
            key={id}
            value={valor}
            onChange={(e) => setValor(mascaraMoeda(e.target.value))}
            onKeyDown={onKey}
            placeholder="0,00"
            className={`${inp} num text-right`}
          />
        );
      default:
        return <span key={id} />;
    }
  };

  return (
    <div className="border-b border-line bg-brand-50/70">
      <div className="grid items-center gap-3 px-4 py-2" style={{ gridTemplateColumns: gridCols }}>
        <span className="flex items-center text-brand">
          <Plus size={15} />
        </span>

        {colunasVisiveis.map((id) => celula(id))}

        <span className="flex justify-end">
          <Botao variante="primario" className="h-7 text-[11px]"
            onClick={gravar}
            disabled={salvando}
            title="Lançar (Enter)"
          >
            <CornerDownLeft size={12} />
          </Botao>
        </span>
      </div>

      <datalist id="fs-pessoas-rapida">
        {pessoas.map((p) => (
          <option key={p.id} value={p.nome} />
        ))}
      </datalist>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pb-2 text-[10.5px] text-ink-soft">
        {/* coluna escondida mas obrigatória para lançar: some da tabela, fica aqui */}
        {faltando.includes("categoria") && (
          <select value={catId} onChange={(e) => setCatId(e.target.value)} className="rounded border border-line bg-white px-1.5 py-0.5 text-[11px]">
            <option value="">Categoria…</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        )}
        {faltando.includes("conta") && (
          <select value={contaId} onChange={(e) => setContaId(e.target.value)} className="rounded border border-line bg-white px-1.5 py-0.5 text-[11px]">
            <option value="">Conta…</option>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        )}
        <span>
          <kbd className="rounded border border-line bg-white px-1 font-semibold">L</kbd> foca ·{" "}
          <kbd className="rounded border border-line bg-white px-1 font-semibold">Enter</kbd> lança e continua
        </span>
        <span>{AJUDA_DATA}</span>
        <span className="flex items-center gap-1">
          <ClipboardPaste size={11} /> colar do Excel: descrição · valor · vencimento · documento
        </span>
      </div>
    </div>
  );
}

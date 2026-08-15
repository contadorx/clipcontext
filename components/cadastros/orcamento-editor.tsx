"use client";

import { useEffect, useState, useCallback } from "react";
import { Save, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Msg } from "@/components/ui/message-strip";
import { SkeletonLinhas } from "@/components/ui/skeleton";
import { num2 } from "@/lib/formato";
import Botao from "@/components/ui/botao";
import { classeControle } from "@/components/ui/campo";

type Categoria = { id: string; nome: string; grupo_id: string; tipo: string };
type Grupo = { id: string; nome: string; ordem: number };

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function parseBR(s: string): number {
  if (!s) return 0;
  const n = parseFloat(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
function key(catId: string, mes: number) {
  return `${catId}:${mes}`;
}

export default function OrcamentoEditor({
  empresaId,
  grupos,
  categorias,
}: {
  empresaId: string;
  grupos: Grupo[];
  categorias: Categoria[];
}) {
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(anoAtual);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [inicial, setInicial] = useState<Record<string, number>>({});
  const [base, setBase] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  const gruposOrdenados = [...grupos].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome));

  const carregar = useCallback(async () => {
    setCarregando(true);
    setMsg(null);
    const supabase = createClient();
    const { data } = await supabase
      .from("orcamentos")
      .select("categoria_id, mes, valor")
      .eq("empresa_id", empresaId)
      .eq("ano", ano);
    const v: Record<string, string> = {};
    const ini: Record<string, number> = {};
    for (const r of data ?? []) {
      const val = Number(r.valor);
      v[key(r.categoria_id, r.mes)] = val ? num2(val) : "";
      ini[key(r.categoria_id, r.mes)] = val;
    }
    setValores(v);
    setInicial(ini);
    setCarregando(false);
  }, [empresaId, ano]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function setCelula(catId: string, mes: number, valor: string) {
    setValores((s) => ({ ...s, [key(catId, mes)]: valor }));
  }
  function aplicarBase(catId: string) {
    const v = base[catId] ?? "";
    setValores((s) => {
      const n = { ...s };
      for (let m = 1; m <= 12; m++) n[key(catId, m)] = v;
      return n;
    });
  }
  function totalLinha(catId: string) {
    let t = 0;
    for (let m = 1; m <= 12; m++) t += parseBR(valores[key(catId, m)] ?? "");
    return t;
  }

  async function salvar() {
    setSalvando(true);
    setMsg(null);
    const supabase = createClient();
    const rows: { empresa_id: string; categoria_id: string; ano: number; mes: number; valor: number }[] = [];
    for (const c of categorias) {
      for (let m = 1; m <= 12; m++) {
        const k = key(c.id, m);
        const novo = parseBR(valores[k] ?? "");
        const antigo = inicial[k] ?? 0;
        if (novo !== antigo) rows.push({ empresa_id: empresaId, categoria_id: c.id, ano, mes: m, valor: novo });
      }
    }
    if (rows.length === 0) {
      setSalvando(false);
      setMsg({ tipo: "ok", texto: "Nada para salvar." });
      return;
    }
    const { error } = await supabase
      .from("orcamentos")
      .upsert(rows, { onConflict: "empresa_id,categoria_id,ano,mes" });
    setSalvando(false);
    if (error) {
      setMsg({ tipo: "erro", texto: error.message });
      return;
    }
    setMsg({ tipo: "ok", texto: `Orçamento salvo (${rows.length} célula(s) atualizada(s)).` });
    const ini = { ...inicial };
    for (const r of rows) ini[key(r.categoria_id, r.mes)] = r.valor;
    setInicial(ini);
  }

  const anos = [anoAtual - 1, anoAtual, anoAtual + 1];
  const inputCel = "num w-24 rounded-md border border-line px-2 py-1 text-right text-xs outline-none focus:border-brand";

  return (
    <div className="space-y-5">
      {msg && <Msg msg={msg} />}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <label htmlFor="orcamento-ano" className="mb-1 block text-[11px] font-semibold text-ink-soft">
            Ano
          </label>
          <select
            id="orcamento-ano"
            value={ano}
            onChange={(e) => setAno(Number(e.target.value))}
            className={classeControle("md", false, "bg-white")}
          >
            {anos.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <Botao variante="primario" className="shadow-card"
          onClick={salvar}
          disabled={salvando || carregando}
        >
          <Save size={15} /> {salvando ? "Salvando…" : "Salvar orçamento"}
        </Botao>
      </div>

      {carregando ? (
        <SkeletonLinhas linhas={8} colunas={6} />
      ) : categorias.length === 0 ? (
        <p className="rounded-xl2 border border-dashed border-line bg-white py-12 text-center text-sm text-ink-soft">
          Cadastre categorias para montar o orçamento.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl2 bg-white shadow-card">
          {/*
            <table> DE PROPÓSITO, não dívida da rodada Tabela: isto é uma
            planilha — coluna de categoria grudada à esquerda (`sticky left-0`,
            que a `Tabela` em grid não tem), linhas de grupo com colspan e uma
            matriz de 12 inputs por linha. Semântica de tabela de verdade,
            inclusive para leitor de tela (th de linha e de coluna). Converter
            perderia a coluna fixa e não ganharia nada de convergência.
          */}
          <table className="min-w-[1100px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-surface/60 text-[11px] font-semibold text-ink-soft">
                <th className="sticky left-0 z-10 bg-surface/60 px-4 py-2 text-left">Categoria</th>
                <th className="px-2 py-2 text-left">Preencher ano</th>
                {MESES.map((m) => (
                  <th key={m} className="px-2 py-2 text-right">
                    {m}
                  </th>
                ))}
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {gruposOrdenados.map((g) => {
                const filhos = categorias.filter((c) => c.grupo_id === g.id);
                if (filhos.length === 0) return null;
                return (
                  <FragmentGroup key={g.id} nome={g.nome}>
                    {filhos.map((c) => (
                      <tr key={c.id} className="border-b border-line/60 last:border-0">
                        <td className="sticky left-0 z-10 bg-white px-4 py-1.5 text-ink">{c.nome}</td>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1">
                            {/*
                              Numa planilha, o rótulo de cada célula são os
                              cabeçalhos da linha e da coluna — que o leitor de
                              tela não lê num `<input>` solto. O `aria-label`
                              junta os dois: a categoria e o mês.
                            */}
                            <input
                              id={`orcamento-base-${c.id}`}
                              aria-label={`Valor para os 12 meses — ${c.nome}`}
                              value={base[c.id] ?? ""}
                              onChange={(e) => setBase((s) => ({ ...s, [c.id]: e.target.value }))}
                              placeholder="0,00"
                              inputMode="decimal"
                              className="num w-20 rounded-md border border-line px-2 py-1 text-right text-xs outline-none focus:border-brand"
                            />
                            <button
                              type="button"
                              onClick={() => aplicarBase(c.id)}
                              title="Aplicar a todos os meses"
                              className="flex h-6 w-6 items-center justify-center rounded-md text-ink-soft transition hover:bg-surface hover:text-brand"
                            >
                              <ChevronRight size={14} />
                            </button>
                          </div>
                        </td>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                          <td key={m} className="px-1 py-1.5 text-right">
                            <input
                              id={`orcamento-${c.id}-${m}`}
                              aria-label={`${MESES[m - 1]} — ${c.nome}`}
                              value={valores[key(c.id, m)] ?? ""}
                              onChange={(e) => setCelula(c.id, m, e.target.value)}
                              placeholder="—"
                              inputMode="decimal"
                              className={inputCel}
                            />
                          </td>
                        ))}
                        <td className="num px-3 py-1.5 text-right font-semibold text-ink">{num2(totalLinha(c.id))}</td>
                      </tr>
                    ))}
                  </FragmentGroup>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] text-ink-soft">
        Dica: digite o valor em “Preencher ano” e clique na seta para repetir nos 12 meses; depois ajuste meses
        específicos (13º, sazonais).
      </p>
    </div>
  );
}

function FragmentGroup({ nome, children }: { nome: string; children: React.ReactNode }) {
  return (
    <>
      <tr>
        <td
          colSpan={15}
          className="sticky left-0 bg-surface/70 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-muted"
        >
          {nome}
        </td>
      </tr>
      {children}
    </>
  );
}

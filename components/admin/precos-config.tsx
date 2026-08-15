"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, Check } from "lucide-react";
import { configDeRow, precoMensalBase, calcular, type CicloDef } from "@/lib/precos";
import PageHeader from "@/components/ui/page-header";
import { Msg } from "@/components/ui/message-strip";
import Card from "@/components/ui/card";
import { brl } from "@/lib/formato";
import Botao from "@/components/ui/botao";

type FaixaRow = { ate: number | null; preco: number };
type Inicial = { faixas: FaixaRow[]; piso: number; ciclos: CicloDef[] };

export default function PrecosConfigAdmin({ inicial }: { inicial: Inicial }) {
  const [faixas, setFaixas] = useState<FaixaRow[]>(inicial.faixas.length ? inicial.faixas : [{ ate: null, preco: 0 }]);
  const [piso, setPiso] = useState<number>(inicial.piso);
  const [ciclos, setCiclos] = useState<CicloDef[]>(inicial.ciclos);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  const cfgPreview = useMemo(() => configDeRow({ faixas, piso, ciclos }), [faixas, piso, ciclos]);

  function setFaixa(i: number, campo: "ate" | "preco", valor: string) {
    setFaixas((fs) => {
      const out = fs.map((f) => ({ ...f }));
      const num = valor === "" ? 0 : Number(valor.replace(",", "."));
      if (campo === "ate") out[i].ate = Number.isFinite(num) ? Math.floor(num) : 0;
      else out[i].preco = Number.isFinite(num) ? num : 0;
      return out;
    });
  }
  function addFaixa() {
    setFaixas((fs) => {
      const out = fs.map((f) => ({ ...f }));
      const ultima = out[out.length - 1];
      const tetoSugerido = out.length >= 2 ? (out[out.length - 2].ate ?? 0) + 10 : 5;
      out.splice(out.length - 1, 0, { ate: tetoSugerido, preco: ultima.preco });
      return out;
    });
  }
  function removerFaixa(i: number) {
    setFaixas((fs) => {
      if (fs.length <= 1) return fs;
      const out = fs.filter((_, idx) => idx !== i).map((f) => ({ ...f }));
      out[out.length - 1].ate = null;
      return out;
    });
  }
  function setCiclo(i: number, campo: "desc" | "selo" | "nome", valor: string) {
    setCiclos((cs) => {
      const out = cs.map((c) => ({ ...c }));
      if (campo === "desc") {
        const pct = valor === "" ? 0 : Number(valor.replace(",", "."));
        out[i].desc = Number.isFinite(pct) ? Math.min(0.99, Math.max(0, pct / 100)) : 0;
      } else if (campo === "selo") out[i].selo = valor || undefined;
      else out[i].nome = valor;
      return out;
    });
  }
  async function salvar() {
    setSalvando(true); setMsg(null);
    try {
      const res = await fetch("/api/precos/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ faixas, piso, ciclos }) });
      const data = await res.json();
      if (!res.ok) setMsg({ tipo: "erro", texto: data?.erro || "Não foi possível salvar." });
      else setMsg({ tipo: "ok", texto: "Preços atualizados. As assinaturas novas e o simulador já usam os novos valores." });
    } catch { setMsg({ tipo: "erro", texto: "Falha de conexão ao salvar." }); }
    finally { setSalvando(false); }
  }
  const exemplos = [1, 3, 5, 10, 25, 50];

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Preços"
        voltar={{ href: "/admin", label: "Painel" }}
        sub="Parametrize as faixas por volume, o piso e os descontos por ciclo. Vale para todos os escritórios."
        acoes={
          <Botao variante="primario" onClick={salvar} disabled={salvando}>
            <Check size={15} /> {salvando ? "Salvando…" : "Salvar"}
          </Botao>
        }
      />

      {msg && <Msg msg={msg} />}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <div className="rounded-xl2 bg-white p-4 shadow-card">
            <h2 className="text-[13px] font-bold text-ink">Faixas por volume de empresas</h2>
            <p className="mt-0.5 text-[13px] text-ink-soft">Cada empresa adicional custa o preço da sua faixa (desconto gradual). A última faixa é "acima", sem teto.</p>
            <div className="mt-4 space-y-2">
              {faixas.map((f, i) => {
                const ehUltima = i === faixas.length - 1;
                const de = i === 0 ? 1 : (faixas[i - 1].ate ?? 0) + 1;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-16 shrink-0 text-right text-xs text-ink-soft">{de} a</span>
                    {ehUltima ? (
                      <span className="w-24 rounded-lg border border-line bg-surface px-3 py-2 text-center text-sm text-ink-soft">acima</span>
                    ) : (
                      <input type="text" inputMode="numeric" value={f.ate ?? ""} onChange={(e) => setFaixa(i, "ate", e.target.value)}
                        className="w-24 rounded-lg border border-line px-3 py-2 text-center text-sm text-ink focus:border-brand focus:outline-none" />
                    )}
                    <span className="shrink-0 text-xs text-ink-soft">empresas ·</span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-ink-soft">R$</span>
                      <input type="text" inputMode="decimal" value={f.preco} onChange={(e) => setFaixa(i, "preco", e.target.value)}
                        className="num w-24 rounded-lg border border-line px-3 py-2 text-center text-sm text-ink focus:border-brand focus:outline-none" />
                      <span className="text-xs text-ink-soft">/empresa</span>
                    </div>
                    <button type="button" onClick={() => removerFaixa(i)} disabled={faixas.length <= 1} title="Remover faixa"
                      className="ml-auto flex items-center justify-center rounded-lg p-1.5 text-ink-soft transition hover:bg-surface hover:text-danger disabled:opacity-30">
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
            <button type="button" onClick={addFaixa}
              className="mt-3 inline-flex items-center gap-1 rounded-lg border border-dashed border-line px-3 py-1.5 text-xs font-semibold text-ink-muted transition hover:border-brand hover:text-brand">
              <Plus size={13} /> Adicionar faixa
            </button>
            <div className="mt-5 border-t border-line pt-4">
              <label className="flex items-center gap-2 text-sm text-ink">
                <span className="font-semibold">Piso mensal</span>
                <span className="text-xs text-ink-soft">R$</span>
                <input type="text" inputMode="decimal" value={piso} onChange={(e) => setPiso(e.target.value === "" ? 0 : Number(e.target.value.replace(",", ".")))}
                  className="num w-28 rounded-lg border border-line px-3 py-2 text-center text-sm focus:border-brand focus:outline-none" />
                <span className="text-xs text-ink-soft">— valor mínimo cobrado, independente do volume</span>
              </label>
            </div>
          </div>

          <Card titulo="Ciclos e descontos" sub="Desconto aplicado sobre o mensal cheio. O selo é o texto exibido na tela de planos.">
            <div className="mt-4 space-y-3">
              {ciclos.map((c, i) => (
                <div key={c.id} className="flex flex-wrap items-center gap-2">
                  <input type="text" value={c.nome} onChange={(e) => setCiclo(i, "nome", e.target.value)}
                    className="w-32 rounded-md border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink focus:border-brand focus:outline-none" />
                  <span className="text-xs text-ink-soft">{c.meses} {c.meses === 1 ? "mês" : "meses"} · desconto</span>
                  <div className="flex items-center gap-1">
                    <input type="text" inputMode="decimal" value={Math.round(c.desc * 1000) / 10} onChange={(e) => setCiclo(i, "desc", e.target.value)}
                      className="num w-16 rounded-lg border border-line px-2 py-2 text-center text-sm focus:border-brand focus:outline-none" />
                    <span className="text-xs text-ink-soft">%</span>
                  </div>
                  <input type="text" value={c.selo ?? ""} placeholder="selo (opcional)" onChange={(e) => setCiclo(i, "selo", e.target.value)}
                    className="flex-1 rounded-md border border-line px-2.5 py-1.5 text-[12.5px] text-ink-muted focus:border-brand focus:outline-none" />
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card className="lg:sticky lg:top-4 lg:self-start" titulo="Pré-visualização" sub="Preço mensal cheio por volume (com a config atual em edição).">
          <div className="mt-3 space-y-1.5">
            {exemplos.map((n) => (
              <div key={n} className="flex items-center justify-between text-sm">
                <span className="text-ink-muted">{n} empresa{n > 1 ? "s" : ""}</span>
                <span className="num font-semibold text-ink">{brl(precoMensalBase(n, cfgPreview))}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-line pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Exemplo: 10 empresas</p>
            <div className="mt-2 space-y-1.5">
              {cfgPreview.ciclos.map((c) => {
                const calc = calcular(10, c.id, cfgPreview);
                return (
                  <div key={c.id} className="flex items-center justify-between text-sm">
                    <span className="text-ink-muted">{c.nome}</span>
                    <span className="num text-ink">{brl(calc.mensalEquivalente)}/mês{c.meses > 1 && <span className="text-ink-soft"> · {brl(calc.totalCiclo)}</span>}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

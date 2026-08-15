"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Check, X } from "lucide-react";
import PageHeader from "@/components/ui/page-header";
import { Msg } from "@/components/ui/message-strip";
import Card from "@/components/ui/card";
import Botao from "@/components/ui/botao";
import { classeControle } from "@/components/ui/campo";
import Tabela, { LinhaTabela } from "@/components/ui/tabela";
import type { ColunaDef } from "@/components/ui/config-colunas";

export type CupomRow = {
  id: string;
  codigo: string;
  percentual: number;
  duracao_meses: number | null;
  ativo: boolean;
  max_usos: number | null;
  usos: number;
  criado_em: string | null;
};

const COLUNAS: ColunaDef[] = [
  { id: "codigo", label: "Código", largura: "1fr" },
  { id: "desconto", label: "Desconto", largura: "100px", alinha: "dir" },
  { id: "duracao", label: "Duração", largura: "110px", alinha: "dir" },
  { id: "usos", label: "Usos", largura: "100px", alinha: "dir" },
  { id: "status", label: "Status", largura: "110px", alinha: "dir" },
];
const GRID = COLUNAS.map((c) => c.largura).join(" ");

export default function AdminCupons({ cupons }: { cupons: CupomRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [codigo, setCodigo] = useState("");
  const [percentual, setPercentual] = useState<number>(50);
  const [duracao, setDuracao] = useState<number>(6);
  const [maxUsos, setMaxUsos] = useState<string>("");
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  async function criar() {
    setMsg(null);
    const res = await fetch("/api/cupom/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        acao: "criar",
        codigo,
        percentual,
        duracaoMeses: duracao > 0 ? duracao : null,
        maxUsos: maxUsos ? Number(maxUsos) : null,
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg({ tipo: "erro", texto: j.erro || "Não foi possível criar o cupom." });
      return;
    }
    setMsg({ tipo: "ok", texto: `Cupom ${codigo.toUpperCase()} criado.` });
    setCodigo("");
    start(() => router.refresh());
  }

  async function toggle(c: CupomRow) {
    const res = await fetch("/api/cupom/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao: "toggle", id: c.id, ativo: !c.ativo }),
    });
    if (res.ok) start(() => router.refresh());
  }

  return (
    <div className="space-y-6">
      <PageHeader titulo="Cupons" sub="Descontos aplicáveis na assinatura, por percentual ou valor fixo." />

      {/* criar */}
      <Card titulo="Novo cupom">
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="block">
            <span className="text-xs font-medium text-ink-muted">Código</span>
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="FUNDADOR50"
              className={classeControle("md", false, "mt-1 uppercase")}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-ink-muted">Desconto (%)</span>
            <input
              type="number"
              min={1}
              max={100}
              value={percentual}
              onChange={(e) => setPercentual(Number(e.target.value))}
              className={classeControle("md", false, "num mt-1")}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-ink-muted">Duração (meses)</span>
            <input
              type="number"
              min={0}
              value={duracao}
              onChange={(e) => setDuracao(Number(e.target.value))}
              className={classeControle("md", false, "num mt-1")}
            />
            <span className="mt-1 block text-[11px] text-ink-soft">0 = enquanto assinante</span>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-ink-muted">Limite de usos</span>
            <input
              type="number"
              min={1}
              value={maxUsos}
              onChange={(e) => setMaxUsos(e.target.value)}
              placeholder="ilimitado"
              className={classeControle("md", false, "num mt-1")}
            />
          </label>
        </div>
        {msg && <Msg msg={msg} />}
        <Botao variante="primario" className="mt-4"
          onClick={criar}
          disabled={pending}
        >
          <Plus size={15} /> Criar cupom
        </Botao>
      </Card>

      {/* lista — a `Tabela` do app, no lugar da <table> à mão */}
      <Tabela
        colunas={COLUNAS}
        gridTemplate={GRID}
        larguraMinima="560px"
        vazio={{ titulo: "Nenhum cupom criado ainda." }}
      >
        {cupons.length > 0 &&
          cupons.map((c) => (
            <LinhaTabela key={c.id} gridTemplate={GRID}>
              <span className="truncate font-semibold text-ink">{c.codigo}</span>
              <span className="num text-right text-ink">{c.percentual}%</span>
              <span className="text-right text-ink-muted">
                {c.duracao_meses ? `${c.duracao_meses} ${c.duracao_meses === 1 ? "mês" : "meses"}` : "fixo"}
              </span>
              <span className="num text-right text-ink-muted">
                {c.usos}
                {c.max_usos != null ? ` / ${c.max_usos}` : ""}
              </span>
              <span className="text-right">
                <button
                  onClick={() => toggle(c)}
                  disabled={pending}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    c.ativo ? "bg-brand-light text-brand-dark" : "bg-rail text-ink-soft"
                  }`}
                >
                  {c.ativo ? <Check size={12} /> : <X size={12} />}
                  {c.ativo ? "Ativo" : "Inativo"}
                </button>
              </span>
            </LinhaTabela>
          ))}
      </Tabela>
    </div>
  );
}

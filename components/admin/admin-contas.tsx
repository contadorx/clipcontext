"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, Undo2, LogIn, Trash2 as TrashIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import ObjectStatus, { type Tom } from "@/components/ui/object-status";
import Tabela, { LinhaTabela } from "@/components/ui/tabela";
import type { ColunaDef } from "@/components/ui/config-colunas";
import { brl, dataBR, dataDeTimestamp } from "@/lib/formato";

export type Conta = {
  id: string;
  nome: string;
  email?: string | null;
  status: string | null;
  ciclo: string | null;
  valor_mensal: number | null;
  criado_em: string;
  proximo_vencimento: string | null;
  is_teste: boolean;
  empresas: number;
};

/*
  Conversão da <table> à mão para a `Tabela` do app (rodada Tabela): mesma
  moldura, cabeçalho grudento e vazio das listas principais. As larguras vieram
  medidas do que a tabela antiga ocupava.
*/
const COLUNAS: ColunaDef[] = [
  { id: "escritorio", label: "Escritório", largura: "1.6fr" },
  { id: "status", label: "Status", largura: "110px" },
  { id: "ciclo", label: "Ciclo", largura: "90px" },
  { id: "empresas", label: "Empresas", largura: "80px", alinha: "dir" },
  { id: "valor", label: "Valor/mês", largura: "100px", alinha: "dir" },
  { id: "cadastro", label: "Cadastro", largura: "92px", alinha: "dir" },
  { id: "venc", label: "Próx. venc.", largura: "92px", alinha: "dir" },
  { id: "teste", label: "Teste", largura: "128px", alinha: "dir" },
  { id: "acoes", label: "Ações", largura: "150px", alinha: "dir" },
];
const GRID = COLUNAS.map((c) => c.largura).join(" ");

const STATUS: Record<string, { l: string; tom: Tom }> = {
  ativa: { l: "Ativa", tom: "positivo" },
  selecionada: { l: "Selecionada", tom: "critico" },
  trial: { l: "Trial", tom: "neutro" },
  cancelada: { l: "Cancelada", tom: "negativo" },
};

export default function AdminContas({ lista }: { lista: Conta[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [alvo, setAlvo] = useState<string | null>(null);
  const [impId, setImpId] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState<string | null>(null);

  async function excluirConta(c: Conta) {
    const aviso =
      `EXCLUIR a conta "${c.nome}"?\n\n` +
      `Isto apaga PERMANENTEMENTE o escritório, todas as empresas, lançamentos, ` +
      `documentos, boletos, notas e o acesso do usuário. Não dá para desfazer.\n\n` +
      `Para confirmar, digite o nome do escritório exatamente:`;
    const digitado = window.prompt(aviso);
    if (digitado === null) return;
    if (digitado.trim() !== c.nome.trim()) {
      alert("O nome digitado não confere. Exclusão cancelada.");
      return;
    }
    setExcluindo(c.id);
    try {
      const r = await fetch("/api/admin/excluir-conta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ escritorio_id: c.id }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { erro?: string };
        alert(j.erro || "Não foi possível excluir a conta.");
        setExcluindo(null);
        return;
      }
      router.refresh();
    } catch {
      alert("Falha de rede ao excluir a conta.");
    } finally {
      setExcluindo(null);
    }
  }

  function toggleTeste(c: Conta) {
    setAlvo(c.id);
    start(async () => {
      const supabase = createClient();
      // marcar como teste tira a conta dos números do painel do negócio; se
      // falhar em silêncio o `router.refresh()` redesenha com o valor antigo e
      // parece que o clique não pegou
      const r = await supabase.rpc("admin_set_teste", { p_escritorio: c.id, p_valor: !c.is_teste });
      if (r.error) alert(`Não foi possível alterar a marca de teste: ${r.error.message}`);
      router.refresh();
    });
  }

  async function impersonar(c: Conta) {
    if (!confirm(`Entrar como "${c.nome}"?\n\nVocê passa a ver o sistema como esse escritório até clicar em "Sair" no aviso do topo.`)) return;
    setImpId(c.id);
    try {
      const r = await fetch("/api/admin/impersonar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ escritorio_id: c.id }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { erro?: string };
        alert(j.erro || "Não foi possível impersonar este escritório.");
        setImpId(null);
        return;
      }
      window.location.href = "/";
    } catch {
      alert("Falha de rede ao impersonar.");
      setImpId(null);
    }
  }

  return (
    <Tabela
      colunas={COLUNAS}
      gridTemplate={GRID}
      larguraMinima="960px"
      vazio={{ titulo: "Nenhum escritório ainda." }}
    >
      {lista.length > 0 &&
        lista.map((e) => {
          const st = STATUS[e.status ?? "trial"] ?? STATUS.trial;
          const ocupado = pending && alvo === e.id;
          return (
            <LinhaTabela key={e.id} gridTemplate={GRID} className={e.is_teste ? "bg-surface/40" : ""}>
              <span className="min-w-0 font-medium text-ink">
                <span className="flex items-center gap-2">
                  <span className="truncate">{e.nome}</span>
                  {e.is_teste && (
                    <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-ink-soft">
                      teste
                    </span>
                  )}
                </span>
                {e.email && <span className="block truncate text-[11px] font-normal text-ink-soft">{e.email}</span>}
              </span>
              <span>
                <ObjectStatus pilula tom={st.tom}>{st.l}</ObjectStatus>
              </span>
              <span className="text-ink-muted">{e.ciclo ?? "—"}</span>
              <span className="num text-right text-ink-muted">{e.empresas}</span>
              <span className="num text-right text-ink">{e.valor_mensal ? brl(Number(e.valor_mensal)) : "—"}</span>
              <span className="num text-right text-ink-soft">{dataDeTimestamp(e.criado_em)}</span>
              <span className="num text-right text-ink-soft">{dataBR(e.proximo_vencimento)}</span>
              <span className="text-right">
                <button
                  type="button"
                  onClick={() => toggleTeste(e)}
                  disabled={ocupado}
                  title={e.is_teste ? "Tirar de teste (volta a contar nas métricas)" : "Marcar como teste (sai das métricas)"}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-60 ${
                    e.is_teste
                      ? "border-line text-ink-muted hover:bg-surface"
                      : "border-line text-ink hover:border-brand hover:text-brand"
                  }`}
                >
                  {e.is_teste ? <Undo2 size={13} /> : <FlaskConical size={13} />}
                  {ocupado ? "…" : e.is_teste ? "Tirar teste" : "Marcar teste"}
                </button>
              </span>
              <span className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => impersonar(e)}
                  disabled={impId === e.id}
                  title={`Entrar no sistema como ${e.nome}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand disabled:opacity-60"
                >
                  <LogIn size={13} />
                  {impId === e.id ? "Entrando…" : "Impersonar"}
                </button>
                <button
                  type="button"
                  onClick={() => excluirConta(e)}
                  disabled={excluindo === e.id}
                  title="Excluir a conta e todos os dados"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition hover:bg-rose-50 hover:text-danger disabled:opacity-60"
                >
                  <TrashIcon size={15} />
                </button>
              </span>
            </LinhaTabela>
          );
        })}
    </Tabela>
  );
}

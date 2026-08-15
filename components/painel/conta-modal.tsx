"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { mascaraMoeda, parseMoeda } from "@/lib/formato";
import MessageStrip from "@/components/ui/message-strip";
import Botao from "@/components/ui/botao";

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

const campoCls =
  "mt-1 w-full rounded-md border border-line px-2.5 py-1.5 text-[12.5px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";

export default function ContaModal({
  aberto,
  empresaId,
  onFechar,
  onSalvo,
}: {
  aberto: boolean;
  empresaId: string;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [nome, setNome] = useState("");
  const [banco, setBanco] = useState("");
  const [agencia, setAgencia] = useState("");
  const [contaNum, setContaNum] = useState("");
  const [dataInicio, setDataInicio] = useState(hoje());
  const [saldo, setSaldo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  if (!aberto) return null;

  function limpar() {
    setNome("");
    setBanco("");
    setAgencia("");
    setContaNum("");
    setDataInicio(hoje());
    setSaldo("");
    setErro(null);
  }

  async function salvar() {
    setErro(null);
    const nomeFinal = nome.trim() || banco.trim();
    if (!nomeFinal) {
      setErro("Dê um nome à conta (ou informe o banco).");
      return;
    }
    if (!empresaId) {
      setErro("Selecione uma empresa antes de criar a conta.");
      return;
    }
    const valor = parseMoeda(saldo);
    setSalvando(true);
    const supabase = createClient();
    const { error } = await supabase.from("contas_bancarias").insert({
      empresa_id: empresaId,
      nome: nomeFinal,
      banco: banco.trim() || null,
      agencia: agencia.trim() || null,
      conta_numero: contaNum.trim() || null,
      data_inicio: dataInicio || null,
      saldo_inicial: valor,
    });
    setSalvando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    limpar();
    onSalvo();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-rail/50 backdrop-blur-[1px] p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onFechar();
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="dlg-conta-do-painel-titulo" className="w-full max-w-md rounded-xl2 bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h3 id="dlg-conta-do-painel-titulo" className="text-[13px] font-bold text-ink">Nova conta</h3>
          <button onClick={onFechar} className="text-ink-soft transition hover:text-ink" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <label className="block">
            <span className="text-xs font-medium text-ink-muted">Nome da conta</span>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Itaú — Movimento" className={campoCls} />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="text-xs font-medium text-ink-muted">Banco</span>
              <input value={banco} onChange={(e) => setBanco(e.target.value)} className={campoCls} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-ink-muted">Agência</span>
              <input value={agencia} onChange={(e) => setAgencia(e.target.value)} className={campoCls} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-ink-muted">Conta</span>
              <input value={contaNum} onChange={(e) => setContaNum(e.target.value)} className={campoCls} />
            </label>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-ink-muted">Data de início</span>
              <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className={campoCls} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-ink-muted">Saldo inicial</span>
              <input inputMode="decimal" value={saldo} onChange={(e) => setSaldo(mascaraMoeda(e.target.value))} placeholder="0,00" className={`num ${campoCls}`} />
            </label>
          </div>

          {erro && <MessageStrip tipo="erro">{erro}</MessageStrip>}
        </div>

        <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
          <button onClick={onFechar} className="rounded-md border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-muted transition hover:border-brand hover:text-brand">
            Cancelar
          </button>
          <Botao variante="primario"
            onClick={salvar}
            disabled={salvando}
          >
            {salvando ? "Salvando…" : "Criar conta"}
          </Botao>
        </div>
      </div>
    </div>
  );
}

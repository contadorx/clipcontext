"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Building2, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { selecionarEmpresa } from "@/app/actions";
import { mascaraCpfCnpj, soDigitos } from "@/lib/formato";
import { useAtalhosModal } from "@/lib/atalhos";
import MessageStrip from "@/components/ui/message-strip";
import Modal, { useSujo } from "@/components/ui/modal";
import Botao from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo";

export function NovaEmpresaModal({
  aberto,
  onFechar,
  aoCriar,
}: {
  aberto: boolean;
  onFechar: () => void;
  aoCriar: (id: string) => void | Promise<void>;
}) {
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const router = useRouter();
  // guarda contra perder o nome/CNPJ já digitados ao clicar fora ou apertar Esc
  const form = useSujo(aberto);
  // Esc é do `Modal` (ele confirma o descarte antes de fechar); aqui fica só Ctrl+Enter
  useAtalhosModal(aberto, { onConfirmar: () => criar() });

  if (!aberto) return null;
  if (typeof document === "undefined") return null;

  async function criar() {
    if (!nome.trim()) {
      setErro("Dê um nome à empresa.");
      return;
    }
    setSalvando(true);
    setErro(null);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("criar_empresa", {
      p_nome: nome.trim(),
      p_cnpj: soDigitos(cnpj) || null,
    });
    setSalvando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    const novoId = data as string;
    setNome("");
    setCnpj("");
    await selecionarEmpresa(novoId);
    await aoCriar(novoId);
    onFechar();
    router.push(`/empresas/${novoId}/configurar`);
  }

  return createPortal(
    <Modal rotulo="Nova empresa" onFechar={onFechar} sujo={form.sujo} largura="max-w-sm">
      <div className="p-5" {...form.campos}>
        <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
          <Building2 size={16} className="text-brand" /> Nova empresa
        </h3>
        <p className="mt-1 text-xs text-ink-soft">Adicione uma empresa à sua carteira. O plano de contas padrão já vem pronto.</p>

        <CampoTexto
          id="nova-empresa-nome"
          className="mt-4"
          rotulo="Nome da empresa"
          obrigatorio
          autoFocus
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && criar()}
          placeholder="Ex.: Padaria Estrela"
        />

        <CampoTexto
          id="nova-empresa-doc"
          className="mt-3"
          rotulo="CNPJ / CPF"
          ajuda="Opcional — dá para preencher depois, nos dados da empresa."
          value={cnpj}
          onChange={(e) => setCnpj(mascaraCpfCnpj(e.target.value))}
          onKeyDown={(e) => e.key === "Enter" && criar()}
          placeholder="00.000.000/0000-00"
          inputClassName="num"
        />

        {erro && <MessageStrip tipo="erro" className="mt-2">{erro}</MessageStrip>}

        <div className="mt-4 flex gap-2">
          <Botao data-fechar onClick={() => form.confirmar() && onFechar()} className="flex-1">
            Cancelar
          </Botao>
          <Botao variante="primario" onClick={criar} disabled={salvando} className="flex-1">
            {salvando ? "Criando…" : "Criar empresa"}
          </Botao>
        </div>
      </div>
    </Modal>,
    document.body,
  );
}

export default function NovaEmpresaBotao({
  aoCriar,
  className = "",
}: {
  aoCriar: (id: string) => void | Promise<void>;
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Botao variante="primario" onClick={() => setAberto(true)} className={className}>
        <Plus size={15} /> Nova empresa
      </Botao>
      <NovaEmpresaModal aberto={aberto} onFechar={() => setAberto(false)} aoCriar={aoCriar} />
    </>
  );
}

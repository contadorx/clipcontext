"use client";

import { useState } from "react";
import { Users, Plus, Trash2, Power, Mail, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { Msg } from "@/components/ui/message-strip";
import EmptyState from "@/components/ui/empty-state";
import ObjectStatus from "@/components/ui/object-status";
import Botao, { BotaoIcone } from "@/components/ui/botao";
import { CampoTexto } from "@/components/ui/campo";

export type PortalUsuario = {
  id: string;
  email: string;
  nome: string | null;
  ativo: boolean;
  ultimo_acesso: string | null;
};

function emailValido(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
}

export default function PortalUsuarios({
  empresaId,
  empresaNome,
  inicial,
}: {
  empresaId: string;
  empresaNome: string;
  inicial: PortalUsuario[];
}) {
  const { toast } = useToast();
  const [lista, setLista] = useState<PortalUsuario[]>(inicial);
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [busy, setBusy] = useState(false);
  const [enviandoId, setEnviandoId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  async function adicionar() {
    const e = email.trim().toLowerCase();
    if (!emailValido(e)) {
      setMsg({ tipo: "erro", texto: "Informe um e-mail válido." });
      return;
    }
    if (lista.some((u) => u.email.toLowerCase() === e)) {
      setMsg({ tipo: "erro", texto: "Esse e-mail já está na lista." });
      return;
    }
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("portal_usuarios")
      .insert({ empresa_id: empresaId, email: e, nome: nome.trim() || null, ativo: true })
      .select("id, email, nome, ativo, ultimo_acesso")
      .single();
    setBusy(false);
    if (error || !data) {
      setMsg({ tipo: "erro", texto: error?.message ?? "Não foi possível adicionar." });
      return;
    }
    setLista((prev) => [...prev, data as PortalUsuario]);
    setEmail("");
    setNome("");
    setMsg({ tipo: "ok", texto: "Usuário autorizado adicionado." });
  }

  async function alternarAtivo(u: PortalUsuario) {
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("portal_usuarios")
      .update({ ativo: !u.ativo })
      .eq("id", u.id);
    setBusy(false);
    if (error) {
      setMsg({ tipo: "erro", texto: error.message });
      return;
    }
    setLista((prev) => prev.map((x) => (x.id === u.id ? { ...x, ativo: !x.ativo } : x)));
  }

  async function remover(u: PortalUsuario) {
    /*
      Sem `confirm()`: remover da lista tira o acesso na hora (a sessão do
      portal confere `ativo` a cada carga), e o Desfazer devolve. Uma pergunta
      do navegador aqui só atrasa quem está limpando a lista de um cliente.
    */
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    const back = await supabase.from("portal_usuarios").select("*").eq("id", u.id).maybeSingle();
    const { error } = await supabase.from("portal_usuarios").delete().eq("id", u.id);
    setBusy(false);
    if (error) {
      setMsg({ tipo: "erro", texto: error.message });
      return;
    }
    setLista((prev) => prev.filter((x) => x.id !== u.id));
    const linha = back.error ? null : back.data;
    toast(linha ? `Acesso removido: ${u.email}.` : `Acesso removido: ${u.email}. Não foi possível preparar o Desfazer.`, {
      desfazer: linha
        ? async () => {
            const volta = await createClient()
              .from("portal_usuarios")
              .insert(linha as Record<string, unknown>)
              .select("id, email, nome, ativo")
              .single();
            if (volta.error) {
              toast(`Não foi possível restaurar (${volta.error.message}).`, { tom: "erro" });
              return;
            }
            // a página carrega ordenado por criação; devolver no fim faria o
            // acesso restaurado parecer um cadastro novo
            setLista((prev) => [...prev, volta.data as PortalUsuario].sort((x, y) => x.email.localeCompare(y.email, "pt-BR")));
          }
        : undefined,
    });
  }

  async function enviarAcesso(u: PortalUsuario) {
    setEnviandoId(u.id);
    setMsg(null);
    try {
      const resp = await fetch("/api/portal/enviar-acesso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empresaId,
          empresaNome,
          usuarioId: u.id,
          email: u.email,
          nome: u.nome,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || data?.error) {
        setMsg({ tipo: "erro", texto: data?.error ?? "Não foi possível enviar o acesso." });
      } else {
        setMsg({ tipo: "ok", texto: `Link de acesso enviado para ${u.email}.` });
      }
    } catch {
      setMsg({ tipo: "erro", texto: "Falha de conexão ao enviar o acesso." });
    }
    setEnviandoId(null);
  }

  return (
    <div className="rounded-xl2 border border-line bg-surface p-5 shadow-card">
      <div className="flex items-center gap-2">
        <Users size={18} className="text-brand" />
        <h2 className="text-base font-bold text-ink">Usuários com acesso</h2>
      </div>
      <p className="mt-1 text-sm text-ink-muted">
        Só quem está nesta lista abre o portal desta empresa. Use "Enviar acesso" para mandar o link de entrada por
        e-mail (sem senha, válido por 24h); depois de entrar, a pessoa fica conectada por duas semanas. "Revogar"
        derruba o acesso na hora, mesmo de quem já tinha entrado.
      </p>

      {/* `sm:items-end` para "Adicionar" continuar na linha dos campos agora que eles têm rótulo em cima */}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <CampoTexto
          id="portal-usuario-email"
          rotulo="E-mail do cliente"
          className="flex-1"
          inputClassName="bg-white text-ink"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@cliente.com.br"
        />
        <CampoTexto
          id="portal-usuario-nome"
          rotulo="Nome (opcional)"
          className="flex-1"
          inputClassName="bg-white text-ink"
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome (opcional)"
        />
        <Botao variante="primario" onClick={adicionar} disabled={busy}>
          <Plus size={15} /> Adicionar
        </Botao>
      </div>

      {msg && <Msg msg={msg} />}

      <div className="mt-4">
        {lista.length === 0 ? (
          <EmptyState titulo="Nenhum usuário autorizado ainda." />
        ) : (
          <ul className="divide-y divide-line">
            {lista.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Mail size={14} className="shrink-0 text-ink-soft" />
                    <span className="truncate text-sm font-medium text-ink">{u.email}</span>
                    {!u.ativo && (
                      <ObjectStatus pilula tom="neutro" semMarcador className="shrink-0">
                        Revogado
                      </ObjectStatus>
                    )}
                  </div>
                  {u.nome && <p className="mt-0.5 truncate text-xs text-ink-muted">{u.nome}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {u.ativo && (
                    <Botao
                      tamanho="sm"
                      onClick={() => enviarAcesso(u)}
                      disabled={busy || enviandoId === u.id}
                      title="Enviar link de acesso por e-mail"
                    >
                      <Send size={13} /> {enviandoId === u.id ? "Enviando…" : "Enviar acesso"}
                    </Botao>
                  )}
                  <Botao
                    tamanho="sm"
                    onClick={() => alternarAtivo(u)}
                    disabled={busy}
                    title={u.ativo ? "Revogar o acesso desta pessoa ao portal" : "Reativar o acesso desta pessoa"}
                  >
                    <Power size={13} /> {u.ativo ? "Revogar" : "Reativar"}
                  </Botao>
                  <BotaoIcone
                    rotulo={`Remover o acesso de ${u.email}`}
                    variante="perigo"
                    onClick={() => remover(u)}
                    disabled={busy}
                  >
                    <Trash2 size={13} />
                  </BotaoIcone>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

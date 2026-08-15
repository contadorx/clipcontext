"use client";

import Link from "next/link";

import { useState } from "react";
import { Link2, Copy, RefreshCw, Check, ExternalLink, Power, Mail, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Msg } from "@/components/ui/message-strip";
import ObjectStatus from "@/components/ui/object-status";
import Botao from "@/components/ui/botao";
import { classeControle, CampoTexto } from "@/components/ui/campo";

type LinkRow = { token: string; ativo: boolean } | null;

function novoToken() {
  const g =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  return g.replace(/-/g, "");
}

export default function PortalAdmin({
  empresaId,
  empresaNome,
  linkInicial,
}: {
  empresaId: string;
  empresaNome: string;
  linkInicial: LinkRow;
}) {
  const [link, setLink] = useState<LinkRow>(linkInicial);
  const [busy, setBusy] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [email, setEmail] = useState("");
  const [nomeCliente, setNomeCliente] = useState("");
  const [enviando, setEnviando] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = link ? `${origin}/portal/${link.token}` : "";

  async function gerarOuRenovar() {
    // `confirm()` fica: gerar um link novo invalida o que o cliente já tem, e
    // não existe Desfazer para um link que já foi distribuído
    if (link && !confirm("Gerar um novo link invalida o link atual que você já compartilhou. Continuar?")) return;
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    const token = novoToken();
    const { error } = await supabase
      .from("portal_links")
      .upsert({ empresa_id: empresaId, token, ativo: true }, { onConflict: "empresa_id" });
    setBusy(false);
    if (error) {
      setMsg({ tipo: "erro", texto: error.message });
      return;
    }
    setLink({ token, ativo: true });
    setMsg({ tipo: "ok", texto: link ? "Novo link gerado. O anterior parou de funcionar." : "Link do portal criado." });
  }

  async function toggleAtivo() {
    if (!link) return;
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("portal_links")
      .update({ ativo: !link.ativo })
      .eq("empresa_id", empresaId);
    setBusy(false);
    if (error) {
      setMsg({ tipo: "erro", texto: error.message });
      return;
    }
    setLink({ ...link, ativo: !link.ativo });
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      setMsg({ tipo: "erro", texto: "Não consegui copiar. Selecione e copie manualmente." });
    }
  }

  async function enviarConvite() {
    const e = email.trim();
    if (!e.includes("@")) {
      setMsg({ tipo: "erro", texto: "Informe um e-mail válido para enviar o convite." });
      return;
    }
    setEnviando(true);
    setMsg(null);
    try {
      const res = await fetch("/api/portal/convidar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresaId, empresaNome, email: e, nome: nomeCliente.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Não foi possível enviar o convite.");
      /*
        O convite garante um link ativo — inclusive reativando um que estava
        desativado. Isso desfazia, em silêncio, o "Desativar" logo acima na
        mesma tela: dois painéis se anulando sem uma palavra. Continua
        reativando (mandar convite para um portal morto não faria sentido), mas
        agora a mensagem diz que reativou.
      */
      const reativou = link ? link.ativo === false : false;
      if (data.token) setLink({ token: data.token, ativo: true });
      setEmail("");
      setNomeCliente("");
      setMsg({
        tipo: "ok",
        texto: reativou
          ? `Convite enviado para ${e}. O portal desta empresa estava desativado e foi reativado — sem isso o link do convite não abriria.`
          : `Convite enviado para ${e}.`,
      });
    } catch (err) {
      setMsg({ tipo: "erro", texto: err instanceof Error ? err.message : "Falha ao enviar o convite." });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-5">
      {msg && <Msg msg={msg} />}

      <div className="rounded-xl2 bg-white p-4 shadow-card">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-light text-brand">
            <Link2 size={20} />
          </div>
          <div>
            <h2 className="text-[13px] font-bold text-ink">Link do portal — {empresaNome}</h2>
            <p className="text-xs text-ink-muted">
              Página só de leitura com o resumo financeiro, com a marca do seu escritório. O link é o endereço; quem
              entra é quem está na lista de e-mails autorizados, pelo link de acesso que chega no e-mail dele.
            </p>
          </div>
        </div>

        {!link ? (
          <Botao variante="primario" className="mt-4"
            onClick={gerarOuRenovar}
            disabled={busy}
          >
            <Link2 size={15} /> Gerar link do portal
          </Botao>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {/*
                Rótulo por `aria-label`: o campo divide a linha com "Copiar" e
                "Abrir", e o título do cartão logo acima já diz "Link do portal
                — {empresa}".
              */}
              <input
                id="portal-link"
                aria-label="Link do portal"
                readOnly
                value={url}
                className={classeControle("md", false, "num min-w-[260px] flex-1 bg-surface text-ink-muted")}
              />
              <button
                type="button"
                onClick={copiar}
                className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink transition hover:border-brand hover:text-brand"
              >
                {copiado ? <Check size={15} /> : <Copy size={15} />} {copiado ? "Copiado" : "Copiar"}
              </button>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink transition hover:border-brand hover:text-brand"
              >
                <ExternalLink size={15} /> Abrir
              </a>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ObjectStatus pilula tom={link.ativo ? "positivo" : "neutro"}>
                {link.ativo ? "Ativo" : "Desativado"}
              </ObjectStatus>
              <button
                type="button"
                onClick={toggleAtivo}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-muted transition hover:border-danger hover:text-danger disabled:opacity-60"
              >
                <Power size={14} /> {link.ativo ? "Desativar" : "Reativar"}
              </button>
              <button
                type="button"
                onClick={gerarOuRenovar}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-muted transition hover:border-brand hover:text-brand disabled:opacity-60"
              >
                <RefreshCw size={14} /> Gerar novo link
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl2 bg-white p-4 shadow-card">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-light text-brand">
            <Mail size={20} />
          </div>
          <div>
            <h2 className="text-[13px] font-bold text-ink">Enviar o portal por e-mail</h2>
            <p className="text-xs text-ink-muted">
              Mandamos o link de acesso direto para o cliente. Gera o link automaticamente se ainda não existir.
            </p>
          </div>
        </div>
        {/* `items-end` para o botão continuar na linha dos campos agora que eles têm rótulo em cima */}
        <div className="mt-4 grid items-end gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <CampoTexto
            id="portal-nome-cliente"
            rotulo="Nome do cliente (opcional)"
            type="text"
            value={nomeCliente}
            onChange={(e) => setNomeCliente(e.target.value)}
            placeholder="Nome do cliente (opcional)"
          />
          <CampoTexto
            id="portal-email"
            rotulo="E-mail do cliente"
            inputClassName="num"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@cliente.com.br"
          />
          <Botao variante="primario"
            onClick={enviarConvite}
            disabled={enviando}
          >
            <Send size={15} /> {enviando ? "Enviando…" : "Enviar convite"}
          </Botao>
        </div>
      </div>

      <p className="text-[11px] text-ink-soft">
        O portal mostra apenas o resumo (entradas, saídas e resultado por mês). Para tirar o acesso de uma pessoa,
        revogue o e-mail dela em "Usuários com acesso"; para tirar de todos de uma vez, desative ou gere um novo link.{" "}
        <Link href="/configuracoes/marca" className="font-semibold text-brand underline underline-offset-2">
          Configure o logo em Marca do escritório
        </Link>
        .
      </p>
    </div>
  );
}

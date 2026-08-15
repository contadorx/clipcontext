"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import MessageStrip from "@/components/ui/message-strip";
import Botao from "@/components/ui/botao";
import { classeControle } from "@/components/ui/campo";
import { LogoFX } from "@/components/marca";

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [pronto, setPronto] = useState(false); // sessão de recuperação reconhecida
  const [verificando, setVerificando] = useState(true);
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    // 1) fluxo PKCE: o link traz ?code=... para trocar por sessão
    const code = new URLSearchParams(window.location.search).get("code");
    if (code) {
      supabase.auth
        .exchangeCodeForSession(code)
        .then(({ error }) => {
          if (!error) setPronto(true);
        })
        .finally(() => setVerificando(false));
    } else {
      // 2) fluxo implícito: o ssr client lê o hash sozinho e dispara o evento
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) setPronto(true);
        setVerificando(false);
      });
    }

    const { data: sub } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === "PASSWORD_RECOVERY" || evento === "SIGNED_IN") {
        setPronto(true);
        setVerificando(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function salvar() {
    setErro(null);
    if (senha.length < 6) {
      setErro("A senha precisa de pelo menos 6 caracteres.");
      return;
    }
    if (senha !== senha2) {
      setErro("As senhas não conferem.");
      return;
    }
    setSalvando(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) throw error;
      setOk(true);
      setTimeout(() => {
        router.push("/login");
        router.refresh();
      }, 1800);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível redefinir a senha.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-rail px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center">
          <LogoFX tamanho={40} escuro texto="text-lg" />
        </div>

        <div className="rounded-xl2 bg-white p-6 shadow-card">
          <h1 className="text-xl font-extrabold text-ink">Criar nova senha</h1>

          {ok ? (
            <p className="mt-4 rounded-lg bg-brand-light px-3 py-2 text-sm font-medium text-brand-dark">
              Senha alterada! Redirecionando para o login…
            </p>
          ) : verificando ? (
            <p className="mt-4 text-sm text-ink-muted">Validando o link…</p>
          ) : !pronto ? (
            <div className="mt-3">
              <p className="text-sm text-ink-muted">
                O link de recuperação é inválido ou expirou. Peça um novo na tela de login.
              </p>
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="mt-4 w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
              >
                Voltar para o login
              </button>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              <p className="text-sm text-ink-muted">Defina a nova senha da sua conta.</p>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-muted">Nova senha</label>
                <input
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••"
                  className={classeControle("md")}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-muted">Confirmar senha</label>
                <input
                  type="password"
                  value={senha2}
                  onChange={(e) => setSenha2(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && salvar()}
                  placeholder="••••••••"
                  className={classeControle("md")}
                />
              </div>

              {erro && (
                <MessageStrip tipo="erro">{erro}</MessageStrip>
              )}

              <Botao variante="primario" largura
                onClick={salvar}
                disabled={salvando}
              >
                {salvando ? "Salvando…" : "Salvar nova senha"}
              </Botao>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

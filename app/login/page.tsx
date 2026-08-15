"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Botao from "@/components/ui/botao";
import { classeControle } from "@/components/ui/campo";
import { LogoFX } from "@/components/marca";

export default function LoginPage() {
  const [modo, setModo] = useState<"login" | "cadastro" | "recuperar">("login");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const router = useRouter();

  async function enviar() {
    const supabase = createClient();
    setErro(null);
    setAviso(null);

    if (modo === "recuperar") {
      if (!email) {
        setErro("Informe o e-mail da conta.");
        return;
      }
      setCarregando(true);
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/redefinir-senha`,
        });
        if (error) throw error;
        setAviso("Se houver uma conta com esse e-mail, enviamos um link para redefinir a senha. Confira sua caixa de entrada (e o spam).");
      } catch (e) {
        setErro(traduzir(e instanceof Error ? e.message : "Algo deu errado."));
      } finally {
        setCarregando(false);
      }
      return;
    }

    if (!email || !senha) {
      setErro("Preencha e-mail e senha.");
      return;
    }
    setCarregando(true);
    try {
      if (modo === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password: senha,
        });
        if (error) throw error;
        const destino = new URLSearchParams(window.location.search).get("redirect") || "/carteira";
        router.push(destino);
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: senha,
        });
        if (error) throw error;
        if (data.session) {
          const destino = new URLSearchParams(window.location.search).get("redirect") || "/onboarding";
          router.push(destino);
          router.refresh();
        } else {
          setAviso(
            `Conta criada! Enviamos um e-mail de confirmação para ${email}. Abra sua caixa de entrada (confira também o spam), clique no link para confirmar a conta e depois volte aqui para entrar.`,
          );
          setModo("login");
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Algo deu errado.";
      setErro(traduzir(msg));
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-rail px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center">
          <LogoFX tamanho={40} escuro texto="text-lg" />
        </div>

        <div className="rounded-xl2 bg-white p-6 shadow-card">
          <h1 className="text-xl font-extrabold text-ink">
            {modo === "login" ? "Entrar" : modo === "cadastro" ? "Criar conta" : "Recuperar senha"}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {modo === "login"
              ? "Acesse o painel da sua operação."
              : modo === "cadastro"
                ? "Comece a organizar o financeiro dos seus clientes."
                : "Enviamos um link para você criar uma nova senha."}
          </p>

          <div className="mt-5 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-muted">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@escritorio.com.br"
                className={classeControle("md")}
              />
            </div>
            {modo !== "recuperar" && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-muted">
                  Senha
                </label>
                <input
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && enviar()}
                  placeholder="••••••••"
                  className={classeControle("md")}
                />
                {modo === "login" && (
                  <button
                    type="button"
                    onClick={() => {
                      setModo("recuperar");
                      setErro(null);
                      setAviso(null);
                    }}
                    className="mt-1.5 text-xs font-semibold text-brand hover:underline"
                  >
                    Esqueci minha senha
                  </button>
                )}
              </div>
            )}

            {erro && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-danger">
                {erro}
              </p>
            )}
            {aviso && (
              <p className="rounded-lg bg-brand-light px-3 py-2 text-xs font-medium text-brand-dark">
                {aviso}
              </p>
            )}

            <Botao variante="primario" largura
              onClick={enviar}
              disabled={carregando}
            >
              {carregando
                ? "Aguarde…"
                : modo === "login"
                  ? "Entrar"
                  : modo === "cadastro"
                    ? "Criar conta"
                    : "Enviar link de recuperação"}
            </Botao>
          </div>

          <p className="mt-5 text-center text-xs text-ink-muted">
            {modo === "recuperar" ? (
              <button
                type="button"
                onClick={() => {
                  setModo("login");
                  setErro(null);
                  setAviso(null);
                }}
                className="font-semibold text-brand hover:underline"
              >
                ← Voltar para entrar
              </button>
            ) : (
              <>
                {modo === "login" ? "Ainda não tem conta?" : "Já tem conta?"}{" "}
                <button
                  type="button"
                  onClick={() => {
                    setModo(modo === "login" ? "cadastro" : "login");
                    setErro(null);
                    setAviso(null);
                  }}
                  className="font-semibold text-brand hover:underline"
                >
                  {modo === "login" ? "Criar agora" : "Entrar"}
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

function traduzir(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials"))
    return "E-mail ou senha incorretos.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "Este e-mail já tem conta. Tente entrar.";
  if (m.includes("password") && m.includes("6"))
    return "A senha precisa de pelo menos 6 caracteres.";
  if (m.includes("email") && m.includes("valid"))
    return "Informe um e-mail válido.";
  return msg;
}

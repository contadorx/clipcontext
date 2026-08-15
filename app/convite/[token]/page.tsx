"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import MessageStrip from "@/components/ui/message-strip";
import Botao from "@/components/ui/botao";

const PAPEL_LABEL: Record<string, string> = {
  admin: "Administrador", membro: "Membro", analista: "Analista", contabilidade: "Contabilidade",
};

export default function ConvitePage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const [estado, setEstado] = useState<"carregando" | "logado" | "deslogado">("carregando");
  const [info, setInfo] = useState<{ papel: string; escritorio: string; valido: boolean } | null>(null);
  const [aceitando, setAceitando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const init = useCallback(async () => {
    const supabase = createClient();
    const { data: sessao } = await supabase.auth.getUser();
    const { data } = await supabase.rpc("convite_info", { p_token: params.token });
    const linha = (data as { papel: string; escritorio: string; valido: boolean }[])?.[0] ?? null;
    setInfo(linha);
    setEstado(sessao.user ? "logado" : "deslogado");
  }, [params.token]);

  useEffect(() => { init(); }, [init]);

  async function aceitar() {
    setAceitando(true);
    setErro(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("aceitar_convite", { p_token: params.token });
    setAceitando(false);
    if (error) { setErro(error.message); return; }
    router.push("/carteira");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md rounded-xl2 bg-white p-5 shadow-card">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white">
          <Users size={20} />
        </span>

        {estado === "carregando" ? (
          <p className="mt-4 text-sm text-ink-muted">Carregando convite…</p>
        ) : !info || !info.valido ? (
          <>
            <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink">Convite indisponível</h1>
            <p className="mt-1 text-sm text-ink-muted">
              Este convite não existe, já foi utilizado ou expirou. Peça um novo link para quem te convidou.
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink">Você foi convidado</h1>
            <p className="mt-1 text-sm text-ink-muted">
              Para entrar em <span className="font-semibold text-ink">{info.escritorio}</span> como{" "}
              <span className="font-semibold text-ink">{PAPEL_LABEL[info.papel] ?? info.papel}</span>.
            </p>

            {erro && <MessageStrip tipo="erro">{erro}</MessageStrip>}

            {estado === "logado" ? (
              <Botao variante="primario" largura className="mt-5"
                onClick={aceitar}
                disabled={aceitando}
              >
                <CheckCircle2 size={16} /> {aceitando ? "Entrando…" : "Aceitar convite"}
              </Botao>
            ) : (
              <div className="mt-5 space-y-2">
                <p className="text-xs text-ink-soft">Crie sua conta ou entre para aceitar — depois volte a este link.</p>
                <a
                  href={`/login?redirect=/convite/${params.token}`}
                  className="flex w-full items-center justify-center rounded-lg bg-brand py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
                >
                  Entrar / criar conta
                </a>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

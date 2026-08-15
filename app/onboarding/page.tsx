"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Botao from "@/components/ui/botao";
import { classeControle } from "@/components/ui/campo";
import { MarcaFX } from "@/components/marca";

export default function OnboardingPage() {
  const [escritorio, setEscritorio] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const router = useRouter();

  async function criar() {
    const supabase = createClient();
    setErro(null);
    if (!escritorio.trim()) {
      setErro("Dê um nome ao seu escritório.");
      return;
    }
    setCarregando(true);
    const { error } = await supabase.rpc("criar_escritorio_inicial", {
      p_nome_escritorio: escritorio.trim(),
      p_nome_empresa: empresa.trim() || "Minha primeira empresa",
    });
    setCarregando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    router.push("/carteira");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md rounded-xl2 bg-white p-5 shadow-card">
        <MarcaFX tamanho={40} />
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink">
          Vamos configurar
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Crie seu escritório e a primeira empresa. Você adiciona as demais
          depois, no seletor de empresas.
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-muted">
              Nome do escritório
            </label>
            <input
              value={escritorio}
              onChange={(e) => setEscritorio(e.target.value)}
              placeholder="Ex.: Oliveira Contabilidade"
              className={classeControle("md")}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-muted">
              Primeira empresa (cliente)
            </label>
            <input
              value={empresa}
              onChange={(e) => setEmpresa(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && criar()}
              placeholder="Ex.: Padaria Estrela"
              className={classeControle("md")}
            />
          </div>

          {erro && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-danger">
              {erro}
            </p>
          )}

          <Botao variante="primario" largura
            onClick={criar}
            disabled={carregando}
          >
            {carregando ? "Criando…" : "Criar e entrar"}
          </Botao>

          {/*
            Saída para quem não está começando do zero.

            Sem empresa ATIVA todo o app manda para cá — inclusive quem acabou
            de arquivar a última empresa e só quer reativá-la. Sem este link a
            única opção visível é criar um escritório novo, que é a coisa errada
            a fazer.
          */}
          <p className="text-center text-xs text-ink-muted">
            Já tem escritório e arquivou todas as empresas?{" "}
            <Link href="/carteira/gerenciar" className="font-semibold text-brand underline underline-offset-2">
              Reative uma em Gerenciar carteira
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, UploadCloud, Trash2, Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Msg } from "@/components/ui/message-strip";
import Card from "@/components/ui/card";
import FooterBar from "@/components/ui/footer-bar";
import Botao from "@/components/ui/botao";
import { classeControle } from "@/components/ui/campo";

const MAX_KB = 200;

export default function MarcaConfig({
  escritorioId,
  nomeInicial,
  logoInicial,
}: {
  escritorioId: string;
  nomeInicial: string;
  logoInicial: string | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [nome, setNome] = useState(nomeInicial);
  const [logo, setLogo] = useState<string | null>(logoInicial);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  function escolherArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    setMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMsg({ tipo: "erro", texto: "Escolha um arquivo de imagem (PNG, JPG ou SVG)." });
      return;
    }
    if (file.size > MAX_KB * 1024) {
      setMsg({ tipo: "erro", texto: `Imagem muito grande. Use até ${MAX_KB} KB (ideal: PNG com fundo transparente).` });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogo(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => setMsg({ tipo: "erro", texto: "Não consegui ler o arquivo. Tente outro." });
    reader.readAsDataURL(file);
  }

  async function salvar() {
    setSalvando(true);
    setMsg(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("escritorios")
      .update({ nome: nome.trim() || nomeInicial, logo_url: logo })
      .eq("id", escritorioId);
    setSalvando(false);
    if (error) {
      setMsg({ tipo: "erro", texto: error.message });
      return;
    }
    setMsg({ tipo: "ok", texto: "Marca salva." });
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {msg && <Msg msg={msg} />}

      <Card titulo="Nome do escritório" sub="Aparece no app e no portal do cliente.">
        {/*
          O nome do campo vai em `aria-label`: o cartão já se chama "Nome do
          escritório" e um rótulo visível logo abaixo do título diria a mesma
          coisa duas vezes.
        */}
        <input
          id="marca-nome"
          aria-label="Nome do escritório"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex.: Contabilidade Oliveira"
          className={classeControle("md", false, "mt-3 max-w-md")}
        />
      </Card>

      <Card titulo="Logo">
        <p className="text-xs text-ink-muted">
          PNG, JPG ou SVG até {MAX_KB} KB. Use uma imagem com fundo transparente para o melhor resultado.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl2 border border-line bg-surface">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="Logo do escritório" className="h-full w-full object-contain" />
            ) : (
              <Building2 size={26} className="text-ink-soft" strokeWidth={1.5} />
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink transition hover:border-brand hover:text-brand"
            >
              <UploadCloud size={15} /> {logo ? "Trocar logo" : "Enviar logo"}
            </button>
            {logo && (
              <button
                type="button"
                onClick={() => setLogo(null)}
                className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-muted transition hover:border-danger hover:text-danger"
              >
                <Trash2 size={15} /> Remover
              </button>
            )}
          </div>
          {/*
            Campo de arquivo escondido, acionado pelo botão acima: fica sem nome
            se alguém o alcançar por teclado ou se o `hidden` sair um dia.
          */}
          <input
            ref={fileRef}
            id="marca-logo-arquivo"
            aria-label="Arquivo do logo (PNG, JPG ou SVG)"
            type="file"
            accept="image/*"
            onChange={escolherArquivo}
            className="hidden"
          />
        </div>
      </Card>

      <FooterBar>
        <Botao variante="primario" onClick={salvar} disabled={salvando}>
          <Save size={15} /> {salvando ? "Salvando…" : "Salvar marca"}
        </Botao>
      </FooterBar>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/sidebar";
import { Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import GuardaDialogo from "@/components/ui/guarda-dialogo";

export default function AppShell({
  colapsadoInicial,
  logoUrl,
  admin,
  papel,
  docsNovos,
  menusBloqueados = [],
  topbar,
  children,
}: {
  colapsadoInicial: boolean;
  logoUrl?: string | null;
  admin?: boolean;
  papel?: string;
  docsNovos?: number;
  menusBloqueados?: string[];
  topbar: React.ReactNode;
  children: React.ReactNode;
}) {
  const [colapsado, setColapsado] = useState(colapsadoInicial);
  // Abaixo de md a navegação é gaveta. Estado separado de `colapsado` de
  // propósito: recolher a coluna no desktop e abrir a gaveta no celular são
  // duas intenções diferentes, e misturá-las faz a preferência de uma vazar
  // para a outra.
  const [gaveta, setGaveta] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Perfil Contabilidade: só acessa configuração/exportação contábil. Qualquer outra rota redireciona.
  const ROTAS_CONTABIL = [
    "/configuracoes/contabil",
    "/configuracoes/exportar-contabil",
    "/configuracoes/modelos-plano-contas",
    "/ajuda",
  ];
  useEffect(() => {
    if (papel !== "contabilidade") return;
    const permitida = ROTAS_CONTABIL.some(
      (h) => pathname === h || pathname.startsWith(h + "/")
    );
    if (!permitida) router.replace("/configuracoes/exportar-contabil");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, papel, router]);

  // Bloqueio de tela: se a pessoa abrir uma rota proibida pela URL, volta para a Carteira.
  useEffect(() => {
    const bloqueada = menusBloqueados.some(
      (h) => h && (pathname === h || pathname.startsWith(h + "/"))
    );
    if (bloqueada) router.replace("/carteira");
  }, [pathname, menusBloqueados, router]);

  // navegar fecha a gaveta — senão ela cobre a tela que a pessoa acabou de abrir
  useEffect(() => {
    setGaveta(false);
  }, [pathname]);

  // Esc fecha a gaveta, como qualquer camada sobreposta
  useEffect(() => {
    if (!gaveta) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setGaveta(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [gaveta]);

  function alternar() {
    setColapsado((c) => {
      const novo = !c;
      // lembra a preferência sem ir ao servidor (instantâneo)
      document.cookie = `fx_sidebar=${novo ? "col" : "exp"}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
      return novo;
    });
  }

  return (
    <>
      {/* Botão de recolher o menu: fica na shell bar, mas é renderizado aqui
          (cliente) e posicionado por cima — a Topbar é componente de servidor
          e não pode receber um handler depois de renderizada. */}
      <button
        type="button"
        onClick={() => setGaveta((g) => !g)}
        aria-label={gaveta ? "Fechar menu" : "Abrir menu"}
        aria-expanded={gaveta}
        className="fixed left-3 top-2.5 z-[60] flex h-8 w-8 items-center justify-center rounded-md text-ink-muted transition hover:bg-surface hover:text-ink md:hidden"
      >
        {gaveta ? <X size={18} /> : <Menu size={18} />}
      </button>
      <button
        type="button"
        onClick={alternar}
        title={colapsado ? "Expandir menu" : "Recolher menu"}
        aria-label={colapsado ? "Expandir menu" : "Recolher menu"}
        className="fixed left-3 top-2.5 z-50 hidden h-8 w-8 items-center justify-center rounded-md text-ink-muted transition hover:bg-surface hover:text-ink md:flex"
      >
        {colapsado ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
      </button>

      {/* véu da gaveta: só existe abaixo de md, e fechar tocando fora é o gesto
          que todo mundo tenta primeiro no celular */}
      {gaveta && (
        <div
          onClick={() => setGaveta(false)}
          aria-hidden
          className="fixed inset-0 z-[45] bg-rail/50 backdrop-blur-[1px] md:hidden"
        />
      )}

      <Sidebar
        logoUrl={logoUrl}
        colapsado={colapsado}
        gavetaAberta={gaveta}
        admin={admin}
        papel={papel}
        docsNovos={docsNovos}
        menusBloqueados={menusBloqueados}
        onToggle={alternar}
      />
      {topbar}
      <div className={colapsado ? "transition-all md:pl-[56px]" : "transition-all md:pl-[214px]"}>
        <main className="mx-auto max-w-[1360px] px-4 pb-8 pt-[68px] sm:px-5">{children}</main>
      </div>

      {/* foco preso, foco inicial e foco devolvido em qualquer diálogo aberto */}
      <GuardaDialogo />
    </>
  );
}

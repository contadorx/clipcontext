import type { Metadata } from "next";
import Link from "next/link";
import { ancoraDoSite, baseDoSite, paginaDoSite } from "@/lib/site-links";
import { URL_APP, URL_SITE } from "@/lib/hosts";
import { LogoFX } from "@/components/marca";

/*
  Moldura das páginas públicas.

  Vive sob `/site` no código e sob a raiz no endereço que a pessoa vê — o
  middleware reescreve por hostname. Por isso NENHUM link interno daqui é
  escrito à mão: todos passam por `paginaDoSite`/`ancoraDoSite`, que decidem o
  prefixo pelo host da requisição. No domínio público sai `/termos`, que é o que
  precisa funcionar quando alguém copia e cola da barra do navegador; em
  localhost e no preview sai `/site/termos`, que é o único endereço que existe
  lá. Escrever `href="/termos"` direto funciona em produção e manda o revisor
  para a tela de login em todo o resto.
*/
const APP = URL_APP;

export const metadata: Metadata = {
  metadataBase: new URL(URL_SITE),
  title: {
    default: "FinanceiroX — gestão financeira de verdade, para uma empresa ou para cem",
    template: "%s · FinanceiroX",
  },
  description:
    "Conciliação bancária em lote, contas a pagar e receber, fluxo de caixa, cobrança por boleto, NFS-e e portal do cliente. Uma tela para cada empresa que você administra.",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "FinanceiroX",
    /*
      A imagem vive em `public/` de propósito: arquivos .png ficam fora do
      matcher do middleware, então `/og.png` responde igual nos dois hosts — um
      arquivo em `app/site/opengraph-image` seria reescrito/redirecionado pelo
      split e o robô do WhatsApp receberia a tela de login.
    */
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "FinanceiroX — o financeiro inteiro sob controle" }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og.png"],
  },
  /*
    Canonical da home. As páginas legais definem a sua — sem isso, todas
    herdariam esta e os buscadores tratariam /termos como cópia da home.
  */
  alternates: { canonical: "/" },
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  const base = baseDoSite();

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <Link href={paginaDoSite(base, "/")} aria-label="FinanceiroX — início">
            <LogoFX tamanho={32} />
          </Link>
          {/*
            Âncoras com `/` na frente porque este layout também envolve /termos,
            /privacidade e /seguranca — onde esses ids não existem. Sem a barra,
            clicar em "Preço" dentro dos Termos só mudava a URL para
            `/termos#preco` e a página ficava parada.
          */}
          <nav className="hidden items-center gap-6 text-sm font-semibold text-ink-muted md:flex">
            <a href={ancoraDoSite(base, "o-que-faz")} className="transition hover:text-ink">
              O que faz
            </a>
            <a href={ancoraDoSite(base, "conciliacao")} className="transition hover:text-ink">
              Conciliação
            </a>
            <a href={ancoraDoSite(base, "multiempresa")} className="transition hover:text-ink">
              Multiempresa
            </a>
            <a href={ancoraDoSite(base, "preco")} className="transition hover:text-ink">
              Preço
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <a
              href={`${APP}/login`}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-ink-muted transition hover:text-ink"
            >
              Entrar
            </a>
            <a
              href={`${APP}/login`}
              className="rounded-lg bg-brand px-3.5 py-2 text-sm font-bold text-white transition hover:bg-brand-dark"
            >
              Começar grátis
            </a>
          </div>
        </div>
      </header>

      {children}

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-10">
          <div className="flex flex-wrap items-start justify-between gap-8">
            <div className="max-w-xs">
              <LogoFX tamanho={30} />
              <p className="mt-3 text-sm text-ink-muted">
                Gestão financeira para quem responde pelo caixa — de uma empresa ou de uma carteira inteira.
              </p>
            </div>
            <div className="flex flex-wrap gap-10 text-sm">
              <div>
                <p className="font-bold text-ink">Produto</p>
                <ul className="mt-2 space-y-1.5 text-ink-muted">
                  <li>
                    <a href={ancoraDoSite(base, "o-que-faz")} className="transition hover:text-ink">
                      O que faz
                    </a>
                  </li>
                  <li>
                    <a href={ancoraDoSite(base, "preco")} className="transition hover:text-ink">
                      Preço
                    </a>
                  </li>
                  <li>
                    <a href={`${APP}/login`} className="transition hover:text-ink">
                      Entrar
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <p className="font-bold text-ink">Legal</p>
                <ul className="mt-2 space-y-1.5 text-ink-muted">
                  <li>
                    <Link href={paginaDoSite(base, "/termos")} className="transition hover:text-ink">
                      Termos de uso
                    </Link>
                  </li>
                  <li>
                    <Link href={paginaDoSite(base, "/privacidade")} className="transition hover:text-ink">
                      Privacidade
                    </Link>
                  </li>
                  <li>
                    <Link href={paginaDoSite(base, "/seguranca")} className="transition hover:text-ink">
                      Segurança
                    </Link>
                  </li>
                </ul>
              </div>
              <div>
                <p className="font-bold text-ink">Contato</p>
                <ul className="mt-2 space-y-1.5 text-ink-muted">
                  <li>
                    <a href="mailto:contato@financeirox.com.br" className="transition hover:text-ink">
                      contato@financeirox.com.br
                    </a>
                  </li>
                  <li>
                    <a href="mailto:privacidade@financeirox.com.br" className="transition hover:text-ink">
                      privacidade@financeirox.com.br
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <p className="mt-8 border-t border-line pt-6 text-xs text-ink-soft">
            © {new Date().getFullYear()} FinanceiroX. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}

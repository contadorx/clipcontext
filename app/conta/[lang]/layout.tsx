/* A área do cliente tem a casca do site, mas não o menu do site: quem está aqui
   veio resolver uma coisa (fatura, chamado, assento) e não é hora de oferecer as
   páginas de venda.

   O layout mora dentro de `[lang]` pelo mesmo motivo que o do site: é a única
   forma de o `<html lang>` ser o idioma da página. O endereço público não tem o
   segmento — é `/conta`, `/en/account` e `/es/cuenta`, traduzido como o resto do
   site. Quem faz a ponte é o `rewrites` do next.config. */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { marca } from '@/lib/marca';
import { CAMINHO, HTML_LANG, IDIOMAS_CONTA, ehLang, textos } from '@/lib/conta/textos';

export function generateStaticParams() {
  return IDIOMAS_CONTA.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<'/conta/[lang]'>): Promise<Metadata> {
  const { lang } = await params;
  const t = textos(ehLang(lang) ? lang : 'pt');
  return {
    title: `${t.tituloAba} — ${marca.marca}`,
    // a área do cliente não é conteúdo público; deixá-la fora do índice evita
    // que uma tela de login apareça na busca no lugar da página de preços
    robots: { index: false, follow: false },
    icons: { icon: [{ url: `/favicon.ico?v=${marca.iconV}`, sizes: 'any' }, { url: '/favicon.svg', type: 'image/svg+xml' }] },
  };
}

export default async function LayoutDaConta({ children, params }: LayoutProps<'/conta/[lang]'>) {
  const { lang } = await params;
  if (!ehLang(lang)) notFound();
  const t = textos(lang);
  const daqui = (p: string) => (lang === 'pt' ? p : `/${lang}${p}`);
  return (
    <html lang={HTML_LANG[lang]}>
      <body>
        <link rel="stylesheet" href="/site.css" />
        <header>
          <div className="wrap">
            <a className="brand" href={lang === 'pt' ? '/' : `/${lang}`}>
              <img src="/logo.svg" alt="" />
              <span>{marca.marcaA}<b>{marca.marcaB}</b></span>
            </a>
            <nav>
              <a className="btnTop" href={`/app?lang=${lang}`}>{t.abrirFerramenta}</a>
              <span style={{ display: 'inline-flex', gap: 9, borderLeft: '1px solid var(--line)', paddingLeft: 16 }}>
                {IDIOMAS_CONTA.map((L) => (
                  <a key={L} href={CAMINHO[L]}
                     style={L === lang ? { color: 'var(--ink)', fontWeight: 600 } : undefined}>
                    {L.toUpperCase()}
                  </a>
                ))}
              </span>
            </nav>
          </div>
        </header>
        {children}
        <footer>
          <div className="wrap">
            <div>
              <a href={`/app?lang=${lang}`}>{t.abrirFerramenta}</a>
              <a href={daqui('/precos')}>{t.planoTitulo}</a>
              <a href={daqui('/privacidade')}>{marca.marca}</a>
            </div>
            <div>{marca.empresa} · CNPJ {marca.cnpj}</div>
          </div>
        </footer>
      </body>
    </html>
  );
}

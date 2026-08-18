/* Um post.
 *
 * O `hreflang` sai dos idiomas que o post REALMENTE tem, e não da lista de
 * idiomas do site. Anunciar uma versão alemã que não existe manda o buscador
 * para um 404 do próprio site — e este projeto já perdeu o alemão e o francês
 * exatamente por uma lista escrita à mão ao lado de uma lista de verdade.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { IDIOMAS, type Lang, marca } from '@/lib/site';
import { post, paraHtml, minutos, type Post } from '@/lib/blog';
import { BLOG_TXT, enderecoBlog, dataDe } from '../txt';
import Partilhar from '../Partilhar';

export const dynamic = 'force-dynamic';

const ehPost = (p: unknown): p is Post =>
  Boolean(p && typeof p === 'object' && (p as Post).titulo);

async function ler(lang: string, slug: string) {
  if (!IDIOMAS.includes(lang as Lang)) return null;
  try {
    const p = await post(lang as Lang, decodeURIComponent(slug));
    return ehPost(p) ? p : null;
  } catch { return null; }
}

export async function generateMetadata({ params }: PageProps<'/[lang]/blog/[slug]'>): Promise<Metadata> {
  const { lang, slug } = await params;
  const p = await ler(lang, slug);
  if (!p) return { title: marca.marca };
  const L = lang as Lang;
  const url = `${marca.site}${enderecoBlog(L)}/${p.slug}`;
  return {
    title: `${p.titulo} — ${marca.marca}`,
    description: p.resumo,
    alternates: {
      canonical: url,
      languages: Object.fromEntries(
        Object.entries(p.idiomas || {}).map(([L2, s]) => [L2, `${marca.site}${enderecoBlog(L2 as Lang)}/${s}`])),
    },
    openGraph: {
      type: 'article', title: p.titulo, description: p.resumo, url,
      siteName: marca.marca, locale: L, publishedTime: p.publicado_em,
      /* A capa do post, quando existe, no lugar da imagem generica do site.
         Compartilhar cinco posts com a mesma figura e quase o mesmo que
         compartilhar sem figura: a linha do tempo deixa de distinguir um do
         outro. */
      images: [p.capa
        ? { url: p.capa }
        : { url: `${marca.site}/og/og.${L}.png`, width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image', title: p.titulo, description: p.resumo,
               images: [p.capa || `${marca.site}/og/og.${L}.png`] },
  };
}

export default async function Publicacao({ params }: PageProps<'/[lang]/blog/[slug]'>) {
  const { lang, slug } = await params;
  const p = await ler(lang, slug);
  if (!p) notFound();
  const L = lang as Lang;
  const b = BLOG_TXT[L] || BLOG_TXT.pt;
  const url = `${marca.site}${enderecoBlog(L)}/${p.slug}`;
  const outros = Object.entries(p.idiomas || {}).filter(([L2]) => L2 !== L);

  return (
    <section style={{ paddingTop: 40 }}>
      <div className="wrap" style={{ maxWidth: 760 }}>
        <p className="small"><a href={enderecoBlog(L)}>← {b.voltar}</a></p>
        <article className="post">
          <h1>{p.titulo}</h1>
          <p className="small muted">
            <time dateTime={p.publicado_em}>{dataDe(L, p.publicado_em)}</time>
            {p.autor ? ` · ${p.autor}` : ''}
            {' · '}{minutos(p.corpo)} {b.minutos}
          </p>
          {p.resumo && <p className="lead">{p.resumo}</p>}
          {p.capa && <img className="postCapa" src={p.capa} alt="" />}
          {/* O HTML aqui foi montado pelo `paraHtml`, que escapa TUDO antes de
              aplicar as marcas permitidas. É o único ponto do site que injeta
              HTML vindo do banco, e é por isso que a conversão mora numa função
              só, com a ordem escrita no comentário dela. */}
          <div className="postCorpo" dangerouslySetInnerHTML={{ __html: paraHtml(p.corpo) }} />
        </article>

        <Partilhar lang={L} url={url} titulo={p.titulo} />

        {outros.length > 0 && (
          <p className="small muted" style={{ marginTop: 20 }}>
            {outros.map(([L2, s]) => (
              <a key={L2} href={`${enderecoBlog(L2 as Lang)}/${s}`} style={{ marginRight: 14 }}>
                {L2.toUpperCase()}
              </a>
            ))}
          </p>
        )}
      </div>
    </section>
  );
}

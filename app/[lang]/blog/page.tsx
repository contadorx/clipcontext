/* O índice do blog.
 *
 * Ele lista o que existe NAQUELE idioma, e não tudo traduzido pela metade: um
 * índice em alemão com títulos em português é pior do que um índice curto — diz
 * à pessoa que ela está no lugar errado.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { IDIOMAS, type Lang, marca, tokens } from '@/lib/site';
import { lista, type Resumo } from '@/lib/blog';
import { BLOG_TXT, enderecoBlog, dataDe } from './txt';

export const dynamic = 'force-dynamic';
export const dynamicParams = false;

export function generateStaticParams() {
  return IDIOMAS.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: PageProps<'/[lang]/blog'>): Promise<Metadata> {
  const { lang } = await params;
  const b = BLOG_TXT[lang as Lang] || BLOG_TXT.pt;
  return {
    title: `${b.titulo} — ${marca.marca}`,
    description: b.lead,
    alternates: {
      canonical: marca.site + enderecoBlog(lang as Lang),
      languages: Object.fromEntries(IDIOMAS.map((L) => [L, marca.site + enderecoBlog(L)])),
    },
  };
}

export default async function Indice({ params }: PageProps<'/[lang]/blog'>) {
  const { lang } = await params;
  if (!IDIOMAS.includes(lang as Lang)) notFound();
  const L = lang as Lang;
  const b = BLOG_TXT[L] || BLOG_TXT.pt;

  let posts: Resumo[] = [];
  let erro = '';
  try {
    const r = await lista(L);
    posts = Array.isArray(r) ? r : [];
    if (!Array.isArray(r)) erro = 'resposta fora de formato';
  } catch (e) { erro = String(e).slice(0, 160); }

  return (
    <section style={{ paddingTop: 40 }}>
      {/* Sem largura própria: a `.wrap` do site já tem uma, e uma segunda
          aqui desalinhava o título do índice em relação ao logotipo do
          cabeçalho — 28 px de desencontro que se veem de longe. */}
      <div className="wrap">
        <h1>{b.titulo}</h1>
        <p className="lead">{b.lead}</p>

        {erro && <p className="aviso err">{b.erro}</p>}
        {!erro && posts.length === 0 && <p className="small muted">{b.vazio}</p>}

        <ul className="postList">
          {posts.map((p) => (
            <li key={p.chave}>
              <a href={`${enderecoBlog(L)}/${p.slug}`}>
                <h2>{p.titulo}</h2>
                <p>{p.resumo}</p>
              </a>
              <p className="small muted">
                <time dateTime={p.publicado_em}>{dataDe(L, p.publicado_em)}</time>
                {p.autor ? ` · ${p.autor}` : ''}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

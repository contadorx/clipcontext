/* O BLOG — leitura, gestão e o desenho do texto.
 *
 * ---- por que o corpo é markdown e não HTML ----
 *
 * O texto sai do banco e vira HTML numa página. Se o que estivesse guardado
 * fosse HTML, qualquer coisa escrita no editor viraria marcação executada — e o
 * editor é um formulário. Bastaria um `<script>` colado num post para ele rodar
 * na página de todo visitante, com o domínio do produto na barra.
 *
 * Então o corpo é markdown, e a conversão daqui faz UMA coisa antes de qualquer
 * outra: escapa tudo. Só depois aplica o subconjunto de marcas que a lista
 * abaixo permite. Não existe caminho pelo qual um `<` do texto original chegue
 * ao navegador como abertura de etiqueta — e é por isso que a ordem importa
 * mais que a lista.
 */
import 'server-only';
import { rpc } from '@/lib/supabase/servico';

export type Lang = 'pt' | 'en' | 'es' | 'de' | 'fr';

export type Figura = { caminho: string; url: string; alt: string };

export type Resumo = {
  chave: string; slug: string; titulo: string; resumo: string;
  autor: string | null; tags: string[]; publicado_em: string;
  /** a figura que vai na lista e na prévia de quem compartilha */
  capa: string | null;
};
export type Post = Resumo & {
  corpo: string; atualizado_em: string;
  /** os idiomas em que este post existe, e o endereço dele em cada um — é daqui
   *  que sai o `hreflang`. Anunciar uma versão alemã que não existe manda o
   *  buscador para um 404 do próprio site. */
  idiomas: Record<string, string>;
};
export type Versao = { slug: string; titulo: string; resumo: string; corpo: string };
export type PostAdmin = {
  chave: string; autor: string | null; tags: string[]; capa: string | null;
  publicado_em: string | null; criado_em: string; atualizado_em: string;
  versoes: Partial<Record<Lang, Versao>>;
  figuras: Figura[];
};

export const lista = (lang: Lang) => rpc<Resumo[]>('walkstamp_blog_lista', { p_lang: lang });
export const post = (lang: Lang, slug: string) =>
  rpc<Post | Record<string, never>>('walkstamp_blog_post', { p_lang: lang, p_slug: slug });
export const todos = () => rpc<PostAdmin[]>('walkstamp_blog_todos', {});
export const salvar = (chave: string, autor: string, tags: string[], versoes: unknown) =>
  rpc<{ ok?: boolean; erro?: string }>('walkstamp_blog_salvar',
    { p_chave: chave, p_autor: autor, p_tags: tags, p_versoes: versoes });
export const publicar = (chave: string, pub: boolean) =>
  rpc<{ ok?: boolean; erro?: string; idiomas?: string[] }>('walkstamp_blog_publicar',
    { p_chave: chave, p_publicar: pub });
export const apagar = (chave: string) =>
  rpc<{ ok?: boolean }>('walkstamp_blog_apagar', { p_chave: chave });
export const figuraAdd = (chave: string, caminho: string, url: string, alt: string) =>
  rpc<{ ok?: boolean; erro?: string }>('walkstamp_blog_figura_add',
    { p_chave: chave, p_caminho: caminho, p_url: url, p_alt: alt });
export const figuraDel = (chave: string, caminho: string) =>
  rpc<{ ok?: boolean; erro?: string }>('walkstamp_blog_figura_del',
    { p_chave: chave, p_caminho: caminho });
export const definirCapa = (chave: string, url: string) =>
  rpc<{ ok?: boolean }>('walkstamp_blog_capa', { p_chave: chave, p_url: url });

/* ------------------------------------------------------- markdown → html */

const esc = (s: string) => s
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Só http(s) e endereços do próprio site. `javascript:` num link é a mesma
 *  execução que o escape acima evitou — fechar uma porta e deixar a outra
 *  aberta não fecha nada. */
const linkSeguro = (u: string) => (/^(https?:\/\/|\/|mailto:|#)/i.test(u.trim()) ? u.trim() : '#');

/** As marcas de dentro da linha, aplicadas ao texto JÁ escapado. */
function linha(txt: string): string {
  let s = esc(txt);
  s = s.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g,
    (_, alt, u) => `<img src="${linkSeguro(u)}" alt="${alt}" loading="lazy">`);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, txt2, u) => {
    const href = linkSeguro(u);
    const fora = /^https?:\/\//i.test(href);
    return `<a href="${href}"${fora ? ' target="_blank" rel="noopener noreferrer"' : ''}>${txt2}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[\s(])_([^_]+)_(?=[\s.,;:!?)]|$)/g, '$1<em>$2</em>');
  return s;
}

/** O corpo inteiro. Blocos separados por linha em branco. */
export function paraHtml(md: string): string {
  const blocos = String(md || '').replace(/\r\n?/g, '\n').split(/\n{2,}/);
  const saida: string[] = [];
  for (const bruto of blocos) {
    const b = bruto.trim();
    if (!b) continue;

    const h = b.match(/^(#{2,4})\s+(.*)$/s);
    if (h && !h[2].includes('\n')) {
      const n = h[1].length;   // `#` sozinho não: o `h1` da página é o título do post
      saida.push(`<h${n}>${linha(h[2])}</h${n}>`);
      continue;
    }
    if (/^```/.test(b)) {
      const dentro = b.replace(/^```[^\n]*\n?/, '').replace(/```$/, '');
      saida.push(`<pre><code>${esc(dentro.replace(/\n$/, ''))}</code></pre>`);
      continue;
    }
    if (/^>\s?/.test(b)) {
      saida.push(`<blockquote><p>${linha(b.split('\n').map((l) => l.replace(/^>\s?/, '')).join(' '))}</p></blockquote>`);
      continue;
    }
    if (/^([-*]|\d+\.)\s/.test(b)) {
      const ord = /^\d+\.\s/.test(b);
      const itens = b.split('\n')
        .filter((l) => l.trim())
        .map((l) => `<li>${linha(l.replace(/^\s*([-*]|\d+\.)\s+/, ''))}</li>`).join('');
      saida.push(ord ? `<ol>${itens}</ol>` : `<ul>${itens}</ul>`);
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(b)) { saida.push('<hr>'); continue; }
    /* Quebra simples dentro do parágrafo vira `<br>`: quem escreve num campo de
       texto usa Enter para separar linha, e transformar isso em espaço faz o
       texto sair diferente do que a pessoa viu ao escrever. */
    saida.push(`<p>${linha(b).split('\n').join('<br>')}</p>`);
  }
  return saida.join('\n');
}

/** Quantos minutos de leitura. 200 palavras por minuto é a medida usual. */
export const minutos = (md: string) =>
  Math.max(1, Math.round(String(md || '').trim().split(/\s+/).filter(Boolean).length / 200));

/** Um título vira um endereço. Acento sai, espaço vira hífen, o resto cai. */
export const paraSlug = (s: string) =>
  String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

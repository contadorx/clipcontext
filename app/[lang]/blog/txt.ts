/* Os textos e o endereço do blog, num lugar só.
 *
 * `blog` é a mesma palavra nos cinco idiomas — e por isso NÃO entra na tabela de
 * slugs traduzidos do `rotas.json`, que existe para os casos em que a palavra
 * muda. Uma entrada que traduz "blog" para "blog" cinco vezes é ruído numa
 * tabela cujo valor é justamente chamar atenção para o que muda. */
import type { Lang } from '@/lib/site';

export const enderecoBlog = (lang: Lang) => (lang === 'pt' ? '/blog' : `/${lang}/blog`);

const LOCALE: Record<Lang, string> = { pt: 'pt-BR', en: 'en-US', es: 'es-ES', de: 'de-DE', fr: 'fr-FR' };
export const dataDe = (lang: Lang, iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(LOCALE[lang] || 'pt-BR',
    { day: '2-digit', month: 'long', year: 'numeric' }).format(d);
};

export const BLOG_TXT: Record<Lang, Record<string, string>> = {
  pt: { titulo: 'Blog', lead: 'Notas sobre evidência de teste, documentação de processo e o que a gente aprende construindo o Walkstamp.',
        vazio: 'Ainda não há publicações neste idioma.', erro: 'Não deu para ler as publicações agora.',
        voltar: 'Todas as publicações', minutos: 'min de leitura', atualizado: 'atualizado em' },
  en: { titulo: 'Blog', lead: 'Notes on test evidence, process documentation, and what we learn while building Walkstamp.',
        vazio: 'No posts in this language yet.', erro: 'Could not read the posts right now.',
        voltar: 'All posts', minutos: 'min read', atualizado: 'updated on' },
  es: { titulo: 'Blog', lead: 'Notas sobre evidencia de prueba, documentación de proceso y lo que aprendemos construyendo Walkstamp.',
        vazio: 'Todavía no hay publicaciones en este idioma.', erro: 'No se pudieron leer las publicaciones ahora.',
        voltar: 'Todas las publicaciones', minutos: 'min de lectura', atualizado: 'actualizado el' },
  de: { titulo: 'Blog', lead: 'Notizen zu Testnachweisen, Prozessdokumentation und dem, was wir beim Bau von Walkstamp lernen.',
        vazio: 'Noch keine Beiträge in dieser Sprache.', erro: 'Die Beiträge konnten gerade nicht gelesen werden.',
        voltar: 'Alle Beiträge', minutos: 'Min. Lesezeit', atualizado: 'aktualisiert am' },
  fr: { titulo: 'Blog', lead: 'Notes sur la preuve de test, la documentation de processus et ce que nous apprenons en construisant Walkstamp.',
        vazio: 'Pas encore de publications dans cette langue.', erro: 'Impossible de lire les publications pour le moment.',
        voltar: 'Toutes les publications', minutos: 'min de lecture', atualizado: 'mis à jour le' },
};

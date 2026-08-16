/* O site, em dados.
 *
 * Nada aqui é decidido aqui. A identidade vem de `src/marca.json` e o mapa de
 * endereços de `src/rotas.json` — os dois escritos pelo `build.py`, que continua
 * sendo o dono do nome da marca, do domínio e do slug de cada página. Este
 * arquivo só sabe ler e montar.
 *
 * O texto continua onde sempre esteve: `src/i18n-site.json` para as frases e
 * `src/site/bodies/<pagina>.<idioma>.html` para o corpo. A migração para o Next
 * não copiou uma linha de conteúdo — trocou apenas quem monta a casca em volta.
 */
import fs from 'node:fs';
import path from 'node:path';

/* Tudo o que se lê daqui mora em `src/`, e o caminho é montado com esse prefixo
   fixo de propósito: sem ele o empacotador não consegue saber o que precisa
   levar junto e acaba arrastando o projeto inteiro — inclusive a `public/`, que
   tem a ferramenta de 600 KB dentro — para dentro do código do servidor. */
const ler = (p: string) => fs.readFileSync(path.join(process.cwd(), 'src', p), 'utf8');

export type Lang = 'pt' | 'en' | 'es';
export type Dicionario = Record<string, string>;

/* A identidade mora em `lib/marca.ts`, que não toca disco — ela é importada
   pelo middleware, que roda no Edge. Reexportada aqui para quem já a pedia
   deste módulo continuar pedindo do mesmo lugar. */
export { marca } from '@/lib/marca';
import { marca } from '@/lib/marca';

const rotas: {
  idiomas: Lang[];
  slugs: Record<string, Record<Lang, string>>;
  metas: Record<string, Record<Lang, { titulo: string; desc: string }>>;
  scripts: { detectarIdioma: string; lembrarIdioma: string };
} = JSON.parse(ler('rotas.json'));

export const SCRIPTS = rotas.scripts;

const dic: Record<Lang, Dicionario> = JSON.parse(ler('i18n-site.json'));

export const IDIOMAS = rotas.idiomas;
export const SLUGS = rotas.slugs;
export const METAS = rotas.metas;
/** Os nomes das páginas internas — `precos`, `seguranca`, `casoEv`… */
export const PAGINAS = Object.keys(rotas.slugs);

const PREFIXO: Record<Lang, string> = { pt: '', en: '/en', es: '/es' };

/** O endereço público de uma página, no idioma dela. `home` é `/`, `/en`, `/es`. */
export function endereco(pagina: string, lang: Lang): string {
  if (pagina === 'home') return PREFIXO[lang] || '/';
  return PREFIXO[lang] + '/' + SLUGS[pagina][lang];
}

/** Todos os endereços que um template pode citar, no idioma pedido. */
export function caminhos(lang: Lang): Dicionario {
  const c: Dicionario = {
    home: endereco('home', lang),
    root: '/',
    // o ?lang vai junto: quem escolheu o idioma do site escolheu o da ferramenta.
    // Sem ele, um navegador em inglês abria o app em inglês mesmo vindo da
    // página em português — e a pessoa achava que era defeito.
    app: '/app?lang=' + lang,
    // a área do cliente tem endereço traduzido como o resto do site: quem lê em
    // espanhol não deveria ter que reconhecer a palavra "conta" para achar a
    // própria fatura
    conta: { pt: '/conta', en: '/en/account', es: '/es/cuenta' }[lang],
  };
  for (const pg of PAGINAS) c[pg] = endereco(pg, lang);
  return c;
}

/** Os valores fixos que toda página recebe. */
export function tokens(lang: Lang): Dicionario {
  return {
    ...dic[lang],
    ...caminhos(lang),
    site: marca.site,
    marca: marca.marca,
    marcaA: marca.marcaA,
    marcaB: marca.marcaB,
    ICONV: marca.iconV,
    supaUrl: marca.supaUrl,
    supaKey: marca.supaKey,
    empresa: marca.empresa,
    cnpj: marca.cnpj,
    contato: marca.contato,
    lang,
  };
}

/** Troca `{{chave}}` pelo valor. É o mesmo contrato que o build.py usava. */
export function trocar(texto: string, t: Dicionario): string {
  let s = texto;
  for (const [k, v] of Object.entries(t)) s = s.split('{{' + k + '}}').join(v);
  return s;
}

/** O seletor de idioma: as três siglas, cada uma apontando para a MESMA página
 *  no outro idioma. O `?lang=` vai em todas — é o sinal explícito que a home
 *  registra para não mandar a pessoa de volta pelo idioma do sistema depois. */
function seletor(lang: Lang, pagina: string): string {
  const itens = IDIOMAS.map((L) => {
    const destino = endereco(pagina, L);
    const href = destino + (destino.includes('?') ? '&' : '?') + 'lang=' + L;
    const atual = L === lang ? ' style="color:var(--ink);font-weight:600"' : '';
    return `<a href="${href}"${atual}>${L.toUpperCase()}</a>`;
  });
  return '<span style="display:inline-flex;gap:9px;border-left:1px solid var(--line);' +
    'padding-left:16px">' + itens.join('') + '</span>';
}

/* ------------------------------------------------ a tabela de funcionalidades */

type Feature = { planos: string; breve?: boolean } & Record<string, unknown>;
type Grupo = { id: string; titulo: Record<Lang, string>; itens: Feature[] };

const features: { grupos: Grupo[] } = JSON.parse(ler('features.json'));

const PLANOS = [
  { nome: 'Free', letra: 'f' },
  { nome: 'Personal', letra: 'p' },
  { nome: 'Team', letra: 't' },
] as const;

const escapar = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A lista completa do que existe, com um visto por plano.
 *
 *  Ela é MONTADA e não escrita à mão porque são ~65 linhas em três idiomas: à
 *  mão, seriam 195 chances de a versão em espanhol prometer uma coisa que a em
 *  português não promete. O dado mora em `src/features.json`, e a regra escrita
 *  lá no topo é a que importa — só entra o que existe.
 */
export function tabelaDePlanos(lang: Lang, t: Dicionario): string {
  const linhas: string[] = [];
  for (const g of features.grupos) {
    linhas.push(`<tr class="grp"><th colspan="4" scope="colgroup">${escapar(g.titulo[lang])}</th></tr>`);
    for (const item of g.itens) {
      const rotulo = escapar(String(item[lang] ?? ''));
      const marca_ = item.breve ? `${rotulo} <span class="soon">${escapar(t.tpBreve)}</span>` : rotulo;
      const celulas = PLANOS.map(({ letra, nome }) => {
        const tem = item.planos.includes(letra);
        /* O visto é decoração; o que o leitor de tela lê é a palavra. Uma tabela
           de 65 linhas cheia de "✓" sem alternativa é ilegível para quem não vê. */
        return tem
          ? `<td class="sim"><span aria-hidden="true">✓</span><span class="soLeitor">${escapar(t.tpSim)} ${nome}</span></td>`
          : `<td class="nao"><span aria-hidden="true">—</span><span class="soLeitor">${escapar(t.tpNao)} ${nome}</span></td>`;
      }).join('');
      linhas.push(`<tr><th scope="row">${marca_}</th>${celulas}</tr>`);
    }
  }
  return '<div class="tabRolar">' +
    `<table class="tabPlanos"><caption class="soLeitor">${escapar(t.tpLegenda)}</caption>` +
    '<thead><tr><th scope="col"></th>' +
    PLANOS.map((p) => `<th scope="col">${p.nome}</th>`).join('') +
    '</tr></thead><tbody>' + linhas.join('') + '</tbody></table></div>';
}

/** Quantas funcionalidades a lista declara. Sai no texto acima da tabela: um
 *  número contado é diferente de um número redondo escrito à mão, que envelhece
 *  na primeira vez que alguém mexe na lista e esquece do parágrafo. */
export const quantasFeatures = features.grupos.reduce((n, g) => n + g.itens.length, 0);

/** Tudo o que fica DENTRO do `<body>` de uma página: cabeçalho, corpo e rodapé.
 *
 *  O HTML sai dos mesmos `src/site/home.html` e `src/site/doc.html` que o
 *  gerador em Python usava, com os mesmos `{{tokens}}`. Isso é deliberado:
 *  retranscrever 45 páginas para JSX seria trocar um sistema que funciona por
 *  uma tarde de erros de digitação. O React aqui é a casca — `<html>`, `<head>`
 *  e as tags de script; o conteúdo continua sendo conteúdo.
 */
export function paginaHtml(pagina: string, lang: Lang): string {
  const t = tokens(lang);
  t.selfPath = endereco(pagina, lang);
  t.switcher = seletor(lang, pagina);
  // o link do comparativo vai montado aqui: um <a> dentro do JSON de tradução
  // quebraria no dia em que alguém trocasse o caminho da página
  t.duoCompLinked = (t.duoComp || '')
    .replace('{0}', `<a href="${t.comparativo}" style="color:var(--accent)">`)
    .replace('{1}', '</a>');
  // a tabela só é montada onde é usada; nas outras páginas o token vira vazio
  t.tabelaPlanos = pagina === 'precos' ? tabelaDePlanos(lang, t) : '';
  t.quantasFeatures = String(quantasFeatures);

  let bruto: string;
  if (pagina === 'home') {
    // o `{{redirect}}` mora no <head> do template e é o React que o escreve
    // agora; aqui ele some para não sobrar token.
    t.redirect = '';
    t.analytics = '';
    t.title = t.title || '';
    bruto = ler('site/home.html');
  } else {
    const m = METAS[pagina]?.[lang];
    if (!m) throw new Error(`página sem título: ${pagina}.${lang}`);
    t.docTitle = m.titulo;
    t.docDesc = m.desc;
    t.ptPath = endereco(pagina, 'pt');
    t.enPath = endereco(pagina, 'en');
    t.esPath = endereco(pagina, 'es');
    t.analytics = '';
    t.body = trocar(ler(`site/bodies/${pagina}.${lang}.html`), t);
    bruto = ler('site/doc.html');
  }

  const inteiro = trocar(bruto, t);
  const sobrando = [...new Set([...inteiro.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))];
  if (sobrando.length) {
    // Em produção isto viraria `{{chave}}` na cara do visitante. Melhor derrubar
    // o build: é o mesmo aviso que o gerador antigo dava, com mais dentes.
    throw new Error(`chaves sem valor em ${pagina}.${lang}: ${sobrando.join(', ')}`);
  }

  const abre = inteiro.indexOf('>', inteiro.indexOf('<body')) + 1;
  const fecha = inteiro.lastIndexOf('</body>');
  if (abre <= 0 || fecha < 0) throw new Error(`sem <body> em ${pagina}`);
  return inteiro
    .slice(abre, fecha)
    // o support.js e o seletor de idioma já são responsabilidade do layout
    .replace(/<script src="\/?support\.js"><\/script>/, '')
    .trim();
}

/** Os hreflang de uma página. O `x-default` só na home, como no site antigo:
 *  ele diz para onde mandar quem não casa com nenhum idioma, e quem chega numa
 *  página interna chegou por link, não por sorteio. */
export function alternativas(pagina: string, comDefault = false): Record<string, string> {
  const alt: Record<string, string> = {
    'pt-BR': marca.site + endereco(pagina, 'pt'),
    en: marca.site + endereco(pagina, 'en'),
    es: marca.site + endereco(pagina, 'es'),
  };
  if (comDefault) alt['x-default'] = marca.site + endereco(pagina, 'en');
  return alt;
}

/** De volta do endereço para o nome da página: `/en/security` → `seguranca`. */
export function porSlug(slug: string, lang: Lang): string | null {
  return PAGINAS.find((pg) => SLUGS[pg][lang] === slug) ?? null;
}

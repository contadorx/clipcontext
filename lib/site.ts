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
import FIGURAS from '@/src/figuras.json';
import path from 'node:path';

/* Tudo o que se lê daqui mora em `src/`, e o caminho é montado com esse prefixo
   fixo de propósito: sem ele o empacotador não consegue saber o que precisa
   levar junto e acaba arrastando o projeto inteiro — inclusive a `public/`, que
   tem a ferramenta de 600 KB dentro — para dentro do código do servidor. */
const ler = (p: string) => fs.readFileSync(path.join(process.cwd(), 'src', p), 'utf8');

/* CINCO, e não três.
 *
 * Esta união dizia `'pt' | 'en' | 'es'` desde a época em que o site falava três
 * idiomas. O site passou a falar cinco — o `rotas.json` lista os cinco, o
 * `build.py` gera as cinco páginas, o alemão e o francês estão no ar — e este
 * tipo continuou em três. Ele não quebrou nada porque todo mundo lia os idiomas
 * do `rotas.json` em tempo de execução; ele quebrou na primeira vez que alguém
 * escreveu uma tabela nova com as cinco chaves, e o compilador recusou `de`.
 *
 * A trava logo abaixo é o que impede o mesmo esquecimento de novo: se o
 * `rotas.json` ganhar um sexto idioma sem que esta linha ganhe também, o build
 * quebra aqui, e não numa página em alemão que ninguém abre. */
export type Lang = 'pt' | 'en' | 'es' | 'de' | 'fr';

/** O locale de cada idioma, para datas e números (`Intl`). Morava no
 *  `lib/conta/textos.ts`; a conta saiu no Build 71 e o blog continua usando. */
export const LOCALE: Record<Lang, string> = {
  pt: 'pt-BR', en: 'en-US', es: 'es-ES', de: 'de-DE', fr: 'fr-FR',
};
export type Dicionario = Record<string, string>;

/* A identidade mora em `lib/marca.ts`, que não toca disco. Reexportada aqui
   para quem já a pedia deste módulo continuar pedindo do mesmo lugar. */
export { marca } from '@/lib/marca';
import { marca } from '@/lib/marca';

const rotas: {
  idiomas: Lang[];
  /* Quais idiomas têm vídeo do tour. Escrito pelo `build.py`, que olha o disco —
     ver o comentário no ponto de uso, mais abaixo. */
  demoLangs?: string[];
  slugs: Record<string, Record<Lang, string>>;
  metas: Record<string, Record<Lang, { titulo: string; desc: string }>>;
  scripts: { detectarIdioma: string; lembrarIdioma: string };
} = JSON.parse(ler('rotas.json'));

export const SCRIPTS = rotas.scripts;

const dic: Record<Lang, Dicionario> = JSON.parse(ler('i18n-site.json'));

export const IDIOMAS = rotas.idiomas;
/* A trava: o `rotas.json` e o tipo `Lang` têm que dizer a mesma coisa. Um
   idioma novo no JSON e ausente aqui quebra o build agora, em vez de virar um
   `undefined` numa tabela meses depois. */
{
  const previstos: Lang[] = ['pt', 'en', 'es', 'de', 'fr'];
  const sobrando = IDIOMAS.filter((L) => !previstos.includes(L));
  const faltando = previstos.filter((L) => !IDIOMAS.includes(L));
  if (sobrando.length || faltando.length) {
    throw new Error(
      'lib/site.ts: o tipo Lang e o rotas.json divergem' +
      (sobrando.length ? ` — no JSON e não no tipo: ${sobrando.join(', ')}` : '') +
      (faltando.length ? ` — no tipo e não no JSON: ${faltando.join(', ')}` : ''),
    );
  }
}
export const SLUGS = rotas.slugs;
export const METAS = rotas.metas;
/** Os nomes das páginas internas — `comparativo`, `seguranca`, `casoEv`… */
export const PAGINAS = Object.keys(rotas.slugs);

/* O prefixo de cada idioma. Era uma tabela escrita à mão, e cada idioma novo
   exigia lembrar dela — que é a definição de lugar onde se esquece. Agora sai
   de `IDIOMAS`, que vem do `build.py`: o português é a raiz, o resto é a sigla. */
const PREFIXO: Record<Lang, string> =
  Object.fromEntries(IDIOMAS.map((l) => [l, l === 'pt' ? '' : '/' + l])) as Record<Lang, string>;

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
    /* `blog` é a mesma palavra nos cinco idiomas, então ele não entra na tabela
       de slugs traduzidos — ela existe para os casos em que a palavra muda. */
    blog: lang === 'pt' ? '/blog' : `/${lang}/blog`,
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
    empresa: marca.empresa,
    cnpj: marca.cnpj,
    contato: marca.contato,
    encarregado: marca.encarregado,
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
    'padding-left:12px">' + itens.join('') + '</span>';
}

/* ------------------------------------------------- a matriz de egressão */

type Destino = {
  id: string; hosts: string[]; quando: 'sozinho' | 'gesto';
  onde: string[]; conteudo: boolean;
} & Record<string, { quem: string; leva: string; gesto: string; nunca: string } | unknown>;

const egressao: { destinos: Destino[] } = JSON.parse(ler('egressao.json'));

/** A tabela que acompanha a frase. Duas colunas de verdade: QUANDO sai, e O QUE
 *  vai junto — e a linha que leva conteúdo é marcada, porque é dela que a
 *  promessa fala. Ordenada com as automáticas primeiro: quem lê quer saber o
 *  que acontece sem ele fazer nada, e depois o que depende dele. */
function matrizDeEgressao(lang: Lang, t: Dicionario): string {
  const ordem = [...egressao.destinos].sort((a, b) =>
    (a.quando === b.quando ? 0 : a.quando === 'sozinho' ? -1 : 1));
  const linhas = ordem.map((d) => {
    const txt = d[lang] as { quem: string; leva: string; gesto: string; nunca: string };
    const marca = d.conteudo
      ? ` <b style="color:var(--err)">${escapar(t.egrConteudo || '')}</b>`
      : '';
    /* `leva` e `nunca` entram como HTML de propósito: são o texto da matriz, e
       ele traz <b>, <code> e <i> escritos à mão no `egressao.json` — o escopo
       `drive.file` em `<code>` e o DNT em `<i>` são a diferença entre uma
       tabela que informa e uma que só tranquiliza. `quem` e `gesto` são
       escapados: ali não há marcação nenhuma para preservar. */
    return `<tr><td><b>${escapar(txt.quem)}</b>${marca}</td>` +
           `<td>${escapar(txt.gesto)}</td>` +
           `<td>${txt.leva}</td>` +
           `<td>${txt.nunca}</td></tr>`;
  }).join('\n');
  return `<table class="legal"><thead><tr>` +
    `<th>${escapar(t.egrQuem || '')}</th>` +
    `<th>${escapar(t.egrQuando || '')}</th>` +
    `<th>${escapar(t.egrLeva || '')}</th>` +
    `<th>${escapar(t.egrNunca || '')}</th>` +
    `</tr></thead><tbody>\n${linhas}\n</tbody></table>`;
}

/* ------------------------------------------------ a tabela de funcionalidades */

type Feature = { planos: string; estado?: string } & Record<string, unknown>;
type Grupo = { id: string; titulo: Record<Lang, string>; itens: Feature[] };

const features: { grupos: Grupo[] } = JSON.parse(ler('features.json'));

const escapar = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* A LISTA COMPLETA POR PLANO saiu no Build 71, com a página de preços: o
   produto ficou grátis, e uma lista que marcava o que era "só no Personal" e
   "só no Team" não tem mais o que marcar. O `features.json` continua sendo a
   fonte da tira de formatos, logo abaixo. */

/* ------------------------------------------------- a tira de formatos de saída
 *
 * Ela existia em SEIS cópias escritas à mão — os cinco `precos.*.html` e a
 * `home.html` —, todas com treze selos. O catálogo tem QUINZE saídas, e a
 * ferramenta tem doze botões. Três números para a mesma pergunta.
 *
 * As três que a tira não mostrava são capacidades PRONTAS, vendidas como
 * inexistentes: o documento por tarefa, o pacote em vários idiomas e o prompt
 * para IA. Ninguém decidiu escondê-las — elas nasceram depois da tira, e a tira
 * era um `<div>` que ninguém lembrou de abrir.
 *
 * Nome de formato não se traduz, então o selo é um campo só em `features.json`
 * e não cinco. E TODA saída precisa de um: sem essa trava, acrescentar um
 * formato ao catálogo e esquecer a tira reabre em silêncio o buraco que este
 * bloco veio fechar — que é exatamente como ele durou até aqui.
 */
type Saida = Feature & {
  selo?: string;
  /** Nota literal, para nome de produto: "Word", "PowerPoint". Não se traduz. */
  seloNota?: string;
  /** Nota TRADUZIDA, por chave do dicionário. Só o CSV precisa ("planilha"). */
  seloNotaChave?: string;
  /** A home mostra estes quatro em cima e o resto numa gaveta. */
  destaque?: boolean;
};

function saidasDoCatalogo(): Saida[] {
  const grupo = features.grupos.find((g) => g.id === 'saidas');
  if (!grupo) throw new Error('features.json não tem o grupo `saidas` — a tira sai de lá');
  const itens = grupo.itens as Saida[];
  const semSelo = itens.filter((i) => !i.selo).map((i) => String(i.pt));
  if (semSelo.length) {
    throw new Error(
      'saídas do catálogo sem `selo`, a tira sairia menor que o catálogo:\n  ' +
      semSelo.join('\n  '));
  }
  return itens;
}

function tira(itens: Saida[], t: Dicionario): string {
  return '<div class="saidas">' + itens.map((i) => {
    const nota = i.seloNotaChave ? String(t[i.seloNotaChave] ?? '') : (i.seloNota ?? '');
    return `<span class="saida"><b>${i.selo}</b>${nota ? ' ' + escapar(nota) : ''}</span>`;
  }).join('') + '</div>';
}

/* A HOME MOSTRA QUATRO EM CIMA E O RESTO NUMA GAVETA, e isso é decisão
   editorial, não descuido: quem decide comprar quer saber se a ENTREGA dele
   cabe, e não quantos formatos existem. Quinze selos de uma vez leem-se como
   "conversor de arquivo", que é a categoria errada.
   O que muda é que os quatro passam a ser DECLARADOS no catálogo (`destaque`)
   em vez de escritos à mão na home — e a gaveta é o complemento, calculado.
   Assim um formato novo entra na gaveta sozinho, e a curadoria dos quatro
   continua sendo uma escolha, feita num lugar só. */
const tiraDestaque = (t: Dicionario) => tira(saidasDoCatalogo().filter((i) => i.destaque), t);
const tiraResto = (t: Dicionario) => tira(saidasDoCatalogo().filter((i) => !i.destaque), t);

/** Quantas saídas o catálogo declara. A tira e o texto saem do mesmo número. */
export const quantasSaidas = (features.grupos.find((g) => g.id === 'saidas')?.itens.length) ?? 0;

/** Tudo o que fica DENTRO do `<body>` de uma página: cabeçalho, corpo e rodapé.
 *
 *  O HTML sai dos mesmos `src/site/home.html` e `src/site/doc.html` que o
 *  gerador em Python usava, com os mesmos `{{tokens}}`. Isso é deliberado:
 *  retranscrever 45 páginas para JSX seria trocar um sistema que funciona por
 *  uma tarde de erros de digitação. O React aqui é a casca — `<html>`, `<head>`
 *  e as tags de script; o conteúdo continua sendo conteúdo.
 */
/* ---- OS DADOS ESTRUTURADOS DAS PÁGINAS FIXAS ----
 *
 * Eles não mudam ONDE a página aparece; mudam COMO ela aparece — é o único
 * item desta rodada que mexe na cara do resultado, e não só na posição.
 *
 * Três formatos, um por natureza de página:
 *
 *   `SoftwareApplication` na home — é o que a ferramenta É, e é o que permite
 *     ao resultado mostrar categoria e preço. `price: 0` não é marketing: a
 *     ferramenta no navegador é gratuita, e declarar isso onde o buscador lê é
 *     a mesma frase que a página já diz.
 *
 *   `FAQPage` na base de conhecimento — e ele é LIDO DO CORPO, pergunta por
 *     pergunta. Escrever as perguntas de novo aqui seria a segunda lista ao lado
 *     da lista de verdade, e a divergência seria invisível: a página diria uma
 *     coisa e o buscador leria outra. Pior que isso, marcação de FAQ que não
 *     corresponde ao texto visível é motivo de punição — e com razão.
 *
 *   `BreadcrumbList` nas demais — a trilha que faz o resultado mostrar o
 *     caminho em vez do endereço cru.
 *
 * `Organization` viaja em todas, como publicador: é o que amarra as páginas a
 * uma entidade só em vez de a um punhado de endereços soltos.
 */
function faqDoCorpo(corpo: string): Array<{ q: string; a: string }> {
  const limpo = (h: string) => h
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ').trim();
  const fora: Array<{ q: string; a: string }> = [];
  const re = /<details\b[^>]*>([\s\S]*?)<\/details>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(corpo))) {
    const dentro = m[1];
    const s2 = dentro.match(/<summary\b[^>]*>([\s\S]*?)<\/summary>/i);
    if (!s2) continue;
    const q = limpo(s2[1]);
    const a = limpo(dentro.slice((s2.index || 0) + s2[0].length));
    /* Resposta curta demais não é resposta — e uma entrada de FAQ sem conteúdo
       é exatamente o tipo de marcação vazia que não deve existir. */
    if (q.length > 3 && a.length > 25) fora.push({ q, a });
  }
  return fora;
}

function dadosEstruturados(pagina: string, lang: Lang, t: Dicionario, corpo: string): string {
  const site = marca.site;
  const url = site + endereco(pagina, lang);
  const org = {
    '@type': 'Organization', name: marca.marca, url: site,
    logo: { '@type': 'ImageObject', url: `${site}/logo.svg` },
    legalName: marca.empresa, email: marca.contato,
  };
  const blocos: unknown[] = [];

  if (pagina === 'home') {
    blocos.push({
      '@context': 'https://schema.org', '@type': 'SoftwareApplication',
      name: marca.marca, url: site, inLanguage: lang,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web browser',
      description: String(t.docDesc || t.metaDesc || ''),
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'BRL' },
      publisher: org,
    });
  } else {
    const faq = pagina === 'ajuda' ? faqDoCorpo(corpo) : [];
    if (faq.length) {
      blocos.push({
        '@context': 'https://schema.org', '@type': 'FAQPage', inLanguage: lang,
        mainEntity: faq.map((f) => ({
          '@type': 'Question', name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      });
    }
    blocos.push({
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: marca.marca, item: site + endereco('home', lang) },
        { '@type': 'ListItem', position: 2, name: String(t.docTitle || pagina).split(' — ')[0], item: url },
      ],
    });
  }
  blocos.push({ '@context': 'https://schema.org', ...org });

  return blocos.map((b) =>
    '<script type="application/ld+json">' +
    JSON.stringify(b).replace(/</g, '\\u003c').replace(/>/g, '\\u003e') +
    '</script>').join('\n');
}

export function paginaHtml(pagina: string, lang: Lang): string {
  const t = tokens(lang);
  t.selfPath = endereco(pagina, lang);
  t.switcher = seletor(lang, pagina);
  // o link do comparativo vai montado aqui: um <a> dentro do JSON de tradução
  // quebraria no dia em que alguém trocasse o caminho da página
  t.duoCompLinked = (t.duoComp || '')
    .replace('{0}', `<a href="${t.comparativo}" style="color:var(--accent)">`)
    .replace('{1}', '</a>');
  /* A tira da home. Ela também valia na página de preços, que saiu no
     Build 71. */
  t.tiraDestaque = pagina === 'home' ? tiraDestaque(t) : '';
  t.tiraResto = pagina === 'home' ? tiraResto(t) : '';
  /* A MATRIZ DE EGRESSÃO. Ela é o segundo metade do caminho A da DEC-1: a frase
     "nada do seu conteúdo sai sem um gesto seu" só é defensável se as exceções
     estiverem nomeadas NO MESMO BLOCO — um absoluto que o F12 do navegador
     desmente em dez segundos vale menos que uma exceção declarada.
     Ela é MONTADA do `src/egressao.json`, e não escrita nas páginas: a promessa
     estava em nove chaves do dicionário e numa dúzia de páginas, cada uma com a
     sua redação. Quem confere se esta lista bate com o que o produto realmente
     chama é `testes/egressao.mjs`. */
  t.matrizEgressao = matrizDeEgressao(lang, t);
  t.quantasSaidas = String(quantasSaidas);

  let bruto: string;
  if (pagina === 'home') {
    // o `{{redirect}}` mora no <head> do template e é o React que o escreve
    // agora; aqui ele some para não sobrar token.
    t.redirect = '';
    t.analytics = '';
    t.title = t.title || '';
    /* Onde o tour não existe, cai no inglês: um `<video>` apontando para um
       404 é uma caixa preta vazia no alto da home — pior do que um vídeo em
       outro idioma.

       A lista de quem TEM tour vem do `rotas.json`, montado pelo `build.py`
       olhando o disco. Escrita à mão aqui, ela ficou meses dizendo
       `['pt','en','es']` depois de o vídeo alemão existir — e ninguém viu,
       porque um vídeo em inglês numa página alemã não quebra nada, só
       decepciona. */
    const comTour: string[] = rotas.demoLangs ?? ['en'];
    t.demoLang = comTour.includes(lang) ? lang : 'en';
    t.figuraFluxo = ((FIGURAS as Record<string, string>).fluxo ?? '')
      .replace('__ALT__', String(t.fluxoAlt ?? ''))
      .replace('__LEG__', String(t.fluxoLeg ?? ''));
    /* A figura da dobra principal. Sem legenda: numa dobra a legenda compete
       com a subida do texto e com o botão. Só o rótulo de acessibilidade. */
    t.figuraDobra = ((FIGURAS as Record<string, string>).dobra ?? '')
      .replace('__ALT__', String(t.dobraAlt ?? ''));
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
    /* A figura do documento, nas cinco páginas de caso de uso. Quem desenha é o
       `build.py` — o mesmo lugar que desenha a marca no PDF —, e ela chega aqui
       como dado, pelo `figuras.json`. Duas cópias do mesmo desenho, uma em
       Python e outra em TypeScript, divergiriam na primeira mudança.
       Ela não tem uma palavra dentro: serve aos cinco idiomas sem tradução. */
    t.figura = ((FIGURAS as Record<string, string>)[pagina] ?? '')
      .replace('__ALT__', String(t.figAlt ?? ''))
      .replace('__LEG__', String(t.figLegenda ?? ''));
    t.body = trocar(ler(`site/bodies/${pagina}.${lang}.html`), t);
    /* Antes do `dadosEstruturados`, que lê os `<details>` deste mesmo corpo —
       e o índice não toca em nenhum deles. */
    if (pagina === 'ajuda') t.body = indiceDaAjuda(String(t.body), t);
    bruto = ler('site/doc.html');
  }
  /* Depois do corpo, porque o FAQ é LIDO dele. Antes do `trocar`, porque é ele
     que troca o `{{jsonld}}` pelo bloco. */
  t.jsonld = dadosEstruturados(pagina, lang, t, String(t.body || ''));

  const inteiro = trocar(bruto, t);
  const sobrando = [...new Set([...inteiro.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))];
  if (sobrando.length) {
    // Em produção isto viraria `{{chave}}` na cara do visitante. Melhor derrubar
    // o build: é o mesmo aviso que o gerador antigo dava, com mais dentes.
    throw new Error(`chaves sem valor em ${pagina}.${lang}: ${sobrando.join(', ')}`);
  }

  /* A TAG DE ABERTURA DO CORPO, PROCURADA FORA DOS COMENTÁRIOS.
     Isto era um `indexOf` cru, e um comentário que MENCIONAVA a tag — escrito
     por mim, no build que apagou os cabeçalhos fósseis — casou primeiro. O
     recorte começou dentro do comentário: meia página de prosa em português
     virou texto visível acima do cabeçalho, em toda página do site e nos cinco
     idiomas, e os atributos do corpo de verdade nunca chegaram ao React.
     Não deu erro nenhum. Quem pegou foi uma régua de dobra, medindo que o
     botão tinha saído da primeira tela do telefone — sintoma a três passos da
     causa.
     Os comentários viram espaços do mesmo tamanho, então os índices continuam
     valendo no texto original. */
  const semComentario = inteiro.replace(/<!--[\s\S]*?-->/g, (c) => ' '.repeat(c.length));
  const inicio = semComentario.indexOf('<body');
  if (inicio < 0) throw new Error(`sem tag de corpo em ${pagina}`);
  const abre = semComentario.indexOf('>', inicio) + 1;
  const fecha = inteiro.lastIndexOf('</body>');
  if (abre <= 0 || fecha < 0) throw new Error(`corpo sem fim em ${pagina}`);
  return embrulharTabelas(
    inteiro
      .slice(abre, fecha)
      // o support.js e o seletor de idioma já são responsabilidade do layout
      .replace(/<script src="\/?support\.js"><\/script>/, '')
      .trim(),
  );
}

/* ---- O ÍNDICE E A BUSCA DA BASE DE CONHECIMENTO ------------------------
 *
 * A página tem 45 painéis em nove temas, e não tinha navegação nenhuma: quem
 * chegava caía no topo de três mil palavras e rolava. O Ctrl+F já alcançava
 * tudo — os acordeões passaram a nascer abertos em 23/08 —, mas achar a
 * palavra no meio de uma parede não diz em que tema você está nem o que mais
 * existe.
 *
 * O ÍNDICE É DERIVADO DOS PRÓPRIOS `<h2>`, e não escrito à mão. Escrito à mão
 * seriam cinco listas, uma por idioma, ao lado das cinco listas de verdade —
 * o defeito de sempre desta base de código. Derivado, um tema novo aparece no
 * índice por existir, e um tema renomeado se renomeia sozinho. Se um dia os
 * corpos divergirem no número de temas, é o índice de cada um que muda, e não
 * uma lista central que passa a mentir para quatro idiomas.
 *
 * O CAMPO DE BUSCA NASCE ESCONDIDO e é revelado pelo `support.js`. Sem
 * JavaScript ele não aparece: um campo de busca que não busca é pior do que
 * campo nenhum. Os links do índice são âncoras de HTML puro e funcionam
 * sempre — é essa metade que carrega a promessa.
 *
 * O `tabindex="-1"` nos `<h2>` existe para o salto de âncora levar o FOCO
 * junto, e não só a rolagem: sem ele, quem navega por teclado clica no índice
 * e continua tabulando do topo da página.
 *
 * AS DUAS FRASES DO CONTADOR VIAJAM EM `data-`, e não numa tabela dentro do
 * `support.js`. Ele já tem uma tabela de cinco idiomas dentro (a da ficha), e
 * ela é exatamente a segunda lista ao lado do `i18n-site.json` que este
 * arquivo existe para não ter. Servidas pelo HTML, as frases saem do mesmo
 * dicionário que o resto da página e não há o que sincronizar.
 */
function indiceDaAjuda(corpo: string, t: Dicionario): string {
  const temas: Array<{ id: string; nome: string }> = [];
  const comId = corpo.replace(/<h2>([\s\S]*?)<\/h2>/g, (_todo, dentro: string) => {
    const id = `tema-${temas.length + 1}`;
    temas.push({ id, nome: String(dentro).replace(/<[^>]+>/g, '').trim() });
    return `<h2 id="${id}" tabindex="-1">${dentro}</h2>`;
  });
  /* Nenhum tema quer dizer corpo com outra forma. Devolver o corpo intacto é o
     comportamento certo: um índice vazio seria uma caixa dizendo que a página
     não tem assunto. */
  if (!temas.length) return corpo;

  const escapa = (x: string) =>
    x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
     .replace(/"/g, '&quot;');
  const itens = temas
    .map((x) => `<li><a href="#${x.id}">${escapa(x.nome)}</a></li>`)
    .join('\n        ');

  const bloco = `<nav class="ajNav" aria-labelledby="ajNavTit">
      <p class="ajNavTit" id="ajNavTit">${escapa(String(t.ajIndice || ''))}</p>
      <div class="ajBusca" role="search" hidden>
        <label for="ajQ">${escapa(String(t.ajBuscaLbl || ''))}</label>
        <input id="ajQ" type="search" autocomplete="off" spellcheck="false"
               placeholder="${escapa(String(t.ajBuscaPh || ''))}">
      </div>
      <ol class="ajTemas">
        ${itens}
      </ol>
      <p class="ajConta" role="status" aria-live="polite"
         data-conta="${escapa(String(t.ajConta || ''))}"
         data-nada="${escapa(String(t.ajNada || ''))}"></p>
    </nav>
`;
  /* Entra ANTES do primeiro tema, que é depois da abertura da página — e não
     numa posição contada em caracteres, que a primeira reescrita de parágrafo
     quebraria em silêncio. */
  const onde = comId.indexOf('<h2 id="tema-1"');
  return comId.slice(0, onde) + bloco + '    ' + comId.slice(onde);
}

/* ---- A TABELA ROLA DENTRO DELA, E NÃO A PÁGINA -------------------------
 *
 * Medido a 380px — a largura de um telefone comum — em todas as combinações de
 * página e idioma que o site publica: **19 de 70 rolavam na horizontal**, e em
 * 17 delas o culpado era a mesma coisa, a `table.legal`. As piores eram as
 * páginas legais em alemão: `/de/privacidade` transbordava 464px, quase uma
 * segunda tela inteira para o lado.
 *
 * São justamente as páginas que quem avalia fornecedor abre — e ele abre no
 * telefone, na fila do café, antes de levar ao jurídico.
 *
 * A saída NÃO é encolher a tabela: uma tabela de prazos de retenção com quatro
 * colunas não cabe em 380px sem virar ilegível, e alemão tem palavra composta
 * que não quebra. A saída é a tabela rolar DENTRO da caixa dela, com a página
 * parada — que é o comportamento que todo mundo já espera de tabela larga.
 *
 * E ISTO MORA AQUI, e não nas 85 páginas: envolver a mão significaria 85
 * arquivos onde a próxima tabela nasce sem o embrulho. Aqui, toda tabela que
 * entrar já nasce embrulhada.
 *
 * `tabindex="0"` porque uma caixa que rola precisa ser alcançável pelo teclado:
 * sem ele, quem não usa mouse não tem como ver a coluna da direita. O
 * `role="region"` com nome é o que faz o leitor de tela anunciar que ali há
 * algo navegável.
 */
function embrulharTabelas(corpo: string): string {
  return corpo.replace(
    /<table class="legal"[\s\S]*?<\/table>/g,
    (t) => `<div class="tabRola" tabindex="0" role="region" aria-label="tabela">${rotularCelulas(t)}</div>`,
  );
}

/** O RÓTULO DE CADA CÉLULA, para a tabela poder EMPILHAR no telefone.
 *
 *  O problema, medido a 380px: a maior destas tabelas tem **3452px** — nove
 *  telas para o lado. E o transbordo não é o pior: a PRIMEIRA COLUNA ROLA PARA
 *  FORA, então na quarta coluna a pessoa já não sabe em que linha está. Rolar
 *  de lado resolve o layout e não resolve a leitura.
 *
 *  O comentário do `.tabRola` argumenta, com razão, que a tabela não pode
 *  ENCOLHER — quatro colunas de prazo não cabem em 380px sem virar ilegível, e
 *  o alemão tem palavra composta que não quebra. Empilhar é outra coisa:
 *  ninguém é espremido, cada célula ganha a linha inteira e leva o nome da
 *  coluna junto.
 *
 *  E o nome vem do `<th>` da própria tabela, copiado para um `data-rot` em cada
 *  `<td>` da coluna. Escrito à mão nas 85 páginas seriam 85 lugares onde a
 *  próxima tabela nasce sem rótulo — e cinco idiomas onde ele nasce em
 *  português. Aqui toda tabela que entrar já nasce rotulada, no idioma dela.
 */
function rotularCelulas(tabela: string): string {
  const cab = [...tabela.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/g)]
    .map((m) => m[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim());
  if (!cab.length) return tabela;
  /* A primeira linha com `<th>` é o cabeçalho; as outras são dados. O `<th>`
     de canto de algumas tabelas fica vazio, e um rótulo vazio é pior que
     nenhum: ele desenha um espaço em branco antes do valor. */
  return tabela.replace(/<tr\b[^>]*>[\s\S]*?<\/tr>/g, (linha) => {
    /* A LINHA DE CABEÇALHO GANHA UMA CLASSE, e não confio no `<thead>`: metade
       destas tabelas escreve os `<th>` numa `<tr>` solta, sem `<thead>` nenhum.
       Esconder só o `thead` deixava esses `<th>` de pé — e foi exatamente isso
       que empurrou a página para 488px quando a versão empilhada entrou.
       Podia ser `tr:has(th)` no CSS; é uma classe aqui porque assim a regra não
       depende de o navegador de quem lê ter `:has()`. */
    if (/<th\b/.test(linha)) {
      return /<tr[^>]*class=/.test(linha)
        ? linha.replace(/<tr([^>]*)class="/, '<tr$1class="cabTab ')
        : linha.replace(/<tr/, '<tr class="cabTab"');
    }
    let i = -1;
    return linha.replace(/<td\b/g, () => {
      i += 1;
      const r = cab[i] || '';
      return r ? `<td data-rot="${escapar(r)}"` : '<td';
    });
  });
}

/** Os hreflang de uma página. O `x-default` só na home, como no site antigo:
 *  ele diz para onde mandar quem não casa com nenhum idioma, e quem chega numa
 *  página interna chegou por link, não por sorteio. */
export function alternativas(pagina: string, comDefault = false): Record<string, string> {
  /* Sai de `IDIOMAS`, e não escrito à mão: era aqui que o alemão e o francês
     iam ficar de fora sem ninguém perceber — a página abre, o texto está certo,
     e só o buscador sabe que a versão existe. O português leva a região porque
     é `pt-BR` de verdade, e não `pt` genérico. */
  const alt: Record<string, string> = Object.fromEntries(
    IDIOMAS.map((l) => [l === 'pt' ? 'pt-BR' : l, marca.site + endereco(pagina, l)]),
  );
  if (comDefault) alt['x-default'] = marca.site + endereco(pagina, 'en');
  return alt;
}

/** De volta do endereço para o nome da página: `/en/security` → `seguranca`. */
export function porSlug(slug: string, lang: Lang): string | null {
  return PAGINAS.find((pg) => SLUGS[pg][lang] === slug) ?? null;
}

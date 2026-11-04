/* O BLOG — dos arquivos do projeto até o post no ar (Build 70).
 *
 * Até o Build 69 o blog morava no banco e era escrito num editor do painel, e
 * esta régua dirigia o editor contra um banco de mentira. No 70 o post virou
 * arquivo em `conteudo/blog/`, o `build.py` o junta em `src/blog.json`, e o
 * site importa esse JSON. As perguntas mudaram de lugar, não de natureza:
 *
 *   1. o que está no disco é o que o build publica — e nada aponta para o
 *      balde velho, que some no Build 72;
 *   2. as regras que as funções do banco aplicavam continuam valendo: só sai
 *      post publicado e com data já passada, só sai idioma com título, a lista
 *      vem do mais novo para o mais velho, e o corpo é ESCAPADO antes de virar
 *      HTML (provado com o `lib/blog.ts` de verdade, sobre dados de ensaio);
 *   3. no ar: o índice de cada idioma mostra o que existe nele, o `hreflang`
 *      sai dos idiomas que o post TEM, a capa é servida pelo próprio site, e
 *      nenhuma página do blog pede nada ao Supabase;
 *   4. compartilhar são links, sem script de rede nenhuma;
 *   5. o blog está no rodapé, nos cinco idiomas;
 *   6. o editor saiu de verdade.
 *
 *   node testes/blog.mjs
 */
import { chromium } from 'playwright';
import { spawn, execSync, execFileSync } from 'child_process';
import fs from 'fs'; import path from 'path'; import os from 'os'; import crypto from 'crypto';

import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';
import { garantirPortaLivre } from './_porta.mjs';
const P = 8837;
const BASE = `http://localhost:${P}`;

let falhas = 0;
const ok = (n, c, e) => { console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : '')); if (!c) falhas++; };

const CONTEUDO = path.join(RAIZ_WS, 'conteudo', 'blog');
const GERADO = JSON.parse(fs.readFileSync(path.join(RAIZ_WS, 'src', 'blog.json'), 'utf8')).posts;
const pastas = fs.readdirSync(CONTEUDO).filter((n) => fs.statSync(path.join(CONTEUDO, n)).isDirectory()).sort();
const metas = Object.fromEntries(pastas.map((n) =>
  [n, JSON.parse(fs.readFileSync(path.join(CONTEUDO, n, 'post.json'), 'utf8'))]));
const publicados = GERADO.filter((p) => p.publicado_em && new Date(p.publicado_em) <= new Date());

console.log('[1] o que está no disco é o que o build publica');
{
  ok('um post gerado para cada pasta', GERADO.length === pastas.length && pastas.length > 0,
     `${GERADO.length} gerados, ${pastas.length} pastas`);
  const divergentes = [];
  for (const p of GERADO) for (const [L, v] of Object.entries(p.versoes)) {
    const md = fs.readFileSync(path.join(CONTEUDO, p.chave, `${L}.md`), 'utf8');
    const m = metas[p.chave].idiomas[L];
    if (md !== v.corpo || m.slug !== v.slug || m.titulo !== v.titulo) divergentes.push(`${p.chave}/${L}`);
  }
  ok('o corpo, o slug e o título gerados são os dos arquivos', divergentes.length === 0, divergentes.join(', '));
  /* O `src/blog.json` é gerado e vai no commit; um arquivo editado sem rodar o
     build publicaria o texto velho. */
  const geradoAgora = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'blog-')), 'src');
  fs.mkdirSync(geradoAgora, { recursive: true });
  let refeito = '';
  try {
    execFileSync('python3', ['-c',
      'import sys, pathlib, shutil; sys.path.insert(0, sys.argv[1]); import build; ' +
      'r = pathlib.Path(sys.argv[2]); shutil.copytree(pathlib.Path(sys.argv[1]) / "conteudo", r / "conteudo"); ' +
      'build.escrever_blog(r, conferir_figuras=False)', RAIZ_WS, path.dirname(geradoAgora)], { stdio: 'pipe' });
    refeito = fs.readFileSync(path.join(geradoAgora, 'blog.json'), 'utf8');
  } catch (e) { refeito = 'erro: ' + String(e.stderr || e.message).slice(0, 200); }
  ok('o src/blog.json do disco é o que o build gera agora — ninguém esqueceu de rodar o build',
     refeito === fs.readFileSync(path.join(RAIZ_WS, 'src', 'blog.json'), 'utf8'), refeito.slice(0, 80));
  const tudo = fs.readFileSync(path.join(RAIZ_WS, 'src', 'blog.json'), 'utf8') +
    pastas.map((n) => fs.readdirSync(path.join(CONTEUDO, n)).filter((f) => /\.md$/.test(f))
      .map((f) => fs.readFileSync(path.join(CONTEUDO, n, f), 'utf8')).join('')).join('');
  ok('nada do blog aponta para o Supabase', !/supabase\.co/.test(tudo));
  ok('todo post publicado tem português e inglês — a regra que o banco aplicava',
     publicados.every((p) => p.versoes.pt && p.versoes.en),
     publicados.filter((p) => !(p.versoes.pt && p.versoes.en)).map((p) => p.chave).join(', '));
  /* AS FIGURAS. Cada uma com o MD5 que tinha no balde — uma imagem trocada no
     caminho sairia no ar com o nome da certa. */
  const faltam = [];
  for (const [chave, m] of Object.entries(metas)) for (const f of m.figuras || []) {
    const arq = path.join(RAIZ_WS, 'public', 'img', 'blog', chave, f.arquivo);
    if (!fs.existsSync(arq)) { faltam.push(`${chave}/${f.arquivo} (falta)`); continue; }
    const md5 = crypto.createHash('md5').update(fs.readFileSync(arq)).digest('hex');
    if (md5 !== f.md5) faltam.push(`${chave}/${f.arquivo} (md5 ${md5})`);
  }
  ok('toda figura está no projeto, com o MD5 do balde', faltam.length === 0,
     faltam.slice(0, 3).join('; ') + (faltam.length > 3 ? ` (+${faltam.length - 3})` : ''));
  /* A porta de desenvolvimento do gerador não pode virar o caminho do build. */
  const build = fs.readFileSync(path.join(RAIZ_WS, 'build.py'), 'utf8');
  const main = build.slice(build.indexOf('def main()'));
  ok('o build confere as figuras — nunca chama o gerador com conferir_figuras=False',
     /escrever_blog\(ROOT\)/.test(main) && !/conferir_figuras\s*=\s*False/.test(main));
}

console.log('\n[2] as regras do banco, agora no lib/blog.ts — provadas sobre dados de ensaio');
{
  /* O `lib/blog.ts` DE VERDADE, e não uma cópia da lógica: o arquivo é
     copiado para uma pasta temporária, os quatro `import` de dados apontam
     para o ensaio, e o Node roda o TypeScript tirando os tipos. */
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'blogts-'));
  let src = fs.readFileSync(path.join(RAIZ_WS, 'lib', 'blog.ts'), 'utf8');
  src = src.replace("import 'server-only';", '')
    .replace("from '@/src/blog.json'", "from './blog.json' with { type: 'json' }")
    .replace("from '@/src/marca.json'", "from './marca.json' with { type: 'json' }")
    .replace("from '@/src/rotas.json'", "from './rotas.json' with { type: 'json' }")
    .replace("from '@/src/i18n-site.json'", "from './i18n-site.json' with { type: 'json' }");
  fs.writeFileSync(path.join(tmp, 'blog.mts'), src);
  for (const f of ['marca.json', 'rotas.json', 'i18n-site.json'])
    fs.copyFileSync(path.join(RAIZ_WS, 'src', f), path.join(tmp, f));
  const futuro = new Date(Date.now() + 30 * 864e5).toISOString();
  const v = (slug, titulo, corpo = 'texto') => ({ slug, titulo, resumo: 'r', corpo });
  fs.writeFileSync(path.join(tmp, 'blog.json'), JSON.stringify({ posts: [
    { chave: 'velho', publicado_em: '2026-01-02T10:00:00+00:00', atualizado_em: null, autor: null, tags: [],
      capa: '/img/blog/velho/a.png', versoes: { pt: v('velho', 'Velho'), en: v('old', 'Old') } },
    { chave: 'novo', publicado_em: '2026-03-01T10:00:00+00:00', atualizado_em: '2026-03-02T10:00:00+00:00',
      autor: 'Ana', tags: ['qa'], capa: null, versoes: { pt: v('novo', 'Novo'), en: v('new', 'New') } },
    { chave: 'agendado', publicado_em: futuro, atualizado_em: null, autor: null, tags: [], capa: null,
      versoes: { pt: v('agendado', 'Agendado'), en: v('scheduled', 'Scheduled') } },
    { chave: 'rascunho', publicado_em: null, atualizado_em: null, autor: null, tags: [], capa: null,
      versoes: { pt: v('rascunho', 'Rascunho') } },
    { chave: 'sem-titulo-en', publicado_em: '2026-02-01T10:00:00+00:00', atualizado_em: null, autor: null,
      tags: [], capa: null, versoes: { pt: v('so-pt', 'Só português'), en: v('sem', '   ') } },
  ] }));
  const roteiro = `
    const b = await import(${JSON.stringify(path.join(tmp, 'blog.mts'))});
    const pt = await b.lista('pt'), en = await b.lista('en'), de = await b.lista('de');
    const velho = await b.post('pt', 'velho'), agendado = await b.post('pt', 'agendado');
    const rascunho = await b.post('pt', 'rascunho'), nada = await b.post('pt', 'nao-existe');
    const soPt = await b.post('pt', 'so-pt'), old = await b.post('en', 'old');
    const crlf = b.paraHtml('## T\\r\\n\\r\\nlinha');
    console.log(JSON.stringify({
      pt: pt.map((p) => p.slug), en: en.map((p) => p.slug), de: de.length,
      velhoIdiomas: velho.idiomas, velhoAtualizado: velho.atualizado_em,
      agendado: Object.keys(agendado).length, rascunho: Object.keys(rascunho).length, nada: Object.keys(nada).length,
      soPtIdiomas: soPt.idiomas, oldSlug: old.slug, capa: pt.find((p) => p.slug === 'velho').capa,
      script: b.paraHtml('<script>alert(1)</script>'),
      js: b.paraHtml('[clique](javascript:alert(1))'),
      img: b.paraHtml('![x" onerror="alert(1)](/img/blog/a.png)'),
      md: b.paraHtml('## Título\\n\\n**forte** e [link](/comparativo)\\n\\n- um\\n- dois'),
      crlf, lf: b.paraHtml('## T\\n\\nlinha'),
      abs: b.urlAbsoluta('/img/blog/velho/a.png'), absJa: b.urlAbsoluta('https://x.example/a.png'),
    }));`;
  let r = null, motivo = '';
  try {
    const saida = execFileSync('node', ['--experimental-strip-types', '--no-warnings', '--input-type=module', '-e', roteiro],
      { stdio: 'pipe', cwd: tmp }).toString();
    r = JSON.parse(saida.trim().split('\n').pop());
  } catch (e) { motivo = String(e.stderr || e.message).slice(0, 300); }
  ok('o lib/blog.ts de verdade roda sobre o ensaio', !!r, motivo);
  if (r) {
    ok('a lista traz só o publicado e já no ar, do mais novo para o mais velho',
       JSON.stringify(r.pt) === JSON.stringify(['novo', 'so-pt', 'velho']), r.pt.join(', '));
    ok('o agendado para daqui a 30 dias não sai — nem na lista, nem no endereço',
       !r.pt.includes('agendado') && r.agendado === 0);
    ok('o rascunho também não', !r.pt.includes('rascunho') && r.rascunho === 0);
    ok('idioma sem título não entra na lista daquele idioma', !r.en.includes('sem'), r.en.join(', '));
    ok('e não é anunciado no hreflang', JSON.stringify(r.soPtIdiomas) === '{"pt":"so-pt"}', JSON.stringify(r.soPtIdiomas));
    ok('o índice de um idioma sem post fica vazio', r.de === 0, String(r.de));
    ok('o post traz o endereço dele em cada idioma que TEM',
       JSON.stringify(r.velhoIdiomas) === '{"pt":"velho","en":"old"}', JSON.stringify(r.velhoIdiomas));
    ok('sem data de atualização, vale a de publicação', r.velhoAtualizado === '2026-01-02T10:00:00+00:00', r.velhoAtualizado);
    ok('cada idioma acha o post pelo slug dele', r.oldSlug === 'old');
    ok('endereço que não existe devolve vazio', r.nada === 0);
    ok('a capa é um caminho do próprio site', r.capa === '/img/blog/velho/a.png', r.capa);
    /* O ESCAPE, que é a razão de o corpo ser markdown. */
    ok('um <script> no corpo sai como texto', /&lt;script&gt;/.test(r.script) && !/<script/i.test(r.script), r.script);
    ok('link javascript: vira "#"', /href="#"/.test(r.js) && !/javascript:/i.test(r.js), r.js);
    ok('aspas no texto alternativo não abrem atributo', !/onerror="/.test(r.img), r.img);
    ok('o markdown desenha título, negrito, link e lista',
       /<h2>Título<\/h2>/.test(r.md) && /<strong>forte<\/strong>/.test(r.md) &&
       /<a href="\/comparativo">link<\/a>/.test(r.md) && (r.md.match(/<li>/g) || []).length === 2, r.md);
    /* O banco guardava o corpo com \r\n (o formulário do navegador manda
       assim); os arquivos têm \n. O desenho tem de sair igual. */
    ok('\\r\\n e \\n desenham o mesmo HTML', r.crlf === r.lf, r.crlf + ' ≠ ' + r.lf);
    ok('a capa ganha o domínio para o Open Graph', r.abs === 'https://walkstamp.com/img/blog/velho/a.png', r.abs);
    ok('e o que já é endereço inteiro fica como está', r.absJa === 'https://x.example/a.png');
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}

/* ------------------------------------------------------------ o site no ar */
try { execSync(`fuser -k ${P}/tcp 2>/dev/null`); } catch {}
await new Promise((r) => setTimeout(r, 500));
/* A porta é nossa antes de qualquer coisa — o porquê está no `_porta.mjs`. */
await garantirPortaLivre(P, 'o blog.mjs');
const next = spawn('npx', ['next', 'start', '-p', String(P)], { cwd: RAIZ_WS, stdio: 'ignore' });
process.on('exit', () => { try { next.kill('SIGKILL'); } catch {} });
for (let i = 0; i < 60; i++) {
  try { const r = await fetch(`${BASE}/blog`); if (r.ok) break; } catch {}
  await new Promise((r) => setTimeout(r, 500));
}
const br = await chromium.launch({ executablePath: CHROME_WS });
const erros = [];
const texto = async (u) => (await fetch(BASE + u)).text();
const primeiro = [...publicados].sort((a, b) => (a.publicado_em < b.publicado_em ? 1 : -1))[0];

console.log('\n[3] no ar: índices, post, hreflang, figuras — e nada pedido ao Supabase');
{
  const ctx = await br.newContext({ viewport: { width: 1300, height: 1000 } });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push(e.message));
  const doBanco = [];
  pg.on('request', (q) => { if (/supabase\.co/.test(q.url())) doBanco.push(q.url()); });

  await pg.goto(`${BASE}/blog`, { waitUntil: 'networkidle' });
  const tituloPt = await pg.locator('.postList h2').allInnerTexts();
  ok('o índice em português mostra cada post publicado', tituloPt.length === publicados.length,
     `${tituloPt.length} de ${publicados.length}`);
  ok('com os títulos em português', publicados.every((p) => tituloPt.includes(p.versoes.pt.titulo)));
  const capas = await pg.locator('.postList img').evaluateAll((im) => im.map((i) => i.getAttribute('src')));
  ok('as capas da lista são do próprio site', capas.length > 0 && capas.every((c) => c.startsWith('/img/blog/')),
     capas.slice(0, 2).join(' '));
  ok('e carregaram', (await pg.locator('.postList img').evaluateAll((im) => im.filter((i) => i.naturalWidth > 0).length)) === capas.length);

  await pg.goto(`${BASE}/en/blog`, { waitUntil: 'networkidle' });
  const tituloEn = await pg.locator('.postList h2').allInnerTexts();
  ok('o índice em inglês mostra a versão inglesa',
     tituloEn.length === publicados.length && publicados.every((p) => tituloEn.includes(p.versoes.en.titulo)),
     tituloEn.slice(0, 2).join(' | '));
  await pg.goto(`${BASE}/de/blog`, { waitUntil: 'networkidle' });
  ok('o índice em alemão fica VAZIO em vez de mostrar português',
     (await pg.locator('.postList h2').count()) === 0);

  await pg.goto(`${BASE}/blog/${primeiro.versoes.pt.slug}`, { waitUntil: 'networkidle' });
  ok('o post abre com o título no h1', (await pg.locator('h1').innerText()) === primeiro.versoes.pt.titulo,
     await pg.locator('h1').innerText());
  ok('e o corpo desenhado', (await pg.locator('.postCorpo p').count()) > 3);
  const capa = await pg.locator('img.postCapa').getAttribute('src');
  ok('a capa do post é do próprio site', capa === primeiro.capa, String(capa));
  const resp = await fetch(BASE + capa);
  const figura = metas[primeiro.chave].figuras.find((f) => primeiro.capa.endsWith('/' + f.arquivo));
  const corpo = Buffer.from(await resp.arrayBuffer());
  ok('e o site a serve, inteira', resp.status === 200 && corpo.length === (figura && figura.bytes),
     `${resp.status}, ${corpo.length} bytes`);
  ok('nenhuma página do blog pediu nada ao Supabase', doBanco.length === 0, doBanco[0]);
  await ctx.close();

  const html = await texto(`/blog/${primeiro.versoes.pt.slug}`);
  /* `gi`: o Next escreve `hrefLang` em camelCase. */
  const alt = [...html.matchAll(/hreflang="([a-z-]+)"[^>]*href="([^"]+)"|href="([^"]+)"[^>]*hreflang="([a-z-]+)"/gi)]
    .map((m) => (m[1] || m[4]) + ' ' + (m[2] || m[3]));
  ok('o hreflang anuncia pt e en', alt.some((a) => a.startsWith('pt')) && alt.some((a) => a.startsWith('en')), alt.join(' | '));
  ok('e NÃO anuncia alemão, que o post não tem', !alt.some((a) => a.startsWith('de')), alt.join(' | '));
  ok('o endereço inglês é o slug inglês', alt.some((a) => a.includes(`/en/blog/${primeiro.versoes.en.slug}`)), alt.join(' | '));
  const og = (html.match(/property="og:image" content="([^"]+)"/) || [])[1] || '';
  ok('a prévia de quem compartilha usa a capa, com o domínio', og === `https://walkstamp.com${primeiro.capa}`, og);

  /* O que um rastreador lê: o índice, o post, o RSS e o sitemap. */
  const paginas = { 'índice': await texto('/blog'), 'post': html, 'RSS': await texto('/blog/rss.xml'),
                    'sitemap': await texto('/sitemap-blog.xml'), 'índice en': await texto('/en/blog') };
  /* O `<body>` do site ainda carrega `data-supa-url` e `data-supa-key` para o
     `support.js` (o formulário de ajuda do site), que sai com o resto da conta
     no Build 71. Só esses dois atributos saem da leitura — no HTML e no
     payload do React —, e qualquer OUTRA menção ao Supabase reprova. */
  const semOLayout = (h) => h
    .replace(/data-supa-(url|key)="[^"]*"/g, '')
    .replace(/\\"data-supa-(url|key)\\":\\"[^"\\]*\\"/g, '');
  const comBanco = Object.entries(paginas)
    .filter(([, h]) => /supabase\.co/.test(semOLayout(h)))
    .map(([n]) => n);
  ok('nenhuma imagem, link ou metadado do blog aponta para o Supabase', comBanco.length === 0, comBanco.join(', '));
  ok('o RSS tem um item por post publicado', (paginas.RSS.match(/<item>/g) || []).length === publicados.length,
     String((paginas.RSS.match(/<item>/g) || []).length));
  const semMapa = publicados.flatMap((p) => Object.values(p.versoes).map((w) => w.slug))
    .filter((s) => !paginas.sitemap.includes(`/${s}</loc>`));
  ok('o sitemap tem todo post, em todo idioma', semMapa.length === 0, semMapa.join(', '));
}

console.log('\n[4] compartilhar: os canais do público, e nenhum script de rede');
{
  const ctx = await br.newContext();
  const pg = await ctx.newPage();
  const terceiros = [];
  pg.on('request', (r) => {
    const u = new URL(r.url());
    if (!['localhost', '127.0.0.1'].includes(u.hostname)) terceiros.push(u.hostname);
  });
  const slug = primeiro.versoes.pt.slug;
  await pg.goto(`${BASE}/blog/${slug}`, { waitUntil: 'networkidle' });
  const hrefs = await pg.locator('.partilhar a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  ok('LinkedIn', hrefs.some((h) => h.includes('linkedin.com')), hrefs.join(' '));
  ok('e-mail', hrefs.some((h) => h.startsWith('mailto:')));
  ok('WhatsApp', hrefs.some((h) => h.includes('wa.me')));
  ok('X', hrefs.some((h) => h.includes('twitter.com/intent')));
  ok('copiar o link', await pg.locator('.partilharCopiar').count() === 1);
  ok('todos levam o endereço do post', hrefs.every((h) => h.includes(encodeURIComponent(`/blog/${slug}`))),
     hrefs.join(' '));
  /* Um botão oficial de rede social traz o rastreador da rede junto — e a
     política deste site diz que não há rastreador de terceiro. */
  ok('nenhum pedido a domínio de terceiro', terceiros.length === 0, terceiros.join(' '));
  await ctx.close();
}

console.log('\n[5] o blog está no rodapé, nos cinco idiomas');
{
  for (const [rota, esperado] of [['/', '/blog'], ['/en', '/en/blog'], ['/es', '/es/blog'], ['/de', '/de/blog'], ['/fr', '/fr/blog']]) {
    const h = await texto(rota);
    ok(`${rota} tem link para ${esperado}`, h.includes(`href="${esperado}"`), esperado);
  }
}

console.log('\n[6] o editor saiu de verdade');
{
  ok('a página do editor não existe mais',
     !fs.existsSync(path.join(RAIZ_WS, 'app', 'conta', '[lang]', 'negocio', 'blog')));
  /* O back-office inteiro saiu no Build 71, com a conta: não há aba nenhuma. */
  const rotas = JSON.parse(fs.readFileSync(path.join(RAIZ_WS, 'src', 'rotas.json'), 'utf8'));
  ok('nem a aba Blog do back-office', !(rotas.abasNegocio || []).includes('blog'),
     (rotas.abasNegocio || ['(sem back-office)']).join(', '));
  const lib = fs.readFileSync(path.join(RAIZ_WS, 'lib', 'blog.ts'), 'utf8');
  const sobra = ['salvar', 'publicar', 'apagar', 'figuraAdd', 'figuraDel', 'definirCapa', 'todos']
    .filter((f) => new RegExp(`export (const|async function|function) ${f}\\b`).test(lib));
  ok('nem as funções de escrever no banco', sobra.length === 0, sobra.join(', '));
  ok('o lib/blog.ts não fala com o banco', !/supabase|rpc\(/.test(lib));
  /* O ensaio das réguas troca os posts por um arquivo — e na Vercel não pode. */
  ok('o ensaio das réguas é ignorado na Vercel',
     /const ENSAIO = !process\.env\.VERCEL \? process\.env\.WALKSTAMP_BLOG_TESTE : ''/.test(lib));
  ok('e o balde de figuras saiu', !fs.existsSync(path.join(RAIZ_WS, 'lib', 'supabase', 'figura.ts')));
}

ok('nenhum erro de JavaScript', erros.length === 0, erros.join(' | '));
await br.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);

/* A LISTA DE TERCEIROS DA POLÍTICA E DO DPA SAI DA MATRIZ DE EGRESSÃO, e não
 * da memória de quem escreveu.
 *
 * O ACHADO QUE FEZ ESTA RÉGUA NASCER (agosto de 2026): a política listava
 * quatro terceiros e o produto falava com seis — faltavam a Stripe e a Brevo.
 * Uma lista escrita à mão ao lado de uma lista de verdade sempre diverge.
 *
 * O QUE MUDOU EM 04/11/2026. O Walkstamp ficou grátis, sem conta e sem
 * servidor. Não há mais suboperador que receba conteúdo de cliente: o que
 * sobra são os endereços que o NAVEGADOR da pessoa contata sozinho, e a fonte
 * de verdade deles é `src/egressao.json` — a matriz que `testes/egressao.mjs`
 * confere contra o arquivo construído e contra o navegador de verdade.
 *
 * Então esta régua deixou de varrer credencial para montar a lista, e passou a
 * cobrar que a política e o DPA, nos cinco idiomas, digam o mesmo que a
 * matriz:
 *
 *   [1] a tabela `#terceiros` existe, com UMA linha por destino da matriz
 *       (`data-destino` = `id` de lá) — nem a menos, nem a mais;
 *   [2] cada linha nomeia a empresa por trás de cada endereço do destino
 *       (`cdn.jsdelivr.net` → jsDelivr, `huggingface.co` → Hugging Face…);
 *   [3] a linha do destino que leva conteúdo (`conteudo: true`) diz isso na
 *       coluna "o que recebe", e nenhuma outra diz;
 *   [4] o que a ferramenta BUSCA no fonte (`src/template.html`) está na tabela
 *       — a segunda trava, para o dia em que alguém esquecer a matriz;
 *   [5] credencial de terceiro que ainda exista no código de servidor tem de
 *       estar nomeada na política (como passado, dentro de `data-antigo`, ou
 *       na tabela);
 *   [6] as traduções do DPA dizem que a portuguesa é a que vale, e o bloco de
 *       assinatura não pede CNPJ de quem não tem.
 *
 * Não precisa de servidor nenhum: lê arquivos.
 *
 *   node testes/terceiros.mjs
 */
import fs from 'fs';
import path from 'path';

import { RAIZ_WS } from './_caminhos.mjs';
const RAIZ = `${RAIZ_WS}`;
let falhas = 0;
const ok = (n, c, e) => {
  console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : ''));
  if (!c) falhas++;
};

const IDIOMAS = ['pt', 'en', 'es', 'de', 'fr'];
const MATRIZ = JSON.parse(fs.readFileSync(path.join(RAIZ, 'src', 'egressao.json'), 'utf8'));
/* Só o que existe no site. O pacote offline é o caminho B: nenhum destino. */
const DESTINOS = MATRIZ.destinos.filter((d) => (d.onde || []).includes('web'));

/* A EMPRESA POR TRÁS DE CADA ENDEREÇO, derivada dos `hosts`.
 *
 * O rótulo é o penúltimo pedaço do domínio: `cdn.jsdelivr.net` → jsdelivr,
 * `www.googleapis.com` → googleapis, `huggingface.co` → huggingface. Duas
 * exceções, as duas escritas na própria matriz:
 *   - `_vercel/...` é um caminho no NOSSO domínio que a Vercel responde;
 *   - o destino com `nossoDominio` é servido por uma empresa cujo nome está no
 *     `quem` da linha ("Vercel (hospedagem)") — o endereço é nosso, a empresa
 *     não. É exatamente a distinção que o `_leia` da matriz explica. */
function empresas(d) {
  const out = new Set();
  for (const h of d.hosts) {
    if (h.startsWith('_vercel')) { out.add('vercel'); continue; }
    if (d.nossoDominio) { out.add(d.pt.quem.split(/[\s(]/)[0].toLowerCase()); continue; }
    const partes = h.split('/')[0].split('.');
    out.add(partes[partes.length - 2]);
  }
  return [...out];
}
/* Texto da célula, sem marcação, minúsculo e sem espaço: "Hugging Face" tem de
   valer para `huggingface`. */
const plano = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ')
  .toLowerCase().replace(/\s+/g, '');
/* `googleapis`, `accounts.google`, `docs.google` são o MESMO fornecedor, e
   nenhuma política razoável vai escrever "googleapis". Quem escreveu "Google"
   respondeu pelos quatro endereços. */
const cita = (txt, rot) => {
  if (txt.includes(rot)) return true;
  for (let n = rot.length - 1; n >= 5; n--) if (txt.includes(rot.slice(0, n))) return true;
  return false;
};

/* Como cada idioma diz "conteúdo seu" na coluna do que o terceiro recebe. Na
   política fala-se com a pessoa; no DPA, com o Cliente. */
const CONTEUDO = {
  pt: /conte[úu]do seu|conte[úu]do do cliente/i,
  en: /content of yours|customer content/i,
  es: /contenido tuyo|contenido del cliente/i,
  de: /inhalte von ihnen|inhalte des kunden/i,
  fr: /du contenu [àa] vous|contenu du client/i,
};

const semComentario = (s) => s.replace(/<!--[\s\S]*?-->/g, '');

/** As linhas da tabela `#terceiros` de um documento: [{destino, tds:[html]}]. */
function linhas(html) {
  const tab = semComentario(html).match(/<table[^>]*\bid="terceiros"[^>]*>([\s\S]*?)<\/table>/);
  if (!tab) return null;
  return [...tab[1].matchAll(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/g)]
    .filter((m) => !/<th\b/.test(m[2]))
    .map((m) => ({
      destino: (m[1].match(/data-destino="([^"]+)"/) || [])[1] || null,
      tds: [...m[2].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map((x) => x[1]),
    }));
}

const DOCS = [
  ['privacidade', (L) => path.join(RAIZ, 'src', 'site', 'bodies', `privacidade.${L}.html`)],
  ['dpa', (L) => path.join(RAIZ, 'src', 'site', `dpa.${L}.html`)],
];

// ---------------------------------------------------------------------------
console.log('[0] a matriz de egressão');
ok('a matriz tem destinos no site', DESTINOS.length >= 5, DESTINOS.map((d) => d.id).join(', '));
for (const d of DESTINOS) console.log(`     ${d.id.padEnd(13)} → ${empresas(d).join(', ')}${d.conteudo ? '   (leva conteúdo)' : ''}`);

// ---------------------------------------------------------------------------
console.log('\n[1-3] a política e o DPA dizem o mesmo que a matriz, nos cinco idiomas');
for (const [doc, arq] of DOCS) {
  for (const L of IDIOMAS) {
    const f = arq(L);
    if (!fs.existsSync(f)) { ok(`${doc}.${L}: o arquivo existe`, false, f); continue; }
    const ls = linhas(fs.readFileSync(f, 'utf8'));
    if (!ls) { ok(`${doc}.${L}: tem a tabela #terceiros`, false, 'falta <table id="terceiros">'); continue; }

    const ids = ls.map((x) => x.destino);
    const faltam = DESTINOS.map((d) => d.id).filter((id) => !ids.includes(id));
    const sobram = ids.filter((id) => !DESTINOS.some((d) => d.id === id));
    const repetidos = ids.filter((id, i) => ids.indexOf(id) !== i);
    ok(`${doc}.${L}: uma linha por destino da matriz`,
       !faltam.length && !sobram.length && !repetidos.length,
       [faltam.length && 'faltam ' + faltam.join(','), sobram.length && 'sobram ' + sobram.join(','),
        repetidos.length && 'repetidos ' + repetidos.join(',')].filter(Boolean).join('; ') || '');

    const tortas = ls.filter((x) => x.tds.length !== 4 || x.tds.some((t) => !plano(t)));
    ok(`${doc}.${L}: cada linha diz terceiro, quando, o que recebe e o que nunca recebe`,
       tortas.length === 0, tortas.map((x) => x.destino).join(', '));

    for (const d of DESTINOS) {
      const l = ls.find((x) => x.destino === d.id);
      if (!l) continue;
      const txt = plano(l.tds.join(' '));
      const semNome = empresas(d).filter((e) => !cita(txt, e));
      ok(`${doc}.${L}: "${d.id}" nomeia quem está atrás do endereço`, semNome.length === 0,
         semNome.length ? 'não cita ' + semNome.join(', ') : '');
      const recebe = (l.tds[2] || '').replace(/<[^>]+>/g, ' ');
      const diz = CONTEUDO[L].test(recebe);
      ok(`${doc}.${L}: "${d.id}" ${d.conteudo ? 'DIZ que leva conteúdo' : 'não diz que leva conteúdo'}`,
         diz === !!d.conteudo, diz ? 'a coluna diz conteúdo' : 'a coluna não diz conteúdo');
    }
  }
}

// ---------------------------------------------------------------------------
console.log('\n[4] o que a ferramenta busca no fonte está na tabela da política');
{
  /* Endereço que a ferramenta BUSCA (`fetch`, `<script src>`, `new Worker`,
     `import`), e não endereço para onde ela só aponta um link. O que separa os
     dois é o que vem ANTES do endereço no fonte: `href=` é destino de clique. */
  const txt = fs.readFileSync(path.join(RAIZ, 'src', 'template.html'), 'utf8');
  const busca = new Map();
  const re = /https:\/\/([a-z0-9.-]+\.[a-z]{2,})/g;
  let m;
  while ((m = re.exec(txt))) {
    const antes = txt.slice(Math.max(0, m.index - 30), m.index);
    if (/href\s*=\s*["'`]?$/.test(antes)) continue;
    const partes = m[1].split('.');
    const rot = partes[partes.length - 2];
    if (!busca.has(rot)) busca.set(rot, m[1]);
  }
  console.log('     ' + [...busca].map(([r, h]) => `${r} (${h})`).join(', '));
  for (const L of IDIOMAS) {
    const ls = linhas(fs.readFileSync(DOCS[0][1](L), 'utf8')) || [];
    const tab = plano(ls.map((x) => x.tds.join(' ')).join(' '));
    const faltando = [...busca.keys()].filter((r) => !cita(tab, r));
    ok(`privacidade.${L}: nenhum endereço buscado pela ferramenta ficou de fora`,
       faltando.length === 0, faltando.join(', ') || '');
  }
}

// ---------------------------------------------------------------------------
console.log('\n[5] credencial de terceiro no código de servidor está nomeada na política');
{
  /* Até o Build 72 pode sobrar código que fala com o banco antigo (a cópia, a
     exclusão). Guardar a chave de um terceiro é a definição operacional de
     falar com ele — e quem fala tem de estar escrito na política, nem que seja
     como passado. Pastas que já não existem são puladas: elas saem de
     propósito. */
  function arquivos(dir, ext, saida = []) {
    if (!fs.existsSync(dir)) return saida;
    for (const nome of fs.readdirSync(dir, { withFileTypes: true })) {
      if (nome.name === 'node_modules' || nome.name.startsWith('.')) continue;
      const p = path.join(dir, nome.name);
      if (nome.isDirectory()) arquivos(p, ext, saida);
      else if (ext.some((e) => nome.name.endsWith(e))) saida.push(p);
    }
    return saida;
  }
  const fontes = [
    ...arquivos(path.join(RAIZ, 'app'), ['.ts', '.tsx']),
    ...arquivos(path.join(RAIZ, 'lib'), ['.ts', '.tsx']),
    ...arquivos(path.join(RAIZ, 'supabase'), ['.ts', '.mjs']),
  ];
  const re = /process\.env\.([A-Z0-9]+)_(?:API_KEY|SECRET_KEY|SERVICE_ROLE_KEY|WEBHOOK_SECRET|ACCESS_TOKEN)/g;
  const cred = new Map();
  for (const arq of fontes) {
    const txt = fs.readFileSync(arq, 'utf8');
    let m;
    while ((m = re.exec(txt))) if (!cred.has(m[1].toLowerCase())) cred.set(m[1].toLowerCase(), path.relative(RAIZ, arq));
  }
  console.log('     ' + ([...cred].map(([v, a]) => `${v} (${a})`).join(', ') || 'nenhuma credencial de terceiro no código'));
  for (const L of IDIOMAS) {
    const pol = semComentario(fs.readFileSync(DOCS[0][1](L), 'utf8')).toLowerCase();
    const faltando = [...cred.keys()].filter((v) => !pol.includes(v));
    ok(`privacidade.${L}: todo terceiro de quem guardamos credencial está nomeado`,
       faltando.length === 0, faltando.join(', ') || '');
  }
}

// ---------------------------------------------------------------------------
console.log('\n[6] as traduções do DPA e o bloco de assinatura');
for (const L of IDIOMAS.filter((x) => x !== 'pt')) {
  const dpa = fs.readFileSync(DOCS[1][1](L), 'utf8').toLowerCase();
  /* `portug`, e não `portugu`: em alemão é "portugiesische" e em francês
     "portugaise". Alguém assinar a versão alemã achando que assinou o original
     é o único jeito de esta tradução piorar a situação. */
  ok(`dpa.${L}: diz que a versão portuguesa é a que vale`,
     /portug/i.test(dpa) && /(governs|vale|maßgeblich|fait foi|prevalec)/i.test(dpa));
  /* Só a célula do cliente, até o `</table>`: o rodapé logo abaixo traz o CNPJ
     da empresa de propósito. Uma empresa alemã não tem CNPJ, e um campo
     impossível de preencher trava a assinatura. */
  const bloco = dpa.slice(dpa.indexOf('class="assina"'));
  const tabela = bloco.slice(0, bloco.indexOf('</table>'));
  const doCliente = tabela.slice(tabela.indexOf('</td>'));
  ok(`dpa.${L}: não pede CNPJ de quem não tem`, dpa.includes('class="assina"') && !doCliente.includes('cnpj'),
     doCliente.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 70));
}

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTerceiros: a política e o DPA acompanham a matriz de egressão.');
process.exit(falhas ? 1 : 0);

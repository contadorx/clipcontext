/* OS DOCUMENTOS LEGAIS DEPOIS DE 04/11/2026 — política de privacidade, termos
 * de uso e o DPA, nos cinco idiomas.
 *
 * O QUE MUDOU. O Walkstamp ficou grátis, sem conta e sem servidor (DEC-22,
 * Builds 69 a 72). Os três documentos descreviam conta, planos pagos, cobrança
 * pela Stripe, banco na Supabase e prazos de retenção que deixaram de existir.
 * Esta régua cobrava exatamente essas frases ("estão à venda", "14 dias com
 * tudo", "a conta apaga sozinha", o link para `/conta/dados`, a contagem de
 * marcos de uso lida da migração do banco). Ela passou a cobrar o contrário:
 *
 *   [1] nenhum token aposentado (`{{prazoConta}}`, `{{contaDados}}`…) e nenhum
 *       token fora da lista que o site e o gerador do DPA preenchem — um token
 *       sem valor sai LITERAL na página ou no papel;
 *   [2] as MESMAS seções (`id` de cada h2), as mesmas tabelas com o mesmo
 *       número de linhas e os mesmos trechos `data-antigo` nos cinco idiomas;
 *   [3] a data nova, no formato de cada idioma;
 *   [4] Stripe, Supabase, Brevo, planos, assinatura e cobrança só aparecem
 *       como PASSADO — dentro de elementos marcados com `data-antigo` — e a
 *       seção sobre quem teve conta continua contando que eles existiram;
 *   [5-7] o que cada documento tem de afirmar agora;
 *   [8] e, com o site no ar, o que a pessoa lê na página servida.
 *
 * As partes [1] a [7] leem arquivos. A [8] precisa do Next na 8802:
 *
 *   npx next build && npx next start -p 8802      (ou rodar.sh / rapido.sh site)
 *   node testes/legal.mjs
 *
 *   node testes/legal.mjs --arquivos               só [1] a [7], sem servidor
 */
import fs from 'fs';
import path from 'path';
import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';

const SO_ARQUIVOS = process.argv.includes('--arquivos');
let falhas = 0;
const ok = (n, c, e) => { console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : '')); if (!c) falhas++; };

const EMPRESA = 'Produtize Produtos e Serviços Inteligentes Ltda.';
const CNPJ = '48.417.292/0001-99';
const MAIL = 'privacidade@walkstamp.com';
const SUPORTE = 'suporte@walkstamp.com';
const IDIOMAS = ['pt', 'en', 'es', 'de', 'fr'];
const ROTAS = JSON.parse(fs.readFileSync(`${RAIZ_WS}/src/rotas.json`, 'utf8'));
const MATRIZ = JSON.parse(fs.readFileSync(`${RAIZ_WS}/src/egressao.json`, 'utf8'));
const DESTINOS = MATRIZ.destinos.filter((d) => (d.onde || []).includes('web'));

const DOCS = {
  privacidade: (L) => `${RAIZ_WS}/src/site/bodies/privacidade.${L}.html`,
  termos:      (L) => `${RAIZ_WS}/src/site/bodies/termos.${L}.html`,
  dpa:         (L) => `${RAIZ_WS}/src/site/dpa.${L}.html`,
};
const ler = (doc, L) => fs.readFileSync(DOCS[doc](L), 'utf8');

/* ---- ferramentas de leitura ---------------------------------------------- */
const semComentario = (s) => s.replace(/<!--[\s\S]*?-->/g, '');
/* Os elementos marcados com `data-antigo` falam do sistema que deixou de
   existir. Um `div` marcado não pode ter outro `div` dentro: o corte é pelo
   primeiro fechamento da mesma etiqueta. */
const ANTIGO = /<(div|p|tr|li|h2|span|ul)\b[^>]*\bdata-antigo\b[^>]*>[\s\S]*?<\/\1>/g;
const semAntigo = (s) => semComentario(s).replace(ANTIGO, ' ');
const soAntigo = (s) => (semComentario(s).match(ANTIGO) || []).join(' ');
const texto = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&[a-z]+;/g, ' ')
  .replace(/\s+/g, ' ');
const ids = (s, tag) => [...semComentario(s).matchAll(new RegExp(`<${tag}\\b[^>]*\\bid="([^"]+)"`, 'g'))].map((m) => m[1]);
const linhasDe = (s, id) => {
  const t = semComentario(s).match(new RegExp(`<table[^>]*\\bid="${id}"[^>]*>([\\s\\S]*?)</table>`));
  return t ? [...t[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => m[1]) : [];
};

/* ---- o que vale em cada idioma ------------------------------------------- */
const DATA = {
  pt: /4 de novembro de 2026/, en: /4 November 2026/, es: /4 de noviembre de 2026/,
  de: /4\. November 2026/, fr: /4 novembre 2026/,
};
/* As palavras do produto vendido. Fora de `data-antigo`, qualquer uma delas
   é o documento voltando a descrever um sistema que não existe. */
const VENDA = {
  pt: /planos? pagos?|plano time|plano gratuito|assinatura|cobran[çc]a|fatura|reembolso|renova[çc][ãa]o|checkout|assentos?\b|degusta/i,
  en: /paid plans?|team plan|free plan|subscription|subscrib|billing|invoice|refund|renewal|checkout|\bseats?\b|free trial/i,
  es: /planes? de pago|plan team|plan gratuito|suscripci[óo]n|\bcobros?\b|factura|reembolso|renovaci[óo]n|checkout|asientos?\b/i,
  de: /bezahlte[nr]? Plan|kostenlose[nr]? Plan|Abonnement|\bAbos?\b|Abrechnung|\bRechnung|Erstattung|Verlängerung|Checkout|Plätze|Testphase/i,
  fr: /offres? payantes?|offre gratuite|abonnement|abonn[ée]s?\b|facturation|facture|remboursement|renouvellement|checkout|si[èe]ges?\b|\bessai\b/i,
};
/* O que saiu do produto no Build 69 e não pode voltar a ser prometido: os
   marcos de uso (o `medir()` que gravava no banco) e as duas sinalizações que
   só eles respeitavam. A contagem de visitas do Vercel não as lê. */
const MARCOS = {
  pt: /marcos de uso|quinze marcos/i, en: /usage milestones|fifteen milestones/i,
  es: /hitos de uso|quince hitos/i, de: /Nutzungsmeilenstein|fünfzehn Meilensteine/i,
  fr: /jalons d[’']usage|quinze jalons/i,
};
const NENHUM = { pt: /\bNenhum\b/, en: /\bNone\b/, es: /\bNinguno\b/, de: /\bKeine\b/, fr: /\bAucun\b/ };
const SEM_COOKIE = {
  pt: /não grava cookie nenhum/i, en: /sets no cookies/i, es: /no guarda ninguna cookie/i,
  de: /setzt keine Cookies/i, fr: /ne dépose aucun cookie/i,
};
/* A cláusula de lei e foro é a que já existia. Ela não é reescrita aqui: é
   conferida, para que uma tradução nova não mude o foro por acidente. */
const LEI = {
  pt: [/regidos pela lei brasileira/, /foro do domic[íi]lio do usu[áa]rio/],
  en: [/governed by Brazilian law/, /courts of\s+the user's domicile/],
  es: [/se rigen por la ley brasileña/, /fuero del domicilio del usuario/],
  de: [/unterliegen brasilianischem Recht/, /Wohnsitz der nutzenden Person/],
  fr: [/régies par la loi brésilienne/, /for du domicile de l[’']utilisateur/],
};
const NAO_TRATA = {
  pt: /não trata dados pessoais por\s+conta do Cliente/, en: /does not process personal data on\s+behalf of the Customer/,
  es: /no trata datos personales por\s+cuenta del Cliente/, de: /verarbeitet keine personenbezogenen\s+Daten im Auftrag des Kunden/,
  fr: /ne traite pas de données personnelles\s+pour le compte du Client/,
};
const SEM_SUB = {
  pt: /Não há suboperador/, en: /There is no sub-processor/, es: /No hay subencargado/,
  de: /Es gibt keinen Unterauftragsverarbeiter/, fr: /Il n[’']y a pas de sous-traitant ultérieur/,
};

/* Os tokens que quem renderiza preenche. O site: `lib/site.ts` (`tokens()` e
   `caminhos()`). O DPA: `testes/gerar-dpa.mjs`. */
const TOKENS_SITE = ['marca', 'empresa', 'cnpj', 'contato', 'encarregado', 'site', 'privacidade', 'termos',
  'seguranca', 'app', 'home', 'blog'];
const TOKENS_DPA = [...TOKENS_SITE, 'dataDpa', 'siteDom'];
const APOSENTADOS = ['prazoConta', 'prazoLista', 'prazoEvento', 'contaDados', 'conta', 'precos'];

// ===========================================================================
console.log('[1] tokens: nenhum aposentado, nenhum que ninguém preencha');
for (const doc of Object.keys(DOCS)) {
  for (const L of IDIOMAS) {
    const s = ler(doc, L);
    const usados = [...new Set([...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))];
    const mortos = usados.filter((t) => APOSENTADOS.includes(t));
    const soltos = usados.filter((t) => !(doc === 'dpa' ? TOKENS_DPA : TOKENS_SITE).includes(t));
    ok(`${doc}.${L}: sem token aposentado`, mortos.length === 0, mortos.join(', '));
    ok(`${doc}.${L}: todo token tem quem o preencha`, soltos.length === 0, soltos.join(', '));
  }
}

// ===========================================================================
console.log('\n[2] as cinco línguas têm as mesmas seções');
for (const doc of Object.keys(DOCS)) {
  const pt = ler(doc, 'pt');
  const ref = {
    h2: ids(pt, 'h2'), tab: ids(pt, 'table'),
    linhas: ids(pt, 'table').map((t) => linhasDe(pt, t).length),
    antigo: (semComentario(pt).match(ANTIGO) || []).length,
  };
  ok(`${doc}.pt: as seções têm id`, ref.h2.length >= 5, ref.h2.join(' '));
  for (const L of IDIOMAS.slice(1)) {
    const s = ler(doc, L);
    const h2 = ids(s, 'h2');
    ok(`${doc}.${L}: mesmas seções, na mesma ordem`, h2.join(' ') === ref.h2.join(' '),
       h2.join(' ') === ref.h2.join(' ') ? '' : h2.join(' '));
    const tab = ids(s, 'table');
    ok(`${doc}.${L}: mesmas tabelas`, tab.join(' ') === ref.tab.join(' '), tab.join(' '));
    const lin = tab.map((t) => linhasDe(s, t).length);
    ok(`${doc}.${L}: e com as mesmas linhas`, lin.join(',') === ref.linhas.join(','),
       `${lin.join(',')} contra ${ref.linhas.join(',')}`);
    const ant = (semComentario(s).match(ANTIGO) || []).length;
    ok(`${doc}.${L}: os mesmos trechos sobre o sistema antigo`, ant === ref.antigo, `${ant} contra ${ref.antigo}`);
  }
}

// ===========================================================================
console.log('\n[3] a data nova');
for (const doc of ['privacidade', 'termos']) {
  for (const L of IDIOMAS) {
    const upd = (ler(doc, L).match(/<p class="updated">([\s\S]*?)<\/p>/) || [, ''])[1];
    ok(`${doc}.${L}: "última atualização" é 04/11/2026`, DATA[L].test(texto(upd)), texto(upd).slice(0, 60));
  }
}
for (const L of IDIOMAS) {
  const v = (ler('dpa', L).match(/<!--\s*versao:\s*([0-9-]+)\s*-->/) || [, ''])[1];
  ok(`dpa.${L}: versão 2026-11-04`, v === '2026-11-04', v || '(sem versão)');
}

// ===========================================================================
console.log('\n[4] o sistema vendido só aparece como passado');
const PRECISA_ANTIGO = { privacidade: ['stripe', 'supabase', 'brevo'], termos: ['stripe'], dpa: ['stripe', 'supabase', 'brevo'] };
for (const doc of Object.keys(DOCS)) {
  for (const L of IDIOMAS) {
    const s = ler(doc, L);
    const atual = texto(semAntigo(s));
    const marcas = atual.match(/stripe|supabase|brevo/gi) || [];
    ok(`${doc}.${L}: Stripe, Supabase e Brevo só como passado`, marcas.length === 0, [...new Set(marcas)].join(', '));
    const venda = atual.match(VENDA[L]);
    ok(`${doc}.${L}: nada de plano, assinatura ou cobrança como atual`, !venda,
       venda ? '…' + atual.slice(Math.max(0, venda.index - 40), venda.index + 40) + '…' : '');
    ok(`${doc}.${L}: tem a seção sobre quem teve conta`, ids(s, 'h2').includes('contaAntiga'));
    const passado = texto(soAntigo(s)).toLowerCase();
    const calou = PRECISA_ANTIGO[doc].filter((v) => !passado.includes(v));
    ok(`${doc}.${L}: e ela conta o que existiu`, calou.length === 0, calou.length ? 'não cita ' + calou.join(', ') : '');
  }
}

// ===========================================================================
console.log('\n[5] a política de privacidade');
for (const L of IDIOMAS) {
  const s = ler('privacidade', L);
  const t = texto(semComentario(s));
  ok(`${L}: canal de privacidade clicável`, s.includes('href="mailto:{{contato}}"'));
  ok(`${L}: e o do suporte`, s.includes(`href="mailto:${SUPORTE}"`));
  ok(`${L}: o aviso do topo leva à seção de quem teve conta`, s.includes('href="#contaAntiga"'));
  ok(`${L}: não promete mais marco de uso`, !MARCOS[L].test(t), (t.match(MARCOS[L]) || [''])[0]);
  ok(`${L}: nem Do Not Track / GPC, que a contagem de visitas não lê`, !/Do Not Track|Global Privacy Control/i.test(t));
  ok(`${L}: diz que o site não grava cookie`, SEM_COOKIE[L].test(t));
  ok(`${L}: nomeia o encarregado`, s.includes('{{encarregado}}'));
  ok(`${L}: fala da ANPD e do RGPD/GDPR`, /ANPD/.test(t) && /RGPD|GDPR|DSGVO/.test(t));
  const pap = linhasDe(s, 'papeis').map(texto);
  ok(`${L}: a tabela de papéis diz que o conteúdo gravado não tem papel nosso`,
     pap.length >= 4 && NENHUM[L].test(pap[1] || ''), (pap[1] || '(falta table#papeis)').slice(0, 80));
  const op = texto(linhasDe(s, 'operadoras').join(' ')).toLowerCase();
  ok(`${L}: quem trata por nossa conta: Vercel e HostGator`, op.includes('vercel') && op.includes('hostgator'));
  const bases = linhasDe(s, 'basesLegais').slice(1);
  const tortas = bases.filter((r) => { const tds = [...r.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map((m) => texto(m[1]).trim()); return tds.length !== 4 || tds.some((x) => !x); });
  ok(`${L}: bases legais — cada linha diz dado, finalidade, base e prazo`, bases.length >= 4 && tortas.length === 0,
     `${bases.length} linhas, ${tortas.length} tortas`);
  const terc = linhasDe(s, 'terceiros').length - 1;
  ok(`${L}: a tabela de terceiros tem um destino por linha da matriz`, terc === DESTINOS.length,
     `${terc} contra ${DESTINOS.length} — detalhe em testes/terceiros.mjs`);
}

// ===========================================================================
console.log('\n[6] os termos de uso');
for (const L of IDIOMAS) {
  const s = ler('termos', L);
  const t = texto(semComentario(s));
  const ns = [...semComentario(s).matchAll(/<h2\b[^>]*>\s*(\d+)\.\s/g)].map((m) => +m[1]);
  ok(`${L}: artigos numerados de 1 a N sem falha`, ns.length > 0 && ns.every((v, i) => v === i + 1), ns.join(','));
  for (const r of LEI[L]) ok(`${L}: lei e foro de antes: ${String(r).slice(1, 40)}`, r.test(t));
  ok(`${L}: canal do suporte e de privacidade clicáveis`,
     s.includes(`href="mailto:${SUPORTE}"`) && s.includes('href="mailto:{{contato}}"'));
  for (const id of ['gratuito', 'permitido', 'codigo', 'garantia', 'responsabilidade', 'privacidade', 'alteracoes', 'lei', 'contato'])
    ok(`${L}: tem a seção "${id}"`, ids(s, 'h2').includes(id));
  ok(`${L}: a ressalva da MIT e o nome antigo continuam`, /MIT/.test(t) && /ClipContext/.test(t));
}

// ===========================================================================
console.log('\n[7] o DPA');
for (const L of IDIOMAS) {
  const s = ler('dpa', L);
  const t = texto(semComentario(s));
  ok(`${L}: diz que não trata dado por conta do Cliente`, NAO_TRATA[L].test(t));
  ok(`${L}: e que não há suboperador`, SEM_SUB[L].test(t));
  ok(`${L}: é um documento inteiro, para virar PDF`, /^<!doctype html>/i.test(s.trim()) && /<\/html>\s*$/.test(s));
  ok(`${L}: usa a versão e o domínio que o gerador preenche`, s.includes('{{dataDpa}}') && s.includes('{{siteDom}}'));
  const terc = linhasDe(s, 'terceiros').length - 1;
  ok(`${L}: a mesma tabela de terceiros da política`, terc === DESTINOS.length, `${terc} contra ${DESTINOS.length}`);
}

if (SO_ARQUIVOS) {
  console.log(falhas ? `\n${falhas} FALHA(S)` : '\nDocumentos legais (arquivos): tudo passou.');
  process.exit(falhas ? 1 : 0);
}

// ===========================================================================
console.log('\n[8] o que a pessoa lê na página servida');
const { chromium } = await import('playwright');
const { criarProxy, exigirNext } = await import('./proxy.mjs');
await exigirNext();
/* O servidorzinho daqui é um encaminhador para o Next — mesma porta, e quem
   responde é o produto de verdade. */
const srv = criarProxy();
await new Promise((r) => srv.listen(8893, r));
const br = await chromium.launch({ executablePath: CHROME_WS });
const endereco = (pg, L) => (L === 'pt' ? '' : '/' + L) + '/' + ROTAS.slugs[pg][L];

for (const L of IDIOMAS) {
  for (const pg of ['privacidade', 'termos']) {
    const rota = endereco(pg, L);
    const ctx = await br.newContext(); const p = await ctx.newPage();
    const r = await p.goto('http://localhost:8893' + rota);
    ok(`${rota}: responde 200`, r && r.status() === 200, String(r && r.status()));
    const txt = await p.locator('body').innerText();
    ok(`${rota}: razão social e CNPJ`, txt.includes(EMPRESA) && txt.includes(CNPJ));
    ok(`${rota}: e-mail de privacidade clicável`, (await p.locator(`a[href="mailto:${MAIL}"]`).count()) > 0);
    ok(`${rota}: e-mail do suporte clicável`, (await p.locator(`a[href="mailto:${SUPORTE}"]`).count()) > 0);
    ok(`${rota}: sem token do build sobrando`, !/\{\{|\}\}/.test(txt), (txt.match(/\{\{\w*\}\}/) || [''])[0]);
    ok(`${rota}: a seção de quem teve conta tem âncora`, (await p.locator('#contaAntiga').count()) === 1);
    if (pg === 'termos') {
      const ns = [...txt.matchAll(/^(\d+)\.\s/gm)].map((m) => +m[1]);
      ok(`${rota}: artigos numerados de 1 a N sem falha`, ns.length > 0 && ns.every((v, i) => v === i + 1), ns.join(','));
    } else {
      /* CADA TABELA PELO SEU `id`: mirar em `table.legal` soma as quatro. */
      const vazias = await p.locator('table#basesLegais tr').evaluateAll((trs) =>
        trs.slice(1).filter((tr) => [...tr.querySelectorAll('td')].length !== 4
          || [...tr.querySelectorAll('td')].some((td) => !td.textContent.trim())).length);
      const n = await p.locator('table#basesLegais tr').count();
      ok(`${rota}: bases legais renderizam, com dado, finalidade, base e prazo`, n >= 5 && vazias === 0, `${n} linhas, ${vazias} tortas`);
      const t = await p.locator('table#terceiros tr').count();
      ok(`${rota}: a tabela de terceiros renderiza inteira`, t === DESTINOS.length + 1, String(t));
    }
    await ctx.close();
  }
}

console.log('\nnavegação');
for (const [rota, alvo] of [['/', '/privacidade'], ['/en', '/en/privacidade'], ['/es', '/es/privacidade']]) {
  const ctx = await br.newContext(); const p = await ctx.newPage();
  await p.goto('http://localhost:8893' + rota + '?lang=pt');
  ok(`${rota}: link para a política no rodapé`, (await p.locator(`footer a[href="${alvo}"]`).count()) === 1);
  await ctx.close();
}

await br.close(); srv.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nDocumentos legais: tudo passou.');
process.exit(falhas ? 1 : 0);

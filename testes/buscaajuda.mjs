/* A BUSCA DA BASE DE CONHECIMENTO.
 *
 * A página tinha 45 painéis em nove temas e nenhuma navegação: quem chegava
 * caía no topo de três mil palavras e rolava. Os acordeões já nasciam abertos
 * desde 23/08 — então o Ctrl+F alcançava tudo —, mas achar a palavra no meio
 * de uma parede não diz em que tema você está nem o que existe ao lado.
 *
 * São DUAS metades com durabilidades diferentes, e esta régua cobra as duas
 * separadamente porque elas falham por motivos diferentes:
 *
 *   - O ÍNDICE é HTML puro, derivado dos próprios `<h2>` no servidor. Ele tem
 *     que funcionar com o JavaScript desligado, e o texto dele tem que ser
 *     IGUAL ao dos títulos — é assim que se prova que ele é derivado e não uma
 *     sexta lista escrita à mão ao lado de cinco.
 *   - O FILTRO é acréscimo. O campo nasce com `hidden` e só aparece quando o
 *     script chega; um campo de busca que não busca é pior do que campo nenhum.
 *
 * Precisa do Next de pé na 8802, que a esteira já sobe.
 *
 *   node testes/buscaajuda.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';

const SITE = 'http://localhost:8802';
/* OS ENDEREÇOS SAEM DO `rotas.json`, e não de uma tabela aqui. Escritos aqui,
   a primeira renomeação de slug daria 404 — e um 404 nesta régua se parece com
   "a página não tem índice", que é o diagnóstico errado a dois passos da
   causa. O prefixo de idioma é o mesmo do site: o português não tem. */
const R = JSON.parse(fs.readFileSync(`${RAIZ_WS}/src/rotas.json`, 'utf8'));
const CAMINHO = Object.fromEntries(R.idiomas.map(
  (l) => [l, (l === 'pt' ? '' : '/' + l) + '/' + R.slugs.ajuda[l]]));

let falhas = 0;
const ok = (n, c, e) => { console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : '')); if (!c) falhas++; };

const br = await chromium.launch({ executablePath: CHROME_WS });

/* Sem site de pé a régua PULA dizendo isso, em vez de reprovar o produto por
   uma esteira que não subiu. */
{
  const pg = await (await br.newContext()).newPage();
  const r = await pg.goto(SITE + CAMINHO.pt, { timeout: 20000 }).catch(() => null);
  if (!r || !r.ok()) {
    console.log('PULADO  o site não respondeu em ' + SITE + ' (a esteira sobe o Next na 8802)');
    await br.close(); process.exit(0);
  }
  await pg.context().close();
}

console.log('[1] o índice é derivado dos títulos — nos cinco idiomas');
for (const [lang, caminho] of Object.entries(CAMINHO)) {
  const ctx = await br.newContext(); const pg = await ctx.newPage();
  await pg.goto(SITE + caminho);
  const m = await pg.evaluate(() => {
    const titulos = [...document.querySelectorAll('h2[id^="tema-"]')];
    const links = [...document.querySelectorAll('.ajTemas a')];
    return {
      titulos: titulos.map(h => h.textContent.trim()),
      ids: titulos.map(h => h.id),
      links: links.map(a => a.textContent.trim()),
      alvos: links.map(a => a.getAttribute('href')),
      foco: titulos.every(h => h.getAttribute('tabindex') === '-1'),
      paineis: document.querySelectorAll('.faq > details').length,
    };
  });
  const iguais = m.links.length === m.titulos.length &&
                 m.links.every((x, i) => x === m.titulos[i]);
  const ancoram = m.alvos.every(h => m.ids.includes(String(h).slice(1)));
  console.log(`  ${lang}  ${m.titulos.length} temas · ${m.paineis} painéis`);
  ok(`${lang}: o índice tem um item por tema, com o texto do tema`, iguais,
     iguais ? '' : JSON.stringify({ links: m.links, titulos: m.titulos }));
  ok(`${lang}: e todo link do índice cai num título que existe`, ancoram,
     ancoram ? '' : JSON.stringify({ alvos: m.alvos, ids: m.ids }));
  ok(`${lang}: o salto de âncora leva o foco junto`, m.foco);
  ok(`${lang}: os 45 painéis continuam lá`, m.paineis === 45, m.paineis === 45 ? '' : String(m.paineis));
  await ctx.close();
}

console.log('\n[2] sem JavaScript: o índice funciona e o campo não aparece');
{
  const ctx = await br.newContext({ javaScriptEnabled: false });
  const pg = await ctx.newPage();
  await pg.goto(SITE + CAMINHO.pt);
  const m = await pg.evaluate(() => ({
    links: document.querySelectorAll('.ajTemas a').length,
    campoEscondido: document.querySelector('.ajBusca').hidden,
    contaVazia: (document.querySelector('.ajConta').textContent || '').trim() === '',
    visiveis: [...document.querySelectorAll('.faq > details')].filter(d => !d.hidden).length,
  }));
  ok('os nove links do índice estão lá', m.links === 9, m.links === 9 ? '' : String(m.links));
  ok('o campo de busca NÃO aparece sem o script', m.campoEscondido);
  ok('e nada está escondido: o Ctrl+F continua alcançando tudo', m.visiveis === 45,
     m.visiveis === 45 ? '' : String(m.visiveis));
  ok('o contador não inventa número nenhum', m.contaVazia);
  await ctx.close();
}

console.log('\n[3] com JavaScript: o campo aparece e filtra');
{
  const ctx = await br.newContext(); const pg = await ctx.newPage();
  const erros = []; pg.on('pageerror', e => erros.push(e.message));
  await pg.goto(SITE + CAMINHO.pt);
  await pg.waitForFunction(() => !document.querySelector('.ajBusca').hidden, null, { timeout: 15000 })
    .catch(() => {});
  ok('agora o campo aparece', !(await pg.evaluate(() => document.querySelector('.ajBusca').hidden)));

  const estado = () => pg.evaluate(() => ({
    visiveis: [...document.querySelectorAll('.faq > details')].filter(d => !d.hidden).length,
    temas: [...document.querySelectorAll('h2[id^="tema-"]')].filter(h => !h.hidden).length,
    conta: (document.querySelector('.ajConta').textContent || '').trim(),
  }));

  await pg.fill('#ajQ', 'vocabulário');
  await pg.waitForTimeout(200);
  const a = await estado();
  console.log(`     "vocabulário" → ${a.visiveis} painéis, ${a.temas} temas · "${a.conta}"`);
  const reduziu = a.visiveis > 0 && a.visiveis < 45;
  ok('filtrar reduz a lista', reduziu, reduziu ? '' : `${a.visiveis} de 45`);
  const temaSumiu = a.temas > 0 && a.temas < 9;
  ok('e some com os temas que não têm nada', temaSumiu, temaSumiu ? '' : `${a.temas} de 9`);
  const diz = /\b45\b/.test(a.conta) && new RegExp('\\b' + a.visiveis + '\\b').test(a.conta);
  ok('o contador diz quantos de quantos', diz, diz ? '' : a.conta);

  /* ACENTO NÃO PODE SER OBRIGATÓRIO: quem procura no teclado do trabalho
     digita "vocabulario" e espera achar "vocabulário". */
  await pg.fill('#ajQ', 'vocabulario');
  await pg.waitForTimeout(200);
  const b = await estado();
  ok('sem acento acha o mesmo que com acento', b.visiveis === a.visiveis,
     b.visiveis === a.visiveis ? '' : `${b.visiveis} contra ${a.visiveis}`);

  /* Duas palavras é E, e não OU: quem escreve duas palavras está estreitando. */
  await pg.fill('#ajQ', 'vocabulario zzzznaoexiste');
  await pg.waitForTimeout(200);
  const c = await estado();
  ok('duas palavras estreitam, não alargam', c.visiveis === 0,
     c.visiveis === 0 ? '' : String(c.visiveis));
  ok('e sem resultado a página DIZ isso', c.conta.length > 10,
     c.conta.length > 10 ? '' : `contador diz "${c.conta}"`);

  /* O achado tem que estar aberto: quem procurou quer a resposta, e não mais
     um clique para vê-la. */
  await pg.evaluate(() => {
    document.querySelector('#ajQ').value = '';
    document.querySelector('#ajQ').dispatchEvent(new Event('input'));
    for (const d of document.querySelectorAll('.faq > details')) d.open = false;
  });
  await pg.fill('#ajQ', 'vocabulario');
  await pg.waitForTimeout(200);
  const abertos = await pg.evaluate(() =>
    [...document.querySelectorAll('.faq > details')].filter(d => !d.hidden && d.open).length);
  ok('o painel encontrado vem aberto', abertos === a.visiveis,
     abertos === a.visiveis ? '' : `${abertos} de ${a.visiveis}`);

  /* E limpar devolve a página como ela estava — inclusive o que a pessoa tinha
     recolhido de propósito ANTES de procurar. Recolhi todos acima. */
  await pg.press('#ajQ', 'Escape');
  await pg.waitForTimeout(200);
  const d = await pg.evaluate(() => ({
    valor: document.querySelector('#ajQ').value,
    visiveis: [...document.querySelectorAll('.faq > details')].filter(x => !x.hidden).length,
    abertos: [...document.querySelectorAll('.faq > details')].filter(x => x.open).length,
    conta: (document.querySelector('.ajConta').textContent || '').trim(),
  }));
  ok('Esc limpa o campo', d.valor === '', d.valor);
  ok('e devolve os 45', d.visiveis === 45, d.visiveis === 45 ? '' : String(d.visiveis));
  ok('e devolve o recolhido como estava, sem reabrir por conta própria',
     d.abertos === 0, d.abertos === 0 ? '' : String(d.abertos));
  ok('e o contador some junto', d.conta === '', d.conta);
  ok('sem erro de JavaScript', erros.length === 0, erros.join(' | ').slice(0, 200));
  await ctx.close();
}

console.log('\n[4] o alemão: trema digitado como "ue", e a largura de um telefone');
{
  const ctx = await br.newContext({ viewport: { width: 380, height: 800 } });
  const pg = await ctx.newPage();
  const erros = []; pg.on('pageerror', e => erros.push(e.message));
  await pg.goto(SITE + CAMINHO.de);
  await pg.waitForFunction(() => !document.querySelector('.ajBusca').hidden, null, { timeout: 15000 })
    .catch(() => {});

  /* Uma palavra que existe na página em alemão E tem trema. Ela é DESCOBERTA,
     e não escrita aqui: uma palavra escrita à mão nesta linha vira uma régua
     que reprova no dia em que alguém melhorar uma frase da Ajuda. */
  const palavra = await pg.evaluate(() => {
    const txt = [...document.querySelectorAll('.faq > details')].map(d => d.textContent).join(' ');
    const m = txt.match(/[A-Za-zÄÖÜäöüß]*[äöü][A-Za-zÄÖÜäöüß]{3,}/);
    return m ? m[0] : '';
  });
  if (!palavra) {
    console.log('  BLOCO PULADO  nenhuma palavra com trema na Ajuda em alemão');
  } else {
    const conta = async (q) => {
      await pg.fill('#ajQ', q); await pg.waitForTimeout(200);
      return pg.evaluate(() => [...document.querySelectorAll('.faq > details')].filter(d => !d.hidden).length);
    };
    const comTrema = await conta(palavra);
    const digitado = palavra.replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue');
    const semTrema = await conta(digitado);
    console.log(`     "${palavra}" → ${comTrema}   |   "${digitado}" → ${semTrema}`);
    ok('a palavra com trema acha alguma coisa', comTrema > 0, comTrema > 0 ? '' : '0');
    ok('e digitada como "ue" acha o mesmo', semTrema === comTrema,
       semTrema === comTrema ? '' : `${semTrema} contra ${comTrema}`);
    await pg.fill('#ajQ', '');
  }

  /* A régua de rolagem horizontal do Build 13, aplicada ao bloco novo: os
     temas em alemão são os rótulos mais longos do site. */
  await pg.waitForTimeout(200);
  const larg = await pg.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    janela: window.innerWidth,
  }));
  const coube = larg.doc <= larg.janela + 1;
  ok('a 380px o índice não empurra a página para o lado', coube,
     coube ? '' : `documento ${larg.doc}px numa janela de ${larg.janela}px`);
  ok('sem erro de JavaScript no alemão', erros.length === 0, erros.join(' | ').slice(0, 200));
  await ctx.close();
}

await br.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nA busca da Ajuda: tudo passou.');
process.exit(falhas ? 1 : 0);

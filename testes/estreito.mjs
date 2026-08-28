/* A PÁGINA NUM TELEFONE, E OS MARCOS QUE O LEITOR DE TELA PROCURA.
 *
 * Duas afirmações, e as duas nasceram de MEDIÇÃO e não de opinião.
 *
 * 1. NADA ROLA PARA O LADO A 380px. Medido antes do conserto, nas 70
 *    combinações de página e idioma que o site publica: DEZENOVE rolavam na
 *    horizontal. Em 17 o culpado era a `table.legal`; nas outras 4, uma palavra
 *    comprida no título em alemão — `Datenschutzerklärung` sobrava 49px sozinha.
 *
 *    A pior era `/de/privacidade`, com 464px de transbordo: quase uma segunda
 *    tela inteira para o lado. E são justamente as páginas legais — as que quem
 *    avalia fornecedor abre, e abre no telefone.
 *
 *    O conserto tem duas metades, e nenhuma encolhe conteúdo: a tabela rola
 *    DENTRO da caixa dela (`lib/site.ts` embrulha, o `.tabRola` rola), e os
 *    títulos hifenizam pelo dicionário do idioma que o `lang` declara.
 *
 * 2. TODA PÁGINA TEM `main` E LINK DE PULAR. Havia `header`, `nav` e `footer` —
 *    e nenhum `main`. O leitor de tela anunciava três regiões e nenhuma delas
 *    era o texto, e quem navega por teclado atravessava os oito links do menu
 *    antes de chegar ao conteúdo, em cada página.
 *
 * O QUE ESTA RÉGUA NÃO É: uma auditoria de acessibilidade. Ela cobre dois itens
 * medíveis por máquina. Leitor de tela de verdade (NVDA, VoiceOver) e zoom 200%
 * continuam dependendo de máquina física, e continuam fora.
 *
 *   node testes/estreito.mjs
 */
import { chromium } from './_navegador.mjs';
import fs from 'fs';

import { exigirNext, ALVO } from './proxy.mjs';
import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';

await exigirNext();

let falhas = 0;
const ok = (n, c, e) => {
  console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : ''));
  if (!c) falhas++;
};

/* As rotas saem do `rotas.json`, e não de uma lista escrita aqui — é a mesma
   armadilha que o `contradicao.mjs` documenta: procurar a ausência de um
   defeito numa página que não existe sempre dá certo. */
const R = JSON.parse(fs.readFileSync(`${RAIZ_WS}/src/rotas.json`, 'utf8'));
/* A home não tem slug — ela É a raiz do idioma. Escrever `slugs.home` daria
   `undefined` e derrubaria a régua no meio, que foi o que aconteceu. */
const endereco = (p, L) =>
  p === 'home' ? (L === 'pt' ? '/' : '/' + L)
               : (L === 'pt' ? '' : '/' + L) + '/' + R.slugs[p][L];
const PAGINAS = Object.keys(R.slugs).filter(
  (p) => !Object.keys(R.aposentadas || {}).includes(p));

/* 380px é um telefone comum de verdade — não o menor que existe, o COMUM. */
const LARGURA = 380;

const br = await chromium.launch({ executablePath: CHROME_WS });
const ctx = await br.newContext({ viewport: { width: LARGURA, height: 800 } });
const pg = await ctx.newPage();

console.log(`[1] nada rola para o lado a ${LARGURA}px`);
{
  const ruins = [];
  let medidas = 0;
  for (const p of PAGINAS) {
    for (const L of R.idiomas) {
      const rota = endereco(p, L);
      const r = await pg.goto(ALVO + rota, { waitUntil: 'domcontentloaded' }).catch(() => null);
      if (!r || r.status() >= 400) continue;
      medidas++;
      await pg.waitForTimeout(90);
      const m = await pg.evaluate(() => {
        const de = document.documentElement;
        /* Quem está DENTRO de uma caixa que rola não conta: rolar ali é o
           comportamento desejado, e foi para isso que a caixa existe. */
        const emRolagem = (e) => {
          for (let a = e.parentElement; a; a = a.parentElement) {
            const o = getComputedStyle(a).overflowX;
            if (o === 'auto' || o === 'scroll') return true;
          }
          return false;
        };
        const culpados = [];
        for (const e of document.querySelectorAll('body *')) {
          if (emRolagem(e)) continue;
          const b = e.getBoundingClientRect();
          const largo = b.right > innerWidth + 1 && b.width > 4;
          /* O texto que não cabe na própria caixa: a caixa mede certo e o
             conteúdo passa. Foi assim que as quatro páginas alemãs sobraram
             depois de a tabela ser resolvida. */
          const texto = e.children.length === 0 && e.scrollWidth > e.clientWidth + 1;
          if (largo || texto) {
            culpados.push(e.tagName.toLowerCase() +
              (typeof e.className === 'string' && e.className
                ? '.' + e.className.trim().split(/\s+/)[0] : '') +
              ' "' + (e.textContent || '').trim().slice(0, 28) + '"');
          }
        }
        return { sobra: de.scrollWidth - de.clientWidth, culpados: culpados.slice(0, 2) };
      });
      if (m.sobra > 1) ruins.push(`${rota} +${m.sobra}px  ${m.culpados.join(' · ')}`);
    }
  }
  console.log(`     ${medidas} combinações de página e idioma`);
  for (const r of ruins.slice(0, 8)) console.log(`     ${r}`);
  ok(`nenhuma das ${medidas} rola para o lado`, ruins.length === 0,
     `${ruins.length} rolam`);
  /* A régua tem de estar MEDINDO alguma coisa: se as rotas sumirem do
     `rotas.json`, o laço acima roda zero vezes e "nenhuma rola" fica verde
     sem ter olhado nada. */
  ok('e a régua mediu o site inteiro, e não uma lista vazia', medidas >= 60,
     String(medidas));
}

console.log('\n[2] no telefone a tabela empilha; na tela larga ela volta a ser tabela');
{
  /* A `/de/privacidade` é a pior das setenta: quatro tabelas, e o alemão. */
  await pg.goto(ALVO + endereco('privacidade', 'de'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(150);
  const m = await pg.evaluate(() => {
    const caixas = [...document.querySelectorAll('.tabRola')];
    return {
      quantas: caixas.length,
      soltas: document.querySelectorAll('table.legal:not(.tabRola table.legal)').length,
      rolam: caixas.filter((c) => c.scrollWidth > c.clientWidth + 1).length,
      alcancaveis: caixas.filter((c) => c.getAttribute('tabindex') === '0').length,
      comNome: caixas.filter((c) => (c.getAttribute('aria-label') || '').length > 0).length,
    };
  });
  ok('as tabelas estão embrulhadas', m.quantas >= 2, String(m.quantas));
  ok('e nenhuma ficou solta', m.soltas === 0, String(m.soltas));
  /* ---- A 380px A TABELA EMPILHA, E POR ISSO NADA ROLA ----

     Esta afirmação era o contrário: `m.rolam >= 1`, "se nenhuma rola, a caixa
     não está fazendo nada". Ela estava certa enquanto rolar era o desenho —
     e o desenho mudou porque rolar resolvia o TRANSBORDO e não a LEITURA:
     medido, a pior destas tabelas tinha 3452px numa tela de 380, nove telas
     para o lado, e a primeira coluna rolava para fora, de modo que na quarta
     coluna ninguém sabia mais em que linha estava.

     Agora, no telefone, cada linha vira um cartão e cada célula leva o nome da
     coluna junto. Rolar ali passou a ser sintoma: se rolou, alguma coisa não
     empilhou. A caixa continua existindo, e continua rolando ACIMA de 640px —
     é o que o bloco seguinte cobra. */
  ok('a 380px nenhuma tabela rola para o lado — elas empilham', m.rolam === 0,
     m.rolam === 0 ? '' : `${m.rolam} ainda rolam`);
  /* E empilhar de verdade: `display:block` nas células, com o rótulo da coluna
     dentro de cada uma. Sem esta segunda afirmação, um `overflow:hidden` que
     apenas CORTASSE a tabela passaria na primeira — e cortar é pior que rolar,
     porque some com a informação sem dizer que sumiu. */
  const emp = await pg.evaluate(() => {
    const td = document.querySelector('.tabRola td');
    const cab = document.querySelector('.tabRola tr.cabTab, .tabRola thead');
    return { display: td ? getComputedStyle(td).display : '',
             rotulo: td ? (td.getAttribute('data-rot') || '') : '',
             comRotulo: document.querySelectorAll('.tabRola td[data-rot]').length,
             /* O NOME DESENHADO, e não o atributo. A primeira versão conferia
                só a presença do `data-rot` — e passou inteira com o `content`
                do `::before` trocado por vazio, ou seja, com a tabela empilhada
                e SEM nome de coluna nenhum, que é exatamente o estado que este
                bloco existe para impedir. Atributo é intenção; `content` é o
                que a pessoa lê. */
             desenhado: td ? getComputedStyle(td, '::before').content : '',
             cabForaDaTela: cab ? Math.round(cab.getBoundingClientRect().right) < 0 : null };
  });
  ok('  as células viram blocos', emp.display === 'block', emp.display);
  ok('  cada uma leva o nome da coluna junto', emp.comRotulo >= 8 && emp.rotulo.length > 0,
     `${emp.comRotulo} com rótulo; a primeira diz "${emp.rotulo}"`);
  ok('  e o nome é DESENHADO, não só declarado no atributo',
     emp.desenhado.includes(emp.rotulo) && emp.desenhado.length > 2, emp.desenhado.slice(0, 40));
  /* O cabeçalho sai da tela por POSIÇÃO, e não com `display:none`: ele continua
     existindo para o leitor de tela, que ainda pode querer a estrutura. */
  ok('  e o cabeçalho sai da tela sem deixar de existir', emp.cabForaDaTela === true,
     String(emp.cabForaDaTela));

  /* ---- E ACIMA DE 640px ELA VOLTA A SER TABELA ----
     Sem esta afirmação, empilhar em TODA largura passaria — e aí quem lê num
     computador perderia a comparação entre colunas, que é a razão de a tabela
     existir. O embrulho que rola continua sendo o que segura os casos largos
     lá em cima; é aqui que se prova que ele ainda tem serviço. */
  await pg.setViewportSize({ width: 1100, height: 800 });
  await pg.waitForTimeout(200);
  const larga = await pg.evaluate(() => {
    const t = document.querySelector('.tabRola table');
    const td = t && t.querySelector('td');
    const cab = document.querySelector('.tabRola tr.cabTab, .tabRola thead');
    return { tabela: t ? getComputedStyle(t).display : '',
             celula: td ? getComputedStyle(td).display : '',
             cabNaTela: cab ? Math.round(cab.getBoundingClientRect().right) > 0 : null };
  });
  ok('a 1100px ela volta a ser tabela', larga.tabela === 'table', larga.tabela);
  ok('  com as células lado a lado', larga.celula === 'table-cell', larga.celula);
  ok('  e o cabeçalho de volta na tela', larga.cabNaTela === true, String(larga.cabNaTela));
  await pg.setViewportSize({ width: LARGURA, height: 800 });
  ok('e o teclado alcança a caixa que rola', m.alcancaveis === m.quantas,
     `${m.alcancaveis} de ${m.quantas}`);
  ok('com nome, para o leitor de tela anunciar', m.comNome === m.quantas,
     `${m.comNome} de ${m.quantas}`);
}

console.log('\n[3] main e link de pular, em toda página e nos cinco idiomas');
{
  const AMOSTRA = ['home', 'precos', 'privacidade', 'seguranca', 'ajuda'];
  for (const p of AMOSTRA) {
    for (const L of R.idiomas) {
      const rota = endereco(p, L);
      const r = await pg.goto(ALVO + rota, { waitUntil: 'domcontentloaded' }).catch(() => null);
      if (!r || r.status() >= 400) continue;
      const m = await pg.evaluate(() => {
        const pular = document.querySelector('a.pular');
        const foco = [...document.querySelectorAll('a[href],button,input,select,textarea')]
          .filter((e) => e.offsetParent !== null || e === pular)[0];
        return {
          temMain: document.querySelectorAll('main').length,
          alvo: pular ? pular.getAttribute('href') : '',
          texto: pular ? (pular.textContent || '').trim() : '',
          /* O link tem de ser o PRIMEIRO tabulável: um link de pular no meio
             da página não poupa nada. */
          primeiro: !!pular && foco === pular,
          existeAlvo: !!document.getElementById('conteudo'),
        };
      });
      ok(`${rota}: um main, e um só`, m.temMain === 1, String(m.temMain));
      ok(`${rota}: link de pular, primeiro do teclado`,
         m.primeiro && m.alvo === '#conteudo' && m.existeAlvo,
         `primeiro=${m.primeiro} alvo=${m.alvo} existe=${m.existeAlvo}`);
      /* Traduzido, e não em português em toda página. */
      ok(`${rota}: e traduzido`, m.texto.length > 3 && !/\{\{/.test(m.texto), m.texto);
    }
  }
}

console.log('\n[4] escondido até o foco — e visível quando ele chega');
{
  /* `display:none` tiraria o link da ordem de tabulação, que é o oposto do que
     ele existe para fazer. Ele sai da tela por POSIÇÃO. */
  await pg.goto(ALVO + '/precos', { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(120);
  const antes = await pg.evaluate(() => {
    const a = document.querySelector('a.pular');
    const b = a.getBoundingClientRect();
    return { fora: b.right < 0 || b.left > innerWidth, display: getComputedStyle(a).display };
  });
  ok('nasce fora da tela', antes.fora === true, JSON.stringify(antes));
  ok('mas NÃO com display:none — senão o teclado não o alcança',
     antes.display !== 'none', antes.display);
  await pg.keyboard.press('Tab');
  await pg.waitForTimeout(150);
  const depois = await pg.evaluate(() => {
    const a = document.querySelector('a.pular');
    const b = a.getBoundingClientRect();
    return { focado: document.activeElement === a, dentro: b.left >= 0 && b.right <= innerWidth };
  });
  ok('o primeiro Tab chega nele', depois.focado === true, JSON.stringify(depois));
  ok('e aí ele aparece', depois.dentro === true, JSON.stringify(depois));
}

await br.close();
console.log(falhas ? `\n${falhas} FALHA(S)`
                   : '\nTelefone e marcos: nada rola para o lado, e o conteúdo tem nome.');
process.exit(falhas ? 1 : 0);

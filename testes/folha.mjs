/* A FOLHA DE ESTILO DO SITE E QUEM A USA, CONFERIDAS UMA CONTRA A OUTRA.
 *
 * Este arquivo nasceu de um defeito com duas metades, uma de cada lado da
 * folha, e ninguém tinha visto nenhuma das duas:
 *
 *   .passos        cinquenta listas de passos escrevendo uma classe sem regra
 *   .passosRodada  a regra escrita para elas, com um nome que nenhum arquivo cita
 *
 * As duas ao mesmo tempo, na mesma folha. E o mesmo par de novo, mais abaixo:
 * `table.cmpPlanos` estilizava a tabela de comparação que o `build.py` emite
 * como `cmpCurta`.
 *
 * NENHUMA DAS DUAS METADES DÁ ERRO. Classe sem regra cai no padrão do
 * navegador; regra sem classe não pinta nada. O CSS não reclama de nenhuma das
 * duas, e é por isso que elas envelhecem juntas por meses.
 *
 * ESTA RÉGUA COBRA OS DOIS SENTIDOS:
 *
 *   1. toda classe escrita no HTML do site tem regra em algum lugar;
 *   2. toda regra da folha tem alguém que a escreve.
 *
 * O QUE ELA NÃO OLHA: `src/template.html`. A ferramenta tem folha própria,
 * embutida, porque ela é um arquivo só e não pode baixar o `site.css` — as duas
 * são separadas de propósito, e cobrar uma contra a outra reprovaria o desenho.
 *
 * EXCEÇÕES SÃO ESCRITAS, COM O MOTIVO, e saem impressas em toda execução.
 */
import fs from 'fs';
import path from 'path';

import { RAIZ_WS } from './_caminhos.mjs';

/* Classes que PODEM existir sem regra, e por quê. */
const SEM_REGRA_OK = {
  heroTxt: 'nomeia a primeira coluna do `.heroDuo`, que é um grid — o filho já ' +
           'se posiciona sozinho. Ela existe para o teste e para quem lê o HTML ' +
           'saber o que é aquela metade, e não para pintar nada.',
};

/* Regras que PODEM existir sem ninguém escrevê-las, e por quê. */
const SEM_USO_OK = {};

let falhas = 0;
const ok = (n, c, e) => {
  console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : ''));
  if (!c) falhas++;
};

const FOLHA = path.join(RAIZ_WS, 'public/site.css');
const css = fs.readFileSync(FOLHA, 'utf8');
/* Sem comentários: `/* .foo ... *\/` cita nomes de classe o tempo todo, e uma
   classe citada num comentário não tem regra nenhuma. */
const cssVivo = css.replace(/\/\*[\s\S]*?\*\//g, ' ');
const definidas = new Set(cssVivo.match(/\.[A-Za-z][\w-]*/g)?.map((s) => s.slice(1)) || []);

/* QUEM ESCREVE CLASSE NO SITE — e a lista tem de estar inteira.
   Não é só o HTML dos corpos: o `build.py` monta os cartões de preço, o
   `lib/site.ts` monta os selos, o `support.js` monta a aba lateral, e o painel
   da conta e o blog são React em `app/`. Deixar `build.py` de fora fez a minha
   primeira varredura chamar de morta uma regra viva; deixar `app/` de fora fez
   a segunda condenar trinta e duas regras do painel e do blog. A régua só vale
   se ela olhar para todo mundo que pinta. */
const EMISSORES = ['build.py', 'src/site/support.js'];
const PASTAS_EMISSORAS = ['app', 'lib'];

function arquivosHtml() {
  const raiz = path.join(RAIZ_WS, 'src/site');
  const fora = [];
  (function andar(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) andar(p);
      else if (e.name.endsWith('.html')) fora.push(p);
    }
  })(raiz);
  return fora;
}

console.log('[1] toda classe escrita no site tem regra em algum lugar');
const usadas = new Map();      // classe → arquivos
const semRegra = new Map();
for (const p of arquivosHtml()) {
  const t = fs.readFileSync(p, 'utf8');
  /* O que o `<style>` do próprio arquivo define conta como regra: as páginas
     legais e a `/link` trazem folha própria, e é legítimo. */
  const proprias = new Set(
    (t.match(/<style[^>]*>[\s\S]*?<\/style>/g) || []).join(' ')
      .match(/\.[A-Za-z][\w-]*/g)?.map((s) => s.slice(1)) || []);
  const limpo = t.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '');
  for (const m of limpo.matchAll(/class="([^"]*)"/g)) {
    /* Classe montada em código não é literal — o valor aqui é um molde. */
    if (/[{}$'`+]/.test(m[1])) continue;
    for (const c of m[1].split(/\s+/).filter(Boolean)) {
      if (!usadas.has(c)) usadas.set(c, new Set());
      usadas.get(c).add(path.basename(p));
      if (!definidas.has(c) && !proprias.has(c)) {
        if (!semRegra.has(c)) semRegra.set(c, new Set());
        semRegra.get(c).add(path.basename(p));
      }
    }
  }
}
const orfas = [...semRegra].filter(([c]) => !SEM_REGRA_OK[c]);
ok(`as ${usadas.size} classes do site têm regra`, orfas.length === 0,
   orfas.map(([c, a]) => `.${c} (${a.size} arquivo(s))`).join(', '));

console.log('\n[2] toda regra da folha tem alguém que a escreva');
function varrer(dir, ext) {
  const fora = [];
  if (!fs.existsSync(dir)) return fora;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) fora.push(...varrer(p, ext));
    else if (ext.some((x) => e.name.endsWith(x))) fora.push(p);
  }
  return fora;
}
const fontes = [
  ...EMISSORES.map((f) => path.join(RAIZ_WS, f)).filter((f) => fs.existsSync(f)),
  ...PASTAS_EMISSORAS.flatMap((d) => varrer(path.join(RAIZ_WS, d), ['.ts', '.tsx'])),
];
const emissor = fontes.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
const naoUsadas = [...definidas].filter((c) =>
  !usadas.has(c) && !new RegExp(`\\b${c.replace(/[-]/g, '\\-')}\\b`).test(emissor) && !SEM_USO_OK[c]);
ok(`as ${definidas.size} regras da folha têm quem as escreva (${fontes.length} fontes varridas)`, naoUsadas.length === 0,
   naoUsadas.map((c) => '.' + c).join(', '));

console.log('\n[3] as exceções, ditas com todas as letras');
const listar = (mapa, titulo) => {
  const itens = Object.entries(mapa);
  if (!itens.length) return;
  for (const [c, porque] of itens) console.log(`  .${c} — ${titulo}\n     por que: ${porque}`);
};
listar(SEM_REGRA_OK, 'usada sem regra');
listar(SEM_USO_OK, 'regra sem uso');
if (!Object.keys(SEM_REGRA_OK).length && !Object.keys(SEM_USO_OK).length) console.log('  nenhuma.');
/* Perdão órfão é lixo que esconde o próximo defeito. */
const perdaoVelho = [
  ...Object.keys(SEM_REGRA_OK).filter((c) => !semRegra.has(c)),
  ...Object.keys(SEM_USO_OK).filter((c) => usadas.has(c) || !definidas.has(c)),
];
ok('nenhuma exceção sobrou perdoando o que já foi consertado', perdaoVelho.length === 0,
   perdaoVelho.length ? perdaoVelho.join(', ') + ' — tire da lista' : '');

console.log(falhas ? `\n${falhas} FALHA(S)`
                   : '\nA folha e quem a usa dizem a mesma coisa.');
process.exit(falhas ? 1 : 0);

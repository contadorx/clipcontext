/* A CONTENT-SECURITY-POLICY, MEDIDA EM VEZ DE ESPERADA.
 *
 * A DEC-12 caminho A dizia: "CSP em Report-Only por uma semana, ler os
 * relatórios, então travar". A semana existe porque ninguém sabe, antes de
 * ligar, o que a regra vai barrar — e barrar a transcrição é desligar o
 * produto.
 *
 * Esta régua troca a semana por uma medição. Ela abre as páginas e a ferramenta
 * num navegador de verdade, com a CSP que o `next.config.mjs` publica, escuta
 * os eventos `securitypolicyviolation` e CONTA. O que uma semana de produção
 * daria em relatórios esparsos — e só das páginas que alguém visitou — ela dá
 * agora, em todas, e de forma repetível.
 *
 * E ela vira trava: no dia em que alguém colar um `<script>` solto numa página,
 * a régua fica vermelha antes de a CSP travar em produção.
 *
 * O QUE ELA NÃO ALCANÇA, e é por isso que a CSP entra em `Report-Only`:
 *
 *   1. O CAMINHO DA TRANSCRIÇÃO. A biblioteca e os pesos do modelo vêm de
 *      `cdn.jsdelivr.net` e `huggingface.co`, e as duas são inalcançáveis da
 *      máquina onde esta régua roda (403 no proxy). As origens estão na regra
 *      porque estão no código, não porque foram vistas passando.
 *   2. O GOOGLE DRIVE, que é recurso desligado hoje.
 *
 * Enquanto estes dois não forem medidos com rede de verdade, travar a CSP é
 * apostar. `Report-Only` não aposta: ele conta.
 *
 *   node testes/csp.mjs
 */
import { chromium } from './_navegador.mjs';
import http from 'http';
import fs from 'fs';

import { criarProxy, exigirNext, ALVO } from './proxy.mjs';
import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';

await exigirNext();

let falhas = 0;
const ok = (n, c, e) => {
  console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : ''));
  if (!c) falhas++;
};

const srv = criarProxy();
await new Promise((r) => srv.listen(8962, r));
const BASE = 'http://localhost:8962';

/* ---- [1] o cabeçalho existe, e é o do arquivo de configuração ------------ */
console.log('[1] a regra sai no cabeçalho, e é a que está escrita');
const cfg = fs.readFileSync(`${RAIZ_WS}/next.config.mjs`, 'utf8');
let cabecalho = '';
{
  const r = await fetch(`${ALVO}/precos`);
  cabecalho = r.headers.get('content-security-policy-report-only') || '';
  ok('a página responde a CSP em Report-Only', cabecalho.length > 50,
     cabecalho.slice(0, 60) || '(sem cabeçalho)');
  /* EM Report-Only, E NÃO TRAVANDO. Enquanto os dois caminhos de cima não forem
     medidos com rede, travar é apostar — e a aposta perdida desliga a
     transcrição, que é o que a pessoa veio fazer. */
  ok('e NÃO está travando ainda',
     !(await fetch(`${ALVO}/precos`)).headers.get('content-security-policy'),
     'existe um Content-Security-Policy que trava');

  /* As diretivas que fazem a regra valer alguma coisa. Sem `object-src` e
     `base-uri`, uma injeção de HTML ainda executa. */
  for (const d of ["default-src 'self'", "object-src 'none'", "base-uri 'self'",
                   "frame-ancestors 'none'", "form-action 'self'"]) {
    ok(`a regra tem "${d}"`, cabecalho.includes(d), cabecalho.slice(0, 80));
  }
  /* A LINHA QUE VALE: script sem `unsafe-inline`. É ali que uma CSP separa
     "documento de conformidade" de "regra que impede alguma coisa". */
  const script = (cabecalho.match(/script-src [^;]*/) || [''])[0];
  ok('e o script NÃO ganhou unsafe-inline', !/unsafe-inline/.test(script), script);
  /* O WebAssembly é obrigatório: a transcrição É WebAssembly. */
  ok('mas ganhou wasm-unsafe-eval, que é a transcrição',
     /wasm-unsafe-eval/.test(script), script);
}

/* ---- [2] as páginas do site, medidas de verdade -------------------------- */
const br = await chromium.launch({ executablePath: CHROME_WS });
const ctx = await br.newContext();

/** Abre uma página e devolve as violações que o navegador anunciou. */
async function violacoes(url, exercitar) {
  const pg = await ctx.newPage();
  await pg.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__csp.push({
        diretiva: e.effectiveDirective || e.violatedDirective,
        alvo: String(e.blockedURI || '').slice(0, 90),
        /* O trecho barrado, que só chega porque a regra pede `report-sample`.
           É ele que diz se o script é nosso ou do framework. */
        amostra: String(e.sample || '').slice(0, 60),
        linha: e.lineNumber || 0,
      });
    });
  });
  await pg.goto(url, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(700);
  if (exercitar) await exercitar(pg);
  const v = await pg.evaluate(() => window.__csp || []);
  await pg.close();
  return v;
}

/* Um resumo legível: a mesma diretiva repetida trinta vezes é UM problema, e
   não trinta. Contar linha por linha esconde quantos problemas existem. */
const resumir = (v) => {
  const m = new Map();
  for (const x of v) {
    const k = `${x.diretiva} ← ${x.alvo || '(inline)'}` +
              (x.amostra ? `  [${x.amostra}]` : '');
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()].map(([k, n]) => `${k} ×${n}`);
};

/* ---- O QUE AINDA VIOLA, NOMEADO UM POR UM -------------------------------
 *
 * A régua NÃO fica vermelha pelo que já se sabe — ela fica vermelha quando
 * aparece coisa NOVA. Um teste que reprova por um estado conhecido é um teste
 * que se aprende a ignorar, e a lista abaixo é o que a segunda metade da DEC-12
 * tem de resolver antes de travar.
 *
 * São quatro trechos, e a diferença entre eles decide a saída:
 *
 *   window.va=…            a medição da Vercel. Conteúdo fixo → HASH resolve.
 *   /* Os dois compor…     nosso, na página. Conteúdo fixo → HASH resolve.
 *   /* Só registra a esc…  nosso, o idioma lembrado (só na home). Fixo → HASH.
 *   (function(){ const $…  nosso, na ferramenta. Fixo → HASH resolve.
 *   (self.__next_f=…)      o arranque do Next. Fixo → HASH resolve.
 *   self.__next_f.push([1  A CARGA DO NEXT, e é ela que decide tudo: o conteúdo
 *                          MUDA A CADA PÁGINA, então não há hash que sirva.
 *                          Travar a CSP exige NONCE — e nonce em Next torna a
 *                          página dinâmica, o que num site quase todo estático
 *                          é um custo de verdade, não um detalhe.
 *
 * É exatamente esta a resposta que a semana de Report-Only ia dar. Ela está
 * aqui, medida, e o próximo build começa sabendo.
 */
const CONHECIDOS = [
  { marca: 'window.va=', quem: 'medição da Vercel', saida: 'hash' },
  { marca: 'Os dois comportamentos', quem: 'nosso, na página', saida: 'hash' },
  { marca: 'const $ = id => document', quem: 'nosso, na ferramenta', saida: 'hash' },
  { marca: 'Só registra a escolha', quem: 'nosso, o idioma lembrado', saida: 'hash' },
  { marca: '(self.__next_f=', quem: 'arranque do Next', saida: 'hash' },
  { marca: 'self.__next_f.push([1', quem: 'carga do Next', saida: 'NONCE' },
];
const conhecido = (v) =>
  !!v.amostra && CONHECIDOS.some((c) => v.amostra.includes(c.marca));

console.log('\n[2] as páginas do site, com a regra ligada');
const novasDoSite = [];
{
  const PAGINAS = ['/', '/precos', '/seguranca', '/privacidade.html', '/termos.html',
                   '/ajuda', '/en/pricing', '/de/preise', '/fr/tarifs', '/es/precios'];
  for (const rota of PAGINAS) {
    const v = await violacoes(BASE + rota);
    const novas = v.filter((x) => !conhecido(x));
    if (novas.length) console.log(`     ${rota}\n       ` + resumir(novas).join('\n       '));
    ok(`${rota}: nenhuma violação NOVA`, novas.length === 0,
       resumir(novas).join(' | ').slice(0, 140));
    novasDoSite.push(...novas);
  }
  console.log(`     ${PAGINAS.length} páginas medidas`);
}

/* ---- [3] a ferramenta, que é onde a regra é mais apertada ---------------- */
console.log('\n[3] a ferramenta, sem tocar na rede de fora');
{
  /* A ferramenta é `public/app.html`, servida pelo Next como arquivo estático —
     então ela recebe o mesmo cabeçalho das páginas. Aqui ela é aberta e
     EXERCITADA no que dá para exercitar sem CDN: carregar um vídeo e extrair
     quadros. O caminho da transcrição não passa por aqui, e é por isso que a
     regra não trava. */
  const v = await violacoes(`${BASE}/app.html?lang=pt`, async (pg) => {
    await pg.selectOption('#modelo', 'evidencia').catch(() => {});
    await pg.setInputFiles('#file', '/tmp/amostra.webm').catch(() => {});
    await pg.waitForFunction(() => !document.getElementById('extract').disabled,
                             null, { timeout: 40000 }).catch(() => {});
    await pg.selectOption('#mode', 'count').catch(() => {});
    await pg.fill('#count', '3').catch(() => {});
    await pg.locator('#extract').click().catch(() => {});
    await pg.waitForFunction(() => document.querySelectorAll('#thumbs figure').length >= 3,
                             null, { timeout: 40000 }).catch(() => {});
    await pg.waitForTimeout(500);
  });
  const novas = v.filter((x) => !conhecido(x));
  if (novas.length) console.log('       ' + resumir(novas).join('\n       '));
  /* A PARTE QUE JÁ VALE HOJE: extrair quadros, montar as saídas e gravar não
     pedem NADA de fora. Se pedissem, apareceria aqui — e apareceria como
     `connect-src` ou `img-src`, não como script. */
  ok('a ferramenta trabalha sem pedir nada de fora', novas.length === 0,
     resumir(novas).join(' | ').slice(0, 200));
  const foraDeScript = v.filter((x) => !/script-src/.test(x.diretiva));
  ok('e nenhuma violação que não seja de script inline', foraDeScript.length === 0,
     resumir(foraDeScript).join(' | ').slice(0, 200));
}

/* ---- [4] a conta ---------------------------------------------------------*/
console.log('\n[4] a área da conta, deslogada');
{
  const v = await violacoes(`${BASE}/conta`);
  const novas = v.filter((x) => !conhecido(x));
  if (novas.length) console.log('       ' + resumir(novas).join('\n       '));
  ok('a conta não traz violação nova', novas.length === 0,
     resumir(novas).join(' | ').slice(0, 140));
}

/* ---- [4b] a lista de pendências não pode ter perdão órfão ---------------- */
console.log('\n[4b] a lista do que falta é honesta');
{
  /* Um perdão escrito que sobrevive ao conserto é lixo que esconde o próximo
     defeito — é a regra que o `tabelas.mjs` já aplica ao catálogo. Se um destes
     cinco deixar de aparecer, ele tem de sair daqui.
     Medido nas páginas E na ferramenta, porque três deles só existem num dos
     dois lugares. */
  const vistos = new Set();
  for (const rota of ['/', '/precos', '/app.html?lang=pt']) {
    for (const x of await violacoes(BASE + rota)) {
      for (const c of CONHECIDOS) if (x.amostra && x.amostra.includes(c.marca)) vistos.add(c.marca);
    }
  }
  const orfaos = CONHECIDOS.filter((c) => !vistos.has(c.marca));
  ok('nenhum item da lista já foi resolvido sem sair dela',
     orfaos.length === 0, orfaos.map((c) => c.quem).join(', '));
  console.log('     o que falta para travar:');
  for (const c of CONHECIDOS) console.log(`       ${c.saida.padEnd(6)} ${c.quem}`);
  const soNonce = CONHECIDOS.filter((c) => c.saida === 'NONCE');
  console.log(`     ${CONHECIDOS.length - soNonce.length} resolvem com hash · ` +
              `${soNonce.length} exige nonce`);
  /* A CONCLUSÃO, ESCRITA COMO AFIRMAÇÃO: enquanto houver um que só o nonce
     resolve, travar a CSP não é questão de apertar a regra — é questão de
     tornar as páginas dinâmicas. */
  ok('e a razão de ainda não travar continua sendo uma só', soNonce.length >= 1,
     'todos resolvem com hash: dá para travar, e esta linha tem de mudar');
}

/* ---- [5] e a regra PEGA o que tem de pegar ------------------------------- */
console.log('\n[5] a régua sabe reprovar');
{
  /* Uma régua que só sabe dizer "nenhuma violação" não distingue "a regra está
     certa" de "a regra não está ligada". Aqui um script solto é injetado de
     propósito: ele TEM de ser anunciado. */
  const pg = await ctx.newPage();
  await pg.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__csp.push({ diretiva: e.effectiveDirective || e.violatedDirective });
    });
  });
  await pg.goto(`${BASE}/precos`, { waitUntil: 'domcontentloaded' });
  await pg.evaluate(() => {
    const s = document.createElement('script');
    s.textContent = 'window.__entrou = true;';
    document.body.appendChild(s);
  });
  await pg.waitForTimeout(400);
  const v = await pg.evaluate(() => window.__csp || []);
  const entrou = await pg.evaluate(() => window.__entrou === true);
  ok('um script inline solto é anunciado', v.some((x) => /script-src/.test(x.diretiva)),
     JSON.stringify(v).slice(0, 120));
  /* E em Report-Only ele RODA — é isso que Report-Only quer dizer, e é por isso
     que ligá-la hoje não pode quebrar nada em produção. */
  ok('e em Report-Only ele ainda roda, que é o combinado', entrou === true,
     String(entrou));
  await pg.close();
}

await br.close();
srv.close();
console.log(falhas ? `\n${falhas} FALHA(S)`
                   : '\nCSP: a regra está no ar, medida, e ainda não trava.');
process.exit(falhas ? 1 : 0);

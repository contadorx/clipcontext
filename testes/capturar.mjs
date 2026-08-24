/* O ANTES E O DEPOIS DE UM BUILD VISUAL, em imagem e em número.
 *
 * Ele não afirma nada sozinho — é instrumento, e não régua. Existe porque um
 * build de CSS não se prova com teste de texto: `display:block` virando
 * `display:flex` passa em toda régua desta pasta e ainda assim pode estragar
 * dez páginas. O que responde a pergunta é olhar as duas versões.
 *
 * Uso, com o site já de pé em :8802:
 *
 *   node testes/capturar.mjs /tmp/antes          # antes de mexer
 *   LARG=390 node testes/capturar.mjs /tmp/antes-tel
 *   ... mexe, `npm run build`, sobe de novo ...
 *   node testes/capturar.mjs /tmp/depois
 *   node testes/capturar.mjs --diff /tmp/antes /tmp/depois
 *
 * O `--diff` compara pixel a pixel e diz quantas páginas ficaram IDÊNTICAS.
 * Esse é o número que importa: numa mudança que devia ser invisível, qualquer
 * página diferente é defeito; numa mudança deliberada, qualquer página que
 * mudou SEM estar na lista é defeito. Os dois lados precisam do mesmo dado.
 *
 * As páginas e os idiomas saem do `rotas.json` — escrever a lista aqui seria
 * mais uma lista paralela, que é o defeito que este projeto mais pagou.
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

import { RAIZ_WS } from './_caminhos.mjs';

const args = process.argv.slice(2);

if (args[0] === '--diff') {
  const [, A, D] = args;
  if (!A || !D) { console.error('uso: --diff <pastaAntes> <pastaDepois>'); process.exit(1); }
  /* A comparação é em Python: o Pillow já é dependência do `amostras.py`, e
     escrever um comparador de PNG em JS seria trazer biblioteca para repetir o
     que a máquina já tem. */
  const py = `
import sys, pathlib
from PIL import Image, ImageChops
A, D = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
iguais, mudaram, faltando = [], [], []
for f in sorted(A.glob('*.png')):
    g = D / f.name
    if not g.exists(): faltando.append(f.name); continue
    ia, ib = Image.open(f).convert('RGB'), Image.open(g).convert('RGB')
    if ia.size != ib.size:
        mudaram.append((f.name, f'{ia.size[1]}->{ib.size[1]}px de altura')); continue
    if ImageChops.difference(ia, ib).getbbox() is None: iguais.append(f.name)
    else:
        px = sum(1 for p in ImageChops.difference(ia, ib).getdata() if p != (0,0,0))
        mudaram.append((f.name, f'{px} pixels'))
print(f'{len(iguais)} idênticas · {len(mudaram)} mudaram' + (f' · {len(faltando)} sem par' if faltando else ''))
for n, q in mudaram: print(f'   mudou   {n:<26} {q}')
for n in faltando: print(f'   SEM PAR {n}')
`;
  console.log(execFileSync('python3', ['-c', py, A, D], { encoding: 'utf8' }));
  process.exit(0);
}

const DESTINO = args[0];
if (!DESTINO) {
  console.error('uso: node capturar.mjs <pasta>   |   node capturar.mjs --diff <antes> <depois>');
  process.exit(1);
}

const { chromium } = await import('playwright');
const { CHROME_WS } = await import('./_caminhos.mjs');
const LARG = Number(process.env.LARG || 1200);
const BASE = process.env.BASE || 'http://localhost:8802';
fs.mkdirSync(DESTINO, { recursive: true });

const rotas = JSON.parse(fs.readFileSync(path.join(RAIZ_WS, 'src/rotas.json'), 'utf8'));
const pre = (L) => (L === 'pt' ? '' : '/' + L);

const br = await chromium.launch({ executablePath: CHROME_WS });
const pg = await (await br.newContext({ viewport: { width: LARG, height: 900 },
                                        deviceScaleFactor: 1, colorScheme: 'light' })).newPage();
let n = 0;
for (const L of rotas.idiomas) {
  const paginas = [['home', pre(L) || '/'],
                   ...Object.keys(rotas.slugs).map((p) => [p, pre(L) + '/' + rotas.slugs[p][L]])];
  for (const [nome, url] of paginas) {
    await pg.goto(BASE + url, { waitUntil: 'networkidle' }).catch(() => {});
    /* Sem animação e sem vídeo: duas capturas do MESMO estado têm de sair
       iguais byte a byte, senão o diff mede o relógio em vez de medir o CSS. */
    await pg.addStyleTag({ content: '*,*::before,*::after{animation:none!important;' +
                                    'transition:none!important}video{visibility:hidden}' });
    await pg.evaluate(() => window.scrollTo(0, 0));
    await pg.waitForTimeout(150);
    await pg.screenshot({ path: path.join(DESTINO, `${nome}.${L}.png`), fullPage: true });
    n++;
  }
}
await br.close();
console.log(`${n} capturas em ${DESTINO} (largura ${LARG})`);

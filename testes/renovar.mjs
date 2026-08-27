/* A CHAVE AVISA ANTES DE VENCER — e se renova sozinha quando dá.
 *
 * O que existia: a licença vale 45 dias, nada a renovava, e no dia SEGUINTE ao
 * vencimento a ferramenta dizia "fale comigo para renovar". Depois de a marca
 * do cliente já ter sumido do documento, e sem dizer para onde ir. Quem paga
 * por ano voltava à conta oito vezes por ano para colar uma chave.
 *
 * E o `lib/stripe.ts` prometia, em comentário, "uma licença curta que se renova
 * sozinha". Ninguém cumpria.
 *
 * O QUE ESTA RÉGUA COBRA, e a segunda metade é a que importa:
 *
 *   1. Faltando poucos dias, a tela AVISA — com o número e o caminho da conta.
 *   2. Com muitos dias pela frente, ela NÃO avisa. Um aviso que aparece sempre
 *      é um aviso que ninguém lê, e aí o do décimo dia passa junto.
 *   3. Vencida, a licença não ativa — o que já valia e continua valendo.
 *
 * O LIMITE, dito aqui porque é onde alguém vai procurar: a renovação silenciosa
 * só acontece com SESSÃO na aba, e a sessão vive em `sessionStorage` com um
 * token que vence. No caso comum — trinta e cinco dias depois, noutra aba — não
 * há sessão, e o que salva a pessoa é o aviso. Renovar sem sessão exigiria uma
 * credencial de longa duração no navegador ou um cron mandando e-mail; as duas
 * mexem no que o produto promete. Está escrito no `BUILD-6.md`.
 */
import fs from 'fs';
import { appComChavesDeTeste, emitir, daquiADias } from './_licenca.mjs';
import http from 'http';
import { chromium } from './_navegador.mjs';

import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';

let falhas = 0;
const ok = (n, c, e) => {
  console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : ''));
  if (!c) falhas++;
};

const fonte = fs.readFileSync(`${RAIZ_WS}/src/template.html`, 'utf8');

/* ---- O BLOCO QUE PULAVA, E AGORA RODA ----
 *
 * Aqui estava escrito: "pintar o aviso exige uma licença que PASSE — e passar
 * exige assinatura Ed25519 da chave privada, que não viaja neste pacote". Era
 * verdade, e a conclusão foi medir só a DECISÃO no código.
 *
 * O Build 21 tirou essa parede: a régua gera o próprio par, assina uma licença
 * que vence em N dias e serve o app com a pública correspondente. Então o aviso
 * pode ser pintado de verdade — com a chave de produção continuando fora desta
 * máquina.
 *
 * E é aqui que a diferença aparece. Medir a decisão prova que a CONDIÇÃO
 * existe; só pintar prova que a pessoa VÊ a frase, com o número certo de dias e
 * com o caminho para a próxima chave. Uma condição certa que escreve num
 * elemento escondido é um aviso que não avisa. */
console.log('[0] o aviso pintado na tela, com licença assinada de verdade');
{
  const APP = appComChavesDeTeste();
  const srv = http.createServer((q, r) => {
    if (q.url.split('?')[0].startsWith('/_vercel/')) {
      r.writeHead(200, {'Content-Type':'text/javascript'}); return r.end('');
    }
    r.writeHead(200, {'Content-Type':'text/html'}); r.end(APP);
  });
  await new Promise((r) => srv.listen(8997, r));
  const br = await chromium.launch({ executablePath: CHROME_WS });

  /* Service worker bloqueado pelo motivo que o `liclink.mjs` documenta: as
     buscas dele não passam pelo route, e ele devolveria o app de produção. */
  const abrir = async (chave) => {
    const ctx = await br.newContext({ serviceWorkers: 'block' });
    const pg = await ctx.newPage();
    const erros = []; pg.on('pageerror', (e) => erros.push(e.message));
    await pg.goto(`http://localhost:8997/app.html?lang=pt&lic=${encodeURIComponent(chave)}`);
    await pg.waitForTimeout(700);
    const msg = (await pg.locator('#licMsg').textContent()) || '';
    const html = await pg.locator('#licMsg').innerHTML();
    const link = await pg.locator('#licMsg a').count();
    const href = link ? await pg.locator('#licMsg a').first().getAttribute('href') : '';
    await ctx.close();
    return { msg, html, link, href, erros };
  };

  /* Uma que vence DENTRO do prazo do aviso, e uma bem longe dele. O número sai
     do próprio produto: se alguém mudar o prazo, é o `RENOVAR_FALTANDO` que
     manda, e não um 10 escrito aqui. */
  const prazo = Number((fonte.match(/const RENOVAR_FALTANDO = (\d+);/) || [])[1]);
  ok('o produto declara o prazo do aviso', prazo > 0, prazo > 0 ? '' : String(prazo));

  const perto = await abrir(emitir('Cliente QA', 5, daquiADias(Math.max(1, prazo - 3))));
  const longe = await abrir(emitir('Cliente QA', 5, daquiADias(prazo + 120)));
  console.log(`     vencendo em ${Math.max(1, prazo - 3)} dias: ${JSON.stringify(perto.msg.slice(0, 78))}`);
  console.log(`     vencendo em ${prazo + 120} dias: ${JSON.stringify(longe.msg.slice(0, 60))}`);

  ok('a licença perto do fim ativa', /Licen[çc]a v[áa]lida/.test(perto.msg),
     /Licen[çc]a v[áa]lida/.test(perto.msg) ? '' : perto.msg.slice(0, 80));
  /* A FRASE APARECE, COM O NÚMERO DE DIAS DENTRO — e não só a condição é
     verdadeira. Comparar tamanhos de texto provaria que "algo a mais apareceu";
     o que se quer provar é que a pessoa lê quantos dias faltam, porque é o
     número que decide se ela age hoje ou semana que vem. */
    const dias = Math.max(1, prazo - 3);
  const temNumero = new RegExp('\\b' + dias + '\\b').test(perto.msg);
  ok('e o aviso diz quantos dias faltam', temNumero && perto.link > 0,
     temNumero && perto.link > 0 ? '' : perto.msg.slice(0, 110));
  /* E ele leva a algum lugar: um aviso que diz "renove" sem dizer onde é o
     defeito que este bloco existe para impedir. */
  ok('e ele leva para a conta, em vez de só mandar renovar',
     /\/conta/.test(perto.href || ''), perto.href || '(sem link)');
  ok('longe do fim, a tela não avisa nada', longe.link === 0,
     longe.link === 0 ? '' : longe.href || '');
  ok('sem erro de JavaScript', perto.erros.length === 0 && longe.erros.length === 0,
     [...perto.erros, ...longe.erros].join(' | ').slice(0, 150));

  await br.close(); srv.close();
}

console.log('[1] o prazo do aviso e o da renovação são o MESMO número');
{
  const quantas = (fonte.match(/const RENOVAR_FALTANDO\b/g) || []).length;
  ok('há uma constante para o prazo, e uma só', quantas === 1, String(quantas));
  /* Ela é lida nos dois lugares: a tela que avisa e a função que renova. Dois
     números com o mesmo propósito é a família de defeito que este projeto mais
     pagou — e aqui daria uma tela avisando num prazo e uma renovação agindo
     noutro. */
  const usos = (fonte.match(/RENOVAR_FALTANDO/g) || []).length;
  ok('e é lida na tela E na renovação', usos >= 3, `${usos} menções`);
  /* E ela vem ANTES do primeiro uso. `const` em zona morta temporal não devolve
     `undefined`: derruba a carga inteira. Aconteceu enquanto eu escrevia isto —
     a constante nasceu junto da renovação, seiscentas linhas abaixo da tela. */
  const decl = fonte.indexOf('const RENOVAR_FALTANDO') + 'const '.length;
  const primeiroUso = fonte.indexOf('RENOVAR_FALTANDO');
  ok('e é declarada antes de ser usada', decl === primeiroUso,
     decl === primeiroUso ? ''
       : 'a declaração vem depois do uso — ReferenceError na carga');
}

console.log('\n[2] a frase do aviso existe nos cinco idiomas');
{
  for (const chave of ['licPerto', 'licPegarOutra']) {
    const n = (fonte.match(new RegExp(chave + ':', 'g')) || []).length;
    ok(`  ${chave} nos cinco`, n === 5, String(n));
  }
  ok('e o aviso leva à conta, em vez de "fale comigo"',
     /licPegarOutra[\s\S]{0,80}CAMINHO_CONTA|CAMINHO_CONTA\[LANG\][\s\S]{0,120}licPegarOutra/.test(fonte)
     || /\$\{CAMINHO_CONTA\[LANG\] \|\| '\/conta'\}/.test(fonte));
}

console.log('\n[3] a renovação silenciosa existe, e não inventa licença');
{
  const i = fonte.indexOf('async function renovarSePerto');
  const corpo = i < 0 ? '' : fonte.slice(i, i + 2600);
  ok('a função existe', i >= 0);
  ok('  ela exige sessão', /if \(!sessao \|\| !sessao\.token/.test(corpo));
  /* A chave que volta é CONFERIDA antes de substituir a de agora: aceitar o que
     o servidor mandou sem olhar seria trocar uma licença boa por qualquer
     resposta. */
  ok('  confere a chave nova antes de guardar', /await conferirLicenca\(nova\)/.test(corpo));
  ok('  e só troca se ela valer MAIS que a de agora',
     /c\.dados\.a <= licenca\.a/.test(corpo));
}

console.log('\n[4] o código parou de prometer o que não faz');
{
  const stripe = fs.readFileSync(`${RAIZ_WS}/lib/stripe.ts`, 'utf8');
  ok('o `lib/stripe.ts` não diz mais "se renova sozinha" como fato',
     !/uma licença curta que se renova sozinha/.test(stripe));
  ok('e explica o limite de quem renova', /sess/i.test(stripe) && /cron|e-mail/i.test(stripe));
}

console.log(falhas ? `\n${falhas} FALHA(S)`
                   : '\nRenovação: avisa antes, renova quando dá, e não promete o resto.');
process.exit(falhas ? 1 : 0);

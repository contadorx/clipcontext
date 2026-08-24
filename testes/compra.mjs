/* O CAMINHO DA COMPRA, DA HOME AO CHECKOUT — e a intenção sobrevivendo a ele.
 *
 * Quem clica "Assinar o Team" na página de preços quer uma coisa específica.
 * Entre esse clique e a tela onde o pagamento começa há três lugares onde essa
 * intenção pode se perder, e antes deste build ela se perdia nos três:
 *
 *   1. o cartão levava o plano num `data-cta` de análise, e não na URL;
 *   2. o link do e-mail carregava só o idioma;
 *   3. a conta lia `erro|feito|comprou|cancelou` do endereço, e mais nada.
 *
 * O resultado era três telas para dizer duas vezes a mesma coisa: a pessoa
 * escolhia o plano, ia ao e-mail, voltava, e escolhia de novo.
 *
 * ESTA RÉGUA ANDA O CAMINHO nos cinco idiomas e cobra as três pontes. Ela não
 * chega ao checkout de verdade — isso depende de chave da Stripe, que não vive
 * aqui — e diz isso com todas as letras em vez de fingir que chegou.
 *
 * E ela cobra as SAÍDAS que faltavam: a página de preços agora leva às duas
 * páginas de confiança, e a de segurança deixou de ser beco.
 */
import fs from 'fs';
import path from 'path';

import { chromium } from 'playwright';
import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';

const SITE = 'http://localhost:8802';
const rotas = JSON.parse(fs.readFileSync(path.join(RAIZ_WS, 'src/rotas.json'), 'utf8'));
const pre = (L) => (L === 'pt' ? '' : '/' + L);
const endereco = (pagina, L) => pre(L) + '/' + rotas.slugs[pagina][L];

let falhas = 0;
const ok = (n, c, e) => {
  console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : ''));
  if (!c) falhas++;
};

const br = await chromium.launch({ executablePath: CHROME_WS });
const pg = await (await br.newContext({ viewport: { width: 1200, height: 900 } })).newPage();

console.log('[1] o clique de compra leva o plano na URL, nos cinco idiomas');
{
  /* Os nomes vêm de `lib/stripe.ts`, que é quem decide o que a Stripe aceita.
     Escrevê-los aqui seria a mesma lista paralela que o `build.py` deixou de
     ter quando passou a conferir o `planoCodigo` contra aquele arquivo. */
  const stripe = fs.readFileSync(path.join(RAIZ_WS, 'lib/stripe.ts'), 'utf8');
  const bloco = stripe.match(/export const PLANOS = \{([\s\S]*?)\n\} as const;/);
  const CODIGOS = [...(bloco ? bloco[1].matchAll(/^ {2}([a-z]\w*): \{/gm) : [])].map((m) => m[1]);
  ok('lib/stripe.ts declara os planos vendáveis', CODIGOS.length >= 2, CODIGOS.join(', '));

  for (const L of rotas.idiomas) {
    await pg.goto(SITE + endereco('precos', L));
    const alvos = await pg.locator('.plan a.btn').evaluateAll((as) =>
      as.map((a) => ({ href: a.getAttribute('href'), cta: a.getAttribute('data-cta') })));
    const pagos = alvos.filter((a) => a.cta !== 'free');
    ok(`${L}: os dois cartões pagos levam ?plano=`,
       pagos.length === 2 && pagos.every((a) => /[?&]plano=/.test(a.href || '')),
       pagos.map((a) => `${a.cta}→${a.href}`).join(' | '));
    const codigos = pagos.map((a) => (a.href.match(/[?&]plano=([a-z]+)/) || [])[1]);
    ok(`${L}: e o plano é um que a Stripe conhece`,
       codigos.every((c) => CODIGOS.includes(c)), codigos.join(', ') + ' × ' + CODIGOS.join(', '));
  }
}

console.log('\n[2] a conta recebe a intenção e diz o que a pessoa veio fazer');
{
  const conta = JSON.parse(fs.readFileSync(path.join(RAIZ_WS, 'src/rotas.json'), 'utf8')).caminhoConta;
  for (const L of rotas.idiomas) {
    await pg.goto(SITE + conta[L] + '?plano=time');
    const campo = await pg.locator('form input[name="plano"]').getAttribute('value').catch(() => null);
    ok(`${L}: o formulário de entrada carrega o plano para o link do e-mail`,
       campo === 'time', String(campo));
    /* A TELA DO "OLHE O SEU E-MAIL", que é alcançável por endereço. O link
       "pedir outro" é o segundo pedido, feito por quem o primeiro e-mail não
       alcançou — e ele largava a intenção pelo caminho.
       A primeira versão desta linha cobrava `>= 0`, que passa sempre. Uma
       afirmação que não pode reprovar é pior que nenhuma: ela ocupa o lugar
       da que reprovaria. */
    await pg.goto(SITE + conta[L] + '?enviado=alguem%40exemplo.com&plano=time');
    const outro = await pg.locator('a[href*="plano=time"]').count();
    ok(`${L}: pedir outro link não larga a intenção`, outro >= 1, `${outro} link(s)`);
  }
  /* Plano inventado NÃO vira parâmetro de tela: o valor veio de uma URL. */
  await pg.goto(SITE + conta.pt + '?plano=ouro');
  const invalido = await pg.locator('form input[name="plano"]').count();
  ok('um plano inventado na URL é ignorado', invalido === 0, `${invalido} campo(s)`);
}

console.log('\n[3] a volta do link do e-mail preserva o plano');
{
  /* Sem sessão, a rota de confirmação recusa e volta para a conta — e é
     exatamente nessa volta que o parâmetro se perdia. O código do erro não
     importa aqui; o que importa é o que sobrevive ao redirecionamento. */
  const r = await pg.request.get(`${SITE}/conta/confirmar?lang=pt&plano=time`,
                                 { maxRedirects: 0 }).catch(() => null);
  const destino = r ? (r.headers()['location'] || '') : '';
  ok('a rota de confirmação devolve o plano no endereço', /[?&]plano=time/.test(destino), destino);
  const r2 = await pg.request.get(`${SITE}/conta/confirmar?lang=pt&plano=ouro`,
                                  { maxRedirects: 0 }).catch(() => null);
  const d2 = r2 ? (r2.headers()['location'] || '') : '';
  ok('e um plano inventado não atravessa', !/plano=/.test(d2), d2);
}

console.log('\n[4] as voltas não apontam para produção quando o site não é produção');
{
  /* O link do e-mail e os três endereços da Stripe usavam `marca.site` fixo.
     Numa prévia ou em `localhost`, o link do e-mail levava a pessoa para o
     site de VERDADE — quem testava a compra testava a compra de outro site. */
  const acoes = fs.readFileSync(path.join(RAIZ_WS, 'app/conta/acoes.ts'), 'utf8');
  const fixos = [...acoes.matchAll(/\$\{marca\.site\}/g)].length;
  ok('nenhum endereço de volta usa `marca.site` escrito à mão', fixos === 0, `${fixos} uso(s)`);
  ok('e existe uma base que olha o ambiente', /function base\(\)/.test(acoes));
  ok('que respeita a implantação de prévia', /VERCEL_URL/.test(acoes));
}

console.log('\n[5] as páginas de confiança deixaram de ser becos');
{
  for (const L of rotas.idiomas) {
    await pg.goto(SITE + endereco('precos', L));
    for (const alvo of ['seguranca', 'verificar']) {
      const n = await pg.locator(`a[href="${endereco(alvo, L)}"]`).count();
      ok(`${L}: /precos leva a /${alvo}`, n >= 1, `${n} link(s)`);
    }
    await pg.goto(SITE + endereco('seguranca', L));
    const saidas = await pg.locator(
      `a[href="${endereco('precos', L)}"], a[href="${endereco('verificar', L)}"]`).count();
    ok(`${L}: /seguranca tem saída`, saidas >= 2, `${saidas} link(s)`);
  }
}

console.log('\n[6] o endereço aposentado continua respondendo');
{
  /* A `/time` era órfã e indexável — nenhuma página levava a ela, e ela vendia
     o mesmo plano que a de preços. Saiu; o endereço não.
     Um endereço publicado está em canonical indexado, em sitemap enviado e em
     links que outras pessoas escreveram. Trocá-lo por um 404 é jogar fora o
     tráfego que ele custou — e é o tipo de coisa que ninguém percebe, porque
     quem cai no 404 não escreve reclamando. */
  const aposentadas = JSON.parse(
    fs.readFileSync(path.join(RAIZ_WS, 'src/rotas.json'), 'utf8')).aposentadas || {};
  ok('há endereço aposentado declarado', Object.keys(aposentadas).length > 0,
     Object.keys(aposentadas).join(', '));
  for (const [nome, velha] of Object.entries(aposentadas)) {
    for (const L of rotas.idiomas) {
      const de = pre(L) + '/' + velha.slugs[L];
      const r = await pg.request.get(SITE + de, { maxRedirects: 0 }).catch(() => null);
      const destino = r ? (r.headers()['location'] || '') : '';
      ok(`${L}: ${de} leva a /${velha.para}`,
         r !== null && [301, 308].includes(r.status()) && destino.endsWith(endereco(velha.para, L)),
         `${r ? r.status() : 'sem resposta'} → ${destino}`);
    }
    /* E ela não pode continuar sendo anunciada: um endereço que redireciona e
       aparece no sitemap manda o buscador para um desvio. */
    const mapa = await (await pg.request.get(SITE + '/sitemap-paginas.xml')).text();
    ok(`${nome} saiu do sitemap`, !new RegExp(`/${velha.slugs.pt}<`).test(mapa));
  }
}

console.log('\n[7] a base de conhecimento é achável pelo Ctrl+F');
{
  for (const L of rotas.idiomas) {
    await pg.goto(SITE + endereco('ajuda', L));
    const r = await pg.evaluate(() => {
      const ds = [...document.querySelectorAll('details')];
      return { total: ds.length, abertos: ds.filter((d) => d.open).length };
    });
    ok(`${L}: as ${r.total} perguntas nascem abertas`, r.total > 0 && r.abertos === r.total,
       `${r.abertos} de ${r.total}`);
    /* E continuam recolhíveis: um `<details>` que não fecha virou um `<div>`. */
    const fecha = await pg.evaluate(() => {
      const d = document.querySelector('details'); if (!d) return false;
      d.open = false; return !d.open;
    });
    ok(`${L}: e continuam podendo fechar`, fecha);
  }
}

await br.close();
console.log(falhas ? `\n${falhas} FALHA(S)`
                   : '\nO caminho da compra: a intenção chega do outro lado.');
process.exit(falhas ? 1 : 0);

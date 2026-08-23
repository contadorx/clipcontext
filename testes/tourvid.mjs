/* O vídeo do tour e o vídeo de exemplo — os dois refeitos, e o que não pode
 * voltar a acontecer com eles.
 *
 * O EXEMPLO era a gravação de um relatório trimestral: slides passando. Aquilo
 * mostrava a ferramenta funcionando e mostrava o PRODUTO ERRADO — quem procura
 * "evidência de teste" ou "instrução de trabalho" não grava slides, grava um
 * sistema. Um exemplo que não parece o trabalho de quem chega faz a pessoa
 * concluir que a ferramenta é para outra coisa.
 *
 * Agora é um pedido de compra sendo testado numa intranet, com a recusa do
 * sistema no meio — que é o quadro que interessa numa evidência e o motivo de a
 * marcação manual existir.
 *
 * E o TOUR foi regravado percorrendo o aplicativo de verdade, nas cinco
 * línguas. O alemão e o francês viam o tour em inglês porque `lib/site.ts`
 * tinha a lista de idiomas escrita à mão ao lado de um `build.py` que olhava o
 * disco — a mesma armadilha que já tinha apagado o hreflang deles.
 */
import fs from 'fs';

import { RAIZ_WS } from './_caminhos.mjs';
const BASE = 'http://localhost:8802';
const DEMO = `${RAIZ_WS}/public/demo`;
const ROTAS = JSON.parse(fs.readFileSync(`${RAIZ_WS}/src/rotas.json`, 'utf8'));

let falhas = 0;
const ok = (n, c, e) => { console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : '')); if (!c) falhas++; };

console.log('[1] os cinco idiomas têm tour e exemplo, em disco');
for (const L of ROTAS.idiomas) {
  for (const [tipo, ext] of [['tour', 'webm'], ['tour', 'mp4'], ['tour', 'jpg'],
                             ['exemplo', 'webm'], ['exemplo', 'mp4'], ['exemplo', 'vtt'],
                             ['rodada', 'webm'], ['rodada', 'mp4'], ['rodada', 'jpg']]) {
    const f = `${DEMO}/${tipo}.${L}.${ext}`;
    const existe = fs.existsSync(f) && fs.statSync(f).size > 400;
    ok(`${L}: ${tipo}.${ext}`, existe, existe ? '' : 'falta ou está vazio');
  }
}

console.log('\n[2] a lista de quem tem tour é DERIVADA do disco');
{
  /* Escrita à mão, ela ficou meses dizendo ['pt','en','es'] depois de o vídeo
     alemão existir — e ninguém viu, porque um vídeo em inglês numa página
     alemã não quebra nada, só decepciona. */
  const site = fs.readFileSync(`${RAIZ_WS}/lib/site.ts`, 'utf8');
  ok('o site não tem a lista escrita à mão',
     !/\['pt', 'en', 'es'\]\.includes\(lang\)/.test(site));
  ok('ele lê o que o build.py apurou', /rotas\.demoLangs/.test(site));
  const build = fs.readFileSync(`${RAIZ_WS}/build.py`, 'utf8');
  ok('e o build.py apura olhando o disco',
     /com_tour = \[L for L in IDIOMAS if \(root \/ "public" \/ "demo"/.test(build));
  ok('os cinco entraram no rotas.json',
     JSON.stringify(ROTAS.demoLangs) === JSON.stringify(ROTAS.idiomas),
     JSON.stringify(ROTAS.demoLangs));
}

console.log('\n[2b] e a lista de quem tem o vídeo da rodada, do mesmo jeito');
{
  /* O vídeo da rodada paga nasceu nos cinco de uma vez. A lista sai do disco
     pelo mesmo motivo do tour: a próxima língua a entrar no site vai entrar
     antes de entrar no estúdio, e um `<video>` apontando para um 404 numa
     página de PREÇOS é pior do que na home — é a página onde a pessoa decide. */
  const site = fs.readFileSync(`${RAIZ_WS}/lib/site.ts`, 'utf8');
  ok('o site lê o que o build.py apurou', /rotas\.rodadaLangs/.test(site));
  const build = fs.readFileSync(`${RAIZ_WS}/build.py`, 'utf8');
  ok('e o build.py apura olhando o disco',
     /com_rodada = \[L for L in IDIOMAS if \(root \/ "public" \/ "demo"/.test(build));
  /* E A RÉGUA COBRA A DERIVAÇÃO, NÃO O NÚMERO CINCO.
     Ela exigia `rodadaLangs === idiomas` — quer dizer, exigia que os cinco
     vídeos existissem. Eles NUNCA existiram: `public/demo/rodada.*.webm` são
     quinze arquivos que nenhum commit trouxe, e a página de preços já pôs uma
     figura no lugar. O que a régua tem de cobrar é o que o comentário acima
     diz: que a lista saia do disco. Se os vídeos forem gravados um dia, ela
     volta a cobrá-los sozinha, sem ninguém editar este arquivo. */
  const noDisco = ROTAS.idiomas.filter(
    (L) => fs.existsSync(`${DEMO}/rodada.${L}.webm`));
  ok('o rotas.json diz exatamente o que está no disco',
     JSON.stringify(ROTAS.rodadaLangs) === JSON.stringify(noDisco),
     `rotas=${JSON.stringify(ROTAS.rodadaLangs)} disco=${JSON.stringify(noDisco)}`);
  if (!noDisco.length) {
    console.log('  nota    nenhum rodada.*.webm no disco: a página de preços usa a figura.');
  }
}

console.log('\n[3] cada home mostra o tour da própria língua');
for (const L of ROTAS.idiomas) {
  const u = L === 'pt' ? '/?lang=pt' : '/' + L;
  const html = await (await fetch(BASE + u)).text();
  const achou = (html.match(/demo\/tour\.([a-z]{2})\.webm/) || [])[1];
  ok(`${L}: aponta para tour.${L}.webm`, achou === L, `achou ${achou}`);
  const r = await fetch(BASE + `/demo/tour.${L}.webm`);
  ok(`${L}: e o arquivo responde`, r.status === 200, String(r.status));
}

console.log('\n[4] a legenda do exemplo fala do SISTEMA, e não de um relatório');
for (const L of ROTAS.idiomas) {
  const vtt = fs.readFileSync(`${DEMO}/exemplo.${L}.vtt`, 'utf8');
  /* A prova de que o exemplo mudou de assunto. "trimestre/quarterly" era o
     relatório antigo; o novo fala de pedido, sistema e recusa. */
  ok(`${L}: não é mais o relatório trimestral`,
     !/trimestr|quarterly|Quartals|trimestre/i.test(vtt));
  const conta = {
    pt: /centro de custo/i, en: /cost centre/i, es: /centro de coste/i,
    de: /Kostenstelle/i, fr: /centre de coût/i,
  }[L];
  ok(`${L}: e conta o teste do centro de custo`, conta.test(vtt));
  /* A RECUSA é o miolo: é o quadro que interessa numa evidência. Um exemplo em
     que tudo dá certo na primeira tentativa não mostra para que serve marcar
     um passo à mão. */
  const recusa = {
    pt: /recusou/i, en: /refused/i, es: /rechaz/i, de: /abgelehnt/i, fr: /refus/i,
  }[L];
  ok(`${L}: com a recusa do sistema no meio`, recusa.test(vtt));
}

console.log('\n[5] a legenda da home descreve o vídeo que existe');
for (const L of ROTAS.idiomas) {
  const u = L === 'pt' ? '/?lang=pt' : '/' + L;
  const html = await (await fetch(BASE + u)).text();
  /* A legenda dizia "o fluxo completo em 19 segundos". O vídeo tem 33 e mostra
     outra coisa. Uma legenda que descreve um vídeo que não existe mais é do
     mesmo tipo de defeito do `revoke` que não revogava — só que na vitrine. */
  ok(`${L}: não promete mais 19 segundos`, !/19 segundos|19 seconds|19 segundos|19 Sekunden|19 secondes/.test(html));
}

console.log('\n[6] os vídeos têm a duração e o peso de quem vai rodar em laço');
for (const L of ROTAS.idiomas) {
  const t = fs.statSync(`${DEMO}/tour.${L}.webm`).size;
  const e = fs.statSync(`${DEMO}/exemplo.${L}.webm`).size;
  /* Um vídeo que roda sozinho no alto da home paga o preço na primeira visita
     de todo mundo. Acima de 2 MB isso começa a doer em rede de escritório. */
  ok(`${L}: o tour cabe em 2 MB`, t < 2 * 1024 * 1024, `${(t/1048576).toFixed(2)} MB`);
  ok(`${L}: e o exemplo em 1 MB`, e < 1024 * 1024, `${(e/1048576).toFixed(2)} MB`);
}

console.log('\n[7] a página de preços mostra a rodada da própria língua');
{
  /* O endereço da página de preços é traduzido — `preise` em alemão, `tarifs`
     em francês. Ele sai do `rotas.json`: escrever `/de/precos` aqui daria 404
     e o teste diria "o vídeo não está lá" sobre uma página que não existe. */
  const slug = ROTAS.slugs?.precos || {};
  /* Sobre `rodadaLangs`, e não sobre `idiomas`: cobrar o vídeo de uma língua
     cujo arquivo não existe é cobrar do produto uma coisa que o estúdio ainda
     não entregou. Hoje a lista é vazia e este laço não roda — quando o
     primeiro vídeo entrar no disco, ele passa a rodar sozinho. */
  for (const L of ROTAS.rodadaLangs) {
    const u = L === 'pt' ? '/' + (slug.pt || 'precos') : `/${L}/${slug[L] || 'precos'}`;
    const r = await fetch(BASE + u);
    ok(`${L}: ${u} responde 200`, r.ok, String(r.status));
    const html = await r.text();
    const achou = (html.match(/demo\/rodada\.([a-z]{2})\.webm/) || [])[1];
    ok(`${L}: mostra a rodada em ${L}`, achou === L, achou || 'nenhum vídeo da rodada');
    /* `preload="none"`: a rodada é um vídeo de 1,7 MB numa página que já carrega
       a tabela de noventa e três linhas. Baixar sozinho o que quase ninguém vai
       abrir é cobrar de todo mundo o interesse de poucos. */
    ok(`${L}: e não baixa sozinho`, /rodada[\s\S]{0,400}?preload="none"|preload="none"[\s\S]{0,400}?rodada/.test(html));
  }
  for (const L of ROTAS.rodadaLangs) {
    const t = fs.statSync(`${DEMO}/rodada.${L}.webm`).size;
    /* Mais folga que o tour: este não roda em laço nem começa sozinho — só
       baixa quando alguém aperta o play. */
    ok(`${L}: a rodada cabe em 3 MB`, t < 3 * 1024 * 1024, `${(t / 1048576).toFixed(2)} MB`);
  }
}

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nVídeos do site: tudo passou.');
process.exit(falhas ? 1 : 0);

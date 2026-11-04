/* O formato do documento, os modelos e os padrões — neste navegador.
 *
 * Até o Build 68 esta régua cobrava o padrão do TIME chegando pela conta: a
 * empresa configurava papel e layout no portal, e a ferramenta obedecia até a
 * pessoa trocar alguma coisa. No 69 o Walkstamp ficou inteiramente grátis e sem
 * servidor, a conta saiu, e o padrão do time virou duas coisas que moram aqui:
 *
 *   - MODELOS salvos neste navegador (cenário, rótulo, ambiente, sistema,
 *     layout e papel), aplicados por um seletor;
 *   - um ARQUIVO DE PADRÕES, que quem configura exporta e o time importa —
 *     modelos, marca do cliente, quem emite e a classificação.
 *
 * As perguntas continuam as mesmas: o padrão é obedecido; o que não existe não
 * é obedecido; e nada disso empurra a pessoa — aplicar um modelo é um gesto.
 *
 *   node testes/formato.mjs
 */
import { chromium } from './_navegador.mjs';
import http from 'http'; import fs from 'fs'; import path from 'path';

import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';
const ROOT=`${RAIZ_WS}/public`;
const T={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml',
         '.webm':'video/webm','.jpg':'image/jpeg','.png':'image/png','.vtt':'text/vtt'};
const srv=http.createServer((q,r)=>{const u=decodeURIComponent(q.url.split('?')[0]);
 const f=path.join(ROOT,u==='/'?'index.html':u);
 if(!fs.existsSync(f)){r.writeHead(404);return r.end()}
 r.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f))});
await new Promise(r=>srv.listen(8857,r));

const br=await chromium.launch({executablePath:CHROME_WS});
let falhas=0;
const ok=(n,c,e)=>{console.log((c?'  ok   ':'  FALHA')+'  '+n+(e?'  → '+e:''));if(!c)falhas++};

/* Um navegador limpo por bloco: o que está em teste é justamente o que fica
   guardado, e um bloco não pode herdar o que o anterior guardou. */
async function abrir(ctx){
  const pg = ctx ? await ctx.newPage() : await (ctx = await br.newContext({ viewport:{width:1300,height:1000}, acceptDownloads:true })).newPage();
  const erros=[]; pg.on('pageerror',e=>erros.push(e.message));
  await pg.goto('http://localhost:8857/app.html?lang=pt');
  await pg.waitForTimeout(400);
  return { pg, ctx, erros };
}
/* Os controles de formato moram no cartão da revisão, que nasce `inert` até
   existir material — o jeito de chegar lá é o de todo mundo: carregar um vídeo. */
async function liberarRevisao(pg){
  await pg.selectOption('#modelo', 'evidencia');
  await pg.setInputFiles('#file', '/tmp/amostra.webm');
  await pg.waitForFunction(() => !document.getElementById('prevCard').hasAttribute('inert'),
    null, { timeout: 20000 });
}

console.log('[1] um modelo salvo volta na próxima visita, e aplicá-lo põe o formato');
{
  const { pg, ctx, erros } = await abrir();
  await liberarRevisao(pg);
  await pg.selectOption('#papel', 'letter');
  await pg.selectOption('#layout', 'grid');
  pg.once('dialog', d => d.accept('Homologação'));
  await pg.locator('#mdSalvar').click();
  await pg.waitForTimeout(300);
  ok('a tela confirma o modelo salvo', /Homologa/.test(await pg.locator('#modelosMsg').textContent()),
     (await pg.locator('#modelosMsg').textContent()).slice(0, 80));
  /* A próxima visita: outra aba do MESMO navegador, que começa no padrão. */
  const outra = await ctx.newPage();
  await outra.goto('http://localhost:8857/app.html?lang=pt');
  await outra.waitForTimeout(400);
  await liberarRevisao(outra);
  ok('a próxima visita começa no padrão da ferramenta', await outra.inputValue('#papel') === 'a4',
     await outra.inputValue('#papel'));
  const opcoes = await outra.locator('#modeloCliente option').allTextContents();
  ok('e o modelo está na lista', opcoes.some(o => /Homologa/.test(o)), opcoes.join(' | '));
  const valor = await outra.locator('#modeloCliente option', { hasText: 'Homologação' }).getAttribute('value');
  await outra.selectOption('#modeloCliente', valor);
  await outra.waitForTimeout(200);
  ok('aplicar o modelo põe o papel', await outra.inputValue('#papel') === 'letter', await outra.inputValue('#papel'));
  ok('e o layout', await outra.inputValue('#layout') === 'grid', await outra.inputValue('#layout'));
  ok('sem erro de JS', erros.length === 0, erros.join(' | ').slice(0, 140));
  await ctx.close();
}

console.log('\n[2] o arquivo de padrões vai e volta: modelos, marca e quem emite');
{
  const { pg, ctx } = await abrir();
  await liberarRevisao(pg);
  await pg.selectOption('#papel', 'letter');
  pg.once('dialog', d => d.accept('Padrão ACME'));
  await pg.locator('#mdSalvar').click();
  await pg.fill('#mcNome', 'ACME Auditoria');
  await pg.fill('#docEmissorCampo', 'Qualidade ACME');
  const d = pg.waitForEvent('download');
  await pg.locator('#pdExportar').click();
  const arq = '/tmp/padroes-walkstamp.json';
  await (await d).saveAs(arq);
  await ctx.close();
  const conteudo = JSON.parse(fs.readFileSync(arq, 'utf8'));
  ok('o arquivo diz o que é', conteudo.tipo === 'walkstamp.padroes', conteudo.tipo);
  /* E SÓ CONFIGURAÇÃO: nada de gravação, de tela ou de texto transcrito. */
  ok('e leva só configuração', Object.keys(conteudo).sort().join(',') ===
     'classificacao,emissor,marca,modelos,tipo,versao', Object.keys(conteudo).join(','));

  /* Outra pessoa, outro navegador, nada guardado. */
  const b = await abrir();
  await liberarRevisao(b.pg);
  await b.pg.setInputFiles('#pdArq', arq);
  await b.pg.waitForTimeout(400);
  ok('importar confirma quantos modelos chegaram', /1 modelo/.test(await b.pg.locator('#modelosMsg').textContent()),
     (await b.pg.locator('#modelosMsg').textContent()).slice(0, 80));
  ok('a marca do cliente chegou', await b.pg.inputValue('#mcNome') === 'ACME Auditoria', await b.pg.inputValue('#mcNome'));
  ok('e quem emite', await b.pg.inputValue('#docEmissorCampo') === 'Qualidade ACME',
     await b.pg.inputValue('#docEmissorCampo'));
  const opcoes = await b.pg.locator('#modeloCliente option').allTextContents();
  ok('e o modelo', opcoes.some(o => /ACME/.test(o)), opcoes.join(' | '));
  await b.ctx.close();
}

console.log('\n[3] valor inventado não é obedecido');
{
  /* Um arquivo vindo de fora, de outra versão, com papel e layout que este
     seletor não conhece. Atribuir um valor desconhecido a um `<select>` não é
     ignorado: ele fica em BRANCO, e o documento sai sem papel nem layout. */
  const arq = '/tmp/padroes-inventados.json';
  fs.writeFileSync(arq, JSON.stringify({ tipo: 'walkstamp.padroes', versao: 1,
    modelos: [{ nome: 'Inventado', dados: { papel: 'papiro', layout: '3d' } }] }));
  const { pg, ctx } = await abrir();
  await liberarRevisao(pg);
  await pg.setInputFiles('#pdArq', arq);
  await pg.waitForTimeout(300);
  /* O que estava antes é o que tem que continuar — e não um valor fixo: o
     cenário escolhido já mexe no layout, e é contra ELE que se compara. */
  const antes = { papel: await pg.inputValue('#papel'), layout: await pg.inputValue('#layout') };
  const valor = await pg.locator('#modeloCliente option', { hasText: 'Inventado' }).getAttribute('value');
  await pg.selectOption('#modeloCliente', valor);
  await pg.waitForTimeout(200);
  ok('papel inventado é ignorado', await pg.inputValue('#papel') === antes.papel,
     `${antes.papel} → ${await pg.inputValue('#papel')}`);
  ok('layout inventado também', await pg.inputValue('#layout') === antes.layout,
     `${antes.layout} → ${await pg.inputValue('#layout')}`);
  await ctx.close();
}

console.log('\n[4] um arquivo que não é de padrões é recusado, dizendo por quê');
{
  const arq = '/tmp/nao-sao-padroes.json';
  fs.writeFileSync(arq, JSON.stringify({ qualquer: 'coisa' }));
  const { pg, ctx } = await abrir();
  await liberarRevisao(pg);
  await pg.setInputFiles('#pdArq', arq);
  await pg.waitForTimeout(300);
  const msg = (await pg.locator('#modelosMsg').textContent()) || '';
  ok('a recusa aparece', /não é um arquivo de padrões/.test(msg), msg.slice(0, 80));
  ok('e a lista continua vazia', (await pg.locator('#modeloCliente option').count()) === 0);
  await ctx.close();
}

console.log('\n[5] o formato vem ANTES dos botões que produzem o arquivo');
{
  /* O pedido foi literal: "em gerar separe uma seção para formatos… depois
     formato de saída e depois dados e recuperação". A ordem é o pedido — se
     alguém reencaixar os seletores no meio dos botões, isto reprova. */
  const { pg, ctx } = await abrir();
  const ordem = await pg.evaluate(() => {
    const ids = ['papel','layout','go','docx','json','zip'];
    const pos = {};
    for (const id of ids) pos[id] = [...document.querySelectorAll('#sb4 *')].indexOf(document.getElementById(id));
    const tit = [...document.querySelectorAll('#sb4 .saidaTit')].map(e => e.textContent.trim());
    return { pos, tit };
  });
  ok('papel e layout vêm antes do Gerar PDF',
     ordem.pos.papel < ordem.pos.go && ordem.pos.layout < ordem.pos.go, JSON.stringify(ordem.pos));
  ok('e os dados de recuperação vêm por último',
     ordem.pos.json > ordem.pos.docx && ordem.pos.zip > ordem.pos.json, JSON.stringify(ordem.pos));
  /* CINCO, e a primeira é a recomendação. Dentro do catálogo a ordem antiga
     continua valendo: forma primeiro, recuperação por último. */
  ok('a recomendação abre a seção',
     ordem.tit.length === 5 && /recomendado/i.test(ordem.tit[0]), ordem.tit.join(' | '));
  ok('e o catálogo mantém a ordem: formato primeiro, recuperação por último',
     /formato/i.test(ordem.tit[1]) && /recupera/i.test(ordem.tit[4]),
     ordem.tit.join(' | '));
  await ctx.close();
}

await br.close(); srv.close();
console.log(falhas?`\n${falhas} FALHA(S)`:'\nFormato, modelos e padrões: tudo passou.');
process.exit(falhas?1:0);

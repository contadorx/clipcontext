import { chromium } from './_navegador.mjs';
import http from 'http'; import fs from 'fs';
import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';
const html = fs.readFileSync(`${RAIZ_WS}/public/app.html`,'utf8');
const jspdf = fs.readFileSync(`${RAIZ_WS}/vendor/jspdf.umd.min.js`,'utf8');
const srv = http.createServer((q,r)=>{ if(q.url.startsWith('/_vercel/')){r.writeHead(200,{'Content-Type':'text/javascript'});return r.end('')} r.writeHead(200,{'Content-Type':'text/html'}); r.end(html); });
await new Promise(r=>srv.listen(8941,r));
const br = await chromium.launch({ executablePath:CHROME_WS });
let falhas=0; const ok=(n,c,e)=>{console.log((c?'  ok   ':'  FALHA')+'  '+n+(e?'  → '+e:''));if(!c)falhas++};
const ctx = await br.newContext({ acceptDownloads:true, viewport:{width:1280,height:1000} });
const pg = await ctx.newPage(); const erros=[]; pg.on('pageerror',e=>erros.push(e.message));
await pg.route('**/jspdf**', r=>r.fulfill({status:200,headers:{'content-type':'text/javascript'},body:jspdf}));
await pg.goto('http://localhost:8941/app.html?lang=pt');
await pg.waitForTimeout(500);

console.log('[1] o cartão de gravar enxugou');
ok('a frase de atalhos sumiu', (await pg.locator('[data-i18n="atalhos"]').count()) === 0);
ok('o microfone não está mais aqui', (await pg.locator('#viaRec #recMic').count()) === 0);
ok('mas continua existindo, com a transcrição', (await pg.locator('#recMic').count()) === 1);
ok('e continua ligado por padrão', await pg.locator('#recMic').isChecked());
/* Duas, e não três: "Contar 3 antes de começar" e "Guardar as telas no meu
   computador" saíram da lista e viraram padrão — nenhuma das duas tinha um lado
   bom para desligar. O que este teste protege é o LAYOUT (uma por linha), e não
   quantas sobraram. */
/* E AGORA O TESTE MEDE O QUE O COMENTÁRIO ACIMA JÁ DIZIA.
   Ele contava `>= 2` — usava a quantidade como procuração para o layout. Quando
   "Transcrever a fala" saiu daqui para uma linha comum aos três caminhos (ela
   nunca foi opção de quem grava: é ela que decide se o modelo baixa), a
   contagem caiu para 1 e o teste reprovou um layout que continuava certo.
   O que se afirma agora é a propriedade: cada opção começa na mesma coluna e
   em alturas diferentes — uma por linha, que é o que estava escrito. */
{
  const caixas = await pg.locator('#recOpts label.opt, #opcoesVias label.opt').evaluateAll(
    els => els.map(e => { const r = e.getBoundingClientRect();
                          return { x: Math.round(r.left), y: Math.round(r.top) }; }));
  ok('há opções para medir', caixas.length >= 2, String(caixas.length));
  const mesmasLinhas = caixas.some((c, i) => caixas.some((d, j) => j !== i && d.y === c.y));
  ok('as opções são uma por linha', !mesmasLinhas, JSON.stringify(caixas));
}
ok('as duas frases longas viraram ajuda', await pg.locator('#recAjudaCx').isHidden());
/* O que fica ao lado da caixa é a RECOMENDAÇÃO, e não os megabytes.

   O número existia para ninguém ser surpreendido por um download depois de
   clicar em Gravar. Essa surpresa acabou: o modelo começa a baixar sozinho ao
   abrir a página e corre em paralelo com o seletor de tela. Sobrou o susto sem
   a causa — megabytes ao lado de uma caixa marcada, escritos no lugar exato
   onde eles fazem desmarcar. O número continua na ajuda do "?". */
ok('a nota ao lado da transcrição é a recomendação',
   /recomendad/i.test(await pg.locator('#optTr').textContent()),
   await pg.locator('#optTr').textContent());
ok('e não anuncia megabytes ali', !/MB/.test(await pg.locator('#optTr').textContent()));
await pg.locator('#recAjuda').click(); await pg.waitForTimeout(200);
ok('e a ajuda abre quando pedida', await pg.locator('#recAjudaCx').isVisible());
ok('com a promessa lá dentro',
   /Nada de vídeo é guardado/.test(await pg.locator('#recAjudaCx').textContent()));

console.log('\n[2] o clipe virou botão com o tempo no rótulo');
ok('o botão existe', await pg.locator('#clipeAbrir').isVisible());
ok('dizendo que está desligado', /desligado/.test(await pg.locator('#clipeAbrir').textContent()),
   await pg.locator('#clipeAbrir').textContent());
ok('o modal começa fechado', await pg.locator('#clipeModal').isHidden());
await pg.locator('#clipeAbrir').click(); await pg.waitForTimeout(300);
ok('abre', await pg.locator('#clipeModal').isVisible());
ok('a webcam mora aqui dentro', (await pg.locator('#clipeModal #recCam').count()) === 1);
ok('e os controles dela só aparecem se ligada', await pg.locator('#camOpts').isHidden());
await pg.locator('#recCam').check(); await pg.waitForTimeout(200);
ok('ligada, aparecem', await pg.locator('#camOpts').isVisible());
ok('e a nota longa do rosto mora dentro do modal, não na tela de gravar',
   (await pg.locator('#clipeModal #recCamNota').count()) === 1);
await pg.locator('#recClipe').check(); await pg.waitForTimeout(200);
await pg.locator('#clipeModalFechar').click(); await pg.waitForTimeout(300);
ok('fechado, o botão conta o estado', /15 s ligado/.test(await pg.locator('#clipeAbrir').textContent()),
   await pg.locator('#clipeAbrir').textContent());
ok('e diz que tem webcam junto', /webcam/.test(await pg.locator('#clipeAbrir').textContent()));

console.log('\n[3] o passo 3 virou quatro subpassos');
await pg.selectOption('#modelo','evidencia');
await pg.setInputFiles('#file','/tmp/amostra.webm'); await pg.waitForTimeout(2500);
await pg.selectOption('#mode','count'); await pg.fill('#count','3');
await pg.locator('#extract').click();
await pg.waitForFunction(()=>document.querySelectorAll('#thumbs figure').length>=3,null,{timeout:40000});
await pg.waitForTimeout(500);
/* TRÊS, e não quatro. O quarto era "Gerar" — e uma ação que a pessoa veio
   fazer, escondida como sub-item de "Revisão" atrás de outros três blocos, era
   o defeito de numeração mais caro da ferramenta. Ele virou a etapa 3. */
ok('são três, e gerar saiu daqui', (await pg.locator('#prevCard details.sub').count()) === 3);
ok('gerar virou a etapa 3', (await pg.locator('#cardBaixar details.sub').count()) === 1);
/* Abertos por padrão: fechar a fileira de saídas atrás de três cliques
   cobraria de quem já conhece a ferramenta o preço da orientação de quem não
   conhece. O que se ganha aqui é saber onde se está, não esconder. */
ok('todos nascem abertos', (await pg.locator('#prevCard details.sub[open]').count()) === 3,
   String(await pg.locator('#prevCard details.sub[open]').count()));
ok('e o de gerar também', (await pg.locator('#cardBaixar details.sub[open]').count()) === 1);
ok('o primeiro diz quantos quadros', /3 quadros mantidos/.test(await pg.locator('#sbEst1').textContent()),
   await pg.locator('#sbEst1').textContent());
ok('e já está marcado como feito', await pg.locator('#sb1').evaluate(e=>e.classList.contains('feito')));
ok('o segundo diz que não há transcrição', /sem transcrição/.test(await pg.locator('#sbEst2').textContent()),
   await pg.locator('#sbEst2').textContent());
ok('o quarto diz que não há documento', /nenhum documento/.test(await pg.locator('#sbEst4').textContent()));
ok('os quadros estão dentro do primeiro',
   (await pg.locator('#sb1 #thumbs').count()) === 1);
ok('a transcrição dentro do segundo', (await pg.locator('#sb2 #trBox').count()) === 1);
ok('a identificação dentro do terceiro', (await pg.locator('#sb3 #evBox').count()) === 1);
ok('e o gerar dentro do quarto', (await pg.locator('#sb4 #go').count()) === 1);
ok('revisar passo a passo saiu do cartão 1', (await pg.locator('#cardVideo #revisar').count()) === 0);
ok('e está no subpasso 1', (await pg.locator('#sb1 #revisar').count()) === 1);

console.log('\n[4] concluir um subpasso leva ao seguinte');
await pg.locator('#sb1 .sbOk').click(); await pg.waitForTimeout(400);
ok('o primeiro fechou', (await pg.locator('#sb1').evaluate(e=>e.open)) === false);
ok('e o segundo abriu', (await pg.locator('#sb2').evaluate(e=>e.open)) === true);
await pg.fill('#tr','WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nabri a tela');
await pg.dispatchEvent('#tr','input'); await pg.waitForTimeout(400);
ok('o estado do segundo acompanha', /1 trechos com tempo/.test(await pg.locator('#sbEst2').textContent()),
   await pg.locator('#sbEst2').textContent());
{
  const dl = pg.waitForEvent('download',{timeout:40000});
  await pg.locator('#sb4').evaluate(e=>e.open=true);
  await pg.locator('#md').click();
  await dl; await pg.waitForTimeout(500);
  ok('gerar marca o último subpasso',
     /documento gerado/.test(await pg.locator('#sbEst4').textContent()),
     await pg.locator('#sbEst4').textContent());
}
console.log('\n[5] o recado abre o e-mail de quem escreve, com o diagnóstico junto');
{
  /* ATÉ O BUILD 68 o recado ia por HTTP para `/api/chamado` e virava um
     chamado numerado num banco. No 69 o produto ficou grátis e sem servidor:
     o recado abre o programa de e-mail da pessoa, endereçado ao suporte, com o
     texto e o relatório no corpo. A régua lê o endereço pelo espelho
     `__ultimoEmail` — um `mailto:` não é pedido de rede. E cobra que nenhum
     pedido HTTP tenha sobrado no caminho. */
  const http = [];
  pg.on('request', r => { if (/\/api\/chamado|supabase/.test(r.url())) http.push(r.url()); });
  await pg.locator('#avisar').click();
  await pg.waitForFunction(() => {
    const el = document.getElementById('fbDiagOut');
    return el && el.textContent && el.textContent.length > 40;
  }, null, { timeout: 30000 });
  ok('o relatório é montado e fica visível antes de mandar',
     /diagn/i.test(await pg.locator('#fbDiagOut').textContent()));
  await pg.locator('#fbEnviar').click(); await pg.waitForTimeout(400);
  ok('recado vazio é recusado aqui mesmo',
     /Escreva alguma coisa/.test(await pg.locator('#fbMsg').textContent()),
     await pg.locator('#fbMsg').textContent());
  await pg.fill('#fbTexto','o PowerPoint sai sem a capa quando o caso está vazio');
  await pg.locator('.fbTipo[data-tipo="problema"]').click();
  await pg.locator('#fbEnviar').click(); await pg.waitForTimeout(700);
  const href = await pg.evaluate(() => window.__ultimoEmail || '');
  const u = href.startsWith('mailto:') ? new URL(href) : null;
  const corpo = u ? (u.searchParams.get('body') || '') : '';
  ok('abriu o e-mail endereçado ao suporte', !!u && u.pathname === 'suporte@walkstamp.com', href.slice(0, 60));
  ok('com o tipo no assunto', !!u && /Problema/.test(u.searchParams.get('subject') || ''),
     u ? u.searchParams.get('subject') : '');
  ok('o texto da pessoa no corpo', /PowerPoint sai sem a capa/.test(corpo), corpo.slice(0, 60));
  /* Depois da linha que separa o recado do relatório — e o relatório começa
     com o próprio "--- diagnóstico ---", então o corte é no PRIMEIRO "\n---\n". */
  const anexo = corpo.includes('\n---\n') ? corpo.slice(corpo.indexOf('\n---\n') + 5) : '';
  ok('e o diagnóstico junto', /diagn/i.test(anexo), anexo.slice(0, 60));
  /* UM `mailto:` TEM LIMITE, e o corpo também: acima de uns dois mil
     caracteres alguns programas de e-mail desistem. */
  ok('o endereço inteiro cabe no limite seguro', href.length < 2100, String(href.length));
  ok('nenhum pedido HTTP no caminho', http.length === 0, http.join(' | '));
  ok('a tela diz o que aconteceu', /programa de e-mail/.test(await pg.locator('#fbMsg').textContent()),
     await pg.locator('#fbMsg').textContent());
  /* Desmarcar a caixa tem que realmente tirar o relatório do envio. */
  await pg.locator('#fbDiag').uncheck();
  await pg.fill('#fbTexto','segundo recado, sem relatório');
  await pg.locator('#fbEnviar').click(); await pg.waitForTimeout(700);
  const href2 = await pg.evaluate(() => window.__ultimoEmail || '');
  const corpo2 = href2.startsWith('mailto:') ? (new URL(href2).searchParams.get('body') || '') : '';
  ok('desmarcada, o relatório não vai', /segundo recado/.test(corpo2) && !/---/.test(corpo2), corpo2.slice(0, 80));
}

ok('sem erro de JS', erros.length===0, erros.join(' | ').slice(0,180));
await br.close(); srv.close();
console.log(falhas?'\n'+falhas+' falha(s)':'\nAjustes de UX: tudo passou.');
process.exit(falhas?1:0);

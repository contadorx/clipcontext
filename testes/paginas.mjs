/* As duas páginas novas: segurança da informação (com a lista do que NÃO temos)
   e o substituto do Steps Recorder. Mais a navegação, o hreflang e o sitemap. */
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
import { criarProxy, exigirNext } from './proxy.mjs';
import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';
await exigirNext();
const ROOT=`${RAIZ_WS}/public`;
const T={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.ico':'image/x-icon','.png':'image/png','.xml':'application/xml','.txt':'text/plain'};
/* O site virou Next.js: as páginas não existem mais como arquivo em public/.
   O servidorzinho estático daqui virou um encaminhador para o Next — mesma
   porta, mesmas URLs no teste, e quem responde é o produto de verdade. */
const srv = criarProxy();
await new Promise(r=>srv.listen(8898,r));
const br=await chromium.launch({executablePath:CHROME_WS});
let falhas=0; const ok=(n,c,e)=>{console.log((c?'  ok   ':'  FALHA')+'  '+n+(e?'  → '+e:''));if(!c)falhas++};
const pg=await (await br.newContext()).newPage();
const erros=[]; pg.on('pageerror',e=>erros.push(e.message));

const SEG = {
 '/seguranca':    ['ISO/IEC 27001','SOC 2','21 CFR Part 11','GAMP 5','SOX / ITGC','HIPAA','LGPD / GDPR',
                   /* A frase de abertura mudou porque a conta paga passou a existir e o
                      anexo da sessão passou a ser possível. O que se cobra aqui é o que
                      CONTINUA verdade — o vídeo e o áudio nunca saem — e a existência da
                      exceção escrita. Cobrar a frase velha era cobrar uma promessa que
                      deixou de ser cumprida. */
                   'não recebe o seu vídeo','única exceção','apagar apaga o arquivo',
                   'versão offline','Do','responsabilidade sua',
                   'Produtize','48.417.292/0001-99'],
 '/en/security':  ['ISO/IEC 27001','SOC 2','21 CFR Part 11','GAMP 5','SOX / ITGC','HIPAA','LGPD / GDPR',
                   'never receives your video','one exception','deleting removes the file',
                   'offline version','your responsibility',
                   'Produtize','48.417.292/0001-99'],
 '/es/seguridad': ['ISO/IEC 27001','SOC 2','21 CFR Part 11','GAMP 5','SOX / ITGC','HIPAA','LGPD / RGPD',
                   'no recibe tu vídeo','única excepción','borrar borra el archivo',
                   'versión offline','responsabilidad tuya',
                   'Produtize','48.417.292/0001-99'],
};
console.log('\n[1] página de segurança: a lista do que não temos');
for (const [rota, termos] of Object.entries(SEG)) {
  const resp = await pg.goto('http://localhost:8898'+rota);
  ok(`${rota} responde 200`, resp.status()===200, String(resp.status()));
  const txt = await pg.locator('body').innerText();
  const faltou = termos.filter(t => !txt.includes(t));
  ok(`${rota} cita todas as normas e a identificação`, faltou.length===0, faltou.join(' | '));
  // a promessa central não pode virar promessa vaga
  ok(`${rota} ensina a conferir sozinho`, /F12|Network|Rede|Red/.test(txt));
  // e não pode prometer o que não tem
  ok(`${rota} não afirma ter certificação`,
     !/(somos|estamos|we are|we hold|tenemos)\s+(certificad|certified|ISO)/i.test(txt));
}

const PSR = {
 '/substituto-do-steps-recorder':   ['psr.exe','Clipchamp','Steps Recorder','Solution Manager','2027','SAP GUI','Gratuito'],
 '/en/steps-recorder-replacement':  ['psr.exe','Clipchamp','Steps Recorder','Solution Manager','2027','SAP GUI','Free'],
 '/es/alternativa-al-steps-recorder':['psr.exe','Clipchamp','Steps Recorder','Solution Manager','2027','SAP GUI','Gratuito'],
};
console.log('\n[2] página do Steps Recorder');
for (const [rota, termos] of Object.entries(PSR)) {
  const resp = await pg.goto('http://localhost:8898'+rota);
  ok(`${rota} responde 200`, resp.status()===200, String(resp.status()));
  const txt = await pg.locator('body').innerText();
  const faltou = termos.filter(t => !txt.includes(t));
  ok(`${rota} cobre o assunto inteiro`, faltou.length===0, faltou.join(' | '));
  // a limitação honesta tem que estar escrita, não escondida
  ok(`${rota} admite onde o concorrente era melhor`,
     /melhor|better|mejor/i.test(txt) && txt.includes('SAP GUI'));
  ok(`${rota} leva para a ferramenta`, await pg.locator('a.btn').count() >= 1);
}

const COMP = {
 '/comparativo':    ['FlowShare','Scribe','Tosca','Steps Recorder','€450','€75','US$ 13','Onde cada um ganha da gente','SAP GUI'],
 '/en/compare':     ['FlowShare','Scribe','Tosca','Steps Recorder','€450','€75','US$ 13','Where each of them beats us','SAP GUI'],
 '/es/comparativa': ['FlowShare','Scribe','Tosca','Steps Recorder','€450','€75','US$ 13','Dónde cada uno nos gana','SAP GUI'],
};
console.log('\n[2b] comparativo');
for (const [rota, termos] of Object.entries(COMP)) {
  const resp = await pg.goto('http://localhost:8898'+rota);
  ok(`${rota} responde 200`, resp.status()===200, String(resp.status()));
  const txt = await pg.locator('body').innerText();
  const faltou = termos.filter(t => !txt.includes(t));
  ok(`${rota} nomeia os concorrentes, os preços e onde perdemos`, faltou.length===0, faltou.join(' | '));
  ok(`${rota} avisa que os preços são de tabela e datados`, /agosto de 2026|August 2026|agosto de 2026/.test(txt));
}

console.log('\n[2c] o nome antigo não aparece fora do aviso histórico');
{
  for (const rota of ['/', '/en', '/es', '/comparativo', '/seguranca']) {
    await pg.goto('http://localhost:8898'+rota);
    const txt = await pg.locator('body').innerText();
    ok(`${rota} sem ClipContext`, !/clipcontext/i.test(txt));
  }
  /* O BLOCO DE APOIO SAIU DO SITE INTEIRO, e a regra virou o inverso.
     Ele já tinha saído da home e da ferramenta e vivia só na página de preços.
     Saiu de lá também: a página vende dois planos com preço e checkout, e um
     botão de "pague um café" ao lado de uma assinatura de R$ 349 por
     pessoa/ano é a página se desculpando por cobrar — quem está com o cartão
     na mão para para decidir entre comprar e doar.
     O que se cobra agora é que ele não volte por nenhuma porta. */
  for (const rota of ['/', '/precos', '/en/precos', '/de/preise', '/comparativo']) {
    await pg.goto('http://localhost:8898' + rota);
    await pg.waitForTimeout(400);
    ok(`${rota} não pede apoio`, (await pg.locator('#support').count()) === 0);
  }
  await pg.goto('http://localhost:8898/precos');
  await pg.waitForTimeout(400);
  const txtP = await pg.locator('body').innerText();
  ok('e a página de preços não fala em doação nem em Pix',
     !/\bpix\b|doa[çc][ãa]o|donate|café|coffee/i.test(txtP),
     (txtP.match(/[^\n]*(pix|doa[çc]|donate|café|coffee)[^\n]*/i) || ['(limpo)'])[0].slice(0, 70));
}

console.log('\n[2d] o cabeçalho tem a ação como botão');
{
  await pg.goto('http://localhost:8898/?lang=pt');
  const btn = pg.locator('header nav a.btnTop');
  ok('o link do app virou botão', await btn.count()===1);
  const bg = await btn.evaluate(el => getComputedStyle(el).backgroundColor);
  ok('e tem fundo de botão de verdade', bg !== 'rgba(0, 0, 0, 0)', bg);
  const comp = await pg.locator('header nav a[href="/comparativo"]').count();
  ok('o comparativo entrou no menu', comp>=1, String(comp));
}

console.log('\n[2e] nenhuma página começa com prosa solta antes do cabeçalho');
{
  /* O CORPO DA PÁGINA COMEÇA NO CABEÇALHO, e não em texto.
     Os `src/site/*.html` são fontes: o `lib/site.ts` recorta o miolo do corpo e
     o React monta o resto. Se o recorte errar o ponto de partida — foi o que
     aconteceu quando um COMENTÁRIO daqueles arquivos escreveu a tag de abertura
     do corpo entre crases —, o que sobra do comentário vira texto visível no
     topo, em toda página e nos cinco idiomas. Não dá erro, não some nenhum
     bloco, e o rodapé continua certo: só nasce meia tela de prosa em português
     acima do cabeçalho, empurrando o botão para fora da primeira tela do
     telefone. Quem pegou da primeira vez foi uma régua de dobra, medindo o
     sintoma a três passos da causa.
     Aqui se cobra a causa, em quatro páginas de dois moldes diferentes. */
  for (const rota of ['/?lang=pt', '/en', '/de/preise', '/fr/aide']) {
    await pg.goto('http://localhost:8898' + rota);
    const antes = await pg.evaluate(() => {
      const cab = document.querySelector('header');
      if (!cab) return '(sem cabeçalho)';
      const passo = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let no, solto = '';
      while ((no = passo.nextNode())) {
        if (cab.contains(no)) break;
        if (no.parentElement && getComputedStyle(no.parentElement).display === 'none') continue;
        /* O LINK DE PULAR É O ÚNICO QUE PODE ESTAR AQUI, e ele TEM de estar:
           ele só poupa o menu se for o primeiro item tabulável da página.
           Ele não é "texto solto" — é um link com nome próprio, fora da tela
           até receber o foco. A exceção é pelo SELETOR e não pelo texto: um
           perdão por palavra deixaria qualquer prosa passar bastando começar
           com "Pular para o conteúdo". */
        if (no.parentElement && no.parentElement.closest('a.pular')) continue;
        solto += no.textContent.trim() ? ' ' + no.textContent.trim() : '';
      }
      return solto.trim();
    });
    ok(`${rota}: nada escrito antes do cabeçalho`, antes === '', antes.slice(0, 90));
  }
}

console.log('\n[3] navegação e idiomas');
{
  await pg.goto('http://localhost:8898/en/security');
  const links = await pg.locator('footer a').evaluateAll(as => as.map(a => a.getAttribute('href')));
  ok('o rodapé leva à página de segurança e à do Steps Recorder',
     links.includes('/en/security') && links.includes('/en/steps-recorder-replacement'), links.join(' '));
  const alt = await pg.locator('link[rel=alternate]').evaluateAll(ls => ls.map(l => l.getAttribute('href')));
  ok('o hreflang aponta para o endereço traduzido de cada idioma',
     alt.includes('https://walkstamp.com/seguranca') &&
     alt.includes('https://walkstamp.com/en/security') &&
     alt.includes('https://walkstamp.com/es/seguridad'), alt.join(' '));
  const canon = await pg.locator('link[rel=canonical]').getAttribute('href');
  ok('o canonical aponta para si mesmo', canon==='https://walkstamp.com/en/security', canon);
  // o seletor de idioma tem que trocar de página, não voltar para a home
  const es = await pg.locator('header nav a', {hasText:'ES'}).getAttribute('href');
  // o ?lang= é o que faz a home lembrar a escolha; a página tem que ser a mesma
  ok('o seletor de idioma mantém a mesma página', es==='/es/seguridad?lang=es', es);
}

console.log('\n[4] sitemap e robots');
{
  /* `/sitemap.xml` virou ÍNDICE quando o blog entrou: as páginas fixas nascem
     no build e o mapa do blog é lido do banco a cada rastreio, e são duas
     cadências que não cabem num arquivo só. Então a régua segue o índice em vez
     de procurar as páginas nele — procurá-las ali passaria a cobrar do índice
     uma coisa que ele não promete mais. */
  const r1 = await pg.goto('http://localhost:8898/sitemap.xml');
  const idx = await r1.text();
  ok('o sitemap existe', r1.status()===200);
  ok('e ele é um índice, apontando para os dois mapas',
     /<sitemapindex/.test(idx) &&
     idx.includes('https://walkstamp.com/sitemap-paginas.xml') &&
     idx.includes('https://walkstamp.com/sitemap-blog.xml'), idx.slice(0, 120));

  const rp = await pg.goto('http://localhost:8898/sitemap-paginas.xml');
  const xml = await rp.text();
  ok('o mapa das páginas existe', rp.status()===200);
  ok('e traz as páginas novas nos três idiomas',
     ['/seguranca','/en/security','/es/seguridad','/substituto-do-steps-recorder',
      '/en/steps-recorder-replacement','/es/alternativa-al-steps-recorder',
      '/comparativo','/en/compare','/es/comparativa']
       .every(u => xml.includes('https://walkstamp.com'+u)));
  ok('sem endereço do domínio antigo', !/clipcontext/i.test(xml) && !/clipcontext/i.test(idx));
  const r2 = await pg.goto('http://localhost:8898/robots.txt');
  ok('o robots aponta para o sitemap', (await r2.text()).includes('sitemap.xml'));
}

ok('sem erro de JS', erros.length===0, erros.join(' | ').slice(0,200));
await br.close(); srv.close();
console.log(falhas?`\n${falhas} FALHA(S)`:'\nPáginas novas: tudo passou.');
process.exit(falhas?1:0);

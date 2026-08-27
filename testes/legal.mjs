/* Os documentos legais: identificação da empresa, direitos do titular e as
   afirmações que deixaram de ser verdade quando a medição entrou. */
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
import { criarProxy, exigirNext } from './proxy.mjs';
import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';
await exigirNext();
const ROOT=`${RAIZ_WS}/public`;
const T={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.ico':'image/x-icon','.png':'image/png'};
/* O site virou Next.js: as páginas não existem mais como arquivo em public/.
   O servidorzinho estático daqui virou um encaminhador para o Next — mesma
   porta, mesmas URLs no teste, e quem responde é o produto de verdade. */
const srv = criarProxy();
await new Promise(r=>srv.listen(8893,r));
const br=await chromium.launch({executablePath:CHROME_WS});
let falhas=0; const ok=(n,c,e)=>{console.log((c?'  ok   ':'  FALHA')+'  '+n+(e?'  → '+e:''));if(!c)falhas++};

const EMPRESA='Produtize Produtos e Serviços Inteligentes Ltda.';
const CNPJ='48.417.292/0001-99';
const MAIL='privacidade@walkstamp.com';

/* QUANTOS MARCOS A POLÍTICA DIZ QUE EXISTEM — contra quantos o produto emite.
 *
 * A política dizia "três" nos cinco idiomas, em até cinco lugares cada. São
 * QUINZE: onze na ferramenta (`medir(...)` em `src/template.html`) e quatro na
 * conta (`lib/conta/medir.ts`). O `check` da tabela `walkstamp.evento` lista
 * exatamente esses quinze — é ele a fonte, e não uma lista escrita aqui.
 *
 * O Build 1 corrigiu a /seguranca e NÃO viu a /privacidade: mesma frase, outro
 * arquivo. E a política é justamente o documento onde um número errado sobre
 * medição custa mais. Esta régua existe para que o par não se separe de novo. */
const NUMEROS = { 3: 'três|three|tres|drei|trois', 15: 'quinze|fifteen|quince|fünfzehn' };
function marcosQueOProdutoEmite(){
  const migr = fs.readdirSync(`${RAIZ_WS}/supabase/migrations`)
    .map((f) => fs.readFileSync(`${RAIZ_WS}/supabase/migrations/${f}`, 'utf8'))
    .filter((s) => /evento_nome_check check/.test(s)).pop() || '';
  const bloco = /evento_nome_check check \(nome in \(([\s\S]*?)\)\)/.exec(migr);
  return bloco ? (bloco[1].match(/'[a-z_]+'/g) || []).length : 0;
}

const paginas = {
 '/privacidade.html':    {tem:['Quem é responsável','Bases legais','Onde os dados ficam','Seus direitos','ANPD','São Paulo','art. 33','Marco Civil'], nao:['não há informação\nsua para acessar','Como não coletamos dados, não há informação']},
 '/en/privacidade.html': {tem:['Who is responsible','Legal bases','Where the data lives','Your rights','ANPD','São Paulo','art. 33','Internet Civil Framework'], nao:['there is no information of yours to access','Since we collect no data']},
 '/es/privacidade.html': {tem:['Quién es responsable','Bases legales','Dónde están los datos','Tus derechos','ANPD','São Paulo','art. 33','Marco Civil'], nao:['no hay información tuya que acceder','Como no recogemos datos']},
 /* ALEMÃO E FRANCÊS ENTRARAM — 23/08.
    Esta lista tinha três idiomas num site que fala cinco, e os dois que
    faltavam são justamente os dois mercados que fazem avaliação de fornecedor:
    a régua de razão social, ANPD e Marco Civil não olhava para nenhum deles.
    `Art. 33` com maiúscula em alemão, e é assim que ele está na página. */
 '/de/privacidade.html': {tem:['Wer verantwortlich ist','Wo die Daten liegen','Ihre Rechte','ANPD','São Paulo','Art. 33','Marco Civil'], nao:['gibt es keine Information von Ihnen']},
 '/fr/privacidade.html': {tem:['Qui est responsable','Où les données se trouvent','Vos droits','ANPD','São Paulo','art. 33','Marco Civil'], nao:['il n’y a aucune information vous concernant']},
 /* OS TERMOS PASSARAM A VENDER — 27/08.
    Até aqui a cláusula 14 dizia "não há nada à venda" e o único dado pessoal
    do site era o e-mail da lista de aviso. Os dois viraram mentira no dia em
    que a conta, a degustação de 14 dias e o cancelamento na conta entraram no
    produto. A régua agora exige as quatro frases que sustentam a venda —
    está à venda, degustação, cancelar na conta, sem devolução proporcional —
    e PROÍBE as duas antigas, para que a volta atrás caia aqui e não no
    contrato de alguém. Alemão e francês entraram junto: os termos falavam
    cinco idiomas e esta lista olhava para três. */
 '/termos.html':         {tem:['Quem oferece o serviço','Privacidade','estão à venda','14 dias com tudo','Cancelar se faz na sua conta','não há devolução','art. 49','Lei aplicável','Contato'],
                          nao:['lista de aviso','não há nada à venda']},
 '/en/termos.html':      {tem:['Who provides the service','Privacy','are for sale','14 days with everything','Cancelling is done in your account','no pro-rata refund','art. 49','Governing law','Contact'],
                          nao:['notification list','nothing is for sale']},
 '/es/termos.html':      {tem:['Quién ofrece el servicio','Privacidad','están a la venta','14 días con todo','Cancelar se hace en tu cuenta','devolución proporcional','art. 49','Ley aplicable','Contacto'],
                          nao:['lista de aviso','no hay nada a la venta']},
 '/de/termos.html':      {tem:['Wer den Dienst anbietet','Datenschutz','stehen zum Verkauf','14 Tage mit allem','Gekündigt wird im eigenen Konto','keine anteilige Erstattung','Art. 49','Anwendbares Recht','Kontakt'],
                          nao:['Benachrichtigungsliste','steht nichts zum Verkauf']},
 '/fr/termos.html':      {tem:['Qui propose le service','Confidentialité','sont en vente','14 jours avec','La résiliation se fait dans votre compte','pas de remboursement au prorata','art. 49','Loi applicable','Contact'],
                          nao:['liste de notification','rien n’est en vente']},
};

for (const [rota, {tem, nao}] of Object.entries(paginas)) {
  console.log('\n' + rota);
  const ctx=await br.newContext(); const pg=await ctx.newPage();
  await pg.goto('http://localhost:8893'+rota);
  const txt=await pg.locator('body').innerText();
  ok('razão social', txt.includes(EMPRESA));
  ok('CNPJ', txt.includes(CNPJ));
  ok('e-mail de contato é clicável',
     (await pg.locator(`a[href="mailto:${MAIL}"]`).count()) > 0,
     (await pg.locator(`a[href^="mailto:"]`).count()) + ' links mailto');
  for (const t of tem) ok(`traz "${t}"`, txt.includes(t));
  for (const n of nao) ok(`não afirma mais: "${n.slice(0,40)}"`, !txt.includes(n));
  // numeração dos termos sem buraco nem repetição
  if (rota.includes('termos')) {
    const ns=[...txt.matchAll(/^(\d+)\.\s/gm)].map(m=>+m[1]);
    ok('artigos numerados de 1 a N sem falha',
       ns.length>0 && ns.every((v,i)=>v===i+1), ns.join(','));
  }
  /* A tabela de bases legais tem que renderizar como tabela — e tem que falar
     do que o cliente PAGANTE confia à gente. Ela listava só a lista de aviso,
     os marcos, as visitas e os registros de acesso: tudo, menos a conta. Contar
     linhas trancava um número; o que interessa é que cada linha tenha as quatro
     colunas preenchidas e que as duas que faltavam estejam lá. */
  if (rota.includes('privacidade')) {
    /* CADA TABELA PELO SEU `id`.
       Esta conferência mirava em `table.legal` — que era uma tabela só quando
       foi escrita. Quando a política ganhou a tabela de PAPÉIS (3 colunas) e a
       de SUBOPERADORES (5), o seletor passou a somar as três e a acusar 11
       linhas "sem as quatro colunas" numa página correta. Uma régua que mira
       numa classe compartilhada mede o que aparecer ali depois. */
    const linhas = await pg.locator('table#basesLegais tr').count();
    ok('a tabela de bases legais renderiza como tabela', linhas >= 5, linhas + ' linhas');
    const vazias = await pg.locator('table#basesLegais tr').evaluateAll((trs) =>
      trs.slice(1).filter((tr) => [...tr.querySelectorAll('td')].length !== 4
        || [...tr.querySelectorAll('td')].some((td) => !td.textContent.trim())).length);
    ok('e cada linha diz dado, finalidade, base legal e prazo', vazias === 0, String(vazias));

    /* AS DUAS TABELAS NOVAS — por ora só em português.
       A separação de papéis e a tabela de suboperadores entraram primeiro em
       `privacidade.pt.html`, para serem revisadas antes de virarem cinco
       traduções de um texto jurídico. Quando en/es/de/fr receberem as duas
       seções, ESTA CONDIÇÃO SAI e a cobrança passa a valer nas três rotas.
       Quem não deixa isso ser esquecido é `testes/terceiros.mjs`, que já falha
       hoje, por idioma, dizendo qual tabela falta.

       O que cada uma tem que afirmar:
       A de papéis é a que decide uma avaliação de fornecedor: dizer-se
       "controladora" dos dados que o cliente confia à conta paga é o erro que
       reprova sozinho, porque quem decide finalidade e meios ali é o cliente. */
    if (rota === '/privacidade.html') {
    const papeis = (await pg.locator('table#papeis').textContent().catch(() => '')) || '';
    ok('a política separa os dois papéis', /operadora/i.test(papeis) && /controladora/i.test(papeis),
       papeis ? 'tem a tabela' : 'falta table#papeis');
    ok('e a conta paga está do lado de OPERADORA',
       /operadora[\s\S]{0,120}cliente/i.test(papeis.replace(/\s+/g, ' ')),
       papeis.replace(/\s+/g, ' ').slice(0, 100));

    const subs = await pg.locator('table#suboperadores tr').evaluateAll((trs) =>
      trs.slice(1).filter((tr) => [...tr.querySelectorAll('td')].length !== 5
        || [...tr.querySelectorAll('td')].some((td) => !td.textContent.trim())).length);
    ok('e a tabela de suboperadores diz nome, função, dado, país e salvaguarda',
       subs === 0, String(subs));
    }

    const col1 = await pg.locator('table#basesLegais tr td:first-child').allTextContents();
    /* ISTO PULAVA POR UM MOTIVO QUE JÁ NÃO ERA VERDADE — consertado em 24/08.
       O texto dizia que as tabelas de `de` e `fr` tinham 13 linhas contra 15 do
       `pt`, faltando a da CONTA PAGA e a da FATURA, e que traduzi-las exigia
       revisão jurídica antes de publicar prazo de retenção em dois mercados que
       fazem avaliação de fornecedor.
       Medido: as CINCO tabelas têm as mesmas sete linhas, e as duas em questão
       estão lá em alemão ("Inhalt des bezahlten Kontos", "Rechnung") e em
       francês ("Contenu du compte payant", "La facture"). A tradução já tinha
       sido feita — em algum momento, sem que este arquivo ficasse sabendo.
       O que faltava era a RÉGUA: as duas expressões regulares só conheciam
       português, inglês e espanhol, então nem se o alemão estivesse perfeito
       ele passaria. O pulo escondia a cobertura de dois idiomas atrás de um
       motivo que tinha deixado de existir — e um pulo que sobrevive ao conserto
       é lixo que esconde o próximo defeito. Agora as cinco são cobradas. */
    ok('a conta paga está na tabela de prazos',
       col1.some((c) => /conta paga|paid-account|cuenta de pago|bezahlten Kontos|compte payant/i
         .test(c)), col1.join(' | ').slice(0, 140));
    ok('e a fatura também, que é a que NÃO é apagada em 90 dias',
       col1.some((c) => /fatura|invoice|factura|Rechnung/i.test(c)
         || /^la facture/i.test(c.trim())), col1.join(' | ').slice(0, 140));
  }
  ok('sem token do build sobrando', !/\{\{|\}\}/.test(txt));
  await ctx.close();
}

// o rodapé continua levando às duas páginas, nos três idiomas
console.log('\nnavegação');
for (const [rota, alvo] of [['/', '/privacidade'], ['/en', '/en/privacidade'], ['/es', '/es/privacidade']]) {
  const ctx=await br.newContext(); const pg=await ctx.newPage();
  await pg.goto('http://localhost:8893'+rota+'?lang=pt');
  ok(`${rota}: link para a política no rodapé`,
     (await pg.locator(`footer a[href="${alvo}"]`).count()) === 1);
  await ctx.close();
}

console.log('\n[marcos] a política conta os mesmos marcos que o produto emite');
{
  const N = marcosQueOProdutoEmite();
  ok('o banco declara quantos marcos existem', N > 0, String(N));
  for (const L of ['pt', 'en', 'es', 'de', 'fr']) {
    const html = fs.readFileSync(`${RAIZ_WS}/src/site/bodies/privacidade.${L}.html`, 'utf8');
    /* Por PALAVRA e não por dígito: a política escreve o número por extenso,
       que é como um documento jurídico o escreve. */
    const errado = new RegExp(`(${NUMEROS[3]})\\s+(marcos|usage milestones|hitos|Nutzungsmeilenstein|jalons)`, 'i');
    ok(`${L}: não diz "três marcos"`, !errado.test(html), (html.match(errado) || [''])[0]);
    const certo = new RegExp(`(${NUMEROS[15]})\\s+(marcos|usage milestones|hitos|Nutzungsmeilenstein|jalons)`, 'i');
    ok(`  e diz o número certo (${N})`, N !== 15 || certo.test(html),
       (html.match(certo) || ['nenhum'])[0]);
  }
}

await br.close(); srv.close();
console.log(falhas?`\n${falhas} FALHA(S)`:'\nDocumentos legais: tudo passou.');
process.exit(falhas?1:0);

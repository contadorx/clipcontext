/* OS CARTÕES DE PLANO E O CATÁLOGO CONTAM A MESMA HISTÓRIA.
 *
 * A página de preços tem DUAS listas, e elas vinham de lugares diferentes:
 *
 *   a lista comparativa   montada de `src/features.json` por `tabelaDePlanos()`,
 *                         nos cinco idiomas, de uma fonte só;
 *   os cartões de plano   escritos à mão em cinco arquivos `precos.<lang>.html`.
 *
 * Medido em 21/08/2026, antes do conserto: os cartões marcavam QUATRO coisas
 * como "em breve" e o catálogo não marcava nenhuma. Três delas existiam desde
 * 16 de agosto — modelo de documento próprio, perfil entre máquinas e padrão do
 * time empurrado. O produto estava deixando de vender o que já fazia.
 *
 * A quarta — a lista de termos guardada — de fato não existe: `vocLista` mora
 * em `sessionStorage` e morre com a aba. Essa continua marcada, e agora a marca
 * mora no catálogo, que é onde a regra do arquivo sempre disse que ela morava:
 * "só entra o que EXISTE; o que ainda não existe entra com breve: true".
 *
 * Este arquivo é o portão. Ele é ESTÁTICO de propósito — lê JSON e HTML, sem
 * navegador e sem servidor. Um portão de release que precisa de `next start`
 * é um portão que se aprende a pular.
 */
/* ---------------------------------------------------------------------------
 * ONDE OS CARTOES MORAM AGORA, e por que esta regua mudou de fonte.
 *
 * Ate a rodada que refez a pagina, os cartoes eram escritos a mao dentro dos
 * cinco `precos.<lang>.html`, e era exatamente disso que este arquivo nasceu:
 * duas listas, duas fontes, e o alemao dizendo uma coisa que o portugues nao
 * dizia. Agora eles saem de uma constante nomeada no `build.py` (`CARTOES`) e
 * chegam pelo `src/precos.json`.
 *
 * A regua segue o conteudo. Continuar lendo o corpo faria ela nao achar cartao
 * nenhum e APROVAR POR VAZIO — que e o pior jeito de um portao morrer: ele
 * continua verde e para de olhar.
 *
 * Tres afirmacoes deste arquivo cobravam estruturas que a rodada removeu de
 * proposito, e estao reescritas no lugar, cada uma dizendo o que substituiu:
 * a secao de lista de espera do Pro/API, a caixa `roteiroFuturo`, e a abertura
 * que nomeava Free/Personal/Team.
 * ------------------------------------------------------------------------ */
import fs from 'fs';
import { RAIZ_WS } from './_caminhos.mjs';

const IDIOMAS = ['pt', 'en', 'es', 'de', 'fr'];
const cat = JSON.parse(fs.readFileSync(`${RAIZ_WS}/src/features.json`, 'utf8'));
const dic = JSON.parse(fs.readFileSync(`${RAIZ_WS}/src/i18n-site.json`, 'utf8'));
const PRECOS = JSON.parse(fs.readFileSync(`${RAIZ_WS}/src/precos.json`, 'utf8'));
/* Os cartoes de um idioma, como HTML. Uma funcao so, para que trocar de
   fonte outra vez seja uma linha e nao uma cacada. */
const cartoesDe = (L) => PRECOS[L].cartoes;
/* O corpo continua existindo, e continua sendo lido: e nele que moram o
   hero, as provas, o FAQ e a lista recolhida. */
const corpoDe = (L) => fs.readFileSync(`${RAIZ_WS}/src/site/bodies/precos.${L}.html`, 'utf8');

let falhas = 0;
const ok = (n, c, e) => { console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : '')); if (!c) falhas++ };

const itens = cat.grupos.flatMap((g) => g.itens);
const porId = new Map(itens.filter((i) => i.id).map((i) => [i.id, i]));

console.log('[1] o catálogo é a fonte, e ele se descreve');
{
  const semTexto = itens.filter((i) => IDIOMAS.some((L) => !String(i[L] || '').trim()));
  ok('todo item existe nos cinco idiomas', semTexto.length === 0,
     semTexto.slice(0, 3).map((i) => i.pt).join(' | '));
  const planoTorto = itens.filter((i) => !/^[fpt]+$/.test(i.planos || ''));
  ok('e todo item diz de que plano é', planoTorto.length === 0,
     planoTorto.slice(0, 3).map((i) => i.pt).join(' | '));
  const alcas = itens.filter((i) => i.id).map((i) => i.id);
  ok('as alças são únicas', new Set(alcas).size === alcas.length, alcas.join(' '));
}

console.log('\n[2] cada cartão aponta para um item que existe');
const marcados = {};
for (const L of IDIOMAS) {
  const html = cartoesDe(L);
  /* Todo `<li>` do cartão que carrega alça, com o que vem dentro dele. */
  const bullets = [...html.matchAll(/<li data-f="([^"]+)">([\s\S]*?)<\/li>/g)]
    .map((m) => ({ id: m[1], dentro: m[2] }));
  marcados[L] = bullets;
  const orfas = bullets.filter((b) => !porId.has(b.id)).map((b) => b.id);
  ok(`${L}: nenhuma alça aponta para o vazio`, orfas.length === 0, orfas.join(' '));
}

console.log('\n[3] OS CINCO CARTÕES PROMETEM AS MESMAS COISAS');
{
  /* Uma página que promete mais em espanhol do que em português não é erro de
     tradução: é o produto sendo outro dependendo de quem lê. */
  const base = marcados.pt.map((b) => b.id).sort().join(',');
  for (const L of IDIOMAS.slice(1)) {
    const meu = marcados[L].map((b) => b.id).sort().join(',');
    ok(`${L} cita os mesmos itens que o pt`, meu === base, meu || '(nenhum)');
  }
}

console.log('\n[4] O SELO SAI DO CATÁLOGO, E DE MAIS NENHUM LUGAR');
{
  /* `breve: true` virou `estado`, com quatro valores em vez de dois — e
     `estado` ausente quer dizer `producao`. O que esta régua cobra não mudou:
     o cartão e o catálogo têm que dizer a mesma coisa sobre o que ainda não
     existe. O que mudou é que agora "não existe" tem grau. */
  const estadoDe = (i) => i.estado || 'producao';
  for (const L of IDIOMAS) {
    const erradas = marcados[L].filter((b) => {
      const temSelo = /class="soon"/.test(b.dentro);
      return temSelo !== (estadoDe(porId.get(b.id)) === 'construcao');
    });
    ok(`${L}: cartão e catálogo concordam sobre o que ainda não existe`,
       erradas.length === 0,
       erradas.map((b) => `${b.id}: cartão diz ${/soon/.test(b.dentro) ? 'breve' : 'pronto'}, ` +
                          `catálogo diz ${estadoDe(porId.get(b.id))}`).join(' | '));
    /* E a PALAVRA do selo é a mesma dos dois lados. O alemão dizia "bald" no
       cartão e "demnächst" na lista comparativa — duas palavras para o mesmo
       selo, na mesma página, e nenhum teste reclamava. */
    const palavra = dic[L].tpBreve;
    const outra = marcados[L].filter((b) => /class="soon"/.test(b.dentro) &&
                                            !b.dentro.includes(`>${palavra}<`));
    ok(`${L}: e usa a mesma palavra da lista comparativa ("${palavra}")`,
       outra.length === 0, outra.map((b) => b.dentro.match(/soon">([^<]*)</)?.[1]).join(' '));
  }
}

console.log('\n[5] e nada fora dos cartões promete futuro por conta própria');
{
  /* O rodapé da página explica o que o selo quer dizer, e é o único `soon` que
     pode existir sem alça. Qualquer outro é uma promessa que ninguém registrou
     no catálogo — que é exatamente como as três de 16/08 ficaram esquecidas. */
  /* MUDOU DE FORMA, E A REGRA FICOU MAIS SIMPLES.
     Antes o corpo trazia selos escritos a mao e a conta era "todos == com alca
     + 1", sendo o +1 o do rodape que explica. Agora NENHUM selo e escrito a
     mao: os dos cartoes sairiam de `CARTOES` e nao existem, e os da lista
     completa nascem de `tabelaDePlanos()` a partir do estado do catalogo. A
     legenda que os explica e o token `{{tpLegenda}}`.
     Entao a regra e: zero selo a mao, nos cinco corpos e nos cinco cartoes. */
  for (const L of IDIOMAS) {
    const noCorpo = (corpoDe(L).match(/class="soon"|class="beta"|class="descoberta"/g) || []).length;
    ok(`${L}: nenhum selo escrito à mão no corpo`, noCorpo === 0, `${noCorpo} selo(s)`);
    const noCartao = (cartoesDe(L).match(/class="soon"|class="beta"|class="descoberta"/g) || []).length;
    ok(`  nem nos cartões`, noCartao === 0, `${noCartao} selo(s)`);
    ok(`  e a legenda que explica os selos está na página`,
       corpoDe(L).includes('{{tpLegenda}}'));
  }
}

console.log('\n[6] UM ESTADO POR PLANO, e a lista espera o que não existe');
{
  /* O DEFEITO. A página vendia o Personal com preço, badge de 14 dias e
     "na hora, sem cartão" — e cinquenta linhas abaixo pedia o e-mail da pessoa
     para avisar "quando o plano pago sair". As duas coisas na mesma página, e
     as duas em cinco idiomas.

     Não era erro de texto: era a página não saber que o que ela promete já foi
     entregue. O mesmo defeito do B1, no outro sentido — lá ela escondia o que
     existia, aqui ela promete o que já existe. */
  for (const L of IDIOMAS) {
    const html = cartoesDe(L);

    const planos = [...html.matchAll(/<div class="plan[^"]*" data-plano="([^"]+)"/g)].map((m) => m[1]);
    ok(`${L}: os três planos têm identidade`, planos.join() === 'free,personal,team', planos.join());

    /* UMA ação primária por cartão. Dois botões num cartão de preço é a pessoa
       parada escolhendo entre eles em vez de escolhendo o plano. */
    /* Cortar no primeiro `</div>` não serve: há `<div>` aninhado dentro do
       cartão. Dividir pelo próprio marcador dá os três pedaços certos — o
       último vai até o fim da fileira, e é o que se quer. */
    const fileira = html.slice(html.indexOf('<div class="plans'));
    const cartoes = fileira.split(/<div class="plan[^"]*" data-plano=/).slice(1);
    const botoes = cartoes.map((c) => (c.match(/<a class="btn/g) || []).length);
    ok(`${L}: uma ação primária em cada`, botoes.length === 3 && botoes.every((n) => n === 1),
       botoes.join('/'));

    /* A LISTA DE ESPERA SAIU DA PÁGINA, E A REGRA VIROU O INVERSO.
       Ela existia para o Pro e a API, e a afirmação de cima cobrava que o que
       ela esperava não fosse o que a página já vendia — a contradição de pedir
       e-mail para avisar de um plano com preço na tela.
       A página agora vende dois planos disponíveis e não pede e-mail nenhum.
       Pedir de novo é reabrir a contradição pela porta dos fundos, e é isso
       que esta afirmação passa a impedir. */
    const corpo = corpoDe(L);
    ok(`${L}: nenhuma seção de lista de espera entre os planos`,
       !/data-espera=/.test(corpo), (corpo.match(/data-espera="[^"]*"/) || [''])[0]);
    ok(`  e nenhum campo de e-mail na página`,
       !/type="email"/.test(corpo), (corpo.match(/type="email"[^>]*/) || [''])[0]);
  }
}

console.log('\n[7] o que o Personal PROMETE é o que a planilha DEVOLVE');
{
  /* O cartão do Personal parou de vender identidade visual e passou a vender a
     rodada de casos: "suba a planilha, cada caso vira um link, e ela volta em
     .xlsx com situação, quando, quem executou, o arquivo e a impressão".
     "Colocar logotipo" se compara com editar um Word; isto substitui um
     processo.
     
     A promessa e a entrega moram em arquivos diferentes, então elas podem
     divergir em silêncio: tirar uma coluna do export não faz a página parar de
     prometê-la. Esta afirmação amarra as duas. */
  const rota = fs.readFileSync(`${RAIZ_WS}/app/conta/planilha/route.ts`, 'utf8');
  const cab = (rota.match(/const cab = \[([\s\S]*?)\]/) || [])[1] || '';
  const colunas = [...cab.matchAll(/t\.(rot[A-Za-z]+)/g)].map((m) => m[1]);
  /* As cinco que o cartão nomeia, uma a uma. Um `every` sobre a lista inteira
     diria "sim" com quatro delas presentes e a quinta trocada por outra. */
  for (const c of ['rotColSit', 'rotColQuando', 'rotColQuem', 'rotColArq', 'rotColImp']) {
    ok(`a planilha devolve ${c}`, colunas.includes(c), colunas.join(' '));
  }
  ok('e sai em .xlsx, como o cartão diz', /montarXlsx/.test(rota));

  /* E o cartão continua liderando pelo roteiro. A primeira bala é a que a
     pessoa lê; se ela voltar a ser o logotipo, o reposicionamento se desfez
     sem ninguém mexer numa linha de código. */
  /* A primeira bala é a que a pessoa lê. Se ela voltar a ser o logotipo, o
     reposicionamento se desfez sem ninguém mexer numa linha de código.
     A palavra mudou — o cartão agora diz "importe a planilha de casos de
     teste", e não a extensão do arquivo —, então a régua pergunta pela
     PLANILHA, em cada língua, e não por `xlsx`. */
  const PLANILHA = { pt: /planilha/i, en: /spreadsheet/i, es: /planilla/i,
                     de: /tabelle/i, fr: /tableur/i };
  for (const L of IDIOMAS) {
    const html = cartoesDe(L);
    const card = html.slice(html.indexOf('data-plano="personal"'));
    const primeira = (card.match(/<li[^>]*>([\s\S]*?)<\/li>/) || [])[1] || '';
    ok(`${L}: a primeira bala do Personal é a rodada de casos`,
       PLANILHA[L].test(primeira), primeira.replace(/<[^>]*>/g, '').slice(0, 70));
  }
}


console.log('\n[8] a ABERTURA da página diz o mesmo que os cartões');
{
  /* A CONTRADIÇÃO PRINCIPAL, e ela sobreviveu a dois builds.
   *
   * O B5 reescreveu o cartão do Personal em torno da rodada de casos. A
   * abertura da página continuou dizendo, em cinco idiomas, que o que se paga é
   * "a identidade do documento e a administração de uma equipe" — texto
   * anterior. A página passou a argumentar contra o próprio cartão: quem lê o
   * primeiro parágrafo compara R$ 149/ano com "PDF com logotipo" e vai embora
   * antes de chegar na bala que fala da planilha.
   *
   * Isso é o que uma régua não pega quando ela só olha os cartões. Aqui a
   * abertura tem que nomear os TRÊS TRABALHOS — caso avulso, roteiro
   * individual, execução coordenada —, que é a promessa que os cartões
   * entregam logo abaixo. */
  /* A ABERTURA MUDOU DE FORMA, E A PERGUNTA ACOMPANHOU.
     Ela nomeava Free, Personal e Team. A página nova lidera pelo RESULTADO —
     o nome do plano desceu para o subtítulo do cartão, que é a inversão que
     sustenta a rodada inteira. Cobrar os três nomes na abertura seria cobrar
     de volta o arranjo que a rodada desfez.
     O que a abertura precisa continuar respondendo é o que ela sempre
     precisou, e é o critério de aceite do hero: o que é grátis, e por que
     alguém paga. As duas coisas, na mesma abertura, em cada língua. */
  const GRATIS = { pt: /gr[áa]tis|gratuit/i, en: /free/i, es: /grat/i,
                   de: /kostenlos|gratis/i, fr: /gratuit/i };
  const PAGA = { pt: /paga|pagar/i, en: /\bpay\b/i, es: /paga|pagar/i,
                 de: /zahl/i, fr: /payez|payer|payant/i };
  const IDENTIDADE = {
    pt: /o que é pago é a .{0,20}identidade/i,
    en: /what you pay for is the .{0,20}identity/i,
    es: /lo que se paga es la .{0,20}identidad/i,
    de: /bezahlt werden die .{0,20}identität/i,
    fr: /ce qui est payant.{0,30}identité/i,
  };
  for (const L of IDIOMAS) {
    const html = corpoDe(L);
    /* Só a abertura: do começo até o bloco dos cartões. Olhar a página inteira
       faria esta afirmação passar sem que a abertura dissesse nada. */
    const abertura = html.slice(0, html.indexOf('{{cartoesPlanos}}'));
    const limpo = abertura.replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    ok(`${L}: a abertura diz o que é grátis`, GRATIS[L].test(limpo), limpo.slice(0, 90));
    ok(`${L}: e por que alguém paga`, PAGA[L].test(limpo), limpo.slice(0, 90));
    ok(`${L}: e não volta a vender identidade e administração`,
       !IDENTIDADE[L].test(abertura),
       (abertura.match(IDENTIDADE[L]) || [''])[0]);
  }
}

console.log('\n[9] nenhum "em breve" DENTRO de um cartão de plano');
{
  /* A REGRA, e por que ela vale a pena.
   *
   * Um item marcado "em breve" no meio das balas do plano obriga quem decide a
   * separar, linha a linha, o que já se compra do que foi prometido. Isso não é
   * transparência: é trabalho passado para quem está pagando, na hora em que
   * ele está com o cartão na mão.
   *
   * A separação é de lugar, e não de redação: o que está no cartão está
   * utilizável no ambiente vendido; o que ainda não existe mora na caixa do
   * roteiro, abaixo dos cartões e fora da conta. O selo continua permitido —
   * na caixa, e no rodapé que o explica. */
  /* A SEPARAÇÃO CONTINUA, E MUDOU DE CAIXA.
     Era a `roteiroFuturo`, um bloco logo abaixo dos cartões. A página nova
     recolheu a lista completa num `<details>` no fim, e é lá que os itens com
     estado moram — abaixo dos cartões e fora da decisão de compra, que era a
     razão da caixa antiga. A regra de lugar é a mesma; o container é outro. */
  for (const L of IDIOMAS) {
    const dentro = (cartoesDe(L).match(/class="soon"|class="beta"|class="descoberta"/g) || []).length;
    ok(`${L}: os cartões só prometem o que já existe`, dentro === 0, dentro + ' selo(s)');
    ok(`${L}: e a lista recolhida existe para receber o resto`,
       /<details class="listaCompleta"/.test(corpoDe(L)));
    /* E o que o cartão aponta por alça tem de estar em produção — é a trava
       que impede um benefício de vender uma funcionalidade que o catálogo diz
       que ainda não existe. */
    const estadoDe = (i) => i.estado || 'producao';
    const prometidas = marcados[L].filter((b) => estadoDe(porId.get(b.id)) !== 'producao');
    ok(`${L}: nenhum benefício aponta para o que não está em produção`,
       prometidas.length === 0,
       prometidas.map((b) => `${b.id}=${estadoDe(porId.get(b.id))}`).join(' '));
  }
}

console.log('\n[10] a home diz que TRABALHO ela substitui, e não só o mecanismo');
{
  /* A home explicava bem o mecanismo e nunca dizia qual trabalho ela toma o
     lugar. Um recurso se compara com outro recurso; um fluxo se compara com a
     segunda-feira de quem executa uma rodada de casos.
     
     As quatro linhas do "antes e depois" apontam para peças que EXISTEM — o
     link que abre o caso preenchido, os passos com hora, o recibo preso ao
     caso, a planilha que volta. Por isso a régua cobra as quatro nos cinco
     idiomas: uma tradução que perdesse uma linha faria a página prometer
     menos numa língua do que na outra, que é o mesmo defeito do [3]. */
  const home = fs.readFileSync(`${RAIZ_WS}/src/site/home.html`, 'utf8');
  ok('a seção existe na home', /id="antesdepois"/.test(home));
  ok('e é tabela de verdade, com cabeçalho de coluna',
     /<table class="antesDepois">/.test(home) && (home.match(/scope="col"/g) || []).length === 2);
  ok('e as quatro linhas estão lá',
     [1, 2, 3, 4].every((n) => home.includes(`{{ad${n}A}}`) && home.includes(`{{ad${n}D}}`)));

  const site = JSON.parse(fs.readFileSync(`${RAIZ_WS}/src/i18n-site.json`, 'utf8'));
  const CHAVES = ['adH', 'adP', 'adAntes', 'adDepois',
                  'ad1A', 'ad1D', 'ad2A', 'ad2D', 'ad3A', 'ad3D', 'ad4A', 'ad4D'];
  for (const L of IDIOMAS) {
    const faltando = CHAVES.filter((k) => !site[L] || !String(site[L][k] || '').trim());
    ok(`${L}: as doze frases do antes e depois existem`, faltando.length === 0,
       faltando.join(', '));
  }
  /* E o depois fala da RODADA, e não de um documento avulso: é isso que
     distingue esta seção de mais uma lista de recursos. */
  for (const L of IDIOMAS) {
    const depois = ['ad1D', 'ad2D', 'ad3D', 'ad4D'].map((k) => site[L][k]).join(' ');
    ok(`${L}: e a coluna do depois termina na planilha devolvida`,
       /xlsx/i.test(depois), depois.slice(-70));
  }
}

console.log('\n[11] a home apresenta os três planos, e mostra quatro formatos');
{
  /* DOIS DEFEITOS DA MESMA PAGINA, e eles se anulavam.
   *
   * A home empurrava so para o Free: o Personal so aparecia na pagina de
   * precos, entao quem chega com uma planilha de casos na mao tinha que
   * adivinhar que existe um plano para isso. E logo na primeira rolagem havia
   * TREZE fichas de formato, que fazem a pagina parecer um conversor de arquivo
   * — a categoria errada, e justamente a que nao se vende.
   *
   * Agora os tres planos aparecem descritos pelo TRABALHO que fazem, e os
   * formatos entram quatro na frente com o resto a um clique. A regua cobra os
   * dois nos cinco idiomas, e cobra que o resto continue INTEIRO: esconder
   * formato de quem veio conferir se o dele cabe seria trocar um defeito
   * por outro. */
  const home = fs.readFileSync(`${RAIZ_WS}/src/site/home.html`, 'utf8');
  ok('a home tem o resumo dos planos', /id="planos"/.test(home));
  ok('e ele vem antes do FAQ', home.indexOf('id="planos"') < home.indexOf('{{faqH}}'));
  ok('e leva à página de preços', /id="planos"[\s\S]{0,900}\{\{precos\}\}/.test(home));

  /* A TIRA NAO MORA MAIS NO HTML. Ate o Build 4, os selos estavam escritos a
     mao aqui e o numero "treze" estava escrito aqui no teste — duas listas
     paralelas ao catalogo, que ja tinha quinze saidas. As duas envelheceram
     juntas e ninguem viu.
     Agora `lib/site.ts` gera a tira a partir de `src/features.json`, e a home
     so carrega os dois tokens. Entao o que esta regua cobra aqui e a ORDEM —
     destaque na frente, o resto dentro do `<details>` — e a CONTAGEM sai do
     catalogo, e nao de um numero digitado. Quem afirma que a pagina servida
     tem os quinze selos e `figuras.mjs [6]`. */
  const iDest = home.indexOf('{{tiraDestaque}}');
  const iMais = home.indexOf('<details class="maisSaidas">');
  const iResto = home.indexOf('{{tiraResto}}');
  ok('a tira de destaque vem do catalogo, e nao escrita a mao', iDest > 0, String(iDest));
  ok('o resto vem do catalogo tambem', iResto > 0, String(iResto));
  ok('e o destaque vem ANTES da gaveta, com o resto dentro dela',
     iDest > 0 && iDest < iMais && iMais < iResto, `${iDest} < ${iMais} < ${iResto}`);
  ok('nenhum selo sobrou escrito a mao na home',
     !/class="saida"/.test(home), 'ha `class="saida"` no HTML — a tira voltou para o arquivo');

  const cat = JSON.parse(fs.readFileSync(`${RAIZ_WS}/src/features.json`, 'utf8'));
  const saidas = (cat.grupos.find((g) => g.id === 'saidas') || {}).itens || [];
  const naFrente = saidas.filter((i) => i.destaque).length;
  ok('o catalogo marca poucos formatos como destaque', naFrente >= 3 && naFrente <= 5,
     `${naFrente} de ${saidas.length}`);
  ok('e nenhum formato sumiu: o resto continua na gaveta',
     saidas.length - naFrente > 0, `${naFrente} + ${saidas.length - naFrente}`);

  const site = JSON.parse(fs.readFileSync(`${RAIZ_WS}/src/i18n-site.json`, 'utf8'));
  const CHAVES = ['plH', 'plP', 'plFreeT', 'plFreeD', 'plPersT', 'plPersD',
                  'plTimeT', 'plTimeD', 'plVer', 'saidasTodas', 'saidasPlan'];
  for (const L of IDIOMAS) {
    const faltando = CHAVES.filter((k) => !String((site[L] || {})[k] || '').trim());
    ok(`${L}: as frases do resumo e do "ver todas" existem`, faltando.length === 0,
       faltando.join(', '));
  }
  /* E o Personal continua sendo descrito pela RODADA, aqui como no cartao: um
     resumo que voltasse a falar de logotipo desfaria o B5 pela porta dos
     fundos, numa secao que nenhuma regua olhava. */
  for (const L of IDIOMAS) {
    ok(`${L}: o Personal do resumo fala da planilha, e não da marca`,
       /xlsx|planilha|spreadsheet|hoja|tabelle|tableur|guion|script|fallliste/i.test(site[L].plPersD),
       site[L].plPersD.slice(0, 64));
  }
}

console.log('\n[12] as seis perguntas de quem está decidindo pagar');
{
  /* As sete perguntas antigas respondem "isto funciona?". Quem esta decidindo
     pagar tem outras seis — o que fica na conta, cancelamento, cobranca por
     pessoa — e elas nao estavam em lugar nenhum do site. A pessoa tinha que
     escrever perguntando, e a maioria nao escreve.
     
     A resposta de CADA uma foi conferida no codigo antes de ser escrita, e uma
     mudou por causa disso: a analise supunha Jira, Zephyr e TestRail no fluxo, e
     so o Jira existe — como resumo para colar, e nao como integracao. Escrever
     "integramos com Zephyr" teria sido exatamente o defeito que o B1 consertou.
     Esta afirmacao guarda os dois lados: as seis existem, e a do Jira continua
     dizendo que os outros dois NAO. */
  const home = fs.readFileSync(`${RAIZ_WS}/src/site/home.html`, 'utf8');
  const site = JSON.parse(fs.readFileSync(`${RAIZ_WS}/src/i18n-site.json`, 'utf8'));
  for (let n = 1; n <= 6; n++) {
    ok(`a pergunta comercial ${n} está no FAQ da home`,
       home.includes(`{{qc${n}}}`) && home.includes(`{{ac${n}}}`));
  }
  for (const L of IDIOMAS) {
    const faltando = [];
    for (let n = 1; n <= 6; n++) {
      if (!String((site[L] || {})[`qc${n}`] || '').trim()) faltando.push(`qc${n}`);
      if (!String((site[L] || {})[`ac${n}`] || '').trim()) faltando.push(`ac${n}`);
    }
    ok(`${L}: as doze frases comerciais existem`, faltando.length === 0, faltando.join(', '));
  }
  /* A trava que importa: a resposta do Jira nao pode virar promessa. */
  for (const L of IDIOMAS) {
    const r = site[L].ac3 || '';
    ok(`${L}: a resposta do Jira continua negando Zephyr e TestRail`,
       /Zephyr/.test(r) && /TestRail/.test(r) &&
       /(não|no|nicht|pas|ningún|nenhum|only|solo|sólo|só|nur|seulement|seule)/i.test(r),
       r.slice(0, 72));
  }
  /* E o prazo do cancelamento e o que o codigo faz, e nao um numero redondo:
     o expurgo conta 90 dias do encerramento, e a fatura sobrevive por guarda
     fiscal. Se um dia o prazo mudar na migracao, esta linha obriga a pagina a
     mudar junto. */
  const expurgo = fs.readdirSync(`${RAIZ_WS}/supabase/migrations`)
    .filter((f) => /expurgo/.test(f))
    .map((f) => fs.readFileSync(`${RAIZ_WS}/supabase/migrations/${f}`, 'utf8')).join('\n');
  const dias = (expurgo.match(/(\d+)\s*days/) || [])[1] || '90';
  for (const L of IDIOMAS) {
    ok(`${L}: o prazo do cancelamento bate com o do expurgo (${dias})`,
       site[L].ac4.includes(dias), site[L].ac4.slice(0, 70));
  }
}

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nCartões e catálogo: uma verdade só.');
process.exit(falhas ? 1 : 0);

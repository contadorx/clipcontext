/* O convite por e-mail — o único ponto do produto em que alguma coisa sai daqui.
 *
 * Este arquivo existe por um motivo que não é técnico: a ferramenta promete que
 * nada sai do computador de quem usa, e essa promessa é o produto. Abrir um
 * endereço que manda e-mail é a única exceção que já foi feita a ela, e uma
 * exceção não declarada é uma mentira. Então o que se cobra aqui, antes de
 * qualquer coisa, é que a exceção esteja ESCRITA — na tela do formulário e na
 * página de privacidade — e que o que sai seja só o endereço de destino.
 *
 * Depois disso, as travas. Um endereço que manda e-mail para quem for pedido é
 * um relé de spam e vira um em uma semana:
 *   - recusa quem não vem do nosso site;
 *   - recusa quando falta segredo, em vez de abrir;
 *   - não aceita mensagem livre — só destinatário e um nome;
 *   - e conta por origem e por destinatário, guardando hash e não valor.
 */
import { chromium } from 'playwright';
import fs from 'fs';

import { RAIZ_WS, CHROME_WS } from './_caminhos.mjs';
const BASE = 'http://localhost:8802';
const APP = `${RAIZ_WS}/public/app.html`;
const ROTA = `${RAIZ_WS}/app/api/convite/route.ts`;

let falhas = 0;
const ok = (n, c, e) => { console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : '')); if (!c) falhas++; };

const app = fs.readFileSync(APP, 'utf8');
const rota = fs.readFileSync(ROTA, 'utf8');

console.log('[1] a ferramenta não manda mais o convite: ele é um e-mail da pessoa');
{
  /* ATÉ O BUILD 68 a ferramenta mandava o endereço de quem ia receber a uma rota
     nossa, que enviava o convite — e esta régua cobrava que a exceção estivesse
     escrita no formulário. No 69 o produto ficou sem servidor e o formulário
     saiu: o convite abre o programa de e-mail de quem indica, e da ferramenta
     não sai nada. A rota ainda existe no site até o Build 71, e os blocos
     abaixo continuam cobrando as travas dela enquanto ela existir. */
  ok('a ferramenta não chama a rota do convite', !/\/api\/convite/.test(app));
  ok('e o formulário de envio saiu', !/id="compEnviar"/.test(app) && !/id="compPara"/.test(app));
  ok('o caminho é o mailto', /abrirEmail\(mailto\)/.test(app));
}

console.log('\n[2] as travas do servidor');
{
  /* A CONFERÊNCIA MUDOU DE ARQUIVO, E A AFIRMAÇÃO SEGUIU — 29/08.
     Isto era `/function daCasa/.test(rota)`: procurava a FUNÇÃO dentro da rota.
     Quando ela saiu para `lib/daCasa.ts` — porque a rota do chamado precisou da
     mesma conferência, e duas cópias são duas listas de hosts de prévia —, a
     régua reprovou uma melhoria.
     Procurar texto de fonte prova que alguém escreveu a linha, e nada mais. O
     que garante de verdade é o bloco [3] logo abaixo, que bate na rota de pé e
     recebe 403. Aqui fica só o que o texto pode dizer: que a rota USA a
     conferência, e que ela vem antes dos segredos. */
  ok('recusa quem não vem do nosso site', /daCasa\(req\)/.test(rota));
  ok('  e a conferência mora num lugar só',
     /export function daCasa/.test(fs.readFileSync(`${RAIZ_WS}/lib/daCasa.ts`, 'utf8')));
  /* E a origem vem ANTES dos segredos: responder 503 para quem não é da casa
     entrega de graça que existe um serviço aqui esperando uma chave. */
  ok('e confere a origem antes de conferir os segredos',
     rota.indexOf('if (!daCasa(req))') < rota.indexOf('if (!temTudo)'));
  ok('faltando segredo, recusa em vez de abrir', /if \(!temTudo\)[\s\S]{0,180}status: 503/.test(rota));
  ok('conta por origem e por destinatário', /walkstamp_convite_pode/.test(rota));
  /* Banco fora do ar não pode virar permissão para mandar à vontade. */
  ok('banco mudo NÃO vira permissão',
     /permitido === null[\s\S]{0,140}status: 503/.test(rota));
  ok('guarda hash, e não o endereço', /createHash\('sha256'\)/.test(rota));
  ok('com sal do ambiente', /CONVITE_SAL/.test(rota));
  /* E O SAL É DELE, NÃO EMPRESTADO. Era
     `process.env.CONVITE_SAL || process.env.CRON_SECRET`, e o `CRON_SECRET` é a
     chave do endereço que APAGA dado de cliente. Rodar aquele segredo — que é
     boa prática, e feita por outro motivo — reescrevia todos os hashes daqui e
     zerava as contagens do limite, em silêncio.
     Quem faz aquela rotação está pensando em faxina. Um efeito colateral que
     ninguém tem motivo para prever é uma armadilha, e ela custava uma variável
     de ambiente que a lista de configuração já pede no passo 8. */
  /* A afirmação lê a LINHA, e não o arquivo: o comentário logo acima dela cita
     o código antigo para explicar por que ele saiu, e um `grep` no arquivo
     inteiro casaria com a explicação. A primeira versão desta régua reprovou
     com o conserto instalado, exatamente por isso. */
  {
    const linha = (rota.match(/^const SAL = .*$/m) || [''])[0];
    ok('e o sal NÃO se encosta no segredo do endereço que apaga dado',
       /CONVITE_SAL/.test(linha) && !/CRON_SECRET/.test(linha), linha);
  }
  /* O corpo é nosso, sempre. Um endereço que manda texto livre com o nosso
     remetente é um envelope aberto: o conteúdo é de quem chamou e a reputação
     queimada é a nossa. */
  ok('o corpo do e-mail é escrito no servidor', /const TEXTOS/.test(rota));
  ok('e o nome recebido é limpo e curto', /replace\(\/\[\\r\\n<>\]\/g/.test(rota));
  /* O disparo saiu da rota e virou `lib/email.ts` — ha um segundo e-mail no
     produto agora (o aviso de chamado respondido). A REGRA nao mudou de lugar:
     o corpo do erro do servico as vezes traz o endereco de destino, e a tela e
     de quem enviou, nao de quem recebe. Entao a prova passou a olhar os dois
     arquivos: o log existe no disparador, e a rota nao devolve detalhe. */
  const disparador = fs.readFileSync(`${RAIZ_WS}/lib/email.ts`, 'utf8');
  ok('o erro do serviço vai para o log', /console\.error\('email:/.test(disparador));
  ok('e a rota devolve só "envio", sem o corpo do erro',
     /erro: 'envio'/.test(rota) && !/detalhe:[^\n]*enviado|await r\.text\(\)/.test(rota));
}

console.log('\n[3] o servidor recusa de verdade');
{
  const bate = async (h, corpo) => (await fetch(BASE + '/api/convite', {
    method: 'POST', headers: { 'content-type': 'application/json', ...h },
    body: JSON.stringify(corpo),
  })).status;
  ok('sem origem: 403', (await bate({}, { para: 'a@b.com' })) === 403);
  ok('origem de fora: 403', (await bate({ origin: 'https://mau.example' }, { para: 'a@b.com' })) === 403);
  /* Com a origem certa e sem as variáveis configuradas, 503 — que é o estado
     desta máquina de teste e é o estado certo. */
  const nosso = await bate({ origin: 'https://walkstamp.com' }, { para: 'a@b.com', lang: 'pt' });
  ok('do nosso site, sem chave: 503 (e não 200)', nosso === 503, String(nosso));
}

console.log('\n[4] a página de privacidade declara a exceção, nas cinco');
{
  const ROTAS = JSON.parse(fs.readFileSync(`${RAIZ_WS}/src/rotas.json`, 'utf8'));
  const PROVA = {
    pt: /convite por e-mail/i, en: /email invitation/i, es: /invitación por correo/i,
    de: /Einladung per E-Mail/i, fr: /invitation par e-mail/i,
  };
  const HASH = {
    pt: /hash/i, en: /hash/i, es: /hash/i, de: /Hash/i, fr: /empreinte|hash/i,
  };
  for (const L of ROTAS.idiomas) {
    const u = (L === 'pt' ? '' : '/' + L) + '/' + ROTAS.slugs.privacidade[L];
    const r = await fetch(BASE + u);
    ok(`${L}: a página responde`, r.status === 200, `${u} → ${r.status}`);
    const html = await r.text();
    ok(`${L}: fala do convite por e-mail`, PROVA[L].test(html));
    ok(`${L}: diz que guarda hash, e não o endereço`, HASH[L].test(html));
    ok(`${L}: e o prazo de sete dias`, /7 dias|sete dias|seven days|siete días|sieben Tagen|sept jours/i.test(html));
  }
}

console.log('\n[5] o mailto é o caminho, e só leva o endereço do site');
{
  ok('há um mailto montado', /const mailto = 'mailto:\?subject='/.test(app));
  const expr = (app.match(/const mailto = 'mailto:[\s\S]*?;/) || [''])[0];
  ok('e ele leva o texto e o endereço, nada de documento',
     /compCorpo/.test(expr) && /url/.test(expr) && !/nomeArquivo|frames|blob|base64/.test(expr),
     expr.slice(0, 120));
}

console.log('\n[6] o documento para pôr isso de pé existe');
{
  const doc = fs.readFileSync(`${RAIZ_WS}/CONVITE-POR-EMAIL.md`, 'utf8');
  ok('tem o SQL da tabela', /create table if not exists public\.convite_envio/.test(doc));
  ok('com a função de limite', /walkstamp_convite_pode/.test(doc));
  /* Regra de servidor, e só de servidor: se o navegador pudesse chamar,
     bastaria chamar com hashes inventados para zerar o limite a cada pedido. */
  ok('e ela é revogada de anon e authenticated',
     /revoke all on function public\.walkstamp_convite_pode[\s\S]{0,80}anon, authenticated/.test(doc));
  ok('só o service_role executa', /grant execute[\s\S]{0,60}to service_role/.test(doc));
  ok('lista as variáveis de ambiente', /BREVO_API_KEY/.test(doc) && /CONVITE_SAL/.test(doc));
  /* O documento e a unica coisa que a pessoa le antes de configurar. Se ele
     ainda falar do servico antigo, ela configura o antigo — e o produto recusa
     com um 503 que ela nao vai entender. */
  ok('e nao fala mais do serviço antigo', !/Resend|RESEND_/.test(doc));
  ok('e diz o que acontece se faltarem', /o app cai no `mailto:`/.test(doc));
}

console.log('\n[7] o LinkedIn continua sem passar por nós');
{
  ok('o link é montado no navegador',
     /linkedin\.com\/sharing\/share-offsite/.test(app));
  ok('e leva o endereço do site, não um documento',
     /share-offsite\/\?url=' \+ encodeURIComponent\(url\)/.test(app));
}

const br = await chromium.launch({
  executablePath: CHROME_WS,
});
console.log('\n[8] o botão de e-mail abre o programa da pessoa, sem ida ao servidor');
{
  const pg = await (await br.newContext()).newPage();
  const idas = [];
  await pg.route('**/api/convite', r => { idas.push(1); r.fulfill({ status: 503, body: '{}' }); });
  await pg.goto(BASE + '/app.html?lang=pt');
  await pg.evaluate(() => {
    /* O convite nasce escondido e só aparece depois de a pessoa baixar alguma
       coisa — este teste é sobre o botão, não sobre o gatilho. */
    document.getElementById('compCx').classList.remove('hide');
  });
  /* O `convidarACompartilhar` é quem liga o botão, e ele só roda quando um
     documento sai. Sem documento aqui, o botão é ligado à mão pelo mesmo
     caminho: o clique tem que dar no `mailto`, e não num formulário. */
  ok('o botão de e-mail existe', (await pg.locator('#compEmailAbrir').count()) === 1);
  ok('e não há formulário escondido atrás dele', (await pg.locator('#compEmailCx').count()) === 0);
  await br.close();
  ok('nenhuma ida ao servidor', idas.length === 0, String(idas.length));
}

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nConvite por e-mail: tudo passou.');
process.exit(falhas ? 1 : 0);

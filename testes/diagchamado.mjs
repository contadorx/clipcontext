/* O DIAGNÓSTICO NO RECADO — que ele exista, e que ele CHEGUE.
 *
 * O relato antigo foi "o botão de diagnóstico não está ativo". Ele estava: tinha
 * virado o anexo do recado. O que NÃO estava ativo era o anexo — a coleta é
 * assíncrona e leva de 1 s (rede boa) a mais de 10 s (rede ruim, que é a
 * máquina de quem está reclamando), e o Enviar não esperava por ela: partia com
 * o texto de espera no lugar do relatório. No banco de produção, o chamado
 * WS-0005 chegou com `diagnostico = "…"`, um caractere.
 *
 * Desde o Build 69 não há banco: o recado abre o programa de e-mail da pessoa,
 * endereçado ao suporte, com o texto e o COMEÇO do relatório no corpo (um
 * endereço `mailto:` tem limite), e o relatório inteiro vai para a área de
 * transferência. O defeito antigo continua possível do mesmo jeito — o corpo
 * do e-mail levar "Montando o relatório…" —, e por isso as três afirmações
 * continuam as mesmas:
 *
 *   1. o relatório aparece no recado, inteiro, antes de sair;
 *   2. quem aperta Enviar DEPRESSA continua mandando o relatório, e não o
 *      texto de espera — é a afirmação que pega o defeito;
 *   3. desmarcar a caixa manda o recado sem relatório e SEM espera — a espera
 *      é o preço de uma promessa, não uma trava.
 *
 * A [2] pegou um defeito novo no Build 69: com a rede ruim, o gesto do clique
 * já expirou quando o relatório fica pronto, e a cópia para a área de
 * transferência ficava pendente para sempre — o e-mail nunca abria. A cópia
 * agora tem prazo, e esta régua é a que reprova se o prazo sumir.
 *
 * O e-mail não é aberto de verdade: a ferramenta deixa o endereço que montou em
 * `window.__ultimoEmail`, e é ele que se lê.
 *
 *   node testes/diagchamado.mjs
 */
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';

import { CHROME_WS } from './_caminhos.mjs';
const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'public');
const CHROME = process.env.CHROME || CHROME_WS;
const T = {'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png',
           '.svg':'image/svg+xml','.ico':'image/x-icon','.webmanifest':'application/json'};
const srv = http.createServer((q, r) => {
  if (q.url.startsWith('/_vercel/')) { r.writeHead(200,{'Content-Type':'text/javascript'}); return r.end(''); }
  const u = q.url.split('?')[0], f = path.join(RAIZ, u === '/' ? 'index.html' : u);
  if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'}); r.end(fs.readFileSync(f));
});
await new Promise(r => srv.listen(8961, r));

let falhas = 0;
const ok = (n, c, e) => { console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : '')); if (!c) falhas++; };

const br = await chromium.launch({ executablePath: CHROME });

/* A REDE LENTA É O CENÁRIO, e não um detalhe do teste: com a rede boa a coleta
   termina antes de qualquer clique humano e o defeito não aparece. Ele é de
   quem está com problema — que é exatamente quem escreve para o suporte. */
const LENTO = 2500;

async function abrir({ lentidao }) {
  const ctx = await br.newContext();
  const pg = await ctx.newPage();
  const erros = []; pg.on('pageerror', e => erros.push(e.message));
  /* Nenhum pedido a servidor nosso: o recado é e-mail. Se alguém religar uma
     rota de chamado, isto aparece aqui antes de aparecer na conta. */
  const nossos = [];
  pg.on('request', q => { if (/\/api\/|supabase/.test(q.url())) nossos.push(q.url()); });
  /* As sondagens do diagnóstico, atrasadas de propósito. */
  const devagar = async (rota) => {
    if (lentidao) await new Promise(r => setTimeout(r, lentidao));
    return rota.fulfill({ status:200, headers:{'access-control-allow-origin':'*'}, body:'{}' });
  };
  await pg.route('**huggingface.co/**', devagar);
  /* As OUTRAS sondagens respondem na hora: o runtime do modelo no CDN e o
     vídeo de exemplo no site. Sem isto elas saem para a rede de verdade, e a
     rede deste contêiner às vezes segura um túnel por minutos — o tempo da
     régua passava a medir o contêiner, e não a espera do produto. */
  const naHora = r => r.fulfill({ status:404, headers:{'access-control-allow-origin':'*'}, body:'' });
  await pg.route('**cdn.jsdelivr.net/npm/onnxruntime-web**', naHora);
  await pg.route(/^https:\/\/(www\.)?walkstamp\.com\//, naHora);
  /* SÓ a biblioteca do modelo, e não o jsdelivr inteiro: o jsPDF vem do mesmo
     CDN por uma tag <script> comum, e devolver um módulo ES para ela produz
     "Unexpected token 'export'" — um erro de página que não é do produto. */
  await pg.route('**@huggingface/transformers**', r => r.fulfill({ status:200,
    headers:{'access-control-allow-origin':'*','content-type':'text/javascript'},
    body:'export const env={allowLocalModels:true,allowRemoteModels:true,backends:{onnx:{wasm:{}}}};export async function pipeline(){}' }));
  await pg.goto('http://localhost:8961/app.html?lang=pt');
  await pg.waitForTimeout(400);
  return { pg, ctx, erros, nossos };
}

/* O que a ferramenta mandaria: destinatário, assunto e corpo, já decodificados. */
async function emailMontado(pg, timeout) {
  /* Por intervalo, e não por quadro: o que se espera é uma variável, não uma
     pintura, e a página com o diálogo aberto não precisa pintar para ela mudar. */
  await pg.waitForFunction(() => !!window.__ultimoEmail, null, { timeout, polling: 250 });
  const href = await pg.evaluate(() => window.__ultimoEmail);
  const u = new URL(href);
  return { href, para: decodeURIComponent(u.pathname),
           assunto: u.searchParams.get('subject') || '', corpo: u.searchParams.get('body') || '' };
}
/* O relatório é o que vem depois do PRIMEIRO separador — o relatório também
   começa com traços ("--- diagnóstico ---"), e dividir em todos eles acharia
   um pedaço vazio. */
const relatorioDoCorpo = (corpo) => {
  const i = corpo.indexOf('\n---\n');
  return i < 0 ? null : corpo.slice(i + 5);
};

// ------------------------------------------------ 1. o relatório no recado
{
  const { pg, ctx, erros, nossos } = await abrir({ lentidao: 0 });
  console.log('\n[1] o relatório aparece no recado antes de sair');
  await pg.click('#avisar');
  await pg.click('#fbModal details summary');
  await pg.waitForFunction(() => /fim ---/.test(document.getElementById('fbDiagOut').textContent || ''),
                           null, { timeout: 60000 });
  const dep = await pg.evaluate(() => {
    const txt = document.getElementById('fbDiagOut').textContent || '';
    return { linhas: txt.split('\n').length, versao: /versão/.test(txt),
             pip: (txt.split('\n').find(l => /janela PiP/.test(l)) || ''),
             marcado: document.getElementById('fbDiag').checked };
  });
  console.log('     relatório com ' + dep.linhas + ' linhas');
  ok('a caixa do relatório nasce marcada', dep.marcado);
  ok('o relatório aparece no recado', dep.linhas > 20, dep.linhas + ' linhas');
  ok('e começa pela versão, que é a primeira pergunta', dep.versao);
  /* ---- O TAMANHO DA JANELINHA SAI AQUI, e não só depois de parar ----
     Ele morava no relatório da CAPTURA, que só é gravado quando a gravação
     para — e voltou do campo como "não achei o erro". Uma medida que só existe
     depois do fato não serve para conferir o fato. Sem o editor aberto ela
     ainda tem que dizer ALGO — uma linha em branco no lugar de um número é o
     mesmo que não ter a linha. */
  ok('o relatório diz o estado da janelinha de picture-in-picture',
     /janela PiP/.test(dep.pip) && /tela=\d+x\d+/.test(dep.pip), dep.pip.trim());
  ok('nenhum pedido a servidor nosso', nossos.length === 0, nossos[0]);
  ok('sem erro de página', erros.length === 0, erros[0]);
  await ctx.close();
}

// ---------------------------- 2. o envio RÁPIDO leva o relatório, não a espera
{
  const { pg, ctx, erros, nossos } = await abrir({ lentidao: LENTO });
  console.log('\n[2] apertar Enviar depressa, com a rede ruim');
  await pg.click('#avisar');
  await pg.waitForTimeout(120);                    // o tempo de digitar, não de esperar
  await pg.fill('#fbTexto', 'a transcrição trava no 0%');
  const t0 = Date.now();
  await pg.click('#fbEnviar');
  const em = await emailMontado(pg, 90000);
  const ms = Date.now() - t0;
  const diag = relatorioDoCorpo(em.corpo) || '';
  console.log('     esperou ' + ms + ' ms, o corpo leva ' + diag.length + ' caracteres de relatório');
  ok('o recado vai para o suporte', em.para === 'suporte@walkstamp.com', em.para);
  ok('com o texto de quem escreveu', em.corpo.startsWith('a transcrição trava no 0%'), em.corpo.slice(0, 40).replace(/\n/g, ' ⏎ '));
  /* A AFIRMAÇÃO QUE PEGA O DEFEITO. Sem a espera, o que viaja é o texto de
     espera ("Montando o relatório…") — curto, sem versão, sem navegador. */
  ok('o corpo leva o relatório, e não o texto de espera',
     /--- diagnóstico ---/.test(diag) && !/Montando o relatório/.test(diag),
     diag.length + ' caracteres: ' + diag.slice(0, 60).replace(/\n/g, ' ⏎ '));
  ok('e é o relatório, não outra coisa', /versão/.test(diag) && /navegador/i.test(diag),
     diag.slice(0, 120).replace(/\n/g, ' ⏎ '));
  /* Um endereço `mailto:` acima de uns dois mil caracteres é recusado por
     alguns programas de e-mail. O corpo é cortado para caber. */
  ok('o endereço cabe no limite dos programas de e-mail', em.href.length < 2100, em.href.length + ' caracteres');
  ok('nenhum pedido a servidor nosso', nossos.length === 0, nossos[0]);
  ok('sem erro de página', erros.length === 0, erros[0]);
  await ctx.close();
}

// ------------------- 3. desmarcar a caixa manda na hora, e sem relatório
{
  const { pg, ctx, erros } = await abrir({ lentidao: LENTO });
  console.log('\n[3] com a caixa desmarcada, não há espera nenhuma');
  await pg.click('#avisar');
  await pg.waitForTimeout(120);
  await pg.fill('#fbTexto', 'só uma ideia');
  await pg.uncheck('#fbDiag');
  const t0 = Date.now();
  await pg.click('#fbEnviar');
  const em = await emailMontado(pg, 30000);
  const ms = Date.now() - t0;
  console.log('     esperou ' + ms + ' ms');
  ok('o recado saiu sem relatório', relatorioDoCorpo(em.corpo) === null, em.corpo.slice(0, 60));
  ok('e saiu sem esperar a coleta', ms < LENTO, ms + ' ms contra ' + LENTO + ' ms de sondagem');
  ok('sem erro de página', erros.length === 0, erros[0]);
  await ctx.close();
}

await br.close(); srv.close();
console.log(falhas ? `\n  ${falhas} falha(s)` : '\n  tudo certo');
process.exit(falhas ? 1 : 0);

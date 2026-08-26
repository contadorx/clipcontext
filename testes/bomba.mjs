/* A BOMBA DE ZIP NO LEITOR DE PLANILHA.
 *
 * Um `.xlsx` é um zip, e um zip mente sobre o próprio tamanho. A tela já
 * cobrava 4 MB de entrada — e quatro megas de zeros descomprimem para
 * gigabytes. Este código roda no servidor que segura a chave de serviço, e
 * derrubá-lo por falta de memória não exigia senha nenhuma: os 14 dias de
 * degustação dão conta a qualquer e-mail, e a conta abre esta porta.
 *
 * O que havia: `inflateRawSync(cru)` sem teto, num laço que inflava TODAS as
 * entradas do zip para dentro de um objeto. Uma bomba escondida numa entrada
 * que a planilha nem lê era descomprimida do mesmo jeito.
 *
 * ESTA RÉGUA FABRICA A BOMBA DE VERDADE e a entrega ao código do produto. Ela
 * não afirma "existe um teto no arquivo": ela mede o que acontece quando o
 * arquivo chega.
 *
 * COMO O MÓDULO DO PRODUTO É CARREGADO, e o que muda nele: `lib/planilha.ts`
 * começa com `import 'server-only'`, que é um alias que só existe dentro do
 * empacotador do Next. A régua copia o arquivo tirando ESSA LINHA e nada mais,
 * e importa a cópia. O que roda aqui é o leitor do produto, com os tetos dele.
 *
 *   node testes/bomba.mjs
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { deflateRawSync } from 'node:zlib';

import { RAIZ_WS } from './_caminhos.mjs';

/* COMO SE MEDE "ELE INFLOU A BOMBA?", e a primeira versão desta régua media
   errado. `heapUsed` NÃO conta Buffer: buffers vivem fora do heap do V8, então
   inflar um gigabyte movia aquele número em zero. A afirmação passava com o
   defeito instalado — que é o pior tipo de régua que existe.
   O que move de verdade é o RELÓGIO. Medido contra o código antigo, a mesma
   bomba levava 17,7 s e 9,6 s para ser recusada, contra 0 ms e 25 ms agora — e
   aqueles segundos de processador, vezes alguns envios ao mesmo tempo, SÃO a
   negação de serviço. O `rss` entra junto porque ele conta o que o processo
   pediu ao sistema, buffers incluídos. */
const agora = () => ({ t: Date.now(), rss: process.memoryUsage().rss });
const desde = (a) => ({
  ms: Date.now() - a.t,
  mb: (process.memoryUsage().rss - a.rss) / 1024 / 1024,
});
/* Folgado o bastante para máquina lenta e apertado o bastante para pegar
   dezessete segundos: inflar um giga não acontece em meio segundo. */
const TETO_MS = 2500;

let falhas = 0;
const ok = (n, c, e) => {
  console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : ''));
  if (!c) falhas++;
};

/* ---- o módulo do produto, sem o `server-only` ---------------------------- */
const fonte = fs.readFileSync(path.join(RAIZ_WS, 'lib/planilha.ts'), 'utf8');
const semServerOnly = fonte.replace(/^import 'server-only';\s*$/m, '');
ok('o `server-only` saiu', !/server-only/.test(semServerOnly));
ok('e foi a ÚNICA linha que mudou',
   fonte.split('\n').length - semServerOnly.split('\n').length <= 1 &&
   fonte.replace(/^import 'server-only';\s*$/m, '') === semServerOnly,
   String(fonte.split('\n').length - semServerOnly.split('\n').length));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-bomba-'));
const alvo = path.join(tmp, 'planilha.mts');
fs.writeFileSync(alvo, semServerOnly);
const P = await import(alvo);

/* ---- montar um zip à mão, para poder mentir nele ------------------------- */
const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
const crc32 = (b) => {
  let c = -1;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};

/** Zip com deflate, escrito aqui para que o conteúdo possa ser o que eu quiser
 *  — inclusive uma entrada que descomprime para gigabytes. */
function zipar(entradas) {
  const locais = [], centrais = [];
  let desloc = 0;
  for (const { nome, dados, mentirTamanho } of entradas) {
    const nb = Buffer.from(nome, 'utf8');
    const comp = deflateRawSync(dados, { level: 9 });
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(8, 8);
    lh.writeUInt32LE(crc32(dados), 14);
    const declarado = mentirTamanho == null ? dados.length : mentirTamanho;
    lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(declarado, 22);
    lh.writeUInt16LE(nb.length, 26);
    locais.push(lh, nb, comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(8, 10);
    ch.writeUInt32LE(crc32(dados), 16);
    ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(declarado, 24);
    ch.writeUInt16LE(nb.length, 28); ch.writeUInt32LE(desloc, 42);
    centrais.push(ch, nb);
    desloc += lh.length + nb.length + comp.length;
  }
  const corpo = Buffer.concat(locais);
  const dir = Buffer.concat(centrais);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(entradas.length, 8); fim.writeUInt16LE(entradas.length, 10);
  fim.writeUInt32LE(dir.length, 12); fim.writeUInt32LE(corpo.length, 16);
  return Buffer.concat([corpo, dir, fim]);
}

const aba = (linhas) =>
  '<worksheet><sheetData>' +
  linhas.map((l, i) =>
    `<row r="${i + 1}">` +
    l.map((c, j) => `<c r="${String.fromCharCode(65 + j)}${i + 1}" t="inlineStr"><is><t>${c}</t></is></c>`).join('') +
    '</row>').join('') +
  '</sheetData></worksheet>';

console.log('[1] a planilha honesta continua sendo lida');
{
  const z = zipar([
    { nome: 'xl/worksheets/sheet1.xml',
      dados: Buffer.from(aba([['Caso', 'Sistema'], ['CT-014', 'S4P/100']]), 'utf8') },
  ]);
  const linhas = P.xlsxParaLinhas(z);
  ok('as duas linhas voltam', linhas.length === 2, JSON.stringify(linhas));
  ok('e as células estão certas',
     linhas[1] && linhas[1][0] === 'CT-014' && linhas[1][1] === 'S4P/100',
     JSON.stringify(linhas[1]));
}

console.log('\n[2] a bomba: uma aba que descomprime para um gigabyte');
{
  /* 1 GiB de zeros. Comprimido cabe em cerca de 1 MB — bem dentro dos 4 MB que
     a tela aceita. Sem teto, é isto que ia para a memória do servidor. */
  const GIGA = Buffer.alloc(1024 * 1024 * 1024);
  const z = zipar([{ nome: 'xl/worksheets/sheet1.xml', dados: GIGA }]);
  console.log(`     o zip tem ${(z.length / 1024 / 1024).toFixed(1)} MB e declara ` +
              `${(GIGA.length / 1024 / 1024).toFixed(0)} MB dentro`);
  ok('e ele passaria pelo limite de 4 MB da tela', z.length < 4 * 1024 * 1024,
     `${(z.length / 1024 / 1024).toFixed(1)} MB`);
  const a0 = agora();
  let erro = null;
  try { P.xlsxParaLinhas(z); } catch (e) { erro = e; }
  const m = desde(a0);
  console.log(`     recusada em ${m.ms}ms, rss ${m.mb >= 0 ? '+' : ''}${m.mb.toFixed(1)} MB`);
  ok('a leitura RECUSA em vez de inflar', !!erro, '(ela aceitou a bomba)');
  ok('e diz o motivo sem vazar detalhe interno',
     !!erro && /grande demais/.test(erro.message), erro && erro.message);
  /* O ponto todo: ela recusa SEM PAGAR o custo de descomprimir. */
  ok('e sem gastar o processador para descobrir', m.ms < TETO_MS, `${m.ms}ms`);
  ok('e sem pedir o gigabyte ao sistema', m.mb < 200, `${m.mb.toFixed(1)} MB`);
}

console.log('\n[2b] a bomba que MENTE o tamanho — o caso que só o zlib pega');
{
  /* O TAMANHO DECLARADO É DO ATACANTE. O bloco de cima foi recusado pela
     declaração, e é bom que tenha sido — mas uma trava que depende do arquivo
     dizer a verdade não é trava. Aqui o zip declara 1 KB e entrega um giga.
     Quem barra isto é o `maxOutputLength`, que para de inflar no meio em vez
     de alocar primeiro e descobrir depois. */
  const GIGA = Buffer.alloc(1024 * 1024 * 1024);
  const z = zipar([{ nome: 'xl/worksheets/sheet1.xml', dados: GIGA, mentirTamanho: 1024 }]);
  console.log(`     o zip declara 1 KB e entrega ${(GIGA.length / 1024 / 1024).toFixed(0)} MB`);
  const a0 = agora();
  let erro = null;
  try { P.xlsxParaLinhas(z); } catch (e) { erro = e; }
  const m = desde(a0);
  console.log(`     recusada em ${m.ms}ms, rss ${m.mb >= 0 ? '+' : ''}${m.mb.toFixed(1)} MB`);
  ok('a mentira não passa', !!erro, '(a declaração falsa foi acreditada)');
  ok('e o zlib para no meio, em vez de inflar até o fim', m.ms < TETO_MS, `${m.ms}ms`);
  ok('e não pede o gigabyte ao sistema', m.mb < 200, `${m.mb.toFixed(1)} MB`);
  /* E a causa real fica guardada, para quem for depurar. */
  ok('o erro guarda a causa de verdade',
     !!erro && !!erro.cause, erro && String(erro.cause));
}

console.log('\n[3] a bomba escondida numa entrada que ninguém lê');
{
  /* ERA O PIOR CASO, e o mais silencioso: o laço antigo inflava TODAS as
     entradas do zip. Uma planilha válida com um `.png` de enfeite de um
     gigabyte derrubava o servidor antes de a primeira célula ser lida. */
  const GIGA = Buffer.alloc(1024 * 1024 * 1024);
  const z = zipar([
    { nome: 'xl/worksheets/sheet1.xml',
      dados: Buffer.from(aba([['Caso'], ['CT-014']]), 'utf8') },
    { nome: 'xl/media/enfeite.png', dados: GIGA },
  ]);
  const a0 = agora();
  let linhas = null, erro = null;
  try { linhas = P.xlsxParaLinhas(z); } catch (e) { erro = e; }
  const m = desde(a0);
  console.log(`     lida em ${m.ms}ms, rss ${m.mb >= 0 ? '+' : ''}${m.mb.toFixed(1)} MB`);
  /* Aqui a resposta certa é LER A PLANILHA e ignorar o enfeite: o arquivo é
     válido, e recusá-lo seria recusar planilha de gente com imagem colada. */
  ok('a planilha é lida normalmente', !erro && linhas && linhas.length === 2,
     erro ? erro.message : JSON.stringify(linhas));
  ok('e o enfeite nunca foi inflado', m.ms < TETO_MS && m.mb < 200,
     `${m.ms}ms, ${m.mb.toFixed(1)} MB`);
}

console.log('\n[4] muitas entradas, cada uma dentro do teto individual');
{
  /* Mil entradas de 20 MB passam por qualquer teto POR ENTRADA. É por isso que
     existe o teto somado e o teto de quantidade. */
  const PEDACO = Buffer.alloc(20 * 1024 * 1024);
  const entradas = [];
  for (let i = 0; i < 40; i++) {
    entradas.push({ nome: `xl/worksheets/sheet${i}.xml`, dados: PEDACO });
  }
  const z = zipar(entradas);
  console.log(`     ${entradas.length} abas de 20 MB, zip de ${(z.length / 1024).toFixed(0)} KB`);
  const a0 = agora();
  let erro = null;
  try { P.xlsxParaLinhas(z); } catch (e) { erro = e; }
  const m = desde(a0);
  console.log(`     recusada em ${m.ms}ms, rss ${m.mb >= 0 ? '+' : ''}${m.mb.toFixed(1)} MB`);
  ok('a soma também tem teto', !!erro, '(passou a soma toda)');
  ok('e sem inflar as quarenta', m.ms < TETO_MS, `${m.ms}ms`);
}

console.log('\n[5] zip mentiroso não derruba com erro de programador');
{
  /* Os ponteiros do diretório central vêm de dentro do arquivo. Um RangeError
     de leitura fora do buffer sobe como erro de servidor; o que se quer é um
     "esse arquivo não serve". */
  const bom = zipar([{ nome: 'xl/worksheets/sheet1.xml',
                       dados: Buffer.from(aba([['a']]), 'utf8') }]);
  const torto = Buffer.from(bom);
  /* O deslocamento do diretório central, apontando para fora. */
  torto.writeUInt32LE(0x7ffffff0, torto.length - 22 + 16);
  let erro = null, linhas = null;
  try { linhas = P.xlsxParaLinhas(torto); } catch (e) { erro = e; }
  ok('não estoura RangeError',
     !erro || !/out of range|RangeError/i.test(String(erro.message) + String(erro.name)),
     erro && `${erro.name}: ${erro.message}`);
  /* Sem aba legível, a resposta certa é dizer que não achou aba. */
  ok('e a resposta é sobre o arquivo', !linhas || linhas.length === 0,
     JSON.stringify(linhas));
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(falhas ? `\n${falhas} FALHA(S)`
                   : '\nBomba de zip: o leitor de planilha não infla o que não cabe.');
process.exit(falhas ? 1 : 0);

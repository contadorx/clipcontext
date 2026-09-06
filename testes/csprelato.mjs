/* OS AVISOS DA CSP TÊM PARA ONDE IR — e a régua olha o que foi GRAVADO.
 *
 * O defeito que isto fecha: a política estava em `Report-Only` desde 24/08 e
 * **sem endereço de relatório**. O navegador conferia, montava o aviso e jogava
 * fora. Uma semana que devia ter virado dados virou trabalho de CPU na máquina
 * dos outros — e travar a CSP (a segunda metade da DEC-12) dependia justamente
 * desses dados para não ser aposta.
 *
 * POR QUE O STATUS NÃO PROVA NADA AQUI, e esta é a lição do arquivo: a rota
 * responde **204 sempre** que o corpo é aceitável — inclusive quando não tem
 * onde guardar. É deliberado (um navegador não faz nada com um erro nosso), mas
 * quer dizer que "deu 204" e "guardou" são perguntas diferentes. Medi isso da
 * pior forma: mandei os dois formatos contra um servidor sem chave de serviço,
 * recebi 204 nos dois, e o banco continuou vazio.
 *
 * Então o que se afirma aqui é o que CHEGOU AO BANCO — as chamadas de gravação,
 * com os argumentos que elas levaram.
 *
 *   node testes/csprelato.mjs
 */
import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import { RAIZ_WS } from './_caminhos.mjs';
import { garantirPortaLivre } from './_porta.mjs';

const P = 8872, B = 8873;
const BASE = `http://localhost:${P}`;
let falhas = 0;
const ok = (n, c, e) => { console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : '')); if (!c) falhas++; };

/* O banco de mentira guarda o que a rota mandou — que é a única pergunta. */
const gravadas = [];
let PODE = true;
const banco = http.createServer((q, r) => {
  const b = []; q.on('data', (d) => b.push(d));
  q.on('end', () => {
    const fn = q.url.replace('/rest/v1/rpc/', '');
    const a = JSON.parse(Buffer.concat(b).toString('utf8') || '{}');
    r.writeHead(200, { 'Content-Type': 'application/json' });
    if (fn === 'walkstamp_chamado_pode') return r.end(JSON.stringify(PODE));
    if (fn === 'walkstamp_csp_registrar') gravadas.push(a);
    r.end('null');
  });
});
await new Promise((r) => banco.listen(B, r));

await garantirPortaLivre(P, 'o csprelato.mjs');
const next = spawn('npx', ['next', 'start', '-p', String(P)], {
  cwd: RAIZ_WS, stdio: 'ignore',
  env: { ...process.env, SUPABASE_URL: `http://localhost:${B}`,
         SUPABASE_SERVICE_ROLE_KEY: 'chave_de_mentira', CHAMADO_SAL: 'sal-de-teste' },
});
process.on('exit', () => { try { next.kill('SIGKILL'); } catch {} banco.close(); });
for (let i = 0; i < 60; i++) {
  try { const r = await fetch(`${BASE}/`); if (r.ok) break; } catch {}
  await new Promise((r) => setTimeout(r, 500));
}

const mandar = (corpo, tipo = 'application/csp-report') =>
  fetch(`${BASE}/api/csp`, { method: 'POST', headers: { 'Content-Type': tipo },
                             body: typeof corpo === 'string' ? corpo : JSON.stringify(corpo) });

console.log('[1] a política diz onde relatar — nos dois nomes');
{
  const r = await fetch(`${BASE}/`);
  const csp = r.headers.get('content-security-policy-report-only') || '';
  const rep = r.headers.get('reporting-endpoints') || '';
  ok('a CSP existe e está em Report-Only', csp.length > 0);
  ok('  com `report-uri` — o nome antigo, que a maioria ainda manda',
     /report-uri\s+\/api\/csp/.test(csp), csp.slice(-60));
  ok('  e `report-to` — o novo', /report-to\s+csp/.test(csp));
  /* O `report-to` da CSP é só um NOME. Sem este cabeçalho ele não aponta para
     lugar nenhum, e o navegador não avisa que não avisou. */
  ok('  e o cabeçalho que diz a que endereço o nome corresponde',
     /csp="\/api\/csp"/.test(rep), rep);
}

console.log('\n[2] o formato ANTIGO chega ao banco');
{
  const antes = gravadas.length;
  const r = await mandar({ 'csp-report': {
    'effective-directive': 'script-src', 'blocked-uri': 'https://exemplo.test/x.js',
    'source-file': 'https://walkstamp.com/app', 'script-sample': 'alert(1)' } });
  ok('a rota aceita', r.status === 204, String(r.status));
  const g = gravadas.length === antes + 1 ? gravadas[antes] : null;
  /* O QUE PROVA É A GRAVAÇÃO, e não o 204: a rota devolve 204 mesmo sem ter
     onde guardar. Foi assim que eu descobri, com o banco vazio do outro lado. */
  ok('  e GRAVOU — que é outra pergunta que o 204 não responde', !!g,
     `${antes} → ${gravadas.length}`);
  ok('  com a diretiva', !!g && g.p_diretiva === 'script-src', g && g.p_diretiva);
  ok('  com o que foi barrado', !!g && g.p_barrado === 'https://exemplo.test/x.js', g && g.p_barrado);
  ok('  e com a amostra do trecho', !!g && g.p_amostra === 'alert(1)', g && g.p_amostra);
}

console.log('\n[3] o formato NOVO também — aceitar só um perde metade dos navegadores');
{
  const antes = gravadas.length;
  await mandar([{ type: 'csp-violation', body: {
    effectiveDirective: 'connect-src', blockedURL: 'https://outro.test/api',
    sourceFile: 'https://walkstamp.com/' } }], 'application/reports+json');
  const g = gravadas.length === antes + 1 ? gravadas[antes] : null;
  ok('gravou o aviso em camelCase', !!g, `${antes} → ${gravadas.length}`);
  ok('  com a diretiva certa', !!g && g.p_diretiva === 'connect-src', g && g.p_diretiva);
  ok('  e o endereço barrado', !!g && g.p_barrado === 'https://outro.test/api', g && g.p_barrado);
}

console.log('\n[4] o que não é aviso não vira linha');
{
  const antes = gravadas.length;
  await mandar('isto não é json');
  await mandar({ qualquer: 'coisa' });
  await mandar({ 'csp-report': { 'blocked-uri': 'https://x.test' } });   // sem diretiva
  await mandar('x'.repeat(20000));                                       // corpo grande demais
  ok('lixo, corpo incompleto e corpo grande não gravam nada',
     gravadas.length === antes, `${antes} → ${gravadas.length}`);
}

console.log('\n[5] os campos são cortados ANTES de virar linha');
{
  const antes = gravadas.length;
  await mandar({ 'csp-report': {
    'effective-directive': 'd'.repeat(200), 'blocked-uri': 'b'.repeat(900),
    'source-file': 'o'.repeat(900), 'script-sample': 'a'.repeat(900) } });
  const g = gravadas.length === antes + 1 ? gravadas[antes] : null;
  /* O corpo é escrito pelo navegador de um desconhecido. Um campo de dois
     megabytes não pode virar uma linha de dois megabytes — e o banco corta de
     novo, porque quem chama não é de confiança. */
  ok('a diretiva cabe em 60', !!g && g.p_diretiva.length === 60, g && String(g.p_diretiva.length));
  ok('  o barrado em 400', !!g && g.p_barrado.length === 400, g && String(g.p_barrado.length));
  ok('  a origem em 400', !!g && g.p_origem.length === 400, g && String(g.p_origem.length));
  ok('  e a amostra em 200', !!g && g.p_amostra.length === 200, g && String(g.p_amostra.length));
}

console.log('\n[6] com o limite estourado, nada é gravado — e o navegador não fica sabendo');
{
  PODE = false;
  const antes = gravadas.length;
  const r = await mandar({ 'csp-report': {
    'effective-directive': 'img-src', 'blocked-uri': 'https://demais.test/i.png' } });
  /* 204 mesmo assim: um 429 aqui só encheria o console de quem visita, e o
     navegador não lê o nosso status para decidir nada. */
  ok('a resposta continua 204, e não um erro no console de quem visita',
     r.status === 204, String(r.status));
  ok('  e nada foi gravado', gravadas.length === antes, `${antes} → ${gravadas.length}`);
  PODE = true;
}

console.log('\n[7] o endereço está no código, e não só no cabeçalho');
{
  /* A rota pode existir e a política apontar para outro lugar — foi exatamente
     o defeito de origem: a política existia e não apontava para lugar nenhum. */
  ok('a rota /api/csp existe no repositório',
     fs.existsSync(`${RAIZ_WS}/app/api/csp/route.ts`));
  const cfg = fs.readFileSync(`${RAIZ_WS}/next.config.mjs`, 'utf8');
  ok('  e o next.config declara os dois nomes e o cabeçalho',
     /report-uri \/api\/csp/.test(cfg) && /report-to csp/.test(cfg)
       && /Reporting-Endpoints/.test(cfg));
}

console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'os avisos da CSP têm para onde ir, e chegam lá'));
process.exit(falhas ? 1 : 0);

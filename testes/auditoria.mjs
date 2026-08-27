/* O `AUDITORIA-PENDENTE.md` é GERADO, e a lista de promessas sem trava não cresce sozinha.
 *
 * Uma marca de visto numa tabela de preço é uma promessa comercial: alguém
 * compra por acreditar nela. O `AUDITORIA-PENDENTE.md` é a lista de quais delas
 * têm régua e quais não têm — e um arquivo desses só vale enquanto for
 * verdadeiro. Ele era escrito à mão, embaixo de comentários no `build.py` que
 * diziam a mesma coisa; as duas cópias divergiram, e o comentário creditava
 * `vocab.mjs` a uma promessa que a página já não faz.
 *
 * ESTA RÉGUA COBRA QUATRO COISAS:
 *
 *   1. O arquivo no disco é EXATAMENTE o que os dados geram. Editar à mão
 *      passa a ser vermelho, e não silêncio.
 *   2. Todo teste creditado EXISTE em `testes/`. Creditar uma régua que não
 *      existe é pior do que não creditar nenhuma.
 *   3. O `semTestePorque` só aparece onde não há teste — ele explica a
 *      ausência; ao lado de um teste, seria contradição publicada.
 *   4. As promessas sem trava não passam do TETO abaixo. Este é o ponto: sem
 *      ele, a auditoria relata o crescimento com fidelidade e nada o impede.
 *      Uma bala nova sem régua fica vermelha aqui, no build em que nasce.
 */
import fs from 'fs';
import { execFileSync } from 'child_process';
import path from 'path';
import os from 'os';

import { RAIZ_WS } from './_caminhos.mjs';

/* O TETO. É um número escrito à mão — o único desta rodada, e de propósito.
   Ele desce quando uma promessa ganha régua, e a régua manda descer: um teto
   folgado é um teto que não trava nada. Subir exige editar esta linha, que é o
   momento em que alguém tem de justificar a promessa sem prova. */
const TETO_SEM_TRAVA = 0;

let falhas = 0;
const ok = (n, c, e) => {
  console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : ''));
  if (!c) falhas++;
};

const ARQ = path.join(RAIZ_WS, 'AUDITORIA-PENDENTE.md');

console.log('[1] o arquivo no disco é o que os dados geram');
if (!fs.existsSync(ARQ)) {
  ok('AUDITORIA-PENDENTE.md existe', false, 'não está na raiz — rode build.py');
  process.exit(1);
}
const noDisco = fs.readFileSync(ARQ, 'utf8');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'auditoria-'));
let gerado = '', motivo = '';
try {
  execFileSync('python3', ['-c',
    'import sys, pathlib; sys.path.insert(0, sys.argv[1]); import build; ' +
    'build.escrever_auditoria(pathlib.Path(sys.argv[2]))',
    RAIZ_WS, tmp], { stdio: 'pipe' });
  gerado = fs.readFileSync(path.join(tmp, 'AUDITORIA-PENDENTE.md'), 'utf8');
} catch (e) {
  motivo = String(e.stderr || e.message).slice(0, 300);
}
ok('o gerador roda', gerado.length > 0, motivo);
ok('o arquivo publicado é idêntico ao gerado — ninguém o editou à mão',
   gerado !== '' && noDisco === gerado,
   noDisco === gerado ? '' : 'divergiu: rode `python3 build.py` e commite o resultado');
ok('e ele avisa que é gerado', /GERADO POR `build\.py`/.test(noDisco));
fs.rmSync(tmp, { recursive: true, force: true });

console.log('\n[2] todo teste creditado existe em testes/');
const creditados = [...noDisco.matchAll(/`([a-z0-9_]+\.mjs)`/g)].map(m => m[1]);
ok('há testes creditados', creditados.length > 0, String(creditados.length));
const sumidos = [...new Set(creditados)]
  .filter(t => !fs.existsSync(path.join(RAIZ_WS, 'testes', t)));
ok('nenhum deles é uma régua inexistente', sumidos.length === 0, sumidos.join(', '));

console.log('\n[3] a explicação da ausência só aparece onde há ausência');
/* `— ` só pode vir depois de `**sem teste**`. Uma linha com régua E explicação
   seria a página dizendo as duas coisas ao mesmo tempo. */
/* A frase publicada TEM travessão dentro dela — "é um endereço, não uma
   integração". Então a leitura é por COLUNA, e não por linha: quem explica a
   ausência é a segunda. E o cabeçalho de cada tabela sai fora, senão ele conta
   como promessa. */
/* SÓ A METADE GERADA. Depois do rodapé da conta vem `src/auditoria-solta.md`,
   escrito à mão, com tabela própria — e ela não é uma lista de promessas de
   cartão. Ler as duas juntas faria esta régua contar 31 promessas onde há 20 e
   reprovar uma frase que traz travessão no meio. */
const corte = noDisco.indexOf('promessa(s) sem trava');
const gerada = corte > 0 ? noDisco.slice(0, corte) : noDisco;
const linhas = gerada.split('\n')
  .filter((l) => /^\| /.test(l) && !/^\|---/.test(l))
  .map((l) => l.replace(/^\| /, '').replace(/ \|$/, '').split(' | '))
  .filter((c) => c.length === 2 && c[1] !== 'O teste');
const contraditorias = linhas.filter(([, t]) => / — /.test(t) && !/^\*\*sem teste\*\* — /.test(t));
ok('nenhuma linha credita um teste e explica a falta dele',
   contraditorias.length === 0, contraditorias.map((c) => c.join(' | ')).join(' / '));

console.log('\n[4] as promessas sem trava não passam do teto');
const semTrava = linhas.filter(([, t]) => /\*\*sem teste\*\*/.test(t)).length;
const rodape = noDisco.match(/\*\*(\d+) promessa\(s\) sem trava\*\* de (\d+)\./);
ok('o rodapé traz a conta', !!rodape, rodape ? rodape[0] : 'não achei o rodapé');
ok('e a conta bate com as linhas', rodape && Number(rodape[1]) === semTrava,
   `rodapé ${rodape ? rodape[1] : '?'} × linhas ${semTrava}`);
ok('o total conta cartões e comparação', rodape && Number(rodape[2]) === linhas.length,
   `rodapé ${rodape ? rodape[2] : '?'} × linhas ${linhas.length}`);
ok(`no máximo ${TETO_SEM_TRAVA} promessas sem trava`, semTrava <= TETO_SEM_TRAVA,
   `são ${semTrava} — uma promessa nova entrou sem régua, ou o teto precisa subir com justificativa`);
if (semTrava < TETO_SEM_TRAVA) {
  ok(`o teto acompanhou a melhora (baixe TETO_SEM_TRAVA para ${semTrava})`, false,
     `são ${semTrava} sem trava e o teto ainda é ${TETO_SEM_TRAVA}`);
}

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nAuditoria: a lista de promessas sem trava é gerada e não cresceu.');
process.exit(falhas ? 1 : 0);

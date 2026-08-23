/* TRÊS NÚMEROS PARA A MESMA PERGUNTA, E NENHUM BATIA.
 *
 * O `LEIA-ME.md` dizia 135 arquivos. No disco havia 143 que afirmam alguma
 * coisa. O `rodar.sh` chamava 136. Ninguém estava mentindo: cada número foi
 * escrito à mão num dia diferente, e é o defeito que este projeto conhece
 * melhor — a lista paralela.
 *
 * O custo não é o número errado. É que um arquivo de teste pode nascer, ficar
 * fora do `rodar.sh` e nunca rodar — e "coberto por X" vira, na prática, "sem
 * teste", com todo mundo achando que está coberto. Aconteceu com
 * `terceiros.mjs` e `precos.mjs`: funcionavam, e a esteira nunca os chamava.
 *
 * Esta régua compara os três e reprova com o NOME do arquivo órfão, e não com
 * a diferença entre dois números. Ela é estática: um segundo, sem navegador.
 */
import fs from 'fs';
import path from 'path';

import { RAIZ_WS } from './_caminhos.mjs';

let falhas = 0;
const ok = (n, c, e) => {
  console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : ''));
  if (!c) falhas++;
};

const AQUI = path.join(RAIZ_WS, 'testes');

/* O QUE NÃO É AFIRMAÇÃO, e por isso não entra na conta. Declarado por nome, e
   não por regra esperta: uma regra que perdoasse "arquivos que parecem
   ferramentas" perdoaria o próximo teste que alguém esquecer de registrar. */
const INSTRUMENTOS = new Set([
  'proxy.mjs',      // encaminhador para o Next, usado por dez testes
  'regua.mjs',      // instrumento de medição de desempenho, roda sob demanda
  'gerar-dpa.mjs',  // gerador dos PDFs do DPA, não afirma nada
  'capturar.mjs',   // captura e compara o antes/depois de um build visual
]);

const ehTeste = (f) =>
  f.endsWith('.mjs') && !f.startsWith('_') && !f.startsWith('shot') &&
  !f.startsWith('dbg') && !INSTRUMENTOS.has(f);

const disco = fs.readdirSync(AQUI).filter(ehTeste).sort();

const rodar = fs.readFileSync(path.join(AQUI, 'rodar.sh'), 'utf8');
const bloco = (rodar.match(/TESTES="([\s\S]*?)"/) || [])[1] || '';
const chamados = bloco.split(/\s+/).filter(Boolean).sort();

console.log(`[1] o disco e o rodar.sh dizem a mesma coisa`);
console.log(`     disco ${disco.length} · rodar.sh ${chamados.length}`);

const orfaos = disco.filter((f) => !chamados.includes(f));
ok('nenhum teste no disco fica fora da esteira', orfaos.length === 0, orfaos.join(' '));

const fantasmas = chamados.filter((f) => !disco.includes(f));
ok('e a esteira não chama arquivo que não existe', fantasmas.length === 0, fantasmas.join(' '));

const repetidos = chamados.filter((f, i) => chamados.indexOf(f) !== i);
ok('nem chama o mesmo duas vezes', repetidos.length === 0, repetidos.join(' '));

console.log('\n[2] e o LEIA-ME.md conta o mesmo número');
const leiame = fs.readFileSync(path.join(AQUI, 'LEIA-ME.md'), 'utf8');
const dito = Number((leiame.match(/^(\d+) arquivos que afirmam/m) || [])[1]);
ok('o LEIA-ME declara quantos são', Number.isFinite(dito), String(dito));
ok(`e o número bate com o disco (${disco.length})`, dito === disco.length,
   `LEIA-ME diz ${dito}`);

console.log('\n[3] os instrumentos declarados existem mesmo');
for (const f of INSTRUMENTOS) {
  ok(`${f} está no disco`, fs.existsSync(path.join(AQUI, f)));
}

console.log('\n[4] quem pula, pula ALTO — e não em letra minúscula');
{
  /* O TERCEIRO ESTADO SÓ VALE SE A ESTEIRA O ENXERGAR.
     O `rodar.sh` reconhece um pulado por `^PULADO` no começo da linha. Cinco
     arquivos escreviam `  pulado  ` — minúsculo e indentado —, saíam 0, e a
     esteira contava **ok**. É o mesmo defeito que o Build 3 consertou nos três
     testes de licença, sobrevivendo em mais cinco: `audio`, `espera`, `faixa`,
     `varredura` e `semmarca`. O `espera.mjs` passou builds inteiros contando
     como verde sem nunca ter rodado, por falta da amostra longa.
     Aqui se cobra a FORMA, que é o que a esteira lê. Um bloco interno que se
     descreve como pulado no meio da saída não conta: o que não pode é a linha
     do desfecho começar com a palavra em minúscula. */
  const errados = [];
  for (const f of disco) {
    const txt = fs.readFileSync(path.join(AQUI, f), 'utf8');
    for (const linha of txt.split('\n')) {
      if (/console\.log\(\s*['"`]\s+pulado/i.test(linha)) errados.push(`${f}: ${linha.trim().slice(0, 60)}`);
    }
  }
  ok('nenhum teste anuncia um pulo em minúscula', errados.length === 0,
     errados.join(' | '));
}

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nInventário dos testes: os três números batem.');
process.exit(falhas ? 1 : 0);

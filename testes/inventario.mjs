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

console.log('\n[5] a pista de liberação conta as MESMAS réguas');
{
  /* QUATRO NÚMEROS, E NÃO TRÊS. O `liberar.sh` calcula o próprio total no
     rodapé — "rodaram 23 de 161 réguas" — e esse total saía de uma lista de
     exclusões escrita à mão, paralela ao `INSTRUMENTOS` daqui. Ela tinha três
     dos quatro nomes: o `capturar.mjs` faltava, e o rodapé dizia 161 enquanto
     este arquivo dizia 160.
     Ninguém reprovava, porque o inventário conferia disco × rodar.sh × LEIA-ME
     e a quarta lista não estava na conta. É o defeito que este arquivo existe
     para impedir, sobrevivendo dentro do próprio corredor de liberação. */
  const lib = fs.readFileSync(path.join(AQUI, 'liberar.sh'), 'utf8');
  const linha = (lib.match(/^.*grep -vE .*gerar-dpa.*$/m) || [''])[0];
  ok('o liberar.sh declara as exclusões dele', linha.length > 0, linha.slice(0, 60));
  const faltando = [...INSTRUMENTOS].filter((f) => !linha.includes(f.replace('.mjs', '')));
  ok('e elas são exatamente os instrumentos deste arquivo', faltando.length === 0,
     faltando.length ? `fora da conta do rodapé: ${faltando.join(', ')}` : '');
}

console.log('\n[6] quantas réguas o corredor específico NÃO consegue chamar');
{
  /* MEDIDO EM 28/08, e é um número que ninguém tinha olhado: das réguas do
     disco, **59 não aparecem em linha nenhuma do mapa do `liberar.sh` nem na
     lista dos contratos** (eram 64 antes de o Build 48 ligar o `portal.mjs` e as
     cartas). Não importa o que o build toque — elas só rodam no
     `rodar.sh` completo.
     Isso não é um defeito do mapa: ele é escrito à mão de propósito, e muita
     régua de produto entra pela linha do `src/template.html`. É um LIMITE, e o
     que faltava era ele estar escrito. "Esteira específica verde" quer dizer
     "verde no que o mapa alcança" — e sem este número ninguém sabia quanto era.
     O TETO SÓ DESCE. Ele não obriga a mapear tudo hoje; obriga a não abrir mais
     buraco amanhã. Uma régua nova que ninguém liga ao mapa reprova aqui, no
     mesmo dia em que nasce, em vez de virar mais um nome nesta lista. */
  const TETO = 59;
  const lib = fs.readFileSync(path.join(AQUI, 'liberar.sh'), 'utf8');
  const mapa = (lib.split("<<'MAPA_FIM'")[1] || '').split('MAPA_FIM')[0];
  const contratos = (lib.match(/CONTRATOS="([\s\S]*?)"/) || ['', ''])[1];
  const alcancadas = new Set([...`${mapa}\n${contratos}`.matchAll(/([a-z0-9-]+\.mjs)/g)].map((m) => m[1]));
  const fora = disco.filter((f) => !alcancadas.has(f) && !INSTRUMENTOS.has(f)).sort();
  ok(`o corredor específico alcança ${disco.length - fora.length} das ${disco.length} réguas`,
     fora.length <= TETO,
     fora.length > TETO
       /* NÃO lista nomes aqui: a lista sai em ordem alfabética e apontaria os
          seis primeiros como culpados, que é o contrário do que aconteceu. */
       ? `${fora.length} fora do alcance, e o teto é ${TETO} — ligue a régua nova ` +
         'a uma linha do mapa do liberar.sh, ou baixe o teto se ela sumiu'
       : `${fora.length} fora do alcance, teto ${TETO}`);
  /* O teto frouxo é teto que não segura: se o número já caiu, ele desce junto,
     senão a folga vira espaço para um buraco novo entrar sem reprovar. */
  ok('  e o teto está colado no número de hoje', fora.length >= TETO - 2,
     fora.length >= TETO - 2 ? `hoje ${fora.length}, teto ${TETO}`
                             : `hoje ${fora.length} — baixe o TETO para ${fora.length}`);
}

console.log('\n[7] duas réguas nunca disputam a mesma porta');
{
  /* O QUE ISTO IMPEDE, e já aconteceu. O `rodar.sh` roda várias ao mesmo tempo
     com `xargs -P`, que é uma FILA: qualquer duas podem cair juntas. Medido em
     29/08: **33 portas eram usadas por mais de uma régua** — três arquivos na
     8918, três na 8921, três na 8931, três na 8934, três na 8937, três na 8951,
     três na 8953.
     Duas réguas na mesma porta não dão erro barulhento: a segunda encontra a
     porta ocupada, e daí em diante ou fala com o servidor da PRIMEIRA — de
     outro teste, com outro conteúdo — ou derruba o dela no meio. Verde falso
     nos dois casos, e o próprio `rodar.sh` já tem no cabeçalho a cicatriz de
     uma execução medida contra uma build velha.

     A exceção é UMA, e é declarada: a 8802 é o Next que o `rodar.sh` sobe uma
     vez para todas as réguas de site. Ali o compartilhamento é o desenho. */
  const COMPARTILHADA = new Set([8802]);
  const dono = new Map();
  const colisoes = [];
  for (const f of disco.concat([...INSTRUMENTOS])) {
    const txt = fs.readFileSync(path.join(AQUI, f), 'utf8');
    const portas = new Set();
    for (const m of txt.matchAll(/\b(?:const|let)\s+(?:P|B|E|PORTA[A-Z_]*|P\d|PORT)\s*=\s*(8\d{3})\b/g)) {
      portas.add(Number(m[1]));
    }
    for (const m of txt.matchAll(/\.listen\((8\d{3})\b/g)) portas.add(Number(m[1]));
    for (const porta of portas) {
      if (COMPARTILHADA.has(porta)) continue;
      if (dono.has(porta)) colisoes.push(`${porta}: ${dono.get(porta)} e ${f}`);
      else dono.set(porta, f);
    }
  }
  ok(`as ${dono.size} portas próprias são de uma régua cada`, colisoes.length === 0,
     colisoes.slice(0, 4).join(' | '));
}

console.log('\n[8] toda régua que sobe o Next PROVA que a porta é dela');
{
  /* ESTA AFIRMAÇÃO NASCEU DE UM ERRO MEU, no mesmo build. Eu acrescentei a
     garantia de porta às catorze réguas que faltavam com uma edição em massa
     que casava `const next = spawn(...)`. Duas tinham outra forma — o
     `email.mjs` chama de `const n`, dentro de uma função; o `faxina.mjs` sobe o
     Next duas vezes num `comNext()`. As duas ganharam o `import` e NENHUMA
     chamada: ficaram com cara de prontas e sem a trava.
     Contar o `import` seria repetir o meu erro. O que se cobra aqui é a
     CHAMADA. */
  const semGarantia = [];
  for (const f of disco.concat([...INSTRUMENTOS])) {
    const txt = fs.readFileSync(path.join(AQUI, f), 'utf8');
    if (!/spawn\('npx',\s*\['next',\s*'start'/.test(txt)) continue;
    if (!/garantirPortaLivre\(/.test(txt)) semGarantia.push(f);
  }
  ok('nenhuma sobe o Next sem garantir a porta antes', semGarantia.length === 0,
     semGarantia.join(', '));
}

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nInventário dos testes: os quatro números batem.');
process.exit(falhas ? 1 : 0);

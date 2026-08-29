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

console.log('\n[6] nenhuma régua fica fora do alcance do corredor específico');
{
  /* A HISTÓRIA DESTE BLOCO, porque ela mudou de forma duas vezes.
     Ele nasceu no Build 48 como um TETO: 62 réguas que nenhum padrão do
     `liberar.sh` alcançava, e um número que só podia descer. O teto não obrigava
     a mapear tudo; obrigava a não abrir mais buraco.
     No Build 53 o buraco fechou. A linha do `src/template.html` listava 61 nomes
     à mão e estava errada dos DOIS lados — sete que nem leem o produto, e 54 que
     leem e ficaram de fora. Ela virou `grupo:produto`, que é uma pergunta ao
     disco, e as oito que sobraram ganharam padrão próprio.
     Então o teto virou ZERO, e um teto de zero não é teto: é invariante. Régua
     nova sem lugar no mapa reprova no dia em que nasce. */
  const lib = fs.readFileSync(path.join(AQUI, 'liberar.sh'), 'utf8');
  const mapa = (lib.split("<<'MAPA_FIM'")[1] || '').split('MAPA_FIM')[0];
  const contratos = (lib.match(/CONTRATOS="([\s\S]*?)"/) || ['', ''])[1];
  const alcancadas = new Set([...`${mapa}\n${contratos}`.matchAll(/([a-z0-9-]+\.mjs)/g)].map((m) => m[1]));
  /* `grupo:produto` não é um nome, é uma PERGUNTA AO DISCO: quem lê `app.html`
     ou o pacote offline. A regra é repetida aqui de propósito, e não importada
     do shell — se ela mudar lá e não aqui, é aqui que se descobre, que é o
     mesmo acordo do `janelinha.mjs` com a conta da largura da fita. */
  if (/grupo:produto/.test(mapa)) {
    for (const f of disco) {
      if (INSTRUMENTOS.has(f)) continue;
      const t = fs.readFileSync(path.join(AQUI, f), 'utf8');
      if (/app\.html|walkstamp-offline\.html/.test(t)) alcancadas.add(f);
    }
  }
  const fora = disco.filter((f) => !alcancadas.has(f) && !INSTRUMENTOS.has(f)).sort();
  ok(`o corredor específico alcança as ${disco.length - fora.length} réguas`,
     fora.length === 0,
     /* NÃO lista em ordem alfabética o começo da lista: apontaria os primeiros
        como culpados, que é o contrário do que aconteceu. */
     fora.length === 0 ? '' :
       `${fora.length} fora do alcance — ligue ao mapa do liberar.sh: ${fora.join(', ')}`);
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

  /* O LEITOR DE PORTAS, e por que ele é assim.
     A primeira versão casava `const <NOME DE PORTA> = 8xxx` — e era CEGA para
     `const P = 8806, B = 8842;`, a lista de declaradores, onde só o primeiro
     era visto. Foi assim que a desconflitação deste mesmo build atribuiu a 8842
     a uma segunda régua e criou uma colisão nova, que o `seo.mjs` reprovou com
     EADDRINUSE. Agora a lista é partida na vírgula, o nome não importa, e o
     endereço escrito à mão (`localhost:8xxx`) conta também.
     Comentário não é código: sem tirá-los, a prosa que EXPLICA uma porta velha
     vira uma colisão inventada. */
  const semComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '')
                                 .replace(/(^|[^:\w])\/\/[^\n]*/g, '$1');
  for (const f of disco.concat([...INSTRUMENTOS])) {
    const txt = semComentarios(fs.readFileSync(path.join(AQUI, f), 'utf8'));
    const portas = new Set();
    for (const m of txt.matchAll(/\b(?:const|let|var)\s+([^;\n]+?);/g)) {
      for (const parte of m[1].split(',')) {
        const mm = parte.match(/^\s*[A-Za-z_$][\w$]*\s*=\s*(8\d{3})\s*$/);
        if (mm) portas.add(Number(mm[1]));
      }
    }
    for (const m of txt.matchAll(/\.listen\(\s*(8\d{3})\b/g)) portas.add(Number(m[1]));
    for (const m of txt.matchAll(/localhost(?::|%3A)(8\d{3})\b/g)) portas.add(Number(m[1]));
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

/* O FUNIL SÓ MEDE O QUE O BANCO ACEITA — e por muito tempo não foi assim.
 *
 * O produto chamava `medir()` com ONZE nomes de evento. A tabela aceitava TRÊS.
 * Os outros oito morriam calados, de três jeitos:
 *
 *   - batendo no `check` do nome (a função captura `check_violation` e volta
 *     sem erro, de propósito — uma medição recusada não pode virar erro na tela
 *     de ninguém, e o preço disso é que ninguém nunca soube);
 *   - mandando parâmetros que a função não tem (`p_de`, `p_para`, `p_pct`,
 *     `p_via`, `p_telas`), o que faz o PostgREST dizer que a função não existe;
 *   - e o `baixou_saida` em `pptx`, `html`, `md`, `csv`, `gdocs`, `jira` ou
 *     `vocabulario`, que batia no `check` do formato e levava a linha inteira.
 *
 * E `idioma` aceitava três dos cinco idiomas do site. Alemão e francês foram
 * descartados desde sempre — o que explica, sem nenhuma teoria sobre tráfego,
 * por que `de` e `fr` têm zero eventos enquanto as páginas existem.
 *
 * NADA DISSO DAVA ERRO EM LUGAR NENHUM. Por isso este arquivo é estático e
 * roda sem banco: ele lê o vocabulário da migração e as chamadas do
 * `template.html`, e reprova quando os dois deixam de bater. Um evento novo
 * passa a exigir uma decisão — que é o que faltava.
 *
 *   node testes/funil.mjs
 */
import fs from 'fs';
import { RAIZ_WS } from './_caminhos.mjs';

let falhas = 0;
const ok = (n, c, e) => {
  console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : ''));
  if (!c) falhas++;
};

/* A migração mais recente que mexe no vocabulário é a fonte. Achada por
   conteúdo e não por nome: renomear o arquivo não pode cegar a régua. */
const dir = `${RAIZ_WS}/supabase/migrations`;
const migs = fs.readdirSync(dir).sort()
  .map((f) => ({ f, sql: fs.readFileSync(`${dir}/${f}`, 'utf8') }))
  .filter((m) => /evento_nome_check/.test(m.sql));
const sql = migs[migs.length - 1].sql;
console.log(`[0] vocabulário lido de ${migs[migs.length - 1].f}`);

/** Os valores de um `check (campo in ('a','b'))` ou `check (campo is null or campo in (...))`. */
function vocab(campo) {
  /* Por indice, e nao por expressao regular: escapar parenteses dentro de um
     `new RegExp` em cima de SQL com parenteses aninhados e o tipo de coisa que
     passa a dar zero resultado em silencio — que e justamente o defeito que
     esta regua existe para pegar. */
  const marca = `add constraint evento_${campo}_check check (`;
  const i = sql.indexOf(marca);
  if (i < 0) return new Set();
  const fim = sql.indexOf(');', i);
  const bloco = sql.slice(i + marca.length, fim);
  return new Set([...bloco.matchAll(/'([^']+)'/g)].map((m) => m[1]));
}
const NOMES = vocab('nome');
const IDIOMAS = vocab('idioma');
const FORMATOS = vocab('formato');
const ORIGENS = vocab('origem');
const FAIXAS = vocab('faixa');
const PLANOS = vocab('plano');
ok('a migração declara os seis vocabulários',
   [NOMES, IDIOMAS, FORMATOS, ORIGENS, FAIXAS, PLANOS].every((v) => v.size > 0),
   [...NOMES].length + '/' + [...IDIOMAS].length + '/' + [...FORMATOS].length + '/' +
   [...ORIGENS].length + '/' + [...FAIXAS].length + '/' + [...PLANOS].length);

/* Os parâmetros que a função aceita, tirados da própria assinatura. */
const assinatura = (sql.match(/create or replace function public\.walkstamp_evento\(([\s\S]*?)\)\s*returns/) || [])[1] || '';
const PARAMS = new Set([...assinatura.matchAll(/\b(p_[a-z]+)\b/g)].map((m) => m[1]));

console.log('\n[1] todo evento que o produto manda cabe no vocabulário');
const html = fs.readFileSync(`${RAIZ_WS}/src/template.html`, 'utf8');
const chamadas = [...html.matchAll(/medir\('([a-z_]+)'(?:,\s*\{([^}]*)\})?\)/g)]
  .map((m) => ({ nome: m[1], args: m[2] || '' }));
ok('há chamadas para conferir', chamadas.length > 10, chamadas.length + ' chamada(s)');

const nomesUsados = [...new Set(chamadas.map((c) => c.nome))].sort();
const foraDoVocab = nomesUsados.filter((n) => !NOMES.has(n));
ok('nenhum nome de evento fora da lista do banco', foraDoVocab.length === 0,
   foraDoVocab.join(', '));

console.log('\n[2] e nenhum parâmetro que a função não tem');
const paramsUsados = [...new Set(chamadas.flatMap(
  (c) => [...c.args.matchAll(/\b(p_[a-z]+)\s*:/g)].map((m) => m[1])))].sort();
const foraDaAssinatura = paramsUsados.filter((p) => !PARAMS.has(p));
ok('todo p_* usado existe na função', foraDaAssinatura.length === 0,
   foraDaAssinatura.join(', ') + '  (a função tem: ' + [...PARAMS].join(', ') + ')');

console.log('\n[3] os valores literais também cabem');
const CAMPOS = { p_formato: FORMATOS, p_origem: ORIGENS, p_faixa: FAIXAS, p_plano: PLANOS };
/* Só os literais. `p_formato: ext` não dá para resolver lendo o arquivo, e
   fingir que dá seria pior do que dizer que não dá — por isso eles entram na
   lista de baixo, com o conjunto escrito à mão e conferido uma vez. */
const naoLiterais = [];
for (const c of chamadas) {
  for (const [campo, lista] of Object.entries(CAMPOS)) {
    const m = c.args.match(new RegExp(campo + `\\s*:\\s*(.+?)(?:,\\s*p_|$)`));
    if (!m) continue;
    const bruto = m[1].trim();
    const literais = [...bruto.matchAll(/'([^']*)'/g)].map((x) => x[1]);
    if (!literais.length) { naoLiterais.push(`${c.nome}.${campo} = ${bruto}`); continue; }
    /* Um ternário tem dois literais, e os dois têm que caber. */
    for (const v of literais) {
      if (!lista.has(v)) ok(`${c.nome}: ${campo}='${v}' está no vocabulário`, false,
                            [...lista].join(' '));
    }
  }
}
ok('todo valor literal de formato, origem, faixa e plano está no vocabulário', true);

console.log('\n[4] o que não dá para ler estaticamente está declarado');
/* Cada entrada aqui foi conferida à mão UMA vez, no código, e o conjunto está
   escrito. Se a régua encontrar uma expressão que não está nesta lista, ela
   reprova: um valor dinâmico novo é exatamente como `p_formato: 'drive:' + fonte`
   entrou e ficou anos mandando algo que o banco recusava. */
const DINAMICOS = {
  "baixou_saida.p_formato = ext": ['html', 'md', 'csv'],
  "baixou_saida.p_formato = ext === 'json' ? 'json' : 'vtt'": ['json', 'vtt'],
  "carregou_video.p_origem = origem || 'arquivo'": ['arquivo', 'drive', 'gravacao', 'exemplo'],
  "transcricao_arquivo.p_formato = fonte || 'sem_tempo'": ['vtt', 'blocos', 'linhas', 'sem_tempo'],
  "trocou_modo.p_origem = alvo.rotulo": ['placa', 'modelo'],
  "recado.p_origem = fbTipo": ['ideia', 'elogio', 'problema'],
  "parou_fala.p_faixa = faixaPct(Math.round(parouNoMeio / total * 100))": ['0-24', '25-49', '50-74', '75-100'],
  "faxina_recomendada.p_faixa = faixaConta(p.todos.length)": ['1-3', '4-10', '11-30', '31+'],
};
const naoDeclarados = naoLiterais.filter((d) => !(d in DINAMICOS));
ok('nenhuma expressão dinâmica sem conjunto declarado', naoDeclarados.length === 0,
   naoDeclarados.join(' | '));
for (const [expr, valores] of Object.entries(DINAMICOS)) {
  const campo = expr.split(' = ')[0].split('.')[1];
  const fora = valores.filter((v) => !CAMPOS[campo].has(v));
  ok(`${expr.split(' = ')[0]}: o conjunto declarado cabe no banco`, fora.length === 0,
     fora.join(', '));
}

console.log('\n[5] a area da conta mede os quatro passos do lado pago');
/* O funil terminava em "baixou um documento". A pergunta que decide o produto
   comeca depois: alguem chega a importar um roteiro? alguem conclui um caso?
   alguem comeca a pagar? A conta nao media nada — e um evento declarado no
   banco e nunca disparado e pior que nenhum, porque o zero parece resposta. */
const CONTA = {
  'importou_roteiro': 'app/conta/roteiro-acoes.ts',
  'concluiu_caso': 'app/conta/roteiro-acoes.ts',
  'comecou_pagamento': 'app/conta/acoes.ts',
  'comecou_teste': 'app/conta/acoes.ts',
};
for (const [evento, arquivo] of Object.entries(CONTA)) {
  const src = fs.readFileSync(`${RAIZ_WS}/${arquivo}`, 'utf8');
  ok(`${evento} é disparado em ${arquivo.split('/').pop()}`,
     src.includes(`medirConta('${evento}'`), arquivo);
  ok(`  e o nome está no vocabulário do banco`, NOMES.has(evento));
}

/* O `redirect` do Next funciona LANCANDO uma excecao: nada escrito abaixo dele
   roda. Uma medicao posta depois seria uma linha que nunca executa — e o funil
   pareceria ligado. */
{
  const src = fs.readFileSync(`${RAIZ_WS}/app/conta/acoes.ts`, 'utf8');
  const iMed = src.indexOf("medirConta('comecou_pagamento'");
  const iRed = src.indexOf('redirect(sessao.url!)');
  ok('e a medição do pagamento vem ANTES do redirect, que lança',
     iMed > 0 && iRed > 0 && iMed < iRed, `${iMed} vs ${iRed}`);
}

/* E ela cala quando a pessoa pediu para nao ser medida. Do lado do servidor
   `navigator.doNotTrack` nao existe, e a saida preguicosa seria dizer que DNT e
   coisa de navegador — o cabecalho vem em toda requisicao, inclusive na que
   dispara a acao. */
{
  const src = fs.readFileSync(`${RAIZ_WS}/lib/conta/medir.ts`, 'utf8');
  ok('a medição da conta respeita Do Not Track e o GPC',
     /headers\(\)/.test(src) && /'dnt'/.test(src) && /'sec-gpc'/.test(src));
  ok('e não manda e-mail, conta nem nome de nada',
     !/p_email|email|conta:/.test(src.replace(/\/\*[\s\S]*?\*\//g, '')));
}

console.log('\n[6] os cinco idiomas do site cabem no campo idioma');
const site = JSON.parse(fs.readFileSync(`${RAIZ_WS}/src/i18n-site.json`, 'utf8'));
const doSite = Object.keys(site);
const semLugar = doSite.filter((L) => !IDIOMAS.has(L));
ok('nenhum idioma publicado é descartado pelo banco', semLugar.length === 0,
   semLugar.join(', ') + '  (o banco aceita: ' + [...IDIOMAS].join(', ') + ')');

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nFunil: o banco aceita o que o produto manda.');
process.exit(falhas ? 1 : 0);

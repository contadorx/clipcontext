/* OS PRAZOS DE RETENÇÃO EXISTEM EM DOIS LUGARES. Esta régua é o que impede
 * eles de discordarem.
 *
 * O banco tem `walkstamp.prazos()`: o expurgo lê de lá, e a tela
 * `/conta/dados` mostra de lá. O site tem `PRAZO_*` no `build.py`, que vira
 * `marca.json` e daí vira o número escrito em prosa na política de privacidade,
 * nos cinco idiomas.
 *
 * NÃO DÁ PARA SER UM SÓ. A política é HTML estático, servido sem sessão e sem
 * chave de serviço: ela não tem como perguntar ao banco quantos dias são. A
 * escolha real não é entre uma fonte e duas — é entre duas fontes conferidas e
 * duas fontes no escuro.
 *
 * Este projeto já pagou esse preço quatro vezes, sempre igual: uma lista escrita
 * à mão ao lado de outra lista de verdade. Foi assim que o alemão e o francês
 * ficaram sem `hreflang`; foi assim que o menu da conta divergiu do menu da
 * ferramenta. Aqui o dano seria pior, porque a lista errada é um documento
 * legal: a política prometendo 90 dias enquanto o banco apaga em 45 é uma
 * promessa que nenhum avaliador de fornecedor perdoa.
 *
 * O QUE ELA LÊ, e é de propósito que sejam os ARQUIVOS e não o banco:
 *   - `build.py`, as três constantes;
 *   - `src/marca.json`, o que o build publicou para o Next;
 *   - a migração que define `walkstamp.prazos()`, o corpo SQL;
 *   - a política de privacidade dos cinco idiomas, o número já trocado.
 *
 * Ela NÃO fala com o Supabase. O banco de produção não vive nesta máquina, e
 * uma régua que só roda quando há rede é uma régua que não roda.
 *
 *   node testes/prazos.mjs
 */
import fs from 'fs';
import path from 'path';
import { RAIZ_WS } from './_caminhos.mjs';

let falhas = 0;
const ok = (n, c, e) => { console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : '')); if (!c) falhas++; };

const CHAVES = [
  { py: 'PRAZO_CONTA_DIAS',   json: 'prazoConta',  sql: 'conta_dias',   token: '{{prazoConta}}' },
  { py: 'PRAZO_LISTA_MESES',  json: 'prazoLista',  sql: 'lista_meses',  token: '{{prazoLista}}' },
  { py: 'PRAZO_EVENTO_MESES', json: 'prazoEvento', sql: 'evento_meses', token: '{{prazoEvento}}' },
];

console.log('[1] o build.py declara os três, e o marca.json publicou os mesmos');
const py = fs.readFileSync(path.join(RAIZ_WS, 'build.py'), 'utf8');
const marca = JSON.parse(fs.readFileSync(path.join(RAIZ_WS, 'src', 'marca.json'), 'utf8'));
const doPy = {};
for (const c of CHAVES) {
  const m = py.match(new RegExp('^' + c.py + '\\s*=\\s*(\\d+)\\s*$', 'm'));
  ok(`build.py declara ${c.py}`, !!m, m ? m[1] : '(não achei)');
  if (m) doPy[c.sql] = m[1];
  ok(`  e o marca.json traz ${c.json}`,
     m ? String(marca[c.json]) === m[1] : false,
     `marca.json=${marca[c.json]}`);
}

console.log('\n[2] a migração de walkstamp.prazos() diz os mesmos números');
{
  /* A migração é procurada pelo que ela FAZ, não pelo nome do arquivo: um
     `create or replace function walkstamp.prazos()` novo, com outro nome, teria
     que ser lembrado aqui — e não seria. Vale a ÚLTIMA por ordem de data, que é
     a que o banco tem. */
  const dir = path.join(RAIZ_WS, 'supabase', 'migrations');
  const arquivos = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const donas = arquivos.filter((f) =>
    /create\s+or\s+replace\s+function\s+walkstamp\.prazos\s*\(/i
      .test(fs.readFileSync(path.join(dir, f), 'utf8')));
  ok('existe migração que define walkstamp.prazos()', donas.length > 0, donas.join(', '));

  if (donas.length) {
    const ultima = donas[donas.length - 1];
    const sql = fs.readFileSync(path.join(dir, ultima), 'utf8');
    const corpo = sql.slice(sql.search(/create\s+or\s+replace\s+function\s+walkstamp\.prazos\s*\(/i));
    const fim = corpo.indexOf('$$;');
    const trecho = fim > 0 ? corpo.slice(0, fim) : corpo;
    for (const c of CHAVES) {
      const m = trecho.match(new RegExp(`'${c.sql}'\\s*,\\s*(\\d+)`));
      ok(`  ${ultima}: '${c.sql}' está lá`, !!m, m ? m[1] : '(não achei)');
      ok(`    e bate com o ${c.py}`,
         !!m && !!doPy[c.sql] && m[1] === doPy[c.sql],
         `sql=${m ? m[1] : '?'} build.py=${doPy[c.sql] || '?'}`);
    }
    /* E o expurgo tem que LER da função, não guardar cópia dos números. Foi
       assim que os três nasceram: três `declare` com literais dentro dele. */
    const expurgos = arquivos.filter((f) =>
      /create\s+or\s+replace\s+function\s+walkstamp\.expurgo\s*\(/i
        .test(fs.readFileSync(path.join(dir, f), 'utf8')));
    const ue = expurgos[expurgos.length - 1];
    const ex = fs.readFileSync(path.join(dir, ue), 'utf8');
    const cab = ex.slice(ex.search(/create\s+or\s+replace\s+function\s+walkstamp\.expurgo\s*\(/i));
    const decl = cab.slice(0, cab.indexOf('begin'));
    ok(`  ${ue}: o expurgo lê de walkstamp.prazos()`,
       /walkstamp\.prazos\(\)/.test(decl), decl.replace(/\s+/g, ' ').slice(0, 110));
    const literais = [...decl.matchAll(/^\s*(DIAS_CONTA|MESES_LISTA|MESES_EVENTO)\s+int\s*:=\s*(\d+)/gm)];
    ok('    e não guarda cópia dos números',
       literais.length === 0, literais.map((m) => `${m[1]}=${m[2]}`).join(' '));
  }
}

console.log('\n[3] a política de privacidade escreve o número, e ele é o mesmo');
{
  /* O CORPO tem que trazer o TOKEN, e a página SERVIDA tem que trazer o NÚMERO.
     Só o token provaria que alguém escreveu `{{prazoConta}}`; só o número
     provaria que "90" aparece — e "90" aparece em qualquer texto por acaso.
     Os dois juntos provam que a substituição acontece. */
  const dir = path.join(RAIZ_WS, 'src', 'site', 'bodies');
  const IDIOMAS = ['pt', 'en', 'es', 'de', 'fr'];
  for (const L of IDIOMAS) {
    const arq = path.join(dir, `privacidade.${L}.html`);
    const corpo = fs.readFileSync(arq, 'utf8');
    for (const c of CHAVES) {
      if (c.json === 'prazoLista') continue; // a lista de aviso saiu do produto
      /* O detalhe só é impresso quando REPROVA. Impresso sempre, ele dizia
         "traz o número CRU, sem token" ao lado de um `ok` — um rótulo que
         contradiz a própria linha, que é o defeito que estas réguas existem
         para não deixar passar em outro lugar. */
      const tem = corpo.includes(c.token);
      ok(`${L}: a política usa o token ${c.token}`, tem,
         tem ? '' : (corpo.includes(String(marca[c.json])) ? 'traz o número CRU, sem token' : '(nenhum)'));
    }
  }
  /* E o número não pode estar escrito CRU ao lado do token: seria a cópia que
     esta régua existe para impedir, escondida na mesma frase. */
  for (const L of IDIOMAS) {
    const corpo = fs.readFileSync(path.join(dir, `privacidade.${L}.html`), 'utf8');
    const cru = corpo.match(/(?:^|[^{\d])(90)\s*(dias|days|días|Tagen|jours)/i);
    ok(`  ${L}: e não escreve o prazo à mão em lugar nenhum`, !cru,
       cru ? cru[0].trim() : '');
  }
}

console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'os prazos são os mesmos nos quatro lugares'));
process.exit(falhas ? 1 : 0);

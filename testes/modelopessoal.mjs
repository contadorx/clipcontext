/* "SÓ PARA MIM" TEM DE SER SÓ PARA MIM.
 *
 * O `modelo_doc` guarda dois tipos de linha: o padrão do time, que é da
 * empresa, e o modelo pessoal, que é de uma pessoa. Até 24/08 a tabela era
 * chaveada só por `cliente_id` e não tinha coluna de dono — quer dizer que o
 * "só para mim" aparecia para todo colega do mesmo cliente.
 *
 * E o pior não era o esquema: a função `perfil_do_usuario`, que alimenta a
 * FERRAMENTA, trazia este comentário, no ar, há meses —
 *
 *     "O escopo `personal` de OUTRA pessoa não aparece aqui — ele é dela."
 *
 * — com um `select` logo abaixo que filtrava só por `cliente_id`. O comentário
 * descrevia um filtro que não existia.
 *
 * DUAS FUNÇÕES LEEM ESSA TABELA, e é isso que esta régua existe para lembrar:
 * `perfil_do_usuario` serve a ferramenta e `time_painel` serve a conta.
 * Consertar uma e seguir em frente foi o que eu quase fiz. As duas precisam do
 * filtro, sempre — e como as migrações são acumuladas e a ÚLTIMA definição é a
 * que vale, a régua olha a última, e não qualquer uma.
 *
 * O que ela NÃO faz: falar com o banco. A prova de comportamento correu como
 * migração, com cenário montado e apagado — doze afirmações, incluindo a de que
 * o banco recusa um pessoal sem dono por SQL cru. Isto aqui é a trava que
 * impede alguém reescrever a função sem o filtro no mês que vem.
 */
import fs from 'fs';
import path from 'path';

import { RAIZ_WS } from './_caminhos.mjs';

let falhas = 0;
const ok = (n, c, e) => {
  console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : ''));
  if (!c) falhas++;
};

const DIR = path.join(RAIZ_WS, 'supabase/migrations');
const arquivos = fs.readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
const juntas = arquivos.map((f) => fs.readFileSync(path.join(DIR, f), 'utf8')).join('\n');

/** A ÚLTIMA definição de uma função, que é a que o banco tem. */
function ultimaDefinicao(nome) {
  /* Até `$$;`, e não até `\n$$;`: a função nova termina em `end $$;`, na mesma
     linha, e a âncora de início de linha fazia esta busca pular a definição
     mais nova e afirmar sobre uma antiga. Uma régua que lê a versão errada
     reprova o conserto e aprova o defeito. */
  const re = new RegExp(
    `create\\s+or\\s+replace\\s+function\\s+walkstamp\\.${nome}\\s*\\([\\s\\S]*?\\$\\$;`, 'gi');
  const todas = [...juntas.matchAll(re)];
  return todas.length ? todas[todas.length - 1][0] : null;
}

console.log('[1] as duas funções que leem `modelo_doc` filtram pelo dono');
for (const nome of ['perfil_do_usuario', 'time_painel']) {
  const def = ultimaDefinicao(nome);
  ok(`${nome} tem definição nas migrações`, !!def);
  if (!def) continue;
  /* O QUE VEM DEPOIS DO `from`, e não a função inteira.
     A primeira versão desta linha olhava uma janela em volta da tabela e
     aceitava um `dono_email` escrito em QUALQUER lugar dela — inclusive na
     projeção, no campo `meu`. Provei tirando o filtro: a afirmação continuou
     verde. Uma régua que passa com o defeito instalado é pior que nenhuma,
     porque ocupa o lugar da que pegaria.
     Agora ela lê o `where` do próprio `select` que traz os modelos. */
  const i = def.indexOf('from walkstamp.modelo_doc');
  ok(`  ${nome} lê a tabela`, i >= 0);
  const depoisDoFrom = i < 0 ? '' : def.slice(i, i + 400);
  const filtro = /\bwhere\b[\s\S]{0,300}?dono_email/.test(depoisDoFrom);
  ok(`  e o WHERE filtra por dono_email`, filtro,
     filtro ? '' : 'o select traz a tabela inteira do cliente');
  /* `escopo = 'time' or dono_email = …` — as duas metades. Só o `dono_email`
     esconderia o pessoal alheio E o padrão do time junto. */
  ok(`  e continua trazendo o padrão do time`,
     /\bwhere\b[\s\S]{0,300}?escopo\s*=\s*'time'/.test(depoisDoFrom));
}

console.log('\n[2] o invariante mora no banco, e não na boa vontade de quem chama');
{
  const c = /constraint\s+modelo_dono_coerente[\s\S]{0,400}?check\s*\(([\s\S]*?)\);/i.exec(juntas);
  ok('existe a restrição `modelo_dono_coerente`', !!c);
  if (c) {
    ok('  pessoal exige dono', /escopo\s*=\s*'personal'[\s\S]{0,120}dono_email/.test(c[1]));
    ok('  e de time não tem dono', /escopo\s*=\s*'time'[\s\S]{0,80}dono_email\s+is\s+null/.test(c[1]));
  }
  ok('a coluna do dono foi criada', /add column if not exists dono_email/.test(juntas));
}

console.log('\n[3] a escrita: o dono cuida do seu, quem administra cuida do time');
{
  const def = ultimaDefinicao('time_modelo');
  ok('time_modelo tem definição', !!def);
  if (def) {
    ok('  recusa mexer no que é de outra pessoa', /nao_e_seu/.test(def));
    /* O escopo de quem já existe é o dele: sem isto, um `p_escopo` nulo — que é
       o que o painel manda ao apagar — cairia no padrão `time` e transformaria
       um "só para mim" em padrão da equipe. */
    ok('  e um escopo nulo não converte o pessoal em padrão da equipe',
       /coalesce\(p_escopo,\s*linha\.escopo\)/.test(def));
    ok('  padrão do time continua exigindo quem administra',
       /v_escopo\s*=\s*'time'[\s\S]{0,80}not eh_admin/.test(def));
  }
}

console.log('\n[4] a tela não oferece o que o banco vai recusar');
{
  const tela = fs.readFileSync(path.join(RAIZ_WS, 'app/conta/[lang]/secoes.tsx'), 'utf8');
  const i = tela.indexOf('timeModeloApagar');
  const volta = tela.slice(Math.max(0, i - 900), i);
  const cond = /\{\(m\.meu \|\| m\.escopo === 'time'\)\s*&&/.test(volta);
  ok('o botão de apagar é condicional', cond,
     cond ? '' : 'ele aparece para toda linha — quem não pode descobre clicando');
  const tipo = fs.readFileSync(path.join(RAIZ_WS, 'lib/supabase/servico.ts'), 'utf8');
  ok('e o `meu` chega do banco, em vez de ser deduzido na tela',
     /modelos\?:\s*Array<\{[^}]*meu\?: boolean/.test(tipo));
}

console.log(falhas ? `\n${falhas} FALHA(S)`
                   : '\nModelo pessoal: é de quem salvou, nas duas funções e na tela.');
process.exit(falhas ? 1 : 0);

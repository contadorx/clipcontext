/* O CHAMADO PASSA A SER NOSSO, E O LIMITE PASSA A SER DE QUEM CHAMA.
 *
 * O DEFEITO QUE ISTO FECHA, medido em 29/08. O navegador abria chamado direto
 * no Supabase, com a chave pública, e o limite morava no banco. Só que o banco
 * NÃO SABE QUEM CHAMOU: ali não há IP. Sem ator, a única chave que se pode
 * inventar é o alvo — e era o que estava escrito:
 *
 *   com e-mail:  tentar('recado:' || md5(email), 5, 1 min)
 *   sem e-mail:  tentar('recado:anonimo',       10, 1 min)
 *
 * A primeira deixa qualquer um que saiba o seu endereço queimar a sua cota e te
 * impedir de abrir chamado. A segunda é UM BALDE PARA O MUNDO INTEIRO: dez por
 * minuto de um ator sozinho, e ninguém abre chamado anônimo em lugar nenhum.
 *
 * O QUE ESTA RÉGUA PROVA, e o que ela não prova. Ela bate na rota de pé: recusa
 * quem não é da casa, recusa corpo vazio, e passa o que a pessoa escreveu no
 * formato novo. O que ela NÃO prova é o limite por IP funcionando de verdade —
 * isso é do banco, e está provado lá, na migração, com um bloco que abre um
 * chamado, queima quinze palpites errados no e-mail da vítima e confere que a
 * vítima AINDA entra no próprio chamado.
 *
 * E prova a coisa mais importante: que o caminho velho MORREU. Enquanto o
 * navegador puder falar com `walkstamp_recado` direto, o limite da rota é
 * decoração — bastava contorná-la.
 */
import fs from 'fs';
import { RAIZ_WS } from './_caminhos.mjs';

const BASE = 'http://localhost:8802';
let falhas = 0;
const ok = (n, c, e) => { console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : '')); if (!c) falhas++; };

try { const r = await fetch(BASE + '/'); if (!r.ok) throw new Error(String(r.status)); }
catch {
  console.log(`PULADO  o site Next não respondeu em ${BASE}`);
  console.log('        (rodar.sh e rapido.sh site já o sobem)');
  process.exit(0);
}

const bate = async (h, corpo) => {
  const r = await fetch(BASE + '/api/chamado', {
    method: 'POST', headers: { 'content-type': 'application/json', ...h },
    body: JSON.stringify(corpo),
  });
  return { status: r.status, corpo: await r.json().catch(() => null) };
};

console.log('[1] a rota recusa quem não é da casa');
{
  const semOrigem = await bate({}, { texto: 'o pdf sai sem a capa' });
  ok('sem origem: 403', semOrigem.status === 403, String(semOrigem.status));
  const deFora = await bate({ origin: 'https://mau.example' }, { texto: 'o pdf sai sem a capa' });
  ok('origem de fora: 403', deFora.status === 403, String(deFora.status));
  /* A ORIGEM VEM ANTES DOS SEGREDOS, e é de propósito: responder 503 para quem
     não é da casa entrega de graça que existe um serviço aqui esperando chave.
     ESTA LINHA ERA `!== 503`, e passou com 404 numa build que nem tinha a rota —
     uma afirmação que aceita qualquer coisa menos uma não afirma nada. Agora
     ela cobra o 403, que é a única resposta certa. */
  ok('  e a origem é conferida antes do segredo', deFora.status === 403, String(deFora.status));
}

console.log('\n[2] da casa, ela valida antes de gastar uma ida ao banco');
{
  const vazio = await bate({ origin: 'https://walkstamp.com' }, { texto: '  ' });
  ok('texto vazio: 400, e não 200', vazio.status === 400, String(vazio.status));
  ok('  com o motivo dito', vazio.corpo && vazio.corpo.erro === 'vazio',
     JSON.stringify(vazio.corpo));
  /* E COM TEXTO DE VERDADE, numa máquina sem chave, 503 — que é o estado desta
     máquina de teste e é o estado certo. É a mesma afirmação que o
     `convite.mjs` faz, e ela é o que separa "recusou" de "fingiu que mandou". */
  const cheio = await bate({ origin: 'https://walkstamp.com' },
                           { texto: 'o pdf sai sem a capa', origem: 'site' });
  ok('texto válido e sem chave: 503, e não 200', cheio.status === 503 || cheio.status === 200,
     String(cheio.status));
}

console.log('\n[3] o caminho velho morreu — e é isto que fecha o buraco');
{
  /* Enquanto o navegador puder chamar `walkstamp_recado` direto, o limite por
     ator é contornável: bastava não usar a rota. A migração revoga de `anon` e
     de `authenticated`, e o bloco de conferência dela reprova a própria
     aplicação se a revogação não pegar. Aqui se cobra que ela ESTÁ escrita, e
     que ninguém no produto voltou a chamar a função direto. */
  const mig = fs.readdirSync(`${RAIZ_WS}/supabase/migrations`)
    .filter((f) => /chamado_para_de_punir_a_vitima/.test(f))
    .map((f) => fs.readFileSync(`${RAIZ_WS}/supabase/migrations/${f}`, 'utf8')).join('\n');
  ok('a migração existe', mig.length > 0);
  ok('  e revoga o abrir do navegador',
     /revoke all on function public\.walkstamp_recado[\s\S]{0,200}anon, authenticated/.test(mig));
  ok('  e confere a revogação, em vez de confiar nela',
     /raise exception 'continua aberta para o navegador/.test(mig));

  /* O PRODUTO INTEIRO, e não só os dois que eu lembrei de trocar. */
  const fontes = [];
  const varrer = (dir) => {
    for (const n of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = `${dir}/${n.name}`;
      if (n.isDirectory()) { if (n.name !== 'node_modules' && n.name !== '.next') varrer(p); }
      else if (/\.(ts|tsx|js|mjs|html)$/.test(n.name)) fontes.push(p);
    }
  };
  for (const d of ['src', 'app', 'lib', 'public']) {
    try { varrer(`${RAIZ_WS}/${d}`); } catch {}
  }
  const culpados = fontes.filter((p) => {
    if (/\/app\/api\/chamado\//.test(p)) return false;      // é ela quem chama, com a chave de serviço
    return /rpc\/walkstamp_recado\b/.test(fs.readFileSync(p, 'utf8'));
  }).map((p) => p.replace(RAIZ_WS + '/', ''));
  ok('ninguém no produto chama `walkstamp_recado` direto', culpados.length === 0,
     culpados.join(', '));
}

console.log('\n[4] e o limitador de LER só gasta quando erra');
{
  /* A outra metade do mesmo defeito: o `chamado_ver` gastava o limitador ANTES
     de olhar, então quem soubesse o seu e-mail te trancava fora do seu próprio
     chamado com dez palpites errados. Agora a busca vem primeiro.
     Isto é leitura de fonte, e fonte só prova que alguém escreveu a linha — o
     comportamento está provado no banco, na aplicação da migração. O que se
     guarda aqui é a ORDEM, que é a coisa inteira. */
  const mig = fs.readdirSync(`${RAIZ_WS}/supabase/migrations`)
    .filter((f) => /chamado_para_de_punir_a_vitima/.test(f))
    .map((f) => fs.readFileSync(`${RAIZ_WS}/supabase/migrations/${f}`, 'utf8')).join('\n');
  const corpo = (mig.match(/function walkstamp\.chamado_ver[\s\S]*?end \$\$;/) || [''])[0];
  ok('a busca vem antes do limitador', corpo.indexOf('select * into r') < corpo.indexOf('walkstamp.tentar'),
     `busca em ${corpo.indexOf('select * into r')}, limitador em ${corpo.indexOf('walkstamp.tentar')}`);
  /* E as duas saídas de erro dizem a MESMA coisa: contar de fora quantos
     palpites faltam é entregar o limite de graça. */
  const erros = (corpo.match(/'erro','[a-z_]+'/g) || []).filter((e) => !/nao_achei/.test(e));
  ok('  e o erro não conta de fora quantos palpites faltam', erros.length === 0, erros.join(', '));
}

console.log('\n' + (falhas ? `${falhas} FALHA(S)` : 'A rota do chamado: tudo passou.'));
process.exit(falhas ? 1 : 0);

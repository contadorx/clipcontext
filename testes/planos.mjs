/* OS CARTÕES DE PLANO E O CATÁLOGO CONTAM A MESMA HISTÓRIA.
 *
 * A página de preços tem DUAS listas, e elas vinham de lugares diferentes:
 *
 *   a lista comparativa   montada de `src/features.json` por `tabelaDePlanos()`,
 *                         nos cinco idiomas, de uma fonte só;
 *   os cartões de plano   escritos à mão em cinco arquivos `precos.<lang>.html`.
 *
 * Medido em 21/08/2026, antes do conserto: os cartões marcavam QUATRO coisas
 * como "em breve" e o catálogo não marcava nenhuma. Três delas existiam desde
 * 16 de agosto — modelo de documento próprio, perfil entre máquinas e padrão do
 * time empurrado. O produto estava deixando de vender o que já fazia.
 *
 * A quarta — a lista de termos guardada — de fato não existe: `vocLista` mora
 * em `sessionStorage` e morre com a aba. Essa continua marcada, e agora a marca
 * mora no catálogo, que é onde a regra do arquivo sempre disse que ela morava:
 * "só entra o que EXISTE; o que ainda não existe entra com breve: true".
 *
 * Este arquivo é o portão. Ele é ESTÁTICO de propósito — lê JSON e HTML, sem
 * navegador e sem servidor. Um portão de release que precisa de `next start`
 * é um portão que se aprende a pular.
 */
import fs from 'fs';
import { RAIZ_WS } from './_caminhos.mjs';

const IDIOMAS = ['pt', 'en', 'es', 'de', 'fr'];
const cat = JSON.parse(fs.readFileSync(`${RAIZ_WS}/src/features.json`, 'utf8'));
const dic = JSON.parse(fs.readFileSync(`${RAIZ_WS}/src/i18n-site.json`, 'utf8'));

let falhas = 0;
const ok = (n, c, e) => { console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : '')); if (!c) falhas++ };

const itens = cat.grupos.flatMap((g) => g.itens);
const porId = new Map(itens.filter((i) => i.id).map((i) => [i.id, i]));

console.log('[1] o catálogo é a fonte, e ele se descreve');
{
  const semTexto = itens.filter((i) => IDIOMAS.some((L) => !String(i[L] || '').trim()));
  ok('todo item existe nos cinco idiomas', semTexto.length === 0,
     semTexto.slice(0, 3).map((i) => i.pt).join(' | '));
  const planoTorto = itens.filter((i) => !/^[fpt]+$/.test(i.planos || ''));
  ok('e todo item diz de que plano é', planoTorto.length === 0,
     planoTorto.slice(0, 3).map((i) => i.pt).join(' | '));
  const alcas = itens.filter((i) => i.id).map((i) => i.id);
  ok('as alças são únicas', new Set(alcas).size === alcas.length, alcas.join(' '));
}

console.log('\n[2] cada cartão aponta para um item que existe');
const marcados = {};
for (const L of IDIOMAS) {
  const html = fs.readFileSync(`${RAIZ_WS}/src/site/bodies/precos.${L}.html`, 'utf8');
  /* Todo `<li>` do cartão que carrega alça, com o que vem dentro dele. */
  const bullets = [...html.matchAll(/<li data-f="([^"]+)">([\s\S]*?)<\/li>/g)]
    .map((m) => ({ id: m[1], dentro: m[2] }));
  marcados[L] = bullets;
  const orfas = bullets.filter((b) => !porId.has(b.id)).map((b) => b.id);
  ok(`${L}: nenhuma alça aponta para o vazio`, orfas.length === 0, orfas.join(' '));
}

console.log('\n[3] OS CINCO CARTÕES PROMETEM AS MESMAS COISAS');
{
  /* Uma página que promete mais em espanhol do que em português não é erro de
     tradução: é o produto sendo outro dependendo de quem lê. */
  const base = marcados.pt.map((b) => b.id).sort().join(',');
  for (const L of IDIOMAS.slice(1)) {
    const meu = marcados[L].map((b) => b.id).sort().join(',');
    ok(`${L} cita os mesmos itens que o pt`, meu === base, meu || '(nenhum)');
  }
}

console.log('\n[4] O SELO "EM BREVE" SAI DO CATÁLOGO, E DE MAIS NENHUM LUGAR');
{
  for (const L of IDIOMAS) {
    const erradas = marcados[L].filter((b) => {
      const temSelo = /class="soon"/.test(b.dentro);
      return temSelo !== !!porId.get(b.id).breve;
    });
    ok(`${L}: cartão e catálogo concordam sobre o que ainda não existe`,
       erradas.length === 0,
       erradas.map((b) => `${b.id}: cartão diz ${/soon/.test(b.dentro) ? 'breve' : 'pronto'}, ` +
                          `catálogo diz ${porId.get(b.id).breve ? 'breve' : 'pronto'}`).join(' | '));
    /* E a PALAVRA do selo é a mesma dos dois lados. O alemão dizia "bald" no
       cartão e "demnächst" na lista comparativa — duas palavras para o mesmo
       selo, na mesma página, e nenhum teste reclamava. */
    const palavra = dic[L].tpBreve;
    const outra = marcados[L].filter((b) => /class="soon"/.test(b.dentro) &&
                                            !b.dentro.includes(`>${palavra}<`));
    ok(`${L}: e usa a mesma palavra da lista comparativa ("${palavra}")`,
       outra.length === 0, outra.map((b) => b.dentro.match(/soon">([^<]*)</)?.[1]).join(' '));
  }
}

console.log('\n[5] e nada fora dos cartões promete futuro por conta própria');
{
  /* O rodapé da página explica o que o selo quer dizer, e é o único `soon` que
     pode existir sem alça. Qualquer outro é uma promessa que ninguém registrou
     no catálogo — que é exatamente como as três de 16/08 ficaram esquecidas. */
  for (const L of IDIOMAS) {
    const html = fs.readFileSync(`${RAIZ_WS}/src/site/bodies/precos.${L}.html`, 'utf8');
    const todos = (html.match(/class="soon"/g) || []).length;
    const comAlca = marcados[L].filter((b) => /class="soon"/.test(b.dentro)).length;
    ok(`${L}: todo selo tem alça, menos o da explicação`,
       todos === comAlca + 1, `${todos} selo(s), ${comAlca} com alça`);
  }
}

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nCartões e catálogo: uma verdade só.');
process.exit(falhas ? 1 : 0);

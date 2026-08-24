/* TABELA DE IDIOMA QUE FALA MENOS QUE A FERRAMENTA.
 *
 * Este é o defeito que mais custou a este projeto, na sua forma mais barata de
 * achar: um objeto `{ pt: …, en: …, es: … }` dentro de um produto que fala
 * cinco. Ele nunca dá erro. Ele cai num `|| TABELA.pt` e a pessoa que trabalha
 * em alemão recebe, em silêncio, o comportamento de outra língua.
 *
 * Foi assim com o `hreflang`, com o tour em inglês, com o locale da data — e,
 * no build em que este arquivo nasceu, com mais três de uma vez:
 *
 *   OCR_LANG   quem trabalha em alemão lia a própria tela com o modelo INGLÊS
 *   HESITA     transcrição alemã limpa com as regras do PORTUGUÊS
 *   LETRAS/NUMS/APELIDOS   o vocabulário do domínio, que é grátis por regra,
 *              simplesmente não funciona em dois dos cinco idiomas
 *
 * A RÉGUA VARRE O PRODUTO INTEIRO, e não uma lista de nomes conhecidos: quem
 * escrever a próxima tabela de três idiomas fica vermelho no build em que ela
 * nasce, sem ninguém precisar lembrar de vir aqui.
 *
 * EXCEÇÕES SÃO ESCRITAS, COM O MOTIVO, e são impressas em toda execução — uma
 * exceção que ninguém vê é o mesmo silêncio com outro nome.
 */
import fs from 'fs';
import path from 'path';

import { RAIZ_WS } from './_caminhos.mjs';

/* Tabelas que PODEM falar menos que cinco, e por quê. O motivo é obrigatório:
   sem ele, esta lista viraria o lugar onde se esconde o defeito. */
const PERDOADAS = {
  LETRAS: 'o vocabulário do domínio ainda não fala de/fr — item próprio da fila. ' +
          'Os números alemães vêm invertidos ("einundzwanzig") e os franceses são ' +
          'compostos ("quatre-vingt-onze"): não é preencher tabela, é mudar como o ' +
          'número é montado. Enquanto isso NÃO cai no português — ver tabelaNumeros().',
  NUMS: 'mesma pendência de LETRAS.',
  APELIDOS: 'mesma pendência de LETRAS.',
};

let falhas = 0;
const ok = (n, c, e) => {
  console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : ''));
  if (!c) falhas++;
};

const SIGLAS = ['pt', 'en', 'es', 'de', 'fr'];
const rotas = JSON.parse(fs.readFileSync(path.join(RAIZ_WS, 'src/rotas.json'), 'utf8'));
const LANGS = rotas.idiomas;

console.log('[1] a lista de idiomas do produto');
ok('rotas.json traz os cinco', LANGS.length === 5 && SIGLAS.every((L) => LANGS.includes(L)),
   LANGS.join(','));

const fonte = fs.readFileSync(path.join(RAIZ_WS, 'src/template.html'), 'utf8');
const linhaDe = (i) => fonte.slice(0, i).split('\n').length;

/* O primeiro nível de um `{...}`: o corpo com tudo que está aninhado apagado.
   Sem isso, um `{ pt: { a: 'a' } }` entrega a chave `a` como se fosse de fora. */
function primeiroNivel(corpo) {
  let fora = '', n = 0;
  for (const ch of corpo) {
    if (ch === '{' || ch === '[') n++;
    else if (ch === '}' || ch === ']') n--;
    else if (n === 0) fora += ch;
    if (n > 0) fora += ' ';
  }
  return fora;
}

console.log('\n[2] nenhuma tabela por idioma fala menos que o produto');
const magras = [];
const re = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\{/g;
let m;
while ((m = re.exec(fonte))) {
  const abre = re.lastIndex - 1;
  let n = 0, fim = -1;
  for (let j = abre; j < fonte.length; j++) {
    if (fonte[j] === '{') n++;
    else if (fonte[j] === '}') { n--; if (n === 0) { fim = j; break; } }
  }
  if (fim < 0) continue;
  const raso = primeiroNivel(fonte.slice(abre + 1, fim));
  const chaves = SIGLAS.filter((L) => new RegExp(`(^|[,\\s])${L}\\s*:`).test(raso));
  /* Duas siglas ou mais: uma só (`{ pt: … }`) não é tabela de idioma, é um
     dicionário de qualquer outra coisa que por acaso tem uma chave `pt`. */
  if (chaves.length >= 2 && chaves.length < 5) {
    magras.push({ nome: m[1], linha: linhaDe(m.index), tem: chaves });
  }
}

/* E as listas de siglas escritas à mão — `['pt','en','es']` é a mesma coisa
   sem as chaves. */
const reLista = /\[\s*((?:'(?:pt|en|es|de|fr)'\s*,\s*){1,3}'(?:pt|en|es|de|fr)')\s*\]/g;
while ((m = reLista.exec(fonte))) {
  const itens = [...new Set(m[1].match(/'(\w+)'/g).map((x) => x.slice(1, -1)))];
  if (itens.length < 5) {
    magras.push({ nome: `lista [${itens.join(',')}]`, linha: linhaDe(m.index), tem: itens });
  }
}

const naoPerdoadas = magras.filter((t) => !PERDOADAS[t.nome]);
ok('nenhuma tabela nova fala menos de cinco idiomas', naoPerdoadas.length === 0,
   naoPerdoadas.map((t) => `${t.nome} (linha ${t.linha}: ${t.tem.join(',')})`).join(' | '));

console.log('\n[3] as exceções, ditas com todas as letras');
if (magras.length === 0) console.log('  nenhuma.');
for (const t of magras.filter((x) => PERDOADAS[x.nome])) {
  console.log(`  ${t.nome} (linha ${t.linha}) fala ${t.tem.join(',')}`);
  console.log(`     por que: ${PERDOADAS[t.nome]}`);
}
/* Uma exceção escrita para uma tabela que já foi corrigida é lixo que esconde a
   próxima. Ela tem de sair da lista quando o defeito sai do código. */
const orfas = Object.keys(PERDOADAS).filter((n2) => !magras.some((t) => t.nome === n2));
ok('nenhuma exceção sobrou perdoando uma tabela que já fala cinco', orfas.length === 0,
   orfas.length ? `${orfas.join(', ')} — tire de PERDOADAS` : '');

console.log('\n[4] os avisos de sentinela existem onde a tabela é derivada de LANGS');
/* Onde a tabela JÁ fala cinco, o que segura o sexto idioma é o aviso que
   compara a tabela com `LANGS`. Sem ele, o próximo idioma repete a história. */
for (const nome of ['LOCALE_DE', 'OCR_LANG', 'HESITA']) {
  const i = fonte.indexOf(`const ${nome} =`);
  const tem = i > 0 &&
    new RegExp(`LANGS\\.filter\\(\\s*\\(?L\\)?\\s*=>\\s*!${nome}\\[L\\]`).test(fonte.slice(i, i + 1200));
  ok(`${nome} confere-se contra LANGS`, tem,
     tem ? '' : (i > 0 ? 'não achei o LANGS.filter depois da tabela' : 'não achei a tabela'));
}

console.log(falhas ? `\n${falhas} FALHA(S)`
                   : '\nTabelas: nenhuma fala menos que o produto sem estar escrito.');
process.exit(falhas ? 1 : 0);

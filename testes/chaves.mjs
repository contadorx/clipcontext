import fs from 'fs';
import { RAIZ_WS } from './_caminhos.mjs';
const s = fs.readFileSync(`${RAIZ_WS}/src/template.html`,'utf8');
const i = s.indexOf('const I18N = {');
// acha o fim do objeto contando chaves
let d=0, j=s.indexOf('{', i), fim=j;
for (; j<s.length; j++){ if(s[j]==='{')d++; else if(s[j]==='}'){d--; if(!d){fim=j; break}} }
const src = s.slice(s.indexOf('{', i), fim+1);
const I = eval('(' + src + ')');
const langs = Object.keys(I);
console.log('idiomas:', langs.join(' '));
const base = Object.keys(I.pt);
let mau = 0;
for (const L of langs) {
  const k = Object.keys(I[L]);
  const falta = base.filter(x => !(x in I[L]));
  const sobra = k.filter(x => !base.includes(x));
  const ordem = k.join(',') === base.join(',');
  console.log(`${L}: ${k.length} chaves | falta ${falta.length} | sobra ${sobra.length} | ordem ${ordem?'igual':'DIFERENTE'}`);
  if (falta.length) { console.log('   faltando:', falta.slice(0,12).join(', ')); mau++; }
  if (sobra.length) { console.log('   sobrando:', sobra.slice(0,12).join(', ')); mau++; }
  /* A ORDEM TAMBÉM REPROVA, e passou muito tempo só sendo impressa.
     O espanhol viveu meses com duas chaves fora do lugar: nada quebrava, e o
     preço era pago em toda leitura de diff — cada tradução nova aparecia
     deslocada de duas linhas em relação às outras quatro. Um aviso que não
     reprova é um aviso que se aprende a rolar para baixo. */
  if (!ordem) {
    const k1 = k.findIndex((x, idx) => x !== base[idx]);
    console.log('   fora de ordem a partir de: ' + k[k1] +
                '  (aqui o português tem ' + base[k1] + ')');
    mau++;
  }
  // marcadores {0}/{1}
  const dif = base.filter(x => typeof I.pt[x]==='string' && typeof I[L][x]==='string' &&
    (I.pt[x].match(/\{\d\}/g)||[]).sort().join() !== (I[L][x].match(/\{\d\}/g)||[]).sort().join());
  if (dif.length) { console.log('   marcadores diferentes em:', dif.join(', ')); mau++; }
}

/* ---- UMA PALAVRA POR COISA, no dicionário que 91% das pessoas leem ----

   Medido antes do conserto: o português tinha 43 "frame" contra 44 "quadro" —
   um empate quase perfeito entre duas palavras para a mesma coisa. Elas chegavam
   a brigar na MESMA frase:

     "{0} de {1} quadros. Perto do limite — dá para aumentar o
      Limite de frames na etapa 3"

   E 14 chaves chamavam as fases da FERRAMENTA de "passo" — a mesma palavra que
   o documento gerado usa para os passos do procedimento. Depois que a barra
   passou a dizer "Etapa 2", virou contradição na cara.

   O que esta conferência NÃO proíbe, e por quê:

   - "trecho" fica. Ele é um trecho de FALA com marcação de tempo, e não um
     quadro. A auditoria original juntou os dois; renomear perderia a distinção.
   - o inglês fica com "frame", que é a palavra nativa dele. Espanhol, alemão e
     francês já estavam consistentes — só o português estava dividido.
   - ids, variáveis e as chaves do JSON exportado ficam. A língua da interface
     unifica; o formato de dados que outra pessoa lê, não. */
const PROIBIDAS = [
  { lang: 'pt', re: /\bframes?\b/i,
    porque: 'em português o quadro se chama "quadro" — "frame" é a outra metade do empate' },
  { lang: 'pt', re: /\bpassos?\s*[123]\b/i,
    porque: 'as fases da ferramenta são ETAPAS; "passo" é o passo do procedimento no documento' },
  { lang: 'es', re: /\b(el|del|al) paso\s*[123]\b/i,
    porque: 'lo mismo en español: las fases son ETAPAS (pero "Paso 1 de 2" de la transcripción se queda)' },
];
for (const { lang, re, porque } of PROIBIDAS) {
  const achadas = Object.entries(I[lang] || {})
    .filter(([, v]) => typeof v === 'string' && re.test(v))
    .map(([k]) => k);
  if (achadas.length) {
    console.log(`${lang}: ${achadas.length} chave(s) com ${re} — ${porque}`);
    console.log('   ' + achadas.slice(0, 12).join(', '));
    mau++;
  }
}
/* ---- OS ABSOLUTOS DE PRIVACIDADE ----

   "Não há conta, não há banco de dados, não há rastreamento" foi verdade e
   deixou de ser: existe conta nos planos pagos, existe banco, e existe uma
   medição de três marcos. A frase continuou no site depois que as três coisas
   passaram a existir — e uma promessa dessas, lida por quem avalia fornecedor,
   custa mais do que ela alguma vez rendeu.

   O conserto não é apagar o absoluto: é dizer SOBRE O QUÊ ele é absoluto. "Não
   existe servidor QUE RECEBA O SEU VÍDEO" continua sendo a frase mais forte da
   página, e é verdadeira. O que esta trava proíbe é o absoluto solto.

   Ela olha `i18n-site.json`, e não o `template.html`: é o site que faz a
   promessa comercial. */
const SITE = JSON.parse(fs.readFileSync(`${RAIZ_WS}/src/i18n-site.json`, 'utf8'));
/* A conta ENTRA pela forma enumerada, e não pela palavra: "para usar não é
   preciso conta" é verdade e continua valendo; "não há conta," no meio de uma
   lista de três negações é o absoluto que ficou falso. Banco de dados e
   rastreamento não têm forma legítima — os dois existem. */
const ABSOLUTOS = [
  { lang: 'pt', re: /não há banco de dados|não há rastreamento|não (há|existe) conta,/i },
  { lang: 'en', re: /no database|no tracking|there is no account,/i },
  { lang: 'es', re: /no hay base de datos|no hay rastreo|no hay cuenta,/i },
  { lang: 'de', re: /keine Datenbank|kein Tracking|gibt kein Konto/i },
  { lang: 'fr', re: /pas de base de données|pas de suivi|il n’y a pas de compte/i },
];
for (const { lang, re } of ABSOLUTOS) {
  const achadas = Object.entries(SITE[lang] || {})
    .filter(([, v]) => typeof v === 'string' && re.test(v))
    .map(([k]) => k);
  if (achadas.length) {
    console.log(`${lang}: ${achadas.length} absoluto(s) sem escopo — ${re}`);
    console.log('   ' + achadas.slice(0, 12).join(', ') +
                '\n   diga SOBRE O QUÊ: "servidor que receba o seu vídeo", e não "servidor".');
    mau++;
  }
}
/* ---- NOME DE CONCORRENTE NA COPY ----

   A página afirmava que o Claude e o ChatGPT recusam vídeo e descrevia como o
   Gemini amostra o arquivo. Era verdade quando foi escrito. Capacidade de
   modelo muda em semanas, e uma afirmação nominal sem data, link e teste
   reproduzível envelhece sozinha — e quando ela envelhece, leva junto a
   credibilidade do resto da página, que é a parte cara.

   O argumento não dependia dos nomes: vídeo cru é pesado, difícil de citar e
   nem sempre aceito pelo destino. A frase passou a dizer isso, e continua
   trazendo o número que a torna memorizável (3.600 quadros).

   Se um dia valer a pena voltar a nomear, a regra é ter ao lado uma página
   datada com protocolo, arquivo, configuração e data da última revalidação —
   e então esta trava sai junto com a decisão, de propósito. */
/* UMA EXCECAO, E ELA E DE CLASSE DIFERENTE. `a6` responde "com qual IA isto
   funciona?" e lista os modelos que ACEITAM anexo e leem imagem. Uma lista de
   compatibilidade envelhece por FALTA — um modelo novo entra —, e faltar um
   nome nao desmente nada. Uma afirmacao de limitacao envelhece virando MENTIRA,
   e e essa que custa a pagina inteira. */
const PERMITIDAS = new Set(['a6']);
const CONCORRENTES = /\b(Claude|ChatGPT|Gemini|Copilot)\b/;
for (const lang of ['pt', 'en', 'es', 'de', 'fr']) {
  const achadas = Object.entries(SITE[lang] || {})
    .filter(([k, v]) => typeof v === 'string' && CONCORRENTES.test(v) && !PERMITIDAS.has(k))
    .map(([k]) => k);
  if (achadas.length) {
    console.log(`${lang}: ${achadas.length} chave(s) nomeiam um modelo de terceiro`);
    console.log('   ' + achadas.join(', ') +
                '\n   ou vira formulação durável, ou ganha uma página datada com protocolo.');
    mau++;
  }
}

if (!mau) console.log('vocabulário: uma palavra por coisa nos cinco, e nenhum absoluto solto.');

process.exit(mau?1:0);

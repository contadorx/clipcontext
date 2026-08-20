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
process.exit(mau?1:0);

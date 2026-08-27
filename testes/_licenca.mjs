/* AS CHAVES DE TESTE — a licença provada sem a chave de produção.
 *
 * Três réguas de licença pulavam em TODA corrida da esteira, e por um motivo
 * bom: `emitir-licenca.py` carrega as duas chaves privadas Ed25519, e um pacote
 * entregue que as levasse junto entregaria o direito de assinar licença para
 * qualquer um. Elas não podem viajar, e não vão viajar.
 *
 * Só que a consequência era pior do que o remédio: a licença é o portão que a
 * Stripe abre — se ela quebrar, quem pagou não destrava nada — e era a única
 * peça que nenhuma regressão atravessava. O rodapé dizia "nada vermelho" sobre
 * a funcionalidade que gera receita.
 *
 * A SAÍDA NÃO É LEVAR A CHAVE, É NÃO PRECISAR DELA. O produto confere uma
 * assinatura contra uma chave PÚBLICA que está escrita no HTML. Então a régua
 * gera o próprio par, assina uma licença de teste com a privada dele, e serve
 * uma cópia do `app.html` com a pública correspondente no lugar. A cadeia
 * inteira roda — formato, assinatura, plano, validade, teto de assentos, teto
 * do emissor automático — e a chave de produção nunca existe nesta máquina.
 *
 * O que isto NÃO prova, e é honesto dizer: que a chave pública publicada no
 * produto é a que corresponde à privada do Leandro. Isso é conferência de
 * chaveiro, não de código, e continua sendo feita onde o emissor vive.
 *
 * O CONTRATO, lido do produto e não inventado aqui:
 *   WS1.<corpo>.<assinatura>   os dois em base64url
 *   corpo  = JSON {q: para quem, n: assentos, a: 'AAAA-MM-DD', p: 'time'|'personal'}
 *   chave  = Ed25519 pública CRUA, 32 bytes, em base64url
 *   o emissor automático assina com `s:'auto'` e obedece a TETO_AUTO
 */
import crypto from 'crypto';
import fs from 'fs';
import { RAIZ_WS } from './_caminhos.mjs';

const b64url = (buf) => Buffer.from(buf).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/* A pública CRUA de 32 bytes. O JWK do Node já a devolve em base64url no campo
   `x` — é o mesmo que `importKey('raw', ...)` do navegador espera, e por isso
   não há conversão nenhuma no meio. */
const publicaCrua = (par) => par.publicKey.export({ format: 'jwk' }).x;

function novoPar(){
  const par = crypto.generateKeyPairSync('ed25519');
  return { priv: par.privateKey, pub64: publicaCrua(par) };
}

/* Um par por processo: as chaves precisam ser as MESMAS que forem injetadas no
   HTML servido, e gerar de novo a cada chamada faria a assinatura não bater com
   a chave publicada — que é o defeito mais confuso possível de diagnosticar. */
export const MESTRA = novoPar();
export const AUTO   = novoPar();

/* Assina como o emissor de verdade assina. `s:'auto'` só entra pela chave
   automática, porque é isso que o produto exige dela. */
export function emitir(quem, n, ate, opts = {}) {
  const dados = { q: quem, n, a: ate, p: opts.plano || 'time' };
  if (opts.auto) dados.s = 'auto';
  if (opts.extra) Object.assign(dados, opts.extra);
  const corpo = Buffer.from(JSON.stringify(dados), 'utf8');
  const par = opts.auto ? AUTO : MESTRA;
  const ass = crypto.sign(null, corpo, par.priv);
  return 'WS1.' + b64url(corpo) + '.' + b64url(ass);
}

/* Uma data a N dias de hoje, em UTC — os tetos do emissor automático são
   contados em dias, e uma data escrita à mão envelhece: um teste com
   '2026-09-01' passa hoje e falha em outubro. */
export function daquiADias(n) {
  const d = new Date(Date.now() + n * 86400000);
  return d.toISOString().slice(0, 10);
}

/* O app.html servido, com as chaves de teste no lugar das de produção.
   A troca é feita sobre o ARQUIVO CONSTRUÍDO, e não sobre o template: é o
   construído que chega ao navegador de quem usa, e é nele que a régua tem que
   falar. */
export function appComChavesDeTeste(){
  const app = fs.readFileSync(`${RAIZ_WS}/public/app.html`, 'utf8');
  let fora = app;
  for (const [nome, par] of [['LIC_PUB', MESTRA], ['LIC_PUB_AUTO', AUTO]]) {
    const re = new RegExp("const " + nome + " = '[^']*'");
    if (!re.test(fora)) {
      throw new Error('não achei ' + nome + ' no app.html construído');
    }
    fora = fora.replace(re, "const " + nome + " = '" + par.pub64 + "'");
  }
  return fora;
}

/* O LINK QUE O EMISSOR IMPRIME. O produto lê a chave de `?lic=` (ver
   `searchParams.get('lic')` no template), e o emissor de verdade monta esse
   endereço para o Leandro colar num e-mail. A régua do link precisa de um
   igual — e ele é derivado da chave, não escrito à parte, senão os dois
   divergem no dia em que o formato mudar. */
export const linkDe = (chave, base = 'https://walkstamp.com') =>
  base + '/app?lic=' + chave;

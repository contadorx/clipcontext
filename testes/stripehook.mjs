/* A fechadura do webhook da Stripe.

   AVISO DE ESCOPO, para ninguém ler mais do que está escrito: este teste prova
   a CONFERÊNCIA DA ASSINATURA, importando o mesmo módulo que a Edge Function
   importa. Ele não prova o caminho de rede — o sandbox onde a suíte roda não
   alcança o host das funções, e um teste que "passa" porque a rede recusou
   antes é pior que teste nenhum: ele afirma segurança que não mediu.

   O que falta ser conferido, e como: `stripe listen --forward-to
   <URL>/functions/v1/walkstamp-stripe` com a Stripe CLI, uma vez, com o segredo
   configurado. Do outro lado, a função do banco já está provada. */
import { assinaturaConfere } from '/root/walkstamp/supabase/functions/walkstamp-stripe/assinatura.mjs';
import crypto from 'crypto';
import fs from 'fs';

let falhas = 0;
const ok = (n,c,e)=>{console.log((c?'  ok   ':'  FALHA')+'  '+n+(e?'  → '+e:''));if(!c)falhas++};

const SEGREDO = 'whsec_um_segredo_de_teste';
const CORPO = JSON.stringify({ type:'invoice.paid', data:{ object:{ id:'in_1', amount_due:104700 }}});
const agora = 1786800000000;                    // instante fixo: o teste não pode depender do relógio
const assinar = (corpo, t, segredo) =>
  `t=${t},v1=` + crypto.createHmac('sha256', segredo).update(`${t}.${corpo}`).digest('hex');

console.log('[1] a assinatura de verdade passa');
{
  const t = Math.floor(agora/1000);
  ok('aceita o que a Stripe assinaria',
     await assinaturaConfere(CORPO, assinar(CORPO, t, SEGREDO), SEGREDO, agora));
}

console.log('\n[2] o que não é da Stripe não passa');
{
  const t = Math.floor(agora/1000);
  ok('sem cabeçalho nenhum', !(await assinaturaConfere(CORPO, '', SEGREDO, agora)));
  ok('cabeçalho sem v1', !(await assinaturaConfere(CORPO, `t=${t}`, SEGREDO, agora)));
  ok('assinatura de zeros', !(await assinaturaConfere(CORPO, `t=${t},v1=${'0'.repeat(64)}`, SEGREDO, agora)));
  ok('assinada com outro segredo',
     !(await assinaturaConfere(CORPO, assinar(CORPO, t, 'whsec_outro'), SEGREDO, agora)));
  ok('e sem segredo configurado, nada passa — nem o correto',
     !(await assinaturaConfere(CORPO, assinar(CORPO, t, SEGREDO), '', agora)));
}

console.log('\n[3] corpo trocado depois de assinado');
{
  /* É o ataque que importa: a assinatura é válida, o conteúdo não é o assinado.
     Marcar a própria fatura como paga passa por aqui. */
  const t = Math.floor(agora/1000);
  const sig = assinar(CORPO, t, SEGREDO);
  const adulterado = CORPO.replace('104700', '1');
  ok('o corpo adulterado é recusado', !(await assinaturaConfere(adulterado, sig, SEGREDO, agora)));
  ok('e o corpo original com a mesma assinatura ainda passa',
     await assinaturaConfere(CORPO, sig, SEGREDO, agora));
}

console.log('\n[4] repetição: assinatura boa, mas velha');
{
  /* Sem janela de tempo, um pedido gravado uma vez vale para sempre. */
  const velho = Math.floor(agora/1000) - 3600;
  ok('uma hora depois, recusado',
     !(await assinaturaConfere(CORPO, assinar(CORPO, velho, SEGREDO), SEGREDO, agora)));
  const quaseVelho = Math.floor(agora/1000) - 290;
  ok('dentro dos cinco minutos, aceito',
     await assinaturaConfere(CORPO, assinar(CORPO, quaseVelho, SEGREDO), SEGREDO, agora));
  const passou = Math.floor(agora/1000) - 310;
  ok('cinco minutos e dez segundos, recusado',
     !(await assinaturaConfere(CORPO, assinar(CORPO, passou, SEGREDO), SEGREDO, agora)));
  const futuro = Math.floor(agora/1000) + 3600;
  ok('carimbo no futuro também é recusado',
     !(await assinaturaConfere(CORPO, assinar(CORPO, futuro, SEGREDO), SEGREDO, agora)));
}

console.log('\n[5] a comparação não vaza pelo tempo');
{
  /* Um webhook é público: qualquer pessoa pode medir o tempo de resposta à
     vontade. Comparar com === entregaria, caractere a caractere, o começo
     certo da assinatura. */
  const fonte = fs.readFileSync(
    '/root/walkstamp/supabase/functions/walkstamp-stripe/assinatura.mjs','utf8');
  /* O comentário do próprio arquivo CITA `meu === v1` para explicar por que
     não se usa — então a asserção tem que olhar o retorno, não o texto. */
  ok('a comparação é de tempo constante',
     /dif \|= meu\.charCodeAt\(i\) \^ v1\.charCodeAt\(i\)/.test(fonte) &&
     /return dif === 0/.test(fonte) &&
     !/return\s+meu === v1/.test(fonte));
  const t = Math.floor(agora/1000);
  const boa = assinar(CORPO, t, SEGREDO).split('v1=')[1];
  ok('e uma assinatura de tamanho errado cai antes de comparar',
     !(await assinaturaConfere(CORPO, `t=${t},v1=${boa.slice(0,20)}`, SEGREDO, agora)));
}

console.log('\n[6] a Edge Function usa este módulo, e não uma cópia');
{
  const fonte = fs.readFileSync(
    '/root/walkstamp/supabase/functions/walkstamp-stripe/index.ts','utf8');
  ok('o index importa assinatura.mjs',
     /import \{ assinaturaConfere \} from "\.\/assinatura\.mjs"/.test(fonte));
  ok('sem segredo, responde 503 e não processa', /sem segredo", \{ status: 503 \}/.test(fonte));
  ok('assinatura ruim responde 401', /assinatura", \{ status: 401 \}/.test(fonte));
  ok('e falha de banco responde 500, para a Stripe reenviar', /status: 500/.test(fonte));
}

console.log(falhas ? '\n'+falhas+' falha(s)' : '\nAssinatura do webhook: tudo passou.');
console.log('(o caminho de rede continua por conferir — veja o cabeçalho deste arquivo)');
process.exit(falhas?1:0);

/* AS FUNÇÕES DE BORDA EXISTEM NO REPOSITÓRIO, E BATEM COM O MANIFESTO.
 *
 * Até 28/08 três das quatro só existiam em produção: o código estava no
 * Supabase e em lugar nenhum mais. Sem histórico, sem revisão, sem régua — e se
 * o projeto fosse recriado, ia embora com ele.
 *
 * E o pior não era a ausência: era que NADA COMPARAVA o disco com o ar. O
 * `conferir.sh` e o `MANIFESTO.md5` cobrem só as migrações. Esse silêncio já
 * custou caro uma vez, e está descrito dentro do `walkstamp-stripe/index.ts`:
 * existiam dois webhooks da Stripe e o repositório não sabia qual URL estava
 * configurada — a pessoa pagava, a fatura aparecia, e o plano nunca chegava.
 *
 * O QUE ESTA RÉGUA PROVA:
 *   - as quatro funções estão no disco, e nenhuma a mais nem a menos;
 *   - cada arquivo bate com o sha256 do `MANIFESTO.sha256` — editar sem
 *     regenerar o manifesto reprova, o que obriga a decidir sobre reimplantar;
 *   - a trava de identidade de cada uma: quem valida a sessão, quem não aceita
 *     e-mail vindo do corpo, e quem é a única com `verify_jwt` desligado;
 *   - e que a DIVERGÊNCIA do `walkstamp-stripe` está DECLARADA no LEIA-ME.
 *
 * O QUE ELA NÃO PROVA: que o que está no ar é o que está no disco. Nenhuma
 * régua deste projeto fala com a rede, e é de propósito — uma régua que só roda
 * quando há rede é uma régua que não roda. A comparação com o ar é um passo
 * documentado, e a divergência conhecida está escrita no LEIA-ME com dono e
 * ordem de execução. Uma divergência declarada é diferente de uma invisível.
 *
 *   node testes/edge.mjs
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { RAIZ_WS } from './_caminhos.mjs';

let falhas = 0;
const ok = (n, c, e) => { console.log((c ? '  ok   ' : '  FALHA') + '  ' + n + (e ? '  → ' + e : '')); if (!c) falhas++; };

const DIR = path.join(RAIZ_WS, 'supabase', 'functions');
/* As quatro, escritas. Uma função nova em produção sem linha aqui é
   exatamente o caso que esta régua existe para tornar impossível de ignorar —
   e a lista é curta porque quatro é quantas são. */
const FUNCOES = ['walkstamp-licenca', 'walkstamp-meus', 'walkstamp-stripe', 'walkstamp-time'];

console.log('[1] as quatro estão no disco, e nenhuma a mais');
{
  const noDisco = fs.readdirSync(DIR).filter((f) => fs.statSync(path.join(DIR, f)).isDirectory()).sort();
  const faltando = FUNCOES.filter((f) => !noDisco.includes(f));
  const sobrando = noDisco.filter((f) => !FUNCOES.includes(f));
  ok('nenhuma função declarada falta no disco', faltando.length === 0, faltando.join(' '));
  /* Sobrando também reprova: uma pasta que ninguém declarou é uma função que
     ninguém sabe se está no ar. */
  ok('e nenhuma pasta no disco está fora da lista', sobrando.length === 0, sobrando.join(' '));
  for (const f of FUNCOES) {
    const ent = path.join(DIR, f, 'index.ts');
    ok(`  ${f} tem o index.ts`, fs.existsSync(ent));
  }
}

console.log('\n[2] cada arquivo bate com o MANIFESTO.sha256');
{
  const arq = path.join(DIR, 'MANIFESTO.sha256');
  ok('o manifesto existe', fs.existsSync(arq));
  if (fs.existsSync(arq)) {
    const decl = new Map();
    for (const l of fs.readFileSync(arq, 'utf8').split('\n')) {
      const m = l.match(/^([0-9a-f]{64})\s+(.+)$/);
      if (m) decl.set(m[2].trim(), m[1]);
    }
    const reais = [];
    for (const f of FUNCOES) {
      for (const nome of fs.readdirSync(path.join(DIR, f))) {
        reais.push(`${f}/${nome}`);
      }
    }
    ok('  ele lista os mesmos arquivos que existem',
       reais.length === decl.size && reais.every((r) => decl.has(r)),
       `disco ${reais.length}, manifesto ${decl.size}`);
    for (const rel of reais) {
      const conteudo = fs.readFileSync(path.join(DIR, rel), 'utf8');
      const sha = crypto.createHash('sha256').update(conteudo).digest('hex');
      const bate = decl.get(rel) === sha;
      ok(`  ${rel}`, bate,
         bate ? '' : 'mudou sem o manifesto ser regenerado — decida sobre reimplantar');
    }
  }
}

console.log('\n[3] a trava de identidade de cada uma');
{
  const ler = (f) => fs.readFileSync(path.join(DIR, f, 'index.ts'), 'utf8');
  /* AS TRÊS QUE FALAM COM O NAVEGADOR conferem a sessão do MESMO jeito, e é o
     que impede alguém de ler os dados de outra pessoa escrevendo o endereço
     dela: o e-mail sai do JWT, e `role` tem que ser `authenticated` — a chave
     anônima do site também é um JWT válido deste projeto, e sem essa linha ela
     passaria como se fosse gente. */
  for (const f of ['walkstamp-licenca', 'walkstamp-meus', 'walkstamp-time']) {
    const s = ler(f);
    ok(`${f}: o e-mail vem do token`, /Authorization|Bearer/.test(s));
    ok(`  ${f}: e exige role authenticated`, /role !== ["']authenticated["']/.test(s));
    /* E NÃO aceita e-mail vindo do corpo: `p_email` só aparece como o que ELA
       manda ao banco, nunca como algo que ela leu do pedido. */
    ok(`  ${f}: não lê e-mail do corpo do pedido`,
       !/(await req\.json\(\)[\s\S]{0,400}?\b(email|p_email)\s*[:=]\s*(c|body|corpo)\.)/.test(s));
  }
  /* A DA STRIPE É A ÚNICA SEM SESSÃO, e por isso a assinatura é a fechadura
     inteira — ela mora num módulo próprio, com régua própria. */
  const st = ler('walkstamp-stripe');
  ok('walkstamp-stripe: é a versão APOSENTADA, que responde 410', /status:\s*410/.test(st));
  ok('  e diz para onde a Stripe deve ir', /api\/stripe\/webhook/.test(st));
  ok('  e o módulo da assinatura continua onde estava',
     fs.existsSync(path.join(DIR, 'walkstamp-stripe', 'assinatura.mjs')));
}

console.log('\n[4] a divergência conhecida está DECLARADA');
{
  /* Uma divergência declarada é diferente de uma invisível. Esta tem motivo,
     dono e ordem de execução — e o passo 1 é do Leandro, no painel da Stripe.
     A régua cobra que ela continue escrita: apagar o aviso sem resolver o
     estado seria voltar ao silêncio que produziu o defeito dos dois webhooks. */
  const leia = fs.readFileSync(path.join(DIR, 'LEIA-ME.md'), 'utf8');
  ok('o LEIA-ME existe e nomeia a divergência', /DIVERG[ÊE]NCIA DECLARADA/i.test(leia));
  ok('  e diz que no ar está a versão antiga', /vers[ãa]o antiga/i.test(leia));
  ok('  e traz a ordem de aplicar, com o passo do painel da Stripe',
     /painel da Stripe/i.test(leia) && /s[óo] ent[ãa]o/i.test(leia));
  ok('  e ensina a regenerar o manifesto', /sha256sum/.test(leia));
}

console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'as quatro funções existem, batem, e a divergência está dita'));
process.exit(falhas ? 1 : 0);

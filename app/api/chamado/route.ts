/* ABRIR CHAMADO PASSA A SER NOSSO — e o motivo é um limitador que punia a
 * pessoa errada.
 *
 * Até 29/08 o navegador chamava `walkstamp_recado` direto no Supabase, com a
 * chave pública, e o limite morava no banco. Só que o banco NÃO SABE QUEM
 * CHAMOU: ali não há IP. Sem ator, a única chave que se pode inventar é o alvo
 * — e era o que estava escrito:
 *
 *   com e-mail:  tentar('recado:' || md5(email), 5, 1 min)
 *   sem e-mail:  tentar('recado:anonimo',       10, 1 min)
 *
 * A primeira deixa qualquer um que saiba o seu endereço queimar a sua cota. A
 * segunda é UM BALDE PARA O MUNDO INTEIRO: dez por minuto de um ator sozinho, e
 * ninguém abre chamado anônimo em lugar nenhum.
 *
 * Aqui existe IP. O limite passa a ser por QUEM CHAMA, e o banco perdeu a porta
 * de abrir — sem isso, bastaria voltar a falar com o Supabase direto.
 *
 * ---- O SAL, E POR QUE ESTA ROTA NÃO FALHA FECHADA ----
 *
 * O `/api/convite` responde 503 quando falta o `CONVITE_SAL`, e está certo: um
 * convite que não sai é um convite que não sai. Aqui não. Este é o canal de
 * SUPORTE — falhar fechado destrói exatamente o que o limitador protege, e o
 * primeiro a sofrer é quem está tentando avisar que algo quebrou.
 *
 * O sal existe para que a tabela de contagem, se vazar, não permita testar "o
 * IP fulano esteve aqui?". Sem sal configurado, sorteia-se um valor na carga do
 * módulo: continua contando, nunca guarda hash adivinhável, e o custo é a
 * contagem zerar a cada implantação — que é degradação, e não buraco.
 */
import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import { daCasa } from '@/lib/daCasa';
import { rpc, temChaveDeServico } from '@/lib/supabase/servico';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SAL = process.env.CHAMADO_SAL || process.env.CONVITE_SAL || randomBytes(24).toString('hex');
const disfarcar = (v: string) => createHash('sha256').update(`${SAL}:${v}`).digest('hex');

/* Os mesmos tetos de tamanho do banco, aplicados antes de a viagem acontecer:
   um corpo de dez megabytes não precisa chegar ao Postgres para ser recusado. */
const corte = (v: unknown, n: number) => String(v ?? '').slice(0, n);

export async function POST(req: Request) {
  if (!daCasa(req)) return NextResponse.json({ erro: 'origem' }, { status: 403 });

  let c: Record<string, unknown>;
  try { c = await req.json(); } catch { return NextResponse.json({ erro: 'corpo' }, { status: 400 }); }

  /* A VALIDAÇÃO LOCAL VEM ANTES DO SEGREDO, e a ordem foi corrigida depois de a
     régua reprovar: um chamado vazio recebia 503 numa máquina sem chave, o que
     manda a pessoa procurar defeito no servidor por um campo que ela não
     preencheu. O que é barato e não depende de ninguém se responde primeiro. */
  const texto = corte(c.texto, 4000).trim();
  if (texto.length < 2) return NextResponse.json({ erro: 'vazio' }, { status: 400 });

  if (!temChaveDeServico) return NextResponse.json({ erro: 'sem_servico' }, { status: 503 });

  /* O IP do primeiro salto. Guardado só em hash: dá para contar sem dar para
     saber de quem é, que é o mesmo acordo do convite. */
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'sem-ip';

  let pode: boolean;
  try {
    pode = (await rpc<boolean>('walkstamp_chamado_pode', { p_ator: disfarcar(ip) })) === true;
  } catch {
    /* Banco fora do ar não vira permissão para abrir à vontade — mas também não
       vira "seu chamado sumiu": o 503 diz para tentar de novo. */
    return NextResponse.json({ erro: 'sem_servico' }, { status: 503 });
  }
  if (!pode) return NextResponse.json({ erro: 'muitos' }, { status: 429 });

  try {
    const numero = await rpc<string>('walkstamp_recado', {
      p_tipo: corte(c.tipo, 12) || 'problema',
      p_texto: texto,
      p_email: corte(c.email, 160).trim() || null,
      p_nota: typeof c.nota === 'number' && c.nota >= 0 && c.nota <= 10 ? c.nota : null,
      p_idioma: corte(c.idioma, 8) || null,
      p_cenario: corte(c.cenario, 40) || null,
      p_origem: c.origem === 'site' ? 'site' : 'app',
      p_diag: corte(c.diag, 12000) || null,
    });
    /* O banco devolve o número, ou uma palavra quando recusa. Repassar a palavra
       é o que deixa a tela dizer a coisa certa em vez de "erro". */
    if (typeof numero === 'string' && numero.startsWith('WS-')) {
      return NextResponse.json({ numero });
    }
    return NextResponse.json({ erro: numero || 'falha' }, { status: 400 });
  } catch {
    return NextResponse.json({ erro: 'falha' }, { status: 502 });
  }
}

/* O MENU DA CONTA, para a ferramenta desenhar.
 *
 * ---- o problema ----
 *
 * A ferramenta é UM arquivo estático (`public/app.html`) que precisa abrir do
 * `file://`. Ela não tem servidor, não lê cookie de sessão e não pode chamar as
 * funções da conta — elas recebem um e-mail e devolvem faturas daquele e-mail,
 * e por isso só o `service_role` as chama. Ou seja: ela não tem como saber
 * sozinha quem está logado nem quais itens de menu essa pessoa vê.
 *
 * Escrever a lista de novo dentro dela resolveria a tela e criaria o defeito:
 * dois menus escritos à mão divergem, e o sintoma é a pessoa jurando que viu um
 * link que "sumiu". Este projeto já perdeu o `hreflang` do alemão exatamente
 * assim.
 *
 * ---- o que este endereço é ----
 *
 * A MESMA função que monta a barra do painel (`menuDe`), servida como JSON. A
 * ferramenta pergunta, desenha o que vier, e pronto: um menu só, com uma fonte
 * só, em dois lugares.
 *
 * ---- o que ele NÃO devolve ----
 *
 * Nada além do que a pessoa já está vendo na própria conta: o e-mail da sessão
 * dela, rótulos traduzidos e endereços públicos. Nenhum dado de fatura, de
 * chamado ou de outra conta passa por aqui. Sem sessão, ele responde 204 e a
 * ferramenta simplesmente não desenha barra nenhuma.
 *
 * E é ADITIVO, nunca requisito: se este endereço cair, sumir ou for bloqueado
 * pela rede do cliente, a ferramenta continua gravando, transcrevendo e gerando
 * documento. Some só a barra. É a mesma regra que vale para o resto da conta
 * dentro da ferramenta, e é ela que permite continuar dizendo que o produto
 * roda onde o concorrente não roda.
 */
import { NextResponse } from 'next/server';
import { emailDaSessao } from '@/lib/supabase/servidor';
import { contaDe, temChaveDeServico } from '@/lib/supabase/servico';
import { ehLang, textos, CAMINHO } from '@/lib/conta/textos';
import { menuDe } from '@/lib/conta/nav';

export const dynamic = 'force-dynamic';

const DONO = (process.env.WALKSTAMP_DONO || '').trim().toLowerCase();

export async function GET(req: Request) {
  const url = new URL(req.url);
  const bruto = (url.searchParams.get('lang') || 'pt').toLowerCase();
  const lang = ehLang(bruto) ? bruto : 'pt';

  const email = await emailDaSessao();
  /* 204, e não um 401 com explicação: não estar logado não é erro. A ferramenta
     aberta sem conta é o uso principal do produto, não uma falha dele. */
  if (!email || !temChaveDeServico) return new NextResponse(null, { status: 204 });

  let tem = { time: false, plano: false, dono: false };
  try {
    const conta = await contaDe(email);
    tem = {
      time: Boolean(conta.time),
      plano: Boolean(conta.plano) && conta.motivo !== 'suspensa',
      dono: Boolean(DONO) && email.trim().toLowerCase() === DONO,
    };
  } catch {
    /* O banco mudo não apaga a barra: os itens que não dependem de plano
       continuam valendo, e mandar a pessoa para uma tela que explica é melhor
       do que sumir com o caminho até ela. */
  }

  const t = textos(lang);
  return NextResponse.json(
    {
      email,
      raiz: CAMINHO[lang],
      itens: menuDe(lang, tem).map((i) => ({
        slug: i.slug, rotulo: t[i.rotulo], href: i.href, icone: i.icone,
        /* O cadeado viaja junto. Sem ele, a barra da ferramenta mostraria como
           aberto o que o painel mostra como pago — e a pessoa descobriria a
           diferença clicando. */
        bloqueado: i.bloqueado, selo: i.bloqueado ? t.menuTrancado : null,
      })),
      /* A própria ferramenta, com o mesmo rótulo que o painel usa no link de
         volta. Ela entra na lista dos dois lados: no painel como saída, aqui
         como o lugar onde a pessoa está. Um menu que não mostra onde você está
         é um menu que faz você procurar. */
      ferramenta: { rotulo: t.painelFerramenta, href: `/app?lang=${lang}` },
    },
    /* Sem cache em lugar nenhum: o menu depende de quem está logado, e um menu
       de outra pessoa servido do cache de um intermediário é vazamento. */
    { headers: { 'Cache-Control': 'no-store, private' } },
  );
}

/* O que toda rota do painel precisa antes de desenhar qualquer coisa.
 *
 * São quatro perguntas, sempre as mesmas: quem está logado, o que o banco sabe
 * dessa pessoa, o menu que ela vê, e — antes de tudo — se este ambiente sequer
 * tem a chave para perguntar. Cada rota respondendo isso por conta própria
 * seriam cinco cópias de um `try/catch` que precisa estar certo em todas.
 *
 * As três telas de recusa (sem sessão, sem chave, banco mudo) moram aqui pelo
 * mesmo motivo: uma delas escrita diferente numa rota é uma rota que responde
 * "não deu" onde as outras respondem "não deu, e é por isto".
 */
import { emailDaSessao } from '@/lib/supabase/servidor';
import { type Conta, contaDe, temChaveDeServico } from '@/lib/supabase/servico';
import type { Lang, Textos } from '@/lib/conta/textos';
import Painel from './Painel';

export type Carga =
  | { estado: 'fora' }
  | { estado: 'semChave'; email: string }
  | { estado: 'erro'; email: string; detalhe: string }
  | { estado: 'ok'; email: string; conta: Conta;
      tem: { time: boolean; plano: boolean; dono: boolean } };

/** O e-mail do dono da plataforma. Sem ele configurado, a aba de negócio não
 *  existe para ninguém — o que é o padrão certo: uma aba de administração que
 *  aparece por engano é pior que uma que falta. */
const DONO = (process.env.WALKSTAMP_DONO || '').trim().toLowerCase();

export async function carregar(): Promise<Carga> {
  const email = await emailDaSessao();
  if (!email) return { estado: 'fora' };
  if (!temChaveDeServico) return { estado: 'semChave', email };
  try {
    const conta = await contaDe(email);
    return {
      estado: 'ok', email, conta,
      tem: {
        time: Boolean(conta.time),
        plano: Boolean(conta.plano) && conta.motivo !== 'suspensa',
        dono: Boolean(DONO) && email.trim().toLowerCase() === DONO,
      },
    };
  } catch (e) {
    return { estado: 'erro', email, detalhe: String(e).slice(0, 200) };
  }
}

/** A casca, para as rotas que já sabem que a carga deu certo. */
export function Envolver({
  lang, t, slug, carga, children,
}: {
  lang: Lang; t: Textos; slug: string;
  carga: Extract<Carga, { estado: 'ok' }>;
  children: React.ReactNode;
}) {
  return (
    <Painel lang={lang} t={t} email={carga.email} slug={slug} tem={carga.tem}>
      {children}
    </Painel>
  );
}

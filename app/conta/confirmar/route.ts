/* A volta do link mágico.
 *
 * O Supabase manda um `token_hash` de uso único; esta rota troca ele por uma
 * sessão e grava o cookie httpOnly. O token some da URL no mesmo movimento —
 * um endereço com token dentro vai parar no histórico, no `Referer` e no print
 * que a pessoa manda pedindo ajuda.
 *
 * Ela fica FORA do `[lang]` de propósito: é uma rota, não uma página, e o
 * endereço dela está gravado dentro de e-mails já enviados. Mudar de lugar
 * quebraria os links que estão voando agora. O idioma viaja no `?lang=`.
 */
import { type EmailOtpType } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { clienteDoServidor } from '@/lib/supabase/servidor';
import { CAMINHO, ehLang, textos } from '@/lib/conta/textos';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const bruto = url.searchParams.get('lang') || 'pt';
  const lang = ehLang(bruto) ? bruto : 'pt';
  const t = textos(lang);
  const volta = (par?: string, valor?: string) =>
    NextResponse.redirect(new URL(
      CAMINHO[lang] + (par ? `?${par}=${encodeURIComponent(valor || '')}` : ''), url.origin));

  const token_hash = url.searchParams.get('token_hash');
  const type = (url.searchParams.get('type') || 'magiclink') as EmailOtpType;
  if (!token_hash) return volta('erro', t.erroLinkSemCodigo);

  const supa = await clienteDoServidor();
  const { error } = await supa.auth.verifyOtp({ type, token_hash });
  if (error) {
    /* Link velho ou já usado. É o caso comum e não é culpa de ninguém: o
       cliente de e-mail que "pré-visualiza" links gasta o token antes da
       pessoa clicar. Dizer isso é melhor que dizer "token inválido". */
    return volta('erro', t.erroLinkUsado);
  }
  return volta();
}

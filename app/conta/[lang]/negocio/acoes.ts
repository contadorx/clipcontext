'use server';
/* As ações do back-office. Hoje, uma: responder um chamado.
 *
 * A checagem do dono é feita AQUI, e não só na tela. Uma Server Action é um
 * endereço como qualquer outro — quem souber o identificador dela pode chamá-la
 * sem nunca ter visto a página. Esconder o formulário não é controle de acesso;
 * esta função é.
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { emailDaSessao } from '@/lib/supabase/servidor';
import { responderChamado } from '@/lib/supabase/servico';
import { ehLang, CAMINHO } from '@/lib/conta/textos';

const DONO = (process.env.WALKSTAMP_DONO || '').trim().toLowerCase();

export async function responder(form: FormData) {
  const lang = String(form.get('lang') || 'pt');
  const destino = `${CAMINHO[ehLang(lang) ? lang : 'pt']}/negocio/chamados`;

  const email = await emailDaSessao();
  const ehDono = Boolean(DONO) && String(email || '').trim().toLowerCase() === DONO;
  /* Sem dono configurado, ninguém responde — nem quem por acaso tenha o mesmo
     e-mail vazio da variável. É o mesmo padrão da aba: ausente é fechado. */
  if (!ehDono) redirect(CAMINHO[ehLang(lang) ? lang : 'pt']);

  const numero = String(form.get('numero') || '').trim();
  const texto = String(form.get('texto') || '').trim();
  if (!numero || !texto) redirect(`${destino}?erro=vazio`);

  let r: { ok?: boolean; erro?: string } = {};
  try {
    r = await responderChamado(numero, texto);
  } catch (e) {
    redirect(`${destino}?erro=${encodeURIComponent(String(e).slice(0, 120))}`);
  }
  if (r.erro) redirect(`${destino}?erro=${encodeURIComponent(r.erro)}`);

  /* A tela lê de uma função `stable` sem cache do Next, mas a rota é dinâmica e
     o roteador do cliente guarda a última resposta. Sem isto, responder e voltar
     mostra o chamado ainda em aberto — e a pessoa responde de novo. */
  revalidatePath(destino);
  redirect(`${destino}?feito=${encodeURIComponent(numero)}`);
}

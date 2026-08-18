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
import { avisarChamadoRespondido } from '@/lib/conta/aviso-chamado';

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

  let r: { ok?: boolean; erro?: string; email?: string | null } = {};
  try {
    r = await responderChamado(numero, texto);
  } catch (e) {
    redirect(`${destino}?erro=${encodeURIComponent(String(e).slice(0, 120))}`);
  }
  if (r.erro) redirect(`${destino}?erro=${encodeURIComponent(r.erro)}`);

  /* O aviso vai DEPOIS de a resposta estar gravada, e a falha dele nao desfaz
     nada: a resposta e o trabalho, o e-mail e a noticia. Sem isto, responder
     pelo painel grava a resposta e mais nada acontece — quem escreveu nao tem
     por que voltar a `/conta/chamados` para conferir. */
  try { await avisarChamadoRespondido(r.email, numero, String(form.get('idioma') || 'pt')); }
  catch { /* ja registrado no log la dentro; a resposta continua salva */ }

  /* A tela lê de uma função `stable` sem cache do Next, mas a rota é dinâmica e
     o roteador do cliente guarda a última resposta. Sem isto, responder e voltar
     mostra o chamado ainda em aberto — e a pessoa responde de novo. */
  revalidatePath(destino);
  redirect(`${destino}?feito=${encodeURIComponent(numero)}`);
}

/* ---------------------------------------------------------------- o blog */

import { salvar as salvarPost, publicar as publicarPost, apagar as apagarPost, paraSlug } from '@/lib/blog';

const IDIOMAS_POST = ['pt', 'en', 'es', 'de', 'fr'] as const;

async function souDono(lang: string) {
  const email = await emailDaSessao();
  const ehDono = Boolean(DONO) && String(email || '').trim().toLowerCase() === DONO;
  if (!ehDono) redirect(CAMINHO[ehLang(lang) ? lang : 'pt']);
}

export async function salvarPublicacao(form: FormData) {
  const lang = String(form.get('lang') || 'pt');
  await souDono(lang);
  const base = `${CAMINHO[ehLang(lang) ? lang : 'pt']}/negocio/blog`;

  const chave = paraSlug(String(form.get('chave') || ''));
  if (!chave) redirect(`${base}?erro=sem_chave`);

  /* Um post é uma coisa só, com as versões dentro. Salvar cada idioma como um
     registro próprio é como o alemão deste site ficou sem `hreflang`: duas
     linhas para a mesma coisa, uma atualizada e a outra não. */
  const versoes: Record<string, unknown> = {};
  for (const L of IDIOMAS_POST) {
    const titulo = String(form.get(`titulo_${L}`) || '').trim();
    versoes[L] = {
      titulo,
      /* O endereço sai do título quando ninguém digitou um. Publicado, ele NÃO
         se recalcula sozinho: mudar o endereço de um post que já está no ar
         quebra todo link que alguém já compartilhou. */
      slug: paraSlug(String(form.get(`slug_${L}`) || '') || titulo) || chave,
      resumo: String(form.get(`resumo_${L}`) || '').trim(),
      corpo: String(form.get(`corpo_${L}`) || ''),
    };
  }

  const tags = String(form.get('tags') || '').split(',')
    .map((s) => s.trim()).filter(Boolean);

  let r: { ok?: boolean; erro?: string } = {};
  try { r = await salvarPost(chave, String(form.get('autor') || ''), tags, versoes); }
  catch (e) { redirect(`${base}?erro=${encodeURIComponent(String(e).slice(0, 120))}`); }
  if (r.erro) redirect(`${base}?erro=${r.erro}&chave=${encodeURIComponent(chave)}`);

  revalidatePath(base);
  redirect(`${base}?feito=salvo&chave=${encodeURIComponent(chave)}`);
}

export async function alternarPublicacao(form: FormData) {
  const lang = String(form.get('lang') || 'pt');
  await souDono(lang);
  const base = `${CAMINHO[ehLang(lang) ? lang : 'pt']}/negocio/blog`;
  const chave = String(form.get('chave') || '');
  const pub = String(form.get('publicar') || '') === '1';

  let r: { ok?: boolean; erro?: string; idiomas?: string[] } = {};
  try { r = await publicarPost(chave, pub); }
  catch (e) { redirect(`${base}?erro=${encodeURIComponent(String(e).slice(0, 120))}`); }
  /* A recusa por idioma faltando vem do BANCO, não da tela. Escrita só aqui,
     ela valeria para este formulário e para mais nenhum caminho. */
  if (r.erro === 'falta_idioma') {
    redirect(`${base}?erro=falta_idioma&faltam=${encodeURIComponent((r.idiomas || []).join(','))}`);
  }
  if (r.erro) redirect(`${base}?erro=${r.erro}`);

  revalidatePath(base);
  redirect(`${base}?feito=${pub ? 'publicado' : 'rascunho'}`);
}

export async function apagarPublicacao(form: FormData) {
  const lang = String(form.get('lang') || 'pt');
  await souDono(lang);
  const base = `${CAMINHO[ehLang(lang) ? lang : 'pt']}/negocio/blog`;
  try { await apagarPost(String(form.get('chave') || '')); }
  catch (e) { redirect(`${base}?erro=${encodeURIComponent(String(e).slice(0, 120))}`); }
  revalidatePath(base);
  redirect(`${base}?feito=apagado`);
}

/* ------------------------------------------------------------- as figuras */

import { figuraAdd, figuraDel, definirCapa } from '@/lib/blog';
import { subirFigura, apagarFigura, extensaoDe, TETO_FIGURA } from '@/lib/supabase/figura';

export async function enviarFigura(form: FormData) {
  const lang = String(form.get('lang') || 'pt');
  await souDono(lang);
  const base = `${CAMINHO[ehLang(lang) ? lang : 'pt']}/negocio/blog`;
  const chave = String(form.get('chave') || '').trim();
  const volta = `${base}?chave=${encodeURIComponent(chave)}`;

  const arq = form.get('figura');
  if (!chave || !(arq instanceof File) || !arq.size) redirect(`${volta}&erro=sem_figura`);
  const f = arq as File;

  /* O tipo vem do ARQUIVO, e a extensão sai dele. Confiar no nome deixaria
     entrar um `.png` que é outra coisa — servido depois com o tipo errado. */
  const ext = extensaoDe(f.type);
  if (!ext) redirect(`${volta}&erro=tipo`);
  if (f.size > TETO_FIGURA) redirect(`${volta}&erro=grande`);

  /* O caminho leva o instante: uma figura trocada não pode reaproveitar o
     endereço da anterior, senão o cache de um ano serve a imagem velha. */
  const caminho = `${chave}/${Date.now()}.${ext}`;
  try {
    const url = await subirFigura(caminho, await f.arrayBuffer(), f.type);
    const r = await figuraAdd(chave, caminho, url, String(form.get('alt') || '').trim());
    if (r.erro) redirect(`${volta}&erro=${r.erro}`);
  } catch (e) {
    redirect(`${volta}&erro=${encodeURIComponent(String(e).slice(0, 120))}`);
  }
  revalidatePath(base);
  redirect(`${volta}&feito=figura`);
}

export async function removerFigura(form: FormData) {
  const lang = String(form.get('lang') || 'pt');
  await souDono(lang);
  const base = `${CAMINHO[ehLang(lang) ? lang : 'pt']}/negocio/blog`;
  const chave = String(form.get('chave') || '').trim();
  const caminho = String(form.get('caminho') || '');
  try {
    /* O arquivo primeiro, o registro depois. Na ordem inversa, um erro no meio
       deixaria o arquivo no balde sem ninguém apontando para ele — órfão que
       ninguém encontra para apagar. */
    await apagarFigura(caminho);
    await figuraDel(chave, caminho);
  } catch (e) {
    redirect(`${base}?chave=${encodeURIComponent(chave)}&erro=${encodeURIComponent(String(e).slice(0, 120))}`);
  }
  revalidatePath(base);
  redirect(`${base}?chave=${encodeURIComponent(chave)}&feito=figura_apagada`);
}

export async function escolherCapa(form: FormData) {
  const lang = String(form.get('lang') || 'pt');
  await souDono(lang);
  const base = `${CAMINHO[ehLang(lang) ? lang : 'pt']}/negocio/blog`;
  const chave = String(form.get('chave') || '').trim();
  try { await definirCapa(chave, String(form.get('url') || '')); }
  catch (e) { redirect(`${base}?chave=${encodeURIComponent(chave)}&erro=${encodeURIComponent(String(e).slice(0, 120))}`); }
  revalidatePath(base);
  redirect(`${base}?chave=${encodeURIComponent(chave)}&feito=capa`);
}

'use server';
/* Apagar o que é seu.
 *
 * A DEC-1 foi decidida em A — "nada do seu conteúdo sai sem um gesto seu", com
 * a matriz de exceções nomeada — e a DEC-3 fechou junto, também em A: o servidor
 * guarda o que a feature precisa, e a conta mostra o quê. O que torna A
 * defensável não é a tela que lista; é este arquivo funcionar.
 *
 * A regra do `acoes.ts` vale igual aqui, e aqui ela vale mais: **o e-mail de
 * quem apaga nunca vem do formulário.** Ele vem da sessão. O que vem do
 * formulário é a CONFIRMAÇÃO — a pessoa digita o próprio e-mail —, e o banco
 * compara os dois. Se o e-mail viesse do campo, um campo escondido trocado
 * apagaria o roteiro de outra pessoa, e este é o único botão do produto que
 * não tem desfazer.
 */
import { redirect } from 'next/navigation';
import { emailDaSessao } from '@/lib/supabase/servidor';
import { rpc } from '@/lib/supabase/servico';
import { apagarAnexo } from '@/lib/supabase/arquivo';
import { CAMINHO, type Lang, ehLang } from '@/lib/conta/textos';
import { enderecoDoItem } from '@/lib/conta/nav';

type Resposta = {
  erro?: string; ok?: boolean;
  faxina?: Array<{ id: number; caminho: string }>;
};

/* Os arquivos no balde saem depois que as linhas saíram — o banco só guardou o
   bilhete com o caminho. Uma falha aqui não desfaz o apagar: a fila do
   `anexo_orfao` tenta de novo, que é como o roteiro já faz. */
async function faxinar(orfaos: Resposta['faxina']) {
  if (!orfaos?.length) return;
  const feitos: number[] = [];
  for (const o of orfaos) {
    try { await apagarAnexo(o.caminho); feitos.push(o.id); }
    catch (e) {
      await rpc('walkstamp_anexo_faxinado', {
        p_ids: [o.id], p_erro: String((e as Error)?.message || e).slice(0, 200),
      }).catch(() => {});
    }
  }
  if (feitos.length) {
    await rpc('walkstamp_anexo_faxinado', { p_ids: feitos, p_erro: null }).catch(() => {});
  }
}

export async function apagarMeusDados(form: FormData): Promise<void> {
  const bruto = String(form.get('lang') || 'pt');
  const lang: Lang = ehLang(bruto) ? bruto : 'pt';
  const destino = enderecoDoItem('dados', lang);

  const email = await emailDaSessao();
  if (!email) redirect(CAMINHO[lang]);

  const confirmacao = String(form.get('confirmacao') || '');

  let r: Resposta;
  try {
    r = await rpc<Resposta>('walkstamp_apagar_meus_dados', {
      p_email: email, p_confirmacao: confirmacao,
    });
  } catch {
    redirect(`${destino}?erro=falhou`);
  }

  if (r.erro === 'confirmacao_nao_bate') redirect(`${destino}?erro=naoBate`);
  if (r.erro) redirect(`${destino}?erro=falhou`);

  await faxinar(r.faxina);
  redirect(`${destino}?feito=1`);
}

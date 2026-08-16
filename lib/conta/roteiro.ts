/* O roteiro de casos, do lado do servidor.
 *
 * O corte que define esta tela:
 *
 *   fica no servidor   o código do caso, o título, o sistema, o chamado,
 *                      quem é o responsável, quando ficou pronto, o nome do
 *                      arquivo gerado e a impressão digital dele
 *   nunca vai          o vídeo, os quadros, a transcrição, o documento
 *
 * A segunda lista continua morrendo no navegador de quem gravou. O que esta
 * tela guarda é a LISTA DE TAREFAS, não a prova — e a política de privacidade
 * diz isso com todas as letras, porque é a primeira coisa do cliente que passa
 * a existir num servidor nosso.
 *
 * Personal executa: roteiro próprio, link próprio, "feito" próprio.
 * Time coordena: roteiro compartilhado, caso atribuído a alguém, painel.
 */
import 'server-only';
import { rpc } from '@/lib/supabase/servico';
import type { Lang } from '@/lib/conta/textos';

export type Caso = {
  id: number;
  ordem: number;
  caso: string;
  titulo: string | null;
  cenario: string | null;
  chamado: string | null;
  sistema: string | null;
  responsavel: string | null;
  feito_em: string | null;
  feito_por: string | null;
  arquivo: string | null;
  impressao: string | null;
  observacao: string | null;
};

export type Roteiro = {
  id: number;
  nome: string;
  escopo: 'personal' | 'time';
  dono: string;
  criado_em: string;
  meu: boolean;
  casos: Caso[];
  erro?: string;
};

export type Resumo = {
  id: number; nome: string; escopo: 'personal' | 'time'; dono: string;
  criado_em: string; meu: boolean; total: number; feitos: number; meus: number;
};

export const meusRoteiros = (email: string) =>
  rpc<{ roteiros: Resumo[]; erro?: string }>('walkstamp_roteiro_meus', { p_email: email });

export const verRoteiro = (email: string, id: number) =>
  rpc<Roteiro>('walkstamp_roteiro_ver', { p_email: email, p_id: id });

/** O endereço público da tela, por idioma. Traduzido como o resto: quem lê em
 *  espanhol não deveria ter que reconhecer a palavra "roteiro". */
export const CAMINHO_ROTEIRO: Record<Lang, string> = {
  pt: '/conta/roteiro',
  en: '/en/account/cases',
  es: '/es/cuenta/casos',
};

/* O link que a tela gera para cada caso.
 *
 * É a peça central do desenho: em vez de a ferramenta ler planilha, a tela de
 * controle entrega um endereço com o caso já dentro. Quem executa clica, grava,
 * baixa — e a ferramenta não precisou saber o que é um roteiro.
 *
 * `rot` é o número do caso, e serve para a volta: depois de baixar, a
 * ferramenta oferece um link de retorno que marca o caso como feito. Ele viaja
 * sozinho, sem endereço de destino embutido — um `?voltar=` aberto seria um
 * redirecionamento que qualquer um escreve. */
export function linkDoCaso(c: Caso, lang: Lang, cenarioPadrao = 'evidencia'): string {
  const p = new URLSearchParams();
  p.set('lang', lang);
  p.set('modelo', c.cenario || cenarioPadrao);
  p.set('caso', c.caso + (c.titulo ? ' — ' + c.titulo : ''));
  if (c.sistema) p.set('sistema', c.sistema);
  if (c.chamado) p.set('chamado', c.chamado);
  p.set('rot', String(c.id));
  return `/app?${p.toString()}`;
}

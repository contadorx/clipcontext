/* A chave de serviço. Ela lê e escreve tudo, e por isso mora numa variável de
 * ambiente e nunca, em hipótese alguma, num arquivo do repositório nem num
 * componente que o navegador baixe.
 *
 * As funções que ela chama tiveram o acesso de `anon` e `authenticated`
 * revogado de propósito: `walkstamp_conta_do_usuario` recebe um e-mail e
 * devolve faturas, chamados e time daquele e-mail. Se o navegador pudesse
 * chamá-la, bastaria trocar o e-mail para ler a conta de outra pessoa. Quem
 * decide de quem é o e-mail é o servidor, a partir da sessão — e é por isso que
 * a chamada precisa vir de cá.
 */
import 'server-only';

const URL_BASE = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const temChaveDeServico = Boolean(URL_BASE && CHAVE);

/** Chama uma função do banco com a chave de serviço. Lança se faltar segredo —
 *  em silêncio, isto viraria uma tela vazia que ninguém sabe explicar. */
export async function rpc<T = unknown>(nome: string, args: Record<string, unknown>): Promise<T> {
  if (!temChaveDeServico) {
    throw new Error(
      'falta SUPABASE_SERVICE_ROLE_KEY (e SUPABASE_URL) no ambiente — ' +
      'a área do cliente não consegue ler nada sem ela',
    );
  }
  const r = await fetch(`${URL_BASE}/rest/v1/rpc/${nome}`, {
    method: 'POST',
    headers: {
      apikey: CHAVE!,
      Authorization: `Bearer ${CHAVE}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`${nome}: ${r.status} ${(await r.text()).slice(0, 300)}`);
  return (await r.json()) as T;
}

export type Conta = {
  email: string;
  plano: string | null;
  assentos: number;
  dias: number;
  cliente: string | null;
  motivo: string;
  papel: string;
  vence_em: string | null;
  emissoes: number;
  assinante: boolean;
  perfil: { cliente: string | null; config: Record<string, string> | null; modelos: unknown[] };
  faturas: Array<{
    numero: string | null; valor: number; moeda: string; status: string;
    vence_em: string | null; pago_em: string | null; nf_url: string | null;
    nf_numero: string | null; criado_em: string;
  }>;
  chamados: Array<{
    numero: string; status: string; tipo: string; texto: string;
    resposta: string | null; criado_em: string;
  }>;
  /** A média real das últimas vinte respostas, com o tamanho da amostra junto.
   *  `quantos` existe para a tela poder calar a boca quando não há histórico —
   *  `horas: 0` sozinho é ambíguo entre "nunca respondi" e "respondi na hora". */
  resposta: { horas: number; quantos: number } | null;
  time: {
    cliente?: string; assentos?: number; usados?: number; dias?: number;
    dominios?: string[];
    /* O padrão do documento. Os cinco primeiros dizem com que CARA ele sai; os
       quatro últimos, com que FORMA — e é a forma que uma empresa padroniza. */
    config?: {
      empresa?: string; logo_url?: string; cenario?: string; rotulo?: string; ambiente?: string;
      papel?: string; layout?: string; hash?: boolean; numerar?: boolean;
    };
    pessoas?: Array<{
      email: string; papel: string; ativo: boolean; admin: boolean;
      ultima_em: string | null; vence_em: string | null;
    }>;
    /* Estes dois já vinham do banco e não tinham onde aparecer: eram a parte do
       painel que só existia na `/time`. Ficam aqui porque o painel passou a
       morar num lugar só, e um painel a menos é uma divergência a menos. */
    modelos?: Array<{ id: number; nome: string; escopo: string; dados: unknown }>;
    emissoes?: Array<{ email: string; vence_em: string | null; dias: number | null; criado_em: string }>;
  } | null;
};

export const contaDe = (email: string) => rpc<Conta>('walkstamp_conta_do_usuario', { p_email: email });

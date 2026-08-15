import { cache } from "react";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export type PortalSessao = {
  empresaId: string;
  usuarioId: string;
  email: string;
  nome: string | null;
};

/**
 * Nome do cookie de sessão, **por portal**.
 *
 * Um cookie único (`fx_portal_sessao`) parecia suficiente e não era: é comum o
 * mesmo cliente ter dois CNPJs no mesmo escritório, e portanto dois portais e
 * dois magic links. Com um cookie só, entrar no portal da segunda empresa
 * derrubava a sessão da primeira — e a tela de acesso não oferece reenvio de
 * propósito, então a saída era telefonar para o contador a cada troca.
 *
 * O nome carregar o token também elimina a necessidade de amarrar sessão e
 * token por fora: o cookie que existe é, por construção, o daquele portal.
 */
export function cookieSessao(token: string): string {
  return `fx_ps_${token.replace(/[^a-zA-Z0-9]/g, "").slice(0, 64)}`;
}

/** Dados do portal, já com a empresa a que o token pertence. */
export type PortalDados = Record<string, unknown> & { empresa?: string | null };

/**
 * Sessão válida **para este portal**, ou `null`.
 *
 * É esta função — e não o token da URL — que decide se a pessoa vê o financeiro
 * do cliente. Três condições, todas necessárias:
 *
 *  1. existe cookie de sessão para ESTE token;
 *  2. a sessão é válida no banco;
 *  3. o usuário do portal continua `ativo`.
 *
 * A terceira é o que faz "Revogar" revogar de verdade. Antes o acesso era só o
 * link: a lista de e-mails autorizados era decorativa, e a tela de Portal do
 * cliente dizia "Revogar" para um botão que não tirava o acesso de ninguém.
 *
 * Falha fechada em tudo: erro de leitura, chave de serviço ausente, linha
 * sumida. O portal expõe o financeiro de terceiros — aqui "não sei" não pode
 * significar "pode entrar". A tela de acesso explica o que fazer.
 *
 * `cache()` do React dedupa por requisição: `generateMetadata` roda antes do
 * componente e precisa da mesma sessão que a página vai usar. Sem isto, abrir o
 * portal custava seis idas ao banco onde duas bastam — e cada consulta a mais é
 * uma chance a mais de falhar num caminho que agora falha fechado.
 */
export const sessaoDoPortal = cache(async (tokenDaUrl: string): Promise<PortalSessao | null> => {
  if (!tokenDaUrl) return null;
  const sessaoToken = cookies().get(cookieSessao(tokenDaUrl))?.value;
  if (!sessaoToken) return null;

  /*
    Chave de SERVIÇO, não a anônima — e isso é uma trava, não um detalhe.

    A validação era feita com o cliente anônimo só porque o servidor tinha um à
    mão. Consequência: `portal_validar_sessao` precisava de `execute` para o
    `anon`, cuja chave está no pacote do navegador — e a função devolve
    `empresa_id`, `email` e o id do usuário. Qualquer pessoa podia bater na RPC
    direto, fora deste caminho, chutando tokens de sessão sem limite nenhum, e
    um acerto vazaria a identidade do cliente.

    O navegador NUNCA chama estas RPCs: quem chama é este arquivo (servidor) e
    a rota de entrada. Com a chave de serviço aqui, o `anon` pode ser revogado
    das duas — é o que faz `fx_grants_portal_validar.sql`.
  */
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    console.error("portal: chave de serviço ausente — acesso negado por precaução");
    return null;
  }

  const { data, error } = await admin.rpc("portal_validar_sessao", { p_token: sessaoToken });
  const row = (Array.isArray(data) ? data[0] : data) as
    | {
        valido: boolean;
        empresa_id: string;
        portal_usuario_id: string;
        email: string;
        nome: string | null;
      }
    | null;
  if (error) {
    // sem isto, uma RPC quebrada trancava TODOS os clientes fora sem deixar
    // rastro — a tela diria "peça acesso" para sempre e ninguém saberia por quê
    console.error("portal: validação de sessão falhou", error.message);
    return null;
  }
  if (!row || !row.valido) return null;

  const u = await admin.from("portal_usuarios").select("ativo").eq("id", row.portal_usuario_id).maybeSingle();
  if (u.error) {
    console.error("portal: não foi possível conferir se o acesso continua ativo", u.error.message);
    return null;
  }
  if (!u.data || u.data.ativo === false) return null;

  return {
    empresaId: row.empresa_id,
    usuarioId: row.portal_usuario_id,
    email: row.email,
    nome: row.nome,
  };
});

/**
 * Dados do portal, lidos com a chave de serviço.
 *
 * `portal_dados` nasceu executável pelo `anon`, e a chave anônima está no
 * pacote do navegador: exigir sessão só no componente React não protegia nada —
 * quem tivesse o link chamava a RPC direto e recebia o financeiro inteiro em
 * JSON. O login obrigatório existia no HTML e não nos dados.
 *
 * Quem consulta agora é o servidor, com a chave de serviço, e **só depois** de
 * `sessaoDoPortal` aprovar. O `execute` do `anon` foi revogado de verdade em
 * 14/08 — a fumaça contra o banco mostrou que o `fx_portal_login.sql` nunca
 * tinha sido aplicado, e o caminho direto ficou aberto todo esse tempo. Lição
 * registrada: migration no repositório não é migration no banco.
 */
export const dadosDoPortal = cache(async (token: string, ano: number): Promise<PortalDados | null> => {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("portal_dados", { p_token: token, p_ano: ano });
    if (error) {
      console.error("portal: portal_dados falhou", error.message);
      return null;
    }
    return (data as PortalDados | null) ?? null;
  } catch {
    console.error("portal: chave de serviço ausente — portal indisponível");
    return null;
  }
});

/**
 * A chave de serviço está configurada?
 *
 * O portal passou a depender dela (é ela que confere revogação e lê os dados
 * sem passar pelo `anon`). Sem a chave, `sessaoDoPortal` devolve `null` para
 * todo mundo — e a tela de "peça acesso" faria o cliente pedir um link que
 * também não vai funcionar, num laço de suporte sem fim. Melhor dizer que o
 * problema é do lado de cá.
 */
export function portalConfigurado(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

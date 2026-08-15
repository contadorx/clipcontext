import { URL_APP } from "@/lib/hosts";

/**
 * Endereço absoluto do PRODUTO, para links que saem daqui de dentro.
 *
 * Existe porque a separação em dois domínios criou uma armadilha de nome:
 * `NEXT_PUBLIC_SITE_URL` sempre significou "a base dos links do app", e depois
 * do split passou a parecer que significa "o site institucional". Um e-mail de
 * lembrete de boleto montado sobre o domínio institucional manda o pagador para
 * `financeirox.com.br/b/<token>` — que é o site, não o produto, e não tem essa
 * página. O link chega quebrado a quem ia pagar.
 *
 * Toda geração de link em job de fundo (cron, digest, régua) passa por aqui.
 * Rota que nasce de um clique no navegador deve continuar usando
 * `new URL(req.url).origin`, que já sai no host certo por construção.
 */
export function urlDoApp(): string {
  /*
    `NEXT_PUBLIC_SITE_URL` continua tendo prioridade para não quebrar quem já a
    tem configurada — mas agora ela precisa apontar para o host do app.
  */
  const explicita = (process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/+$/, "");
  if (explicita) return explicita;
  return URL_APP;
}
